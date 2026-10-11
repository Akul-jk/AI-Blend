import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import { toast } from '../../components/ui/Toast';
import { Mail, ArrowLeft, KeyRound } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import { apiErrorMessage } from '../../utils/apiError';

export const ForgotPasswordView: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await api.post('/auth/forgot-password', { email });
      toast.success(response.data.message || 'Recovery code generated.');
      
      // Navigate to reset password page
      setTimeout(() => {
        navigate('/reset-password');
      }, 1500);
    } catch (err: unknown) {
      console.error(err);
      const errMsg = apiErrorMessage(err, 'Failed to submit request.');
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-md glass-panel rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500"></div>
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
            <KeyRound className="w-6 h-6 animate-pulse-slow" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100">Recover Password</h2>
          <p className="text-sm text-slate-400 mt-1">Get a security code to reset credentials</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Registered Email</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-900/60 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-slate-200 text-sm focus:outline-none transition-colors"
                placeholder="operator@company.com"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-xl transition-all shadow-lg hover:shadow-emerald-500/10 flex items-center justify-center gap-2"
          >
            {submitting ? 'Submitting request...' : 'Send Recovery Code'}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-slate-900 flex justify-between text-xs">
          <Link to="/login" className="text-slate-500 hover:text-slate-300 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Login
          </Link>
          <Link to="/reset-password" className="text-emerald-400 hover:text-emerald-300 font-semibold">
            Already have code?
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};
export default ForgotPasswordView;
