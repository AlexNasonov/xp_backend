const express = require('express');
const router = express.Router();


const config = require('../modules/config');
const access = require('../modules/access');
const UserC = require('../controllers/UserController');

const LocalLogger = require('../modules/logger');
const log = new LocalLogger(module);

const editableSettings = [
  'articlesSelectedTags',
  'subdomains',
  'locales',
  'regions',
  'mirrors']

router.get('/settings', access.Editor, (req, res, next) => {
  try {
    const params = {};
    for (const i of editableSettings) {
      params[i] = config.get(i);
    }
    res.status(200).json(params);
  } catch (e) {
    res.status(500).json(e.message);
  }
});

router.post('/settings', access.Admin, (req, res, next) => {
  try {
    for (const i of editableSettings) {
      if (req.body[i]) config.set(i, req.body[i]);
    }
    config.save();
    res.sendStatus(200);
  } catch (e) {
    res.status(500).json(e.message);
  }
});

router.get('/users', access.Admin, (req, res, next) => {
  if (req.query.email) {
    UserC
        .getbyEmail(req.query.email)
        .then((data) => {
          const result = {
            count: (data) ? 1: 0,
            rows: [],
          };
          if (data) result.rows.push(data);
          res.status(200).json(result);
        })
        .catch((e) => {
          res.status(500).json(e.message);
        });
  } else {
    UserC
        .getAll(req.query.limit, req.query.offset, req.query.desc, req.query.role, req.query.filter)
        .then((data) => res.status(200).json(data))
        .catch((e) => {
          res.status(500).json(e.message);
        });
  }
});

router.delete('/users', access.Admin, (req, res, next) => {
  UserC
      .delete(req.query.email)
      .then(() => res.sendStatus(200))
      .catch((e) => {
        res.status(500).json(e.message);
      });
});

router.post('/users', access.Admin, (req, res, next) => {
  UserC
      .setRole(req.body.email, req.body.role)
      .then((data) => {
        if (data === 'bad role') return res.status(400).json(data);
        if (data === 'no user') return res.status(404).json(data);
        res.sendStatus(200);
      })
      .catch((e) => {
        res.status(500).json(e.message);
      });
});


module.exports = router;
