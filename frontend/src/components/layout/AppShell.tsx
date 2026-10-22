import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Background from './Background';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAppStore } from '../../stores/appStore';
import { socketService } from '../../services/socket';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useAlertStore } from '../../stores/alertStore';
import { useReplayStore } from '../../stores/replayStore';
import type { TelemetryReading } from '../../types';
import type { Alert } from '../../types';

const AppShell: React.FC = () => {
  const { sidebarCollapsed } = useAppStore();
  const { setLatestReadings, addReadings, setSocketConnected } = useTelemetryStore();
  const addReplayReadings = useReplayStore(state => state.addReadings);
  const clearReplayReadings = useReplayStore(state => state.clear);
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
    const offReplay = socketService.on('telemetry:replay', (readings: TelemetryReading[]) => {
      if (Array.isArray(readings)) addReplayReadings(readings);
    });
    const offReplayReset = socketService.on('telemetry:replay:reset', () => clearReplayReadings());
    const offAlert = socketService.on('telemetry:alert', (alert: Alert) => addAlert(alert));
    return () => { offStatus(); offInit(); offUpdate(); offReplay(); offReplayReset(); offAlert(); socketService.disconnect(); setSocketConnected(false); };
  }, [addAlert, addReadings, addReplayReadings, clearReplayReadings, setLatestReadings, setSocketConnected]);

  return (
    <div className="relative flex min-h-screen overflow-hidden font-sans text-[var(--text-primary)]">
      <Background />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className={`flex min-w-0 flex-1 flex-col transition-[margin] duration-300 ${sidebarCollapsed ? 'ml-[76px]' : 'ml-64'} max-md:ml-0`}>
        <Header />

        <main className="custom-scrollbar flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
          <div className="page-enter mx-auto w-full max-w-[1480px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;
