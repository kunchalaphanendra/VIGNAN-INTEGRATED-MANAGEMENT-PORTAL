import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../utils/api';
import { 
    HiOutlineDatabase, 
    HiOutlineDownload, 
    HiOutlineRefresh, 
    HiOutlineCheckCircle, 
    HiOutlineExclamationCircle, 
    HiOutlineClock,
    HiOutlineCloudUpload,
    HiOutlineAdjustments,
    HiOutlineTag
} from 'react-icons/hi';

function fmtDate(iso) {
    try { 
        return new Date(iso).toLocaleString('en-IN', { 
            dateStyle: 'medium', 
            timeStyle: 'short' 
        }); 
    } catch { 
        return iso; 
    }
}

export default function BackupPage() {
    const [backups, setBackups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [status, setStatus] = useState({ cloudConfigured: false });
    const [result, setResult] = useState(null); // { success, message }
    
    // Tiered backup parameters
    const [selectedTier, setSelectedTier] = useState('daily');
    const [customLabel, setCustomLabel] = useState('');

    const load = async () => {
        try {
            const listRes = await api.get('/backup/list');
            setBackups(listRes.data.backups || []);
            
            const statusRes = await api.get('/backup/status');
            setStatus(statusRes.data || { cloudConfigured: false });
        } catch (err) {
            console.error('Failed to load backup data:', err);
            setBackups([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const runBackup = async () => {
        if (['semester', 'yearly'].includes(selectedTier) && !customLabel.trim()) {
            setResult({ success: false, message: '❌ A custom label (e.g., semester_1_final) is required for long-term snapshot archives.' });
            return;
        }

        setRunning(true);
        setResult(null);
        try {
            const res = await api.post('/backup/run', {
                tier: selectedTier,
                customName: customLabel
            });
            setResult({ 
                success: true, 
                message: `✅ ${res.data.message} — ${res.data.file} (${res.data.size})` 
            });
            setCustomLabel('');
            load();
        } catch (err) {
            setResult({ 
                success: false, 
                message: `❌ Backup failed: ${err.response?.data?.error || err.message}` 
            });
        } finally {
            setRunning(false);
        }
    };

    const downloadBackup = (tier, filename) => {
        const base = api.defaults?.baseURL || '/api';
        window.open(`${base}/backup/download/${tier}/${filename}`, '_blank');
    };

    const getTierBadgeStyle = (tier) => {
        switch (tier) {
            case 'daily':
                return { bg: 'rgba(59,130,246,0.12)', color: '#2563EB', label: 'Daily' };
            case 'weekly':
                return { bg: 'rgba(99,102,241,0.12)', color: '#4F46E5', label: 'Weekly' };
            case 'monthly':
                return { bg: 'rgba(168,85,247,0.12)', color: '#9333EA', label: 'Monthly' };
            case 'semester':
                return { bg: 'rgba(234,179,8,0.12)', color: '#A16207', label: 'Semester' };
            case 'yearly':
                return { bg: 'rgba(249,115,22,0.12)', color: '#EA580C', label: 'Yearly' };
            default:
                return { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)', label: tier };
        }
    };

    return (
        <DashboardLayout>
            <div className="page-header-row">
                <div>
                    <h1>System Backup Infrastructure</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                        Production-grade disaster recovery, multi-tier archiving, and offsite cloud replication.
                    </p>
                </div>
                
                {/* Cloud Status indicator */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 14px', borderRadius: 10,
                    background: status.cloudConfigured ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)',
                    border: `1px solid ${status.cloudConfigured ? 'rgba(34,197,94,0.3)' : 'rgba(107,114,128,0.3)'}`,
                    color: status.cloudConfigured ? '#15803D' : '#4B5563',
                    fontSize: '0.8rem', fontWeight: 700
                }}>
                    <HiOutlineCloudUpload size={18} className={status.cloudConfigured ? 'glow-icon' : ''} />
                    {status.cloudConfigured ? '☁️ S3 CLOUD SYNC: ACTIVE' : '☁️ S3 CLOUD SYNC: OFF-LINE'}
                </div>
            </div>

            {/* Status result banner */}
            {result && (
                <div style={{
                    padding: '14px 18px', borderRadius: 12, marginBottom: 20,
                    background: result.success ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
                    border: `1px solid ${result.success ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}`,
                    color: result.success ? '#15803D' : '#DC2626',
                    fontSize: '0.875rem', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 10,
                }}>
                    {result.success ? <HiOutlineCheckCircle size={18} /> : <HiOutlineExclamationCircle size={18} />}
                    {result.message}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 24, marginBottom: 28 }}>
                
                {/* Manual triggers card */}
                <div style={{
                    borderRadius: 16, padding: '20px 24px',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <HiOutlineAdjustments size={20} color="var(--primary)" />
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Trigger Manual Backup</h3>
                        </div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
                            Select the target storage retention tier and click run. System-wide backups are compressed as all-in-one ZIP packages containing the complete SQL schema dump and student uploaded media files.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 16, marginBottom: 20 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                    RETENTION TIER
                                </label>
                                <select 
                                    value={selectedTier}
                                    onChange={(e) => setSelectedTier(e.target.value)}
                                    className="input-select"
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border)', outline: 'none' }}
                                >
                                    <option value="daily">Daily Backup (30 Days)</option>
                                    <option value="weekly">Weekly Backup (12 Weeks)</option>
                                    <option value="monthly">Monthly Backup (12 Months)</option>
                                    <option value="semester">Semester End Snapshot (Immutable)</option>
                                    <option value="yearly">Academic Year Snapshot (Immutable)</option>
                                </select>
                            </div>

                            {['semester', 'yearly'].includes(selectedTier) && (
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                        SNAPSHOT IDENTIFIER / LABEL
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                                        <HiOutlineTag style={{ position: 'absolute', left: 12, color: 'var(--text-tertiary)' }} size={16} />
                                        <input
                                            type="text"
                                            value={customLabel}
                                            onChange={(e) => setCustomLabel(e.target.value)}
                                            placeholder={selectedTier === 'semester' ? 'e.g., sem_1_final' : 'e.g., academic_2025_2026'}
                                            className="input-text"
                                            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 8, border: '1.5px solid var(--border)', outline: 'none' }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={runBackup}
                        disabled={running}
                        className="btn btn-hod"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '12px', borderRadius: 8 }}
                    >
                        <HiOutlineRefresh size={18} style={{ animation: running ? 'spin 1s linear infinite' : 'none' }} />
                        {running ? `Executing ${selectedTier.toUpperCase()} backup...` : `Initiate ${selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)} Backup`}
                    </button>
                </div>

                {/* Tier details and works card */}
                <div style={{
                    borderRadius: 16, padding: '20px 24px',
                    background: 'rgba(26,60,110,0.04)', border: '1px solid rgba(26,60,110,0.15)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <HiOutlineDatabase size={20} color="#1A3C6E" />
                            <h3 style={{ margin: 0, fontSize: '1rem', color: '#1A3C6E', fontWeight: 700 }}>Infrastructure Rules</h3>
                        </div>
                        <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
                            <li style={{ marginBottom: 6 }}>
                                <strong>Daily Backups:</strong> Automated daily cycle at 2:00 AM. Maintains the last 30 daily zip archives.
                            </li>
                            <li style={{ marginBottom: 6 }}>
                                <strong>Weekly Backups:</strong> Automated weekly cycle on Sundays at 3:00 AM. Retains the last 12 weeks.
                            </li>
                            <li style={{ marginBottom: 6 }}>
                                <strong>Monthly Backups:</strong> Automated monthly cycle on the 1st at 4:00 AM. Retains the last 12 months.
                            </li>
                            <li style={{ marginBottom: 6 }}>
                                <strong>Semester & Yearly Snapshots:</strong> Immutable, long-term archives. Protected from automated rotation systems (never pruned).
                            </li>
                        </ul>
                    </div>
                    
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', borderTop: '1px solid rgba(26,60,110,0.15)', paddingTop: 10, marginTop: 10 }}>
                        💡 Offsite S3 backups are pushed immediately upon generation to guarantee absolute recovery capability during severe hardware malfunctions.
                    </div>
                </div>

            </div>

            {/* Backup list */}
            <div style={{
                borderRadius: 16, overflow: 'hidden',
                background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
            }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        Backup Archive Repositories
                    </span>
                    <span style={{
                        fontSize: '0.72rem', fontWeight: 600, padding: '2px 10px', borderRadius: 100,
                        background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                    }}>{backups.length} archives available</span>
                </div>

                {loading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</div>
                ) : backups.length === 0 ? (
                    <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                        <HiOutlineDatabase size={36} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
                        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>No backups generated yet.</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Filename</th>
                                <th>Tier</th>
                                <th>Created At</th>
                                <th>Size</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {backups.map((b, i) => {
                                const style = getTierBadgeStyle(b.tier);
                                return (
                                    <tr key={b.file}>
                                        <td data-label="Filename">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                {i === 0 && (
                                                    <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: 100, background: 'rgba(22,163,74,0.12)', color: '#15803D', fontWeight: 700 }}>
                                                        Latest
                                                    </span>
                                                )}
                                                <code style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{b.file}</code>
                                            </div>
                                        </td>
                                        <td data-label="Tier">
                                            <span style={{
                                                fontSize: '0.7rem', fontWeight: 700,
                                                padding: '3px 8px', borderRadius: 6,
                                                background: style.bg, color: style.color
                                            }}>
                                                {style.label}
                                            </span>
                                        </td>
                                        <td data-label="Created At">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                                                <HiOutlineClock size={13} />
                                                {fmtDate(b.created_at)}
                                            </div>
                                        </td>
                                        <td data-label="Size">
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.83rem' }}>{b.size}</span>
                                        </td>
                                        <td data-label="Action">
                                            <button
                                                onClick={() => downloadBackup(b.tier, b.file)}
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                                    padding: '5px 12px', borderRadius: 7,
                                                    border: '1.5px solid var(--border)',
                                                    background: 'var(--bg-secondary)',
                                                    color: 'var(--text-primary)',
                                                    fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                                                }}
                                            >
                                                <HiOutlineDownload size={13} /> Download
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                .glow-icon {
                    filter: drop-shadow(0 0 4px #22C55E);
                }
            `}</style>
        </DashboardLayout>
    );
}
