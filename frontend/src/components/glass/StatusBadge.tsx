import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, Zap, Activity, HardDrive } from 'lucide-react';
import { cn } from './GlassCard';

export type StatusType = 'online' | 'offline' | 'simulation' | 'hardware' | 'warning' | 'critical' | 'info';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
}

const statusConfig: Record<StatusType, { icon: React.ElementType, defaultLabel: string, style: React.CSSProperties }> = {
  online: { icon: CheckCircle, defaultLabel: 'ONLINE', style: { color: 'var(--green)', borderColor: 'color-mix(in srgb,var(--green) 28%,transparent)', background: 'color-mix(in srgb,var(--green) 9%,transparent)' } },
  offline: { icon: Zap, defaultLabel: 'OFFLINE', style: { color: 'var(--text-muted)', borderColor: 'var(--line)', background: 'var(--surface-subtle)' } },
  simulation: { icon: Activity, defaultLabel: 'SIMULATION', style: { color: 'var(--accent)', borderColor: 'color-mix(in srgb,var(--accent) 28%,transparent)', background: 'var(--accent-soft)' } },
  hardware: { icon: HardDrive, defaultLabel: 'HARDWARE', style: { color: 'var(--violet)', borderColor: 'color-mix(in srgb,var(--violet) 28%,transparent)', background: 'color-mix(in srgb,var(--violet) 9%,transparent)' } },
  warning: { icon: AlertTriangle, defaultLabel: 'WARNING', style: { color: 'var(--warning)', borderColor: 'color-mix(in srgb,var(--warning) 28%,transparent)', background: 'color-mix(in srgb,var(--warning) 9%,transparent)' } },
  critical: { icon: AlertCircle, defaultLabel: 'CRITICAL', style: { color: 'var(--danger)', borderColor: 'color-mix(in srgb,var(--danger) 28%,transparent)', background: 'color-mix(in srgb,var(--danger) 9%,transparent)' } },
  info: { icon: Info, defaultLabel: 'INFO', style: { color: 'var(--accent)', borderColor: 'color-mix(in srgb,var(--accent) 28%,transparent)', background: 'var(--accent-soft)' } },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className }) => {
  const config = statusConfig[status] || statusConfig.info;
  const Icon = config.icon;

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border backdrop-blur-sm',
      'border',
      className
    )} style={config.style}>
      <Icon className="w-3.5 h-3.5" />
      {label || config.defaultLabel}
    </span>
  );
};

export default StatusBadge;
