// Online Payment in three steps:  1) choose fees   2) payment summary + method   3) confirmation with transaction ID.
// The gateway is a MOCK for development. Card numbers, CVV and PINs are never typed here or sent to our server.
import { useMemo, useState } from 'react';
import { CheckCircle2, CreditCard, Landmark, Receipt as ReceiptIcon, Smartphone } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import FeeCard from '../../components/FeeCard';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import Badge from '../../components/Badge';
import ReceiptModal from '../../components/ReceiptModal';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../hooks/useToast';
import { http } from '../../services/api';
import { formatCurrency, humanize } from '../../utils/format';

const METHODS = [
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'card', label: 'Debit / credit card', icon: CreditCard },
  { value: 'net_banking', label: 'Net banking', icon: Landmark },
];

export default function OnlinePayment() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => http.get('/fees', { limit: 100 }), []);
  const [step, setStep] = useState('select');          // select -> summary -> done
  const [selected, setSelected] = useState({});        // fee id -> amount typed ('' = pay in full)
  const [method, setMethod] = useState('upi');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [result, setResult] = useState(null);
  const [receiptId, setReceiptId] = useState(null);

  const payable = useMemo(() => (data?.items || []).filter((f) => f.pending_amount > 0), [data]);
  const chosen = payable.filter((f) => f.id in selected);
  const amountOf = (f) => (selected[f.id] === '' || selected[f.id] === undefined ? f.pending_amount : Number(selected[f.id]));
  const errors = {};
  chosen.forEach((f) => { const a = amountOf(f); if (!(a > 0) || a > f.pending_amount) errors[f.id] = `Enter between 0.01 and ${f.pending_amount}`; });
  const total = chosen.reduce((sum, f) => sum + (errors[f.id] ? 0 : amountOf(f)), 0);
  const canContinue = chosen.length > 0 && Object.keys(errors).length === 0;

  const toggle = (id) => setSelected((prev) => { const next = { ...prev }; if (id in next) delete next[id]; else next[id] = ''; return next; });
  const setAmount = (id, value) => setSelected((prev) => ({ ...prev, [id]: value }));

  async function pay() {
    setPaying(true);
    setPayError('');
    try {
      const body = await http.post('/payments', {
        items: chosen.map((f) => ({ fee_id: f.id, amount: amountOf(f) })),
        payment_method: method,
        ...(simulateFailure ? { simulate_failure: true } : {}),
      });
      setResult(body.data);
      setStep('done');
      toast.success('Payment successful');
      reload();
    } catch (err) {
      setPayError(err.message);                // e.g. "Payment declined... You were not charged."
      toast.error('Payment failed');
    } finally { setPaying(false); }
  }

  function startOver() { setSelected({}); setResult(null); setPayError(''); setStep('select'); }

  if (loading && !data) return <LoadingSpinner fullPage label="Loading your fees..." />;   // only on the FIRST load, not after a payment
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;

  if (step === 'done' && result) {
    return (
      <>
        <PageHeader title="Payment confirmation" />
        <div className="card"><div className="center-box">
          <div className="big-icon success"><CheckCircle2 size={40} /></div>
          <h2>Payment successful</h2>
          <dl className="kv" style={{ textAlign: 'left' }}>
            <dt>Transaction ID</dt><dd>{result.transaction.transaction_ref}</dd>
            <dt>Amount paid</dt><dd>{formatCurrency(result.transaction.amount)}</dd>
            <dt>Payment method</dt><dd>{humanize(result.transaction.payment_method)}</dd>
            <dt>Status</dt><dd><Badge status={result.transaction.status} /></dd>
            <dt>Receipt number</dt><dd>{result.receipt.receipt_number}</dd>
          </dl>
          <div className="row">
            <Button icon={<ReceiptIcon size={17} />} onClick={() => setReceiptId(result.receipt.id)}>View receipt</Button>
            <Button variant="secondary" to="/fees">Back to fee details</Button>
            <Button variant="ghost" onClick={startOver}>Pay another fee</Button>
          </div>
        </div></div>
        <ReceiptModal receiptId={receiptId} onClose={() => setReceiptId(null)} />
      </>
    );
  }

  if (step === 'summary') {
    return (
      <>
        <PageHeader title="Payment summary" subtitle="Check the details, then pay." />
        <div className="stack" style={{ maxWidth: 760 }}>
          {payError && <Alert type="error" title="Payment failed.">{payError}</Alert>}
          <section className="card">
            <div className="card-header">Fees to pay</div>
            <ul className="list-plain">
              {chosen.map((f) => <li key={f.id}><span>{f.description || humanize(f.fee_type)}</span><strong>{formatCurrency(amountOf(f))}</strong></li>)}
              <li><strong>Total payable</strong><strong style={{ fontSize: '1.2rem' }}>{formatCurrency(total)}</strong></li>
            </ul>
          </section>
          <section className="card card-body stack">
            <strong id="method-label">Payment method</strong>
            <div className="pay-methods" role="radiogroup" aria-labelledby="method-label">
              {METHODS.map(({ value, label, icon: Icon }) => (
                <label key={value} className={`pay-method ${method === value ? 'selected' : ''}`}>
                  <input type="radio" name="method" value={value} checked={method === value} onChange={() => setMethod(value)} className="sr-only" />
                  <Icon size={20} /> {label}
                </label>
              ))}
            </div>
            <Alert type="info">This is a practice payment gateway. You are not asked for card numbers, CVV or PIN, and no real money moves.</Alert>
            {import.meta.env.DEV && (
              <label className="check"><input type="checkbox" checked={simulateFailure} onChange={(e) => setSimulateFailure(e.target.checked)} /> Developer option: simulate a failed payment</label>
            )}
          </section>
          <div className="row">
            <Button variant="secondary" onClick={() => setStep('select')} disabled={paying}>Back</Button>
            <Button loading={paying} icon={<CreditCard size={17} />} onClick={pay}>Pay {formatCurrency(total)}</Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Online Payment" subtitle="Select the fees you want to pay." />
      {payable.length === 0 ? (
        <div className="card"><EmptyState title="Nothing to pay" message="All your fees are paid. Thank you!" action={<Button to="/receipts" variant="secondary">View receipts</Button>} /></div>
      ) : (
        <div className="stack">
          <div className="grid cols-2">
            {payable.map((f) => <FeeCard key={f.id} fee={f} selected={f.id in selected} onToggle={toggle} amount={selected[f.id] ?? ''} onAmountChange={setAmount} error={errors[f.id]} />)}
          </div>
          <div className="card card-body row">
            <span>{chosen.length} fee(s) selected</span><span className="spacer" />
            <strong style={{ fontSize: '1.2rem' }}>Total: {formatCurrency(total)}</strong>
            <Button disabled={!canContinue} onClick={() => setStep('summary')}>Continue</Button>
          </div>
        </div>
      )}
    </>
  );
}
