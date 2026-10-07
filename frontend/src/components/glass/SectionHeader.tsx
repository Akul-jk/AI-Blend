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
    <div className={cn("flex items-center justify-between mb-6", className)}>
      <div className="flex items-center gap-3">
        {icon && <div className="p-2 bg-white/5 rounded-lg border border-white/10 text-cyan-400">{icon}</div>}
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">{title}</h2>
          {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};

export default SectionHeader;
