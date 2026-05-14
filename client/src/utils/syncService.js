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

// Helper: authenticated fetch that sends Bearer token (same as api.js)
async function authFetch(url, options = {}) {
    const token = localStorage.getItem('vimp_token');
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(url, { ...options, headers, credentials: 'include' });
}

/**
 * Sync all pending offline entries to the server.
 * @param {Function} onProgress  Called with { synced, conflicts, errors, total, phase }
 * @returns {Promise<{ synced: number, conflicts: number, errors: number }>}
 */
export async function runSync(onProgress) {
    if (isSyncing) return { synced: 0, conflicts: 0, errors: 0 };
    isSyncing = true;

    const results = { synced: 0, conflicts: 0, errors: 0 };

    try {
        const pending = await getUnsyncedEntries();
        if (pending.length === 0) {
            isSyncing = false;
            return results;
        }

        const total = pending.length;
        onProgress?.({ ...results, total, phase: 'starting' });

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
                    await markSynced(entry.local_id);
                    results.synced++;
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
            } catch (networkErr) {
                await markSyncError(entry.local_id, 'Network error — will retry');
                results.errors++;
            }

            onProgress?.({ ...results, total, phase: 'syncing' });
        }

        onProgress?.({ ...results, total, phase: 'done' });
    } finally {
        isSyncing = false;
    }

    return results;
}
