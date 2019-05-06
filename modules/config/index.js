const nconf = require('nconf');

Object.assign(nconf, {
  getEnv(param) {
    const c = this.get(param);
    const e = process.env.NODE_ENV;
    return (['development', 'staging'].includes(e)) ? c[e] : c.production;
  },
});

module.exports = nconf;
