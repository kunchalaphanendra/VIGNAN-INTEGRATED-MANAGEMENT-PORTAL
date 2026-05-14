import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { HiOutlineSun, HiOutlineMoon, HiOutlineArrowRight } from 'react-icons/hi';

/* ── Role configuration ───────────────────────────────────── */
const roles = [
    {
        key: 'principal',
        emoji: '🏛️',
        title: 'Principal / Admin',
        desc: 'Manage the entire institution, departments, and view reports',
        accent: '#C62828',
        light: 'rgba(198,40,40,0.08)',
        border: 'rgba(198,40,40,0.22)',
        gradient: 'linear-gradient(135deg, #C62828 0%, #EF5350 100%)',
    },
    {
        key: 'hod',
        emoji: '🎓',
        title: 'Head of Department',
        desc: 'Manage faculty, students, attendance, and marks for your department',
        accent: '#2E7D32',
        light: 'rgba(46,125,50,0.08)',
        border: 'rgba(46,125,50,0.22)',
        gradient: 'linear-gradient(135deg, #2E7D32 0%, #43A047 100%)',
    },
    {
        key: 'faculty',
        emoji: '📘',
        title: 'Faculty',
        desc: 'Mark attendance, enter marks, and manage class activities',
        accent: '#1565C0',
        light: 'rgba(21,101,192,0.08)',
        border: 'rgba(21,101,192,0.22)',
        gradient: 'linear-gradient(135deg, #1565C0 0%, #1E88E5 100%)',
    },
    {
        key: 'student',
        emoji: '🎒',
        title: 'Student',
        desc: 'View attendance, marks, grades, and submit requests',
        accent: '#6A1B9A',
        light: 'rgba(106,27,154,0.08)',
        border: 'rgba(106,27,154,0.22)',
        gradient: 'linear-gradient(135deg, #6A1B9A 0%, #8E24AA 100%)',
    },
];

/* ── Component ────────────────────────────────────────────── */
export default function Landing() {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();

    return (
        <>
            {/* Google Fonts – Inter */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

                .landing-root {
                    font-family: 'Inter', system-ui, sans-serif;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 48px 20px 32px;
                    background: var(--bg-primary);
                    position: relative;
                }

                /* subtle radial glow behind the header */
                .landing-root::before {
                    content: '';
                    position: absolute;
                    top: -80px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 640px;
                    height: 420px;
                    background: radial-gradient(ellipse at center, rgba(42,82,152,0.10) 0%, transparent 70%);
                    pointer-events: none;
                }

                /* ── Logo ── */
                .landing-logo {
                    width: 76px;
                    height: 76px;
                    border-radius: 20px;
                    background: linear-gradient(145deg, #1A3C6E 0%, #2A5298 55%, #D4891A 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 20px;
                    box-shadow: 0 8px 28px rgba(26,60,110,0.28), 0 2px 6px rgba(0,0,0,0.12);
                }

                /* ── Cards grid ── */
                .role-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 18px;
                    width: 100%;
                    max-width: 640px;
                }

                @media (max-width: 520px) {
                    .role-grid { grid-template-columns: 1fr; }
                }

                /* ── Individual card ── */
                .role-card {
                    position: relative;
                    display: flex;
                    align-items: flex-start;
                    gap: 16px;
                    padding: 22px 22px 20px;
                    border-radius: 16px;
                    text-align: left;
                    cursor: pointer;
                    background: var(--bg-card);
                    transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1),
                                box-shadow 0.25s ease,
                                border-color 0.25s ease;
                    border: 1.5px solid var(--border);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
                    overflow: hidden;
                }

                .role-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 12px 32px rgba(0,0,0,0.13);
                }

                /* coloured left accent stripe */
                .role-card::before {
                    content: '';
                    position: absolute;
                    left: 0; top: 12px; bottom: 12px;
                    width: 4px;
                    border-radius: 0 4px 4px 0;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }

                .role-card:hover::before { opacity: 1; }

                /* ── Icon bubble ── */
                .role-icon-wrap {
                    flex-shrink: 0;
                    width: 48px;
                    height: 48px;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 22px;
                    transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
                }

                .role-card:hover .role-icon-wrap {
                    transform: scale(1.12) rotate(-3deg);
                }

                /* ── Login arrow button ── */
                .login-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    margin-top: 10px;
                    font-size: 13px;
                    font-weight: 600;
                    letter-spacing: 0.01em;
                    padding: 5px 10px 5px 0;
                    border-radius: 8px;
                    transition: gap 0.2s ease, opacity 0.2s ease;
                }

                .role-card:hover .login-btn { gap: 8px; }

                .login-btn-arrow {
                    transition: transform 0.2s ease;
                }

                .role-card:hover .login-btn-arrow { transform: translateX(3px); }

                /* ── Fade-in animations ── */
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(22px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .fade-up {
                    opacity: 0;
                    animation: fadeInUp 0.5s ease forwards;
                }
            `}</style>

            <div className="landing-root">
                {/* ── Theme toggle ── */}
                <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 10 }}>
                    <button
                        onClick={toggleTheme}
                        style={{
                            padding: '10px',
                            borderRadius: '12px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'box-shadow 0.2s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.12)'}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)'}
                    >
                        {theme === 'light' ? <HiOutlineMoon size={20} /> : <HiOutlineSun size={20} />}
                    </button>
                </div>

                {/* ── Header / Branding ── */}
                <div className="fade-up" style={{ textAlign: 'center', marginBottom: 48, animationDelay: '0s' }}>
                    {/* Logo */}
                    <div className="landing-logo">
                        <span style={{ color: '#fff', fontSize: 30, fontWeight: 900, lineHeight: 1 }}>V</span>
                    </div>

                    {/* Title */}
                    <h1 style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 'clamp(2rem, 5vw, 2.8rem)',
                        fontWeight: 900,
                        letterSpacing: '-0.025em',
                        color: 'var(--text-primary)',
                        margin: '0 0 8px',
                        lineHeight: 1.1,
                    }}>
                        Vignan College
                    </h1>

                    {/* Subtitle */}
                    <p style={{
                        fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)',
                        fontWeight: 700,
                        color: 'var(--accent)',
                        margin: '0 0 12px',
                        letterSpacing: '0.01em',
                    }}>
                        Integrated Management Portal
                    </p>

                    {/* Description */}
                    <p style={{
                        fontSize: 14,
                        color: 'var(--text-secondary)',
                        maxWidth: 360,
                        margin: '0 auto',
                        lineHeight: 1.6,
                    }}>
                        Access your academic dashboard by selecting your role below
                    </p>
                </div>

                {/* ── Role Cards ── */}
                <div className="role-grid">
                    {roles.map((role, i) => (
                        <button
                            key={role.key}
                            className="role-card fade-up"
                            style={{
                                '--accent': role.accent,
                                animationDelay: `${0.08 + i * 0.09}s`,
                            }}
                            onClick={() => navigate(`/login?role=${role.key}`)}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = role.border;
                                e.currentTarget.style.background = role.light;
                                e.currentTarget.style.setProperty('--stripe', role.accent);
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = '';
                                e.currentTarget.style.background = 'var(--bg-card)';
                            }}
                        >
                            {/* Left accent stripe (via ::before colour set inline) */}
                            <style>{`.role-card[data-key="${role.key}"]:hover::before { background: ${role.gradient}; }`}</style>

                            {/* ── Icon bubble ── */}
                            <div
                                className="role-icon-wrap"
                                style={{ background: role.light, border: `1.5px solid ${role.border}` }}
                            >
                                {role.emoji}
                            </div>

                            {/* ── Text content ── */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={{
                                    margin: '0 0 5px',
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: role.accent,
                                    lineHeight: 1.2,
                                }}>
                                    {role.title}
                                </h3>
                                <p style={{
                                    margin: 0,
                                    fontSize: 12.5,
                                    color: 'var(--text-secondary)',
                                    lineHeight: 1.55,
                                }}>
                                    {role.desc}
                                </p>

                                {/* Login arrow */}
                                <div className="login-btn" style={{ color: role.accent }}>
                                    Login
                                    <HiOutlineArrowRight size={13} className="login-btn-arrow" />
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* ── Footer ── */}
                <p className="fade-up" style={{
                    marginTop: 52,
                    fontSize: 12,
                    color: 'var(--text-tertiary)',
                    textAlign: 'center',
                    animationDelay: '0.5s',
                }}>
                    © 2024 Vignan College of Engineering &amp; Technology. All rights reserved.
                </p>
            </div>
        </>
    );
}
