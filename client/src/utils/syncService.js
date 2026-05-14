/**
 * syncService.js
 * Auto-syncs pending offline attendance entries to the server
 * when internet connection is restored.
 *
 * Call runSync() whenever isOnline becomes true after being offline.
 * It is safe to call multiple times — it won't double-submit.
 */

import {
    getUnsyncedEntries,
    markSynced,
    markConflict,
    markSyncError,
} from './offlineAttendance';

let isSyncing = false; // guard against concurrent sync runs

/**
 * Sync all pending offline entries to the server.
 * @param {Function} onProgress  Called with { synced, conflicts, errors, total }
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
                const response = await fetch('/api/faculty/sessions/sync-offline', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        assignment_id:  entry.assignment_id,
                        session_date:   entry.session_date,
                        period_number:  entry.period_number,
                        start_time:     entry.start_time,
                        end_time:       entry.end_time,
                        records:        entry.records,
                        saved_at:       entry.saved_at, // for audit — when was it marked offline
                    }),
                });

                if (response.ok) {
                    await markSynced(entry.local_id);
                    results.synced++;
                } else if (response.status === 409) {
                    // Conflict — another faculty already marked this period
                    const data = await response.json().catch(() => ({}));
                    const msg  = data.taken_by
                        ? `Conflict with ${data.taken_by} — flagged to HOD`
                        : 'Conflict detected — flagged to HOD';
                    await markConflict(entry.local_id, msg);
                    results.conflicts++;
                } else if (response.status === 401 || response.status === 403) {
                    // Session expired — don't mark as error, just stop for now
                    await markSyncError(entry.local_id, 'Session expired — please log in again');
                    results.errors++;
                } else {
                    const data = await response.json().catch(() => ({}));
                    await markSyncError(entry.local_id, data.error || `Server error ${response.status}`);
                    results.errors++;
                }
            } catch (networkErr) {
                // Still no internet mid-sync
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
