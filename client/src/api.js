export class ApiError extends Error {
  constructor(status, body) {
    const e = body?.error || {};
    super(e.message || 'Request failed');
    this.status = status;
    this.code = e.code || 'UNKNOWN';
    this.fields = e.fields || {};
    this.details = e.details || null;
  }
  get isConflict() { return this.status === 409; }
}

async function request(method, path, body, headers = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method, credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'halyard', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, { error: { code: 'NETWORK', message: 'Cannot reach the server. Check your connection and retry.' } });
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

const qs = (o) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => v !== '' && v != null && p.set(k, v));
  return p.toString();
};

export const api = {
  me: () => request('GET', '/auth/me'),
  login: (b) => request('POST', '/auth/login', b),
  register: (b) => request('POST', '/auth/register', b),
  logout: () => request('POST', '/auth/logout'),
  teams: () => request('GET', '/teams'),
  createTeam: (b) => request('POST', '/teams', b),
  addMember: (id, b) => request('POST', `/teams/${id}/members`, b),
  members: (id) => request('GET', `/teams/${id}/members`),
  stats: () => request('GET', '/work-items/stats'),
  list: (params) => request('GET', `/work-items?${qs(params)}`),
  get: (id) => request('GET', `/work-items/${id}`),
  create: (b, key) => request('POST', '/work-items', b, { 'Idempotency-Key': key }),
  update: (id, b) => request('PATCH', `/work-items/${id}`, b),
  claim: (id) => request('POST', `/work-items/${id}/claim`),
  assign: (id, b) => request('POST', `/work-items/${id}/assign`, b),
  setStatus: (id, b) => request('PATCH', `/work-items/${id}/status`, b),
  comments: (id, page = 1) => request('GET', `/work-items/${id}/comments?page=${page}`),
  addComment: (id, body) => request('POST', `/work-items/${id}/comments`, { body }),
  activity: (id, page = 1) => request('GET', `/work-items/${id}/activity?page=${page}`),
};
