// Admin: add, edit, disable students and reset their passwords.
// (A student is DISABLED, not deleted, so marks, fees and receipts stay safe.)
import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import CrudManager from '../../components/CrudManager';
import FormModal from '../../components/FormModal';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import { useToast } from '../../hooks/useToast';
import { http } from '../../services/api';

const SECTIONS = ['A', 'B', 'C', 'D'].map((s) => ({ value: s, label: s }));
const FIELDS = [
  { name: 'username', label: 'Username', required: true, createOnly: true, maxLength: 50 },
  { name: 'password', label: 'Temporary password', type: 'password', required: true, createOnly: true, hint: 'The student changes it after the first login' },
  { name: 'student_code', label: 'Student ID', required: true, createOnly: true, maxLength: 20, hint: 'For example 24CS006' },
  { name: 'full_name', label: 'Full name', required: true, maxLength: 100 },
  { name: 'email', label: 'Email', type: 'email', required: true, maxLength: 120 },
  { name: 'mobile', label: 'Mobile', maxLength: 10 },
  { name: 'course_id', label: 'Course', type: 'select', required: true, optionsUrl: '/courses', optionsParams: { limit: 100 } },
  { name: 'current_semester_id', label: 'Current semester', type: 'select', optionsUrl: '/semesters', optionsParams: { limit: 100 }, optionLabel: (s) => `${s.course_name} - Sem ${s.semester_no} (${s.academic_year})` },
  { name: 'section', label: 'Section', type: 'select', required: true, options: SECTIONS },
  { name: 'admission_year', label: 'Admission year', type: 'number', required: true, min: 2000, max: 2100 },
  { name: 'current_year', label: 'Year of study', type: 'number', required: true, min: 1, max: 6 },
  { name: 'date_of_birth', label: 'Date of birth', type: 'date' },
  { name: 'gender', label: 'Gender', type: 'select', options: [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }] },
  { name: 'address', label: 'Address', type: 'textarea', full: true, maxLength: 255 },
];
const COLUMNS = [
  { key: 'student_code', header: 'Student ID' }, { key: 'full_name', header: 'Name', render: (s) => <strong>{s.full_name}</strong> },
  { key: 'email', header: 'Email' }, { key: 'course', header: 'Course' }, { key: 'semester', header: 'Sem', numeric: true }, { key: 'section', header: 'Sec' },
  { key: 'is_active', header: 'Account', render: (s) => <Badge tone={s.is_active ? 'success' : 'neutral'}>{s.is_active ? 'Active' : 'Disabled'}</Badge> },
];

export default function StudentsAdmin() {
  const toast = useToast();
  const [reset, setReset] = useState(null);
  return (
    <>
      <CrudManager title="Manage Students" subtitle="Create student accounts, update details, disable accounts, reset passwords." entity="student" url="/students" loadOne deleteLabel="Disable"
        columns={COLUMNS} fields={FIELDS} searchPlaceholder="Search name, Student ID or email" defaults={{ section: 'A', current_year: 1 }}
        confirmDeleteText={(s) => (s ? `${s.full_name} will no longer be able to log in. Their marks, fees and receipts are kept.` : '')}
        filters={[{ name: 'course_id', label: 'Course', optionsUrl: '/courses', optionsParams: { limit: 100 } }, { name: 'section', label: 'Section', options: SECTIONS }]}
        rowActions={(s) => <Button size="sm" variant="secondary" icon={<KeyRound size={14} />} onClick={() => setReset(s)}>Reset password</Button>} />
      <FormModal open={Boolean(reset)} title={reset ? `Reset password - ${reset.full_name}` : ''} submitLabel="Set password" note="Tell the student the temporary password in person. They should change it after logging in."
        fields={[{ name: 'new_password', label: 'New temporary password', type: 'password', required: true, full: true }]}
        onSubmit={async (v) => { const res = await http.put(`/students/${reset.id}/reset-password`, v); toast.success(res.message); setReset(null); }} onClose={() => setReset(null)} />
    </>
  );
}
