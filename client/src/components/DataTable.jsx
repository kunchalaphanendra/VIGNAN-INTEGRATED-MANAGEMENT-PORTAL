import { useState } from 'react';
import { HiOutlineSearch, HiOutlineChevronUp, HiOutlineChevronDown, HiOutlineInbox } from 'react-icons/hi';

export default function DataTable({ columns, data, searchable = true, emptyText = 'No data found', title, actions }) {
    const [search, setSearch] = useState('');
    const [sortCol, setSortCol] = useState(null);
    const [sortDir, setSortDir] = useState('asc');

    const filtered = data.filter(row => {
        if (!search) return true;
        return columns.some(col => {
            const val = typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor];
            return String(val || '').toLowerCase().includes(search.toLowerCase());
        });
    });

    const sorted = [...filtered].sort((a, b) => {
        if (!sortCol) return 0;
        const col = columns.find(c => c.key === sortCol);
        if (!col) return 0;
        const aVal = typeof col.accessor === 'function' ? col.accessor(a) : a[col.accessor];
        const bVal = typeof col.accessor === 'function' ? col.accessor(b) : b[col.accessor];
        const cmp = String(aVal || '').localeCompare(String(bVal || ''), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
    });

    const handleSort = (key) => {
        if (sortCol === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortCol(key);
            setSortDir('asc');
        }
    };

    return (
        <div className="card-table-wrap" style={{
            borderRadius: 16, overflow: 'hidden',
            background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
        }}>

            {/* Header bar with search and optional title/actions */}
            {(searchable || title || actions) && (
                <div className="dt-header-bar" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexWrap: 'wrap', gap: 10, padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {title && <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>}
                        {title && (
                            <span style={{
                                fontSize: '0.7rem', fontWeight: 600, padding: '2px 10px', borderRadius: 100,
                                background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                            }}>{filtered.length} {filtered.length === 1 ? 'item' : 'items'}</span>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
                        {searchable && (
                            <div className="dt-search-wrap" style={{ position: 'relative', width: '100%', maxWidth: 240 }}>
                                <HiOutlineSearch size={15} style={{
                                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                                    color: 'var(--text-tertiary)',
                                }} />
                                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="Search..." className="form-input"
                                    style={{ height: 36, paddingLeft: 34, fontSize: '0.835rem', width: '100%' }} />
                            </div>
                        )}
                        {actions}
                    </div>
                </div>
            )}

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            {columns.map(col => (
                                <th key={col.key}
                                    onClick={() => col.sortable !== false && handleSort(col.key)}
                                    style={{ whiteSpace: 'nowrap', cursor: col.sortable !== false ? 'pointer' : 'default', userSelect: 'none' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {col.header}
                                        {sortCol === col.key && (
                                            <span style={{ color: 'var(--primary)' }}>
                                                {sortDir === 'asc' ? <HiOutlineChevronUp size={13} /> : <HiOutlineChevronDown size={13} />}
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} data-label="">
                                    <div className="empty-state" style={{ padding: '40px 20px' }}>
                                        <div className="empty-state-icon">
                                            <HiOutlineInbox size={24} />
                                        </div>
                                        <p>{emptyText}</p>
                                    </div>
                                </td>
                            </tr>
                        ) : sorted.map((row, i) => (
                            <tr key={row.id || i}>
                                {columns.map(col => (
                                    <td key={col.key} data-label={col.header || ''}>
                                        {col.render ? col.render(row) : (typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor])}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
