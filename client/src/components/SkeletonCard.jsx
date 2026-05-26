/**
 * SkeletonCard — animated placeholder card shown while data is loading.
 * Usage: <SkeletonCard /> inside a grid while `loading === true`
 *
 * Props:
 *   - lines {number} — number of text skeleton lines (default 2)
 *   - height {number} — card height in px (default 110)
 *   - hasIcon {bool}  — show a circular icon placeholder (default true)
 */
export function SkeletonCard({ lines = 2, height = 110, hasIcon = true }) {
    return (
        <div style={{
            borderRadius: 16,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            padding: '20px 22px',
            height,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1 }}>
                    {/* Label placeholder */}
                    <div className="skeleton-line" style={{ width: '55%', height: 10, borderRadius: 6, marginBottom: 14 }} />
                    {/* Value placeholder */}
                    <div className="skeleton-line" style={{ width: '38%', height: 22, borderRadius: 6 }} />
                </div>
                {hasIcon && (
                    <div className="skeleton-line" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }} />
                )}
            </div>
            {lines > 2 && (
                <div className="skeleton-line" style={{ width: '70%', height: 9, borderRadius: 6, marginTop: 8 }} />
            )}
        </div>
    );
}

/**
 * SkeletonTable — animated placeholder for a data table.
 * Props:
 *   - rows {number}    — number of skeleton rows (default 5)
 *   - cols {number}    — number of skeleton columns (default 5)
 */
export function SkeletonTable({ rows = 5, cols = 5 }) {
    return (
        <div style={{
            borderRadius: 16,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', gap: 12, alignItems: 'center',
            }}>
                <div className="skeleton-line" style={{ width: 120, height: 12, borderRadius: 6 }} />
                <div className="skeleton-line" style={{ marginLeft: 'auto', width: 180, height: 32, borderRadius: 8 }} />
            </div>
            {/* Rows */}
            <div style={{ padding: '0 0 8px' }}>
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${cols}, 1fr)`,
                        gap: 16, padding: '14px 16px',
                        borderBottom: i < rows - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                        {Array.from({ length: cols }).map((_, j) => (
                            <div key={j} className="skeleton-line" style={{
                                height: 12, borderRadius: 6,
                                width: j === 0 ? '80%' : j === cols - 1 ? '60%' : '70%',
                            }} />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * SkeletonGrid — a responsive grid of SkeletonCards.
 * Props:
 *   - count {number} — number of cards (default 4)
 *   - cols {string}  — CSS grid-template-columns (default 'repeat(auto-fill, minmax(220px,1fr))')
 */
export function SkeletonGrid({ count = 4, cols = 'repeat(auto-fill, minmax(200px, 1fr))' }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 16 }}>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} />
            ))}
        </div>
    );
}
