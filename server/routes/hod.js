const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db/connection');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const upload = require('../middleware/upload');
const uploadImport = require('../middleware/uploadImport');
const { notifyStudentsInDept, notifyAll } = require('../utils/notificationService');

const SALT_ROUNDS = 12;

router.use(auth, roleGuard('hod'));

// ─────────────────────────────────────────────────────────────────────────────
// OFFLINE ATTENDANCE CONFLICT ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/hod/attendance-conflicts — list unresolved conflicts for this dept
router.get('/attendance-conflicts', async (req, res) => {
    try {
        const deptId = req.user.department_id;
        const [rows] = await db.query(`
            SELECT ac.*,
                ua.full_name AS faculty_a_name,
                ub.full_name AS faculty_b_name
            FROM attendance_conflicts ac
            JOIN users ua ON ua.id = ac.faculty_a_id
            JOIN users ub ON ub.id = ac.faculty_b_id
            WHERE ac.department_id = ?
              AND ac.resolution IS NULL
            ORDER BY ac.session_date DESC, ac.period_number ASC
        `, [deptId]).catch(() => [[]]);
        res.json({ conflicts: rows });
    } catch (err) {
        console.error('attendance-conflicts GET error:', err);
        res.json({ conflicts: [] });
    }
});

// POST /api/hod/attendance-conflicts/:id/resolve — HOD picks which faculty wins
router.post('/attendance-conflicts/:id/resolve', async (req, res) => {
    try {
        const { resolution } = req.body; // 'faculty_a' or 'faculty_b'
        if (!['faculty_a', 'faculty_b'].includes(resolution))
            return res.status(400).json({ error: 'resolution must be "faculty_a" or "faculty_b"' });

        const [conflicts] = await db.query(
            'SELECT * FROM attendance_conflicts WHERE id = ? AND department_id = ?',
            [req.params.id, req.user.department_id]
        ).catch(() => [[]]);
        if (conflicts.length === 0) return res.status(404).json({ error: 'Conflict not found' });

        const c = conflicts[0];
        const winnerRecords = resolution === 'faculty_b'
            ? (typeof c.faculty_b_records === 'string' ? JSON.parse(c.faculty_b_records) : c.faculty_b_records || [])
            : null; // faculty_a records are already in the DB as the original submission

        // If faculty_b wins — overwrite attendance with their records
        if (resolution === 'faculty_b' && winnerRecords && winnerRecords.length > 0) {
            // Find the assignment_id via attendance_sessions
            const [sess] = await db.query(`
                SELECT ats.assignment_id FROM attendance_sessions ats
                WHERE ats.department_id = ? AND ats.year = ? AND ats.section = ?
                  AND ats.session_date = ? AND ats.period_number = ?
                  AND ats.faculty_id = ?
                LIMIT 1
            `, [c.department_id, c.year, c.section, c.session_date, c.period_number, c.faculty_a_id]);

            if (sess.length > 0) {
                const assignmentId = sess[0].assignment_id;
                for (const r of winnerRecords) {
                    await db.query(
                        `INSERT INTO attendance (student_id, assignment_id, date, period_number, status, marked_by)
                         VALUES (?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE status=VALUES(status), marked_by=VALUES(marked_by)`,
                        [r.student_id, assignmentId, c.session_date, c.period_number, r.status, c.faculty_b_id]
                    );
                }
            }
        }

        // Mark conflict as resolved
        await db.query(
            'UPDATE attendance_conflicts SET resolution = ?, resolved_by = ?, updated_at = NOW() WHERE id = ?',
            [resolution, req.user.id, req.params.id]
        );

        res.json({ message: `Conflict resolved — ${resolution === 'faculty_a' ? 'original' : 'offline'} attendance kept` });
    } catch (err) {
        console.error('resolve conflict error:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// GET /api/hod/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const deptId = req.user.department_id;
        const { year, section } = req.query;

        // Build dynamic filters
        let studentFilter = ' AND u.department_id = ? AND u.role = \'student\' AND u.is_active = TRUE';
        const studentParams = [deptId];
        if (year && year !== 'all' && year !== 'Entire Department') {
            studentFilter += ' AND sp.year = ?';
            studentParams.push(year);
        }
        if (section && section !== 'all' && section !== 'All Sections') {
            studentFilter += ' AND sp.section = ?';
            studentParams.push(section);
        }

        // 1. Total Students
        const [students] = await db.query(
            `SELECT COUNT(*) as count FROM users u JOIN student_profiles sp ON sp.user_id = u.id WHERE 1=1 ${studentFilter}`,
            studentParams
        );

        // 2. Total Faculty
        let facultySql = '';
        const facultyParams = [deptId];
        if ((year && year !== 'all' && year !== 'Entire Department') || (section && section !== 'all' && section !== 'All Sections')) {
            facultySql = `
                SELECT COUNT(DISTINCT fa.faculty_id) as count 
                FROM faculty_assignments fa
                JOIN users u ON fa.faculty_id = u.id
                WHERE fa.department_id = ? AND u.role = 'faculty' AND u.is_active = TRUE
            `;
            if (year && year !== 'all' && year !== 'Entire Department') {
                facultySql += ' AND fa.year = ?';
                facultyParams.push(year);
            }
            if (section && section !== 'all' && section !== 'All Sections') {
                facultySql += ' AND fa.section = ?';
                facultyParams.push(section);
            }
        } else {
            facultySql = "SELECT COUNT(*) as count FROM users WHERE department_id=? AND role='faculty' AND is_active=TRUE";
        }
        const [faculty] = await db.query(facultySql, facultyParams);

        // 3. Sections list
        const [sections] = await db.query(
            "SELECT DISTINCT section FROM student_profiles WHERE department_id=?", [deptId]
        );

        // 4. Defaulters / Attendance Alerts
        let defaultersSql = `
            SELECT u.id, u.full_name, sp.roll_number, s.name as subject_name,
                ROUND(SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END)*100.0/COUNT(*), 2) as percentage
            FROM attendance a
            JOIN users u ON a.student_id = u.id
            JOIN student_profiles sp ON sp.user_id = u.id
            JOIN faculty_assignments fa ON a.assignment_id = fa.id
            JOIN subjects s ON fa.subject_id = s.id
            WHERE fa.department_id = ?
        `;
        const defaultersParams = [deptId];
        if (year && year !== 'all' && year !== 'Entire Department') {
            defaultersSql += ' AND sp.year = ?';
            defaultersParams.push(year);
        }
        if (section && section !== 'all' && section !== 'All Sections') {
            defaultersSql += ' AND sp.section = ?';
            defaultersParams.push(section);
        }
        defaultersSql += `
            GROUP BY a.student_id, a.assignment_id
            HAVING percentage < 75
            ORDER BY percentage ASC LIMIT 20
        `;
        const [defaulters] = await db.query(defaultersSql, defaultersParams);

        // 5. Pending Leaves
        let leavesSql = '';
        const leavesParams = [req.user.id];
        if ((year && year !== 'all' && year !== 'Entire Department') || (section && section !== 'all' && section !== 'All Sections')) {
            leavesSql = `
                SELECT COUNT(DISTINCT fl.id) as count 
                FROM faculty_leaves fl
                JOIN users u ON fl.faculty_id = u.id
                JOIN faculty_assignments fa ON fa.faculty_id = fl.faculty_id
                WHERE fl.hod_id = ? AND fl.status = 'pending'
            `;
            if (year && year !== 'all' && year !== 'Entire Department') {
                leavesSql += ' AND fa.year = ?';
                leavesParams.push(year);
            }
            if (section && section !== 'all' && section !== 'All Sections') {
                leavesSql += ' AND fa.section = ?';
                leavesParams.push(section);
            }
        } else {
            leavesSql = `
                SELECT COUNT(*) as count FROM faculty_leaves 
                WHERE hod_id = ? AND status = 'pending'
            `;
        }
        const [pendingLeaves] = await db.query(leavesSql, leavesParams);

        res.json({
            total_faculty: faculty[0].count,
            total_students: students[0].count,
            sections: sections.map(s => s.section),
            defaulters,
            pending_leaves: pendingLeaves[0].count
        });
    } catch (err) {
        console.error('HOD dashboard error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/hod/faculty — Create faculty account
router.post('/faculty', async (req, res) => {
    try {
        const { full_name, email, phone, password, designation, qualification, joining_date } = req.body;
        if (!full_name || !password) return res.status(400).json({ error: 'Name and password required' });

        const deptId = req.user.department_id;

        // Use MAX numeric suffix across ALL faculty login IDs to avoid collisions
        const [maxRow] = await db.query(
            "SELECT MAX(CAST(SUBSTRING_INDEX(login_id, '-', -1) AS UNSIGNED)) AS maxNum FROM users WHERE role='faculty' AND login_id LIKE 'VIG-FAC-%'"
        );
        const nextNum = (maxRow[0].maxNum || 0) + 1;
        const loginId = `VIG-FAC-${String(nextNum).padStart(3, '0')}`;
        const hash = await bcrypt.hash(password, SALT_ROUNDS);

        const [result] = await db.query(
            'INSERT INTO users (login_id, password_hash, role, department_id, full_name, email, phone) VALUES (?,?,?,?,?,?,?)',
            [loginId, hash, 'faculty', deptId, full_name, email, phone]
        );

        await db.query(
            'INSERT INTO faculty_profiles (user_id, designation, qualification, joining_date) VALUES (?,?,?,?)',
            [result.insertId, designation, qualification, joining_date]
        );

        res.status(201).json({ message: 'Faculty created', login_id: loginId, id: result.insertId });
    } catch (err) {
        console.error('Create faculty error:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'A faculty member with this Login ID already exists. Please try again.' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// ── Ensure faculty_department_links table exists ──────────────────────────────
async function ensureFacultyLinks() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS faculty_department_links (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            faculty_id   INT NOT NULL,
            department_id INT NOT NULL,
            linked_by    INT NOT NULL,
            created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_faculty_dept (faculty_id, department_id),
            FOREIGN KEY (faculty_id)    REFERENCES users(id)       ON DELETE CASCADE,
            FOREIGN KEY (department_id) REFERENCES departments(id)  ON DELETE CASCADE
        )
    `).catch(() => {}); // ignore if already exists
}

// GET /api/hod/faculty — returns primary + linked faculty for this dept
router.get('/faculty', async (req, res) => {
    try {
        await ensureFacultyLinks();
        const deptId = req.user.department_id;

        // Primary faculty (home dept)
        const [primary] = await db.query(`
            SELECT u.id, u.login_id, u.full_name, u.email, u.phone, u.is_active, u.created_at,
                   fp.designation, fp.qualification, fp.joining_date,
                   FALSE AS is_guest, NULL AS home_dept_name
            FROM users u
            LEFT JOIN faculty_profiles fp ON fp.user_id = u.id
            WHERE u.department_id = ? AND u.role = 'faculty' AND u.is_active = TRUE
            ORDER BY u.full_name
        `, [deptId]);

        // Linked (guest) faculty from other depts
        const [linked] = await db.query(`
            SELECT u.id, u.login_id, u.full_name, u.email, u.phone, u.is_active, u.created_at,
                   fp.designation, fp.qualification, fp.joining_date,
                   TRUE AS is_guest, d.name AS home_dept_name
            FROM faculty_department_links fdl
            JOIN users u ON u.id = fdl.faculty_id
            LEFT JOIN faculty_profiles fp ON fp.user_id = u.id
            LEFT JOIN departments d ON d.id = u.department_id
            WHERE fdl.department_id = ? AND u.is_active = TRUE
            ORDER BY u.full_name
        `, [deptId]);

        res.json({ faculty: [...primary, ...linked] });
    } catch (err) {
        console.error('GET faculty error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/hod/faculty/all — all faculty across institution (for link modal)
// Must be BEFORE /faculty/:id
router.get('/faculty/all', async (req, res) => {
    try {
        await ensureFacultyLinks();
        const deptId = req.user.department_id;
        console.log('[faculty/all] HOD dept_id:', deptId);

        const [rows] = await db.query(`
            SELECT u.id, u.login_id, u.full_name, u.email, u.phone,
                   fp.designation, d.name AS department_name, d.code AS department_code,
                   u.department_id,
                   EXISTS(
                       SELECT 1 FROM faculty_department_links fdl
                       WHERE fdl.faculty_id = u.id AND fdl.department_id = ?
                   ) AS already_linked,
                   (u.department_id <=> ?) AS is_primary
            FROM users u
            LEFT JOIN faculty_profiles fp ON fp.user_id = u.id
            LEFT JOIN departments d ON d.id = u.department_id
            WHERE u.role = 'faculty' AND u.is_active = TRUE
              AND NOT (u.department_id <=> ?)
            ORDER BY d.name, u.full_name
        `, [deptId, deptId, deptId]);

        console.log('[faculty/all] rows found:', rows.length);
        res.json({ faculty: rows });
    } catch (err) {
        console.error('GET faculty/all error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/hod/faculty/link/:facultyId — link an external faculty to this dept

router.post('/faculty/link/:facultyId', async (req, res) => {
    try {
        await ensureFacultyLinks();
        const deptId    = req.user.department_id;
        const facultyId = req.params.facultyId;

        // Verify faculty exists and is not already primary in this dept
        const [fac] = await db.query(
            "SELECT id, department_id FROM users WHERE id = ? AND role = 'faculty' AND is_active = TRUE",
            [facultyId]
        );
        if (fac.length === 0) return res.status(404).json({ error: 'Faculty not found' });
        if (fac[0].department_id === Number(deptId))
            return res.status(400).json({ error: 'Faculty already belongs to this department' });

        await db.query(
            'INSERT IGNORE INTO faculty_department_links (faculty_id, department_id, linked_by) VALUES (?, ?, ?)',
            [facultyId, deptId, req.user.id]
        );
        res.json({ message: 'Faculty linked successfully' });
    } catch (err) {
        console.error('Link faculty error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/hod/faculty/link/:facultyId — unlink a guest faculty from this dept
router.delete('/faculty/link/:facultyId', async (req, res) => {
    try {
        await ensureFacultyLinks();
        const deptId    = req.user.department_id;
        const facultyId = req.params.facultyId;
        await db.query(
            'DELETE FROM faculty_department_links WHERE faculty_id = ? AND department_id = ?',
            [facultyId, deptId]
        );
        res.json({ message: 'Faculty unlinked' });
    } catch (err) {
        console.error('Unlink faculty error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/hod/faculty/:id
router.patch('/faculty/:id', async (req, res) => {
    try {
        const { full_name, email, phone, designation, qualification, joining_date, password } = req.body;
        const deptId = req.user.department_id;
        const facultyId = req.params.id;

        // Verify the faculty belongs to this HOD's department
        const [userCheck] = await db.query(
            "SELECT id FROM users WHERE id = ? AND department_id = ? AND role = 'faculty'",
            [facultyId, deptId]
        );
        if (userCheck.length === 0) {
            return res.status(404).json({ error: 'Faculty not found in your department' });
        }

        // Build dynamic query for users table
        let userQuery = 'UPDATE users SET full_name = ?, email = ?, phone = ?';
        const userParams = [full_name || null, email || null, phone || null];

        if (password && password.trim().length >= 8) {
            const hash = await bcrypt.hash(password, SALT_ROUNDS);
            userQuery += ', password_hash = ?';
            userParams.push(hash);
        }

        userQuery += ' WHERE id = ?';
        userParams.push(facultyId);

        await db.query(userQuery, userParams);

        // Update or insert faculty profile
        await db.query(`
            INSERT INTO faculty_profiles (user_id, designation, qualification, joining_date)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                designation = VALUES(designation),
                qualification = VALUES(qualification),
                joining_date = VALUES(joining_date)
        `, [facultyId, designation || null, qualification || null, joining_date || null]);

        res.json({ message: 'Faculty updated successfully' });
    } catch (err) {
        console.error('PATCH faculty error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/hod/faculty/:id  (deactivate home-dept faculty)
router.delete('/faculty/:id', require('../middleware/confirmPassword'), async (req, res) => {
    try {
        await db.query('UPDATE users SET is_active=FALSE WHERE id=? AND department_id=? AND role="faculty"',
            [req.params.id, req.user.department_id]);
        
        try {
            const { logAction } = require('../utils/auditLogger');
            await logAction(req.user.id, 'DEACTIVATE_FACULTY', 'users', req.params.id, { department_id: req.user.department_id });
        } catch (auditErr) {
            console.error('Failed to log deactivate faculty action:', auditErr.message);
        }

        res.json({ message: 'Faculty deactivated' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/hod/students — Add single student
router.post('/students', async (req, res) => {
    try {
        const { full_name, email, phone, password, roll_number, year, semester, section,
            parent_name, parent_phone, parent_email, date_of_birth, address } = req.body;
        if (!full_name || !password || !roll_number || !year || !semester) {
            return res.status(400).json({ error: 'Required fields missing' });
        }

        const deptId = req.user.department_id;
        const hash = await bcrypt.hash(password, SALT_ROUNDS);

        const [result] = await db.query(
            'INSERT INTO users (login_id, password_hash, role, department_id, full_name, email, phone) VALUES (?,?,?,?,?,?,?)',
            [roll_number, hash, 'student', deptId, full_name, email, phone]
        );

        await db.query(
            `INSERT INTO student_profiles 
       (user_id, roll_number, year, semester, section, department_id, parent_name, parent_phone, parent_email, date_of_birth, address) 
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [result.insertId, roll_number, year, semester, section, deptId, parent_name, parent_phone, parent_email, date_of_birth, address]
        );

        res.status(201).json({ message: 'Student created', id: result.insertId, login_id: roll_number });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Roll number already exists' });
        console.error('Create student error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/hod/students/import  — CSV or Excel
// Required columns: roll_number, full_name, email, phone, year, semester, section, password
// Optional columns: parent_name, parent_phone
router.post('/students/import', uploadImport.single('file'), async (req, res) => {
    const fs = require('fs');
    const path = require('path');

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const deptId = req.user.department_id;

    const REQUIRED = ['roll_number', 'full_name', 'email', 'phone', 'year', 'semester', 'section', 'password'];

    // ── Parse file into array of plain objects ──────────────────────────────
    let rows = [];
    try {
        if (ext === '.csv') {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split(/\r?\n/).filter(l => l.trim());
            if (lines.length < 2) return res.status(400).json({ error: 'File is empty or has no data rows' });

            const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                const obj = {};
                headers.forEach((h, idx) => { obj[h] = values[idx] ?? ''; });
                obj._row = i + 1;
                rows.push(obj);
            }
        } else if (ext === '.xlsx' || ext === '.xls') {
            const ExcelJS = require('exceljs');
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.readFile(filePath);
            const ws = wb.worksheets[0];
            if (!ws) return res.status(400).json({ error: 'Excel file has no worksheets' });

            const headerRow = ws.getRow(1).values.slice(1); // exceljs is 1-indexed, col 0 is empty
            const headers = headerRow.map(h => String(h || '').trim().toLowerCase().replace(/\s+/g, '_'));

            // Helper: extract a plain string from an ExcelJS cell value.
            // ExcelJS can return hyperlink objects {text, hyperlink}, formula objects
            // {result, formula}, or rich-text arrays {richText:[{text},...]} instead
            // of plain strings. This happens when Excel auto-formats emails as mailto
            // hyperlinks, which causes String(val) to produce "[object Object]".
            const cellText = (val) => {
                if (val === undefined || val === null) return '';
                if (typeof val === 'object') {
                    // Hyperlink cell: { text: 'foo@bar.com', hyperlink: 'mailto:...' }
                    if (typeof val.text === 'string') return val.text.trim();
                    // Formula cell: { result: 42, formula: '=A1+1' }
                    if (val.result !== undefined) return String(val.result).trim();
                    // Rich-text cell: { richText: [{ text: 'hello' }, ...] }
                    if (Array.isArray(val.richText)) return val.richText.map(r => r.text || '').join('').trim();
                }
                return String(val).trim();
            };

            ws.eachRow((row, rowIndex) => {
                if (rowIndex === 1) return; // skip header
                const vals = row.values.slice(1);
                const obj = {};
                headers.forEach((h, idx) => { obj[h] = cellText(vals[idx]); });
                obj._row = rowIndex;
                rows.push(obj);
            });
        } else {
            return res.status(400).json({ error: 'Unsupported file type. Please upload a .csv or .xlsx file.' });
        }
    } catch (parseErr) {
        console.error('Parse error:', parseErr);
        return res.status(400).json({ error: 'Failed to parse file: ' + parseErr.message });
    } finally {
        try { fs.unlinkSync(filePath); } catch (_) {}
    }

    if (rows.length === 0) return res.status(400).json({ error: 'No data rows found in the file' });

    // ── Validate ALL rows first — reject entire file on any error ───────────
    const validationErrors = [];
    for (const row of rows) {
        const rowNum = row._row;

        // Required fields
        for (const field of REQUIRED) {
            if (!row[field] || row[field].trim() === '') {
                validationErrors.push(`Row ${rowNum}: "${field}" is required but missing or empty`);
            }
        }
        if (validationErrors.length > 0) continue; // skip further checks if required fields missing

        // Email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
            validationErrors.push(`Row ${rowNum}: "${row.email}" is not a valid email address`);
        }
        // Phone — 10 digits
        if (!/^\d{10}$/.test(row.phone)) {
            validationErrors.push(`Row ${rowNum}: Phone "${row.phone}" must be exactly 10 digits`);
        }
        // Year — 1..4
        const year = parseInt(row.year);
        if (isNaN(year) || year < 1 || year > 4) {
            validationErrors.push(`Row ${rowNum}: Year "${row.year}" must be 1, 2, 3, or 4`);
        }
        // Semester — 1..8
        const sem = parseInt(row.semester);
        if (isNaN(sem) || sem < 1 || sem > 8) {
            validationErrors.push(`Row ${rowNum}: Semester "${row.semester}" must be between 1 and 8`);
        }
        // Password min length
        if (row.password.length < 6) {
            validationErrors.push(`Row ${rowNum}: Password must be at least 6 characters`);
        }
    }

    if (validationErrors.length > 0) {
        return res.status(422).json({
            error: `File rejected — ${validationErrors.length} validation error(s) found. Fix all errors and re-upload.`,
            details: validationErrors
        });
    }

    // ── Upsert all rows (update if roll_number exists, insert if new) ────────
    let inserted = 0, updated = 0;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        for (const row of rows) {
            const hash = await bcrypt.hash(row.password, SALT_ROUNDS);
            const rollNum = row.roll_number.trim();
            const year = parseInt(row.year);
            const sem = parseInt(row.semester);

            // Check if student already exists in this department
            const [existing] = await conn.query(
                "SELECT u.id FROM users u JOIN student_profiles sp ON sp.user_id = u.id WHERE u.login_id = ? AND sp.department_id = ?",
                [rollNum, deptId]
            );

            if (existing.length > 0) {
                // UPDATE existing student
                const userId = existing[0].id;
                await conn.query(
                    'UPDATE users SET full_name=?, email=?, phone=?, password_hash=? WHERE id=?',
                    [row.full_name, row.email, row.phone, hash, userId]
                );
                await conn.query(
                    `UPDATE student_profiles SET year=?, semester=?, section=?,
                     parent_name=COALESCE(NULLIF(?,\'\'),parent_name),
                     parent_phone=COALESCE(NULLIF(?,\'\'),parent_phone)
                     WHERE user_id=?`,
                    [year, sem, row.section, row.parent_name||'', row.parent_phone||'', userId]
                );
                updated++;
            } else {
                // INSERT new student
                const [userResult] = await conn.query(
                    'INSERT INTO users (login_id, password_hash, role, department_id, full_name, email, phone) VALUES (?,?,?,?,?,?,?)',
                    [rollNum, hash, 'student', deptId, row.full_name, row.email, row.phone]
                );
                await conn.query(
                    'INSERT INTO student_profiles (user_id, roll_number, year, semester, section, department_id, parent_name, parent_phone) VALUES (?,?,?,?,?,?,?,?)',
                    [userResult.insertId, rollNum, year, sem, row.section, deptId, row.parent_name||null, row.parent_phone||null]
                );
                inserted++;
            }
        }

        await conn.commit();
        res.json({
            message: `Import complete: ${inserted} added, ${updated} updated`,
            inserted,
            updated,
            total: rows.length
        });
    } catch (err) {
        await conn.rollback();
        console.error('Import transaction error:', err);
        res.status(500).json({ error: 'Database error during import: ' + err.message });
    } finally {
        conn.release();
    }
});

// Kept old endpoint name for backward compatibility (alias)
router.post('/students/bulk', upload.single('file'), (req, res) => {
    res.status(410).json({ error: 'This endpoint is deprecated. Use /students/import instead.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/hod/faculty/import — Bulk import faculty from CSV or Excel
// Required columns: full_name, email, phone, password
// Optional columns: designation, qualification, joining_date
// ─────────────────────────────────────────────────────────────────────────────
router.post('/faculty/import', uploadImport.single('file'), async (req, res) => {
    const fs   = require('fs');
    const path = require('path');

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const filePath = req.file.path;
    const ext      = path.extname(req.file.originalname).toLowerCase();
    const deptId   = req.user.department_id;

    const REQUIRED = ['full_name', 'email', 'phone', 'password'];

    // ── Parse file ─────────────────────────────────────────────────────────
    let rows = [];
    try {
        const cellText = (val) => {
            if (val === undefined || val === null) return '';
            if (typeof val === 'object') {
                if (typeof val.text === 'string') return val.text.trim();
                if (val.result !== undefined) return String(val.result).trim();
                if (Array.isArray(val.richText)) return val.richText.map(r => r.text || '').join('').trim();
            }
            return String(val).trim();
        };

        if (ext === '.csv') {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines   = content.split(/\r?\n/).filter(l => l.trim());
            if (lines.length < 2) return res.status(400).json({ error: 'File is empty or has no data rows' });
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                const obj = {};
                headers.forEach((h, idx) => { obj[h] = values[idx] ?? ''; });
                obj._row = i + 1;
                rows.push(obj);
            }
        } else if (ext === '.xlsx' || ext === '.xls') {
            const ExcelJS = require('exceljs');
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.readFile(filePath);
            const ws = wb.worksheets[0];
            if (!ws) return res.status(400).json({ error: 'Excel file has no worksheets' });
            const headerRow = ws.getRow(1).values.slice(1);
            const headers   = headerRow.map(h => cellText(h).toLowerCase().replace(/\s+/g, '_'));
            ws.eachRow((row, rowIndex) => {
                if (rowIndex === 1) return;
                const vals = row.values.slice(1);
                const obj  = {};
                headers.forEach((h, idx) => { obj[h] = cellText(vals[idx]); });
                obj._row = rowIndex;
                rows.push(obj);
            });
        } else {
            return res.status(400).json({ error: 'Unsupported file type. Please upload .csv or .xlsx' });
        }
    } catch (parseErr) {
        return res.status(400).json({ error: 'Failed to parse file: ' + parseErr.message });
    } finally {
        try { fs.unlinkSync(filePath); } catch (_) {}
    }

    if (rows.length === 0) return res.status(400).json({ error: 'No data rows found in the file' });

    // ── Validate ───────────────────────────────────────────────────────────
    const validationErrors = [];
    for (const row of rows) {
        const rowNum = row._row;
        for (const field of REQUIRED) {
            if (!row[field] || row[field].trim() === '') {
                validationErrors.push(`Row ${rowNum}: "${field}" is required but missing or empty`);
            }
        }
        if (validationErrors.length > 0) continue;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
            validationErrors.push(`Row ${rowNum}: "${row.email}" is not a valid email`);
        }
        if (!/^\d{10}$/.test(row.phone)) {
            validationErrors.push(`Row ${rowNum}: Phone "${row.phone}" must be exactly 10 digits`);
        }
        if (row.password.length < 6) {
            validationErrors.push(`Row ${rowNum}: Password must be at least 6 characters`);
        }
    }
    if (validationErrors.length > 0) {
        return res.status(422).json({
            error: `File rejected — ${validationErrors.length} error(s) found. Fix and re-upload.`,
            details: validationErrors,
        });
    }

    // ── Upsert ─────────────────────────────────────────────────────────────
    let inserted = 0, updated = 0;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        for (const row of rows) {
            const hash = await bcrypt.hash(row.password, SALT_ROUNDS);

            // Check if a faculty with this email already exists in this dept
            const [existing] = await conn.query(
                `SELECT id FROM users WHERE email=? AND department_id=? AND role='faculty'`,
                [row.email, deptId]
            );

            if (existing.length > 0) {
                const userId = existing[0].id;
                await conn.query(
                    `UPDATE users SET full_name=?, phone=?, password_hash=? WHERE id=?`,
                    [row.full_name, row.phone, hash, userId]
                );
                await conn.query(
                    `UPDATE faculty_profiles SET
                       designation=COALESCE(NULLIF(?,''),designation),
                       qualification=COALESCE(NULLIF(?,''),qualification)
                     WHERE user_id=?`,
                    [row.designation||'', row.qualification||'', userId]
                );
                updated++;
            } else {
                // Auto-generate login ID: VIG-FAC-XXX
                const [[{ maxId }]] = await conn.query(
                    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(login_id,'-',-1) AS UNSIGNED)),0)+1 AS maxId
                     FROM users WHERE role='faculty'`
                );
                const loginId = `VIG-FAC-${String(maxId).padStart(3,'0')}`;

                const [uRes] = await conn.query(
                    `INSERT INTO users (login_id, password_hash, role, department_id, full_name, email, phone)
                     VALUES (?,?,?,?,?,?,?)`,
                    [loginId, hash, 'faculty', deptId, row.full_name, row.email, row.phone]
                );
                await conn.query(
                    `INSERT INTO faculty_profiles (user_id, designation, qualification, joining_date)
                     VALUES (?,?,?,?)`,
                    [uRes.insertId, row.designation||null, row.qualification||null, row.joining_date||null]
                );
                inserted++;
            }
        }

        await conn.commit();
        res.json({
            message: `Faculty import complete: ${inserted} added, ${updated} updated`,
            inserted, updated, total: rows.length,
        });
    } catch (err) {
        await conn.rollback();
        console.error('Faculty import error:', err);
        res.status(500).json({ error: 'Database error during import: ' + err.message });
    } finally {
        conn.release();
    }
});

// GET /api/hod/students/stats — real per-student attendance % + CGPA/SGPA + backlogs
// Accepts optional ?year=2&section=B query params to scope to a specific class
// Must be BEFORE the /students route so Express doesn't treat 'stats' as an :id param
router.get('/students/stats', async (req, res) => {
    try {
        const deptId = req.user.department_id;
        const { year, section } = req.query;

        // Build optional student-id sub-list when year/section filter is active
        let studentIdFilter = '';
        let studentParams = [deptId];
        if (year || section) {
            let scopeSql = 'SELECT u.id FROM users u JOIN student_profiles sp ON sp.user_id = u.id WHERE sp.department_id = ? AND u.role = \'student\'';
            if (year)    { scopeSql += ' AND sp.year = ?';    studentParams.push(year); }
            if (section) { scopeSql += ' AND sp.section = ?'; studentParams.push(section); }
            const [scopeRows] = await db.query(scopeSql, studentParams);
            if (scopeRows.length === 0) return res.json({ attMap: {}, cgpaMap: {}, sgpaMap: {}, backlogMap: {} });
            const ids = scopeRows.map(r => r.id);
            studentIdFilter = `AND a.student_id IN (${ids.join(',')})`;
        }

        // ── Attendance per student ────────────────────────────────────────────
        const [attRows] = await db.query(`
            SELECT
                a.student_id,
                COUNT(*) AS total,
                SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) AS attended
            FROM attendance a
            JOIN faculty_assignments fa ON fa.id = a.assignment_id
            WHERE fa.department_id = ?
              ${studentIdFilter}
              AND NOT EXISTS (
                SELECT 1 FROM attendance_sessions ats
                WHERE ats.assignment_id  = a.assignment_id
                  AND DATE(ats.session_date) = DATE(a.date)
                  AND (a.period_number IS NULL OR ats.period_number = a.period_number)
                  AND ats.outside_window = 1
                  AND (ats.hod_confirmed IS NULL OR ats.hod_confirmed = 0)
              )
            GROUP BY a.student_id
        `, [deptId]);

        const attMap = {};
        attRows.forEach(r => {
            const total = Number(r.total) || 0;
            const attended = Number(r.attended) || 0;
            attMap[r.student_id] = {
                total,
                attended,
                percentage: total > 0 ? Math.round(attended * 10000.0 / total) / 100 : null,
            };
        });

        // ── CGPA/SGPA: primary source = student_cgpa (faculty-entered) ────────
        // Fall back to grades table (computed from marks) if not found
        const cgpaMap = {};
        const sgpaMap = {};

        // 1. Try student_cgpa table (most up-to-date, entered by faculty)
        try {
            const [cgpaRows] = await db.query(`
                SELECT sc.student_id, sc.cgpa, sc.sgpa
                FROM student_cgpa sc
                JOIN users u ON u.id = sc.student_id
                WHERE u.department_id = ?
                ORDER BY sc.updated_at DESC
            `, [deptId]);
            // Take latest entry per student
            cgpaRows.forEach(r => {
                if (!(r.student_id in cgpaMap)) {
                    cgpaMap[r.student_id] = r.cgpa !== null ? Number(r.cgpa) : null;
                    sgpaMap[r.student_id] = r.sgpa !== null ? Number(r.sgpa) : null;
                }
            });
        } catch (_e) { /* student_cgpa table may not exist yet */ }

        // 2. Fall back to grades table for students not in cgpaMap
        const [gradesRows] = await db.query(`
            SELECT g.student_id,
                   ROUND(SUM(g.grade_points * s.credits) / NULLIF(SUM(s.credits), 0), 2) AS cgpa
            FROM grades g
            JOIN subjects s ON s.id = g.subject_id
            JOIN users u ON u.id = g.student_id
            WHERE u.department_id = ?
            GROUP BY g.student_id
        `, [deptId]);
        gradesRows.forEach(r => {
            if (!(r.student_id in cgpaMap)) {
                cgpaMap[r.student_id] = r.cgpa !== null ? Number(r.cgpa) : null;
            }
        });

        // ── Backlogs: check student_backlogs table first, then grades F count ──
        const backlogMap = {};

        // 1. student_backlogs table (faculty-entered active backlogs)
        try {
            const [blRows] = await db.query(`
                SELECT sb.student_id, SUM(sb.backlog_count) AS backlogs
                FROM student_backlogs sb
                JOIN users u ON u.id = sb.student_id
                WHERE u.department_id = ? AND sb.status = 'active'
                GROUP BY sb.student_id
            `, [deptId]);
            blRows.forEach(r => { backlogMap[r.student_id] = Number(r.backlogs) || 0; });
        } catch (_e) { /* student_backlogs may not exist */ }

        // 2. Also check grades table F count for students not already mapped
        const [gradeBlRows] = await db.query(`
            SELECT g.student_id, COUNT(*) AS backlogs
            FROM grades g
            JOIN users u ON u.id = g.student_id
            WHERE u.department_id = ? AND g.grade_letter = 'F'
            GROUP BY g.student_id
        `, [deptId]);
        gradeBlRows.forEach(r => {
            if (!(r.student_id in backlogMap)) {
                backlogMap[r.student_id] = Number(r.backlogs) || 0;
            }
        });

        res.json({ attMap, cgpaMap, sgpaMap, backlogMap });
    } catch (err) {
        console.error('HOD student stats error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/hod/priority-list
router.get('/priority-list', async (req, res) => {
    try {
        const deptId = req.user.department_id;
        const { year, section, sortBy, search } = req.query;

        let sql = `
            SELECT 
                u.id, 
                u.full_name, 
                sp.roll_number, 
                sp.year, 
                sp.section,
                COALESCE(sc.cgpa, grade_calc.cgpa) AS cgpa,
                COALESCE(sc.sgpa, grade_calc.sgpa) AS sgpa,
                att_calc.percentage AS att,
                COALESCE(sb_calc.backlogs, grade_calc.backlogs, 0) AS backlogs,
                marks_calc.marks_avg AS marks_average
            FROM users u
            JOIN student_profiles sp ON sp.user_id = u.id
            LEFT JOIN (
                SELECT student_id, cgpa, sgpa 
                FROM student_cgpa sc1
                WHERE id = (SELECT id FROM student_cgpa sc2 WHERE sc2.student_id = sc1.student_id ORDER BY updated_at DESC LIMIT 1)
            ) sc ON sc.student_id = u.id
            LEFT JOIN (
                SELECT 
                    g.student_id,
                    ROUND(SUM(g.grade_points * s.credits) / NULLIF(SUM(s.credits), 0), 2) AS cgpa,
                    ROUND(SUM(CASE WHEN g.semester = (SELECT MAX(semester) FROM grades WHERE student_id = g.student_id) THEN g.grade_points * s.credits ELSE 0 END) / 
                          NULLIF(SUM(CASE WHEN g.semester = (SELECT MAX(semester) FROM grades WHERE student_id = g.student_id) THEN s.credits ELSE 0 END), 0), 2) AS sgpa,
                    SUM(CASE WHEN g.grade_letter = 'F' THEN 1 ELSE 0 END) AS backlogs
                FROM grades g
                JOIN subjects s ON s.id = g.subject_id
                GROUP BY g.student_id
            ) grade_calc ON grade_calc.student_id = u.id
            LEFT JOIN (
                SELECT 
                    a.student_id,
                    ROUND(SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS percentage
                FROM attendance a
                JOIN faculty_assignments fa ON fa.id = a.assignment_id
                WHERE NOT EXISTS (
                    SELECT 1 FROM attendance_sessions ats
                    WHERE ats.assignment_id  = a.assignment_id
                      AND DATE(ats.session_date) = DATE(a.date)
                      AND (a.period_number IS NULL OR ats.period_number = a.period_number)
                      AND ats.outside_window = 1
                      AND (ats.hod_confirmed IS NULL OR ats.hod_confirmed = 0)
                )
                GROUP BY a.student_id
            ) att_calc ON att_calc.student_id = u.id
            LEFT JOIN (
                SELECT student_id, SUM(backlog_count) AS backlogs
                FROM student_backlogs
                WHERE status = 'active'
                GROUP BY student_id
            ) sb_calc ON sb_calc.student_id = u.id
            LEFT JOIN (
                SELECT student_id, ROUND(AVG(marks_obtained), 2) AS marks_avg
                FROM marks
                GROUP BY student_id
            ) marks_calc ON marks_calc.student_id = u.id
            WHERE u.role = 'student' AND u.is_active = TRUE AND sp.department_id = ?
        `;

        const params = [deptId];

        if (year && year !== 'all' && year !== 'Entire Department') {
            sql += ' AND sp.year = ?';
            params.push(year);
        }
        if (section && section !== 'all' && section !== 'All Sections') {
            sql += ' AND sp.section = ?';
            params.push(section);
        }
        if (search) {
            sql += ' AND (u.full_name LIKE ? OR sp.roll_number LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        // Apply custom sorting
        let orderClause = ' ORDER BY ';
        switch (sortBy) {
            case 'sgpa':
                orderClause += 'CASE WHEN COALESCE(sc.sgpa, grade_calc.sgpa) IS NULL THEN 1 ELSE 0 END, COALESCE(sc.sgpa, grade_calc.sgpa) DESC, COALESCE(sc.cgpa, grade_calc.cgpa) DESC';
                break;
            case 'attendance':
                orderClause += 'CASE WHEN att_calc.percentage IS NULL THEN 1 ELSE 0 END, att_calc.percentage DESC, COALESCE(sc.cgpa, grade_calc.cgpa) DESC';
                break;
            case 'lowest_attendance':
                orderClause += 'CASE WHEN att_calc.percentage IS NULL THEN 1 ELSE 0 END, att_calc.percentage ASC, COALESCE(sc.cgpa, grade_calc.cgpa) ASC';
                break;
            case 'least_backlogs':
                orderClause += 'COALESCE(sb_calc.backlogs, grade_calc.backlogs, 0) ASC, CASE WHEN COALESCE(sc.cgpa, grade_calc.cgpa) IS NULL THEN 1 ELSE 0 END, COALESCE(sc.cgpa, grade_calc.cgpa) DESC';
                break;
            case 'most_backlogs':
                orderClause += 'COALESCE(sb_calc.backlogs, grade_calc.backlogs, 0) DESC, CASE WHEN COALESCE(sc.cgpa, grade_calc.cgpa) IS NULL THEN 1 ELSE 0 END, COALESCE(sc.cgpa, grade_calc.cgpa) DESC';
                break;
            case 'marks_avg':
                orderClause += 'CASE WHEN marks_calc.marks_avg IS NULL THEN 1 ELSE 0 END, marks_calc.marks_avg DESC, COALESCE(sc.cgpa, grade_calc.cgpa) DESC';
                break;
            case 'cgpa':
            default:
                orderClause += 'CASE WHEN COALESCE(sc.cgpa, grade_calc.cgpa) IS NULL THEN 1 ELSE 0 END, COALESCE(sc.cgpa, grade_calc.cgpa) DESC, CASE WHEN att_calc.percentage IS NULL THEN 1 ELSE 0 END, att_calc.percentage DESC';
                break;
        }

        sql += orderClause;

        const [rows] = await db.query(sql, params);
        res.json({ students: rows });
    } catch (err) {
        console.error('HOD priority list error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/hod/students
router.get('/students', async (req, res) => {
    try {
        const { year, section } = req.query;
        let sql = `
      SELECT u.id, u.login_id, u.full_name, u.email, u.phone, u.is_active,
             sp.roll_number, sp.year, sp.semester, sp.section,
             sp.parent_name, sp.parent_phone,
             sp.date_of_birth
      FROM users u
      JOIN student_profiles sp ON sp.user_id = u.id
      WHERE sp.department_id = ? AND u.role = 'student'
    `;
        const params = [req.user.department_id];
        if (year) { sql += ' AND sp.year = ?'; params.push(year); }
        if (section) { sql += ' AND sp.section = ?'; params.push(section); }
        sql += ' ORDER BY sp.roll_number';

        const [rows] = await db.query(sql, params);
        res.json({ students: rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/hod/students/promotable — students with stats for promotion preview
// Must be BEFORE /students/:id
router.get('/students/promotable', async (req, res) => {
    try {
        const deptId = req.user.department_id;
        const { year, semester, section } = req.query;

        let sql = `
            SELECT u.id, u.full_name, u.is_active,
                   sp.roll_number, sp.year, sp.semester, sp.section
            FROM users u
            JOIN student_profiles sp ON sp.user_id = u.id
            WHERE sp.department_id = ? AND u.role = 'student' AND u.is_active = TRUE
        `;
        const params = [deptId];
        if (year)     { sql += ' AND sp.year = ?';     params.push(year); }
        if (semester) { sql += ' AND sp.semester = ?'; params.push(semester); }
        if (section)  { sql += ' AND sp.section = ?';  params.push(section); }
        sql += ' ORDER BY sp.year, sp.section, sp.roll_number';

        const [students] = await db.query(sql, params);
        if (students.length === 0) return res.json({ students: [] });

        const ids = students.map(s => s.id);

        // Attendance %
        const attMap = {};
        try {
            const [attRows] = await db.query(`
                SELECT a.student_id,
                    ROUND(SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 1) AS pct
                FROM attendance a
                JOIN faculty_assignments fa ON fa.id = a.assignment_id
                WHERE fa.department_id = ? AND a.student_id IN (?)
                GROUP BY a.student_id
            `, [deptId, ids]);
            attRows.forEach(r => { attMap[r.student_id] = Number(r.pct) || 0; });
        } catch (_) {}

        // CGPA
        const cgpaMap = {};
        try {
            const [cgpaRows] = await db.query(`
                SELECT sc.student_id, sc.cgpa FROM student_cgpa sc
                INNER JOIN (SELECT student_id, MAX(updated_at) AS mx FROM student_cgpa GROUP BY student_id) lat
                ON sc.student_id = lat.student_id AND sc.updated_at = lat.mx
                WHERE sc.student_id IN (?)
            `, [ids]);
            cgpaRows.forEach(r => { cgpaMap[r.student_id] = Number(r.cgpa); });
        } catch (_) {}

        // Active backlogs
        const backlogMap = {};
        try {
            const [blRows] = await db.query(`
                SELECT student_id, SUM(backlog_count) AS cnt
                FROM student_backlogs WHERE student_id IN (?) AND status = 'active'
                GROUP BY student_id
            `, [ids]);
            blRows.forEach(r => { backlogMap[r.student_id] = Number(r.cnt) || 0; });
        } catch (_) {}

        const result = students.map(s => ({
            ...s,
            attendance: attMap[s.id] ?? null,
            cgpa:       cgpaMap[s.id]  ?? null,
            backlogs:   backlogMap[s.id] || 0,
        }));

        res.json({ students: result });
    } catch (err) {
        console.error('Promotable students error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/hod/students/promote
// mode: 'year'     → year+1, sem = first sem of new year; Year 4 → graduated
// mode: 'semester' → sem+1 only, year unchanged
router.post('/students/promote', require('../middleware/confirmPassword'), async (req, res) => {
    const { student_ids, mode } = req.body;
    if (!Array.isArray(student_ids) || student_ids.length === 0)
        return res.status(400).json({ error: 'student_ids array is required' });
    if (!['year', 'semester'].includes(mode))
        return res.status(400).json({ error: 'mode must be "year" or "semester"' });

    const deptId = req.user.department_id;
    const conn   = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [valid] = await conn.query(`
            SELECT u.id, sp.year, sp.semester, sp.section
            FROM users u
            JOIN student_profiles sp ON sp.user_id = u.id
            WHERE u.id IN (?) AND sp.department_id = ? AND u.role = 'student' AND u.is_active = TRUE
        `, [student_ids, deptId]);

        if (valid.length === 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'No valid students found' });
        }

        let promoted = 0, graduated = 0, advanced = 0;

        for (const s of valid) {
            const curYear = Number(s.year);
            const curSem  = Number(s.semester);

            if (mode === 'semester') {
                // ── SEMESTER MODE: sem+1, year unchanged ──────────────────────
                const newSem = curSem + 1;
                await conn.query(
                    `UPDATE student_profiles SET semester = ? WHERE user_id = ?`,
                    [newSem, s.id]
                );
                advanced++;
            } else {
                // ── YEAR MODE ────────────────────────────────────────────────
                if (curYear >= 4) {
                    // Graduate
                    await conn.query(`UPDATE users SET is_active = FALSE WHERE id = ?`, [s.id]);
                    await conn.query(
                        `ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS graduated_at TIMESTAMP NULL`
                    ).catch(() => {});
                    await conn.query(
                        `UPDATE student_profiles SET year = 4, semester = 8, graduated_at = NOW() WHERE user_id = ?`,
                        [s.id]
                    );
                    graduated++;
                } else {
                    // year+1, sem = first odd sem of new year (2→3, 3→5, 4→7)
                    const newYear = curYear + 1;
                    const newSem  = newYear * 2 - 1;
                    await conn.query(
                        `UPDATE student_profiles SET year = ?, semester = ? WHERE user_id = ?`,
                        [newYear, newSem, s.id]
                    );
                    promoted++;
                }
            }
        }

        await conn.commit();

        try {
            const { logAction } = require('../utils/auditLogger');
            await logAction(req.user.id, 'PROMOTE_STUDENTS', 'student_profiles', null, { student_ids, mode, promoted, graduated, advanced });
        } catch (auditErr) {
            console.error('Failed to log promote students action:', auditErr.message);
        }

        res.json({
            message: mode === 'semester'
                ? `Semester advanced for ${advanced} student(s)`
                : `Year promotion complete: ${promoted} promoted, ${graduated} graduated`,
            promoted, graduated, advanced,
            total: valid.length,
        });
    } catch (err) {
        await conn.rollback();
        console.error('Promote error:', err);
        res.status(500).json({ error: 'Failed: ' + err.message });
    } finally {
        conn.release();
    }
});



// PATCH /api/hod/students/:id
router.patch('/students/:id', async (req, res) => {
    try {
        const { full_name, email, phone, year, semester, section, parent_name, parent_phone, roll_number, date_of_birth } = req.body;
        // Treat empty strings as null so COALESCE keeps the existing DB value
        const nullIfEmpty = v => (v === '' || v == null) ? null : v;
        // MySQL DATE column needs YYYY-MM-DD — strip time from ISO strings like '2006-12-14T18:30:00.000Z'
        const dateOnly = v => {
            if (!v) return null;
            const s = String(v);
            return s.length >= 10 ? s.slice(0, 10) : s;
        };

        await db.query(
            'UPDATE users SET full_name=COALESCE(?,full_name), email=COALESCE(?,email), phone=COALESCE(?,phone), login_id=COALESCE(?,login_id) WHERE id=?',
            [nullIfEmpty(full_name), nullIfEmpty(email), nullIfEmpty(phone), nullIfEmpty(roll_number), req.params.id]
        );
        await db.query(
            `UPDATE student_profiles SET
               year        = COALESCE(?,year),
               semester    = COALESCE(?,semester),
               section     = COALESCE(?,section),
               parent_name = COALESCE(?,parent_name),
               parent_phone= COALESCE(?,parent_phone),
               date_of_birth = COALESCE(?,date_of_birth),
               roll_number = COALESCE(?,roll_number)
             WHERE user_id=?`,
            [nullIfEmpty(year), nullIfEmpty(semester), nullIfEmpty(section),
             nullIfEmpty(parent_name), nullIfEmpty(parent_phone),
             dateOnly(date_of_birth), nullIfEmpty(roll_number),
             req.params.id]
        );
        res.json({ message: 'Student updated' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Roll number already exists' });
        console.error('Update student error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/hod/students/:id
router.delete('/students/:id', async (req, res) => {
    try {
        await db.query('UPDATE users SET is_active=FALSE WHERE id=? AND role="student"', [req.params.id]);
        res.json({ message: 'Student deactivated' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/hod/students/:id/full — comprehensive student data for HOD view
router.get('/students/:id/full', async (req, res) => {
    try {
        const studentId = req.params.id;
        const deptId = req.user.department_id;

        // 1. Basic profile
        const [profileRows] = await db.query(`
            SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.created_at,
                   sp.roll_number, sp.year, sp.semester, sp.section,
                   sp.parent_name, sp.parent_phone, sp.date_of_birth, sp.address
            FROM users u
            JOIN student_profiles sp ON sp.user_id = u.id
            WHERE u.id = ? AND sp.department_id = ? AND u.role = 'student'
        `, [studentId, deptId]);

        if (profileRows.length === 0) return res.status(404).json({ error: 'Student not found' });
        const profile = profileRows[0];

        // 2. All marks (MID1, MID2, internals, assignments)
        const [marksRows] = await db.query(`
            SELECT m.id, m.exam_type, m.exam_label, m.marks_obtained, m.max_marks,
                   m.is_published, m.locked,
                   s.name AS subject_name, s.code AS subject_code, s.credits
            FROM marks m
            JOIN subjects s ON s.id = m.subject_id
            WHERE m.student_id = ? AND s.department_id = ?
            ORDER BY s.name, m.exam_type, m.exam_label
        `, [studentId, deptId]);

        // 3. CGPA / SGPA
        let cgpa = null, sgpa = null;
        try {
            const [cgpaRows] = await db.query(`
                SELECT cgpa, sgpa FROM student_cgpa
                WHERE student_id = ?
                ORDER BY updated_at DESC LIMIT 1
            `, [studentId]);
            if (cgpaRows.length > 0) { cgpa = cgpaRows[0].cgpa; sgpa = cgpaRows[0].sgpa; }
        } catch (_) {}

        // Fall back to grades table
        if (cgpa === null) {
            const [gradesRows] = await db.query(`
                SELECT ROUND(SUM(g.grade_points * s.credits) / NULLIF(SUM(s.credits), 0), 2) AS cgpa
                FROM grades g JOIN subjects s ON s.id = g.subject_id
                WHERE g.student_id = ?
            `, [studentId]);
            if (gradesRows.length > 0) cgpa = gradesRows[0].cgpa;
        }

        // 4. Attendance per subject — same outside-window exclusion as HOD stats & student portal
        const [attRows] = await db.query(`
            SELECT s.name AS subject_name, s.code AS subject_code,
                   fa.year, fa.section,
                   COUNT(*) AS total,
                   SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) AS attended,
                   ROUND(SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(*),0), 2) AS percentage
            FROM attendance a
            JOIN faculty_assignments fa ON fa.id = a.assignment_id
            JOIN subjects s ON s.id = fa.subject_id
            WHERE a.student_id = ? AND fa.department_id = ?
              AND NOT EXISTS (
                SELECT 1 FROM attendance_sessions ats
                WHERE ats.assignment_id  = a.assignment_id
                  AND DATE(ats.session_date) = DATE(a.date)
                  AND (a.period_number IS NULL OR ats.period_number = a.period_number)
                  AND ats.outside_window = 1
                  AND (ats.hod_confirmed IS NULL OR ats.hod_confirmed = 0)
              )
            GROUP BY fa.id
            ORDER BY s.name
        `, [studentId, deptId]);

        // 5. Overall attendance — use SUM(attended)/SUM(total) so it matches
        //    what the student portal and HOD dashboard show (NOT an average of %s)
        const totalAttended = attRows.reduce((s, r) => s + (Number(r.attended) || 0), 0);
        const totalClasses  = attRows.reduce((s, r) => s + (Number(r.total)    || 0), 0);
        const overallAtt    = totalClasses > 0
            ? Math.round(totalAttended * 10000 / totalClasses) / 100
            : null;

        // 6. Backlogs
        let backlogs = [];
        try {
            const [blRows] = await db.query(`
                SELECT sb.subject_name, sb.backlog_count, sb.status, sb.semester, sb.updated_at
                FROM student_backlogs sb
                WHERE sb.student_id = ? AND sb.status = 'active'
                ORDER BY sb.semester
            `, [studentId]);
            backlogs = blRows;
        } catch (_) {}

        // 7. Grades
        let grades = [];
        try {
            const [grRows] = await db.query(`
                SELECT g.grade_letter, g.grade_points, s.name AS subject_name, s.code, s.credits, g.semester
                FROM grades g JOIN subjects s ON s.id = g.subject_id
                WHERE g.student_id = ?
                ORDER BY g.semester, s.name
            `, [studentId]);
            grades = grRows;
        } catch (_) {}

        res.json({
            profile,
            marks: marksRows,
            cgpa,
            sgpa,
            attendance: attRows,
            overall_attendance: overallAtt,
            backlogs,
            grades,
        });
    } catch (err) {
        console.error('HOD student full data error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/hod/attendance/summary
router.get('/attendance/summary', async (req, res) => {
    try {
        // Per-student percentages first, then averaged — matches student portal formula
        const [rows] = await db.query(`
      SELECT fa.year, fa.section, s.name as subject_name, s.code,
        u_fac.full_name as faculty_name,
        COUNT(DISTINCT a.student_id) as total_students,
        ROUND(AVG(per_student.pct), 2) as avg_attendance
      FROM faculty_assignments fa
      JOIN subjects s ON fa.subject_id = s.id
      JOIN users u_fac ON u_fac.id = fa.faculty_id
      LEFT JOIN (
        SELECT a2.assignment_id, a2.student_id,
          ROUND(SUM(CASE WHEN a2.status IN ('present','late') THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(*),0), 2) as pct
        FROM attendance a2
        GROUP BY a2.assignment_id, a2.student_id
      ) per_student ON per_student.assignment_id = fa.id
      LEFT JOIN attendance a ON a.assignment_id = fa.id
      WHERE fa.department_id = ?
      GROUP BY fa.id
      HAVING COUNT(DISTINCT a.student_id) > 0
      ORDER BY fa.year, fa.section, s.name
    `, [req.user.department_id]);
        res.json({ summary: rows });
    } catch (err) {
        console.error('HOD attendance summary error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/hod/attendance/defaulters
router.get('/attendance/defaulters', async (req, res) => {
    try {
        // Uses same COUNT/SUM formula identical to student portal
        const [rows] = await db.query(`
      SELECT u.full_name, sp.roll_number, s.name as subject_name,
        fa.year, fa.section,
        COUNT(*) as total,
        SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN a.status='late'   THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN a.status='leave'  THEN 1 ELSE 0 END) as leave_count,
        SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) as attended,
        ROUND(SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(*),0), 2) as percentage
      FROM attendance a
      JOIN users u ON a.student_id = u.id
      JOIN student_profiles sp ON sp.user_id = u.id
      JOIN faculty_assignments fa ON a.assignment_id = fa.id
      JOIN subjects s ON fa.subject_id = s.id
      WHERE fa.department_id = ?
      GROUP BY a.student_id, a.assignment_id
      HAVING percentage < 75
      ORDER BY percentage ASC
    `, [req.user.department_id]);
        res.json({ defaulters: rows });
    } catch (err) {
        console.error('HOD defaulters error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/hod/attendance/audit — sessions with outside_window flag
router.get('/attendance/audit', async (req, res) => {
    try {
        const [rows] = await db.query(`
      SELECT
        ats.id as session_id,
        DATE_FORMAT(ats.session_date, '%d %b %Y') as session_date,
        ats.period_number,
        TIME_FORMAT(ats.start_time, '%h:%i %p') as period_start,
        TIME_FORMAT(ats.end_time,   '%h:%i %p') as period_end,
        ats.created_at as submitted_at,
        TIME_FORMAT(ats.created_at, '%h:%i %p') as submitted_time,
        ats.outside_window,
        ats.hod_confirmed,
        u_fac.full_name as faculty_name,
        u_fac.login_id  as faculty_login,
        s.name as subject_name,
        s.code as subject_code,
        fa.year, fa.section,
        COUNT(DISTINCT a.student_id) as student_count,
        cp.window_open_before,
        cp.window_close_after,
        TIMESTAMPDIFF(
          MINUTE,
          TIMESTAMP(ats.session_date, ats.start_time),
          ats.created_at
        ) as mins_from_start
      FROM attendance_sessions ats
      JOIN faculty_assignments fa ON fa.id = ats.assignment_id
      JOIN subjects s ON s.id = fa.subject_id
      JOIN users u_fac ON u_fac.id = ats.faculty_id
      LEFT JOIN attendance a ON a.assignment_id = ats.assignment_id AND a.date = ats.session_date
      LEFT JOIN class_periods cp ON cp.department_id = fa.department_id AND cp.period_number = ats.period_number
      WHERE fa.department_id = ?
        AND ats.outside_window = 1
      GROUP BY ats.id
      ORDER BY ats.hod_confirmed ASC, ats.created_at DESC
      LIMIT 200
    `, [req.user.department_id]);
        res.json({ audit: rows });
    } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_FIELD_ERROR') {
            return res.json({ audit: [] });
        }
        console.error('HOD audit error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/hod/attendance/audit/confirm/:sessionId — HOD confirms an outside-window session
router.patch('/attendance/audit/confirm/:sessionId', async (req, res) => {
    try {
        const sessionId = parseInt(req.params.sessionId);

        // Ensure it belongs to this HOD's department
        const [rows] = await db.query(`
      SELECT ats.id FROM attendance_sessions ats
      JOIN faculty_assignments fa ON fa.id = ats.assignment_id
      WHERE ats.id = ? AND fa.department_id = ? AND ats.outside_window = 1
    `, [sessionId, req.user.department_id]);

        if (rows.length === 0) return res.status(404).json({ error: 'Session not found or already in-window' });

        await db.query(
            'UPDATE attendance_sessions SET hod_confirmed = 1 WHERE id = ?',
            [sessionId]
        );

        res.json({ message: 'Attendance confirmed — it will now count in calculations.' });
    } catch (err) {
        console.error('HOD confirm error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/hod/marks/summary
router.get('/marks/summary', async (req, res) => {
    try {
        const [rows] = await db.query(`
      SELECT s.id as subject_id, s.name as subject_name, s.code,
        m.exam_type, m.exam_label,
        sp.\`year\` AS year, sp.section AS section,
        ROUND(AVG(m.marks_obtained), 2) as avg_marks,
        MAX(m.max_marks) as max_marks,
        COUNT(*) as entries
      FROM marks m
      JOIN subjects s ON m.subject_id = s.id
      JOIN users u ON u.id = m.student_id
      JOIN student_profiles sp ON sp.user_id = u.id
      WHERE s.department_id = ?
      GROUP BY m.subject_id, m.exam_type, m.exam_label, sp.\`year\`, sp.section
      ORDER BY s.name, sp.\`year\`, sp.section, m.exam_type
    `, [req.user.department_id]);
        res.json({ summary: rows });
    } catch (err) {
        console.error('HOD marks summary error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/hod/marks/detail?subject_id=&exam_label= — per-student detail for HOD drill-down
router.get('/marks/detail', async (req, res) => {
    try {
        const { subject_id, exam_label } = req.query;
        if (!subject_id || !exam_label) return res.status(400).json({ error: 'subject_id and exam_label required' });
        const [rows] = await db.query(`
            SELECT m.id, m.marks_obtained, m.max_marks, m.exam_type, m.exam_label,
                   u.full_name, sp.roll_number
            FROM marks m
            JOIN subjects s ON m.subject_id = s.id
            JOIN users u ON m.student_id = u.id
            JOIN student_profiles sp ON sp.user_id = u.id
            WHERE m.subject_id = ?
              AND m.exam_label = ?
              AND s.department_id = ?
            ORDER BY sp.roll_number
        `, [subject_id, exam_label, req.user.department_id]);
        res.json({ marks: rows });
    } catch (err) {
        console.error('HOD marks detail error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/hod/marks/lock/:subjectId
router.patch('/marks/lock/:subjectId', async (req, res) => {
    try {
        await db.query('UPDATE marks SET locked = TRUE WHERE subject_id = ? AND exam_type = "external"', [req.params.subjectId]);
        res.json({ message: 'External marks locked' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/hod/marks/publish/:subjectId
router.patch('/marks/publish/:subjectId', async (req, res) => {
    try {
        await db.query('UPDATE marks SET is_published = TRUE WHERE subject_id = ?', [req.params.subjectId]);

        // Trigger GPA computation for published marks
        const { computeGrade, computeSGPA } = require('../utils/gpa');
        const [marksData] = await db.query(`
      SELECT m.student_id, m.subject_id, s.credits,
        SUM(m.marks_obtained) as total_obtained, SUM(m.max_marks) as total_max
      FROM marks m JOIN subjects s ON m.subject_id = s.id
      WHERE m.subject_id = ? AND m.is_published = TRUE
      GROUP BY m.student_id, m.subject_id
    `, [req.params.subjectId]);

        const [ay] = await db.query('SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1');
        const ayId = ay.length > 0 ? ay[0].id : 1;

        for (const row of marksData) {
            const pct = (row.total_obtained / row.total_max) * 100;
            const grade = computeGrade(pct);
            await db.query(
                `INSERT INTO grades (student_id, subject_id, academic_year_id, semester, grade_letter, grade_points)
         VALUES (?, ?, ?, (SELECT semester FROM subjects WHERE id=?), ?, ?)
         ON DUPLICATE KEY UPDATE grade_letter=VALUES(grade_letter), grade_points=VALUES(grade_points), computed_at=NOW()`,
                [row.student_id, row.subject_id, ayId, row.subject_id, grade.letter, grade.points]
            );
        }

        res.json({ message: 'Marks published and grades computed' });
    } catch (err) {
        console.error('Publish marks error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/hod/faculty-leaves
router.get('/faculty-leaves', async (req, res) => {
    try {
        const [rows] = await db.query(`
      SELECT fl.*, u.full_name as faculty_name, u.login_id
      FROM faculty_leaves fl
      JOIN users u ON fl.faculty_id = u.id
      WHERE fl.hod_id = ?
      ORDER BY fl.created_at DESC
    `, [req.user.id]);
        res.json({ leaves: rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/hod/faculty-leaves/:id
router.patch('/faculty-leaves/:id', async (req, res) => {
    try {
        const { status, remarks } = req.body;
        await db.query('UPDATE faculty_leaves SET status=?, remarks=?, updated_at=NOW() WHERE id=? AND hod_id=?',
            [status, remarks, req.params.id, req.user.id]);

        // Notify faculty
        const [leave] = await db.query('SELECT faculty_id FROM faculty_leaves WHERE id=?', [req.params.id]);
        if (leave.length > 0) {
            const { sendNotification } = require('../utils/notificationService');
            await sendNotification({
                recipient_id: leave[0].faculty_id,
                title: `Leave ${status}`,
                message: `Your leave request has been ${status}. ${remarks || ''}`,
                type: 'leave',
                sender_role: req.user.role,
                sender_id: req.user.id,
                target_url: `/faculty/my-leaves`
            });
        }

        res.json({ message: `Leave ${status}` });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/hod/notices
router.post('/notices', async (req, res) => {
    try {
        const { title, body, target_role, target_year, target_section, priority, category } = req.body;
        const role = target_role || 'all';
        const [result] = await db.query(
            `INSERT INTO notices (title, body, created_by, target_role, target_department_id, target_year, target_section, priority, category)
       VALUES (?,?,?,?,?,?,?,?,?)`,
            [title, body, req.user.id, role, req.user.department_id, target_year, target_section, priority || 'general', category || 'academic']
        );
        const noticeId = result.insertId;

        // Fan-out to notifications table so bell icon shows the notice
        try {
            const { notifyStudentsInDept, notifyFacultyInDept, notifyAll } = require('../utils/notificationService');
            const notifMsg = body?.substring(0, 120) || '';
            if (role === 'student') {
                await notifyStudentsInDept({ deptId: req.user.department_id, year: target_year || null, section: target_section || null, title, message: notifMsg, type: 'notice', referenceId: noticeId });
            } else if (role === 'faculty') {
                await notifyFacultyInDept({ deptId: req.user.department_id, title, message: notifMsg, type: 'notice', referenceId: noticeId });
            } else {
                // 'all' — notify both students and faculty in this department
                await notifyStudentsInDept({ deptId: req.user.department_id, year: target_year || null, section: target_section || null, title, message: notifMsg, type: 'notice', referenceId: noticeId });
                await notifyFacultyInDept({ deptId: req.user.department_id, title, message: notifMsg, type: 'notice', referenceId: noticeId });
            }
        } catch (_e) { /* notification fan-out is non-critical */ }

        res.status(201).json({ message: 'Notice posted', id: noticeId });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/hod/notices
router.get('/notices', async (req, res) => {
    try {
        const [rows] = await db.query(`
      SELECT n.*, 
        (SELECT COUNT(*) FROM notice_reads WHERE notice_id = n.id) as read_count
      FROM notices n
      WHERE n.created_by = ? OR n.target_department_id = ? OR n.target_department_id IS NULL
      ORDER BY n.created_at DESC
    `, [req.user.id, req.user.department_id]);
        res.json({ notices: rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Calendar
router.get('/calendar', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM calendar_events WHERE department_id = ? OR department_id IS NULL ORDER BY event_date',
            [req.user.department_id]
        );
        res.json({ events: rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/calendar', async (req, res) => {
    try {
        const { title, description, event_type, event_date, end_date, year, section } = req.body;
        const [result] = await db.query(
            `INSERT INTO calendar_events (title, description, event_type, event_date, end_date, created_by, department_id, year, section)
       VALUES (?,?,?,?,?,?,?,?,?)`,
            [title, description, event_type, event_date, end_date, req.user.id, req.user.department_id, year, section]
        );
        res.status(201).json({ message: 'Event created', id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/hod/subjects
router.get('/subjects', async (req, res) => {
    try {
        const { year } = req.query;
        let queryStr = 'SELECT * FROM subjects WHERE department_id = ?';
        const params = [req.user.department_id];

        if (year && year !== 'all') {
            queryStr += ' AND academic_year = ?';
            params.push(parseInt(year));
        }

        queryStr += ' ORDER BY academic_year, semester, name';

        const [rows] = await db.query(queryStr, params);
        res.json({ subjects: rows });
    } catch (err) {
        console.error('GET subjects error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/hod/subjects
router.post('/subjects', async (req, res) => {
    try {
        const { name, code, semester, credits, academic_year } = req.body;
        if (!name || !code || !semester || !academic_year) {
            return res.status(400).json({ error: 'Name, code, semester, and academic year are required' });
        }
        
        const yearInt = parseInt(academic_year);
        if (![1, 2, 3, 4].includes(yearInt)) {
            return res.status(400).json({ error: 'Academic year must be 1, 2, 3, or 4' });
        }

        const [result] = await db.query(
            'INSERT INTO subjects (name, code, department_id, semester, credits, academic_year) VALUES (?,?,?,?,?,?)',
            [name, code, req.user.department_id, semester, credits || 3, yearInt]
        );

        try {
            const { notifyStudentsInDept } = require('../utils/notificationService');
            await notifyStudentsInDept({
                deptId: req.user.department_id,
                year: yearInt,
                title: 'New Subject Added',
                message: `A new subject "${name}" (${code}) has been added to your curriculum for Sem ${semester}.`,
                type: 'academic',
                target_url: `/student/marks`
            });
        } catch (notifErr) {
            console.error('Subject addition notification failed:', notifErr);
        }

        res.status(201).json({ message: 'Subject created', id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Subject code exists' });
        console.error('POST subjects error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/hod/assignments — List all faculty assignments
router.get('/assignments', async (req, res) => {
    try {
        const [rows] = await db.query(`
      SELECT fa.*, s.name as subject_name, s.code as subject_code, 
             u.full_name as faculty_name, u.login_id as faculty_login
      FROM faculty_assignments fa
      JOIN subjects s ON fa.subject_id = s.id
      JOIN users u ON fa.faculty_id = u.id
      WHERE fa.department_id = ?
      ORDER BY fa.year, fa.section, s.name
    `, [req.user.department_id]);

        // Group rows by Year -> Section
        const grouped = {};
        rows.forEach(r => {
            const yearStr = r.year === 1 ? '1st Year' : r.year === 2 ? '2nd Year' : r.year === 3 ? '3rd Year' : '4th Year';
            const secKey = `Section ${r.section}`;

            if (!grouped[yearStr]) {
                grouped[yearStr] = {};
            }
            if (!grouped[yearStr][secKey]) {
                grouped[yearStr][secKey] = {
                    class_teacher: null,
                    subjects: []
                };
            }

            if (r.is_class_teacher) {
                grouped[yearStr][secKey].class_teacher = {
                    id: r.faculty_id,
                    name: r.faculty_name,
                    login_id: r.faculty_login
                };
            }

            grouped[yearStr][secKey].subjects.push({
                id: r.id,
                subject: r.subject_name,
                subject_code: r.subject_code,
                faculty: r.faculty_name,
                faculty_login: r.faculty_login,
                is_class_teacher: r.is_class_teacher
            });
        });

        res.json({ assignments: grouped, raw: rows });
    } catch (err) {
        console.error('GET assignments error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/hod/assignments — Assign faculty to subject/section
router.post('/assignments', async (req, res) => {
    try {
        const { faculty_id, subject_id, section, academic_year_id, is_class_teacher } = req.body;
        const yearVal = req.body.academic_year || req.body.year;

        if (!faculty_id || !subject_id || !yearVal || !section) {
            return res.status(400).json({ error: 'Faculty, subject, year, and section are required' });
        }

        // Find active academic year ID if not provided
        let ayId = academic_year_id;
        if (!ayId) {
            const [ayRows] = await db.query('SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1');
            ayId = ayRows.length > 0 ? ayRows[0].id : 1;
        }

        // If is_class_teacher is true, reset all other assignments in this year/section
        if (is_class_teacher) {
            await db.query(
                `UPDATE faculty_assignments 
                 SET is_class_teacher = FALSE 
                 WHERE department_id = ? AND year = ? AND section = ?`,
                [req.user.department_id, yearVal, section]
            );
        }

        const [result] = await db.query(
            `INSERT INTO faculty_assignments (faculty_id, subject_id, department_id, year, section, academic_year_id, is_class_teacher)
             VALUES (?,?,?,?,?,?,?)`,
            [faculty_id, subject_id, req.user.department_id, yearVal, section, ayId, is_class_teacher || false]
        );

        try {
            const [subRows] = await db.query('SELECT name, code FROM subjects WHERE id = ?', [subject_id]);
            const subjectName = subRows[0]?.name || 'a subject';
            const { sendNotification, notifyStudentsInDept } = require('../utils/notificationService');
            
            // Notify faculty
            await sendNotification({
                recipient_id: faculty_id,
                title: 'New Class Assigned',
                message: `You have been assigned to teach "${subjectName}" for Year ${yearVal} - Section ${section}.` + 
                         (is_class_teacher ? ' You are also designated as the Class Teacher.' : ''),
                type: 'academic',
                sender_role: req.user.role,
                sender_id: req.user.id,
                target_url: `/faculty/timetable`
            });

            // Notify students
            await notifyStudentsInDept({
                deptId: req.user.department_id,
                year: yearVal,
                section,
                title: is_class_teacher ? 'New Class Teacher Appointed' : 'Subject Faculty Assigned',
                message: is_class_teacher 
                    ? `A new Class Teacher has been appointed for your class (Year ${yearVal} - Section ${section}).`
                    : `Faculty has been assigned for subject "${subjectName}" (Year ${yearVal} - Section ${section}).`,
                type: 'academic',
                target_url: `/student/timetable`
            });
        } catch (notifErr) {
            console.error('Assignment notification failed:', notifErr);
        }

        res.status(201).json({ message: 'Assignment created', id: result.insertId });
    } catch (err) {
        console.error('POST assignments error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/hod/assignments/:id
router.delete('/assignments/:id', async (req, res) => {
    try {
        // Verify assignment belongs to this HOD's department
        const [asgn] = await db.query('SELECT * FROM faculty_assignments WHERE id=? AND department_id=?',
            [req.params.id, req.user.department_id]);
        if (asgn.length === 0) return res.status(404).json({ error: 'Assignment not found' });

        // Delete dependent rows to avoid FK constraint failures
        await db.query('DELETE FROM attendance WHERE assignment_id=?', [req.params.id]);
        await db.query('DELETE FROM timetable WHERE assignment_id=?', [req.params.id]);

        // Now safe to delete the assignment
        await db.query('DELETE FROM faculty_assignments WHERE id=? AND department_id=?',
            [req.params.id, req.user.department_id]);
        res.json({ message: 'Assignment removed' });
    } catch (err) {
        console.error('Delete assignment error:', err);
        res.status(500).json({ error: 'Failed to remove assignment: ' + err.message });
    }
});

// ─── HOD PLACEMENT ROUTES ─────────────────────────────────────────────────────
// HOD can post jobs visible only to their department students.
// Principal jobs (department_id IS NULL) are visible to all.

async function ensurePlacementColumns() {
    // Add posted_by_role and department_id columns if not present (safe migration)
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

// GET /api/hod/placements — all jobs visible to this HOD's dept (own dept + principal's)
router.get('/placements', async (req, res) => {
    try {
        await ensurePlacementColumns();
        const deptId = req.user.department_id;
        const [rows] = await db.query(`
            SELECT pj.*, u.full_name as posted_by_name
            FROM placement_jobs pj
            LEFT JOIN users u ON pj.created_by = u.id
            WHERE pj.department_id IS NULL OR pj.department_id = ?
            ORDER BY pj.created_at DESC
        `, [deptId]);
        const jobs = rows.map(j => ({
            ...j,
            eligible_years: typeof j.eligible_years === 'string' ? JSON.parse(j.eligible_years) : (j.eligible_years || []),
            eligible_departments: typeof j.eligible_departments === 'string' ? JSON.parse(j.eligible_departments) : (j.eligible_departments || []),
        }));
        res.json({ jobs });
    } catch (err) {
        console.error('HOD placements error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/hod/placements — create job for own department only
router.post('/placements', async (req, res) => {
    try {
        await ensurePlacementColumns();
        const { company, role, description, min_cgpa, eligible_years, eligible_years_all,
            openings, open_date, close_date, apply_link, contact_email, status } = req.body;
        if (!company || !role) return res.status(400).json({ error: 'Company and role are required' });

        const deptId = req.user.department_id;
        // HOD jobs are always scoped to their department
        const [result] = await db.query(
            `INSERT INTO placement_jobs
             (company, role, description, min_cgpa, eligible_years, eligible_departments,
              openings, open_date, close_date, apply_link, contact_email, status, created_by, posted_by_role, department_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'hod', ?)`,
            [
                company, role, description || null,
                min_cgpa || 6.0,
                JSON.stringify(eligible_years || [1, 2, 3, 4]),
                JSON.stringify([]),   // dept eligibility is implicit (department_id column handles it)
                openings || 1,
                open_date || null, close_date || null,
                apply_link || null, contact_email || null,
                status || 'Active',
                req.user.id,
                deptId,
            ]
        );
        try {
            const { sendNotification } = require('../utils/notificationService');
            await sendNotification({
                recipient_role: 'student',
                department_id: deptId,
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
        console.error('HOD create placement error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/hod/placements/:id — update own dept's job only
router.put('/placements/:id', async (req, res) => {
    try {
        const deptId = req.user.department_id;
        const [existing] = await db.query(
            'SELECT id FROM placement_jobs WHERE id = ? AND department_id = ?', [req.params.id, deptId]
        );
        if (existing.length === 0) return res.status(404).json({ error: 'Job not found or not yours' });

        const { company, role, description, min_cgpa, eligible_years,
            openings, open_date, close_date, apply_link, contact_email, status } = req.body;
        await db.query(
            `UPDATE placement_jobs SET
              company = COALESCE(?, company), role = COALESCE(?, role),
              description = ?, min_cgpa = COALESCE(?, min_cgpa),
              eligible_years = COALESCE(?, eligible_years),
              openings = COALESCE(?, openings),
              open_date = ?, close_date = ?, apply_link = ?, contact_email = ?,
              status = COALESCE(?, status)
             WHERE id = ?`,
            [
                company, role, description || null, min_cgpa,
                eligible_years ? JSON.stringify(eligible_years) : null,
                openings, open_date || null, close_date || null,
                apply_link || null, contact_email || null, status, req.params.id,
            ]
        );
        res.json({ message: 'Job updated' });
    } catch (err) {
        console.error('HOD update placement error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/hod/placements/:id — delete own dept's job only
router.delete('/placements/:id', async (req, res) => {
    try {
        const deptId = req.user.department_id;
        const [existing] = await db.query(
            'SELECT id FROM placement_jobs WHERE id = ? AND department_id = ?', [req.params.id, deptId]
        );
        if (existing.length === 0) return res.status(404).json({ error: 'Job not found or not yours' });
        await db.query('DELETE FROM placement_jobs WHERE id = ?', [req.params.id]);
        res.json({ message: 'Job deleted' });
    } catch (err) {
        console.error('HOD delete placement error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});



// ─── ACADEMIC CALENDAR (Working Day Registry) ─────────────────────────────────

// GET /api/hod/academic-calendar
router.get('/academic-calendar', async (req, res) => {
    try {
        const { month, year: yearParam, academic_year_id } = req.query;
        let sql = `
            SELECT ac.id, ac.department_id, ac.academic_year_id,
                   DATE_FORMAT(ac.calendar_date, '%Y-%m-%d') AS calendar_date,
                   ac.day_type, ac.label, ac.classes_count, ac.created_by,
                   ac.updated_at, u.full_name AS updated_by_name
            FROM academic_calendar ac
            LEFT JOIN users u ON u.id = ac.created_by
            WHERE ac.department_id = ?
        `;
        const params = [req.user.department_id];

        if (academic_year_id) { sql += ' AND ac.academic_year_id = ?'; params.push(academic_year_id); }
        if (month && yearParam) {
            sql += ' AND MONTH(ac.calendar_date) = ? AND YEAR(ac.calendar_date) = ?';
            params.push(month, yearParam);
        }
        sql += ' ORDER BY ac.calendar_date';

        const [rows] = await db.query(sql, params);
        res.json({ calendar: rows });
    } catch (err) {
        console.error('Get academic calendar error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// POST /api/hod/academic-calendar — Add or bulk-init calendar dates
// Body: { academic_year_id, start_date, end_date, weekends: ['Saturday','Sunday'] }
// OR single: { academic_year_id, calendar_date, day_type, label }
router.post('/academic-calendar', async (req, res) => {
    try {
        const { academic_year_id, calendar_date, day_type, label, start_date, end_date, weekends } = req.body;
        const deptId = req.user.department_id;

        // Bulk initialization mode
        if (start_date && end_date) {
            if (!academic_year_id) return res.status(400).json({ error: 'academic_year_id required' });
            // Parse start/end directly to avoid UTC timezone shift (IST is UTC+05:30)
            const [sy, sm, sd] = start_date.split('-').map(Number);
            const [ey, em, ed] = end_date.split('-').map(Number);
            const current = new Date(sy, sm - 1, sd);   // local midnight
            const end = new Date(ey, em - 1, ed);        // local midnight
            let inserted = 0;

            while (current <= end) {
                const dow = current.getDay(); // 0=Sun, 6=Sat
                let isHoliday = false;

                if (dow === 0) {
                    // All Sundays are holidays
                    isHoliday = true;
                } else if (dow === 6) {
                    // Only 2nd and 4th Saturdays are holidays
                    // Math.ceil(date / 7) gives which Saturday of the month (1st, 2nd, 3rd, 4th, 5th)
                    const whichSaturday = Math.ceil(current.getDate() / 7);
                    isHoliday = (whichSaturday === 2 || whichSaturday === 4);
                }
                // Mon–Fri and 1st/3rd/5th Saturdays → working

                // Build local date string without UTC conversion
                const y = current.getFullYear();
                const m = String(current.getMonth() + 1).padStart(2, '0');
                const d = String(current.getDate()).padStart(2, '0');
                const dateStr = `${y}-${m}-${d}`;
                await db.query(
                    `INSERT INTO academic_calendar (department_id, academic_year_id, calendar_date, day_type, created_by)
                     VALUES (?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE day_type = VALUES(day_type)`,
                    [deptId, academic_year_id, dateStr, isHoliday ? 'holiday' : 'working', req.user.id]
                );
                inserted++;
                current.setDate(current.getDate() + 1);
            }
            return res.status(201).json({ message: `Calendar initialized: ${inserted} dates`, inserted });
        }

        // Single date insertion
        if (!calendar_date || !academic_year_id) {
            return res.status(400).json({ error: 'calendar_date and academic_year_id required' });
        }
        await db.query(
            `INSERT INTO academic_calendar (department_id, academic_year_id, calendar_date, day_type, label, created_by)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE day_type = VALUES(day_type), label = VALUES(label)`,
            [deptId, academic_year_id, calendar_date, day_type || 'working', label || null, req.user.id]
        );
        res.status(201).json({ message: 'Calendar entry created' });
    } catch (err) {
        console.error('Create calendar entry error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/hod/academic-calendar/:id
router.patch('/academic-calendar/:id', async (req, res) => {
    try {
        const { day_type, label, classes_count } = req.body;
        // Verify this entry belongs to HOD's dept
        const [entry] = await db.query(
            'SELECT id FROM academic_calendar WHERE id = ? AND department_id = ?',
            [req.params.id, req.user.department_id]
        );
        if (!entry.length) return res.status(404).json({ error: 'Calendar entry not found' });

        await db.query(
            'UPDATE academic_calendar SET day_type = COALESCE(?, day_type), label = COALESCE(?, label), classes_count = COALESCE(?, classes_count) WHERE id = ?',
            [day_type, label, classes_count, req.params.id]
        );

        // Log to audit_logs
        await db.query(
            'INSERT INTO audit_logs (user_id, action, table_affected, record_id, details) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'UPDATE_CALENDAR', 'academic_calendar', req.params.id, JSON.stringify({ day_type, label })]
        );

        res.json({ message: 'Calendar entry updated' });
    } catch (err) {
        console.error('Update calendar error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/hod/academic-calendar/:id
router.delete('/academic-calendar/:id', async (req, res) => {
    try {
        const [entry] = await db.query(
            'SELECT id FROM academic_calendar WHERE id = ? AND department_id = ?',
            [req.params.id, req.user.department_id]
        );
        if (!entry.length) return res.status(404).json({ error: 'Calendar entry not found' });

        await db.query('DELETE FROM academic_calendar WHERE id = ?', [req.params.id]);
        res.json({ message: 'Calendar entry deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── DEPARTMENT ANALYTICS ─────────────────────────────────────────────────────

// GET /api/hod/analytics
router.get('/analytics', async (req, res) => {
    try {
        const deptId = req.user.department_id;

        // Students breakdown by year & section
        const [breakdown] = await db.query(`
            SELECT sp.year, sp.section, COUNT(*) AS student_count
            FROM student_profiles sp
            JOIN users u ON u.id = sp.user_id
            WHERE sp.department_id = ? AND u.is_active = TRUE
            GROUP BY sp.year, sp.section
            ORDER BY sp.year, sp.section
        `, [deptId]);

        // Attendance rate per subject
        const [attBySubject] = await db.query(`
            SELECT s.name AS subject_name, s.code,
                COUNT(*) AS total_records,
                SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) AS present_count,
                ROUND(SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS avg_pct
            FROM attendance a
            JOIN faculty_assignments fa ON fa.id = a.assignment_id
            JOIN subjects s             ON s.id = fa.subject_id
            WHERE fa.department_id = ?
            GROUP BY fa.subject_id
            ORDER BY avg_pct ASC
        `, [deptId]);

        // Leave stats this month
        const [leaveStats] = await db.query(`
            SELECT
                SUM(CASE WHEN sl.status = 'pending'  THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN sl.status = 'approved' THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN sl.status = 'rejected' THEN 1 ELSE 0 END) AS rejected
            FROM student_leaves sl
            JOIN users u ON sl.student_id = u.id
            WHERE u.department_id = ? AND MONTH(sl.created_at) = MONTH(CURDATE())
        `, [deptId]);

        // Count cross-dept faculty assigned to this dept
        const [crossDept] = await db.query(`
            SELECT COUNT(DISTINCT fa.faculty_id) AS cross_dept_faculty
            FROM faculty_assignments fa
            JOIN users u ON u.id = fa.faculty_id
            WHERE fa.department_id = ? AND u.department_id != ?
        `, [deptId, deptId]);

        res.json({
            student_breakdown: breakdown,
            attendance_by_subject: attBySubject,
            leave_stats: leaveStats[0],
            cross_dept_faculty_count: crossDept[0].cross_dept_faculty
        });
    } catch (err) {
        console.error('HOD analytics error:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

// ─── CLASS PERIODS (HOD configures daily class schedule) ─────────────────────

// GET /api/hod/periods
router.get('/periods', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM class_periods WHERE department_id = ? ORDER BY period_number',
            [req.user.department_id]
        );
        res.json({ periods: rows });
    } catch (err) {
        console.error('Get periods error:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

// POST /api/hod/periods — Create or upsert a period
router.post('/periods', async (req, res) => {
    try {
        const { period_number, label, start_time, end_time, window_open_before, window_close_after } = req.body;
        if (!period_number || !start_time || !end_time) {
            console.error('Create period validation failed. Body:', req.body);
            return res.status(400).json({ error: 'period_number, start_time, end_time required' });
        }
        console.log('Inserting period:', req.body);
        const [result] = await db.query(
            `INSERT INTO class_periods (department_id, period_number, label, start_time, end_time, window_open_before, window_close_after)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               label = VALUES(label),
               start_time = VALUES(start_time),
               end_time = VALUES(end_time),
               window_open_before = VALUES(window_open_before),
               window_close_after = VALUES(window_close_after),
               is_active = TRUE`,
            [req.user.department_id, period_number, label || `Period ${period_number}`,
             start_time, end_time,
             window_open_before ?? 5, window_close_after ?? 10]
        );
        res.status(201).json({ message: 'Period saved', id: result.insertId || null });
    } catch (err) {
        console.error('Create period error SQL details:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

// PATCH /api/hod/periods/:id
router.patch('/periods/:id', async (req, res) => {
    try {
        const { label, start_time, end_time, window_open_before, window_close_after, is_active } = req.body;
        const [existing] = await db.query(
            'SELECT id FROM class_periods WHERE id = ? AND department_id = ?',
            [req.params.id, req.user.department_id]
        );
        if (!existing.length) return res.status(404).json({ error: 'Period not found' });

        await db.query(
            `UPDATE class_periods
             SET label = COALESCE(?, label),
                 start_time = COALESCE(?, start_time),
                 end_time = COALESCE(?, end_time),
                 window_open_before = COALESCE(?, window_open_before),
                 window_close_after = COALESCE(?, window_close_after),
                 is_active = COALESCE(?, is_active)
             WHERE id = ?`,
            [label, start_time, end_time, window_open_before, window_close_after, is_active, req.params.id]
        );
        res.json({ message: 'Period updated' });
    } catch (err) {
        console.error('Update period error:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

// DELETE /api/hod/periods/:id
router.delete('/periods/:id', async (req, res) => {
    try {
        const [existing] = await db.query(
            'SELECT id FROM class_periods WHERE id = ? AND department_id = ?',
            [req.params.id, req.user.department_id]
        );
        if (!existing.length) return res.status(404).json({ error: 'Period not found' });
        await db.query('DELETE FROM class_periods WHERE id = ?', [req.params.id]);
        res.json({ message: 'Period deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── HOD TIMETABLE (JSON blob store) ──────────────────────────────────────────
// GET /api/hod/timetable?year=1&section=A
router.get('/timetable', async (req, res) => {
    try {
        const { year, section } = req.query;
        if (!year || !section) return res.status(400).json({ error: 'year and section are required' });
        const [rows] = await db.query(
            'SELECT slots_json FROM hod_timetables WHERE department_id = ? AND year = ? AND section = ?',
            [req.user.department_id, year, section]
        );
        if (rows.length === 0) return res.json({ timetable: null });
        const slots = typeof rows[0].slots_json === 'string'
            ? JSON.parse(rows[0].slots_json)
            : rows[0].slots_json;
        res.json({ timetable: slots });
    } catch (err) {
        console.error('GET timetable error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/hod/timetable  — upsert timetable for a year/section
// Body: { year, section, slots }   where slots is the dayData object
router.post('/timetable', async (req, res) => {
    try {
        const { year, section, slots } = req.body;
        if (!year || !section || slots === undefined) {
            return res.status(400).json({ error: 'year, section, and slots are required' });
        }
        await db.query(
            `INSERT INTO hod_timetables (department_id, year, section, slots_json, updated_at)
             VALUES (?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE slots_json = VALUES(slots_json), updated_at = NOW()`,
            [req.user.department_id, year, section, JSON.stringify(slots)]
        );

        try {
            const { notifyStudentsInDept } = require('../utils/notificationService');
            await notifyStudentsInDept({
                deptId: req.user.department_id,
                year,
                section,
                title: 'Timetable Updated',
                message: `Your class timetable for Year ${year} - Section ${section} has been updated by the HOD.`,
                type: 'academic',
                target_url: `/student/timetable`
            });
        } catch (notifErr) {
            console.error('Timetable notification failed:', notifErr);
        }

        res.json({ message: 'Timetable saved' });
    } catch (err) {
        console.error('POST timetable error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── GET /api/hod/attendance/period-locks?date= ──────────────────────────────
// Returns ALL locked attendance sessions for a given date in the HOD's department
router.get('/attendance/period-locks', async (req, res) => {
    try {
        const deptId = req.user.department_id;
        const date = req.query.date || new Date().toLocaleDateString('en-CA');
        const [rows] = await db.query(`
            SELECT
                ats.id            AS session_id,
                ats.session_date,
                ats.period_number,
                ats.year,
                ats.section,
                ats.outside_window,
                ats.hod_confirmed,
                TIME_FORMAT(ats.start_time, '%h:%i %p') AS period_start,
                TIME_FORMAT(ats.end_time,   '%h:%i %p') AS period_end,
                DATE_FORMAT(ats.created_at, '%h:%i %p') AS locked_at,
                u.full_name   AS faculty_name,
                u.login_id    AS faculty_login,
                s.name        AS subject_name,
                s.code        AS subject_code,
                SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present_count,
                SUM(CASE WHEN a.status = 'absent'  THEN 1 ELSE 0 END) AS absent_count,
                COUNT(a.id)   AS total_students
            FROM attendance_sessions ats
            JOIN faculty_assignments fa ON fa.id = ats.assignment_id
            JOIN subjects            s  ON s.id  = fa.subject_id
            JOIN users               u  ON u.id  = ats.faculty_id
            LEFT JOIN attendance     a  ON a.assignment_id = ats.assignment_id
                                       AND a.date = ats.session_date
            WHERE ats.department_id = ?
              AND DATE_FORMAT(ats.session_date, '%Y-%m-%d') = ?
            GROUP BY ats.id
            ORDER BY ats.year, ats.section, ats.period_number
        `, [deptId, date]);
        res.json({ locks: rows, date });
    } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ locks: [], date: req.query.date });
        console.error('HOD period-locks error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── DELETE /api/hod/attendance/period-locks/:sessionId ──────────────────────
// Unlock a period: removes the session and all its attendance records for that date
router.delete('/attendance/period-locks/:sessionId', async (req, res) => {
    try {
        const deptId = req.user.department_id;
        const { sessionId } = req.params;

        // Verify session belongs to HOD's department
        const [sess] = await db.query(
            'SELECT * FROM attendance_sessions WHERE id = ? AND department_id = ?',
            [sessionId, deptId]
        );
        if (sess.length === 0) return res.status(403).json({ error: 'Session not found or not in your department' });

        const s = sess[0];

        // Delete attendance records for that assignment on that date
        await db.query(
            'DELETE FROM attendance WHERE assignment_id = ? AND date = ?',
            [s.assignment_id, s.session_date]
        ).catch(() => {});

        // Delete the session itself
        await db.query('DELETE FROM attendance_sessions WHERE id = ?', [sessionId]);

        res.json({ message: 'Period unlocked successfully', session_id: sessionId });
    } catch (err) {
        console.error('HOD unlock period error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── GET /api/hod/attendance/today-status ────────────────────────────────────
// Returns all period slots for today across all sections in the HOD's department
// along with lock status (locked / pending / free based on timetable)
router.get('/attendance/today-status', async (req, res) => {
    try {
        const deptId = req.user.department_id;
        const today  = new Date().toLocaleDateString('en-CA');
        const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const todayDay = dayNames[new Date().getDay()];

        // 1. Get all class periods for this dept
        const [periods] = await db.query(
            `SELECT id, period_number, start_time, end_time FROM class_periods
             WHERE department_id = ? ORDER BY period_number`, [deptId]
        ).catch(() => [[]]);

        // 2. Get all sections in this dept
        const [sections] = await db.query(
            `SELECT DISTINCT year, section FROM student_profiles
             WHERE department_id = ? ORDER BY year, section`, [deptId]
        );

        // 3. Get timetable entries for today (to know subject+faculty per slot)
        const [ttSlots] = await db.query(`
            SELECT t.year, t.section, fa.id AS assignment_id,
                   s.name AS subject_name, u.full_name AS faculty_name,
                   cp.period_number, cp.start_time, cp.end_time
            FROM timetable t
            JOIN faculty_assignments fa ON fa.id = t.assignment_id
            JOIN subjects            s  ON s.id  = fa.subject_id
            JOIN users               u  ON u.id  = fa.faculty_id
            JOIN class_periods       cp ON cp.department_id = fa.department_id
                                       AND cp.period_number = t.period_number
            WHERE fa.department_id = ?
              AND t.day_of_week = ?
        `, [deptId, todayDay]).catch(() => [[]]);

        // 4. Get already-locked sessions for today
        const [locked] = await db.query(`
            SELECT ats.id AS session_id, ats.year, ats.section, ats.period_number,
                   ats.outside_window, u.full_name AS locked_by,
                   DATE_FORMAT(ats.created_at, '%h:%i %p') AS locked_at,
                   SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) AS present_count,
                   SUM(CASE WHEN a.status='absent'  THEN 1 ELSE 0 END) AS absent_count
            FROM attendance_sessions ats
            JOIN users u ON u.id = ats.faculty_id
            LEFT JOIN attendance a ON a.assignment_id = ats.assignment_id
                                  AND a.date = ats.session_date
            WHERE ats.department_id = ?
              AND DATE_FORMAT(ats.session_date,'%Y-%m-%d') = ?
            GROUP BY ats.id
        `, [deptId, today]).catch(() => [[]]);

        // Build lock lookup: "year|section|period_number" -> lock info
        const lockMap = {};
        locked.forEach(l => { lockMap[`${l.year}|${l.section}|${l.period_number}`] = l; });

        // Build timetable lookup
        const ttMap = {};
        ttSlots.forEach(t => { ttMap[`${t.year}|${t.section}|${t.period_number}`] = t; });

        // 5. Assemble rows
        const rows = [];
        for (const sec of sections) {
            for (const p of periods) {
                const key  = `${sec.year}|${sec.section}|${p.period_number}`;
                const lock = lockMap[key];
                const tt   = ttMap[key];
                rows.push({
                    year:         sec.year,
                    section:      sec.section,
                    period_number: p.period_number,
                    start_time:   p.start_time,
                    end_time:     p.end_time,
                    subject_name: tt?.subject_name  || null,
                    faculty_name: tt?.faculty_name  || null,
                    status:       lock  ? 'locked'
                                : tt   ? 'pending'
                                :        'free',
                    session_id:    lock?.session_id  || null,
                    locked_by:     lock?.locked_by   || null,
                    locked_at:     lock?.locked_at   || null,
                    present_count: lock?.present_count ?? null,
                    absent_count:  lock?.absent_count  ?? null,
                    outside_window: lock?.outside_window ?? null,
                });
            }
        }

        res.json({ status: rows, today, day: todayDay });
    } catch (err) {
        console.error('HOD today-status error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── HOD COMPLAINT PORTAL ─────────────────────────────────────────────────────

// POST /api/hod/complaint-window — HOD opens a complaint window for their department
router.post('/complaint-window', async (req, res) => {
    try {
        const { open_date, close_date } = req.body;
        if (!open_date || !close_date) return res.status(400).json({ error: 'Dates are required' });

        const [result] = await db.query(
            'INSERT INTO complaint_windows (open_date, close_date, created_by, created_by_role, department_id) VALUES (?, ?, ?, ?, ?)',
            [open_date, close_date, req.user.id, 'hod', req.user.department_id]
        );
        res.status(201).json({ message: 'Complaint window created', id: result.insertId });
    } catch (err) {
        console.error('HOD create complaint window error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/hod/complaint-windows — List HOD's own complaint windows
router.get('/complaint-windows', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT * FROM complaint_windows 
             WHERE created_by_role = 'hod' AND department_id = ? 
             ORDER BY open_date DESC`,
            [req.user.department_id]
        );
        res.json({ windows: rows });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/hod/complaints — List complaints submitted to HOD portal (dept-scoped)
router.get('/complaints', async (req, res) => {
    try {
        const { status } = req.query;
        let sql = `
            SELECT c.*,
                CASE WHEN c.is_anonymous THEN NULL ELSE u.full_name END as student_name,
                CASE WHEN c.is_anonymous THEN NULL ELSE sp.roll_number END as roll_number,
                d.name as department_name, sp.year
            FROM complaints c
            LEFT JOIN users u ON c.student_id = u.id
            LEFT JOIN student_profiles sp ON sp.user_id = c.student_id
            LEFT JOIN departments d ON sp.department_id = d.id
            WHERE c.portal_type = 'hod'
              AND sp.department_id = ?
        `;
        const params = [req.user.department_id];
        if (status) { sql += ' AND c.status = ?'; params.push(status); }
        sql += ' ORDER BY c.submitted_at DESC';

        const [rows] = await db.query(sql, params);
        res.json({ complaints: rows });
    } catch (err) {
        console.error('HOD get complaints error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/hod/complaints/:id/status — HOD updates complaint status
router.patch('/complaints/:id/status', async (req, res) => {
    try {
        const { status, admin_notes } = req.body;
        if (!status) return res.status(400).json({ error: 'Status is required' });

        const allowed = ['submitted', 'in_progress', 'resolved', 'rejected'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Allowed: ${allowed.join(', ')}` });
        }

        // Verify complaint belongs to HOD's department
        const [comp] = await db.query(`
            SELECT c.id FROM complaints c
            JOIN student_profiles sp ON sp.user_id = c.student_id
            WHERE c.id = ? AND c.portal_type = 'hod' AND sp.department_id = ?
        `, [req.params.id, req.user.department_id]);

        if (comp.length === 0) {
            return res.status(404).json({ error: 'Complaint not found or not in your department' });
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
        console.error('HOD update complaint status error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ═══════════════════════════════════════════════════════════════════
// POST /api/hod/reset-data  — Academic Year Data Reset
// Runs each deletion independently (no single transaction) so that a
// missing optional table doesn't poison the whole operation.
// ═══════════════════════════════════════════════════════════════════
router.post('/reset-data', require('../middleware/confirmPassword'), async (req, res) => {
    const {
        year,
        clear_attendance, clear_marks, clear_cgpa,
        clear_grades, clear_backlogs, clear_notices, clear_placements,
    } = req.body;

    if (!year) return res.status(400).json({ error: 'Year is required' });

    const deptId = req.user.department_id;
    const summary = {};
    const errors  = [];

    // Helper: run a DELETE and record result; skip silently if table missing
    const safeDelete = async (label, sql, params) => {
        try {
            const [r] = await db.query(sql, params);
            summary[label] = r.affectedRows;
        } catch (e) {
            if (e.code === 'ER_NO_SUCH_TABLE') {
                summary[label] = 0;
            } else {
                errors.push(`${label}: ${e.message}`);
                console.error(`[reset-data] ${label}:`, e.message);
            }
        }
    };

    // Archive marks before deleting so data can be recovered
    const archiveMarks = async (studentIds, subjectIds) => {
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS marks_archive (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    archive_year INT, archive_dept_id INT,
                    student_id INT, subject_id INT, exam_type VARCHAR(50),
                    marks_obtained DECIMAL(5,2), max_marks DECIMAL(5,2),
                    is_published TINYINT(1), entered_by INT,
                    INDEX(student_id), INDEX(archive_dept_id)
                )
            `);
            await db.query(`
                INSERT INTO marks_archive
                    (archive_year, archive_dept_id, student_id, subject_id, exam_type, marks_obtained, max_marks, is_published, entered_by)
                SELECT ?, ?, student_id, subject_id, exam_type, marks_obtained, max_marks, is_published, entered_by
                FROM marks WHERE student_id IN (?) AND subject_id IN (?)
            `, [year, deptId, studentIds, subjectIds]);
        } catch (e) { console.warn('[reset-data] marks archive warning:', e.message); }
    };

    // Archive attendance before deleting
    const archiveAttendance = async (studentIds) => {
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS attendance_archive (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    archive_year INT, archive_dept_id INT,
                    student_id INT, assignment_id INT, date DATE,
                    status ENUM('present','absent','late','excused'),
                    session_id INT,
                    INDEX(student_id), INDEX(archive_dept_id)
                )
            `);
            await db.query(`
                INSERT INTO attendance_archive
                    (archive_year, archive_dept_id, student_id, assignment_id, date, status, session_id)
                SELECT ?, ?, student_id, assignment_id, date, status, session_id
                FROM attendance WHERE student_id IN (?)
            `, [year, deptId, studentIds]);
        } catch (e) { console.warn('[reset-data] attendance archive warning:', e.message); }
    };

    try {
        // -- Student IDs for this dept + year
        const [stuRows] = await db.query(`
            SELECT u.id FROM users u
            JOIN student_profiles sp ON sp.user_id = u.id
            WHERE sp.department_id = ? AND sp.year = ? AND u.role = 'student' AND u.is_active = TRUE
        `, [deptId, year]);
        const studentIds = stuRows.map(r => r.id);

        // ── Assignment IDs for this dept + year (used by attendance) ──
        const [asgnRows] = await db.query(
            'SELECT id FROM faculty_assignments WHERE department_id = ? AND year = ?',
            [deptId, year]
        );
        const assignmentIds = asgnRows.map(r => r.id);

        // ── Subject IDs for this dept (used by marks) ─────────────────
        const [subjRows] = await db.query(
            'SELECT id FROM subjects WHERE department_id = ?',
            [deptId]
        );
        const subjectIds = subjRows.map(r => r.id);

        // ── 1. Attendance ──────────────────────────────────────────────
        // IMPORTANT: attendance records are linked to faculty_assignments.year
        // which may NOT equal the student's CURRENT year (e.g. a student promoted
        // from Year 2 → Year 3 still has attendance rows under Year-2 assignments).
        // So we delete by student_id (who they ARE now), not by assignment_id.
        if (clear_attendance && studentIds.length > 0) {
            await archiveAttendance(studentIds); // save copy before delete
            await safeDelete('attendance_records',
                'DELETE FROM attendance WHERE student_id IN (?)',
                [studentIds]
            );
            await safeDelete('attendance_sessions',
                `DELETE FROM attendance_sessions WHERE id NOT IN (
                    SELECT DISTINCT session_id FROM attendance WHERE session_id IS NOT NULL
                ) AND department_id = ? AND year = ?`,
                [deptId, year]
            );
        } else if (clear_attendance) {
            summary.attendance_records = 0; summary.attendance_sessions = 0;
        }


        // ── 2. Marks ──────────────────────────────────────────────────
        // marks table has: student_id, subject_id (NO assignment_id)
        // Delete marks for these students scoped to this dept's subjects
        if (clear_marks && studentIds.length > 0) {
            if (subjectIds.length > 0) {
                await archiveMarks(studentIds, subjectIds); // save copy before delete
                await safeDelete('marks',
                    'DELETE FROM marks WHERE student_id IN (?) AND subject_id IN (?)',
                    [studentIds, subjectIds]
                );
            } else {
                summary.marks = 0;
            }
        } else if (clear_marks) { summary.marks = 0; }

        // ── 3. Grades ──────────────────────────────────────────────────
        if (clear_grades && studentIds.length > 0) {
            await safeDelete('grades', 'DELETE FROM grades WHERE student_id IN (?)', [studentIds]);
        } else if (clear_grades) { summary.grades = 0; }

        // ── 4. CGPA / SGPA + Grades (fallback source) ─────────────────
        // student_cgpa is the primary source; grades table is the fallback.
        // BOTH must be cleared together so the UI shows '—' after reset.
        if (clear_cgpa && studentIds.length > 0) {
            await safeDelete('cgpa_records', 'DELETE FROM student_cgpa WHERE student_id IN (?)', [studentIds]);
            await safeDelete('sgpa_records', 'DELETE FROM student_sgpa WHERE student_id IN (?)', [studentIds]);
            await safeDelete('grades_for_cgpa', 'DELETE FROM grades WHERE student_id IN (?)', [studentIds]);
        } else if (clear_cgpa) { summary.cgpa_records = 0; summary.sgpa_records = 0; }

        // ── 5. Backlogs ────────────────────────────────────────────────
        if (clear_backlogs && studentIds.length > 0) {
            await safeDelete('backlogs', 'DELETE FROM student_backlogs WHERE student_id IN (?)', [studentIds]);
        } else if (clear_backlogs) { summary.backlogs = 0; }

        // ── 6. HOD-posted Notices ──────────────────────────────────────
        if (clear_notices) {
            await safeDelete('notices', `
                DELETE FROM notices
                WHERE created_by IN (SELECT id FROM users WHERE department_id = ? AND role = 'hod')
            `, [deptId]);
        }

        // ── 7. HOD-posted Placements ───────────────────────────────────
        if (clear_placements) {
            await safeDelete('placements',
                "DELETE FROM placement_jobs WHERE department_id = ? AND posted_by_role = 'hod'",
                [deptId]
            );
        }

        console.log(`[reset-data] HOD dept=${deptId} year=${year}`, summary);

        try {
            const { logAction } = require('../utils/auditLogger');
            await logAction(req.user.id, 'RESET_DATA', 'departments', deptId, { year, summary, errors });
        } catch (auditErr) {
            console.error('Failed to log reset data action:', auditErr.message);
        }

        res.json({
            message: errors.length > 0 ? 'Reset completed with some warnings' : 'Reset complete',
            summary,
            warnings: errors.length > 0 ? errors : undefined,
        });
    } catch (err) {
        console.error('Reset data fatal error:', err);
        res.status(500).json({ error: 'Reset failed: ' + err.message });
    }
});

module.exports = router;




