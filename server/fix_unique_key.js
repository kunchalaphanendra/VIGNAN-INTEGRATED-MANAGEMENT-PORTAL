const db = require('./db/connection');

async function main() {
    try {
        const dbName = (await db.query('SELECT DATABASE() as d'))[0][0].d;

        // Check current indexes
        const [currentIndexes] = await db.query(`
            SELECT INDEX_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_sessions'
            ORDER BY INDEX_NAME, SEQ_IN_INDEX
        `, [dbName]);
        console.log('Current indexes:', JSON.stringify(currentIndexes, null, 2));

        // Check for duplicates
        const [dups] = await db.query(`
            SELECT department_id, year, section, session_date, period_number, COUNT(*) as cnt
            FROM attendance_sessions
            WHERE department_id IS NOT NULL
            GROUP BY department_id, year, section, session_date, period_number
            HAVING cnt > 1
        `);
        console.log('Duplicate groups:', JSON.stringify(dups, null, 2));

        // Delete duplicates, keep the latest (highest id)
        if (dups.length > 0) {
            await db.query(`
                DELETE ats1 FROM attendance_sessions ats1
                INNER JOIN attendance_sessions ats2
                ON ats1.department_id = ats2.department_id
                   AND ats1.year = ats2.year
                   AND ats1.section = ats2.section
                   AND ats1.session_date = ats2.session_date
                   AND ats1.period_number <=> ats2.period_number
                   AND ats1.id < ats2.id
            `);
            console.log('Deleted duplicate sessions (kept latest)');
        }

        // Now try adding the correct unique key
        const [newKey] = await db.query(`
            SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_sessions' AND INDEX_NAME = 'uniq_class_period'
        `, [dbName]);
        
        if (newKey.length === 0) {
            await db.query(`
                ALTER TABLE attendance_sessions
                ADD UNIQUE KEY uniq_class_period (department_id, year, section, session_date, period_number)
            `);
            console.log('SUCCESS: Added uniq_class_period key');
        } else {
            console.log('uniq_class_period already exists');
        }

        // Final index check
        const [finalIdx] = await db.query(`
            SELECT INDEX_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_sessions'
            ORDER BY INDEX_NAME, SEQ_IN_INDEX
        `, [dbName]);
        const fs = require('fs');
        fs.writeFileSync('./fix_key_result.json', JSON.stringify(finalIdx, null, 2));
        console.log('Final indexes written to fix_key_result.json');
    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
}
main();
