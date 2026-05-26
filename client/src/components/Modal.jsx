import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineX } from 'react-icons/hi';

/**
 * Modal rendered via React Portal directly into document.body.
 * This bypasses ALL parent stacking contexts (transforms, opacity, etc.)
 * and guarantees the overlay covers the entire screen — including sidebar and navbar.
 */
export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
    const overlayRef = useRef(null);

    // Lock body scroll
    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const maxWidth = { sm: '420px', md: '540px', lg: '660px', xl: '800px' }[size] || '540px';

    // Portal renders DIRECTLY into document.body — bypasses stacking contexts
    return createPortal(
        <div
            ref={overlayRef}
            onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                padding: 'clamp(12px, 5vh, 48px) 12px 24px',
                overflowY: 'auto',
                backgroundColor: 'var(--overlay)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
            }}
            className="modal-overlay"
        >
            {/* Animate in */}
            <style>{`
                @keyframes modalIn {
                    from { opacity: 0; transform: scale(0.96) translateY(-8px); }
                    to   { opacity: 1; transform: scale(1) translateY(0); }
                }
                .modal-overlay { animation: none; }
                .modal-card { animation: modalIn 0.22s cubic-bezier(0.16,1,0.3,1) both; }
            `}</style>

            {/* Dialog card */}
            <div
                className="modal-card modal-box"
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth,
                    flexShrink: 0,
                    borderRadius: 18,
                    overflow: 'hidden',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.28), 0 8px 24px rgba(0,0,0,0.14)',
                    marginBottom: 24,
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                }}>
                    <h2 style={{
                        margin: 0,
                        fontSize: '0.975rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.01em',
                    }}>{title}</h2>
                    <button
                        onClick={onClose}
                        style={{
                            width: 30, height: 30,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: 'transparent', color: '#94a3b8',
                            transition: 'all 0.15s ease',
                            flexShrink: 0,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                    >
                        <HiOutlineX size={17} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '20px' }}>
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}
