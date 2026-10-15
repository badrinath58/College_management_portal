import { humanize, statusTone } from '../utils/format';

// <Badge status="overdue" />  -> red "Overdue"      <Badge tone="info">New</Badge>
export default function Badge({ status, tone, children }) {
  return <span className={`badge ${tone || statusTone(status)}`}>{children || humanize(status)}</span>;
}
