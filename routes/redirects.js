const express = require('express');
const router = express.Router();

const access = require('../modules/access').Editor;

const RedC = require('../controllers/RedirectController');


router.post('/find', access, (req, res, next) => {
  RedC.find(req.body.old, req.body.locale, req.body.subdomain)
      .then((item) => res.status(200).json(item))
      .catch((e)=> res.status(500).json(e.message));
});

router.post('/set', access, (req, res, next) => {
  RedC.set(req.body.old, req.body.new, req.body.locale, req.body.subdomain)
      .then((item) => res.status(200).json(item))
      .catch((e)=> res.status(500).json(e.message));
});

router.delete('/remove', access, (req, res, next) => {
  RedC.remove(req.body.old, req.body.locale, req.body.subdomain)
      .then((_) => res.sendStatus(200))
      .catch((e)=> res.status(500).json(e.message));
});


module.exports = router;
