const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('./db/connection');

async function fix() {
    try {
        console.log('Fixing complaints table...');

        // 1. Update the ENUM to support both old and new status values
        await db.query(`
            ALTER TABLE complaints 
            MODIFY COLUMN status ENUM('submitted','under_review','in_progress','resolved','dismissed','rejected') 
            NOT NULL DEFAULT 'submitted'
        `);
        console.log('✅ Status ENUM updated to include in_progress and rejected');

        // 2. Migrate old statuses to new ones
        await db.query("UPDATE complaints SET status = 'in_progress' WHERE status = 'under_review'");
        await db.query("UPDATE complaints SET status = 'rejected' WHERE status = 'dismissed'");
        console.log('✅ Migrated under_review -> in_progress, dismissed -> rejected');

        // 3. Check final state
        const [cols] = await db.query("SHOW COLUMNS FROM complaints LIKE 'status'");
        console.log('\nFinal status column:', cols[0].Type);

        const [rows] = await db.query('SELECT complaint_ref, student_id, is_anonymous, status FROM complaints');
        console.log('\nAll complaints now:', JSON.stringify(rows, null, 2));

        process.exit(0);
    } catch (e) {
        console.error('ERROR:', e.sqlMessage || e.message);
        process.exit(1);
    }
}
fix();
