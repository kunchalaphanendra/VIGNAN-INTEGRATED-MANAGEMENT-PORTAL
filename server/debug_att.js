const db = require('./db/connection');
(async () => {
  try {
    const [user] = await db.query("SELECT id FROM users WHERE login_id = '24891A67A0' AND role = 'student' LIMIT 1");
    if (!user.length) { console.log('USER NOT FOUND'); process.exit(1); }
    const uid = user[0].id;
    console.log('uid:', uid);

    // sessionCounts
    const [sc] = await db.query(`
        SELECT ats.assignment_id, COUNT(*) as total_sessions,
          GROUP_CONCAT(ats.outside_window) as ow_vals,
          GROUP_CONCAT(ats.hod_confirmed) as hc_vals
        FROM attendance_sessions ats
        JOIN faculty_assignments fa ON fa.id = ats.assignment_id
        JOIN student_profiles sp
          ON sp.department_id = fa.department_id
         AND sp.year = fa.year AND sp.section = fa.section
        WHERE sp.user_id = ?
          AND NOT (ats.outside_window = 1 AND (ats.hod_confirmed IS NULL OR ats.hod_confirmed = 0))
        GROUP BY ats.assignment_id
    `, [uid]);
    console.log('\nsessionCounts:', JSON.stringify(sc));

    // attCounts
    const [ac] = await db.query(`
        SELECT a.assignment_id,
          SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) as attended,
          SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count
        FROM attendance a
        WHERE a.student_id = ?
          AND EXISTS (
            SELECT 1 FROM attendance_sessions ats2
            WHERE ats2.assignment_id = a.assignment_id
              AND DATE(ats2.session_date) = DATE(a.date)
              AND NOT (ats2.outside_window = 1 AND (ats2.hod_confirmed IS NULL OR ats2.hod_confirmed = 0))
          )
        GROUP BY a.assignment_id
    `, [uid]);
    console.log('\nattCounts:', JSON.stringify(ac));

    // Full attendance API simulation
    const [assignments] = await db.query(`
        SELECT fa.id as assignment_id, s.name as subject_name, s.code
        FROM faculty_assignments fa
        JOIN subjects s ON s.id = fa.subject_id
        JOIN student_profiles sp
          ON sp.department_id = fa.department_id
         AND sp.year = fa.year AND sp.section = fa.section
        WHERE sp.user_id = ?
    `, [uid]);
    console.log('\nassignments:', JSON.stringify(assignments.map(a => ({id:a.assignment_id, name:a.subject_name}))));

    const sessMap = {};
    for (const s of sc) sessMap[s.assignment_id] = Number(s.total_sessions);
    const attMap = {};
    for (const a of ac) attMap[a.assignment_id] = a;

    const subjectMap = {};
    for (const asgn of assignments) {
      const key = asgn.subject_name + '|' + asgn.code;
      const total = sessMap[asgn.assignment_id] || 0;
      const att = attMap[asgn.assignment_id] || {};
      const attN = { attended: Number(att.attended)||0 };
      if (!subjectMap[key]) subjectMap[key] = { subject_name: asgn.subject_name, total:0, attended:0 };
      subjectMap[key].total += total;
      subjectMap[key].attended += attN.attended;
    }
    const subjects = Object.values(subjectMap).map(s => ({
      ...s, fraction: `${s.attended}/${s.total}`,
      pct: s.total > 0 ? Math.round(s.attended*10000/s.total)/100 : 0
    }));
    const overallTotal = subjects.reduce((sum,s)=>sum+s.total,0);
    const overallAttended = subjects.reduce((sum,s)=>sum+s.attended,0);
    console.log('\nsubjects:', JSON.stringify(subjects));
    console.log('\noverall:', {total:overallTotal, attended:overallAttended, fraction:`${overallAttended}/${overallTotal}`});

    process.exit(0);
  } catch(e) { console.error('ERROR:', e.message); process.exit(1); }
})();
