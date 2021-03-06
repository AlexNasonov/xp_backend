const cu = require('./ControllerUtilities');
const tc = require('./TagController');

const Logger = require('../modules/logger');
const log = new Logger(module);

const Models = require('../modules/sequelize');
const Op = require('sequelize').Op;
const Tag = Models.Tag;
const Article = Models.Article;

const sitemapC = require('./SitemapController');

const ps = ['url', 'title', 'description',
  'keywords', 'css', 'locale', 'published',
  'header', 'summary', 'body', 'subdomain'];

module.exports = class ArticlesController {
  /**
   * Prepare Text data
   * @param {Model} data - instance of a sequelize model
   * @param {boolean} render //TODO: add or remove render feature
   * @return {Promise<*>}
   * @private
   */
  static async _serveData(data, render) {
    const res = {id: data.id};

    for (const i of ps) {
      if (data[i]) res[i] = data[i];
    }

    res.template = data.pageId;

    res.ogImage = {
      url: data.og_image_url,
      width: data.og_image_width,
      height: data.og_image_height,
    };
    res.createdAt = data.createdAt;
    res.updatedAt = data.updatedAt;
    res.tags = cu.flatten('id', data.tags);

    if (data.details && data.details.altLocale) res.altLocale = data.details.altLocale;

    return res;
  }

  /**
   * Get and combine text data: body from a ejs file, other data from DB
   * @param {string} id - text id
   * @param {boolean} render - should body be presented as EJS or as HTML
   * @return {Promise<*>}
   */
  static async get(id, render) {
    try {
      const data = await Article.findByPk(id, {
        include: [{
          model: Tag,
          attributes: ['id'],
          through: {attributes: []},
        }],
      });
      if (data) return await this._serveData(data, render);
      else return false;
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }

  /**
   * Create a new text
   * @param {string} id
   * @param {string} data
   * @return {Promise<*>}
   */
  static async add(id, data, sitemapBlock) {
    try {
      const pd = {id: id};

      for (const i of ps) {
        if (data[i]) pd[i] = data[i];
      }

      pd.url = pd.url.toLowerCase();
      if (!pd.url.startsWith('/')) pd.url = '/'+pd.url;
      if (!data.published) pd.published = false;
      if (data.ogImage) {
        pd.og_image_url = data.ogImage.url;
        pd.og_image_width = data.ogImage.width;
        pd.og_image_height = data.ogImage.height;
      }

      if (!data.template) pd.published = false;

      const text = await Article.create(pd);
      if (data.tags) await text.setTags(data.tags);
      if (data.template) await text.setPage(await Models.Page.findByPk(data.template));
      if (data.altLocale) await text.updateDetails('altLocale', data.altLocale);


      const res = await this.get(id, false);
      if (!sitemapBlock) sitemapC.launchGenerator();
      return res;
    } catch (e) {
      if (e.message === 'Validation error') {
        e.status = 409;
        e.message = `text db entry with id ${id} or url ${data.url} already exists`;
      }
      log.error(e.message);
      throw e;
    }
  }

  /**
   * Get articles by params
   * @param {number} limit
   * @param {number} offset
   * @param {string} order
   * @param {boolean} desc
   * @param {string} filter
   * @return {Promise<{}>}
   */
  static async getAll(limit, offset, order, desc, filter) {
    try {
      const o = (['createdAt', 'updatedAt'].includes(order)) ? order : 'id';
      const options = cu.setQueryOptions(limit, offset, o, desc);
      options.include = [{
        model: Tag,
        attributes: ['id'],
        through: {attributes: []},
      }];


      let filters = [];

      for (const i of ['id', 'url']) {
        if (filter[i]) {
          filters.push({
            [i]: {[Op.like]: '%' + filter[i] + '%'},
          });
        }
      }

      for (const i of ['header', 'summary']) {
        const l = filter[i] || filter.Content;
        if (l) {
          filters.push({
            [i]: {[Op.like]: '%' + l + '%'},
          });
        }
      }

      if (filter.content) {
        filters.push({
          body: {[Op.like]: '%' + filter.content + '%'},
        });
      }

      const cf = cu.setPagesFilters(filter);
      filters = filters.concat(cf.filters);

      if (filters.length>0) options.where = {[Op.and]: filters};

      if (cf.tags) options.include[0].where = {id: cf.tags};

      const d = await Article.findAndCountAll(options);
      const res = {count: d.count, rows: []};
      if (d.rows.length > 0) {
        for (const i of d.rows) {
          res.rows.push(await this._serveData(i));
        }
      }

      return res;
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }

  /**
   * Update a text
   * @param {string} id
   * @param {object} data
   * @return {Promise<boolean>}
   */
  static async update(id, data, sitemapBlock) {
    try {
      let text = await Article.findByPk(id);
      if (text) {
        for (const i of ps) {
          if (data[i]) text[i] = data[i];
        }
        text.url = text.url.toLowerCase();
        if (!text.url.startsWith('/')) text.url = '/'+text.url;
        if (!data.published) text.published = false;
        if (data.ogImage) {
          text.og_image_url = data.ogImage.url;
          text.og_image_width = data.ogImage.width;
          text.og_image_height = data.ogImage.height;
        }

        text = await text.save();

        if (data.tags instanceof Array) {
          const tl = (data.tags.length > 0) ? data.tags : null;
          await text.setTags(tl);
        }

        if (data.template) await text.setPage(await Models.Page.findByPk(data.template));
        if (data.altLocale) {
          const det = text.details;
          const al = (det && det.altLocale) ? det.altLocale : {};
          for (const i of Object.keys(data.altLocale)) {
            al[i] = data.altLocale[i];
          }
          text.updateDetails('altLocale', al);
        }

        if (!sitemapBlock) sitemapC.launchGenerator();

        return true;
      } else return false;
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }

  static async getTags(id, limit, offset, order, desc, filter) {
    try {
      const text = await Article.findByPk(id);
      if (text) {
        const options = tc.setOptions(limit, offset, order, desc, filter);
        return await text.getTags(options);
      } else return false;
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }

  static async delete(id, sitemapBlock) {
    try {
      const text = await Article.findByPk(id);
      if (text) await text.destroy();
      if (!sitemapBlock) sitemapC.launchGenerator();
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }

  static async deleteAll(filter, sitemapBlock) {
    try {
      const options = {
        where: {},
        attributes: ['id'],
        include: [{
          model: Tag,
          attributes: ['id'],
          through: {attributes: []},
        }],
      };

      const cf = cu.setPagesFilters(filter);

      if (cf.filters.length>0) options.where = {[Op.and]: cf.filters};

      if (cf.tags) options.include[0].where = {id: cf.tags};

      const f = await Article.findAndCountAll(options);
      if (f.count === 0) return f.count;

      const d = [];
      for (const i of f.rows) {
        d.push(i.id);
      }

      const res = await Article.destroy({where: {id: d}});
      if (!sitemapBlock) sitemapC.launchGenerator();
      return res;
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }
};
