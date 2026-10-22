const test = require('node:test');
const assert = require('node:assert/strict');
const { readReplayDataset, ReplayController } = require('../dist/simulation/replay.js');

test('replay reads the canonical dataset in timestamp order without changing its source', () => {
  const rows = readReplayDataset();
  assert.equal(rows.length, 6314);
  assert.deepEqual(new Set(rows.map(row => String(row.appliance_id))).size, 14);
  assert.ok(rows.every(row => row.source === 'replay'));
  for (let i = 1; i < rows.length; i += 1) assert.ok(rows[i - 1].timestamp <= rows[i].timestamp);
  const meterTimestamps = rows.map(row => `${row.pzem_id}:${row.timestamp}`);
  assert.equal(new Set(meterTimestamps).size, meterTimestamps.length);
});

test('replay emits isolated replay events and pause does not ingest or advance records', () => {
  const events = [];
  const controller = new ReplayController({ emit: (name, values) => events.push({ name, values }) });
  const initial = controller.status();
  assert.equal(initial.state, 'idle');
  assert.equal(initial.persistent, false);

  const running = controller.start();
  assert.equal(running.state, 'running');
  assert.equal(events[0].name, 'telemetry:replay');
  assert.equal(events[0].values.length, 14);
  assert.ok(events[0].values.every(reading => reading.source === 'replay'));
  assert.equal(events.some(event => event.name === 'telemetry:update'), false);

  const paused = controller.pause();
  assert.equal(paused.state, 'paused');
  assert.equal(paused.cursor, 14);
});

test('replay supports bounded speed selection and restart', () => {
  const events = [];
  const controller = new ReplayController({ emit: (name, values) => events.push({ name, values }) });
  assert.equal(controller.setSpeed(2).speed, 2);
  assert.throws(() => controller.setSpeed(3), /speed must be one of/);
  const restarted = controller.restart();
  assert.equal(restarted.state, 'running');
  assert.equal(restarted.cursor, 14);
  assert.equal(events[0].name, 'telemetry:replay:reset');
  assert.equal(events[1].name, 'telemetry:replay');
  assert.equal(events[1].values[0].timestamp, readReplayDataset()[0].original_timestamp);
  controller.pause();
});
