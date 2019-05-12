module.exports = async (sitePath) => {
  const fs = require('fs');
  const fse = require('fs-extra');
  const req = require('request-promise-native').defaults({jar: true});
  const path = require('path');
  const pubPath = path.join(sitePath, './public');
  const smPath = path.join(pubPath, './sitemaps');
  const config = require(path.resolve(sitePath, 'config.json'));
  const locales = config.locales;
  const regions = config.regions;
  const selTags = config.articlesSelectedTags;

  const Logger = require('./modules/logger');
  const log = new Logger(module);

  const login = 'media@flussonic.com';
  const password = 'eLxrnUfsiWc';
  const host = 'http://localhost:4000/api';

  try {
    log.warn('[SITEMAP]: Sitemap generation started');
    await fse.emptyDir(smPath);

    // sign in
    await req( {
      method: 'POST',
      uri: host+'/entrance/signin',
      body: {
        email: login,
        password: password,
      },
      json: true,
      resolveWithFullResponse: true,
    });

    log.info(`[SITEMAP]: script signed in as editor`);


    // create locale-defined lists of items
    const items = {};

    for (const l of locales) {
      let li = [];

      for (const e of ['pages', 'articles']) {
        let entries = await getItems(e, l);

        if (entries.body.count > 0) {
          li = li.concat(entries.body.rows);

          const pages = Math.floor(entries.body.count/100);
          if (pages > 0 ) {
            let n = 1;

            while (n<=pages) {
              entries = await getItems(e, l, n*100);
              li = li.concat(entries.body.rows);
              n++;
            }
          }
        }

        log.info(`[SITEMAP]: locale "${l}" - ${entries.body.count} ${e} found, ${li.length} in a list`);
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
              li.push(tag);
            }
          }
        }

        if (!tag) li.push(i.url);
      }
      log.info(`[SITEMAP]: locale "${l}" - ${li.length} urls extracted`);
      links[l] = li;
    }

    // create basic sitemaps
    for (const l of locales) {
      const fp = path.join(smPath, './sitemap-'+l+'.xml');
      const ws = fs.createWriteStream(fp);
      ws.write('<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n', 'utf8');

      for (const i of links[l]) {
        const priority = (selTags.includes(i.split('/')[1])) ? '0.8' : '1.0';

        ws.write('<url>\n' +
            '    <loc>'+i+'</loc>\n' +
            '    <lastmod>'+new Date().toLocaleString()+'</lastmod>\n' +
            '    <changefreq>daily</changefreq>\n' +
            '    <priority>'+priority+'</priority>\n' +
            '</url>\n\n', 'utf8');
      }

      ws.write('</urlset>\n', 'utf8');
      ws.end();
      log.info(`[SITEMAP]: file ${fp} created`);
    }
  } catch (err) {
    console.log(err);
    log.error('[SITEMAP]: Sitemap generation failed \n'+err);
  }

  async function getItems(e, l, offset) {
    const params = {
      method: 'GET',
      uri: host+'/editor/'+e,
      qs: {
        filterPublished: 'true',
        filterLocale: l,
      },
      json: true,
      resolveWithFullResponse: true,
    };

    if (offset) params.qs.offset = offset;

    return await req(params);
  }

  function prepareLocaleSet() {
    const l = [];
    for (const i of locales) {
      l.push(`${i}-${i}`);
    }
    for (const i of regions) {
      l.push(`en-${i}`);
    }
    return l;
  };
};
