const TagC = require('../../controllers/TagController');
const config = require('../config');
const selTags = config.get('articlesSelectedTags') || [];
const models = require('../sequelize');
const sequelize = models.sequelize;

module.exports = class Predefined {
  static async run() {
    // create selected Tags
    for (const i of selTags) {
      await TagC.get('articles', i, 'Selected tag. Undestructable')
          .catch();
    }

    const vectorName = '_search';
    const searchObjects = {
      articles: ['header', 'body'],
    };


    sequelize.transaction((t) =>
      Promise.all(Object.keys(searchObjects).map((table) =>
        sequelize.query(`
          ALTER TABLE ${table} ADD COLUMN ${vectorName} TSVECTOR;
        `, {transaction: t})
            .then(() =>
              sequelize.query(`
                UPDATE ${table} SET ${vectorName} = to_tsvector('english', ${searchObjects[table].join(' || \' \' || ')});
              `, {transaction: t})
            ).then(() =>
              sequelize.query(`
                CREATE INDEX ${table}_search ON ${table} USING gin(${vectorName});
              `, {transaction: t})
            ).then(() =>
              sequelize.query(`
                CREATE TRIGGER ${table}_vector_update
                BEFORE INSERT OR UPDATE ON ${table}
                FOR EACH ROW EXECUTE PROCEDURE tsvector_update_trigger(${vectorName}, 'pg_catalog.english', ${searchObjects[table].join(', ')});
              `, {transaction: t})
            )
            .catch(e => console.log(e.message)) // TODO: check if _search exists before execution
      ))
    );
  }
};
