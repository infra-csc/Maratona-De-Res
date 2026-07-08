import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { CheckCircle, ClipboardCheck, AlertTriangle } from "lucide-react";

interface TokenInfo {
  tokenId: string;
  isUsed: boolean;
  recipientName: string | null;
  submitterName: string | null;
  eventName: string | null;
  eventStatus: string | null;
  criterionName: string | null;
  criterionDescription: string | null;
}

const scoreLabels: Record<number, string> = {
  1: "Muito fraco", 2: "Fraco", 3: "Abaixo do esperado",
  4: "Razoável", 5: "Médio", 6: "Acima da média",
  7: "Bom", 8: "Muito bom", 9: "Excelente", 10: "Excepcional",
};

export default function PublicEvalPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitterName, setSubmitterName] = useState("");
  const [score, setScore] = useState<number>(0);
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [token]);

  async function handleSubmit() {
    if (!token || score === 0 || !submitterName.trim()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const r = await fetch(`/api/public-eval/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submitterName: submitterName.trim(), score, comments }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Erro ao enviar");
      }
      setDone(true);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#f2f4f6] flex items-center justify-center p-4">
        <div className="bg-white border-2 border-[#191c1e] shadow-[8px_8px_0px_0px_#191c1e] p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-[#ffdad6] border-2 border-[#191c1e] flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={26} className="text-[#ba1a1a]" />
          </div>
          <h2 className="text-xl italic uppercase font-black tracking-tight text-[#ba1a1a] mb-2">Link inválido</h2>
          <p className="text-sm italic text-[#444933]">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-[#f2f4f6] flex items-center justify-center">
        <p className="text-sm italic text-[#747a60] font-bold uppercase">Carregando...</p>
      </div>
    );
  }

  if (info.isUsed || done) {
    return (
      <div className="min-h-screen bg-[#f2f4f6] flex items-center justify-center p-4">
        <div className="bg-white border-2 border-[#191c1e] shadow-[8px_8px_0px_0px_#191c1e] p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-[#ccff00] border-2 border-[#191c1e] flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={26} />
          </div>
          <h2 className="text-2xl italic uppercase font-black tracking-tight mb-2">
            {done ? "Avaliação enviada!" : "Link já utilizado"}
          </h2>
          <p className="text-sm italic text-[#444933]">
            {done
              ? "Obrigado pela sua contribuição. Sua avaliação foi registrada com sucesso."
              : "Este link já foi utilizado anteriormente e não pode ser usado novamente."}
          </p>
          {info.eventName && (
            <p className="text-xs font-bold italic uppercase text-[#747a60] mt-4">{info.eventName}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f4f6] py-12 px-4">
      <div className="max-w-xl mx-auto">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-[#191c1e] text-[#ccff00] px-4 py-2 font-black italic uppercase text-xs tracking-wider mb-4">
            <ClipboardCheck size={14} /> Avaliação de Freelancer
          </div>
          <h1 className="text-3xl md:text-4xl italic uppercase font-black tracking-tight text-[#191c1e] leading-tight">
            Formulário de Avaliação
          </h1>
          {info.eventName && (
            <p className="text-sm italic text-[#747a60] font-bold mt-2">{info.eventName}</p>
          )}
        </div>

        <div className="bg-white border-2 border-[#191c1e] shadow-[8px_8px_0px_0px_#191c1e] p-6 md:p-8 space-y-6">
          <div className="border-2 border-[#ccff00] bg-[#f9ffe0] p-4">
            <p className="text-xs font-black italic uppercase text-[#506600] mb-1">Critério a avaliar</p>
            <h2 className="text-xl italic uppercase font-black tracking-tight text-[#191c1e]">
              {info.criterionName}
            </h2>
            {info.criterionDescription && (
              <p className="text-sm italic text-[#444933] mt-2 leading-relaxed">{info.criterionDescription}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-black italic uppercase mb-2">
              Seu nome <span className="text-[#ba1a1a] text-[10px] ml-1 bg-[#ffdad6] px-2 py-0.5 border border-[#191c1e]">Obrigatório</span>
            </label>
            <input
              type="text"
              value={submitterName}
              onChange={e => setSubmitterName(e.target.value)}
              placeholder="Digite seu nome completo"
              className="w-full border-2 border-[#191c1e] bg-white px-4 py-3 text-sm italic font-bold focus:outline-none focus:ring-2 focus:ring-[#ccff00]"
            />
          </div>

          <div>
            <p className="text-xs font-black italic uppercase mb-3">
              Nota <span className="text-[#ba1a1a] text-[10px] ml-1 bg-[#ffdad6] px-2 py-0.5 border border-[#191c1e]">Obrigatório</span>
            </p>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setScore(val)}
                  className={`border-2 border-[#191c1e] py-3 font-black text-lg italic transition-all ${
                    score === val
                      ? "bg-[#ccff00] text-[#161e00] shadow-[3px_3px_0px_0px_#161e00]"
                      : "bg-white hover:bg-[#f2f4f6]"
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
            {score > 0 && (
              <p className="mt-2 text-xs font-bold italic text-[#747a60] text-center">
                {score} — {scoreLabels[score]}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black italic uppercase">
                Comentário <span className="text-[10px] text-[#747a60] bg-[#e6e8ea] border border-[#191c1e] px-2 py-0.5 ml-1 font-bold italic uppercase">Opcional</span>
              </label>
              <span className="text-[10px] font-bold italic text-[#747a60] tabular-nums">{comments.length}/300</span>
            </div>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              maxLength={300}
              rows={4}
              placeholder="Observações sobre o desempenho da equipe neste critério..."
              className="w-full border-2 border-[#191c1e] bg-white px-4 py-3 text-sm italic resize-y focus:outline-none focus:ring-2 focus:ring-[#ccff00]"
            />
          </div>

          {submitError && (
            <div className="bg-[#ffdad6] border-2 border-[#ba1a1a] px-4 py-3 text-sm font-bold italic text-[#ba1a1a]">
              {submitError}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={score === 0 || !submitterName.trim() || isSubmitting}
            className="w-full bg-[#ccff00] border-2 border-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e] px-6 py-4 font-black italic uppercase text-base tracking-wide disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:shadow-[2px_2px_0px_0px_#191c1e] enabled:hover:translate-x-[2px] enabled:hover:translate-y-[2px] transition-all"
          >
            {isSubmitting ? "Enviando..." : "Enviar Avaliação"}
          </button>

          <p className="text-[11px] text-center italic text-[#747a60]">
            Este link é de uso único e expira após o envio.
          </p>
        </div>
      </div>
    </div>
  );
}
