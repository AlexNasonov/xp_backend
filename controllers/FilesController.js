const fs = require('fs');
const path = require('path');
const util = require('util');
const readDirectory = util.promisify(fs.readdir);
const renameFile = util.promisify(fs.rename);
const writeFile = util.promisify(fs.writeFile);
const deleteFile = util.promisify(fs.unlink);
const deleteDirectory = util.promisify(fs.rmdir);
const stat = util.promisify(fs.stat);
const mime = require('mime-types');
const chmodr = util.promisify(require('chmodr'));

const Logger = require('../modules/logger');
const log = new Logger(module);

setPath = (p) => path.join(process.env.publicPath, p || '');

module.exports = class FilesController {
  static async readDir(dpath) {
    try {
      const p = setPath(dpath);
      if (!fs.existsSync(p)) return false;
      else {
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
      }
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
      if (fs.existsSync(p)) return;
      fs.mkdirSync(p);
      await chmodr(p, 0o777);
    } catch (e) {
      if (e.errno === -4058) e.status = 404;
      log.error(e.message);
      throw e;
    }
  }

  static async deleteDir(dpath) {
    try {
      const p = setPath(dpath);
      if (p === path.join(__dirname, `../public`) || !fs.existsSync(p)) return;
      return await deleteDirectory(p);
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }

  static async moveFile(name, destination) {
    try {
      const f = path.join(__dirname, `../public/tmp`, name);
      const t = path.join(__dirname, `../public`, destination, name);

      await renameFile(f, t);
      return path.join('/', destination, name);
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }

  static async deleteFile(fpath) {
    try {
      const p = path.join(__dirname, `../public`, fpath);
      return await deleteFile(p);
    } catch (e) {
      log.error(e.message);
      throw e;
    }
  }
};
