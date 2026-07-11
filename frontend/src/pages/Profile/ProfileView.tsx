import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../components/ui/Toast';
import { User, Lock, Shield, Mail } from 'lucide-react';

export const ProfileView: React.FC = () => {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updating, setUpdating] = useState(false);

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return toast.error('Passwords do not match.');
    }
    
    setUpdating(true);
    // Simulate updating
    setTimeout(() => {
      setUpdating(false);
      toast.success('Security password credentials updated.');
      setPassword('');
      setConfirmPassword('');
    }, 1000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-400" />
            Operator User Profile
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Manage credentials, badges, and project permissions scopes</p>
        </div>
      </section>

      {/* Grid: Operator Info & Security Config */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* User properties list */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-5">Scope Credentials</span>
          
          <div className="space-y-4 text-xs">
            <div className="flex justify-between border-b border-slate-900 pb-2.5">
              <span className="text-[10px] text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                Username
              </span>
              <span className="text-[10px] font-bold text-slate-200">{user?.username || 'admin'}</span>
            </div>

            <div className="flex justify-between border-b border-slate-900 pb-2.5">
              <span className="text-[10px] text-slate-400 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                Email Address
              </span>
              <span className="text-[10px] font-bold text-slate-200">{user?.email || 'admin@aiblend.com'}</span>
            </div>

            <div className="flex justify-between border-b border-slate-900 pb-2.5">
              <span className="text-[10px] text-slate-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-slate-500" />
                Access Role Scope
              </span>
              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                {user?.role || 'admin'}
              </span>
            </div>
          </div>
        </div>

        {/* Change password security form */}
        <div className="glass-panel rounded-2xl p-5">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-4 flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-slate-400" />
            Change Password
          </span>

          <form onSubmit={handleUpdatePassword} className="space-y-4 text-xs">
            <div>
              <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1.5">New Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-slate-200 text-xs focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-1.5">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-slate-200 text-xs focus:outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={updating}
              className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-xl transition-all shadow-md text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5"
            >
              Update Password
            </button>
          </form>
        </div>

      </div>

    </div>
  );
};
export default ProfileView;
