const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');
const auth = require('../middleware/auth');
const { checkLockout, recordAttempt } = require('../middleware/lockout');

const SALT_ROUNDS = 12;

// POST /api/auth/login
router.post('/login', checkLockout, async (req, res) => {
    try {
        const { login_id, password, role } = req.body;
        if (!login_id || !password || !role) {
            return res.status(400).json({ error: 'Login ID, password, and role are required' });
        }

        const [rows] = await db.query(
            `SELECT u.*, d.name as department_name, d.code as department_code 
             FROM users u 
             LEFT JOIN departments d ON u.department_id = d.id 
             WHERE u.login_id = ? AND u.role = ? AND u.is_active = TRUE`,
            [login_id, role]
        );

        if (rows.length === 0) {
            await recordAttempt(login_id, req.ip, true);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            await recordAttempt(login_id, req.ip, true);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Record successful login (clears old failures)
        await recordAttempt(login_id, req.ip, false);

        const tokenPayload = {
            id: user.id,
            login_id: user.login_id,
            role: user.role,
            department_id: user.department_id,
            full_name: user.full_name
        };

        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES || '8h'
        });

        res.cookie('token', token, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 8 * 60 * 60 * 1000 // 8 hours
        });

        res.json({
            message: 'Login successful',
            token,   // also returned in body so client can store in localStorage (needed for mobile/proxy)
            user: {
                id: user.id,
                login_id: user.login_id,
                role: user.role,
                full_name: user.full_name,
                email: user.email,
                phone: user.phone,
                department_id: user.department_id,
                department_name: user.department_name,
                department_code: user.department_code,
                profile_photo: user.profile_photo,
                theme_preference: user.theme_preference
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT u.id, u.login_id, u.role, u.department_id, u.full_name, u.email, u.phone, u.profile_photo, u.theme_preference,
                    d.name as department_name, d.code as department_code 
             FROM users u 
             LEFT JOIN departments d ON u.department_id = d.id 
             WHERE u.id = ?`,
            [req.user.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user: rows[0] });
    } catch (err) {
        console.error('Get me error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/auth/change-password
router.post('/change-password', auth, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Current and new password are required' });
        }
        if (new_password.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters' });
        }

        const [rows] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
        const match = await bcrypt.compare(current_password, rows[0].password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        const hash = await bcrypt.hash(new_password, SALT_ROUNDS);
        await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);

        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/auth/theme
router.patch('/theme', auth, async (req, res) => {
    try {
        const { theme } = req.body;
        if (!['light', 'dark'].includes(theme)) {
            return res.status(400).json({ error: 'Theme must be "light" or "dark"' });
        }

        await db.query('UPDATE users SET theme_preference = ? WHERE id = ?', [theme, req.user.id]);
        res.json({ message: 'Theme updated', theme });
    } catch (err) {
        console.error('Theme update error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
