import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { CheckCircle2, ClipboardCheck, AlertTriangle, ShieldAlert, Sun, Moon } from "lucide-react";

type TokenType = "criteria" | "conformity_cenografia" | "conformity_ferramentas" | "criteria_with_conformity";

interface TokenCriterion {
  criterionId: number;
  criterionName: string;
  criterionDescription: string | null;
}

interface TokenInfo {
  tokenId: string;
  tokenType: TokenType;
  isUsed: boolean;
  usedAt: string | null;
  recipientName: string | null;
  submitterName: string | null;
  eventName: string | null;
  eventStatus: string | null;
  criteria: TokenCriterion[];
}

// score: null = ainda não selecionado; number = selecionado (inclusive 0)
interface CriterionAnswer {
  score: number | null;
  comments: string;
}

// Conformity answer state for Cenografia
interface ConformityAnswers {
  epi: boolean | null;
  estaiamentos: boolean | null;
  conduta: boolean | null;
  epiComment: string;
  estaiamentosComment: string;
  condutaComment: string;
  absencesResponse: boolean | null;
  absencesReport: string;
  standoutResponse: boolean | null;
  standoutJustification: string;
}

// Rótulo apenas nas extremidades (0 e 10), conforme formulário oficial
const scoreLabels: Record<number, string> = {
  0: "Crítico, não atendeu ao básico",
  10: "Perfeição, atendeu completamente e sem erros",
};

// Identidade visual própria desta página (freelancer, sem conta no sistema) —
// tokens de tema aplicados via CSS custom properties, independentes do
// brutalismo usado no resto do app.
const CONDENSED = "'Barlow Condensed', sans-serif";
const BODY = "'Barlow', sans-serif";
const WARNING = "#e5484d";

const darkTokens: React.CSSProperties = {
  ["--background" as string]: "#0c0c0c",
  ["--foreground" as string]: "#f0ede8",
  ["--card" as string]: "#141414",
  ["--card-foreground" as string]: "#f0ede8",
  ["--primary" as string]: "#d4ff00",
  ["--primary-foreground" as string]: "#0c0c0c",
  ["--secondary" as string]: "#1e1e1e",
  ["--muted-foreground" as string]: "#7a7a7a",
  ["--accent" as string]: "#d4ff00",
  ["--accent-foreground" as string]: "#0c0c0c",
  ["--border" as string]: "rgba(255,255,255,0.08)",
  ["--ring" as string]: "#d4ff00",
};

const lightTokens: React.CSSProperties = {
  ["--background" as string]: "#f2f1ec",
  ["--foreground" as string]: "#111111",
  ["--card" as string]: "#ffffff",
  ["--card-foreground" as string]: "#111111",
  ["--primary" as string]: "#111111",
  ["--primary-foreground" as string]: "#ffffff",
  ["--secondary" as string]: "#e8e6e0",
  ["--muted-foreground" as string]: "#888880",
  ["--accent" as string]: "#9ab000",
  ["--accent-foreground" as string]: "#111111",
  ["--border" as string]: "rgba(0,0,0,0.1)",
  ["--ring" as string]: "#111111",
};

/** Botão pill Sim/Não reutilizado nos três formulários. "Não" usa uma cor de
 * alerta fixa (não faz parte do tema) porque sinaliza uma penalidade real. */
function YesNoToggle({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2 shrink-0">
      <button
        type="button"
        onClick={() => onChange(true)}
        className="px-4 py-2 rounded-lg text-xs font-bold tracking-widest uppercase transition-all"
        style={{
          fontFamily: CONDENSED,
          backgroundColor: value === true ? "var(--primary)" : "transparent",
          color: value === true ? "var(--primary-foreground)" : "var(--muted-foreground)",
          border: value === true ? "1px solid var(--primary)" : "1px solid var(--border)",
        }}
      >
        Sim
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className="px-4 py-2 rounded-lg text-xs font-bold tracking-widest uppercase transition-all"
        style={{
          fontFamily: CONDENSED,
          backgroundColor: value === false ? WARNING : "transparent",
          color: value === false ? "#ffffff" : "var(--muted-foreground)",
          border: value === false ? `1px solid ${WARNING}` : "1px solid var(--border)",
        }}
      >
        Não
      </button>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl transition-colors duration-300 ${className}`}
      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
    >
      {children}
    </div>
  );
}

export default function PublicEvalPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [isDark, setIsDark] = useState(false);
  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitterName, setSubmitterName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Criteria form state — score null = ainda não escolhido
  const [answers, setAnswers] = useState<Record<number, CriterionAnswer>>({});

  // Cenografia conformity state
  const [cenoAnswers, setCenoAnswers] = useState<ConformityAnswers>({
    epi: null, estaiamentos: null, conduta: null,
    epiComment: "", estaiamentosComment: "", condutaComment: "",
    absencesResponse: null, absencesReport: "", standoutResponse: null, standoutJustification: "",
  });

  // Ferramentas conformity state
  const [ferramentasAnswer, setFerramentasAnswer] = useState<boolean | null>(null);
  const [ferramentasComment, setFerramentasComment] = useState("");

  const tokens = isDark ? darkTokens : lightTokens;

  useEffect(() => {
    if (!token) return;
    fetch(`/api/public-eval/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error ?? `Erro ${r.status}`);
        }
        return r.json();
      })
      .then((data) => {
        setInfo(data);
        setSubmitterName("");
        setAnswers(
          Object.fromEntries(
            // score: null = ainda não selecionado (0 é nota válida)
            (data.criteria ?? []).map((c: TokenCriterion) => [c.criterionId, { score: null, comments: "" }]),
          ),
        );
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [token]);

  const tokenType = info?.tokenType ?? "criteria";
  const criteria = info?.criteria ?? [];
  const isCombined = tokenType === "criteria_with_conformity";

  // critério pronto = score selecionado (inclui 0) E comentário preenchido
  const allCriteriaScored = criteria.length > 0 && criteria.every((c) => {
    const ans = answers[c.criterionId];
    return ans?.score !== null && ans?.score !== undefined && ans?.comments?.trim().length > 0;
  });

  // Cenografia: resposta "Não" exige comentário explicando o que aconteceu
  const cenoItems = ["epi", "estaiamentos", "conduta"] as const;
  const cenoCommentKeyOf = { epi: "epiComment", estaiamentos: "estaiamentosComment", conduta: "condutaComment" } as const;
  const cenoAllAnswered = cenoItems.every(k => cenoAnswers[k] !== null);
  const cenoCommentMissing = cenoItems.some(k => cenoAnswers[k] === false && !cenoAnswers[cenoCommentKeyOf[k]].trim());
  const cenoAbsencesMissing = !cenoAnswers.absencesReport.trim();
  const cenoStandoutMissing = cenoAnswers.standoutResponse === true && !cenoAnswers.standoutJustification.trim();
  const cenoCanSubmit = cenoAllAnswered && !cenoCommentMissing && !cenoAbsencesMissing && !cenoStandoutMissing;

  // Ferramentas: resposta "Não" exige comentário
  const ferramentasCanSubmit = ferramentasAnswer !== null
    && (ferramentasAnswer !== false || !!ferramentasComment.trim());

  function setScore(criterionId: number, score: number) {
    setAnswers((prev) => ({ ...prev, [criterionId]: { score, comments: prev[criterionId]?.comments ?? "" } }));
  }

  function setComments(criterionId: number, comments: string) {
    setAnswers((prev) => ({ ...prev, [criterionId]: { score: prev[criterionId]?.score ?? null, comments } }));
  }

  async function handleSubmitCriteria() {
    if (!token || !submitterName.trim() || !allCriteriaScored) return;
    if (isCombined && !cenoCanSubmit) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const body: Record<string, unknown> = {
        submitterName: submitterName.trim(),
        evaluations: criteria.map((c) => ({
          criterionId: c.criterionId,
          score: answers[c.criterionId]?.score ?? 0,
          comments: answers[c.criterionId]?.comments || undefined,
        })),
      };
      if (isCombined) {
        Object.assign(body, {
          epi: cenoAnswers.epi,
          estaiamentos: cenoAnswers.estaiamentos,
          conduta: cenoAnswers.conduta,
          epiComment: cenoAnswers.epiComment || null,
          estaiamentosComment: cenoAnswers.estaiamentosComment || null,
          condutaComment: cenoAnswers.condutaComment || null,
          absencesResponse: true,
          absencesReport: cenoAnswers.absencesReport,
          standoutResponse: cenoAnswers.standoutResponse,
          standoutJustification: cenoAnswers.standoutJustification || null,
        });
      }
      const r = await fetch(`/api/public-eval/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Erro ao enviar");
      }
      setDone(true);
    } catch (e: unknown) {
      setSubmitError((e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitConformity() {
    if (!token || !submitterName.trim()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const body: Record<string, unknown> = { submitterName: submitterName.trim() };
      if (tokenType === "conformity_cenografia") {
        Object.assign(body, {
          epi: cenoAnswers.epi,
          estaiamentos: cenoAnswers.estaiamentos,
          conduta: cenoAnswers.conduta,
          epiComment: cenoAnswers.epiComment || null,
          estaiamentosComment: cenoAnswers.estaiamentosComment || null,
          condutaComment: cenoAnswers.condutaComment || null,
          absencesResponse: true,
          absencesReport: cenoAnswers.absencesReport,
          standoutResponse: cenoAnswers.standoutResponse,
          standoutJustification: cenoAnswers.standoutJustification || null,
        });
      } else {
        Object.assign(body, {
          guardaEquipamentos: ferramentasAnswer,
          guardaEquipamentosComment: ferramentasComment || null,
        });
      }
      const r = await fetch(`/api/public-eval/${token}/submit-conformity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Erro ao enviar");
      }
      setDone(true);
    } catch (e: unknown) {
      setSubmitError((e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const shellStyle: React.CSSProperties = {
    ...tokens,
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
    transition: "background-color 0.3s, color 0.3s",
    fontFamily: BODY,
  };

  // ── Loading / error / not-found states ──────────────────────────────────────
  if (loadError) {
    return (
      <div style={shellStyle} className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center">
          <AlertTriangle size={40} className="mx-auto mb-4" style={{ color: WARNING }} />
          <h1 className="font-black text-2xl uppercase tracking-wide mb-2" style={{ fontFamily: CONDENSED }}>Link Inválido</h1>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{loadError}</p>
        </Card>
      </div>
    );
  }

  if (!info) {
    return (
      <div style={shellStyle} className="min-h-screen flex items-center justify-center">
        <p className="text-sm font-bold uppercase animate-pulse" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Carregando...</p>
      </div>
    );
  }

  if (info.isUsed) {
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
          <CheckCircle2 size={40} className="mx-auto mb-4" style={{ color: "var(--accent)" }} />
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

  if (done) {
    return (
      <div style={shellStyle} className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <CheckCircle2 size={56} strokeWidth={1.5} style={{ color: "var(--accent)", margin: "0 auto" }} />
          <h2 className="font-black text-3xl uppercase tracking-wide" style={{ fontFamily: CONDENSED }}>Respostas Enviadas</h2>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Obrigado, <span className="font-semibold" style={{ color: "var(--foreground)" }}>{submitterName}</span>. Suas respostas foram registradas com sucesso.
          </p>
        </div>
      </div>
    );
  }

  const isConformityCenografia = tokenType === "conformity_cenografia";
  const isConformityFerramentas = tokenType === "conformity_ferramentas";
  const isConformity = isConformityCenografia || isConformityFerramentas;
  const showCriteria = !isConformity;
  const showCenografiaConformity = isConformityCenografia || isCombined;
  const canSubmit = !isSubmitting && !!submitterName.trim() && (
    isConformityCenografia ? cenoCanSubmit :
    isConformityFerramentas ? ferramentasCanSubmit :
    isCombined ? (allCriteriaScored && cenoCanSubmit) :
    allCriteriaScored
  );

  return (
    <div style={shellStyle} className="min-h-screen flex flex-col items-center justify-start px-4 py-8">
      <div className="w-full max-w-md space-y-4">

        {/* Toggle de tema */}
        <div className="flex justify-end">
          <button
            onClick={() => setIsDark((d) => !d)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold tracking-widest uppercase transition-all"
            style={{ fontFamily: CONDENSED, border: "1px solid var(--border)", color: "var(--muted-foreground)", background: "transparent" }}
          >
            {isDark ? <Sun size={13} strokeWidth={2} /> : <Moon size={13} strokeWidth={2} />}
            {isDark ? "Light" : "Dark"}
          </button>
        </div>

        {/* Hero header */}
        <Card className="px-6 pt-6 pb-7">
          <div className="flex items-center gap-2 mb-4">
            {(isConformity || isCombined) ? <ShieldAlert size={14} strokeWidth={2.5} style={{ color: "var(--accent)" }} /> : <ClipboardCheck size={14} strokeWidth={2.5} style={{ color: "var(--accent)" }} />}
            <span className="text-[11px] font-bold tracking-[0.18em] uppercase" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>
              {isConformityCenografia ? "Conformidade — Cenografia" : isConformityFerramentas ? "Conformidade — Ferramentas" : isCombined ? "Avaliação + Conformidade" : "Avaliação de Desempenho"}
            </span>
          </div>
          <h1 className="font-black uppercase leading-[0.95] text-[2.2rem]" style={{ fontFamily: CONDENSED }}>
            {info.eventName ?? "Evento"}
          </h1>
          {info.recipientName && (
            <p className="mt-3 text-sm" style={{ color: "var(--muted-foreground)" }}>
              Preparado para: <span className="font-semibold" style={{ color: "var(--foreground)" }}>{info.recipientName}</span>
            </p>
          )}
        </Card>

        {/* Nome */}
        <Card className="px-5 py-5 space-y-3">
          <label className="block text-[11px] font-bold tracking-[0.15em] uppercase" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>
            Seu nome completo <span style={{ color: WARNING }}>*</span>
          </label>
          <input
            type="text"
            value={submitterName}
            onChange={(e) => setSubmitterName(e.target.value)}
            placeholder="Confirme seu nome antes de responder"
            className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all"
            style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          />
        </Card>

        {/* ── Criteria form (escala 0-10, comentário obrigatório) ───────────── */}
        {showCriteria && criteria.map((c) => {
          const ans = answers[c.criterionId];
          const selectedScore = ans?.score ?? null;
          const comment = ans?.comments ?? "";
          const commentMissing = selectedScore !== null && comment.trim().length === 0;
          return (
            <Card key={c.criterionId} className="overflow-hidden">
              <div className="px-5 py-4" style={{ backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
                <p className="text-[11px] font-bold tracking-[0.15em] uppercase mb-0.5" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Critério</p>
                <p className="font-black uppercase text-lg" style={{ fontFamily: CONDENSED }}>{c.criterionName}</p>
                {c.criterionDescription && (
                  <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{c.criterionDescription}</p>
                )}
              </div>
              <div className="p-5 space-y-4">
                {/* Score picker: 0-10, rótulo só nas pontas */}
                <div>
                  <p className="text-[11px] font-bold tracking-[0.15em] uppercase mb-3" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>
                    Nota <span style={{ color: WARNING }}>*</span>
                    {selectedScore !== null && scoreLabels[selectedScore] && (
                      <span className="ml-2 normal-case font-semibold" style={{ color: "var(--accent)" }}>— {scoreLabels[selectedScore]}</span>
                    )}
                  </p>
                  <div className="flex gap-1">
                    {[0,1,2,3,4,5,6,7,8,9,10].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setScore(c.criterionId, s)}
                        className="flex-1 rounded-lg py-2.5 text-sm font-black transition-all"
                        style={{
                          fontFamily: CONDENSED,
                          backgroundColor: selectedScore === s ? "var(--primary)" : "transparent",
                          color: selectedScore === s ? "var(--primary-foreground)" : "var(--muted-foreground)",
                          border: selectedScore === s ? "1px solid var(--primary)" : "1px solid var(--border)",
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[10px] font-medium max-w-[120px] leading-tight" style={{ color: "var(--muted-foreground)" }}>{scoreLabels[0]}</span>
                    <span className="text-[10px] font-medium max-w-[120px] text-right leading-tight" style={{ color: "var(--muted-foreground)" }}>{scoreLabels[10]}</span>
                  </div>
                </div>

                {/* Comentário SEMPRE obrigatório */}
                <div>
                  <label className="block text-[11px] font-bold tracking-[0.15em] uppercase mb-1.5" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>
                    Comentário <span style={{ color: WARNING }}>*</span>
                    <span className="ml-1 text-[10px] font-medium normal-case" style={{ color: "var(--muted-foreground)" }}>(obrigatório)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={comment}
                    onChange={e => setComments(c.criterionId, e.target.value)}
                    placeholder="Descreva o desempenho observado..."
                    className="w-full rounded-lg px-4 py-2.5 text-sm outline-none resize-none transition-all"
                    style={{
                      backgroundColor: "var(--secondary)",
                      color: "var(--foreground)",
                      border: commentMissing ? `1px solid ${WARNING}` : "1px solid var(--border)",
                    }}
                  />
                  {commentMissing && (
                    <p className="text-[10px] font-bold mt-1" style={{ color: WARNING }}>Preencha o comentário antes de enviar.</p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

        {/* ── Cenografia conformity form ───────────────────────────────────── */}
        {showCenografiaConformity && (() => {
          const items: { key: "epi" | "estaiamentos" | "conduta"; commentKey: "epiComment" | "estaiamentosComment" | "condutaComment"; question: string }[] = [
            { key: "epi", commentKey: "epiComment", question: "Todos usaram EPI na arena?" },
            { key: "estaiamentos", commentKey: "estaiamentosComment", question: "Estaiamento e Aterramento foram feitos de maneira correta?" },
            { key: "conduta", commentKey: "condutaComment", question: "Conduta e comportamento foram adequados?" },
          ];
          return (
            <div className="space-y-4">
              <Card className="overflow-hidden">
                <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="text-[11px] font-bold tracking-[0.18em] uppercase" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>Matriz de Conformidade</span>
                </div>
                {items.map((item, i) => {
                  const val = cenoAnswers[item.key];
                  const isNao = val === false;
                  return (
                    <div key={item.key} className="px-5 py-4" style={i < items.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm leading-snug flex-1">{item.question}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          {isNao && <span className="text-[10px] font-bold uppercase whitespace-nowrap" style={{ fontFamily: CONDENSED, color: WARNING }}>-10 pts</span>}
                          <YesNoToggle value={val} onChange={(v) => setCenoAnswers(f => ({ ...f, [item.key]: v }))} />
                        </div>
                      </div>
                      {val !== null && (
                        <div className="mt-3 space-y-1">
                          <label className="text-[10px] font-bold tracking-[0.1em] uppercase" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>
                            Comentário {isNao ? <span className="normal-case font-semibold" style={{ color: WARNING }}>* obrigatório</span> : <span className="font-normal normal-case">(opcional)</span>}
                          </label>
                          <textarea
                            rows={2}
                            placeholder={isNao ? "Descreva o que aconteceu..." : "Alguma observação? (opcional)"}
                            value={cenoAnswers[item.commentKey]}
                            onChange={e => setCenoAnswers(f => ({ ...f, [item.commentKey]: e.target.value }))}
                            className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                            style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                          />
                          {isNao && !cenoAnswers[item.commentKey].trim() && (
                            <p className="text-[10px] font-bold" style={{ color: WARNING }}>Comentário obrigatório quando a resposta é Não.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </Card>

              <Card className="p-5 space-y-1">
                <label className="block text-sm font-semibold">
                  Alguém faltou ou atrasou por mais de 30 minutos? Especifique. <span style={{ color: WARNING }}>*</span> obrigatório
                </label>
                <textarea
                  rows={3}
                  placeholder='Ex.: "João Silva — faltou sem aviso." Se ninguém faltou/atrasou, escreva "Ninguém faltou ou atrasou".'
                  value={cenoAnswers.absencesReport}
                  onChange={e => setCenoAnswers(f => ({ ...f, absencesReport: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                  style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                />
                {!cenoAnswers.absencesReport.trim() && <p className="text-[10px] font-bold" style={{ color: WARNING }}>Especifique antes de enviar.</p>}
              </Card>

              <Card className="p-5 space-y-3">
                <label className="block text-sm font-semibold">
                  Algum profissional teve um desempenho fora da curva? <span style={{ color: WARNING }}>*</span>
                </label>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => setCenoAnswers(f => ({ ...f, standoutResponse: false, standoutJustification: "" }))}
                    className="flex-1 px-4 py-2.5 rounded-lg text-xs font-bold uppercase transition-all"
                    style={{
                      fontFamily: CONDENSED,
                      backgroundColor: cenoAnswers.standoutResponse === false ? "var(--primary)" : "transparent",
                      color: cenoAnswers.standoutResponse === false ? "var(--primary-foreground)" : "var(--muted-foreground)",
                      border: cenoAnswers.standoutResponse === false ? "1px solid var(--primary)" : "1px solid var(--border)",
                    }}
                  >Não, dentro do padrão esperado</button>
                  <button type="button"
                    onClick={() => setCenoAnswers(f => ({ ...f, standoutResponse: true }))}
                    className="flex-1 px-4 py-2.5 rounded-lg text-xs font-bold uppercase transition-all"
                    style={{
                      fontFamily: CONDENSED,
                      backgroundColor: cenoAnswers.standoutResponse === true ? "var(--accent)" : "transparent",
                      color: cenoAnswers.standoutResponse === true ? "var(--accent-foreground)" : "var(--muted-foreground)",
                      border: cenoAnswers.standoutResponse === true ? "1px solid var(--accent)" : "1px solid var(--border)",
                    }}
                  >Sim, houve um grande destaque</button>
                </div>
                {cenoAnswers.standoutResponse === true && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold tracking-[0.1em] uppercase" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>Detalhe o destaque <span>*</span> obrigatório</label>
                    <textarea
                      rows={2}
                      placeholder="Nome do profissional e por que se destacou..."
                      value={cenoAnswers.standoutJustification}
                      onChange={e => setCenoAnswers(f => ({ ...f, standoutJustification: e.target.value }))}
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                      style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                    />
                    {cenoStandoutMissing && <p className="text-[10px] font-bold" style={{ color: WARNING }}>Descreva o destaque antes de enviar.</p>}
                  </div>
                )}
              </Card>
            </div>
          );
        })()}

        {/* ── Ferramentas conformity form ──────────────────────────────────── */}
        {isConformityFerramentas && (() => {
          const isNao = ferramentasAnswer === false;
          return (
            <Card className="overflow-hidden">
              <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="text-[11px] font-bold tracking-[0.18em] uppercase" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>Ferramentas e Case</span>
              </div>
              <div className="px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm leading-snug flex-1">Todos os equipamentos e ferramentas retornaram?</p>
                  <div className="flex items-center gap-2 shrink-0">
                    {isNao && <span className="text-[10px] font-bold uppercase whitespace-nowrap" style={{ fontFamily: CONDENSED, color: WARNING }}>-10 pts</span>}
                    <YesNoToggle value={ferramentasAnswer} onChange={setFerramentasAnswer} />
                  </div>
                </div>
                {ferramentasAnswer !== null && (
                  <div className="mt-3 space-y-1">
                    <label className="text-[10px] font-bold tracking-[0.1em] uppercase" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>
                      Comentário {isNao ? <span className="normal-case font-semibold" style={{ color: WARNING }}>* obrigatório</span> : <span className="font-normal normal-case">(opcional)</span>}
                    </label>
                    <textarea
                      rows={2}
                      placeholder={isNao ? "Descreva o que aconteceu com os equipamentos/ferramentas..." : "Alguma observação? (opcional)"}
                      value={ferramentasComment}
                      onChange={e => setFerramentasComment(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                      style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                    />
                    {isNao && !ferramentasComment.trim() && (
                      <p className="text-[10px] font-bold" style={{ color: WARNING }}>Comentário obrigatório quando a resposta é Não.</p>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })()}

        {/* Submit */}
        {submitError && (
          <div className="rounded-lg px-4 py-3 text-sm font-semibold" style={{ backgroundColor: "rgba(229,72,77,0.1)", border: `1px solid ${WARNING}`, color: WARNING }}>
            {submitError}
          </div>
        )}
        <button
          type="button"
          disabled={!canSubmit}
          onClick={isConformity ? handleSubmitConformity : handleSubmitCriteria}
          className="w-full rounded-xl py-4 font-black text-sm tracking-[0.2em] uppercase transition-all active:scale-[0.98]"
          style={{
            fontFamily: CONDENSED,
            backgroundColor: canSubmit ? "var(--primary)" : "var(--secondary)",
            color: canSubmit ? "var(--primary-foreground)" : "var(--muted-foreground)",
            opacity: canSubmit ? 1 : 0.5,
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          {isSubmitting ? "Enviando..." : "Enviar Respostas"}
        </button>
        <p className="text-center text-xs italic pb-4" style={{ color: "var(--muted-foreground)" }}>
          Este formulário é de uso único e expira após o envio.
        </p>
      </div>
    </div>
  );
}
