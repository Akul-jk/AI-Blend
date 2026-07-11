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
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map(t => {
        let bgColor = 'bg-slate-900 border-slate-800';
        let icon = <Info className="w-5 h-5 text-blue-400" />;
        
        switch (t.type) {
          case 'success':
            bgColor = 'bg-slate-900/90 border-emerald-500/20 text-emerald-100 shadow-emerald-950/10';
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
            break;
          case 'error':
            bgColor = 'bg-slate-900/90 border-red-500/20 text-red-100 shadow-red-950/10';
            icon = <AlertCircle className="w-5 h-5 text-red-400" />;
            break;
          case 'warning':
            bgColor = 'bg-slate-900/90 border-amber-500/20 text-amber-100 shadow-amber-950/10';
            icon = <AlertTriangle className="w-5 h-5 text-amber-400" />;
            break;
          case 'info':
          default:
            bgColor = 'bg-slate-900/90 border-violet-500/20 text-violet-100 shadow-violet-950/10';
            icon = <Info className="w-5 h-5 text-violet-400" />;
        }

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-xl transition-all duration-300 animate-slide-in ${bgColor}`}
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
