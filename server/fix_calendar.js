const mysql = require('mysql2/promise');

// The real day of week for any YYYY-MM-DD string, using JS local date
// We parse it as local time to avoid UTC shift
function getDayOfWeek(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).getDay(); // 0=Sun, 6=Sat
}

function getWhichSaturday(dateStr) {
    const [, , d] = dateStr.split('-').map(Number);
    return Math.ceil(d / 7);
}

async function fix() {
    const db = await mysql.createConnection({
        host: 'localhost', user: 'root', password: '123456', database: 'vignan_portal'
    });

    console.log('=== Fetching all calendar entries ===');
    const [rows] = await db.query(
        "SELECT id, DATE_FORMAT(calendar_date, '%Y-%m-%d') AS dt, day_type, label FROM academic_calendar"
    );
    console.log(`Total rows: ${rows.length}`);

    let fixes = 0;
    for (const row of rows) {
        const dow = getDayOfWeek(row.dt); // 0=Sun, 1=Mon...6=Sat
        let expected;

        if (dow === 0) {
            // Sunday → always holiday
            expected = 'holiday';
        } else if (dow === 6) {
            // Saturday → 2nd and 4th only
            const whichSat = getWhichSaturday(row.dt);
            expected = (whichSat === 2 || whichSat === 4) ? 'holiday' : 'working';
        } else if (dow >= 1 && dow <= 5) {
            // Mon–Fri → working (unless has a label)
            if (row.label && row.label.trim()) {
                // Has a label → user manually set it, don't touch
                continue;
            }
            expected = 'working';
        }

        if (row.day_type !== expected) {
            await db.query('UPDATE academic_calendar SET day_type=? WHERE id=?', [expected, row.id]);
            console.log(`Fixed ${row.dt} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow]}): ${row.day_type} → ${expected}`);
            fixes++;
        }
    }

    console.log(`\nTotal fixes applied: ${fixes}`);

    // Show April 2026 final state
    const [apr] = await db.query(
        "SELECT DATE_FORMAT(calendar_date,'%Y-%m-%d') AS dt, day_type FROM academic_calendar " +
        "WHERE MONTH(calendar_date)=4 AND YEAR(calendar_date)=2026 ORDER BY calendar_date"
    );
    console.log('\n=== April 2026 final state ===');
    apr.forEach(r => {
        const dow = getDayOfWeek(r.dt);
        const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow];
        console.log(`${r.dt} ${dayName} → ${r.day_type}`);
    });

    await db.end();
    console.log('\nDone!');
}

fix().catch(console.error);
