import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useSensorStore } from '../../stores/sensorStore';
import socketService from '../../services/socket';
import { toast } from '../../components/ui/Toast';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip 
} from 'recharts';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Terminal, 
  Play, 
  Pause, 
  Trash2, 
  Gauge,
  Zap,
  Cable
} from 'lucide-react';

interface LogPacket {
  timestamp: string;
  payload: string;
}

export const LiveMonitoringView: React.FC = () => {
  const { sensors, history, socketConnected } = useSensorStore();

  const [latency, setLatency] = useState<number | null>(null);
  const [packetCount, setPacketCount] = useState(0);
  const [terminalLogs, setTerminalLogs] = useState<LogPacket[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Ping-pong latency tracker loops
  useEffect(() => {
    let pingInterval: NodeJS.Timeout;

    const handlePong = (sentTimestamp: number) => {
      const rtt = Date.now() - sentTimestamp;
      setLatency(rtt);
    };

    socketService.on('telemetry:pong', handlePong);

    if (socketConnected) {
      pingInterval = setInterval(() => {
        socketService.emit('telemetry:ping', Date.now());
      }, 2000);
    } else {
      setLatency(null);
    }

    return () => {
      clearInterval(pingInterval);
      socketService.off('telemetry:pong', handlePong);
    };
  }, [socketConnected]);

  // Log incoming packets dynamically
  useEffect(() => {
    const handleUpdate = (updatedSensors: any[]) => {
      setPacketCount(prev => prev + 1);

      if (!isPaused) {
        const payloadString = JSON.stringify(updatedSensors, null, 2);
        setTerminalLogs(prev => [
          { 
            timestamp: new Date().toLocaleTimeString(), 
            payload: payloadString 
          }, 
          ...prev
        ].slice(0, 50)); // Keep last 50 packets
      }
    };

    socketService.on('telemetry:update', handleUpdate);

    return () => {
      socketService.off('telemetry:update', handleUpdate);
    };
  }, [isPaused]);

  // Force socket reconnects manually
  const handleReconnect = () => {
    toast.info('Disconnecting telemetry socket...');
    socketService.disconnect();
    
    setTimeout(() => {
      toast.success('Attempting WebSocket connection...');
      socketService.connect();
    }, 1000);
  };

  // Derive charts coordinates
  const activePower = useMemo(() => sensors.find(s => s.id === 'sns-001')?.value || 0, [sensors]);
  const powerW = useMemo(() => Math.round(activePower * 1000), [activePower]);
  
  const voltage = useMemo(() => {
    const baseline = 229.4;
    const variance = (activePower / 100) * (Math.random() - 0.5);
    return parseFloat((baseline + variance).toFixed(1));
  }, [activePower]);

  const current = useMemo(() => {
    if (powerW === 0) return 0;
    return parseFloat((powerW / voltage).toFixed(2));
  }, [powerW, voltage]);

  const chartData = useMemo(() => {
    const powerPoints = history['sns-001'] || [];
    return powerPoints.map(p => {
      const timeStr = new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const pW = p.value * 1000;
      const vVal = parseFloat((229.4 + (p.value / 100) * (Math.random() - 0.5)).toFixed(1));
      const cVal = vVal === 0 ? 0 : parseFloat((pW / vVal).toFixed(2));

      return {
        time: timeStr,
        power: pW,
        voltage: vVal,
        current: cVal
      };
    });
  }, [history]);

  return (
    <div className="flex flex-col gap-6">
      
      {/* Page Header */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            Live Telemetry Diagnostics
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">High-frequency physical parameters streaming</p>
        </div>

        <button 
          onClick={handleReconnect}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-[10px] font-semibold text-slate-300 transition-colors uppercase tracking-wider"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Manual Reconnect
        </button>
      </section>

      {/* Diagnostics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Connection status */}
        <div className="glass-panel rounded-xl p-4 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Websocket Uplink</span>
            <span className="text-sm font-bold text-slate-200">
              {socketConnected ? 'Connected' : 'Offline'}
            </span>
          </div>
          {socketConnected ? (
            <Wifi className="w-6 h-6 text-emerald-400" />
          ) : (
            <WifiOff className="w-6 h-6 text-red-400 animate-pulse" />
          )}
        </div>

        {/* Latency */}
        <div className="glass-panel rounded-xl p-4 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Network Latency</span>
            <span className="text-sm font-bold text-slate-200">
              {latency !== null ? `${latency} ms` : 'Evaluating...'}
            </span>
          </div>
          <Activity className="w-6 h-6 text-violet-400" />
        </div>

        {/* Packets count */}
        <div className="glass-panel rounded-xl p-4 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Telemetry Packets</span>
            <span className="text-sm font-bold text-slate-200">{packetCount} items</span>
          </div>
          <Terminal className="w-6 h-6 text-blue-400" />
        </div>

        {/* Diagnostic Status */}
        <div className="glass-panel rounded-xl p-4 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Data Stream integrity</span>
            <span className="text-sm font-bold text-slate-200">
              {socketConnected ? '100% Stable' : '0% Unavailable'}
            </span>
          </div>
          <Gauge className="w-6 h-6 text-emerald-400" />
        </div>
      </div>

      {/* Main Layout: Waveforms & Command Console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Waveforms - Left 2 Columns */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Active Power waveforms */}
          <div className="glass-panel rounded-xl p-5 flex flex-col h-60">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-emerald-400" />
                Active Load Profile (W)
              </span>
              <span className="text-[10px] font-bold text-slate-100">{powerW} W</span>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="livePowerColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={9} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: '#030712', borderColor: '#1e293b', fontSize: '10px' }} />
                  <Area type="monotone" dataKey="power" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#livePowerColor)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Voltage and Current side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Voltage line chart */}
            <div className="glass-panel rounded-xl p-5 flex flex-col h-56">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Cable className="w-4 h-4 text-blue-400" />
                  Voltage Line (V)
                </span>
                <span className="text-[10px] text-slate-100 font-bold">{voltage} V</span>
              </div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="liveVoltColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#475569" fontSize={8} tickLine={false} axisLine={false} />
                    <YAxis stroke="#475569" fontSize={8} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ backgroundColor: '#030712', borderColor: '#1e293b', fontSize: '10px' }} />
                    <Area type="monotone" dataKey="voltage" stroke="#3b82f6" strokeWidth={1.5} fillOpacity={1} fill="url(#liveVoltColor)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Current line chart */}
            <div className="glass-panel rounded-xl p-5 flex flex-col h-56">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-red-400" />
                  Current load (A)
                </span>
                <span className="text-[10px] text-slate-100 font-bold">{current} A</span>
              </div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="liveCurrColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#475569" fontSize={8} tickLine={false} axisLine={false} />
                    <YAxis stroke="#475569" fontSize={8} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ backgroundColor: '#030712', borderColor: '#1e293b', fontSize: '10px' }} />
                    <Area type="monotone" dataKey="current" stroke="#ef4444" strokeWidth={1.5} fillOpacity={1} fill="url(#liveCurrColor)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>

        {/* Live Terminal Console - Right 1 Column */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col h-[528px] overflow-hidden">
          {/* Header controls */}
          <div className="flex items-center justify-between mb-4 border-b border-slate-900 pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-200">WSS Event Console</span>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Play Pause button */}
              <button 
                onClick={() => setIsPaused(!isPaused)}
                className={`p-1.5 rounded bg-slate-900 border border-slate-800 transition-colors ${
                  isPaused ? 'text-amber-400 hover:text-amber-300' : 'text-slate-400 hover:text-slate-200'
                }`}
                title={isPaused ? 'Resume Logging' : 'Pause Logging'}
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
              
              {/* Clear button */}
              <button 
                onClick={() => setTerminalLogs([])}
                className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 transition-colors"
                title="Clear Terminal logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Scrolling log feed */}
          <div className="flex-1 overflow-y-auto font-mono text-[9px] text-emerald-400 space-y-4 pr-1.5 scrollbar-thin">
            {terminalLogs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-600">
                Listening for socket packets...
              </div>
            ) : (
              terminalLogs.map((log, idx) => (
                <div key={idx} className="border-b border-slate-900/40 pb-2">
                  <div className="flex items-center justify-between text-slate-500 mb-1.5 font-bold">
                    <span>EVENT: telemetry:update</span>
                    <span>{log.timestamp}</span>
                  </div>
                  <pre className="overflow-x-auto text-[8px] bg-black/40 p-2.5 rounded-lg border border-slate-900 max-h-36">
                    {log.payload}
                  </pre>
                </div>
              ))
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>

      </div>

    </div>
  );
};
export default LiveMonitoringView;
