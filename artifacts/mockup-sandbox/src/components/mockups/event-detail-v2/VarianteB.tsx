import { ArrowLeft, TrendingUp, TrendingDown, Users, Calendar, MapPin, ShieldCheck, BarChart3, SlidersHorizontal, Zap, ChevronRight, MessageSquare, CheckCircle, AlertCircle } from "lucide-react";
import { useState } from "react";

const event = {
  name: "42K – Florianópolis – 2026",
  city: "Florianópolis", client: "Rock World", date: "06/06/2026 — 06/06/2026",
  status: "Concluído", score: 67.5, avgScore: 67.5, conformityScore: 67.5,
  participants: 12, diarias: 14, evaluated: 4, total: 4, calCount: 4,
};

const criteria = [
  { name: "Perda de Material/Estrutura", area: "Logística",   weight: 3, avg: null, cal: 4.0, comment: "Prejuízo com reembolso da mangueira do caminhão pipa" },
  { name: "Qualidade da Entrega",         area: "Atendimento", weight: 3, avg: null, cal: 8.0, comment: "" },
  { name: "Logística Reversa",            area: "Logística",   weight: 3, avg: null, cal: 7.0, comment: "Carga um pouco desorganizada" },
  { name: "Conduta da Equipe",            area: "RH",          weight: 3, avg: null, cal: 6.0, comment: "" },
];

const team = [
  { name: "Jean Pierre Ott",        initials: "JP", fn: "Coordenador", scores: true },
  { name: "Renan Andrade de Moura", initials: "RA", fn: "Assistente",  scores: true },
  { name: "Paulo Roberto da Silva", initials: "PR", fn: "Técnico",     scores: true },
  { name: "Douglas Ferreira Reis",  initials: "DF", fn: "Técnico",     scores: true },
  { name: "Kaio Gabriel Barbosa",   initials: "KG", fn: "Freela",      scores: false },
];

function ScoreMeter({ score }: { score: number }) {
  const pct = score;
  const segments = [20, 40, 60, 80, 100];
  const color = score >= 80 ? "#ccff00" : score >= 65 ? "#a8c900" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="space-y-1">
      <div className="flex gap-0.5 h-3">
        {segments.map((s, i) => {
          const filled = pct >= s;
          const partial = pct < s && pct >= (segments[i - 1] ?? 0);
          const partialPct = partial ? ((pct - (segments[i - 1] ?? 0)) / 20) * 100 : 0;
          return (
            <div key={s} className="flex-1 bg-[#2a2e30] overflow-hidden relative">
              {(filled || partial) && (
                <div className="absolute inset-0 transition-all" style={{ backgroundColor: color, width: filled ? "100%" : `${partialPct}%` }} />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between">
        {[0, 25, 50, 75, 100].map(v => (
          <span key={v} className="text-[7px] italic text-[#747a60]">{v}</span>
        ))}
      </div>
    </div>
  );
}

function MiniProgress({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#e8eae0] overflow-hidden">
        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[9px] font-black italic shrink-0" style={{ color }}>{value}/{total}</span>
    </div>
  );
}

function InfoChip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 px-3 py-2 border-r border-[#2a2e30] last:border-0 ${accent ? "bg-[#222600]" : ""}`}>
      <span className="text-[8px] font-bold italic uppercase tracking-widest text-[#747a60]">{label}</span>
      <span className={`text-[11px] font-black italic ${accent ? "text-[#ccff00]" : "text-white"}`}>{value}</span>
    </div>
  );
}

export function VarianteB() {
  const [tab, setTab] = useState<"visaoGeral" | "quesitos" | "equipe">("visaoGeral");

  return (
    <div className="min-h-screen bg-[#f2f4f6] flex flex-col" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-30 bg-[#191c1e] border-b-4 border-[#ccff00]">
        {/* Title + inline info bar */}
        <div className="px-5 py-2 flex items-center gap-2 border-b border-[#2a2e30]">
          <button className="flex items-center gap-1 text-[#747a60] hover:text-[#ccff00] text-[10px] italic font-bold shrink-0">
            <ArrowLeft size={11} /> Eventos
          </button>
          <span className="text-[#444933]">/</span>
          <span className="text-[10px] font-black italic uppercase text-white truncate flex-1">{event.name}</span>
          <span className="text-[8px] font-black italic uppercase bg-[#506600] text-[#ccff00] border border-[#768f00] px-2 py-0.5 flex items-center gap-1 shrink-0">
            <ShieldCheck size={8} /> Confirmado
          </span>
          <span className="text-[8px] font-black italic uppercase bg-[#2a2e30] text-[#747a60] border border-[#444] px-2 py-0.5 shrink-0">Histórico</span>
        </div>

        {/* Compact info strip */}
        <div className="flex items-stretch divide-x divide-[#2a2e30]">
          <InfoChip label="Score" value={`${event.score}/100`} accent />
          <InfoChip label="Avaliações" value={`${event.evaluated}/${event.total}`} />
          <InfoChip label="Calibrações" value={`${event.calCount}/${event.total}`} />
          <InfoChip label="Participantes" value={`${event.participants} col.`} />
          <InfoChip label="Diárias" value={`${event.diarias} dias`} />
          <InfoChip label="Período" value={event.date} />
          <InfoChip label="Local" value={event.city} />
          <InfoChip label="Status" value={event.status} />
        </div>

        {/* Tab bar */}
        <div className="flex px-5 gap-0">
          {(["visaoGeral", "quesitos", "equipe"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-[10px] font-black italic uppercase border-b-2 transition-colors ${tab === t ? "text-[#ccff00] border-[#ccff00]" : "text-[#747a60] border-transparent hover:text-white"}`}>
              {{ visaoGeral: "Visão Geral", quesitos: `Quesitos (${criteria.length})`, equipe: `Equipe (${event.participants})` }[t]}
            </button>
          ))}
        </div>
      </div>

      {/* ── VISÃO GERAL ── */}
      {tab === "visaoGeral" && (
        <div className="flex-1 p-5 flex gap-5 min-h-0">

          {/* Left column */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* Score card — full width, dashboard style */}
            <div className="bg-[#191c1e] border-2 border-[#191c1e] p-4 grid grid-cols-4 gap-4 items-center">
              {/* Score meter */}
              <div className="col-span-2">
                <p className="text-[8px] font-black italic uppercase text-[#747a60] mb-2 tracking-widest">Score Final do Evento</p>
                <div className="flex items-end gap-3 mb-3">
                  <span className="text-[52px] font-black italic text-[#ccff00] leading-none">{event.score}</span>
                  <div className="pb-1">
                    <span className="text-[14px] font-black italic text-[#506600]">/100</span>
                    <p className="text-[9px] italic text-[#747a60] mt-0.5">calibrado</p>
                  </div>
                </div>
                <ScoreMeter score={event.score} />
              </div>
              {/* Quick stats */}
              <div className="col-span-2 grid grid-cols-2 gap-3">
                {[
                  { label: "Nota Avaliador", value: event.avgScore.toFixed(1), icon: <TrendingUp size={12} />, dim: false },
                  { label: "Penalidades", value: `−${(event.avgScore - event.conformityScore).toFixed(1)}`, icon: <AlertCircle size={12} />, dim: true },
                  { label: "Participantes", value: `${event.participants}`, icon: <Users size={12} />, dim: false },
                  { label: "Diárias", value: `${event.diarias}d`, icon: <Calendar size={12} />, dim: false },
                ].map(s => (
                  <div key={s.label} className={`border border-[#2a2e30] px-3 py-2 ${s.dim ? "opacity-60" : ""}`}>
                    <div className="flex items-center gap-1.5 text-[#747a60] mb-1">{s.icon}<span className="text-[8px] font-bold italic uppercase">{s.label}</span></div>
                    <p className="text-[20px] font-black italic text-white leading-none">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Criteria table ── */}
            <div className="bg-white border-2 border-[#191c1e]">
              <div className="bg-[#191c1e] px-4 py-2.5 flex items-center justify-between">
                <span className="text-[11px] font-black italic uppercase text-[#ccff00] flex items-center gap-2">
                  <TrendingUp size={12} /> Notas e Calibrações por Critério
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-black italic uppercase bg-[#506600] text-[#ccff00] border border-[#768f00] px-2 py-0.5 flex items-center gap-1">
                    <ShieldCheck size={8} /> 4/4 Pub. Final
                  </span>
                </div>
              </div>

              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f4f6ee] border-b-2 border-[#191c1e]">
                    {["Critério", "Peso", "Nota Avaliador", "Nota Calibrada", "Nota Final", "Δ", "Contribuição"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-[9px] font-black italic uppercase text-[#747a60] text-left tracking-wider first:w-auto last:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {criteria.map((c, i) => {
                    const finalScore = c.cal;
                    const diff = c.avg != null ? c.cal - c.avg : null;
                    const contrib = (finalScore * c.weight).toFixed(1);
                    const tier = finalScore >= 8 ? "high" : finalScore >= 6 ? "mid" : "low";
                    const tierStyle = {
                      high: { bg: "#f2ffd6", border: "#506600", text: "#161e00" },
                      mid: { bg: "#fff8e6", border: "#b58c00", text: "#191c1e" },
                      low: { bg: "#ffede9", border: "#b02f00", text: "#5c1400" },
                    }[tier];
                    return (
                      <tr key={c.name} className={`border-b border-[#f0f2ea] ${i % 2 !== 0 ? "bg-[#fafcf5]" : "bg-white"}`}>
                        <td className="px-4 py-3">
                          <p className="font-black italic text-[12px] text-[#191c1e] uppercase leading-tight">{c.name}</p>
                          <p className="text-[9px] italic text-[#9aa088] mt-0.5">{c.area}</p>
                          {c.comment && (
                            <p className="text-[9px] italic text-[#506600] mt-1 flex items-start gap-1">
                              <span className="shrink-0 mt-0.5">💬</span>{c.comment}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-[12px] font-black italic border-2 border-[#191c1e] px-2 py-0.5 bg-[#f4f6ee] inline-block">{c.weight}</span>
                        </td>
                        <td className="px-3 py-3 text-[13px] font-black italic text-[#9aa088]">
                          {c.avg != null ? c.avg : <span className="text-[#d0d2ca]">—</span>}
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-[16px] font-black italic text-[#191c1e]">{c.cal.toFixed(1)}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1.5 border-2 text-[13px] font-black italic"
                            style={{ backgroundColor: tierStyle.bg, borderColor: tierStyle.border, color: tierStyle.text }}>
                            {finalScore >= 8 ? <CheckCircle size={10} /> : null}
                            {finalScore.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {diff === null
                            ? <span className="text-[#d0d2ca] text-[10px]">—</span>
                            : <div className={`flex items-center gap-0.5 text-[10px] font-black italic ${diff > 0 ? "text-[#506600]" : diff < 0 ? "text-[#b02f00]" : "text-[#c4c9ac]"}`}>
                                {diff > 0 ? <TrendingUp size={9} /> : diff < 0 ? <TrendingDown size={9} /> : null}
                                {diff > 0 ? `+${diff}` : diff === 0 ? "=" : diff}
                              </div>
                          }
                        </td>
                        <td className="px-3 py-3 text-right text-[12px] font-black italic text-[#191c1e]">{contrib}</td>
                      </tr>
                    );
                  })}
                  {/* Total row */}
                  <tr className="bg-[#191c1e]">
                    <td className="px-4 py-2.5" colSpan={6}>
                      <span className="text-[9px] font-black italic uppercase text-[#747a60]">Score da Equipe</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-[18px] font-black italic text-[#ccff00]">{event.score}</span>
                      <span className="text-[9px] font-black italic text-[#747a60] ml-1">/100</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Comments */}
            <div className="bg-white border-2 border-[#191c1e]">
              <div className="bg-[#191c1e] px-4 py-2.5 flex items-center gap-2">
                <MessageSquare size={11} className="text-[#ccff00]" />
                <span className="text-[11px] font-black italic uppercase text-[#ccff00]">Comentários do Evento</span>
              </div>
              <div className="px-4 py-6 text-center">
                <p className="text-[11px] italic font-bold uppercase text-[#c4c9ac] tracking-wider">Nenhum comentário ainda. Seja o primeiro a comentar.</p>
              </div>
              <div className="px-4 py-3 border-t border-[#e8eae0] flex gap-2">
                <input placeholder="Escreva um comentário para toda a equipe..." className="flex-1 text-[11px] italic border border-[#d0d2ca] px-3 py-2 bg-[#f8f9fb] focus:outline-none focus:border-[#ccff00]" />
                <button className="px-4 h-9 bg-[#191c1e] text-[#ccff00] text-[9px] font-black italic uppercase hover:bg-[#506600] transition-colors">Enviar</button>
              </div>
            </div>
          </div>

          {/* ── Right sidebar ── */}
          <div className="w-64 shrink-0 space-y-3">

            {/* Ações Rápidas */}
            <div className="bg-white border-2 border-[#191c1e]">
              <div className="bg-[#191c1e] px-3 py-2 flex items-center gap-2">
                <Zap size={11} className="text-[#ccff00]" />
                <span className="text-[10px] font-black italic uppercase text-[#ccff00]">Ações Rápidas</span>
              </div>
              <div className="p-2.5 space-y-1.5">
                <button className="w-full h-9 bg-[#191c1e] text-[#ccff00] text-[9px] font-black italic uppercase flex items-center gap-2 px-3 hover:bg-[#506600] transition-colors border-2 border-[#191c1e]">
                  <SlidersHorizontal size={11} /> Ver Calibrações
                </button>
                <button className="w-full h-9 border-2 border-[#191c1e] bg-white text-[#191c1e] text-[9px] font-black italic uppercase flex items-center gap-2 px-3 hover:bg-[#f4f6ee] transition-colors">
                  <BarChart3 size={11} /> Resultados
                </button>
              </div>
            </div>

            {/* Progresso */}
            <div className="bg-white border-2 border-[#191c1e]">
              <div className="bg-[#f4f6ee] border-b-2 border-[#191c1e] px-3 py-2">
                <span className="text-[10px] font-black italic uppercase text-[#444933]">Progresso</span>
              </div>
              <div className="p-3 space-y-3">
                {[
                  { label: "Avaliações", v: event.evaluated, t: event.total },
                  { label: "Calibrações", v: event.calCount, t: event.total },
                ].map(p => (
                  <div key={p.label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-[8px] font-black italic uppercase text-[#747a60]">{p.label}</span>
                      <span className="text-[8px] font-black italic text-[#506600]">{p.v}/{p.t}</span>
                    </div>
                    <MiniProgress value={p.v} total={p.t} color="#506600" />
                  </div>
                ))}
              </div>
            </div>

            {/* Score breakdown */}
            <div className="bg-white border-2 border-[#191c1e]">
              <div className="bg-[#f4f6ee] border-b-2 border-[#191c1e] px-3 py-2">
                <span className="text-[10px] font-black italic uppercase text-[#444933]">Breakdown Score</span>
              </div>
              <div className="p-3 space-y-2">
                {criteria.map(c => (
                  <div key={c.name} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[8px] font-black italic text-[#191c1e] uppercase truncate">{c.name}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`text-[11px] font-black italic ${c.cal >= 8 ? "text-[#506600]" : c.cal >= 6 ? "text-[#191c1e]" : "text-[#b02f00]"}`}>{c.cal.toFixed(1)}</span>
                      <span className="text-[7px] italic text-[#9aa088]">×{c.weight}</span>
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t-2 border-[#191c1e] flex justify-between items-center">
                  <span className="text-[9px] font-black italic uppercase text-[#747a60]">Total</span>
                  <span className="text-[18px] font-black italic text-[#ccff00] bg-[#191c1e] px-2 py-0.5">{event.score}</span>
                </div>
              </div>
            </div>

            {/* Equipe preview */}
            <div className="bg-white border-2 border-[#191c1e]">
              <div className="bg-[#f4f6ee] border-b-2 border-[#191c1e] px-3 py-2 flex items-center justify-between">
                <span className="text-[10px] font-black italic uppercase text-[#444933] flex items-center gap-1.5">
                  <Users size={10} /> Equipe
                </span>
              </div>
              <div className="p-3 space-y-1.5">
                {team.map(m => (
                  <div key={m.name} className="flex items-center gap-2">
                    <div className={`w-6 h-6 flex items-center justify-center text-[9px] font-black italic border-2 shrink-0 ${m.scores ? "border-[#191c1e] bg-[#191c1e] text-[#ccff00]" : "border-[#d0d2ca] bg-white text-[#9aa088]"}`}>
                      {m.initials}
                    </div>
                    <span className="text-[9px] font-black italic text-[#191c1e] truncate flex-1">{m.name}</span>
                    {!m.scores && <span className="text-[7px] font-black italic uppercase text-[#9aa088] border border-[#d0d2ca] px-1 shrink-0">inf.</span>}
                  </div>
                ))}
              </div>
              <div className="border-t border-[#e8eae0] px-3 py-2">
                <button className="text-[9px] font-black italic uppercase text-[#506600] hover:underline flex items-center gap-1">
                  + 7 mais → ver equipe <ChevronRight size={10} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab !== "visaoGeral" && (
        <div className="flex-1 p-5 flex items-center justify-center">
          <div className="bg-white border-2 border-[#191c1e] p-8 text-center">
            <p className="text-[11px] italic font-bold uppercase text-[#747a60]">Conteúdo da aba {tab}</p>
          </div>
        </div>
      )}
    </div>
  );
}
