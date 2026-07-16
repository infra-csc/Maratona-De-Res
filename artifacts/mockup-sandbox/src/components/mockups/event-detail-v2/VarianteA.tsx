import { ArrowLeft, TrendingUp, Users, Calendar, MapPin, ShieldCheck, BarChart3, SlidersHorizontal, Zap, ChevronRight, MessageSquare } from "lucide-react";
import { useState } from "react";

const event = {
  name: "42K – Florianópolis – 2026",
  city: "Florianópolis", client: "—", date: "06/06/2026",
  status: "closed", score: 67.5, avgScore: 67.5, conformityScore: 67.5,
  participants: 12, diarias: 14, evaluated: 4, total: 4, calCount: 4,
};

const criteria = [
  { name: "Perda de Material/Estrutura", area: "Logística", weight: 3, avg: null, cal: 4.0, comment: "Prejuízo com reembolso da mangueira do caminhão pipa" },
  { name: "Qualidade da Entrega",         area: "Atendimento", weight: 3, avg: null, cal: 8.0, comment: "" },
  { name: "Logística Reversa",            area: "Logística",  weight: 3, avg: null, cal: 7.0, comment: "Carga um pouco desorganizada" },
  { name: "Conduta da Equipe",            area: "RH",         weight: 3, avg: null, cal: 6.0, comment: "" },
];

const team = [
  { name: "Jean Pierre Ott",        initials: "JP", fn: "Coordenador", scores: true },
  { name: "Renan Andrade de Moura", initials: "RA", fn: "Assistente",  scores: true },
  { name: "Paulo Roberto da Silva", initials: "PR", fn: "Técnico",     scores: true },
  { name: "Douglas Ferreira Reis",  initials: "DF", fn: "Técnico",     scores: true },
  { name: "Kaio Gabriel Barbosa",   initials: "KG", fn: "Freela",      scores: false },
];

function ScoreBar({ value }: { value: number }) {
  const pct = Math.min(100, value);
  const color = value >= 80 ? "#ccff00" : value >= 60 ? "#a8c900" : "#f59e0b";
  return (
    <div className="w-full h-2 bg-[#2a2e30] mt-2 overflow-hidden">
      <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
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

export function VarianteA() {
  const [tab, setTab] = useState<"visaoGeral" | "quesitos" | "equipe">("visaoGeral");
  const penalty = event.avgScore - event.conformityScore;
  const delta = event.score - event.avgScore;

  return (
    <div className="min-h-screen bg-[#f2f4f6] flex flex-col" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-30 bg-[#191c1e] border-b-4 border-[#ccff00]">
        <div className="px-5 py-2.5 flex items-center gap-3">
          <button className="flex items-center gap-1 text-[#747a60] hover:text-[#ccff00] text-[10px] italic font-bold">
            <ArrowLeft size={11} /> Eventos
          </button>
          <span className="text-[#444933]">/</span>
          <span className="text-[10px] font-black italic uppercase text-white truncate">{event.name}</span>
          <span className="text-[8px] font-black italic uppercase bg-[#506600] text-[#ccff00] border border-[#768f00] px-2 py-0.5 flex items-center gap-1">
            <ShieldCheck size={8} /> Confirmado
          </span>
          <span className="text-[8px] font-black italic uppercase bg-[#2a2e30] text-[#ccff00] border border-[#444] px-2 py-0.5">Histórico</span>

          <div className="flex items-center gap-4 ml-auto">
            <div className="text-center">
              <div className="text-[8px] font-bold italic uppercase text-[#747a60]">Score</div>
              <div className="text-[22px] font-black italic text-[#ccff00] leading-none">{event.score}</div>
            </div>
            <div className="w-px h-8 bg-[#333]" />
            <div className="text-center">
              <div className="text-[8px] font-bold italic uppercase text-[#747a60]">Avaliações</div>
              <div className="text-[15px] font-black italic text-white leading-none">{event.evaluated}/{event.total}</div>
            </div>
            <div className="w-px h-8 bg-[#333]" />
            <div className="text-center">
              <div className="text-[8px] font-bold italic uppercase text-[#747a60]">Critérios</div>
              <div className="text-[15px] font-black italic text-[#ccff00] leading-none">{event.calCount}/{event.total}</div>
            </div>
            <div className="w-px h-8 bg-[#333]" />
            <div className="flex items-center gap-1.5 text-[#9aa088] text-[10px] italic">
              <Calendar size={10} /><span>{event.date}</span>
              <MapPin size={10} className="ml-1" /><span>{event.city}</span>
            </div>
          </div>
        </div>
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

            {/* ── 4 stat cards — improved ── */}
            <div className="grid grid-cols-4 gap-3">

              {/* Score Final — lime bg, score bar */}
              <div className="border-2 border-[#191c1e] bg-[#191c1e] px-4 py-3 col-span-1">
                <p className="text-[8px] font-black italic uppercase text-[#9aa088] mb-1 tracking-widest">Score Final</p>
                <p className="text-[36px] font-black italic leading-none text-[#ccff00]">{event.score}</p>
                <p className="text-[9px] italic text-[#747a60] mt-0.5">/100 · calibrado</p>
                <ScoreBar value={event.score} />
              </div>

              {/* Nota Avaliador */}
              <div className="border-2 border-[#191c1e] bg-white px-4 py-3">
                <p className="text-[8px] font-black italic uppercase text-[#747a60] mb-1 tracking-widest">Nota Avaliador</p>
                <p className="text-[36px] font-black italic leading-none text-[#191c1e]">{event.avgScore}</p>
                <p className="text-[9px] italic text-[#9aa088] mt-0.5">/100 · média bruta</p>
                <div className="mt-2 flex items-center gap-1.5">
                  {delta === 0
                    ? <span className="text-[9px] font-black italic text-[#c4c9ac]">sem calibração</span>
                    : <>
                        <TrendingUp size={10} className={delta > 0 ? "text-[#506600]" : "text-[#b02f00]"} />
                        <span className={`text-[9px] font-black italic ${delta > 0 ? "text-[#506600]" : "text-[#b02f00]"}`}>
                          {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)} pós-cal.
                        </span>
                      </>
                  }
                </div>
              </div>

              {/* Participantes */}
              <div className="border-2 border-[#191c1e] bg-white px-4 py-3">
                <p className="text-[8px] font-black italic uppercase text-[#747a60] mb-1 tracking-widest">Participantes</p>
                <div className="flex items-end gap-2">
                  <p className="text-[36px] font-black italic leading-none text-[#191c1e]">{event.participants}</p>
                  <Users size={18} className="text-[#d0d2ca] mb-1" />
                </div>
                <p className="text-[9px] italic text-[#9aa088] mt-0.5">colaboradores alocados</p>
              </div>

              {/* Diárias */}
              <div className="border-2 border-[#191c1e] bg-white px-4 py-3">
                <p className="text-[8px] font-black italic uppercase text-[#747a60] mb-1 tracking-widest">Diárias Realizadas</p>
                <div className="flex items-end gap-2">
                  <p className="text-[36px] font-black italic leading-none text-[#191c1e]">{event.diarias}</p>
                  <Calendar size={18} className="text-[#d0d2ca] mb-1" />
                </div>
                <p className="text-[9px] italic text-[#9aa088] mt-0.5">dias confirmados</p>
              </div>
            </div>

            {/* ── Criteria table — improved ── */}
            <div className="bg-white border-2 border-[#191c1e]">
              <div className="bg-[#191c1e] px-4 py-2.5 flex items-center justify-between">
                <span className="text-[11px] font-black italic uppercase text-[#ccff00] flex items-center gap-2">
                  <TrendingUp size={12} /> Notas e Calibrações por Critério
                </span>
                <span className="text-[9px] font-black italic uppercase text-[#506600] flex items-center gap-1">
                  <ShieldCheck size={9} /> 4/4 Pub. Final
                </span>
              </div>

              <div className="px-4 py-2 bg-[#fafcf5] border-b border-[#e8eae0]">
                <p className="text-[10px] italic text-[#747a60] leading-relaxed">
                  <strong className="text-[#191c1e]">Nota Avaliador</strong> é a nota dada pela área avaliadora.{" "}
                  <strong className="text-[#191c1e]">Nota Calibrada</strong> é o valor ajustado.{" "}
                  <strong className="text-[#191c1e]">Nota Final</strong> entra no score da equipe.
                </p>
              </div>

              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#191c1e] bg-[#f4f6ee]">
                    <th className="px-4 py-2.5 text-[9px] font-black italic uppercase text-[#747a60] text-left tracking-wider">Critério</th>
                    <th className="px-3 py-2.5 text-[9px] font-black italic uppercase text-[#747a60] text-center tracking-wider w-14">Peso</th>
                    <th className="px-3 py-2.5 text-[9px] font-black italic uppercase text-[#747a60] text-center tracking-wider w-28">Nota Avaliador</th>
                    <th className="px-3 py-2.5 text-[9px] font-black italic uppercase text-[#747a60] text-center tracking-wider w-28">Nota Calibrada</th>
                    <th className="px-3 py-2.5 text-[9px] font-black italic uppercase text-[#747a60] text-center tracking-wider w-20">Nota Final</th>
                    <th className="px-3 py-2.5 text-[9px] font-black italic uppercase text-[#747a60] text-center tracking-wider w-12">Δ</th>
                    <th className="px-3 py-2.5 text-[9px] font-black italic uppercase text-[#747a60] text-right tracking-wider w-24">Contribuição</th>
                  </tr>
                </thead>
                <tbody>
                  {criteria.map((c, i) => {
                    const finalScore = c.cal;
                    const diff = c.avg != null ? c.cal - c.avg : null;
                    const contrib = (finalScore * c.weight).toFixed(1);
                    const scoreColor = finalScore >= 8 ? "#506600" : finalScore >= 6 ? "#191c1e" : "#b02f00";
                    return (
                      <tr key={c.name} className={`border-b border-[#f0f2ea] ${i % 2 !== 0 ? "bg-[#fafcf5]" : "bg-white"}`}>
                        <td className="px-4 py-3">
                          <p className="font-black italic text-[12px] text-[#191c1e] uppercase leading-tight">{c.name}</p>
                          <p className="text-[9px] italic text-[#9aa088] mt-0.5">{c.area}</p>
                          {c.comment && (
                            <p className="text-[9px] italic text-[#747a60] mt-1 border-l-2 border-[#ccff00] pl-2 bg-[#fafcf5] py-0.5">
                              {c.comment}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-[12px] font-black italic border-2 border-[#191c1e] px-2 py-0.5 bg-[#f4f6ee] inline-block">{c.weight}</span>
                        </td>
                        <td className="px-3 py-3 text-center text-[13px] font-black italic text-[#9aa088]">
                          {c.avg != null ? c.avg : <span className="text-[#d0d2ca] font-bold">—</span>}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-[16px] font-black italic" style={{ color: scoreColor }}>{c.cal.toFixed(1)}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="inline-block px-2.5 py-1 text-[14px] font-black italic border-2 border-[#191c1e]"
                            style={{ backgroundColor: finalScore >= 8 ? "#ccff00" : finalScore >= 6 ? "#f4f6ee" : "#ffede9", color: "#191c1e" }}>
                            {finalScore.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {diff === null
                            ? <span className="text-[#d0d2ca] text-[10px] font-bold">—</span>
                            : <span className={`text-[10px] font-black italic ${diff > 0 ? "text-[#506600]" : diff < 0 ? "text-[#b02f00]" : "text-[#c4c9ac]"}`}>
                                {diff > 0 ? `+${diff}` : diff === 0 ? "=" : diff}
                              </span>}
                        </td>
                        <td className="px-3 py-3 text-right text-[12px] font-black italic text-[#191c1e]">{contrib}</td>
                      </tr>
                    );
                  })}
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
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[8px] font-black italic uppercase text-[#747a60]">Avaliações</span>
                    <span className="text-[8px] font-black italic text-[#506600]">{event.evaluated}/{event.total}</span>
                  </div>
                  <MiniProgress value={event.evaluated} total={event.total} color="#506600" />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[8px] font-black italic uppercase text-[#747a60]">Calibrações</span>
                    <span className="text-[8px] font-black italic text-[#506600]">{event.calCount}/{event.total}</span>
                  </div>
                  <MiniProgress value={event.calCount} total={event.total} color="#506600" />
                </div>
                <div className="pt-2 border-t border-[#e8eae0] flex items-center justify-between">
                  <span className="text-[9px] font-black italic uppercase text-[#747a60]">Status Geral</span>
                  <span className="text-[8px] font-black italic uppercase bg-[#191c1e] text-[#ccff00] px-2 py-0.5">
                    100% Avaliado
                  </span>
                </div>
              </div>
            </div>

            {/* Equipe preview */}
            <div className="bg-white border-2 border-[#191c1e]">
              <div className="bg-[#f4f6ee] border-b-2 border-[#191c1e] px-3 py-2 flex items-center justify-between">
                <span className="text-[10px] font-black italic uppercase text-[#444933] flex items-center gap-1.5">
                  <Users size={10} /> Equipe
                </span>
                <span className="text-[8px] font-black italic uppercase text-[#747a60]">{event.participants} col.</span>
              </div>
              <div className="divide-y divide-[#f0f2ea]">
                {team.map(m => (
                  <div key={m.name} className="px-3 py-2 flex items-center gap-2">
                    <div className={`w-6 h-6 flex items-center justify-center text-[9px] font-black italic border-2 shrink-0 ${m.scores ? "border-[#191c1e] bg-[#191c1e] text-[#ccff00]" : "border-[#d0d2ca] bg-[#f8f9fb] text-[#9aa088]"}`}>
                      {m.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-black italic text-[#191c1e] truncate leading-tight">{m.name}</p>
                      <p className="text-[8px] italic text-[#9aa088]">{m.fn}</p>
                    </div>
                    {!m.scores && <span className="text-[7px] font-black italic uppercase bg-[#f0f2ea] text-[#9aa088] border border-[#d0d2ca] px-1 py-px shrink-0">inf.</span>}
                  </div>
                ))}
              </div>
              <div className="border-t border-[#e8eae0] px-3 py-2">
                <button className="text-[9px] font-black italic uppercase text-[#506600] hover:underline flex items-center gap-1">
                  + 7 mais → ver equipe completa <ChevronRight size={10} />
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
