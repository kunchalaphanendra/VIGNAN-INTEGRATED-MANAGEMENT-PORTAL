/**
 * backup.js — Automated MySQL database & Uploads zip backup
 * Triggered by node-cron in server.js or manually by administrative endpoints.
 */

const { exec } = require('child_process');
const path     = require('path');
const fs       = require('fs');
const { ZipArchive } = require('archiver');
const { uploadFileToCloud } = require('./utils/cloudStorage');

const BACKUP_ROOT = path.join(__dirname, '..', 'backups');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Retention definitions
const RETENTION = {
    daily: 30,
    weekly: 12,
    monthly: 12,
    semester: Infinity, // Immutable
    yearly: Infinity,   // Immutable
};

/**
 * Ensures backup directory structure exists:
 * backups/
 *   ├── daily/
 *   ├── weekly/
 *   ├── monthly/
 *   ├── semester/
 *   └── yearly/
 */
function ensureBackupDirs() {
    if (!fs.existsSync(BACKUP_ROOT)) {
        fs.mkdirSync(BACKUP_ROOT, { recursive: true });
    }
    Object.keys(RETENTION).forEach(tier => {
        const tierDir = path.join(BACKUP_ROOT, tier);
        if (!fs.existsSync(tierDir)) {
            fs.mkdirSync(tierDir, { recursive: true });
        }
    });
}

/**
 * Runs a MySQL database dump and packages it along with the /uploads directory into a single zip.
 * @param {string} tier - 'daily', 'weekly', 'monthly', 'semester', or 'yearly'
 * @param {string} [customName] - Optional label for semester or yearly snapshot
 * @returns {Promise<{ file: string, size: string, path: string, tier: string, replicated: boolean }>}
 */
function runBackup(tier = 'daily', customName = '') {
    return new Promise((resolve, reject) => {
        ensureBackupDirs();

        const db   = process.env.DB_NAME     || 'vignan_portal';
        const host = process.env.DB_HOST     || 'localhost';
        const user = process.env.DB_USER     || 'root';
        const pass = process.env.DB_PASS     || process.env.DB_PASSWORD || '';
        const port = process.env.DB_PORT     || '3306';

        // Prepare filenames
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const nameSuffix = customName ? `_${customName.trim().replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
        const zipName = `backup_${tier}${nameSuffix}_${ts}.zip`;
        const tierDir = path.join(BACKUP_ROOT, tier);
        const finalZipPath = path.join(tierDir, zipName);

        // Temp location for database SQL dump
        const tempSqlPath = path.join(BACKUP_ROOT, `temp_${tier}_db.sql`);

        // Build mysqldump command
        const passFlag = pass ? `-p"${pass}"` : '';
        const cmd = `mysqldump -h ${host} -P ${port} -u ${user} ${passFlag} --no-tablespaces --single-transaction --routines --triggers ${db} > "${tempSqlPath}"`;

        exec(cmd, { shell: true }, async (err) => {
            if (err) {
                // Clean up temp SQL if created
                try { if (fs.existsSync(tempSqlPath)) fs.unlinkSync(tempSqlPath); } catch (_) {}
                return reject(new Error(`mysqldump failed: ${err.message}`));
            }

            // Create ZIP archive
            const output = fs.createWriteStream(finalZipPath);
            const archive = new ZipArchive({ zlib: { level: 9 } });

            output.on('close', async () => {
                // Clean up temp SQL file
                try { if (fs.existsSync(tempSqlPath)) fs.unlinkSync(tempSqlPath); } catch (_) {}

                const stat = fs.statSync(finalZipPath);
                const size = (stat.size / (1024 * 1024)).toFixed(2) + ' MB';
                console.log(`[Backup] ✅ Saved Tiered Backup locally: ${zipName} (${size})`);

                // Upload offsite to cloud storage (S3)
                const replicated = await uploadFileToCloud(finalZipPath, tier, zipName);

                // Prune old backups in this specific tier according to retention schedules
                pruneBackups(tier);

                resolve({
                    file: zipName,
                    size,
                    path: finalZipPath,
                    tier,
                    replicated,
                });
            });

            archive.on('error', (zipErr) => {
                try { if (fs.existsSync(tempSqlPath)) fs.unlinkSync(tempSqlPath); } catch (_) {}
                try { if (fs.existsSync(finalZipPath)) fs.unlinkSync(finalZipPath); } catch (_) {}
                reject(new Error(`ZIP compression failed: ${zipErr.message}`));
            });

            archive.pipe(output);

            // Add MySQL dump file into ZIP root as 'database.sql'
            archive.file(tempSqlPath, { name: 'database.sql' });

            // Add server's uploads folder inside the ZIP under 'uploads/' folder
            if (fs.existsSync(UPLOADS_DIR)) {
                archive.directory(UPLOADS_DIR, 'uploads');
            }

            archive.finalize();
        });
    });
}

/**
 * Prunes the local backup folder of the specified tier based on its retention definition.
 * @param {string} tier - The retention tier to prune
 */
function pruneBackups(tier) {
    const limit = RETENTION[tier];
    if (!limit || limit === Infinity) {
        console.log(`[Backup] 🔒 Tier "${tier}" is immutable. Skipping pruning.`);
        return;
    }

    try {
        const tierDir = path.join(BACKUP_ROOT, tier);
        if (!fs.existsSync(tierDir)) return;

        const files = fs.readdirSync(tierDir)
            .filter(f => f.startsWith('backup_') && f.endsWith('.zip'))
            .map(f => ({ name: f, time: fs.statSync(path.join(tierDir, f)).mtimeMs }))
            .sort((a, b) => b.time - a.time); // Newest first

        files.slice(limit).forEach(({ name }) => {
            const filepath = path.join(tierDir, name);
            fs.unlinkSync(filepath);
            console.log(`[Backup] 🗑 Pruned old ${tier} backup: ${name}`);
        });
    } catch (err) {
        console.error(`[Backup] Pruning error for tier ${tier}:`, err.message);
    }
}

/**
 * Recursively scans all tier folders and returns metadata about all backups.
 * @returns {Array<{ file: string, size: string, tier: string, created_at: string, path: string }>}
 */
function listBackups() {
    ensureBackupDirs();
    const results = [];

    Object.keys(RETENTION).forEach(tier => {
        const tierDir = path.join(BACKUP_ROOT, tier);
        if (!fs.existsSync(tierDir)) return;

        const files = fs.readdirSync(tierDir)
            .filter(f => f.startsWith('backup_') && f.endsWith('.zip'));

        files.forEach(f => {
            const filepath = path.join(tierDir, f);
            const stat = fs.statSync(filepath);
            results.push({
                file: f,
                size: (stat.size / (1024 * 1024)).toFixed(2) + ' MB',
                tier,
                created_at: stat.mtime.toISOString(),
                path: filepath,
            });
        });
    });

    // Return sorted by created_at descending (newest first)
    return results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

module.exports = {
    runBackup,
    listBackups,
    pruneBackups,
    BACKUP_ROOT,
};
