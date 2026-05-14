/**
 * offlineAttendance.js
 * IndexedDB wrapper for storing attendance entries when internet is unavailable.
 * Works in Chrome (desktop + Android). Zero dependencies.
 */

const DB_NAME    = 'vimp_offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending_attendance';

// ─── Open / initialise the DB ─────────────────────────────────────────────
function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, {
                    keyPath: 'local_id',
                    autoIncrement: true,
                });
                // Indexes for fast querying
                store.createIndex('synced',            'synced',            { unique: false });
                store.createIndex('conflict_flagged',  'conflict_flagged',  { unique: false });
                store.createIndex('assignment_id',     'assignment_id',     { unique: false });
            }
        };

        req.onsuccess  = (e) => resolve(e.target.result);
        req.onerror    = (e) => reject(e.target.error);
    });
}

// ─── Save a pending attendance entry ──────────────────────────────────────
/**
 * @param {Object} entry
 *   assignment_id, session_date, period_number, start_time, end_time,
 *   records: [{ student_id, roll_number, full_name, status }],
 *   subject_name, year, section, dept_name
 */
export async function savePendingAttendance(entry) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx    = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const record = {
            ...entry,
            saved_at:         new Date().toISOString(),
            synced:           false,
            conflict_flagged: false,
            sync_error:       null,
        };
        const req = store.add(record);
        req.onsuccess = () => resolve(req.result); // returns local_id
        req.onerror   = (e) => reject(e.target.error);
    });
}

// ─── Get all unsynced entries ──────────────────────────────────────────────
export async function getUnsyncedEntries() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx    = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('synced');
        const req   = index.getAll(IDBKeyRange.only(false));
        req.onsuccess = () => resolve(req.result);
        req.onerror   = (e) => reject(e.target.error);
    });
}

// ─── Get ALL entries (for displaying in UI) ───────────────────────────────
export async function getAllOfflineEntries() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx    = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req   = store.getAll();
        req.onsuccess = () => resolve(req.result.reverse()); // newest first
        req.onerror   = (e) => reject(e.target.error);
    });
}

// ─── Count unsynced entries ────────────────────────────────────────────────
export async function countUnsynced() {
    const entries = await getUnsyncedEntries();
    return entries.length;
}

// ─── Mark an entry as synced ───────────────────────────────────────────────
export async function markSynced(localId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx    = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(localId);
        getReq.onsuccess = () => {
            const record        = getReq.result;
            if (!record) return resolve();
            record.synced       = true;
            record.synced_at    = new Date().toISOString();
            const putReq = store.put(record);
            putReq.onsuccess = () => resolve();
            putReq.onerror   = (e) => reject(e.target.error);
        };
        getReq.onerror = (e) => reject(e.target.error);
    });
}

// ─── Mark an entry as conflict-flagged ────────────────────────────────────
export async function markConflict(localId, message) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx    = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(localId);
        getReq.onsuccess = () => {
            const record           = getReq.result;
            if (!record) return resolve();
            record.synced          = true;   // don't retry
            record.conflict_flagged = true;
            record.sync_error      = message || 'Conflict — flagged to HOD';
            record.synced_at       = new Date().toISOString();
            const putReq = store.put(record);
            putReq.onsuccess = () => resolve();
            putReq.onerror   = (e) => reject(e.target.error);
        };
        getReq.onerror = (e) => reject(e.target.error);
    });
}

// ─── Mark an entry as sync-error (will retry next time) ───────────────────
export async function markSyncError(localId, errorMessage) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx    = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(localId);
        getReq.onsuccess = () => {
            const record      = getReq.result;
            if (!record) return resolve();
            record.sync_error = errorMessage;
            // Keep synced = false so it retries
            const putReq = store.put(record);
            putReq.onsuccess = () => resolve();
            putReq.onerror   = (e) => reject(e.target.error);
        };
        getReq.onerror = (e) => reject(e.target.error);
    });
}

// ─── Clear all synced (non-conflict) entries older than N days ────────────
export async function clearOldSynced(daysOld = 7) {
    const db = await openDB();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    return new Promise((resolve, reject) => {
        const tx    = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req   = store.getAll();
        req.onsuccess = () => {
            const toDelete = req.result.filter(r =>
                r.synced && !r.conflict_flagged &&
                new Date(r.synced_at || r.saved_at) < cutoff
            );
            for (const r of toDelete) store.delete(r.local_id);
            resolve(toDelete.length);
        };
        req.onerror = (e) => reject(e.target.error);
    });
}
