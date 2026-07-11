import React, { useEffect, useState } from 'react';
import { useAlertStore } from '../../stores/alertStore';
import api from '../../services/api';
import socketService from '../../services/socket';
import { toast } from '../../components/ui/Toast';
import { 
  AlertTriangle, 
  CheckCircle, 
  Trash2, 
  Clock, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export const AlertsView: React.FC = () => {
  const { alerts, setAlerts, resolveAlert, deleteAlert, addAlert } = useAlertStore();
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all');

  const fetchAlerts = async () => {
    try {
      const response = await api.get('/alerts');
      setAlerts(response.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to query alerts queue.');
    }
  };

  useEffect(() => {
    fetchAlerts();

    // Listen to live alerts
    const handleLiveAlert = (newAlert: any) => {
      addAlert(newAlert);
    };
    
    const handleAlertUpdate = (data: { id: number; status: string }) => {
      if (data.status === 'resolved') {
        resolveAlert(Number(data.id));
      }
    };

    socketService.on('telemetry:alert', handleLiveAlert);
    socketService.on('alert_update', handleAlertUpdate);

    return () => {
      socketService.off('telemetry:alert', handleLiveAlert);
      socketService.off('alert_update', handleAlertUpdate);
    };
  }, []);

  const handleResolve = async (id: number) => {
    try {
      await api.put(`/alerts/${id}`);
      resolveAlert(id);
      toast.success('Alert marked as resolved.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to resolve alert.');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/alerts/${id}`);
      deleteAlert(id);
      toast.success('Alert record cleared.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete alert.');
    }
  };

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'active') return !a.resolved;
    if (filter === 'resolved') return a.resolved;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Grid Anomaly Alert Timeline
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Chronological safety logs from PZEM and auxiliary modules</p>
        </div>

        {/* Filter Tab bar */}
        <div className="flex items-center gap-1 bg-slate-900/60 p-0.5 rounded-lg border border-slate-800">
          {(['all', 'active', 'resolved'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                filter === f 
                  ? 'bg-slate-800 text-slate-200 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </section>

      {/* Main timeline listing */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs font-mono">
            No anomaly logs in the current filter category.
          </div>
        ) : (
          <div className="relative border-l border-slate-900 pl-6 ml-4 space-y-6">
            {filteredAlerts.map(alert => (
              <div key={alert.id} className="relative group">
                {/* Bullet circle */}
                <span className={`absolute -left-9 top-1 w-6 h-6 rounded-full flex items-center justify-center border ${
                  alert.resolved 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                    : alert.severity === 'critical'
                    ? 'bg-red-500/10 border-red-500/20 text-red-400 animate-pulse'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                }`}>
                  {alert.resolved ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5" />
                  )}
                </span>

                {/* Content Panel */}
                <div className="glass-panel group-hover:border-slate-800 transition-all rounded-xl p-4.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-slate-200 text-sm">
                        {alert.severity === 'critical' ? '🔴 Critical Anomaly' : '🟡 Threshold Warning'}
                      </h4>
                      <span className="text-[10px] text-slate-500">•</span>
                      <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wide bg-slate-900 px-1.5 py-0.5 rounded border border-slate-900">
                        {alert.type} sensor
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{alert.message}</p>
                    <div className="flex items-center gap-1 text-[9px] text-slate-500 font-mono">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(alert.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {!alert.resolved && (
                      <button
                        onClick={() => handleResolve(alert.id)}
                        className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg transition-colors uppercase tracking-wider"
                      >
                        Resolve
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(alert.id)}
                      className="p-1.5 bg-slate-900 border border-slate-800 hover:border-red-500/30 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
                      title="Clear Alert record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
export default AlertsView;
