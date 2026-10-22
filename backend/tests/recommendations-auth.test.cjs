const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { default: recommendationsRoute } = require('../dist/routes/recommendations.js');
const app = express();
app.use('/api/v1/recommendations', recommendationsRoute);
let server;
let url;

test.before(async () => {
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  url = `http://127.0.0.1:${server.address().port}/api/v1/recommendations`;
});
test.after(async () => new Promise(resolve => server.close(resolve)));

test('recommendation history requires authentication', async () => {
  const response = await fetch(url);
  assert.equal(response.status, 401);
});
