const db = require('./server/db/connection');
async function run() {
    // Check if ANY attendance records exist linked to session 40 (P3 Math May14)
    const [session40] = await db.query(`
        SELECT ats.*, fa.subject_id, s.name AS subject
        FROM attendance_sessions ats
        JOIN faculty_assignments fa ON fa.id = ats.assignment_id
        JOIN subjects s ON s.id = fa.subject_id
        WHERE ats.id = 40
    `);
    console.log('Session 40:', JSON.stringify(session40[0]));

    const [records] = await db.query(`
        SELECT a.student_id, u.full_name, a.status, a.period_number, a.date
        FROM attendance a
        JOIN users u ON u.id = a.student_id
        WHERE a.assignment_id = ? AND DATE(a.date) = DATE(?)
          AND a.period_number = ?
    `, [session40[0].assignment_id, session40[0].session_date, session40[0].period_number]);
    console.log('\nAttendance records for P3 May14 Math:', JSON.stringify(records, null, 2));

    // Also check what students are in Y3B Math assignment
    const [students] = await db.query(`
        SELECT u.id, u.full_name, sp.roll_number
        FROM student_profiles sp
        JOIN users u ON u.id = sp.user_id
        WHERE sp.department_id = ? AND sp.year = ? AND sp.section = ?
        ORDER BY sp.roll_number
    `, [session40[0].department_id, session40[0].year, session40[0].section]);
    console.log('\nY3B students:', JSON.stringify(students, null, 2));
    process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
