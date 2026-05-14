// ─── Shared Timetable Utilities ───────────────────────────────────────────
// NO hardcoded subjects, faculty, or students here.
// All such data comes from the real backend API.

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Convert "HH:MM" string to total minutes since midnight.
 */
export function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + (m || 0);
}

/**
 * Check whether the current time (in minutes) falls within [startTime, endTime].
 */
export function isWithinSlot(startTime, endTime) {
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    return cur >= timeToMinutes(startTime) && cur <= timeToMinutes(endTime);
}

/**
 * Convert minutes-since-midnight back to "HH:MM".
 */
export function minsToTime(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
