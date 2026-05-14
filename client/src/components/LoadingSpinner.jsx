export default function LoadingSpinner({ size = 'md', text = 'Loading...' }) {
    const sizes = { sm: 'w-6 h-6 border-2', md: 'w-10 h-10 border-[3px]', lg: 'w-14 h-14 border-4' };

    return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className={`${sizes[size]} rounded-full animate-spin`}
                style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
            {text && (
                <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)', animation: 'pulse-subtle 1.5s ease-in-out infinite' }}>
                    {text}
                </p>
            )}
        </div>
    );
}
