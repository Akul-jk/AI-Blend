import React from 'react';
import GlassCard from './GlassCard';
import { cn } from './GlassCard';

interface GlassPanelProps extends Omit<React.ComponentProps<typeof GlassCard>, 'children'> {
  children?: React.ReactNode;
  title?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

const GlassPanel: React.FC<GlassPanelProps> = ({ title, icon, action, children, className, ...props }) => {
  return (
    <GlassCard className={cn('p-6 flex flex-col', className)} {...props}>
      {(title || icon || action) && (
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--line)]">
          <div className="flex items-center gap-3">
            {icon && <span className="text-[var(--accent)]">{icon}</span>}
            {title && <h3 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">{title}</h3>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="flex-1 min-h-0">{children}</div>
    </GlassCard>
  );
};

export default GlassPanel;
