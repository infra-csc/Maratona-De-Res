import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary] Erro capturado:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#f7f9fb] p-8 text-center">
          <div className="border-2 border-[#ba1a1a] bg-white p-8 shadow-[4px_4px_0px_0px_#191c1e] max-w-lg w-full">
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-[#ba1a1a] mb-2">
              Erro inesperado
            </h2>
            <p className="text-sm font-bold italic text-[#444933] mb-4">
              A página encontrou um erro. Tente recarregar ou fazer login novamente.
            </p>
            {this.state.error?.message && (
              <pre className="text-xs text-left bg-[#eceef0] border border-[#191c1e] p-3 rounded overflow-auto max-h-40 text-[#191c1e] mb-4">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="border-2 border-[#191c1e] bg-[#ccff00] px-5 py-2.5 font-bold text-xs italic uppercase tracking-wider shadow-[2px_2px_0px_0px_#191c1e] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                Recarregar
              </button>
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.assign("/login");
                }}
                className="border-2 border-[#191c1e] bg-white px-5 py-2.5 font-bold text-xs italic uppercase tracking-wider shadow-[2px_2px_0px_0px_#191c1e] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                Fazer login novamente
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
