/**
 * route middleware to trace leads
 */
const LocalLogger = require('../logger');
const log = new LocalLogger(module);
const request = require('request');
const Lead = require('../sequelize').Lead;
const config = require('../config');

exports.LeadTracer = function(req, res, next) {
  if (req.session._ga) return next();

  if (!req.headers.cookie) return next();

  const cookies = {};

  for (const i of req.headers.cookie.split('; ')) {
    const ia = i.split('=');
    cookies[ia[0]] = ia[1];
  }
  if (!cookies._ga) return next();
  if (req.session._ga === cookies._ga) return next();
  else {
    let data = {};
    return Lead.findOne({where: {_ga: cookies._ga}})
        .then((lead) => {
          if (lead) {
            req.session._ga = lead._ga;
            next();
          } else {
            data = {
              _ga: cookies._ga,
              ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
              languages: [],
              agent: req.headers['user-agent'],
            };

            for (const l of req.headers['accept-language'].split(',')) {
              const ls = l.split(';');
              data.languages.push({
                locale: ls[0],
                q: (!ls[1]) ? 1.0 : parseFloat(ls[1].slice(2)),
              });
            }

            return getGeo(data.ip)
                .then((body)=>{
                  data.geo = body;
                  data.languages = JSON.stringify(data.languages);
                  return Lead.create(data);
                })
                .then((lead)=>{
                  req.session._ga = lead._ga;
                  next();
                })
                .catch((e) => {
                  log.error(e);
                  next();
                });
          }
        })
        .catch((e) => {
          log.error(e);
          next();
        });
  }
};

getGeo = (ip) => {
  return new Promise((resolve, reject)=> {
    request(`http://api.ipstack.com/${(ip !== '::1') ?
      ip :
      '8.8.8.8'}?access_key=${config.get('ipGeoKey')}`,
    function(error, response, body) {
      if (error) reject(error);
      else resolve(body);
    });
  });
};
