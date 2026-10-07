import React, { useState, useRef, useEffect } from 'react';
import { LogOut, Shield, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const UserProfile: React.FC = () => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* User profile button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-1.5 py-1 rounded-xl border border-transparent hover:border-slate-900/80 hover:bg-slate-950/40 transition-all text-left"
      >
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs uppercase shadow-inner">
          {user.username.substring(0, 2).toUpperCase()}
        </div>
        <div className="hidden md:block">
          <span className="text-xs font-semibold block text-slate-200 leading-none">{user.username}</span>
          <span className="text-[9px] text-slate-500 font-mono block mt-0.5 uppercase tracking-wider leading-none">
            {user.role}
          </span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-500 hidden md:block" />
      </button>

      {/* Profile Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 glass-panel rounded-xl border border-slate-900 bg-slate-950/95 shadow-2xl z-50 overflow-hidden py-1">
          {/* User details */}
          <div className="px-4 py-2 border-b border-slate-900/80">
            <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-wider">Signed in as</span>
            <span className="text-xs font-bold block text-slate-200 mt-0.5">{user.email}</span>
          </div>

          {/* Actions */}
          <div className="py-1">
            <button
              onClick={() => {
                setIsOpen(false);
                // Future profile settings view navigate
              }}
              className="w-full text-left px-4 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 flex items-center gap-2"
            >
              <Shield className="w-3.5 h-3.5 text-slate-500" />
              Role Permissions
            </button>
            <button
              onClick={() => logout()}
              className="w-full text-left px-4 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-slate-900/40 flex items-center gap-2 border-t border-slate-900/80 mt-1 pt-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default UserProfile;
