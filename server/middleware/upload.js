const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const ALLOWED_TYPES = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
};

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const role = req.user ? req.user.role : 'general';
        const userId = req.user ? req.user.id : 'anonymous';
        const dest = path.join(__dirname, '..', 'uploads', role, String(userId));
        // Create directory if not exists
        const fs = require('fs');
        fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${uuidv4()}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) {
        cb(null, true);
    } else {
        cb(new Error('File type not allowed. Only PDF, JPG, PNG, and DOCX are accepted.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_SIZE }
});

module.exports = upload;
