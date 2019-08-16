const express = require('express');
const fs = require('fs');
const path = require('path');
const util = require('util');
const readDir = util.promisify(fs.readdir);
const router = express.Router();
const LocalLogger = require('../modules/logger');
const log = new LocalLogger(module);

const leadTracer = require('../modules/leads').LeadTracer;

const config = require('../modules/config');
const host = config.getEnv('host');

const selTags = config.get('articlesSelectedTags') || [];

const RouteC = require('../controllers/RouteController');



router.get('/sitemap.xml', leadTracer, (req, res, next) => {
  const hn = req.hostname;
  const file = (hn !== host)
      ? path.join(process.env.publicPath, `./files/sitemaps/sitemap-${hn}.xml`)
      : path.join(process.env.publicPath, `./files/sitemaps/sitemap.xml`);
  res.sendFile(file);
});

router.get('/robots.txt', async (req, res, next) => {
  const hn = req.hostname;
  const prefix = (hn !== host && hn !=='localhost') ? hn : '';
  const regex = new RegExp(`.*\(${prefix}-robots.txt)`, 'ig');
  const dirName = path.join(process.env.publicPath, `./files/robots`);
  const dir = await readDir(dirName);
  let file = dir.filter((elm) => elm.match(regex))[0];
  file = path.join(dirName, `./${file}`);
  res.sendFile(file);
});

// blog pages
router.get(RouteC.prepareLocaleSet('blog', true), leadTracer, (req, res, next) => {
  const [locale, region, url] = RouteC.setLRUrl(req.hostname.toLowerCase(), req.path.toLowerCase());
  RouteC.setBlogPage(req.subdomains, req.query.page, region, locale, req.hostname, '/blog', req.query.tag, req.path)
      .then((data)=> {
        res.render('pages/blog', data);
      })
      .catch((e) =>{
        if (e.status === 404) return RouteC.render404(req, res, next);
        else {
          log.error(e.message);
          return next(e);
        }
      });
});

// search pages
router.get(RouteC.prepareLocaleSet('search', true), leadTracer, (req, res, next) => {
  const [locale, region, url] = RouteC.setLRUrl(req.hostname.toLowerCase(), req.path.toLowerCase());

  if(!req.query.q) return RouteC.render404(req, res, next, true);

  RouteC.setSearchPage(req.subdomains, req.query.page, region, locale, req.hostname, url, req.query.tags, req.query.q, req.path)
      .then((data)=> {
        const qString = RouteC.setQuery(req.query);
        data.url = data.url+qString;
        data.path = data.path+qString;
        return res.render('pages/search', data);
      })
      .catch((e) =>{
        if (e.status === 404) return RouteC.render404(req, res, next, true);
        else {
          log.error(e.message);
          return next(e);
        }
      });
});

// tag-defined pages like:  /post/post-name
for (const tag of selTags) {
  router.get(RouteC.prepareLocaleSet(tag+'/'), leadTracer, (req, res, next) => {

    const [locale, region, url] = RouteC.setLRUrl(req.hostname.toLowerCase(), req.path.toLowerCase());
    RouteC.setArticlePage(req.subdomains, region, locale, req.hostname, url, tag, req.path)
        .then((data)=> {
          if (data.redirect) return res.redirect(data.redirect);
          return res.render('pages/'+data.pageId, data);
        })
        .catch((e) =>{
          if (e.status === 404) return RouteC.render404(req, res, next, true);
          else {
            log.error(e.message);
            return next(e);
          }
        });
  });
}

router.get(RouteC.prepareLocaleSet('', true), leadTracer, (req, res, next) => {
  const [locale, region, url] = RouteC.setLRUrl(req.hostname.toLowerCase(), req.path.toLowerCase());
  RouteC.setIndexPage(req.subdomains, region, locale, req.hostname, '/', '/')
      .then((data)=> res.render('pages/'+data.pageId, data))
      .catch((e) =>{
        if (e.status === 404) return RouteC.render404(req, res, next);
        else {
          log.error(e.message);
          return next(e);
        }
      });
});

router.get(RouteC.prepareLocaleSet(''), leadTracer, (req, res, next) => {
  const [locale, region, url] = RouteC.setLRUrl(req.hostname.toLowerCase(), req.path.toLowerCase());
  RouteC.setCustomPage(req.subdomains, region, locale, req.hostname, url, req.path)
      .then((data)=> {
        if (data.redirect) return res.redirect(data.redirect);
        else res.render('pages/'+data.pageId, data);
      })
      .catch((e) =>{
        if (e.status === 404) return RouteC.render404(req, res, next);
        else {
          log.error(e.message);
          return next(e);
        }
      });
});


module.exports = router;
