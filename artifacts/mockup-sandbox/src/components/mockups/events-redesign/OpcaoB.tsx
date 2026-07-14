import { useState } from "react";

const events = [
  { id: 1, name: "CIRCUITO BANCO DO BRASIL – JOINVILLE", client: "Banco do Brasil", city: "Joinville", start: "17/08", end: "22/08", participants: 12, evaluated: 0, total: 7, score: null, configured: false, confirmed: false },
  { id: 2, name: "NIGHT RUN – ETAPA 1 – PALMAS", client: "Night Run", city: "Palmas", start: "17/08", end: "22/08", participants: 8, evaluated: 0, total: 7, score: null, configured: false, confirmed: false },
  { id: 3, name: "COPA SÃO PAULO DE FUTSAL – CAMPINAS", client: "FPF", city: "Campinas", start: "10/07", end: "15/07", participants: 24, evaluated: 7, total: 7, score: 82.4, configured: true, confirmed: true },
  { id: 4, name: "FESTIVAL LOLLAPALOOZA – SP", client: "T4F", city: "São Paulo", start: "05/07", end: "07/07", participants: 60, evaluated: 5, total: 7, score: 74.1, configured: true, confirmed: false },
  { id: 5, name: "EXPO REAL ESTATE – BRASÍLIA", client: "Abitare", city: "Brasília", start: "28/06", end: "30/06", participants: 18, evaluated: 7, total: 7, score: 91.0, configured: true, confirmed: true },
  { id: 6, name: "MARATONA DE SP – ETAPA 3", client: "Yescom", city: "São Paulo", start: "20/06", end: "22/06", participants: 45, evaluated: 4, total: 7, score: 68.5, configured: true, confirmed: false },
];

const stats = [
  { key: "all", label: "Todos os eventos", value: 86, color: "#191c1e" },
  { key: "configured", label: "Configurados", value: 8, color: "#506600" },
  { key: "confirmed", label: "Confirmados", value: 14, color: "#506600" },
  { key: "unconfirmed", label: "Não confirmados", value: 72, color: "#ff5722" },
  { key: "pendingCal", label: "Falta calibrar", value: 11, color: "#ffb300" },
  { key: "done", label: "Avaliação 100%", value: 9, color: "#ccff00" },
];

function statusInfo(ev: typeof events[0]) {
  if (!ev.configured) return { label: "Aguardando RH", color: "#ff5722" };
  if (ev.evaluated === ev.total && ev.total > 0) return { label: "Avaliado", color: "#506600" };
  if (ev.evaluated > 0) return { label: "Em avaliação", color: "#ffb300" };
  return { label: "Configurado", color: "#506600" };
}

export function OpcaoB() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");

  return (
    <div className="min-h-screen bg-[#f7f9fb] flex flex-col" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── Top bar ── */}
      <div className="bg-[#191c1e] text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-black italic uppercase tracking-tighter">Gestão de <span className="text-[#ccff00]">Eventos</span></h1>
          <span className="text-[10px] font-bold italic uppercase text-white/40 border border-white/20 px-2 py-0.5">Ciclo 2026</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-[11px] font-bold italic uppercase text-white/60 border border-white/20 px-3 py-1.5 hover:text-white hover:border-white/60 transition-colors">
            Sincronizar
          </button>
          <button className="text-[11px] font-black italic uppercase bg-[#ccff00] text-[#161e00] px-4 py-1.5 hover:bg-[#b8e600] transition-colors">
            + Novo Evento
          </button>
        </div>
      </div>

      <div className="flex flex-1">
        {/* ── Sidebar ── */}
        <aside className="w-52 shrink-0 bg-white border-r-2 border-[#191c1e] flex flex-col">
          <div className="p-4 border-b-2 border-[#eceef0]">
            <p className="text-[9px] font-black italic uppercase tracking-widest text-[#747a60] mb-3">Filtrar por status</p>
            <div className="space-y-0.5">
              {stats.map(s => (
                <button
                  key={s.key}
                  onClick={() => setActiveFilter(s.key)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors border-l-2 ${
                    activeFilter === s.key
                      ? "bg-[#f0ffe0] border-[#506600]"
                      : "border-transparent hover:bg-[#f7f9fb]"
                  }`}
                >
                  <span className={`text-xs font-bold italic ${activeFilter === s.key ? "text-[#191c1e]" : "text-[#444933]"}`}>{s.label}</span>
                  <span className="text-sm font-black italic" style={{ color: s.color }}>{s.value}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 mt-auto border-t-2 border-[#eceef0]">
            <p className="text-[9px] font-bold italic uppercase text-[#747a60] mb-2">Legenda</p>
            {[
              { c: "#ff5722", l: "Aguardando RH" },
              { c: "#ffb300", l: "Em avaliação" },
              { c: "#506600", l: "Completo" },
            ].map(x => (
              <div key={x.l} className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: x.c }} />
                <span className="text-[10px] italic text-[#747a60]">{x.l}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="flex-1 flex flex-col">
          {/* Search bar */}
          <div className="px-6 py-3 border-b-2 border-[#eceef0] bg-white flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747a60] text-xs">🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-4 h-9 border-2 border-[#191c1e] bg-[#f7f9fb] text-sm italic font-medium focus:outline-none focus:bg-white"
                placeholder="Buscar evento, cliente ou cidade..."
              />
            </div>
            <select className="h-9 border-2 border-[#191c1e] bg-white px-2 text-[11px] font-bold italic uppercase focus:outline-none">
              <option>↕ Mais recente</option>
              <option>Mais antigo</option>
              <option>Maior score</option>
            </select>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b-2 border-[#191c1e] bg-[#191c1e] sticky top-0">
                  {["Evento", "Período", "Part.", "Avaliação", "Score", "Status", ""].map(h => (
                    <th key={h} className="px-4 py-2.5 text-[10px] font-bold uppercase italic text-[#ccff00] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map(ev => {
                  const st = statusInfo(ev);
                  const pct = ev.total > 0 ? (ev.evaluated / ev.total) * 100 : 0;
                  return (
                    <tr key={ev.id} className="border-b-2 border-[#eceef0] hover:bg-[#f7f9fb] transition-colors">
                      <td className="px-4 py-3 max-w-[260px]">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-8 shrink-0 rounded-sm" style={{ backgroundColor: st.color }} />
                          <div className="min-w-0">
                            <p className="font-black italic uppercase text-xs leading-tight truncate text-[#191c1e]">{ev.name}</p>
                            <p className="text-[10px] text-[#747a60] italic truncate">{ev.client} · {ev.city}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-bold italic text-[#444933] whitespace-nowrap">{ev.start} – {ev.end}</td>
                      <td className="px-4 py-3 text-xs font-black italic text-center text-[#444933]">{ev.participants}</td>
                      <td className="px-4 py-3">
                        <div className="w-24">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-bold italic text-[#747a60]">{ev.evaluated}/{ev.total}</span>
                            <span className="text-[9px] font-bold italic text-[#747a60]">{Math.round(pct)}%</span>
                          </div>
                          <div className="h-1 bg-[#eceef0]">
                            <div className="h-full" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#506600" : pct > 0 ? "#ccff00" : "transparent" }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {ev.score != null ? (
                          <span className="text-sm font-black italic text-[#191c1e]">{ev.score.toFixed(1)}</span>
                        ) : (
                          <span className="text-xs italic text-[#c4c9ac]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold italic" style={{ color: st.color }}>{st.label}</span>
                        {ev.confirmed && <span className="block text-[9px] italic text-[#506600]">Elegibilidade OK</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-[10px] font-black italic uppercase bg-[#191c1e] text-[#ccff00] px-2.5 py-1 hover:bg-[#506600] transition-colors whitespace-nowrap">
                          Gerenciar →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer count */}
          <div className="px-6 py-2 border-t-2 border-[#eceef0] bg-white flex items-center justify-between">
            <span className="text-[11px] italic text-[#747a60]">Mostrando {events.length} de 86 eventos</span>
            <span className="text-[11px] italic text-[#747a60]">Ciclo 2026 · 01/06 – 30/09/2026</span>
          </div>
        </main>
      </div>
    </div>
  );
}
