// Quick test: simulate May 2026 initialization to verify logic
const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function getHolidayType(date) {
    const dow = date.getDay();
    if (dow === 0) return 'holiday (Sunday)';
    if (dow === 6) {
        const whichSat = Math.ceil(date.getDate() / 7);
        if (whichSat === 2 || whichSat === 4) return `holiday (${whichSat === 2 ? '2nd' : '4th'} Saturday)`;
        return `working (${whichSat}${whichSat===1?'st':whichSat===3?'rd':'th'} Saturday)`;
    }
    return 'working';
}

console.log('=== May 2026 Initialization Preview ===\n');
const start = new Date(2026, 4, 1); // May 1
const end = new Date(2026, 4, 31);  // May 31
const cur = new Date(start);
let holidays = [];

while (cur <= end) {
    const type = getHolidayType(cur);
    const dateStr = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
    if (type.startsWith('holiday')) {
        holidays.push(`  ${dateStr} (${dayNames[cur.getDay()]}) → ${type}`);
    }
    cur.setDate(cur.getDate() + 1);
}

console.log('Holidays:');
holidays.forEach(h => console.log(h));
console.log(`\nTotal holidays: ${holidays.length}`);
console.log(`Total working: ${31 - holidays.length}`);
