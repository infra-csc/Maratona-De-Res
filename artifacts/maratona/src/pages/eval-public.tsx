import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { CheckCircle, ClipboardCheck, AlertTriangle, ShieldAlert } from "lucide-react";

type TokenType = "criteria" | "conformity_cenografia" | "conformity_ferramentas";

interface TokenCriterion {
  criterionId: number;
  criterionName: string;
  criterionDescription: string | null;
}

interface TokenInfo {
  tokenId: string;
  tokenType: TokenType;
  isUsed: boolean;
  recipientName: string | null;
  submitterName: string | null;
  eventName: string | null;
  eventStatus: string | null;
  criteria: TokenCriterion[];
}

interface CriterionAnswer {
  score: number;
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
  absencesReport: string;
  standoutResponse: boolean | null;
  standoutJustification: string;
}

const scoreLabels: Record<number, string> = {
  1: "Muito fraco", 2: "Fraco", 3: "Abaixo do esperado",
  4: "Razoável", 5: "Médio", 6: "Acima da média",
  7: "Bom", 8: "Muito bom", 9: "Excelente", 10: "Excepcional",
};

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";

export default function PublicEvalPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitterName, setSubmitterName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Criteria form state
  const [answers, setAnswers] = useState<Record<number, CriterionAnswer>>({});

  // Cenografia conformity state
  const [cenoAnswers, setCenoAnswers] = useState<ConformityAnswers>({
    epi: null, estaiamentos: null, conduta: null,
    epiComment: "", estaiamentosComment: "", condutaComment: "",
    absencesReport: "", standoutResponse: null, standoutJustification: "",
  });

  // Ferramentas conformity state
  const [ferramentasAnswer, setFerramentasAnswer] = useState<boolean | null>(null);
  const [ferramentasComment, setFerramentasComment] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/public-eval/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error ?? "Link inválido");
        }
        return r.json() as Promise<TokenInfo>;
      })
      .then((data) => {
        setInfo(data);
        setSubmitterName(data.recipientName ?? "");
        setAnswers(
          Object.fromEntries(
            (data.criteria ?? []).map((c) => [c.criterionId, { score: 0, comments: "" }]),
          ),
        );
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [token]);

  const tokenType = info?.tokenType ?? "criteria";
  const criteria = info?.criteria ?? [];
  const allCriteriaScored = criteria.length > 0 && criteria.every((c) => (answers[c.criterionId]?.score ?? 0) > 0);

  // Cenografia validation
  const cenoItems = ["epi", "estaiamentos", "conduta"] as const;
  const cenoAllAnswered = cenoItems.every(k => cenoAnswers[k] !== null);
  const cenoAnyCommentMissing = cenoItems.some(k => cenoAnswers[k] === false && !cenoAnswers[`${k}Comment` as keyof ConformityAnswers]?.toString().trim());
  const cenoStandoutMissing = cenoAnswers.standoutResponse === true && !cenoAnswers.standoutJustification.trim();
  const cenoCanSubmit = cenoAllAnswered && !cenoAnyCommentMissing && !cenoStandoutMissing;

  // Ferramentas validation
  const ferramentasCanSubmit = ferramentasAnswer !== null && (ferramentasAnswer === true || ferramentasComment.trim().length > 0);

  function setScore(criterionId: number, score: number) {
    setAnswers((prev) => ({ ...prev, [criterionId]: { score, comments: prev[criterionId]?.comments ?? "" } }));
  }

  function setComments(criterionId: number, comments: string) {
    setAnswers((prev) => ({ ...prev, [criterionId]: { score: prev[criterionId]?.score ?? 0, comments } }));
  }

  async function handleSubmitCriteria() {
    if (!token || !submitterName.trim() || !allCriteriaScored) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const r = await fetch(`/api/public-eval/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submitterName: submitterName.trim(),
          evaluations: criteria.map((c) => ({
            criterionId: c.criterionId,
            score: answers[c.criterionId]?.score,
            comments: answers[c.criterionId]?.comments || undefined,
          })),
        }),
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
          absencesReport: cenoAnswers.absencesReport || null,
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

  // ── Loading / error / not-found states ──────────────────────────────────────
  if (loadError) {
    return (
      <div className="min-h-screen bg-[#f2f4f6] flex items-center justify-center p-6">
        <div className={`bg-white border-2 border-[#191c1e] max-w-md w-full p-8 text-center ${HARD_SHADOW}`}>
          <AlertTriangle size={40} className="mx-auto mb-4 text-[#862200]" />
          <h1 className="text-2xl font-black italic uppercase tracking-tight mb-2">Link Inválido</h1>
          <p className="text-sm italic text-[#444933]">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-[#f2f4f6] flex items-center justify-center">
        <p className="text-sm italic font-bold uppercase text-[#747a60] animate-pulse">Carregando...</p>
      </div>
    );
  }

  if (info.isUsed) {
    return (
      <div className="min-h-screen bg-[#f2f4f6] flex items-center justify-center p-6">
        <div className={`bg-white border-2 border-[#191c1e] max-w-md w-full p-8 text-center ${HARD_SHADOW}`}>
          <CheckCircle size={40} className="mx-auto mb-4 text-[#506600]" />
          <h1 className="text-2xl font-black italic uppercase tracking-tight mb-2">Link Já Utilizado</h1>
          <p className="text-sm italic text-[#444933]">Este link já foi respondido por <strong>{info.submitterName ?? "alguém"}</strong>. Obrigado!</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#f2f4f6] flex items-center justify-center p-6">
        <div className={`bg-white border-2 border-[#191c1e] max-w-md w-full p-8 text-center ${HARD_SHADOW}`}>
          <CheckCircle size={40} className="mx-auto mb-4 text-[#506600]" />
          <h1 className="text-2xl font-black italic uppercase tracking-tight mb-2">Respostas Enviadas!</h1>
          <p className="text-sm italic text-[#444933]">Obrigado, <strong>{submitterName}</strong>. Suas respostas foram registradas com sucesso.</p>
        </div>
      </div>
    );
  }

  const isConformityCenografia = tokenType === "conformity_cenografia";
  const isConformityFerramentas = tokenType === "conformity_ferramentas";
  const isConformity = isConformityCenografia || isConformityFerramentas;
  const canSubmit = !isSubmitting && !!submitterName.trim() && (
    isConformityCenografia ? cenoCanSubmit :
    isConformityFerramentas ? ferramentasCanSubmit :
    allCriteriaScored
  );

  return (
    <div className="min-h-screen bg-[#f2f4f6] p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className={`bg-[#191c1e] text-white p-6 ${HARD_SHADOW}`}>
          <div className="flex items-center gap-3 mb-1">
            {isConformity ? <ShieldAlert size={22} className="text-[#ccff00]" /> : <ClipboardCheck size={22} className="text-[#ccff00]" />}
            <span className="text-xs font-black italic uppercase tracking-widest text-[#ccff00]">
              {isConformityCenografia ? "Conformidade — Cenografia" : isConformityFerramentas ? "Conformidade — Ferramentas" : "Avaliação de Desempenho"}
            </span>
          </div>
          <h1 className="text-2xl font-black italic uppercase tracking-tight">{info.eventName ?? "Evento"}</h1>
          {info.recipientName && (
            <p className="text-sm italic text-white/70 mt-1">Preparado para: <strong className="text-white">{info.recipientName}</strong></p>
          )}
        </div>

        {/* Submitter name */}
        <div className={`bg-white border-2 border-[#191c1e] p-5 ${HARD_SHADOW}`}>
          <label className="block text-xs font-black italic uppercase mb-2 text-[#191c1e]">
            Seu nome completo <span className="text-[#ba1a1a]">*</span>
          </label>
          <input
            type="text"
            value={submitterName}
            onChange={e => setSubmitterName(e.target.value)}
            placeholder="Confirme seu nome antes de responder"
            className="w-full border-2 border-[#191c1e] bg-white px-4 py-3 text-sm italic font-bold focus:outline-none focus:ring-2 focus:ring-[#ccff00]"
          />
        </div>

        {/* ── Criteria form ───────────────────────────────────────────────── */}
        {!isConformity && criteria.map((c) => (
          <div key={c.criterionId} className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
            <div className="bg-[#f2f4f6] border-b-2 border-[#191c1e] px-5 py-3">
              <p className="text-xs font-black italic uppercase text-[#747a60] mb-0.5">Critério</p>
              <p className="text-base font-black italic uppercase text-[#191c1e]">{c.criterionName}</p>
              {c.criterionDescription && (
                <p className="text-xs italic text-[#747a60] mt-1">{c.criterionDescription}</p>
              )}
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs font-black italic uppercase text-[#444933] mb-3">
                  Nota <span className="text-[#ba1a1a]">*</span>
                  {answers[c.criterionId]?.score > 0 && (
                    <span className="ml-2 text-[#506600]">— {scoreLabels[answers[c.criterionId].score]}</span>
                  )}
                </p>
                <div className="grid grid-cols-5 gap-1.5">
                  {[1,2,3,4,5,6,7,8,9,10].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setScore(c.criterionId, s)}
                      className={`border-2 border-[#191c1e] py-2.5 text-sm font-black italic transition-all ${answers[c.criterionId]?.score === s ? "bg-[#ccff00] text-[#161e00]" : "bg-white text-[#9aa088] hover:bg-[#f5f5f5]"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-black italic uppercase mb-1.5 text-[#444933]">
                  Comentário <span className="text-[11px] font-bold normal-case text-[#747a60]">(opcional)</span>
                </label>
                <textarea
                  rows={3}
                  value={answers[c.criterionId]?.comments ?? ""}
                  onChange={e => setComments(c.criterionId, e.target.value)}
                  placeholder="Descreva o desempenho observado..."
                  className="w-full border-2 border-[#191c1e] px-4 py-2.5 text-sm italic resize-none focus:outline-none focus:ring-2 focus:ring-[#ccff00]"
                />
              </div>
            </div>
          </div>
        ))}

        {/* ── Cenografia conformity form ───────────────────────────────────── */}
        {isConformityCenografia && (() => {
          const items: { key: "epi" | "estaiamentos" | "conduta"; label: string; question: string }[] = [
            { key: "epi", label: "Uso de EPI", question: "Todos usaram EPI na arena?" },
            { key: "estaiamentos", label: "Estaiamentos / Aterramentos", question: "Estaiamento e Aterramento foram feitos de maneira correta?" },
            { key: "conduta", label: "Conduta", question: "Conduta e comportamento foram adequados?" },
          ];
          return (
            <div className="space-y-4">
              <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
                <div className="bg-[#191c1e] px-5 py-3">
                  <p className="text-xs font-black italic uppercase text-[#ccff00]">Matriz de Conformidade</p>
                </div>
                <div className="divide-y-2 divide-[#eceef0]">
                  {items.map(item => {
                    const val = cenoAnswers[item.key];
                    const isNao = val === false;
                    const commentKey = `${item.key}Comment` as keyof ConformityAnswers;
                    const commentMissing = isNao && !cenoAnswers[commentKey]?.toString().trim();
                    return (
                      <div key={item.key} className={`px-5 transition-colors ${isNao ? "bg-[#fdece6] border-l-4 border-[#862200]" : val === null ? "bg-[#fffbf0] border-l-4 border-[#d4a800]" : ""}`}>
                        <div className="flex items-center justify-between gap-3 min-h-[56px]">
                          <span className="text-sm font-bold italic text-[#191c1e] leading-snug">{item.question}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {isNao && <span className="text-[10px] font-black italic uppercase text-[#862200] whitespace-nowrap">-10 pts</span>}
                            <div className="flex items-center border-2 border-[#191c1e] overflow-hidden">
                              <button type="button"
                                onClick={() => setCenoAnswers(f => ({ ...f, [item.key]: true }))}
                                className={`px-3 py-1.5 text-[11px] font-black italic uppercase border-r-2 border-[#191c1e] transition-all ${val === true ? "bg-[#ccff00] text-[#161e00]" : "bg-white text-[#9aa088] hover:bg-[#f5f5f5]"}`}
                              >Sim</button>
                              <button type="button"
                                onClick={() => setCenoAnswers(f => ({ ...f, [item.key]: false }))}
                                className={`px-3 py-1.5 text-[11px] font-black italic uppercase transition-all ${val === false ? "bg-[#862200] text-white" : "bg-white text-[#9aa088] hover:bg-[#f5f5f5]"}`}
                              >Não</button>
                            </div>
                          </div>
                        </div>
                        {isNao && (
                          <div className="pb-3 space-y-1">
                            <label className="text-[10px] font-black italic uppercase text-[#862200]">Justificativa <span>*</span> obrigatória quando NÃO</label>
                            <textarea
                              rows={2}
                              placeholder={`Justifique por que ${item.label.toLowerCase()} não foi atendido...`}
                              value={cenoAnswers[commentKey]?.toString() ?? ""}
                              onChange={e => setCenoAnswers(f => ({ ...f, [commentKey]: e.target.value }))}
                              className="w-full border-2 border-[#191c1e] px-3 py-2 text-sm italic resize-none focus:outline-none"
                            />
                            {commentMissing && <p className="text-[10px] font-bold italic text-[#862200]">Preencha a justificativa antes de enviar.</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={`bg-white border-2 border-[#191c1e] p-5 space-y-2 ${HARD_SHADOW}`}>
                <label className="block text-sm font-black italic uppercase text-[#191c1e]">Alguém faltou ou atrasou por mais de 30 minutos?</label>
                <p className="text-[11px] text-[#747a60] italic">Especifique nomes e motivo. Se ninguém faltou, deixe em branco.</p>
                <textarea
                  rows={3}
                  placeholder="Ex.: João Silva — faltou sem aviso."
                  value={cenoAnswers.absencesReport}
                  onChange={e => setCenoAnswers(f => ({ ...f, absencesReport: e.target.value }))}
                  className="w-full border-2 border-[#191c1e] px-3 py-2 text-sm italic resize-none focus:outline-none"
                />
              </div>

              <div className={`bg-white border-2 border-[#191c1e] p-5 space-y-3 ${HARD_SHADOW}`}>
                <label className="block text-sm font-black italic uppercase text-[#191c1e]">Algum profissional teve um desempenho fora da curva?</label>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => setCenoAnswers(f => ({ ...f, standoutResponse: false, standoutJustification: "" }))}
                    className={`flex-1 px-4 py-2.5 text-xs font-black italic uppercase border-2 border-[#191c1e] transition-all ${cenoAnswers.standoutResponse === false ? "bg-[#ccff00] text-[#161e00]" : "bg-white text-[#9aa088] hover:bg-[#f5f5f5]"}`}
                  >Não, dentro do padrão esperado</button>
                  <button type="button"
                    onClick={() => setCenoAnswers(f => ({ ...f, standoutResponse: true }))}
                    className={`flex-1 px-4 py-2.5 text-xs font-black italic uppercase border-2 border-[#191c1e] transition-all ${cenoAnswers.standoutResponse === true ? "bg-[#506600] text-white" : "bg-white text-[#9aa088] hover:bg-[#f5f5f5]"}`}
                  >Sim, houve um grande destaque</button>
                </div>
                {cenoAnswers.standoutResponse === true && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black italic uppercase text-[#506600]">Detalhe o destaque <span>*</span> obrigatório</label>
                    <textarea
                      rows={2}
                      placeholder="Nome do profissional e por que se destacou..."
                      value={cenoAnswers.standoutJustification}
                      onChange={e => setCenoAnswers(f => ({ ...f, standoutJustification: e.target.value }))}
                      className="w-full border-2 border-[#191c1e] px-3 py-2 text-sm italic resize-none focus:outline-none"
                    />
                    {cenoStandoutMissing && <p className="text-[10px] font-bold italic text-[#862200]">Descreva o destaque antes de enviar.</p>}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Ferramentas conformity form ──────────────────────────────────── */}
        {isConformityFerramentas && (() => {
          const isNao = ferramentasAnswer === false;
          const commentMissing = isNao && !ferramentasComment.trim();
          return (
            <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
              <div className="bg-[#191c1e] px-5 py-3">
                <p className="text-xs font-black italic uppercase text-[#ccff00]">Ferramentas e Case</p>
              </div>
              <div className={`px-5 transition-colors ${isNao ? "bg-[#fdece6] border-l-4 border-[#862200]" : ferramentasAnswer === null ? "bg-[#fffbf0] border-l-4 border-[#d4a800]" : ""}`}>
                <div className="flex items-center justify-between gap-3 min-h-[56px]">
                  <span className="text-sm font-bold italic text-[#191c1e] leading-snug">Todos os equipamentos e ferramentas retornaram?</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {isNao && <span className="text-[10px] font-black italic uppercase text-[#862200] whitespace-nowrap">-10 pts</span>}
                    <div className="flex items-center border-2 border-[#191c1e] overflow-hidden">
                      <button type="button"
                        onClick={() => { setFerramentasAnswer(true); setFerramentasComment(""); }}
                        className={`px-3 py-1.5 text-[11px] font-black italic uppercase border-r-2 border-[#191c1e] transition-all ${ferramentasAnswer === true ? "bg-[#ccff00] text-[#161e00]" : "bg-white text-[#9aa088] hover:bg-[#f5f5f5]"}`}
                      >Sim</button>
                      <button type="button"
                        onClick={() => setFerramentasAnswer(false)}
                        className={`px-3 py-1.5 text-[11px] font-black italic uppercase transition-all ${ferramentasAnswer === false ? "bg-[#862200] text-white" : "bg-white text-[#9aa088] hover:bg-[#f5f5f5]"}`}
                      >Não</button>
                    </div>
                  </div>
                </div>
                {isNao && (
                  <div className="pb-3 space-y-1">
                    <label className="text-[10px] font-black italic uppercase text-[#862200]">Justificativa <span>*</span> obrigatória quando NÃO</label>
                    <textarea
                      rows={2}
                      placeholder="Descreva o que aconteceu com os equipamentos/ferramentas..."
                      value={ferramentasComment}
                      onChange={e => setFerramentasComment(e.target.value)}
                      className="w-full border-2 border-[#191c1e] px-3 py-2 text-sm italic resize-none focus:outline-none"
                    />
                    {commentMissing && <p className="text-[10px] font-bold italic text-[#862200]">Preencha a justificativa antes de enviar.</p>}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Submit */}
        {submitError && (
          <div className="border-2 border-[#862200] bg-[#fdece6] px-4 py-3 text-sm font-bold italic text-[#862200]">
            {submitError}
          </div>
        )}
        <button
          type="button"
          disabled={!canSubmit}
          onClick={isConformity ? handleSubmitConformity : handleSubmitCriteria}
          className={`w-full border-2 border-[#191c1e] py-4 font-black text-base italic uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${canSubmit ? `bg-[#ccff00] text-[#161e00] ${HARD_SHADOW} hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_#191c1e]` : "bg-[#eceef0] text-[#747a60] cursor-not-allowed opacity-70"}`}
        >
          {isSubmitting ? "Enviando..." : "Enviar Respostas"}
        </button>
        <p className="text-center text-[11px] italic text-[#747a60]">
          Este formulário é de uso único e expira após o envio.
        </p>
      </div>
    </div>
  );
}
