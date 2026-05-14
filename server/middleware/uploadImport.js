const multer = require('multer');
const path = require('path');
const os = require('os');

// Store import files in the system temp directory — they are deleted immediately after parsing
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `import_${Date.now()}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = [
        'text/csv',
        'application/vnd.ms-excel',                                           // .xls
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  // .xlsx
        'text/plain',       // some browsers send CSVs as text/plain
        'application/octet-stream'  // fallback for some upload clients
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(file.mimetype) || ['.csv', '.xlsx', '.xls'].includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only .csv and .xlsx files are accepted for import.'), false);
    }
};

const uploadImport = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

module.exports = uploadImport;
