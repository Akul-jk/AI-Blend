import React, { useRef, useEffect } from 'react';
import { Search } from 'lucide-react';

export const SearchBar: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Press '/' key to focus the search bar
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="relative w-full max-w-xs md:max-w-sm hidden sm:block">
      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none">
        <Search className="w-4 h-4" />
      </span>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search metrics, devices, or logs... (Press '/')"
        className="w-full pl-9 pr-8 py-1.5 bg-slate-900/40 hover:bg-slate-900/60 focus:bg-slate-900 border border-slate-900/80 focus:border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none transition-all placeholder:text-slate-500"
      />
      <span className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
        <kbd className="hidden md:inline-flex h-4.5 select-none items-center gap-0.5 rounded border border-slate-800 bg-slate-950 px-1.5 font-mono text-[9px] font-medium text-slate-500">
          /
        </kbd>
      </span>
    </div>
  );
};
export default SearchBar;
