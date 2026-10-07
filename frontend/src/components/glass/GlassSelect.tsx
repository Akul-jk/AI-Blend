import React from 'react';
import { cn } from './GlassCard';
import { ChevronDown } from 'lucide-react';

interface GlassSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string | number; label: string }[];
}

const GlassSelect = React.forwardRef<HTMLSelectElement, GlassSelectProps>(
  ({ className, label, error, options, required, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label className="text-sm font-medium text-slate-300 flex items-center gap-1">
            {label}
            {required && <span className="text-rose-400">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              "w-full bg-slate-900/50 border border-white/10 rounded-lg pl-4 pr-10 py-2 text-sm text-white appearance-none",
              "focus:outline-none focus:ring-2 focus:border-transparent transition-all backdrop-blur-sm cursor-pointer",
              error ? "focus:ring-rose-500 border-rose-500/50" : "focus:ring-cyan-500",
              className
            )}
            {...props}
          >
            <option value="" disabled className="bg-slate-900 text-slate-400">Select an option...</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <ChevronDown size={16} />
          </div>
        </div>
        {error && <span className="text-xs text-rose-400 mt-0.5">{error}</span>}
      </div>
    );
  }
);
GlassSelect.displayName = 'GlassSelect';

export default GlassSelect;
