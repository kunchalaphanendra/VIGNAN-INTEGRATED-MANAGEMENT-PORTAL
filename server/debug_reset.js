// node server/debug_reset.js — shows exactly what the reset route would delete
const db = require('./db/connection');

async function debug() {
    const deptId = 9;
    const year = 3;

    // Student IDs
    const [stuRows] = await db.query(`
        SELECT u.id, u.full_name, sp.year FROM users u
        JOIN student_profiles sp ON sp.user_id = u.id
        WHERE sp.department_id = ? AND sp.year = ? AND u.role = 'student' AND u.is_active = TRUE
    `, [deptId, year]);
    console.log('\n── Year', year, 'students ──');
    stuRows.forEach(s => console.log(' ', s.id, s.full_name));
    const studentIds = stuRows.map(r => r.id);

    // Assignment IDs
    const [asgnRows] = await db.query(
        'SELECT id, subject_id, section FROM faculty_assignments WHERE department_id = ? AND year = ?',
        [deptId, year]
    );
    console.log('\n── Assignments for dept', deptId, 'year', year, '──');
    asgnRows.forEach(a => console.log('  assignment_id:', a.id, 'subject_id:', a.subject_id, 'section:', a.section));
    const assignmentIds = asgnRows.map(r => r.id);

    if (!assignmentIds.length) {
        console.log('  ⚠ NO assignments found for this dept+year — attendance delete will find nothing!');
    }

    // Attendance records
    if (assignmentIds.length) {
        const [attRows] = await db.query(
            'SELECT COUNT(*) as cnt FROM attendance WHERE assignment_id IN (?)', [assignmentIds]
        );
        console.log('\n── Attendance rows (by assignment_id) ──');
        console.log('  Would delete:', attRows[0].cnt, 'rows');
    }

    // All attendance for these students
    if (studentIds.length) {
        const [allAtt] = await db.query(
            'SELECT a.student_id, a.assignment_id, COUNT(*) as cnt FROM attendance a WHERE a.student_id IN (?) GROUP BY a.student_id, a.assignment_id',
            [studentIds]
        );
        console.log('\n── All attendance for Year', year, 'students ──');
        allAtt.forEach(r => console.log('  student_id:', r.student_id, 'assignment_id:', r.assignment_id, 'records:', r.cnt));

        // Check which assignment_ids belong to other years/depts
        if (allAtt.length) {
            const aIds = [...new Set(allAtt.map(r => r.assignment_id))];
            const [faRows] = await db.query(
                'SELECT id, department_id, year, section FROM faculty_assignments WHERE id IN (?)', [aIds]
            );
            console.log('\n── Faculty assignments for those attendance records ──');
            faRows.forEach(fa => console.log('  fa.id:', fa.id, 'dept:', fa.department_id, 'year:', fa.year, 'section:', fa.section));
        }
    }

    // Subject IDs
    const [subjRows] = await db.query('SELECT id, name FROM subjects WHERE department_id = ?', [deptId]);
    console.log('\n── Subjects for dept', deptId, '──');
    subjRows.forEach(s => console.log('  ', s.id, s.name));

    process.exit(0);
}

debug().catch(e => { console.error(e.message); process.exit(1); });
