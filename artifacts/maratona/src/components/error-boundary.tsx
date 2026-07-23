import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary] Erro capturado:", error, info.componentStack);
    this.setState({ componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      const { error, componentStack } = this.state;
      const stack = error?.stack ?? error?.message ?? "Erro desconhecido";
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#f7f9fb] p-8 text-center">
          <div className="border-2 border-[#ba1a1a] bg-white p-8 shadow-[4px_4px_0px_0px_#191c1e] max-w-2xl w-full">
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-[#ba1a1a] mb-2">
              Erro inesperado
            </h2>
            <p className="text-sm font-bold italic text-[#444933] mb-4">
              A página encontrou um erro. Tente recarregar ou fazer login novamente.
            </p>
            <pre className="text-xs text-left bg-[#eceef0] border border-[#191c1e] p-3 rounded overflow-auto max-h-48 text-[#191c1e] mb-2 whitespace-pre-wrap break-all">
              {stack}
            </pre>
            {componentStack && (
              <pre className="text-xs text-left bg-[#fff8f8] border border-[#ba1a1a] p-3 rounded overflow-auto max-h-32 text-[#ba1a1a] mb-4 whitespace-pre-wrap break-all">
                {componentStack.trim()}
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
