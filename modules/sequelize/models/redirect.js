const config = require('../../config');
const locales = config.get('locales');
const subdomains = config.get('subdomains');

module.exports = function(sequelize, DataTypes) {
  const Model = sequelize.define('redirect',
      {
        old: {
          type: DataTypes.STRING(255),
          validate: {
            notEmpty: true,
          },
        },
        new: {
          type: DataTypes.STRING(255),
          validate: {
            notEmpty: true,
          },
        },

        locale: {
          type: DataTypes.STRING(5),
          defaultValue: locales[0],
          validate: {
            notEmpty: true,
            isIn: [locales],
          },
        },

        subdomain: {
          type: DataTypes.STRING(16),
          defaultValue: subdomains[0],
          validate: {
            notEmpty: true,
            isIn: [subdomains],
          },
        },

        details: {
          type: DataTypes.JSONB,
        },

      },
      {
        indexes: [
          {
            unique: true,
            fields: ['old', 'locale', 'subdomain'],
          },
        ],
      });

  Model.prototype.updateDetails = function(key, value) {
    const d = this.details || {};
    d[key] = value;
    return this.update({details: d});
  };

  Model.prototype.removeDetails = function(key) {
    const d = this.details;
    delete d[key];
    return this.update({details: d});
  };

  return Model;
};
