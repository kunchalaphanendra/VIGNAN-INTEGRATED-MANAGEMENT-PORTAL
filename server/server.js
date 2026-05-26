const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const server = http.createServer(app);

// Socket.io initialization
const io = new Server(server, {
    cors: {
        origin: function (origin, callback) {
            const allowed = [
                process.env.CLIENT_URL || 'http://localhost:5173',
                'http://localhost:5173',
                'http://localhost:5174',
                'http://localhost:5175',
                'http://127.0.0.1:5173',
                'http://127.0.0.1:5174',
            ];
            const isLocalNetwork = origin && (
                /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin) ||
                /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(origin)
            );
            if (!origin || allowed.includes(origin) || isLocalNetwork) {
                callback(null, true);
            } else {
                callback(new Error('CORS: ' + origin + ' not allowed'));
            }
        },
        credentials: true
    }
});

global.io = io;

io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('join', (user) => {
        if (!user || !user.id) return;
        socket.join(`user_${user.id}`);
        socket.join('global');
        if (user.role) {
            socket.join(`role_${user.role}`);
            if (user.department_id) {
                socket.join(`dept_${user.department_id}`);
                socket.join(`dept_${user.department_id}_${user.role}`);
            }
        }
        console.log(`[Socket] User ${user.id} (${user.role}) joined rooms.`);
    });

    socket.on('disconnect', () => {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
});


// Middleware
app.use(cors({
    origin: function (origin, callback) {
        // Allow localhost OR any local network IP (192.168.x.x) for mobile testing
        const allowed = [
            process.env.CLIENT_URL || 'http://localhost:5173',
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:5175',
            'http://127.0.0.1:5173',
            'http://127.0.0.1:5174',
        ];
        const isLocalNetwork = origin && (
            /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin) ||
            /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(origin)
        );
        if (!origin || allowed.includes(origin) || isLocalNetwork) {
            callback(null, true);
        } else {
            callback(new Error('CORS: ' + origin + ' not allowed'));
        }
    },
    credentials: true
}));
// Production Security Headers
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' ws: wss: http://localhost:5000 http://localhost:5173; frame-ancestors 'none';");
    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/principal', require('./routes/principal'));
app.use('/api/hod', require('./routes/hod'));
app.use('/api/faculty', require('./routes/faculty'));
app.use('/api/student', require('./routes/student'));
app.use('/api/backup', require('./routes/backup'));

// Notifications route (shared across all roles)
const db = require('./db/connection');
const auth = require('./middleware/auth');

app.get('/api/notifications', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { type, search, unreadOnly, page = 1, limit = 20 } = req.query;
        
        let sql = 'SELECT * FROM notifications WHERE recipient_id = ?';
        const params = [userId];
        
        if (type && type !== 'all') {
            sql += ' AND type = ?';
            params.push(type);
        }
        if (search) {
            sql += ' AND (title LIKE ? OR message LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        if (unreadOnly === 'true' || unreadOnly === true) {
            sql += ' AND is_read = FALSE';
        }
        
        sql += ' ORDER BY created_at DESC';
        
        const offset = (parseInt(page) - 1) * parseInt(limit);
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);
        
        const [rows] = await db.query(sql, params);
        
        let countSql = 'SELECT COUNT(*) as count FROM notifications WHERE recipient_id = ?';
        const countParams = [userId];
        if (type && type !== 'all') {
            countSql += ' AND type = ?';
            countParams.push(type);
        }
        if (search) {
            countSql += ' AND (title LIKE ? OR message LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`);
        }
        if (unreadOnly === 'true' || unreadOnly === true) {
            countSql += ' AND is_read = FALSE';
        }
        const [countResult] = await db.query(countSql, countParams);
        const total = countResult[0].count;
        
        const [unreadResult] = await db.query(
            'SELECT COUNT(*) as count FROM notifications WHERE recipient_id = ? AND is_read = FALSE',
            [userId]
        );
        const unreadCount = unreadResult[0].count;
        
        res.json({
            notifications: rows,
            total,
            unread_count: unreadCount,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit))
        });
    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.patch('/api/notifications/read-all', auth, async (req, res) => {
    try {
        await db.query('UPDATE notifications SET is_read = TRUE WHERE recipient_id = ?', [req.user.id]);
        res.json({ message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.patch('/api/notifications/:id/read', auth, async (req, res) => {
    try {
        await db.query('UPDATE notifications SET is_read = TRUE WHERE id = ? AND recipient_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'Notification marked as read' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/notifications/:id', auth, async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM notifications WHERE id = ? AND recipient_id = ?', [req.params.id, req.user.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.json({ message: 'Notification deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/notifications/create', auth, async (req, res) => {
    if (req.user.role !== 'principal' && req.user.role !== 'hod') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    try {
        const { title, message, type, recipient_role, recipient_id, department_id, target_url } = req.body;
        const { sendNotification } = require('./utils/notificationService');
        await sendNotification({
            title,
            message,
            type,
            sender_role: req.user.role,
            sender_id: req.user.id,
            recipient_role,
            recipient_id,
            department_id,
            target_url
        });
        res.json({ message: 'Notification created' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Error handling
app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    if (err.message && err.message.includes('File type not allowed')) {
        return res.status(400).json({ error: err.message });
    }
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Vignan Portal server running on port ${PORT}`);

    // ── Daily auto-backup at 2:00 AM ─────────────────────────────────────────
    try {
        const cron = require('node-cron');
        const { runBackup } = require('./backup');
        cron.schedule('0 2 * * *', () => {
            console.log('[Backup] ⏰ Daily auto-backup starting...');
            runBackup()
                .then(r => console.log(`[Backup] ✅ Auto-backup done: ${r.file} (${r.size})`))
                .catch(e => console.error('[Backup] ❌ Auto-backup failed:', e.message));
        }, { timezone: 'Asia/Kolkata' });
        console.log('[Backup] ⏰ Daily backup scheduled at 2:00 AM IST');
    } catch (e) {
        console.warn('[Backup] node-cron not available, auto-backup disabled:', e.message);
    }
});
