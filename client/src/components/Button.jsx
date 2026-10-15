// <Button variant="primary|secondary|danger|ghost" size="sm" loading icon={<Icon/>}>Save</Button>
// Give it  to="/path"  and it becomes a link that looks like a button.
import { Link } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';

export default function Button({ variant = 'primary', size, block, loading = false, disabled, icon, to, type = 'button', className = '', children, ...rest }) {
  const classes = ['btn', `btn-${variant}`, size === 'sm' ? 'btn-sm' : '', block ? 'btn-block' : '', className].filter(Boolean).join(' ');
  if (to) return <Link to={to} className={classes} {...rest}>{icon}{children}</Link>;
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <LoadingSpinner size="sm" /> : icon}
      {children}
    </button>
  );
}
