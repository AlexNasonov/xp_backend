const models = require('../modules/sequelize');

const RedC = require('./RedirectController');

const LocalLogger = require('../modules/logger');
const log = new LocalLogger(module);

const config = require('../modules/config');
const host = config.getEnv('host');
const mirrors = config.get('mirrors');
const locales = config.get('locales');
const regions = config.get('regions');
const subdomains = config.get('subdomains');
const selTags = config.get('articlesSelectedTags') || [];
const blogTags = config.get('articlesBlogTags');
const searchTags = config.get('articlesSearchTags');

module.exports = class RouteController {
  static prepareLocaleSet(prefix, strict) {
    const list = [];
    const pr = `${prefix || ''}${(strict) ? '':'*'}`;
    for (const r of regions) {
      for (const l of locales) {
        list.push(`/${l}-${r}/${pr}`);
      }
    }
    list.push(`/${pr}`);
    return list;
  };

  static setLRUrl(hostname, path) {
    let locale = locales[0];
    let region = regions[0];
    let tagPos = 1;

    const sPath = path.split('/');

    // set locale and region
    if (hostname !== host) {
      for (const i of mirrors) {
        if (i[0] === hostname) {
          const lr = i[1].split('-');
          locale = lr[0];
          region = lr[1];
        }
      }
    } else {
      let lr = sPath[1];
      lr = lr.split('-');
      if (lr.length === 2 && locales.includes(lr[0]) && regions.includes(lr[1])) {
        locale = lr[0];
        region = lr[1];
        tagPos = 2;
      }
    }

    // exclude articlesSelectedTags tag from url to get a clear article url
    const tag = sPath[tagPos];
    if (selTags.includes(tag) && !path.endsWith(tag)) tagPos++;
    const url = '/'+sPath.slice(tagPos).join('/');
    return [locale.toLowerCase(), region.toLowerCase(), url.toLowerCase()];
  };

  static setParams(url, locale, sd) {
    const params = {where: {
      locale: locale || locales[0],
      subdomain: (sd && sd.length>0 && subdomains.includes(sd[0]))? sd[0] : subdomains[0],
    }};
    if (url) params.where.url = url;
    return params;
  };

  static setAlts(locale, url) {
    const l = [];
    for (const i of regions) l.push(`/${locale}-${i}${url}`);
    return l;
  };

  static setData(region, locale, instance, host, url, path) {
    let h; let p;
    if (process.env.NODE_ENV === 'development' || process.env.TUNNEL_ENV) {
      h = config.get('host')['development']+':'+config.get('port');
      p = 'http://';
    } else {
      h = host;
      p = (process.env.NODE_ENV === 'staging') ? 'http://' : 'https://';
    }
    let baseURL = p+h+path.replace(url, '');
    if (baseURL.endsWith('/')) baseURL = baseURL.slice(0, -1);
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
      path: path,
      base_url: baseURL,
      alts: RouteController.setAlts(locale, url),
      details: instance.details,
    };
  };

  static err404() {
    const e = new Error();
    e.status = 404;
    return e;
  };


  static async setGeneratedPage(subdomains, pageNumber, region, locale, host, url, limit, path) {
    const params = RouteController.setParams(false, locale, subdomains);
    const pn = (pageNumber) ? parseInt(pageNumber)-1 : 0;
    params.limit = limit;
    params.offset = pn*params.limit;
    params.order = [['createdAt', 'DESC']];

    const page = await models.Page.findOne({where: {
      url: url,
    }});

    if (!page || !page.published) throw RouteController.err404();

    const res = {
      params: params,
      data: RouteController.setData(region, locale, page, host, url, path),
    };
    res.data.limit = limit;

    return res;
  }

  static async setBlogPage(subdomains, pageNumber, region, locale, host, url, tagFilter, path) {
    const preset = await RouteController.setGeneratedPage(subdomains, pageNumber, region, locale, host, url, 20, path);
    const data = preset.data;
    if (blogTags) {
      const tagList = (tagFilter && blogTags.includes(tagFilter)) ? [tagFilter] : blogTags;
      preset.params.where.published = true;
      preset.params.include = [{
        model: models.Tag,
        attributes: ['id'],
        where: {id: tagList},
        through: {attributes: []},
      }];
    }
    data.content = await models.Article.findAndCountAll(preset.params);

    return data;
  };


  static async setSearchPage(subdomains, pageNumber, region, locale, host, url, tags, q, path) {
    const preset = await RouteController.setGeneratedPage(subdomains, pageNumber, region, locale, host, url, 20, path);
    const data = preset.data;
    const params = preset.params;
    params.include = [{
      model: models.Tag,
      attributes: ['id'],
      through: {attributes: []},
      where: {id: (tags)? JSON.parse(tags) : searchTags},
    }];

    const results = await models.sequelize.query(`
    SELECT *
    FROM ${models.Article.tableName}
    WHERE _search @@ plainto_tsquery('english', :query);
  `, {
      model: models.Article,
      replacements: {query: q},
    });

    const ids = [];

    for (const i of results) {
      ids.push(i.id);
    }

    params.where = {
      id: ids,
      locale: locale,
      published: true,
    };

    data.content = await models.Article.findAndCountAll(params);
    data.content.query = q;
    return data;
  }

  static async findRedirect(url, locale, subdomain) {
    const redirect = await RedC.find(url, locale, subdomain);
    if (redirect) return {redirect: redirect.new};
    else throw RouteController.err404();
  }

  static async setArticlePage(subdomains, region, locale, host, url, tag, path) {
    const params = RouteController.setParams(url, locale, subdomains);
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

    if (!article) return await RouteController.findRedirect(uri, params.where.locale, params.where.subdomain);
    if (!article.published) throw RouteController.err404();

    const data = RouteController.setData(region, locale, article, host, uri, path);
    data.content = article.body;
    data.css = article.page.css;
    data.pageId = article.pageId;
    return data;
  };

  static async setCustomPage(subdomains, region, locale, host, url, path) {
    const params = RouteController.setParams(url, locale, subdomains);
    const page = await models.Page.findOne(params);

    if (!page) return await RouteController.findRedirect(url, params.where.locale, params.where.subdomain);
    if (!page.published) throw RouteController.err404();

    const data = RouteController.setData(region, locale, page, host, url, path);
    data.pageId = page.id;
    return data;
  };


  static async setIndexPage(subdomains, region, locale, host, url, path) {
    const page = await models.Page.findOne(RouteController.setParams(url, locale, subdomains));
    if (!page || !page.published) throw RouteController.err404();

    const data = RouteController.setData(region, locale, page, host, url, path);
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

  static render404(req, res, next) {
    const lrData = RouteController.setLRUrl(req.hostname, req.path);
    const [locale, region] = [lrData[0], lrData[1]];

    RouteController.setCustomPage(req.subdomains, region, locale, req.hostname, '/404', req.path)
        .then((data)=> {
          res.status(404);
          data.base_url = data.base_url.replace(lrData[2], '');
          return res.render('pages/'+data.pageId, data);
        })
        .catch((e) =>{
          log.error(e.message);
          return next(e);
        });
  };
};
