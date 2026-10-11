import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

type ToastCallback = (toast: ToastItem) => void;
const listeners = new Set<ToastCallback>();

export const toast = {
  show(message: string, type: ToastType = 'info', duration = 4000) {
    const id = Math.random().toString(36).substring(2, 9);
    const item: ToastItem = { id, message, type, duration };
    listeners.forEach(cb => cb(item));
    return id;
  },
  success(message: string, duration = 4000) {
    return this.show(message, 'success', duration);
  },
  error(message: string, duration = 5000) {
    return this.show(message, 'error', duration);
  },
  info(message: string, duration = 4000) {
    return this.show(message, 'info', duration);
  },
  warning(message: string, duration = 4000) {
    return this.show(message, 'warning', duration);
  }
};

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleAddToast = (newToast: ToastItem) => {
      setToasts(prev => [...prev, newToast]);
      
      const delay = newToast.duration || 4000;
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newToast.id));
      }, delay);
    };

    listeners.add(handleAddToast);
    return () => {
      listeners.delete(handleAddToast);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3 pointer-events-none sm:bottom-6 sm:right-6">
      {toasts.map(t => {
        let bgColor = 'border-[var(--line)] text-[var(--text-primary)]';
        let icon = <Info className="w-5 h-5 text-[var(--accent)]" />;
        
        switch (t.type) {
          case 'success':
            bgColor = 'border-emerald-500/25 text-[var(--text-primary)]';
            icon = <CheckCircle2 className="w-5 h-5 text-[var(--green)]" />;
            break;
          case 'error':
            bgColor = 'border-rose-500/25 text-[var(--text-primary)]';
            icon = <AlertCircle className="w-5 h-5 text-[var(--danger)]" />;
            break;
          case 'warning':
            bgColor = 'border-amber-500/25 text-[var(--text-primary)]';
            icon = <AlertTriangle className="w-5 h-5 text-[var(--warning)]" />;
            break;
          case 'info':
          default:
            bgColor = 'border-violet-500/25 text-[var(--text-primary)]';
            icon = <Info className="w-5 h-5 text-[var(--violet)]" />;
        }

        return (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-[var(--surface)] p-4 shadow-[var(--shadow)] backdrop-blur-md transition-all duration-300 animate-slide-in ${bgColor}`}
          >
            <div className="mt-0.5 flex-shrink-0">{icon}</div>
            <div className="flex-1 text-sm font-medium pr-2 break-words">{t.message}</div>
            <button
              onClick={() => removeToast(t.id)}
              className="mt-0.5 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
