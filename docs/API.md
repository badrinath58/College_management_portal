# College Management Portal - API Reference

Base URL: `http://localhost:5000/api`. This file is generated from the real route files, so the endpoint tables cannot drift from the code.

## Conventions

| Topic | Rule |
|---|---|
| Auth | Send `Authorization: Bearer <token>` on every request except `POST /auth/login` and `GET /health`. Tokens last 1 hour (7 days with "Remember me"). |
| Success | `{ "success": true, "message": "...", "data": ... }` |
| Error | `{ "success": false, "message": "..." }` with status **400** bad input, **401** not logged in / token expired, **402** payment failed, **403** not allowed, **404** not found, **409** conflict (duplicate, room full...), **429** too many requests |
| Field names | Bodies, query strings and responses use the **database column names** (`snake_case`). The only exception is `rememberMe` on login. |
| Lists | `data = { items: [...], pagination: { page, limit, total, totalPages } }`. Use `?page=2&limit=10`; most lists also accept `?q=` to search. |
| Own data | A **student** always receives only their own rows. Faculty and admin may pass `?student_id=` where it makes sense. |
| Dates / times | `YYYY-MM-DD` and `HH:MM` |
| Rate limits | 300 requests and 10 logins per 15 minutes per IP (change with `API_RATE_LIMIT` / `LOGIN_RATE_LIMIT` in `.env`). Headers `RateLimit-*` show what is left. |
| `*` in the tables | Any logged-in user, but the data is scoped by role. |

## Who can see what

| Data | Student | Faculty | Admin |
|---|---|---|---|
| Fees, payments, transactions, receipts, grade cards, hall tickets, library issues, backlogs, hostel | own | **no access** | all |
| Attendance, marks, answer sheets | own (released only) | own subjects | all |
| Students list | no | read | manage |
| Faculty, departments, courses, semesters, subjects | read (subjects of own semester) | read | manage |

## Typical request bodies

| Endpoint | Body |
|---|---|
| `POST /auth/login` | `{ "username": "student01", "password": "...", "rememberMe": true }` (a Student ID such as `24CS001` also works) |
| `PUT /auth/password` | `{ "current_password": "...", "new_password": "..." }` (8+ chars, upper, lower, digit) |
| `PUT /students/profile` | `{ "mobile": "9876501001", "address": "..." }` (students change only these two) |
| `POST /students/profile/photo` | multipart, field `photo` (.jpg/.png, max 2 MB) |
| `POST /students` (admin) | `{ username, email, password, student_code, full_name, course_id, section, admission_year, current_year, ... }` creates the login and the profile together |
| `POST /attendance` | `{ "subject_id": 17, "section": "A", "class_date": "2026-10-05", "period_no": 2, "records": [ { "student_id": 1, "status": "present" } ] }` (present / absent / late) |
| `POST /marks` | `{ "student_id": 1, "subject_id": 17, "internal_marks": 8, "mid_marks": 15, "assignment_marks": 9, "external_marks": 50, "finalize": true }`. Maximums: theory 10/20/10/60, practical 25/25/50. `finalize` computes grade, backlog and grade card; `absent: true` records an absent result. |
| `POST /payments` | `{ "fee_ids": [7, 8], "payment_method": "upi" }` or `{ "items": [ { "fee_id": 7, "amount": 2000 } ], "payment_method": "card" }`. Admin adds `student_id` and may use `cash`. **Never** send card numbers, CVV or PIN (the request is refused). Development only: `"simulate_failure": true`. |
| `POST /hostel/bookings` | `{ "room_id": 3 }` |
| `PUT /hostel/bookings/:id/review` | `{ "action": "approve" }` or `{ "action": "reject", "remarks": "..." }` |
| `POST /library/issues` | `{ "student_id": 1, "book_id": 4, "days": 14 }` |
| `POST /timetable/select` | `{ "timetable_id": 2 }` |
| `PUT /timetable/:id/slots` | `{ "slots": [ { "day_of_week": "Monday", "start_time": "09:00", "end_time": "09:50", "subject_id": 17, "room_number": "A-204" } ] }` |
| `POST /exams` | `{ "name": "...", "exam_type": "mid", "semester_id": 5, "start_date": "...", "end_date": "...", "subjects": [ { "subject_id": 17, "exam_date": "...", "start_time": "10:00", "end_time": "11:30", "max_marks": 20 } ] }` |
| `POST /answer-sheets` | multipart: `student_id`, `exam_subject_id`, `marks_obtained?`, `release?`, `download_allowed?`, file field `file` (.pdf/.jpg/.png, max 5 MB) |
| `POST /hall-ticket/generate` | `{ "exam_id": 3 }` (blocks students under 65% attendance or with overdue fees) |

## PDF downloads

| Document | Endpoint |
|---|---|
| Fee receipt | `GET /receipts/:id/pdf` |
| Payment receipt (successful payments only) | `GET /transactions/:id/pdf` |
| Grade card | `GET /grade-card/pdf?semester_id=` (students get published semesters only; admin adds `student_id`) |
| Hall ticket (refused with 403 while blocked) | `GET /hall-ticket/:exam_id/pdf` (admin adds `student_id`) |
| Time table | `GET /timetable/pdf?timetable_id=` (student: their timetable; faculty: their teaching slots) |

They return `application/pdf` with a `Content-Disposition` file name (`?inline=true` shows it in the browser). Fetch them with the Authorization header (Axios `responseType: 'blob'`). They are never cached.

## Uploaded files

Files are never public. Use the `file_url` returned by the API (for example `GET /api/files/answer-sheets/<name>.pdf`) with the Authorization header. Add `?download=true` to download; a student needs `download_allowed`. Profile photos and answer sheets are checked for ownership on every request.

## All endpoints

### /api/health

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/health` | public |

### /api/auth

| Method | Path | Who can call it |
|---|---|---|
| POST | `/api/auth/login` | public |
| POST | `/api/auth/logout` | any logged-in user* |
| GET | `/api/auth/me` | any logged-in user* |
| PUT | `/api/auth/password` | any logged-in user* |

### /api/students

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/students/profile` | student |
| PUT | `/api/students/profile` | student |
| POST | `/api/students/profile/photo` | student |
| GET | `/api/students` | admin, faculty |
| POST | `/api/students` | admin |
| GET | `/api/students/:id` | admin, faculty |
| PUT | `/api/students/:id` | admin |
| PUT | `/api/students/:id/reset-password` | admin |
| DELETE | `/api/students/:id` | admin |

### /api/faculty

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/faculty/me` | faculty |
| GET | `/api/faculty` | admin |
| POST | `/api/faculty` | admin |
| GET | `/api/faculty/:id` | admin |
| PUT | `/api/faculty/:id` | admin |
| PUT | `/api/faculty/:id/reset-password` | admin |
| DELETE | `/api/faculty/:id` | admin |

### /api/departments

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/departments` | any logged-in user* |
| POST | `/api/departments` | admin |
| GET | `/api/departments/:id` | any logged-in user* |
| PUT | `/api/departments/:id` | admin |
| DELETE | `/api/departments/:id` | admin |

### /api/courses

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/courses` | any logged-in user* |
| POST | `/api/courses` | admin |
| GET | `/api/courses/:id` | any logged-in user* |
| PUT | `/api/courses/:id` | admin |
| DELETE | `/api/courses/:id` | admin |

### /api/semesters

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/semesters` | any logged-in user* |
| POST | `/api/semesters` | admin |
| GET | `/api/semesters/:id` | any logged-in user* |
| PUT | `/api/semesters/:id` | admin |
| DELETE | `/api/semesters/:id` | admin |

### /api/subjects

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/subjects` | any logged-in user* |
| POST | `/api/subjects` | admin |
| GET | `/api/subjects/:id` | any logged-in user* |
| PUT | `/api/subjects/:id` | admin |
| DELETE | `/api/subjects/:id` | admin |

### /api/calendar

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/calendar` | any logged-in user* |
| POST | `/api/calendar` | admin, faculty |
| GET | `/api/calendar/:id` | any logged-in user* |
| PUT | `/api/calendar/:id` | admin, faculty |
| DELETE | `/api/calendar/:id` | admin, faculty |

### /api/attendance

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/attendance` | any logged-in user* |
| GET | `/api/attendance/roster` | faculty, admin |
| GET | `/api/attendance/sessions` | faculty, admin |
| GET | `/api/attendance/sessions/:id` | faculty, admin |
| GET | `/api/attendance/report` | faculty, admin |
| POST | `/api/attendance` | faculty, admin |
| PUT | `/api/attendance/:id` | faculty, admin |

### /api/backlogs

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/backlogs` | student, admin |
| POST | `/api/backlogs` | admin |
| GET | `/api/backlogs/:id` | student, admin |
| PUT | `/api/backlogs/:id` | admin |
| DELETE | `/api/backlogs/:id` | admin |

### /api/books

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/books/search` | any logged-in user* |
| GET | `/api/books/categories` | any logged-in user* |
| GET | `/api/books` | any logged-in user* |
| POST | `/api/books` | admin |
| GET | `/api/books//:id` | any logged-in user* |
| PUT | `/api/books//:id` | admin |
| DELETE | `/api/books//:id` | admin |

### /api/library

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/library/issues` | student, admin |
| POST | `/api/library/issues` | admin |
| PUT | `/api/library/issues/:id/renew` | student, admin |
| PUT | `/api/library/issues/:id/return` | admin |
| PUT | `/api/library/issues/:id/fine-paid` | admin |

### /api/timetable

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/timetable` | any logged-in user* |
| GET | `/api/timetable/versions` | any logged-in user* |
| GET | `/api/timetable/pdf` | any logged-in user* |
| POST | `/api/timetable/select` | student |
| POST | `/api/timetable` | admin |
| PUT | `/api/timetable/:id` | admin |
| PUT | `/api/timetable/:id/slots` | admin |
| DELETE | `/api/timetable/:id` | admin |

### /api/exams

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/exams` | any logged-in user* |
| GET | `/api/exams/:id` | any logged-in user* |
| POST | `/api/exams` | admin, faculty |
| PUT | `/api/exams/:id` | admin, faculty |
| PUT | `/api/exams/:id/subjects` | admin, faculty |
| DELETE | `/api/exams/:id` | admin |

### /api/hall-ticket

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/hall-ticket` | student, admin |
| POST | `/api/hall-ticket/generate` | admin |
| PUT | `/api/hall-ticket/:id/status` | admin |
| GET | `/api/hall-ticket/:exam_id/pdf` | student, admin |
| GET | `/api/hall-ticket/:exam_id` | student, admin |

### /api/fees

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/fees` | student, admin |
| POST | `/api/fees` | admin |
| POST | `/api/fees/assign` | admin |
| PUT | `/api/fees/:id` | admin |
| DELETE | `/api/fees/:id` | admin |

### /api/payments

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/payments` | student, admin |
| GET | `/api/payments/summary` | student, admin |
| POST | `/api/payments` | student, admin |

### /api/transactions

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/transactions` | student, admin |
| GET | `/api/transactions/:id/pdf` | student, admin |

### /api/receipts

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/receipts` | student, admin |
| GET | `/api/receipts/:id/pdf` | student, admin |
| GET | `/api/receipts/:id` | student, admin |

### /api/marks

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/marks` | any logged-in user* |
| GET | `/api/marks/roster` | faculty, admin |
| POST | `/api/marks` | faculty, admin |
| PUT | `/api/marks/:id` | faculty, admin |
| DELETE | `/api/marks/:id` | admin |

### /api/grade-card

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/grade-card` | student, admin |
| GET | `/api/grade-card/pdf` | student, admin |
| POST | `/api/grade-card/recalculate` | admin |
| PUT | `/api/grade-card/:id/publish` | admin |

### /api/hostel

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/hostel/occupancy` | admin |
| GET | `/api/hostel/bookings` | student, admin |
| POST | `/api/hostel/bookings` | student |
| PUT | `/api/hostel/bookings/:id/cancel` | student, admin |
| PUT | `/api/hostel/bookings/:id/review` | admin |
| GET | `/api/hostel/hostels` | student, admin |
| POST | `/api/hostel/hostels` | admin |
| GET | `/api/hostel/hostels/:id` | student, admin |
| PUT | `/api/hostel/hostels/:id` | admin |
| DELETE | `/api/hostel/hostels/:id` | admin |
| GET | `/api/hostel/rooms` | student, admin |
| POST | `/api/hostel/rooms` | admin |
| GET | `/api/hostel/rooms/:id` | student, admin |
| PUT | `/api/hostel/rooms/:id` | admin |
| DELETE | `/api/hostel/rooms/:id` | admin |

### /api/lesson-plans

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/lesson-plans` | any logged-in user* |
| POST | `/api/lesson-plans` | faculty, admin |
| GET | `/api/lesson-plans/:id` | any logged-in user* |
| PUT | `/api/lesson-plans/:id` | faculty, admin |
| DELETE | `/api/lesson-plans/:id` | faculty, admin |

### /api/answer-sheets

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/answer-sheets` | any logged-in user* |
| POST | `/api/answer-sheets` | faculty, admin |
| PUT | `/api/answer-sheets/:id` | faculty, admin |
| POST | `/api/answer-sheets/:id/revaluation` | student |
| DELETE | `/api/answer-sheets/:id` | admin |

### /api/notifications

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/notifications` | any logged-in user* |
| GET | `/api/notifications/unread-count` | any logged-in user* |
| PUT | `/api/notifications/read-all` | any logged-in user* |
| PUT | `/api/notifications/:id/read` | any logged-in user* |
| DELETE | `/api/notifications/:id` | any logged-in user* |

### /api/dashboard

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/dashboard/student` | student |
| GET | `/api/dashboard/faculty` | faculty |
| GET | `/api/dashboard/admin` | admin |

### /api/files

| Method | Path | Who can call it |
|---|---|---|
| GET | `/api/files/:folder/:filename` | any logged-in user* |
