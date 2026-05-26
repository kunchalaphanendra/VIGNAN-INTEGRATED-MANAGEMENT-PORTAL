import { HiOutlinePrinter } from 'react-icons/hi';

/**
 * PrintButton — triggers window.print() for the current page.
 * The @media print CSS in index.css hides nav/sidebar/buttons and makes
 * the content full-width for a clean PDF.
 *
 * Props:
 *   - label {string}   — button label (default 'Download PDF')
 *   - className {string}
 *   - style {object}
 *   - size {'sm'|'md'} — size variant (default 'md')
 */
export default function PrintButton({ label = 'Download PDF', className = '', style = {}, size = 'md' }) {
    const handlePrint = () => {
        // Small delay so React finishes any pending state renders
        setTimeout(() => window.print(), 150);
    };

    const base = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: size === 'sm' ? '6px 12px' : '9px 18px',
        borderRadius: 9,
        border: '1.5px solid var(--border)',
        background: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
        fontWeight: 600,
        fontSize: size === 'sm' ? '0.78rem' : '0.85rem',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        ...style,
    };

    return (
        <button
            className={`no-print ${className}`}
            style={base}
            onClick={handlePrint}
            onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--bg-tertiary, var(--bg-secondary))';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--bg-secondary)';
                e.currentTarget.style.boxShadow = 'none';
            }}
        >
            <HiOutlinePrinter size={size === 'sm' ? 14 : 16} />
            {label}
        </button>
    );
}
