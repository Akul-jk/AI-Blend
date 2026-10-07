import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Activity, BarChart2,
  BrainCircuit, LineChart, AlertTriangle,
  Database, FileText, Settings, Shield,
  Server, HardDrive, Cpu, Plug, Menu, ChevronLeft
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { cn } from '../glass/GlassCard';

const navGroups = [
  {
    title: 'OVERVIEW',
    items: [
      { name: 'Dashboard', path: '/', icon: LayoutDashboard },
      { name: 'Live Monitoring', path: '/monitoring', icon: Activity },
      { name: 'Energy Analytics', path: '/analytics', icon: BarChart2 },
    ]
  },
  {
    title: 'INTELLIGENCE',
    items: [
      { name: 'AI Insights', path: '/ai', icon: BrainCircuit },
      { name: 'Predictions', path: '/predictions', icon: LineChart },
    ]
  },
  {
    title: 'DATA',
    items: [
      { name: 'Historical Data', path: '/history', icon: Database },
      { name: 'Datasets', path: '/datasets', icon: FileText },
      { name: 'Reports', path: '/reports', icon: FileText },
    ]
  },
  {
    title: 'SYSTEM',
    items: [
      { name: 'Appliances', path: '/appliances', icon: Plug },
      { name: 'Devices', path: '/device', icon: HardDrive },
      { name: 'Sensors', path: '/sensors', icon: Cpu },
      { name: 'Alerts', path: '/alerts', icon: AlertTriangle },
      { name: 'Settings', path: '/settings', icon: Settings },
    ]
  },
  {
    title: 'AI / ADMIN',
    items: [
      { name: 'Training', path: '/training', icon: Server },
      { name: 'Model Comparison', path: '/comparison', icon: Shield },
    ]
  }
];

const Sidebar: React.FC = () => {
  const { sidebarCollapsed, setSidebarCollapsed, sidebarOpen, setSidebarOpen } = useAppStore();
  const location = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full z-50 glass-elevated border-r border-white/10 flex flex-col transition-all duration-300",
        sidebarCollapsed ? "w-20" : "w-64",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <ZapIcon className="text-cyan-400 w-6 h-6" />
              <span className="font-bold text-white tracking-wide">EnergyAI</span>
            </div>
          )}
          {sidebarCollapsed && (
            <ZapIcon className="text-cyan-400 w-6 h-6 mx-auto" />
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            {sidebarCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
          {navGroups.map((group, i) => (
            <div key={i} className="mb-6 px-3">
              {!sidebarCollapsed && (
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3">
                  {group.title}
                </h4>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                        isActive
                          ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]"
                          : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                      )}
                      onClick={() => setSidebarOpen(false)}
                      title={sidebarCollapsed ? item.name : undefined}
                    >
                      {isActive && sidebarCollapsed && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-cyan-400 rounded-r-full" />
                      )}
                      <Icon size={20} className={cn(
                        "shrink-0 transition-transform duration-200",
                        isActive ? "text-cyan-400" : "group-hover:text-cyan-400"
                      )} />
                      {!sidebarCollapsed && <span className="text-sm font-medium">{item.name}</span>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
};

const ZapIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
  </svg>
);

export default Sidebar;
