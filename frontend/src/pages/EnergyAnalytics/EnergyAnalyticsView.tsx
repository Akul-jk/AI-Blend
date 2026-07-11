import React from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip 
} from 'recharts';
import { 
  BarChart3
} from 'lucide-react';

export const EnergyAnalyticsView: React.FC = () => {
  // Weekly Consumption Bar Chart
  const weeklyData = [
    { day: 'Mon', usage: 8.4 },
    { day: 'Tue', usage: 7.9 },
    { day: 'Wed', usage: 9.1 },
    { day: 'Thu', usage: 8.2 },
    { day: 'Fri', usage: 10.5 },
    { day: 'Sat', usage: 6.8 },
    { day: 'Sun', usage: 7.2 }
  ];

  // Daily Load Profile Peak vs Base Load
  const dailyLoadProfile = [
    { hour: '00:00', BaseLoad: 0.12, PeakLoad: 0.12 },
    { hour: '04:00', BaseLoad: 0.10, PeakLoad: 0.10 },
    { hour: '08:00', BaseLoad: 0.15, PeakLoad: 0.38 },
    { hour: '12:00', BaseLoad: 0.15, PeakLoad: 0.45 },
    { hour: '16:00', BaseLoad: 0.15, PeakLoad: 0.32 },
    { hour: '20:00', BaseLoad: 0.18, PeakLoad: 0.68 }, // Peak demand hour
    { hour: '23:59', BaseLoad: 0.14, PeakLoad: 0.14 }
  ];

  // Cost distribution pie chart
  const costBreakdown = [
    { name: 'HVAC HVAC Load', value: 45, color: '#10b981' },
    { name: 'Lighting Arrays', value: 20, color: '#8b5cf6' },
    { name: 'Server Lab Nodes', value: 25, color: '#3b82f6' },
    { name: 'Standby Loads', value: 10, color: '#f59e0b' }
  ];

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            Energy Analytics & Bill Audit
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Explore peak demand ratios and HVAC load distributions</p>
        </div>
      </section>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-xl p-4 flex flex-col justify-between min-h-24">
          <span className="text-[10px] text-slate-500 uppercase font-semibold">Peak Demand Load</span>
          <div className="mt-3">
            <span className="text-xl font-bold text-slate-100">0.68 kW</span>
            <span className="text-[9px] text-slate-500 block mt-1">Recorded at 08:15 PM</span>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-4 flex flex-col justify-between min-h-24">
          <span className="text-[10px] text-slate-500 uppercase font-semibold">Base Idle Load</span>
          <div className="mt-3">
            <span className="text-xl font-bold text-slate-100">0.12 kW</span>
            <span className="text-[9px] text-emerald-400 block mt-1 font-semibold">🟢 Optimized</span>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-4 flex flex-col justify-between min-h-24">
          <span className="text-[10px] text-slate-500 uppercase font-semibold">Avg Energy Tariff</span>
          <div className="mt-3">
            <span className="text-xl font-bold text-slate-100">₹6.50 / Unit</span>
            <span className="text-[9px] text-slate-500 block mt-1">Local Industrial Rate</span>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-4 flex flex-col justify-between min-h-24">
          <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Savings</span>
          <div className="mt-3">
            <span className="text-xl font-bold text-emerald-400">₹260.00 Saved</span>
            <span className="text-[9px] text-slate-500 block mt-1">This billing cycle</span>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Weekly usage - Left 2 Columns */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 flex flex-col h-72">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-4">Weekly Consumption Profile (kWh)</span>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <XAxis dataKey="day" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#030712', borderColor: '#1e293b', fontSize: '10px' }} />
                <Bar dataKey="usage" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost Breakdown Pie */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col h-72 justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Zone Cost Distribution</span>
          
          <div className="flex-1 min-h-0 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={costBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {costBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#030712', borderColor: '#1e293b', fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[9px] text-slate-400 font-mono mt-3">
            {costBreakdown.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span>{item.name} ({item.value}%)</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Grid: Daily Load Profile */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col h-72">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-4">Daily Load Profiler: Peak vs Base Load</span>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyLoadProfile}>
              <XAxis dataKey="hour" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
              <YAxis stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#030712', borderColor: '#1e293b', fontSize: '10px' }} />
              <Area type="monotone" dataKey="PeakLoad" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.05} strokeWidth={1.5} />
              <Area type="monotone" dataKey="BaseLoad" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.05} strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};
export default EnergyAnalyticsView;
