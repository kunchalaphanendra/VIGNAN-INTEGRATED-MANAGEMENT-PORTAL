/**
 * Notification Service
 * Centralized utility to insert notifications into the DB for any action.
 * Usage: const { sendNotification, notifyDepartment } = require('./notificationService');
 */
const db = require('../db/connection');

/**
 * Send a notification to multiple users.
 * @param {number[]} userIds - Array of user IDs to notify
 * @param {string} title     - Notification title
 * @param {string} message   - Notification body
 * @param {string} type      - One of: notice|leave|marks|complaint|alert|poll|calendar|attendance
 * @param {number|null} referenceId - Optional: ID of the related record
 */
async function sendNotification({ userIds, title, message, type, referenceId = null }) {
    if (!userIds || userIds.length === 0) return;

    // Remove duplicates
    const unique = [...new Set(userIds)];

    const values = unique.map(uid => [uid, title, message, type, referenceId]);
    await db.query(
        'INSERT INTO notifications (user_id, title, message, type, reference_id) VALUES ?',
        [values]
    );
}

/**
 * Notify all active students in a department (optionally filtered by year/section).
 */
async function notifyStudentsInDept({ deptId, year = null, section = null, title, message, type, referenceId = null }) {
    let sql = `
        SELECT u.id FROM users u
        JOIN student_profiles sp ON sp.user_id = u.id
        WHERE sp.department_id = ? AND u.role = 'student' AND u.is_active = TRUE
    `;
    const params = [deptId];
    if (year) { sql += ' AND sp.year = ?'; params.push(year); }
    if (section) { sql += ' AND sp.section = ?'; params.push(section); }

    const [rows] = await db.query(sql, params);
    const userIds = rows.map(r => r.id);
    await sendNotification({ userIds, title, message, type, referenceId });
}

/**
 * Notify all active faculty in a department.
 */
async function notifyFacultyInDept({ deptId, title, message, type, referenceId = null }) {
    const [rows] = await db.query(
        "SELECT id FROM users WHERE department_id = ? AND role = 'faculty' AND is_active = TRUE",
        [deptId]
    );
    const userIds = rows.map(r => r.id);
    await sendNotification({ userIds, title, message, type, referenceId });
}

/**
 * Notify all active students in a specific class (year + section + dept from an assignment).
 */
async function notifyClassStudents({ assignmentId, title, message, type, referenceId = null }) {
    const [assign] = await db.query(
        'SELECT department_id, year, section FROM faculty_assignments WHERE id = ?',
        [assignmentId]
    );
    if (!assign.length) return;
    const { department_id, year, section } = assign[0];
    await notifyStudentsInDept({ deptId: department_id, year, section, title, message, type, referenceId });
}

/**
 * Notify all users institution-wide (all roles or filtered by role).
 */
async function notifyAll({ role = null, title, message, type, referenceId = null }) {
    let sql = 'SELECT id FROM users WHERE is_active = TRUE';
    const params = [];
    if (role) { sql += ' AND role = ?'; params.push(role); }

    const [rows] = await db.query(sql, params);
    const userIds = rows.map(r => r.id);
    await sendNotification({ userIds, title, message, type, referenceId });
}

module.exports = {
    sendNotification,
    notifyStudentsInDept,
    notifyFacultyInDept,
    notifyClassStudents,
    notifyAll,
};
