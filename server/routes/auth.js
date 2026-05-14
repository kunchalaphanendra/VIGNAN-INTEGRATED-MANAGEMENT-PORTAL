const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');
const auth = require('../middleware/auth');

const SALT_ROUNDS = 12;

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { login_id, password, role } = req.body;
        if (!login_id || !password || !role) {
            return res.status(400).json({ error: 'Login ID, password, and role are required' });
        }

        const [rows] = await db.query(
            'SELECT * FROM users WHERE login_id = ? AND role = ? AND is_active = TRUE',
            [login_id, role]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

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
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 8 * 60 * 60 * 1000 // 8 hours
        });

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                login_id: user.login_id,
                role: user.role,
                full_name: user.full_name,
                email: user.email,
                phone: user.phone,
                department_id: user.department_id,
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
            'SELECT id, login_id, role, department_id, full_name, email, phone, profile_photo, theme_preference FROM users WHERE id = ?',
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
