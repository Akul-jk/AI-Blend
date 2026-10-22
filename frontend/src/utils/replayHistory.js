export function appendReplayReadings(history, readings, limit = 100) {
  const merged = new Map(history.map(reading => [identity(reading), reading]));
  for (const reading of readings) {
    const key = identity(reading);
    if (!merged.has(key)) merged.set(key, reading);
  }
  return [...merged.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(-limit);
}

function identity(reading) {
  const meter = reading.pzem_id ?? `appliance:${reading.appliance_id ?? 'unknown'}`;
  return `${meter}|${reading.timestamp}`;
}
