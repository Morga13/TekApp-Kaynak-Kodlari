import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  declare state: State;
  declare props: Props & { children: React.ReactNode };

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught React Error:", error, errorInfo);
  }

  handleReload() {
    (this as React.Component<Props, State>).setState({ hasError: false, error: null });
    window.location.reload();
  }

  render() {
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
