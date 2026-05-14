const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('./db/connection');

async function fix() {
    try {
        console.log('=== Fixing complaints table ===\n');

        // 1. Ensure status ENUM includes all needed values
        await db.query(`
            ALTER TABLE complaints 
            MODIFY COLUMN status ENUM('submitted','under_review','in_progress','resolved','dismissed','rejected') 
            NOT NULL DEFAULT 'submitted'
        `);
        console.log('✅ Status ENUM updated');

        // 2. Ensure submitted_at has a proper default (CURRENT_TIMESTAMP)
        await db.query(`
            ALTER TABLE complaints
            MODIFY COLUMN submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        `).catch(e => console.log('submitted_at already has default:', e.sqlMessage));
        console.log('✅ submitted_at column fixed');

        // 3. Ensure updated_at has ON UPDATE
        await db.query(`
            ALTER TABLE complaints
            MODIFY COLUMN updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
        `).catch(e => console.log('updated_at note:', e.sqlMessage));
        console.log('✅ updated_at column fixed');

        // 4. Migrate old status values
        await db.query("UPDATE complaints SET status = 'in_progress' WHERE status = 'under_review'");
        await db.query("UPDATE complaints SET status = 'rejected' WHERE status = 'dismissed'");
        console.log('✅ Status values migrated');

        // 5. Final check
        const [cols] = await db.query("SHOW COLUMNS FROM complaints LIKE 'status'");
        console.log('\nFinal status column:', cols[0]?.Type);
        
        const [all] = await db.query('SELECT id, complaint_ref, student_id, is_anonymous, status FROM complaints');
        console.log('\nAll complaints:', JSON.stringify(all, null, 2));

        process.exit(0);
    } catch(e) {
        console.error('ERROR:', e.sqlMessage || e.message);
        process.exit(1);
    }
}
fix();
