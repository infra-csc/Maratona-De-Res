import { useEffect } from "react";
import { ArrowLeft, Compass, Home } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { StateLink, StatePanel, savedDark, stateBtnSecondary } from "@/components/layout/shell-states";
import { BrandMark, Wordmark } from "@/components/layout/shell-ui";
import { cn } from "@/lib/utils";

function NotFoundPanel({ loggedIn }: { loggedIn: boolean }) {
  const [location] = useLocation();
  useEffect(() => { document.title = "Página não encontrada · Maratona"; }, []);
  return (
    <StatePanel
      icon={Compass}
      eyebrow="Erro 404"
      title="Página não encontrada"
      actions={
        <>
          <StateLink href={loggedIn ? "/" : "/login"} primary>
            <Home size={16} aria-hidden /> {loggedIn ? "Ir para o início" : "Ir para o login"}
          </StateLink>
          {window.history.length > 1 && (
            <button type="button" onClick={() => window.history.back()} className={stateBtnSecondary}>
              <ArrowLeft size={16} aria-hidden /> Voltar
            </button>
          )}
        </>
      }
      detail={
        <p className="text-[13px] text-muted-foreground">
          Endereço aberto:{" "}
          <code className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[12px] text-foreground break-all">{location}</code>
        </p>
      }
    >
      {loggedIn
        ? "O endereço não existe ou foi movido. Se chegou aqui por um link salvo, comece pelo início e siga pelo menu."
        : "O endereço não existe ou foi movido. Entre no sistema e siga pelo menu até a tela que procura."}
    </StatePanel>
  );
}

export default function NotFound() {
  const { user } = useAuth();
  // Logado: dentro da casca (menu à mão). Sem sessão: só a marca.
  if (user) {
    return (
      <AppLayout>
        <NotFoundPanel loggedIn />
      </AppLayout>
    );
  }
  return (
    <div className={cn(savedDark() && "dark")}>
      <div className="font-body flex min-h-dvh flex-col bg-background text-foreground">
        <header className="flex items-center gap-3 px-5 py-5 sm:px-8">
          <BrandMark size={32} />
          <Wordmark />
        </header>
        <main className="flex flex-1 items-center">
          <NotFoundPanel loggedIn={false} />
        </main>
      </div>
    </div>
  );
}
