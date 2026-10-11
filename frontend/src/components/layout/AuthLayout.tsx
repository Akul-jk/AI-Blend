import React from 'react';
import { ArrowUpRight, Leaf, Moon, Sun, Zap } from 'lucide-react';
import { useThemeStore } from '../../stores/themeStore';

const AuthLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme, toggleTheme } = useThemeStore();
  return <div className="grid min-h-screen bg-[var(--canvas)] lg:grid-cols-[minmax(0,1.05fr)_minmax(440px,.95fr)]">
    <aside className="energy-hero relative hidden min-h-screen flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-14">
      <div className="relative z-10 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-cyan-200"><Zap size={22} fill="currentColor" /></span><div><p className="text-sm font-bold tracking-tight">Smart Energy Monitor</p><p className="text-[10px] uppercase tracking-[.18em] text-slate-200/65">Energy intelligence</p></div></div>
      <div className="relative z-10 max-w-xl pb-8"><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-cyan-100"><Leaf size={13} />Powered by insight</div><h1 className="text-4xl font-semibold leading-[1.08] tracking-[-.04em] text-white xl:text-5xl">Clarity for every<br />kilowatt hour.</h1><p className="mt-5 max-w-md text-sm leading-6 text-slate-200/75">Bring live energy telemetry, operational context, and forecasting into one considered workspace.</p><div className="mt-8 flex items-center gap-3 text-xs text-slate-200/70"><span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/[.06]"><ActivityMark /></span>Built for thoughtful energy decisions <ArrowUpRight size={14} /></div></div>
      <div className="relative z-10 flex items-center justify-between text-[10px] text-slate-200/55"><span>Monitor · Understand · Improve</span><button type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-black/15 px-3 py-2 text-slate-100 transition hover:bg-white/10">{theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}{theme === 'dark' ? 'Light appearance' : 'Dark appearance'}</button></div>
    </aside>
    <main className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-8 lg:px-10"><div className="absolute right-4 top-4 lg:hidden"><button type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2.5 text-[var(--text-secondary)]">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button></div><div className="w-full max-w-md">{children}</div></main>
  </div>;
};

const ActivityMark = () => <svg viewBox="0 0 20 20" className="h-4 w-4 text-cyan-200" fill="none" aria-hidden="true"><path d="M2 10h4l2-6 4 12 2-6h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
export default AuthLayout;
