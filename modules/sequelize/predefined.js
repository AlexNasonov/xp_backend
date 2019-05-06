const TagC = require('../../controllers/TagController');
const config = require('../config');
const selTags = config.get('articlesSelectedTags') || [];

module.exports = class Predefined {
  static run() {
    // create selected Tags
    for (const i of selTags) {
      TagC.get('articles', i, 'Selected tag. Undestructable')
          .catch();
    }
  }
};
