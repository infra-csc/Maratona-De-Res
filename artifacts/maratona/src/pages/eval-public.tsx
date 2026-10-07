// Formulário público de avaliação (link de uso único, sem login): tema e
// orquestração. As peças vivem em ./eval-public/: hook de estado/envio,
// telas de estado (inválido, carregando, já usado, enviado, sem critérios),
// topo (tema, evento, nome), cartão de critério, matrizes de conformidade
// (Cenografia e Ferramentas) e a seção de envio com a lista de pendências.
import { useState } from "react";
import type { CSSProperties } from "react";
import { useParams } from "wouter";
import { BODY, darkTokens, lightTokens } from "@/lib/premium-theme";
import { usePublicEval } from "./eval-public/use-public-eval";
import { LoadErrorScreen, LoadingScreen, AlreadyUsedScreen, DoneScreen, NoCriteriaScreen, AllClosedScreen, ClosedCriteriaList, CycleClosedScreen, MatrixAnsweredScreen, NextCycleScreen } from "./eval-public/status-screens";
import { Card } from "./eval-public/ui";
import { CONDENSED } from "@/lib/premium-theme";
import { Lock } from "lucide-react";
import { FormHeader } from "./eval-public/form-header";
import { CriterionCard } from "./eval-public/criterion-card";
import { CenografiaForm } from "./eval-public/cenografia-form";
import { FerramentasForm } from "./eval-public/ferramentas-form";
import { SubmitSection } from "./eval-public/submit-section";

export default function PublicEvalPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [isDark, setIsDark] = useState(false);
  const ev = usePublicEval(token);
  const { info, submitterName, criteria } = ev;

  const tokens = isDark ? darkTokens : lightTokens;

  const shellStyle: CSSProperties = {
    ...tokens,
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
    transition: "background-color 0.3s, color 0.3s",
    fontFamily: BODY,
  };

  // ── Loading / error / not-found states ──────────────────────────────────────
  // Evento do próximo ciclo (409 EVENT_NEXT_CYCLE ao abrir ou ao enviar): a mensagem do servidor.
  if (ev.nextCycleMessage) return <NextCycleScreen shellStyle={shellStyle} message={ev.nextCycleMessage} eventName={info?.eventName ?? null} />;
  if (ev.loadError) return <LoadErrorScreen shellStyle={shellStyle} message={ev.loadError} />;
  if (!info) return <LoadingScreen shellStyle={shellStyle} />;
  if (info.isUsed) return <AlreadyUsedScreen shellStyle={shellStyle} info={info} />;
  // Evento do próximo ciclo (info.nextCycle): o link ainda não aceita envio — avisa antes do formulário.
  if (info.nextCycle && !ev.done) return <NextCycleScreen shellStyle={shellStyle} eventName={info.eventName ?? null} message="Este evento é do próximo ciclo: abre para avaliação quando o ciclo novo for criado." />;
  // Ciclo fechado (só consulta): o link não aceita envio — nada de formulário.
  if (info.cycleClosed && !ev.done) return <CycleClosedScreen shellStyle={shellStyle} info={info} />;
  if (ev.done) return <DoneScreen shellStyle={shellStyle} submitterName={submitterName} rejected={ev.rejected} nothingSaved={ev.nothingSaved} savedCount={ev.savedCount} conformitySaved={ev.conformitySaved} />;
  // Link só da matriz, e ela já tem resposta: avisa em vez de pedir de novo.
  if (ev.isConformity && info.conformityAnswered) return <MatrixAnsweredScreen shellStyle={shellStyle} info={info} />;
  if (ev.showCriteria && ev.allCriteria.length === 0) return <NoCriteriaScreen shellStyle={shellStyle} eventName={info.eventName} />;
  // Tudo já respondido: avisa antes de a pessoa preencher qualquer coisa. No
  // link combinado com a matriz ainda aberta, a tela mostra só a matriz.
  if (ev.showCriteria && criteria.length === 0 && !ev.needsMatrix) return <AllClosedScreen shellStyle={shellStyle} info={info} />;

  return (
    <div style={shellStyle} className="min-h-screen flex flex-col items-center justify-start px-4 py-8">
      <div className="w-full max-w-md space-y-4">

        <FormHeader
          info={info}
          isDark={isDark}
          onToggleTheme={() => setIsDark((d) => !d)}
          submitterName={submitterName}
          onSubmitterNameChange={ev.setSubmitterName}
          isConformity={ev.isConformity}
          isCombined={ev.isCombined}
          isConformityCenografia={ev.isConformityCenografia}
          isConformityFerramentas={ev.isConformityFerramentas}
        />

        {/* ── Critérios já respondidos: só leitura, não são cobrados ── */}
        {ev.showCriteria && ev.closedCriteria.length > 0 && (
          <Card className="p-4 space-y-3">
            <p className="text-[11px] font-bold tracking-[0.15em] uppercase" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>
              {ev.closedCriteria.length === 1 ? "1 critério já foi respondido" : `${ev.closedCriteria.length} critérios já foram respondidos`} — não precisa responder
            </p>
            <ClosedCriteriaList criteria={ev.closedCriteria} />
            {criteria.length === 0 && ev.needsMatrix && (
              <p className="text-sm font-semibold" data-testid="public-only-matrix">Falta só a Matriz de Conformidade, logo abaixo.</p>
            )}
          </Card>
        )}

        {/* ── Link combinado com a matriz já respondida: não é pedida de novo ── */}
        {ev.conformityAnswered && (
          <Card className="p-4 flex items-start gap-2" data-testid="public-matrix-answered">
            <Lock size={14} className="shrink-0 mt-0.5" style={{ color: "var(--muted-foreground)" }} aria-hidden />
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              A Matriz de Conformidade deste evento já foi respondida{info.conformityAnsweredByName ? <> por <strong style={{ color: "var(--foreground)" }}>{info.conformityAnsweredByName}</strong></> : null} — não precisa responder.
            </p>
          </Card>
        )}

        {/* ── Criteria form (escala 0-10, comentário obrigatório) ───────────── */}
        {ev.showCriteria && criteria.map((c) => (
          <CriterionCard key={c.criterionId} c={c} ans={ev.answers[c.criterionId]} setScore={ev.setScore} setComments={ev.setComments} />
        ))}

        {/* ── Cenografia conformity form ───────────────────────────────────── */}
        {ev.showCenografiaConformity && (
          <CenografiaForm cenoAnswers={ev.cenoAnswers} setCenoAnswers={ev.setCenoAnswers} cenoStandoutMissing={ev.cenoStandoutMissing} withoutConduta={ev.withoutConduta} showErrors={ev.attempted} />
        )}

        {/* ── Ferramentas conformity form ──────────────────────────────────── */}
        {ev.isConformityFerramentas && (
          <FerramentasForm
            answer={ev.ferramentasAnswer}
            onAnswer={ev.setFerramentasAnswer}
            comment={ev.ferramentasComment}
            onComment={ev.setFerramentasComment}
          />
        )}

        {/* Submit */}
        <SubmitSection
          submitError={ev.submitError}
          pending={ev.pending}
          isSubmitting={ev.isSubmitting}
          canSubmit={ev.canSubmit}
          onAttempt={() => ev.setAttempted(true)}
          onSubmit={() => { if (ev.isConformity) void ev.handleSubmitConformity(); else void ev.handleSubmitCriteria(); }}
        />
      </div>
    </div>
  );
}
