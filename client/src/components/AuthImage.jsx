// Uploaded files are protected, so a plain <img src="..."> would be refused (no login token).
// This component downloads the image with the token, then shows it from memory.
import { useEffect, useState } from 'react';
import api from '../services/api';

export default function AuthImage({ src, alt, fallback = null, className }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!src) return undefined;
    let objectUrl = null;
    let cancelled = false;
    // the API path already includes "/api", but the Axios base URL does too, so remove it
    api.get(src.replace(/^\/api/, ''), { responseType: 'blob' })
      .then((res) => { if (!cancelled) { objectUrl = URL.createObjectURL(res.data); setUrl(objectUrl); } })
      .catch(() => { if (!cancelled) setUrl(null); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src]);

  return url ? <img src={url} alt={alt} className={className} /> : <>{fallback}</>;
}
