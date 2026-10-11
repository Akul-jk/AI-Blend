import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, ChevronRight, Menu, Moon, Sun, UserRound } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useThemeStore } from '../../stores/themeStore';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useAuth } from '../../context/AuthContext';

const routeNames: Record<string, string> = {
  '/': 'Overview', '/monitoring': 'Live monitoring', '/analytics': 'Energy analytics', '/ai': 'AI insights',
  '/predictions': 'Forecasts', '/history': 'Energy history', '/datasets': 'Datasets', '/reports': 'Reports',
  '/appliances': 'Appliances', '/device': 'Devices', '/sensors': 'Sensors', '/alerts': 'Alerts',
  '/settings': 'Settings', '/training': 'Model training', '/comparison': 'Model comparison',
  '/model-management': 'Model management', '/profile': 'Profile',
};

const Header: React.FC = () => {
  const { toggleSidebar } = useAppStore();
  const { theme, toggleTheme } = useThemeStore();
  const { socketConnected, latestReadings } = useTelemetryStore();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const title = routeNames[pathname] || (pathname.startsWith('/appliances/') ? 'Appliance details' : 'Workspace');
  const reading = Object.values(latestReadings).sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  const source = reading?.source === 'hardware' ? 'Hardware' : reading ? 'Simulation' : 'No readings';

  return (
    <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between gap-4 border-b border-[var(--line)] bg-[var(--surface-glass)] px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={toggleSidebar} aria-label="Open navigation" aria-haspopup="true" className="rounded-lg p-2 text-[var(--text-secondary)] transition hover:bg-[var(--surface-subtle)] md:hidden"><Menu size={20} /></button>
        <div className="min-w-0">
          <div className="hidden items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted)] sm:flex"><span>Workspace</span><ChevronRight size={12} /><span className="truncate text-[var(--text-secondary)]">{title}</span></div>
          <h1 className="truncate text-base font-semibold tracking-tight text-[var(--text-primary)] sm:mt-0.5 sm:text-lg">{title}</h1>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span className="hidden items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-subtle)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] sm:inline-flex" title={reading ? `Latest reading: ${new Date(reading.timestamp).toLocaleString()}` : 'No telemetry received'}>
          <span className={`h-1.5 w-1.5 rounded-full ${socketConnected ? 'bg-[var(--green)] shadow-[0_0_8px_var(--green)]' : 'bg-[var(--warning)]'}`} />
          <span>{socketConnected ? source : 'Disconnected'}</span>{reading && <span className="hidden border-l border-[var(--line)] pl-2 text-[var(--text-muted)] lg:inline">Updated {new Date(reading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
        </span>
        <Link to="/alerts" aria-label="View alerts" title="Alerts" className="relative rounded-lg p-2 text-[var(--text-secondary)] transition hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"><Bell size={18} /></Link>
        <button type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`${theme === 'dark' ? 'Light' : 'Dark'} theme`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] px-2.5 text-[var(--text-secondary)] transition hover:border-[var(--line-strong)] hover:text-[var(--text-primary)] sm:px-3">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}<span className="hidden text-xs font-medium sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
        <Link to="/profile" title={user?.username || 'Profile'} aria-label="Open profile" className="flex h-9 w-9 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">
          {user?.username ? user.username.slice(0, 1).toUpperCase() : <UserRound size={16} />}
        </Link>
      </div>
    </header>
  );
};

export default Header;
