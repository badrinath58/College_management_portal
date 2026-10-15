// Admin: add, update and delete backlog records. (Backlogs are also created automatically when a failed result is finalized.)
import CrudManager from '../../components/CrudManager';
import Badge from '../../components/Badge';
import { formatDate, humanize } from '../../utils/format';

const FIELDS = [
  { name: 'student_id', label: 'Student', type: 'student', required: true, createOnly: true, full: true },
  { name: 'subject_id', label: 'Subject', type: 'select', required: true, disabledOnEdit: true, full: true, optionsUrl: '/subjects', optionsParams: { limit: 100 }, optionLabel: (s) => `${s.code} - ${s.name} (Sem ${s.semester_no})` },
  { name: 'attempt_no', label: 'Attempts made', type: 'number', min: 1 },
  { name: 'result', label: 'Latest result', type: 'select', required: true, options: ['fail', 'absent', 'pass'].map((v) => ({ value: v, label: humanize(v) })) },
  { name: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'cleared', label: 'Cleared' }] },
  { name: 'reexam_date', label: 'Re-examination date', type: 'date' },
  { name: 'cleared_on', label: 'Cleared on', type: 'date' },
  { name: 'remarks', label: 'Remarks', type: 'textarea', full: true, maxLength: 255 },
];
const COLUMNS = [
  { key: 'student_name', header: 'Student', render: (b) => `${b.student_name} (${b.student_code})` },
  { key: 'subject_name', header: 'Subject', render: (b) => `${b.subject_name} (${b.subject_code})` },
  { key: 'semester_no', header: 'Sem', numeric: true }, { key: 'attempt_no', header: 'Attempt', numeric: true },
  { key: 'result', header: 'Result', render: (b) => <Badge status={b.result} /> }, { key: 'status', header: 'Status', render: (b) => <Badge status={b.status} /> },
  { key: 'reexam_date', header: 'Re-exam', render: (b) => formatDate(b.reexam_date) },
];

export default function BacklogsAdmin() {
  return (
    <CrudManager title="Backlogs" subtitle="Subjects students have not cleared." entity="backlog" url="/backlogs" columns={COLUMNS} fields={FIELDS}
      searchPlaceholder="Search student or subject" defaults={{ attempt_no: 1, status: 'active', result: 'fail' }}
      filters={[{ name: 'status', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'cleared', label: 'Cleared' }] }]} />
  );
}
