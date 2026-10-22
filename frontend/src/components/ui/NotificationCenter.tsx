import React, { useState, useRef, useEffect } from 'react';
import { Bell, AlertOctagon, CheckCircle2, WifiOff } from 'lucide-react';
import { useAlertStore } from '../../stores/alertStore';
import { useSensorStore } from '../../stores/sensorStore';
import { toast } from './Toast';
import { fetchAlerts, resolveAlert as resolveAlertRequest } from '../../services/api';

export const NotificationCenter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { alerts, setAlerts, resolveAlert } = useAlertStore();
  const { socketConnected } = useSensorStore();

  const activeAlerts = alerts.filter(a => !a.resolved);
  const unreadCount = activeAlerts.length;

  useEffect(() => {
    fetchAlerts().then(response => setAlerts(response.data)).catch(() => {});
    // Click outside handler
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setAlerts]);

  const handleResolveAll = async () => {
    try {
      await Promise.all(activeAlerts.map(alert => resolveAlertRequest(alert.id)));
      activeAlerts.forEach(alert => resolveAlert(alert.id));
      toast.success('All notifications marked as resolved.');
      setIsOpen(false);
    } catch {
      toast.error('Some notifications could not be resolved. Open Alert Center to retry.');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
      >
        <Bell className="w-4 h-4" />

        {/* Unread badge dot */}
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 glass-panel rounded-xl border border-slate-900 bg-slate-950/95 shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-900/80 flex items-center justify-between">
            <span className="font-bold text-xs text-slate-200 uppercase tracking-wider">Alarms & Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleResolveAll}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold"
              >
                Clear all
              </button>
            )}
          </div>

          {/* List Container */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-900">
            {/* Connection Offline Status indicator */}
            {!socketConnected && (
              <div className="p-3.5 bg-red-500/5 text-red-400 flex items-start gap-2.5 text-xs">
                <WifiOff className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Telemetry Disconnected</p>
                  <p className="text-slate-500 text-[10px] mt-0.5 leading-normal">The WebSocket data feed is offline. Retrying socket reconnects...</p>
                </div>
              </div>
            )}

            {alerts.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-xs">
                <CheckCircle2 className="w-6 h-6 text-slate-700 mb-2" />
                <p>System operational</p>
                <p className="text-[10px] text-slate-600 mt-0.5">No anomaly alerts active</p>
              </div>
            ) : (
              alerts.map(a => (
                <div
                  key={a.id}
                  className={`p-3.5 flex items-start gap-3 transition-colors ${
                    a.resolved
                      ? 'bg-slate-950/20 text-slate-500'
                      : a.severity === 'critical'
                        ? 'bg-red-500/5 hover:bg-red-500/10 text-red-200'
                        : 'bg-amber-500/5 hover:bg-amber-500/10 text-amber-200'
                  }`}
                >
                  <AlertOctagon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    a.resolved
                      ? 'text-slate-700'
                      : a.severity === 'critical'
                        ? 'text-red-400'
                        : 'text-amber-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-xs leading-normal ${a.resolved ? 'line-through text-slate-600' : ''}`}>
                      {a.severity.toUpperCase()} ALERT
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-normal break-words">{a.message}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[9px] text-slate-600 font-mono">
                        {new Date(a.timestamp).toLocaleTimeString()}
                      </span>
                      {!a.resolved && (
                        <button
                          onClick={() => {
                            resolveAlertRequest(a.id).then(() => { resolveAlert(a.id); toast.success('Alert resolved.'); }).catch(() => toast.error('Alert could not be resolved. Please retry.'));
                          }}
                          className="text-[9px] text-emerald-400 hover:underline font-medium"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default NotificationCenter;
