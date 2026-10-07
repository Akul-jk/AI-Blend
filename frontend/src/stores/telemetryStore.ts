import { create } from 'zustand';
import type { TelemetryReading } from '../types';

interface TelemetryState {
  latestReadings: Record<string, TelemetryReading>;
  history: Record<string, TelemetryReading[]>;
  totals: {
    totalPower: number;
    totalEnergyToday: number;
    peakPower: number;
  };
  socketConnected: boolean;

  setLatestReadings: (readings: Record<string, TelemetryReading>) => void;
  addReading: (applianceId: string, reading: TelemetryReading) => void;
  addReadings: (readings: TelemetryReading[]) => void;
  setTotals: (totals: { totalPower: number; totalEnergyToday: number; peakPower: number }) => void;
  setSocketConnected: (connected: boolean) => void;
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  latestReadings: {},
  history: {},
  totals: { totalPower: 0, totalEnergyToday: 0, peakPower: 0 },
  socketConnected: false,

  setLatestReadings: (readings) => set({ latestReadings: readings }),
  addReading: (applianceId, reading) => set((state) => {
    const currentHistory = state.history[applianceId] || [];
    const newHistory = [...currentHistory, reading].slice(-100);
    return {
      latestReadings: { ...state.latestReadings, [applianceId]: reading },
      history: { ...state.history, [applianceId]: newHistory }
    };
  }),
  addReadings: (readings) => set((state) => {
    const newHistory = { ...state.history };
    const newLatest = { ...state.latestReadings };

    readings.forEach(r => {
      const aid = String(r.appliance_id ?? r.pzem_id ?? 'unknown');
      const current = newHistory[aid] || [];
      newHistory[aid] = [...current, r].slice(-100);
      newLatest[aid] = r;
    });

    return {
      latestReadings: newLatest,
      history: newHistory
    };
  }),
  setTotals: (totals) => set({ totals }),
  setSocketConnected: (connected) => set({ socketConnected: connected }),
}));
