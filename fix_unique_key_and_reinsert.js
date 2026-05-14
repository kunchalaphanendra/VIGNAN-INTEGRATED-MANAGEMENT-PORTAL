// Fix: Drop the old non-period-aware unique key and re-insert missing attendance
const db = require('./server/db/connection');

async function run() {
    // 1. Drop the old unique key (keeps uq_attendance_session which includes period_number)
    console.log('Dropping old unique_attendance key...');
    await db.query('ALTER TABLE attendance DROP INDEX unique_attendance').catch(e => {
        if (e.message.includes("check that column/key exists")) {
            console.log('  Already dropped, skipping.');
        } else {
            throw e;
        }
    });
    console.log('✅ Old key dropped');

    // 2. Check what Math Y3B sessions exist for May 14 that need attendance
    const [sessions] = await db.query(`
        SELECT ats.id, ats.period_number, ats.assignment_id
        FROM attendance_sessions ats
        WHERE ats.faculty_id = 5
          AND DATE(ats.session_date) = '2026-05-14'
        ORDER BY ats.period_number
    `);
    console.log('\nSessions for Khaleel May14:', sessions.map(s => `P${s.period_number}(sess=${s.id},asgn=${s.assignment_id})`).join(', '));

    // 3. Get all Y3B students
    const [students] = await db.query(`
        SELECT sp.user_id AS student_id
        FROM student_profiles sp
        WHERE sp.department_id = 9 AND sp.year = 3 AND sp.section = 'B'
    `);
    console.log('Y3B students:', students.length);

    // 4. Re-insert attendance for each session × each student
    let total = 0;
    for (const sess of sessions) {
        for (const s of students) {
            const [res] = await db.query(`
                INSERT INTO attendance (student_id, assignment_id, date, period_number, status, marked_by, session_id)
                VALUES (?, ?, '2026-05-14', ?, 'present', 5, ?)
                ON DUPLICATE KEY UPDATE status=VALUES(status), marked_by=VALUES(marked_by)
            `, [s.student_id, sess.assignment_id, sess.period_number, sess.id]);
            total += res.affectedRows;
        }
        console.log(`  P${sess.period_number} → ${students.length} records inserted/updated`);
    }
    console.log(`\n✅ Done — ${total} total records`);

    // 5. Verify Phanendra's count
    const [check] = await db.query(`
        SELECT s.name, COUNT(*) AS total, GROUP_CONCAT(a.period_number ORDER BY a.period_number) AS periods
        FROM attendance a
        JOIN faculty_assignments fa ON fa.id = a.assignment_id
        JOIN subjects s ON s.id = fa.subject_id
        WHERE a.student_id = 6
        GROUP BY fa.subject_id
    `);
    console.log('\nPhanendra attendance after fix:');
    check.forEach(r => console.log(`  ${r.name}: ${r.total} records, periods=[${r.periods}]`));
    process.exit(0);
}
run().catch(e => { console.error('❌', e.message); process.exit(1); });
