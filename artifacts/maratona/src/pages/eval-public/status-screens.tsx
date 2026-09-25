import type { CSSProperties } from "react";
import type { PublicEvalInfo } from "@workspace/api-client-react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { CONDENSED, DANGER_TEXT } from "@/lib/premium-theme";
import { Card } from "./ui";

// Telas de estado (link inválido, carregando, já usado, enviado, sem
// critérios). Todas recebem o `shellStyle` com os tokens do tema da página.

type ShellProps = { shellStyle: CSSProperties };

export function LoadErrorScreen({ shellStyle, message }: ShellProps & { message: string }) {
  return (
    <div style={shellStyle} className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 text-center">
        <AlertTriangle size={40} className="mx-auto mb-4" style={{ color: DANGER_TEXT }} />
        <h1 className="font-black text-2xl uppercase tracking-wide mb-2" style={{ fontFamily: CONDENSED }}>Link Inválido</h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{message}</p>
      </Card>
    </div>
  );
}

export function LoadingScreen({ shellStyle }: ShellProps) {
  return (
    <div style={shellStyle} className="min-h-screen flex items-center justify-center">
      <p className="text-sm font-bold uppercase animate-pulse" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Carregando...</p>
    </div>
  );
}

export function AlreadyUsedScreen({ shellStyle, info }: ShellProps & { info: PublicEvalInfo }) {
  const usedDate = info.usedAt ? new Date(info.usedAt) : null;
  const usedDateStr = usedDate
    ? usedDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;
  const usedTimeStr = usedDate
    ? usedDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;
  return (
    <div style={shellStyle} className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 text-center">
        <CheckCircle2 size={40} className="mx-auto mb-4" style={{ color: "var(--accent-text)" }} />
        <h1 className="font-black text-2xl uppercase tracking-wide mb-2" style={{ fontFamily: CONDENSED }}>Link Já Utilizado</h1>
        <p className="text-sm mb-3" style={{ color: "var(--muted-foreground)" }}>
          Este formulário já foi preenchido por <strong style={{ color: "var(--foreground)" }}>{info.submitterName ?? "alguém"}</strong>.
        </p>
        {usedDateStr && usedTimeStr && (
          <p className="text-xs font-bold uppercase inline-block rounded-lg px-4 py-2" style={{ fontFamily: CONDENSED, backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
            {usedDateStr} às {usedTimeStr}
          </p>
        )}
        <p className="text-xs mt-4" style={{ color: "var(--muted-foreground)" }}>Caso precise de ajuda, entre em contato com o responsável pelo evento.</p>
      </Card>
    </div>
  );
}

export function DoneScreen({ shellStyle, submitterName }: ShellProps & { submitterName: string }) {
  return (
    <div style={shellStyle} className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <CheckCircle2 size={56} strokeWidth={1.5} style={{ color: "var(--accent-text)", margin: "0 auto" }} />
        <h1 className="font-black text-3xl uppercase tracking-wide" style={{ fontFamily: CONDENSED }}>Respostas Enviadas</h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Obrigado, <span className="font-semibold" style={{ color: "var(--foreground)" }}>{submitterName}</span>. Suas respostas foram registradas com sucesso.
        </p>
      </div>
    </div>
  );
}

// Link de critérios sem nenhum critério: antes o botão ficava cinza para
// sempre (allCriteriaScored exige length > 0). Diz na cara o que fazer.
export function NoCriteriaScreen({ shellStyle, eventName }: ShellProps & { eventName: PublicEvalInfo["eventName"] }) {
  return (
    <div style={shellStyle} className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 text-center">
        <AlertTriangle size={40} className="mx-auto mb-4" style={{ color: DANGER_TEXT }} />
        <h1 className="font-black text-2xl uppercase tracking-wide mb-2" style={{ fontFamily: CONDENSED }}>Link sem critérios</h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Este link não tem critérios para avaliar{eventName ? <> em <strong style={{ color: "var(--foreground)" }}>{eventName}</strong></> : null} — peça outro ao responsável pelo evento.
        </p>
      </Card>
    </div>
  );
}
