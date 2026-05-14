const db = require('./db/connection');
async function main() {
    try {
        // What does todayIST() return?
        const now = new Date();
        const istMs = now.getTime() + (5.5 * 60 * 60 * 1000);
        const todayIST = new Date(istMs).toISOString().split('T')[0];
        console.log('todayIST():', todayIST);
        console.log('UTC today:', now.toISOString().split('T')[0]);
        console.log('Server local:', now.toLocaleDateString('en-CA'));

        // Check what's in attendance_sessions
        const [s] = await db.query(`
            SELECT id, assignment_id, faculty_id, session_date, period_number, outside_window, created_at
            FROM attendance_sessions
            ORDER BY id DESC LIMIT 5
        `);
        s.forEach(r => {
            const d = new Date(r.session_date);
            console.log(`ID ${r.id}: session_date=${d.toISOString()} | period=${r.period_number} | outside_window=${r.outside_window} | created_at=${r.created_at}`);
        });

        // Check if session_date is stored as pure DATE (no time)
        const [raw] = await db.query(`SELECT id, DATE_FORMAT(session_date, '%Y-%m-%d') as sd FROM attendance_sessions ORDER BY id DESC LIMIT 5`);
        raw.forEach(r => console.log(`ID ${r.id}: raw session_date=${r.sd}`));
    } catch(e) { console.log('Error:', e.message); }
    process.exit(0);
}
main();
