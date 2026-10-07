import React from 'react';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Level = 'bg' | 'standard' | 'elevated' | 'active';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  level?: Level;
  hover?: boolean;
}

const levelClasses: Record<Level, string> = {
  bg: 'glass-bg',
  standard: 'glass-standard',
  elevated: 'glass-elevated',
  active: 'glass-active',
};

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, level = 'standard', hover = false, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={cn(
          levelClasses[level],
          'rounded-xl transition-colors duration-300',
          hover && 'hover:border-white/30 hover:bg-slate-800/70',
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
GlassCard.displayName = 'GlassCard';

export default GlassCard;
