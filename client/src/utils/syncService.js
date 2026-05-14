/**
 * syncService.js
 * Auto-syncs pending offline attendance entries to the server
 * when internet connection is restored.
 */

import {
    getUnsyncedEntries,
    markSynced,
    markConflict,
    markSyncError,
} from './offlineAttendance';

let isSyncing = false; // guard against concurrent sync runs

// Helper: authenticated fetch that sends Bearer token
async function authFetch(url, options = {}) {
    const token = localStorage.getItem('vimp_token');
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Abort after 20 seconds to prevent infinite hangs
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    try {
        const res = await fetch(url, {
            ...options,
            headers,
            credentials: 'include',
            signal: controller.signal,
        });
        clearTimeout(timer);
        return res;
    } catch (err) {
        clearTimeout(timer);
        throw err;
    }
}

/**
 * Deduplicate pending entries: keep only the LATEST entry per
 * (assignment_id, session_date, period_number) combination.
 * This prevents re-submitting the same attendance block multiple times.
 */
function deduplicateEntries(entries) {
    const seen = new Map();
    // Process in order (oldest first), overwrite with newer ones
    for (const entry of entries) {
        const key = `${entry.assignment_id}|${entry.session_date}|${entry.period_number}`;
        seen.set(key, entry);
    }
    return [...seen.values()];
}

/**
 * Sync all pending offline entries to the server.
 * @param {Function} onDone  Called once when sync completes: { synced, conflicts, errors }
 * @returns {Promise<{ synced: number, conflicts: number, errors: number }>}
 */
export async function runSync(onDone) {
    if (isSyncing) return { synced: 0, conflicts: 0, errors: 0 };
    isSyncing = true;

    const results = { synced: 0, conflicts: 0, errors: 0 };

    try {
        // Read all pending entries first, then close IndexedDB transaction
        const allPending = await getUnsyncedEntries();
        if (allPending.length === 0) {
            return results;
        }

        // Deduplicate: same class + same day + same period → keep only latest
        const pending = deduplicateEntries(allPending);
        const skipped = allPending.length - pending.length;
        if (skipped > 0) {
            // Mark the older duplicate entries as synced without uploading
            const dedupedIds = new Set(pending.map(e => e.local_id));
            for (const entry of allPending) {
                if (!dedupedIds.has(entry.local_id)) {
                    await markSynced(entry.local_id); // silent dedup
                }
            }
        }

        // Sync each unique entry sequentially
        for (const entry of pending) {
            try {
                const response = await authFetch('/api/faculty/sessions/sync-offline', {
                    method: 'POST',
                    body: JSON.stringify({
                        assignment_id:  entry.assignment_id,
                        session_date:   entry.session_date,
                        period_number:  entry.period_number,
                        start_time:     entry.start_time,
                        end_time:       entry.end_time,
                        records:        entry.records,
                        saved_at:       entry.saved_at,
                    }),
                });

                if (response.ok) {
                    const data = await response.json().catch(() => ({}));
                    await markSynced(entry.local_id);
                    results.synced++;
                    // Track if any were outside-window (for toast messaging)
                    if (data.outside_window) results.outsideWindow = (results.outsideWindow || 0) + 1;
                } else if (response.status === 409) {
                    const data = await response.json().catch(() => ({}));
                    const msg  = data.taken_by
                        ? `Conflict with ${data.taken_by} — flagged to HOD`
                        : 'Conflict detected — flagged to HOD';
                    await markConflict(entry.local_id, msg);
                    results.conflicts++;
                } else if (response.status === 401 || response.status === 403) {
                    await markSyncError(entry.local_id, 'Session expired — please log in again');
                    results.errors++;
                } else {
                    const data = await response.json().catch(() => ({}));
                    await markSyncError(entry.local_id, data.error || `Server error ${response.status}`);
                    results.errors++;
                }
            } catch (err) {
                const msg = err.name === 'AbortError'
                    ? 'Request timed out — will retry'
                    : 'Network error — will retry';
                await markSyncError(entry.local_id, msg);
                results.errors++;
            }
        }
    } finally {
        isSyncing = false;
    }

    // Call onDone AFTER all IndexedDB writes are complete
    onDone?.(results);
    return results;
}
