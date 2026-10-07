import React, { useState } from 'react';
import { trainModel } from '../../services/api';
import { toast } from '../../components/ui/Toast';
import { Play, Cpu, Activity } from 'lucide-react';

export const ModelTrainingView: React.FC = () => {
  const [training, setTraining] = useState(false);

  const handleTrain = async () => {
    setTraining(true);
    try {
      await trainModel();
      toast.success('Model training job started in background. Monitor FastAPI logs for progress.');
    } catch (err) {
      toast.error('Failed to trigger training job.');
    } finally {
      setTimeout(() => setTraining(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-2xl border border-slate-700/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-indigo-500/10 rounded-xl">
            <Cpu className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">LSTM Pipeline Training</h2>
            <p className="text-sm text-slate-400">Trigger background retraining on actual database telemetry</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6">
            <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Actual ML Pipeline Configuration
            </h3>

            <div className="space-y-4 text-sm">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-500">Algorithm</span>
                <span className="text-slate-300 font-mono font-bold">LSTM Sequence Model</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-500">Sequence Length</span>
                <span className="text-slate-300 font-mono">60</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-500">Batch Size</span>
                <span className="text-slate-300 font-mono">32</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-500">Maximum Epochs</span>
                <span className="text-slate-300 font-mono">100</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-500">Optimizer</span>
                <span className="text-slate-300 font-mono">Adam</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-500">Loss Function</span>
                <span className="text-slate-300 font-mono">MSE</span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleTrain}
          disabled={training}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)]"
        >
          <Play className="w-5 h-5" />
          {training ? 'Triggering...' : 'Trigger Model Retraining'}
        </button>
      </div>
    </div>
  );
};
