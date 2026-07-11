import React, { useState, useMemo } from 'react';
import { useSensorStore } from '../../stores/sensorStore';
import api from '../../services/api';
import { toast } from '../../components/ui/Toast';
import { 
  Gauge, 
  Settings, 
  Sliders, 
  X, 
  Info,
  SlidersHorizontal
} from 'lucide-react';

export const SensorDashboardView: React.FC = () => {
  const { sensors, history, updateSensors } = useSensorStore();
  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(null);
  
  // Drawer threshold fields
  const [warningLow, setWarningLow] = useState<string>('');
  const [warningHigh, setWarningHigh] = useState<string>('');
  const [criticalLow, setCriticalLow] = useState<string>('');
  const [criticalHigh, setCriticalHigh] = useState<string>('');
  const [calibrationMultiplier, setCalibrationMultiplier] = useState<string>('1.0');
  const [saving, setSaving] = useState(false);

  const selectedSensor = useMemo(() => {
    return sensors.find(s => s.id === selectedSensorId) || null;
  }, [sensors, selectedSensorId]);

  // Derive historical metrics (min, max, avg) for each sensor
  const sensorStats = useMemo(() => {
    const stats: Record<string, { min: number; max: number; avg: number }> = {};
    
    sensors.forEach(sensor => {
      const points = history[sensor.id] || [];
      if (points.length === 0) {
        stats[sensor.id] = { min: sensor.value, max: sensor.value, avg: sensor.value };
      } else {
        const values = points.map(p => p.value);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const avgVal = values.reduce((s, v) => s + v, 0) / values.length;
        stats[sensor.id] = {
          min: parseFloat(minVal.toFixed(2)),
          max: parseFloat(maxVal.toFixed(2)),
          avg: parseFloat(avgVal.toFixed(2))
        };
      }
    });
    return stats;
  }, [sensors, history]);

  const handleOpenCalibration = (sensor: any) => {
    setSelectedSensorId(sensor.id);
    setWarningLow(sensor.warningLow !== null ? sensor.warningLow.toString() : '');
    setWarningHigh(sensor.warningHigh !== null ? sensor.warningHigh.toString() : '');
    setCriticalLow(sensor.criticalLow !== null ? sensor.criticalLow.toString() : '');
    setCriticalHigh(sensor.criticalHigh !== null ? sensor.criticalHigh.toString() : '');
    setCalibrationMultiplier(sensor.calibrationMultiplier !== null ? sensor.calibrationMultiplier.toString() : '1.0');
  };

  const handleSaveCalibration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSensorId) return;

    setSaving(true);
    try {
      const payload = {
        warningLow: warningLow ? parseFloat(warningLow) : null,
        warningHigh: warningHigh ? parseFloat(warningHigh) : null,
        criticalLow: criticalLow ? parseFloat(criticalLow) : null,
        criticalHigh: criticalHigh ? parseFloat(criticalHigh) : null,
        calibrationMultiplier: parseFloat(calibrationMultiplier) || 1.0
      };

      await api.put(`/sensors/${selectedSensorId}`, payload);
      
      // Update local Zustand store properties for immediate visual feedback
      updateSensors(sensors.map(s => s.id === selectedSensorId ? { ...s, ...payload } : s));
      
      toast.success('Sensor settings and calibration parameters saved.');
      setSelectedSensorId(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update sensor thresholds.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex gap-6 relative min-h-[calc(100vh-8rem)]">
      
      {/* Sensor Cards List - Left column */}
      <div className="flex-1 flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Gauge className="w-5 h-5 text-emerald-400" />
            Sensor Telemetry Dashboard
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Live PZEM meters and auxiliary environmental nodes list</p>
        </div>

        {/* Responsive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {sensors.map(sensor => {
            const stats = sensorStats[sensor.id] || { min: 0, max: 0, avg: 0 };
            
            // Highlight warning state
            const isHighWarning = sensor.warningHigh !== null && sensor.value >= sensor.warningHigh;
            const isLowWarning = sensor.warningLow !== null && sensor.value <= sensor.warningLow;
            
            return (
              <div 
                key={sensor.id} 
                className={`glass-panel rounded-xl p-5 flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${
                  isHighWarning || isLowWarning 
                    ? 'border-red-500/30 bg-red-950/[0.02] shadow-lg shadow-red-950/5' 
                    : 'glass-panel-hover'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">{sensor.type} meter</span>
                      <h3 className="font-bold text-slate-200 text-sm mt-1">{sensor.name}</h3>
                    </div>
                    
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${
                      isHighWarning || isLowWarning
                        ? 'bg-red-500/10 border-red-500/20 text-red-400 animate-pulse'
                        : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400'
                    }`}>
                      {isHighWarning || isLowWarning ? 'Threshold Alert' : 'Normal'}
                    </span>
                  </div>

                  {/* Main current value */}
                  <div className="flex items-baseline gap-1 mt-6">
                    <span className="text-3xl font-bold tracking-tight text-slate-100">{sensor.value}</span>
                    <span className="text-xs font-semibold text-slate-400">{sensor.unit}</span>
                  </div>
                </div>

                {/* Calibration Details & Stats */}
                <div className="mt-6 pt-4 border-t border-slate-900 grid grid-cols-3 gap-2 text-center text-[10px]">
                  <div className="border-r border-slate-900">
                    <span className="text-slate-500 block">Min</span>
                    <span className="font-semibold text-slate-300 mt-0.5 block">{stats.min}</span>
                  </div>
                  <div className="border-r border-slate-900">
                    <span className="text-slate-500 block">Max</span>
                    <span className="font-semibold text-slate-300 mt-0.5 block">{stats.max}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Average</span>
                    <span className="font-semibold text-slate-300 mt-0.5 block">{stats.avg}</span>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="mt-5 pt-3.5 border-t border-slate-900/60 flex items-center justify-between">
                  <span className="text-[9px] text-slate-500 font-mono">
                    ID: {sensor.id} • Cal: {sensor.calibrationMultiplier || '1.0'}x
                  </span>
                  
                  <button 
                    onClick={() => handleOpenCalibration(sensor)}
                    className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-slate-200 transition-colors uppercase tracking-wider"
                  >
                    <Settings className="w-3 h-3" />
                    Configure
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Slide-over Calibration Drawer - Right Column */}
      {selectedSensor && (
        <div className="w-80 glass-panel rounded-2xl p-6 h-fit sticky top-20 border-l border-slate-900 flex flex-col justify-between animate-fade-in z-20">
          <div>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Calibration Panel</span>
              </div>
              <button 
                onClick={() => setSelectedSensorId(null)}
                className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-3.5 mb-6 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="text-[10px] text-slate-400 leading-relaxed">
                <span>Adjust thresholds dynamically. If calibrated values cross high/low bounds, telemetry WebSocket loops will dispatch an alert toast.</span>
              </div>
            </div>

            <form onSubmit={handleSaveCalibration} className="space-y-4 text-xs">
              <div>
                <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1.5">Calibration Multiplier</label>
                <input
                  type="number"
                  step={0.01}
                  value={calibrationMultiplier}
                  onChange={e => setCalibrationMultiplier(e.target.value)}
                  placeholder="1.0"
                  className="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-slate-200 text-xs focus:outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1.5">Warning Low</label>
                  <input
                    type="number"
                    value={warningLow}
                    onChange={e => setWarningLow(e.target.value)}
                    placeholder="Null"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-slate-200 text-xs focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1.5">Warning High</label>
                  <input
                    type="number"
                    value={warningHigh}
                    onChange={e => setWarningHigh(e.target.value)}
                    placeholder="Null"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-slate-200 text-xs focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1.5">Critical Low</label>
                  <input
                    type="number"
                    value={criticalLow}
                    onChange={e => setCriticalLow(e.target.value)}
                    placeholder="Null"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-slate-200 text-xs focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1.5">Critical High</label>
                  <input
                    type="number"
                    value={criticalHigh}
                    onChange={e => setCriticalHigh(e.target.value)}
                    placeholder="Null"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-slate-200 text-xs focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 mt-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {saving ? 'Saving bounds...' : 'Save Configuration'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
export default SensorDashboardView;
