import { useState } from "react";

const events = [
  { id: 1, name: "CIRCUITO BANCO DO BRASIL – JOINVILLE – 2026", client: "Banco do Brasil", city: "Joinville", start: "17/08", end: "22/08", participants: 12, evaluated: 0, total: 7, score: null, configured: false, confirmed: false, unassigned: ["Atendimento", "Produção"] },
  { id: 2, name: "NIGHT RUN – ETAPA 1 – PALMAS – 2026", client: "Night Run", city: "Palmas", start: "17/08", end: "22/08", participants: 8, evaluated: 0, total: 7, score: null, configured: false, confirmed: false, unassigned: ["Cenografia"] },
  { id: 3, name: "COPA SÃO PAULO DE FUTSAL – CAMPINAS – 2026", client: "FPF", city: "Campinas", start: "10/07", end: "15/07", participants: 24, evaluated: 7, total: 7, score: 82.4, configured: true, confirmed: true, unassigned: [] },
  { id: 4, name: "FESTIVAL LOLLAPALOOZA – SP – 2026", client: "T4F", city: "São Paulo", start: "05/07", end: "07/07", participants: 60, evaluated: 5, total: 7, score: 74.1, configured: true, confirmed: false, unassigned: [] },
  { id: 5, name: "EXPO REAL ESTATE – BRASÍLIA – 2026", client: "Abitare", city: "Brasília", start: "28/06", end: "30/06", participants: 18, evaluated: 7, total: 7, score: 91.0, configured: true, confirmed: true, unassigned: [] },
];

const totalCount = 86;
const stats = [
  { key: "configured", label: "Configurados", value: 8, color: "#506600" },
  { key: "confirmed", label: "Confirmados", value: 14, color: "#506600" },
  { key: "unconfirmed", label: "Não confirmados", value: 72, color: "#ff5722" },
  { key: "pendingCal", label: "Falta calibrar", value: 11, color: "#ffb300" },
  { key: "done", label: "Avaliação 100%", value: 9, color: "#ccff00" },
];

function statusFor(ev: typeof events[0]) {
  if (!ev.configured) return { label: "Aguardando RH", border: "#ff5722", bg: "#fff4f0" };
  if (ev.evaluated === ev.total && ev.total > 0) return { label: "Avaliação completa", border: "#506600", bg: "#f0fff0" };
  if (ev.evaluated > 0) return { label: "Em avaliação", border: "#ffb300", bg: "#fffbf0" };
  return { label: "Configurado", border: "#ccff00", bg: "#f7ffe0" };
}

export function OpcaoA() {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  return (
    <div className="min-h-screen bg-[#f7f9fb]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="px-8 pt-8 pb-12 space-y-6 max-w-[1100px]">

        {/* ── Header compacto ── */}
        <div className="flex items-center justify-between gap-4">
          <div className="border-l-[6px] border-[#ccff00] pl-5 py-0.5">
            <h1 className="text-3xl italic uppercase tracking-tighter font-black leading-none text-[#191c1e]">
              Gestão de <span className="bg-[#191c1e] text-[#ccff00] px-2">Eventos</span>
            </h1>
            <p className="text-xs text-[#747a60] italic mt-1">Ciclo 2026 · 01/06/2026 – 30/09/2026 · {totalCount} eventos sincronizados</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold italic uppercase border-2 border-[#191c1e] bg-white hover:bg-[#f5f5f5] transition-colors">
              Sincronizar
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-bold italic uppercase bg-[#ccff00] border-2 border-[#191c1e] shadow-[3px_3px_0px_0px_#191c1e] hover:shadow-[1px_1px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
              + Novo Evento
            </button>
          </div>
        </div>

        {/* ── Stat strip compacto ── */}
        <div className="flex items-stretch gap-0 border-2 border-[#191c1e] bg-white overflow-hidden shadow-[3px_3px_0px_0px_#191c1e]">
          {stats.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setActiveFilter(activeFilter === s.key ? null : s.key)}
              className={`flex-1 flex flex-col items-center justify-center py-3 px-2 border-r-2 border-[#191c1e] last:border-r-0 transition-colors relative
                ${activeFilter === s.key ? "bg-[#191c1e]" : "hover:bg-[#f7f9fb]"}`}
            >
              <span className="text-2xl font-black italic leading-none" style={{ color: activeFilter === s.key ? "#ccff00" : s.color }}>{s.value}</span>
              <span className={`text-[9px] font-bold uppercase italic tracking-wider mt-0.5 ${activeFilter === s.key ? "text-[#ccff00]/70" : "text-[#747a60]"}`}>{s.label}</span>
              <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ backgroundColor: activeFilter === s.key ? "#ccff00" : "transparent" }} />
            </button>
          ))}
        </div>

        {/* ── Barra de busca + filtros ── */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747a60] text-sm">🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 h-10 border-2 border-[#191c1e] bg-white text-sm italic font-medium focus:outline-none focus:ring-2 focus:ring-[#ccff00]"
              placeholder="Buscar evento, cliente ou cidade..."
            />
          </div>
          <select className="h-10 border-2 border-[#191c1e] bg-white px-3 text-xs font-bold italic uppercase focus:outline-none">
            <option>Todos status</option>
            <option>Configurados</option>
            <option>Aguardando RH</option>
          </select>
          <select className="h-10 border-2 border-[#191c1e] bg-white px-3 text-xs font-bold italic uppercase focus:outline-none">
            <option>↕ Mais recente</option>
            <option>Mais antigo</option>
          </select>
        </div>

        {/* ── Cards de evento ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {events.map(ev => {
            const st = statusFor(ev);
            const pct = ev.total > 0 ? (ev.evaluated / ev.total) * 100 : 0;
            return (
              <div key={ev.id} className="bg-white border-2 border-[#191c1e] border-l-[5px] hover:shadow-[3px_3px_0px_0px_#191c1e] transition-all"
                style={{ borderLeftColor: st.border }}>
                <div className="p-4">
                  {/* Linha superior: badge status + ações */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-black italic uppercase text-sm leading-tight truncate text-[#191c1e]">{ev.name}</p>
                      <p className="text-[11px] text-[#747a60] italic mt-0.5">{ev.client} · {ev.city}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-black italic uppercase px-2 py-0.5 border border-[#191c1e]"
                      style={{ backgroundColor: st.bg, color: st.border }}>
                      {st.label}
                    </span>
                  </div>

                  {/* Metadados em linha compacta */}
                  <div className="flex items-center gap-4 text-[11px] text-[#747a60] italic mb-3">
                    <span>📅 {ev.start} – {ev.end}</span>
                    <span>👥 {ev.participants} part.</span>
                    {ev.score != null && <span className="font-black text-[#191c1e]">⭐ {ev.score.toFixed(1)}</span>}
                  </div>

                  {/* Progress de avaliação */}
                  {ev.total > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold italic uppercase text-[#747a60]">Avaliação</span>
                        <span className="text-[10px] font-black italic">{ev.evaluated}/{ev.total}</span>
                      </div>
                      <div className="h-1.5 bg-[#eceef0] border border-[#191c1e]">
                        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#506600" : pct > 0 ? "#ccff00" : "#eceef0" }} />
                      </div>
                    </div>
                  )}

                  {ev.unassigned.length > 0 && (
                    <p className="text-[10px] font-bold italic text-[#b02f00] mb-2">Sem avaliador: {ev.unassigned.join(", ")}</p>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t-2 border-[#eceef0] flex items-center justify-between px-4 py-2">
                  <span className={`text-[10px] font-black italic uppercase ${ev.confirmed ? "text-[#506600]" : "text-[#a06a00]"}`}>
                    {ev.confirmed ? "✓ Elegibilidade OK" : "Elegibilidade pendente"}
                  </span>
                  <button className="text-[10px] font-black italic uppercase bg-[#191c1e] text-[#ccff00] px-3 py-1 hover:bg-[#506600] transition-colors">
                    Gerenciar →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
