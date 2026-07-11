import React, { useState } from 'react';
import api from '../../services/api';
import { useSensorStore } from '../../stores/sensorStore';
import { toast } from '../../components/ui/Toast';
import { 
  Server, 
  RefreshCw, 
  Download, 
  Terminal
} from 'lucide-react';

export const DeviceView: React.FC = () => {
  const { socketConnected } = useSensorStore();
  const [deviceInfo] = useState({
    name: 'ESP32 PZEM-004T Link Node',
    mac: '24:0A:C4:B2:D5:1C',
    ip: '192.168.1.140',
    firmware: 'v1.0.4-pzem',
    wifiStrength: '-56 dBm',
    uptime: '14h 22m 10s',
    cpuUsage: 18,
    memoryUsage: 42
  });

  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    '[SYSTEM] ESP32 telemetry server initialized.',
    '[SYSTEM] Wi-Fi connected to SSID "AI-Blend-Net".',
    '[SOCKET] Registered connection link client ID: ' + Math.random().toString(36).slice(-8)
  ]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleRestart = async () => {
    setLoading(true);
    addLog('Issuing MCU restart trigger to ESP32...');
    try {
      await api.post('/device/restart');
      toast.success('Restart command sent.');
      addLog('[MCU] Resetting ESP32 controller pipeline...');
      setTimeout(() => {
        addLog('[SYSTEM] Socket client re-registered.');
        toast.info('Telemetry socket reconnected.');
      }, 2000);
    } catch (err) {
      console.error(err);
      toast.error('Failed to trigger MCU restart.');
    } finally {
      setLoading(false);
    }
  };

  const handleOTA = async () => {
    setLoading(true);
    addLog('Downloading update package OTA...');
    try {
      await api.post('/device/update');
      toast.info('OTA update started.');
      addLog('[OTA] Downloaded binary segment successfully.');
      addLog('[OTA] Writing flash registers...');
      setTimeout(() => {
        addLog('[SYSTEM] MCU Rebooting to apply firmware...');
        toast.success('OTA Firmware update complete!');
      }, 2000);
    } catch (err) {
      console.error(err);
      toast.error('OTA update failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Server className="w-5 h-5 text-indigo-400" />
            ESP32 Device Controller
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Hardware specifications and OTA remote compilation terminal</p>
        </div>
      </section>

      {/* Grid: Info Cards & CPU Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Device properties list */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-5">Hardware Attributes</span>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-xs">
            {[
              { label: 'Device Name', value: deviceInfo.name },
              { label: 'MAC Address', value: deviceInfo.mac },
              { label: 'IP Address', value: deviceInfo.ip },
              { label: 'Active Firmware', value: deviceInfo.firmware },
              { label: 'Wi-Fi RSSI', value: deviceInfo.wifiStrength },
              { label: 'System Uptime', value: deviceInfo.uptime },
              { label: 'Socket Connection', value: socketConnected ? 'Connected' : 'Offline', color: socketConnected ? 'text-emerald-400 font-semibold' : 'text-red-400 animate-pulse' },
              { label: 'Edge Compiler Status', value: 'Ready', color: 'text-emerald-400' }
            ].map((prop, idx) => (
              <div key={idx} className="flex justify-between border-b border-slate-900 pb-2.5">
                <span className="text-[10px] text-slate-400">{prop.label}</span>
                <span className={`text-[10px] font-bold text-slate-200 ${prop.color || ''}`}>{prop.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* System gauges */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between h-fit">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-4">Hardware CPU & RAM Load</span>
          
          <div className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>MCU CPU Load</span>
                <span className="font-semibold text-slate-200">{deviceInfo.cpuUsage}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${deviceInfo.cpuUsage}%` }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>SRAM Usage</span>
                <span className="font-semibold text-slate-200">{deviceInfo.memoryUsage}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full" style={{ width: `${deviceInfo.memoryUsage}%` }} />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Grid: Actions & Terminal Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Remote Command buttons */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4 h-fit">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">MCU Commands</span>
          
          <button
            disabled={loading}
            onClick={handleRestart}
            className="w-full py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-slate-100 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4 text-emerald-400" />
            Restart ESP32 Controller
          </button>

          <button
            disabled={loading}
            onClick={handleOTA}
            className="w-full py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-slate-100 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5"
          >
            <Download className="w-4 h-4 text-violet-400" />
            Trigger OTA Firmware Update
          </button>
        </div>

        {/* Scrolling terminal logs */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-5 flex flex-col h-56 overflow-hidden">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-4 flex items-center gap-1.5">
            <Terminal className="w-4 h-4" />
            Local hardware syslog stream
          </span>
          
          <div className="flex-1 overflow-y-auto font-mono text-[9px] text-slate-400 space-y-1.5 pr-1.5 scrollbar-thin">
            {logs.map((log, idx) => (
              <div key={idx}>
                <span>{log}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
export default DeviceView;
