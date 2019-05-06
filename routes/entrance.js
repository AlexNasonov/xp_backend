const express = require('express');
const router = express.Router();
const passport = require('passport');
const LocalLogger = require('../modules/logger');
const log = new LocalLogger(module);
const UserC = require('../controllers/UserController');


router.post('/signup', (req, res, next) => {
  if (req.body.password.length < 8) res.sendStatus(400);
  else {
    UserC.signup(req.body.email, req.body.password)
        .then((data) => {
          if (!data) res.status(409).json(`User ${req.body.email} already exists`);
          else res.status(200).json(req.body.email);
        })
        .catch((e) => {
          const code = (e.name === 'SequelizeValidationError')? 400: 500;
          res.status(code).json(e.message);
        });
  }
});


router.post('/signin', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.sendStatus(401);

    const sessionUser = UserC.serializeUser(user);

    req.login(sessionUser, (loginError) => {
      if (!loginError) {
        log.info('SESSION: Session user now logged in!');
        res.status(200).json(sessionUser);
      } else next(loginError);
    });
  })(req, res, next);
});


router.post('/signout', (req, res) => {
  req.logout();
  res.sendStatus(200);
});

router.get('/recover', (req, res, next) => {
  UserC.requestNewPassword(req.query.email)
      .then((d) => {
        if (d === 'no user' ) return res.sendStatus(404);
        if (d === 'mail sent') return res.sendStatus(200);
      })
      .catch((e) => {
        res.status(500).json(e.message);
      });
});

router.put('/recover', (req, res, next) => {
  UserC.setNewPassword(req.body.email, req.body.password, req.body.code)
      .then((d) => {
        if (d === 'no user' || d === 'wrong code') {
          log.info(`User ${req.body.email} password change failed: ${d}`);
          res.sendStatus(404);
        }
        if (d === 'success') res.sendStatus(200);
      })
      .catch((e) => {
        res.status(500).json(e.message);
      });
});

router.get('/whoami', (req, res, next) => {
  if (!req.user) res.sendStatus(401);
  else res.status(200).json(req.user);
});

module.exports = router;
