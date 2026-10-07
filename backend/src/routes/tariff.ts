import { Router } from 'express';
import { getDb } from '../db';
import { authenticateToken, authorizeRoles } from '../auth';

const router = Router();
const sendSuccess = (res: any, data: any, message = 'Success', status = 200) => res.status(status).json({ success: true, message, data });
const sendError = (res: any, message: string, error: any = {}, status = 500) => res.status(status).json({ success: false, message, error });

// ---- Billing Calculation Engine ----
export async function calculateBill(units: number, db: any, options?: { green_enabled?: boolean; phase_type?: string }): Promise<any> {
  const tariff = await db.get("SELECT * FROM tariffs WHERE name = 'KSEB LT-I Domestic' LIMIT 1");
  if (!tariff) throw new Error('No tariff configuration found');

  const slabs = await db.all("SELECT * FROM tariff_slabs WHERE tariff_id = ? ORDER BY min_units ASC", [tariff.id]);

  let energyCharge = 0;
  const breakdown: any[] = [];
  let tariffMode = 'LT_I_TELESCOPIC';

  if (units <= 250) {
    // TELESCOPIC calculation
    tariffMode = 'LT_I_TELESCOPIC';
    let remaining = units;
    for (const slab of slabs.filter((s: any) => s.is_telescopic === 1)) {
      if (remaining <= 0) break;
      // Slab endpoints are displayed as 0–50, 51–100, etc. Each domestic
      // slab therefore covers 50 units; inclusive integer arithmetic adds one too many.
      const slabSize = slab.max_units - slab.min_units + (slab.min_units === 0 ? 0 : 1);
      const applicableUnits = Math.min(remaining, slabSize);
      const charge = parseFloat((applicableUnits * slab.rate).toFixed(2));
      energyCharge += charge;
      breakdown.push({
        range: `${slab.min_units}-${slab.max_units}`,
        units: applicableUnits,
        rate: slab.rate,
        charge
      });
      remaining -= applicableUnits;
    }
  } else {
    // NON-TELESCOPIC: flat rate × ALL units
    tariffMode = 'NON_TELESCOPIC_FLAT';
    const slab = slabs.find((s: any) =>
      s.is_telescopic === 0 &&
      units >= s.min_units &&
      (s.max_units === null || units <= s.max_units)
    );
    if (slab) {
      energyCharge = parseFloat((units * slab.rate).toFixed(2));
      breakdown.push({
        range: `${slab.min_units}-${slab.max_units === 999999 ? '∞' : slab.max_units}`,
        units,
        rate: slab.rate,
        charge: energyCharge
      });
    }
  }

  const phaseType = options?.phase_type || 'single';
  const fixedCharge = tariff.fixed_charge;
  const meterRent = phaseType === 'three' ? 15 : tariff.meter_rent;
  const fuelSurcharge = parseFloat((units * tariff.fuel_surcharge).toFixed(2));
  const electricityDuty = parseFloat(((energyCharge + fixedCharge) * (tariff.electricity_duty_percent / 100)).toFixed(2));

  // Green tariff (optional)
  const greenEnabled = options?.green_enabled || false;
  const greenCharge = greenEnabled ? parseFloat((units * tariff.green_tariff_optional).toFixed(2)) : 0;

  const total = parseFloat((energyCharge + fixedCharge + meterRent + fuelSurcharge + electricityDuty + greenCharge).toFixed(2));

  return {
    consumption: units,
    tariff_mode: tariffMode,
    phase_type: phaseType,
    energy_charge: energyCharge,
    fuel_surcharge: fuelSurcharge,
    fixed_charge: fixedCharge,
    meter_rent: meterRent,
    green_tariff: greenCharge,
    electricity_duty: electricityDuty,
    total,
    currency: 'INR',
    slabs_breakdown: breakdown,
    tariff_version: tariff.id,
    disclaimer: 'Tariff values are configurable and should be verified against the applicable current KSEB tariff/order before use for actual billing.'
  };
}

// GET /api/v1/tariff - Get active tariff config
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const tariff = await db.get("SELECT * FROM tariffs LIMIT 1");
    const slabs = await db.all("SELECT * FROM tariff_slabs WHERE tariff_id = ? ORDER BY min_units ASC", [tariff.id]);
    sendSuccess(res, { tariff, slabs });
  } catch (error) {
    sendError(res, 'Server error');
  }
});

// PUT /api/v1/tariff/:id - Update tariff configuration
router.put('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  const { fixed_charge, meter_rent, fuel_surcharge, electricity_duty_percent, green_tariff_optional, slabs } = req.body;

  try {
    const db = getDb();

    const numbers = [fixed_charge, meter_rent, fuel_surcharge, electricity_duty_percent, green_tariff_optional ?? 0].map(Number);
    if (numbers.some(value => !Number.isFinite(value) || value < 0)) {
      return sendError(res, 'Negative values are not allowed', {}, 400);
    }
    if (!await db.get('SELECT id FROM tariffs WHERE id = ?', [id])) return sendError(res, 'Tariff not found', {}, 404);
    if (slabs && Array.isArray(slabs)) {
      for (const slab of slabs) {
        const min = Number(slab.min_units), max = slab.max_units == null ? null : Number(slab.max_units), rate = Number(slab.rate);
        if (!Number.isFinite(min) || min < 0 || (max !== null && (!Number.isFinite(max) || max <= min)) || !Number.isFinite(rate) || rate < 0 || ![true, false, 0, 1].includes(slab.is_telescopic)) return sendError(res, 'Invalid slab configuration', {}, 400);
      }
    }
    await db.exec('BEGIN IMMEDIATE');
    try {
      await db.run(`UPDATE tariffs SET fixed_charge = ?, meter_rent = ?, fuel_surcharge = ?, electricity_duty_percent = ?, green_tariff_optional = ? WHERE id = ?`, [...numbers, id]);
      if (Array.isArray(slabs)) {
        await db.run('DELETE FROM tariff_slabs WHERE tariff_id = ?', [id]);
        for (const slab of slabs) await db.run('INSERT INTO tariff_slabs (tariff_id, is_telescopic, min_units, max_units, rate) VALUES (?, ?, ?, ?, ?)', [id, slab.is_telescopic ? 1 : 0, Number(slab.min_units), slab.max_units == null ? null : Number(slab.max_units), Number(slab.rate)]);
      }
      await db.exec('COMMIT');
    } catch (error) { await db.exec('ROLLBACK'); throw error; }
    sendSuccess(res, {}, 'Tariff updated successfully');
  } catch (error) {
    sendError(res, 'Server error');
  }
});

// POST /api/v1/tariff/calculate - Calculate bill for given consumption
router.post('/calculate', authenticateToken, async (req, res) => {
  try {
    const { consumption, green_enabled, phase_type } = req.body;
    if (consumption === undefined || !Number.isFinite(Number(consumption)) || Number(consumption) < 0) {
      return sendError(res, 'Valid consumption value required', {}, 400);
    }
    const db = getDb();
    const result = await calculateBill(parseFloat(consumption), db, { green_enabled, phase_type });
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 'Server error');
  }
});

// GET /api/v1/tariff/preview - Quick preview
router.get('/preview', authenticateToken, async (req, res) => {
  try {
    const consumption = req.query.consumption ? parseFloat(req.query.consumption as string) : 180;
    const greenEnabled = req.query.green_enabled === 'true';
    const phaseType = (req.query.phase_type as string) || 'single';
    const db = getDb();
    const result = await calculateBill(consumption, db, { green_enabled: greenEnabled, phase_type: phaseType });
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 'Server error');
  }
});

export default router;
