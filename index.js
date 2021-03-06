module.exports = (rootPath, certificate, customRouter) => {
  const customPaths = ['public', 'views', 'logs'];
  const path = require('path');
  const paths = {
    config: path.join(rootPath, 'config.json'),
  };

  for (const i of customPaths) {
    paths[i] = path.join(rootPath, i);
    process.env[i+'Path'] = paths[i];
  }

  // config
  const config = require('./modules/config');
  // set config
  config.argv()
      .env()
      .file({file: paths.config});


  /**
 *  IMPORTS & VARIABLES
 */
  const express = require('express');
  const favicon = require('serve-favicon');
  const cors = require('cors');
  const cookieParser = require('cookie-parser');
  const bodyParser = require('body-parser');
  const debug = require('debug')('http');
  const http = require('http');
  const https = require('https');

  // system loggers
  const morganLogger = require('morgan');

  // http logger
  const Logger = require('./modules/logger');

  // main logger, f.e.: log.error('error');
  const log = new Logger(module);

  // web sessions
  const session = require('express-session');

  // ORM and db session store
  const sequelize = require('./modules/sequelize').sequelize;
  const SequelizeStore = require('connect-session-sequelize')(session.Store);

  // passport
  const passport = require('passport');


  // Express routes
  const routes = {
    pages: require('./routes/pages'),
    api: {
      entrance: require('./routes/entrance'),
      editor: require('./routes/editor'),
      files: require('./routes/files'),
      redirects: require('./routes/redirects'),
      admin: require('./routes/admin'),
    },
  };

  const predefined = require('./modules/sequelize/predefined');

  // Set CHMOD for public folder, create logs folder
  const fse = require('fs-extra');

  const compression = require('compression');

  const app = express();
  app.use(compression());
  app.use(favicon(path.join(paths.public, 'favicon.ico')));

  /**
 * APPLICATION SETUP
 */


  for (const i of customPaths) {
    fse.ensureDir(paths[i], 0o777);
  }

  for (const i of ['', './sitemaps', './robots', './images']) {
    fse.ensureDir(path.join(paths.public, './files', i), 0o777);
  }


  // view engine setup
  app.set('views', paths.views);
  app.set('view engine', 'ejs');

  app.use(morganLogger('dev'));
  app.use(bodyParser.json({limit: '500mb'}));
  app.use(bodyParser.urlencoded({limit: '500mb', extended: true, parameterLimit: 50000}));
  app.use(cookieParser(config.get('appName')));
  app.use('/public', express.static(paths.public, {fallthrough: false}));

  // setup sessions
  app.use(session({
    secret: config.get('appName'),
    resave: false,
    saveUninitialized: false,

    // The interval at which to cleanup expired sessions in milliseconds.
    checkExpirationInterval: 15 * 60 * 1000,

    // The maximum age (in milliseconds) of a valid session.
    expiration: 24 * 60 * 60 * 1000,
    store: new SequelizeStore({
      db: sequelize,
    }),
  }));


  // sequelize({force:true}) used to destroy and rebuild DB each time on start
  if (!process.env.TEST_ENV) {
    sequelize.sync({force: false})
        .then((_) => predefined.run());
  }

  // setup CORS
  const corsOptions = {
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'X-Requested-With',
      'X-HTTP-Method-Override',
      'Content-Type',
      'Accept',
      'Content-Length',
      'Origin'],
    credentials: true,
    origin: true,
  };
  app.options('*', cors(corsOptions));
  app.use(cors(corsOptions));

  // use passport
  app.use(passport.initialize());
  app.use(passport.session());
  require('./modules/passport')(passport);

  // error handlers
  // development error handler will print stacktrace
  // production error handler - no stacktraces leaked to user
  app.use(function(err, req, res, next) {
    const error = (['development', 'staging'].includes(app.get('env'))) ? err : {};
    log.error(err.message);
    log.error(err.stack);
    res.status(error.status || 500);
    res.send(error.message+'\n\n'+error);
  });

  // use routes
  if (customRouter) app.use(customRouter);
  for (const i of Object.keys(routes.api)) {
    app.use('/api/' + i, routes.api[i]);
  }
  app.use('/', routes.pages);


  // set port
  const port = normalizePort(process.env.PORT || config.get('port'));
  app.set('port', port);

  // create HTTP server.
  let httpsOptions = undefined;
  if (certificate) {
    if (certificate.key && certificate.cert) {
      httpsOptions = {
        key: fse.readFileSync(certificate.key),
        cert: fse.readFileSync(certificate.cert),
      };
    } else if (certificate.pfx) httpsOptions = {pfx: fse.readFileSync(certificate.pfx)};
  }

  const server = (httpsOptions)
      ? https.createServer(httpsOptions, app)
      : http.createServer(app);
  server.listen(port);
  server.on('error', onError);
  server.on('listening', onListening);


  /**
   * UTILITY FUNCTIONS
   *
   * Normalize a port into a number, string, or false.
   * @return port number or false
   */
  function normalizePort(val) {
    const port = parseInt(val, 10);

    if (isNaN(port)) {
      // named pipe
      return val;
    }

    if (port >= 0) {
      // port number
      return port;
    }

    return false;
  }

  /**
   * Event listener for HTTP server "error" event.
   */
  function onError(error) {
    if (error.syscall !== 'listen') {
      throw error;
    }

    const bind = typeof port === 'string'
      ? 'Pipe ' + port
      : 'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
      case 'EACCES':
        log.error('ERROR' + bind + ' requires elevated privileges');
        process.exit(1);
        break;
      case 'EADDRINUSE':
        log.error('ERROR' + bind + ' is already in use');
        process.exit(1);
        break;
      default:
        throw error;
    }
  }

  /**
   * Event listener for HTTP server "listening" event.
   */
  function onListening() {
    const addr = server.address();
    const bind = typeof addr === 'string'
      ? 'pipe ' + addr
      : 'port ' + addr.port;
    debug('Listening on ' + bind);
  }


  return app;
};


