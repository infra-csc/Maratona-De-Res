import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useGetAnalyticsOverview, getGetAnalyticsOverviewQueryKey,
  useGetAnalyticsEventsReport, getGetAnalyticsEventsReportQueryKey,
} from "@workspace/api-client-react";
import { keepPreviousData } from "@tanstack/react-query";
import { FileText, Play, Presentation, ShieldCheck } from "lucide-react";
import { CycleScopeNotice, useCycleScope } from "@/components/cycle-select";
import { cn, fmtDate, plural } from "@/lib/utils";
import { btnGhost, btnPrimary, btnSmall } from "../events/events-ui";
import { AnalyticsScopeFallback, AnalyticsTopBar, analyticsBody } from "./analytics-tabs";
import { buildTeamStory } from "./derive";
import { buildSlides, slideMeta } from "./slides";
import { Slide } from "./stage";
import { Presenter } from "./presenter";

const fmtDay = (iso: string) => fmtDate(iso, { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Análises → Apresentação para a equipe. A mesma história do ciclo contada
 * para os colaboradores: só números da equipe, sem quem avaliou, sem
 * calibração individual e sem nome de colaborador. A página mostra cada parte
 * exatamente como sai no telão (prévia 16:9); "Apresentar" abre em tela cheia
 * e "Exportar PDF" imprime uma parte por folha.
 */
export default function AnalyticsTeamPage() {
  // Seletor de ciclo: atual (padrão), anterior ou Total geral (todos os ciclos).
  const scope = useCycleScope();
  const p = scope.params;
  const overview = useGetAnalyticsOverview(p, { query: { queryKey: getGetAnalyticsOverviewQueryKey(p), staleTime: 60_000, placeholderData: keepPreviousData } });
  const report = useGetAnalyticsEventsReport(p, { query: { queryKey: getGetAnalyticsEventsReportQueryKey(p), staleTime: 60_000, placeholderData: keepPreviousData } });
  const scopeKind = scope.isAll ? "all" : scope.readOnly ? "past" : "current";

  const story = useMemo(
    () => (overview.data ? buildTeamStory(overview.data, report.data, fmtDay, scopeKind) : null),
    [overview.data, report.data, scopeKind],
  );
  const slides = useMemo(() => (story ? buildSlides(story) : []), [story]);
  const [presenting, setPresenting] = useState<number | null>(null);
  // Estável: o efeito de tela cheia do Presenter depende dela.
  const closePresenter = useCallback(() => setPresenting(null), []);

  if (overview.isLoading) {
    return <AnalyticsScopeFallback scope={scope} current="equipe" state="loading" loadingLabel="Montando a apresentação" errorTitle="" />;
  }
  if (overview.isError || !overview.data || !story) {
    return <AnalyticsScopeFallback scope={scope} current="equipe" state="error" loadingLabel="" errorTitle="Não foi possível montar a apresentação"
      onRetry={() => { void overview.refetch(); void report.refetch(); }}
      errorDetail={(overview.error as { data?: { error?: string } } | null)?.data?.error} />;
  }

  const meta = slideMeta(story);
  const refreshing = overview.isFetching && overview.isPlaceholderData;

  return (
    <div className="min-h-full flex flex-col min-w-0">
      <AnalyticsTopBar
        scope={scope}
        current="equipe"
        actions={<>
          <button type="button" onClick={() => window.print()} className={cn(btnGhost, "px-2.5 lg:px-3")} data-testid="button-team-pdf"
            aria-label="Exportar PDF" title="Imprime ou salva em PDF, uma parte por folha">
            <FileText size={15} aria-hidden /> <span className="hidden lg:inline">Exportar PDF</span>
          </button>
          <button type="button" onClick={() => setPresenting(0)} className={cn(btnPrimary, "min-h-11 lg:min-h-9 px-3 lg:px-4 text-[13px] gap-1.5")} data-testid="button-team-present">
            <Presentation size={15} aria-hidden /> Apresentar
          </button>
        </>}
      />

      <div className={cn(analyticsBody, "transition-opacity duration-200 motion-reduce:transition-none", refreshing && "opacity-70")} aria-busy={refreshing || undefined}>
        <div className="no-print space-y-4">
          <CycleScopeNotice scope={scope} allHelp={<>Os números somam <strong>todos os ciclos</strong>: eventos e critérios de todos eles; nas faixas cada pessoa conta uma vez por ciclo.</>} />
          <Intro total={slides.length} />
        </div>

        <div className="grid gap-6 2xl:grid-cols-[232px_minmax(0,1fr)] items-start">
          <Roteiro slides={slides} onPresent={setPresenting} />
          <ol className="space-y-6 min-w-0" aria-label="Partes da apresentação">
            {slides.map((s, i) => (
              <li key={s.id} className={cn("min-w-0 scroll-mt-32", i > 0 && "print-page-break")} id={`parte-${s.id}`}>
                <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <Slide id={s.id} index={i} total={slides.length} eyebrow={s.eyebrow} title={s.title} tone={s.tone} lead={s.lead} meta={meta}>
                    {s.body}
                  </Slide>
                </div>
                <div className="no-print mt-2 flex items-center justify-between gap-3">
                  <span className="font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground tabular-nums">Parte {i + 1} de {slides.length}</span>
                  <button type="button" onClick={() => setPresenting(i)} className={cn(btnSmall, "group gap-1.5")} data-testid={`button-present-from-${s.id}`}>
                    <Play size={13} aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                    Apresentar a partir daqui
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {presenting != null ? <Presenter slides={slides} start={presenting} meta={meta} onClose={closePresenter} /> : null}
    </div>
  );
}

/** Faixa de abertura: sigilo garantido + como conduzir. */
function Intro({ total }: { total: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3.5 sm:px-5 flex flex-col lg:flex-row lg:items-center gap-x-6 gap-y-2.5">
      <p className="flex items-start gap-2.5 min-w-0 flex-1 text-[14px] leading-snug text-foreground">
        <ShieldCheck size={18} aria-hidden className="mt-px shrink-0 text-[var(--accent-text)]" />
        <span><strong className="font-semibold">Pronta para mostrar a todos.</strong>{" "}
          <span className="text-muted-foreground">Nenhum nome de avaliador ou de colaborador aparece aqui: só números da equipe.</span>
        </span>
      </p>
      <p className="hidden md:flex items-center gap-2 text-[13px] text-muted-foreground shrink-0">
        <span className="font-semibold text-foreground">{plural(total, "parte")}</span>
        <span aria-hidden>·</span>
        <Kbd>←</Kbd><Kbd>→</Kbd> ou clique para navegar
        <span aria-hidden>·</span>
        <Kbd>Esc</Kbd> sai
      </p>
    </div>
  );
}

function Kbd({ children }: { children: string }) {
  return <kbd className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-md border border-border bg-secondary/60 font-sans text-[12px] font-semibold text-foreground">{children}</kbd>;
}

/** Roteiro (telas largas): as partes em ordem, com a que está na tela em destaque. */
function Roteiro({ slides, onPresent }: { slides: { id: string; title: string }[]; onPresent: (i: number) => void }) {
  const [active, setActive] = useState(slides[0]?.id);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(entries => {
      const top = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setActive(top.target.id.replace(/^parte-/, ""));
    }, { rootMargin: "-30% 0px -55% 0px" });
    slides.forEach(s => { const el = document.getElementById(`parte-${s.id}`); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [slides]);
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <nav aria-label="Roteiro da apresentação" className="no-print hidden 2xl:block sticky top-[132px]">
      <p className="font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground px-3 mb-2">Roteiro</p>
      <ol className="space-y-0.5">
        {slides.map((s, i) => {
          const on = s.id === active;
          return (
            <li key={s.id} className="group relative">
              <button type="button" aria-current={on ? "step" : undefined}
                onClick={() => document.getElementById(`parte-${s.id}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })}
                className={cn("w-full text-left flex items-baseline gap-2.5 min-h-10 pl-3 pr-9 py-2 rounded-lg text-[13.5px] leading-snug transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "bg-secondary text-foreground font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60")}>
                <span className="font-condensed text-[13px] font-black tabular-nums w-4 shrink-0">{i + 1}</span>
                <span className="min-w-0">{s.title}</span>
              </button>
              <button type="button" onClick={() => onPresent(i)} aria-label={`Apresentar a partir de "${s.title}"`} title="Apresentar a partir daqui"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md inline-flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-foreground hover:bg-card transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Play size={13} aria-hidden />
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
