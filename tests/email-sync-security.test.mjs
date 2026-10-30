import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/email-sync.js';

function response() {
  return {
    headers: {},
    code: 200,
    payload: null,
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.code = code; return this; },
    json(value) { this.payload = value; return this; }
  };
}

test('GET is refused without contacting the mailbox', async () => {
  const res = response();
  await handler({ method: 'GET', headers: {} }, res);
  assert.equal(res.code, 405);
  assert.equal(res.payload.error, 'METHOD_NOT_ALLOWED');
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('unauthenticated POST is refused', async () => {
  const res = response();
  await handler({ method: 'POST', headers: {} }, res);
  assert.equal(res.code, 401);
  assert.equal(res.payload.error, 'UNAUTHORIZED');
});

test('disabled TLS stops IMAP before connection and never leaks internals', async () => {
  const oldFetch = globalThis.fetch;
  const oldPass = process.env.ARTESSENCIA_IMAP_PASSWORD;
  const oldStarttls = process.env.ARTESSENCIA_IMAP_STARTTLS;
  const oldTls = process.env.ARTESSENCIA_IMAP_TLS;
  try {
    globalThis.fetch = async url => ({
      ok: true,
      json: async () => String(url).includes('/auth/v1/user')
        ? { id: 'dummy-owner' } : true
    });
    process.env.ARTESSENCIA_IMAP_PASSWORD = 'dummy-password';
    process.env.ARTESSENCIA_IMAP_STARTTLS = 'false';
    process.env.ARTESSENCIA_IMAP_TLS = 'false';

    const res = response();
    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer dummy-jwt' }
    }, res);
    assert.equal(res.code, 500);
    assert.deepEqual(res.payload, {ok: false, error: 'IMAP_SYNC_FAILED'});
    assert.equal('detail' in res.payload, false);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldPass === undefined) delete process.env.ARTESSENCIA_IMAP_PASSWORD;
    else process.env.ARTESSENCIA_IMAP_PASSWORD = oldPass;
    if (oldStarttls === undefined) delete process.env.ARTESSENCIA_IMAP_STARTTLS;
    else process.env.ARTESSENCIA_IMAP_STARTTLS = oldStarttls;
    if (oldTls === undefined) delete process.env.ARTESSENCIA_IMAP_TLS;
    else process.env.ARTESSENCIA_IMAP_TLS = oldTls;
  }
});
