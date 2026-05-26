const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db/connection');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { notifyAll, notifyStudentsInDept } = require('../utils/notificationService');

const SALT_ROUNDS = 12;

// All routes require principal role
router.use(auth, roleGuard('principal'));

// GET /api/principal/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const [students] = await db.query("SELECT COUNT(*) as count FROM users WHERE role='student' AND is_active=TRUE");
        const [faculty] = await db.query("SELECT COUNT(*) as count FROM users WHERE role='faculty' AND is_active=TRUE");
        const [hods] = await db.query("SELECT COUNT(*) as count FROM users WHERE role='hod' AND is_active=TRUE");
        const [departments] = await db.query("SELECT COUNT(*) as count FROM departments");

        // Average attendance across all
        const [avgAtt] = await db.query(`
      SELECT ROUND(
        AVG(CASE WHEN a.status IN ('present','late') THEN 100.0 ELSE 0 END), 2
      ) as avg_attendance
      FROM attendance a
    `);

        // Per-department stats
        const [deptStats] = await db.query(`
      SELECT d.id, d.name, d.code,
        (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.role='faculty' AND u.is_active=TRUE) as faculty_count,
        (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.role='student' AND u.is_active=TRUE) as student_count
      FROM departments d
    `);

        // Unread complaints count
        const [complaints] = await db.query("SELECT COUNT(*) as count FROM complaints WHERE status='submitted'");

        // Active polls
        const [activePolls] = await db.query("SELECT COUNT(*) as count FROM polls WHERE close_date >= CURDATE()");

        res.json({
            stats: {
                total_students: students[0].count,
                total_faculty: faculty[0].count,
                total_hods: hods[0].count,
                total_departments: departments[0].count,
                avg_attendance: avgAtt[0].avg_attendance || 0,
                unread_complaints: complaints[0].count,
                active_polls: activePolls[0].count
            },
            department_stats: deptStats
        });
    } catch (err) {
        console.error('Principal dashboard error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/principal/hod — Create HOD account
router.post('/hod', async (req, res) => {
    try {
        const { full_name, email, phone, department_id, password } = req.body;
        if (!full_name || !department_id || !password) {
            return res.status(400).json({ error: 'Full name, department, and password are required' });
        }

        // Auto-generate login_id
        const [existing] = await db.query("SELECT COUNT(*) as count FROM users WHERE role='hod'");
        const loginId = `VIG-HOD-${String(existing[0].count + 1).padStart(3, '0')}`;

        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        const [result] = await db.query(
            'INSERT INTO users (login_id, password_hash, role, department_id, full_name, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [loginId, hash, 'hod', department_id, full_name, email, phone]
        );

        res.status(201).json({ message: 'HOD created', login_id: loginId, id: result.insertId });
    } catch (err) {
        console.error('Create HOD error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/principal/hods
router.get('/hods', async (req, res) => {
    try {
        const [rows] = await db.query(`
      SELECT u.id, u.login_id, u.full_name, u.email, u.phone, u.is_active, u.created_at,
             d.name as department_name, d.code as department_code
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.role = 'hod'
      ORDER BY u.created_at DESC
    `);
        res.json({ hods: rows });
    } catch (err) {
        console.error('List HODs error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/principal/hod/:id — Deactivate HOD
router.delete('/hod/:id', async (req, res) => {
    try {
        await db.query('UPDATE users SET is_active = FALSE WHERE id = ? AND role = "hod"', [req.params.id]);
        res.json({ message: 'HOD deactivated' });
    } catch (err) {
        console.error('Delete HOD error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/principal/departments — enriched with real student/faculty counts + stats
router.get('/departments', async (req, res) => {
    try {
        // 1. Base departments with student & faculty counts
        const [rows] = await db.query(`
            SELECT d.id, d.name, d.code, d.created_at,
                (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.role = 'student' AND u.is_active = TRUE) AS student_count,
                (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.role = 'faculty' AND u.is_active = TRUE) AS faculty_count
            FROM departments d
            ORDER BY d.name
        `);

        // 2. Real attendance average per dept (total attended / total classes)
        const [attRows] = await db.query(`
            SELECT fa.department_id,
                ROUND(
                    SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0),
                    2
                ) AS avg_attendance
            FROM attendance a
            JOIN faculty_assignments fa ON fa.id = a.assignment_id
            GROUP BY fa.department_id
        `);
        const attMap = {};
        attRows.forEach(r => { attMap[r.department_id] = r.avg_attendance; });

        // 3. Real CGPA average per dept (from student_cgpa table, fallback grades)
        const cgpaMap = {};
        try {
            const [cgpaRows] = await db.query(`
                SELECT u.department_id, ROUND(AVG(latest.cgpa), 2) AS avg_cgpa
                FROM (
                    SELECT sc.student_id, sc.cgpa
                    FROM student_cgpa sc
                    INNER JOIN (
                        SELECT student_id, MAX(updated_at) AS max_t FROM student_cgpa GROUP BY student_id
                    ) mx ON sc.student_id = mx.student_id AND sc.updated_at = mx.max_t
                ) latest
                JOIN users u ON u.id = latest.student_id
                WHERE u.role = 'student' AND u.is_active = TRUE
                GROUP BY u.department_id
            `);
            cgpaRows.forEach(r => { cgpaMap[r.department_id] = r.avg_cgpa; });
        } catch (_) {}

        // Fallback: grades table for depts not in cgpaMap
        try {
            const [grRows] = await db.query(`
                SELECT u.department_id,
                    ROUND(SUM(g.grade_points * s.credits) / NULLIF(SUM(s.credits), 0), 2) AS avg_cgpa
                FROM grades g
                JOIN subjects s ON s.id = g.subject_id
                JOIN users u ON u.id = g.student_id
                WHERE u.role = 'student'
                GROUP BY u.department_id
            `);
            grRows.forEach(r => { if (!(r.department_id in cgpaMap)) cgpaMap[r.department_id] = r.avg_cgpa; });
        } catch (_) {}

        // 4. Active backlogs per dept
        const backlogMap = {};
        try {
            const [blRows] = await db.query(`
                SELECT u.department_id, SUM(sb.backlog_count) AS total_backlogs
                FROM student_backlogs sb
                JOIN users u ON u.id = sb.student_id
                WHERE sb.status = 'active' AND u.role = 'student'
                GROUP BY u.department_id
            `);
            blRows.forEach(r => { backlogMap[r.department_id] = Number(r.total_backlogs) || 0; });
        } catch (_) {}

        const departments = rows.map(d => ({
            ...d,
            avg_attendance: attMap[d.id] != null ? Number(attMap[d.id]) : null,
            avg_cgpa:       cgpaMap[d.id]  != null ? Number(cgpaMap[d.id]) : null,
            active_backlogs: backlogMap[d.id] || 0,
        }));

        res.json({ departments });
    } catch (err) {
        console.error('Principal departments error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/principal/departments
router.post('/departments', async (req, res) => {
    try {
        const { name, code } = req.body;
        if (!name || !code) return res.status(400).json({ error: 'Name and code are required' });

        const [result] = await db.query('INSERT INTO departments (name, code) VALUES (?, ?)', [name, code]);
        res.status(201).json({ message: 'Department created', id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Department code already exists' });
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/principal/departments/:id
router.delete('/departments/:id', async (req, res) => {
    const deptId = req.params.id;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Block if active students or faculty still belong to this dept
        const [activeUsers] = await conn.query(
            "SELECT COUNT(*) AS cnt FROM users WHERE department_id = ? AND is_active = TRUE AND role IN ('student','faculty','hod')",
            [deptId]
        );
        if (activeUsers[0].cnt > 0) {
            await conn.rollback();
            return res.status(409).json({
                error: `Cannot delete — ${activeUsers[0].cnt} active member(s) are still assigned to this department. Please reassign or deactivate them first.`
            });
        }

        // 2. Cascade delete all dependent data
        // Attendance records linked via faculty_assignments for this dept
        await conn.query(`
            DELETE a FROM attendance a
            JOIN faculty_assignments fa ON fa.id = a.assignment_id
            WHERE fa.department_id = ?
        `, [deptId]);

        // Attendance sessions
        await conn.query(`
            DELETE ats FROM attendance_sessions ats
            JOIN faculty_assignments fa ON fa.id = ats.assignment_id
            WHERE fa.department_id = ?
        `, [deptId]);

        // Marks linked via faculty_assignments
        await conn.query(`
            DELETE m FROM marks m
            JOIN faculty_assignments fa ON fa.id = m.assignment_id
            WHERE fa.department_id = ?
        `, [deptId]).catch(() => {});

        // Faculty assignments
        await conn.query('DELETE FROM faculty_assignments WHERE department_id = ?', [deptId]);

        // Subjects
        await conn.query('DELETE FROM subjects WHERE department_id = ?', [deptId]).catch(() => {});

        // HOD accounts (deactivate, not hard-delete, to preserve audit trail)
        await conn.query(
            "UPDATE users SET is_active = FALSE WHERE department_id = ? AND role = 'hod'",
            [deptId]
        );

        // Inactive faculty/students — nullify their department link
        await conn.query(
            "UPDATE users SET department_id = NULL WHERE department_id = ? AND is_active = FALSE",
            [deptId]
        );

        // Notices scoped to this dept
        await conn.query('UPDATE notices SET target_department_id = NULL WHERE target_department_id = ?', [deptId]).catch(() => {});

        // Calendar events scoped to this dept
        await conn.query('UPDATE calendar_events SET department_id = NULL WHERE department_id = ?', [deptId]).catch(() => {});

        // 3. Delete department
        const [result] = await conn.query('DELETE FROM departments WHERE id = ?', [deptId]);
        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'Department not found' });
        }

        await conn.commit();
        res.json({ message: 'Department and all linked data deleted successfully' });
    } catch (err) {
        await conn.rollback();
        console.error('Delete department error:', err);
        res.status(500).json({ error: 'Failed to delete department: ' + err.message });
    } finally {
        conn.release();
    }
});




// GET /api/principal/reports/department/:id
router.get('/reports/department/:id', async (req, res) => {
    try {
        const deptId = req.params.id;
        const [dept] = await db.query('SELECT * FROM departments WHERE id = ?', [deptId]);
        if (dept.length === 0) return res.status(404).json({ error: 'Department not found' });

        const [students] = await db.query(
            "SELECT COUNT(*) as count FROM users WHERE department_id = ? AND role='student' AND is_active=TRUE", [deptId]
        );
        const [faculty] = await db.query(
            "SELECT COUNT(*) as count FROM users WHERE department_id = ? AND role='faculty' AND is_active=TRUE", [deptId]
        );
        const [avgGPA] = await db.query(
            'SELECT ROUND(AVG(cgpa), 2) as avg_cgpa FROM grades WHERE student_id IN (SELECT id FROM users WHERE department_id = ?)', [deptId]
        );
        const [defaulters] = await db.query(`
      SELECT u.id, u.full_name, sp.roll_number, s.name as subject_name,
        ROUND(SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as percentage
      FROM attendance a
      JOIN users u ON a.student_id = u.id
      JOIN student_profiles sp ON sp.user_id = u.id
      JOIN faculty_assignments fa ON a.assignment_id = fa.id
      JOIN subjects s ON fa.subject_id = s.id
      WHERE fa.department_id = ?
      GROUP BY a.student_id, a.assignment_id
      HAVING percentage < 75
    `, [deptId]);

        res.json({
            department: dept[0],
            total_students: students[0].count,
            total_faculty: faculty[0].count,
            avg_cgpa: avgGPA[0].avg_cgpa || 0,
            defaulters
        });
    } catch (err) {
        console.error('Department report error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/principal/reports/semester
router.get('/reports/semester', async (req, res) => {
    try {
        const [rows] = await db.query(`
      SELECT sp.year, sp.semester, d.name as department,
        COUNT(DISTINCT sp.user_id) as student_count,
        ROUND(AVG(g.sgpa), 2) as avg_sgpa
      FROM student_profiles sp
      LEFT JOIN grades g ON g.student_id = sp.user_id AND g.semester = sp.semester
      LEFT JOIN departments d ON sp.department_id = d.id
      GROUP BY sp.year, sp.semester, sp.department_id
      ORDER BY sp.year, sp.semester
    `);
        res.json({ report: rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/principal/reports/student/:id
router.get('/reports/student/:id', async (req, res) => {
    try {
        const [user] = await db.query(`
      SELECT u.*, sp.roll_number, sp.year, sp.semester, sp.section, 
             sp.parent_name, sp.parent_phone, d.name as department_name
      FROM users u
      JOIN student_profiles sp ON sp.user_id = u.id
      JOIN departments d ON sp.department_id = d.id
      WHERE u.id = ?
    `, [req.params.id]);
        if (user.length === 0) return res.status(404).json({ error: 'Student not found' });

        const [attendance] = await db.query(`
      SELECT s.name as subject_name, s.code as subject_code,
        COUNT(*) as total, 
        SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) as attended,
        ROUND(SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END)*100.0/COUNT(*), 2) as percentage
      FROM attendance a
      JOIN faculty_assignments fa ON a.assignment_id = fa.id
      JOIN subjects s ON fa.subject_id = s.id
      WHERE a.student_id = ?
      GROUP BY fa.subject_id
    `, [req.params.id]);

        const [marks] = await db.query(`
      SELECT s.name as subject_name, m.exam_type, m.exam_label, m.marks_obtained, m.max_marks
      FROM marks m
      JOIN subjects s ON m.subject_id = s.id
      WHERE m.student_id = ? AND m.is_published = TRUE
      ORDER BY s.name, m.exam_type
    `, [req.params.id]);

        const [grades] = await db.query(`
      SELECT s.name as subject_name, s.credits, g.grade_letter, g.grade_points, g.sgpa, g.cgpa
      FROM grades g
      JOIN subjects s ON g.subject_id = s.id
      WHERE g.student_id = ?
      ORDER BY g.semester, s.name
    `, [req.params.id]);

        const [leaves] = await db.query(
            'SELECT * FROM student_leaves WHERE student_id = ? ORDER BY from_date DESC', [req.params.id]
        );

        const [projects] = await db.query(
            'SELECT * FROM student_projects WHERE student_id = ? ORDER BY created_at DESC', [req.params.id]
        );

        res.json({ student: user[0], attendance, marks, grades, leaves, projects });
    } catch (err) {
        console.error('Student report error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/principal/reports/faculty/:id
router.get('/reports/faculty/:id', async (req, res) => {
    try {
        const [user] = await db.query(`
      SELECT u.*, fp.designation, fp.qualification, fp.joining_date, d.name as department_name
      FROM users u
      LEFT JOIN faculty_profiles fp ON fp.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ? AND u.role = 'faculty'
    `, [req.params.id]);
        if (user.length === 0) return res.status(404).json({ error: 'Faculty not found' });

        const [leaves] = await db.query(
            "SELECT COUNT(*) as total_leaves FROM faculty_leaves WHERE faculty_id = ? AND status='approved'",
            [req.params.id]
        );

        const [assignments] = await db.query(`
      SELECT fa.*, s.name as subject_name, s.code as subject_code
      FROM faculty_assignments fa
      JOIN subjects s ON fa.subject_id = s.id
      WHERE fa.faculty_id = ?
    `, [req.params.id]);

        res.json({ faculty: user[0], total_leaves: leaves[0].total_leaves, assignments });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/principal/polls
router.post('/polls', async (req, res) => {
    try {
        const { title, description, is_anonymous, open_date, close_date, questions } = req.body;
        if (!title || !open_date || !close_date || !questions || questions.length === 0) {
            return res.status(400).json({ error: 'Title, dates, and at least one question are required' });
        }

        const [result] = await db.query(
            'INSERT INTO polls (title, description, created_by, is_anonymous, open_date, close_date) VALUES (?, ?, ?, ?, ?, ?)',
            [title, description, req.user.id, is_anonymous || false, open_date, close_date]
        );

        for (const q of questions) {
            await db.query(
                'INSERT INTO poll_questions (poll_id, question_text, question_type, options) VALUES (?, ?, ?, ?)',
                [result.insertId, q.question_text, q.question_type, JSON.stringify(q.options || null)]
            );
        }

        res.status(201).json({ message: 'Poll created', id: result.insertId });
    } catch (err) {
        console.error('Create poll error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/principal/polls
router.get('/polls', async (req, res) => {
    try {
        const [polls] = await db.query(`
      SELECT p.*, 
        (SELECT COUNT(DISTINCT respondent_id) FROM poll_responses WHERE poll_id = p.id) as response_count,
        (SELECT COUNT(*) FROM users WHERE role = 'faculty' AND is_active = TRUE) as total_faculty
      FROM polls p ORDER BY p.created_at DESC
    `);
        res.json({ polls });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/principal/polls/:id/results
router.get('/polls/:id/results', async (req, res) => {
    try {
        const [poll] = await db.query('SELECT * FROM polls WHERE id = ?', [req.params.id]);
        if (poll.length === 0) return res.status(404).json({ error: 'Poll not found' });

        const [questions] = await db.query('SELECT * FROM poll_questions WHERE poll_id = ?', [req.params.id]);
        const [responses] = await db.query('SELECT * FROM poll_responses WHERE poll_id = ?', [req.params.id]);

        res.json({ poll: poll[0], questions, responses });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/principal/complaint-window
router.post('/complaint-window', async (req, res) => {
    try {
        const { open_date, close_date } = req.body;
        if (!open_date || !close_date) return res.status(400).json({ error: 'Dates are required' });

        const [result] = await db.query(
            'INSERT INTO complaint_windows (open_date, close_date, created_by, created_by_role) VALUES (?, ?, ?, ?)',
            [open_date, close_date, req.user.id, 'principal']
        );
        res.status(201).json({ message: 'Complaint window created', id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/principal/complaint-windows
router.get('/complaint-windows', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT * FROM complaint_windows WHERE created_by_role = 'principal' ORDER BY open_date DESC`
        );
        res.json({ windows: rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/principal/complaints
router.get('/complaints', async (req, res) => {
    try {
        const { status, department_id } = req.query;
        let sql = `
      SELECT c.*, 
        CASE WHEN c.is_anonymous THEN NULL ELSE u.full_name END as student_name,
        CASE WHEN c.is_anonymous THEN NULL ELSE sp.roll_number END as roll_number,
        d.name as department_name, sp.year
      FROM complaints c
      LEFT JOIN users u ON c.student_id = u.id
      LEFT JOIN student_profiles sp ON sp.user_id = c.student_id
      LEFT JOIN departments d ON sp.department_id = d.id
      WHERE c.portal_type = 'principal'
    `;
        const params = [];
        if (status) { sql += ' AND c.status = ?'; params.push(status); }
        if (department_id) { sql += ' AND sp.department_id = ?'; params.push(department_id); }
        sql += ' ORDER BY c.submitted_at DESC';

        const [rows] = await db.query(sql, params);
        res.json({ complaints: rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/principal/complaints/:id/status
router.patch('/complaints/:id/status', async (req, res) => {
    try {
        const { status, admin_notes } = req.body;
        if (!status) return res.status(400).json({ error: 'Status is required' });

        const allowed = ['submitted', 'in_progress', 'resolved', 'rejected'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Allowed: ${allowed.join(', ')}` });
        }

        await db.query(
            'UPDATE complaints SET status = ?, admin_notes = ?, updated_at = NOW() WHERE id = ?',
            [status, admin_notes || null, req.params.id]
        );
        try {
            const [compl] = await db.query('SELECT student_id, complaint_ref, is_anonymous FROM complaints WHERE id = ?', [req.params.id]);
            if (compl.length > 0 && compl[0].student_id && !compl[0].is_anonymous) {
                const { sendNotification } = require('../utils/notificationService');
                await sendNotification({
                    recipient_id: compl[0].student_id,
                    title: 'Complaint Status Update',
                    message: `Your complaint (${compl[0].complaint_ref}) status has been updated to "${status}".`,
                    type: 'complaint',
                    sender_role: req.user.role,
                    sender_id: req.user.id,
                    target_url: `/student/complaints`
                });
            }
        } catch (notifErr) {
            console.error('Complaint status update notification failed:', notifErr);
        }
        res.json({ message: 'Complaint status updated' });
    } catch (err) {
        console.error('Update complaint status error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/principal/notices
router.get('/notices', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT n.*, u.full_name as posted_by
            FROM notices n
            LEFT JOIN users u ON n.created_by = u.id
            ORDER BY n.created_at DESC
        `);
        res.json({ notices: rows });
    } catch (err) {
        console.error('Get notices error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/principal/notices
router.post('/notices', async (req, res) => {
    try {
        const { title, body, target_role, target_department_id, target_year, target_section, priority, category } = req.body;
        if (!title || !body) return res.status(400).json({ error: 'Title and body are required' });
        const role = target_role || 'all';

        const [result] = await db.query(
            `INSERT INTO notices (title, body, created_by, target_role, target_department_id, target_year, target_section, priority, category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, body, req.user.id, role, target_department_id, target_year, target_section, priority || 'general', category || 'academic']
        );
        const noticeId = result.insertId;

        // Fan-out to notifications table so bell icon shows the notice
        try {
            const { notifyStudentsInDept, notifyFacultyInDept, notifyAll, sendNotification } = require('../utils/notificationService');
            const notifMsg = body?.substring(0, 120) || '';
            if (target_department_id) {
                // Department-scoped notice
                if (role === 'student' || role === 'all') {
                    await notifyStudentsInDept({ deptId: target_department_id, year: target_year || null, section: target_section || null, title, message: notifMsg, type: 'notice', referenceId: noticeId });
                }
                if (role === 'faculty' || role === 'all') {
                    await notifyFacultyInDept({ deptId: target_department_id, title, message: notifMsg, type: 'notice', referenceId: noticeId });
                }
            } else {
                // Institution-wide
                if (role === 'all') {
                    await notifyAll({ title, message: notifMsg, type: 'notice', referenceId: noticeId });
                } else {
                    await notifyAll({ role, title, message: notifMsg, type: 'notice', referenceId: noticeId });
                }
            }
        } catch (_e) { /* notification fan-out is non-critical */ }

        res.status(201).json({ message: 'Notice posted', id: noticeId });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/principal/calendar
router.get('/calendar', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM calendar_events ORDER BY event_date');
        res.json({ events: rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/principal/calendar
router.post('/calendar', async (req, res) => {
    try {
        const { title, description, event_type, event_date, end_date, department_id, year, section } = req.body;
        if (!title || !event_type || !event_date) {
            return res.status(400).json({ error: 'Title, type, and date are required' });
        }

        const [result] = await db.query(
            `INSERT INTO calendar_events (title, description, event_type, event_date, end_date, created_by, department_id, year, section)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description, event_type, event_date, end_date, req.user.id, department_id, year, section]
        );
        res.status(201).json({ message: 'Event created', id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/principal/reports/export
router.get('/reports/export', async (req, res) => {
    // Placeholder for PDF/Excel export — will be implemented with pdfkit/exceljs
    res.json({ message: 'Export endpoint — use type=pdf or type=excel query params' });
});

// ─── PLACEMENT JOB ROUTES ────────────────────────────────────────────────────

// Safe migration — run once to add posted_by_role & department_id cols
async function ensurePlacementCols() {
    const [cols] = await db.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='placement_jobs'`
    ).catch(() => [[]]);
    const names = cols.map(c => c.COLUMN_NAME);
    if (!names.includes('posted_by_role')) {
        await db.query(`ALTER TABLE placement_jobs ADD COLUMN posted_by_role ENUM('principal','hod') DEFAULT 'principal'`).catch(() => {});
    }
    if (!names.includes('department_id')) {
        await db.query(`ALTER TABLE placement_jobs ADD COLUMN department_id INT NULL DEFAULT NULL`).catch(() => {});
    }
}

// GET /api/principal/placements — principal sees ALL jobs
router.get('/placements', async (req, res) => {
    try {
        await ensurePlacementCols();
        const [rows] = await db.query(`
            SELECT pj.*, u.full_name as posted_by_name
            FROM placement_jobs pj
            LEFT JOIN users u ON pj.created_by = u.id
            ORDER BY pj.created_at DESC
        `);
        const jobs = rows.map(j => ({
            ...j,
            eligible_years: typeof j.eligible_years === 'string' ? JSON.parse(j.eligible_years) : (j.eligible_years || []),
            eligible_departments: typeof j.eligible_departments === 'string' ? JSON.parse(j.eligible_departments) : (j.eligible_departments || []),
        }));
        res.json({ jobs });
    } catch (err) {
        console.error('Get placements error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/principal/placements — institution-wide (department_id = NULL = visible to all)
router.post('/placements', async (req, res) => {
    try {
        await ensurePlacementCols();
        const { company, role, description, min_cgpa, eligible_years, eligible_departments,
            openings, open_date, close_date, apply_link, contact_email, status } = req.body;
        if (!company || !role) return res.status(400).json({ error: 'Company and role are required' });

        const [result] = await db.query(
            `INSERT INTO placement_jobs
             (company, role, description, min_cgpa, eligible_years, eligible_departments,
              openings, open_date, close_date, apply_link, contact_email, status,
              created_by, posted_by_role, department_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'principal', NULL)`,
            [
                company, role, description || null,
                min_cgpa || 6.0,
                JSON.stringify(eligible_years || []),
                JSON.stringify(eligible_departments || []),
                openings || 1,
                open_date || null, close_date || null,
                apply_link || null, contact_email || null,
                status || 'Active',
                req.user.id,
            ]
        );
        try {
            const { sendNotification } = require('../utils/notificationService');
            await sendNotification({
                recipient_role: 'student',
                title: 'New Placement Opportunity',
                message: `New job opening at ${company} for role "${role}".`,
                type: 'placement',
                sender_role: req.user.role,
                sender_id: req.user.id,
                target_url: `/student/placements`
            });
        } catch (notifErr) {
            console.error('Placement notification failed:', notifErr);
        }
        res.status(201).json({ message: 'Job posted', id: result.insertId });
    } catch (err) {
        console.error('Create placement error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/principal/placements/:id
router.put('/placements/:id', async (req, res) => {
    try {
        const { company, role, description, min_cgpa, eligible_years, eligible_departments,
            openings, open_date, close_date, apply_link, contact_email, status } = req.body;

        const [existing] = await db.query('SELECT id FROM placement_jobs WHERE id = ?', [req.params.id]);
        if (existing.length === 0) return res.status(404).json({ error: 'Job not found' });

        await db.query(
            `UPDATE placement_jobs SET
                company = COALESCE(?, company),
                role = COALESCE(?, role),
                description = ?,
                min_cgpa = COALESCE(?, min_cgpa),
                eligible_years = COALESCE(?, eligible_years),
                eligible_departments = COALESCE(?, eligible_departments),
                openings = COALESCE(?, openings),
                open_date = ?,
                close_date = ?,
                apply_link = ?,
                contact_email = ?,
                status = COALESCE(?, status)
             WHERE id = ?`,
            [
                company, role, description || null,
                min_cgpa,
                eligible_years ? JSON.stringify(eligible_years) : null,
                eligible_departments ? JSON.stringify(eligible_departments) : null,
                openings,
                open_date || null, close_date || null,
                apply_link || null, contact_email || null,
                status,
                req.params.id,
            ]
        );
        res.json({ message: 'Job updated' });
    } catch (err) {
        console.error('Update placement error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/principal/placements/:id
router.delete('/placements/:id', async (req, res) => {
    try {
        const [existing] = await db.query('SELECT id FROM placement_jobs WHERE id = ?', [req.params.id]);
        if (existing.length === 0) return res.status(404).json({ error: 'Job not found' });

        await db.query('DELETE FROM placement_jobs WHERE id = ?', [req.params.id]);
        res.json({ message: 'Job deleted' });
    } catch (err) {
        console.error('Delete placement error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── DEPARTMENT DETAIL ENDPOINTS (for expandable dept cards) ─────────────────

// GET /api/principal/departments/:id/students — enriched with filters, sorting and dynamic stats
router.get('/departments/:id/students', async (req, res) => {
    try {
        const deptId = req.params.id;
        const { year, section, sortBy, search } = req.query;

        // Get department code first
        const [deptRows] = await db.query('SELECT code FROM departments WHERE id = ?', [deptId]);
        const deptCode = deptRows.length > 0 ? deptRows[0].code : '';

        // Base student list
        const [rows] = await db.query(`
            SELECT u.id, u.full_name, u.email, u.is_active,
                   sp.roll_number, sp.year, sp.semester, sp.section
            FROM users u
            JOIN student_profiles sp ON sp.user_id = u.id
            WHERE sp.department_id = ? AND u.role = 'student' AND u.is_active = TRUE
            ORDER BY sp.roll_number
        `, [deptId]);

        if (rows.length === 0) {
            return res.json({
                department: deptCode,
                summary: { students: 0, avgAttendance: 0, avgCGPA: 0, backlogs: 0 },
                data: {},
                students: []
            });
        }

        // Real attendance per student (total attended / total classes)
        const [attRows] = await db.query(`
            SELECT a.student_id,
                ROUND(SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS pct
            FROM attendance a
            JOIN faculty_assignments fa ON fa.id = a.assignment_id
            WHERE fa.department_id = ?
            GROUP BY a.student_id
        `, [deptId]);
        const attMap = {};
        attRows.forEach(r => { attMap[r.student_id] = Number(r.pct); });

        // Real CGPA — student_cgpa first
        const cgpaMap = {};
        try {
            const [cgpaRows] = await db.query(`
                SELECT sc.student_id, sc.cgpa FROM student_cgpa sc
                INNER JOIN (SELECT student_id, MAX(updated_at) AS mx FROM student_cgpa GROUP BY student_id) latest
                ON sc.student_id = latest.student_id AND sc.updated_at = latest.mx
                WHERE sc.student_id IN (?)
            `, [rows.map(r => r.id)]);
            cgpaRows.forEach(r => { cgpaMap[r.student_id] = Number(r.cgpa); });
        } catch (_) {}

        // Backlog counts
        const backlogMap = {};
        try {
            const [blRows] = await db.query(`
                SELECT student_id, SUM(backlog_count) AS cnt
                FROM student_backlogs WHERE student_id IN (?) AND status = 'active'
                GROUP BY student_id
            `, [rows.map(r => r.id)]);
            blRows.forEach(r => { backlogMap[r.student_id] = Number(r.cnt) || 0; });
        } catch (_) {}

        // Map and enrich students
        let students = rows.map(s => ({
            ...s,
            cgpa:     cgpaMap[s.id]     != null ? cgpaMap[s.id]     : null,
            att:      attMap[s.id]      != null ? attMap[s.id]      : null,
            backlogs: backlogMap[s.id]  || 0,
            status:   s.is_active ? 'Active' : 'Inactive'
        }));

        // Apply filters: Year
        if (year && year !== 'all') {
            students = students.filter(s => String(s.year) === String(year));
        }

        // Apply filters: Section
        if (section && section !== 'all') {
            students = students.filter(s => String(s.section).toLowerCase() === String(section).toLowerCase());
        }

        // Apply filters: Search (name or roll number)
        if (search && search.trim() !== '') {
            const q = search.trim().toLowerCase();
            students = students.filter(s =>
                (s.full_name || '').toLowerCase().includes(q) ||
                (s.roll_number || '').toLowerCase().includes(q)
            );
        }

        // Calculate dynamic summary stats on the filtered dataset
        const totalCount = students.length;
        
        const studentsWithAtt = students.filter(s => s.att != null);
        const avgAttendance = studentsWithAtt.length > 0
            ? Math.round(studentsWithAtt.reduce((acc, s) => acc + s.att, 0) / studentsWithAtt.length)
            : 0;

        const studentsWithCgpa = students.filter(s => s.cgpa != null);
        const avgCGPA = studentsWithCgpa.length > 0
            ? Number((studentsWithCgpa.reduce((acc, s) => acc + s.cgpa, 0) / studentsWithCgpa.length).toFixed(2))
            : 0.0;

        const totalBacklogs = students.reduce((acc, s) => acc + (s.backlogs || 0), 0);

        // Apply sorting
        if (sortBy) {
            if (sortBy === 'cgpa') {
                students.sort((a, b) => (b.cgpa || 0) - (a.cgpa || 0));
            } else if (sortBy === 'attendance') {
                students.sort((a, b) => (b.att || 0) - (a.att || 0));
            } else if (sortBy === 'leastBacklogs' || sortBy === 'least_backlogs') {
                students.sort((a, b) => (a.backlogs || 0) - (b.backlogs || 0));
            } else if (sortBy === 'highestBacklogs' || sortBy === 'highest_backlogs') {
                students.sort((a, b) => (b.backlogs || 0) - (a.backlogs || 0));
            } else if (sortBy === 'alphabetical') {
                students.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
            }
        } else {
            // Default to CGPA rank as in the example
            students.sort((a, b) => (b.cgpa || 0) - (a.cgpa || 0));
        }

        // Map Rank attribute after sorting
        students = students.map((s, index) => ({
            ...s,
            rank: index + 1
        }));

        // Group students: Year -> Section
        const grouped = {};
        const YEAR_LABELS = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };
        
        students.forEach(s => {
            const yearStr = YEAR_LABELS[s.year] || `${s.year}th Year`;
            const secStr = `Section ${s.section || 'A'}`;

            if (!grouped[yearStr]) {
                grouped[yearStr] = {};
            }
            if (!grouped[yearStr][secStr]) {
                grouped[yearStr][secStr] = [];
            }
            grouped[yearStr][secStr].push(s);
        });

        res.json({
            department: deptCode,
            summary: {
                students: totalCount,
                avgAttendance,
                avgCGPA,
                backlogs: totalBacklogs
            },
            data: grouped,
            students // also return the flat list for backward compatibility
        });
    } catch (err) {
        console.error('GET department students error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/principal/departments/:id/faculty
router.get('/departments/:id/faculty', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT u.id, u.full_name, u.email, u.is_active, u.login_id,
                   fp.designation, fp.qualification
            FROM users u
            LEFT JOIN faculty_profiles fp ON fp.user_id = u.id
            WHERE u.department_id = ? AND u.role = 'faculty' AND u.is_active = TRUE
            ORDER BY u.full_name
        `, [req.params.id]);
        res.json({ faculty: rows });
    } catch (err) {
        console.error('Dept faculty error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── STUDENT OVERVIEW (for Principal) ────────────────────────────────────────

// GET /api/principal/students
// Query params: dept_id, year, section, attendance (low|critical|good), search, page, limit
router.get('/students', async (req, res) => {
    try {
        const { dept_id, year, section, attendance, search, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Build base query — compute attendance directly from attendance table
        let sql = `
            SELECT
                u.id,
                u.full_name,
                u.email,
                u.is_active,
                sp.roll_number,
                sp.year,
                sp.semester,
                sp.section,
                d.id   AS dept_id,
                d.name AS dept_name,
                d.code AS dept_code,
                ROUND(
                    COALESCE(
                        SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(a.id), 0),
                        0
                    ), 2
                ) AS overall_attendance_pct,
                (
                    SELECT COUNT(*) FROM (
                        SELECT fa2.id,
                            ROUND(SUM(CASE WHEN a2.status IN ('present','late') THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS pct
                        FROM attendance a2
                        JOIN faculty_assignments fa2 ON fa2.id = a2.assignment_id
                        WHERE a2.student_id = u.id
                        GROUP BY fa2.id
                        HAVING pct < 75
                    ) _below
                ) AS subjects_below_75,
                COUNT(DISTINCT sl.id) AS total_leaves,
                COALESCE(sc.cgpa, gv.cgpa) AS cgpa
            FROM users u
            JOIN student_profiles sp ON sp.user_id = u.id
            JOIN departments d ON d.id = sp.department_id
            LEFT JOIN attendance a ON a.student_id = u.id
            LEFT JOIN student_leaves sl ON sl.student_id = u.id AND sl.status = 'approved'
            LEFT JOIN (
                SELECT sc2.student_id, sc2.cgpa
                FROM student_cgpa sc2
                INNER JOIN (SELECT student_id, MAX(updated_at) AS mx FROM student_cgpa GROUP BY student_id) lsc
                    ON sc2.student_id = lsc.student_id AND sc2.updated_at = lsc.mx
            ) sc ON sc.student_id = u.id
            LEFT JOIN (
                SELECT g2.student_id,
                    ROUND(SUM(g2.grade_points * s2.credits) / NULLIF(SUM(s2.credits), 0), 2) AS cgpa
                FROM grades g2 JOIN subjects s2 ON s2.id = g2.subject_id
                GROUP BY g2.student_id
            ) gv ON gv.student_id = u.id
            WHERE u.role = 'student' AND u.is_active = TRUE
        `;
        const params = [];

        if (dept_id)  { sql += ' AND sp.department_id = ?'; params.push(dept_id); }
        if (year)     { sql += ' AND sp.year = ?'; params.push(year); }
        if (section)  { sql += ' AND sp.section = ?'; params.push(section); }
        if (search)   { sql += ' AND (u.full_name LIKE ? OR sp.roll_number LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

        sql += `
            GROUP BY u.id, sp.roll_number, sp.year, sp.semester,
                     sp.section, d.id, d.name, d.code, sc.cgpa, gv.cgpa
        `;

        // Attendance band filter via HAVING
        if (attendance === 'critical') { sql += ' HAVING overall_attendance_pct < 60'; }
        else if (attendance === 'low') { sql += ' HAVING overall_attendance_pct >= 60 AND overall_attendance_pct < 75'; }
        else if (attendance === 'good') { sql += ' HAVING overall_attendance_pct >= 75'; }

        sql += ' ORDER BY d.name, sp.year, sp.section, sp.roll_number';

        // Count for pagination
        const countSql = `SELECT COUNT(*) as total FROM (${sql}) AS sub`;
        const [countRows] = await db.query(countSql, params);
        const total = countRows[0]?.total || 0;

        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [students] = await db.query(sql, params);

        // Summary band counts — also computed from real attendance data
        const bandWhereParts = [];
        const bandParams = [];
        if (dept_id) { bandWhereParts.push('sp.department_id = ?'); bandParams.push(dept_id); }
        if (year)    { bandWhereParts.push('sp.year = ?'); bandParams.push(year); }
        const bandWhere = bandWhereParts.length ? 'AND ' + bandWhereParts.join(' AND ') : '';

        const [bandRows] = await db.query(`
            SELECT
                COUNT(*) AS total_students,
                SUM(CASE WHEN avg_pct <  60  THEN 1 ELSE 0 END) AS critical_attendance,
                SUM(CASE WHEN avg_pct >= 60 AND avg_pct < 75 THEN 1 ELSE 0 END) AS low_attendance,
                SUM(CASE WHEN avg_pct >= 75 THEN 1 ELSE 0 END) AS good_attendance
            FROM (
                SELECT u2.id AS student_id,
                    ROUND(
                        SUM(CASE WHEN a3.status IN ('present','late') THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(a3.id), 0),
                        2
                    ) AS avg_pct
                FROM users u2
                JOIN student_profiles sp ON sp.user_id = u2.id
                LEFT JOIN attendance a3 ON a3.student_id = u2.id
                WHERE u2.role = 'student' AND u2.is_active = TRUE ${bandWhere}
                GROUP BY u2.id
            ) AS student_avgs
        `, bandParams);

        res.json({
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            students,
            summary: bandRows[0] || { total_students: 0, critical_attendance: 0, low_attendance: 0, good_attendance: 0 }
        });
    } catch (err) {
        console.error('Principal students overview error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/principal/students/:id/subjects — Subject-wise drill-down
router.get('/students/:id/subjects', async (req, res) => {
    try {
        const studentId = req.params.id;

        // Verify student exists
        const [user] = await db.query(
            "SELECT u.full_name, sp.roll_number, sp.year, sp.section, d.name AS dept_name FROM users u JOIN student_profiles sp ON sp.user_id = u.id JOIN departments d ON d.id = sp.department_id WHERE u.id = ? AND u.role = 'student'",
            [studentId]
        );
        if (!user.length) return res.status(404).json({ error: 'Student not found' });

        const [subjects] = await db.query(`
            SELECT
                s.name    AS subject_name,
                s.code    AS subject_code,
                fa.year,
                fa.section,
                d.name    AS dept_name,
                ats.total_sessions,
                ats.attended_sessions,
                ats.percentage,
                CASE
                    WHEN ats.percentage >= 75 THEN 'good'
                    WHEN ats.percentage >= 60 THEN 'low'
                    ELSE 'critical'
                END AS attendance_band
            FROM attendance_summary ats
            JOIN faculty_assignments fa ON fa.id = ats.assignment_id
            JOIN subjects s             ON s.id = fa.subject_id
            JOIN departments d          ON d.id = fa.department_id
            WHERE ats.student_id = ?
              AND ats.academic_year_id = (SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1)
            ORDER BY d.name, s.name
        `, [studentId]);

        res.json({ student: user[0], subjects });
    } catch (err) {
        console.error('Student subject drill-down error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── SYSTEM RESETS (DANGER ZONE) ──────────────────────────────────────────────

// DELETE /api/principal/reset-attendance
router.delete('/reset-attendance', require('../middleware/confirmPassword'), async (req, res) => {
    try {
        const { confirmation } = req.body;
        if (confirmation !== 'RESET') {
            return res.status(400).json({ error: 'Invalid confirmation text' });
        }
        
        // Truncate/Delete attendance tables
        await db.query('SET FOREIGN_KEY_CHECKS = 0');
        await db.query('TRUNCATE TABLE attendance');
        await db.query('TRUNCATE TABLE attendance_sessions');
        await db.query('TRUNCATE TABLE attendance_summary');
        await db.query('SET FOREIGN_KEY_CHECKS = 1');
        
        try {
            const { logAction } = require('../utils/auditLogger');
            await logAction(req.user.id, 'RESET_ATTENDANCE', 'attendance', null, { principal_id: req.user.id });
        } catch (auditErr) {
            console.error('Failed to log reset attendance:', auditErr.message);
        }

        res.json({ message: 'All attendance records have been permanently deleted.' });
    } catch (err) {
        console.error('Reset attendance error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/principal/reset-academics
router.delete('/reset-academics', require('../middleware/confirmPassword'), async (req, res) => {
    try {
        const { confirmation } = req.body;
        if (confirmation !== 'RESET') {
            return res.status(400).json({ error: 'Invalid confirmation text' });
        }
        
        // Truncate/Delete academics tables (keeping users/profiles intact)
        await db.query('SET FOREIGN_KEY_CHECKS = 0');
        await db.query('TRUNCATE TABLE marks');
        await db.query('TRUNCATE TABLE grades');
        await db.query('TRUNCATE TABLE student_projects');
        await db.query('TRUNCATE TABLE student_leaves');
        await db.query('SET FOREIGN_KEY_CHECKS = 1');
        
        try {
            const { logAction } = require('../utils/auditLogger');
            await logAction(req.user.id, 'RESET_ACADEMICS', 'marks', null, { principal_id: req.user.id });
        } catch (auditErr) {
            console.error('Failed to log reset academics:', auditErr.message);
        }

        res.json({ message: 'All student academics records (marks, grades, projects, leaves) have been permanently deleted.' });
    } catch (err) {
        console.error('Reset academics error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

