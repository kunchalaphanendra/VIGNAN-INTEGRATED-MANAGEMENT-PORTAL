const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('./db/connection');

async function run() {
    try {
        // 1. Table structure
        const [cols] = await db.query('DESCRIBE complaints');
        console.log('=== COMPLAINTS TABLE ===');
        cols.forEach(c => console.log(`  ${c.Field} | ${c.Type} | NULL:${c.Null} | Default:${c.Default}`));

        // 2. Complaint windows
        const [wins] = await db.query('SELECT * FROM complaint_windows ORDER BY created_at DESC');
        console.log('\n=== COMPLAINT WINDOWS ===');
        console.log(JSON.stringify(wins, null, 2));

        // 3. Is any window currently open?
        const [open] = await db.query('SELECT * FROM complaint_windows WHERE open_date <= CURDATE() AND close_date >= CURDATE()');
        console.log('\n=== CURRENTLY OPEN WINDOW ===');
        console.log(JSON.stringify(open));

        // 4. All complaints
        const [all] = await db.query('SELECT id, complaint_ref, student_id, is_anonymous, status, submitted_at FROM complaints');
        console.log('\n=== ALL COMPLAINTS ===');
        console.log(JSON.stringify(all, null, 2));

        // 5. Student user id
        const [stu] = await db.query("SELECT id, login_id FROM users WHERE login_id = '24891A67A0'");
        console.log('\n=== STUDENT USER ===', JSON.stringify(stu));

        process.exit(0);
    } catch(e) {
        console.error('ERROR:', e.sqlMessage || e.message);
        process.exit(1);
    }
}
run();
