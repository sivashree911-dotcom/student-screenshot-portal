const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// Ensure upload directories exist
const postersDir = path.join(config.uploadDir, 'posters');
const screenshotsDir = path.join(config.uploadDir, 'screenshots');

if (!fs.existsSync(postersDir)) {
  fs.mkdirSync(postersDir, { recursive: true });
}
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp'];

// Storage config for Screenshots
const screenshotStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, screenshotsDir);
  },
  filename: function (req, file, cb) {
    const regNo = req.student ? req.student.registerNumber : 'unknown';
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `screenshot-${regNo}-${uniqueSuffix}${ext}`);
  }
});

// Storage config for Posters
const posterStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, postersDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `poster-${uniqueSuffix}${ext}`);
  }
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Only PNG, JPG, JPEG, and WEBP images are allowed.'), false);
  }
}

// 5 MB file size limit
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const uploadScreenshot = multer({
  storage: screenshotStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: fileFilter
});

const uploadPoster = multer({
  storage: posterStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: fileFilter
});

module.exports = {
  uploadScreenshot,
  uploadPoster,
  postersDir,
  screenshotsDir
};
