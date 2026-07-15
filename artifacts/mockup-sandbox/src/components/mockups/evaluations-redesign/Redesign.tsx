import { useState } from "react";

const SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";

const mockEvents = [
  { id: 1, name: "GIRL POWER", subtitle: "Belo Horizonte · MG", status: "partial", submitted: 3, total: 5, confDone: 4, confTotal: 5 },
  { id: 2, name: "SRUN – SOROCABA 2026", subtitle: "Sorocaba · SP", status: "partial", submitted: 1, total: 5, confDone: 0, confTotal: 0 },
  { id: 3, name: "42K FLORIANÓPOLIS", subtitle: "Florianópolis · SC", status: "pending", submitted: 0, total: 5, confDone: 0, confTotal: 0 },
  { id: 4, name: "CORRIDA CIDADE – SP", subtitle: "São Paulo · SP", status: "done", submitted: 5, total: 5, confDone: 0, confTotal: 0 },
  { id: 5, name: "FESTIVAL VERDE – RJ", subtitle: "Rio de Janeiro · RJ", status: "done", submitted: 7, total: 7, confDone: 5, confTotal: 5 },
];

const mockCriteria = [
  { id: 1, area: "Cenografia", name: "Montagem e desmontagem de estruturas", submitted: true, score: 8, comment: "Equipe eficiente, sem atrasos." },
  { id: 2, area: "Cenografia", name: "Acabamento e detalhamento visual", submitted: true, score: 7, comment: "Apresentou pequenos desvios no acabamento." },
  { id: 3, area: "Cenografia", name: "Limpeza e organização do espaço", submitted: false, score: null, comment: "" },
  { id: 4, area: "Atendimento", name: "Cordialidade e comunicação com cliente", submitted: false, score: null, comment: "" },
  { id: 5, area: "Atendimento", name: "Pontualidade e cumprimento de prazos", submitted: false, score: null, comment: "" },
];

const areaGroups = [
  { area: "Cenografia", criteria: mockCriteria.filter(c => c.area === "Cenografia") },
  { area: "Atendimento", criteria: mockCriteria.filter(c => c.area === "Atendimento") },
];

const statusMeta = {
  done:    { label: "Concluída",     bg: "bg-[#ccff00]", text: "text-[#161e00]", border: "border-l-[#506600]", bar: "bg-[#ccff00]" },
  partial: { label: "Em andamento",  bg: "bg-[#ffdbd1]", text: "text-[#862200]", border: "border-l-[#f28b6a]", bar: "bg-[#f28b6a]" },
  pending: { label: "A fazer",       bg: "bg-[#f2f4f6]", text: "text-[#444933]", border: "border-l-[#bbbfc4]", bar: "bg-[#d0d4c8]" },
};

export function Redesign() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [draftScore, setDraftScore] = useState<Record<number, number | null>>({});
  const [draftComment, setDraftComment] = useState<Record<number, string>>({});

  const todo = mockEvents.filter(e => e.status !== "done");
  const done = mockEvents.filter(e => e.status === "done");
  const selected = mockEvents.find(e => e.id === selectedId);

  if (selected) {
    const submitted = mockCriteria.filter(c => c.submitted).length;
    const pct = Math.round((submitted / mockCriteria.length) * 100);

    return (
      <div className="bg-[#f7f9fb] min-h-screen flex flex-col" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

        {/* Header */}
        <div className="bg-[#191c1e] px-5 py-0 flex items-stretch shrink-0">
          <button
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-2 text-[#747a60] hover:text-[#ccff00] text-[11px] font-black italic uppercase tracking-wide py-3.5 pr-4 border-r border-[#2e3228] transition-colors"
          >
            ← Central de Avaliações
          </button>
          <div className="flex items-center gap-2 px-4 py-3.5 flex-1 min-w-0">
            <span className="text-[11px] font-black italic uppercase text-[#ccff00] tracking-wide truncate">{selected.name}</span>
            <span className="text-[#444933] text-[11px]">·</span>
            <span className="text-[11px] italic text-[#747a60] truncate">{selected.subtitle}</span>
          </div>
          <div className="flex items-center gap-3 px-5 border-l border-[#2e3228]">
            <span className="text-[10px] font-black italic uppercase text-[#747a60]">
              {submitted}/{mockCriteria.length} enviados
            </span>
            <div className="w-20 bg-[#2e3228] h-1.5 rounded-sm overflow-hidden">
              <div className="h-full bg-[#ccff00] transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Criteria column */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {areaGroups.map(group => (
              <div key={group.area}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-black italic uppercase tracking-widest text-[#747a60]">{group.area}</span>
                  <div className="flex-1 h-px bg-[#dde0e3]" />
                  <span className="text-[10px] font-bold italic text-[#747a60]">
                    {group.criteria.filter(c => c.submitted).length}/{group.criteria.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {group.criteria.map(c => {
                    const score = draftScore[c.id] ?? (c.submitted ? c.score : null);
                    const comment = draftComment[c.id] ?? (c.submitted ? c.comment : "");
                    return (
                      <div key={c.id} className={`bg-white border-2 border-[#191c1e] border-l-4 ${c.submitted ? "border-l-[#506600]" : "border-l-[#bbbfc4]"} ${SHADOW}`}>
                        <div className="px-4 pt-3.5 pb-2.5 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[13px] font-black italic uppercase tracking-tight text-[#191c1e] leading-snug">{c.name}</p>
                          </div>
                          {c.submitted && (
                            <span className="shrink-0 text-[10px] font-black italic uppercase px-2 py-0.5 bg-[#ccff00] text-[#161e00] border border-[#506600]">
                              ✓ Enviado · {c.score}/10
                            </span>
                          )}
                        </div>

                        {!c.submitted && (
                          <div className="px-4 pb-4 space-y-3">
                            {/* Score buttons */}
                            <div>
                              <p className="text-[9px] font-black italic uppercase tracking-wider text-[#747a60] mb-1.5">Nota (0–10)</p>
                              <div className="grid grid-cols-11 gap-1">
                                {Array.from({ length: 11 }, (_, i) => (
                                  <button
                                    key={i}
                                    onClick={() => setDraftScore(s => ({ ...s, [c.id]: s[c.id] === i ? null : i }))}
                                    className={`py-2.5 border-2 border-[#191c1e] text-[13px] font-black italic transition-all ${
                                      score === i
                                        ? "bg-[#ccff00] text-[#161e00]"
                                        : "bg-white text-[#191c1e] hover:-translate-y-0.5"
                                    }`}
                                  >
                                    {i}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Comment */}
                            <div>
                              <p className="text-[9px] font-black italic uppercase tracking-wider text-[#747a60] mb-1.5">Comentário</p>
                              <textarea
                                value={comment}
                                onChange={e => setDraftComment(d => ({ ...d, [c.id]: e.target.value }))}
                                placeholder="Descreva sua avaliação..."
                                rows={2}
                                className="w-full border-2 border-[#191c1e] px-3 py-2 text-[12px] italic font-bold resize-none focus:outline-none focus:border-[#ccff00] bg-[#f7f9fb] text-[#191c1e] placeholder:text-[#bbbfc4]"
                              />
                            </div>

                            <div className="flex gap-2">
                              <button className="flex-1 py-2 border-2 border-[#191c1e] text-[10px] font-black italic uppercase tracking-wide text-[#444933] hover:bg-[#f2f4f6] transition-colors">
                                Salvar Rascunho
                              </button>
                              <button
                                disabled={score == null || !comment.trim()}
                                className="flex-1 py-2 border-2 border-[#191c1e] text-[10px] font-black italic uppercase tracking-wide bg-[#191c1e] text-[#ccff00] disabled:opacity-30 hover:bg-[#2e3228] transition-colors"
                              >
                                Enviar Avaliação →
                              </button>
                            </div>
                          </div>
                        )}

                        {c.submitted && (
                          <div className="px-4 pb-3 text-[11px] italic text-[#506600] font-bold border-t border-dashed border-[#dde0e3] pt-2.5">
                            "{c.comment}"
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Right sidebar */}
          <aside className="w-72 shrink-0 border-l-2 border-[#191c1e] bg-white flex flex-col overflow-y-auto">

            {/* Event info */}
            <div className="bg-[#191c1e] px-4 py-4">
              <p className="text-[9px] font-black italic uppercase tracking-widest text-[#747a60] mb-1">Evento</p>
              <p className="text-[14px] font-black italic uppercase text-white leading-tight">{selected.name}</p>
              <p className="text-[10px] italic text-[#747a60] mt-0.5">{selected.subtitle}</p>
            </div>

            {/* Progress ring / stats */}
            <div className="px-4 py-4 border-b-2 border-[#eceef0]">
              <p className="text-[9px] font-black italic uppercase tracking-widest text-[#747a60] mb-3">Seu Progresso</p>
              <div className="flex items-center gap-4">
                <div className="relative w-14 h-14 shrink-0">
                  <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                    <circle cx="28" cy="28" r="22" fill="none" stroke="#eceef0" strokeWidth="6" />
                    <circle cx="28" cy="28" r="22" fill="none" stroke="#ccff00" strokeWidth="6"
                      strokeDasharray={`${(pct / 100) * 138.2} 138.2`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[12px] font-black italic text-[#191c1e]">{pct}%</span>
                </div>
                <div>
                  <p className="text-[20px] font-black italic text-[#191c1e] leading-none">{submitted}<span className="text-[13px] text-[#747a60]">/{mockCriteria.length}</span></p>
                  <p className="text-[10px] font-bold italic uppercase text-[#747a60] mt-0.5">quesitos enviados</p>
                  <p className="text-[10px] font-bold italic uppercase text-[#f28b6a] mt-0.5">
                    {mockCriteria.length - submitted} pendentes
                  </p>
                </div>
              </div>
            </div>

            {/* Criteria checklist mini */}
            <div className="px-4 py-4 border-b-2 border-[#eceef0] flex-1">
              <p className="text-[9px] font-black italic uppercase tracking-widest text-[#747a60] mb-2.5">Quesitos</p>
              <div className="space-y-1.5">
                {mockCriteria.map(c => (
                  <div key={c.id} className="flex items-center gap-2">
                    <div className={`w-3.5 h-3.5 border-2 border-[#191c1e] shrink-0 flex items-center justify-center ${c.submitted ? "bg-[#ccff00]" : "bg-white"}`}>
                      {c.submitted && <span className="text-[8px] font-black">✓</span>}
                    </div>
                    <span className={`text-[10px] font-bold italic flex-1 leading-snug ${c.submitted ? "text-[#506600] line-through" : "text-[#191c1e]"}`}>
                      {c.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="px-4 py-4">
              <button className={`w-full py-2.5 border-2 border-[#191c1e] text-[10px] font-black italic uppercase tracking-wide ${SHADOW} bg-[#191c1e] text-[#ccff00] hover:bg-[#2e3228] transition-colors`}>
                Lançar Tudo de Uma Vez →
              </button>
              <p className="text-[9px] italic text-[#747a60] text-center mt-2">Envia todos os quesitos preenchidos</p>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f7f9fb] min-h-screen flex flex-col" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Header */}
      <div className="bg-[#191c1e] px-6 py-3.5 flex items-center justify-between shrink-0">
        <h1 className="text-[16px] italic uppercase tracking-tighter font-black text-white">
          Central de <span className="text-[#ccff00]">Avaliações</span>
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black italic uppercase text-[#506600] bg-[#ccff00] px-2.5 py-1">Ciclo 2026</span>
          <span className="text-[10px] italic font-bold text-[#747a60]">{todo.length} pendentes · {done.length} concluídas</span>
        </div>
      </div>

      <div className="flex-1 px-6 py-6 max-w-5xl mx-auto w-full space-y-8">

        {/* A Fazer */}
        {todo.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] font-black italic uppercase tracking-widest text-[#191c1e]">A Fazer</span>
              <span className="text-[10px] font-black italic px-2 py-0.5 bg-[#191c1e] text-[#ccff00]">{todo.length}</span>
              <div className="flex-1 h-px bg-[#dde0e3]" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {todo.map(ev => {
                const meta = statusMeta[ev.status as keyof typeof statusMeta];
                const pct = ev.total > 0 ? Math.round((ev.submitted / ev.total) * 100) : 0;
                return (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedId(ev.id)}
                    className={`text-left bg-white border-2 border-[#191c1e] border-l-4 ${meta.border} ${SHADOW} hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_#191c1e] transition-all group`}
                  >
                    <div className="px-4 pt-4 pb-3 space-y-3">
                      {/* Status badge */}
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 border text-[9px] font-black italic uppercase tracking-wide ${meta.bg} ${meta.text} border-current`}>
                        {meta.label}
                      </span>

                      {/* Name */}
                      <div>
                        <p className="text-[14px] font-black italic uppercase tracking-tight text-[#191c1e] leading-tight">{ev.name}</p>
                        <p className="text-[10px] italic text-[#747a60] mt-0.5">{ev.subtitle}</p>
                      </div>

                      {/* Progress */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[9px] font-bold italic uppercase text-[#444933]">{ev.submitted}/{ev.total} quesitos</span>
                          <span className="text-[9px] font-black italic text-[#191c1e]">{pct}%</span>
                        </div>
                        <div className="w-full bg-[#eceef0] border border-[#c8cbd0] h-2 overflow-hidden">
                          <div className={`h-full transition-all ${meta.bar}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      {/* Conformidade row */}
                      {ev.confTotal > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-[#eceef0] border border-[#c8cbd0] h-1.5 overflow-hidden">
                            <div className={`h-full ${ev.confDone === ev.confTotal ? "bg-[#ccff00]" : "bg-[#f28b6a]"}`}
                              style={{ width: `${Math.round((ev.confDone / ev.confTotal) * 100)}%` }} />
                          </div>
                          <span className="text-[9px] italic font-black text-[#747a60] shrink-0">Conf {ev.confDone}/{ev.confTotal}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t-2 border-[#191c1e] px-4 py-2.5 flex items-center justify-between bg-[#f7f9fb] group-hover:bg-[#f7ffd1] transition-colors">
                      <span className="text-[9px] font-black italic uppercase tracking-wide text-[#444933]">Avaliar</span>
                      <span className="text-[#ccff00] bg-[#191c1e] px-2 py-0.5 text-[9px] font-black">→</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Concluídas (collapsible) */}
        {done.length > 0 && (
          <section>
            <button
              onClick={() => setShowDone(d => !d)}
              className="flex items-center gap-3 mb-3 w-full text-left group"
            >
              <span className="text-[10px] font-black italic uppercase tracking-widest text-[#747a60] group-hover:text-[#191c1e] transition-colors">Concluídas</span>
              <span className="text-[10px] font-black italic px-2 py-0.5 bg-[#eceef0] text-[#444933]">{done.length}</span>
              <div className="flex-1 h-px bg-[#dde0e3]" />
              <span className="text-[10px] italic text-[#747a60]">{showDone ? "▲" : "▼"}</span>
            </button>

            {showDone && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {done.map(ev => {
                  const meta = statusMeta.done;
                  return (
                    <button
                      key={ev.id}
                      onClick={() => setSelectedId(ev.id)}
                      className={`text-left bg-white border-2 border-[#191c1e] border-l-4 ${meta.border} opacity-80 hover:opacity-100 transition-all hover:translate-x-[-1px] hover:translate-y-[-1px]`}
                    >
                      <div className="px-4 pt-4 pb-3 space-y-2">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 border text-[9px] font-black italic uppercase tracking-wide ${meta.bg} ${meta.text} border-current`}>
                          ✓ {meta.label}
                        </span>
                        <p className="text-[13px] font-black italic uppercase tracking-tight text-[#191c1e] leading-tight">{ev.name}</p>
                        <p className="text-[10px] italic text-[#747a60]">{ev.subtitle}</p>
                        <div className="w-full bg-[#ccff00]/30 border border-[#506600]/30 h-1.5 overflow-hidden">
                          <div className="h-full bg-[#ccff00]" style={{ width: "100%" }} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Empty state */}
        {todo.length === 0 && done.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className={`w-16 h-16 bg-[#ccff00] border-2 border-[#191c1e] ${SHADOW} flex items-center justify-center mb-4`}>
              <span className="text-2xl">✓</span>
            </div>
            <p className="text-[14px] font-black italic uppercase text-[#191c1e]">Tudo em dia</p>
            <p className="text-[11px] italic text-[#747a60] mt-1">Nenhuma avaliação pendente para este ciclo.</p>
          </div>
        )}
      </div>
    </div>
  );
}
