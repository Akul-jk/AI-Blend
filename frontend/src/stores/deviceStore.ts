import { create } from 'zustand';

export interface Device {
  id: string;
  name: string;
  type: string;
  status: string;
  location: string;
  createdAt: string;
}

interface DeviceState {
  devices: Device[];
  setDevices: (devices: Device[]) => void;
  updateDeviceStatus: (deviceId: string, status: string) => void;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  devices: [],
  setDevices: (devices) => set({ devices }),
  updateDeviceStatus: (deviceId, status) => set((state) => ({
    devices: state.devices.map(d => d.id === deviceId ? { ...d, status } : d)
  }))
}));
