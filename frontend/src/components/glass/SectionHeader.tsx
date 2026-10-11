import React from 'react';
import { cn } from './GlassCard';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, icon, action, className }) => {
  return (
    <div className={cn("flex flex-col items-start justify-between gap-4 mb-6 sm:flex-row sm:items-center", className)}>
      <div className="flex items-center gap-3">
        {icon && <div className="rounded-xl border border-[var(--line)] bg-[var(--accent-soft)] p-2.5 text-[var(--accent)]">{icon}</div>}
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="max-w-full">{action}</div>}
    </div>
  );
};

export default SectionHeader;
