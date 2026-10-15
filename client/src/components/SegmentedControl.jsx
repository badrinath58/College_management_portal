// Present / Absent / Late buttons for one student.
const OPTIONS = [{ value: 'present', label: 'P', title: 'Present' }, { value: 'absent', label: 'A', title: 'Absent' }, { value: 'late', label: 'L', title: 'Late' }];

export default function SegmentedControl({ value, onChange, name }) {
  return (
    <div className="seg" role="group" aria-label={`Attendance for ${name}`}>
      {OPTIONS.map((o) => (
        <button key={o.value} type="button" title={o.title} aria-pressed={value === o.value} className={value === o.value ? `on-${o.value}` : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}
