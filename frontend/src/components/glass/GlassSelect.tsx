import React, { useId } from 'react';
import { cn } from './GlassCard';
import { ChevronDown } from 'lucide-react';

interface GlassSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string | number; label: string }[];
}

const GlassSelect = React.forwardRef<HTMLSelectElement, GlassSelectProps>(
  ({ className, label, error, options, required, id: selectId, ...props }, ref) => {
    const generatedId = useId();
    const id = selectId || generatedId;
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-1">
            {label}
            {required && <span className="text-rose-400">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={id}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className={cn(
              "w-full bg-[var(--surface)] border border-[var(--line)] rounded-[var(--radius-control)] pl-4 pr-10 py-2.5 text-sm text-[var(--text-primary)] appearance-none",
              "focus:outline-none focus:ring-2 focus:border-transparent transition-all backdrop-blur-sm cursor-pointer",
              error ? "focus:ring-rose-500 border-rose-500/50" : "focus:ring-cyan-500",
              className
            )}
            {...props}
          >
            <option value="" disabled>Select an option...</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <ChevronDown size={16} />
          </div>
        </div>
        {error && <span id={`${id}-error`} role="alert" className="text-xs text-rose-400 mt-0.5">{error}</span>}
      </div>
    );
  }
);
GlassSelect.displayName = 'GlassSelect';

export default GlassSelect;
