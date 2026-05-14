const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./server/db/connection');

async function fix() {
    try {
        console.log('Adding missing columns to student_projects...');

        await db.query('ALTER TABLE student_projects ADD COLUMN IF NOT EXISTS project_link VARCHAR(500) NULL');
        console.log('✅ project_link: done');

        // Use ALTER IGNORE or check if column exists first for ENUM
        const [cols] = await db.query('SHOW COLUMNS FROM student_projects LIKE "status"');
        if (cols.length === 0) {
            await db.query("ALTER TABLE student_projects ADD COLUMN status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending'");
            console.log('✅ status: added');
        } else {
            console.log('ℹ️  status: already exists');
        }

        await db.query('ALTER TABLE student_projects ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL');
        console.log('✅ rejection_reason: done');

        const [final] = await db.query('DESCRIBE student_projects');
        console.log('\nFinal columns:', final.map(c => c.Field).join(', '));
        process.exit(0);
    } catch (e) {
        console.error('ERROR:', e.message, e.sqlMessage);
        process.exit(1);
    }
}

fix();
