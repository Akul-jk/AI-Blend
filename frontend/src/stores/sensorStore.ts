import { create } from 'zustand';

export interface Sensor {
  id: string;
  deviceId: string;
  name: string;
  type: string;
  unit: string;
  value: number;
  lastUpdated: string;
}

export interface SensorHistoryPoint {
  id: number;
  sensorId: string;
  value: number;
  timestamp: string;
}

interface SensorState {
  sensors: Sensor[];
  history: Record<string, SensorHistoryPoint[]>;
  socketConnected: boolean;
  setSensors: (sensors: Sensor[]) => void;
  updateSensors: (updatedSensors: Sensor[]) => void;
  setSocketConnected: (connected: boolean) => void;
  setSensorHistory: (sensorId: string, history: SensorHistoryPoint[]) => void;
  addHistoryPoint: (sensorId: string, point: SensorHistoryPoint) => void;
}

export const useSensorStore = create<SensorState>((set) => ({
  sensors: [],
  history: {},
  socketConnected: false,
  setSensors: (sensors) => set({ sensors }),
  updateSensors: (updatedSensors) => set((state) => {
    // Map existing sensors by ID for performance
    const sensorMap = new Map(state.sensors.map(s => [s.id, s]));
    
    updatedSensors.forEach(updated => {
      const existing = sensorMap.get(updated.id);
      if (existing) {
        sensorMap.set(updated.id, { ...existing, ...updated });
      } else {
        sensorMap.set(updated.id, updated);
      }
    });

    return { sensors: Array.from(sensorMap.values()) };
  }),
  setSocketConnected: (socketConnected) => set({ socketConnected }),
  setSensorHistory: (sensorId, sensorHistory) => set((state) => ({
    history: { ...state.history, [sensorId]: sensorHistory }
  })),
  addHistoryPoint: (sensorId, point) => set((state) => {
    const existingHistory = state.history[sensorId] || [];
    const updatedHistory = [...existingHistory, point].slice(-100); // Keep last 100 points
    return {
      history: { ...state.history, [sensorId]: updatedHistory }
    };
  })
}));
