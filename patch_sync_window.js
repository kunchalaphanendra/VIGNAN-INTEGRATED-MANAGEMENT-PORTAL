const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server', 'routes', 'faculty.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the old block to replace (use a unique short string to locate it)
const marker = 'Already created \u2014 just upsert attendance';
const idx = content.indexOf(marker);
if (idx === -1) {
    console.error('Could not find marker in file. Check manually.');
    process.exit(1);
}

// Find the start of the "// -- Check if" comment before marker
const checkComment = '// \u2500\u2500 Check if this faculty already submitted this period (idempotent) \u2500\u2500';
const startIdx = content.lastIndexOf(checkComment, idx);
if (startIdx === -1) {
    console.error('Could not find start comment.');
    process.exit(1);
}

// Find the end: res.json({ message: 'Offline attendance synced'...
const endMarker = "res.json({ message: 'Offline attendance synced', session_id: sessionId, count: records.length });";
const endIdx = content.indexOf(endMarker, startIdx);
if (endIdx === -1) {
    console.error('Could not find end marker.');
    process.exit(1);
}
const endPos = endIdx + endMarker.length;

const newBlock = `// \u2500\u2500 Determine if saved_at was within the period window \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        // Compare timestamp when faculty MARKED (saved_at) vs the period window.
        // Prevents gaming: going offline after period ends to submit fake attendance.
        let isOutsideWindow = false;
        let windowNote      = null;

        if (start_time && end_time && saved_at) {
            try {
                const [periodRows] = await db.query(
                    \`SELECT window_open_before, window_close_after
                     FROM class_periods WHERE department_id=? AND period_number=? LIMIT 1\`,
                    [deptId, period_number ?? null]
                ).catch(() => [[]]);

                const openBefore  = periodRows[0]?.window_open_before ?? 5;
                const closeAfter  = periodRows[0]?.window_close_after ?? 10;

                const toMin = (t) => { const [h,m] = t.split(':').map(Number); return h*60+m; };
                const savedDate   = new Date(saved_at);
                const savedMin    = savedDate.getHours() * 60 + savedDate.getMinutes();
                const windowStart = toMin(start_time) - openBefore;
                const windowEnd   = toMin(end_time)   + closeAfter;

                isOutsideWindow = savedMin < windowStart || savedMin > windowEnd;

                if (isOutsideWindow) {
                    const hh = String(savedDate.getHours()).padStart(2,'0');
                    const mm = String(savedDate.getMinutes()).padStart(2,'0');
                    windowNote = \`Offline attendance marked at \${hh}:\${mm} \u2014 outside Period \${period_number} window (\${start_time.slice(0,5)}\u2013\${end_time.slice(0,5)}). Pending HOD confirmation.\`;
                }
            } catch { /* non-fatal \u2014 default to within-window */ }
        }

        // \u2500\u2500 Check if this faculty already submitted this period (idempotent) \u2500\u2500
        const [existing] = await db.query(
            \`SELECT id FROM attendance_sessions
             WHERE faculty_id=? AND department_id=? AND year=? AND section=? AND session_date=? AND period_number<=>?\`,
            [req.user.id, deptId, year, section, dateStr, period_number ?? null]
        );

        let sessionId;
        if (existing.length > 0) {
            sessionId = existing[0].id;
        } else {
            const [result] = await db.query(
                \`INSERT INTO attendance_sessions
                 (assignment_id, faculty_id, department_id, year, section, session_date,
                  period_number, start_time, end_time, outside_window, hod_confirmed, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`,
                [assignment_id, req.user.id, deptId, year, section, dateStr,
                 period_number ?? null, start_time ?? null, end_time ?? null,
                 isOutsideWindow ? 1 : 0,
                 isOutsideWindow ? null : 1,
                 req.user.id]
            );
            sessionId = result.insertId;
        }

        // \u2500\u2500 Save attendance records \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        for (const r of records) {
            await db.query(
                \`INSERT INTO attendance (student_id, assignment_id, date, period_number, status, marked_by)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE status=VALUES(status), marked_by=VALUES(marked_by)\`,
                [r.student_id, assignment_id, dateStr, period_number ?? null, r.status, req.user.id]
            );
        }

        res.json({
            message:        'Offline attendance synced',
            session_id:     sessionId,
            count:          records.length,
            outside_window: isOutsideWindow,
            window_note:    windowNote,
        });`;

const before = content.substring(0, startIdx);
const after  = content.substring(endPos);
const patched = before + newBlock + after;

fs.writeFileSync(filePath, patched, 'utf8');
console.log('✅ Patch applied successfully!');
console.log('startIdx:', startIdx, 'endPos:', endPos);
