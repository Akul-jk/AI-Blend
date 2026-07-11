import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Activity, 
  TrendingUp,
  Gauge,
  Brain,
  Sparkles,
  History, 
  FileSpreadsheet, 
  AlertOctagon, 
  Server,
  Database,
  Target,
  BarChart3,
  Settings,
  User,
  Cpu,
  X
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard className="w-4 h-4" /> },
    { name: 'Live Monitoring', path: '/monitoring', icon: <Activity className="w-4 h-4" /> },
    { name: 'Energy Analytics', path: '/analytics', icon: <TrendingUp className="w-4 h-4" /> },
    { name: 'Sensor Dashboard', path: '/sensors', icon: <Gauge className="w-4 h-4" /> },
    { name: 'AI Workspace', path: '/ai', icon: <Brain className="w-4 h-4" /> },
    { name: 'Predictions', path: '/predictions', icon: <Sparkles className="w-4 h-4" /> },
    { name: 'Historical Data', path: '/history', icon: <History className="w-4 h-4" /> },
    { name: 'Reports', path: '/reports', icon: <FileSpreadsheet className="w-4 h-4" /> },
    { name: 'Alerts', path: '/alerts', icon: <AlertOctagon className="w-4 h-4" /> },
    { name: 'Device', path: '/device', icon: <Server className="w-4 h-4" /> },
    { name: 'Dataset', path: '/datasets', icon: <Database className="w-4 h-4" /> },
    { name: 'Model Training', path: '/training', icon: <Target className="w-4 h-4" /> },
    { name: 'Model Comparison', path: '/comparison', icon: <BarChart3 className="w-4 h-4" /> },
    { name: 'Settings', path: '/settings', icon: <Settings className="w-4 h-4" /> },
    { name: 'Profile', path: '/profile', icon: <User className="w-4 h-4" /> },
  ];

  const activeStyle = "flex items-center gap-2.5 px-3 py-2 rounded-lg bg-emerald-500/10 border-l-2 border-emerald-500 text-emerald-400 text-xs font-semibold transition-all shadow-md shadow-emerald-950/5";
  const inactiveStyle = "flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-900/50 text-slate-400 hover:text-slate-200 text-xs font-medium transition-all border-l-2 border-transparent";

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
        />
      )}

      {/* Sidebar container */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-56 glass-panel border-r border-slate-900/80 bg-slate-950 flex flex-col justify-between transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:h-full ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo block */}
          <div className="h-14 flex items-center justify-between px-5 border-b border-slate-900/80">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Cpu className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <span className="font-bold text-[10px] tracking-tight text-slate-100 uppercase leading-none">Smart Energy</span>
                <span className="text-slate-500 text-[8px] block font-mono">Monitoring System</span>
              </div>
            </div>
            
            {/* Mobile close button */}
            <button 
              onClick={onClose}
              className="lg:hidden p-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Nav Items - Scrollable */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto min-h-0">
            {navItems.map((item) => (
              <NavLink 
                key={item.path} 
                to={item.path}
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    onClose();
                  }
                }}
                className={({ isActive }) => isActive ? activeStyle : inactiveStyle}
              >
                {item.icon}
                <span>{item.name}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Footer info in sidebar */}
        <div className="p-3 border-t border-slate-900 bg-slate-950/40 text-center">
          <p className="text-[9px] text-slate-600 font-mono">Operator Terminal</p>
          <p className="text-[8px] text-slate-700 font-mono mt-0.5">Secure Session Active</p>
        </div>
      </aside>
    </>
  );
};
export default Sidebar;
