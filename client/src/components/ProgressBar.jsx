import { attendanceTone } from '../utils/format';

// value 0-100. tone="auto" colours it like attendance: green 75+, amber 65-74, red below
export default function ProgressBar({ value = 0, tone = 'auto', label }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const colour = tone === 'auto' ? attendanceTone(pct) : tone;
  return (
    <div className={`progress ${colour}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}
