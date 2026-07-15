import { useState } from "react";

const SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";

const events = [
  { id: 1, name: "GIRL POWER", sub: "Belo Horizonte · MG", status: "partial", sub2: 3, total: 5, conf: 4, confTotal: 5 },
  { id: 2, name: "SRUN – SOROCABA 2026", sub: "Sorocaba · SP", status: "partial", sub2: 1, total: 5, conf: 0, confTotal: 0 },
  { id: 3, name: "42K FLORIANÓPOLIS", sub: "Florianópolis · SC", status: "pending", sub2: 0, total: 5, conf: 0, confTotal: 0 },
  { id: 4, name: "CORRIDA CIDADE – SP", sub: "São Paulo · SP", status: "done", sub2: 5, total: 5, conf: 0, confTotal: 0 },
  { id: 5, name: "FESTIVAL VERDE – RJ", sub: "Rio de Janeiro · RJ", status: "done", sub2: 7, total: 7, conf: 5, confTotal: 5 },
];

const criteria = [
  { id: 1, area: "Cenografia", name: "Montagem e desmontagem de estruturas", done: true, score: 8, comment: "Equipe eficiente, sem atrasos." },
  { id: 2, area: "Cenografia", name: "Acabamento e detalhamento visual", done: true, score: 7, comment: "Pequenos desvios no acabamento." },
  { id: 3, area: "Cenografia", name: "Limpeza e organização do espaço", done: false, score: null, comment: "" },
  { id: 4, area: "Atendimento", name: "Cordialidade e comunicação com cliente", done: false, score: null, comment: "" },
  { id: 5, area: "Atendimento", name: "Pontualidade e cumprimento de prazos", done: false, score: null, comment: "" },
];

const statusDot: Record<string, string> = {
  done: "bg-[#ccff00]",
  partial: "bg-[#f28b6a]",
  pending: "bg-[#bbbfc4]",
};
const statusBorder: Record<string, string> = {
  done: "border-l-[#506600]",
  partial: "border-l-[#f28b6a]",
  pending: "border-l-[#bbbfc4]",
};
const statusLabel: Record<string, string> = {
  done: "Concluída",
  partial: "Em andamento",
  pending: "A fazer",
};

const areaGroups = [
  { area: "Cenografia", items: criteria.filter(c => c.area === "Cenografia") },
  { area: "Atendimento", items: criteria.filter(c => c.area === "Atendimento") },
];

export function Redesign() {
  const [sel, setSel] = useState<number>(1);
  const [scores, setScores] = useState<Record<number, number | null>>({});
  const [comments, setComments] = useState<Record<number, string>>({});

  const ev = events.find(e => e.id === sel)!;
  const todo = events.filter(e => e.status !== "done");
  const done = events.filter(e => e.status === "done");
  const submitted = criteria.filter(c => c.done).length;
  const pct = Math.round((submitted / criteria.length) * 100);

  return (
    <div
      className="h-screen flex flex-col bg-[#f7f9fb] text-[#191c1e] overflow-hidden select-none"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* ── Top bar ── */}
      <div className="shrink-0 bg-[#191c1e] flex items-center justify-between px-5 py-0 h-11">
        <h1 className="text-[13px] font-black italic uppercase tracking-tight text-white">
          Central de <span className="text-[#ccff00]">Avaliações</span>
        </h1>
        <div className="flex items-center gap-4 text-[10px] font-bold italic uppercase text-[#747a60]">
          <span><span className="text-white font-black">{todo.length}</span> pendentes</span>
          <div className="w-px h-3 bg-[#2e3228]" />
          <span><span className="text-[#ccff00] font-black">{done.length}</span> concluídas</span>
          <div className="w-px h-3 bg-[#2e3228]" />
          <span className="text-[10px] font-black italic uppercase text-[#506600] bg-[#ccff00] px-2 py-0.5">Ciclo 2026</span>
        </div>
      </div>

      {/* ── Body: list + detail ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left: compact event list ── */}
        <div className="w-64 shrink-0 border-r-2 border-[#191c1e] bg-white flex flex-col overflow-hidden">

          {/* Search */}
          <div className="px-3 py-2 border-b border-[#eceef0]">
            <div className="flex items-center gap-2 border border-[#dde0e3] bg-[#f7f9fb] px-2.5 py-1.5">
              <span className="text-[#bbbfc4] text-[10px]">⌕</span>
              <span className="text-[10px] italic text-[#bbbfc4]">Buscar evento...</span>
            </div>
          </div>

          {/* A Fazer group */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-3 pt-3 pb-1">
              <span className="text-[8px] font-black italic uppercase tracking-widest text-[#747a60]">A Fazer · {todo.length}</span>
            </div>
            {todo.map(ev => {
              const pct = ev.total > 0 ? Math.round((ev.sub2 / ev.total) * 100) : 0;
              const active = sel === ev.id;
              return (
                <button
                  key={ev.id}
                  onClick={() => setSel(ev.id)}
                  className={`w-full text-left px-3 py-2.5 border-l-[3px] ${statusBorder[ev.status]} flex flex-col gap-1 transition-colors ${
                    active ? "bg-[#f7ffd1]" : "hover:bg-[#f7f9fb]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-[11px] font-black italic uppercase leading-tight truncate ${active ? "text-[#191c1e]" : "text-[#2e3228]"}`}>
                      {ev.name}
                    </span>
                    <div className={`w-2 h-2 shrink-0 rounded-full ${statusDot[ev.status]}`} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1 bg-[#eceef0] overflow-hidden">
                      <div
                        className={`h-full ${ev.status === "partial" ? "bg-[#f28b6a]" : "bg-[#d0d4c8]"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[8px] font-black italic text-[#747a60] shrink-0">{ev.sub2}/{ev.total}</span>
                  </div>
                </button>
              );
            })}

            {/* Concluídas group */}
            <div className="px-3 pt-4 pb-1">
              <span className="text-[8px] font-black italic uppercase tracking-widest text-[#747a60]">Concluídas · {done.length}</span>
            </div>
            {done.map(ev => {
              const active = sel === ev.id;
              return (
                <button
                  key={ev.id}
                  onClick={() => setSel(ev.id)}
                  className={`w-full text-left px-3 py-2.5 border-l-[3px] border-l-[#506600] flex flex-col gap-1 transition-colors opacity-70 hover:opacity-100 ${
                    active ? "bg-[#f7ffd1] opacity-100" : "hover:bg-[#f7f9fb]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-black italic uppercase leading-tight truncate text-[#2e3228]">{ev.name}</span>
                    <div className="w-2 h-2 shrink-0 rounded-full bg-[#ccff00]" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1 bg-[#eceef0] overflow-hidden">
                      <div className="h-full bg-[#ccff00]" style={{ width: "100%" }} />
                    </div>
                    <span className="text-[8px] font-black italic text-[#506600] shrink-0">100%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right: evaluation detail ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Event header strip */}
          <div className="shrink-0 border-b-2 border-[#191c1e] bg-white px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-1 self-stretch ${ev.status === "done" ? "bg-[#ccff00]" : ev.status === "partial" ? "bg-[#f28b6a]" : "bg-[#bbbfc4]"}`} />
              <div className="min-w-0">
                <h2 className="text-[15px] font-black italic uppercase tracking-tight text-[#191c1e] leading-tight truncate">{ev.name}</h2>
                <p className="text-[10px] italic text-[#747a60] mt-0">{ev.sub}</p>
              </div>
              <span className={`shrink-0 text-[9px] font-black italic uppercase px-2 py-0.5 border ${
                ev.status === "done" ? "bg-[#ccff00] text-[#161e00] border-[#506600]"
                : ev.status === "partial" ? "bg-[#ffdbd1] text-[#862200] border-[#f0a090]"
                : "bg-[#f2f4f6] text-[#444933] border-[#c8cbd0]"
              }`}>
                {statusLabel[ev.status]}
              </span>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold italic uppercase text-[#747a60]">Progresso</span>
                <div className="w-24 h-2 bg-[#eceef0] border border-[#dde0e3] overflow-hidden">
                  <div
                    className={`h-full ${ev.status === "done" ? "bg-[#ccff00]" : "bg-[#f28b6a]"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[9px] font-black italic text-[#191c1e]">{submitted}/{criteria.length}</span>
              </div>
              <button className={`text-[9px] font-black italic uppercase px-3 py-1.5 border-2 border-[#191c1e] bg-[#191c1e] text-[#ccff00] ${SHADOW} hover:bg-[#2e3228] transition-colors`}>
                Lançar Tudo →
              </button>
            </div>
          </div>

          {/* Criteria list */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {areaGroups.map(group => (
              <div key={group.area}>
                {/* Area divider */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[9px] font-black italic uppercase tracking-widest text-[#747a60]">{group.area}</span>
                  <div className="flex-1 h-px bg-[#dde0e3]" />
                  <span className="text-[9px] italic font-bold text-[#747a60]">
                    {group.items.filter(c => c.done).length}/{group.items.length}
                  </span>
                </div>

                {/* Criterion rows */}
                <div className="space-y-2">
                  {group.items.map(c => {
                    const sc = scores[c.id] !== undefined ? scores[c.id] : c.done ? c.score : null;
                    const cm = comments[c.id] !== undefined ? comments[c.id] : c.done ? c.comment : "";
                    return (
                      <div
                        key={c.id}
                        className={`border-2 border-[#191c1e] border-l-4 bg-white transition-all ${
                          c.done ? "border-l-[#506600]" : "border-l-[#dde0e3]"
                        }`}
                      >
                        {/* Criterion header row */}
                        <div className="flex items-center gap-3 px-4 py-2.5">
                          <div className={`w-3.5 h-3.5 shrink-0 border-2 border-[#191c1e] flex items-center justify-center ${c.done ? "bg-[#ccff00]" : "bg-white"}`}>
                            {c.done && <span className="text-[7px] font-black">✓</span>}
                          </div>
                          <span className="flex-1 text-[11px] font-black italic uppercase tracking-tight text-[#191c1e] leading-snug">{c.name}</span>
                          {c.done && (
                            <span className="shrink-0 text-[10px] font-black italic text-[#506600] bg-[#ccff00]/20 px-2 py-0.5 border border-[#506600]/30">
                              {c.score}/10
                            </span>
                          )}
                        </div>

                        {/* Submitted: collapsed comment */}
                        {c.done && (
                          <div className="px-4 pb-2.5 border-t border-dashed border-[#eceef0]">
                            <p className="text-[10px] italic text-[#747a60] mt-1.5">"{c.comment}"</p>
                          </div>
                        )}

                        {/* Not submitted: score + comment inline */}
                        {!c.done && (
                          <div className="px-4 pb-3 border-t border-[#eceef0] space-y-2.5 pt-2.5">
                            {/* Score strip */}
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] font-black italic uppercase text-[#747a60] w-6 shrink-0">Nota</span>
                              <div className="flex gap-0.5">
                                {Array.from({ length: 11 }, (_, i) => (
                                  <button
                                    key={i}
                                    onClick={() => setScores(s => ({ ...s, [c.id]: s[c.id] === i ? null : i }))}
                                    className={`w-7 h-7 border border-[#191c1e] text-[10px] font-black italic transition-all ${
                                      sc === i
                                        ? "bg-[#ccff00] text-[#161e00] border-2"
                                        : "bg-white text-[#191c1e] hover:bg-[#f7ffd1]"
                                    }`}
                                  >
                                    {i}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Comment + actions inline */}
                            <div className="flex items-start gap-2">
                              <span className="text-[8px] font-black italic uppercase text-[#747a60] w-6 shrink-0 mt-1.5">Obs</span>
                              <textarea
                                value={cm ?? ""}
                                onChange={e => setComments(d => ({ ...d, [c.id]: e.target.value }))}
                                placeholder="Comentário obrigatório..."
                                rows={1}
                                className="flex-1 border border-[#dde0e3] bg-[#f7f9fb] px-2.5 py-1.5 text-[10px] italic resize-none focus:outline-none focus:border-[#191c1e] text-[#191c1e] placeholder:text-[#c8cbd0]"
                              />
                              <div className="flex flex-col gap-1 shrink-0">
                                <button className="px-2.5 py-1.5 border border-[#dde0e3] text-[8px] font-black italic uppercase text-[#747a60] hover:bg-[#f2f4f6] transition-colors whitespace-nowrap">
                                  Rascunho
                                </button>
                                <button
                                  disabled={sc == null}
                                  className="px-2.5 py-1.5 border border-[#191c1e] bg-[#191c1e] text-[8px] font-black italic uppercase text-[#ccff00] disabled:opacity-30 hover:bg-[#2e3228] transition-colors whitespace-nowrap"
                                >
                                  Enviar →
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
