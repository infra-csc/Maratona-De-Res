import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useGetAnalyticsOverview, getGetAnalyticsOverviewQueryKey,
  useGetAnalyticsEventsReport, getGetAnalyticsEventsReportQueryKey,
} from "@workspace/api-client-react";
import { ChevronLeft, ChevronRight, FileText, Presentation, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared";
import { BODY, CONDENSED } from "@/lib/premium-theme";
import { fmtDate } from "@/lib/utils";
import { AnalyticsTabs, AnalyticsScopeFallback } from "./analytics-tabs";
import { keepPreviousData } from "@tanstack/react-query";
import { CycleSelect, CycleScopeNotice, useCycleScope } from "@/components/cycle-select";
import { buildTeamStory } from "./derive";
import { buildSlides, Slide, type SlideDef } from "./slides";

const fmtDay = (iso: string) => fmtDate(iso, { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Análises → Apresentação para a equipe. A mesma história do ciclo contada
 * para os colaboradores: só números da equipe, sem quem avaliou, sem
 * calibração individual e sem nome de colaborador. Rola como página, abre em
 * tela cheia uma parte por vez (setas do teclado) e sai em PDF uma parte por folha.
 */
export default function AnalyticsTeamPage() {
  // Seletor de ciclo: atual (padrão), anterior ou Total geral (todos os ciclos).
  const scope = useCycleScope();
  const p = scope.params;
  const overview = useGetAnalyticsOverview(p, { query: { queryKey: getGetAnalyticsOverviewQueryKey(p), staleTime: 60_000, placeholderData: keepPreviousData } });
  const report = useGetAnalyticsEventsReport(p, { query: { queryKey: getGetAnalyticsEventsReportQueryKey(p), staleTime: 60_000, placeholderData: keepPreviousData } });
  const scopeKind = scope.isAll ? "all" : scope.readOnly ? "past" : "current";

  const slides = useMemo(
    () => (overview.data ? buildSlides(buildTeamStory(overview.data, report.data, fmtDay, scopeKind)) : []),
    [overview.data, report.data, scopeKind],
  );
  const [presenting, setPresenting] = useState<number | null>(null);
  // Estável: o efeito de tela cheia do Presenter depende dela.
  const closePresenter = useCallback(() => setPresenting(null), []);

  if (overview.isLoading) {
    return <AnalyticsScopeFallback scope={scope} current="equipe" state="loading" loadingLabel="Montando a apresentação" errorTitle="" />;
  }
  if (overview.isError || !overview.data) {
    return <AnalyticsScopeFallback scope={scope} current="equipe" state="error" loadingLabel="" errorTitle="Não foi possível montar a apresentação"
      errorDetail={(overview.error as { data?: { error?: string } } | null)?.data?.error} />;
  }

  return (
    <div className="px-4 md:px-6 py-6 space-y-5 max-w-6xl mx-auto" style={{ fontFamily: BODY }}>
      <div className="no-print space-y-5">
        <PageHeader
          eyebrow={overview.data.cycle.name}
          title="Análises"
          description={`Apresentação para a equipe: o que foi bom e o que precisa melhorar ${scope.isAll ? "em todos os ciclos" : "no ciclo"}, só com números da equipe. Não mostra quem avaliou, calibrações nem notas individuais.`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <CycleSelect scope={scope} />
              <Button variant="outline" onClick={() => window.print()} data-testid="button-team-pdf">
                <FileText size={15} className="mr-1.5" aria-hidden /> Exportar PDF
              </Button>
              <Button onClick={() => setPresenting(0)} data-testid="button-team-present">
                <Presentation size={15} className="mr-1.5" aria-hidden /> Apresentar
              </Button>
            </div>
          }
        />
        <AnalyticsTabs current="equipe" />
        <CycleScopeNotice scope={scope} allHelp={<>Os números somam <strong>todos os ciclos</strong>: eventos e critérios de todos eles; nas faixas cada pessoa conta uma vez por ciclo.</>} />
        <p className="flex items-center gap-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          <ShieldCheck size={16} aria-hidden style={{ color: "var(--accent-text)" }} />
          Pronta para mostrar a todos: nenhum nome de avaliador ou de colaborador aparece nesta visão.
        </p>
      </div>

      <div className="space-y-5">
        {slides.map((s, i) => (
          <div key={s.id} className={i < slides.length - 1 ? "print-page-break" : undefined}>
            <Slide id={s.id} index={i} total={slides.length} eyebrow={s.eyebrow} title={s.title} icon={s.icon} lead={s.lead?.(false)}>
              {s.body(false)}
            </Slide>
            <div className="no-print mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setPresenting(i)}
                className="text-[12px] font-semibold underline underline-offset-2"
                style={{ color: "var(--muted-foreground)" }}
              >
                Apresentar a partir daqui
              </button>
            </div>
          </div>
        ))}
      </div>

      {presenting != null ? (
        <Presenter slides={slides} start={presenting} onClose={closePresenter} />
      ) : null}
    </div>
  );
}

/** Tela cheia, uma parte por vez: ← → (ou PageUp/PageDown/espaço), Home/End, Esc sai. */
function Presenter({ slides, start, onClose }: { slides: SlideDef[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const ref = useRef<HTMLDivElement>(null);
  const last = slides.length - 1;
  const go = useCallback((n: number) => setI(Math.max(0, Math.min(last, n))), [last]);

  useEffect(() => {
    const el = ref.current;
    el?.focus();
    // Tela cheia de verdade quando o navegador permite; se não, a camada fixa já cobre a tela.
    el?.requestFullscreen?.().catch(() => undefined);
    const onFsChange = () => { if (!document.fullscreenElement) onClose(); };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [onClose]);

  const onKey = (e: React.KeyboardEvent) => {
    if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); go(i + 1); }
    else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); go(i - 1); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(last); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  const s = slides[i];
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={`Apresentação: ${s.title}`}
      tabIndex={-1}
      onKeyDown={onKey}
      className="fixed inset-0 z-[60] flex flex-col outline-none no-print"
      style={{ backgroundColor: "var(--card)", fontFamily: BODY }}
      data-testid="team-presenter"
    >
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-[1400px] mx-auto h-full">
          <Slide big id={`${s.id}-apresentando`} index={i} total={slides.length} eyebrow={s.eyebrow} title={s.title} icon={s.icon} lead={s.lead?.(true)}>
            {s.body(true)}
          </Slide>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 px-8 py-4" style={{ borderTop: "1px solid var(--border)" }}>
        <button type="button" onClick={onClose} className="inline-flex items-center gap-2 text-[14px] font-bold uppercase" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>
          <X size={18} aria-hidden /> Sair (Esc)
        </button>
        <div className="flex items-center gap-2" aria-hidden>
          {slides.map((sl, n) => (
            <span key={sl.id} className="h-2 rounded-full transition-all" style={{ width: n === i ? 28 : 8, backgroundColor: n === i ? "var(--accent-text)" : "var(--border)" }} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="lg" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Parte anterior">
            <ChevronLeft size={20} aria-hidden />
          </Button>
          <Button size="lg" onClick={() => (i === last ? onClose() : go(i + 1))} aria-label={i === last ? "Encerrar apresentação" : "Próxima parte"}>
            {i === last ? "Encerrar" : <ChevronRight size={20} aria-hidden />}
          </Button>
        </div>
      </div>
    </div>
  );
}
