const multer = require('multer');

function errorHandler(err, req, res, next) {
  console.error('API Error:', err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum allowed size is 5 MB.'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`
    });
  }

  if (err.message && err.message.includes('Invalid file format')) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'An unexpected error occurred. Please try again.';

  res.status(statusCode).json({
    success: false,
    message: message
  });
}

function notFoundHandler(req, res, next) {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      message: `API endpoint ${req.method} ${req.originalUrl} not found.`
    });
  }

  res.status(404).json({
    success: false,
    message: `Resource ${req.originalUrl} not found.`
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
