const express  = require('express');
const router   = express.Router();
const auth = require('../middleware/auth');
const { runBackup, listBackups, BACKUP_DIR } = require('../backup');
const path = require('path');
const fs   = require('fs');

// Only HOD or Principal can trigger/view backups
const adminOnly = (req, res, next) => {
    if (!['hod', 'principal'].includes(req.user?.role)) {
        return res.status(403).json({ error: 'Not authorized' });
    }
    next();
};

// POST /api/backup/run — trigger a manual backup
router.post('/run', auth, adminOnly, async (req, res) => {
    try {
        const result = await runBackup();
        res.json({ message: 'Backup created successfully', ...result });
    } catch (err) {
        console.error('[Backup route] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/backup/list — list all backups
router.get('/list', auth, adminOnly, (req, res) => {
    res.json({ backups: listBackups() });
});

// GET /api/backup/download/:filename — download a backup file
router.get('/download/:filename', auth, adminOnly, (req, res) => {
    const filename = req.params.filename;
    // Sanitize: only allow backup_*.sql filenames
    if (!/^backup_[\d\-T]+\.sql$/.test(filename)) {
        return res.status(400).json({ error: 'Invalid filename' });
    }
    const filepath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'Backup file not found' });
    }
    res.download(filepath, filename);
});

module.exports = router;
