// Parkly UI (demo) — vanilla JS, chạy trực tiếp (không build)

const LS_TOKEN = 'parkly_demo_token';
const LS_ROLE = 'parkly_demo_role';

export function getToken() {
  return localStorage.getItem(LS_TOKEN) || '';
}

export function setToken(token) {
  localStorage.setItem(LS_TOKEN, token || '');
}

export function getRole() {
  return localStorage.getItem(LS_ROLE) || 'ADMIN';
}

export function setRole(role) {
  localStorage.setItem(LS_ROLE, role || 'ADMIN');
}

export function baseApi(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `/api${p}`;
}

export async function apiFetch(path, opts = {}) {
  const headers = new Headers(opts.headers || {});
  const t = getToken();
  if (t) headers.set('Authorization', `Bearer ${t}`);
  if (!(opts.body instanceof FormData) && opts.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(baseApi(path), { ...opts, headers });
  const ct = res.headers.get('content-type') || '';
  const isJson = ct.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => '');
  if (!res.ok) {
    const msg = payload?.error?.message || payload?.message || res.statusText;
    const details = payload?.error?.details || payload?.details;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = payload;
    err.details = details;
    throw err;
  }

  // Standard envelope: { requestId, data }
  return payload?.data ?? payload;
}

export function sseUrl(path, params = {}) {
  const u = new URL(baseApi(path), window.location.origin);
  const t = getToken();
  if (t) u.searchParams.set('token', t);
  for (const [k, v] of Object.entries(params || {})) {
    if (v == null || v === '') continue;
    u.searchParams.set(k, String(v));
  }
  return u.toString();
}

export function uuid() {
  // RFC4122-ish đủ dùng cho idempotency demo
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function $(id) {
  return document.getElementById(id);
}

export function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

export function appendLog(id, line) {
  const el = $(id);
  if (!el) return;
  el.textContent += (el.textContent ? '\n' : '') + line;
  el.scrollTop = el.scrollHeight;
}

export function fmtJson(x) {
  try {
    return JSON.stringify(x, null, 2);
  } catch {
    return String(x);
  }
}

export function bindAuthBar() {
  const tokenEl = document.getElementById('demoToken');
  const roleEl = document.getElementById('demoRole');
  const saveBtn = document.getElementById('saveAuth');
  const clearBtn = document.getElementById('clearAuth');

  if (tokenEl) tokenEl.value = getToken();
  if (roleEl) roleEl.value = getRole();

  saveBtn?.addEventListener('click', () => {
    setToken(tokenEl?.value || '');
    setRole(roleEl?.value || 'ADMIN');
    location.reload();
  });

  clearBtn?.addEventListener('click', () => {
    setToken('');
    setRole('ADMIN');
    location.reload();
  });
}
