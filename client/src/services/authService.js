import { http } from './api';

export const authService = {
  login: (username, password, rememberMe) => http.post('/auth/login', { username, password, rememberMe }),
  logout: () => http.post('/auth/logout'),
  me: () => http.get('/auth/me'),
  changePassword: (current_password, new_password) => http.put('/auth/password', { current_password, new_password }),
};
