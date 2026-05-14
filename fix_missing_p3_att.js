// Fix: Insert missing attendance records for P3 Math May14 (session 40)
// Session was created but attendance loop never ran
const db = require('./server/db/connection');

async function run() {
    const session = {
        id: 40,
        assignment_id: 17,
        session_date: '2026-05-14',
        period_number: 3,
        faculty_id: 5, // Khaleel
    };

    // Get all Y3B students (department_id=9, year=3, section=B)
    const [students] = await db.query(`
        SELECT sp.user_id AS student_id
        FROM student_profiles sp
        WHERE sp.department_id = 9 AND sp.year = 3 AND sp.section = 'B'
    `);
    console.log('Students to insert:', students.length);

    let inserted = 0;
    for (const s of students) {
        const [res] = await db.query(`
            INSERT INTO attendance (student_id, assignment_id, date, period_number, status, marked_by)
            VALUES (?, ?, ?, ?, 'present', ?)
            ON DUPLICATE KEY UPDATE status=VALUES(status), marked_by=VALUES(marked_by)
        `, [s.student_id, session.assignment_id, session.session_date, session.period_number, session.faculty_id]);
        inserted += res.affectedRows;
        console.log(`  → student_id=${s.student_id}: ${res.affectedRows > 0 ? 'inserted/updated' : 'no change'}`);
    }
    console.log(`\n✅ Done — ${inserted} attendance records inserted for P3 Math May14`);
    process.exit(0);
}
run().catch(e => { console.error('❌', e.message); process.exit(1); });
