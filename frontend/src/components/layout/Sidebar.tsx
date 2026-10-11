import React, { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Activity, AlertTriangle, BarChart3, BrainCircuit, ChevronLeft, ChevronRight, Cpu, Database,
  FileClock, FileText, HardDrive, LayoutDashboard, LineChart, LogOut, Plug, Settings, Shield,
  X, Zap,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../glass/GlassCard';

const groups = [
  { title: 'Monitor', items: [
    { name: 'Overview', path: '/', icon: LayoutDashboard }, { name: 'Live monitoring', path: '/monitoring', icon: Activity },
    { name: 'Appliances', path: '/appliances', icon: Plug }, { name: 'Devices', path: '/device', icon: HardDrive }, { name: 'Sensors', path: '/sensors', icon: Cpu },
  ] },
  { title: 'Analyze', items: [
    { name: 'Energy analytics', path: '/analytics', icon: BarChart3 }, { name: 'Energy history', path: '/history', icon: FileClock },
    { name: 'Forecasts', path: '/predictions', icon: LineChart }, { name: 'AI insights', path: '/ai', icon: BrainCircuit }, { name: 'Alerts', path: '/alerts', icon: AlertTriangle },
  ] },
  { title: 'Workspace', items: [
    { name: 'Datasets', path: '/datasets', icon: Database }, { name: 'Reports', path: '/reports', icon: FileText },
    { name: 'Training', path: '/training', icon: Cpu }, { name: 'Model comparison', path: '/comparison', icon: Shield },
    { name: 'Model management', path: '/model-management', icon: BrainCircuit, admin: true }, { name: 'Settings', path: '/settings', icon: Settings },
  ] },
];

const Sidebar: React.FC = () => {
  const { sidebarCollapsed, setSidebarCollapsed, sidebarOpen, setSidebarOpen } = useAppStore();
  const { user, logout } = useAuth();
  const location = useLocation();
  const sidebarRef = useRef<HTMLElement>(null);
  const collapsed = sidebarCollapsed && !sidebarOpen;

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const focusable = () => sidebarRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])');
    focusable()?.[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
      if (event.key === 'Tab') {
        const items = focusable();
        if (!items?.length) return;
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus(); }
        else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow; previousFocus?.focus?.(); };
  }, [sidebarOpen, setSidebarOpen]);

  const closeMobile = () => setSidebarOpen(false);
  return <>
    {sidebarOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-[var(--overlay)] backdrop-blur-sm md:hidden" onClick={closeMobile} />}
    <aside id="app-navigation" ref={sidebarRef} role={sidebarOpen ? 'dialog' : undefined} aria-label="Main navigation" aria-modal={sidebarOpen ? true : undefined} className={cn(
      'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[var(--line)] bg-[var(--surface-glass)] shadow-[var(--shadow)] backdrop-blur-2xl transition-[width,transform] duration-300',
      sidebarCollapsed ? 'w-64 md:w-[76px]' : 'w-64', sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
    )}>
      <div className={cn('flex h-[76px] shrink-0 items-center border-b border-[var(--line)] px-4', collapsed ? 'justify-center' : 'justify-between')}>
        <NavLink to="/" onClick={closeMobile} aria-label="Smart Energy Monitor home" className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(145deg,#14364a,#0c2631)] text-[#36D9F5] shadow-[0_8px_20px_rgba(18,185,213,.17)]"><Zap size={21} fill="currentColor" strokeWidth={1.5} /></span>
          {!collapsed && <span className="min-w-0"><span className="block truncate text-sm font-bold tracking-tight text-[var(--text-primary)]">Smart Energy</span><span className="block text-[10px] font-medium tracking-[.16em] text-[var(--text-muted)]">MONITOR</span></span>}
        </NavLink>
        <button type="button" aria-label="Close navigation" onClick={closeMobile} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] md:hidden"><X size={18} /></button>
        <button type="button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} onClick={() => setSidebarCollapsed(!collapsed)} className="hidden rounded-lg p-2 text-[var(--text-muted)] transition hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] md:block">
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      <nav className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {groups.map(group => {
          const items = group.items.filter(item => !item.admin || user?.role === 'admin');
          return <div key={group.title}>
            {!collapsed && <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.17em] text-[var(--text-muted)]">{group.title}</p>}
            <div className="space-y-1">{items.map(({ name, path, icon: Icon }) => {
              const active = path === '/' ? location.pathname === '/' : location.pathname === path || location.pathname.startsWith(`${path}/`);
              return <NavLink key={path} to={path} onClick={closeMobile} title={collapsed ? name : undefined} aria-current={active ? 'page' : undefined}
                className={cn('group relative flex min-h-10 items-center gap-3 rounded-[11px] px-3 text-[13px] font-medium transition duration-200',
                  active ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_22%,transparent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]',
                  collapsed && 'justify-center px-0')}>
                {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[var(--accent)]" />}
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />{!collapsed && <span className="truncate">{name}</span>}
              </NavLink>;
            })}</div>
          </div>;
        })}
      </nav>
      <div className="shrink-0 border-t border-[var(--line)] p-3">
        <div className="flex items-center gap-1 rounded-xl p-1 transition hover:bg-[var(--surface-subtle)]">
          <NavLink to="/profile" onClick={closeMobile} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">{user?.username?.slice(0,1).toUpperCase() || 'U'}</span>
          {!collapsed && <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-[var(--text-primary)]">{user?.username || 'Account'}</span><span className="block truncate text-[10px] text-[var(--text-muted)]">{user?.role || 'Member'}</span></span>}
          </NavLink>
          <button type="button" title="Sign out" aria-label="Sign out" onClick={logout} className={cn('rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--danger)]', collapsed && 'mx-auto')}><LogOut size={15} /></button>
        </div>
      </div>
    </aside>
  </>;
};

export default Sidebar;
