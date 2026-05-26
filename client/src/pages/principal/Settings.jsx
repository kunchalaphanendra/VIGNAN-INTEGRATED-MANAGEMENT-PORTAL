import { useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../utils/api';
import { HiOutlineExclamationCircle, HiOutlineShieldExclamation, HiOutlineCheckCircle } from 'react-icons/hi';

export default function PrincipalSettings() {
    const [attConfirm, setAttConfirm] = useState('');
    const [acadConfirm, setAcadConfirm] = useState('');
    const [loadingAtt, setLoadingAtt] = useState(false);
    const [loadingAcad, setLoadingAcad] = useState(false);
    const [msg, setMsg] = useState({ text: '', type: '' });

    const handleAttReset = async () => {
        if (attConfirm !== 'RESET') {
            setMsg({ text: 'You must type RESET exactly to confirm.', type: 'error' });
            return;
        }
        if (!window.confirm('WARNING: This will permanently delete ALL attendance records for ALL students. This action CANNOT be undone. Proceed?')) return;
        const password = window.prompt('Please enter your administrator password to confirm:');
        if (!password) return;
        
        setLoadingAtt(true); setMsg({ text: '', type: '' });
        try {
            const res = await api.delete('/principal/reset-attendance', { data: { confirmation: attConfirm, password } });
            setMsg({ text: res.data.message, type: 'success' });
            setAttConfirm('');
        } catch (e) {
            setMsg({ text: e.response?.data?.error || 'Failed to reset attendance', type: 'error' });
        } finally {
            setLoadingAtt(false);
        }
    };

    const handleAcadReset = async () => {
        if (acadConfirm !== 'RESET') {
            setMsg({ text: 'You must type RESET exactly to confirm.', type: 'error' });
            return;
        }
        if (!window.confirm('WARNING: This will permanently delete ALL academic records (marks, grades, projects) for ALL students. Profiles will remain. Proceed?')) return;
        const password = window.prompt('Please enter your administrator password to confirm:');
        if (!password) return;
        
        setLoadingAcad(true); setMsg({ text: '', type: '' });
        try {
            const res = await api.delete('/principal/reset-academics', { data: { confirmation: acadConfirm, password } });
            setMsg({ text: res.data.message, type: 'success' });
            setAcadConfirm('');
        } catch (e) {
            setMsg({ text: e.response?.data?.error || 'Failed to reset academics', type: 'error' });
        } finally {
            setLoadingAcad(false);
        }
    };

    return (
        <DashboardLayout>
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <HiOutlineShieldExclamation size={26} color="#B71C1C" />
                    System Settings & Data Reset
                </h1>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                    Manage core system data. <strong style={{ color: '#B71C1C' }}>Warning: These actions are destructive and cannot be undone.</strong>
                </p>
            </div>

            {msg.text && (
                <div style={{
                    marginBottom: 24, padding: "14px 20px", borderRadius: 10,
                    display: "flex", alignItems: "center", gap: 10, fontSize: "0.9rem", fontWeight: 600,
                    background: msg.type === "success" ? "rgba(22,163,74,0.1)" : "rgba(183,28,28,0.1)",
                    color: msg.type === "success" ? "#15803D" : "#B71C1C",
                    border: `1px solid ${msg.type === "success" ? "rgba(22,163,74,0.2)" : "rgba(183,28,28,0.2)"}`
                }}>
                    {msg.type === "success" ? <HiOutlineCheckCircle size={20} /> : <HiOutlineExclamationCircle size={20} />}
                    {msg.text}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
                
                {/* Reset Attendance Card */}
                <div style={{
                    background: 'var(--bg-card)', border: '1px solid rgba(183,28,28,0.2)', borderRadius: 14, padding: 24,
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Reset All Attendance</h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
                        This will delete <b>all attendance records</b> for <b>all students across all departments</b>. Use this only at the beginning of a new academic year or semester. Student profiles and assignments will remain intact.
                    </p>
                    <div style={{ background: 'rgba(183,28,28,0.04)', padding: 16, borderRadius: 10, marginBottom: 20 }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                            Type <b>RESET</b> to confirm:
                        </label>
                        <input 
                            type="text" 
                            className="form-input" 
                            value={attConfirm} 
                            onChange={e => setAttConfirm(e.target.value)} 
                            placeholder="RESET"
                            style={{ borderColor: attConfirm === 'RESET' ? '#B71C1C' : 'var(--border)' }}
                        />
                    </div>
                    <button 
                        onClick={handleAttReset} 
                        disabled={loadingAtt || attConfirm !== 'RESET'}
                        style={{
                            width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                            background: attConfirm === 'RESET' ? '#B71C1C' : 'var(--border)',
                            color: attConfirm === 'RESET' ? 'white' : 'var(--text-tertiary)',
                            fontWeight: 700, fontSize: '0.9rem', cursor: attConfirm === 'RESET' ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8
                        }}
                    >
                        <HiOutlineExclamationCircle size={18} />
                        {loadingAtt ? 'Resetting...' : 'Permanently Reset Attendance'}
                    </button>
                </div>

                {/* Reset Academics Card */}
                <div style={{
                    background: 'var(--bg-card)', border: '1px solid rgba(183,28,28,0.2)', borderRadius: 14, padding: 24,
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Reset Student Academics</h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
                        This will delete <b>all marks, grades, leaves, and projects</b> for all students. 
                        User accounts, login credentials, and basic profiles will <b>not</b> be deleted.
                    </p>
                    <div style={{ background: 'rgba(183,28,28,0.04)', padding: 16, borderRadius: 10, marginBottom: 20 }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                            Type <b>RESET</b> to confirm:
                        </label>
                        <input 
                            type="text" 
                            className="form-input" 
                            value={acadConfirm} 
                            onChange={e => setAcadConfirm(e.target.value)} 
                            placeholder="RESET"
                            style={{ borderColor: acadConfirm === 'RESET' ? '#B71C1C' : 'var(--border)' }}
                        />
                    </div>
                    <button 
                        onClick={handleAcadReset} 
                        disabled={loadingAcad || acadConfirm !== 'RESET'}
                        style={{
                            width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                            background: acadConfirm === 'RESET' ? '#B71C1C' : 'var(--border)',
                            color: acadConfirm === 'RESET' ? 'white' : 'var(--text-tertiary)',
                            fontWeight: 700, fontSize: '0.9rem', cursor: acadConfirm === 'RESET' ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8
                        }}
                    >
                        <HiOutlineExclamationCircle size={18} />
                        {loadingAcad ? 'Resetting...' : 'Permanently Reset Academics'}
                    </button>
                </div>

            </div>
        </DashboardLayout>
    );
}
