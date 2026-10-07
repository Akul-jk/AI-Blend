import { create } from 'zustand';
import type { Alert } from '../types';
export type { Alert } from '../types';

interface AlertState {
  alerts: Alert[];
  addAlert: (alert: Alert) => void;
  resolveAlert: (alertId: number) => void;
  deleteAlert: (alertId: number) => void;
  setAlerts: (alerts: Alert[]) => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  alerts: [],
  addAlert: (alert) => set((state) => {
    // Prevent duplicate alerts
    if (state.alerts.some(a => a.id === alert.id)) return state;
    return { alerts: [alert, ...state.alerts].slice(0, 100) }; // Keep top 100 alerts
  }),
  resolveAlert: (alertId) => set((state) => ({
    alerts: state.alerts.map(a => a.id === alertId ? { ...a, resolved: true } : a)
  })),
  deleteAlert: (alertId) => set((state) => ({ alerts: state.alerts.filter(a => a.id !== alertId) })),
  setAlerts: (alerts) => set({ alerts })
}));
