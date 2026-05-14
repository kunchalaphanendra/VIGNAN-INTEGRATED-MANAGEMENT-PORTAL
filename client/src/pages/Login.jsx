import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { HiOutlineEye, HiOutlineEyeOff, HiOutlineSun, HiOutlineMoon, HiOutlineArrowLeft } from 'react-icons/hi';

const roleConfig = {
    principal: {
        icon: '🏛',
        title: 'Principal Login',
        color: '#B71C1C',
        colorRgb: '183, 28, 28',
        gradient: 'linear-gradient(135deg, #8B0000 0%, #C62828 50%, #EF5350 100%)',
    },
    hod: {
        icon: '🎓',
        title: 'HOD Login',
        color: '#2E7D32',
        colorRgb: '46, 125, 50',
        gradient: 'linear-gradient(135deg, #1B5E20 0%, #388E3C 50%, #66BB6A 100%)',
    },
    faculty: {
        icon: '📘',
        title: 'Faculty Login',
        color: '#1565C0',
        colorRgb: '21, 101, 192',
        gradient: 'linear-gradient(135deg, #0D47A1 0%, #1976D2 50%, #42A5F5 100%)',
    },
    student: {
        icon: '🎒',
        title: 'Student Login',
        color: '#6A1B9A',
        colorRgb: '106, 27, 154',
        gradient: 'linear-gradient(135deg, #4A148C 0%, #7B1FA2 50%, #AB47BC 100%)',
    },
};

const loginPageStyles = `
    .login-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 20px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06);
        overflow: hidden;
        transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), box-shadow 0.3s cubic-bezier(0.4,0,0.2,1);
    }
    .login-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 20px 56px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.08);
    }
    .login-header {
        padding: 36px 40px 28px;
        text-align: center;
        color: white;
        position: relative;
        overflow: hidden;
    }
    .login-header::before {
        content: '';
        position: absolute;
        top: -40%;
        left: -20%;
        width: 140%;
        height: 200%;
        background: radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.18) 0%, transparent 65%);
        pointer-events: none;
    }
    .login-icon {
        font-size: 2.8rem;
        display: block;
        margin-bottom: 12px;
        filter: drop-shadow(0 2px 8px rgba(0,0,0,0.25));
        position: relative;
    }
    .login-title {
        font-size: 1.65rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        line-height: 1.2;
        position: relative;
    }
    .login-subtitle {
        font-size: 0.82rem;
        font-weight: 500;
        margin-top: 6px;
        opacity: 0.72;
        letter-spacing: 0.01em;
        position: relative;
    }
    .login-form {
        padding: 32px 36px 36px;
        display: flex;
        flex-direction: column;
        gap: 22px;
    }
    .login-label {
        display: block;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        margin-bottom: 8px;
        color: var(--text-secondary);
    }
    .login-input {
        width: 100%;
        padding: 13px 18px;
        border: 1.5px solid var(--border);
        border-radius: 11px;
        background: var(--input-bg);
        color: var(--text-primary);
        font-family: 'Inter', sans-serif;
        font-size: 0.9rem;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
        outline: none;
    }
    .login-input::placeholder {
        color: var(--text-tertiary);
        font-weight: 400;
    }
    .login-input:hover:not(:focus) {
        border-color: var(--text-tertiary);
    }
    .login-input-wrapper {
        position: relative;
    }
    .login-input.has-icon {
        padding-right: 48px;
    }
    .eye-btn {
        position: absolute;
        right: 14px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
        color: var(--text-tertiary);
        transition: color 0.2s ease, background 0.2s ease;
        display: flex;
        align-items: center;
    }
    .eye-btn:hover {
        color: var(--text-secondary);
        background: var(--bg-secondary);
    }
    .login-btn {
        width: 100%;
        padding: 15px 24px;
        border: none;
        border-radius: 11px;
        font-family: 'Inter', sans-serif;
        font-size: 0.95rem;
        font-weight: 700;
        color: white;
        cursor: pointer;
        letter-spacing: 0.01em;
        transition: filter 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
    }
    .login-btn:hover:not(:disabled) {
        filter: brightness(1.1);
        transform: translateY(-2px);
    }
    .login-btn:active:not(:disabled) {
        filter: brightness(0.97);
        transform: translateY(0);
    }
    .login-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
    }
    .login-error {
        padding: 13px 16px;
        border-radius: 10px;
        font-size: 0.85rem;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
        background: #FEF2F2;
        color: #B91C1C;
        border: 1px solid #FECACA;
    }
    .back-link {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-size: 0.85rem;
        font-weight: 500;
        text-decoration: none;
        padding: 6px 10px;
        border-radius: 8px;
        margin-bottom: 20px;
        transition: color 0.2s ease, background 0.2s ease;
        color: var(--text-secondary);
        margin-left: -10px;
    }
    .back-link:hover {
        color: var(--text-primary);
        background: var(--bg-secondary);
    }
    .spin {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2.5px solid rgba(255,255,255,0.35);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
    }
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;

export default function Login() {
    const [params] = useSearchParams();
    const role = params.get('role') || 'student';
    const config = roleConfig[role] || roleConfig.student;
    const navigate = useNavigate();
    const { login } = useAuth();
    const { theme, toggleTheme } = useTheme();

    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(loginId, password, role);
            navigate(`/${role}/dashboard`);
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const focusStyle = {
        borderColor: config.color,
        boxShadow: `0 0 0 3.5px rgba(${config.colorRgb}, 0.13)`,
    };

    return (
        <>
            <style>{loginPageStyles}</style>
            <div
                className="min-h-screen flex items-center justify-center p-4"
                style={{ background: 'var(--bg-primary)' }}
            >
                {/* Theme toggle */}
                <div className="absolute top-5 right-5">
                    <button
                        onClick={toggleTheme}
                        className="p-3 rounded-xl transition-all"
                        style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            boxShadow: 'var(--shadow-sm)',
                            color: 'var(--text-secondary)',
                        }}
                    >
                        {theme === 'light' ? <HiOutlineMoon size={20} /> : <HiOutlineSun size={20} />}
                    </button>
                </div>

                <div className="w-full max-w-sm animate-fade-in-up">
                    {/* Back button */}
                    <Link to="/" className="back-link">
                        <HiOutlineArrowLeft size={15} />
                        Back to role selection
                    </Link>

                    {/* Login card */}
                    <div className="login-card">
                        {/* Header */}
                        <div className="login-header" style={{ background: config.gradient }}>
                            <span className="login-icon">{config.icon}</span>
                            <h2 className="login-title">{config.title}</h2>
                            <p className="login-subtitle">Vignan College Portal</p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="login-form">
                            {error && (
                                <div className="login-error">
                                    <span>⚠</span> {error}
                                </div>
                            )}

                            <div>
                                <label className="login-label">Login ID</label>
                                <input
                                    type="text"
                                    value={loginId}
                                    onChange={e => setLoginId(e.target.value)}
                                    className="login-input"
                                    placeholder={role === 'student' ? 'Enter Roll Number' : 'Enter Login ID'}
                                    required
                                    autoFocus
                                    onFocus={e => { Object.assign(e.target.style, focusStyle); }}
                                    onBlur={e => { e.target.style.borderColor = ''; e.target.style.boxShadow = ''; }}
                                />
                            </div>

                            <div>
                                <label className="login-label">Password</label>
                                <div className="login-input-wrapper">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="login-input has-icon"
                                        placeholder="Enter password"
                                        required
                                        onFocus={e => { Object.assign(e.target.style, focusStyle); }}
                                        onBlur={e => { e.target.style.borderColor = ''; e.target.style.boxShadow = ''; }}
                                    />
                                    <button
                                        type="button"
                                        className="eye-btn"
                                        onClick={() => setShowPassword(!showPassword)}
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <HiOutlineEyeOff size={18} /> : <HiOutlineEye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="login-btn"
                                style={{
                                    background: config.gradient,
                                    boxShadow: `0 6px 20px rgba(${config.colorRgb}, 0.35)`,
                                }}
                            >
                                {loading ? (
                                    <>
                                        <span className="spin" />
                                        Signing in...
                                    </>
                                ) : 'Sign In'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </>
    );
}
