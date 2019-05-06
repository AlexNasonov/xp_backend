const config = require('../../config');
const locales = config.get('locales');
const subdomains = config.get('subdomains');

module.exports = function(sequelize, DataTypes) {
  const Model = sequelize.define('article',
      {
        id: {
          type: DataTypes.STRING(64),
          primaryKey: true,
          validate: {notEmpty: true},
        },

        url: {
          type: DataTypes.STRING(128),
          validate: {
            notEmpty: true,
          }
        },
        body: {
          type: DataTypes.TEXT,
        },

        header: {
          type: DataTypes.STRING(255),
        },

        summary: {
          type: DataTypes.STRING(255),
        },

        title: {
          type: DataTypes.STRING(255),
        },

        description: {
          type: DataTypes.STRING(255),
        },

        keywords: {
          type: DataTypes.STRING(255),
        },

        og_image_url: {
          type: DataTypes.STRING(255),
          defaultValue: '/images/og-image.jpg',
          validate: {
            notEmpty: true,
          },
        },

        og_image_width: {
          type: DataTypes.INTEGER,
          defaultValue: 1200,
          validate: {
            notEmpty: true,
          },
        },

        og_image_height: {
          type: DataTypes.INTEGER,
          defaultValue: 630,
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

        published: {
          type: DataTypes.BOOLEAN,
          validate: {
            notEmpty: true,
          },
          defaultValue: false,
        },

        details: {
          type: DataTypes.JSONB,
        },

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
