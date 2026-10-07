import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, Zap, Activity, HardDrive } from 'lucide-react';
import { cn } from './GlassCard';

export type StatusType = 'online' | 'offline' | 'simulation' | 'hardware' | 'warning' | 'critical' | 'info';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
}

const statusConfig: Record<StatusType, { icon: React.ElementType, defaultLabel: string, colorClass: string }> = {
  online: { icon: CheckCircle, defaultLabel: 'ONLINE', colorClass: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
  offline: { icon: Zap, defaultLabel: 'OFFLINE', colorClass: 'text-slate-400 bg-slate-400/10 border-slate-400/30' },
  simulation: { icon: Activity, defaultLabel: 'SIMULATION', colorClass: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30' },
  hardware: { icon: HardDrive, defaultLabel: 'HARDWARE', colorClass: 'text-violet-400 bg-violet-400/10 border-violet-400/30' },
  warning: { icon: AlertTriangle, defaultLabel: 'WARNING', colorClass: 'text-amber-400 bg-amber-400/10 border-amber-400/30' },
  critical: { icon: AlertCircle, defaultLabel: 'CRITICAL', colorClass: 'text-rose-400 bg-rose-400/10 border-rose-400/30' },
  info: { icon: Info, defaultLabel: 'INFO', colorClass: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className }) => {
  const config = statusConfig[status] || statusConfig.info;
  const Icon = config.icon;

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border backdrop-blur-sm',
      config.colorClass,
      className
    )}>
      <Icon className="w-3.5 h-3.5" />
      {label || config.defaultLabel}
    </span>
  );
};

export default StatusBadge;
