const Logger = require('../modules/logger');
const log = new Logger(module);
const models = require('../modules/sequelize');
const Op = require('sequelize').Op;
const cu = require('./ControllerUtilities');
const Tag = models.Tag;

module.exports = class TagController {
  /**
   * Set options object for Sequelize Model calls
   * @param {number} limit
   * @param {number} offset
   * @param {string} order
   * @param {boolean} desc
   * @param {string} filter
   * @return {{}}
   */
  static setOptions(limit, offset, order, desc, filter) {
    const o = (['createdAt', 'updatedAt'].includes(order)) ? order: 'id';
    const options = cu.setQueryOptions(limit, offset, o, desc);
    options.where = {};
    if (filter) options.where.id = {[Op.like]: '%'+filter+'%'};
    return options;
  }

  /**
   * Create or get an already created Tag
   * @param {string} entity - one of entities (check config)
   * @param {string} id - a unique tag name that acts like a tag
   * @param {string} description - tag short description
   * @return {Promise<object>} - Tag data
   */
  static async get(entity, id, description) {
    const options = {where: {id: id, entity: entity}};
    try {
      let data = await Tag.findOne(options);
      if (!data) {
        if (description) options.where.description = description;
        data = await Tag.create(options.where);
      }
      return Promise.resolve(data);
    } catch (e) {
      log.error(e.message);
      throw e;
    }

  }

  /**
   * Get a number of entries according to options
   * @param {string} entity - one of entities (check config)
   * @param {number} limit
   * @param {number} offset
   * @param {string} order
   * @param {boolean} desc
   * @param {string} filter
   * @return {Promise<{count: Integer, rows: Model[]}>}
   */
  static async getAll(entity, limit, offset, order, desc, filter) {
    if (!entity) {
      const m = 'Entity undefined';
      log.error(m);
      throw new TypeError(m);
    }

    const options = this.setOptions(limit, offset, order, desc, filter);
    options.where.entity = entity;
    try {
      return await Tag.findAndCountAll(options);
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }

  /**
   * Get a number of entries, associated with an instance
   * @param {Sequelize.Model} instance
   * @param {number} limit
   * @param {number} offset
   * @param {string} order
   * @param {boolean} desc
   * @param {string} filter
   * @return {Promise<string[]>}
   */
  static async getAllByInstance(instance, limit, offset, order, desc, filter) {
    const options = this.setOptions(limit, offset, order, desc, filter);
    return await instance.getTags(options);
  }

  /**
   *
   * @param {string} entity - one of entities (check config)
   * @param {string} id - a unique tag name that acts like a tag
   * @return {Promise<*>}
   */
  static async delete(entity, id) {
    try {
      if (entity === 'articles' && selTags.include(id)) throw new TypeError(`Tag ${id} is undestructable`);
      const t = await this.get(entity, id);
      return await t.destroy();
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }
};