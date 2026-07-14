import { useState } from "react";

const events = [
  { id: 1, name: "CIRCUITO BANCO DO BRASIL – JOINVILLE", client: "BB", progress: 0, total: 7, status: "pending", conf: false },
  { id: 2, name: "NIGHT RUN – ETAPA 1 – PALMAS", client: "Night Run", progress: 0, total: 7, status: "pending", conf: false },
  { id: 3, name: "COPA SP DE FUTSAL – CAMPINAS", client: "FPF", progress: 7, total: 7, status: "done", conf: true },
  { id: 4, name: "FESTIVAL LOLLAPALOOZA – SP", client: "T4F", progress: 5, total: 7, status: "partial", conf: true },
  { id: 5, name: "EXPO REAL ESTATE – BRASÍLIA", client: "Abitare", progress: 7, total: 7, status: "done", conf: true },
  { id: 6, name: "MARATONA SP – ETAPA 3", client: "Yescom", progress: 4, total: 7, status: "partial", conf: true },
];

const avaliadores = ["Todos", "Ana Rodrigues", "Carlos Mendes", "Fábio Lima", "Juliana Costa"];

const criteriaGroups = [
  {
    area: "Cenografia",
    criteria: [
      { id: 1, name: "Montagem de estruturas", score: 8, evaluator: "Ana Rodrigues", status: "submitted" },
      { id: 2, name: "Acabamento e detalhamento", score: null, evaluator: "Ana Rodrigues", status: "pending" },
      { id: 3, name: "Limpeza do espaço", score: 9, evaluator: "Carlos Mendes", status: "submitted" },
    ]
  },
  {
    area: "Atendimento",
    criteria: [
      { id: 4, name: "Cordialidade e comunicação", score: 7, evaluator: "Fábio Lima", status: "submitted" },
      { id: 5, name: "Pontualidade", score: null, evaluator: "Juliana Costa", status: "draft" },
    ]
  },
  {
    area: "Produção",
    criteria: [
      { id: 6, name: "Gestão de materiais", score: null, evaluator: "—", status: "pending" },
      { id: 7, name: "Tempo de execução", score: 6, evaluator: "Fábio Lima", status: "submitted" },
    ]
  },
];

const statusColor: Record<string, string> = {
  submitted: "#506600",
  partial: "#a06a00",
  draft: "#862200",
  pending: "#747a60",
};
const statusLabel: Record<string, string> = {
  submitted: "Enviado",
  partial: "Parcial",
  draft: "Rascunho",
  pending: "Pendente",
};

export function OpcaoA() {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(4);
  const [selectedAvaliador, setSelectedAvaliador] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "done">("all");
  const [search, setSearch] = useState("");

  const selectedEvent = events.find(e => e.id === selectedEventId);

  const filteredEvents = events.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) &&
    (statusFilter === "all" || (statusFilter === "done" && e.status === "done") || (statusFilter === "pending" && e.status !== "done"))
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
        <button className="flex items-center gap-1.5 border-2 border-[#ccff00]/40 px-4 py-1.5 text-[11px] font-black italic uppercase text-[#ccff00] hover:border-[#ccff00] transition-colors">
          ↓ Exportar Pendentes
        </button>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* ── Sidebar ── */}
        <aside className="w-56 shrink-0 bg-white border-r-2 border-[#191c1e] flex flex-col overflow-hidden">

          {/* Search */}
          <div className="p-3 border-b-2 border-[#eceef0]">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#747a60] text-xs">🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-7 pr-2 h-8 border-2 border-[#191c1e] bg-[#f7f9fb] text-xs italic font-medium focus:outline-none"
                placeholder="Buscar evento..."
              />
            </div>
          </div>

          {/* Status filter chips */}
          <div className="px-3 py-2 border-b-2 border-[#eceef0] flex gap-1.5">
            {(["all","pending","done"] as const).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`flex-1 text-[9px] font-black italic uppercase py-1 border transition-colors ${
                  statusFilter === f ? "bg-[#191c1e] text-[#ccff00] border-[#191c1e]" : "bg-white text-[#747a60] border-[#d0d3d6] hover:bg-[#f7f9fb]"
                }`}
              >
                {f === "all" ? "Todos" : f === "pending" ? "Pend." : "Concl."}
              </button>
            ))}
          </div>

          {/* Event list */}
          <div className="flex-1 overflow-auto py-1">
            {filteredEvents.map(ev => {
              const pct = ev.total > 0 ? (ev.progress / ev.total) * 100 : 0;
              const active = selectedEventId === ev.id;
              return (
                <button
                  key={ev.id}
                  onClick={() => setSelectedEventId(ev.id)}
                  className={`w-full px-3 py-2.5 text-left border-l-2 transition-colors ${
                    active ? "bg-[#f0ffe0] border-[#506600]" : "border-transparent hover:bg-[#f7f9fb]"
                  }`}
                >
                  <p className={`text-[11px] font-black italic uppercase leading-tight truncate ${active ? "text-[#191c1e]" : "text-[#444933]"}`}>
                    {ev.name}
                  </p>
                  <p className="text-[9px] italic text-[#747a60] mt-0.5">{ev.client}</p>
                  <div className="mt-1.5 h-1 bg-[#eceef0]">
                    <div className="h-full" style={{ width: `${pct}%`, backgroundColor: ev.status === "done" ? "#506600" : ev.status === "partial" ? "#ffb300" : "#eceef0" }} />
                  </div>
                  <p className="text-[9px] italic text-[#747a60] mt-0.5">{ev.progress}/{ev.total} quesitos</p>
                </button>
              );
            })}
          </div>

          {/* Avaliador filter */}
          <div className="p-3 border-t-2 border-[#eceef0]">
            <p className="text-[9px] font-black italic uppercase tracking-wider text-[#747a60] mb-2">Filtrar por avaliador</p>
            <select
              value={selectedAvaliador}
              onChange={e => setSelectedAvaliador(e.target.value)}
              className="w-full h-8 border-2 border-[#191c1e] bg-white px-2 text-[10px] font-bold italic focus:outline-none"
            >
              {avaliadores.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
        </aside>

        {/* ── Main panel ── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-auto">
          {!selectedEvent ? (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
              <p className="text-xl font-black italic uppercase">Selecione um evento</p>
            </div>
          ) : (
            <>
              {/* Event header */}
              <div className="bg-white border-b-2 border-[#eceef0] px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold italic uppercase text-[#747a60] mb-0.5">{selectedEvent.client}</p>
                    <h2 className="text-lg font-black italic uppercase tracking-tight leading-tight">{selectedEvent.name}</h2>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] italic font-bold uppercase text-[#747a60]">Progresso geral</p>
                    <p className="text-2xl font-black italic text-[#191c1e]">{Math.round((selectedEvent.progress / selectedEvent.total) * 100)}%</p>
                    <p className="text-[9px] italic text-[#747a60]">{selectedEvent.progress}/{selectedEvent.total} quesitos</p>
                  </div>
                </div>
                {/* Team progress bar */}
                <div className="mt-3 h-2 bg-[#eceef0] border border-[#191c1e]">
                  <div className="h-full bg-[#ccff00]" style={{ width: `${Math.round((selectedEvent.progress / selectedEvent.total) * 100)}%` }} />
                </div>
              </div>

              {/* Criteria by area */}
              <div className="p-5 space-y-4">
                {criteriaGroups.map(group => (
                  <div key={group.area} className="bg-white border-2 border-[#191c1e]">
                    <div className="px-4 py-2.5 border-b-2 border-[#eceef0] bg-[#f7f9fb] flex items-center justify-between">
                      <h3 className="text-[11px] font-black italic uppercase tracking-wider text-[#191c1e]">{group.area}</h3>
                      <span className="text-[10px] italic text-[#747a60]">
                        {group.criteria.filter(c => c.status === "submitted").length}/{group.criteria.length} enviados
                      </span>
                    </div>
                    <div className="divide-y divide-[#eceef0]">
                      {group.criteria.map(c => (
                        <div key={c.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold italic uppercase truncate">{c.name}</p>
                            <p className="text-[10px] italic text-[#747a60]">{c.evaluator}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {c.score != null && (
                              <span className="text-base font-black italic text-[#191c1e]">{c.score}</span>
                            )}
                            <span className="text-[9px] font-bold italic uppercase" style={{ color: statusColor[c.status] }}>
                              {statusLabel[c.status]}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
