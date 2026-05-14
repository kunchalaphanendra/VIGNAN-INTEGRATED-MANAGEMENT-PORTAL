const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('./db/connection');

async function addColIfMissing(table, col, definition) {
    const [cols] = await db.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, col]
    );
    if (cols.length === 0) {
        await db.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${definition}`);
        console.log(`✅ Added ${col} to ${table}`);
    } else {
        console.log(`ℹ️  ${col} already exists in ${table} — skipped`);
    }
}

async function migrate() {
    try {
        console.log('Running HOD Complaint Portal migration...');

        await addColIfMissing('complaints', 'portal_type',
            "ENUM('principal','hod') NOT NULL DEFAULT 'principal'");

        await addColIfMissing('complaint_windows', 'department_id',
            'INT NULL DEFAULT NULL');

        await addColIfMissing('complaint_windows', 'created_by_role',
            "ENUM('principal','hod') NOT NULL DEFAULT 'principal'");

        // Backfill existing windows
        await db.query(`
            UPDATE complaint_windows 
            SET created_by_role = 'principal' 
            WHERE created_by_role = 'principal' OR created_by_role IS NULL
        `).catch(() => {});

        console.log('\n✅ Migration complete!');
        process.exit(0);
    } catch (err) {
        console.error('Migration error:', err.message || err);
        process.exit(1);
    }
}

migrate();
