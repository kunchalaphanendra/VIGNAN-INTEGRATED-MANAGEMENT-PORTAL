# 🎓 VIGNAN Integrated Management Portal (VIMP)

<div align="center">

![VIMP Banner](https://img.shields.io/badge/VIGNAN-Integrated%20Management%20Portal-blue?style=for-the-badge&logo=graduation-cap)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js)
![MySQL](https://img.shields.io/badge/MySQL-Database-4479A1?style=for-the-badge&logo=mysql)
![License](https://img.shields.io/badge/License-ISC-green?style=for-the-badge)

**A full-stack academic management system for Vignan's Institute of Information Technology**  
*Streamlining education administration across Students, Faculty, HODs, and Principals*

---



</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Portal Roles](#-portal-roles)
- [API Routes](#-api-routes)
- [Author](#-author)

---

## 🌟 Overview

The **VIGNAN Integrated Management Portal (VIMP)** is a comprehensive, role-based academic management system built for Vignan's Institute of Information Technology (CSE-DS Department). It provides a unified platform for managing all academic operations — from attendance tracking and marks entry to placement postings and student feedback — across four distinct user roles.

---

## ✨ Features

### 🎓 Student Portal
| Feature | Description |
|---|---|
| 📊 Dashboard | Real-time CGPA, attendance %, and academic overview |
| 📅 Attendance | Subject-wise attendance tracking with projections |
| 📝 Marks | Mid-term & end-term marks with grade calculations |
| 🏆 Grades & CGPA | Semester-wise grade report and CGPA history |
| 📋 Timetable | Weekly class schedule view |
| 💼 Placements | Browse job listings from HOD & Principal |
| 🛠️ Projects | View and manage academic projects |
| 📣 Feedback | Submit feedback forms issued by HOD |
| 📩 Complaints | Raise and track academic complaints |
| 🌿 Leaves | Apply for leave requests |

### 👨‍🏫 Faculty Portal
| Feature | Description |
|---|---|
| 📊 Dashboard | Overview of assigned subjects and student stats |
| ✅ Attendance | Mark and manage student attendance per class |
| 📝 Marks | Enter and publish student marks (Mid/End term) |
| 📋 Timetable | View assigned timetable |
| 💼 Placements | Browse placement opportunities |
| 🛠️ Projects | Manage student project submissions |
| 📊 Polls | View and participate in department polls |
| 🌿 My Leaves | Apply and track personal leave requests |
| 👨‍🎓 Student Leaves | Approve/reject student leave applications |

### 🏢 HOD Portal
| Feature | Description |
|---|---|
| 📊 Dashboard | Department-wide analytics and KPIs |
| 👥 Students | Full student data management and promotion |
| 👨‍🏫 Faculty | Manage department faculty and assignments |
| ✅ Attendance | Monitor department-wide attendance |
| 📝 Marks | Oversee and lock marks entries |
| 📋 Timetable | Configure and publish timetables |
| 🗓️ Academic Calendar | Manage working days and holidays |
| 📊 Analytics | Advanced academic performance analytics |
| 📈 Monthly Reports | Generate monthly academic reports |
| 🔧 Subjects | Manage department subjects |
| ⏰ Periods Config | Configure daily period schedule |
| 💼 Placements | Post and manage department job opportunities |
| 📣 Feedback Portal | Create and distribute targeted feedback forms |
| 📩 Complaints | Review and resolve student complaints |
| 🔄 Reset Data | Academic year data reset operations |
| 📚 Assignments | Manage student assignments |
| 🎓 Promote Students | Handle year-end student promotions |

### 🏛️ Principal Portal
| Feature | Description |
|---|---|
| 📊 Dashboard | Institution-wide statistics and overview |
| 🏢 Departments | Manage all departments |
| 👥 Students | Institution-wide student overview |
| 🏫 HODs | Manage Head of Departments |
| 💼 Placements | Post institution-wide job opportunities |
| 📣 Polls | Create and manage institution polls |
| 🗓️ Calendar | Academic calendar management |
| 📢 Notices | Publish official notices |
| 📊 Reports | Generate institution-wide reports |
| 📩 Complaints | Review escalated complaints |
| ⚙️ Settings | System-wide configuration |

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| **React** | 18 | UI framework |
| **Vite** | Latest | Build tool & dev server |
| **React Router DOM** | v6 | Client-side routing |
| **Vanilla CSS** | — | Custom styling & responsive design |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| **Node.js** | LTS | Runtime environment |
| **Express** | v5 | REST API framework |
| **MySQL2** | v3 | Database driver |
| **JWT** | v9 | Authentication tokens |
| **Bcrypt** | v6 | Password hashing |
| **Multer** | v2 | File upload handling |
| **ExcelJS** | v4 | Excel report generation |
| **PDFKit** | v0.17 | PDF report generation |
| **Nodemailer** | v8 | Email notifications |
| **Twilio** | v5 | SMS notifications |
| **Cookie-Parser** | v1.4 | Session cookie handling |
| **CORS** | v2.8 | Cross-origin resource sharing |
| **Dotenv** | v17 | Environment variable management |

### Database
- **MySQL** — Relational database for all academic data

---

## 📁 Project Structure

```
VIGNAN-INTEGRATED-MANAGEMENT-PORTAL/
│
├── 📁 client/                        # React Frontend (Vite)
│   ├── 📁 src/
│   │   ├── 📁 components/            # Reusable UI components
│   │   │   ├── DashboardLayout.jsx
│   │   │   ├── Navbar.jsx
│   │   │   └── Sidebar.jsx
│   │   ├── 📁 pages/
│   │   │   ├── 📁 student/           # Student portal pages
│   │   │   │   ├── Dashboard.jsx
│   │   │   │   ├── Attendance.jsx
│   │   │   │   ├── Marks.jsx
│   │   │   │   ├── Grades.jsx
│   │   │   │   ├── Timetable.jsx
│   │   │   │   ├── Placements.jsx
│   │   │   │   ├── Projects.jsx
│   │   │   │   ├── Feedback.jsx
│   │   │   │   ├── Complaints.jsx
│   │   │   │   └── Leaves.jsx
│   │   │   ├── 📁 faculty/           # Faculty portal pages
│   │   │   │   ├── Dashboard.jsx
│   │   │   │   ├── Attendance.jsx
│   │   │   │   ├── Marks.jsx
│   │   │   │   ├── Timetable.jsx
│   │   │   │   ├── Projects.jsx
│   │   │   │   └── Polls.jsx
│   │   │   ├── 📁 hod/               # HOD portal pages
│   │   │   │   ├── Dashboard.jsx
│   │   │   │   ├── Students.jsx
│   │   │   │   ├── Faculty.jsx
│   │   │   │   ├── Marks.jsx
│   │   │   │   ├── Attendance.jsx
│   │   │   │   ├── Timetable.jsx
│   │   │   │   ├── Placements.jsx
│   │   │   │   ├── FeedbackPortal.jsx
│   │   │   │   ├── Analytics.jsx
│   │   │   │   └── MonthlyReports.jsx
│   │   │   └── 📁 principal/         # Principal portal pages
│   │   │       ├── Dashboard.jsx
│   │   │       ├── Departments.jsx
│   │   │       ├── Placements.jsx
│   │   │       ├── Polls.jsx
│   │   │       └── Reports.jsx
│   │   ├── Landing.jsx               # Public landing page
│   │   └── Login.jsx                 # Authentication page
│   ├── package.json
│   └── vite.config.js
│
├── 📁 server/                        # Node.js Backend (Express)
│   ├── 📁 routes/
│   │   ├── auth.js                   # Authentication routes
│   │   ├── student.js                # Student API routes
│   │   ├── faculty.js                # Faculty API routes
│   │   ├── hod.js                    # HOD API routes
│   │   └── principal.js              # Principal API routes
│   ├── 📁 controllers/               # Route controllers
│   ├── 📁 middleware/
│   │   └── uploadImport.js           # File upload middleware
│   ├── 📁 utils/
│   │   ├── gpa.js                    # GPA calculation utilities
│   │   ├── mailer.js                 # Email service
│   │   ├── notificationService.js    # Notification utilities
│   │   └── sms.js                    # SMS service (Twilio)
│   ├── 📁 db/
│   │   └── migrate_v2.sql            # Database migration scripts
│   ├── server.js                     # Express app entry point
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:
- **Node.js** (v18 or higher) → [Download](https://nodejs.org/)
- **MySQL** (v8 or higher) → [Download](https://dev.mysql.com/downloads/)
- **Git** → [Download](https://git-scm.com/)

### 1. Clone the Repository

```bash
git clone https://github.com/kunchalaphanendra/VIGNAN-INTEGRATED-MANAGEMENT-PORTAL.git
cd VIGNAN-INTEGRATED-MANAGEMENT-PORTAL
```

### 2. Setup the Backend

```bash
cd server
npm install
```

Create a `.env` file in the `server/` directory (see [Environment Variables](#-environment-variables))

```bash
# Start the backend server
node server.js
```

The server will run on **http://localhost:5000**

### 3. Setup the Frontend

```bash
cd client
npm install
npm run dev
```

The frontend will run on **http://localhost:5173**

---

## 🔐 Environment Variables

Create a `.env` file in the `server/` directory with the following:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=vignan_portal

# JWT Secret
JWT_SECRET=your_jwt_secret_key

# Email Configuration (Nodemailer)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Twilio SMS (optional)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE=your_twilio_phone_number

# Server
PORT=5000
```

> ⚠️ **Never commit your `.env` file to version control.** It is already included in `.gitignore`.

---

## 👥 Portal Roles

| Role | Login Type | Access Level |
|---|---|---|
| 🎓 **Student** | Student credentials | Personal academic data |
| 👨‍🏫 **Faculty** | Faculty credentials | Assigned subject management |
| 🏢 **HOD** | HOD credentials | Full department management |
| 🏛️ **Principal** | Principal credentials | Institution-wide oversight |

---

## 🔗 API Routes

### Authentication
| Method | Route | Description |
|---|---|---|
| `POST` | `/api/auth/login` | User login (all roles) |
| `POST` | `/api/auth/logout` | User logout |

### Student Routes (`/api/student/`)
| Method | Route | Description |
|---|---|---|
| `GET` | `/dashboard` | Get student dashboard data |
| `GET` | `/attendance` | Get attendance records |
| `GET` | `/marks` | Get marks data |
| `GET` | `/timetable` | Get class timetable |
| `POST` | `/complaints` | Submit a complaint |
| `POST` | `/feedback` | Submit feedback form |

### Faculty Routes (`/api/faculty/`)
| Method | Route | Description |
|---|---|---|
| `GET` | `/dashboard` | Get faculty dashboard |
| `POST` | `/attendance` | Mark attendance |
| `POST` | `/marks` | Enter student marks |

### HOD Routes (`/api/hod/`)
| Method | Route | Description |
|---|---|---|
| `GET` | `/dashboard` | HOD dashboard stats |
| `GET/POST` | `/students` | Student management |
| `GET/POST` | `/faculty` | Faculty management |
| `POST` | `/marks/lock` | Lock marks entry |
| `POST` | `/feedback` | Create feedback forms |
| `POST` | `/placements` | Post job opportunities |
| `POST` | `/reset` | Academic year reset |

### Principal Routes (`/api/principal/`)
| Method | Route | Description |
|---|---|---|
| `GET` | `/dashboard` | Institution overview |
| `GET` | `/departments` | All departments data |
| `POST` | `/placements` | Post institution jobs |
| `POST` | `/notices` | Publish notices |
| `POST` | `/polls` | Create polls |

---

## 👨‍💻 Author

<div align="center">

### **Kunchala Phanendra**

[![GitHub](https://img.shields.io/badge/GitHub-kunchalaphanendra-181717?style=for-the-badge&logo=github)](https://github.com/kunchalaphanendra)

*B.Tech CSE (Data Science) — Vignan's Institute of Information Technology*

---

> *"Building systems that make education management smarter and more connected."*

</div>

---

<div align="center">

**⭐ If you found this project useful, please consider giving it a star!**

Made with ❤️ by **Kunchala Phanendra**

</div>
