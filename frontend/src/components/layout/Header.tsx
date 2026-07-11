import React from 'react';
import { Menu, Sun, Moon, Wifi, WifiOff, Cpu, Database } from 'lucide-react';
import { useThemeStore } from '../../stores/themeStore';
import { useSensorStore } from '../../stores/sensorStore';
import Breadcrumbs from '../ui/Breadcrumbs';
import SearchBar from '../ui/SearchBar';
import NotificationCenter from '../ui/NotificationCenter';
import UserProfile from '../ui/UserProfile';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { theme, toggleTheme } = useThemeStore();
  const { socketConnected } = useSensorStore();

  return (
    <header className="h-14 border-b border-slate-900/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle */}
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors lg:hidden"
          title="Toggle Navigation"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Dynamic breadcrumb path indicator */}
        <Breadcrumbs />
      </div>

      <div className="flex items-center gap-3.5">
        {/* Search bar wrapper */}
        <SearchBar />

        {/* Global Status indicators */}
        <div className="hidden sm:flex items-center gap-2.5 border-r border-slate-900 pr-3.5">
          {/* ESP32 indicator */}
          <div className="flex items-center gap-1" title="ESP32 Status">
            <Cpu className={`w-3.5 h-3.5 ${socketConnected ? 'text-emerald-400' : 'text-red-400 animate-pulse'}`} />
            <span className="text-[9px] font-mono text-slate-400">ESP32</span>
            <span className={`w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-emerald-400' : 'bg-red-400'}`} />
          </div>

          {/* Wi-Fi Status */}
          <div className="flex items-center gap-1" title="Wi-Fi Status">
            {socketConnected ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-red-400 animate-pulse" />
            )}
            <span className="text-[9px] font-mono text-slate-400">Wi-Fi</span>
            <span className={`w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-emerald-400' : 'bg-red-400'}`} />
          </div>

          {/* Database indicator */}
          <div className="flex items-center gap-1" title="Database Health">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[9px] font-mono text-slate-400">DB</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
        </div>

        {/* Theme Switcher Button */}
        <button 
          onClick={toggleTheme}
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          title="Toggle Light/Dark Theme"
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        {/* Notification Center Bell dropdown */}
        <NotificationCenter />

        {/* User profile dropdown */}
        <UserProfile />
      </div>
    </header>
  );
};
export default Header;
