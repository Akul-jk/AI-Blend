export interface RecommendationReading {
  appliance_id: number;
  appliance_name: string;
  category: string;
  timestamp: string;
  interval_energy_kwh: number | null;
  quality: string;
  source: string;
  power: number;
}

export interface ApplianceRecommendation {
  appliance_id: number;
  appliance_name: string;
  category: string;
  energy_kwh: number;
  valid_readings: number;
  observed_from: string | null;
  observed_to: string | null;
  average_power_w: number | null;
  source: 'simulation' | 'hardware' | 'mixed' | 'unknown';
  actions: string[];
}

export interface UnusualUsageRecommendation {
  appliance_id: number;
  appliance_name: string;
  observed_kwh_per_hour: number;
  baseline_kwh_per_hour: number;
  ratio: number;
  baseline_days: number;
}

const actionsFor = (name: string, category: string): string[] => {
  const label = `${name} ${category}`.toLowerCase();
  if (/air.?condition|\bac\b/.test(label)) return ['Clean the filter and seal obvious room air leaks; keep the setpoint comfortable rather than unusually low.'];
  if (/refrigerat|freezer/.test(label)) return ['Check the door seal, keep vents clear, and avoid repeated door opening.'];
  if (/water heater|geyser|heater/.test(label)) return ['Heat only the water needed and switch the heater off after use.'];
  if (/washing|washer|laundry/.test(label)) return ['Prefer full loads and a lower-temperature cycle when suitable for the fabric.'];
  if (/kettle/.test(label)) return ['Boil only the amount of water needed and descale the kettle when required.'];
  if (/light|lamp/.test(label)) return ['Turn lights off in empty rooms and use efficient lamps when replacement is due.'];
  if (/tv|television|computer|laptop|charger|electronics/.test(label)) return ['Switch the device off when unused; avoid leaving chargers and peripherals energized unnecessarily.'];
  return ['Review when this appliance is used and switch it off when the task is complete; check its manual before changing operating settings.'];
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const bounds = (timestamps: number[]) => timestamps.reduce((range, value) => ({ min: Math.min(range.min, value), max: Math.max(range.max, value) }), { min: Infinity, max: -Infinity });

const coversMostOfUtcDay = (timestamps: number[]): boolean => {
  const range = bounds(timestamps);
  if (timestamps.length < 12 || range.max - range.min < 18 * 60 * 60 * 1000) return false;
  const sixHourBuckets = new Set(timestamps.map(timestamp => new Date(timestamp).getUTCHours() >= 18 ? 3 : Math.floor(new Date(timestamp).getUTCHours() / 6)));
  return sixHourBuckets.size === 4;
};

export function buildRecommendations(readings: RecommendationReading[], now = new Date()): {
  window_hours: 24;
  observed_from: string | null;
  observed_to: string | null;
  source: 'simulation' | 'hardware' | 'mixed' | 'unknown';
  synthetic: boolean;
  highest_consumers: ApplianceRecommendation[];
  unusual_usage: UnusualUsageRecommendation[];
  unusual_usage_status: string;
} {
  const valid = readings.filter(row => row.quality === 'valid'
    && Number.isFinite(row.interval_energy_kwh) && (row.interval_energy_kwh ?? 0) >= 0
    && Number.isFinite(Date.parse(row.timestamp)));
  const from = valid.length ? valid.reduce((a, b) => a.timestamp < b.timestamp ? a : b).timestamp : null;
  const to = valid.length ? valid.reduce((a, b) => a.timestamp > b.timestamp ? a : b).timestamp : null;
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const covered = valid.filter(row => Date.parse(row.timestamp) >= windowStart.getTime() && Date.parse(row.timestamp) <= now.getTime());
  const sources = new Set(covered.map(row => row.source));
  const source = sources.size === 1 && (sources.has('simulation') || sources.has('hardware'))
    ? [...sources][0] as 'simulation' | 'hardware' : sources.size > 1 ? 'mixed' : 'unknown';
  const grouped = new Map<number, RecommendationReading[]>();
  for (const row of covered) {
    const applianceRows = grouped.get(row.appliance_id) || [];
    applianceRows.push(row);
    grouped.set(row.appliance_id, applianceRows);
  }
  const highestConsumers: ApplianceRecommendation[] = [...grouped.entries()].map(([id, rows]): ApplianceRecommendation => ({
    appliance_id: id,
    appliance_name: rows[0].appliance_name,
    category: rows[0].category,
    energy_kwh: rows.reduce((sum, row) => sum + (row.interval_energy_kwh || 0), 0),
    valid_readings: rows.length,
    observed_from: rows.reduce((a, b) => a.timestamp < b.timestamp ? a : b).timestamp,
    observed_to: rows.reduce((a, b) => a.timestamp > b.timestamp ? a : b).timestamp,
    average_power_w: rows.length ? rows.reduce((sum, row) => sum + row.power, 0) / rows.length : null,
    source: (new Set(rows.map(row => row.source)).size > 1 ? 'mixed' : rows[0].source === 'simulation' || rows[0].source === 'hardware' ? rows[0].source : 'unknown') as ApplianceRecommendation['source'],
    actions: actionsFor(rows[0].appliance_name, rows[0].category),
  })).sort((a, b) => b.energy_kwh - a.energy_kwh || a.appliance_id - b.appliance_id).slice(0, 5);

  // A valid daily baseline needs seven prior UTC dates with >=18 hours of
  // observed coverage; short demo sessions must not be presented as anomalies.
  const daily = new Map<number, Map<string, { energy: number; timestamps: number[]; sources: Set<string> }>>();
  for (const row of valid) {
    const byDate = daily.get(row.appliance_id) || new Map();
    const date = new Date(row.timestamp).toISOString().slice(0, 10);
    const day = byDate.get(date) || { energy: 0, timestamps: [], sources: new Set<string>() };
    day.energy += row.interval_energy_kwh || 0;
    day.timestamps.push(Date.parse(row.timestamp));
    day.sources.add(row.source);
    byDate.set(date, day);
    daily.set(row.appliance_id, byDate);
  }
  const today = now.toISOString().slice(0, 10);
  const unusualUsage: UnusualUsageRecommendation[] = [];
  for (const [id, days] of daily) {
    const current = days.get(today);
    const currentSource = current?.sources.size === 1 ? [...current.sources][0] : null;
    if (!current || !currentSource) continue;
    const priorRates = [...days.entries()].filter(([date, day]) => date < today && day.sources.size === 1
      && day.sources.has(currentSource) && coversMostOfUtcDay(day.timestamps))
      .slice(-7).map(([, day]) => day.energy / 24);
    if (priorRates.length < 7 || current.timestamps.length < 12) continue;
    const currentRange = bounds(current.timestamps);
    if (currentRange.max - currentRange.min < 4 * 60 * 60 * 1000) continue;
    const baseline = median(priorRates);
    const observed = current.energy / ((currentRange.max - currentRange.min) / 3600000);
    if (baseline > 0 && observed >= baseline * 2) {
      const row = grouped.get(id)?.[0];
      if (row) unusualUsage.push({ appliance_id: id, appliance_name: row.appliance_name, observed_kwh_per_hour: observed, baseline_kwh_per_hour: baseline, ratio: observed / baseline, baseline_days: priorRates.length });
    }
  }

  const coverageFrom = covered.length ? covered.reduce((a, b) => a.timestamp < b.timestamp ? a : b).timestamp : null;
  const coverageTo = covered.length ? covered.reduce((a, b) => a.timestamp > b.timestamp ? a : b).timestamp : null;
  const coveredIds = new Set(covered.map(row => row.appliance_id));
  return {
    window_hours: 24,
    observed_from: coverageFrom,
    observed_to: coverageTo,
    source,
    synthetic: source === 'simulation' || covered.some(row => row.source === 'simulation'),
    highest_consumers: highestConsumers.filter(item => coveredIds.has(item.appliance_id)),
    unusual_usage: unusualUsage.sort((a, b) => b.ratio - a.ratio),
    unusual_usage_status: unusualUsage.length ? 'A sustained baseline and current-day coverage support these comparisons.' : 'No unusual-usage finding: at least seven prior UTC days with 18-hour coverage each and four current-day hours are required.',
  };
}
