const fse = require('fs-extra');
const path = require('path');
const pubPath = process.env.publicPath;
const smPath = path.join(pubPath, './files/sitemaps');
const config = require('../modules/config');
const models = require('../modules/sequelize');
const locales = config.get('locales');
const regions = config.get('regions');
const selTags = config.get('articlesSelectedTags');


const Logger = require('../modules/logger');
const log = new Logger(module);

module.exports = class SitemapController {

  static setDate() {
    const date = new Date();
    const mm = date.getMonth() + 1; // getMonth() is zero-based
    const dd = date.getDate();

    return [date.getFullYear(),
      (mm>9 ? '' : '0') + mm,
      (dd>9 ? '' : '0') + dd
    ].join('-');
  }

  static async getItems(e, l, limit, offset) {
    const model = (e==='pages') ? models.Page : models.Article;
    const params = {
      where: {
        locale: l,
        published: true,
      },
      limit: 100,
      offset: offset || 0,
      attributes: ['url', 'subdomain'],
      include: [{
        model: models.Tag,
        attributes: ['id'],
        through: {attributes: []},
      }],
    };
    return await model.findAndCountAll(params);
  }

  static createFile(fp, links, host, prefix) {
    const ws = fse.createWriteStream(fp);
    ws.write('<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n', 'utf8');

    for (const i of links) {
      const priority = (selTags.includes(i[0].split('/')[1])) ? '0.8' : '1.0';
      const sd = (i[0] !== config.get('subdomains')[0]) ? i[0]+'.' : '';

      ws.write('<url>\n' +
          '    <loc>https://'+sd+host+prefix+i[1]+'</loc>\n' +
          '    <lastmod>'+SitemapController.setDate()+'</lastmod>\n' +
          '    <changefreq>daily</changefreq>\n' +
          '    <priority>'+priority+'</priority>\n' +
          '</url>\n\n', 'utf8');
    }

    ws.write('</urlset>\n', 'utf8');
    ws.end();
    log.info(`[SITEMAP]: file ${fp} created`);
  }

  static async generateSitemaps() {
    try {
      log.warn('[SITEMAP]: Sitemap generation started');
      await fse.emptyDir(smPath);

      // create locale-defined lists of items
      const items = {};

      for (const l of locales) {
        let li = [];

        for (const e of ['pages', 'articles']) {
          const limit = 100;

          console.log('LIMIT', limit);
          let entries = await this.getItems(e, l, limit);

          console.log('ENTRIES', entries.count);

          if (entries.count > 0) {
            li = li.concat(entries.rows);

            const pages = Math.floor(entries.count/limit);
            if (pages > 0 ) {
              let n = 1;

              while (n<=pages) {
                entries = await this.getItems(e, l, limit, n*limit);
                li = li.concat(entries.rows);
                log.info(`[SITEMAP]: locale "${l}" - more entries added, ${li.length} in a list`);
                n++;
              }
            }
          }

          log.info(`[SITEMAP]: locale "${l}" - ${entries.count} ${e} found, ${li.length} in a list`);
        }

        log.info(`[SITEMAP]: locale "${l}" - ${li.length} total items found`);
        items[l] = li;
      }



      // extract links
      const links = {};
      for (const l of locales) {
        const li = [];
        for (const i of items[l]) {
          let tag = false;

          if (i.tags) {
            for (const t of selTags) {
              if (i.tags.includes(t)) {
                tag = `/${t}${i.url}`;
                li.push([i.subdomain, tag]);
              }
            }
          }

          if (!tag) li.push([i.subdomain, i.url]);
        }
        log.info(`[SITEMAP]: locale "${l}" - ${li.length} urls extracted`);
        links[l] = li;
      }
      const sitemaps = [];

      // create sitemaps (see routes/pages.js prepareLocaleSet)
      for (const l of locales) {
        const prefix = `${l}-${l}`;
        const name = `sitemap-${prefix}.xml`;
        const fp = path.join(smPath, `./${name}`);
        this.createFile(fp, links[l], config.get('host')['production'], '/'+prefix);
        sitemaps.push(name);
      }

      for (const i of regions) {
        const l = locales[0];
        const prefix = `${l}-${i}`;
        const name = `sitemap-${prefix}.xml`;
        const fp = path.join(smPath, `./${name}`);
        this.createFile(fp, links[l], config.get('host')['production'], '/'+prefix);
        sitemaps.push(name);
      }

      // create def sitemap
      const name = `sitemap-default.xml`;
      const fpDef = path.join(smPath, `./${name}`);
      this.createFile(fpDef, links[locales[0]], config.get('host')['production'], '');
      sitemaps.push(name);


      // create mirrors sitemaps
      for (const i of config.get('mirrors')) {
        const l = links[i[1].split('-')[0]];
        const fp = path.join(smPath, `./sitemap-${i[0]}.xml`);
        this.createFile(fp, l, i[0], '');
      }

      // create main sitemap
      const fpMain = path.join(pubPath, `./files/sitemaps/sitemap.xml`);
      const ws = fse.createWriteStream(fpMain);
      ws.write('<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n', 'utf8');
      for (const i of sitemaps) {
        ws.write('<url>\n' +
            '    <loc>https://'+config.get('host')['production']+'/public/files/sitemaps/'+i+'</loc>\n' +
            '    <lastmod>'+SitemapController.setDate()+'</lastmod>\n' +
            '</url>\n\n', 'utf8');
      }
      ws.write('</urlset>\n', 'utf8');
      ws.end();
      log.info(`[SITEMAP]: file ${fpMain} created`);

      log.info(`[SITEMAP]: files generation completed`);


    } catch (e) {
      log.error(`[SITEMAP]: files generation failed. ${e}`);
      console.log(e);
      process.env.sitemaps_worker = false;
    }
  }

  static launchGenerator() {
    if (!process.env.sitemaps_worker) {
      process.env.sitemaps_worker = true;
      log.info(`[SITEMAP]: worker started`);
      setTimeout(function() {
        return Promise.resolve(SitemapController.generateSitemaps());
      }, 1000);
    } else {
      log.info(`[SITEMAP]: worker already loaded`);
    }
  }
};
