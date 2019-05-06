const TagC = require('../../controllers/TagController');
const config = require('../config');

module.exports = class Predefined {
  static run() {
    // create selected Tags
    for (const i of config.get('articlesSelectedTags')) {
      TagC.get('articles', i, 'Selected tag. Undestructable')
          .catch();
    }
  }
};
