// ============================================================
//  KGCE Library — shared.js (Asynchronous API version)
// ============================================================

const API_BASE = window.API_BASE || 'http://localhost:8080';

const FINE_PER_DAY = 5;
const LOAN_DAYS    = 14;

// ----------------------------------------------------------
//  TOKEN STORAGE
// ----------------------------------------------------------
function getToken()          { return localStorage.getItem('kgce_token'); }
function setToken(t)         { localStorage.setItem('kgce_token', t); }
function clearToken()        { localStorage.removeItem('kgce_token'); }

function getCurrentUser()    { return JSON.parse(localStorage.getItem('kgce_user') || 'null'); }
function setCurrentUser(u)   { localStorage.setItem('kgce_user', JSON.stringify(u)); }
function clearCurrentUser()  { localStorage.removeItem('kgce_user'); }

function logoutUser() {
  clearToken();
  clearCurrentUser();
  window.location.href = 'index.html';
}

// ----------------------------------------------------------
//  HTTP HELPERS
// ----------------------------------------------------------
async function apiFetch(path, opts = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  try {
    const res = await fetch(API_BASE + path, { ...opts, headers });
    const data = await res.json();
    if (!data.success) {
      if (data.error === 'Invalid token' || data.error === 'No token provided') {
        clearToken();
        clearCurrentUser();
        window.location.href = 'index.html';
        throw new Error('Session expired. Please log in again.');
      }
      throw new Error(data.error || 'API error');
    }
    return data.data;
  } catch (err) {
    throw err;
  }
}

function apiGet(path)         { return apiFetch(path); }
function apiPost(path, body)  { return apiFetch(path, { method: 'POST',   body: JSON.stringify(body) }); }
function apiPatch(path, body) { return apiFetch(path, { method: 'PATCH',  body: JSON.stringify(body || {}) }); }
function apiDelete(path)      { return apiFetch(path, { method: 'DELETE' }); }

// ----------------------------------------------------------
//  AUTH
// ----------------------------------------------------------
async function loginUserApi(email, password) {
  const res = await apiPost('/api/auth/login', { email, password });
  setToken(res.token);
  setCurrentUser(res.user);
  return res.user;
}

async function registerUserApi(name, email, password, type, dept) {
  return await apiPost('/api/auth/register', { name, email, password, type, dept });
}

async function loginAdminApi(email, password) {
  const res = await apiPost('/api/auth/admin-login', { email, password });
  setToken(res.token);
  setCurrentUser(res.user);
  return res.user;
}

// ----------------------------------------------------------
//  BOOKS
// ----------------------------------------------------------
async function getBooksApi(search = '')    { return await apiGet('/api/books' + (search ? '?search=' + encodeURIComponent(search) : '')); }
async function addBookApi(data)            { return await apiPost('/api/books', data); }
async function deleteBookApi(id)           { return await apiDelete('/api/books/' + id); }
async function getSuggestionsApi(id)      { return await apiGet('/api/books/' + id + '/suggestions'); }

// ----------------------------------------------------------
//  USERS / ISSUES / FINES
// ----------------------------------------------------------
async function getUsersApi(search = '')    { return await apiGet('/api/users' + (search ? '?search=' + encodeURIComponent(search) : '')); }
async function getIssuesApi()              { return await apiGet('/api/issues'); }
async function borrowBookApi(bookId)       { return await apiPost('/api/issues', { bookId }); }
async function returnBookApi(issueId)      { return await apiPatch('/api/issues/' + issueId + '/return'); }
async function calculateFineApi(userId, daysOverdue, year) { return await apiPost('/api/fines/calculate', { userId, daysOverdue, year }); }

// ----------------------------------------------------------
//  UTILITY
// ----------------------------------------------------------
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function dueDateStr(fromDate) {
  const d = new Date(fromDate || new Date());
  d.setDate(d.getDate() + LOAN_DAYS);
  return d.toISOString().split('T')[0];
}

function calculateFineSync(issueDateStr) {
  const issued  = new Date(issueDateStr);
  const due     = new Date(issued);
  due.setDate(due.getDate() + LOAN_DAYS);
  const today   = new Date();
  const overdue = Math.max(0, Math.floor((today - due) / (1000 * 60 * 60 * 24)));
  return overdue * FINE_PER_DAY;
}