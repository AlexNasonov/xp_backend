const config = require('../config');
const path = require('path');

const db = config.getEnv('database');

const Sequelize = require('sequelize');

const sequelize = new Sequelize(
    db['name'],
    db['username'],
    db['password'], {
      host: db.host,
      port: db.port,
      dialect: config.get('dbDialect'),
      logging: (db.logging) ? console.log : false,
      native: false,
      dialectOptions: {
        ssl: db.ssl,
      },
      pool: {
        max: 5,
        min: 0,
        idle: 10000,
      },
    });

if (['development', 'staging'].includes(process.env.NODE_ENV))console.log(db);

const User = sequelize.import(path.join(__dirname, 'models/user'));
const Tag = sequelize.import(path.join(__dirname, 'models/tag'));
const Chunk = sequelize.import(path.join(__dirname, 'models/chunk'));
const Page = sequelize.import(path.join(__dirname, 'models/page'));
const Article = sequelize.import(path.join(__dirname, 'models/article'));
const Lead = sequelize.import(path.join(__dirname, 'models/lead'));

Chunk.belongsToMany(Tag, {through: 'chunk_tags'});
Tag.belongsToMany(Chunk, {through: 'chunk_tags'});

Page.belongsToMany(Tag, {through: 'page_tags'});
Tag.belongsToMany(Page, {through: 'page_tags'});

Article.belongsToMany(Tag, {through: 'article_tags'});
Tag.belongsToMany(Article, {through: 'article_tags'});

Article.belongsTo(Page);

/**
 * Exports
 */
exports.sequelize = sequelize;
exports.User = User;
exports.Tag = Tag;
exports.Chunk = Chunk;
exports.Page = Page;
exports.Article = Article;
exports.Lead = Lead;
