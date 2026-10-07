import React, { useState, useEffect } from 'react';
import { useSensorStore } from '../../stores/sensorStore';
import { Cpu, Database, Network } from 'lucide-react';

export const Footer: React.FC = () => {
  const { socketConnected, sensors } = useSensorStore();
  const [lastUpdated, setLastUpdated] = useState('00:00:00');

  useEffect(() => {
    if (sensors.length > 0) {
      const date = new Date();
      setLastUpdated(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }, [sensors]);

  return (
    <footer className="h-10 border-t border-slate-900 bg-slate-950 px-4 md:px-6 flex items-center justify-between text-[9px] text-slate-500 font-mono">
      <div className="flex items-center gap-3">
        <span className="font-bold text-slate-400">Smart Energy System</span>
        <span className="text-slate-600">|</span>
        <span>Version 1.0</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Status markers */}
        <div className="flex items-center gap-1.5">
          <Cpu className={`w-3 h-3 ${socketConnected ? 'text-emerald-400' : 'text-red-400 animate-pulse'}`} />
          <span>ESP32: <span className={socketConnected ? 'text-emerald-400' : 'text-red-400'}>{socketConnected ? 'Online' : 'Offline'}</span></span>
        </div>

        <div className="flex items-center gap-1.5">
          <Network className={`w-3 h-3 ${socketConnected ? 'text-emerald-400' : 'text-red-400 animate-pulse'}`} />
          <span>Socket: <span className={socketConnected ? 'text-emerald-400' : 'text-red-400'}>{socketConnected ? 'Connected' : 'Disconnected'}</span></span>
        </div>

        <div className="flex items-center gap-1.5">
          <Database className="w-3 h-3 text-emerald-400" />
          <span>Database: <span className="text-emerald-400">Healthy</span></span>
        </div>

        <div className="hidden md:flex items-center gap-1">
          <span className="text-slate-600">|</span>
          <span className="ml-2">Last Sync: <span className="text-slate-400">{lastUpdated}</span></span>
        </div>
      </div>
    </footer>
  );
};
export default Footer;
