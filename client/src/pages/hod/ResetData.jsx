import { useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import Modal from '../../components/Modal';
import api from '../../utils/api';

const DATA_ITEMS = [
    {
        key: 'clear_attendance',
        label: 'Attendance Records',
        desc: 'All attendance entries and session logs for the selected year',
        icon: '📋',
        danger: true,
    },
    {
        key: 'clear_marks',
        label: 'Marks',
        desc: 'All mid-term, end-term and internal marks entered by faculty',
        icon: '📝',
        danger: true,
    },
    {
        key: 'clear_grades',
        label: 'Grades',
        desc: 'Computed grade records (A, B, C… / F) for the selected year',
        icon: '🎯',
        danger: true,
    },
    {
        key: 'clear_cgpa',
        label: 'CGPA / SGPA & Grades',
        desc: 'Clears CGPA/SGPA entries AND grade records (both are needed — grades are used as fallback for CGPA display)',
        icon: '📊',
        danger: true,
    },
    {
        key: 'clear_backlogs',
        label: 'Backlogs',
        desc: 'Active backlog records for students in the selected year',
        icon: '⚠️',
        danger: false,
    },
    {
        key: 'clear_notices',
        label: 'HOD Notices',
        desc: 'All notices posted by your department (not principal notices)',
        icon: '📢',
        danger: false,
    },
    {
        key: 'clear_placements',
        label: 'HOD Placements',
        desc: 'Placement jobs posted by your department',
        icon: '💼',
        danger: false,
    },
];

const YEAR_LABELS = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };

export default function ResetData() {
    const [year, setYear]           = useState('');
    const [checks, setChecks]       = useState({});
    const [showConfirm, setShowConfirm] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [resetting, setResetting] = useState(false);
    const [result, setResult]       = useState(null);

    const allChecked = DATA_ITEMS.every(d => checks[d.key]);
    const anyChecked = DATA_ITEMS.some(d => checks[d.key]);
    const selectedItems = DATA_ITEMS.filter(d => checks[d.key]);

    const toggleAll = () => {
        if (allChecked) setChecks({});
        else {
            const all = {};
            DATA_ITEMS.forEach(d => { all[d.key] = true; });
            setChecks(all);
        }
    };
    const toggle = key => setChecks(c => ({ ...c, [key]: !c[key] }));

    const openConfirm = () => {
        if (!year)       return alert('Please select a year first.');
        if (!anyChecked) return alert('Please select at least one data type to clear.');
        setConfirmText('');
        setResult(null);
        setShowConfirm(true);
    };

    const doReset = async () => {
        if (confirmText !== 'RESET') return alert('Type RESET to confirm.');
        setResetting(true);
        try {
            const body = { year: Number(year), ...checks };
            const r = await api.post('/hod/reset-data', body);
            setResult(r.data);
            setShowConfirm(false);
            setChecks({});
            setYear('');
        } catch (err) {
            alert(err.response?.data?.error || 'Reset failed');
        } finally {
            setResetting(false);
        }
    };

    return (
        <DashboardLayout>
            <style>{`@keyframes fadeSlide{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '1.4rem',
                        background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)',
                    }}>🗑️</div>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                            Academic Data Reset
                        </h1>
                        <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', margin: 0 }}>
                            Clear specific academic records for a year-group before starting a new semester.
                        </p>
                    </div>
                </div>
            </div>

            {/* Warning banner */}
            <div style={{
                padding: '14px 18px', borderRadius: 12, marginBottom: 24,
                background: 'rgba(220,38,38,0.07)', border: '1.5px solid rgba(220,38,38,0.25)',
                display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
                <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>⛔</span>
                <div style={{ fontSize: '0.83rem', color: '#991B1B', lineHeight: 1.7 }}>
                    <strong>This action is permanent and cannot be undone.</strong><br />
                    All selected records will be deleted from the database. Use this only for new academic year resets after promoting students.
                    Student accounts are <strong>not</strong> affected.
                </div>
            </div>

            {/* Result banner */}
            {result && (
                <div style={{
                    padding: '14px 18px', borderRadius: 12, marginBottom: 22,
                    background: 'rgba(22,163,74,0.09)', border: '1.5px solid rgba(22,163,74,0.28)',
                    animation: 'fadeSlide 0.3s ease',
                }}>
                    <p style={{ fontWeight: 700, color: '#15803D', margin: '0 0 6px', fontSize: '0.9rem' }}>✅ Reset completed successfully!</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {Object.entries(result.summary || {}).map(([k, v]) => (
                            <span key={k} style={{ padding: '3px 12px', borderRadius: 100, fontSize: '0.72rem', fontWeight: 700, background: 'rgba(22,163,74,0.12)', color: '#166534' }}>
                                {k.replace(/_/g, ' ')}: {v} deleted
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
                {/* Left — year + checkboxes */}
                <div>
                    {/* Year selector */}
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', marginBottom: 18 }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                            Select Year *
                        </label>
                        <select className="form-input" value={year} onChange={e => setYear(e.target.value)}>
                            <option value="">Choose which year to clear…</option>
                            <option value="1">1st Year</option>
                            <option value="2">2nd Year</option>
                            <option value="3">3rd Year</option>
                            <option value="4">4th Year</option>
                        </select>
                        {year && (
                            <p style={{ fontSize: '0.75rem', color: '#D97706', marginTop: 8, margin: '8px 0 0' }}>
                                ⚠️ Will affect all active <strong>{YEAR_LABELS[year]}</strong> students in your department.
                            </p>
                        )}
                    </div>

                    {/* Checkboxes */}
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Data to Clear
                            </label>
                            <button onClick={toggleAll} style={{
                                fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                                padding: '4px 12px', borderRadius: 8,
                                border: '1.5px solid var(--border)',
                                background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                            }}>
                                {allChecked ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {DATA_ITEMS.map(item => (
                                <label key={item.key} onClick={() => toggle(item.key)} style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
                                    padding: '12px 14px', borderRadius: 10, transition: 'all 0.15s',
                                    background: checks[item.key]
                                        ? item.danger ? 'rgba(220,38,38,0.07)' : 'rgba(37,99,235,0.06)'
                                        : 'var(--bg-secondary)',
                                    border: `1.5px solid ${checks[item.key]
                                        ? item.danger ? 'rgba(220,38,38,0.3)' : 'rgba(37,99,235,0.25)'
                                        : 'var(--border)'}`,
                                }}>
                                    {/* Checkbox */}
                                    <div style={{
                                        width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
                                        border: `2px solid ${checks[item.key]
                                            ? item.danger ? '#DC2626' : '#2563EB'
                                            : 'var(--border)'}`,
                                        background: checks[item.key]
                                            ? item.danger ? '#DC2626' : '#2563EB'
                                            : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: 'all 0.15s',
                                    }}>
                                        {checks[item.key] && <span style={{ color: 'white', fontSize: '0.65rem', fontWeight: 900 }}>✓</span>}
                                    </div>
                                    <span style={{ fontSize: '1rem', flexShrink: 0 }}>{item.icon}</span>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.87rem', color: 'var(--text-primary)' }}>{item.label}</p>
                                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right — summary + action */}
                <div style={{ position: 'sticky', top: 80 }}>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px', marginBottom: 16 }}>
                        <p style={{ fontWeight: 800, fontSize: '0.87rem', color: 'var(--text-primary)', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Reset Summary
                        </p>

                        <div style={{ marginBottom: 14 }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: '0 0 6px', fontWeight: 600 }}>YEAR</p>
                            <p style={{ fontWeight: 700, color: year ? 'var(--text-primary)' : 'var(--text-tertiary)', margin: 0, fontSize: '0.9rem' }}>
                                {year ? `${YEAR_LABELS[year]} students` : 'Not selected'}
                            </p>
                        </div>

                        <div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: '0 0 8px', fontWeight: 600 }}>DATA TO BE CLEARED</p>
                            {selectedItems.length === 0 ? (
                                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', margin: 0 }}>None selected</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {selectedItems.map(item => (
                                        <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: '0.85rem' }}>{item.icon}</span>
                                            <span style={{
                                                fontSize: '0.8rem', fontWeight: 600,
                                                color: item.danger ? '#DC2626' : 'var(--text-primary)',
                                            }}>{item.label}</span>
                                            {item.danger && <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: 100, background: 'rgba(220,38,38,0.1)', color: '#DC2626', fontWeight: 700 }}>HIGH RISK</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action button */}
                    <button
                        onClick={openConfirm}
                        disabled={!year || !anyChecked}
                        style={{
                            width: '100%', padding: '14px 0', borderRadius: 12,
                            fontWeight: 800, fontSize: '0.95rem', cursor: !year || !anyChecked ? 'not-allowed' : 'pointer',
                            border: 'none',
                            background: !year || !anyChecked
                                ? 'var(--bg-secondary)'
                                : 'linear-gradient(135deg,#DC2626,#B91C1C)',
                            color: !year || !anyChecked ? 'var(--text-tertiary)' : 'white',
                            transition: 'all 0.2s',
                            boxShadow: year && anyChecked ? '0 4px 16px rgba(220,38,38,0.3)' : 'none',
                        }}
                    >
                        🗑️ Clear Selected Data
                    </button>
                    <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 8 }}>
                        You'll be asked to confirm before anything is deleted.
                    </p>
                </div>
            </div>

            {/* Confirmation modal */}
            <Modal isOpen={showConfirm} onClose={() => !resetting && setShowConfirm(false)} title="⛔ Confirm Data Reset">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', fontSize: '0.83rem', color: '#991B1B', lineHeight: 1.7 }}>
                        You are about to permanently delete <strong>{selectedItems.length} data type(s)</strong> for all
                        active <strong>{YEAR_LABELS[year]}</strong> students. This <strong>cannot be undone</strong>.
                    </div>

                    <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 14px' }}>
                        <p style={{ margin: '0 0 6px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Will delete:</p>
                        {selectedItems.map(item => (
                            <div key={item.key} style={{ fontSize: '0.82rem', color: item.danger ? '#DC2626' : 'var(--text-primary)', padding: '2px 0', fontWeight: item.danger ? 700 : 500 }}>
                                {item.icon} {item.label}
                            </div>
                        ))}
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                            Type <code style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626', padding: '1px 6px', borderRadius: 4 }}>RESET</code> to confirm:
                        </label>
                        <input
                            className="form-input"
                            placeholder="Type RESET here…"
                            value={confirmText}
                            onChange={e => setConfirmText(e.target.value)}
                            autoFocus
                            style={{ borderColor: confirmText === 'RESET' ? '#DC2626' : undefined }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
                        <button className="btn btn-outline" onClick={() => setShowConfirm(false)} disabled={resetting}>Cancel</button>
                        <button
                            disabled={confirmText !== 'RESET' || resetting}
                            onClick={doReset}
                            style={{
                                padding: '10px 24px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: '0.875rem', cursor: confirmText !== 'RESET' || resetting ? 'not-allowed' : 'pointer',
                                background: confirmText === 'RESET' ? '#DC2626' : 'var(--bg-secondary)',
                                color: confirmText === 'RESET' ? 'white' : 'var(--text-tertiary)',
                                transition: 'all 0.15s',
                            }}
                        >
                            {resetting ? 'Resetting…' : '🗑️ Yes, Delete Permanently'}
                        </button>
                    </div>
                </div>
            </Modal>
        </DashboardLayout>
    );
}
