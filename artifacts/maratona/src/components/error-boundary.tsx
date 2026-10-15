import { Component, type ReactNode } from "react";
import { AlertTriangle, Check, Copy, LogIn, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/clipboard";
import { StatePanel, savedDark, stateBtnPrimary, stateBtnSecondary } from "@/components/layout/shell-states";
import { BrandMark, Wordmark } from "@/components/layout/shell-ui";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null, copied: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary] Erro capturado:", error, info.componentStack);
    this.setState({ componentStack: info.componentStack });
  }

  private async copyDetails(text: string) {
    const ok = await copyToClipboard(text);
    if (ok) {
      this.setState({ copied: true });
      window.setTimeout(() => this.setState({ copied: false }), 2000);
    }
  }

  override render() {
    if (this.state.hasError) {
      const { error, componentStack, copied } = this.state;
      const stack = error?.stack ?? error?.message ?? "Erro desconhecido";
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      const report = [
        `Endereço: ${window.location.pathname}${window.location.search}`,
        `Quando: ${new Date().toLocaleString("pt-BR")}`,
        "",
        stack,
        componentStack ? `\nComponentes:${componentStack}` : "",
      ].join("\n");
      return (
        // Fora do provedor de tema: lê a preferência salva direto.
        <div className={cn(savedDark() && "dark")}>
          <div role="alert" className="font-body flex min-h-dvh flex-col bg-background text-foreground">
            <header className="flex items-center gap-3 px-5 py-5 sm:px-8">
              <BrandMark size={32} />
              <Wordmark />
            </header>
            <main className="flex flex-1 items-center">
              <StatePanel
                icon={AlertTriangle}
                tone="danger"
                eyebrow="Erro inesperado"
                title="Algo deu errado nesta tela"
                actions={
                  <>
                    <button type="button" onClick={() => window.location.reload()} className={stateBtnPrimary}>
                      <RotateCw size={16} aria-hidden /> Recarregar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.clear();
                        window.location.assign(`${base}/login`);
                      }}
                      className={stateBtnSecondary}
                    >
                      <LogIn size={16} aria-hidden /> Fazer login novamente
                    </button>
                  </>
                }
                detail={
                  <details className="group rounded-xl border border-border bg-card">
                    <summary className="font-condensed flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                      Detalhes técnicos
                      <span aria-hidden="true" className="text-[16px] leading-none transition-transform duration-150 group-open:rotate-45">+</span>
                    </summary>
                    <div className="border-t border-border p-3">
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-secondary p-3 font-mono text-[12px] leading-relaxed text-foreground">
                        {stack}
                      </pre>
                      {componentStack && (
                        <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-secondary p-3 font-mono text-[12px] leading-relaxed text-muted-foreground">
                          {componentStack.trim()}
                        </pre>
                      )}
                      <button type="button" onClick={() => this.copyDetails(report)} className={cn(stateBtnSecondary, "mt-3 md:min-h-9 px-3.5 text-[13px]")}>
                        {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
                        {copied ? "Copiado" : "Copiar para o suporte"}
                      </button>
                    </div>
                  </details>
                }
              >
                Recarregue a página — na maioria das vezes resolve. Se o erro voltar, copie os detalhes técnicos abaixo e mande para o suporte.
              </StatePanel>
            </main>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
