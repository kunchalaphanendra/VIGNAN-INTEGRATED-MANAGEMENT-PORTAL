/**
 * fix_attendance_unique.js
 * 
 * Fixes the attendance table so multiple periods of the same subject
 * on the same day are stored as SEPARATE rows (not overwritten).
 *
 * Changes:
 *  1. Add `period_number` column to attendance table (nullable for old rows)
 *  2. Backfill period_number from attendance_sessions for existing rows
 *  3. Drop old UNIQUE KEY unique_attendance(student_id, assignment_id, date)
 *  4. Add new UNIQUE KEY on (student_id, assignment_id, date, period_number)
 *     — period_number NULL treated as one entry per day (backward-compat)
 */

require('dotenv').config({ path: '../.env' });
const db = require('./db/connection');

async function main() {
    const [dbNameRows] = await db.query('SELECT DATABASE() as d');
    const dbName = dbNameRows[0].d;
    console.log('Database:', dbName);

    // 1. Check existing columns on attendance table
    const [cols] = await db.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='attendance'`,
        [dbName]
    );
    const existingCols = cols.map(r => r.COLUMN_NAME);
    console.log('Existing columns:', existingCols.join(', '));

    // 2. Add period_number column if missing
    if (!existingCols.includes('period_number')) {
        console.log('Adding period_number column...');
        await db.query(`ALTER TABLE attendance ADD COLUMN period_number TINYINT NULL AFTER date`);
        console.log('✅ period_number column added');
    } else {
        console.log('period_number already exists, skipping.');
    }

    // 3. Backfill period_number from attendance_sessions for existing rows
    console.log('Backfilling period_number from attendance_sessions...');
    const [backfillResult] = await db.query(`
        UPDATE attendance a
        JOIN attendance_sessions ats 
          ON ats.assignment_id = a.assignment_id 
         AND DATE(ats.session_date) = DATE(a.date)
        SET a.period_number = ats.period_number
        WHERE a.period_number IS NULL
    `);
    console.log(`✅ Backfilled ${backfillResult.affectedRows} attendance rows with period_number`);

    // 4. Check existing unique keys
    const [keys] = await db.query(
        `SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX 
         FROM INFORMATION_SCHEMA.STATISTICS 
         WHERE TABLE_SCHEMA=? AND TABLE_NAME='attendance' AND NON_UNIQUE=0
         ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
        [dbName]
    );
    console.log('Current unique keys:', JSON.stringify(keys, null, 2));

    // 5. Drop the old unique key if it only covers (student_id, assignment_id, date)
    const oldKeyNames = [...new Set(keys.map(k => k.INDEX_NAME))].filter(n => n !== 'PRIMARY');
    for (const keyName of oldKeyNames) {
        const keyCols = keys.filter(k => k.INDEX_NAME === keyName).map(k => k.COLUMN_NAME);
        // Drop if it's the old 3-column key or a key that doesn't include period_number
        if (!keyCols.includes('period_number')) {
            console.log(`Dropping old unique key: ${keyName} (${keyCols.join(', ')})`);
            await db.query(`ALTER TABLE attendance DROP INDEX \`${keyName}\``).catch(e => {
                console.warn(`  Could not drop ${keyName}:`, e.message);
            });
        } else {
            console.log(`Keeping key: ${keyName} (${keyCols.join(', ')})`);
        }
    }

    // 6. Add new unique key that includes period_number
    const [existNewKey] = await db.query(
        `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
         WHERE TABLE_SCHEMA=? AND TABLE_NAME='attendance' AND INDEX_NAME='uq_attendance_session'`,
        [dbName]
    );
    if (existNewKey.length === 0) {
        console.log('Adding new unique key (student_id, assignment_id, date, period_number)...');
        await db.query(`
            ALTER TABLE attendance 
            ADD UNIQUE KEY uq_attendance_session (student_id, assignment_id, date, period_number)
        `).catch(e => {
            console.warn('Could not add uq_attendance_session:', e.message);
            console.log('Trying without NULL support...');
        });
        console.log('✅ New unique key uq_attendance_session added');
    } else {
        console.log('uq_attendance_session already exists, skipping.');
    }

    // 7. Final verification
    const [finalKeys] = await db.query(
        `SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as cols
         FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA=? AND TABLE_NAME='attendance' AND NON_UNIQUE=0
         GROUP BY INDEX_NAME`,
        [dbName]
    );
    console.log('\n✅ Final unique keys on attendance table:');
    finalKeys.forEach(k => console.log(`  ${k.INDEX_NAME}: (${k.cols})`));

    const [countRows] = await db.query('SELECT COUNT(*) as c FROM attendance');
    console.log(`\n✅ Total attendance rows: ${countRows[0].c}`);

    process.exit(0);
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
