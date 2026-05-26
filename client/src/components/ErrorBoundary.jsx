import { Component } from 'react';

/**
 * ErrorBoundary — catches any React render crash and shows a friendly error screen
 * instead of a blank white page.
 *
 * Usage: wrap your <App /> in <ErrorBoundary> in main.jsx
 */
export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('[ErrorBoundary] Caught error:', error, info);
    }

    handleReload = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 20,
                background: 'var(--bg-primary, #f8f9fa)',
                padding: 24,
                fontFamily: 'Inter, system-ui, sans-serif',
            }}>
                {/* Icon */}
                <div style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: 'rgba(220,38,38,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '2rem',
                }}>⚠️</div>

                <div style={{ textAlign: 'center', maxWidth: 480 }}>
                    <h2 style={{
                        fontSize: '1.3rem', fontWeight: 800,
                        color: 'var(--text-primary, #1a1a1a)', margin: '0 0 8px',
                    }}>
                        Something went wrong
                    </h2>
                    <p style={{
                        fontSize: '0.9rem', color: 'var(--text-secondary, #666)',
                        lineHeight: 1.6, margin: 0,
                    }}>
                        The page ran into an unexpected error. Your data is safe —
                        this is a display issue. Try reloading the page.
                    </p>

                    {/* Error detail (collapsed) */}
                    {this.state.error && (
                        <details style={{ marginTop: 16, textAlign: 'left' }}>
                            <summary style={{
                                fontSize: '0.78rem', cursor: 'pointer',
                                color: 'var(--text-tertiary, #999)', fontWeight: 600,
                            }}>Technical details</summary>
                            <pre style={{
                                marginTop: 8, padding: '10px 14px',
                                borderRadius: 8, fontSize: '0.72rem',
                                background: 'rgba(220,38,38,0.06)',
                                color: '#DC2626', overflowX: 'auto',
                                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                                border: '1px solid rgba(220,38,38,0.2)',
                            }}>
                                {this.state.error.toString()}
                            </pre>
                        </details>
                    )}
                </div>

                <button
                    onClick={this.handleReload}
                    style={{
                        padding: '11px 28px', borderRadius: 10, border: 'none',
                        background: 'linear-gradient(135deg, #1A3C6E, #2A5298)',
                        color: 'white', fontWeight: 700, fontSize: '0.9rem',
                        cursor: 'pointer', boxShadow: '0 4px 14px rgba(26,60,110,0.3)',
                    }}
                >
                    🔄 Reload Page
                </button>
            </div>
        );
    }
}
