import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip 
} from 'recharts';
import { 
  Brain, 
  Send, 
  Sparkles, 
  User 
} from 'lucide-react';

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
}

export const PredictionsView: React.FC = () => {
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    { sender: 'ai', text: 'Hello! I am your AI Energy Assistant. Ask me about prediction metrics, bill variance, or system health logs.' }
  ]);
  const [inputText, setInputText] = useState('');

  // Forecast data for next 24 hours
  const forecastData = useMemo(() => {
    const data = [];
    const baseHour = new Date().getHours();
    
    for (let i = 1; i <= 24; i++) {
      const hour = (baseHour + i) % 24;
      const hourStr = `${hour.toString().padStart(2, '0')}:00`;
      
      // Sinusoidal load curve peaking around 6pm-9pm (hour 18-21)
      const multiplier = 1 + 0.6 * Math.sin(((hour - 6) / 24) * 2 * Math.PI);
      const predictedVal = parseFloat((0.45 * multiplier).toFixed(3)); // kW

      data.push({
        time: hourStr,
        Load: predictedVal
      });
    }
    return data;
  }, []);

  // Answer matching rules for AI chat queries
  const getAIResponse = (query: string): string => {
    const text = query.toLowerCase();
    if (text.includes('bill') || text.includes('increasing')) {
      return 'Forecasts show this month’s bill is ₹1,620. This is 11% higher than last week’s base rate. Main drivers are high current draws (contributing 42% value variance) and heavy active power loads during peak hours (6 PM – 9 PM).';
    }
    if (text.includes('parameter') || text.includes('affect') || text.includes('driver')) {
      return 'According to our Gini relative importance indices, Active Power Draw is the primary driver of prediction variance with a 36% weight, followed by Current Load at 25% and Line Voltage at 18%.';
    }
    if (text.includes('tomorrow') || text.includes('predict')) {
      return 'LSTM v2.4 projects tomorrow’s cumulative energy consumption will be 8.42 kWh. Active load is forecasted to peak at 07:00 PM with approximately 740W. Grid voltage is projected to remain stable at 229.4V.';
    }
    if (text.includes('save') || text.includes('recommend')) {
      return 'I recommend routing solar loads to HVAC loops during 12 PM - 4 PM peak sunshine hours, and shifting high-power operations (e.g. washing machines) past 10 PM. This should save ₹260 this month.';
    }
    return 'I have recorded your request. LSTM estimator profiles show a stable 97.3% confidence interval, indicating optimal load balance across environmental zones. Please let me know if you would like me to compile details.';
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg = inputText;
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInputText('');

    setTimeout(() => {
      const response = getAIResponse(userMsg);
      setMessages(prev => [...prev, { sender: 'ai', text: response }]);
    }, 800);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome Banner */}
      <section className="glass-panel rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-violet-500/10 via-emerald-500/5 to-transparent rounded-full blur-3xl -z-10 animate-pulse-slow"></div>
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Brain className="w-5 h-5 text-violet-400" />
            AI Forecasts & Explainable AI
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Explore future consumption models and natural language attribution logs</p>
        </div>
      </section>

      {/* Grid: Forecast Chart & Explainable AI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Forecast Chart - Left 2 Columns */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 flex flex-col h-80">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-200">24-Hour Load Forecast Timeline</h3>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">LSTM-v2.4 predicted power demand curves (kW)</p>
            </div>
            <span className="px-2 py-0.5 rounded bg-violet-500/15 border border-violet-500/20 text-[9px] font-mono text-violet-400">
              97.3% Confidence Interval
            </span>
          </div>

          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastData}>
                <defs>
                  <linearGradient id="foreLoadColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#030712', borderColor: '#1e293b', fontSize: '10px' }} />
                <Area type="monotone" dataKey="Load" stroke="#8b5cf6" strokeWidth={1.5} fillOpacity={1} fill="url(#foreLoadColor)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Explainable AI contribution */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-4">Explainable AI Contribution</span>
            
            <div className="space-y-4">
              {[
                { label: 'Current Draw Variance', value: 42, color: 'bg-emerald-500' },
                { label: 'Voltage Fluctuations', value: 24, color: 'bg-emerald-500/70' },
                { label: 'Evening Peak Intervals', value: 21, color: 'bg-emerald-500/50' },
                { label: 'Temperature Adjustments', value: 13, color: 'bg-emerald-500/30' }
              ].map((contrib, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>{contrib.label}</span>
                    <span className="font-semibold text-slate-200">+{contrib.value}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div className={`h-full ${contrib.color} rounded-full`} style={{ width: `${contrib.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-900/60 text-[10px] text-slate-500">
            <span className="block font-semibold">Attribution Rationale</span>
            <p className="mt-1 leading-relaxed">Predictions increased primarily because current draw was elevated by 11% compared to baseline profiles.</p>
          </div>
        </div>

      </div>

      {/* AI Assistant Chat Panel */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col h-96 overflow-hidden">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-900 pb-3">
          <Brain className="w-4 h-4 text-violet-400" />
          <div>
            <h3 className="font-bold text-sm text-slate-200">AI Assistant Expert Panel</h3>
            <p className="text-[9px] text-slate-500 font-mono mt-0.5">Chat with the local XGBoost / LSTM validation model</p>
          </div>
        </div>

        {/* Message Logs */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin mb-4 text-xs">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 max-w-2xl ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                msg.sender === 'user' 
                  ? 'bg-slate-900 border-slate-800 text-slate-300' 
                  : 'bg-violet-500/10 border-violet-500/20 text-violet-400'
              }`}>
                {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              </div>
              <div className={`p-3 rounded-xl leading-relaxed ${
                msg.sender === 'user' 
                  ? 'bg-slate-900 text-slate-200 border border-slate-900' 
                  : 'bg-slate-900/40 text-slate-300 border border-slate-900'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* Text Input form */}
        <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-slate-900 pt-3">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Type energy query (e.g. 'Why is my bill increasing?')..."
            className="flex-1 px-4 py-2.5 bg-slate-900/60 border border-slate-800 focus:border-violet-500/50 rounded-xl text-slate-200 text-xs focus:outline-none transition-colors"
          />
          <button
            type="submit"
            className="p-2.5 bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white rounded-xl transition-all shadow-md"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

    </div>
  );
};
export default PredictionsView;
