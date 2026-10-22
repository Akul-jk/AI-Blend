const test = require('node:test');
const assert = require('node:assert/strict');

test('replay history stays timestamp ordered and ignores duplicate meter timestamps', async () => {
  const { appendReplayReadings } = await import('../src/utils/replayHistory.js');
  const at = (seconds, pzem_id = 'PZEM-001', appliance_id = 1) => ({
    timestamp: `2026-10-15T00:00:${String(seconds).padStart(2, '0')}.000Z`, pzem_id, appliance_id,
  });
  const ordered = appendReplayReadings([at(2)], [at(1), at(2), at(3)]);
  assert.deepEqual(ordered.map(item => item.timestamp.slice(-7, -5)), ['01', '02', '03']);
  assert.equal(appendReplayReadings(ordered, [at(2)]).length, 3);
  assert.equal(appendReplayReadings(ordered, [at(2, 'PZEM-002', 2)]).length, 4);
});

test('replay history keeps only the configured number of newest readings', async () => {
  const { appendReplayReadings } = await import('../src/utils/replayHistory.js');
  const readings = [1, 2, 3].map(second => ({ timestamp: `2026-10-15T00:00:0${second}.000Z`, pzem_id: 'PZEM-001' }));
  assert.deepEqual(appendReplayReadings([], readings, 2).map(item => item.timestamp.slice(-7, -5)), ['02', '03']);
});
