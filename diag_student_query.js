const db = require('./server/db/connection');
async function run() {
    // Exactly reproduce the student dashboard query for Phanendra (id=6)
    const sid = 6;

    const [attRows] = await db.query(`
        SELECT
            s.name AS subject_name,
            COUNT(*) AS total,
            SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) AS attended,
            GROUP_CONCAT(
                CONCAT(DATE(a.date), ' P', a.period_number, ' [', a.status, ']',
                       ' sess=', COALESCE(ats.id,'NULL'),
                       ' ow=', COALESCE(ats.outside_window,'?'),
                       ' hc=', COALESCE(ats.hod_confirmed,'null'),
                       ' excl=', IF(ats.outside_window=1 AND (ats.hod_confirmed IS NULL OR ats.hod_confirmed=0), 'YES','no')
                )
                ORDER BY a.date, a.period_number SEPARATOR ' | '
            ) AS detail
        FROM attendance a
        JOIN faculty_assignments fa ON fa.id = a.assignment_id
        JOIN subjects s ON s.id = fa.subject_id
        LEFT JOIN attendance_sessions ats
               ON ats.assignment_id = a.assignment_id
              AND DATE(ats.session_date) = DATE(a.date)
              AND (a.period_number IS NULL OR ats.period_number = a.period_number)
        WHERE a.student_id = ?
        GROUP BY fa.subject_id, s.name
    `, [sid]);

    console.log('\n=== ALL rows (including excluded) ===');
    attRows.forEach(r => {
        console.log(`${r.subject_name}: total=${r.total} attended=${r.attended}`);
        console.log('  ' + r.detail.split(' | ').join('\n  '));
    });

    // Now the actual filtered query (what student sees)
    const [filtered] = await db.query(`
        SELECT s.name AS subject_name, COUNT(*) AS total,
               SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) AS attended
        FROM attendance a
        JOIN faculty_assignments fa ON fa.id = a.assignment_id
        JOIN subjects s ON s.id = fa.subject_id
        WHERE a.student_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM attendance_sessions ats
            WHERE ats.assignment_id = a.assignment_id
              AND DATE(ats.session_date) = DATE(a.date)
              AND (a.period_number IS NULL OR ats.period_number = a.period_number)
              AND ats.outside_window = 1
              AND (ats.hod_confirmed IS NULL OR ats.hod_confirmed = 0)
          )
        GROUP BY fa.subject_id, s.name
    `, [sid]);

    console.log('\n=== FILTERED (what student sees) ===');
    filtered.forEach(r => console.log(`${r.subject_name}: ${r.attended}/${r.total}`));
    process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
