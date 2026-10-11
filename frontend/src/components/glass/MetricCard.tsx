import React from 'react';
import GlassCard from './GlassCard';
import StatusBadge from './StatusBadge';
import type { StatusType } from './StatusBadge';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from './GlassCard';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  status?: StatusType;
  className?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  label, value, unit, icon, trend, trendValue, status, className
}) => {
  return (
    <GlassCard level="standard" className={cn("kpi-card rounded-[16px] p-5 flex flex-col gap-3", className)}>
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          {icon && <span className="text-[var(--accent)]">{icon}</span>}
          <span className="text-xs font-semibold tracking-[.1em] uppercase">{label}</span>
        </div>
        {status && <StatusBadge status={status} />}
      </div>

      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-3xl font-semibold text-[var(--text-primary)] tracking-tight">{value}</span>
        {unit && <span className="text-sm font-medium text-[var(--text-muted)]">{unit}</span>}
      </div>

      {trend && (
        <div className="flex items-center gap-1 mt-auto pt-2">
          {trend === 'up' && <ArrowUpRight className="w-4 h-4 text-emerald-400" />}
          {trend === 'down' && <ArrowDownRight className="w-4 h-4 text-rose-400" />}
          {trend === 'stable' && <Minus className="w-4 h-4 text-slate-400" />}
          <span className={cn(
            "text-xs font-medium",
            trend === 'up' ? "text-emerald-400" : trend === 'down' ? "text-rose-400" : "text-slate-400"
          )}>
            {trendValue}
          </span>
        </div>
      )}
    </GlassCard>
  );
};

export default MetricCard;
