import React from 'react';
import GlassCard from './GlassCard';
import { cn } from './GlassCard';

interface LoadingStateProps {
  variant?: 'card' | 'table' | 'chart' | 'spinner';
  className?: string;
  text?: string;
}

const LoadingState: React.FC<LoadingStateProps> = ({ variant = 'spinner', className, text = 'Loading...' }) => {
  if (variant === 'spinner') {
    return (
      <div className={cn("flex flex-col items-center justify-center p-8", className)}>
        <div role="status" className="w-8 h-8 border-[3px] border-[color-mix(in_srgb,var(--accent)_20%,transparent)] border-t-[var(--accent)] rounded-full animate-spin mb-4" />
        <p className="text-sm text-[var(--text-muted)] animate-pulse">{text}</p>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <GlassCard className={cn("p-5 animate-pulse", className)}>
        <div className="w-1/3 h-4 bg-white/10 rounded mb-4" />
        <div className="w-1/2 h-8 bg-white/10 rounded mb-4" />
        <div className="w-full h-2 bg-white/10 rounded" />
      </GlassCard>
    );
  }

  return (
    <GlassCard className={cn("p-6 flex flex-col items-center justify-center animate-pulse", className)}>
      <div className="w-8 h-8 bg-white/10 rounded-full mb-4" />
      <div className="w-32 h-4 bg-white/10 rounded" />
    </GlassCard>
  );
};

export default LoadingState;
