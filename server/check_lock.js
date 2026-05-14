const mysql = require('mysql2/promise');
const fs = require('fs');

(async () => {
    const c = await mysql.createConnection({
        host: 'localhost', user: 'root', password: '123456', database: 'vignan_portal'
    });
    
    let out = 'Assignments:\n';
    const [assign] = await c.query('SELECT fa.id, fa.department_id, fa.year, fa.section, u.full_name as fac FROM faculty_assignments fa JOIN users u ON u.id=fa.faculty_id WHERE fa.department_id=9 AND fa.year=2 AND fa.section="B"');
    assign.forEach(a => out += JSON.stringify(a) + '\n');

    out += '\nSessions:\n';
    const [ats] = await c.query('SELECT id, assignment_id, faculty_id, session_date, period_number FROM attendance_sessions WHERE session_date="2026-03-27"');
    ats.forEach(a => {
        // fix timezone issues for JSON display
        a.session_date = '2026-03-27';
        out += JSON.stringify(a) + '\n';
    });

    fs.writeFileSync('db_status.txt', out, 'utf8');
    await c.end();
})();
