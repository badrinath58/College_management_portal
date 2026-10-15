// Text field with label, hint and error message. type="password" gets a show/hide eye button.
//   <Input label="Password" type="password" value={v} onChange={...} error={errors.password} required />
import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const Input = forwardRef(function Input({ label, error, hint, type = 'text', required, as = 'input', className = '', ...rest }, ref) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  const Tag = as; // 'input' or 'textarea'
  const control = (
    <Tag
      id={id} ref={ref} required={required}
      type={Tag === 'input' ? (isPassword && visible ? 'text' : type) : undefined}
      className={`control ${error ? 'invalid' : ''} ${className}`}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
      {...rest}
    />
  );
  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}{required && <span className="req" aria-hidden="true">*</span>}</label>}
      {isPassword ? (
        <div className="input-wrap">
          {control}
          <button type="button" className="suffix-btn" onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}>
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      ) : control}
      {error ? <span id={`${id}-err`} className="field-error">{error}</span>
        : hint ? <span id={`${id}-hint`} className="field-hint">{hint}</span> : null}
    </div>
  );
});
export default Input;
