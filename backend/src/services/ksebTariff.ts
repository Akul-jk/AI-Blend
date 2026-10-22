export type KsebPhase = 'single' | 'three';

type SourcedSlab = {
  min: number;
  max: number | null;
  rate: number;
  singleFixed: number;
  threeFixed: number;
  telescopic: boolean;
};

// KSERC Order 427/D(T)/2023, LT-I Domestic schedule, rates effective
// 1 April 2025 through 31 March 2027 (monthly consumption).
const SCHEDULE: SourcedSlab[] = [
  { min: 0, max: 50, rate: 3.35, singleFixed: 50, threeFixed: 130, telescopic: true },
  { min: 50, max: 100, rate: 4.25, singleFixed: 85, threeFixed: 175, telescopic: true },
  { min: 100, max: 150, rate: 5.35, singleFixed: 105, threeFixed: 205, telescopic: true },
  { min: 150, max: 200, rate: 7.20, singleFixed: 140, threeFixed: 215, telescopic: true },
  { min: 200, max: 250, rate: 8.50, singleFixed: 160, threeFixed: 235, telescopic: true },
  { min: 250, max: 300, rate: 6.75, singleFixed: 220, threeFixed: 240, telescopic: false },
  { min: 300, max: 350, rate: 7.60, singleFixed: 240, threeFixed: 250, telescopic: false },
  { min: 350, max: 400, rate: 7.95, singleFixed: 260, threeFixed: 260, telescopic: false },
  { min: 400, max: 500, rate: 8.25, singleFixed: 285, threeFixed: 285, telescopic: false },
  { min: 500, max: null, rate: 9.20, singleFixed: 310, threeFixed: 310, telescopic: false },
];

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateSourcedKsebBill(
  units: number,
  options: { phase_type?: KsebPhase; fuel_surcharge_per_unit?: number; meter_rent?: number; green_charge_per_unit?: number } = {},
) {
  if (!Number.isFinite(units) || units < 0) throw new Error('Consumption must be a finite non-negative number');
  const phase = options.phase_type ?? 'single';
  if (phase !== 'single' && phase !== 'three') throw new Error('phase_type must be single or three');
  const fuelRate = options.fuel_surcharge_per_unit ?? 0;
  const meterRent = options.meter_rent ?? 0;
  const greenRate = options.green_charge_per_unit ?? 0;
  if ([fuelRate, meterRent, greenRate].some(value => !Number.isFinite(value) || value < 0)) {
    throw new Error('Additional charge assumptions must be finite and non-negative');
  }

  let energyCharge = 0;
  const breakdown: Array<{ range: string; units: number; rate: number; charge: number }> = [];
  if (units <= 250) {
    let remaining = units;
    for (const slab of SCHEDULE.filter(item => item.telescopic)) {
      const applicable = Math.min(remaining, slab.max! - slab.min);
      if (applicable > 0) {
        const charge = money(applicable * slab.rate);
        energyCharge += charge;
        breakdown.push({ range: `${slab.min}-${slab.max}`, units: applicable, rate: slab.rate, charge });
        remaining -= applicable;
      }
      if (remaining <= 0) break;
    }
  } else {
    const slab = SCHEDULE.find(item => !item.telescopic && units <= (item.max ?? Infinity))!;
    energyCharge = money(units * slab.rate);
    breakdown.push({ range: `${slab.min}-${slab.max ?? '∞'} (rate applies to all units)`, units, rate: slab.rate, charge: energyCharge });
  }

  const fixedSlab = SCHEDULE.find(item => units <= (item.max ?? Infinity))!;
  const fixedCharge = phase === 'three' ? fixedSlab.threeFixed : fixedSlab.singleFixed;
  const duty = money(energyCharge * 0.10);
  const fuelSurcharge = money(units * fuelRate);
  const greenCharge = money(units * greenRate);
  const total = money(energyCharge + fixedCharge + meterRent + duty + fuelSurcharge + greenCharge);

  return {
    profile: 'KSERC LT-I Domestic · sourced estimate',
    source: 'https://dev.erckerala.org/api/storage/orders/o0sDy6ZmrpxIKwgD9dz8lMNuYvVEq11l9P1VcHeP.pdf',
    order: '427/D(T)/2023/KSERC · OP 18/2023',
    effective_period: '2025-04-01 through 2027-03-31',
    consumption: units,
    tariff_mode: units <= 250 ? 'LT_I_TELESCOPIC' : 'LT_I_NON_TELESCOPIC_FLAT',
    phase_type: phase,
    energy_charge: money(energyCharge),
    fuel_surcharge: fuelSurcharge,
    fuel_surcharge_per_unit: fuelRate,
    fixed_charge: fixedCharge,
    meter_rent: meterRent,
    green_tariff: greenCharge,
    electricity_duty: duty,
    duty_rate: 0.10,
    total,
    currency: 'INR',
    slabs_breakdown: breakdown,
    assumptions: [
      'LT-I domestic; rates effective 1 April 2025 through 31 March 2027.',
      'Monthly units above 250 use the applicable non-telescopic rate for all units.',
      'Duty is estimated at 10% of energy charges; consumer-specific concessions are not applied.',
      'Fuel surcharge, meter rent, and green charge default to zero because applicability and current values vary; set them explicitly when known.',
      'Fixed charges use the schedule consumption band and selected connection phase.',
      'Estimate excludes taxes or adjustments not represented by these assumptions and is not an official bill.',
    ],
  };
}
