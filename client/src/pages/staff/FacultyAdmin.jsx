// Admin: add, edit, disable faculty and reset passwords.
import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import CrudManager from '../../components/CrudManager';
import FormModal from '../../components/FormModal';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import { useToast } from '../../hooks/useToast';
import { http } from '../../services/api';

const FIELDS = [
  { name: 'username', label: 'Username', required: true, createOnly: true, maxLength: 50 },
  { name: 'password', label: 'Temporary password', type: 'password', required: true, createOnly: true },
  { name: 'employee_id', label: 'Employee ID', required: true, createOnly: true, maxLength: 20 },
  { name: 'full_name', label: 'Full name', required: true, maxLength: 100 },
  { name: 'email', label: 'Email', type: 'email', required: true, maxLength: 120 },
  { name: 'department_id', label: 'Department', type: 'select', required: true, optionsUrl: '/departments', optionsParams: { limit: 100 } },
  { name: 'designation', label: 'Designation', maxLength: 80 },
  { name: 'phone', label: 'Phone', maxLength: 15 },
  { name: 'joining_date', label: 'Joining date', type: 'date' },
];
const COLUMNS = [
  { key: 'employee_id', header: 'Employee ID' }, { key: 'full_name', header: 'Name', render: (f) => <strong>{f.full_name}</strong> },
  { key: 'email', header: 'Email' }, { key: 'department', header: 'Department' }, { key: 'designation', header: 'Designation' }, { key: 'phone', header: 'Phone' },
  { key: 'is_active', header: 'Account', render: (f) => <Badge tone={f.is_active ? 'success' : 'neutral'}>{f.is_active ? 'Active' : 'Disabled'}</Badge> },
];

export default function FacultyAdmin() {
  const toast = useToast();
  const [reset, setReset] = useState(null);
  return (
    <>
      <CrudManager title="Manage Faculty" subtitle="Create faculty accounts, update details, disable accounts, reset passwords." entity="faculty member" url="/faculty" loadOne deleteLabel="Disable"
        columns={COLUMNS} fields={FIELDS} searchPlaceholder="Search name, employee ID or email"
        confirmDeleteText={(f) => (f ? `${f.full_name} will no longer be able to log in. Subjects assigned to them stay assigned.` : '')}
        filters={[{ name: 'department_id', label: 'Department', optionsUrl: '/departments', optionsParams: { limit: 100 } }]}
        rowActions={(f) => <Button size="sm" variant="secondary" icon={<KeyRound size={14} />} onClick={() => setReset(f)}>Reset password</Button>} />
      <FormModal open={Boolean(reset)} title={reset ? `Reset password - ${reset.full_name}` : ''} submitLabel="Set password" note="Tell them the temporary password in person."
        fields={[{ name: 'new_password', label: 'New temporary password', type: 'password', required: true, full: true }]}
        onSubmit={async (v) => { const res = await http.put(`/faculty/${reset.id}/reset-password`, v); toast.success(res.message); setReset(null); }} onClose={() => setReset(null)} />
    </>
  );
}
