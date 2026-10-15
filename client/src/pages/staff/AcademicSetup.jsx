// Admin: departments, courses, semesters and subjects (with the faculty who teaches each subject).
import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import Tabs from '../../components/Tabs';
import CrudManager from '../../components/CrudManager';
import Badge from '../../components/Badge';
import { formatDate } from '../../utils/format';

const semLabel = (s) => `${s.course_name} - Semester ${s.semester_no} (${s.academic_year})`;
const TABS = [{ id: 'departments', label: 'Departments' }, { id: 'courses', label: 'Courses' }, { id: 'semesters', label: 'Semesters' }, { id: 'subjects', label: 'Subjects' }];

export default function AcademicSetup() {
  const [tab, setTab] = useState('departments');
  return (
    <>
      <PageHeader title="Academic Setup" subtitle="Departments, courses, semesters and subjects. Students, exams and timetables are built on these." />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'departments' && (
        <CrudManager embedded entity="department" url="/departments" searchPlaceholder="Search departments"
          fields={[{ name: 'code', label: 'Code', required: true, maxLength: 10, hint: 'For example CSE' }, { name: 'name', label: 'Name', required: true, maxLength: 100 }, { name: 'hod_name', label: 'Head of department', maxLength: 100 }]}
          columns={[{ key: 'code', header: 'Code' }, { key: 'name', header: 'Name', render: (d) => <strong>{d.name}</strong> }, { key: 'hod_name', header: 'Head of department' }]} />
      )}
      {tab === 'courses' && (
        <CrudManager embedded entity="course" url="/courses" searchPlaceholder="Search courses"
          filters={[{ name: 'department_id', label: 'Department', optionsUrl: '/departments', optionsParams: { limit: 100 } }]}
          fields={[{ name: 'department_id', label: 'Department', type: 'select', required: true, optionsUrl: '/departments', optionsParams: { limit: 100 } }, { name: 'code', label: 'Code', required: true, maxLength: 20 },
            { name: 'name', label: 'Course name', required: true, full: true, maxLength: 100 }, { name: 'duration_years', label: 'Duration (years)', type: 'number', required: true, min: 1, max: 8 }, { name: 'total_semesters', label: 'Total semesters', type: 'number', required: true, min: 1, max: 16 }]}
          columns={[{ key: 'code', header: 'Code' }, { key: 'name', header: 'Course', render: (c) => <strong>{c.name}</strong> }, { key: 'department_name', header: 'Department' }, { key: 'duration_years', header: 'Years', numeric: true }, { key: 'total_semesters', header: 'Semesters', numeric: true }]} />
      )}
      {tab === 'semesters' && (
        <CrudManager embedded entity="semester" url="/semesters"
          filters={[{ name: 'course_id', label: 'Course', optionsUrl: '/courses', optionsParams: { limit: 100 } }]}
          fields={[{ name: 'course_id', label: 'Course', type: 'select', required: true, optionsUrl: '/courses', optionsParams: { limit: 100 } }, { name: 'semester_no', label: 'Semester number', type: 'number', required: true, min: 1, max: 12 },
            { name: 'academic_year', label: 'Academic year', required: true, maxLength: 9, hint: 'For example 2026-27' }, { name: 'is_current', label: 'This is the running semester', type: 'checkbox' },
            { name: 'start_date', label: 'Start date', type: 'date', required: true }, { name: 'end_date', label: 'End date', type: 'date', required: true }]}
          columns={[{ key: 'course_name', header: 'Course' }, { key: 'semester_no', header: 'Semester', numeric: true }, { key: 'academic_year', header: 'Year' },
            { key: 'start_date', header: 'Starts', render: (s) => formatDate(s.start_date) }, { key: 'end_date', header: 'Ends', render: (s) => formatDate(s.end_date) },
            { key: 'is_current', header: 'Running', render: (s) => (s.is_current ? <Badge tone="success">Current</Badge> : '-') }]} />
      )}
      {tab === 'subjects' && (
        <CrudManager embedded entity="subject" url="/subjects" searchPlaceholder="Search code or name"
          filters={[{ name: 'semester_id', label: 'Semester', optionsUrl: '/semesters', optionsParams: { limit: 100 }, optionLabel: semLabel }]}
          fields={[{ name: 'semester_id', label: 'Semester', type: 'select', required: true, disabledOnEdit: true, optionsUrl: '/semesters', optionsParams: { limit: 100 }, optionLabel: semLabel, full: true },
            { name: 'code', label: 'Subject code', required: true, maxLength: 20 }, { name: 'name', label: 'Subject name', required: true, maxLength: 120 },
            { name: 'credits', label: 'Credits', type: 'number', required: true, min: 1, max: 10 },
            { name: 'subject_type', label: 'Type', type: 'select', options: [{ value: 'theory', label: 'Theory' }, { value: 'practical', label: 'Practical / Lab' }] },
            { name: 'faculty_id', label: 'Taught by', type: 'select', optionsUrl: '/faculty', optionsParams: { limit: 100 }, optionLabel: (f) => `${f.full_name} (${f.employee_id})`, full: true }]}
          columns={[{ key: 'code', header: 'Code' }, { key: 'name', header: 'Subject', render: (s) => <strong>{s.name}</strong> }, { key: 'course_name', header: 'Course' }, { key: 'semester_no', header: 'Sem', numeric: true },
            { key: 'credits', header: 'Credits', numeric: true }, { key: 'subject_type', header: 'Type' }, { key: 'faculty_name', header: 'Faculty', render: (s) => s.faculty_name || <Badge tone="warning">Not assigned</Badge> }]} />
      )}
    </>
  );
}
