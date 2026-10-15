-- =====================================================================
--  College Management Portal  -  schema.sql   (MySQL 8.0.16 or newer)
--  Run:  mysql -u root -p < schema.sql
--  Safe to re-run: it drops and recreates every table (dev use only!).
--
--  Conventions used everywhere (easy to explain in a viva):
--   * Every table has an INT UNSIGNED AUTO_INCREMENT primary key `id`.
--   * Foreign key columns are named <table_singular>_id.
--   * ON DELETE CASCADE  -> child rows are meaningless without the parent
--                           (e.g. attendance_records of a deleted session).
--   * ON DELETE RESTRICT -> financial / academic records must never vanish
--                           silently (transactions, receipts, fee_payments).
--   * ON DELETE SET NULL -> optional links (e.g. subject.faculty_id).
--   * CHECK constraints are enforced by MySQL 8.0.16+ (older versions ignore them).
--   * No card number / CVV / UPI PIN column exists anywhere, on purpose.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS college_management
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE college_management;

-- ---------------------------------------------------------------------
-- Drop everything first (foreign key checks off so the order does not matter)
-- ---------------------------------------------------------------------
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS receipts;
DROP TABLE IF EXISTS answer_sheets;
DROP TABLE IF EXISTS hall_tickets;
DROP TABLE IF EXISTS lesson_plans;
DROP TABLE IF EXISTS hostel_bookings;
DROP TABLE IF EXISTS hostel_rooms;
DROP TABLE IF EXISTS hostels;
DROP TABLE IF EXISTS marks;
DROP TABLE IF EXISTS grade_cards;
DROP TABLE IF EXISTS fee_payments;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS fees;
DROP TABLE IF EXISTS exam_subjects;
DROP TABLE IF EXISTS exams;
DROP TABLE IF EXISTS book_issues;
DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS backlogs;
DROP TABLE IF EXISTS attendance_records;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS academic_calendar;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS timetable_slots;
DROP TABLE IF EXISTS timetable;
DROP TABLE IF EXISTS subjects;
DROP TABLE IF EXISTS faculty;
DROP TABLE IF EXISTS admins;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS semesters;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS departments;

SET FOREIGN_KEY_CHECKS = 1;


-- =====================================================================
--  1. ACADEMIC STRUCTURE
--     departments -> courses -> semesters -> subjects
-- =====================================================================

CREATE TABLE departments (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code        VARCHAR(10)  NOT NULL,                 -- e.g. CSE
  name        VARCHAR(100) NOT NULL,
  hod_name    VARCHAR(100) NULL,                     -- Head of Department
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_departments_code (code),
  UNIQUE KEY uq_departments_name (name)
) ENGINE=InnoDB;

CREATE TABLE courses (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  department_id    INT UNSIGNED NOT NULL,
  code             VARCHAR(20)  NOT NULL,            -- e.g. BTECH-CSE
  name             VARCHAR(100) NOT NULL,
  duration_years   TINYINT UNSIGNED NOT NULL,
  total_semesters  TINYINT UNSIGNED NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_courses_code (code),
  KEY idx_courses_department (department_id),
  CONSTRAINT fk_courses_department FOREIGN KEY (department_id)
    REFERENCES departments (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- One row = "semester N of a course in an academic year", e.g. B.Tech CSE Sem 5, 2026-27.
CREATE TABLE semesters (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id      INT UNSIGNED NOT NULL,
  semester_no    TINYINT UNSIGNED NOT NULL,
  academic_year  VARCHAR(9) NOT NULL,                -- '2026-27'
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  is_current     TINYINT(1) NOT NULL DEFAULT 0,      -- 1 = running right now
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_semesters_course_no_year (course_id, semester_no, academic_year),
  KEY idx_semesters_current (is_current),
  CONSTRAINT fk_semesters_course FOREIGN KEY (course_id)
    REFERENCES courses (id) ON DELETE CASCADE,
  CONSTRAINT chk_semesters_no    CHECK (semester_no BETWEEN 1 AND 12),
  CONSTRAINT chk_semesters_dates CHECK (end_date > start_date)
) ENGINE=InnoDB;


-- =====================================================================
--  2. USERS AND ROLES
--     users holds the login; students / faculty / admins hold the profile.
--     Each profile table has UNIQUE(user_id) => one login = one profile.
--     The role in users.role is what the JWT carries for authorization.
-- =====================================================================

CREATE TABLE users (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username       VARCHAR(50)  NOT NULL,
  email          VARCHAR(120) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,              -- bcrypt hash only, never plain text
  role           ENUM('student','faculty','admin') NOT NULL,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,      -- 0 = account disabled
  last_login_at  TIMESTAMP NULL DEFAULT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB;

CREATE TABLE admins (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  full_name    VARCHAR(100) NOT NULL,
  phone        VARCHAR(15)  NULL,
  designation  VARCHAR(80)  NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admins_user (user_id),
  CONSTRAINT fk_admins_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE faculty (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NOT NULL,
  employee_id    VARCHAR(20)  NOT NULL,              -- e.g. EMP001
  full_name      VARCHAR(100) NOT NULL,
  department_id  INT UNSIGNED NOT NULL,
  designation    VARCHAR(80)  NULL,
  phone          VARCHAR(15)  NULL,
  joining_date   DATE NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_faculty_user (user_id),
  UNIQUE KEY uq_faculty_employee (employee_id),
  KEY idx_faculty_department (department_id),
  CONSTRAINT fk_faculty_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_faculty_department FOREIGN KEY (department_id)
    REFERENCES departments (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- A subject belongs to ONE semester row (which already knows the course and year).
-- faculty_id = the teacher assigned to the subject (used for "assigned subjects").
CREATE TABLE subjects (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  semester_id  INT UNSIGNED NOT NULL,
  code         VARCHAR(20)  NOT NULL,                -- e.g. CS501
  name         VARCHAR(120) NOT NULL,
  credits      TINYINT UNSIGNED NOT NULL,
  subject_type ENUM('theory','practical') NOT NULL DEFAULT 'theory',
  faculty_id   INT UNSIGNED NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subjects_code (code),
  KEY idx_subjects_semester (semester_id),
  KEY idx_subjects_faculty (faculty_id),
  CONSTRAINT fk_subjects_semester FOREIGN KEY (semester_id)
    REFERENCES semesters (id) ON DELETE CASCADE,
  CONSTRAINT fk_subjects_faculty FOREIGN KEY (faculty_id)
    REFERENCES faculty (id) ON DELETE SET NULL,
  CONSTRAINT chk_subjects_credits CHECK (credits BETWEEN 1 AND 10)
) ENGINE=InnoDB;


-- =====================================================================
--  3. TIMETABLE  (created before students because students.selected_timetable_id points here)
--     timetable       = one "version" for (semester, section)
--     timetable_slots = the Monday..Saturday cells of that version
-- =====================================================================

CREATE TABLE timetable (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  semester_id    INT UNSIGNED NOT NULL,
  section        CHAR(1)      NOT NULL,              -- 'A', 'B' ...
  version_label  VARCHAR(60)  NOT NULL,              -- e.g. 'Regular', 'Revised - Lab shifted'
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,    -- only active versions are offered to students
  created_by     INT UNSIGNED NULL,                  -- users.id of admin/faculty
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_timetable_version (semester_id, section, version_label),
  CONSTRAINT fk_timetable_semester FOREIGN KEY (semester_id)
    REFERENCES semesters (id) ON DELETE CASCADE,
  CONSTRAINT fk_timetable_creator FOREIGN KEY (created_by)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE timetable_slots (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  timetable_id  INT UNSIGNED NOT NULL,
  day_of_week   ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday') NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  subject_id    INT UNSIGNED NOT NULL,
  faculty_id    INT UNSIGNED NULL,
  room_number   VARCHAR(20) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- a timetable cannot have two classes starting at the same time on the same day
  UNIQUE KEY uq_slot_cell (timetable_id, day_of_week, start_time),
  KEY idx_slots_subject (subject_id),
  KEY idx_slots_faculty (faculty_id),
  CONSTRAINT fk_slots_timetable FOREIGN KEY (timetable_id)
    REFERENCES timetable (id) ON DELETE CASCADE,
  CONSTRAINT fk_slots_subject FOREIGN KEY (subject_id)
    REFERENCES subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_slots_faculty FOREIGN KEY (faculty_id)
    REFERENCES faculty (id) ON DELETE SET NULL,
  CONSTRAINT chk_slots_time CHECK (end_time > start_time)
) ENGINE=InnoDB;

CREATE TABLE students (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id               INT UNSIGNED NOT NULL,
  student_code          VARCHAR(20)  NOT NULL,       -- the visible Student ID, e.g. 24CS001
  full_name             VARCHAR(100) NOT NULL,
  mobile                VARCHAR(15)  NULL,
  date_of_birth         DATE NULL,
  gender                ENUM('male','female','other') NULL,
  address               VARCHAR(255) NULL,
  course_id             INT UNSIGNED NOT NULL,       -- department is reached via courses.department_id
  current_semester_id   INT UNSIGNED NULL,
  section               CHAR(1) NOT NULL,
  admission_year        SMALLINT UNSIGNED NOT NULL,
  current_year          TINYINT UNSIGNED NOT NULL,   -- 1..4 (year of study)
  photo_path            VARCHAR(255) NULL,           -- relative path inside server/uploads
  selected_timetable_id INT UNSIGNED NULL,           -- the timetable version the student chose
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_students_user (user_id),
  UNIQUE KEY uq_students_code (student_code),
  KEY idx_students_course (course_id),
  KEY idx_students_semester (current_semester_id),
  KEY idx_students_section (course_id, section),
  KEY idx_students_name (full_name),
  CONSTRAINT fk_students_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_students_course FOREIGN KEY (course_id)
    REFERENCES courses (id) ON DELETE RESTRICT,
  CONSTRAINT fk_students_semester FOREIGN KEY (current_semester_id)
    REFERENCES semesters (id) ON DELETE SET NULL,
  CONSTRAINT fk_students_timetable FOREIGN KEY (selected_timetable_id)
    REFERENCES timetable (id) ON DELETE SET NULL,
  CONSTRAINT chk_students_year CHECK (current_year BETWEEN 1 AND 6)
) ENGINE=InnoDB;


-- =====================================================================
--  4. ACADEMIC CALENDAR  (college-wide events; students read, admin/faculty write)
-- =====================================================================

CREATE TABLE academic_calendar (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title        VARCHAR(150) NOT NULL,
  description  TEXT NULL,
  event_type   ENUM('holiday','exam','assignment','semester_start','semester_end','event') NOT NULL,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,                        -- same as start_date for one-day events
  created_by   INT UNSIGNED NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_calendar_start (start_date),
  KEY idx_calendar_type (event_type),
  CONSTRAINT fk_calendar_creator FOREIGN KEY (created_by)
    REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_calendar_dates CHECK (end_date >= start_date)
) ENGINE=InnoDB;


-- =====================================================================
--  5. ATTENDANCE
--     attendance         = ONE class session (subject + section + date + period)
--     attendance_records = one row per student for that session
--     Percentage = (present + late) / total sessions, calculated with a query.
-- =====================================================================

CREATE TABLE attendance (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  subject_id  INT UNSIGNED NOT NULL,
  faculty_id  INT UNSIGNED NULL,                     -- who marked it
  section     CHAR(1) NOT NULL,
  class_date  DATE NOT NULL,
  period_no   TINYINT UNSIGNED NOT NULL,
  topic       VARCHAR(150) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- the same class cannot be recorded twice
  UNIQUE KEY uq_attendance_session (subject_id, section, class_date, period_no),
  KEY idx_attendance_date (class_date),
  KEY idx_attendance_faculty (faculty_id),
  CONSTRAINT fk_attendance_subject FOREIGN KEY (subject_id)
    REFERENCES subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_faculty FOREIGN KEY (faculty_id)
    REFERENCES faculty (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE attendance_records (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  attendance_id  INT UNSIGNED NOT NULL,
  student_id     INT UNSIGNED NOT NULL,
  status         ENUM('present','absent','late') NOT NULL,   -- 'late' counts as present
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_record_once (attendance_id, student_id),
  KEY idx_records_student (student_id),
  CONSTRAINT fk_records_attendance FOREIGN KEY (attendance_id)
    REFERENCES attendance (id) ON DELETE CASCADE,
  CONSTRAINT fk_records_student FOREIGN KEY (student_id)
    REFERENCES students (id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- =====================================================================
--  6. MARKS, GRADE CARDS, BACKLOGS
-- =====================================================================

-- One row per (student, subject, attempt). attempt_no 2+ = supplementary attempts.
-- total_marks is a STORED generated column: MySQL adds the five parts itself,
-- so the total can never disagree with its components.
CREATE TABLE marks (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id         INT UNSIGNED NOT NULL,
  subject_id         INT UNSIGNED NOT NULL,
  attempt_no         TINYINT UNSIGNED NOT NULL DEFAULT 1,
  internal_marks     DECIMAL(5,2) NOT NULL DEFAULT 0,
  mid_marks          DECIMAL(5,2) NOT NULL DEFAULT 0,
  assignment_marks   DECIMAL(5,2) NOT NULL DEFAULT 0,
  practical_marks    DECIMAL(5,2) NOT NULL DEFAULT 0,
  external_marks     DECIMAL(5,2) NOT NULL DEFAULT 0,
  total_marks        DECIMAL(6,2) GENERATED ALWAYS AS
                     (internal_marks + mid_marks + assignment_marks + practical_marks + external_marks) STORED,
  grade              VARCHAR(2) NULL,                -- O, A+, A, B+, B, C, F  (NULL until result is final)
  grade_points       DECIMAL(3,1) NULL,              -- 10, 9, 8, 7, 6, 5, 0
  result             ENUM('pass','fail','absent','pending') NOT NULL DEFAULT 'pending',
  entered_by         INT UNSIGNED NULL,              -- faculty.id who entered the marks
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_marks_attempt (student_id, subject_id, attempt_no),
  KEY idx_marks_subject (subject_id),
  KEY idx_marks_entered_by (entered_by),
  CONSTRAINT fk_marks_student FOREIGN KEY (student_id)
    REFERENCES students (id) ON DELETE CASCADE,
  CONSTRAINT fk_marks_subject FOREIGN KEY (subject_id)
    REFERENCES subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_marks_faculty FOREIGN KEY (entered_by)
    REFERENCES faculty (id) ON DELETE SET NULL,
  CONSTRAINT chk_marks_nonnegative CHECK (
    internal_marks >= 0 AND mid_marks >= 0 AND assignment_marks >= 0
    AND practical_marks >= 0 AND external_marks >= 0)
) ENGINE=InnoDB;

-- Semester summary (SGPA) plus running CGPA, one row per student per semester.
CREATE TABLE grade_cards (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id       INT UNSIGNED NOT NULL,
  semester_id      INT UNSIGNED NOT NULL,
  sgpa             DECIMAL(4,2) NOT NULL,
  cgpa             DECIMAL(4,2) NOT NULL,            -- cumulative up to and including this semester
  total_credits    TINYINT UNSIGNED NOT NULL,
  earned_credits   TINYINT UNSIGNED NOT NULL,
  result_status    ENUM('pass','fail') NOT NULL,
  is_published     TINYINT(1) NOT NULL DEFAULT 0,    -- students see only published cards
  published_on     DATE NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gradecard (student_id, semester_id),
  KEY idx_gradecard_semester (semester_id),
  CONSTRAINT fk_gradecards_student FOREIGN KEY (student_id)
    REFERENCES students (id) ON DELETE CASCADE,
  CONSTRAINT fk_gradecards_semester FOREIGN KEY (semester_id)
    REFERENCES semesters (id) ON DELETE CASCADE,
  CONSTRAINT chk_gradecards_gpa CHECK (sgpa BETWEEN 0 AND 10 AND cgpa BETWEEN 0 AND 10)
) ENGINE=InnoDB;

-- One row per (student, subject) that was ever failed. 'cleared' once passed later.
CREATE TABLE backlogs (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id   INT UNSIGNED NOT NULL,
  subject_id   INT UNSIGNED NOT NULL,
  attempt_no   TINYINT UNSIGNED NOT NULL DEFAULT 1,  -- attempts made so far
  result       ENUM('fail','absent','pass') NOT NULL,-- result of the latest attempt
  status       ENUM('active','cleared') NOT NULL DEFAULT 'active',
  reexam_date  DATE NULL,
  cleared_on   DATE NULL,
  remarks      VARCHAR(255) NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_backlog (student_id, subject_id),
  KEY idx_backlogs_status (status),
  KEY idx_backlogs_subject (subject_id),
  CONSTRAINT fk_backlogs_student FOREIGN KEY (student_id)
    REFERENCES students (id) ON DELETE CASCADE,
  CONSTRAINT fk_backlogs_subject FOREIGN KEY (subject_id)
    REFERENCES subjects (id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- =====================================================================
--  7. LIBRARY
--     books.available_copies is lowered when a book is issued and raised on return.
--     The CHECK stops it from ever exceeding total_copies.
-- =====================================================================

CREATE TABLE books (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  isbn             VARCHAR(20)  NOT NULL,
  title            VARCHAR(200) NOT NULL,
  author           VARCHAR(150) NOT NULL,
  category         VARCHAR(60)  NOT NULL,
  publisher        VARCHAR(120) NULL,
  total_copies     SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  available_copies SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  shelf_number     VARCHAR(20) NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_books_isbn (isbn),
  KEY idx_books_title (title),
  KEY idx_books_author (author),
  KEY idx_books_category (category),
  CONSTRAINT chk_books_copies CHECK (available_copies <= total_copies)
) ENGINE=InnoDB;

CREATE TABLE book_issues (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  book_id       INT UNSIGNED NOT NULL,
  student_id    INT UNSIGNED NOT NULL,
  issue_date    DATE NOT NULL,
  due_date      DATE NOT NULL,
  return_date   DATE NULL,                           -- NULL = not returned yet
  renew_count   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  fine_amount   DECIMAL(8,2) NOT NULL DEFAULT 0,     -- late fine, Rs. 2 per day in the demo
  fine_paid     TINYINT(1) NOT NULL DEFAULT 0,
  status        ENUM('issued','returned','overdue','lost') NOT NULL DEFAULT 'issued',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_issues_student_status (student_id, status),
  KEY idx_issues_book (book_id),
  KEY idx_issues_due (due_date),
  CONSTRAINT fk_issues_book FOREIGN KEY (book_id)
    REFERENCES books (id) ON DELETE RESTRICT,
  CONSTRAINT fk_issues_student FOREIGN KEY (student_id)
    REFERENCES students (id) ON DELETE CASCADE,
  CONSTRAINT chk_issues_dates CHECK (due_date >= issue_date),
  CONSTRAINT chk_issues_fine CHECK (fine_amount >= 0)
) ENGINE=InnoDB;


-- =====================================================================
--  8. EXAMS, HALL TICKETS, ANSWER SHEETS
--     exams          = an examination event for a semester (Mid-I, End Sem ...)
--     exam_subjects  = the timetable of that event (date, time, room per subject)
--     hall_tickets   = one per student per exam (can be 'blocked')
--     answer_sheets  = scanned paper of one student for one exam_subject
-- =====================================================================

CREATE TABLE exams (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(150) NOT NULL,
  exam_type     ENUM('mid','internal','semester','supplementary','practical') NOT NULL,
  semester_id   INT UNSIGNED NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  exam_center   VARCHAR(120) NULL,
  instructions  TEXT NULL,
  status        ENUM('scheduled','ongoing','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  created_by    INT UNSIGNED NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_exams_semester_start (semester_id, start_date),
  KEY idx_exams_status (status),
  CONSTRAINT fk_exams_semester FOREIGN KEY (semester_id)
    REFERENCES semesters (id) ON DELETE CASCADE,
  CONSTRAINT fk_exams_creator FOREIGN KEY (created_by)
    REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_exams_dates CHECK (end_date >= start_date)
) ENGINE=InnoDB;

CREATE TABLE exam_subjects (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  exam_id       INT UNSIGNED NOT NULL,
  subject_id    INT UNSIGNED NOT NULL,
  exam_date     DATE NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  room_number   VARCHAR(40) NULL,
  max_marks     SMALLINT UNSIGNED NOT NULL,
  instructions  TEXT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_exam_subject (exam_id, subject_id),
  KEY idx_exam_subjects_date (exam_date),
  KEY idx_exam_subjects_subject (subject_id),
  CONSTRAINT fk_examsub_exam FOREIGN KEY (exam_id)
    REFERENCES exams (id) ON DELETE CASCADE,
  CONSTRAINT fk_examsub_subject FOREIGN KEY (subject_id)
    REFERENCES subjects (id) ON DELETE CASCADE,
  CONSTRAINT chk_examsub_time CHECK (end_time > start_time)
) ENGINE=InnoDB;

CREATE TABLE hall_tickets (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id      INT UNSIGNED NOT NULL,
  exam_id         INT UNSIGNED NOT NULL,
  ticket_number   VARCHAR(40) NOT NULL,
  exam_center     VARCHAR(120) NULL,
  status          ENUM('generated','blocked') NOT NULL DEFAULT 'generated',
  blocked_reason  VARCHAR(255) NULL,                 -- e.g. low attendance or fee dues
  issued_on       DATE NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_hallticket_number (ticket_number),
  UNIQUE KEY uq_hallticket_student_exam (student_id, exam_id),
  KEY idx_hallticket_exam (exam_id),
  CONSTRAINT fk_halltickets_student FOREIGN KEY (student_id)
    REFERENCES students (id) ON DELETE CASCADE,
  CONSTRAINT fk_halltickets_exam FOREIGN KEY (exam_id)
    REFERENCES exams (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- The uploaded file itself lives in server/uploads; only its path is stored here.
-- is_released = 0  -> hidden from the student
-- download_allowed -> student may download (otherwise view only)
CREATE TABLE answer_sheets (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id        INT UNSIGNED NOT NULL,
  exam_subject_id   INT UNSIGNED NOT NULL,
  file_path         VARCHAR(255) NOT NULL,
  original_name     VARCHAR(255) NOT NULL,
  mime_type         VARCHAR(60)  NOT NULL,           -- application/pdf, image/jpeg, image/png
  file_size         INT UNSIGNED NOT NULL,           -- bytes
  marks_obtained    DECIMAL(5,2) NULL,
  evaluation_status ENUM('pending','evaluated','revaluation_requested') NOT NULL DEFAULT 'pending',
  is_released       TINYINT(1) NOT NULL DEFAULT 0,
  download_allowed  TINYINT(1) NOT NULL DEFAULT 0,
  released_at       TIMESTAMP NULL DEFAULT NULL,
  uploaded_by       INT UNSIGNED NULL,               -- users.id of faculty/admin
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_answersheet (student_id, exam_subject_id),
  KEY idx_answersheets_examsubject (exam_subject_id),
  KEY idx_answersheets_released (is_released),
  CONSTRAINT fk_answersheets_student FOREIGN KEY (student_id)
    REFERENCES students (id) ON DELETE CASCADE,
  CONSTRAINT fk_answersheets_examsubject FOREIGN KEY (exam_subject_id)
    REFERENCES exam_subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_answersheets_uploader FOREIGN KEY (uploaded_by)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;


-- =====================================================================
--  9. FEES, PAYMENTS, TRANSACTIONS, RECEIPTS
--
--   fees (what is owed)  <--  fee_payments  -->  transactions (one gateway payment)
--                                                        |
--                                                        +--> receipts (one per successful transaction)
--
--   One transaction can pay several fee rows, so fee_payments is the link table.
--   Only the gateway result is stored (reference + status). NO card/CVV/PIN data.
-- =====================================================================

CREATE TABLE fees (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id     INT UNSIGNED NOT NULL,
  semester_id    INT UNSIGNED NOT NULL,
  fee_type       ENUM('tuition','examination','hostel','library','transport','other') NOT NULL,
  description    VARCHAR(150) NULL,
  amount         DECIMAL(10,2) NOT NULL,
  paid_amount    DECIMAL(10,2) NOT NULL DEFAULT 0,
  pending_amount DECIMAL(10,2) GENERATED ALWAYS AS (amount - paid_amount) STORED,
  due_date       DATE NOT NULL,
  status         ENUM('pending','partial','paid','overdue') NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_fee_item (student_id, semester_id, fee_type),
  KEY idx_fees_status_due (status, due_date),
  KEY idx_fees_semester (semester_id),
  CONSTRAINT fk_fees_student FOREIGN KEY (student_id)
    REFERENCES students (id) ON DELETE CASCADE,
  CONSTRAINT fk_fees_semester FOREIGN KEY (semester_id)
    REFERENCES semesters (id) ON DELETE RESTRICT,
  CONSTRAINT chk_fees_amounts CHECK (amount > 0 AND paid_amount >= 0 AND paid_amount <= amount)
) ENGINE=InnoDB;

CREATE TABLE transactions (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  transaction_ref    VARCHAR(40)  NOT NULL,          -- the Transaction ID shown to the student
  student_id         INT UNSIGNED NOT NULL,
  amount             DECIMAL(10,2) NOT NULL,
  payment_method     ENUM('card','upi','net_banking','cash','mock_gateway') NOT NULL,
  status             ENUM('initiated','success','failed','refunded') NOT NULL DEFAULT 'initiated',
  description        VARCHAR(255) NULL,
  gateway_reference  VARCHAR(100) NULL,              -- id returned by the (mock) gateway
  failure_reason     VARCHAR(255) NULL,
  transaction_date   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_transactions_ref (transaction_ref),
  KEY idx_transactions_student_date (student_id, transaction_date),
  KEY idx_transactions_status (status),
  KEY idx_transactions_method (payment_method),
  CONSTRAINT fk_transactions_student FOREIGN KEY (student_id)
    REFERENCES students (id) ON DELETE RESTRICT,
  CONSTRAINT chk_transactions_amount CHECK (amount > 0)
) ENGINE=InnoDB;

CREATE TABLE fee_payments (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  fee_id          INT UNSIGNED NOT NULL,
  transaction_id  INT UNSIGNED NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,            -- part of the transaction applied to this fee
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_feepayment (fee_id, transaction_id),
  KEY idx_feepayments_transaction (transaction_id),
  CONSTRAINT fk_feepayments_fee FOREIGN KEY (fee_id)
    REFERENCES fees (id) ON DELETE RESTRICT,
  CONSTRAINT fk_feepayments_transaction FOREIGN KEY (transaction_id)
    REFERENCES transactions (id) ON DELETE RESTRICT,
  CONSTRAINT chk_feepayments_amount CHECK (amount > 0)
) ENGINE=InnoDB;

CREATE TABLE receipts (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  receipt_number  VARCHAR(30) NOT NULL,              -- e.g. RCPT-2026-0001
  transaction_id  INT UNSIGNED NOT NULL,             -- UNIQUE => one receipt per transaction
  student_id      INT UNSIGNED NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  description     VARCHAR(255) NULL,
  payment_date    DATE NOT NULL,
  pdf_path        VARCHAR(255) NULL,                 -- filled when the PDF is generated
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_receipts_number (receipt_number),
  UNIQUE KEY uq_receipts_transaction (transaction_id),
  KEY idx_receipts_student (student_id),
  CONSTRAINT fk_receipts_transaction FOREIGN KEY (transaction_id)
    REFERENCES transactions (id) ON DELETE RESTRICT,
  CONSTRAINT fk_receipts_student FOREIGN KEY (student_id)
    REFERENCES students (id) ON DELETE RESTRICT
) ENGINE=InnoDB;


-- =====================================================================
--  10. HOSTEL
--      Overbooking protection (two layers):
--        1) CHECK (occupied_beds <= capacity) on hostel_rooms
--        2) uq_hostel_one_active_request: a student can have only ONE
--           pending/approved request at a time.
--      The backend must approve a booking inside a transaction:
--        SELECT ... FROM hostel_rooms WHERE id = ? FOR UPDATE;
--        UPDATE hostel_rooms SET occupied_beds = occupied_beds + 1 ...
--      If two admins approve at the same moment, the row lock + CHECK
--      guarantee the room can never exceed its capacity.
-- =====================================================================

CREATE TABLE hostels (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name           VARCHAR(100) NOT NULL,
  block          VARCHAR(10)  NOT NULL,
  hostel_type    ENUM('boys','girls') NOT NULL,
  warden_name    VARCHAR(100) NULL,
  warden_phone   VARCHAR(15)  NULL,
  total_floors   TINYINT UNSIGNED NOT NULL DEFAULT 1,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_hostels_name (name)
) ENGINE=InnoDB;

CREATE TABLE hostel_rooms (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  hostel_id      INT UNSIGNED NOT NULL,
  room_number    VARCHAR(10) NOT NULL,
  floor_no       TINYINT UNSIGNED NOT NULL,
  room_type      ENUM('single','double','triple','dormitory') NOT NULL,
  capacity       TINYINT UNSIGNED NOT NULL,
  occupied_beds  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  annual_fee     DECIMAL(10,2) NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_room_in_hostel (hostel_id, room_number),
  CONSTRAINT fk_rooms_hostel FOREIGN KEY (hostel_id)
    REFERENCES hostels (id) ON DELETE CASCADE,
  CONSTRAINT chk_rooms_capacity CHECK (capacity > 0),
  CONSTRAINT chk_rooms_no_overbooking CHECK (occupied_beds <= capacity)
) ENGINE=InnoDB;

CREATE TABLE hostel_bookings (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id    INT UNSIGNED NOT NULL,
  room_id       INT UNSIGNED NOT NULL,
  status        ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  requested_on  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by   INT UNSIGNED NULL,                   -- users.id of the admin
  reviewed_at   TIMESTAMP NULL DEFAULT NULL,
  remarks       VARCHAR(255) NULL,
  -- Helper column: equals student_id while the request is pending/approved, otherwise NULL.
  -- UNIQUE on it => at most one live request per student (many NULLs are allowed by MySQL).
  active_student_key INT UNSIGNED GENERATED ALWAYS AS
      (IF(status IN ('pending','approved'), student_id, NULL)) VIRTUAL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_hostel_one_active_request (active_student_key),
  KEY idx_bookings_student (student_id),
  KEY idx_bookings_room_status (room_id, status),
  CONSTRAINT fk_bookings_student FOREIGN KEY (student_id)
    REFERENCES students (id) ON DELETE RESTRICT,
  CONSTRAINT fk_bookings_room FOREIGN KEY (room_id)
    REFERENCES hostel_rooms (id) ON DELETE RESTRICT,
  CONSTRAINT fk_bookings_reviewer FOREIGN KEY (reviewed_by)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;


-- =====================================================================
--  11. LESSON PLANS
-- =====================================================================

CREATE TABLE lesson_plans (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  subject_id       INT UNSIGNED NOT NULL,
  faculty_id       INT UNSIGNED NULL,
  unit_no          TINYINT UNSIGNED NOT NULL,
  topic            VARCHAR(200) NOT NULL,
  teaching_method  ENUM('lecture','tutorial','lab_session','seminar','case_study','group_discussion') NOT NULL DEFAULT 'lecture',
  planned_date     DATE NOT NULL,
  completed_date   DATE NULL,
  status           ENUM('planned','in_progress','completed','postponed') NOT NULL DEFAULT 'planned',
  remarks          VARCHAR(255) NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_lesson_subject_unit (subject_id, unit_no),
  KEY idx_lesson_faculty (faculty_id),
  KEY idx_lesson_status (status),
  CONSTRAINT fk_lesson_subject FOREIGN KEY (subject_id)
    REFERENCES subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_lesson_faculty FOREIGN KEY (faculty_id)
    REFERENCES faculty (id) ON DELETE SET NULL
) ENGINE=InnoDB;


-- =====================================================================
--  12. NOTIFICATIONS  (addressed to a login, so students, faculty and admins can all receive them)
-- =====================================================================

CREATE TABLE notifications (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  title       VARCHAR(150) NOT NULL,
  message     VARCHAR(500) NOT NULL,
  type        ENUM('exam','attendance','fee','payment','timetable','marks','answer_sheet','hostel','library','general') NOT NULL DEFAULT 'general',
  is_read     TINYINT(1) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user_read (user_id, is_read, created_at),
  KEY idx_notifications_type (type),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ===================== end of schema.sql =====================
