const express = require('express');
const fs = require('fs');
const path = require('path');
const util = require('util');
const readDir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const router = express.Router();
const LocalLogger = require('../modules/logger');
const log = new LocalLogger(module);

const leadTracer = require('../modules/leads').LeadTracer;

const models = require('../modules/sequelize');

const config = require('../modules/config');
const host = config.get('host.production');
const mirrors = config.get('mirrors');
const locales = config.get('locales');
const regions = config.get('regions');
const subdomains = config.get('subdomains');
const selTags = config.get('articlesSelectedTags') || [];

prepareLocaleSet = (prefix, strict) => {
  const l = [];
  const pr = prefix || '';
  for (const i of locales) {
    let ls = `/${i}-${i}/${pr}`;
    if (!strict) ls = ls+'*';
    l.push(ls);
  }
  for (const i of regions) {
    let rs = `/en-${i}/${pr}`;
    if (!strict) rs = rs+'*';
    l.push(rs);
  }
  return l;
};

setDefRL = (h) => {
  let rl = [locales[0], regions[0]];
  if (h !== host) {
    for (const i of mirrors) {
      if (i[0] === h) rl = i[1].split('-');
    }
  }
  return rl.reverse();
};

setRLUrl = (reqPath, slice) =>{
  const sPath = reqPath.split('/');
  const [locale, region] = sPath[1].split('-');
  const url = '/'+sPath.slice(slice).join('/');
  return [region, locale, url];
};

setParams = (url, locale, sd) => {
  const params = {where: {
    locale: locale,
    published: true,
    subdomain: (sd && sd.length>0 && subdomains.includes(sd[0]))? sd[0] : subdomains[0],
  }};
  if (url) params.where.url = url;
  return params;
};

setAlts = (locale, url) => {
  const l = [];
  for (const i of regions) l.push(`/${locale}-${i}${url}`);
  return l;
};

setData = (region, locale, instance, host, url) => {
  let h; let p;
  if (process.env.NODE_ENV === 'development' || process.env.TUNNEL_ENV) {
    h = config.get('host')['development']+':'+config.get('port');
    p = 'http://';
  } else {
    h = host;
    p = (process.env.NODE_ENV === 'staging') ? 'http://' : 'https://';
  }

  return {
    region: region,
    locale: locale,
    title: instance.title,
    description: instance.description,
    keywords: instance.keywords,
    og_image_url: instance.og_image_url,
    og_image_height: instance.og_image_height,
    og_image_width: instance.og_image_width,
    css: instance.css,
    host: h,
    url: url,
    base_url: p+h,
    alts: setAlts(locale, url),
  };
};

set404 = () => {
  const e = new Error();
  e.status = 404;
  return e;
};

setBlogPage = (subdomains, pageNumber, region, locale, host, url) => {
  const params = setParams(false, locale, subdomains);
  const pn = (pageNumber) ? parseInt(pageNumber)-1 : 0;
  params.limit = 20;
  params.offset = pn*params.limit;
  params.order = [['createdAt', 'DESC']];
  let data;
  return new Promise((resolve, reject)=>{
    models.Page.findOne({where: {
      url: '/blog',
    }})
        .then((page) => {
          if (!page) reject(set404());
          data = setData(region, locale, page, host, '/blog');
          return models.Article.findAndCountAll(params);
        })
        .then((articles) =>{
          data.content = articles;
          data.limit = params.limit;
          resolve(data);
        })
        .catch((e) =>{
          reject(e);
        });
  });
};

setPostPage = (subdomains, region, locale, host, url, tag) =>{
  const params = setParams(url, locale, subdomains);
  params.include = [{
    model: models.Page,
    attributes: ['css'],
  },
  {
    model: models.Tag,
    attributes: ['id'],
    through: {attributes: []},
    where: {id: tag},
  }];
  return new Promise((resolve, reject) => {
    models.Article.findOne(params)
        .then((article) =>{
          if (!article) reject(set404());
          const data = setData(region, locale, article, host, '/'+tag+url);
          data.content = article.body;
          data.css = article.page.css;
          data.pageId = article.pageId;
          resolve(data);
        })
        .catch((e) =>{
          reject(e);
        });
  });
};

setCustomPage = (subdomains, region, locale, host, url) => {
  return new Promise((resolve, reject) => {
    models.Page.findOne(setParams(url, locale, subdomains))
        .then((page) =>{
          if (!page) reject(set404());
          const data = setData(region, locale, page, host, url);
          data.pageId = page.id;
          resolve(data);
        })
        .catch((e) =>{
          reject(e);
        });
  });
};


setIndexPage = (subdomains, region, locale, host, url) => {
  let data;
  return new Promise((resolve, reject) => {
    models.Page.findOne(setParams(url, locale, subdomains))
        .then((page) =>{
          if (!page) reject(set404());
          data = setData(region, locale, page, host, url);
          data.pageId = page.id;
          return models.Tag.findByPk('promo', {include: [{
            model: models.Article,
            where: {locale: locale},
            attributes: ['url', 'header', 'summary', 'og_image_url', 'createdAt'],
            through: {attributes: []},
          }],
          order: [[models.Article, 'header', 'ASC']],
          });
        })
        .then((tag)=> {
          data.promo = (tag) ? tag.articles : undefined;
          resolve(data);
        })
        .catch((e) =>{
          reject(e);
        });
  });
};

/**
 * LOCALE DEFINED IN URL
 */

router.get(prepareLocaleSet('blog', true), leadTracer, (req, res, next) => {
  const [region, locale, url] = setRLUrl(req.path, 2);
  setBlogPage(req.subdomains, req.query.page, region, locale, req.hostname, url)
      .then((data)=> {
        const d = data;
        d.base_url = data.base_url + `/`+data.locale+'-'+data.region;
        return res.render('pages/blog', d);
      })
      .catch((e) =>{
        if (e.status === 404) return res.status(e.status).send('URL not found');
        log.error(e.message);
        return next(e);
      });
});


for (const tag of selTags) {
  router.get(prepareLocaleSet(tag+'/'), leadTracer, (req, res, next) => {
    const [region, locale, url] = setRLUrl(req.path, 3);
    setPostPage(req.subdomains, region, locale, req.hostname, url, tag)
        .then((data)=> {
          const d = data;
          d.base_url = data.base_url + `/`+data.locale+'-'+data.region;
          return res.render('pages/'+data.pageId, d);
        })
        .catch((e) =>{
          if (e.status === 404) return res.status(e.status).send('URL not found');
          log.error(e.message);
          return next(e);
        });
  });
}


router.get(prepareLocaleSet(), leadTracer, (req, res, next) => {
  const [region, locale, url] = setRLUrl(req.path, 2);
  if (url === '/') {
    setIndexPage(req.subdomains, region, locale, req.hostname, url)
        .then((data)=> {
          const d = data;
          d.base_url = data.base_url + `/`+data.locale+'-'+data.region;
          return res.render('pages/'+data.pageId, d);
        })
        .catch((e) =>{
          if (e.status === 404) return res.status(e.status).send('URL not found');
          log.error(e.message);
          return next(e);
        });
  } else {
    setCustomPage(req.subdomains, region, locale, req.hostname, url)
        .then((data)=> {
          const d = data;
          d.base_url = data.base_url + `/`+data.locale+'-'+data.region;
          return res.render('pages/'+data.pageId, d);
        })
        .catch((e) =>{
          if (e.status === 404) return res.status(e.status).send('URL not found');
          log.error(e.message);
          return next(e);
        });
  }
});

/**
 * LOCALE NOT DEFINED IN URL
 */
router.get('/blog', leadTracer, (req, res, next) => {
  const [region, locale] = setDefRL(req.hostname);
  setBlogPage(req.subdomains, req.query.page, region, locale, req.hostname, '/blog')
      .then((data)=> res.render('pages/blog', data))
      .catch((e) =>{
        log.error(e.message);
        return next(e);
      });
});

for (const tag of selTags) {
  router.get('/'+tag+'/*', leadTracer, (req, res, next) => {
    const [region, locale] = setDefRL(req.hostname);
    const url = '/' + req.path.split('/').slice(2).join('/');
    setPostPage(req.subdomains, region, locale, req.hostname, url, tag).
        then((data) => res.render('pages/' + data.pageId, data)).
        catch((e) => {
          if (e.status === 404) return res.status(e.status).send('URL not found');
          log.error(e.message);
          return next(e);
        });
  });
}

/* router.get('/kill', (req, res, next) => {
  req.session.destroy();
  res.status(200).send('Session destroyed');
});*/

router.get('/robots.txt', async (req, res, next) => {
  let prefix = setDefRL(req.hostname)[1];
  if (prefix === 'en') prefix = 'com';
  const regex = new RegExp(`.*\(${prefix}_robots.txt)`, 'ig');

  const dir = await readDir(path.join(__dirname, '../public'));
  let file = dir.filter((elm) => elm.match(regex))[0];
  file = path.join(__dirname, `../public/${file}`);
  file = await readFile(file, 'utf8');
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send(file);
});

router.get('/', leadTracer, (req, res, next) => {
  const [region, locale] = setDefRL(req.hostname);
  const url = req.path;
  setIndexPage(req.subdomains, region, locale, req.hostname, url)
      .then((data)=> res.render('pages/'+data.pageId, data))
      .catch((e) =>{
        if (e.status === 404) return res.status(e.status).send('URL not found');
        log.error(e.message);
        return next(e);
      });
});

router.get('/*', leadTracer, (req, res, next) => {
  const [region, locale] = setDefRL(req.hostname);
  const url = req.path;
  setCustomPage(req.subdomains, region, locale, req.hostname, url)
      .then((data)=> res.render('pages/'+data.pageId, data))
      .catch((e) =>{
        if (e.status === 404) return res.status(e.status).send('URL not found');
        log.error(e.message);
        return next(e);
      });
});


module.exports = router;
