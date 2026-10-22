const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'simulation-test-secret-12345678901234567890';
const { createSimulationRouter } = require('../dist/routes/simulation.js');

const app = express();
app.use(express.json());
app.use('/api/v1/simulation', createSimulationRouter({ emit: () => {} }));
let server;
let baseUrl;
test.before(async () => {
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/simulation/replay`;
});
test.after(async () => new Promise(resolve => server.close(resolve)));

test('replay metadata and controls reject unauthenticated requests', async () => {
  for (const [url, method] of [[baseUrl, 'GET'], [`${baseUrl}/start`, 'POST'], [`${baseUrl}/pause`, 'POST'], [`${baseUrl}/resume`, 'POST'], [`${baseUrl}/restart`, 'POST'], [`${baseUrl}/speed`, 'PUT']]) {
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'PUT' ? JSON.stringify({ speed: 2 }) : undefined });
    assert.equal(response.status, 401, `${method} ${url}`);
  }
});
