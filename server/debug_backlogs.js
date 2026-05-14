// Debug script — run with: node debug_backlogs.js
require('dotenv').config({ path: '../.env' });
const db = require('./db/connection');

async function main() {
    // Find student Phanendra (roll 24891A67A0)
    const [students] = await db.query(
        "SELECT u.id, u.full_name, u.login_id FROM users u WHERE u.login_id = '24891A67A0' LIMIT 1"
    );
    if (!students.length) { console.log('Student not found'); process.exit(1); }
    const student = students[0];
    console.log(`\n✅ Student: ${student.full_name} (id=${student.id}, login=${student.login_id})`);

    // Show all backlog rows for this student
    const [rows] = await db.query(
        "SELECT * FROM student_backlogs WHERE student_id = ?", [student.id]
    );
    console.log(`\n📋 All backlog rows for student (count=${rows.length}):`);
    rows.forEach(r => console.log(JSON.stringify(r)));

    // Show current academic year
    const [ay] = await db.query("SELECT * FROM academic_years WHERE is_current = TRUE");
    console.log(`\n📅 Current academic years:`, ay.length ? JSON.stringify(ay) : 'NONE');

    // Attempt DELETE — NO subject_id filter (FIXED query)
    console.log(`\n🗑 Attempting DELETE WHERE student_id = ${student.id} (no subject_id filter) ...`);
    const [result] = await db.query(
        "DELETE FROM student_backlogs WHERE student_id = ?", [student.id]
    );
    console.log(`   Affected rows: ${result.affectedRows}`);

    // Check remaining rows
    const [after] = await db.query(
        "SELECT * FROM student_backlogs WHERE student_id = ?", [student.id]
    );
    console.log(`\n📋 Remaining backlog rows after delete (count=${after.length}):`);
    after.forEach(r => console.log(JSON.stringify(r)));
    if (after.length === 0) console.log('   ✅ All backlogs deleted successfully!');

    process.exit(0);
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
