const {createLogger, format, transports} = require('winston');
const {combine, timestamp, label, printf} = format;

const myFormat = printf(({level, label, message, timestamp}) => {
  return `${timestamp} ${level}: ${message} [${label}]`;
});

const env = process.env.NODE_ENV;

module.exports = class Logger {
  constructor(module) {

    return createLogger({
      format: combine(
          label({label: module.filename}),
          timestamp(),
          myFormat
      ),
      transports: [
        new transports.Console({
          colorize: true,
          level: env === 'development' ? 'debug' : 'error',
        }),
        new transports.File({
          name: 'app-info',
          level: 'info',
          filename: 'logs/main.log',
          maxsize: 1000000,
        }),
        new transports.File({
          name: 'app-error',
          level: 'error',
          filename: 'logs/error.log',
          maxsize: 1000000,
        }),
      ],
    });
  }
};
