import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { toast } from '../../components/ui/Toast';
import { Cpu, Activity, Lock, User as UserIcon, ShieldCheck } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const [username, setUsername] = React.useState('admin');
  const [password, setPassword] = React.useState('admin123');
  const [submitting, setSubmitting] = React.useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await api.post('/auth/login', { username, password });
      const { token, user } = response.data;
      login(token, user);
      toast.success(`Welcome back, ${user.username}!`);
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Authentication failed. Please check credentials.';
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
      <div className="w-full max-w-md glass-panel rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500"></div>
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
            <Cpu className="w-6 h-6 animate-pulse-slow" />
          </div>
          <h2 className="text-xl font-bold text-slate-100 text-center uppercase tracking-tight">Smart Energy<br/><span className="text-emerald-400">Monitoring System</span></h2>
          <p className="text-sm text-slate-400 mt-1">Sign in to control energy analytics</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Username</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <UserIcon className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-900/60 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-slate-200 text-sm focus:outline-none transition-colors"
                placeholder="Enter admin or username"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-900/60 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-slate-200 text-sm focus:outline-none transition-colors"
                placeholder="Enter password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-xl transition-all shadow-lg hover:shadow-emerald-500/10 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Activity className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Authenticate
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-900 flex flex-col gap-3 text-center">
          <div className="flex justify-between text-xs">
            <Link to="/forgot-password" className="text-slate-500 hover:text-slate-300">
              Forgot Password?
            </Link>
            <Link to="/register" className="text-emerald-400 hover:text-emerald-300 font-semibold">
              Register Account
            </Link>
          </div>
          <p className="text-[10px] text-slate-600 mt-2">
            System defaults seeded: <code className="text-emerald-500/70 font-mono">admin / admin123</code>
          </p>
        </div>
      </div>
    </div>
  );
};
export default LoginView;
