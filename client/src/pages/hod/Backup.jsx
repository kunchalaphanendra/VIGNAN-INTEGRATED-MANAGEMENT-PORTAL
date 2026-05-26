import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../utils/api';
import { HiOutlineDatabase, HiOutlineDownload, HiOutlineRefresh, HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlineClock } from 'react-icons/hi';

function fmtDate(iso) {
    try { return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return iso; }
}

export default function BackupPage() {
    const [backups,  setBackups]  = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [running,  setRunning]  = useState(false);
    const [result,   setResult]   = useState(null); // { success, message }

    const load = async () => {
        try {
            const res = await api.get('/backup/list');
            setBackups(res.data.backups || []);
        } catch { setBackups([]); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const runBackup = async () => {
        setRunning(true);
        setResult(null);
        try {
            const res = await api.post('/backup/run');
            setResult({ success: true, message: `✅ ${res.data.message} — ${res.data.file} (${res.data.size})` });
            load();
        } catch (err) {
            setResult({ success: false, message: `❌ Backup failed: ${err.response?.data?.error || err.message}` });
        } finally { setRunning(false); }
    };

    const downloadBackup = (filename) => {
        // Open the download URL directly
        const base = api.defaults?.baseURL || '/api';
        window.open(`${base}/backup/download/${filename}`, '_blank');
    };

    return (
        <DashboardLayout>
            <div className="page-header-row">
                <div>
                    <h1>Database Backup</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                        Protect all academic data — attendance, marks, student records
                    </p>
                </div>
                <button
                    onClick={runBackup}
                    disabled={running}
                    className="btn btn-hod"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: running ? 0.7 : 1 }}
                >
                    <HiOutlineRefresh size={16} style={{ animation: running ? 'spin 1s linear infinite' : 'none' }} />
                    {running ? 'Creating Backup…' : 'Backup Now'}
                </button>
            </div>

            {/* Status banner */}
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

            {/* Info card */}
            <div style={{
                borderRadius: 14, padding: '18px 22px', marginBottom: 24,
                background: 'rgba(26,60,110,0.06)', border: '1px solid rgba(26,60,110,0.18)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <HiOutlineDatabase size={20} color="#1A3C6E" />
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>How it works</span>
                </div>
                <ul style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20 }}>
                    <li>Auto-backup runs every night at <strong>2:00 AM IST</strong></li>
                    <li>Each backup is a complete <code>.sql</code> dump of all tables</li>
                    <li>The last <strong>30 backups</strong> are kept automatically (older ones deleted)</li>
                    <li>Download any backup below to store it safely on your PC or Google Drive</li>
                </ul>
            </div>

            {/* Backup list */}
            <div style={{
                borderRadius: 16, overflow: 'hidden',
                background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
            }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        Backup History
                    </span>
                    <span style={{
                        fontSize: '0.72rem', fontWeight: 600, padding: '2px 10px', borderRadius: 100,
                        background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                    }}>{backups.length} backups stored</span>
                </div>

                {loading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</div>
                ) : backups.length === 0 ? (
                    <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                        <HiOutlineDatabase size={36} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
                        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>No backups yet. Click <strong>Backup Now</strong> to create your first one.</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Filename</th>
                                <th>Created At</th>
                                <th>Size</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {backups.map((b, i) => (
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
                                            onClick={() => downloadBackup(b.file)}
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
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </DashboardLayout>
    );
}
