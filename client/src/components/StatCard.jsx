export default function StatCard({ icon: Icon, label, value, color, subtitle, className = '', onClick }) {
    return (
        <div
            className={`card ${className}`}
            style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: 'clamp(14px, 4vw, 22px) clamp(14px, 4vw, 24px)',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all 0.25s ease',
            position: 'relative',
            overflow: 'hidden',
            cursor: onClick ? 'pointer' : 'default',
        }}
            onClick={onClick}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
            {/* Subtle top accent line */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: `linear-gradient(90deg, ${color || 'var(--primary)'}, ${color || 'var(--primary)'}55)`,
                borderRadius: '16px 16px 0 0',
            }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                        fontSize: 'clamp(0.6rem, 2vw, 0.72rem)', fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        color: 'var(--text-tertiary)',
                        marginBottom: 8,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{label}</p>
                    <p style={{
                        fontSize: 'clamp(1.2rem, 5vw, 1.6rem)', fontWeight: 700,
                        letterSpacing: '-0.02em', lineHeight: 1,
                        color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{value}</p>
                    {subtitle && (
                        <p style={{ fontSize: 'clamp(0.65rem, 2vw, 0.72rem)', color: 'var(--text-secondary)', marginTop: 6 }}>{subtitle}</p>
                    )}
                </div>
                {Icon && (
                    <div style={{
                        width: 'clamp(36px, 10vw, 48px)', height: 'clamp(36px, 10vw, 48px)',
                        borderRadius: 14,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `${color}12`, color: color,
                        flexShrink: 0,
                    }}>
                        <Icon size={22} />
                    </div>
                )}
            </div>
        </div>
    );
}
