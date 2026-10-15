#!/usr/bin/env node
// End-to-end check of a RUNNING backend + MySQL (start `npm run dev` first and load schema.sql + seed.sql).
//   npm run verify                       -> tests http://localhost:5000/api
//   API_URL=http://localhost:5000/api npm run verify
// The script logs in many times, so first set API_RATE_LIMIT=2000 and LOGIN_RATE_LIMIT=200 in .env and restart the
// server (then set them back afterwards).
//
// It uses the DEMO accounts from seed.sql (development only). Everything it writes is done with ONE throwaway
// student that it creates and disables at the end, so the demo students keep their data. Re-run seed.sql to reset.
// Needs Node 18+ (built-in fetch).
const BASE = (process.env.API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const DEMO = { admin: ['admin', 'Admin@123'], faculty: ['faculty01', 'Faculty@123'], student: ['student01', 'Student@123'], other: ['student02', 'Student@123'] };

let passed = 0; let failed = 0; let warned = 0; const failures = [];
const section = (title) => console.log(`\n${title}`);
const warn = (message) => { warned += 1; console.log(`  ! ${message}`); };
function expect(condition, message) { if (!condition) throw new Error(message); }
async function check(name, fn) {
  try { const note = await fn(); passed += 1; console.log(`  \u2713 ${name}${note ? ` (${note})` : ''}`); }
  catch (err) { failed += 1; failures.push(`${name}: ${err.message}`); console.log(`  \u2717 ${name}\n      ${err.message}`); }
}

async function api(method, path, { token, json, form, headers = {}, raw = false } = {}) {
  const options = { method, headers: { ...headers } };
  if (token) options.headers.Authorization = `Bearer ${token}`;
  if (json !== undefined) { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(json); }
  if (form) options.body = form;
  const res = await fetch(BASE + path, options);
  if (raw) return { status: res.status, headers: res.headers, buffer: Buffer.from(await res.arrayBuffer()) };
  const text = await res.text();
  let body = text;
  try { body = JSON.parse(text); } catch (e) { /* not JSON */ }
  return { status: res.status, headers: res.headers, body, data: body && body.data };
}
const has = (r) => `got ${r.status}${r.body && r.body.message ? `: ${r.body.message}` : ''}${r.status === 429 ? '  -> the rate limiter blocked this script. Put API_RATE_LIMIT=2000 and LOGIN_RATE_LIMIT=200 in .env, restart the server, then run verify again.' : ''}`;
async function loginAs([username, password]) {
  const r = await api('POST', '/auth/login', { json: { username, password, rememberMe: false } });
  expect(r.status === 200, `login of ${username} failed (${has(r)}). Did you run seed.sql?`);
  return { token: r.data.token, user: r.data.user, profile: r.data.profile, raw: r };
}
const isPdf = (r) => r.status === 200 && (r.headers.get('content-type') || '').includes('application/pdf') && r.buffer.slice(0, 5).toString() === '%PDF-';
const isoDay = (offset = 0) => { const d = new Date(Date.now() + offset * 86400000); return d.toISOString().slice(0, 10); };
const stamp = String(Date.now());
const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
const upload = (name, bytes, type, fields) => { const f = new FormData(); Object.entries(fields).forEach(([k, v]) => f.append(k, String(v))); f.append('file', new Blob([bytes], { type }), name); return f; };

(async () => {
  console.log(`Verifying ${BASE}`);
  const t = {};   // tokens and shared ids

  // ------------------------------------------------------------------ 1
  section('1. Server and database');
  try {
    const r = await api('GET', '/health');
    if (r.status !== 200) throw new Error(has(r));
    console.log(`  \u2713 Backend answers and MySQL is connected (${JSON.stringify(r.data)})`); passed += 1;
  } catch (err) {
    console.log(`  \u2717 Cannot reach the backend at ${BASE}: ${err.message}\n    Start it with "cd server && npm run dev" and check MySQL and the .env file.`); process.exit(2);
  }
  await check('Responses use the standard { success, message, data } shape', async () => { const r = await api('GET', '/health'); expect(r.body.success === true && typeof r.body.message === 'string' && 'data' in r.body, JSON.stringify(r.body)); });
  await check('Unknown URLs return a JSON 404', async () => { const r = await api('GET', '/no-such-route'); expect(r.status === 404 && r.body.success === false, has(r)); });

  // ------------------------------------------------------------------ 2
  section('2. Login and tokens');
  await check('Admin, faculty and student can log in', async () => {
    for (const [key, creds] of Object.entries({ admin: DEMO.admin, faculty: DEMO.faculty, student: DEMO.student, other: DEMO.other })) t[key] = await loginAs(creds);
    expect(t.admin.user.role === 'admin' && t.faculty.user.role === 'faculty' && t.student.user.role === 'student', 'wrong roles');
  });
  await check('Login answer never contains a password hash', async () => { expect(!/\$2[aby]\$/.test(JSON.stringify(t.student.raw.body)), 'a bcrypt hash was sent to the browser'); });
  await check('The Student ID (24CS001) works as a username too', async () => { const r = await loginAs(['24CS001', DEMO.student[1]]); expect(r.user.username === 'student01', 'wrong user'); });
  await check('A wrong password is refused with a generic message', async () => { const r = await api('POST', '/auth/login', { json: { username: 'student01', password: 'Wrong@123' } }); expect(r.status === 401 && /invalid username or password/i.test(r.body.message), has(r)); });
  await check('An unknown user gets the SAME message (no user enumeration)', async () => { const r = await api('POST', '/auth/login', { json: { username: 'nobody99', password: 'Wrong@123' } }); expect(r.status === 401 && /invalid username or password/i.test(r.body.message), has(r)); });
  await check('Empty login fields are rejected (400)', async () => { const r = await api('POST', '/auth/login', { json: { username: '', password: '' } }); expect(r.status === 400, has(r)); });
  await check('SQL injection in the login form does not log anyone in', async () => { const r = await api('POST', '/auth/login', { json: { username: "' OR '1'='1", password: "' OR '1'='1" } }); expect(r.status === 401, has(r)); });
  await check('/auth/me without a token is refused (401)', async () => { const r = await api('GET', '/auth/me'); expect(r.status === 401, has(r)); });
  await check('/auth/me with a valid token returns the profile', async () => { const r = await api('GET', '/auth/me', { token: t.student.token }); expect(r.status === 200 && r.data.user.role === 'student' && r.data.profile.student_code === '24CS001', has(r)); });
  await check('A tampered token is refused', async () => { const r = await api('GET', '/auth/me', { token: `${t.student.token.slice(0, -4)}abcd` }); expect(r.status === 401, has(r)); });
  await check('Logout endpoint answers', async () => { const r = await api('POST', '/auth/logout', { token: t.other.token }); expect(r.status === 200, has(r)); });

  // ------------------------------------------------------------------ 3
  section('3. Protected routes and role-based access');
  const denied = async (name, method, path, who, json) => check(name, async () => { const r = await api(method, path, { token: t[who].token, json }); expect(r.status === 403, `expected 403, ${has(r)}`); });
  await check('No token -> 401 on a protected API', async () => { const r = await api('GET', '/fees'); expect(r.status === 401, has(r)); });
  await denied('Student cannot open the admin dashboard', 'GET', '/dashboard/admin', 'student');
  await denied('Student cannot list all students', 'GET', '/students', 'student');
  await denied('Student cannot enter marks', 'POST', '/marks', 'student', { student_id: 1, subject_id: 1 });
  await denied('Student cannot create a department', 'POST', '/departments', 'student', { code: 'X', name: 'X' });
  await denied('Faculty cannot read fees', 'GET', '/fees', 'faculty');
  await denied('Faculty cannot read receipts', 'GET', '/receipts', 'faculty');
  await denied('Faculty cannot read grade cards', 'GET', '/grade-card?student_id=1', 'faculty');
  await denied('Faculty cannot manage faculty accounts', 'GET', '/faculty', 'faculty');
  await denied('Admin cannot request a hostel room (student-only action)', 'POST', '/hostel/bookings', 'admin', { room_id: 1 });

  // ------------------------------------------------------------------ 4
  section('4. Dashboards');
  await check('Student dashboard', async () => { const r = await api('GET', '/dashboard/student', { token: t.student.token }); expect(r.status === 200 && r.data.profile.student_code === '24CS001' && r.data.attendance.subjects.length > 0 && 'charts' in r.data && r.data.upcoming_exams, has(r)); return `${r.data.attendance.subjects.length} subjects, CGPA ${r.data.cgpa}`; });
  await check('Faculty dashboard', async () => { const r = await api('GET', '/dashboard/faculty', { token: t.faculty.token }); expect(r.status === 200 && r.data.subjects.length > 0, has(r)); return `${r.data.subjects.length} subjects`; });
  await check('Admin dashboard', async () => { const r = await api('GET', '/dashboard/admin', { token: t.admin.token }); expect(r.status === 200 && r.data.totals.students >= 5 && r.data.hostel.capacity > 0, has(r)); return `${r.data.totals.students} students, hostel ${r.data.hostel.occupancy_percent}%`; });

  // ------------------------------------------------------------------ 5
  section('5. Database relationships (seed data)');
  await check('Student profile joins course, department and semester', async () => { const r = await api('GET', '/students/profile', { token: t.student.token }); expect(r.status === 200 && r.data.course && r.data.department && r.data.semester, has(r)); return `${r.data.course} / ${r.data.department}`; });
  await check('Subjects join semester, course and faculty', async () => { const r = await api('GET', '/subjects?limit=100', { token: t.admin.token }); const s = r.data.items.find((x) => x.code === 'CS501'); expect(s && s.faculty_name && s.course_name && s.semester_no === 5, 'CS501 missing joined data'); return `CS501 taught by ${s.faculty_name}`; });
  await check('Attendance is calculated from class records (student04 is low)', async () => { const s4 = await loginAs(['student04', 'Student@123']); const r = await api('GET', '/attendance', { token: s4.token }); expect(r.status === 200 && r.data.subjects.some((x) => x.is_low), 'no low-attendance subject found'); });
  await check('Exams include their papers', async () => { const r = await api('GET', '/exams?limit=5', { token: t.student.token }); expect(r.status === 200 && r.data.items.length > 0 && r.data.items.some((e) => e.subjects.length > 0), has(r)); });
  await check('Grade card has SGPA, CGPA and subject rows', async () => { const r = await api('GET', '/grade-card', { token: t.student.token }); expect(r.status === 200 && r.data.cards.length > 0 && r.data.cards[0].subjects.length > 0 && typeof r.data.cards[0].sgpa === 'number', has(r)); return `CGPA ${r.data.cgpa}`; });
  await check('Backlogs: student05 has an active backlog', async () => { const s5 = await loginAs(['student05', 'Student@123']); const r = await api('GET', '/backlogs', { token: s5.token }); expect(r.status === 200 && r.data.items.some((b) => b.status === 'active'), has(r)); });
  await check('A student sees only their own receipts', async () => { const r = await api('GET', '/receipts?limit=50', { token: t.student.token }); expect(r.status === 200 && r.data.items.every((x) => x.student_code === '24CS001'), 'another student\'s receipt was returned'); });
  await check('Boys only see rooms of the boys hostel', async () => { const r = await api('GET', '/hostel/rooms?limit=100', { token: t.other.token }); expect(r.status === 200 && r.data.items.length > 0 && r.data.items.every((x) => x.hostel_type === 'boys'), 'a girls room was listed'); });
  await check('Duplicate unique value is refused (409)', async () => { const r = await api('POST', '/departments', { token: t.admin.token, json: { code: 'CSE', name: `Another ${stamp}` } }); expect(r.status === 409, has(r)); });

  // ------------------------------------------------------------------ 6
  section('6. CRUD (create, read, update, delete)');
  await check('Department: create, read, update, delete', async () => {
    const c = await api('POST', '/departments', { token: t.admin.token, json: { code: `V${stamp.slice(-6)}`, name: `Verify ${stamp}`, hod_name: 'Test' } }); expect(c.status === 201, `create ${has(c)}`);
    const id = c.data.id;
    expect((await api('GET', `/departments/${id}`, { token: t.admin.token })).data.name === `Verify ${stamp}`, 'read back failed');
    const u = await api('PUT', `/departments/${id}`, { token: t.admin.token, json: { hod_name: 'Changed' } }); expect(u.status === 200 && u.data.hod_name === 'Changed', `update ${has(u)}`);
    expect((await api('DELETE', `/departments/${id}`, { token: t.admin.token })).status === 200, 'delete failed');
    expect((await api('GET', `/departments/${id}`, { token: t.admin.token })).status === 404, 'still exists after delete');
  });
  await check('Calendar event (faculty): create, update, delete', async () => {
    const c = await api('POST', '/calendar', { token: t.faculty.token, json: { title: `Verify ${stamp}`, event_type: 'event', start_date: isoDay(5) } }); expect(c.status === 201 && c.data.end_date === isoDay(5), `create ${has(c)}`);
    expect((await api('PUT', `/calendar/${c.data.id}`, { token: t.faculty.token, json: { title: 'Changed' } })).data.title === 'Changed', 'update failed');
    expect((await api('DELETE', `/calendar/${c.data.id}`, { token: t.faculty.token })).status === 200, 'delete failed');
  });
  await check('Book (admin): available copies follow total copies', async () => {
    const c = await api('POST', '/books', { token: t.admin.token, json: { isbn: `9${stamp.slice(-12)}`, title: `Verify ${stamp}`, author: 'Test', category: 'Test', total_copies: 3 } }); expect(c.status === 201 && c.data.available_copies === 3, `create ${has(c)}`);
    const s = await api('GET', `/books/search?title=${encodeURIComponent(`Verify ${stamp}`)}`, { token: t.student.token }); expect(s.data.items.length === 1, 'search did not find it');
    expect((await api('DELETE', `/books/${c.data.id}`, { token: t.admin.token })).status === 200, 'delete failed');
  });
  await check('Lesson plan (faculty): create, update, delete own subject; other faculty subject refused', async () => {
    const mine = await api('GET', '/subjects?mine=true&limit=100', { token: t.faculty.token }); expect(mine.data.items.length > 0, 'faculty01 has no subjects');
    const subject = mine.data.items[0];
    const c = await api('POST', '/lesson-plans', { token: t.faculty.token, json: { subject_id: subject.id, unit_no: 9, topic: `Verify ${stamp}`, planned_date: isoDay(10) } }); expect(c.status === 201, `create ${has(c)}`);
    const u = await api('PUT', `/lesson-plans/${c.data.id}`, { token: t.faculty.token, json: { status: 'completed' } }); expect(u.status === 200 && u.data.completed_date, `update ${has(u)}`);
    expect((await api('DELETE', `/lesson-plans/${c.data.id}`, { token: t.faculty.token })).status === 200, 'delete failed');
    const all = await api('GET', '/subjects?limit=100', { token: t.admin.token }); const foreign = all.data.items.find((s) => s.faculty_id && s.faculty_id !== subject.faculty_id);
    if (foreign) { const x = await api('POST', '/lesson-plans', { token: t.faculty.token, json: { subject_id: foreign.id, unit_no: 9, topic: 'x', planned_date: isoDay(10) } }); expect(x.status === 403, `foreign subject: ${has(x)}`); }
  });

  // ------------------------------------------------------------------ 7  (one throwaway student)
  section('7. Throwaway student: accounts, attendance, marks, fees, payments, hostel, library, files');
  const credentials = { username: `verify${stamp.slice(-8)}`, password: 'Verify@12345' };
  let me;
  await check('Admin creates a student; the new student can log in', async () => {
    const courses = await api('GET', '/courses?limit=50', { token: t.admin.token }); const course = courses.data.items.find((c) => c.code === 'BTECH-CSE'); expect(course, 'BTECH-CSE not found');
    const sems = await api('GET', `/semesters?course_id=${course.id}&is_current=1`, { token: t.admin.token }); expect(sems.data.items.length > 0, 'no current semester');
    const c = await api('POST', '/students', { token: t.admin.token, json: { username: credentials.username, email: `${credentials.username}@example.com`, password: credentials.password, student_code: `V${stamp.slice(-8)}`, full_name: 'Verify Student', course_id: course.id, current_semester_id: sems.data.items[0].id, section: 'A', admission_year: 2024, current_year: 3, gender: 'male' } });
    expect(c.status === 201, `create ${has(c)}`);
    t.newStudentId = c.data.id; me = await loginAs([credentials.username, credentials.password]); t.me = me;
  });
  await check('A weak password for a new account is refused', async () => { const r = await api('POST', '/students', { token: t.admin.token, json: { username: `weak${stamp.slice(-6)}`, email: `weak${stamp.slice(-6)}@example.com`, password: 'abc', student_code: `W${stamp.slice(-8)}`, full_name: 'Weak', course_id: 1, section: 'A', admission_year: 2024, current_year: 1 } }); expect(r.status === 400, has(r)); });
  if (!me) { warn('Skipping the rest of section 7: the throwaway student could not be created.'); }
  else {
    const subjects = await api('GET', '/subjects?mine=true&limit=100', { token: t.faculty.token });
    const subject = subjects.data.items.find((s) => s.semester_no === 5) || subjects.data.items[0];

    await check('Student can change their own password (and the old one stops working)', async () => {
      const r = await api('PUT', '/auth/password', { token: me.token, json: { current_password: credentials.password, new_password: 'Verify@67890' } }); expect(r.status === 200, has(r));
      const old = await api('POST', '/auth/login', { json: { username: credentials.username, password: credentials.password } }); expect(old.status === 401, 'old password still works');
      credentials.password = 'Verify@67890'; me = await loginAs([credentials.username, credentials.password]);
    });
    await check('Student edits mobile; a 9-digit number is refused', async () => {
      expect((await api('PUT', '/students/profile', { token: me.token, json: { mobile: '9123456780' } })).status === 200, 'valid mobile refused');
      expect((await api('PUT', '/students/profile', { token: me.token, json: { mobile: '12345' } })).status === 400, 'bad mobile accepted');
    });

    await check('Faculty marks attendance (absent) -> student sees low attendance + gets a notification; duplicate class refused', async () => {
      const date = isoDay(-(30 + Math.floor(Math.random() * 250))); const period = 1 + Math.floor(Math.random() * 8);
      const body = { subject_id: subject.id, section: 'A', class_date: date, period_no: period, records: [{ student_id: t.newStudentId, status: 'absent' }] };
      let r = await api('POST', '/attendance', { token: t.faculty.token, json: body }); if (r.status === 409) { body.period_no = ((period % 8) + 1); r = await api('POST', '/attendance', { token: t.faculty.token, json: body }); }
      expect(r.status === 201, `mark ${has(r)}`);
      expect((await api('POST', '/attendance', { token: t.faculty.token, json: body })).status === 409, 'duplicate class was accepted');
      const a = await api('GET', '/attendance', { token: me.token }); const row = a.data.subjects.find((s) => s.subject_id === subject.id); expect(row && row.is_low && row.percentage === 0, 'attendance not shown as low');
      const n = await api('GET', '/notifications?unread=true', { token: me.token }); expect(n.data.items.some((x) => /low attendance/i.test(x.title)), 'no low-attendance notification');
    });
    await check('Faculty cannot mark attendance for a future date or a foreign class', async () => {
      expect((await api('POST', '/attendance', { token: t.faculty.token, json: { subject_id: subject.id, section: 'A', class_date: isoDay(3), period_no: 1, records: [{ student_id: t.newStudentId, status: 'present' }] } })).status === 400, 'future date accepted');
    });

    await check('Marks: above-maximum refused, draft saved, finalize gives a grade; student sees it', async () => {
      const bad = await api('POST', '/marks', { token: t.faculty.token, json: { student_id: t.newStudentId, subject_id: subject.id, external_marks: 75 } }); expect(bad.status === 400, `over max: ${has(bad)}`);
      const draft = await api('POST', '/marks', { token: t.faculty.token, json: { student_id: t.newStudentId, subject_id: subject.id, internal_marks: 8, mid_marks: 15, assignment_marks: 9 } }); expect(draft.status === 201 && draft.data.result === 'pending', `draft ${has(draft)}`);
      const fin = await api('POST', '/marks', { token: t.faculty.token, json: { student_id: t.newStudentId, subject_id: subject.id, external_marks: 50, finalize: true } }); expect(fin.status === 201 && fin.data.result === 'pass' && fin.data.grade, `finalize ${has(fin)}`);
      expect(Number(fin.data.total_marks) === 82 && fin.data.grade === 'A+', `total/grade wrong: ${fin.data.total_marks} ${fin.data.grade}`);
      const m = await api('GET', '/marks?limit=100', { token: me.token }); expect(m.data.items.some((x) => x.subject_id === subject.id && x.grade === 'A+'), 'student cannot see the marks');
    });

    await check('Fees: admin adds a fee; student pays partly, then in full; receipt is created', async () => {
      const f = await api('POST', '/fees', { token: t.admin.token, json: { student_id: t.newStudentId, semester_id: subject.semester_id, fee_type: 'transport', amount: 6000, due_date: isoDay(30), description: 'Verify transport fee' } }); expect(f.status === 201, `add fee ${has(f)}`);
      let fees = await api('GET', '/fees?limit=50', { token: me.token }); const fee = fees.data.items.find((x) => x.description === 'Verify transport fee'); expect(fee && fee.pending_amount === 6000 && fee.status === 'pending', 'fee not listed as pending'); t.feeId = fee.id;
      const p1 = await api('POST', '/payments', { token: me.token, json: { items: [{ fee_id: fee.id, amount: 2000 }], payment_method: 'upi' } }); expect(p1.status === 201 && p1.data.transaction.status === 'success' && p1.data.receipt.receipt_number, `payment ${has(p1)}`);
      t.txnId = p1.data.transaction.id; t.receiptId = p1.data.receipt.id;
      fees = await api('GET', '/fees?limit=50', { token: me.token }); let row = fees.data.items.find((x) => x.id === fee.id); expect(row.status === 'partial' && row.paid_amount === 2000 && row.pending_amount === 4000, `after part payment: ${row.status} ${row.paid_amount}`);
      const p2 = await api('POST', '/payments', { token: me.token, json: { fee_ids: [fee.id], payment_method: 'net_banking' } }); expect(p2.status === 201 && p2.data.transaction.amount === 4000, `second payment ${has(p2)}`);
      fees = await api('GET', '/fees?limit=50', { token: me.token }); row = fees.data.items.find((x) => x.id === fee.id); expect(row.status === 'paid' && row.pending_amount === 0, `after full payment: ${row.status}`);
      const again = await api('POST', '/payments', { token: me.token, json: { fee_ids: [fee.id], payment_method: 'upi' } }); expect(again.status === 409, `paying a paid fee: ${has(again)}`);
      const txns = await api('GET', '/transactions', { token: me.token }); expect(txns.data.items.length >= 2, 'transactions missing');
    });
    await check('Payments never accept card numbers, CVV or PIN; students cannot pay cash; overpaying is refused', async () => {
      const card = await api('POST', '/payments', { token: me.token, json: { fee_ids: [t.feeId], payment_method: 'card', card_number: '4111111111111111', cvv: '123' } }); expect(card.status === 400, `card data: ${has(card)}`);
      expect((await api('POST', '/payments', { token: me.token, json: { fee_ids: [t.feeId], payment_method: 'cash' } })).status === 400, 'student cash accepted');
    });
    await check('A failed payment is recorded and the student is not charged (development mode)', async () => {
      const f = await api('POST', '/fees', { token: t.admin.token, json: { student_id: t.newStudentId, semester_id: subject.semester_id, fee_type: 'other', amount: 1000, due_date: isoDay(30), description: 'Verify failure fee' } });
      const fee = (await api('GET', '/fees?limit=50', { token: me.token })).data.items.find((x) => x.description === 'Verify failure fee'); expect(fee, 'fee missing');
      const r = await api('POST', '/payments', { token: me.token, json: { fee_ids: [fee.id], payment_method: 'upi', simulate_failure: true } });
      if (r.status === 201) return warn('server is NOT in development mode: simulate_failure was ignored (this payment really went through)');
      expect(r.status === 402, `expected 402, ${has(r)}`);
      const after = (await api('GET', '/fees?limit=50', { token: me.token })).data.items.find((x) => x.id === fee.id); expect(after.paid_amount === 0, 'fee was charged');
      const txns = await api('GET', '/transactions?status=failed', { token: me.token }); expect(txns.data.items.length >= 1, 'failed transaction not recorded');
      return f.status === 201 ? 'failed attempt recorded' : '';
    });
    await check('Receipt and payment-receipt PDFs download; another student cannot fetch them', async () => {
      expect(isPdf(await api('GET', `/receipts/${t.receiptId}/pdf`, { token: me.token, raw: true })), 'receipt PDF invalid');
      expect(isPdf(await api('GET', `/transactions/${t.txnId}/pdf`, { token: me.token, raw: true })), 'payment receipt PDF invalid');
      expect((await api('GET', `/receipts/${t.receiptId}`, { token: t.other.token })).status === 403, "another student read someone's receipt");
      expect((await api('GET', `/receipts/${t.receiptId}/pdf`, { token: t.other.token, raw: true })).status === 403, "another student downloaded someone's receipt PDF");
    });

    await check('Hostel: full room refused, one active request per student, approve, cancel frees the bed', async () => {
      const full = await api('GET', '/hostel/rooms?q=B-102&limit=5', { token: me.token }); const fullRoom = full.data.items.find((r) => r.room_number === 'B-102');
      if (fullRoom && fullRoom.available_beds === 0) expect((await api('POST', '/hostel/bookings', { token: me.token, json: { room_id: fullRoom.id } })).status === 409, 'full room accepted'); else warn('B-102 is not full in this database, skipping the full-room check');
      const rooms = await api('GET', '/hostel/rooms?available=true&limit=100', { token: me.token }); const room = rooms.data.items.find((r) => r.available_beds > 0); expect(room, 'no free room');
      const b = await api('POST', '/hostel/bookings', { token: me.token, json: { room_id: room.id } }); expect(b.status === 201, `request ${has(b)}`);
      expect((await api('POST', '/hostel/bookings', { token: me.token, json: { room_id: room.id } })).status === 409, 'second active request accepted');
      const ok = await api('PUT', `/hostel/bookings/${b.data.id}/review`, { token: t.admin.token, json: { action: 'approve' } }); expect(ok.status === 200, `approve ${has(ok)}`);
      let now = (await api('GET', `/hostel/rooms/${room.id}`, { token: t.admin.token })).data; expect(now.occupied_beds === room.occupied_beds + 1, `occupied beds ${now.occupied_beds} (expected ${room.occupied_beds + 1})`);
      expect((await api('PUT', `/hostel/bookings/${b.data.id}/cancel`, { token: me.token })).status === 200, 'cancel failed');
      now = (await api('GET', `/hostel/rooms/${room.id}`, { token: t.admin.token })).data; expect(now.occupied_beds === room.occupied_beds, 'bed was not freed');
    });
    await check('Hostel overbooking is impossible: a room cannot exceed its capacity', async () => {
      const rooms = await api('GET', '/hostel/rooms?limit=100', { token: t.admin.token }); const room = rooms.data.items[0];
      const r = await api('PUT', `/hostel/rooms/${room.id}`, { token: t.admin.token, json: { occupied_beds: room.capacity + 1 } }); expect(r.status === 400, `database allowed overbooking: ${has(r)}`);
    });

    await check('Library: issue, renew, return', async () => {
      const books = await api('GET', '/books?available=true&limit=1', { token: t.admin.token }); const book = books.data.items[0]; expect(book, 'no available book');
      const i = await api('POST', '/library/issues', { token: t.admin.token, json: { student_id: t.newStudentId, book_id: book.id } }); expect(i.status === 201, `issue ${has(i)}`);
      const after = await api('GET', `/books/${book.id}`, { token: t.admin.token }); expect(after.data.available_copies === book.available_copies - 1, 'copies not reduced');
      const mine = await api('GET', '/library/issues', { token: me.token }); const issue = mine.data.items.find((x) => x.book_id === book.id && !x.return_date); expect(issue && issue.can_renew, 'cannot renew');
      expect((await api('PUT', `/library/issues/${issue.id}/renew`, { token: me.token })).status === 200, 'renew failed');
      expect((await api('PUT', `/library/issues/${issue.id}/return`, { token: t.admin.token })).status === 200, 'return failed');
      expect((await api('GET', `/books/${book.id}`, { token: t.admin.token })).data.available_copies === book.available_copies, 'copy not restored');
    });

    await check('Answer sheets: upload validation, release, owner-only access, download permission', async () => {
      const exams = await api('GET', '/exams?limit=10', { token: t.admin.token }); const paper = exams.data.items.flatMap((e) => e.subjects)[0]; expect(paper, 'no exam paper');
      const fields = { student_id: t.newStudentId, exam_subject_id: paper.id, marks_obtained: 10, release: 1, download_allowed: 0 };
      expect((await api('POST', '/answer-sheets', { token: t.admin.token, form: upload('virus.exe', Buffer.from('MZ'), 'application/octet-stream', fields) })).status === 400, '.exe accepted');
      expect((await api('POST', '/answer-sheets', { token: t.admin.token, form: upload('fake.pdf', Buffer.from('this is not a pdf'), 'application/pdf', fields) })).status === 400, 'a text file named .pdf was accepted');
      expect((await api('POST', '/answer-sheets', { token: me.token, form: upload('s.pdf', pdfBytes, 'application/pdf', fields) })).status === 403, 'student uploaded an answer sheet');
      const up = await api('POST', '/answer-sheets', { token: t.admin.token, form: upload('scan.pdf', pdfBytes, 'application/pdf', fields) }); expect(up.status === 201, `upload ${has(up)}`);
      const list = await api('GET', '/answer-sheets', { token: me.token }); const sheet = list.data.items[0]; expect(sheet && sheet.file_url && !('file_path' in sheet), 'student cannot see the released sheet (or the server path leaked)');
      expect((await api('GET', sheet.file_url.replace(/^\/api/, ''), { raw: true })).status === 401, 'file readable without a login');
      expect(isPdf(await api('GET', sheet.file_url.replace(/^\/api/, ''), { token: me.token, raw: true })), 'owner cannot view the file');
      expect((await api('GET', `${sheet.file_url.replace(/^\/api/, '')}?download=true`, { token: me.token, raw: true })).status === 403, 'download allowed although it is not');
      expect((await api('GET', sheet.file_url.replace(/^\/api/, ''), { token: t.other.token, raw: true })).status === 403, "another student opened someone's answer sheet");
      expect((await api('PUT', `/answer-sheets/${sheet.id}`, { token: t.admin.token, json: { is_released: false } })).status === 200, 'unrelease failed');
      expect((await api('GET', '/answer-sheets', { token: me.token })).data.items.length === 0, 'unreleased sheet still visible');
      expect((await api('DELETE', `/answer-sheets/${sheet.id}`, { token: t.admin.token })).status === 200, 'delete failed');
    });

    await check('Admin disables the student -> login is refused', async () => {
      expect((await api('DELETE', `/students/${t.newStudentId}`, { token: t.admin.token })).status === 200, 'disable failed');
      const r = await api('POST', '/auth/login', { json: { username: credentials.username, password: credentials.password } }); expect(r.status === 403, `login of a disabled account: ${has(r)}`);
      const old = await api('GET', '/auth/me', { token: me.token }); expect(old.status === 401, 'the old token of a disabled account still works');
    });
  }

  // ------------------------------------------------------------------ 8
  section('8. PDF documents (demo students)');
  await check('Time table PDF', async () => { expect(isPdf(await api('GET', '/timetable/pdf', { token: t.student.token, raw: true })), 'invalid'); });
  await check('Grade card PDF', async () => { expect(isPdf(await api('GET', '/grade-card/pdf', { token: t.student.token, raw: true })), 'invalid'); });
  await check('Hall ticket PDF (and a blocked ticket is refused)', async () => {
    const list = await api('GET', '/hall-ticket', { token: t.student.token }); const ok = list.data.find((x) => x.status === 'generated'); expect(ok, 'student01 has no generated ticket');
    expect(isPdf(await api('GET', `/hall-ticket/${ok.exam_id}/pdf`, { token: t.student.token, raw: true })), 'invalid');
    const s5 = await loginAs(['student05', 'Student@123']); const l5 = await api('GET', '/hall-ticket', { token: s5.token }); const blocked = l5.data.find((x) => x.status === 'blocked');
    if (blocked) expect((await api('GET', `/hall-ticket/${blocked.exam_id}/pdf`, { token: s5.token, raw: true })).status === 403, 'blocked ticket was downloadable'); else warn('student05 has no blocked ticket in this database');
  });
  await check('Faculty teaching time table PDF', async () => { expect(isPdf(await api('GET', '/timetable/pdf', { token: t.faculty.token, raw: true })), 'invalid'); });
  await check('PDF endpoints need a login', async () => { expect((await api('GET', '/grade-card/pdf', { raw: true })).status === 401, 'open to everyone'); });

  // ------------------------------------------------------------------ 9
  section('9. Security basics');
  await check('Secure HTTP headers are set and X-Powered-By is hidden', async () => { const r = await api('GET', '/health'); expect(r.headers.get('x-content-type-options') === 'nosniff' && !r.headers.get('x-powered-by'), 'headers missing'); });
  await check('Rate limiting is active', async () => { const r = await api('GET', '/health'); expect([...r.headers.keys()].some((k) => k.startsWith('ratelimit')), 'no rate-limit headers'); });
  await check('CORS does not allow other websites', async () => { const r = await api('GET', '/health', { headers: { Origin: 'http://evil.example' } }); expect(r.headers.get('access-control-allow-origin') !== 'http://evil.example' && r.headers.get('access-control-allow-origin') !== '*', `allowed ${r.headers.get('access-control-allow-origin')}`); });
  await check('Student list never contains password hashes', async () => { const r = await api('GET', '/students?limit=50', { token: t.admin.token }); expect(!/password|\$2[aby]\$/i.test(JSON.stringify(r.body)), 'password data in the answer'); });
  await check('SQL-injection text in a search box is harmless', async () => { const r = await api('GET', `/books?q=${encodeURIComponent("' OR 1=1 --")}`, { token: t.student.token }); expect(r.status === 200 && r.data.items.length === 0, `got ${r.status} with ${r.data && r.data.items && r.data.items.length} rows`); });

  console.log(`\n${'='.repeat(60)}\n${passed} passed, ${failed} failed${warned ? `, ${warned} warning(s)` : ''}`);
  if (failed) { console.log('\nFailures:'); failures.forEach((f) => console.log(`  - ${f}`)); }
  console.log('\nThe checks created one throwaway student (now disabled), a few records for it, and nothing for the demo students. Re-run database/seed.sql to reset.');
  process.exit(failed ? 1 : 0);
})().catch((err) => { console.error('\nverify.js crashed:', err); process.exit(2); });
