// ============================================================
// Simulation Profiles — Per-appliance behavior models
// Time-aware, electrically consistent
// ============================================================

const configuredSeed = Number(process.env.SIMULATION_SEED || 42) >>> 0;
let randomState = configuredSeed || 1;
function simulationRandom(): number {
  randomState ^= randomState << 13;
  randomState ^= randomState >>> 17;
  randomState ^= randomState << 5;
  return (randomState >>> 0) / 0x100000000;
}
export interface SimReading {
  power: number;
  current: number;
  voltage: number;
  power_factor: number;
  frequency: number;
}

export interface ApplianceProfile {
  category: string;
  generateReadings: (appliance: any) => SimReading;
}

function getHour(): number {
  return new Date().getHours();
}

function baseVoltage(): number {
  return 228 + simulationRandom() * 4; // 228-232V typical Indian grid
}

function baseFrequency(): number {
  return 49.95 + simulationRandom() * 0.10; // 49.95-50.05 Hz
}

function noise(amplitude: number): number {
  return (simulationRandom() - 0.5) * amplitude;
}

// Time-of-day probability multiplier
function timeMultiplier(hour: number, peakHours: number[], offHours: number[]): number {
  if (peakHours.includes(hour)) return 0.85 + simulationRandom() * 0.15;
  if (offHours.includes(hour)) return simulationRandom() * 0.15;
  return 0.3 + simulationRandom() * 0.4;
}

export const profiles: Record<string, ApplianceProfile> = {
  'Refrigerator': {
    category: 'Refrigerator',
    generateReadings: (app) => {
      // Compressor cycles: ~30min ON, ~30min OFF
      const cyclePos = (Date.now() / 60000) % 60; // position in ~60min cycle
      const isCompressorOn = cyclePos < 30 + noise(5);
      const ratedPower = app.rated_power || 150;
      const basePower = isCompressorOn ? ratedPower * (0.75 + simulationRandom() * 0.2) : (app.standby_power || 5) + noise(1);
      const power = Math.max(2, basePower);
      const voltage = baseVoltage();
      const pf = isCompressorOn ? 0.80 + simulationRandom() * 0.10 : 0.35 + simulationRandom() * 0.10;
      const current = power / (voltage * pf);
      return { power, current: Math.max(0.01, current), voltage, power_factor: pf, frequency: baseFrequency() };
    }
  },

  'Laptop': {
    category: 'Laptop',
    generateReadings: (app) => {
      const hour = getHour();
      const ratedPower = app.rated_power || 65;
      // Active during daytime (8-23), sleep at night
      const isActive = hour >= 8 && hour <= 23 ? simulationRandom() > 0.2 : simulationRandom() > 0.7;
      const basePower = isActive ? ratedPower * (0.5 + simulationRandom() * 0.4) : (app.standby_power || 2) + noise(0.5);
      const power = Math.max(1, basePower);
      const voltage = baseVoltage();
      const pf = 0.92 + simulationRandom() * 0.06;
      const current = power / (voltage * pf);
      return { power, current: Math.max(0.005, current), voltage, power_factor: pf, frequency: baseFrequency() };
    }
  },

  'Fan': {
    category: 'Fan',
    generateReadings: (app) => {
      const hour = getHour();
      const ratedPower = app.rated_power || 75;
      // Fans run more during afternoon/evening
      const prob = timeMultiplier(hour, [10,11,12,13,14,15,16,17,18,19,20,21], [0,1,2,3,4,5]);
      const isOn = simulationRandom() < prob;
      const power = isOn ? ratedPower * (0.6 + simulationRandom() * 0.35) + noise(2) : 0;
      const voltage = baseVoltage();
      const pf = isOn ? 0.85 + simulationRandom() * 0.10 : 0;
      const current = isOn && pf > 0 ? Math.max(0, power / (voltage * pf)) : 0;
      return { power: Math.max(0, power), current, voltage, power_factor: pf, frequency: baseFrequency() };
    }
  },

  'Lighting': {
    category: 'Lighting',
    generateReadings: (app) => {
      const hour = getHour();
      const ratedPower = app.rated_power || 100;
      // Strong evening/night correlation
      const prob = timeMultiplier(hour, [18,19,20,21,22,23], [6,7,8,9,10,11,12,13]);
      const isOn = simulationRandom() < prob;
      const power = isOn ? ratedPower * (0.7 + simulationRandom() * 0.3) + noise(1) : 0;
      const voltage = baseVoltage();
      const pf = isOn ? 0.95 + simulationRandom() * 0.04 : 0;
      const current = isOn && pf > 0 ? Math.max(0, power / (voltage * pf)) : 0;
      return { power: Math.max(0, power), current, voltage, power_factor: pf, frequency: baseFrequency() };
    }
  },

  'TV': {
    category: 'TV',
    generateReadings: (app) => {
      const hour = getHour();
      const ratedPower = app.rated_power || 120;
      // Evening entertainment
      const prob = timeMultiplier(hour, [18,19,20,21,22,23], [0,1,2,3,4,5,6,7,8]);
      const isOn = simulationRandom() < prob;
      const standby = app.standby_power || 1;
      const power = isOn ? ratedPower * (0.6 + simulationRandom() * 0.35) + noise(3) : standby + noise(0.3);
      const voltage = baseVoltage();
      const pf = isOn ? 0.88 + simulationRandom() * 0.08 : 0.3;
      const current = Math.max(0.005, power / (voltage * pf));
      return { power: Math.max(0.5, power), current, voltage, power_factor: pf, frequency: baseFrequency() };
    }
  },

  'Phone Charger': {
    category: 'Phone Charger',
    generateReadings: (app) => {
      const hour = getHour();
      const ratedPower = app.rated_power || 18;
      // Charging mostly evening/night
      const prob = timeMultiplier(hour, [20,21,22,23,0,1], [8,9,10,11,12,13,14]);
      const isCharging = simulationRandom() < prob;
      const standby = 0.5;
      const power = isCharging ? ratedPower * (0.5 + simulationRandom() * 0.5) + noise(0.5) : standby + noise(0.1);
      const voltage = baseVoltage();
      const pf = isCharging ? 0.90 + simulationRandom() * 0.08 : 0.15;
      const current = Math.max(0.001, power / (voltage * pf));
      return { power: Math.max(0.1, power), current, voltage, power_factor: pf, frequency: baseFrequency() };
    }
  },

  'Mixer Grinder': {
    category: 'Mixer Grinder',
    generateReadings: (app) => {
      const hour = getHour();
      const ratedPower = app.rated_power || 750;
      // Meal times only
      const isMealTime = [7,8,12,13,18,19].includes(hour);
      const isOn = isMealTime && simulationRandom() > 0.7;
      const power = isOn ? ratedPower * (0.6 + simulationRandom() * 0.4) + noise(20) : 0;
      const voltage = baseVoltage();
      const pf = isOn ? 0.75 + simulationRandom() * 0.10 : 0;
      const current = isOn && pf > 0 ? power / (voltage * pf) : 0;
      return { power: Math.max(0, power), current: Math.max(0, current), voltage, power_factor: pf, frequency: baseFrequency() };
    }
  },

  'Iron Box': {
    category: 'Iron Box',
    generateReadings: (app) => {
      const hour = getHour();
      const ratedPower = app.rated_power || 1500;
      // Morning/evening ironing
      const isIroningTime = [7,8,9,17,18].includes(hour);
      const isOn = isIroningTime && simulationRandom() > 0.75;
      // Thermostat cycling
      const isCycleHigh = isOn && simulationRandom() > 0.3;
      const power = isCycleHigh ? ratedPower * (0.8 + simulationRandom() * 0.2) : isOn ? ratedPower * 0.1 : 0;
      const voltage = baseVoltage();
      const pf = isOn ? 0.95 + simulationRandom() * 0.04 : 0;
      const current = isOn && pf > 0 ? power / (voltage * pf) : 0;
      return { power: Math.max(0, power), current: Math.max(0, current), voltage, power_factor: pf, frequency: baseFrequency() };
    }
  },

  'Kettle': {
    category: 'Kettle',
    generateReadings: (app) => {
      const hour = getHour();
      const ratedPower = app.rated_power || 1800;
      // Morning/afternoon tea times
      const isTeaTime = [6,7,8,15,16,21].includes(hour);
      const isOn = isTeaTime && simulationRandom() > 0.85;
      const power = isOn ? ratedPower * (0.9 + simulationRandom() * 0.1) + noise(10) : 0;
      const voltage = baseVoltage();
      const pf = isOn ? 0.98 + simulationRandom() * 0.02 : 0;
      const current = isOn && pf > 0 ? power / (voltage * pf) : 0;
      return { power: Math.max(0, power), current: Math.max(0, current), voltage, power_factor: pf, frequency: baseFrequency() };
    }
  },

  'Washing Machine': {
    category: 'Washing Machine',
    generateReadings: (app) => {
      const hour = getHour();
      const ratedPower = app.rated_power || 500;
      // Morning wash cycles
      const isWashTime = [8,9,10].includes(hour);
      const isOn = isWashTime && simulationRandom() > 0.7;
      // Multi-phase: wash(low) -> agitate(high) -> rinse(medium) -> spin(high)
      const phase = simulationRandom();
      const power = isOn ? (phase < 0.3 ? ratedPower * 0.3 : phase < 0.6 ? ratedPower * 0.7 : ratedPower * (0.8 + simulationRandom() * 0.2)) + noise(15) : 0;
      const voltage = baseVoltage();
      const pf = isOn ? 0.70 + simulationRandom() * 0.15 : 0;
      const current = isOn && pf > 0 ? power / (voltage * pf) : 0;
      return { power: Math.max(0, power), current: Math.max(0, current), voltage, power_factor: pf, frequency: baseFrequency() };
    }
  },

  'AC': {
    category: 'AC',
    generateReadings: (app) => {
      const hour = getHour();
      const ratedPower = app.rated_power || 1500;
      // Afternoon and night
      const prob = timeMultiplier(hour, [12,13,14,15,22,23,0,1,2], [5,6,7,8]);
      const isOn = simulationRandom() < prob;
      // Compressor cycling
      const isCompressorOn = isOn && simulationRandom() > 0.25;
      const power = isCompressorOn ? ratedPower * (0.6 + simulationRandom() * 0.4) + noise(30) : isOn ? ratedPower * 0.15 + noise(5) : 0;
      const voltage = baseVoltage();
      const pf = isOn ? 0.80 + simulationRandom() * 0.10 : 0;
      const current = isOn && pf > 0 ? power / (voltage * pf) : 0;
      return { power: Math.max(0, power), current: Math.max(0, current), voltage, power_factor: pf, frequency: baseFrequency() };
    }
  },

  'Water Heater': {
    category: 'Water Heater',
    generateReadings: (app) => {
      const hour = getHour();
      const ratedPower = app.rated_power || 2000;
      // Morning bath
      const isHeatingTime = [5,6,7].includes(hour);
      const isOn = isHeatingTime && simulationRandom() > 0.6;
      const power = isOn ? ratedPower * (0.85 + simulationRandom() * 0.15) + noise(15) : 0;
      const voltage = baseVoltage();
      const pf = isOn ? 0.97 + simulationRandom() * 0.03 : 0;
      const current = isOn && pf > 0 ? power / (voltage * pf) : 0;
      return { power: Math.max(0, power), current: Math.max(0, current), voltage, power_factor: pf, frequency: baseFrequency() };
    }
  },

  'Microwave': {
    category: 'Microwave',
    generateReadings: (app) => {
      const hour = getHour();
      const ratedPower = app.rated_power || 1000;
      // Meal times
      const isMealTime = [7,8,12,13,19,20].includes(hour);
      const isOn = isMealTime && simulationRandom() > 0.85;
      const power = isOn ? ratedPower * (0.7 + simulationRandom() * 0.3) + noise(10) : 0;
      const voltage = baseVoltage();
      const pf = isOn ? 0.90 + simulationRandom() * 0.08 : 0;
      const current = isOn && pf > 0 ? power / (voltage * pf) : 0;
      return { power: Math.max(0, power), current: Math.max(0, current), voltage, power_factor: pf, frequency: baseFrequency() };
    }
  },

  'Default': {
    category: 'Default',
    generateReadings: (app) => {
      const ratedPower = app.rated_power || 100;
      const isOn = simulationRandom() > 0.4;
      const power = isOn ? ratedPower * (0.5 + simulationRandom() * 0.5) + noise(5) : 0;
      const voltage = baseVoltage();
      const pf = isOn ? 0.85 + simulationRandom() * 0.10 : 0;
      const current = isOn && pf > 0 ? power / (voltage * pf) : 0;
      return { power: Math.max(0, power), current: Math.max(0, current), voltage, power_factor: pf, frequency: baseFrequency() };
    }
  }
};
