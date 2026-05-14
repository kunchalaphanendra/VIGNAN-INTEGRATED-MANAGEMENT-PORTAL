const mysql = require('mysql2/promise');
(async () => {
    const c = await mysql.createConnection({
        host: 'localhost', user: 'root', password: '123456', database: 'vignan_portal'
    });

    // Check actual schema of attendance_sessions
    const [cols] = await c.query("DESCRIBE attendance_sessions");
    console.log('attendance_sessions columns:');
    cols.forEach(r => console.log(`  ${r.Field} ${r.Type} ${r.Null} ${r.Default ?? ''}`));

    // Check all assignments
    const [rows] = await c.query(`
        SELECT fa.id, fa.faculty_id, fa.department_id, fa.year, fa.section,
               u.full_name, s.name as subject
        FROM faculty_assignments fa
        JOIN users u ON u.id = fa.faculty_id
        JOIN subjects s ON s.id = fa.subject_id
        ORDER BY fa.department_id, fa.year, fa.section
    `);
    console.log('\nAll assignments:');
    rows.forEach(r => console.log(`  id=${r.id} fac_id=${r.faculty_id}(${r.full_name}) dept=${r.department_id} yr=${r.year} sec=${r.section} subj=${r.subject}`));

    // Check for multi-faculty classes
    const [dups] = await c.query(`
        SELECT department_id, year, section, COUNT(DISTINCT faculty_id) as fac_count
        FROM faculty_assignments
        GROUP BY department_id, year, section
        HAVING fac_count > 1
    `);
    console.log('\nClasses shared by multiple faculty:');
    if (dups.length === 0) console.log('  NONE');
    else dups.forEach(r => console.log(`  dept=${r.department_id} yr=${r.year} sec=${r.section}`));

    await c.end();
})();
