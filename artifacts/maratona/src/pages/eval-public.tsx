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
import { LoadErrorScreen, LoadingScreen, AlreadyUsedScreen, DoneScreen, NoCriteriaScreen } from "./eval-public/status-screens";
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
  if (ev.loadError) return <LoadErrorScreen shellStyle={shellStyle} message={ev.loadError} />;
  if (!info) return <LoadingScreen shellStyle={shellStyle} />;
  if (info.isUsed) return <AlreadyUsedScreen shellStyle={shellStyle} info={info} />;
  if (ev.done) return <DoneScreen shellStyle={shellStyle} submitterName={submitterName} />;
  if (ev.showCriteria && criteria.length === 0) return <NoCriteriaScreen shellStyle={shellStyle} eventName={info.eventName} />;

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

        {/* ── Criteria form (escala 0-10, comentário obrigatório) ───────────── */}
        {ev.showCriteria && criteria.map((c) => (
          <CriterionCard key={c.criterionId} c={c} ans={ev.answers[c.criterionId]} setScore={ev.setScore} setComments={ev.setComments} />
        ))}

        {/* ── Cenografia conformity form ───────────────────────────────────── */}
        {ev.showCenografiaConformity && (
          <CenografiaForm cenoAnswers={ev.cenoAnswers} setCenoAnswers={ev.setCenoAnswers} cenoStandoutMissing={ev.cenoStandoutMissing} />
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
          onSubmit={() => { if (ev.isConformity) void ev.handleSubmitConformity(); else void ev.handleSubmitCriteria(); }}
        />
      </div>
    </div>
  );
}
