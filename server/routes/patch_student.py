with open('student.js', 'rb') as f:
    content = f.read().decode('utf-8')

lines = content.split('\r\n')
print('Total lines:', len(lines))
print('Lines 94-122:')
for i, l in enumerate(lines[94:122], 95):
    print(i, repr(l[:60]))

new_lines = [
    '',
    '        // GPA - from dedicated student_cgpa table',
    '        let gpaRow = { current_sgpa: null, cgpa: null };',
    '        try {',
    '            const [gpaRows] = await db.query(',
    '                `SELECT cgpa, sgpa as current_sgpa FROM student_cgpa WHERE student_id = ? ORDER BY updated_at DESC LIMIT 1`,',
    '                [req.user.id]',
    '            );',
    '            if (gpaRows.length > 0) gpaRow = gpaRows[0];',
    '        } catch { /* student_cgpa may not exist yet */ }',
    '',
    '        // Complaint window',
    '        const [window] = await db.query(',
    "            'SELECT * FROM complaint_windows WHERE close_date >= CURDATE() ORDER BY open_date LIMIT 1'",
    '        );',
    '',
    '        // Active backlogs count',
    '        let activeBacklogs = { total_backlogs: 0, backlog_entries: 0 };',
    '        try {',
    '            const [blRows] = await db.query(',
    "                `SELECT COUNT(*) as backlog_entries, COALESCE(SUM(backlog_count),0) as total_backlogs FROM student_backlogs WHERE student_id = ? AND status = 'active'`,",
    '                [req.user.id]',
    '            );',
    '            if (blRows.length > 0) activeBacklogs = blRows[0];',
    '        } catch { /* table may not exist */ }',
    '',
    '        res.json({',
    '            overall_attendance: overallAtt[0],',
    '            subject_attendance: subjectAtt,',
    '            latest_marks: latestMarks,',
    '            notices,',
    '            leaves,',
    '            upcoming_events: events,',
    '            gpa: gpaRow,',
    '            complaint_window: window.length > 0 ? window[0] : null,',
    '            active_backlogs: activeBacklogs,',
    '        });',
    '    } catch (err) {',
    "        console.error('Student dashboard error:', err);",
    "        res.status(500).json({ error: 'Server error' });",
    '    }',
    '});',
]

# lines indices 94-120 correspond to lines 95-121 (1-indexed)
result_lines = lines[:94] + new_lines + lines[121:]
result = '\r\n'.join(result_lines)
with open('student.js', 'wb') as f:
    f.write(result.encode('utf-8'))
print('Written OK. Total lines now:', len(result_lines))
