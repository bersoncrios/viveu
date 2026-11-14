import test from 'node:test';
import assert from 'node:assert/strict';
import pitch from '../api/pitch.mjs';

async function request(credentials, method = 'GET') {
  const headers = {};
  const response = {
    headers,
    setHeader(name, value) { headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    end(body = '') { this.body = body; return this; }
  };
  await pitch({ method, headers: credentials ? { authorization: `Basic ${Buffer.from(credentials).toString('base64')}` } : {} }, response);
  return response;
}

test('pitch denies missing or invalid credentials without exposing slides', async () => {
  for (const credentials of [undefined, 'admin:errada', 'outro:camilla']) {
    const response = await request(credentials);
    assert.equal(response.statusCode, 401);
    assert.match(response.headers['WWW-Authenticate'], /^Basic /);
    assert.doesNotMatch(response.body, /class="slide/);
    assert.equal(response.headers['Cache-Control'], 'private, no-store');
  }
});

test('pitch serves the complete presentation only to admin with the correct password', async () => {
  const response = await request(`admin:${process.env.PITCH_PASSWORD || 'camilla'}`);
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /Pitch de investimento do Viveu/);
  assert.match(response.body, /data-number="12 \/ 12"/);
  const head = await request(`admin:${process.env.PITCH_PASSWORD || 'camilla'}`, 'HEAD');
  assert.equal(head.statusCode, 200);
  assert.equal(head.body, '');
});

test('pitch rejects unsupported methods', async () => {
  assert.equal((await request(undefined, 'POST')).statusCode, 405);
});
