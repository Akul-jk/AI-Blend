import React from 'react';
import GlassCard from './GlassCard';
import { cn } from './GlassCard';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  height?: number | string;
}

const ChartContainer: React.FC<ChartContainerProps> = ({ title, subtitle, action, children, className, height = 300 }) => {
  return (
    <GlassCard className={cn("rounded-[var(--radius-card)] p-5 flex flex-col", className)}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">{title}</h3>
          {subtitle && <p className="text-sm text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="flex-1 w-full relative" style={{ minHeight: height }}>
        {children}
      </div>
    </GlassCard>
  );
};

export default ChartContainer;
