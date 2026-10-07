import React from 'react';
import { cn } from './GlassCard';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';

interface GlassButtonProps extends Omit<HTMLMotionProps<"button">, "disabled"> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'ai';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, icon, children, ...props }, ref) => {

    const baseClasses = "inline-flex items-center justify-center font-medium transition-all duration-300 rounded-lg backdrop-blur-md outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900";

    const sizeClasses = {
      sm: "px-3 py-1.5 text-xs gap-1.5",
      md: "px-4 py-2 text-sm gap-2",
      lg: "px-6 py-3 text-base gap-2.5",
    };

    const variantClasses = {
      primary: "bg-cyan-500/20 text-cyan-50 hover:bg-cyan-500/30 border border-cyan-500/50 hover:border-cyan-400 focus:ring-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]",
      secondary: "bg-white/5 text-slate-200 hover:bg-white/10 border border-white/10 hover:border-white/20 focus:ring-slate-500",
      danger: "bg-rose-500/20 text-rose-50 hover:bg-rose-500/30 border border-rose-500/50 hover:border-rose-400 focus:ring-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.2)]",
      ghost: "bg-transparent text-slate-300 hover:bg-white/5 hover:text-white border border-transparent",
      ai: "bg-violet-500/20 text-violet-50 hover:bg-violet-500/30 border border-violet-500/50 hover:border-violet-400 focus:ring-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.2)]"
    };

    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref}
        whileTap={isDisabled ? undefined : { scale: 0.98 }}
        className={cn(
          baseClasses,
          sizeClasses[size],
          variantClasses[variant],
          isDisabled && "opacity-50 cursor-not-allowed",
          className
        )}
        disabled={isDisabled}
        {...props as any}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {!loading && icon && <span className="inline-flex">{icon}</span>}
        {children}
      </motion.button>
    );
  }
);
GlassButton.displayName = 'GlassButton';

export default GlassButton;
