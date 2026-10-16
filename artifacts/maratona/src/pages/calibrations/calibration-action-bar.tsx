// Barra de trabalho da calibração: progresso, filtros e as duas ações em
// sequência — SALVAR (guarda, ninguém vê) e PUBLICAR (faz valer). Regra do dono
// (02/10/2026): salvar é calibrar; só publicar faz valer.
import { Check, Loader2, Save, Send } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import { Chip, btnPrimary, btnSecondary } from "../evaluations/ui";

export type CalibrationActionBarProps = {
  autoFillableCount: number;
  canFinalize: boolean;
  savingAutoFill: boolean;
  savingAll: boolean;
  publishingAll: boolean;
  autoFillFromEvaluator: () => Promise<void>;
  finalPublishedCount: number;
  scorableCount: number;
  /** Critérios exibidos e quantos já têm calibração salva. */
  totalCount: number;
  calibratedCount: number;
  totalDirtyCount: number;
  /** Critérios salvos e ainda não publicados (não valem na nota). */
  pendingPublishCount: number;
  handleSaveAll: () => Promise<void>;
  /** Abre a confirmação de publicação (ou orienta, se houver algo sem salvar). */
  onPublishClick: () => void;
};

export function CalibrationActionBar({
  autoFillableCount, canFinalize, savingAutoFill, savingAll, publishingAll, autoFillFromEvaluator,
  finalPublishedCount, scorableCount, totalCount, calibratedCount,
  totalDirtyCount, pendingPublishCount, handleSaveAll, onPublishClick,
}: CalibrationActionBarProps) {
  const busy = savingAll || publishingAll || savingAutoFill;
  const pct = totalCount > 0 ? Math.round((calibratedCount / totalCount) * 100) : 0;
  // A ação "da vez" ganha o botão cheio: primeiro salvar o que foi digitado, depois publicar.
  const saveIsNext = totalDirtyCount > 0;
  const publishIsNext = !saveIsNext && pendingPublishCount > 0;

  return (
    <div className="lg:sticky lg:top-16 z-20 -mt-3 pt-3 bg-background">
      <div className="@container rounded-2xl border border-border bg-card shadow-sm">
        <div className="px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-3">
          {/* Progresso */}
          <div className="flex items-center gap-3 min-w-0" title={`${finalPublishedCount} de ${scorableCount} critérios com peso publicados como final`}>
            <div className="relative w-11 h-11 shrink-0" aria-hidden>
              <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="4" className="stroke-secondary" />
                <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="4" strokeLinecap="round"
                  className="stroke-[var(--accent)] transition-[stroke-dasharray] duration-500"
                  strokeDasharray={`${(pct / 100) * 97.4} 97.4`} />
              </svg>
            </div>
            <div className="leading-tight min-w-0">
              <p className="font-condensed text-[19px] font-black tabular-nums text-foreground leading-none" data-testid="cal-progress">
                {calibratedCount}<span className="text-muted-foreground">/{totalCount}</span> <span className="text-[14px] font-bold uppercase tracking-[0.03em]">calibrados</span>
              </p>
              <p className="text-[12.5px] text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{finalPublishedCount} de {scorableCount} como final</span>
                {canFinalize && pendingPublishCount > 0 && (
                  <Chip tone="warn" className="h-5 text-[11.5px]" data-testid="text-pending-publish" title="Calibrações salvas que ainda não foram publicadas: o colaborador e a nota oficial só mudam depois de publicar">
                    {pendingPublishCount} {pendingPublishCount === 1 ? "falta publicar" : "faltam publicar"}
                  </Chip>
                )}
              </p>
            </div>
          </div>

          {/* Ações */}
          <div className="w-full @2xl:w-auto @2xl:ml-auto grid grid-cols-2 gap-2 @2xl:flex @2xl:flex-wrap @2xl:items-center @2xl:justify-end">
            <button
              data-testid="button-save-all-cal"
              type="button"
              disabled={busy || totalDirtyCount === 0}
              onClick={handleSaveAll}
              title={totalDirtyCount === 0 ? "Nenhuma alteração para salvar" : `Salvar ${plural(totalDirtyCount, "alteração", "alterações")}: guarda a calibração, não publica`}
              className={cn(saveIsNext ? btnPrimary : btnSecondary, totalDirtyCount === 0 && calibratedCount > 0 && !savingAll && "border-transparent bg-transparent disabled:opacity-100 text-muted-foreground px-2")}
            >
              {savingAll
                ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Salvando…</>
                : totalDirtyCount > 0
                  ? <><Save size={15} aria-hidden /> Salvar calibração <span className="tabular-nums">· {totalDirtyCount}</span></>
                  : calibratedCount > 0
                    ? <><Check size={15} aria-hidden /> Tudo salvo</>
                    : <><Save size={15} aria-hidden /> Salvar calibração</>}
            </button>
            {canFinalize && (
              <>
                <button
                  data-testid="button-publish-all"
                  type="button"
                  disabled={busy}
                  onClick={onPublishClick}
                  title="Publicar: a calibração salva passa a valer para o colaborador e na nota oficial (parcial ou final, conforme o seletor de cada critério)"
                  className={publishIsNext ? btnPrimary : btnSecondary}
                >
                  {publishingAll ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Publicando…</> : <><Send size={15} aria-hidden /> Publicar</>}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Regra do dono (02/10/2026): salvar é calibrar; só publicar faz valer. */}
        <p data-testid="text-save-vs-publish" className="border-t border-border px-4 py-2 text-[12.5px] leading-snug text-muted-foreground flex flex-wrap gap-x-5 gap-y-1">
          <span className="inline-flex items-baseline gap-1.5">
            <StepDot n={1} />
            <span><strong className="text-foreground font-semibold">Salvar calibração</strong> guarda a nota calibrada — o colaborador não vê e a nota oficial não muda.</span>
          </span>
          <span className="inline-flex items-baseline gap-1.5">
            <StepDot n={2} />
            <span><strong className="text-foreground font-semibold">Publicar</strong> faz valer, como parcial ou final conforme o seletor de cada critério.</span>
          </span>
        </p>
      </div>
    </div>
  );
}

function StepDot({ n }: { n: number }) {
  return <span aria-hidden className="font-condensed shrink-0 w-[18px] h-[18px] rounded-full bg-secondary text-foreground text-[11.5px] font-black inline-flex items-center justify-center translate-y-[1px]">{n}</span>;
}
