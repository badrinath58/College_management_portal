// A printable fee receipt: college name and logo, receipt number, student, payment details, signature area.
import Logo from './Logo';
import { formatCurrency, formatDate, formatDateTime, humanize } from '../utils/format';

export default function Receipt({ receipt: r }) {
  return (
    <div className="doc receipt">
      <div className="doc-head">
        <Logo size={64} />
        <div className="title"><h2>{r.college_name}</h2><p>Fee Payment Receipt</p></div>
        <div style={{ textAlign: 'right' }}><strong>{r.receipt_number}</strong><br />{formatDate(r.payment_date)}</div>
      </div>
      <dl>
        <dt>Student name</dt><dd>{r.student_name}</dd>
        <dt>Student ID</dt><dd>{r.student_code}</dd>
        <dt>Course</dt><dd>{r.course} ({r.department})</dd>
        <dt>Payment date</dt><dd>{formatDateTime(r.transaction_date)}</dd>
        <dt>Payment method</dt><dd>{humanize(r.payment_method)}</dd>
        <dt>Transaction ID</dt><dd>{r.transaction_ref}</dd>
      </dl>
      <table>
        <thead><tr><th>#</th><th>Payment description</th><th className="num">Amount</th></tr></thead>
        <tbody>
          {r.items.map((it, i) => <tr key={i}><td>{i + 1}</td><td>{it.description || humanize(it.fee_type)}</td><td className="num">{formatCurrency(it.amount)}</td></tr>)}
          <tr><td colSpan={2}><strong>Total paid</strong></td><td className="num"><strong>{formatCurrency(r.amount)}</strong></td></tr>
        </tbody>
      </table>
      <p className="stamp">PAID</p>
      <div className="signatures"><div>Student signature</div><div>Authorized signature</div></div>
      <p style={{ textAlign: 'center', marginTop: 14, fontSize: '0.75rem', color: '#64748b' }}>This is a computer generated receipt.</p>
    </div>
  );
}
