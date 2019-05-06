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
const Chunk = Models.Chunk;

const dpath = path.join(__dirname, `../views/chunks`);
const cpath = (id) => path.join(dpath, `./${id}.ejs`);

module.exports = class ChunksController {
  /**
   * Prepare Chunk data
   * @param {Model} data - instance of a sequelize model
   * @param {boolean} render
   * @return {Promise<*>}
   * @private
   */
  static async _serveData(data, render) {
    const res = data.dataValues;
    const file = cpath(data.id);
    if (!fs.existsSync(file)) await writeFile(file, '', {encoding: 'utf8', flag: 'w'});
    if (render) res.body = await ejs.renderFile(file);
    else res.body = await readFile(file, 'utf8');
    res.tags = cu.flatten('id', data.tags);
    return res;
  }

  /**
   * Get and combine chunk data: body from a ejs file, other data from DB
   * @param {string} id - chunk id
   * @param {boolean} render - should body be presented as EJS or as HTML
   * @return {Promise<*>}
   */
  static async get(id, render) {
    try {
      const data = await Chunk.findByPk(id, {include: [{
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
   * Create a new chunk
   * @param {string} id
   * @param {string} data
   * @return {Promise<*>}
   */
  static async add(id, data) {
    const f = cpath(id);

    if (!data.body) {
      const em = 'no chunk body provided';
      log.error(em);
      throw new TypeError(em);
    }

    if (fs.existsSync(f)) {
      const em = `chunk ${f} already exists`;
      const e = new TypeError(em);
      e.status = 409;
      log.error(em);
      throw e;
    }

    try {
      if (!fs.existsSync(dpath)) fs.mkdirSync(dpath);

      await writeFile(f, data.body, {encoding: 'utf8', flag: 'w'});
      const chunk = await Chunk.create({
        id: id,
        description: data.description,
      });

      if (data.tags) await chunk.setTags(data.tags);

      return await this.get(id, false);
    } catch (e) {
      if (fs.existsSync(f)) await deleteFile(f);
      if (e.message === 'Validation error') {
        e.status = 409;
        e.message = `chunk db entry with id ${id} already exists`;
      }
      log.error(e.message);
      throw e;
    }
  }

  /**
   * Get chunks by params
   * @param {number} limit
   * @param {number} offset
   * @param {string} order
   * @param {boolean} desc
   * @param {string} filter
   * @return {Promise<{}>}
   */
  static async getAll(limit, offset, order, desc, filter) {
    try {
      const o = (['createdAt', 'updatedAt'].includes(order)) ? order: 'id';
      const options = cu.setQueryOptions(limit, offset, o, desc);
      options.where = {};
      if (filter.ID) options.where.id = {[Op.like]: '%'+filter.ID+'%'};

      options.include = [{
        model: Tag,
        attributes: ['id'],
        through: {attributes: []},
      }];

      if (filter.Tag) options.include[0].where = {id: JSON.parse(filter.Tag)};

      const d = await Chunk.findAndCountAll(options);
      const res = {count: d.count, rows: []};
      if (d.rows.length>0) {
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
   * Update a chunk
   * @param {string} id
   * @param {object} data
   * @return {Promise<boolean>}
   */
  static async update(id, data) {
    try {
      let chunk = await Chunk.findByPk(id);
      if (chunk) {
        if (data.body) await writeFile(cpath(id), data.body, {encoding: 'utf8', flag: 'w'});

        if (data.description) {
          chunk.description = data.description;
          chunk = await chunk.save();
        }

        if (data.tags instanceof Array) {
          const tl = (data.tags.length > 0) ? data.tags : null;
          await chunk.setTags(tl);
        }
        return true;
      } else return false;
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }

  static async getTags(id, limit, offset, order, desc, filter) {
    try {
      const chunk = await Chunk.findByPk(id);
      if (chunk) {
        const options = tc.setOptions(limit, offset, order, desc, filter);
        return await chunk.getTags(options);
      } else return false;
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }

  static async delete(id) {
    try {
      const f = cpath(id);
      if (fs.existsSync(f)) await deleteFile(f);

      const chunk = await Chunk.findByPk(id);
      if (chunk) await chunk.destroy();
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }
};

