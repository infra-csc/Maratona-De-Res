import type { PublicEvalInfo } from "@workspace/api-client-react";
import { Users, Lock, ListChecks, History, UserCheck } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import { Eyebrow } from "../evaluations/ui";
import { fieldCls, FOCUS_RING } from "./ui";

/** Rótulo do tipo de link, no topo. */
function kindLabel(isCombined: boolean, isConformityCenografia: boolean, isConformityFerramentas: boolean) {
  if (isConformityCenografia) return "Matriz de Conformidade";
  if (isConformityFerramentas) return "Retorno de equipamentos";
  if (isCombined) return "Avaliação da equipe + Matriz de Conformidade";
  return "Avaliação da equipe";
}

/**
 * Topo do formulário: o que é, de qual evento, para quem — e as duas coisas
 * que o freela precisa saber antes de começar: quem é avaliado e que o envio
 * é único.
 */
export function FormHero({
  info, isCombined, isConformityCenografia, isConformityFerramentas, openCount, closedCount, withMatrix, draftRestored,
}: {
  info: PublicEvalInfo;
  isCombined: boolean;
  isConformityCenografia: boolean;
  isConformityFerramentas: boolean;
  /** Critérios a responder neste link. */
  openCount: number;
  /** Critérios que a área já respondeu (só leitura). */
  closedCount: number;
  /** A Matriz de Conformidade (Cenografia) faz parte deste envio. */
  withMatrix: boolean;
  draftRestored: boolean;
}) {
  const isConformity = isConformityCenografia || isConformityFerramentas;
  const scope = isConformityFerramentas
    ? "1 pergunta sobre equipamentos e ferramentas"
    : isConformityCenografia
      ? "Matriz de Conformidade"
      : [openCount > 0 ? plural(openCount, "critério") : null, withMatrix ? "Matriz de Conformidade" : null].filter(Boolean).join(" + ");
  return (
    <section aria-labelledby="public-event-title" className="pt-7 sm:pt-10 pb-6 sm:pb-8">
      <Eyebrow className="text-accent-text">{kindLabel(isCombined, isConformityCenografia, isConformityFerramentas)}</Eyebrow>
      <h1 id="public-event-title" className="font-condensed mt-2.5 text-[34px] sm:text-[44px] font-black uppercase leading-[0.94] tracking-[-0.02em] text-foreground break-words">
        {info.eventName ?? "Evento"}
      </h1>
      {info.recipientName && (
        <p className="mt-3 text-[15px] text-muted-foreground">
          Preparado para: <span className="font-semibold text-foreground">{info.recipientName}</span>
        </p>
      )}

      {/* Quem é avaliado: sempre a equipe de Cenografia do evento. */}
      <div className="mt-6 flex items-start gap-3 rounded-xl bg-secondary/70 px-4 py-3.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-foreground"><Users size={15} aria-hidden /></span>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          {isConformity || (openCount === 0 && withMatrix) ? (
            <><span className="font-semibold text-foreground">As respostas são sobre a equipe de Cenografia deste evento.</span> Responda pelo que você viu em campo.</>
          ) : (
            <><span className="font-semibold text-foreground">Você avalia a equipe de Cenografia deste evento.</span> Cada nota de 0 a 10 vale para a equipe inteira, não para uma pessoa.</>
          )}
        </p>
      </div>

      {/* O que tem para responder e a regra do envio único. */}
      <ul className="mt-4 grid gap-x-6 gap-y-2.5 text-[14px] leading-snug text-muted-foreground sm:grid-cols-2">
        {scope && (
          <li className="flex items-start gap-2.5">
            <ListChecks size={16} aria-hidden className="mt-0.5 shrink-0 text-foreground" />
            <span><span className="font-semibold text-foreground">{scope}</span>{closedCount > 0 ? ` · ${plural(closedCount, "critério")} já ${closedCount === 1 ? "respondido" : "respondidos"} pela área` : ""}</span>
          </li>
        )}
        <li className="flex items-start gap-2.5">
          <Lock size={16} aria-hidden className="mt-0.5 shrink-0 text-foreground" />
          <span><span className="font-semibold text-foreground">Envio único.</span> Depois de enviar, o link fecha e as respostas não mudam mais.</span>
        </li>
      </ul>

      {draftRestored && (
        <p className="mt-4 flex items-start gap-2 text-[13px] leading-snug text-[var(--status-info-text)]" data-testid="public-draft-restored">
          <History size={14} aria-hidden className="mt-0.5 shrink-0" />
          Recuperamos o que você já tinha preenchido neste aparelho. Nada foi enviado ainda.
        </p>
      )}
    </section>
  );
}

/** Quem está respondendo: nome obrigatório (vai junto com as respostas). */
export function NameSection({ value, onChange, recipientName, showError }: {
  value: string;
  onChange: (v: string) => void;
  recipientName: string | null;
  showError: boolean;
}) {
  const missing = !value.trim();
  const suggestion = recipientName?.trim();
  return (
    <section id="secao-nome" aria-labelledby="secao-nome-titulo" className="px-4 py-6 sm:px-7 sm:py-7 scroll-mt-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className={cn(
          "font-condensed mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200",
          missing ? "border border-border bg-card text-muted-foreground" : "bg-primary text-primary-foreground",
        )}>
          <UserCheck size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="secao-nome-titulo" className="font-condensed text-[22px] md:text-[24px] font-black uppercase leading-[1.05] tracking-[-0.01em] text-foreground">Quem está respondendo</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">Seu nome vai junto com as respostas.</p>
        </div>
      </div>
      <div className="mt-4 sm:pl-11" data-pending-box>
        <label htmlFor="field-submitter-name" className="font-condensed mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-foreground">
          Seu nome completo <span className="text-[var(--status-danger-text)]">obrigatório</span>
        </label>
        <input
          id="field-submitter-name"
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="next"
          value={value}
          aria-invalid={(showError && missing) || undefined}
          aria-describedby={showError && missing ? "field-submitter-name-erro" : undefined}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nome e sobrenome"
          className={cn(fieldCls, "h-12 px-3.5", showError && missing && "border-[var(--status-danger)]")}
        />
        {showError && missing && (
          <p id="field-submitter-name-erro" className="mt-1.5 text-[13px] font-semibold text-[var(--status-danger-text)]">Escreva seu nome para enviar.</p>
        )}
        {missing && suggestion && (
          <button
            type="button"
            onClick={() => onChange(suggestion)}
            className={cn("mt-2.5 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-[14px] font-semibold text-foreground underline decoration-border underline-offset-4 transition-colors duration-150 hover:decoration-foreground", FOCUS_RING)}
          >
            Sou {suggestion}
          </button>
        )}
      </div>
    </section>
  );
}
