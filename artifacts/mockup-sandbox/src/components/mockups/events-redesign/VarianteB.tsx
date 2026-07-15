import { ChevronRight, Users, Search, Plus, SlidersHorizontal, ShieldCheck, AlertTriangle, CheckCircle } from "lucide-react";

const events = [
  { id: 1, name: "Rock in Rio 2026", city: "Rio de Janeiro", client: "Rock World", date: "12/07", participants: 24, evaluated: 4, total: 4, calCount: 4, finalCal: 4, score: 87.3, status: "closed", fc: true },
  { id: 2, name: "Lollapalooza BR", city: "São Paulo", client: "T4F", date: "08–10/07", participants: 18, evaluated: 3, total: 4, calCount: 2, finalCal: 0, score: 74.1, status: "closed", fc: false },
  { id: 3, name: "Tech Summit 2026", city: "Brasília", client: "SBS Events", date: "15/07", participants: 12, evaluated: 4, total: 4, calCount: 4, finalCal: 4, score: 81.0, status: "closed", fc: true },
  { id: 4, name: "42K Florianópolis", city: "Florianópolis", client: "Run Brasil", date: "06/06", participants: 12, evaluated: 4, total: 4, calCount: 4, finalCal: 4, score: 67.5, status: "closed", fc: true },
  { id: 5, name: "Fashion Week SP", city: "São Paulo", client: "SPFW", date: "20/07", participants: 8, evaluated: 2, total: 4, calCount: 0, finalCal: 0, score: null, status: "open", fc: false },
  { id: 6, name: "Anime Friends", city: "São Paulo", client: "Salvatore", date: "18/07", participants: 15, evaluated: 0, total: 4, calCount: 0, finalCal: 0, score: null, status: "open", fc: false },
  { id: 7, name: "SRUN Sorocaba", city: "Sorocaba", client: "SRUN", date: "06/06", participants: 10, evaluated: 4, total: 4, calCount: 4, finalCal: 4, score: 72.5, status: "closed", fc: true },
];

function MiniBar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="flex flex-col gap-0.5 w-full">
      <div className="h-1 bg-[#e8eae0] w-full overflow-hidden">
        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[9px] font-black italic" style={{ color }}>{value}/{total}</span>
    </div>
  );
}

function StatusBadge({ ev }: { ev: typeof events[0] }) {
  if (ev.status === "open") {
    if (ev.evaluated === 0) return <span className="text-[8px] font-black italic uppercase px-1.5 py-0.5 border bg-[#fff4e5] text-[#a06a00] border-[#e8b84b]">Aguardando</span>;
    if (ev.evaluated < ev.total) return <span className="text-[8px] font-black italic uppercase px-1.5 py-0.5 border bg-[#fff4e5] text-[#a06a00] border-[#e8b84b]">Em Avaliação</span>;
    return <span className="text-[8px] font-black italic uppercase px-1.5 py-0.5 border bg-[#f4fce0] text-[#506600] border-[#c4cda8]">Avaliado</span>;
  }
  if (ev.fc) return <span className="text-[8px] font-black italic uppercase px-1.5 py-0.5 border bg-[#191c1e] text-[#ccff00] border-[#506600]">Pub. Final</span>;
  if (ev.calCount > 0) return <span className="text-[8px] font-black italic uppercase px-1.5 py-0.5 border bg-[#f4fce0] text-[#506600] border-[#c4cda8]">Concluído</span>;
  return <span className="text-[8px] font-black italic uppercase px-1.5 py-0.5 border bg-[#eceef0] text-[#747a60] border-[#d0d2ca]">Concluído</span>;
}

function AccentBar({ ev }: { ev: typeof events[0] }) {
  if (ev.fc) return <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#506600]" />;
  if (ev.evaluated === ev.total && ev.total > 0) return <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#ccff00]" />;
  if (ev.evaluated > 0) return <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#ffb300]" />;
  return <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#e0e2da]" />;
}

export function VarianteB() {
  return (
    <div className="min-h-screen bg-[#f2f4f6] font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header */}
      <div className="bg-[#191c1e] border-b-4 border-[#ccff00] px-5 py-3 flex items-center gap-5">
        <div>
          <span className="text-[9px] font-black italic uppercase text-[#747a60] tracking-wider block">Gerenciar</span>
          <span className="text-[15px] font-black italic uppercase text-white">Eventos do Ciclo</span>
        </div>
        {/* Quick stats */}
        <div className="flex items-center gap-1 ml-2">
          {[
            { val: 7, label: "Eventos", color: "text-white" },
            { val: 2, label: "Abertos", color: "text-[#ccff00]" },
            { val: 5, label: "Concluídos", color: "text-[#9aa088]" },
            { val: 4, label: "Pub. Final", color: "text-[#506600]" },
          ].map((s, i) => (
            <div key={i} className="px-3 py-1 border-r border-[#333] last:border-0">
              <span className={`block text-[17px] font-black italic leading-none ${s.color}`}>{s.val}</span>
              <span className="text-[8px] font-bold italic uppercase text-[#747a60]">{s.label}</span>
            </div>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className="h-8 px-3 border border-[#333] text-[9px] font-bold italic uppercase text-[#9aa088] hover:border-[#ccff00] hover:text-[#ccff00] transition-colors flex items-center gap-1.5">
            <SlidersHorizontal size={10}/> Filtros
          </button>
          <button className="h-8 px-3 bg-[#ccff00] text-[#161e00] text-[9px] font-black italic uppercase flex items-center gap-1.5 hover:bg-[#b8e800] transition-colors">
            <Plus size={10}/> Novo Evento
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white border-b border-[#e0e2da] px-5 py-2 flex items-center gap-3">
        <div className="flex items-center gap-1.5 border border-[#d0d2ca] px-2.5 py-1.5 w-72">
          <Search size={10} className="text-[#9aa088]" />
          <span className="text-[10px] italic text-[#b0b8a0]">Buscar evento…</span>
        </div>
        {/* Filter chips */}
        {["Todos", "Em Andamento", "Concluídos", "Pub. Final", "Pendente Cal."].map((f, i) => (
          <button key={f} className={`h-7 px-2.5 text-[9px] font-bold italic uppercase border transition-colors ${i === 0 ? "bg-[#191c1e] text-[#ccff00] border-[#191c1e]" : "bg-white text-[#747a60] border-[#d0d2ca] hover:border-[#191c1e] hover:text-[#191c1e]"}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="px-5 py-3">
        <div className="bg-white border border-[#d0d2ca]">
          {/* Table header */}
          <div className="grid border-b-2 border-[#191c1e] bg-[#191c1e] text-[#ccff00]/70 text-[9px] font-black italic uppercase tracking-wider" style={{ gridTemplateColumns: "1fr 80px 60px 110px 110px 90px 110px 56px" }}>
            {["Evento", "Data", "Part.", "Avaliações", "Calibrações", "Nota", "Status", ""].map(h => (
              <div key={h} className="px-3 py-2">{h}</div>
            ))}
          </div>

          {/* Rows */}
          {events.map((ev, i) => (
            <div key={ev.id} className={`grid relative items-center border-b border-[#eceef0] hover:bg-[#f8fdf0] transition-colors group cursor-pointer ${i % 2 !== 0 ? "bg-[#fafcf5]" : ""}`} style={{ gridTemplateColumns: "1fr 80px 60px 110px 110px 90px 110px 56px" }}>
              <AccentBar ev={ev} />

              {/* Event name */}
              <div className="pl-4 pr-3 py-3">
                <div className="text-[11px] font-black italic uppercase text-[#191c1e] leading-tight truncate">{ev.name}</div>
                <div className="text-[9px] italic text-[#9aa088] mt-0.5">{ev.city} · {ev.client}</div>
              </div>

              {/* Date */}
              <div className="px-3 py-3 text-[10px] font-bold italic text-[#444933] whitespace-nowrap">{ev.date}</div>

              {/* Participants */}
              <div className="px-3 py-3 flex items-center gap-1 text-[#747a60]">
                <Users size={10} />
                <span className="text-[11px] font-black italic text-[#444933]">{ev.participants}</span>
              </div>

              {/* Avaliações — mini bar */}
              <div className="px-3 py-3">
                <MiniBar value={ev.evaluated} total={ev.total} color={ev.evaluated === ev.total ? "#506600" : "#ccff00"} />
              </div>

              {/* Calibrações — mini bar */}
              <div className="px-3 py-3">
                <MiniBar value={ev.calCount} total={ev.total} color={ev.fc ? "#506600" : ev.calCount > 0 ? "#a06a00" : "#d0d2ca"} />
              </div>

              {/* Score */}
              <div className="px-3 py-3 text-center">
                {ev.score != null ? (
                  <span className={`text-[18px] font-black italic ${ev.fc ? "text-[#506600]" : "text-[#191c1e]"}`}>{ev.score.toFixed(1)}</span>
                ) : (
                  <span className="text-[12px] italic text-[#c4c9ac]">—</span>
                )}
              </div>

              {/* Status */}
              <div className="px-3 py-3">
                <StatusBadge ev={ev} />
              </div>

              {/* Action */}
              <div className="px-3 py-3 flex items-center justify-center">
                <button className="h-7 w-7 bg-[#191c1e] text-[#ccff00] flex items-center justify-center hover:bg-[#506600] transition-colors">
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 px-1">
          {[
            { color: "#506600", label: "Pub. Final" },
            { color: "#ccff00", label: "Avaliado" },
            { color: "#ffb300", label: "Em andamento" },
            { color: "#e0e2da", label: "Aguardando" },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="w-2 h-3 shrink-0" style={{ backgroundColor: l.color }} />
              <span className="text-[9px] italic text-[#747a60]">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
