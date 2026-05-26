const db = require('../db/connection');

/**
 * Send a notification.
 * Handles database fan-out and Socket.IO real-time broadcasting.
 * 
 * Supports options:
 * - title, message, type (required)
 * - sender_role, sender_id (optional)
 * - recipient_id (optional, single user)
 * - recipient_role (optional, broadcast to role)
 * - department_id (optional, broadcast to department)
 * - target_url (optional, redirect link)
 */
async function sendNotification({
    title,
    message,
    type = 'info',
    sender_role = null,
    sender_id = null,
    recipient_id = null,
    recipient_role = null,
    department_id = null,
    target_url = null
}) {
    let recipientIds = [];

    // 1. Resolve recipients
    if (recipient_id) {
        recipientIds.push(recipient_id);
    } else if (recipient_role && department_id) {
        // Broadcast to specific department and role
        const [rows] = await db.query(
            "SELECT id FROM users WHERE role = ? AND department_id = ? AND is_active = TRUE",
            [recipient_role, department_id]
        );
        recipientIds = rows.map(r => r.id);
    } else if (recipient_role) {
        // Broadcast to role institution-wide
        const [rows] = await db.query(
            "SELECT id FROM users WHERE role = ? AND is_active = TRUE",
            [recipient_role]
        );
        recipientIds = rows.map(r => r.id);
    } else if (department_id) {
        // Broadcast to entire department (all roles)
        const [rows] = await db.query(
            "SELECT id FROM users WHERE department_id = ? AND is_active = TRUE",
            [department_id]
        );
        recipientIds = rows.map(r => r.id);
    } else {
        // Global broadcast (all users)
        const [rows] = await db.query(
            "SELECT id FROM users WHERE is_active = TRUE"
        );
        recipientIds = rows.map(r => r.id);
    }

    if (recipientIds.length === 0) return;

    // Remove duplicates
    const uniqueRecipients = [...new Set(recipientIds)];

    // 2. Insert into Database using bulk insert
    const values = uniqueRecipients.map(uid => [
        uid, title, message, type, sender_role, sender_id, recipient_role, department_id, target_url
    ]);

    const [insertResult] = await db.query(
        `INSERT INTO notifications 
         (recipient_id, title, message, type, sender_role, sender_id, recipient_role, department_id, target_url) 
         VALUES ?`,
        [values]
    );

    // 3. Emit real-time notification via Socket.IO
    if (global.io && insertResult.insertId) {
        const startId = insertResult.insertId;
        const [insertedRows] = await db.query(
            "SELECT * FROM notifications WHERE id >= ? ORDER BY id ASC",
            [startId]
        );

        // Emit to each individual recipient's room
        insertedRows.forEach(row => {
            global.io.to(`user_${row.recipient_id}`).emit('new_notification', row);
        });
    }
}

/**
 * Backward compatibility helpers (mapping old functions to the new signature)
 */
async function notifyAll({ role = null, title, message, type, target_url = null }) {
    await sendNotification({
        title, message, type,
        recipient_role: role,
        target_url
    });
}

async function notifyStudentsInDept({ deptId, year = null, section = null, title, message, type, target_url = null }) {
    if (year || section) {
        let sql = `
            SELECT u.id FROM users u
            JOIN student_profiles sp ON sp.user_id = u.id
            WHERE sp.department_id = ? AND u.role = 'student' AND u.is_active = TRUE
        `;
        const params = [deptId];
        if (year) { sql += ' AND sp.year = ?'; params.push(year); }
        if (section) { sql += ' AND sp.section = ?'; params.push(section); }
        
        const [rows] = await db.query(sql, params);
        for (const r of rows) {
            await sendNotification({
                title, message, type,
                recipient_id: r.id,
                target_url
            });
        }
    } else {
        await sendNotification({
            title, message, type,
            recipient_role: 'student',
            department_id: deptId,
            target_url
        });
    }
}

async function notifyFacultyInDept({ deptId, title, message, type, target_url = null }) {
    await sendNotification({
        title, message, type,
        recipient_role: 'faculty',
        department_id: deptId,
        target_url
    });
}

async function notifyClassStudents({ assignmentId, title, message, type, target_url = null }) {
    const [assign] = await db.query(
        'SELECT department_id, year, section FROM faculty_assignments WHERE id = ?',
        [assignmentId]
    );
    if (!assign.length) return;
    const { department_id, year, section } = assign[0];
    await notifyStudentsInDept({
        deptId: department_id,
        year,
        section,
        title,
        message,
        type,
        target_url
    });
}

module.exports = {
    sendNotification,
    notifyStudentsInDept,
    notifyFacultyInDept,
    notifyClassStudents,
    notifyAll,
};
