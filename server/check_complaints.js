const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('./db/connection');

async function check() {
    try {
        // Get full column definition for status
        const [cols] = await db.query("SHOW COLUMNS FROM complaints LIKE 'status'");
        console.log('status column full def:', JSON.stringify(cols, null, 2));

        // Check the student with id from auth (user id for 24891A67A0)
        const [student] = await db.query("SELECT id, login_id FROM users WHERE login_id = '24891A67A0'");
        console.log('\nStudent user:', JSON.stringify(student));

        // Check complaints for that student
        if (student.length > 0) {
            const [rows] = await db.query('SELECT * FROM complaints WHERE student_id = ?', [student[0].id]);
            console.log('\nStudent complaints:', JSON.stringify(rows, null, 2));
        }

        // Check all complaints with student_id NOT NULL
        const [nonAnon] = await db.query('SELECT id, complaint_ref, student_id, is_anonymous, status FROM complaints WHERE is_anonymous = 0');
        console.log('\nNon-anonymous complaints:', JSON.stringify(nonAnon, null, 2));

        process.exit(0);
    } catch (e) {
        console.error('ERROR:', e.message || e.sqlMessage);
        process.exit(1);
    }
}
check();
