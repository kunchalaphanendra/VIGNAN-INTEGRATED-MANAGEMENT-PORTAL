// node server/clear_attendance_now.js
// Clears ALL attendance for Year 3 students (regardless of which year the assignment belongs to)
const db = require('./db/connection');

async function run() {
    const deptId = 9, year = 3;

    const [stuRows] = await db.query(`
        SELECT u.id, u.full_name FROM users u
        JOIN student_profiles sp ON sp.user_id = u.id
        WHERE sp.department_id = ? AND sp.year = ? AND u.role = 'student' AND u.is_active = TRUE
    `, [deptId, year]);
    const studentIds = stuRows.map(r => r.id);
    console.log('Year', year, 'students:', stuRows.map(s => s.full_name).join(', '));

    if (!studentIds.length) { console.log('None found'); process.exit(0); }

    // Delete attendance records by student_id (covers all historical assignments)
    const [r] = await db.query('DELETE FROM attendance WHERE student_id IN (?)', [studentIds]);
    console.log('✅ Attendance records deleted:', r.affectedRows);

    // Clean up orphaned sessions (sessions with no attendance rows left)
    const [s] = await db.query(`
        DELETE FROM attendance_sessions
        WHERE id NOT IN (
            SELECT DISTINCT session_id FROM attendance WHERE session_id IS NOT NULL
        ) AND department_id = ? AND year = ?
    `, [deptId, year]);
    console.log('✅ Orphaned sessions deleted:', s.affectedRows);

    // Verify
    const [check] = await db.query('SELECT COUNT(*) as cnt FROM attendance WHERE student_id IN (?)', [studentIds]);
    console.log('Remaining attendance rows:', check[0].cnt);

    process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
