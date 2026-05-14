import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function StudentGrades() {
    const [grades, setGrades] = useState([]);
    const [history, setHistory] = useState([]);
    const [manualGpa, setManualGpa] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const [g, h] = await Promise.all([api.get('/student/grades'), api.get('/student/gpa/history')]);
                setGrades(g.data.grades || []);
                setManualGpa(g.data.manual_gpa || null);
                setHistory(h.data.history || []);
            } catch { } finally { setLoading(false); }
        })();
    }, []);

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    const gradeColors = { 'A+': '#16A34A', 'A': '#22C55E', 'B+': '#3B82F6', 'B': '#6366F1', 'C': '#F59E0B', 'D': '#EF4444', 'F': '#DC2626' };

    return (
        <DashboardLayout>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Grades & GPA</h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>Your academic performance and GPA trend</p>
            </div>

            {/* GPA Summary Cards */}
            {manualGpa && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
                    <div style={{ background: 'linear-gradient(135deg, #F3E8FF, #E9D5FF)', padding: 20, borderRadius: 14, border: '1px solid #D8B4FE' }}>
                        <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#7E22CE', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cumulative GPA (CGPA)</p>
                        <p style={{ fontSize: '2rem', fontWeight: 800, color: '#581C87', marginTop: 4 }}>{Number(manualGpa.cgpa).toFixed(2)}</p>
                        <p style={{ fontSize: '0.8rem', color: '#6B21A8', marginTop: 2 }}>Last updated: {new Date(manualGpa.updated_at).toLocaleDateString()}</p>
                    </div>
                    <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 14, border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current SGPA</p>
                        <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{Number(manualGpa.sgpa).toFixed(2)}</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: 2 }}>Semester {manualGpa.semester}</p>
                    </div>
                </div>
            )}

            {/* GPA Trend Chart */}
            {history.length > 0 && (
                <div style={{
                    borderRadius: 14, padding: 24, marginBottom: 28,
                    background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
                }}>
                    <h2 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16 }}>Semester-wise SGPA Trend</h2>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={history}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="semester" label={{ value: 'Semester', position: 'bottom' }} stroke="var(--text-secondary)" />
                            <YAxis domain={[0, 10]} stroke="var(--text-secondary)" />
                            <Tooltip />
                            <Line type="monotone" dataKey="sgpa" stroke="#6A1B9A" strokeWidth={3} dot={{ r: 5 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Grade Sheet */}
            <div style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                {grades.length > 0 ? (
                    <table className="data-table">
                        <thead><tr><th>Subject</th><th>Credits</th><th>Grade</th><th>Points</th><th>SGPA</th><th>CGPA</th></tr></thead>
                        <tbody>
                            {grades.map((g, i) => (
                                <tr key={i}>
                                    <td style={{ fontWeight: 500 }}>{g.subject_name} <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>({g.code})</span></td>
                                    <td>{g.credits}</td>
                                    <td>
                                        <span style={{
                                            padding: '3px 10px', borderRadius: 100,
                                            fontSize: '0.7rem', fontWeight: 700, color: 'white',
                                            background: gradeColors[g.grade_letter] || '#6B7280',
                                        }}>{g.grade_letter}</span>
                                    </td>
                                    <td style={{ fontWeight: 600 }}>{g.grade_points}</td>
                                    <td>{g.sgpa || '—'}</td>
                                    <td style={{ fontWeight: 700, color: '#6A1B9A' }}>{g.cgpa || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <p style={{ fontSize: '2rem', marginBottom: 10 }}>📄</p>
                        <p style={{ fontWeight: 600 }}>No subject-wise grade records available yet.</p>
                        <p style={{ fontSize: '0.85rem', marginTop: 4 }}>Detailed grades will appear here once officially published by the department.</p>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
