const db = require('./server/db/connection');
async function run() {
    const [students] = await db.query(
        "SELECT u.id, u.full_name, sp.year, sp.section, sp.department_id FROM users u JOIN student_profiles sp ON sp.user_id = u.id WHERE u.full_name LIKE '%Phanendra%' LIMIT 5"
    );
    console.log('Students:', JSON.stringify(students));
    if (!students.length) { process.exit(0); }
    const sid = students[0].id;

    // All attendance + session info for this student
    const [att] = await db.query(`
        SELECT a.date, a.period_number, a.status, a.assignment_id,
               s.name AS subject,
               ats.id AS session_id, ats.outside_window, ats.hod_confirmed
        FROM attendance a
        JOIN faculty_assignments fa ON fa.id = a.assignment_id
        JOIN subjects s ON s.id = fa.subject_id
        LEFT JOIN attendance_sessions ats
               ON ats.assignment_id = a.assignment_id
              AND DATE(ats.session_date) = DATE(a.date)
              AND (a.period_number IS NULL OR ats.period_number = a.period_number)
        WHERE a.student_id = ?
        ORDER BY a.date DESC, a.period_number
    `, [sid]);
    console.log('\nAttendance+session rows:');
    att.forEach(r => console.log(JSON.stringify(r)));

    // Also check all sessions for Khaleel Math
    const [sessions] = await db.query(`
        SELECT ats.id, ats.session_date, ats.period_number, ats.outside_window, ats.hod_confirmed,
               s.name AS subject
        FROM attendance_sessions ats
        JOIN faculty_assignments fa ON fa.id = ats.assignment_id
        JOIN subjects s ON s.id = fa.subject_id
        WHERE ats.faculty_id = (SELECT id FROM users WHERE full_name LIKE '%Khaleel%' LIMIT 1)
        ORDER BY ats.session_date DESC, ats.period_number
    `);
    console.log('\nAll sessions for Khaleel:');
    sessions.forEach(r => console.log(JSON.stringify(r)));
    process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
