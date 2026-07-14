import { useState } from "react";

const events = [
  { id: 1, name: "CIRCUITO BANCO DO BRASIL – JOINVILLE", client: "Banco do Brasil", city: "Joinville", start: "17/08", end: "22/08", progress: 0, total: 7, done: false },
  { id: 2, name: "NIGHT RUN – ETAPA 1 – PALMAS", client: "Night Run", city: "Palmas", start: "17/08", end: "22/08", progress: 0, total: 7, done: false },
  { id: 3, name: "COPA SP DE FUTSAL – CAMPINAS", client: "FPF", city: "Campinas", start: "10/07", end: "15/07", progress: 7, total: 7, done: true },
  { id: 4, name: "FESTIVAL LOLLAPALOOZA – SP", client: "T4F", city: "São Paulo", start: "05/07", end: "07/07", progress: 5, total: 7, done: false },
  { id: 5, name: "EXPO REAL ESTATE – BRASÍLIA", client: "Abitare", city: "Brasília", start: "28/06", end: "30/06", progress: 7, total: 7, done: true },
];

const avaliadores = [
  { id: 1, name: "Ana Rodrigues", total: 4, submitted: 3 },
  { id: 2, name: "Carlos Mendes", total: 3, submitted: 3 },
  { id: 3, name: "Fábio Lima", total: 4, submitted: 2 },
  { id: 4, name: "Juliana Costa", total: 3, submitted: 0 },
];

const criteriaGroups = [
  {
    area: "Cenografia",
    areaId: 13,
    criteria: [
      { id: 1, name: "Montagem de estruturas", evaluator: "Ana Rodrigues", score: 8, status: "submitted" },
      { id: 2, name: "Acabamento e detalhamento", evaluator: "Ana Rodrigues", score: null, status: "pending" },
      { id: 3, name: "Limpeza do espaço", evaluator: "Carlos Mendes", score: 9, status: "submitted" },
    ]
  },
  {
    area: "Atendimento",
    areaId: 2,
    criteria: [
      { id: 4, name: "Cordialidade e comunicação", evaluator: "Fábio Lima", score: 7, status: "submitted" },
      { id: 5, name: "Pontualidade", evaluator: "Juliana Costa", score: null, status: "draft" },
    ]
  },
  {
    area: "Produção",
    areaId: 3,
    criteria: [
      { id: 6, name: "Gestão de materiais", evaluator: "—", score: null, status: "pending" },
      { id: 7, name: "Tempo de execução", evaluator: "Fábio Lima", score: 6, status: "submitted" },
    ]
  },
];

const statusMeta: Record<string, { label: string; color: string; bg: string }> = {
  submitted: { label: "Enviado", color: "#506600", bg: "#f0ffe0" },
  partial:   { label: "Parcial",  color: "#a06a00", bg: "#fffbf0" },
  draft:     { label: "Rascunho", color: "#862200", bg: "#fff4f0" },
  pending:   { label: "Pendente", color: "#747a60", bg: "#f7f9fb" },
};

export function OpcaoB() {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(4);
  const [selectedAvaliadorId, setSelectedAvaliadorId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "done">("all");

  const selectedEvent = events.find(e => e.id === selectedEventId);

  const filteredEvents = events.filter(e =>
    statusFilter === "all" || (statusFilter === "done" && e.done) || (statusFilter === "pending" && !e.done)
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f9fb]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── Top bar ── */}
      <div className="bg-[#191c1e] px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl italic uppercase tracking-tighter font-black leading-none text-white">
            Central de <span className="text-[#ccff00]">Avaliações</span>
          </h1>
          <span className="text-[10px] font-bold italic uppercase text-white/40 border border-white/20 px-2 py-0.5">Ciclo 2026</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Status filter inline in topbar */}
          <div className="flex border border-white/20 overflow-hidden">
            {(["all","pending","done"] as const).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1 text-[10px] font-black italic uppercase transition-colors ${
                  statusFilter === f ? "bg-[#ccff00] text-[#161e00]" : "text-white/60 hover:text-white"
                }`}
              >
                {f === "all" ? "Todos" : f === "pending" ? "Pendentes" : "Concluídos"}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1.5 border border-white/20 px-4 py-1.5 text-[11px] font-black italic uppercase text-white/60 hover:text-white transition-colors">
            ↓ Exportar
          </button>
        </div>
      </div>

      {/* ── 2-col split: event list + detail ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Event list panel (left) ── */}
        <div className="w-72 shrink-0 bg-white border-r-2 border-[#191c1e] flex flex-col">
          <div className="px-4 py-3 border-b-2 border-[#eceef0]">
            <p className="text-[9px] font-black italic uppercase tracking-widest text-[#747a60] mb-2">Eventos · {filteredEvents.length} de {events.length}</p>
            <input
              className="w-full h-8 border-2 border-[#191c1e] bg-[#f7f9fb] px-3 text-xs italic font-medium focus:outline-none"
              placeholder="Buscar evento..."
            />
          </div>
          <div className="flex-1 overflow-auto divide-y-2 divide-[#eceef0]">
            {filteredEvents.map(ev => {
              const pct = ev.total > 0 ? (ev.progress / ev.total) * 100 : 0;
              const active = selectedEventId === ev.id;
              return (
                <button
                  key={ev.id}
                  onClick={() => setSelectedEventId(ev.id)}
                  className={`w-full px-4 py-3 text-left transition-colors border-l-2 ${
                    active ? "bg-[#f0ffe0] border-[#506600]" : "border-transparent hover:bg-[#f7f9fb]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className={`text-[11px] font-black italic uppercase leading-tight ${active ? "text-[#191c1e]" : "text-[#444933]"}`}>
                      {ev.name}
                    </p>
                    <span className={`shrink-0 text-[9px] font-black italic uppercase px-1.5 py-0.5 ${ev.done ? "bg-[#ccff00] text-[#161e00]" : "bg-[#eceef0] text-[#747a60]"}`}>
                      {ev.done ? "OK" : `${ev.progress}/${ev.total}`}
                    </span>
                  </div>
                  <p className="text-[10px] italic text-[#747a60] mb-1.5">{ev.client} · {ev.start}–{ev.end}</p>
                  <div className="h-1 bg-[#eceef0]">
                    <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: ev.done ? "#506600" : pct > 0 ? "#ccff00" : "transparent" }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Detail panel (right) ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-auto">
          {!selectedEvent ? (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-30">
              <p className="text-2xl font-black italic uppercase">← Selecione um evento</p>
            </div>
          ) : (
            <>
              {/* Event header */}
              <div className="bg-white border-b-2 border-[#eceef0] px-6 py-4 shrink-0">
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold italic uppercase text-[#747a60]">{selectedEvent.client} · {selectedEvent.city} · {selectedEvent.start}–{selectedEvent.end}</p>
                    <h2 className="text-base font-black italic uppercase tracking-tight leading-tight mt-0.5">{selectedEvent.name}</h2>
                  </div>
                  {/* Avaliador filter chips */}
                  <div className="shrink-0 flex flex-wrap gap-1.5 justify-end">
                    <button
                      onClick={() => setSelectedAvaliadorId(null)}
                      className={`text-[9px] font-black italic uppercase px-2 py-1 border transition-colors ${selectedAvaliadorId === null ? "bg-[#191c1e] text-[#ccff00] border-[#191c1e]" : "bg-white text-[#747a60] border-[#d0d3d6]"}`}
                    >
                      Todos
                    </button>
                    {avaliadores.map(av => (
                      <button
                        key={av.id}
                        onClick={() => setSelectedAvaliadorId(av.id)}
                        className={`text-[9px] font-black italic uppercase px-2 py-1 border transition-colors ${
                          selectedAvaliadorId === av.id ? "bg-[#191c1e] text-[#ccff00] border-[#191c1e]" : av.submitted === av.total ? "bg-[#f0ffe0] text-[#506600] border-[#c6e090]" : "bg-white text-[#747a60] border-[#d0d3d6]"
                        }`}
                      >
                        {av.name.split(" ")[0]} {av.submitted}/{av.total}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Team progress strip */}
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1 h-2 bg-[#eceef0] border border-[#191c1e]">
                    <div className="h-full bg-[#ccff00]" style={{ width: `${Math.round((selectedEvent.progress / selectedEvent.total) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-black italic text-[#191c1e] whitespace-nowrap">
                    {selectedEvent.progress}/{selectedEvent.total} quesitos · {Math.round((selectedEvent.progress / selectedEvent.total) * 100)}%
                  </span>
                </div>
              </div>

              {/* Criteria by area */}
              <div className="flex-1 p-5 space-y-4">
                {criteriaGroups.map(group => (
                  <div key={group.area} className="bg-white border-2 border-[#191c1e]">
                    <div className="px-4 py-2 bg-[#191c1e] flex items-center justify-between">
                      <h3 className="text-[11px] font-black italic uppercase text-[#ccff00]">{group.area}</h3>
                      <span className="text-[10px] italic text-white/50">
                        {group.criteria.filter(c => c.status === "submitted").length}/{group.criteria.length}
                      </span>
                    </div>
                    <div className="divide-y divide-[#eceef0]">
                      {group.criteria.map(c => {
                        const st = statusMeta[c.status];
                        return (
                          <div key={c.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold italic uppercase truncate text-[#191c1e]">{c.name}</p>
                              <p className="text-[10px] italic text-[#747a60]">{c.evaluator}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {c.score != null && (
                                <span className="text-sm font-black italic text-[#191c1e]">{c.score}</span>
                              )}
                              <span className="text-[9px] font-black italic uppercase px-2 py-0.5" style={{ color: st.color, backgroundColor: st.bg }}>
                                {st.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
