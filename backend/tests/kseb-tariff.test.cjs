const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateSourcedKsebBill } = require('../dist/services/ksebTariff.js');

test('LT-I telescopic slabs use 50-unit widths and the sourced fixed charge', () => {
  const at50 = calculateSourcedKsebBill(50);
  assert.equal(at50.energy_charge, 167.5);
  assert.equal(at50.fixed_charge, 50);
  assert.equal(at50.electricity_duty, 16.75);
  assert.equal(at50.total, 234.25);

  const at51 = calculateSourcedKsebBill(51);
  assert.deepEqual(at51.slabs_breakdown.map(slab => slab.units), [50, 1]);
  assert.equal(at51.energy_charge, 171.75);
  assert.equal(at51.fixed_charge, 85);
});

test('LT-I switches to a whole-consumption non-telescopic rate above 250 units', () => {
  const at250 = calculateSourcedKsebBill(250);
  assert.equal(at250.tariff_mode, 'LT_I_TELESCOPIC');
  assert.equal(at250.energy_charge, 1432.5);

  const at251 = calculateSourcedKsebBill(251);
  assert.equal(at251.tariff_mode, 'LT_I_NON_TELESCOPIC_FLAT');
  assert.equal(at251.energy_charge, 1694.25);
  assert.equal(at251.fixed_charge, 220);
  assert.equal(at251.slabs_breakdown[0].units, 251);
});

test('three-phase fixed charge and explicitly supplied extra charges are transparent', () => {
  const bill = calculateSourcedKsebBill(50, {
    phase_type: 'three', fuel_surcharge_per_unit: 0.1, meter_rent: 6, green_charge_per_unit: 0.77,
  });
  assert.equal(bill.fixed_charge, 130);
  assert.equal(bill.fuel_surcharge, 5);
  assert.equal(bill.meter_rent, 6);
  assert.equal(bill.green_tariff, 38.5);
  assert.equal(bill.electricity_duty, 16.75);
  assert.equal(bill.total, 363.75);
});

test('sourced estimate rounds component amounts to paise', () => {
  const bill = calculateSourcedKsebBill(0.13);
  assert.equal(bill.energy_charge, 0.44);
  assert.equal(bill.electricity_duty, 0.04);
  assert.equal(bill.total, 50.48);
});

test('sourced estimate rejects invalid usage, phase, and additional charge assumptions', () => {
  assert.throws(() => calculateSourcedKsebBill(-1), /non-negative/);
  assert.throws(() => calculateSourcedKsebBill(10, { phase_type: 'unknown' }), /phase_type/);
  assert.throws(() => calculateSourcedKsebBill(10, { meter_rent: -1 }), /non-negative/);
});
