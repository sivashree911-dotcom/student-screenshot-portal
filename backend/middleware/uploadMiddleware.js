const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { v2: cloudinary } = require('cloudinary');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// ---------------------------------------------------------
// Cloudinary configuration
// ---------------------------------------------------------
const cloudName = config.cloudinary.cloudName || process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = config.cloudinary.apiKey || process.env.CLOUDINARY_API_KEY;
const apiSecret = config.cloudinary.apiSecret || process.env.CLOUDINARY_API_SECRET;

const isCloudinaryConfigured = Boolean(cloudName && apiKey && apiSecret);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret
  });
}

// ---------------------------------------------------------
// Local upload directories
// Posters use local/disk storage or fallback
// Screenshots are stored permanently in Cloudinary
// ---------------------------------------------------------
const postersDir = path.join(config.uploadDir, 'posters');
const screenshotsDir = path.join(config.uploadDir, 'screenshots');

if (!fs.existsSync(postersDir)) {
  fs.mkdirSync(postersDir, { recursive: true });
}

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// ---------------------------------------------------------
// Allowed image types & validation
// ---------------------------------------------------------
const allowedMimeTypes = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp'
];

const allowedExtensions = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp'
];

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (
    allowedMimeTypes.includes(file.mimetype) &&
    allowedExtensions.includes(ext)
  ) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file format. Only PNG, JPG, JPEG, and WEBP images are allowed.'
      ),
      false
    );
  }
}

// ---------------------------------------------------------
// CLOUDINARY STORAGE — SCREENSHOTS
// ---------------------------------------------------------
let screenshotStorage;

if (isCloudinaryConfigured) {
  screenshotStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'student-screenshot-portal/screenshots',
      resource_type: 'image',
      allowed_formats: ['png', 'jpg', 'jpeg', 'webp'],
      public_id: (req, file) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        return `screenshot-${uniqueSuffix}`;
      }
    }
  });
} else {
  if (config.nodeEnv === 'production') {
    console.warn(
      '⚠️ [CLOUDINARY] Warning: Cloudinary credentials not configured in production. Using local disk storage fallback.'
    );
  }

  screenshotStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, screenshotsDir);
    },
    filename: function (req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `screenshot-${uniqueSuffix}${ext}`);
    }
  });
}

// ---------------------------------------------------------
// LOCAL STORAGE — POSTERS
// ---------------------------------------------------------
const posterStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, postersDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix =
      Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `poster-${uniqueSuffix}${ext}`);
  }
});

// ---------------------------------------------------------
// Maximum file size: 5 MB
// ---------------------------------------------------------
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// ---------------------------------------------------------
// Multer instances
// ---------------------------------------------------------
const uploadScreenshot = multer({
  storage: screenshotStorage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: fileFilter
});

const uploadPoster = multer({
  storage: posterStorage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: fileFilter
});

// ---------------------------------------------------------
// Export
// ---------------------------------------------------------
module.exports = {
  uploadScreenshot,
  uploadPoster,
  postersDir,
  screenshotsDir,
  cloudinary,
  isCloudinaryConfigured
};