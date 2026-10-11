const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'model-management-test-secret-1234567890';
process.env.ML_INTERNAL_TOKEN = 'internal-test-token-12345678901234567890';
process.env.ML_SERVICE_URL = 'http://127.0.0.1:1';

const { default: mlRoutes } = require('../dist/routes/ml.js');
const { generateToken } = require('../dist/auth.js');
const serverApp = express();
serverApp.use(express.json());
serverApp.use('/api/v1/ml', mlRoutes);

let server;
let baseUrl;
test.before(async () => {
  await new Promise(resolve => { server = serverApp.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/ml/model-management`;
});
test.after(async () => new Promise(resolve => server.close(resolve)));

const auth = role => `Bearer ${generateToken({ id: 4, username: role, email: `${role}@test.local`, role })}`;

test('model management rejects missing authentication', async () => {
  const response = await fetch(`${baseUrl}/models`);
  assert.equal(response.status, 401);
});

test('model management rejects authenticated non-admin users', async () => {
  const response = await fetch(`${baseUrl}/models`, { headers: { Authorization: auth('user') } });
  assert.equal(response.status, 403);
});

test('admin requests are proxied through Express and never expose ML service directly', async () => {
  const response = await fetch(`${baseUrl}/models`, { headers: { Authorization: auth('admin') } });
  assert.equal(response.status, 503);
  const result = await response.json();
  assert.match(result.message, /unavailable/i);
});

test('package upload rejects unsupported content types', async () => {
  const response = await fetch(`${baseUrl}/models/validate`, {
    method: 'POST', headers: { Authorization: auth('admin'), 'Content-Type': 'text/plain' }, body: 'not a package',
  });
  assert.equal(response.status, 415);
});

test('unauthorized upload is rejected before the upload parser runs', async () => {
  const response = await fetch(`${baseUrl}/models/stage`, {
    method: 'POST', headers: { 'Content-Type': 'application/zip' }, body: 'untrusted bytes',
  });
  assert.equal(response.status, 401);
});
