const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRecommendations } = require('../dist/services/recommendations.js');

const now = new Date('2026-10-15T12:00:00.000Z');
const row = (appliance_id, timestamp, energy, extra = {}) => ({
  appliance_id, appliance_name: appliance_id === 1 ? 'Kettle' : 'Fan', category: 'General',
  timestamp, interval_energy_kwh: energy, quality: 'valid', source: 'simulation', power: 100, ...extra,
});

test('recommendations rank only valid readings in the observed 24-hour window', () => {
  const rows = [
    row(1, '2026-10-15T08:00:00.000Z', 0.12),
    row(2, '2026-10-15T08:01:00.000Z', 0.08),
    row(1, '2026-10-15T08:02:00.000Z', 500, { timestamp: '2026-10-12T08:02:00.000Z' }),
    row(2, '2026-10-15T08:03:00.000Z', 4, { quality: 'baseline' }),
  ];
  const result = buildRecommendations(rows, now);
  assert.deepEqual(result.highest_consumers.map(item => item.appliance_id), [1, 2]);
  assert.equal(result.highest_consumers[0].energy_kwh, 0.12);
  assert.equal(result.source, 'simulation');
  assert.equal(result.synthetic, true);
  assert.equal(result.unusual_usage.length, 0);
  assert.match(result.unusual_usage_status, /seven prior UTC days/);
});

test('unusual use requires seven full-coverage baseline days and current coverage', () => {
  const rows = [];
  for (let daysAgo = 7; daysAgo >= 1; daysAgo -= 1) {
    const date = new Date(now.getTime() - daysAgo * 86400000).toISOString().slice(0, 10);
    for (let sample = 0; sample < 12; sample += 1) {
      const at = new Date(`${date}T00:00:00.000Z`).getTime() + sample * (19 * 3600000 / 11);
      rows.push(row(1, new Date(at).toISOString(), 0.1));
    }
  }
  for (let sample = 0; sample < 12; sample += 1) {
    const at = new Date('2026-10-15T00:00:00.000Z').getTime() + sample * (4 * 3600000 / 11);
    rows.push(row(1, new Date(at).toISOString(), 1));
  }
  const result = buildRecommendations(rows, now);
  assert.equal(result.unusual_usage.length, 1);
  assert.equal(result.unusual_usage[0].baseline_days, 7);
  assert.ok(result.unusual_usage[0].ratio > 2);
});
