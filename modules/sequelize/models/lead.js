module.exports = function(sequelize, DataTypes) {
  const Model = sequelize.define('lead',
      {
        id: {
          allowNull: false,
          primaryKey: true,
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4
        },

        _ga: {
          type: DataTypes.STRING(128),
          validate: {
            notEmpty: true,
          },
          unique: true,
        },
        ip: {
          type: DataTypes.STRING(32),
        },
        geo: {
          type: DataTypes.TEXT,
        },

        languages: {
          type: DataTypes.STRING(255),
        },

        agent: {
          type: DataTypes.STRING(255),
        },

        email: {
          type: DataTypes.STRING(255),
        },

        description: {
          type: DataTypes.STRING(255),
        },

        name: {
          type: DataTypes.STRING(255),
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
