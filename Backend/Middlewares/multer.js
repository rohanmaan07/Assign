// server/middlewares/multer.js
const multer = require('multer');

// File ko server ki memory mein store karein (disk par nahi)
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB video limit
});

module.exports = upload;