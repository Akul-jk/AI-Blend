import React from 'react';
import { Cpu, Construction } from 'lucide-react';

interface PlaceholderViewProps {
  title: string;
}

export const PlaceholderView: React.FC<PlaceholderViewProps> = ({ title }) => {
  return (
    <div className="glass-panel rounded-2xl p-8 min-h-[70vh] flex flex-col items-center justify-center text-center relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl -z-10 animate-pulse-slow"></div>
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl -z-10 animate-pulse-slow"></div>
      
      <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-violet-400 mb-6">
        <Cpu className="w-8 h-8 animate-pulse" />
      </div>

      <h2 className="text-3xl font-extrabold text-slate-100 tracking-tight mb-3">
        {title} Workspace
      </h2>
      <p className="text-sm text-slate-400 max-w-md leading-relaxed mb-8">
        This section is configured in the route manager. The underlying controller logic, telemetry bindings, and UI cards will be developed dynamically in the subsequent phase.
      </p>

      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/60 border border-slate-800 text-[10px] font-semibold text-slate-500 tracking-wider uppercase">
        <Construction className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
        Developer Sandbox Active
      </div>
    </div>
  );
};
export default PlaceholderView;
