const express = require('express');
const router = express.Router();

const Logger = require('../modules/logger');
const log = new Logger(module);

const access = require('../modules/access').Editor;
const config = require('../modules/config');
const entities = config.get('entities');

const TagC = require('../controllers/TagController');
const eCtrls = {
  chunks: require('../controllers/ChunkController'),
  pages: require('../controllers/PageController'),
  articles: require('../controllers/ArticleController'),
};

eCheck = function(req, res, next) {
  if (entities.indexOf(req.params.entity) === -1) res.sendStatus(404);
  else return next();
};

setFilters = (query) => {
  const filters = {};
  for (const i of ['ID', 'URL', 'Header', 'Summary', 'Content', 'Tag', 'Locale', 'Subdomain', 'Published']) {
    const f = 'filter'+i;
    filters[i.toLowerCase()] = query[f];
  }
  return filters;
};

/**
 * OPERATIONS WITH A LIST OF ITEMS
 */
router.get('/:entity', access, eCheck, (req, res, next) => {
  const filters = setFilters(req.query);
  eCtrls[req.params.entity]
      .getAll(parseInt(req.query.limit), parseInt(req.query.offset), req.query.order, req.query.desc, filters)
      .then((data) => res.status(200).json(data))
      .catch((e) => {
        res.status(500).json(e.message);
      });
});

// TODO: add relevant functions to all controllers
router.delete('/:entity', access, eCheck, (req, res, next) => {
  const filters = setFilters(req.query);
  eCtrls[req.params.entity]
      .deleteAll(filters)
      .then((n) => res.status(200).json({rows: n}))
      .catch((e) => {
        res.status(500).json(e.message);
      });
});

/**
 * TAGS CALLS
 */
router.get('/:entity/tags', access, eCheck, (req, res, next) => {
  TagC.getAll(req.params.entity, parseInt(req.query.limit), parseInt(req.query.offset), req.query.order, req.query.desc, req.query.filterID)
      .then((data) => res.status(200).json(data))
      .catch((e) => {
        res.status(500).json(e.message);
      });
});

router.get('/:entity/tags/:tagID', access, eCheck, (req, res, next) => {
  const r = /^\w+$/;
  if (!r.test(req.params.tagID)) {
    const em = 'id must contain only letters and numbers';
    log.error(em);
    return res.status(500).json(em);
  }

  TagC.get(req.params.entity, req.params.tagID, req.query.description)
      .then((tag) => res.status(200).json(tag))
      .catch((e) => {
        res.status(500).json(e.message);
      });
});

router.delete('/:entity/tags/:tagID', access, eCheck, (req, res, next) => {
  TagC.delete(req.params.entity, req.params.tagID)
      .then(() => res.sendStatus(200))
      .catch((e) => {
        res.status(500).json(e.message);
      });
});


/**
 * CALLS PER ITEM
 */

router.get('/:entity/:entityID', access, eCheck, (req, res, next) => {
  eCtrls[req.params.entity]
      .get(req.params.entityID, req.query.render) // render is viable only for chunks and pages
      .then((data) => {
        if (!data) res.sendStatus(404);
        else res.status(200).json(data);
      })
      .catch((e) => {
        res.status(500).json(e.message);
      });
});

router.post('/:entity/:entityID', access, eCheck, (req, res, next) => {
  const r = /^\w+$/;
  if (!r.test(req.params.entityID)) {
    const em = 'id must contain only letters and numbers';
    log.error(em);
    return res.status(500).json(em);
  }

  eCtrls[req.params.entity]
      .add(req.params.entityID, req.body)
      .then((data) => res.status(200).json(data))
      .catch((e) => {
        res.status((e.status === 409) ? 409 : 500).json(e.message);
      });
});

router.put('/:entity/:entityID', access, eCheck, (req, res, next) => {
  eCtrls[req.params.entity]
      .update(req.params.entityID, req.body)
      .then((data) => {
        if (!data) res.sendStatus(404);
        else res.status(200).json(data);
      })
      .catch((e) => {
        res.status(500).json(e.message);
      });
});

router.delete('/:entity/:entityID', access, eCheck, (req, res, next) => {
  eCtrls[req.params.entity]
      .delete(req.params.entityID)
      .then(() => res.sendStatus(200))
      .catch((e) => {
        res.status(500).json(e.message);
      });
});

router.get('/:entity/:entityID/tags', access, eCheck, (req, res, next) => {
  eCtrls[req.params.entity]
      .getTags(req.params.entityID, parseInt(req.query.limit), parseInt(req.query.offset), req.query.order, req.query.desc, req.query.filterID)
      .then((data) => res.status(200).json(data))
      .catch((e) => {
        res.status(500).json(e.message);
      });
});

module.exports = router;
