import { create } from 'zustand';
import type { DataSourceMode, ModelSourceMode, SystemStatus } from '../types';

interface AppState {
  dataSource: DataSourceMode;
  modelSource: ModelSourceMode;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  selectedApplianceId: string | null;
  systemStatus: SystemStatus | null;

  setDataSource: (mode: DataSourceMode) => void;
  setModelSource: (mode: ModelSourceMode) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSelectedAppliance: (id: string | null) => void;
  setSystemStatus: (status: SystemStatus | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  dataSource: 'simulation',
  modelSource: 'simulation',
  sidebarOpen: false,
  sidebarCollapsed: false,
  selectedApplianceId: null,
  systemStatus: null,

  setDataSource: (mode) => set({ dataSource: mode }),
  setModelSource: (mode) => set({ modelSource: mode }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSelectedAppliance: (id) => set({ selectedApplianceId: id }),
  setSystemStatus: (status) => set({ systemStatus: status }),
}));
