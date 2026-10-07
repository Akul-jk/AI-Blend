import React, { useState, useEffect } from 'react';
import { Brain, Activity, Sparkles } from 'lucide-react';
import { fetchAppliances, fetchApplianceTelemetry, predictEnergy } from '../../services/api';
import type { ApplianceWithDetails, TelemetryReading, MLPrediction } from '../../types';

export const PredictionsView: React.FC = () => {
  const [appliances, setAppliances] = useState<ApplianceWithDetails[]>([]);
  const [selectedApp, setSelectedApp] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [telemetry, setTelemetry] = useState<TelemetryReading[]>([]);
  const [prediction, setPrediction] = useState<MLPrediction | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAppliances().then(res => {
      setAppliances(res.data);
      if (res.data.length > 0) setSelectedApp(String(res.data[0].id));
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedApp) return;
    setLoading(true);
    setPrediction(null);
    setError('');

    // Auto refresh telemetry every 5s while waiting for 60 readings
    const fetchTel = () => {
      fetchApplianceTelemetry(selectedApp, { limit: 100 })
        .then(res => {
          const readings = res.data;
          setTelemetry(readings);

          if (readings.length >= 60) {
            // Sort by timestamp ascending for the model, as backend returns DESC
            const sortedReadings = [...readings].reverse();
            // Take the last 60 chronologically
            const recent60 = sortedReadings.slice(-60);

            predictEnergy(selectedApp, recent60)
              .then(predRes => {
                setPrediction(predRes.data);
                setLoading(false);
              })
              .catch(err => {
                setError(err.response?.data?.detail || 'Failed to generate prediction');
                setLoading(false);
              });
          } else {
            setLoading(false);
          }
        })
        .catch(() => {
          setError('Failed to fetch telemetry');
          setLoading(false);
        });
    };

    fetchTel();
    const interval = setInterval(() => {
      if (!prediction) fetchTel();
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedApp, prediction]);

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-2xl border border-slate-700/50">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Brain className="w-6 h-6 text-emerald-400" />
              LSTM Energy Forecaster
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Select an appliance to predict its next interval energy consumption using real simulation telemetry.
            </p>
          </div>
          <select
            className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200"
            value={selectedApp}
            onChange={e => setSelectedApp(e.target.value)}
          >
            {appliances.map(app => (
              <option key={app.id} value={app.id}>{app.name} ({app.pzem_id})</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
            <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Telemetry Buffer Status
            </h3>
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
              <span className="text-sm text-slate-400">Available Observations</span>
              <span className={`text-lg font-bold ${telemetry.length >= 60 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {telemetry.length} / 60
              </span>
            </div>
            {telemetry.length < 60 && (
              <p className="text-xs text-amber-400/80 mt-3 animate-pulse">
                Collecting telemetry — prediction available after 60 observations.
              </p>
            )}
          </div>

          <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
            <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Next Interval Prediction
            </h3>
            {prediction ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between">
                  <span className="text-sm text-slate-400">Forecasted Energy</span>
                  <span className="text-2xl font-bold text-emerald-400">{prediction.prediction.toFixed(6)} <span className="text-sm text-emerald-400/60">{prediction.unit}</span></span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <div className="bg-slate-800/50 p-2 rounded">
                    <span className="block mb-1">Model Version</span>
                    <span className="font-mono text-slate-300">{prediction.model_version}</span>
                  </div>
                  <div className="bg-slate-800/50 p-2 rounded">
                    <span className="block mb-1">Data Source</span>
                    <span className="font-mono text-slate-300">{prediction.source}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[100px] flex items-center justify-center text-slate-500 text-sm">
                {loading ? 'Processing sequence...' : 'Awaiting telemetry buffer...'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
