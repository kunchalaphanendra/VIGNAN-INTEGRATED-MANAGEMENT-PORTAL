require('dotenv').config();
const db = require('./db/connection');
async function fix() {
    // Show all unpublished marks
    const [unpub] = await db.query("SELECT m.id, u.full_name, sp.roll_number, s.name as sub, m.exam_label, m.marks_obtained FROM marks m JOIN users u ON m.student_id=u.id JOIN student_profiles sp ON sp.user_id=u.id JOIN subjects s ON m.subject_id=s.id WHERE m.is_published=0 ORDER BY s.name, m.exam_label, sp.roll_number");
    process.stdout.write('=== UNPUBLISHED MARKS (' + unpub.length + ' records) ===\n');
    unpub.forEach(r => process.stdout.write('  [' + r.id + '] ' + r.roll_number + ' ' + r.full_name + ' | ' + r.sub + ' | ' + r.exam_label + ' | ' + r.marks_obtained + '\n'));
    
    // Publish all unpublished marks
    const [result] = await db.query("UPDATE marks SET is_published=1 WHERE is_published=0");
    process.stdout.write('\nPublished ' + result.affectedRows + ' records.\n');
    
    // Verify Phanendra
    const [ph] = await db.query("SELECT m.id, s.name as sub, m.exam_label, m.marks_obtained, m.is_published FROM marks m JOIN subjects s ON m.subject_id=s.id WHERE m.student_id=6 ORDER BY s.name, m.exam_label");
    process.stdout.write('\n=== Phanendra marks now ===\n');
    ph.forEach(r => process.stdout.write('  [' + r.id + '] ' + r.sub + ' | ' + r.exam_label + ' | ' + r.marks_obtained + ' | pub=' + r.is_published + '\n'));
    
    process.exit(0);
}
fix().catch(e => { process.stderr.write('ERROR: ' + e.message + '\n'); process.exit(1); });
