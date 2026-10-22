import { create } from 'zustand';
import type { TelemetryReading } from '../types';
import { appendReplayReadings } from '../utils/replayHistory.js';

interface ReplayState {
  latest: Record<string, TelemetryReading>;
  history: Record<string, TelemetryReading[]>;
  addReadings: (readings: TelemetryReading[]) => void;
  clear: () => void;
}

export const useReplayStore = create<ReplayState>(set => ({
  latest: {},
  history: {},
  addReadings: readings => set(state => {
    const latest = { ...state.latest };
    const history = { ...state.history };
    readings.forEach(reading => {
      const id = String(reading.appliance_id ?? reading.pzem_id ?? 'unknown');
      const existing = history[id] || [];
      const next = appendReplayReadings(existing, [reading]);
      if (next.length === existing.length) return;
      latest[id] = reading;
      history[id] = next;
    });
    return { latest, history };
  }),
  clear: () => set({ latest: {}, history: {} }),
}));
