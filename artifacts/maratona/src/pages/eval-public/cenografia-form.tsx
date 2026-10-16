import type { Dispatch, SetStateAction } from "react";
import { CheckCircle2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Chip } from "../evaluations/ui";
import { MatrixHeader, MatrixQuestion, Segmented, matrixLabelCls, matrixTextareaCls } from "../evaluations/conformity-bits";
import type { ConformityAnswers } from "./types";

const allItems: { key: "epi" | "estaiamentos" | "conduta"; commentKey: "epiComment" | "estaiamentosComment" | "condutaComment"; question: string; what: string }[] = [
  { key: "epi", commentKey: "epiComment", question: "Todos usaram EPI na arena?", what: "o uso de EPI" },
  { key: "estaiamentos", commentKey: "estaiamentosComment", question: "Estaiamento e Aterramento foram feitos de maneira correta?", what: "o estaiamento e o aterramento" },
  { key: "conduta", commentKey: "condutaComment", question: "Conduta e comportamento foram adequados?", what: "a conduta" },
];

const YES_NO = [
  { value: true, label: "Sim", tone: "yes" as const },
  { value: false, label: "Não", tone: "no" as const },
];

/** Textos da matriz: 16 px no celular (sem zoom ao focar no iPhone). */
const textCls = cn(matrixTextareaCls, "w-full px-3.5 py-3 text-[16px] md:text-[15px] shadow-none placeholder:text-muted-foreground/80");

function Required() {
  return <span className="text-[var(--status-danger-text)] font-normal text-[13px] whitespace-nowrap">· obrigatório</span>;
}

/**
 * Matriz de Conformidade de Cenografia: Sim/Não (comentário obrigatório no
 * Não), faltas/atrasos e destaque. No ciclo sem "Conduta" a pergunta some.
 */
export function CenografiaForm({ cenoAnswers, setCenoAnswers, cenoStandoutMissing, withoutConduta = false, showErrors = false, complete = false }: {
  cenoAnswers: ConformityAnswers;
  setCenoAnswers: Dispatch<SetStateAction<ConformityAnswers>>;
  cenoStandoutMissing: boolean;
  withoutConduta?: boolean;
  /** Já tentou enviar: mostra os avisos de campo obrigatório vazio. */
  showErrors?: boolean;
  /** Tudo da matriz respondido. */
  complete?: boolean;
}) {
  const items = withoutConduta ? allItems.filter(i => i.key !== "conduta") : allItems;
  const absencesMissing = !cenoAnswers.absencesReport.trim();
  const standoutQ = "ceno-standout-q";
  return (
    <section id="matriz" aria-label="Matriz de Conformidade" className="@container px-4 py-6 sm:px-7 sm:py-7 scroll-mt-4">
      <MatrixHeader
        title="Matriz de Conformidade"
        status={complete ? <Chip tone="ok" icon={CheckCircle2}>Respondida</Chip> : undefined}
        description="Sobre a equipe de Cenografia neste evento. Responda Sim ou Não; se for Não, conte o que aconteceu."
      />

      <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
        {items.map(item => {
          const val = cenoAnswers[item.key];
          const isNao = val === false;
          const commentMissing = isNao && !cenoAnswers[item.commentKey].trim();
          return (
            <div key={item.key} id={`ceno-${item.key}`} data-pending-box className="scroll-mt-4">
              <MatrixQuestion
                id={`ceno-${item.key}-q`}
                question={item.question}
                penalty={isNao}
                unanswered={showErrors && val === null}
                control={
                  <Segmented
                    value={val}
                    options={YES_NO}
                    labelledBy={`ceno-${item.key}-q`}
                    onChange={(v) => setCenoAnswers(f => ({ ...f, [item.key]: v }))}
                  />
                }
              >
                {val !== null && (
                  <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 duration-200">
                    <label htmlFor={`ceno-${item.key}-comment`} className={matrixLabelCls}>
                      Comentário {isNao ? <span className="text-[var(--status-danger-text)]">· obrigatório</span> : <span className="normal-case tracking-normal font-normal">(opcional)</span>}
                    </label>
                    <Textarea
                      id={`ceno-${item.key}-comment`}
                      rows={2}
                      placeholder={isNao ? `Descreva o que aconteceu com ${item.what}...` : "Alguma observação? (opcional)"}
                      value={cenoAnswers[item.commentKey]}
                      aria-invalid={commentMissing || undefined}
                      onChange={e => setCenoAnswers(f => ({ ...f, [item.commentKey]: e.target.value }))}
                      className={cn(textCls, "min-h-[72px]", commentMissing && "border-[var(--status-danger)]")}
                    />
                    {commentMissing && <p className="mt-1.5 text-[13px] font-semibold text-[var(--status-danger-text)]">Comentário obrigatório quando a resposta é Não.</p>}
                  </div>
                )}
              </MatrixQuestion>
            </div>
          );
        })}

        {/* Faltas/atrasos — texto livre, sempre obrigatório */}
        <div className="px-4 py-4 sm:px-5" data-pending-box>
          <label htmlFor="ceno-absences" className="flex items-start gap-2 text-[15px] font-semibold leading-snug text-foreground">
            <span aria-hidden className={cn("mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full", showErrors && absencesMissing ? "bg-[var(--status-warn)]" : "bg-transparent")} />
            <span>Alguém faltou ou atrasou por mais de 30 minutos? Especifique. <Required /></span>
          </label>
          <div className="mt-3 pl-3.5">
            <Textarea
              id="ceno-absences"
              rows={3}
              placeholder={"Ex.: João Silva — faltou sem aviso. Se ninguém faltou ou atrasou, escreva “Ninguém faltou ou atrasou”."}
              value={cenoAnswers.absencesReport}
              aria-invalid={(showErrors && absencesMissing) || undefined}
              onChange={e => setCenoAnswers(f => ({ ...f, absencesReport: e.target.value }))}
              className={cn(textCls, "min-h-[84px]", showErrors && absencesMissing && "border-[var(--status-danger)]")}
            />
            {showErrors && absencesMissing && <p className="mt-1.5 text-[13px] font-semibold text-[var(--status-danger-text)]">Especifique antes de enviar.</p>}
          </div>
        </div>

        {/* Destaque — obrigatória; no Sim, o detalhe também */}
        <div className="px-4 py-4 sm:px-5" data-pending-box>
          <p id={standoutQ} className="flex items-start gap-2 text-[15px] font-semibold leading-snug text-foreground">
            <span aria-hidden className={cn("mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full", showErrors && cenoAnswers.standoutResponse === null ? "bg-[var(--status-warn)]" : "bg-transparent")} />
            <span>Algum profissional teve um desempenho fora da curva? <Required /></span>
          </p>
          <div id="ceno-standout" role="group" aria-labelledby={standoutQ} className="mt-3 grid grid-cols-1 gap-2 pl-3.5 @md:grid-cols-2">
            {([
              { v: false, label: "Não, dentro do padrão esperado" },
              { v: true, label: "Sim, houve um grande destaque" },
            ] as const).map(o => {
              const on = cenoAnswers.standoutResponse === o.v;
              return (
                <button key={String(o.v)} type="button" aria-pressed={on}
                  onClick={() => setCenoAnswers(f => o.v ? { ...f, standoutResponse: true } : { ...f, standoutResponse: false, standoutJustification: "" })}
                  className={cn(
                    "flex min-h-12 items-center gap-2.5 rounded-lg border px-4 py-2.5 text-left text-[15px] font-semibold leading-snug transition-[background-color,border-color,color,transform] duration-150 motion-safe:active:scale-[0.98]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                    on ? (o.v ? "border-transparent bg-accent text-accent-foreground" : "border-transparent bg-primary text-primary-foreground") : "border-border bg-background text-foreground hover:bg-secondary",
                  )}
                >
                  <span aria-hidden className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2", on ? "border-current" : "border-muted-foreground/50")}>
                    {on && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  </span>
                  {o.label}
                </button>
              );
            })}
          </div>
          {showErrors && cenoAnswers.standoutResponse === null && (
            <p className="mt-1.5 pl-3.5 text-[13px] font-semibold text-[var(--status-danger-text)]">Escolha uma das opções antes de enviar.</p>
          )}
          {cenoAnswers.standoutResponse === true && (
            <div className="mt-3 pl-3.5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 duration-200">
              <label htmlFor="ceno-standout-justification" className={matrixLabelCls}>Detalhe o destaque <span className="text-[var(--status-danger-text)]">· obrigatório</span></label>
              <Textarea
                id="ceno-standout-justification"
                rows={2}
                placeholder="Nome do profissional e por que se destacou..."
                value={cenoAnswers.standoutJustification}
                aria-invalid={cenoStandoutMissing || undefined}
                onChange={e => setCenoAnswers(f => ({ ...f, standoutJustification: e.target.value }))}
                className={cn(textCls, "min-h-[72px]", showErrors && cenoStandoutMissing && "border-[var(--status-danger)]")}
              />
              {cenoStandoutMissing && <p className="mt-1.5 text-[13px] font-semibold text-[var(--status-warn-text)]">Descreva o destaque antes de enviar.</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
