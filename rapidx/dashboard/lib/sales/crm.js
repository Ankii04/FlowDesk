'use strict';
function createCrm(env) {
  let accessToken;
  const base = () => {
    const url = new URL(env.FORTIVEX_CRM_URL || 'http://127.0.0.1:3000/api/v1');
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
      throw failure('LeadPulse URL must use HTTPS outside localhost.');
    }
    return url.href.replace(/\/$/, '');
  };
  function failure(message, status = 503, code = 'crm_unavailable') {
    return Object.assign(new Error(message), { status, code });
  }
  async function request(path, options = {}) {
    try {
      const response = await fetch(base() + path, {
        method: options.body ? 'POST' : 'GET',
        headers: { ...(options.token && { Authorization: 'Bearer ' + options.token }), ...(options.body && { 'Content-Type': 'application/json' }) },
        body: options.body && JSON.stringify(options.body), signal: AbortSignal.timeout(6000),
      });
      const data = await response.json().catch(() => ({}));
      return { status: response.status, ok: response.ok, body: data };
    } catch (_) {
      throw failure('LeadPulse is unreachable. Start it and retry.');
    }
  }
  async function call(path, body) {
    if (!env.FORTIVEX_CRM_EMAIL || !env.FORTIVEX_CRM_PASSWORD) throw failure('LeadPulse connector credentials are missing.');
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!accessToken) {
        const auth = await request('/auth/login', { body: { email: env.FORTIVEX_CRM_EMAIL, password: env.FORTIVEX_CRM_PASSWORD } });
        accessToken = auth.body.data?.accessToken;
        if (!auth.ok || !accessToken) throw failure('LeadPulse rejected the demo connector. Check the seed and credentials.');
      }
      const result = await request('/sales-demo' + path, { token: accessToken, body });
      if (result.status === 401) { accessToken = undefined; continue; }
      if (result.ok) return result.body.data;
      if (result.status === 409) throw failure(result.body.message || 'LeadPulse reported a conflict.', 409, result.body.code);
      if (result.status === 404) throw failure('Saved session was not found.', 404, 'not_found');
      throw failure('LeadPulse could not complete the request. Retry after checking its server log.');
    }
    throw failure('LeadPulse authentication expired. Retry the request.');
  }
  return {
    slots: tenantId => call('/slots?tenantId=' + encodeURIComponent(tenantId)),
    finalize: payload => call('/runs', payload),
    read: (id, account, tenantId) => call('/runs/' + encodeURIComponent(id) + '?' + new URLSearchParams({ account, tenantId })),
  };
}
module.exports = { createCrm };
