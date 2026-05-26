import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';

/* ─── Link-Faculty Modal ─────────────────────────────────────────────────── */
function LinkFacultyModal({ isOpen, onClose, onLinked }) {
    const [all, setAll]           = useState([]);
    const [loading, setLoading]   = useState(false);
    const [search, setSearch]     = useState('');
    const [linking, setLinking]   = useState(null);

    useEffect(() => {
        if (!isOpen) return;
        setSearch('');
        setLoading(true);
        api.get('/hod/faculty/all')
            .then(r => setAll(r.data.faculty || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [isOpen]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return all;
        return all.filter(f =>
            (f.full_name   || '').toLowerCase().includes(q) ||
            (f.login_id    || '').toLowerCase().includes(q) ||
            (f.department_name || '').toLowerCase().includes(q) ||
            (f.designation || '').toLowerCase().includes(q)
        );
    }, [all, search]);

    const handleLink = async (faculty) => {
        setLinking(faculty.id);
        try {
            await api.post(`/hod/faculty/link/${faculty.id}`);
            // update local state to show "Linked ✓"
            setAll(prev => prev.map(f => f.id === faculty.id ? { ...f, already_linked: 1 } : f));
            onLinked();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to link faculty');
        } finally {
            setLinking(null);
        }
    };

    const handleUnlink = async (faculty) => {
        setLinking(faculty.id);
        try {
            await api.delete(`/hod/faculty/link/${faculty.id}`);
            setAll(prev => prev.map(f => f.id === faculty.id ? { ...f, already_linked: 0 } : f));
            onLinked();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to unlink faculty');
        } finally {
            setLinking(null);
        }
    };

    // Group by department
    const grouped = useMemo(() => {
        const map = {};
        filtered.forEach(f => {
            const dept = f.department_name || 'Unknown';
            if (!map[dept]) map[dept] = [];
            map[dept].push(f);
        });
        return Object.entries(map);
    }, [filtered]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Link Existing Faculty" size="lg">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Search */}
                <div style={{ position: 'relative' }}>
                    <span style={{
                        position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
                        fontSize: '0.9rem', color: 'var(--text-tertiary)', pointerEvents: 'none',
                    }}>🔍</span>
                    <input
                        className="form-input"
                        style={{ paddingLeft: 32 }}
                        placeholder="Search by name, ID, department…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        autoFocus
                    />
                    {search && (
                        <button onClick={() => setSearch('')} style={{
                            position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--text-tertiary)', fontSize: '0.85rem',
                        }}>✕</button>
                    )}
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', margin: 0 }}>
                    Showing faculty from all other departments. Linked faculty can be assigned classes & take attendance in your department.
                </p>

                {/* Faculty list */}
                <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
                    {loading ? (
                        <div style={{ padding: 32, textAlign: 'center' }}><LoadingSpinner /></div>
                    ) : grouped.length === 0 ? (
                        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                            No faculty found
                        </div>
                    ) : (
                        grouped.map(([deptName, members]) => (
                            <div key={deptName}>
                                {/* Dept header */}
                                <div style={{
                                    padding: '8px 16px', background: 'var(--bg-secondary)',
                                    borderBottom: '1px solid var(--border)',
                                    fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em',
                                    color: 'var(--text-tertiary)', textTransform: 'uppercase',
                                }}>
                                    {deptName}
                                </div>

                                {members.map((f, i) => {
                                    const isLinking = linking === f.id;
                                    const linked    = Number(f.already_linked) === 1;
                                    return (
                                        <div key={f.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '12px 16px',
                                            borderBottom: i < members.length - 1 ? '1px solid var(--border)' : 'none',
                                            background: linked ? 'rgba(37,99,235,0.04)' : 'transparent',
                                            transition: 'background 0.15s',
                                        }}>
                                            {/* Avatar */}
                                            <div style={{
                                                width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                                                background: linked ? 'rgba(37,99,235,0.15)' : 'var(--bg-secondary)',
                                                border: linked ? '2px solid #2563EB' : '2px solid var(--border)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontWeight: 800, fontSize: '0.85rem',
                                                color: linked ? '#2563EB' : 'var(--text-secondary)',
                                            }}>
                                                {(f.full_name || '?')[0].toUpperCase()}
                                            </div>

                                            {/* Info */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                                    <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                                                        {f.full_name}
                                                    </span>
                                                    {linked && (
                                                        <span style={{
                                                            padding: '1px 8px', borderRadius: 100, fontSize: '0.65rem', fontWeight: 700,
                                                            background: 'rgba(37,99,235,0.12)', color: '#2563EB',
                                                        }}>✓ Linked</span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2, display: 'flex', gap: 10 }}>
                                                    <span style={{ fontFamily: 'monospace' }}>{f.login_id}</span>
                                                    {f.designation && <span>• {f.designation}</span>}
                                                </div>
                                            </div>

                                            {/* Action */}
                                            {linked ? (
                                                <button
                                                    onClick={() => handleUnlink(f)}
                                                    disabled={isLinking}
                                                    style={{
                                                        padding: '6px 14px', borderRadius: 8, border: '1.5px solid #FCA5A5',
                                                        background: 'rgba(220,38,38,0.07)', color: '#DC2626',
                                                        fontSize: '0.75rem', fontWeight: 700, cursor: isLinking ? 'wait' : 'pointer',
                                                        whiteSpace: 'nowrap', transition: 'all 0.15s',
                                                    }}
                                                >
                                                    {isLinking ? '…' : 'Unlink'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleLink(f)}
                                                    disabled={isLinking}
                                                    style={{
                                                        padding: '6px 14px', borderRadius: 8, border: '1.5px solid rgba(37,99,235,0.35)',
                                                        background: 'rgba(37,99,235,0.08)', color: '#2563EB',
                                                        fontSize: '0.75rem', fontWeight: 700, cursor: isLinking ? 'wait' : 'pointer',
                                                        whiteSpace: 'nowrap', transition: 'all 0.15s',
                                                    }}
                                                    onMouseEnter={e => { if (!isLinking) { e.currentTarget.style.background='#2563EB'; e.currentTarget.style.color='white'; }}}
                                                    onMouseLeave={e => { if (!isLinking) { e.currentTarget.style.background='rgba(37,99,235,0.08)'; e.currentTarget.style.color='#2563EB'; }}}
                                                >
                                                    {isLinking ? '…' : '+ Link'}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-outline" onClick={onClose}>Close</button>
                </div>
            </div>
        </Modal>
    );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function HodFaculty() {
    const [faculty, setFaculty]     = useState([]);
    const [loading, setLoading]     = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [editId, setEditId]         = useState(null);
    const [showLink, setShowLink]   = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importLoading, setImportLoading] = useState(false);
    const [importResult, setImportResult] = useState(null); // {success, message, details}
    const [search, setSearch]       = useState('');
    const [form, setForm] = useState({
        full_name: '', email: '', phone: '', password: '',
        designation: '', qualification: '', joining_date: '',
    });

    useEffect(() => { load(); }, []);

    const load = async () => {
        try {
            const r = await api.get('/hod/faculty');
            setFaculty(r.data.faculty || []);
        } catch { }
        finally { setLoading(false); }
    };

    const handleOpenCreate = () => {
        setEditId(null);
        setForm({ full_name: '', email: '', phone: '', password: '', designation: '', qualification: '', joining_date: '' });
        setShowCreate(true);
    };

    const handleOpenEdit = (f) => {
        setEditId(f.id);
        let formattedDate = '';
        if (f.joining_date) {
            const dateObj = new Date(f.joining_date);
            if (!isNaN(dateObj.getTime())) {
                formattedDate = dateObj.toISOString().split('T')[0];
            }
        }
        setForm({
            full_name: f.full_name || '',
            email: f.email || '',
            phone: f.phone || '',
            password: '',
            designation: f.designation || '',
            qualification: f.qualification || '',
            joining_date: formattedDate,
        });
        setShowCreate(true);
    };

    const handleCloseModal = () => {
        setShowCreate(false);
        setEditId(null);
        setForm({ full_name: '', email: '', phone: '', password: '', designation: '', qualification: '', joining_date: '' });
    };

    const handleCreateOrUpdate = async (e) => {
        e.preventDefault();
        try {
            if (editId) {
                const payload = { ...form };
                if (!payload.password.trim()) {
                    delete payload.password;
                }
                await api.patch(`/hod/faculty/${editId}`, payload);
                alert('Faculty updated successfully!');
                handleCloseModal();
                load();
            } else {
                const r = await api.post('/hod/faculty', form);
                alert(`Faculty created!\nLogin ID: ${r.data.login_id}`);
                handleCloseModal();
                load();
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Error saving faculty details');
        }
    };

    const handleDeactivate = async (id) => {
        if (!confirm('Are you sure you want to deactivate this faculty member?')) return;
        const password = window.prompt('Please enter your HOD password to confirm deactivation:');
        if (!password) return;
        try { await api.delete(`/hod/faculty/${id}`, { data: { password } }); load(); } catch (err) { alert(err.response?.data?.error || 'Deactivation failed'); }
    };

    const handleUnlinkDirect = async (id) => {
        if (!confirm('Remove this guest faculty from your department?')) return;
        try { await api.delete(`/hod/faculty/link/${id}`); load(); } catch { }
    };

    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

    // ── Faculty import ─────────────────────────────────────────────────────
    const handleImport = async (e) => {
        e.preventDefault();
        if (!importFile) return;
        const fd = new FormData();
        fd.append('file', importFile);
        setImportLoading(true);
        setImportResult(null);
        try {
            const r = await api.post('/hod/faculty/import', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setImportResult({ success: true, message: r.data.message });
            setImportFile(null);
            load();
        } catch (err) {
            const d = err.response?.data;
            setImportResult({ success: false, message: d?.error || 'Import failed', details: d?.details });
        } finally {
            setImportLoading(false);
        }
    };

    const downloadTemplate = () => {
        const csv = 'full_name,email,phone,password,designation,qualification,joining_date\nDr. Ramesh Kumar,ramesh@vignan.ac.in,9876543210,Pass@123,Associate Professor,M.Tech,2024-06-01';
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'faculty_import_template.csv';
        a.click(); URL.revokeObjectURL(url);
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return faculty;
        return faculty.filter(f =>
            (f.full_name   || '').toLowerCase().includes(q) ||
            (f.login_id    || '').toLowerCase().includes(q) ||
            (f.designation || '').toLowerCase().includes(q)
        );
    }, [faculty, search]);

    const primary = filtered.filter(f => !Number(f.is_guest));
    const guests  = filtered.filter(f =>  Number(f.is_guest));

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    return (
        <DashboardLayout>
            <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                        Faculty Management
                    </h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4, margin: 0 }}>
                        Manage faculty members in your department
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setShowLink(true)}
                        style={{
                            padding: '9px 18px', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem',
                            border: '1.5px solid rgba(37,99,235,0.35)',
                            background: 'rgba(37,99,235,0.08)', color: '#2563EB',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
                            transition: 'all 0.15s', whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background='#2563EB'; e.currentTarget.style.color='white'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='rgba(37,99,235,0.08)'; e.currentTarget.style.color='#2563EB'; }}
                    >
                        🔗 Link Existing Faculty
                    </button>
                    <button
                        onClick={() => { setShowImport(true); setImportResult(null); setImportFile(null); }}
                        style={{
                            padding: '9px 18px', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem',
                            border: '1.5px solid rgba(46,125,50,0.35)',
                            background: 'rgba(46,125,50,0.08)', color: '#2E7D32',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
                            transition: 'all 0.15s', whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background='#2E7D32'; e.currentTarget.style.color='white'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='rgba(46,125,50,0.08)'; e.currentTarget.style.color='#2E7D32'; }}
                    >
                        📥 Import CSV/Excel
                    </button>
                    <button onClick={handleOpenCreate} className="btn btn-hod" style={{ whiteSpace: 'nowrap' }}>
                        + Add Faculty
                    </button>
                </div>
            </div>

            {/* Search bar */}
            <div style={{ position: 'relative', marginBottom: 18 }}>
                <span style={{
                    position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
                    fontSize: '0.9rem', color: 'var(--text-tertiary)', pointerEvents: 'none',
                }}>🔍</span>
                <input
                    className="form-input"
                    style={{ paddingLeft: 32 }}
                    placeholder="Search name, ID, designation…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                {search && (
                    <button onClick={() => setSearch('')} style={{
                        position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-tertiary)', fontSize: '0.85rem',
                    }}>✕</button>
                )}
            </div>

            {/* Stats bar */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
                {[
                    { label: 'Total Faculty', value: faculty.length, color: '#1A3C6E' },
                    { label: 'Home Faculty', value: faculty.filter(f => !Number(f.is_guest)).length, color: '#16A34A' },
                    { label: 'Guest / Linked', value: faculty.filter(f => Number(f.is_guest)).length, color: '#2563EB' },
                ].map((s, i) => (
                    <div key={i} style={{
                        padding: '10px 20px', borderRadius: 10, background: 'var(--bg-card)',
                        border: '1px solid var(--border)', textAlign: 'center', minWidth: 120,
                    }}>
                        <p style={{ fontSize: '1.3rem', fontWeight: 900, color: s.color, margin: 0 }}>{s.value}</p>
                        <p style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-tertiary)', margin: '3px 0 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div style={{ borderRadius: 14, background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table className="data-table" style={{ minWidth: 700 }}>
                    <thead>
                        <tr>
                            <th>Login ID</th>
                            <th>Name</th>
                            <th>Designation</th>
                            <th>Home Dept</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Type</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: '0.88rem' }}>
                                    {faculty.length === 0
                                        ? 'No faculty yet — click "+ Add Faculty" or "🔗 Link Existing Faculty"'
                                        : 'No results for this search'}
                                </td>
                            </tr>
                        ) : (
                            filtered.map(f => {
                                const isGuest = Number(f.is_guest) === 1;
                                return (
                                    <tr key={`${isGuest ? 'g' : 'p'}-${f.id}`} style={{ animation: 'fadeIn 0.2s ease' }}>
                                        <td><span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.82rem' }}>{f.login_id}</span></td>
                                        <td><span style={{ fontWeight: 600 }}>{f.full_name}</span></td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.83rem' }}>{f.designation || '—'}</td>
                                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {isGuest ? (
                                                <span style={{ color: '#2563EB', fontWeight: 600 }}>{f.home_dept_name || '—'}</span>
                                            ) : '—'}
                                        </td>
                                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{f.email || '—'}</td>
                                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{f.phone || '—'}</td>
                                        <td>
                                            {isGuest ? (
                                                <span style={{
                                                    padding: '3px 10px', borderRadius: 100, fontSize: '0.68rem', fontWeight: 700,
                                                    background: 'rgba(37,99,235,0.12)', color: '#2563EB',
                                                }}>🔗 Guest</span>
                                            ) : (
                                                <span style={{
                                                    padding: '3px 10px', borderRadius: 100, fontSize: '0.68rem', fontWeight: 700,
                                                    background: 'rgba(22,163,74,0.12)', color: '#15803D',
                                                }}>✓ Home</span>
                                            )}
                                        </td>
                                        <td>
                                            {isGuest ? (
                                                <button
                                                    onClick={() => handleUnlinkDirect(f.id)}
                                                    style={{
                                                        padding: '5px 12px', borderRadius: 7, border: '1.5px solid #FCA5A5',
                                                        background: 'rgba(220,38,38,0.06)', color: '#DC2626',
                                                        fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
                                                    }}
                                                >Unlink</button>
                                            ) : (
                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                    <button
                                                        onClick={() => handleOpenEdit(f)}
                                                        style={{
                                                            padding: '5px 12px', borderRadius: 7, border: '1.5px solid rgba(37,99,235,0.3)',
                                                            background: 'rgba(37,99,235,0.06)', color: '#2563EB',
                                                            fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
                                                            transition: 'all 0.15s'
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = '#2563EB'; e.currentTarget.style.color = '#fff'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,99,235,0.06)'; e.currentTarget.style.color = '#2563EB'; }}
                                                    >Edit</button>
                                                    <button
                                                        onClick={() => handleDeactivate(f.id)}
                                                        className="btn btn-sm btn-danger"
                                                        disabled={!f.is_active}
                                                        style={{ padding: '5px 12px', fontSize: '0.74rem', fontWeight: 700, height: 'auto', lineHeight: 'normal' }}
                                                    >Deactivate</button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Link modal */}
            <LinkFacultyModal
                isOpen={showLink}
                onClose={() => setShowLink(false)}
                onLinked={load}
            />

            {/* Import modal */}
            <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="Import Faculty from CSV / Excel">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Template download */}
                    <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(46,125,50,0.06)', border: '1px solid rgba(46,125,50,0.2)' }}>
                        <p style={{ fontSize: '0.83rem', fontWeight: 700, color: '#2E7D32', margin: '0 0 6px' }}>📋 Required columns:</p>
                        <code style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>full_name, email, phone, password</code>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '6px 0 0' }}>Optional: designation, qualification, joining_date</p>
                        <button onClick={downloadTemplate} style={{
                            marginTop: 10, padding: '6px 14px', borderRadius: 7,
                            border: '1.5px solid rgba(46,125,50,0.4)', background: 'transparent',
                            color: '#2E7D32', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                        }}>⬇ Download Template CSV</button>
                    </div>

                    {/* File input */}
                    <form onSubmit={handleImport}>
                        <div style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '20px', textAlign: 'center' }}>
                            <input
                                type="file" accept=".csv,.xlsx,.xls"
                                onChange={e => { setImportFile(e.target.files[0]); setImportResult(null); }}
                                style={{ fontSize: '0.85rem' }}
                            />
                            {importFile && (
                                <p style={{ fontSize: '0.78rem', color: '#2E7D32', fontWeight: 600, marginTop: 8 }}>
                                    ✓ {importFile.name} selected
                                </p>
                            )}
                        </div>

                        {/* Result banner */}
                        {importResult && (
                            <div style={{
                                marginTop: 14, padding: '12px 16px', borderRadius: 10,
                                background: importResult.success ? 'rgba(22,163,74,0.07)' : 'rgba(220,38,38,0.07)',
                                border: `1px solid ${importResult.success ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}`,
                                color: importResult.success ? '#15803D' : '#DC2626',
                            }}>
                                <p style={{ fontWeight: 700, fontSize: '0.85rem', margin: 0 }}>{importResult.message}</p>
                                {importResult.details && (
                                    <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: '0.75rem', lineHeight: 1.7 }}>
                                        {importResult.details.slice(0, 10).map((d, i) => <li key={i}>{d}</li>)}
                                        {importResult.details.length > 10 && <li>...and {importResult.details.length - 10} more errors</li>}
                                    </ul>
                                )}
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                            <button type="button" className="btn btn-outline" onClick={() => setShowImport(false)}>Cancel</button>
                            <button
                                type="submit"
                                disabled={!importFile || importLoading}
                                className="btn btn-hod"
                                style={{ opacity: (!importFile || importLoading) ? 0.65 : 1 }}
                            >
                                {importLoading ? 'Importing…' : '📥 Import Faculty'}
                            </button>
                        </div>
                    </form>
                </div>
            </Modal>

            {/* Create / Edit modal */}
            <Modal isOpen={showCreate} onClose={handleCloseModal} title={editId ? "Edit Faculty Member" : "Add New Faculty Member"}>
                <form onSubmit={handleCreateOrUpdate} className="modal-form">
                    <div className="modal-section">
                        <p className="modal-section-title">Personal Information</p>
                        <div className="form-group">
                            <label className="form-label">Full Name <span className="required">*</span></label>
                            <input className="form-input" placeholder="e.g. Dr. Ramesh Kumar" value={form.full_name} onChange={e => upd('full_name', e.target.value)} required />
                        </div>
                        <div className="form-row form-row-2">
                            <div className="form-group">
                                <label className="form-label">Designation</label>
                                <input className="form-input" placeholder="e.g. Associate Professor" value={form.designation} onChange={e => upd('designation', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Qualification</label>
                                <input className="form-input" placeholder="e.g. M.Tech, PhD" value={form.qualification} onChange={e => upd('qualification', e.target.value)} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Date of Joining</label>
                            <input type="date" className="form-input" value={form.joining_date} onChange={e => upd('joining_date', e.target.value)} />
                        </div>
                    </div>
                    <div className="modal-section">
                        <p className="modal-section-title">Contact Details</p>
                        <div className="form-row form-row-2">
                            <div className="form-group">
                                <label className="form-label">Email Address</label>
                                <input className="form-input" type="email" placeholder="faculty@example.com" value={form.email} onChange={e => upd('email', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone Number</label>
                                <input className="form-input" placeholder="10-digit number" value={form.phone} onChange={e => upd('phone', e.target.value)} />
                            </div>
                        </div>
                    </div>
                    <div className="modal-section">
                        <p className="modal-section-title">Account Security</p>
                        <div className="form-group">
                            <label className="form-label">
                                Login Password {editId ? '' : <span className="required">*</span>}
                            </label>
                            <input 
                                type="password" 
                                className="form-input" 
                                placeholder={editId ? "Leave blank to keep current password" : "Minimum 8 characters"} 
                                value={form.password} 
                                onChange={e => upd('password', e.target.value)} 
                                required={!editId} 
                                minLength={editId && !form.password ? undefined : 8} 
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={handleCloseModal}>Cancel</button>
                        <button type="submit" className="btn btn-hod">{editId ? "Save Changes" : "Create Faculty"}</button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
