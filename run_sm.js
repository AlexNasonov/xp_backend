const path = require('path');
const app = require('./sitemap_gen')(path.resolve(__dirname, './sites/flussonic'), true);

//TODO: make a test site