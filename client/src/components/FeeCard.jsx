// A fee that can be ticked for payment. The student may also type a smaller amount (partial payment).
import { useId } from 'react';
import Badge from './Badge';
import { formatCurrency, formatDate, humanize } from '../utils/format';

export default function FeeCard({ fee, selected, onToggle, amount, onAmountChange, error }) {
  const id = useId();
  return (
    <div className={`fee-card ${selected ? 'selected' : ''}`}>
      <input type="checkbox" id={id} checked={selected} onChange={() => onToggle(fee.id)} aria-label={`Select ${fee.description || fee.fee_type}`} />
      <div className="grow">
        <label htmlFor={id} className="row" style={{ cursor: 'pointer' }}>
          <strong>{fee.description || humanize(fee.fee_type)}</strong><span className="spacer" /><Badge status={fee.status} />
        </label>
        <div className="counts" style={{ marginTop: 6 }}>
          <span>Total {formatCurrency(fee.amount)}</span><span>Paid {formatCurrency(fee.paid_amount)}</span><span>Due {formatDate(fee.due_date)}</span>
        </div>
        <div style={{ marginTop: 6 }}>Pending: <strong>{formatCurrency(fee.pending_amount)}</strong></div>
        {selected && (
          <div className="amount-input">
            <input type="number" className={`control ${error ? 'invalid' : ''}`} min="0.01" step="0.01" max={fee.pending_amount}
              value={amount} onChange={(e) => onAmountChange(fee.id, e.target.value)} placeholder={`Pay ${fee.pending_amount}`}
              aria-label={`Amount to pay for ${fee.description || fee.fee_type}`} />
            {error ? <span className="field-error">{error}</span> : <span className="field-hint">Leave empty to pay in full</span>}
          </div>
        )}
      </div>
    </div>
  );
}
