/**
 * GPA Computation Utility
 * Grade boundary logic for Vignan College Portal
 */

function computeGrade(percentage) {
    if (percentage >= 90) return { letter: 'A+', points: 10 };
    if (percentage >= 80) return { letter: 'A', points: 9 };
    if (percentage >= 70) return { letter: 'B+', points: 8 };
    if (percentage >= 60) return { letter: 'B', points: 7 };
    if (percentage >= 50) return { letter: 'C', points: 6 };
    if (percentage >= 40) return { letter: 'D', points: 5 };
    return { letter: 'F', points: 0 };
}

function computeSGPA(subjectGrades) {
    // subjectGrades = [{ gradePoints, credits }, ...]
    if (!subjectGrades || subjectGrades.length === 0) return 0;
    const totalCredits = subjectGrades.reduce((s, g) => s + g.credits, 0);
    if (totalCredits === 0) return 0;
    const weightedSum = subjectGrades.reduce((s, g) => s + (g.gradePoints * g.credits), 0);
    return parseFloat((weightedSum / totalCredits).toFixed(2));
}

function computeCGPA(semesterData) {
    // semesterData = [{ sgpa, totalCredits }, ...]
    if (!semesterData || semesterData.length === 0) return 0;
    const totalCredits = semesterData.reduce((s, sem) => s + sem.totalCredits, 0);
    if (totalCredits === 0) return 0;
    const weightedSum = semesterData.reduce((s, sem) => s + (sem.sgpa * sem.totalCredits), 0);
    return parseFloat((weightedSum / totalCredits).toFixed(2));
}

module.exports = { computeGrade, computeSGPA, computeCGPA };
