const cu = require('./ControllerUtilities');
const tc = require('./TagController');

const Logger = require('../modules/logger');
const log = new Logger(module);

const Models = require('../modules/sequelize');
const Op = require('sequelize').Op;
const Tag = Models.Tag;
const Article = Models.Article;

const ps = ['url', 'title', 'description',
  'keywords', 'css', 'locale', 'published',
  'header', 'summary', 'body', 'subdomain'];

module.exports = class TextsController {
  /**
   * Prepare Text data
   * @param {Model} data - instance of a sequelize model
   * @param {boolean} render
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
  static async add(id, data) {
    try {
      const pd = {id: id};

      for (const i of ps) {
        if (data[i]) pd[i] = data[i];
      }

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

      return await this.get(id, false);
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

      const filters = [];

      for (const i of ['ID', 'URL']) {
        if (filter[i]) {
          filters.push({
            [i.toLocaleLowerCase()]: {[Op.like]: '%' + filter[i] + '%'},
          });
        }
      }

      for (const i of ['Header', 'Summary']) {
        const l = filter[i] || filter.Content;
        if (l) {
          filters.push({
            [i.toLocaleLowerCase()]: {[Op.like]: '%' + l + '%'},
          });
        }
      }

      if (filter.Content) {
        filters.push({
          body: {[Op.like]: '%' + filter.Content + '%'},
        });
      }

      for (const i of ['Locale', 'Subdomain']) {
        if (filter[i]) {
          filters.push({
            [i.toLocaleLowerCase()]: filter[i],
          });
        }
      }

      const pub = filter['Published'];
      if (pub) {
        filters.push({
          published: (pub === 'true'),
        });
      }

      if (filters.length>0) options.where = {[Op.and]: filters};

      options.include = [{
        model: Tag,
        attributes: ['id'],
        through: {attributes: []},
      }];

      if (filter.Tag) options.include[0].where = {id: JSON.parse(filter.Tag)};

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
  static async update(id, data) {
    try {
      let text = await Article.findByPk(id);
      if (text) {
        for (const i of ps) {
          if (data[i]) text[i] = data[i];
        }
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

  static async delete(id) {
    try {
      const text = await Article.findByPk(id);
      if (text) await text.destroy();
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }
};
