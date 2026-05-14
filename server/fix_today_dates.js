const db = require('./db/connection');
async function main() {
    try {
        // Direct approach: find sessions where created_at date (UTC) translates to today IST
        // Today in server's local TZ is 2026-03-27, but created_at UTC might show 2026-03-27
        // as well since server is in IST and MySQL TIMESTAMP auto-converts
        const today = new Date().toLocaleDateString('en-CA');
        console.log('today (server local):', today);

        // Method: select sessions where YEAR/MONTH/DAY of created_at locally = today
        // but session_date != today
        const [sessions] = await db.query(`
            SELECT id, DATE_FORMAT(session_date,'%Y-%m-%d') as sd,
                   created_at, period_number, faculty_id
            FROM attendance_sessions
            WHERE DATE_FORMAT(session_date,'%Y-%m-%d') != ?
            ORDER BY id DESC LIMIT 10
        `, [today]);
        console.log('Sessions NOT on today:');
        sessions.forEach(r => console.log(`  id=${r.id} fac=${r.faculty_id} sd=${r.sd} created=${r.created_at}`));

        // Update: sessions created within last 24 hours but stored with wrong date
        const [upd] = await db.query(`
            UPDATE attendance_sessions
            SET session_date = CURDATE()
            WHERE session_date = CURDATE() - INTERVAL 1 DAY
              AND created_at >= CURDATE() - INTERVAL 1 DAY
              AND created_at < CURDATE() + INTERVAL 1 DAY
        `);
        console.log('Updated to CURDATE():', upd.affectedRows, 'rows');

        // Verify
        const [check] = await db.query(`
            SELECT id, DATE_FORMAT(session_date,'%Y-%m-%d') as sd, period_number, outside_window
            FROM attendance_sessions WHERE DATE_FORMAT(session_date,'%Y-%m-%d') = CURDATE()
        `);
        console.log('\nSessions on CURDATE():');
        check.forEach(r => console.log(`  id=${r.id} sd=${r.sd} p=${r.period_number} ow=${r.outside_window}`));
    } catch(e) { console.log('Error:', e.message); }
    process.exit(0);
}
main();
