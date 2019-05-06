const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const LocalLogger = require('../modules/logger');
const log = new LocalLogger(module);

const FilesC = require('../controllers/FilesController');
const access = require('../modules/access').Editor;

upload = function(req, res, next) {

};

router.get('/dir', access, (req, res, next) => {
  FilesC.readDir(req.query.url)
      .then((data) => (data) ? res.status(200).json(data) : res.sendStatus(404))
      .catch((e) => {
        res.status(500).json(e.message);
      });
});

router.post('/dir', access, (req, res, next) => {
  FilesC.createDir(req.body.url)
      .then(() => res.sendStatus(200))
      .catch((e) => {
        e.status = (e.status) ? e.status : 500;
        res.status(e.status).json(e.message);
      });
});

router.delete('/dir', access, (req, res, next) => {
  FilesC.deleteDir(req.query.url)
      .then(() => res.sendStatus(200))
      .catch((e) => {
        res.status(500).json(e.message);
      });
});

router.post('/upload', access, (req, res, next)=>{
  const tmp = 'tmp';

  FilesC.createDir(tmp)
      .then(() => {
        const storage = multer.diskStorage(
            {
              destination: path.join(__dirname, '../public', tmp),
              filename: function( req, file, cb ) {
                cb( null, Date.now() + '-' + file.originalname);
              },
            }
        );

        const u = multer({
          storage: storage,
        }).single('file');

        return new Promise((resolve, reject) =>{
          u(req, res, function(err) {
            if (err) reject(err);

            resolve(FilesC.moveFile(req.file.filename, req.body.dir));
          });
        });
      })
      .then((file) =>{
        return res.status(200).json(file);
      })
      .catch((e) => {
        res.status(500).json(e.message);
      });
});

router.delete('/file', access, (req, res, next) => {
  FilesC.deleteFile(req.query.url)
      .then(() => res.sendStatus(200))
      .catch((e) => {
        res.status(500).json(e.message);
      });
});

module.exports = router;
