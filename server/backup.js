/**
 * backup.js — Automated MySQL database backup
 * Triggered daily by node-cron in server.js
 * Can also be called manually via the /api/backup/run endpoint
 */

const { exec } = require('child_process');
const path     = require('path');
const fs       = require('fs');

const BACKUP_DIR    = path.join(__dirname, '..', 'backups');
const MAX_BACKUPS   = 30; // keep last 30 daily backups

/**
 * Run a mysqldump and save to /backups/
 * Returns a Promise<{ file, size }> on success.
 */
function runBackup() {
    return new Promise((resolve, reject) => {
        // Ensure backup dir exists
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }

        const db   = process.env.DB_NAME     || 'vignan_portal';
        const host = process.env.DB_HOST     || 'localhost';
        const user = process.env.DB_USER     || 'root';
        const pass = process.env.DB_PASSWORD || '';
        const port = process.env.DB_PORT     || '3306';

        const ts       = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `backup_${ts}.sql`;
        const filepath = path.join(BACKUP_DIR, filename);

        // Build mysqldump command
        // Use --no-tablespaces to avoid PROCESS privilege requirement
        const passFlag = pass ? `-p"${pass}"` : '';
        const cmd = `mysqldump -h ${host} -P ${port} -u ${user} ${passFlag} --no-tablespaces --single-transaction --routines --triggers ${db} > "${filepath}"`;

        exec(cmd, { shell: true }, (err) => {
            if (err) {
                // Clean up empty file if created
                try { if (fs.existsSync(filepath)) fs.unlinkSync(filepath); } catch (_) {}
                return reject(new Error(`mysqldump failed: ${err.message}`));
            }

            const stat = fs.statSync(filepath);
            const size = (stat.size / 1024).toFixed(1) + ' KB';

            console.log(`[Backup] ✅ Saved: ${filename} (${size})`);

            // Rotate: delete oldest backups if count > MAX_BACKUPS
            pruneBackups();

            resolve({ file: filename, size, path: filepath });
        });
    });
}

/**
 * Delete oldest backups keeping only MAX_BACKUPS most recent.
 */
function pruneBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('backup_') && f.endsWith('.sql'))
            .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
            .sort((a, b) => b.time - a.time); // newest first

        files.slice(MAX_BACKUPS).forEach(({ name }) => {
            fs.unlinkSync(path.join(BACKUP_DIR, name));
            console.log(`[Backup] 🗑 Pruned old backup: ${name}`);
        });
    } catch (err) {
        console.error('[Backup] Prune error:', err.message);
    }
}

/**
 * List all existing backups with metadata.
 */
function listBackups() {
    try {
        if (!fs.existsSync(BACKUP_DIR)) return [];
        return fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('backup_') && f.endsWith('.sql'))
            .map(f => {
                const stat = fs.statSync(path.join(BACKUP_DIR, f));
                return {
                    file: f,
                    size: (stat.size / 1024).toFixed(1) + ' KB',
                    created_at: stat.mtime.toISOString(),
                };
            })
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } catch {
        return [];
    }
}

module.exports = { runBackup, listBackups, BACKUP_DIR };
