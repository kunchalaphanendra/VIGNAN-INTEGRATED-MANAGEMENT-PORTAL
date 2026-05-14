const db = require('./server/db/connection');
async function run() {
    // Last 5 sessions created
    const [sessions] = await db.query(`
        SELECT ats.id, ats.session_date, ats.period_number, ats.outside_window, ats.hod_confirmed,
               ats.created_at, u.full_name AS faculty, s.name AS subject, ats.year, ats.section
        FROM attendance_sessions ats
        JOIN users u ON u.id = ats.faculty_id
        JOIN faculty_assignments fa ON fa.id = ats.assignment_id
        JOIN subjects s ON s.id = fa.subject_id
        ORDER BY ats.created_at DESC
        LIMIT 5
    `);
    console.log('Last 5 sessions:');
    sessions.forEach(r => console.log(JSON.stringify(r)));

    // Last 5 attendance records
    const [att] = await db.query(`
        SELECT a.date, a.period_number, a.status, u.full_name AS student, s.name AS subject
        FROM attendance a
        JOIN users u ON u.id = a.student_id
        JOIN faculty_assignments fa ON fa.id = a.assignment_id
        JOIN subjects s ON s.id = fa.subject_id
        ORDER BY a.created_at DESC
        LIMIT 10
    `);
    console.log('\nLast 10 attendance records:');
    att.forEach(r => console.log(JSON.stringify(r)));
    process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
