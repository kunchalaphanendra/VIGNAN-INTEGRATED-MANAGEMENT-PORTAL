/**
 * restore.js — Disaster Recovery Restoration CLI Utility
 * Restores both the MySQL database and the /uploads files from a tiered backup ZIP.
 * 
 * Usage:
 *   Local Restore:
 *     node server/db/restore.js <path-to-zip-file>
 * 
 *   S3 Cloud Restore:
 *     node server/db/restore.js --s3 <s3-key> <local-temp-zip-destination>
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

// Load environment variables from server root
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { downloadFileFromCloud } = require('../utils/cloudStorage');

const TEMP_EXTRACT_DIR = path.join(__dirname, 'temp_restore');
const UPLOADS_DEST_DIR = path.join(__dirname, '..', 'uploads');

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        printUsage();
        process.exit(0);
    }

    let zipPath = '';
    let isTempZip = false;

    try {
        if (args[0] === '--s3') {
            if (args.length < 3) {
                console.error('❌ Error: Missing arguments for --s3 mode.');
                printUsage();
                process.exit(1);
            }
            const s3Key = args[1];
            const tempDest = path.resolve(args[2]);

            console.log(`[Restore CLI] ☁️ Initiating cloud restore for S3 Key: ${s3Key}`);
            // Ensure parent directory for temp download exists
            const parentDir = path.dirname(tempDest);
            if (!fs.existsSync(parentDir)) {
                fs.mkdirSync(parentDir, { recursive: true });
            }

            // Download from S3
            await downloadFileFromCloud(s3Key, tempDest);
            zipPath = tempDest;
            isTempZip = true;
        } else {
            zipPath = path.resolve(args[0]);
        }

        // Verify backup zip file exists
        if (!fs.existsSync(zipPath)) {
            throw new Error(`Backup archive file not found at: ${zipPath}`);
        }

        console.log(`[Restore CLI] 📂 Found backup archive: ${zipPath}`);

        // 1. Extract ZIP Archive
        console.log('[Restore CLI] 📦 Extracting archive contents...');
        if (fs.existsSync(TEMP_EXTRACT_DIR)) {
            fs.rmSync(TEMP_EXTRACT_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(TEMP_EXTRACT_DIR, { recursive: true });

        const zip = new AdmZip(zipPath);
        zip.extractAllTo(TEMP_EXTRACT_DIR, true);
        console.log('[Restore CLI] 📦 Extraction complete.');

        // 2. Validate extracted contents
        const sqlPath = path.join(TEMP_EXTRACT_DIR, 'database.sql');
        const uploadsSrcPath = path.join(TEMP_EXTRACT_DIR, 'uploads');

        if (!fs.existsSync(sqlPath)) {
            throw new Error('Invalid backup archive: "database.sql" was not found inside the ZIP file.');
        }

        // 3. Restore Database
        console.log('[Restore CLI] 🛢 Restoring database schema and records...');
        await restoreDatabase(sqlPath);
        console.log('[Restore CLI] 🛢 Database restoration completed successfully.');

        // 4. Restore Uploaded files
        if (fs.existsSync(uploadsSrcPath)) {
            console.log('[Restore CLI] 📁 Restoring uploads directory attachments...');
            if (!fs.existsSync(UPLOADS_DEST_DIR)) {
                fs.mkdirSync(UPLOADS_DEST_DIR, { recursive: true });
            }
            // Copy contents from temp/uploads to active server uploads
            fs.cpSync(uploadsSrcPath, UPLOADS_DEST_DIR, { recursive: true });
            console.log('[Restore CLI] 📁 Upload attachments restored successfully.');
        } else {
            console.log('[Restore CLI] ℹ️ No uploads folder found in backup. Skipping uploads restoration.');
        }

        console.log('\n[Restore CLI] 🎉 DISASTER RECOVERY RESTORATION COMPLETED SUCCESSFULLY!');
        console.log('[Restore CLI] Live application data and file attachments are fully recovered.');

    } catch (err) {
        console.error('\n❌ [Restore CLI] Restoration Failed:', err.message);
        process.exit(1);
    } finally {
        // Clean up temp extraction folder
        try {
            if (fs.existsSync(TEMP_EXTRACT_DIR)) {
                fs.rmSync(TEMP_EXTRACT_DIR, { recursive: true, force: true });
                console.log('[Restore CLI] 🧹 Cleaned up temporary extraction directory.');
            }
        } catch (_) {}

        // Clean up downloaded temp zip if from S3
        try {
            if (isTempZip && fs.existsSync(zipPath)) {
                fs.unlinkSync(zipPath);
                console.log('[Restore CLI] 🧹 Cleaned up temporary S3 download file.');
            }
        } catch (_) {}
    }
}

/**
 * Executes mysql command line to import the SQL dump
 */
function restoreDatabase(sqlFilePath) {
    return new Promise((resolve, reject) => {
        const db   = process.env.DB_NAME     || 'vignan_portal';
        const host = process.env.DB_HOST     || 'localhost';
        const user = process.env.DB_USER     || 'root';
        const pass = process.env.DB_PASS     || process.env.DB_PASSWORD || '';
        const port = process.env.DB_PORT     || '3306';

        const passFlag = pass ? `-p"${pass}"` : '';
        const cmd = `mysql -h ${host} -P ${port} -u ${user} ${passFlag} ${db} < "${sqlFilePath}"`;

        console.log(`[Restore CLI] Executing: mysql -h ${host} -P ${port} -u ${user} [hidden-pass] ${db} < database.sql`);

        exec(cmd, (err, stdout, stderr) => {
            if (err) {
                console.error('[Restore CLI] Database restore stderr:', stderr);
                return reject(new Error(`MySQL restoration failed: ${err.message}`));
            }
            resolve();
        });
    });
}

function printUsage() {
    console.log(`
Disaster Recovery Restoration Tool
==================================

Usage (Local Restore):
  node server/db/restore.js <path-to-local-zip-backup>

Usage (S3 Cloud Restore):
  node server/db/restore.js --s3 <s3-key> <local-temp-zip-destination>

Examples:
  node server/db/restore.js backups/daily/backup_daily_2026-05-26.zip
  node server/db/restore.js --s3 backups/weekly/backup_weekly_2026-05-26.zip temp_restore.zip
`);
}

main();
