import { ChevronRight, Users, Calendar, MoreHorizontal, Plus, Search, Filter } from "lucide-react";

const events = [
  { id: 1, name: "Rock in Rio 2026", city: "Rio de Janeiro", client: "Rock World", date: "12/07", participants: 24, evaluated: 4, total: 4, calCount: 4, score: 87.3, status: "closed", fc: true },
  { id: 2, name: "Lollapalooza BR", city: "São Paulo", client: "T4F", date: "08/07 — 10/07", participants: 18, evaluated: 3, total: 4, calCount: 2, score: 74.1, status: "closed", fc: false },
  { id: 3, name: "Tech Summit 2026", city: "Brasília", client: "SBS Events", date: "15/07", participants: 12, evaluated: 4, total: 4, calCount: 4, score: 81.0, status: "closed", fc: true },
  { id: 4, name: "42K Florianópolis", city: "Florianópolis", client: "Run Brasil", date: "06/06", participants: 12, evaluated: 4, total: 4, calCount: 4, score: 67.5, status: "closed", fc: true },
  { id: 5, name: "Fashion Week SP", city: "São Paulo", client: "SPFW", date: "20/07", participants: 8, evaluated: 2, total: 4, calCount: 0, score: null, status: "open", fc: false },
  { id: 6, name: "Anime Friends", city: "São Paulo", client: "Salvatore", date: "18/07", participants: 15, evaluated: 0, total: 4, calCount: 0, score: null, status: "open", fc: false },
  { id: 7, name: "SRUN Sorocaba", city: "Sorocaba", client: "SRUN", date: "06/06", participants: 10, evaluated: 4, total: 4, calCount: 4, score: 72.5, status: "closed", fc: true },
];

const statusGroups = [
  { key: "open", label: "Em Andamento", color: "#ccff00", bg: "#f4fce0", border: "#c4cda8", events: events.filter(e => e.status === "open") },
  { key: "closed", label: "Concluídos", color: "#506600", bg: "#f8fdf0", border: "#c4cda8", events: events.filter(e => e.status === "closed") },
];

function ProgressBar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-[#e8eae0] rounded-none overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[9px] font-black italic whitespace-nowrap" style={{ color }}>{value}/{total}</span>
    </div>
  );
}

export function VarianteA() {
  return (
    <div className="min-h-screen bg-[#f2f4f6] font-['Plus_Jakarta_Sans',sans-serif]">
      {/* ── Header ── */}
      <div className="bg-[#191c1e] border-b-4 border-[#ccff00] px-5 py-3 flex items-center gap-4">
        <div className="flex-1">
          <span className="text-[10px] font-black italic uppercase text-[#747a60] tracking-wider block">Gerenciar</span>
          <span className="text-[16px] font-black italic uppercase text-white">Eventos do Ciclo</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Stats pills */}
          {[
            { label: "Total", val: events.length, color: "text-white" },
            { label: "Andamento", val: events.filter(e=>e.status==="open").length, color: "text-[#ccff00]" },
            { label: "Concluídos", val: events.filter(e=>e.status==="closed").length, color: "text-[#9aa088]" },
          ].map(s => (
            <div key={s.label} className="text-center border border-[#333] px-3 py-1.5">
              <span className={`text-[18px] font-black italic leading-none block ${s.color}`}>{s.val}</span>
              <span className="text-[8px] font-bold italic uppercase text-[#747a60]">{s.label}</span>
            </div>
          ))}
          <button className="h-8 px-3 bg-[#ccff00] text-[#161e00] text-[10px] font-black italic uppercase border border-[#ccff00] hover:bg-[#b8e800] flex items-center gap-1.5 transition-colors">
            <Plus size={11} /> Novo Evento
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="px-5 py-2.5 flex items-center gap-2 bg-white border-b border-[#e0e2da]">
        <div className="flex-1 flex items-center gap-1.5 border border-[#d0d2ca] bg-[#f8f9fb] px-2.5 py-1.5">
          <Search size={11} className="text-[#9aa088]" />
          <span className="text-[11px] italic text-[#b0b8a0]">Buscar evento, cidade ou cliente…</span>
        </div>
        <button className="h-8 px-3 border border-[#d0d2ca] text-[10px] font-bold italic uppercase text-[#747a60] flex items-center gap-1.5 hover:border-[#191c1e] transition-colors">
          <Filter size={10} /> Filtros
        </button>
        {/* View toggle */}
        <div className="flex border border-[#d0d2ca]">
          <button className="h-8 px-3 bg-[#191c1e] text-[#ccff00] text-[10px] font-black italic uppercase">Cards</button>
          <button className="h-8 px-3 bg-white text-[#747a60] text-[10px] font-bold italic uppercase hover:bg-[#f2f4f6]">Lista</button>
        </div>
      </div>

      {/* ── Groups ── */}
      <div className="px-5 py-4 space-y-6">
        {statusGroups.map(group => (
          <div key={group.key}>
            {/* Group header */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 border-2" style={{ borderColor: group.color, backgroundColor: group.color }} />
              <span className="text-[11px] font-black italic uppercase text-[#191c1e] tracking-wide">{group.label}</span>
              <span className="text-[10px] font-bold italic text-[#747a60] border border-[#d0d2ca] px-1.5 py-px">{group.events.length}</span>
              <div className="flex-1 h-px bg-[#e0e2da]" />
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-3 gap-3">
              {group.events.map(ev => (
                <div key={ev.id} className={`bg-white border hover:shadow-md transition-shadow cursor-pointer group ${ev.fc ? "border-[#506600]" : "border-[#d0d2ca]"}`}>
                  {/* Card top accent */}
                  <div className="h-1" style={{ backgroundColor: ev.fc ? "#506600" : ev.evaluated > 0 ? "#ccff00" : "#e0e2da" }} />

                  <div className="px-3 pt-2.5 pb-2">
                    {/* Name + date */}
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="text-[11px] font-black italic uppercase text-[#191c1e] leading-tight flex-1">{ev.name}</span>
                      <button className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center text-[#747a60] hover:text-[#191c1e] transition-all shrink-0">
                        <MoreHorizontal size={12} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <span className="text-[9px] italic text-[#9aa088] flex items-center gap-0.5"><Calendar size={8}/> {ev.date}</span>
                      <span className="text-[#d0d2ca]">·</span>
                      <span className="text-[9px] italic text-[#9aa088]">{ev.city}</span>
                    </div>

                    {/* Metrics */}
                    <div className="space-y-1.5 mb-2.5">
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[8px] font-bold italic uppercase text-[#747a60]">Avaliações</span>
                        </div>
                        <ProgressBar value={ev.evaluated} total={ev.total} color={ev.evaluated === ev.total ? "#506600" : "#ccff00"} />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[8px] font-bold italic uppercase text-[#747a60]">Calibrações</span>
                        </div>
                        <ProgressBar value={ev.calCount} total={ev.total} color={ev.fc ? "#506600" : ev.calCount > 0 ? "#a06a00" : "#e0e2da"} />
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-[#e8eae0]">
                      <div className="flex items-center gap-1 text-[#747a60]">
                        <Users size={9} />
                        <span className="text-[9px] font-bold italic">{ev.participants}</span>
                      </div>
                      {ev.score != null ? (
                        <div className="flex items-center gap-1">
                          <span className={`text-[16px] font-black italic leading-none ${ev.fc ? "text-[#506600]" : "text-[#191c1e]"}`}>{ev.score.toFixed(1)}</span>
                          {ev.fc && <span className="text-[8px] font-black italic uppercase text-[#506600] bg-[#e8f5d0] px-1 py-px">Pub. Final</span>}
                        </div>
                      ) : (
                        <span className="text-[11px] italic text-[#c4c9ac]">—</span>
                      )}
                      <button className="h-6 w-6 bg-[#191c1e] text-[#ccff00] flex items-center justify-center hover:bg-[#506600] transition-colors">
                        <ChevronRight size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add card */}
              <button className="border-2 border-dashed border-[#d0d2ca] h-36 flex flex-col items-center justify-center gap-1.5 text-[#9aa088] hover:border-[#ccff00] hover:text-[#506600] transition-colors group">
                <Plus size={16} className="group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold italic uppercase">Novo Evento</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
