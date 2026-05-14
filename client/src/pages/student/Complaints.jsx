import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';

const STATUS_STYLES = {
    submitted:   { bg: 'rgba(245,158,11,0.12)',  color: '#D97706',  label: 'Submitted',   icon: '📋' },
    in_progress: { bg: 'rgba(59,130,246,0.12)',  color: '#2563EB',  label: 'In Progress', icon: '🔄' },
    resolved:    { bg: 'rgba(22,163,74,0.12)',   color: '#15803D',  label: 'Resolved',    icon: '✅' },
    rejected:    { bg: 'rgba(220,38,38,0.1)',    color: '#DC2626',  label: 'Rejected',    icon: '❌' },
    under_review:{ bg: 'rgba(59,130,246,0.12)',  color: '#2563EB',  label: 'In Progress', icon: '🔄' },
    dismissed:   { bg: 'rgba(107,114,128,0.1)',  color: '#6B7280',  label: 'Rejected',    icon: '❌' },
};

function StatusBadge({ status }) {
    const s = STATUS_STYLES[status] || STATUS_STYLES.submitted;
    return (
        <span style={{
            padding: '3px 10px', borderRadius: 100, fontSize: '0.72rem',
            fontWeight: 600, background: s.bg, color: s.color, display: 'inline-flex',
            alignItems: 'center', gap: 4,
        }}>
            {s.icon} {s.label}
        </span>
    );
}

function PortalBanner({ type, data, isOpen }) {
    if (!data) return null;
    const isPrincipal = type === 'principal';
    const color = isPrincipal ? '#B71C1C' : '#2E7D32';
    const lightBg = isPrincipal ? 'rgba(183,28,28,0.05)' : 'rgba(46,125,50,0.05)';
    const border = isPrincipal ? 'rgba(183,28,28,0.18)' : 'rgba(46,125,50,0.18)';
    const icon = isOpen ? (isPrincipal ? '🏫' : '🎓') : '🔒';
    const label = isPrincipal ? 'Principal' : (data.opened_by || 'HOD');

    return (
        <div style={{
            borderRadius: 12, padding: '14px 20px',
            background: isOpen ? lightBg : 'rgba(107,114,128,0.04)',
            border: `1px solid ${isOpen ? border : 'rgba(107,114,128,0.15)'}`,
            display: 'flex', alignItems: 'center', gap: 12, flex: 1,
        }}>
            <span style={{ fontSize: '1.6rem' }}>{icon}</span>
            <div style={{ flex: 1 }}>
                <p style={{
                    fontSize: '0.85rem', fontWeight: 700,
                    color: isOpen ? color : 'var(--text-secondary)',
                    marginBottom: 2,
                }}>
                    {label} — Portal {isOpen ? 'OPEN' : 'CLOSED'}
                </p>
                {isOpen && data.current_window && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Closes {new Date(data.current_window.close_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                    </p>
                )}
                {!isOpen && data.next_window && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Next: {new Date(data.next_window.open_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                    </p>
                )}
            </div>
            {isOpen && (
                <span style={{
                    padding: '3px 10px', borderRadius: 20,
                    fontSize: '0.68rem', fontWeight: 700,
                    background: isOpen ? (isPrincipal ? 'rgba(183,28,28,0.12)' : 'rgba(46,125,50,0.12)') : 'transparent',
                    color,
                }}>OPEN</span>
            )}
        </div>
    );
}

export default function StudentComplaints() {
    const [windowData, setWindowData] = useState(null);
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [title, setTitle] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [portalType, setPortalType] = useState('principal'); // which portal to submit to
    const [submitting, setSubmitting] = useState(false);
    const [tab, setTab] = useState('list'); // 'list' | 'submit'
    const [expandedId, setExpandedId] = useState(null);
    const [lastRefreshed, setLastRefreshed] = useState(null);
    const pollRef = useRef(null);

    useEffect(() => {
        load();
        pollRef.current = setInterval(() => { silentRefresh(); }, 30000);
        return () => clearInterval(pollRef.current);
    }, []);

    const load = async () => {
        try {
            const [wRes, cRes] = await Promise.all([
                api.get('/student/complaint/window'),
                api.get('/student/complaints').catch(() => ({ data: { complaints: [] } })),
            ]);
            setWindowData(wRes.data);
            setComplaints(cRes.data.complaints || []);
            setLastRefreshed(new Date());

            // Auto-select the open portal for submission
            const wd = wRes.data;
            if (wd?.hod?.is_open && !wd?.principal?.is_open) setPortalType('hod');
            else setPortalType('principal');
        } catch { }
        finally { setLoading(false); }
    };

    const silentRefresh = async () => {
        try {
            const [wRes, cRes] = await Promise.all([
                api.get('/student/complaint/window'),
                api.get('/student/complaints').catch(() => ({ data: { complaints: [] } })),
            ]);
            setWindowData(wRes.data);
            setComplaints(cRes.data.complaints || []);
            setLastRefreshed(new Date());
        } catch { }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim()) return;
        setSubmitting(true);
        try {
            const r = await api.post('/student/complaint', {
                title: title || 'General Complaint',
                message,
                is_anonymous: isAnonymous,
                portal_type: portalType,
            });
            const portalLabel = portalType === 'hod' ? 'HOD' : 'Principal';
            alert(`Complaint submitted to ${portalLabel}!\nReference: ${r.data.complaint_ref}`);
            setMessage(''); setTitle(''); setIsAnonymous(false);
            setTab('list');
            load();
        } catch (err) {
            console.error('Submit complaint error:', err.response?.data || err.message);
            alert(err.response?.data?.error || 'Error submitting complaint');
        }
        finally { setSubmitting(false); }
    };

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    const principalData = windowData?.principal || { is_open: false };
    const hodData = windowData?.hod || { is_open: false };
    const anyOpen = principalData.is_open || hodData.is_open;
    const bothOpen = principalData.is_open && hodData.is_open;

    return (
        <DashboardLayout>
            {/* Page Header */}
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    📣 Complaint Portal
                </h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    Submit and track complaints — view status updates from administration
                </p>
            </div>

            {/* Dual Portal Status Banners */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                <PortalBanner type="principal" data={principalData} isOpen={principalData.is_open} />
                <PortalBanner type="hod" data={hodData} isOpen={hodData.is_open} />
            </div>

            {/* Tabs + live indicator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-secondary)', width: 'fit-content' }}>
                    {[
                        { key: 'list', label: `📋 My Complaints (${complaints.length})` },
                        ...(anyOpen ? [{ key: 'submit', label: '+ Submit New Complaint' }] : []),
                    ].map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)} style={{
                            padding: '9px 20px', border: 'none', cursor: 'pointer',
                            fontSize: '0.85rem', fontWeight: tab === t.key ? 700 : 500,
                            background: tab === t.key ? 'var(--student)' : 'transparent',
                            color: tab === t.key ? 'white' : 'var(--text-secondary)',
                            transition: 'all 0.2s',
                        }}>{t.label}</button>
                    ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                        <span style={{
                            width: 7, height: 7, borderRadius: '50%', background: '#22C55E',
                            boxShadow: '0 0 0 2px rgba(34,197,94,0.25)', animation: 'pulse 2s infinite', display: 'inline-block',
                        }} />
                        Live · updates every 30s
                        {lastRefreshed && ` · ${lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                    </span>
                    <button onClick={silentRefresh} style={{
                        background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                        padding: '3px 10px', cursor: 'pointer', fontSize: '0.72rem',
                        color: 'var(--text-secondary)', fontWeight: 600,
                    }}>↻ Refresh</button>
                </div>
            </div>

            {/* My Complaints List */}
            {tab === 'list' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {complaints.length === 0 ? (
                        <div style={{
                            borderRadius: 14, padding: '48px 24px', textAlign: 'center',
                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                        }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📭</div>
                            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>No complaints submitted yet</p>
                            {anyOpen && (
                                <button onClick={() => setTab('submit')} className="btn btn-student" style={{ marginTop: 16 }}>
                                    Submit Your First Complaint
                                </button>
                            )}
                        </div>
                    ) : (
                        complaints.map(c => {
                            const s = STATUS_STYLES[c.status] || STATUS_STYLES.submitted;
                            const expanded = expandedId === c.id;
                            const isHod = c.portal_type === 'hod';
                            return (
                                <div key={c.id} style={{
                                    borderRadius: 12, background: 'var(--bg-card)',
                                    border: '1px solid var(--border)',
                                    boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
                                }}>
                                    <div style={{ height: 3, background: s.color }} />
                                    <div style={{ padding: '16px 20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: 4 }}>
                                                    {c.title || c.complaint_ref}
                                                </p>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    <span>🔖 {c.complaint_ref}</span>
                                                    <span>📅 {new Date(c.submitted_at).toLocaleDateString('en-IN')}</span>
                                                    {/* Portal badge */}
                                                    <span style={{
                                                        padding: '1px 8px', borderRadius: 20, fontSize: '0.68rem', fontWeight: 700,
                                                        background: isHod ? 'rgba(46,125,50,0.1)' : 'rgba(183,28,28,0.08)',
                                                        color: isHod ? '#2E7D32' : '#B71C1C',
                                                    }}>
                                                        {isHod ? '🎓 HOD' : '🏫 Principal'}
                                                    </span>
                                                    {c.updated_at && c.updated_at !== c.submitted_at && (
                                                        <span>🔄 Updated {new Date(c.updated_at).toLocaleDateString('en-IN')}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                                                <StatusBadge status={c.status} />
                                                <button onClick={() => setExpandedId(expanded ? null : c.id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, padding: 0 }}>
                                                    {expanded ? '▲ Less' : '▼ Details'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expanded details */}
                                        {expanded && (
                                            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
                                                <div style={{
                                                    padding: 14, borderRadius: 8,
                                                    background: 'var(--bg-secondary)', border: '1px solid var(--border-light)',
                                                    fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 12,
                                                }}>
                                                    {c.message}
                                                </div>
                                                {c.admin_notes && (
                                                    <div style={{
                                                        padding: 12, borderRadius: 8,
                                                        background: `${s.bg}`, border: `1px solid ${s.color}33`,
                                                    }}>
                                                        <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: s.color, marginBottom: 4 }}>
                                                            {isHod ? 'HOD' : 'Admin'} Remarks
                                                        </p>
                                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                                                            {c.admin_notes}
                                                        </p>
                                                    </div>
                                                )}
                                                {!c.admin_notes && c.status === 'submitted' && (
                                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                                        ⏳ Awaiting review by {isHod ? 'HOD' : 'administration'}...
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Submit Complaint Form */}
            {tab === 'submit' && anyOpen && (
                <div style={{
                    borderRadius: 14, padding: 24,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-sm)', maxWidth: 640,
                }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
                        Submit a New Complaint
                    </h2>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {/* Portal selector — only show if BOTH are open */}
                        {bothOpen && (
                            <div className="form-group">
                                <label className="form-label">Submit To <span className="required">*</span></label>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    {[
                                        { value: 'principal', label: '🏫 Principal', color: '#B71C1C' },
                                        { value: 'hod', label: '🎓 HOD (Department)', color: '#2E7D32' },
                                    ].map(opt => (
                                        <label key={opt.value} style={{
                                            flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                                            border: `2px solid ${portalType === opt.value ? opt.color : 'var(--border)'}`,
                                            background: portalType === opt.value ? `${opt.color}0d` : 'var(--bg-secondary)',
                                            transition: 'all 0.15s',
                                        }}>
                                            <input type="radio" name="portal_type" value={opt.value}
                                                checked={portalType === opt.value}
                                                onChange={() => setPortalType(opt.value)}
                                                style={{ accentColor: opt.color }} />
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: portalType === opt.value ? opt.color : 'var(--text-primary)' }}>
                                                {opt.label}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Show which portal will receive (when only one is open) */}
                        {!bothOpen && (
                            <div style={{
                                padding: '10px 14px', borderRadius: 8,
                                background: portalType === 'hod' ? 'rgba(46,125,50,0.06)' : 'rgba(183,28,28,0.06)',
                                border: `1px solid ${portalType === 'hod' ? 'rgba(46,125,50,0.2)' : 'rgba(183,28,28,0.2)'}`,
                                fontSize: '0.82rem', color: 'var(--text-secondary)',
                            }}>
                                This complaint will be submitted to the{' '}
                                <strong style={{ color: portalType === 'hod' ? '#2E7D32' : '#B71C1C' }}>
                                    {portalType === 'hod' ? '🎓 HOD' : '🏫 Principal'}
                                </strong>
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Complaint Title <span className="required">*</span></label>
                            <input
                                className="form-input"
                                placeholder="e.g. Infrastructure Issue, Faculty Concern, etc."
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                required
                                maxLength={120}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Complaint Details <span className="required">*</span></label>
                            <textarea
                                className="form-input"
                                placeholder="Describe your complaint in detail (max 2000 characters)..."
                                rows={6}
                                maxLength={2000}
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                required
                            />
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textAlign: 'right', marginTop: 4 }}>
                                {message.length}/2000
                            </p>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            <input
                                type="checkbox"
                                checked={isAnonymous}
                                onChange={e => setIsAnonymous(e.target.checked)}
                                style={{ width: 16, height: 16, borderRadius: 4 }}
                            />
                            Submit anonymously (your identity will not be visible to admin)
                        </label>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-outline" onClick={() => setTab('list')}>Cancel</button>
                            <button type="submit" disabled={submitting} className="btn btn-student">
                                {submitting ? 'Submitting...' : '📤 Submit Complaint'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {tab === 'submit' && !anyOpen && (
                <div style={{
                    borderRadius: 14, padding: '40px 24px', textAlign: 'center',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔒</div>
                    <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>No complaint portal is currently open</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 8 }}>
                        Please wait for the Principal or HOD to open the complaint window.
                    </p>
                </div>
            )}
        </DashboardLayout>
    );
}
