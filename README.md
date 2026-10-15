# College Student Management Portal

A full-stack college ERP / student portal. Students, faculty and administrators each get their own dashboard and menu.

**React** (Vite) · **Node.js + Express** · **MySQL 8** · JWT login · bcrypt passwords · role-based access · PDF documents · file uploads · mock payment gateway

Everything runs on your own computer. No hosted database, backend, login or storage service is used.

---

## 1. What it does

| Role | Main things they can do |
|---|---|
| **Student** | Dashboard with charts · attendance (low-attendance warnings) · marks · grade card (SGPA / CGPA) · hall ticket · exam schedule · timetable (choose a version) · fee details · **online payment** with receipt · transactions · library books (renew, fines) · hostel room request · lesson plans · answer sheets · backlogs · academic calendar · profile and photo · notifications · **PDF** grade card, hall ticket, receipts, timetable |
| **Faculty** | Mark and correct attendance (P / A / L) with percentage reports · enter marks (draft, then finalize) · lesson plans · create exams · upload and release answer sheets · students list · teaching timetable · calendar events |
| **Admin** | Manage students, faculty, departments, courses, semesters, subjects · fees (add, charge a whole semester) · payments · library desk (issue / return / fines) and catalogue · hostel (approve requests, rooms, occupancy) · timetable builder · hall tickets · grade-card publishing · backlogs · calendar |

---

## 2. Project structure

```
college-management-portal/
├── client/                      React frontend (http://localhost:5173)
│   └── src/
│       ├── components/          reusable UI (DataTable, Modal, Toast, CrudManager, charts, Receipt, ...)
│       ├── pages/               one file per screen  (student/  staff/  shared/)
│       ├── layouts/             DashboardLayout (sidebar + top bar), AuthLayout
│       ├── services/            api.js (Axios + token + errors), authService.js
│       ├── context/             AuthContext, ThemeContext (dark mode), ToastContext
│       ├── hooks/               useFetch, useList (pagination + search), useOptions ...
│       ├── utils/               menu.js (sidebar per role), format.js, calendar.js, print.js ...
│       ├── styles/              global.css (colours, dark mode, layout), components.css
│       ├── routes.jsx           every URL and the roles allowed to open it
│       ├── App.jsx, main.jsx
├── server/                      Express backend (http://localhost:5000)
│   ├── config/                  env.js (settings + safety checks), db.js (MySQL pool, transactions)
│   ├── routes/                  one file per module + routes/index.js (the map of the API)
│   ├── controllers/             request in, response out
│   ├── services/                business rules (grades, fees, attendance, notifications) and services/pdf/
│   ├── middleware/              auth (JWT), role, validate, upload, rateLimiter, errorHandler
│   ├── utils/                   crud.js (reusable CRUD), pagination, validators, grades ...
│   ├── models/                  (empty on purpose: queries are plain SQL, see "How it works")
│   ├── uploads/                 profile-photos/ and answer-sheets/ (not public)
│   ├── assets/logo.png          logo used in PDFs
│   ├── scripts/verify.js        end-to-end checker (npm run verify)
│   ├── app.js, server.js
├── database/
│   ├── schema.sql               31 tables, keys, indexes, CHECK constraints
│   └── seed.sql                 demo data (5 students, 2 faculty, 1 admin, ...)
├── docs/API.md                  all 145 endpoints with the roles that may call them
├── .env.example                 copy to .env
└── package.json                 helper scripts
```

---

## 3. Setup (about 10 minutes)

### Requirements

| Tool | Version | Check with |
|---|---|---|
| Node.js | 18 or newer (20 recommended) | `node -v` |
| MySQL Server | **8.0.16 or newer** (older versions silently ignore the CHECK rules that stop hostel overbooking) | `mysql --version` |

### Step 1 - Database

```bash
cd college-management-portal
mysql -u root -p < database/schema.sql                      # creates the database college_management and all tables
mysql -u root -p college_management < database/seed.sql     # loads the demo data
```

(`npm run db:schema` and `npm run db:seed` do the same.) You can re-run both files at any time to reset everything. This deletes all data.

### Step 2 - Settings

```bash
cp .env.example .env
```

Open `.env` and set:

* `DB_PASSWORD` - your MySQL root password
* `JWT_SECRET` - a long random string. Generate one with
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
  The server refuses to start with the placeholder or a short secret.

### Step 3 - Backend

```bash
cd server
npm install
npm run dev
```

You should see `MySQL connected` and `API running on http://localhost:5000`.
Test: open <http://localhost:5000/api/health>. It must answer `"database": "ok"`.

### Step 4 - Frontend (a second terminal)

```bash
cd client
npm install
npm run dev
```

Open <http://localhost:5173>.

> The backend allows exactly one website origin, `CLIENT_URL` (default `http://localhost:5173`). If you change the frontend port, change `CLIENT_URL` in `.env` too.

---

## 4. Demo login accounts (development only)

These exist only because `seed.sql` creates them. **Delete or change them before any real use.** Passwords are stored as bcrypt hashes, never as text.

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `Admin@123` |
| Faculty | `faculty01` | `Faculty@123` (`faculty02` has the same password) |
| Student | `student01` | `Student@123` (`student02` to `student05` too; a Student ID such as `24CS001` also works as the username) |

Handy demo students: `student04` and `student05` have **low attendance** (red warnings), `student05` has a **blocked hall ticket** and a **backlog**, `student03` has a **partly paid** fee, `student02` is a boy (sees only the boys' hostel).

---

## 5. Settings reference (`.env`)

| Variable | Default / example | Meaning |
|---|---|---|
| `PORT` | `5000` | Backend port |
| `NODE_ENV` | `development` | Use `production` when deployed (hides error details, disables the "simulate failed payment" test flag) |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | `localhost`, `3306`, `college_management`, `root`, *yours* | MySQL connection |
| `JWT_SECRET` | *you generate it* | Signs login tokens. Must be 16+ characters (32+ recommended). |
| `JWT_EXPIRES_IN` / `JWT_REMEMBER_EXPIRES_IN` | `1h` / `7d` | Token lifetime without / with "Remember me" |
| `CLIENT_URL` | `http://localhost:5173` | The only origin allowed by CORS |
| `COLLEGE_NAME` | Greenfield Institute of Technology | Printed on receipts, hall tickets, grade cards |
| `API_RATE_LIMIT` / `LOGIN_RATE_LIMIT` | `300` / `10` | Requests per 15 minutes per IP |

Frontend (optional `client/.env`): `VITE_API_URL` (default `http://localhost:5000/api`) and `VITE_COLLEGE_NAME`. Only `VITE_` variables reach the browser, so never put secrets there.

---

## 6. Check that everything works

### 6a. Automatic backend check (`npm run verify`)

This tests the real running server and database: health, login, wrong passwords, expired/tampered tokens, role rules, the three dashboards, database relationships, CRUD, attendance, marks and grades, fees and payments (partial, full, failed), hostel rules (full room, one request per student, overbooking), library, answer-sheet uploads, PDFs, and security headers.

The script logs in many times, so raise the rate limits for the run:

1. In `.env` set `API_RATE_LIMIT=2000` and `LOGIN_RATE_LIMIT=200`, restart the backend.
2. Run `cd server && npm run verify`.
3. Set the limits back and restart.

It writes only through one throwaway student that it creates and disables at the end. Re-run `seed.sql` to reset the data. A healthy run ends with `66 passed, 0 failed`.

### 6b. Frontend check (5 minutes)

```bash
cd client
npm run build        # must finish without errors
npm run dev
```

| Do this | You should see |
|---|---|
| Log in as `student04` | Red attendance banner and red subject cards |
| Wrong password | Red "Invalid username or password." |
| Tick *Remember me*, close the browser, reopen | Still logged in |
| As a student open `/admin/dashboard` | "Access denied" |
| Student: Online Payment, tick a fee, pay | Transaction ID, receipt popup, **Download PDF** works |
| Hall Ticket as `student01` | Ticket and **Download Hall Ticket PDF** |
| Hall Ticket as `student05` | Red "blocked" message with the reason |
| Resize the window below 960 px | Hamburger menu, slide-in sidebar, tables become cards |
| Moon icon in the top bar | Dark mode (remembered) |
| Admin: Timetables, add two classes at the same time | Error "Two classes start at ..." |
| Search for a book with SQL text `' OR 1=1 --` | Normal "No books found" |

### 6c. Documentation of the API

`docs/API.md` lists every endpoint with who may call it, request bodies, and file/PDF rules.

---

## 7. How it works (read this before your viva)

### Request flow

```
Browser (React)
  -> Axios adds  Authorization: Bearer <token>
  -> Express: helmet (security headers) -> CORS -> rate limit -> JSON body
  -> route -> validate input -> protect (is the token valid?) -> authorizeRoles (is this role allowed?)
  -> controller -> service -> MySQL (parameterised SQL)
  -> always answers { success, message, data }   (errors: { success:false, message })
```

### Key ideas, in simple words

| Topic | What we did and why |
|---|---|
| **Passwords** | Stored with **bcrypt** (a slow one-way hash with a random salt). Even the admin cannot read a password; a forgotten one is *reset* by the admin. |
| **JWT login** | After login the server signs a small token (`id`, `role`) with `JWT_SECRET`. The browser sends it on every request. The server re-checks the user in the database each time, so a disabled account stops working immediately. A token is *stateless*: "logout" means the browser forgets it. |
| **Roles** | The role lives in `users.role`. `authorizeRoles('admin')` on the route is the real protection; hiding a menu item in React is only for convenience. |
| **SQL injection** | Every query uses `?` placeholders; user text is never glued into SQL. Table/column names in the reusable CRUD come only from our code. |
| **Transactions** | Payments, hostel approval, book issue, attendance and marks run inside `withTransaction`. Either every step is saved or none. Example: a payment locks the fee rows, creates the transaction, the fee payments, updates the fees and creates the receipt together. |
| **Overbooking** | Three layers: a database `CHECK (occupied_beds <= capacity)`, a unique key allowing one pending/approved request per student, and a row lock (`FOR UPDATE`) while approving. |
| **Grades** | `utils/grades.js` is the single grading scale. Final marks produce a grade, update/clear backlogs and recalculate SGPA / CGPA from the latest attempt of each subject. |
| **Why no ORM (models/ is empty)** | Plain SQL with `mysql2` keeps every query visible and explainable. |
| **Reusable CRUD** | `server/utils/crud.js` and the React `CrudManager` describe a table in a few lines instead of copying list/create/edit/delete code ten times. |
| **Payments** | A **mock gateway** (`services/mockGateway.js`). The server never receives or stores card numbers, CVV or PIN, and rejects a request that contains them. A real gateway (Razorpay, Stripe) hosts its own payment page; you would replace only `charge()`. |
| **Files** | Uploads are not public. Every file request goes through `/api/files/...` which checks login and ownership. Uploads accept only `.pdf .jpg .jpeg .png`, check the real file bytes, limit the size, and save under a random name. |
| **PDFs** | Built on the server with `pdf-lib` (free) from the same data the screen shows, so they cannot disagree. Each document is only reachable by its owner (or the admin). |
| **Pagination** | Done in SQL (`LIMIT/OFFSET`), so the browser receives one page, not the whole table. |
| **Notifications** | Stored in a table. Low attendance, new marks, payments, hostel decisions, timetable changes and answer sheets create them; fee-due and exam alerts are created when a student opens the dashboard (no background job needed). |

### Security checklist (what is implemented)

* bcrypt hashing, JWT with expiry, role checks on every protected route
* Input validation, parameterised SQL, consistent error format that hides internal details in production
* Helmet security headers, CORS limited to one origin, rate limiting (stricter on login)
* Same login error for "unknown user" and "wrong password"; account lock-out by disabling users
* File type, content, size and name checks; protected file serving; no executables
* Secrets only in `.env` (never committed, never sent to React). A test confirms no password or secret is in the frontend source.
* Sensitive APIs (fees, receipts, grade cards, hall tickets, library, backlogs, hostel) are closed to faculty at the API level, not just hidden in the menu

### Known limits (be honest about these in your viva)

* The payment gateway is a simulation.
* Logout does not invalidate a token on the server (stateless JWT); tokens are short-lived for that reason. The token sits in the browser's storage, so keep the site free of third-party scripts.
* There is no email service; a forgotten password is reset by the administrator.
* Disabled accounts cannot be re-enabled from the screen (there is no API for it yet).
* The standard PDF fonts cover Latin letters only; other scripts print as `?`.
* Tested here with stand-in libraries and a scripted fake database; the real run on your machine is `npm run verify` and the checklist above.

---

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| `Missing environment variables` / `JWT_SECRET is too weak` | Create `.env` from `.env.example` in the **project root** (not inside `server/`) and set a real `JWT_SECRET`. |
| `Could not connect to MySQL: ER_ACCESS_DENIED_ERROR` | Wrong `DB_USER` / `DB_PASSWORD` in `.env`. |
| `ER_BAD_DB_ERROR: Unknown database` | Run `database/schema.sql` first. |
| `mysql` command not found | Add MySQL's `bin` folder to PATH, or run the two SQL files from MySQL Workbench (open file, run all). |
| Browser shows "Cannot reach the server" | Backend not running, or `VITE_API_URL` is wrong. Check <http://localhost:5000/api/health>. |
| Browser console shows a CORS error | `CLIENT_URL` in `.env` must equal the exact address in the browser bar (`http://localhost:5173`). Restart the backend after changing it. |
| `EADDRINUSE` port already in use | Another program uses 5000 or 5173. Stop it or change `PORT` (and `VITE_API_URL`). |
| "Too many login attempts" (429) | Wait 15 minutes, or raise `LOGIN_RATE_LIMIT` while testing. |
| Hostel room can be overbooked | Your MySQL is older than 8.0.16. Upgrade MySQL. |
| Login says invalid for the demo users | `seed.sql` was not loaded, or you changed the passwords. Re-run `seed.sql`. |
| PDF buttons fail | The backend must be restarted after `npm install` so `pdf-lib` is loaded. |
| Answer sheet file not found | The seed lists 9 sample files that ship in `server/uploads/answer-sheets/`. If you deleted them, upload new ones as faculty. |
| `npm run build` complains about an icon name | The icon library (`lucide-react`) renamed one; change the import in `client/src/utils/icons.js` or the file named in the error. |

---

## 9. Putting it on a real server (checklist)

1. `NODE_ENV=production`, a new strong `JWT_SECRET`, a dedicated MySQL user with only the rights it needs (not `root`).
2. Delete the demo accounts and demo data; create your own admin.
3. Serve the site over HTTPS; set `CLIENT_URL` to the real address; build the frontend with `npm run build` and serve `client/dist`.
4. Replace `services/mockGateway.js` with a real payment gateway.
5. Back up the database and the `server/uploads` folder.

---

## 10. Libraries (all free and open source)

Backend: express, mysql2, jsonwebtoken, bcryptjs, helmet, cors, dotenv, express-validator, express-rate-limit, multer, pdf-lib.
Frontend: react, react-router-dom, axios, recharts, lucide-react, vite.
