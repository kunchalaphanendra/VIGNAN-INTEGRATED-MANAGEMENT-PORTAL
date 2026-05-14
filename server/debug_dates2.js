const db = require('./db/connection');
async function main() {
    try {
        const today = new Date().toLocaleDateString('en-CA');
        console.log('todayIST():', today);
        console.log('new Date():', new Date().toString());

        // Check all sessions and their raw dates
        const [s] = await db.query(`
            SELECT id, assignment_id, faculty_id, 
                   DATE_FORMAT(session_date, '%Y-%m-%d') as sd,
                   period_number, outside_window, hod_confirmed
            FROM attendance_sessions
            ORDER BY id DESC LIMIT 10
        `);
        s.forEach(r => console.log(`ID ${r.id}: assignment=${r.assignment_id} fac=${r.faculty_id} sd=${r.sd} p=${r.period_number} ow=${r.outside_window}`));

        console.log('\nSessions matching today (' + today + ') for any faculty:');
        const [t] = await db.query(`
            SELECT id, assignment_id, faculty_id, period_number, outside_window
            FROM attendance_sessions
            WHERE DATE_FORMAT(session_date, '%Y-%m-%d') = ?
        `, [today]);
        t.forEach(r => console.log(`  ID ${r.id} fac=${r.faculty_id} asgn=${r.assignment_id} p=${r.period_number} ow=${r.outside_window}`));
        if (t.length === 0) console.log('  NONE for today!');
    } catch(e) { console.log('Error:', e.message); }
    process.exit(0);
}
main();
