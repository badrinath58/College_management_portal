// <LoadingSpinner />  <LoadingSpinner label="Loading marks..." />  <LoadingSpinner fullPage />
export default function LoadingSpinner({ size = 'md', label, fullPage = false }) {
  const spinner = <span className={`spinner ${size === 'md' ? '' : size}`} role="status" aria-label={label || 'Loading'} />;
  if (size === 'sm' && !label) return spinner;                 // tiny version used inside buttons
  return (
    <div className={`center-box ${fullPage ? 'full' : ''}`}>
      {spinner}
      {label && <p>{label}</p>}
    </div>
  );
}
