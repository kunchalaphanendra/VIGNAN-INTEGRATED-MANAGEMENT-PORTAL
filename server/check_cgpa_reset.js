// Quick check script — run with: node server/check_cgpa_reset.js
const db = require('./db/connection');

async function check() {
    // Find Phanendra
    const [users] = await db.query(
        "SELECT u.id, u.login_id, u.full_name, u.department_id, sp.year, sp.semester FROM users u JOIN student_profiles sp ON sp.user_id = u.id WHERE u.login_id = '24891A67A0'"
    );
    if (!users.length) { console.log('Student not found'); process.exit(1); }
    const s = users[0];
    console.log('Student:', s);

    // student_cgpa
    const [cgpa] = await db.query('SELECT * FROM student_cgpa WHERE student_id = ?', [s.id]);
    console.log('\nstudent_cgpa rows:', cgpa);

    // grades
    const [grades] = await db.query('SELECT g.*, sub.name, sub.credits FROM grades g LEFT JOIN subjects sub ON sub.id = g.subject_id WHERE g.student_id = ?', [s.id]);
    console.log('\ngrades rows:', grades);

    // marks
    const [marks] = await db.query('SELECT m.*, fa.year, fa.department_id FROM marks m JOIN faculty_assignments fa ON fa.id = m.assignment_id WHERE m.student_id = ?', [s.id]);
    console.log('\nmarks rows (first 5):', marks.slice(0, 5));

    // student_sgpa
    try {
        const [sgpa] = await db.query('SELECT * FROM student_sgpa WHERE student_id = ?', [s.id]);
        console.log('\nstudent_sgpa rows:', sgpa);
    } catch (e) { console.log('\nstudent_sgpa table does not exist'); }

    process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
