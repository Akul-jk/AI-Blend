import { create } from 'zustand';

export interface Alert {
  id: number;
  sensorId: string;
  deviceId: string;
  type: string;
  severity: 'warning' | 'critical';
  message: string;
  timestamp: string;
  resolved: number; // 0 or 1
}

interface AlertState {
  alerts: Alert[];
  addAlert: (alert: Alert) => void;
  resolveAlert: (alertId: number) => void;
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
    alerts: state.alerts.map(a => a.id === alertId ? { ...a, resolved: 1 } : a)
  })),
  setAlerts: (alerts) => set({ alerts })
}));
