const fs = require('fs');
const path = require('path');
const util = require('util');
const ejs = require('ejs');
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const deleteFile = util.promisify(fs.unlink);

const cu = require('./ControllerUtilities');
const tc = require('./TagController');

const Logger = require('../modules/logger');
const log = new Logger(module);

const Models = require('../modules/sequelize');
const Op = require('sequelize').Op;
const Tag = Models.Tag;
const Page = Models.Page;

const sitemapC = require('./SitemapController');

const dpath = path.join(process.env.viewsPath, `/pages`);
const cpath = (id) => path.join(dpath, `./${id}.ejs`);

const ps = ['url', 'title', 'description', 'keywords', 'css', 'locale', 'published', 'subdomain'];

module.exports = class PagesController {
  /**
   * Prepare Page data
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

    res.ogImage = {
      url: data.og_image_url,
      width: data.og_image_width,
      height: data.og_image_height,
    };
    res.createdAt = data.createdAt;
    res.updatedAt = data.updatedAt;

    const file = cpath(data.id);
    if (!fs.existsSync(file)) await writeFile(file, '', {encoding: 'utf8', flag: 'w'});

    if (render) res.body = await ejs.renderFile(file);
    else res.body = await readFile(file, 'utf8');
    res.tags = cu.flatten('id', data.tags);
    if (data.details && data.details.altLocale) res.altLocale = data.details.altLocale;


    return res;
  }


  /**
   * Get and combine data data: body from a ejs file, other data from DB
   * @param {string} id - data id
   * @param {boolean} render - should body be presented as EJS or as HTML
   * @return {Promise<*>}
   */
  static async get(id, render) {
    try {
      const data = await Page.findByPk(id, {
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
   * Create a new data
   * @param {string} id
   * @param {string} data
   * @return {Promise<*>}
   */
  static async add(id, data, sitemapBlock) {
    const f = cpath(id);

    if (!data.body) {
      const em = 'no data body provided';
      log.error(em);
      throw new TypeError(em);
    }

    if (fs.existsSync(f)) {
      const em = `page ${f} already exists`;
      const e = new TypeError(em);
      e.status = 409;
      log.error(em);
      throw e;
    }

    try {
      if (!fs.existsSync(dpath)) fs.mkdirSync(dpath);

      await writeFile(f, data.body, {encoding: 'utf8', flag: 'w'});

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

      const page = await Page.create(pd);
      if (data.tags) await page.setTags(data.tags);
      if (data.altLocale) await page.updateDetails('altLocale', data.altLocale);

      const res = await this.get(id, false);
      if (!sitemapBlock) sitemapC.launchGenerator();
      return res;
    } catch (e) {
      if (fs.existsSync(f)) await deleteFile(f);
      if (e.message === 'Validation error') {
        e.status = 409;
        e.message = `page db entry with id ${id} or url ${data.url} already exists`;
      }
      log.error(e.message);
      throw e;
    }
  }

  /**
   * Get pages by params
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

      const cf = cu.setPagesFilters(filter);
      filters = filters.concat(cf.filters);

      if (filters.length>0) options.where = {[Op.and]: filters};

      if (cf.tags) options.include[0].where = {id: cf.tags};

      const d = await Page.findAndCountAll(options);
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
   * Update a data
   * @param {string} id
   * @param {object} data
   * @return {Promise<boolean>}
   */
  static async update(id, data, sitemapBlock) {
    try {
      let page = await Page.findByPk(id);
      if (page) {
        if (data.body) await writeFile(cpath(id), data.body, {encoding: 'utf8', flag: 'w'});

        for (const i of ps) {
          if (data[i]) page[i] = data[i];
        }

        page.url = page.url.toLowerCase();
        if (!page.url.startsWith('/')) page.url = '/'+page.url;
        if (!data.published) page.published = false;

        if (data.ogImage) {
          page.og_image_url = data.ogImage.url;
          page.og_image_width = data.ogImage.width;
          page.og_image_height = data.ogImage.height;
        }

        page = await page.save();

        if (data.tags instanceof Array) {
          const tl = (data.tags.length > 0) ? data.tags : null;
          await page.setTags(tl);
        }

        if (data.altLocale) {
          const det = page.details;
          const al = (det && det.altLocale) ? det.altLocale : {};
          for (const i of Object.keys(data.altLocale)) {
            al[i] = data.altLocale[i];
          }
          page.updateDetails('altLocale', al);
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
      const page = await Page.findByPk(id);
      if (page) {
        const options = tc.setOptions(limit, offset, order, desc, filter);
        return await page.getTags(options);
      } else return false;
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }

  static async delete(id, sitemapBlock) {
    try {
      const f = cpath(id);
      if (fs.existsSync(f)) await deleteFile(f);

      const page = await Page.findByPk(id);
      if (page) await page.destroy();
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

      const f = await Page.findAndCountAll(options);
      if (f.count === 0) return f.count;

      const d = [];
      for (const i of f.rows) {
        const p = cpath(i.id);
        if (fs.existsSync(p)) await deleteFile(p);
        d.push(i.id);
      }

      const res = await Page.destroy({where: {id: d}});
      if (!sitemapBlock) sitemapC.launchGenerator();
      return res;
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }
};
