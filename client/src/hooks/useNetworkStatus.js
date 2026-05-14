/**
 * useNetworkStatus.js
 * Watches online/offline state. When connection returns (wasOffline → online),
 * the syncService should trigger auto-sync.
 */
import { useState, useEffect, useRef } from 'react';

export default function useNetworkStatus() {
    const [isOnline, setIsOnline]   = useState(navigator.onLine);
    const [wasOffline, setWasOffline] = useState(false); // true for one render cycle when net returns
    const prevOnline = useRef(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            if (!prevOnline.current) {
                // Was offline, now back — flag for sync trigger
                setWasOffline(true);
                setTimeout(() => setWasOffline(false), 2000); // reset after 2s
            }
            prevOnline.current = true;
        };

        const handleOffline = () => {
            setIsOnline(false);
            prevOnline.current = false;
        };

        window.addEventListener('online',  handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online',  handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return { isOnline, wasOffline };
}
