// ─── Mock Faculty for CSE Dept ───────────────────────────────────────────────
export const MOCK_FEEDBACK_FACULTY = [
  { id: 'FAC001', name: 'P. Anand Babu', designation: 'Associate Professor', subjects: ['Data Structures', 'DBMS'] },
  { id: 'FAC002', name: 'K. Srinivasa Rao', designation: 'Assistant Professor', subjects: ['Operating Systems', 'Computer Networks'] },
  { id: 'FAC003', name: 'M. Lakshmi Prasad', designation: 'Professor', subjects: ['Software Engineering', 'Web Technologies'] },
];

// ─── Mock Students for CSE Dept (used in submission tracker) ─────────────────
export const MOCK_FEEDBACK_STUDENTS = [
  { rollNumber: '21CSE001', name: 'Ravi Kumar',       year: 2, section: 'A' },
  { rollNumber: '21CSE002', name: 'Priya Sharma',     year: 2, section: 'A' },
  { rollNumber: '21CSE003', name: 'Arun Reddy',       year: 2, section: 'A' },
  { rollNumber: '21CSE004', name: 'Divya Nair',       year: 2, section: 'B' },
  { rollNumber: '21CSE005', name: 'Kiran Babu',       year: 2, section: 'B' },
  { rollNumber: '21CSE006', name: 'Sneha Patil',      year: 2, section: 'B' },
  { rollNumber: '21CSE007', name: 'Venkat Rao',       year: 2, section: 'A' },
  { rollNumber: '21CSE008', name: 'Anjali Gupta',     year: 2, section: 'A' },
];

// ─── Feedback Cycles ─────────────────────────────────────────────────────────
// Starts empty — HOD creates their own cycles from the portal
export const FEEDBACK_CYCLES = [];

// ─── Helper: Calculate weighted avg score for a faculty ──────────────────────
// Excellent=4, Good=3, Average=2, Bad=1
export function calcFacultyScore(ratings, fields) {
  let totalScore = 0;
  let fieldCount = 0;
  fields.forEach(field => {
    const r = ratings[field.id] || {};
    const weights = { Excellent: 4, Good: 3, Average: 2, Bad: 1 };
    let sum = 0, count = 0;
    Object.entries(r).forEach(([opt, cnt]) => {
      sum += (weights[opt] || 0) * cnt;
      count += cnt;
    });
    if (count > 0) {
      totalScore += sum / count;
      fieldCount++;
    }
  });
  return fieldCount > 0 ? parseFloat((totalScore / fieldCount).toFixed(2)) : 0;
}

// ─── Helper: Get response count for a faculty ────────────────────────────────
export function getFacultyResponseCount(ratings, fields) {
  if (!ratings || !fields.length) return 0;
  const firstField = fields[0];
  const r = ratings[firstField.id] || {};
  return Object.values(r).reduce((a, b) => a + b, 0);
}

// ─── Helper: Get best and weakest fields for a faculty ───────────────────────
export function getBestAndWeakestFields(ratings, fields) {
  const weights = { Excellent: 4, Good: 3, Average: 2, Bad: 1 };
  let best = null, bestScore = -1;
  let weakest = null, weakestScore = 999;

  fields.forEach(field => {
    const r = ratings[field.id] || {};
    let sum = 0, count = 0;
    Object.entries(r).forEach(([opt, cnt]) => {
      sum += (weights[opt] || 0) * cnt;
      count += cnt;
    });
    if (count > 0) {
      const score = sum / count;
      if (score > bestScore) { bestScore = score; best = field.label; }
      if (score < weakestScore) { weakestScore = score; weakest = field.label; }
    }
  });
  return { best, weakest };
}
