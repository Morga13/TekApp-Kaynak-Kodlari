import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

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
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught React Error:", error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-slate-900 text-white text-center">
          <div className="h-16 w-16 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mb-4 border border-rose-500/30">
            <AlertTriangle className="h-8 w-8 animate-pulse" />
          </div>
          <h1 className="text-xl font-bold mb-2 text-slate-100">Bir Hata Oluştu</h1>
          <p className="text-xs text-slate-400 max-w-xs mb-6 leading-relaxed">
            Uygulama çalışırken beklenmeyen bir aksaklık yaşandı. Verileriniz güvendedir.
          </p>
          <button
            onClick={this.handleReload}
            className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-sky-500/25"
          >
            <RefreshCw className="h-4 w-4" />
            Uygulamayı Yeniden Başlat
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
