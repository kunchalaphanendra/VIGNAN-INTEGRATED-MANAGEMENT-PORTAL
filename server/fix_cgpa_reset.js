const db = require('./db/connection');
async function fix() {
    const [students] = await db.query(
        "SELECT u.id FROM users u JOIN student_profiles sp ON sp.user_id = u.id WHERE sp.department_id = 9 AND sp.year = 3 AND u.role = 'student' AND u.is_active = TRUE"
    );
    const ids = students.map(s => s.id);
    console.log('Year 3 student IDs:', ids);
    if (!ids.length) { console.log('No students found'); process.exit(0); }
    const [r] = await db.query('DELETE FROM grades WHERE student_id IN (?)', [ids]);
    console.log('Deleted grades rows:', r.affectedRows);
    const [check] = await db.query('SELECT * FROM grades WHERE student_id IN (?)', [ids]);
    console.log('Remaining grades for these students:', check);
    process.exit(0);
}
fix().catch(e => { console.error(e.message); process.exit(1); });
