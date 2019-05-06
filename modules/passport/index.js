const passport = require('passport');
const bcrypt = require('bcrypt');
const UserController = require('../../controllers/UserController');
const LocalStrategy = require('passport-local').Strategy;
const LocalLogger = require('../logger');
const log = new LocalLogger(module);

passport.use('local', new LocalStrategy({
  // by default, local strategy uses username and password,
  // we will override with email
  usernameField: 'email',
  passwordField: 'password',
  passReqToCallback: true, // pass back the entire request to the callback
},
(req, username, password, done) => { // callback (done) has (error, user, info)
  UserController.getbyEmail(username)
      .then((user) => {
      // if no user is found, return the message
        if (!user || !user.enabled) {
          log.info(`PASSPORT: user ${username} not found.`);
          return done(null, null, 'wrong password'); // to avoid bruteforce
        }

        // if the user is found but the password is wrong
        if (!bcrypt.compareSync(password, user.password)) {
          log.info(`PASSPORT: user ${username} - wrong password.`);
          return done(null, null, 'wrong password');
        }

        // all is fine, return successful user
        log.info(`PASSPORT: user ${username} - login SUCCESS.`);
        return done(null, user);
      })
      .catch((e) => {
        log.error(e);
        done(e);
      });
}));

passport.serializeUser((user, done) => {
  done(null, JSON.stringify(user));
});

passport.deserializeUser((data, done) => {
  try {
    done(null, JSON.parse(data));
  } catch (e) {
    done(e);
  }
});

module.exports = () => {
};
