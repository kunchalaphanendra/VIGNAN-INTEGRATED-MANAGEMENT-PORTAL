const db = require('./db/connection');
(async () => {
  try {
    // Check faculty department_id
    const [fac] = await db.query("SELECT id, login_id, department_id FROM users WHERE login_id IN ('VIG-FAC-001', 'VIG-FAC-002')");
    console.log('Faculty:', JSON.stringify(fac));
    
    // Check all subjects
    const [subj] = await db.query('SELECT id, name, code, department_id FROM subjects LIMIT 20');
    console.log('Subjects:', JSON.stringify(subj));
    
    // Check assignments
    const facIds = fac.map(f => f.id);
    if (facIds.length > 0) {
      const [assign] = await db.query('SELECT fa.id, fa.faculty_id, fa.department_id, s.name FROM faculty_assignments fa JOIN subjects s ON s.id=fa.subject_id WHERE fa.faculty_id IN (' + facIds.join(',') + ')');
      console.log('Assignments:', JSON.stringify(assign));
    }
  } catch(e) { console.error(e.message); }
  process.exit(0);
})();
