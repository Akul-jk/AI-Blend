import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Background from './Background';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAppStore } from '../../stores/appStore';
import { socketService } from '../../services/socket';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useAlertStore } from '../../stores/alertStore';
import type { TelemetryReading } from '../../types';

const AppShell: React.FC = () => {
  const { sidebarCollapsed } = useAppStore();
  const { setLatestReadings, addReadings, setSocketConnected } = useTelemetryStore();
  const addAlert = useAlertStore(state => state.addAlert);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    socketService.connect();
    const offStatus = socketService.onStatusChange(setSocketConnected);
    const offInit = socketService.on('telemetry:init', (payload: { latestTelemetry?: TelemetryReading[] }) => {
      const readings = payload?.latestTelemetry || [];
      const map = Object.fromEntries(readings.map(r => [String(r.appliance_id ?? r.pzem_id), r]));
      setLatestReadings(map);
      addReadings(readings);
    });
    const offUpdate = socketService.on('telemetry:update', (readings: TelemetryReading[]) => {
      if (Array.isArray(readings)) addReadings(readings);
    });
    const offAlert = socketService.on('telemetry:alert', (alert: any) => addAlert(alert));
    return () => { offStatus(); offInit(); offUpdate(); offAlert(); socketService.disconnect(); setSocketConnected(false); };
  }, [addAlert, addReadings, setLatestReadings, setSocketConnected]);

  return (
    <div className="relative min-h-screen text-slate-200 overflow-hidden flex font-sans">
      <Background />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-64'} max-md:ml-0 max-md:mb-16`}>
        <Header />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;
