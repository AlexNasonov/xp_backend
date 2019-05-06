const models = require('../modules/sequelize');
const bcrypt = require('bcrypt');
const Logger = require('../modules/logger');
const log = new Logger(module);
const mailer = require('./MailerController');
const uuid = require('uuid/v4');
const cu = require('./ControllerUtilities');
const config = require('../modules/config');
const Op = require('sequelize').Op;

const saltRounds = 10;
const prFlag = 'passwordRecovery';


module.exports = class UserController {
  /**
   * Get user data by email (primary key)
   * @param {string} email
   * @return {Promise<Model>}
   */
  static async getbyEmail(email) {
    return models.User.findByPk(email);
  }

  /**
   * Register a new user
   * @param {string} email
   * @param {string} password
   * @return {Promise<boolean>}
   */
  static async signup(email, password) {
    let user;

    try {
      user = await this.getbyEmail(email);
      if (!user) {
        const salt = bcrypt.genSaltSync(saltRounds);
        const userdata = {
          email: email,
          password: bcrypt.hashSync(password, salt),
          role: (!process.env.TEST_ENV) ? 'guest' : 'admin',
        };

        // create user
        user = await models.User.create(userdata);
        log.info(`Created user: ${user.email}`);
        return true;
      } else return false;
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }

  /**
   * Send a user a code for password recovery, make a note in user's details.
   * @param {string} email - user email
   * @return {Promise<string>}
   */
  static async requestNewPassword(email) {
    let user;
    try {
      user = await this.getbyEmail(email);
      if (!user) return 'no user';
      else {
        const code = (process.env.TEST_ENV) ? 'test-code' : uuid();
        const host = config.getEnv('ed-host');
        user.updateDetails(prFlag, code);
        user = await user.save();
        await mailer.sendMail(email,
            `${host} password reset`,
            `Please follow this link to set a new password: 
            http://${host}/enter?recoverCode=${code}&recoverEmail=${email}`);
        log.info(`Mail with password reset credentials sent to ${email}`);
        return 'mail sent';
      }
    } catch (e) {
      user.removeDetails(prFlag);
      log.error(e.message);
      throw e;
    }
  }

  /**
   * set new password for a user
   * @param {string} email - user email
   * @param {string} password - new password, provided by a user
   * @param {string} code - sent to user in an email
   * @return {Promise<string>}
   */
  static async setNewPassword(email, password, code) {
    let user;
    try {
      user = await this.getbyEmail(email);
      if (!user) return 'no user';
      else {
        if (code !== user.details[prFlag]) {
          return 'wrong code';
        }
        const salt = bcrypt.genSaltSync(saltRounds);
        user.password = bcrypt.hashSync(password, salt);
        await user.save();
        user.removeDetails(prFlag);
        return 'success';
      }
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }

  static async getAll(limit, offset, desc, role, filter) {
    try {
      const options = cu.setQueryOptions(+limit, +offset, 'email', desc);
      options.where = {};
      if (role) options.where = {role: role};
      if (filter) options.where.email = {[Op.like]: '%' + filter + '%'};

      return await models.User.findAndCountAll(options);
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }

  static async setRole(email, role) {
    let user;

    if (!['admin', 'editor', 'guest'].includes(role)) return 'bad role';

    try {
      user = await this.getbyEmail(email);
      if (!user) return 'no user';
      else {
        user.role = role;
        await user.save();
        return 'success';
      }
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }

  static async delete(email) {
    try {
      const user = await this.getbyEmail(email);
      if (!user) return 'no user';
      else await user.destroy();
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }

  /**
   * Serialize a user to save his data in session
   * @param {Object} user - Sequelize User model instance
   * @return {Object} user data from session
   */
  static serializeUser(user) {
    const sessionUser = {};
    const params = ['email', 'role', 'enabled', 'name', 'surname'];
    for (const i of params) {
      sessionUser[i] = user[i];
    }
    return sessionUser;
  }
};
