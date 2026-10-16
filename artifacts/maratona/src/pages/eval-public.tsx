// Formulário público de avaliação (link de uso único, sem login): tema e
// orquestração. As peças vivem em ./eval-public/: hook de estado/envio,
// telas de estado (inválido, sem conexão, carregando, já usado, enviado…),
// topo (evento, quem é avaliado, nome), cartão de critério, matrizes de
// conformidade (Cenografia e Ferramentas), progresso e a seção de envio.
import { useEffect } from "react";
import { useParams } from "wouter";
import { Lock, ArrowDown } from "lucide-react";
import { displayCriterionName } from "@/lib/criterion-name";
import { usePublicEval } from "./eval-public/use-public-eval";
import { LoadErrorScreen, LoadingScreen, AlreadyUsedScreen, DoneScreen, NoCriteriaScreen, AllClosedScreen, CycleClosedScreen, MatrixAnsweredScreen, NextCycleScreen } from "./eval-public/status-screens";
import { PublicShell, usePublicTheme } from "./eval-public/ui";
import { FormHero, NameSection } from "./eval-public/form-header";
import { CriterionCard, ClosedCriterionRow } from "./eval-public/criterion-card";
import { CenografiaForm } from "./eval-public/cenografia-form";
import { FerramentasForm } from "./eval-public/ferramentas-form";
import { SubmitSection } from "./eval-public/submit-section";
import { MobileProgressBar, ProgressAside, type Step } from "./eval-public/progress";

const SUBMIT_ID = "envio";

export default function PublicEvalPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const { isDark, toggle } = usePublicTheme();
  const shell = { isDark, onToggleTheme: toggle };
  const ev = usePublicEval(token);
  const { info, submitterName, criteria } = ev;

  // Envio concluído (ou recusado por ser do próximo ciclo): a tela final começa do topo.
  useEffect(() => {
    if (ev.done || ev.nextCycleMessage) window.scrollTo({ top: 0 });
  }, [ev.done, ev.nextCycleMessage]);

  // ── Telas de estado ─────────────────────────────────────────────────────────
  // Evento do próximo ciclo (409 EVENT_NEXT_CYCLE ao abrir ou ao enviar): a mensagem do servidor.
  if (ev.nextCycleMessage) return <NextCycleScreen shell={shell} message={ev.nextCycleMessage} eventName={info?.eventName ?? null} />;
  if (ev.loadError) return <LoadErrorScreen shell={shell} message={ev.loadError} status={ev.loadErrorStatus} onRetry={ev.retryLoad} />;
  if (!info) return <LoadingScreen shell={shell} />;
  if (info.isUsed) return <AlreadyUsedScreen shell={shell} info={info} />;
  // Evento do próximo ciclo (info.nextCycle): o link ainda não aceita envio — avisa antes do formulário.
  if (info.nextCycle && !ev.done) return <NextCycleScreen shell={shell} eventName={info.eventName ?? null} message="Este evento é do próximo ciclo: abre para avaliação quando o ciclo novo for criado." />;
  // Ciclo fechado (só consulta): o link não aceita envio — nada de formulário.
  if (info.cycleClosed && !ev.done) return <CycleClosedScreen shell={shell} info={info} />;
  if (ev.done) {
    return (
      <DoneScreen
        shell={shell}
        eventName={info.eventName}
        submitterName={submitterName}
        criteria={info.criteria}
        rejected={ev.rejected}
        nothingSaved={ev.nothingSaved}
        savedCount={ev.savedCount}
        savedIds={ev.savedIds}
        conformitySaved={ev.conformitySaved}
      />
    );
  }
  // Link só da matriz, e ela já tem resposta: avisa em vez de pedir de novo.
  if (ev.isConformity && info.conformityAnswered) return <MatrixAnsweredScreen shell={shell} info={info} />;
  if (ev.showCriteria && ev.allCriteria.length === 0) return <NoCriteriaScreen shell={shell} eventName={info.eventName} />;
  // Tudo já respondido: avisa antes de a pessoa preencher qualquer coisa. No
  // link combinado com a matriz ainda aberta, a tela mostra só a matriz.
  if (ev.showCriteria && criteria.length === 0 && !ev.needsMatrix) return <AllClosedScreen shell={shell} info={info} />;

  // ── Etapas (progresso, índice e revisão antes do envio) ─────────────────────
  const steps: Step[] = [{ key: "nome", label: "Seu nome", done: !!submitterName.trim(), target: "secao-nome", text: submitterName.trim() || undefined }];
  if (ev.showCriteria) {
    for (const c of criteria) {
      const mark = ev.allCriteria.findIndex(x => x.criterionId === c.criterionId) + 1;
      const a = ev.answers[c.criterionId];
      const score = a?.score ?? null;
      steps.push({
        key: `c-${c.criterionId}`,
        mark,
        label: displayCriterionName(c.criterionName),
        done: score !== null && !!a?.comments?.trim(),
        target: `crit-${c.criterionId}`,
        value: score !== null ? `${score}/10` : undefined,
      });
    }
  }
  if (ev.showCenografiaConformity) steps.push({ key: "matriz", label: "Matriz de Conformidade", done: ev.cenoCanSubmit, target: "matriz" });
  if (ev.isConformityFerramentas) {
    steps.push({
      key: "ferramentas", label: "Ferramentas e Case", done: ev.ferramentasCanSubmit, target: "matriz",
      value: ev.ferramentasAnswer === null ? undefined : ev.ferramentasAnswer ? "Sim" : "Não",
    });
  }

  return (
    <PublicShell {...shell}>
      <div className="mx-auto w-full max-w-[1048px] px-4 pb-32 sm:px-6 lg:grid lg:grid-cols-[minmax(0,680px)_280px] lg:justify-center lg:gap-10 lg:pb-20">
        <main className="min-w-0">
          <FormHero
            info={info}
            isCombined={ev.isCombined}
            isConformityCenografia={ev.isConformityCenografia}
            isConformityFerramentas={ev.isConformityFerramentas}
            openCount={ev.showCriteria ? criteria.length : 0}
            closedCount={ev.showCriteria ? ev.closedCriteria.length : 0}
            withMatrix={ev.needsMatrix}
            draftRestored={ev.draftRestored}
          />

          {/* O formulário inteiro numa superfície só (no celular, de ponta a ponta). */}
          <div className="-mx-4 divide-y divide-border border-y border-border bg-card sm:mx-0 sm:rounded-2xl sm:border">
            <NameSection
              value={submitterName}
              onChange={ev.setSubmitterName}
              recipientName={info.recipientName}
              showError={ev.attempted}
            />

            {/* Critérios: os abertos pedem nota e comentário; os já respondidos ficam só para leitura. */}
            {ev.showCriteria && ev.allCriteria.map((c, i) => (
              c.closed
                ? <ClosedCriterionRow key={c.criterionId} c={c} n={i + 1} />
                : <CriterionCard key={c.criterionId} c={c} n={i + 1} ans={ev.answers[c.criterionId]} setScore={ev.setScore} setComments={ev.setComments} showErrors={ev.attempted} />
            ))}

            {ev.showCriteria && criteria.length === 0 && ev.needsMatrix && (
              <p className="flex items-center gap-2.5 bg-secondary/60 px-4 py-4 text-[15px] font-semibold text-foreground sm:px-7" data-testid="public-only-matrix">
                <ArrowDown size={16} aria-hidden className="shrink-0" /> Falta só a Matriz de Conformidade, logo abaixo.
              </p>
            )}

            {/* Link combinado com a matriz já respondida: não é pedida de novo. */}
            {ev.conformityAnswered && (
              <div className="flex items-start gap-3 px-4 py-5 sm:px-7" data-testid="public-matrix-answered">
                <span aria-hidden className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"><Lock size={14} /></span>
                <p className="text-[15px] leading-relaxed text-muted-foreground">
                  <span className="font-condensed block text-[20px] font-black uppercase leading-tight text-foreground">Matriz de Conformidade</span>
                  Já foi respondida{info.conformityAnsweredByName ? <> por <strong className="font-semibold text-foreground">{info.conformityAnsweredByName}</strong></> : null} — não precisa responder.
                </p>
              </div>
            )}

            {ev.showCenografiaConformity && (
              <CenografiaForm
                cenoAnswers={ev.cenoAnswers}
                setCenoAnswers={ev.setCenoAnswers}
                cenoStandoutMissing={ev.cenoStandoutMissing}
                withoutConduta={ev.withoutConduta}
                showErrors={ev.attempted}
                complete={ev.cenoCanSubmit}
              />
            )}

            {ev.isConformityFerramentas && (
              <FerramentasForm
                answer={ev.ferramentasAnswer}
                onAnswer={ev.setFerramentasAnswer}
                comment={ev.ferramentasComment}
                onComment={ev.setFerramentasComment}
                showErrors={ev.attempted}
              />
            )}

            <SubmitSection
              id={SUBMIT_ID}
              steps={steps}
              submitError={ev.submitError}
              pending={ev.pending}
              isSubmitting={ev.isSubmitting}
              canSubmit={ev.canSubmit}
              onAttempt={() => ev.setAttempted(true)}
              attempted={ev.attempted}
              onSubmit={() => { if (ev.isConformity) void ev.handleSubmitConformity(); else void ev.handleSubmitCriteria(); }}
            />
          </div>
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-6 pt-10">
            <ProgressAside steps={steps} />
          </div>
        </aside>
      </div>

      <MobileProgressBar steps={steps} pending={ev.pending} submitSectionId={SUBMIT_ID} />
    </PublicShell>
  );
}
