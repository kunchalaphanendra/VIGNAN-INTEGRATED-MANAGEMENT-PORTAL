// Run: node server/clear_marks_now.js
// Clears all marks for Year 3 students in dept 9 using the CORRECT schema
const db = require('./db/connection');

async function run() {
    // 1. Get Year 3 student IDs for dept 9
    const [stuRows] = await db.query(`
        SELECT u.id, u.full_name FROM users u
        JOIN student_profiles sp ON sp.user_id = u.id
        WHERE sp.department_id = 9 AND sp.year = 3
          AND u.role = 'student' AND u.is_active = TRUE
    `);
    const studentIds = stuRows.map(r => r.id);
    console.log('Year 3 students:', stuRows.map(s => `${s.id}:${s.full_name}`));

    if (!studentIds.length) { console.log('No students found'); process.exit(0); }

    // 2. Get subject IDs for dept 9
    const [subjRows] = await db.query('SELECT id FROM subjects WHERE department_id = 9');
    const subjectIds = subjRows.map(r => r.id);
    console.log('Dept 9 subject count:', subjectIds.length);

    if (!subjectIds.length) { console.log('No subjects found'); process.exit(0); }

    // 3. Delete marks (correct schema: student_id + subject_id)
    const [r] = await db.query(
        'DELETE FROM marks WHERE student_id IN (?) AND subject_id IN (?)',
        [studentIds, subjectIds]
    );
    console.log('✅ Marks deleted:', r.affectedRows);

    // 4. Verify
    const [check] = await db.query(
        'SELECT COUNT(*) as cnt FROM marks WHERE student_id IN (?)',
        [studentIds]
    );
    console.log('Remaining marks for these students:', check[0].cnt);
    process.exit(0);
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
