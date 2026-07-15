import { ShieldCheck, Flag, Send, Copy, ChevronDown, Users, RotateCcw } from "lucide-react";

const criteria = [
  {
    id: 1, name: "EPI e Segurança", area: "LOGÍSTICA", weight: 4,
    avaliador: 8, calibrado: 9,
    avaliadorComment: "Carga um pouco desorganizada",
    avaliadorName: "Carlos Menezes",
    justificativa: "Carga um pouco desorganizada",
    status: "final", ts: "15/07/2026, 16:20",
  },
  {
    id: 2, name: "Prazo de Entrega", area: "PRODUÇÃO", weight: 5,
    avaliador: 3, calibrado: 8,
    avaliadorComment: "Cenografia: identificamos duas falhas de impressão na testeira da Colgate. Além disso, foi necessário cortar o backdrop do palco.",
    avaliadorName: "Carlos Menezes",
    justificativa: "Cenografia: identificamos duas falhas de impressão na testeira da Colgate. Além disso, foi necessário cortar o backdrop do palco porque a madeira entregue não estava de acordo com o projeto.",
    status: "final", ts: "15/07/2026, 16:20",
  },
  {
    id: 3, name: "Perda de Material", area: "LOGÍSTICA", weight: 3,
    avaliador: 4, calibrado: null,
    avaliadorComment: "",
    avaliadorName: "",
    justificativa: "",
    status: null, ts: null,
  },
  {
    id: 4, name: "Conduta e Comportamento", area: "PRODUÇÃO", weight: 4,
    avaliador: 9, calibrado: null,
    avaliadorComment: "",
    avaliadorName: "",
    justificativa: "",
    status: null, ts: null,
  },
];

function ScoreInput({ value, placeholder }: { value: number | null; placeholder: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[8px] font-black italic uppercase text-[#747a60] mb-0.5">{placeholder}</span>
      <div className={`w-12 h-12 border-2 flex items-center justify-center ${value !== null ? "border-[#191c1e] bg-white" : "border-dashed border-[#c4cda8] bg-[#f8f8f8]"}`}>
        {value !== null ? (
          <span className="text-[22px] font-black italic text-[#191c1e] leading-none">{value}</span>
        ) : (
          <span className="text-[18px] font-black italic text-[#c4cda8]">—</span>
        )}
      </div>
    </div>
  );
}

export function VarianteB() {
  return (
    <div className="min-h-screen bg-[#f2f4f6] font-['Plus_Jakarta_Sans',sans-serif]">
      {/* ── Header ── */}
      <div className="bg-[#191c1e] border-b-4 border-[#ccff00] px-5 py-3 flex items-center gap-4">
        <div className="flex-1">
          <span className="text-[9px] font-black italic uppercase text-[#747a60] tracking-wider block">Calibrações</span>
          <span className="text-[14px] font-black italic uppercase text-white leading-tight">Tech Summit 2026</span>
          <span className="text-[10px] italic text-[#9aa088]">Logística & Produção · 14/07–15/07/2026</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <span className="text-[8px] font-black italic uppercase text-[#747a60] block">Avaliador</span>
            <span className="text-[20px] font-black italic text-[#9aa088]">7.2</span>
          </div>
          <div className="text-center">
            <span className="text-[8px] font-black italic uppercase text-[#ccff00] block">Calibrado</span>
            <span className="text-[20px] font-black italic text-white">8.5</span>
          </div>
          <div className="text-center">
            <span className="text-[8px] font-black italic uppercase text-[#747a60] block">Progresso</span>
            <span className="text-[12px] font-black italic text-[#ccff00] border border-[#ccff00] px-2 py-0.5 block">2 / 4</span>
          </div>
        </div>
      </div>

      {/* ── Cards grid ── */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {criteria.map(c => {
          const diff = c.calibrado !== null ? c.calibrado - c.avaliador : null;
          const hasDiff = diff !== null && diff !== 0;
          return (
            <div key={c.id} className={`bg-white border ${c.status === "final" ? "border-[#506600]" : "border-[#d0d2ca]"} flex flex-col`}>
              {/* Card header */}
              <div className={`px-3 py-2 border-b ${c.status === "final" ? "border-[#c4cda8] bg-[#f4fce0]" : "border-[#e8eae0] bg-[#f8f9fb]"} flex items-center gap-2`}>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-black italic uppercase text-[#191c1e] leading-tight block truncate">{c.name}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[8px] font-bold italic bg-[#eceef0] text-[#747a60] border border-[#d0d2ca] px-1 py-px">{c.area}</span>
                    <span className="text-[8px] font-bold italic text-[#747a60]">Peso {c.weight}</span>
                  </div>
                </div>
                {/* Status badge */}
                {c.status === "final" ? (
                  <span className="text-[9px] font-bold italic uppercase bg-[#506600] text-[#ccff00] border border-[#506600] px-1.5 py-0.5 flex items-center gap-0.5 whitespace-nowrap shrink-0">
                    <ShieldCheck size={9} /> Final
                  </span>
                ) : (
                  <span className="text-[9px] font-bold italic uppercase bg-[#eceef0] text-[#9aa088] border border-[#d0d2ca] px-1.5 py-0.5 whitespace-nowrap shrink-0">Pendente</span>
                )}
              </div>

              {/* Scores row */}
              <div className="px-3 py-3 flex items-center gap-4 border-b border-[#eee]">
                <ScoreInput value={c.avaliador} placeholder="Avaliador" />
                <div className="flex flex-col items-center text-[#d0d2ca]">
                  <span className="text-[10px] font-black italic">→</span>
                  {hasDiff && (
                    <span className={`text-[9px] font-black italic ${diff! > 0 ? "text-[#506600]" : "text-[#b02f00]"}`}>
                      {diff! > 0 ? "+" : ""}{diff}
                    </span>
                  )}
                </div>
                <ScoreInput value={c.calibrado} placeholder="Calibrado" />
                {/* Inline score input */}
                <div className="flex-1 flex flex-col items-center">
                  <span className="text-[8px] font-black italic uppercase text-[#747a60] mb-0.5">Nova nota</span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    placeholder="0–10"
                    className="w-14 h-12 border-2 border-dashed border-[#ccff00] bg-[#f8fdf0] text-center text-[18px] font-black italic text-[#191c1e] focus:outline-none focus:border-[#506600]"
                  />
                </div>
              </div>

              {/* Comment + justification */}
              <div className="px-3 py-2 flex-1 flex flex-col gap-2">
                {/* Avaliador comment */}
                {c.avaliadorComment && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[8px] font-black italic uppercase bg-[#e8f5d0] text-[#506600] px-1 py-px">Avaliador</span>
                      <span className="text-[9px] italic text-[#747a60]">{c.avaliadorName}</span>
                      <button className="ml-auto h-4 w-4 flex items-center justify-center text-[#506600] hover:bg-[#ccff00] transition-colors">
                        <Copy size={9} />
                      </button>
                    </div>
                    <p className="text-[11px] italic text-[#444933] leading-snug line-clamp-2">{c.avaliadorComment}</p>
                  </div>
                )}
                {/* Justificativa */}
                <div className={c.avaliadorComment ? "border-t border-dashed border-[#d0d2ca] pt-2" : ""}>
                  <span className="text-[8px] font-black italic uppercase bg-[#eceef0] text-[#747a60] px-1 py-px block mb-1">Justificativa Calibração</span>
                  <textarea
                    rows={2}
                    defaultValue={c.justificativa}
                    placeholder="Escreva a justificativa…"
                    className="w-full px-2 py-1 text-[11px] italic border border-[#e0e2da] bg-[#fafafa] focus:outline-none focus:ring-1 focus:ring-[#ccff00] placeholder:text-[#b0b8a0] resize-none leading-snug"
                  />
                </div>
              </div>

              {/* Card footer — publish buttons */}
              <div className="px-3 py-2 bg-[#f8f9fb] border-t border-[#e8eae0] flex items-center justify-between">
                {c.ts && (
                  <span className="text-[8px] italic text-[#9aa088]">{c.ts}</span>
                )}
                <div className="flex items-center gap-1 ml-auto">
                  <button className="h-6 px-2 border border-[#191c1e] bg-white text-[#191c1e] text-[9px] font-black italic uppercase hover:bg-[#191c1e] hover:text-white flex items-center gap-1 transition-colors">
                    <Flag size={9} /> Parcial
                  </button>
                  <button className={`h-6 px-2 border text-[9px] font-black italic uppercase flex items-center gap-1 transition-colors ${c.status === "final" ? "bg-[#506600] text-[#ccff00] border-[#506600]" : "bg-[#191c1e] text-[#ccff00] border-[#191c1e] hover:bg-[#506600]"}`}>
                    <ShieldCheck size={9} /> Final
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
