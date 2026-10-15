// Who is logged in? Everything in the app reads this through useAuth().
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService';
import { clearToken, getToken, saveToken } from '../utils/tokenStorage';
import { fileUrl } from '../utils/format';

const AuthContext = createContext(null);

// the API sends photo_path; the components need a ready-to-use photo_url
const withPhotoUrl = (profile) => (profile ? { ...profile, photo_url: fileUrl(profile.photo_path) } : profile);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // { id, username, email, role }
  const [profile, setProfile] = useState(null); // name, department... (depends on role)
  const [loading, setLoading] = useState(Boolean(getToken())); // true while we check a saved token

  // On first load: if a token is saved, ask the server who it belongs to
  useEffect(() => {
    if (!getToken()) return;
    authService.me()
      .then((body) => { setUser(body.data.user); setProfile(withPhotoUrl(body.data.profile)); })
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  // api.js fires this event when the server says the token is expired or invalid
  useEffect(() => {
    const onExpired = (event) => {
      sessionStorage.setItem('cmp_notice', event.detail?.message || 'Your session has expired. Please log in again.');
      setUser(null);
      setProfile(null);
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = useCallback(async ({ username, password, rememberMe }) => {
    const body = await authService.login(username, password, rememberMe);
    saveToken(body.data.token, rememberMe);
    setUser(body.data.user);
    setProfile(withPhotoUrl(body.data.profile));
    return body.data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await authService.logout(); } catch (e) { /* even if the server is unreachable we still log out locally */ }
    clearToken();
    sessionStorage.removeItem('cmp_notice');   // an expired token during logout is not worth a warning
    setUser(null);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({ user, profile, role: user?.role || null, isAuthenticated: Boolean(user), loading, login, logout, setProfile }),
    [user, profile, loading, login, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
