// Where the login token lives in the browser.
//  "Remember me" ticked  -> localStorage   (survives closing the browser)
//  not ticked            -> sessionStorage (disappears when the tab is closed)
// (Any script on the page could read these, which is why the backend uses short-lived tokens
//  and why we never put third-party scripts on this site.)
const KEY = 'cmp_token';

export const getToken = () => localStorage.getItem(KEY) || sessionStorage.getItem(KEY);

export function saveToken(token, remember) {
  clearToken();
  (remember ? localStorage : sessionStorage).setItem(KEY, token);
}

export function clearToken() {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
}
