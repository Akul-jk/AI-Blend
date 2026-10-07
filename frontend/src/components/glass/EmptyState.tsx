import React from 'react';
import { Search } from 'lucide-react';
import GlassCard from './GlassCard';
import { cn } from './GlassCard';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message: string;
  action?: React.ReactNode;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message, action, className }) => {
  return (
    <GlassCard className={cn("flex flex-col items-center justify-center p-8 text-center", className)}>
      <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-4">
        {icon || <Search className="w-8 h-8" />}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400 max-w-sm mb-6">{message}</p>
      {action && <div>{action}</div>}
    </GlassCard>
  );
};

export default EmptyState;
