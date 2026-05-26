const express  = require('express');
const router   = express.Router();
const auth = require('../middleware/auth');
const { runBackup, listBackups, BACKUP_ROOT } = require('../backup');
const { isCloudConfigured } = require('../utils/cloudStorage');
const path = require('path');
const fs   = require('fs');

// Only HOD or Principal can trigger/view backups
const adminOnly = (req, res, next) => {
    if (!['hod', 'principal'].includes(req.user?.role)) {
        return res.status(403).json({ error: 'Not authorized' });
    }
    next();
};

// GET /api/backup/status — Check backup configuration and S3 status
router.get('/status', auth, adminOnly, (req, res) => {
    res.json({
        cloudConfigured: isCloudConfigured(),
        backupRoot: BACKUP_ROOT,
    });
});

// POST /api/backup/run — trigger a manual backup (optionally with tier and custom label)
router.post('/run', auth, adminOnly, async (req, res) => {
    try {
        const { tier = 'daily', customName } = req.body;
        if (!['daily', 'weekly', 'monthly', 'semester', 'yearly'].includes(tier)) {
            return res.status(400).json({ error: 'Invalid backup tier' });
        }
        if (['semester', 'yearly'].includes(tier) && (!customName || !customName.trim())) {
            return res.status(400).json({ error: 'A custom label/name is required for semester and yearly snapshots' });
        }

        const result = await runBackup(tier, customName);
        res.json({ message: `${tier.charAt(0).toUpperCase() + tier.slice(1)} backup created successfully`, ...result });
    } catch (err) {
        console.error('[Backup route] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/backup/list — list all backups from all tiers
router.get('/list', auth, adminOnly, (req, res) => {
    res.json({ backups: listBackups() });
});

// GET /api/backup/download/:tier/:filename — download a zip backup file from a specific tier directory
router.get('/download/:tier/:filename', auth, adminOnly, (req, res) => {
    const { tier, filename } = req.params;
    
    if (!['daily', 'weekly', 'monthly', 'semester', 'yearly'].includes(tier)) {
        return res.status(400).json({ error: 'Invalid backup tier' });
    }
    // Sanitize: only allow backup_*.zip files
    if (!/^backup_[a-zA-Z0-9_-]+\.zip$/.test(filename)) {
        return res.status(400).json({ error: 'Invalid backup filename format' });
    }

    const filepath = path.join(BACKUP_ROOT, tier, filename);
    if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'Backup file not found' });
    }
    
    res.download(filepath, filename);
});

module.exports = router;
