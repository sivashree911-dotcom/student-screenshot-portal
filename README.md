# STUDENT SCREENSHOT PORTAL

A complete, production-ready college web application used to verify student eligibility, display hackathons, collect registration screenshots/proof, manage team members, and track student participation.

---

## 🌟 Key Features

### For Students
* **Student Verification**: Enter register number (e.g. `1300`), normalized and checked against the approved student directory.
* **Secure Student Session**: Authenticated via JWT token without exposing sensitive list data to the frontend.
* **Hackathon Dashboard**: Browse active hackathons with institution details, dates, deadlines, mode, and team limits.
* **External Registration**: Safe link out to official hackathon portals (Unstop, Devpost, SIH, etc.).
* **Registration Proof Upload**: Upload proof screenshot (PNG, JPG, JPEG, WEBP <= 5 MB) with live preview and replacement.
* **Team Management**: Verified student automatically assigned as Captain; add college members with real-time approved status check (`✓ Verified College Student`).
* **External Participants**: Support for adding external students with institution tagging when allowed by the hackathon.
* **Duplicate Prevention**: Rejects duplicate register numbers and captain duplication.
* **Submission Tracking**: Instant unique Submission ID (`SUB-YYYY-XXXXXX`) and live status tracking (`Pending`, `Verified`, `Rejected` with reason).
* **Privacy**: Students only see their own submissions; **no admin links or buttons exist anywhere in student UI**.

### For Administrators (Hidden Route `/admin/login`)
* **Dedicated Hidden Portal**: Accessible only via protected route `/admin/login`.
* **Secure Authentication**: Password hashing via Bcrypt, JWT auth token protection on all administrative API endpoints.
* **KPI Dashboard**: Real-time counts for Approved Students, Active Hackathons, Total Submissions, Pending, Verified, Rejected, and Turnout Percentage.
* **Student Management**: View all approved students with search by register number/name and department/year filters.
* **Hackathon Management**: Full CRUD with poster upload, registration links, team size bounds, and external eligibility toggles.
* **Submission Review**: Review uploaded screenshot proofs with zoom viewer, inspect team rosters, and **Verify** or **Reject** with mandatory feedback.
* **Team Directory**: Filter teams by hackathon, inspect captain and college vs. external member distributions.
* **Participation Analytics**:
  * Calculates unique approved college students appearing in **Verified** submissions.
  * Displays **Participated List** and **Not Participated List** for any selected hackathon.
  * **Duplicate Participation Detection**: Flags students registered in multiple teams for the same hackathon.
  * **CSV Report Export**: Download full hackathon participation breakdown.
  * **Cross-Hackathon Participation Matrix**: Grid view (`✓ Participated` / `— Not Participated`) with CSV download.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, React Router DOM, Lucide Icons, Modern CSS Design System |
| **Backend** | Node.js, Express.js, Multer, JWT, Bcrypt |
| **Database** | MySQL 8.0+ (`mysql2/promise` connection pool) with embedded fallback resilience |
| **Integrations** | Google Sheets + Google Apps Script Web App API |

---

## 📁 Project Structure

```text
SCREENSHOT PORTAL/
├── backend/
│   ├── config/
│   │   ├── config.js               # Environment configuration loader
│   │   └── db.js                   # MySQL connection pool & table initializer
│   ├── controllers/
│   │   ├── adminController.js      # Dashboard stats & system health
│   │   ├── authController.js       # Admin authentication & password change
│   │   ├── hackathonController.js  # Hackathon CRUD & poster uploads
│   │   ├── participationController.js # Participation math & CSV export
│   │   ├── studentController.js    # Student validation & Sheets integration
│   │   └── submissionController.js # Proof upload & verification workflow
│   ├── data/
│   │   ├── sampleStudents.json     # Approved students dataset / fallback
│   │   └── portal.sqlite           # Persistent relational storage fallback
│   ├── middleware/
│   │   ├── authMiddleware.js       # Admin & Student JWT guards
│   │   ├── errorMiddleware.js      # Central error & upload error handler
│   │   └── uploadMiddleware.js     # Multer 5MB file validation
│   ├── routes/
│   │   ├── adminRoutes.js
│   │   ├── authRoutes.js
│   │   ├── hackathonRoutes.js
│   │   ├── participationRoutes.js
│   │   ├── studentRoutes.js
│   │   └── submissionRoutes.js
│   ├── scripts/
│   │   ├── createAdmin.js          # CLI script to create/reset admin
│   │   ├── generatePosters.js      # Sample SVG poster generator
│   │   ├── initDb.js               # Database initializer
│   │   └── testEndToEnd.js         # Complete 22-step integration test suite
│   ├── uploads/
│   │   ├── posters/                # Hackathon poster graphics
│   │   └── screenshots/            # Uploaded student registration proofs
│   ├── server.js                   # Express server entry point
│   ├── package.json
│   └── .env.example
├── database/
│   ├── schema.sql                  # MySQL table definitions
│   └── seed.sql                    # Initial seed data
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AdminLayout.jsx     # Admin sidebar navigation
│   │   │   ├── FileUpload.jsx      # Drag & drop screenshot upload
│   │   │   ├── Modal.jsx           # Accessible modal dialog
│   │   │   ├── Navbar.jsx          # Student navigation (No Admin Links)
│   │   │   └── ProtectedRoute.jsx  # Route guards for students and admins
│   │   ├── context/
│   │   │   ├── AdminAuthContext.jsx
│   │   │   └── StudentAuthContext.jsx
│   │   ├── pages/
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── AdminHackathons.jsx
│   │   │   ├── AdminLogin.jsx
│   │   │   ├── AdminMatrix.jsx
│   │   │   ├── AdminParticipation.jsx
│   │   │   ├── AdminSettings.jsx
│   │   │   ├── AdminStudents.jsx
│   │   │   ├── AdminSubmissions.jsx
│   │   │   ├── AdminTeams.jsx
│   │   │   ├── HackathonDashboard.jsx
│   │   │   ├── HackathonDetailSubmission.jsx
│   │   │   ├── MySubmissions.jsx
│   │   │   └── StudentVerify.jsx
│   │   ├── services/
│   │   │   └── api.js              # Fetch client with auto auth injection
│   │   ├── styles/
│   │   │   └── index.css           # Modern CSS Design System
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── google-apps-script/
│   ├── Code.gs                     # Google Apps Script Web App API
│   └── README_APPS_SCRIPT.md       # Google Sheet setup guide
├── package.json                    # Root workspace runner
└── README.md
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
* **Node.js** v18.0.0 or higher
* **MySQL** 8.0+ (Optional for local testing; automatic persistent storage fallback is built-in)

### 2. Installation
From the project root:

```bash
npm run install:all
```

---

## 🗄️ MySQL Database Setup

1. Open your MySQL client (e.g. MySQL Workbench, phpMyAdmin, or MySQL CLI).
2. Execute the schema file located at [`database/schema.sql`](./database/schema.sql):
   ```sql
   SOURCE database/schema.sql;
   ```
3. Optionally seed demo data located at [`database/seed.sql`](./database/seed.sql):
   ```sql
   SOURCE database/seed.sql;
   ```
4. Update your database credentials in `backend/.env`.

---

## ⚙️ Environment Variables

Create `backend/.env` (or copy from `backend/.env.example`):

```env
PORT=5000
NODE_ENV=development

# MySQL Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=student_screenshot_portal

# Security
JWT_SECRET=your_super_secret_jwt_key_portal_2026
JWT_EXPIRES_IN=7d

# Google Apps Script API URL (leave empty for sample student catalog)
APPS_SCRIPT_API_URL=

UPLOAD_DIR=uploads
```

---

## 📊 Google Sheet & Google Apps Script Setup

1. Create a Google Sheet with a tab named **Students**.
2. Add these headers in Row 1:
   `Register Number` | `Student Name` | `Email` | `Department` | `Year` | `Section` | `Status`
3. In Google Sheets, click **Extensions** > **Apps Script**.
4. Paste the code from [`google-apps-script/Code.gs`](./google-apps-script/Code.gs).
5. Click **Deploy** > **New deployment** > **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the Web App URL and paste into `backend/.env`:
   ```env
   APPS_SCRIPT_API_URL=https://script.google.com/macros/s/AKfycb.../exec
   ```

---

## 👤 Administrator Account Setup

To create or reset an administrator account securely:

```bash
# Default credentials: admin@college.edu / AdminPassword@123
npm run create-admin

# Or with custom credentials:
node backend/scripts/createAdmin.js "Portal Administrator" "admin@college.edu" "YourSecurePassword"
```

---

## 🖥️ Running the Application

### Option A: Run Both Frontend and Backend Concurrently (Recommended)
```bash
npm run dev
```

### Option B: Run Services Separately

**Terminal 1 (Backend API):**
```bash
npm run backend
# Running at http://localhost:5000
```

**Terminal 2 (Frontend React App):**
```bash
npm run frontend
# Running at http://localhost:3000
```

---

## 🧪 Testing

Run the automated 22-step integration test suite:

```bash
node backend/scripts/testEndToEnd.js
```

---

## 🧭 Application Navigation

* **Student Portal**: [http://localhost:3000/](http://localhost:3000/)
  * Example Register Number: `1300` (or `1301`, `1302`, etc.)
* **Admin Login (Hidden Route)**: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)
  * Email: `admin@college.edu`
  * Password: `AdminPassword@123`

---

## 📈 Participation Calculation Logic

1. **Participation Basis**: A student is counted as participating only when their register number appears in a **Verified** submission for a given hackathon.
2. **Team Member Inclusivity**: All college students in a verified team count as participants (not just the captain).
3. **External Participants**: External members are tagged and never counted toward the college student participation count.
4. **Duplicate Detection**: If a student is registered in multiple teams for the same hackathon, they are counted as **1 participant** and flagged in the **Duplicate Participation Alert** for admin review.
5. **Formulas**:
   $$\text{Participated Count} = \text{Unique approved register numbers in verified teams}$$
   $$\text{Not Participated Count} = \text{Total Approved Students} - \text{Participated Count}$$
   $$\text{Participation Rate} = \left(\frac{\text{Participated Count}}{\text{Total Approved Students}}\right) \times 100\%$$

---

## 🛡️ Security Architecture

* **No Student Admin Exposure**: Zero admin links, buttons, or hints in student navigation.
* **Server-Side Validation**: Team sizes, register numbers, duplicate entries, file formats, and sizes are validated on the backend.
* **Safe File Storage**: Multer generates sanitized, collision-resistant server-side filenames and validates MIME types and 5MB size limits.
* **Authentication**: Bcrypt password hashing (10 rounds) and signed JWT tokens with expiration.
