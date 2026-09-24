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
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      return (
        <div
          role="alert"
          className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground p-6 text-center"
        >
          <div className="rounded-xl border bg-card text-card-foreground p-8 shadow-lg max-w-xl w-full">
            <h2 className="text-2xl font-semibold tracking-tight text-destructive mb-2">
              Algo deu errado
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Algo deu errado. Recarregue a página; se persistir, avise o suporte.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex min-h-9 items-center justify-center rounded-md border border-primary-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Recarregar
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.clear();
                  window.location.assign(`${base}/login`);
                }}
                className="inline-flex min-h-9 items-center justify-center rounded-md border [border-color:var(--button-outline)] bg-transparent px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Fazer login novamente
              </button>
            </div>
            <details className="mt-6 text-left">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Detalhes técnicos
              </summary>
              <pre className="mt-2 text-xs bg-muted border rounded-md p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                {stack}
              </pre>
              {componentStack && (
                <pre className="mt-2 text-xs bg-muted border rounded-md p-3 overflow-auto max-h-32 whitespace-pre-wrap break-all">
                  {componentStack.trim()}
                </pre>
              )}
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
