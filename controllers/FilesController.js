const fse = require('fs-extra');
const path = require('path');
const util = require('util');
const readDirectory = util.promisify(fse.readdir);
const stat = util.promisify(fse.stat);
const mime = require('mime-types');

const Logger = require('../modules/logger');
const log = new Logger(module);

setPath = (p) => path.join(process.env.publicPath, p || '');

module.exports = class FilesController {
  static async readDir(dpath) {
    try {
      const p = setPath(dpath);
      const c = await readDirectory(p, {withFileTypes: true});
      for (const i in c) {
        if (c[i]) {
          const tp = path.join(p, c[i].name);
          const s = await stat(tp);
          if (s.isFile()) {
            c[i].type = 'file';
            c[i].size = s.size;
            c[i].mime = mime.lookup(tp);
          }
          if (s.isDirectory()) c[i].type = 'directory';
          c[i].createdAt = s.birthtime;
          c[i].updatedAt = s.mtime;
        }
      }
      return c;
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }

  static async createDir(dpath) {
    const r = /^(\.\.\/(?:\.\.\/)*)?(?!.*?\/\/)(?!(?:.*\/)?\.+(?:\/|$)).+$/;
    if (!r.test(dpath)) {
      const em = 'invalid folder url';
      log.error(em);
      const e = new TypeError(em);
      e.status = 400;
      throw e;
    }
    try {
      const p = setPath(dpath);
      await fse.ensureDir(p, 0o777);
    } catch (e) {
      if (e.errno === -4058) e.status = 404;
      log.error(e.message);
      throw e;
    }
  }

  static async delete(dpath) {
    try {
      if (!dpath) return;
      return await fse.remove(setPath(dpath));
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }

  static async moveFile(name, destination) {
    try {
      const f = setPath(`./tmp/${name}`);
      const t = setPath(destination+'/'+name);

      await fse.move(f, t);
      return path.join('/', destination, name);
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }

};
