// "Acesso negado" dentro do app: diz QUAL tela e QUAL perfil, e o que fazer.
// Só apresentação — quem pode ver cada tela continua decidido no App.tsx.
import { ArrowLeft, Home, Lock } from "lucide-react";
import { useLocation } from "wouter";
import { navLabelFor } from "./sidebar";
import { roleLabel } from "./shell-ui";
import { StateLink, StatePanel, stateBtnSecondary } from "./shell-states";

export function AccessDenied({ role }: { role: string }) {
  const [location] = useLocation();
  const screen = navLabelFor(location);
  return (
    <StatePanel
      icon={Lock}
      tone="warn"
      eyebrow="Sem permissão"
      title="Acesso negado"
      actions={
        <>
          <StateLink href="/" primary><Home size={16} aria-hidden /> Ir para o início</StateLink>
          {typeof window !== "undefined" && window.history.length > 1 && (
            <button type="button" onClick={() => window.history.back()} className={stateBtnSecondary}>
              <ArrowLeft size={16} aria-hidden /> Voltar
            </button>
          )}
        </>
      }
    >
      <p>
        {screen ? <>A tela <strong className="font-semibold text-foreground">{screen}</strong> não está liberada</> : "Esta tela não está liberada"}{" "}
        para o perfil <strong className="font-semibold text-foreground">{roleLabel(role)}</strong>.
      </p>
      <p className="mt-1.5">Se você precisa dela no seu trabalho, peça acesso ao RH ou ao administrador.</p>
    </StatePanel>
  );
}
