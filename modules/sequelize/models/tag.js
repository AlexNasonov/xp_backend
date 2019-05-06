const config = require('../../config');

module.exports = function(sequelize, DataTypes) {
  const Model = sequelize.define('tag',
      {
        id: {
          type: DataTypes.STRING(64),
          primaryKey: true,
          validate: {notEmpty: true},
        },

        description: {
          type: DataTypes.STRING(255),
        },

        entity: {
          type: DataTypes.STRING(12),
          validate: {
            notEmpty: true,
            isIn: [config.get('entities')],
          },
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
