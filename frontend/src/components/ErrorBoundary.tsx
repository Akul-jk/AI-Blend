import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 font-sans">
          <div className="max-w-md w-full glass-panel rounded-2xl p-8 border border-red-500/20 shadow-2xl flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6 border border-red-500/20">
              <AlertOctagon className="w-8 h-8 animate-pulse" />
            </div>

            <h1 className="text-2xl font-bold mb-2">Application Crash</h1>
            <p className="text-slate-400 text-sm mb-6">
              Antigravity's core system has caught an unhandled runtime error. The stack trace has been captured and logged in the dev console.
            </p>

            {this.state.error && (
              <div className="w-full text-left bg-slate-900/50 p-4 rounded-xl border border-white/5 mb-6 max-h-40 overflow-y-auto">
                <p className="text-red-400 text-xs font-mono break-all">{this.state.error.toString()}</p>
                {this.state.error.stack && (
                  <pre className="text-slate-500 text-[10px] font-mono mt-2 overflow-x-auto">
                    {this.state.error.stack}
                  </pre>
                )}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-xl transition-all shadow-lg hover:shadow-emerald-500/15"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
