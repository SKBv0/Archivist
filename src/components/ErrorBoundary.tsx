import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
    children: ReactNode;
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
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-black text-zinc-200 flex flex-col items-center justify-center p-8 text-center space-y-6 animate-fade-in font-sans">
                    <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 mb-4">
                        <AlertTriangle className="text-red-500" size={32} />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">Critical Error</h1>
                    <p className="text-zinc-500 max-w-md">
                        The application encountered an unexpected state and cannot continue.
                    </p>
                    <div className="max-w-md w-full bg-zinc-900/50 p-4 rounded-lg border border-red-500/20 text-left">
                        <p className="font-mono text-xs text-red-400 break-words">
                            {this.state.error?.message || 'Unknown Error'}
                        </p>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-colors shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                    >
                        <RefreshCcw size={16} /> Reload Application
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
