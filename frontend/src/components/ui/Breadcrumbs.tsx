import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  const routeNameMap: Record<string, string> = {
    'monitoring': 'Live Monitoring',
    'history': 'Historical Analytics',
    'ml': 'ML Workspace',
    'reports': 'Reports Center',
    'alerts': 'Alert Center',
    'settings': 'Settings',
  };

  return (
    <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
      <Link 
        to="/" 
        className="flex items-center gap-1 text-slate-400 hover:text-emerald-400 transition-colors"
      >
        <Home className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Home</span>
      </Link>
      
      {pathnames.map((value, index) => {
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const displayName = routeNameMap[value] || value.charAt(0).toUpperCase() + value.slice(1);

        return (
          <React.Fragment key={to}>
            <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
            {isLast ? (
              <span className="text-slate-300 font-semibold truncate max-w-[120px] sm:max-w-none">
                {displayName}
              </span>
            ) : (
              <Link 
                to={to} 
                className="text-slate-400 hover:text-emerald-400 transition-colors truncate max-w-[120px] sm:max-w-none"
              >
                {displayName}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
export default Breadcrumbs;
