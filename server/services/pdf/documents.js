// The five PDF documents. Each function receives the SAME data object the JSON API returns,
// so a PDF can never show something different from the screen.
const { PdfBuilder, COLORS } = require('./pdfBuilder');

const num = (v) => Number(v || 0);
const money = (v) => `Rs. ${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const humanize = (s) => (s ? String(s).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '-');
const date = (v) => {
  if (!v) return '-';
  const d = new Date(String(v).length === 10 ? `${v}T00:00:00` : String(v).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const dateTime = (v) => {
  const d = new Date(String(v).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const hm = (t) => (t ? String(t).slice(0, 5) : '-');

// ------------------------------------------------------------------ 1. fee receipt
async function feeReceipt(r) {
  const pdf = await PdfBuilder.create({ title: `Fee receipt ${r.receipt_number}` });
  pdf.header({ college: r.college_name, title: 'FEE PAYMENT RECEIPT', rightLines: [{ text: r.receipt_number, bold: true, size: 10 }, { text: date(r.payment_date), color: COLORS.muted }] });
  pdf.keyValues([
    ['Student name', r.student_name], ['Student ID', r.student_code],
    ['Course', r.course], ['Department', r.department],
    ['Payment date', dateTime(r.transaction_date)], ['Payment method', humanize(r.payment_method)],
    ['Transaction ID', r.transaction_ref], ['Receipt number', r.receipt_number],
  ]);
  pdf.heading('Fees paid');
  const rows = r.items.map((it, i) => ({ n: i + 1, description: it.description || humanize(it.fee_type), amount: money(it.amount) }));
  rows.push({ n: '', description: 'Total paid', amount: money(r.amount), _bold: true });
  pdf.table({ columns: [{ header: '#', width: 0.6, key: 'n' }, { header: 'Payment description', width: 7, key: 'description' }, { header: 'Amount', width: 2.4, align: 'right', key: 'amount' }], rows, fontSize: 9.5, padding: 6 });
  pdf.stamp('PAID');
  pdf.signatures(['Student signature', 'Authorized signature']);
  return pdf.finish(r.college_name);
}

// ------------------------------------------------------------------ 2. payment receipt (the transaction itself)
async function paymentReceipt(t) {
  const pdf = await PdfBuilder.create({ title: `Payment receipt ${t.transaction_ref}` });
  pdf.header({ college: t.college_name, title: 'PAYMENT RECEIPT - TRANSACTION ACKNOWLEDGEMENT', rightLines: [{ text: t.transaction_ref, bold: true, size: 8.5 }, { text: dateTime(t.transaction_date), color: COLORS.muted, size: 8 }] });
  pdf.heading('Payment details');
  pdf.keyValues([
    ['Transaction ID', t.transaction_ref], ['Payment status', humanize(t.status)],
    ['Date and time', dateTime(t.transaction_date)], ['Payment method', humanize(t.payment_method)],
    ['Amount paid', money(t.amount)], ['Gateway reference', t.gateway_reference || '-'],
    ['Receipt number', t.receipt_number || '-'], ['Description', t.description || '-'],
  ]);
  pdf.heading('Paid by');
  pdf.keyValues([['Student name', t.student_name], ['Student ID', t.student_code], ['Course', t.course], ['Department', t.department]]);
  pdf.heading('Fees covered by this payment');
  const rows = t.items.map((it, i) => ({ n: i + 1, description: it.description || humanize(it.fee_type), amount: money(it.amount) }));
  rows.push({ n: '', description: 'Total', amount: money(t.amount), _bold: true });
  pdf.table({ columns: [{ header: '#', width: 0.6, key: 'n' }, { header: 'Fee', width: 7, key: 'description' }, { header: 'Amount', width: 2.4, align: 'right', key: 'amount' }], rows, fontSize: 9.5, padding: 6 });
  pdf.stamp(t.status === 'success' ? 'SUCCESSFUL' : humanize(t.status).toUpperCase(), t.status === 'success' ? COLORS.good : COLORS.bad);
  pdf.paragraph('This acknowledgement confirms the payment recorded by the college. Card numbers, CVV and PIN are never stored by the portal.', { size: 8.5, color: COLORS.muted });
  return pdf.finish(t.college_name);
}

// ------------------------------------------------------------------ 3. grade card
async function gradeCard(data) {
  const s = data.student;
  const pdf = await PdfBuilder.create({ title: `Grade card ${s.student_code}` });
  pdf.header({ college: data.college_name, title: 'GRADE CARD', subtitle: 'Statement of grades' });
  pdf.keyValues([['Student name', s.full_name], ['Student ID', s.student_code], ['Course', s.course], ['Department', s.department], ['Section', s.section], ['Admission year', s.admission_year]]);
  const columns = [
    { header: 'Sem', width: 0.8, key: 'sem' }, { header: 'Subject', width: 4.2, key: 'subject' }, { header: 'Code', width: 1.3, key: 'code' },
    { header: 'Credits', width: 1, align: 'right', key: 'credits' }, { header: 'Internal', width: 1.1, align: 'right', key: 'internal' },
    { header: 'External', width: 1.1, align: 'right', key: 'external' }, { header: 'Total', width: 1, align: 'right', key: 'total' },
    { header: 'Grade', width: 0.9, align: 'center', key: 'grade' }, { header: 'Points', width: 1, align: 'right', key: 'points' }, { header: 'Result', width: 1.1, key: 'result' },
  ];
  data.cards.forEach((card) => {
    pdf.heading(`Semester ${card.semester_no}  (${card.academic_year})`);
    const rows = card.subjects.map((x) => ({
      sem: card.semester_no, subject: x.subject_name, code: x.subject_code, credits: x.credits,
      internal: num(x.internal_marks) + num(x.mid_marks) + num(x.assignment_marks) + num(x.practical_marks), external: num(x.external_marks),
      total: num(x.total_marks), grade: x.grade || '-', points: x.grade_points ?? '-', result: String(x.result).toUpperCase(),
    }));
    pdf.table({ columns, rows, fontSize: 8.5 });
    pdf.paragraph(`SGPA: ${card.sgpa.toFixed(2)}  |  CGPA: ${card.cgpa.toFixed(2)}  |  Credits earned: ${card.earned_credits}/${card.total_credits}  |  Result: ${card.result_status.toUpperCase()}`,
      { size: 9.5, bold: true, color: card.result_status === 'pass' ? COLORS.good : COLORS.bad });
  });
  pdf.rule();
  pdf.paragraph(`Cumulative Grade Point Average (CGPA): ${data.cgpa === null ? '-' : Number(data.cgpa).toFixed(2)}`, { size: 11, bold: true });
  pdf.paragraph('Internal = internal + mid + assignment + practical marks. External = end-semester examination. Grade scale: O 90+, A+ 80+, A 70+, B+ 60+, B 50+, C 40+, F below 40.', { size: 8, color: COLORS.muted });
  pdf.signatures(['Prepared by', 'Controller of Examinations']);
  return pdf.finish(data.college_name);
}

// ------------------------------------------------------------------ 4. hall ticket
async function hallTicket(t, photoBuffer) {
  const pdf = await PdfBuilder.create({ title: `Hall ticket ${t.ticket_number}` });
  const photo = await pdf.embedImage(photoBuffer);
  pdf.header({ college: t.college_name, title: 'HALL TICKET', subtitle: t.exam_name, photo: photo || undefined, rightLines: photo ? [] : [{ text: 'Affix photo', color: COLORS.muted }] });
  pdf.keyValues([
    ['Hall ticket no.', t.ticket_number], ['Student name', t.full_name],
    ['Student ID', t.student_code], ['Course', t.course],
    ['Department', t.department], ['Semester / Section', `Semester ${t.semester_no} (${t.academic_year}) / ${t.section}`],
    ['Examination', `${t.exam_name} (${humanize(t.exam_type)})`], ['Exam center', t.exam_center || '-'],
    ['Exam dates', `${date(t.start_date)} to ${date(t.end_date)}`], ['Issued on', date(t.issued_on)],
  ]);
  pdf.heading('Examination schedule');
  pdf.table({
    columns: [{ header: 'Subject', width: 4, key: 'subject' }, { header: 'Code', width: 1.3, key: 'code' }, { header: 'Date', width: 1.8, key: 'date' }, { header: 'Time', width: 1.6, key: 'time' }, { header: 'Room', width: 2, key: 'room' }],
    rows: t.subjects.map((x) => ({ subject: x.subject_name, code: x.subject_code, date: date(x.exam_date), time: `${hm(x.start_time)} - ${hm(x.end_time)}`, room: x.room_number || '-' })), fontSize: 9, padding: 5,
  });
  if (t.instructions) { pdf.heading('Instructions'); pdf.paragraph(t.instructions, { size: 9 }); }
  pdf.paragraph('Carry this hall ticket and your college ID card to every examination. Mobile phones and smart watches are not allowed in the hall.', { size: 8.5, color: COLORS.muted });
  pdf.signatures(['Student signature', 'Controller of Examinations']);
  return pdf.finish(t.college_name);
}

// ------------------------------------------------------------------ 5. timetable (landscape grid)
async function timetable({ college, title, subtitle, slots }) {
  const pdf = await PdfBuilder.create({ title: `Time table - ${title}`, landscape: true });
  pdf.header({ college, title: `TIME TABLE - ${title}`, subtitle });
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const periods = [...new Set(slots.map((s) => `${s.start_time}|${s.end_time}`))].sort();
  const cell = (day, p) => slots.filter((s) => s.day_of_week === day && `${s.start_time}|${s.end_time}` === p)
    .map((s) => [`${s.subject_code} ${s.subject_name}`, `Room ${s.room_number}`, s.faculty_name || '', s.section ? `Section ${s.section}` : ''].filter(Boolean).join('\n')).join('\n\n');
  pdf.table({
    columns: [{ header: 'Time', width: 0.9, align: 'center', key: 'time' }, ...days.map((d) => ({ header: d, width: 1.7, key: d }))],
    rows: periods.map((p) => { const [a, b] = p.split('|'); const row = { time: `${hm(a)}\n${hm(b)}` }; days.forEach((d) => { row[d] = cell(d, p) || '-'; }); return row; }), fontSize: 7.8, padding: 4,
  });
  return pdf.finish(college);
}

module.exports = { feeReceipt, paymentReceipt, gradeCard, hallTicket, timetable };
