// Faculty create and update lesson plans for their own subjects (admin can edit any).
import { useMemo } from 'react';
import CrudManager from '../../components/CrudManager';
import Badge from '../../components/Badge';
import { useAuth } from '../../context/AuthContext';
import { formatDate, humanize } from '../../utils/format';

const METHODS = ['lecture', 'tutorial', 'lab_session', 'seminar', 'case_study', 'group_discussion'].map((v) => ({ value: v, label: humanize(v) }));
const STATUSES = ['planned', 'in_progress', 'completed', 'postponed'].map((v) => ({ value: v, label: humanize(v) }));

export default function LessonPlansManage() {
  const { role } = useAuth();
  const subjectParams = { limit: 100, ...(role === 'faculty' ? { mine: 'true' } : {}) };
  const subjectLabel = (s) => `${s.code} - ${s.name}`;
  const fields = useMemo(() => [
    { name: 'subject_id', label: 'Subject', type: 'select', required: true, disabledOnEdit: true, optionsUrl: '/subjects', optionsParams: subjectParams, optionLabel: subjectLabel },
    { name: 'unit_no', label: 'Unit', type: 'number', required: true, min: 1, max: 20 },
    { name: 'topic', label: 'Topic', required: true, full: true, maxLength: 200 },
    { name: 'teaching_method', label: 'Teaching method', type: 'select', options: METHODS },
    { name: 'status', label: 'Status', type: 'select', options: STATUSES },
    { name: 'planned_date', label: 'Planned date', type: 'date', required: true },
    { name: 'completed_date', label: 'Completed date', type: 'date', hint: 'Filled automatically when you mark the topic completed' },
    { name: 'remarks', label: 'Remarks', type: 'textarea', full: true, maxLength: 255 },
  ], [role]); // eslint-disable-line react-hooks/exhaustive-deps
  const columns = [
    { key: 'subject_name', header: 'Subject', render: (p) => `${p.subject_name} (${p.subject_code})` },
    { key: 'unit_no', header: 'Unit', numeric: true },
    { key: 'topic', header: 'Topic', render: (p) => <span>{p.topic}{p.remarks && <><br /><small className="muted">{p.remarks}</small></>}</span> },
    { key: 'teaching_method', header: 'Method', render: (p) => humanize(p.teaching_method) },
    { key: 'planned_date', header: 'Planned', render: (p) => formatDate(p.planned_date) },
    { key: 'completed_date', header: 'Completed', render: (p) => formatDate(p.completed_date) },
    { key: 'status', header: 'Status', render: (p) => <Badge status={p.status} /> },
  ];
  return (
    <CrudManager title="Lesson Plans" subtitle="Plan what you will teach, then mark topics as completed." entity="lesson plan" url="/lesson-plans" limit={10}
      columns={columns} fields={fields} searchPlaceholder="Search topic or subject" defaults={{ teaching_method: 'lecture', status: 'planned' }}
      filters={[{ name: 'subject_id', label: 'Subject', optionsUrl: '/subjects', optionsParams: subjectParams, optionLabel: subjectLabel }, { name: 'status', label: 'Status', options: STATUSES }]} />
  );
}
