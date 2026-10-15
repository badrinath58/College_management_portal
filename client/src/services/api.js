// The ONE Axios instance used by the whole app.
//  - adds the login token to every request
//  - turns every failure into a friendly message (invalid login, expired token, network down...)
//  - tells the app when the session has expired
import axios from 'axios';
import { getToken, clearToken } from '../utils/tokenStorage';

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status; // 0 = no answer from the server (network problem)
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // 1. server did not answer at all
    if (!error.response) {
      const message = error.code === 'ECONNABORTED'
        ? 'The server took too long to respond. Please try again.'
        : 'Cannot reach the server. Check your internet connection and that the backend is running.';
      return Promise.reject(new ApiError(message, 0));
    }
    const { status, data } = error.response;
    const url = error.config?.url || '';
    // 2. expired or invalid token (but a wrong password on the login form is NOT a session problem)
    if (status === 401 && !url.includes('/auth/login')) {
      clearToken();
      window.dispatchEvent(new CustomEvent('auth:expired', { detail: { message: data?.message } }));
    }
    // a failed file download arrives as a Blob that contains the JSON error, so read it
    let body = data;
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      try { body = JSON.parse(await data.text()); } catch (e) { body = null; }
    }
    const message = body && typeof body.message === 'string' ? body.message : 'Something went wrong. Please try again.';
    return Promise.reject(new ApiError(message, status));
  }
);

// Small helpers. Each returns the whole body: { success, message, data }
export const http = {
  get: (url, params) => api.get(url, { params }).then((r) => r.data),
  post: (url, body) => api.post(url, body).then((r) => r.data),
  put: (url, body) => api.put(url, body).then((r) => r.data),
  delete: (url) => api.delete(url).then((r) => r.data),
};

export default api;
