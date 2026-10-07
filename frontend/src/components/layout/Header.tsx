import React from 'react';
import { Menu, Bell, Search, User } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useTelemetryStore } from '../../stores/telemetryStore';
import StatusBadge from '../glass/StatusBadge';

const Header: React.FC = () => {
  const { toggleSidebar } = useAppStore();
  const latestReadings = useTelemetryStore(state => state.latestReadings);
  const hasReading = Object.keys(latestReadings).length > 0;
  const hasHardware = Object.values(latestReadings).some(reading => reading.source === 'hardware');

  return (
    <header className="h-16 glass-standard border-b border-white/10 flex items-center justify-between px-4 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="md:hidden p-2 rounded-lg hover:bg-white/10 text-slate-300"
        >
          <Menu size={24} />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400 font-medium">
          <span>Smart Energy Monitor</span>
          <span>/</span>
          <span className="text-white">Dashboard</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            className="w-64 bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:bg-white/10 transition-all"
          />
        </div>

        {hasReading ? <StatusBadge status={hasHardware ? 'hardware' : 'simulation'} label={hasHardware ? 'HARDWARE' : 'SIMULATION'} className="hidden sm:inline-flex" /> : <StatusBadge status="warning" label="NO TELEMETRY" className="hidden sm:inline-flex" />}

        <button className="relative p-2 rounded-full hover:bg-white/10 text-slate-300 transition-colors">
          <Bell size={20} />
        </button>

        <button className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-400 hover:bg-cyan-500/30 transition-colors">
          <User size={16} />
        </button>
      </div>
    </header>
  );
};

export default Header;
