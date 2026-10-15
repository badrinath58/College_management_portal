// Round picture. Shows the protected photo if there is one, otherwise the initials.
import AuthImage from './AuthImage';
import { initials } from '../utils/format';

export default function Avatar({ name, src, size = 40 }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      <AuthImage src={src} alt={name || 'Profile photo'} fallback={initials(name)} />
    </span>
  );
}
