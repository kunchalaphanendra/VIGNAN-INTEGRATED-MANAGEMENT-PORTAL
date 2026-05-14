const db = require('./db/connection');

async function main() {
    try {
        const [sessions] = await db.query(`
            SELECT ats.id, ats.assignment_id, ats.faculty_id, ats.department_id, ats.year, ats.section,
                   ats.session_date, ats.period_number, ats.outside_window, ats.hod_confirmed,
                   ats.start_time, u.login_id
            FROM attendance_sessions ats
            JOIN users u ON u.id = ats.faculty_id
            WHERE ats.session_date >= CURDATE() - INTERVAL 2 DAY
            ORDER BY ats.created_at DESC LIMIT 20
        `);
        const out = { sessions };

        const [periods] = await db.query(`SELECT id, department_id, period_number, start_time, end_time, window_open_before, window_close_after FROM class_periods ORDER BY department_id, period_number`);
        out.periods = periods;

        const dbName = (await db.query('SELECT DATABASE() as d'))[0][0].d;
        const [indexes] = await db.query(`
            SELECT INDEX_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_sessions'
            ORDER BY INDEX_NAME, SEQ_IN_INDEX
        `, [dbName]);
        out.indexes = indexes;

        const [att] = await db.query(`
            SELECT a.id, a.student_id, a.assignment_id, a.date, a.status 
            FROM attendance a
            WHERE a.date >= CURDATE() - INTERVAL 2 DAY
            ORDER BY a.date DESC, a.id DESC LIMIT 10
        `);
        out.attendance = att;

        const fs = require('fs');
        fs.writeFileSync('./debug_out.json', JSON.stringify(out, null, 2));
        console.log('Written to debug_out.json');
    } catch (err) {
        console.error(err.message);
    }
    process.exit(0);
}
main();
