import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import DataTable from '../../components/DataTable';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';

export default function FacultyStudentLeaves() {
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => { load(); }, []);
    const load = async () => { try { const r = await api.get('/faculty/student-leaves'); setLeaves(r.data.leaves); } catch { } finally { setLoading(false); } };
    const handleAction = async (id, status) => {
        const remarks = prompt('Remarks (optional):');
        try { await api.patch(`/faculty/student-leaves/${id}`, { status, remarks }); load(); } catch { }
    };

    const statusStyles = {
        pending: { bg: 'rgba(245,158,11,0.12)', color: '#D97706' },
        approved: { bg: 'rgba(22,163,74,0.12)', color: '#15803D' },
        rejected: { bg: 'rgba(220,38,38,0.1)', color: '#DC2626' },
    };

    const cols = [
        { key: 'name', header: 'Student', accessor: 'full_name' },
        { key: 'roll', header: 'Roll No', accessor: 'roll_number' },
        { key: 'class', header: 'Class', render: r => r.year ? `${r.dept_code || ''} - Y${r.year} (${r.section || ''})` : '—' },
        { key: 'type', header: 'Type', accessor: 'leave_type' },
        { key: 'from', header: 'From', accessor: r => new Date(r.from_date).toLocaleDateString() },
        { key: 'to', header: 'To', accessor: r => new Date(r.to_date).toLocaleDateString() },
        { key: 'reason', header: 'Reason', render: r => <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.reason?.substring(0, 40)}</span> },
        {
            key: 'status', header: 'Status', render: r => {
                const s = statusStyles[r.status] || statusStyles.pending;
                return <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 600, background: s.bg, color: s.color }}>{r.status}</span>;
            }
        },
        {
            key: 'actions', header: '', sortable: false, render: r => r.status === 'pending' ? (
                <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleAction(r.id, 'approved')} className="btn btn-sm btn-success">✓</button>
                    <button onClick={() => handleAction(r.id, 'rejected')} className="btn btn-sm btn-danger">✗</button>
                </div>
            ) : null
        }
    ];
    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;
    return (
        <DashboardLayout>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Student Leave Requests</h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>Review and manage student leave applications</p>
            </div>
            <DataTable columns={cols} data={leaves} />
        </DashboardLayout>
    );
}
