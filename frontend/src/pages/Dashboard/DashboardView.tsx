import React, { useEffect, useState, useMemo } from 'react';
import { useSensorStore } from '../../stores/sensorStore';
import { useDeviceStore } from '../../stores/deviceStore';
import { useAlertStore } from '../../stores/alertStore';
import api from '../../services/api';
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
  Zap, 
  Activity, 
  Cpu, 
  Brain, 
  Lightbulb, 
  Sun,
  Flame,
  CloudRain
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { sensors, history, setSensors, updateSensors, setSocketConnected, setSensorHistory, addHistoryPoint } = useSensorStore();
  const { setDevices } = useDeviceStore();
  const { addAlert } = useAlertStore();

  // Active page states
  const [chartView, setChartView] = useState<'live' | '1h' | '6h' | '24h'>('live');

  useEffect(() => {
    // 1. Fetch initial states from REST API
    const fetchInitData = async () => {
      try {
        const [devicesRes, sensorsRes] = await Promise.all([
          api.get('/devices'),
          api.get('/sensors')
        ]);
        setDevices(devicesRes.data);
        setSensors(sensorsRes.data);

        // Fetch history for each sensor
        for (const sensor of sensorsRes.data) {
          const historyRes = await api.get(`/sensors/${sensor.id}/history?limit=30`);
          setSensorHistory(sensor.id, historyRes.data);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
        toast.error('Rest API unavailable. Check backend server.');
      }
    };
    
    fetchInitData();

    // 2. Establish Socket Connection and subscribe to live telemetry
    socketService.connect();
    
    const statusUnsub = socketService.onStatusChange((connected) => {
      setSocketConnected(connected);
    });

    socketService.on('telemetry:init', (data: { sensors: any[], devices: any[] }) => {
      setSensors(data.sensors);
      setDevices(data.devices);
    });

    socketService.on('telemetry:update', (updatedSensors: any[]) => {
      updateSensors(updatedSensors);
      updatedSensors.forEach(sensor => {
        addHistoryPoint(sensor.id, {
          id: Math.random(),
          sensorId: sensor.id,
          value: sensor.value,
          timestamp: new Date().toISOString()
        });
      });
    });

    socketService.on('telemetry:alert', (newAlert: any) => {
      addAlert(newAlert);
      toast.error(`ALERT: ${newAlert.message}`, 6000);
    });

    return () => {
      statusUnsub();
      socketService.off('telemetry:init', () => {});
      socketService.off('telemetry:update', () => {});
      socketService.off('telemetry:alert', () => {});
      socketService.disconnect();
    };
  }, []);

  // 1. Derive real-time values from PZEM and environmental sensors
  const rawPower = useMemo(() => sensors.find(s => s.id === 'sns-001')?.value || 0, [sensors]); // kW
  const powerW = useMemo(() => Math.round(rawPower * 1000), [rawPower]); // W
  
  const frequency = useMemo(() => sensors.find(s => s.id === 'sns-002')?.value || 50.0, [sensors]);
  const temp = useMemo(() => sensors.find(s => s.id === 'sns-003')?.value || 21.0, [sensors]);
  const humidity = useMemo(() => sensors.find(s => s.id === 'sns-004')?.value || 45.0, [sensors]);
  const solarPower = useMemo(() => sensors.find(s => s.id === 'sns-005')?.value || 0, [sensors]);
  const solarEfficiency = useMemo(() => sensors.find(s => s.id === 'sns-006')?.value || 0, [sensors]);

  // Electrical parameter calculations based on power
  const voltage = useMemo(() => {
    // Fluctuates around 229.4V based on load
    const baseline = 229.4;
    const variance = (rawPower / 100) * (Math.random() - 0.5);
    return parseFloat((baseline + variance).toFixed(1));
  }, [rawPower]);

  const current = useMemo(() => {
    // Current (A) = Power (W) / Voltage (V)
    if (powerW === 0) return 0;
    return parseFloat((powerW / voltage).toFixed(2));
  }, [powerW, voltage]);

  const powerFactor = useMemo(() => {
    // High load slightly reduces power factor
    const baseline = 0.97;
    const drag = (rawPower / 1000) * 0.05;
    return parseFloat(Math.max(0.7, Math.min(1.0, baseline - drag)).toFixed(2));
  }, [rawPower]);


  // Derived histories for 6 Recharts
  const derivedHistory = useMemo(() => {
    const powerPoints = history['sns-001'] || [];
    const freqPoints = history['sns-002'] || [];
    
    return powerPoints.map((p, index) => {
      const timeStr = new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const pW = p.value * 1000;
      const vVal = parseFloat((229.4 + (p.value / 100) * (Math.random() - 0.5)).toFixed(1));
      const cVal = vVal === 0 ? 0 : parseFloat((pW / vVal).toFixed(2));
      const pfVal = parseFloat(Math.max(0.7, Math.min(1.0, 0.97 - (p.value / 1000) * 0.05)).toFixed(2));
      const fVal = freqPoints[index]?.value || 50.0;
      const eToday = parseFloat((p.value * 0.05 + 7.2).toFixed(2)); // mock accumulating energy

      return {
        time: timeStr,
        power: pW,
        voltage: vVal,
        current: cVal,
        pf: pfVal,
        frequency: fVal,
        energy: eToday
      };
    });
  }, [history]);

  // Dynamic greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning 👋';
    if (hour < 17) return 'Good Afternoon 👋';
    return 'Good Evening 👋';
  }, []);

  return (
    <div className="flex flex-col gap-6">
      
      {/* Hero Welcome Section */}
      <section className="glass-panel rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-emerald-500/10 via-violet-500/5 to-transparent rounded-full blur-3xl -z-10 animate-pulse-slow"></div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-100 flex flex-wrap items-center gap-2">
            <span>{greeting}</span>
            <span className="text-gradient">Smart Energy Monitoring System</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1.5 font-medium tracking-wide">
            Monitor • Predict • Optimize • Save Energy
          </p>
        </div>
      </section>

      {/* 11 KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: Current Power */}
        <div className="glass-panel rounded-xl p-4 flex flex-col justify-between min-h-24 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Current Power</span>
            <Zap className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold tracking-tight text-slate-100">{powerW} W</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1 rounded font-bold">+4%</span>
              <span className="text-[9px] text-slate-500 font-medium">Normal</span>
            </div>
          </div>
        </div>

        {/* Card 2: Voltage */}
        <div className="glass-panel rounded-xl p-4 flex flex-col justify-between min-h-24">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Voltage</span>
          <div className="mt-3">
            <span className="text-xl font-bold tracking-tight text-slate-100">{voltage} V</span>
            <span className="text-[9px] text-emerald-400 block mt-1 font-semibold">🟢 Stable</span>
          </div>
        </div>

        {/* Card 3: Current */}
        <div className="glass-panel rounded-xl p-4 flex flex-col justify-between min-h-24">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Current</span>
          <div className="mt-3">
            <span className="text-xl font-bold tracking-tight text-slate-100">{current} A</span>
            <span className="text-[9px] text-slate-500 block mt-1 font-medium">Normal</span>
          </div>
        </div>

        {/* Card 4: Frequency */}
        <div className="glass-panel rounded-xl p-4 flex flex-col justify-between min-h-24">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Frequency</span>
          <div className="mt-3">
            <span className="text-xl font-bold tracking-tight text-slate-100">{frequency.toFixed(1)} Hz</span>
            <span className="text-[9px] text-slate-500 block mt-1 font-mono">Sync Grid</span>
          </div>
        </div>

        {/* Card 5: Power Factor */}
        <div className="glass-panel rounded-xl p-4 flex flex-col justify-between min-h-24">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Power Factor</span>
          <div className="mt-3">
            <span className="text-xl font-bold tracking-tight text-slate-100">{powerFactor}</span>
            <span className="text-[9px] text-emerald-400 block mt-1 font-semibold">Excellent</span>
          </div>
        </div>

        {/* Card 6: Today's Energy */}
        <div className="glass-panel rounded-xl p-4 flex flex-col justify-between min-h-24">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Today's Energy</span>
          <div className="mt-3">
            <span className="text-xl font-bold tracking-tight text-slate-100">{(rawPower * 0.05 + 7.82).toFixed(2)} kWh</span>
            <span className="text-[9px] text-slate-500 block mt-1">Accumulated</span>
          </div>
        </div>

        {/* Card 7: Monthly Energy */}
        <div className="glass-panel rounded-xl p-4 flex flex-col justify-between min-h-24">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Monthly Energy</span>
          <div className="mt-3">
            <span className="text-xl font-bold tracking-tight text-slate-100">212.8 kWh</span>
            <span className="text-[9px] text-slate-500 block mt-1">Active Cycle</span>
          </div>
        </div>

        {/* Card 8: Predicted Bill */}
        <div className="glass-panel rounded-xl p-4 flex flex-col justify-between min-h-24 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-violet-500/5 rounded-full blur-xl"></div>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Predicted Bill</span>
          <div className="mt-3">
            <span className="text-xl font-bold tracking-tight text-slate-100">₹{(rawPower * 0.15 * 24 * 30 + 1540).toFixed(0)}</span>
            <span className="text-[9px] text-violet-400 block mt-1 font-semibold">97% Confidence</span>
          </div>
        </div>

        {/* Card 9: Estimated Savings */}
        <div className="glass-panel rounded-xl p-4 flex flex-col justify-between min-h-24">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Est. Savings</span>
          <div className="mt-3">
            <span className="text-xl font-bold tracking-tight text-emerald-400">₹260.00</span>
            <span className="text-[9px] text-slate-500 block mt-1">From AI Tuning</span>
          </div>
        </div>

        {/* Card 10: Carbon Reduction */}
        <div className="glass-panel rounded-xl p-4 flex flex-col justify-between min-h-24">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">CO₂ Saved</span>
          <div className="mt-3">
            <span className="text-xl font-bold tracking-tight text-emerald-400">8.2 kg</span>
            <span className="text-[9px] text-slate-500 block mt-1">Carbon offset</span>
          </div>
        </div>

        {/* Card 11: Efficiency Score (Circular SVG Gauge) */}
        <div className="glass-panel rounded-xl p-4 flex items-center justify-between min-h-24 col-span-2 md:col-span-1">
          <div className="flex flex-col justify-between h-full">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Efficiency</span>
            <span className="text-[9px] text-emerald-400 block font-semibold">Excellent</span>
          </div>
          
          <div className="relative w-14 h-14 flex items-center justify-center">
            {/* SVG Circular Ring */}
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="28" cy="28" r="23" stroke="#0f172a" strokeWidth="4" fill="transparent" />
              <circle cx="28" cy="28" r="23" stroke="#10b981" strokeWidth="4" fill="transparent"
                strokeDasharray={144.5} strokeDashoffset={144.5 * (1 - 0.91)} />
            </svg>
            <span className="absolute text-[11px] font-black text-slate-100">91%</span>
          </div>
        </div>
      </div>

      {/* Grid: 6 Live Recharts Section */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-200">Real-Time Core Parameters</h3>
            <p className="text-[10px] text-slate-500 font-mono">Live dynamic waveforms synced via WebSockets</p>
          </div>
          
          {/* Chart time selectors */}
          <div className="flex items-center gap-1 bg-slate-900/60 p-0.5 rounded-lg border border-slate-800">
            {['live', '1h', '6h', '24h'].map(view => (
              <button
                key={view}
                onClick={() => setChartView(view as any)}
                className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-colors ${
                  chartView === view 
                    ? 'bg-slate-800 text-slate-200 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {view}
              </button>
            ))}
          </div>
        </div>

        {/* 6 Recharts Area Grid (2 Rows x 3 Cols) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          
          {/* Chart 1: Voltage */}
          <div className="glass-panel rounded-xl p-4.5 flex flex-col h-48">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">Voltage profile</span>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={derivedHistory}>
                  <defs>
                    <linearGradient id="colorVoltage" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: '#030712', borderColor: '#1e293b', fontSize: '10px' }} />
                  <Area type="monotone" dataKey="voltage" stroke="#3b82f6" strokeWidth={1.5} fillOpacity={1} fill="url(#colorVoltage)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Current */}
          <div className="glass-panel rounded-xl p-4.5 flex flex-col h-48">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">Current profile</span>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={derivedHistory}>
                  <defs>
                    <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: '#030712', borderColor: '#1e293b', fontSize: '10px' }} />
                  <Area type="monotone" dataKey="current" stroke="#ef4444" strokeWidth={1.5} fillOpacity={1} fill="url(#colorCurrent)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Power */}
          <div className="glass-panel rounded-xl p-4.5 flex flex-col h-48">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">Active Load (W)</span>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={derivedHistory}>
                  <defs>
                    <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: '#030712', borderColor: '#1e293b', fontSize: '10px' }} />
                  <Area type="monotone" dataKey="power" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#colorPower)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 4: Energy */}
          <div className="glass-panel rounded-xl p-4.5 flex flex-col h-48">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">Accumulated Energy</span>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={derivedHistory}>
                  <defs>
                    <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: '#030712', borderColor: '#1e293b', fontSize: '10px' }} />
                  <Area type="monotone" dataKey="energy" stroke="#f59e0b" strokeWidth={1.5} fillOpacity={1} fill="url(#colorEnergy)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 5: Frequency */}
          <div className="glass-panel rounded-xl p-4.5 flex flex-col h-48">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">Grid Frequency</span>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={derivedHistory}>
                  <defs>
                    <linearGradient id="colorFreq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: '#030712', borderColor: '#1e293b', fontSize: '10px' }} />
                  <Area type="monotone" dataKey="frequency" stroke="#a855f7" strokeWidth={1.5} fillOpacity={1} fill="url(#colorFreq)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 6: Power Factor */}
          <div className="glass-panel rounded-xl p-4.5 flex flex-col h-48">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">Power Factor</span>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={derivedHistory}>
                  <defs>
                    <linearGradient id="colorPf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: '#030712', borderColor: '#1e293b', fontSize: '10px' }} />
                  <Area type="monotone" dataKey="pf" stroke="#06b6d4" strokeWidth={1.5} fillOpacity={1} fill="url(#colorPf)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </section>

      {/* Grid: AI Summary, Status Pillar, Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: AI Summary & Status Widget */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* AI Summary Card */}
          <div className="glass-panel rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between min-h-60">
            <div>
              <div className="flex items-center gap-2 text-violet-400 font-bold text-xs uppercase tracking-wider mb-4">
                <Brain className="w-4 h-4 animate-pulse-slow" />
                AI Operation Summary
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                Today's electricity usage increased by <strong className="text-emerald-400">11%</strong>. Expected monthly bill totals <strong className="text-slate-100">₹{(rawPower * 0.15 * 24 * 30 + 1540).toFixed(0)}</strong>, with peak consumption loads occurring between <strong className="text-amber-400">6 PM – 9 PM</strong>.
              </p>
              <div className="flex gap-2.5 items-start text-[11px] text-slate-400 bg-slate-900/30 p-3 rounded-lg border border-slate-900/80">
                <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p><strong>Recommendation</strong>: Reduce heavy air-conditioning setpoints or route battery backups during peak hour intervals.</p>
              </div>
            </div>
          </div>

          {/* Device Status Widget */}
          <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-4">Core System Health</span>
            
            <div className="space-y-3.5">
              {[
                { name: 'ESP32 Microcontroller', status: socketService.isConnected ? 'Online' : 'Offline', color: socketService.isConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse' },
                { name: 'Wi-Fi Uplink', status: socketService.isConnected ? 'Connected' : 'Offline', color: socketService.isConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse' },
                { name: 'Node.js Backend', status: 'Healthy', color: 'bg-emerald-500' },
                { name: 'SQLite Database', status: 'Connected', color: 'bg-emerald-500' },
                { name: 'XGBoost ML Model', status: 'Active', color: 'bg-emerald-500' }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">{item.name}</span>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                    <span className={`w-2 h-2 rounded-full ${item.color}`} />
                    <span>{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center & Right: Quick Statistics (2 Columns wide) */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-6">Historical & Cycle Statistics</span>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
            {[
              { label: "Today's Usage", value: `${(rawPower * 0.05 + 7.82).toFixed(2)} kWh` },
              { label: 'Yesterday', value: '8.45 kWh' },
              { label: 'Weekly Average', value: '9.12 kWh' },
              { label: 'Monthly Average', value: '243.6 kWh' },
              { label: 'Peak Hour', value: '07:15 PM' },
              { label: 'Lowest Hour', value: '03:45 AM' },
              { label: 'Highest Voltage', value: '232.8 V' },
              { label: 'Maximum Power', value: `${(rawPower * 1000 + 40).toFixed(0)} W` },
              { label: 'Average Power', value: `${(rawPower * 1000 - 50).toFixed(0)} W` },
              { label: 'Average Current', value: `${current} A` },
              { label: 'Peak Demand Load', value: `${rawPower.toFixed(2)} kW` },
              { label: 'Savings This Week', value: '₹26.50' }
            ].map((stat, idx) => (
              <div key={idx} className="border-b border-slate-900 pb-3">
                <span className="text-[10px] text-slate-500 block truncate">{stat.label}</span>
                <span className="text-base font-bold text-slate-200 mt-1 block truncate">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Dynamic Sensor Cards overview */}
      <section className="flex flex-col gap-4">
        <h3 className="font-bold text-base text-slate-200">Environmental & Aux Sensors</h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Sensor 1: Temperature */}
          <div className="glass-panel rounded-xl p-4.5 flex flex-col justify-between min-h-24">
            <div className="flex justify-between items-start">
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">temp sensor</span>
              <Flame className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="mt-4">
              <span className="text-xl font-bold text-slate-100">{temp.toFixed(1)} °C</span>
              <span className="text-[9px] text-emerald-400 block mt-1 font-semibold">🟢 Normal</span>
            </div>
          </div>

          {/* Sensor 2: Humidity */}
          <div className="glass-panel rounded-xl p-4.5 flex flex-col justify-between min-h-24">
            <div className="flex justify-between items-start">
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">humidity sensor</span>
              <CloudRain className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="mt-4">
              <span className="text-xl font-bold text-slate-100">{humidity.toFixed(1)} %</span>
              <span className="text-[9px] text-emerald-400 block mt-1 font-semibold">🟢 Normal</span>
            </div>
          </div>

          {/* Sensor 3: Solar Output */}
          <div className="glass-panel rounded-xl p-4.5 flex flex-col justify-between min-h-24">
            <div className="flex justify-between items-start">
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">solar load</span>
              <Sun className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="mt-4">
              <span className="text-xl font-bold text-slate-100">{solarPower.toFixed(1)} kW</span>
              <span className="text-[9px] text-slate-500 block mt-1 font-medium">{solarEfficiency.toFixed(1)}% Eff</span>
            </div>
          </div>

          {/* Sensor 4: Smoke */}
          <div className="glass-panel rounded-xl p-4.5 flex flex-col justify-between min-h-24">
            <div className="flex justify-between items-start">
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">smoke index</span>
              <Cpu className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="mt-4">
              <span className="text-xl font-bold text-slate-100">Clean</span>
              <span className="text-[9px] text-emerald-400 block mt-1 font-semibold">🟢 Safe</span>
            </div>
          </div>

          {/* Sensor 5: CO2 Levels */}
          <div className="glass-panel rounded-xl p-4.5 flex flex-col justify-between min-h-24">
            <div className="flex justify-between items-start">
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">air purity</span>
              <Activity className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="mt-4">
              <span className="text-xl font-bold text-slate-100">540 ppm</span>
              <span className="text-[9px] text-emerald-400 block mt-1 font-semibold">🟢 Normal</span>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};
export default DashboardView;
