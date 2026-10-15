// Admin tools used on the Fee Details page: add a fee, charge a whole semester, edit or delete one fee.
import { useToast } from '../../hooks/useToast';
import FormModal from '../../components/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { http } from '../../services/api';
import { formatCurrency, humanize } from '../../utils/format';

const TYPES = ['tuition', 'examination', 'hostel', 'library', 'transport', 'other'].map((v) => ({ value: v, label: humanize(v) }));
const SEMESTER = { name: 'semester_id', label: 'Semester', type: 'select', required: true, optionsUrl: '/semesters', optionsParams: { limit: 100 }, optionLabel: (s) => `${s.course_name} - Sem ${s.semester_no} (${s.academic_year})` };
const COMMON = [
  { name: 'fee_type', label: 'Fee type', type: 'select', required: true, options: TYPES },
  { name: 'amount', label: 'Amount (Rs.)', type: 'number', required: true, min: 0.01, step: 0.01 },
  { name: 'due_date', label: 'Due date', type: 'date', required: true },
  { name: 'description', label: 'Description', maxLength: 150, full: true },
];
const ADD_FIELDS = [{ name: 'student_id', label: 'Student', type: 'student', required: true, full: true }, SEMESTER, ...COMMON];
const ASSIGN_FIELDS = [SEMESTER, { name: 'section', label: 'Section (leave empty for everyone)', maxLength: 1 }, ...COMMON];

// modal = { type: 'add' | 'assign' | 'edit' | 'delete', fee? }
export default function FeeAdmin({ modal, onClose, onDone }) {
  const toast = useToast();
  const done = (message) => { toast.success(message); onClose(); onDone(); };
  const fee = modal?.fee;
  return (
    <>
      <FormModal open={modal?.type === 'add'} title="Add a fee for one student" fields={ADD_FIELDS} initial={{ fee_type: 'tuition' }} onSubmit={async (v) => done((await http.post('/fees', v)).message)} onClose={onClose} />
      <FormModal open={modal?.type === 'assign'} title="Charge a fee to a whole semester" fields={ASSIGN_FIELDS} initial={{ fee_type: 'examination' }} submitLabel="Charge students"
        note="Every student of the semester gets this fee. Students who already have this fee type are skipped, and everyone is notified."
        onSubmit={async (v) => { const r = await http.post('/fees/assign', v); done(`${r.data.students_charged} student(s) charged`); }} onClose={onClose} />
      <FormModal open={modal?.type === 'edit'} mode="edit" title="Edit fee" fields={COMMON} initial={fee || {}}
        note={fee ? `${fee.student_name}. ${formatCurrency(fee.paid_amount)} is already paid, so the amount cannot go below that.` : undefined}
        onSubmit={async (v) => { const body = { ...v }; Object.keys(body).forEach((k) => { if (body[k] === '') delete body[k]; }); done((await http.put(`/fees/${fee.id}`, body)).message); }} onClose={onClose} />
      <ConfirmDialog open={modal?.type === 'delete'} danger title="Delete this fee?" confirmText="Delete" onCancel={onClose}
        onConfirm={async () => { try { done((await http.delete(`/fees/${fee.id}`)).message); } catch (err) { toast.error(err.message); onClose(); } }}
        message={fee ? `${humanize(fee.fee_type)} fee of ${formatCurrency(fee.amount)} for ${fee.student_name}. A fee with payments cannot be deleted.` : ''} />
    </>
  );
}
