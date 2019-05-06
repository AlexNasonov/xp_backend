'use strict';

module.exports = function(sequelize, DataTypes) {
  let Model = sequelize.define('user', {

    email: {
      type: DataTypes.STRING(128),
      primaryKey: true,
      validate: {
        isEmail: true,
      },
    },

    password: {
      type: DataTypes.STRING(255),
      validate: {
        notEmpty: true,
      },
    },

    name: {
      type: DataTypes.STRING(64),
    },

    surname: {
      type: DataTypes.STRING(64),
    },

    role: {
      type: DataTypes.STRING(12),
      defaultValue: 'guest',
      validate: {
        notEmpty: true,
        isIn: [['guest', 'editor', 'admin']],
      },
    },

    enabled: {
      type: DataTypes.BOOLEAN,
      validate: {
        notEmpty: true,
      },
      defaultValue: true,
    },

    details: {
      type: DataTypes.JSONB,
      defaultValue: {},
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
