import React from 'react';
import { cn } from './GlassCard';

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
}

const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  ({ className, label, error, helperText, leftIcon, required, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label className="text-sm font-medium text-slate-300 flex items-center gap-1">
            {label}
            {required && <span className="text-rose-400">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 flex items-center pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder:text-slate-500",
              "focus:outline-none focus:ring-2 focus:border-transparent transition-all backdrop-blur-sm",
              leftIcon && "pl-10",
              error ? "focus:ring-rose-500 border-rose-500/50" : "focus:ring-cyan-500",
              className
            )}
            {...props}
          />
        </div>
        {error && <span className="text-xs text-rose-400 mt-0.5">{error}</span>}
        {!error && helperText && <span className="text-xs text-slate-400 mt-0.5">{helperText}</span>}
      </div>
    );
  }
);
GlassInput.displayName = 'GlassInput';

export default GlassInput;
