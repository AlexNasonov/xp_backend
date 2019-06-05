const express = require('express');
const fs = require('fs');
const path = require('path');
const util = require('util');
const readDir = util.promisify(fs.readdir);
const router = express.Router();
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const LocalLogger = require('../modules/logger');
const log = new LocalLogger(module);

const leadTracer = require('../modules/leads').LeadTracer;

const models = require('../modules/sequelize');

const RedC = require('../controllers/RedirectController');

const config = require('../modules/config');
const host = config.get('host.production');
const mirrors = config.get('mirrors');
const locales = config.get('locales');
const regions = config.get('regions');
const subdomains = config.get('subdomains');
const selTags = config.get('articlesSelectedTags') || [];
const blogTags = config.get('articlesBlogTags');
const searchTags = config.get('articlesSearchTags');

prepareLocaleSet = (prefix, strict) => {
  const l = [];
  const pr = prefix || '';
  for (const i of locales) {
    let ls = `/${i}-${i}/${pr}`;
    if (!strict) ls = ls+'*';
    l.push(ls);
  }
  for (const i of regions) {
    let rs = `/${locales[0]}-${i}/${pr}`;
    if (!strict) rs = rs+'*';
    l.push(rs);
  }
  return l;
};

setDefLR = (h) => {
  let lr = [locales[0], regions[0]];
  if (h !== host) {
    for (const i of mirrors) {
      if (i[0] === h) lr = i[1].split('-');
    }
  }
  return lr;
};

setLRUrl = (reqPath, slice) =>{
  const sPath = reqPath.split('/');
  const [locale, region] = sPath[1].split('-');
  const url = '/'+sPath.slice(slice).join('/');
  return [region, locale, url];
};

setParams = (url, locale, sd) => {
  const params = {where: {
    locale: locale,
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
    altLocale: (instance.details) ? instance.details.altLocale : undefined,
  };
};

err404 = () => {
  const e = new Error();
  e.status = 404;
  return e;
};

async function setGeneratedPage(subdomains, pageNumber, region, locale, host, url, limit) {
  const params = setParams(false, locale, subdomains);
  const pn = (pageNumber) ? parseInt(pageNumber)-1 : 0;
  params.limit = limit;
  params.offset = pn*params.limit;
  params.order = [['createdAt', 'DESC']];

  const page = await models.Page.findOne({where: {
    url: url,
  }});
  if (!page || !page.published) throw err404();

  const res = {
    params: params,
    data: setData(region, locale, page, host, url),
  };
  res.data.limit = limit;

  return res;
}

async function setBlogPage(subdomains, pageNumber, region, locale, host, url) {
  const preset = await setGeneratedPage(subdomains, pageNumber, region, locale, host, url, 20);
  const data = preset.data;
  if (blogTags) {
    preset.params.include = [{
      model: models.Tag,
      attributes: ['id'],
      where: {id: blogTags},
      through: {attributes: []},
    }];
  }
  data.content = await models.Article.findAndCountAll(preset.params);
  return data;
};


async function setSearchPage(subdomains, pageNumber, region, locale, host, url, tags, q) {
  const preset = await setGeneratedPage(subdomains, pageNumber, region, locale, host, url, 20);
  const data = preset.data;
  const params = preset.params;
  params.include = [{
    model: models.Tag,
    attributes: ['id'],
    through: {attributes: []},
    where: {id: (tags)? JSON.parse(tags) : searchTags},
  }];

  params.where = {
    body: {
      [Op.like]: `%${q}%`,
    },
  };

  // params.where = [Sequelize.literal(`MATCH (body) AGAINST(:searchQuery IN NATURAL LANGUAGE MODE)`), 'score'];
  /* params.replacements = {
    searchQuery: q
  }*/

  /*
  Author.findAll({
    attributes: { include:[[Sequelize.literal(`MATCH (name, altName) AGAINST('shakespeare' IN NATURAL LANGUAGE MODE)`), 'score']] },
    where: Sequelize.literal(`MATCH (name, altName) AGAINST('shakespeare' IN NATURAL LANGUAGE MODE)`),
    order:[[Sequelize.literal('score'), 'DESC']],
  });*/

  data.content = await models.Article.findAndCountAll(params);
  return data;
}

async function setArticlePage(subdomains, region, locale, host, url, tag) {
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

  const uri = '/'+tag+url;

  const article = await models.Article.findOne(params);

  if (!article) {
    const redirect = RedC.find(uri, params.where.locale, params.where.subdomain);
    if (redirect) return {redirect: redirect.new};
    else throw err404();
  } else if (!article.published) throw err404();
  const data = setData(region, locale, article, host, uri);
  data.content = article.body;
  data.css = article.page.css;
  data.pageId = article.pageId;
  return data;
};

async function setCustomPage(subdomains, region, locale, host, url) {
  const params = setParams(url, locale, subdomains);
  const page = await models.Page.findOne(params);
  if (!page) {
    const redirect = RedC.find(url, params.where.locale, params.where.subdomain);
    if (redirect) return {redirect: redirect.new};
    else throw err404();
  } else if (!page.published) throw err404();

  const data = setData(region, locale, page, host, url);
  data.pageId = page.id;
  return data;
};


async function setIndexPage(subdomains, region, locale, host, url) {
  const page = await models.Page.findOne(setParams(url, locale, subdomains));
  if (!page || !page.published) throw err404();

  const data = setData(region, locale, page, host, url);
  data.pageId = page.id;

  const promo = await models.Tag.findByPk('promo', {include: [{
    model: models.Article,
    where: {locale: locale},
    attributes: ['url', 'header', 'summary', 'og_image_url', 'createdAt'],
    through: {attributes: []},
  }],
  order: [[models.Article, 'header', 'ASC']],
  });
  data.promo = (promo) ? promo.articles : undefined;
  return data;
};


/**
 * LOCALE DEFINED IN URL
 */

router.get(prepareLocaleSet('blog', true), leadTracer, (req, res, next) => {
  const [region, locale, url] = setLRUrl(req.path, 2);
  setBlogPage(req.subdomains, req.query.page, region, locale, req.hostname, url)
      .then((data)=> {
        const d = data;
        d.base_url = data.base_url + `/`+data.locale+'-'+data.region;
        return res.render('pages/blog', d);
      })
      .catch((e) =>{
        if (e.status === 404) res.redirect('/404');
        else {
          log.error(e.message);
          return next(e);
        }
      });
});

router.get(prepareLocaleSet('search', true), leadTracer, (req, res, next) => {
  const [region, locale, url] = setLRUrl(req.path, 2);
  setSearchPage(req.subdomains, req.query.page, region, locale, req.hostname, url, req.query.tags, req.query.q)
      .then((data)=> {
        const d = data;
        d.base_url = data.base_url + `/`+data.locale+'-'+data.region;
        return res.render('pages/search', d);
      })
      .catch((e) =>{
        if (e.status === 404) res.redirect('/404');
        else {
          log.error(e.message);
          return next(e);
        }
      });
});


for (const tag of selTags) {
  router.get(prepareLocaleSet(tag+'/'), leadTracer, (req, res, next) => {
    const [region, locale, url] = setLRUrl(req.path, 3);
    setArticlePage(req.subdomains, region, locale, req.hostname, url, tag)
        .then((data)=> {
          if (data.redirect) return res.redirect(data.redirect);
          const d = data;
          d.base_url = data.base_url + `/`+data.locale+'-'+data.region;
          return res.render('pages/'+data.pageId, d);
        })
        .catch((e) =>{
          if (e.status === 404) res.redirect('/404');
          else {
            log.error(e.message);
            return next(e);
          }
        });
  });
}


router.get(prepareLocaleSet(), leadTracer, (req, res, next) => {
  const [region, locale, url] = setLRUrl(req.path, 2);
  if (url === '/') {
    setIndexPage(req.subdomains, region, locale, req.hostname, url)
        .then((data)=> {
          const d = data;
          d.base_url = data.base_url + `/`+data.locale+'-'+data.region;
          return res.render('pages/'+data.pageId, d);
        })
        .catch((e) =>{
          if (e.status === 404) res.redirect('/404');
          else {
            log.error(e.message);
            return next(e);
          }
        });
  } else {
    setCustomPage(req.subdomains, region, locale, req.hostname, url)
        .then((data)=> {
          if (data.redirect) return res.redirect(data.redirect);
          const d = data;
          d.base_url = data.base_url + `/`+data.locale+'-'+data.region;
          return res.render('pages/'+data.pageId, d);
        })
        .catch((e) =>{
          if (e.status === 404) res.redirect('/404');
          else {
            log.error(e.message);
            return next(e);
          }
        });
  }
});

/**
 * LOCALE NOT DEFINED IN URL
 */
router.get('/blog', leadTracer, (req, res, next) => {
  const [locale, region] = setDefLR(req.hostname);
  setBlogPage(req.subdomains, req.query.page, region, locale, req.hostname, '/blog')
      .then((data)=> res.render('pages/blog', data))
      .catch((e) =>{
        if (e.status === 404) res.redirect('/404');
        else {
          log.error(e.message);
          return next(e);
        }
      });
});

router.get('/search', leadTracer, (req, res, next) => {
  const [locale, region] = setDefLR(req.hostname);
  setSearchPage(req.subdomains, req.query.page, region, locale, req.hostname, '/search', req.query.tags)
      .then((data)=> res.render('pages/search', data))
      .catch((e) =>{
        if (e.status === 404) res.redirect('/404');
        else {
          log.error(e.message);
          return next(e);
        }
      });
});

router.get('/sitemap.xml', leadTracer, (req, res, next) => {
  const hn = req.hostname;
  const file = (hn !== host)
      ? path.join(process.env.publicPath, `./sitemaps/sitemap-${hn}.xml`)
      : path.join(process.env.publicPath, `./sitemap.xml`);

  res.sendFile(file);
});

for (const tag of selTags) {
  router.get('/'+tag+'/*', leadTracer, (req, res, next) => {
    const [locale, region] = setDefLR(req.hostname);
    const url = '/' + req.path.split('/').slice(2).join('/');
    setArticlePage(req.subdomains, region, locale, req.hostname, url, tag).
        then((data) => {
          if (data.redirect) return res.redirect(data.redirect);
          else res.render('pages/' + data.pageId, data);
        }).
        catch((e) => {
          if (e.status === 404) res.redirect('/404');
          else {
            log.error(e.message);
            return next(e);
          }
        });
  });
}

router.get('/robots.txt', async (req, res, next) => {
  const hn = req.hostname;
  const prefix = (hn !== host) ? hn : '';
  const regex = new RegExp(`.*\(${prefix}_robots.txt)`, 'ig');

  const dir = await readDir(process.env.publicPath);
  let file = dir.filter((elm) => elm.match(regex))[0];

  file = path.join(__dirname, `../public/${file}`);
  res.sendFile(file);
});

router.get('/', leadTracer, (req, res, next) => {
  const [locale, region] = setDefLR(req.hostname);
  const url = req.path;
  setIndexPage(req.subdomains, region, locale, req.hostname, url)
      .then((data)=> res.render('pages/'+data.pageId, data))
      .catch((e) =>{
        if (e.status === 404) res.redirect('/404');
        else {
          log.error(e.message);
          return next(e);
        }
      });
});

router.get('/*', leadTracer, (req, res, next) => {
  const [locale, region] = setDefLR(req.hostname);
  const url = req.path;
  setCustomPage(req.subdomains, region, locale, req.hostname, url)
      .then((data)=> {
        if (data.redirect) return res.redirect(data.redirect);
        else res.render('pages/'+data.pageId, data);
      })
      .catch((e) =>{
        if (e.status === 404) res.redirect('/404');
        else {
          log.error(e.message);
          return next(e);
        }
      });
});


module.exports = router;
