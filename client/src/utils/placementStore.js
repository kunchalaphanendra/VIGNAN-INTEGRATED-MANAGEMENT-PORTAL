/* Shared in-memory placement job store (singleton pattern) */
let JOBS = [
    {
        id: 1, company: 'TCS', role: 'Software Engineer', description: 'Join TCS as a Software Engineer and work on enterprise applications. Selected candidates will undergo a 3-month training program.',
        minCgpa: 6.5, years: [3, 4], departments: ['CSE', 'ECE', 'IT'],
        openings: 120, openDate: '2026-03-01', closeDate: '2026-03-28',
        applyLink: 'https://tcs.com/careers', contact: 'hr@tcs.com', status: 'Active',
    },
    {
        id: 2, company: 'Infosys', role: 'Systems Engineer', description: 'Infosys Power Programmer challenge for high performers. Work in agile teams on cutting-edge products.',
        minCgpa: 7.0, years: [3, 4], departments: ['CSE', 'IT', 'MECH'],
        openings: 60, openDate: '2026-03-10', closeDate: '2026-04-05',
        applyLink: 'https://infosys.com/careers', contact: 'campus@infosys.com', status: 'Active',
    },
    {
        id: 3, company: 'Wipro', role: 'Project Engineer', description: 'Wipro ELITE National Talent Hunt. Work across service lines including cloud, cybersecurity, and AI.',
        minCgpa: 6.0, years: [4], departments: ['CSE', 'ECE', 'EEE', 'MECH'],
        openings: 200, openDate: '2026-02-15', closeDate: '2026-03-14',
        applyLink: 'https://wipro.com/careers', contact: 'campus@wipro.com', status: 'Closed',
    },
    {
        id: 4, company: 'Google', role: 'Associate Product Manager Intern', description: 'Google APM Internship for final-year high achievers. Work on real-world product challenges in Google Hyderabad.',
        minCgpa: 9.0, years: [4], departments: ['CSE', 'IT'],
        openings: 5, openDate: '2026-04-01', closeDate: '2026-04-20',
        applyLink: 'https://careers.google.com', contact: 'intern-apm@google.com', status: 'Upcoming',
    },
];

let nextId = 5;

export const placementStore = {
    getAll: () => [...JOBS],
    add: (job) => { const j = { ...job, id: nextId++ }; JOBS = [...JOBS, j]; return j; },
    update: (id, updates) => { JOBS = JOBS.map(j => j.id === id ? { ...j, ...updates } : j); },
    remove: (id) => { JOBS = JOBS.filter(j => j.id !== id); },
};

export const ALL_DEPARTMENTS = ['CSE', 'ECE', 'EEE', 'IT', 'MECH', 'CIVIL', 'MBA'];
export const ALL_YEARS = [1, 2, 3, 4];
