import React, { useEffect, useState, useRef } from 'react';
import api from '../../services/api';
import { toast } from '../../components/ui/Toast';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip 
} from 'recharts';
import { 
  Play, 
  Cpu, 
  Terminal, 
  LineChart as LineChartIcon,
  Activity,
  Gauge
} from 'lucide-react';

interface LossPoint {
  epoch: number;
  loss: number;
  accuracy: number;
}

export const ModelTrainingView: React.FC = () => {
  // Configuration states
  const [algorithm, setAlgorithm] = useState('LSTM');
  const [epochs, setEpochs] = useState(15);
  const [learningRate, setLearningRate] = useState(0.001);
  const [batchSize, setBatchSize] = useState(32);
  
  // Monitoring states
  const [training, setTraining] = useState(false);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [progressData, setProgressData] = useState<LossPoint[]>([]);
  
  // Edge server hardware meters (mock active cycles during training)
  const [sysMeters, setSysMeters] = useState({ cpu: 12, gpu: 0, ram: 4.8 });
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Simulate hardware loads and metrics progress during training
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (training) {
      // Hardware indicators jump during compilation
      setSysMeters({ cpu: 78, gpu: 84, ram: 6.2 });

      let step = 1;
      let currentLoss = 0.95;
      let currentAcc = 0.65;
      
      const newLogs = [`[INFO] Initializing dataset split...`, `[INFO] Building ${algorithm} layers on CUDA:0...`];
      setLogs(newLogs);
      setProgressData([]);

      interval = setInterval(() => {
        if (step <= epochs) {
          currentLoss = Math.max(0.05, parseFloat((currentLoss - (currentLoss * (0.15 + Math.random() * 0.1))).toFixed(3)));
          currentAcc = Math.min(0.99, parseFloat((currentAcc + (1 - currentAcc) * (0.15 + Math.random() * 0.1)).toFixed(3)));

          setProgressData(prev => [
            ...prev,
            { epoch: step, loss: currentLoss, accuracy: currentAcc }
          ]);

          setLogs(prev => [
            ...prev,
            `Epoch ${step}/${epochs} - loss: ${currentLoss.toFixed(4)} - accuracy: ${(currentAcc * 100).toFixed(1)}%`
          ]);

          setCurrentEpoch(step);
          setSysMeters({
            cpu: Math.round(70 + Math.random() * 15),
            gpu: Math.round(80 + Math.random() * 15),
            ram: parseFloat((6.2 + Math.random() * 0.4).toFixed(1))
          });

          step++;
        } else {
          // Completed training loop
          clearInterval(interval);
          setTraining(false);
          setSysMeters({ cpu: 14, gpu: 0, ram: 4.9 });
          setLogs(prev => [...prev, `[SUCCESS] Estimator weights exported. Model validation score completed.`, `[INFO] Deployment target prepared.`]);
          toast.success('Estimator training cycle completed successfully!');
        }
      }, 800);
    }

    return () => clearInterval(interval);
  }, [training, epochs, algorithm]);

  const handleStartTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    if (training) return;

    setTraining(true);
    try {
      // Fire REST request to log training action
      await api.post('/ml/train', {
        name: `${algorithm}-${Date.now().toString().slice(-4)}`,
        type: algorithm
      });
      toast.info(`Booting ${algorithm} training estimator loops...`);
    } catch (err) {
      console.error(err);
      toast.error('Connection failed to Edge hardware training server.');
      setTraining(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome Banner */}
      <section className="glass-panel rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-500/10 via-amber-500/5 to-transparent rounded-full blur-3xl -z-10"></div>
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            Hyperparameter Estimator Training
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Tune network weights, loss optimizers, and run local SGD fitting loops</p>
        </div>
      </section>

      {/* Grid: Configurations & Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Config Panel */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between h-fit">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-4">Training Setup</span>
          
          <form onSubmit={handleStartTraining} className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Algorithm</label>
              <select
                value={algorithm}
                onChange={e => setAlgorithm(e.target.value)}
                disabled={training}
                className="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-slate-200 text-xs focus:outline-none transition-colors appearance-none"
              >
                <option value="LSTM" className="bg-slate-950">LSTM (Best for time series)</option>
                <option value="XGBoost" className="bg-slate-950">XGBoost (Fast struct forecast)</option>
                <option value="Random Forest" className="bg-slate-950">Random Forest (Robust baseline)</option>
                <option value="GRU" className="bg-slate-950">GRU Network</option>
                <option value="ANN" className="bg-slate-950">Dense ANN MLP</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Epochs</label>
                <input
                  type="number"
                  value={epochs}
                  disabled={training}
                  onChange={e => setEpochs(Number(e.target.value))}
                  min={5}
                  max={50}
                  className="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-slate-200 text-xs focus:outline-none transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Batch Size</label>
                <select
                  value={batchSize}
                  disabled={training}
                  onChange={e => setBatchSize(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-slate-200 text-xs focus:outline-none transition-colors"
                >
                  <option value={16} className="bg-slate-950">16</option>
                  <option value={32} className="bg-slate-950">32</option>
                  <option value={64} className="bg-slate-950">64</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Learning Rate</label>
              <input
                type="number"
                step={0.0001}
                value={learningRate}
                disabled={training}
                onChange={e => setLearningRate(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-slate-200 text-xs focus:outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={training}
              className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-xs font-semibold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Play className="w-3.5 h-3.5" />
              {training ? `Fitting Epoch ${currentEpoch}...` : 'Start Estimator Training'}
            </button>
          </form>
        </div>

        {/* Console Logs Terminal & Host Metrics */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Hardware meters */}
          <div className="glass-panel rounded-2xl p-5 grid grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/5 border border-indigo-500/10 text-indigo-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-wider">Host CPU</span>
                <span className="text-sm font-bold text-slate-200">{sysMeters.cpu}%</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/5 border border-violet-500/10 text-violet-400">
                <Gauge className="w-5 h-5 animate-pulse-slow" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-wider">CUDA GPU</span>
                <span className="text-sm font-bold text-slate-200">{sysMeters.gpu}%</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/5 border border-cyan-500/10 text-cyan-400">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-wider">Sys RAM</span>
                <span className="text-sm font-bold text-slate-200">{sysMeters.ram} GB</span>
              </div>
            </div>
          </div>

          {/* Scrolling log console */}
          <div className="glass-panel rounded-2xl p-5 flex flex-col h-60 overflow-hidden">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-4 flex items-center gap-1.5">
              <Terminal className="w-4 h-4" />
              Training console logs
            </span>
            
            <div className="flex-1 overflow-y-auto font-mono text-[9px] text-indigo-400 space-y-2 pr-1.5 scrollbar-thin">
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600">
                  Awaiting SGD solver startup...
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="pb-1">
                    <span>{log}</span>
                  </div>
                ))
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>

      </div>

      {/* Accuracy & Loss Curves Section */}
      <section className="flex flex-col gap-4">
        <h3 className="font-bold text-base text-slate-200 flex items-center gap-2">
          <LineChartIcon className="w-5 h-5 text-indigo-400" />
          SGD Solver Convergence Curves
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Loss Curve */}
          <div className="glass-panel rounded-xl p-5 flex flex-col h-60">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-4">Loss reduction (MSE)</span>
            <div className="flex-1 min-h-0">
              {progressData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 text-xs">
                  Awaiting telemetry training cycles...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progressData}>
                    <XAxis dataKey="epoch" stroke="#475569" fontSize={9} />
                    <YAxis stroke="#475569" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#030712', borderColor: '#1e293b', fontSize: '10px' }} />
                    <Line type="monotone" dataKey="loss" stroke="#ef4444" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Accuracy Curve */}
          <div className="glass-panel rounded-xl p-5 flex flex-col h-60">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-4">R² Accuracy Score</span>
            <div className="flex-1 min-h-0">
              {progressData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 text-xs">
                  Awaiting telemetry training cycles...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progressData}>
                    <XAxis dataKey="epoch" stroke="#475569" fontSize={9} />
                    <YAxis stroke="#475569" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#030712', borderColor: '#1e293b', fontSize: '10px' }} />
                    <Line type="monotone" dataKey="accuracy" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};
export default ModelTrainingView;
