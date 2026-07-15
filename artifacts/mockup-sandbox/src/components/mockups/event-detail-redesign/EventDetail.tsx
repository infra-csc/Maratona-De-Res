import { useState } from "react";
import { ArrowLeft, Users, Calendar, MapPin, ShieldCheck, Lock, ChevronRight, Save, RefreshCw, Plus, Trash2, MessageSquare, AlertTriangle, CheckCircle, Flag, BarChart3 } from "lucide-react";

const event = {
  name: "Rock in Rio 2026",
  city: "Rio de Janeiro",
  client: "Rock World",
  date: "12/07/2026",
  status: "closed",
  score: 87.3,
  avgScore: 82.1,
  participants: 24,
  evaluated: 4,
  total: 4,
  calCount: 4,
  finalCal: 4,
  fc: true,
};

const criteria = [
  { id: 1, name: "EPI e Segurança", area: "Logística", weight: 4, avaliador: 9, calibrado: 9, status: "final" },
  { id: 2, name: "Prazo de Entrega", area: "Produção", weight: 5, avaliador: 8, calibrado: 9, status: "final" },
  { id: 3, name: "Conduta e Comportamento", area: "Produção", weight: 4, avaliador: 8, calibrado: 8, status: "final" },
  { id: 4, name: "Guarda de Equipamentos", area: "Logística", weight: 3, avaliador: 7, calibrado: 8, status: "final" },
];

const team = [
  { name: "Carlos Menezes", fn: "Coordenador", diarias: 3, confirmed: true },
  { name: "Ana Figueiredo", fn: "Assistente", diarias: 2, confirmed: true },
  { name: "Roberto Luz", fn: "Técnico Sênior", diarias: 3, confirmed: true },
  { name: "Juliana Torres", fn: "Assistente", diarias: 1, confirmed: false },
  { name: "Marcos Lima", fn: "Técnico", diarias: 2, confirmed: true },
];

const conformity = [
  { label: "EPI", key: "epi", ok: true, comment: "" },
  { label: "Estaiamento", key: "estaiamentos", ok: true, comment: "" },
  { label: "Conduta", key: "conduta", ok: false, comment: "Dois colaboradores chegaram 40min atrasados." },
  { label: "Guarda Equip.", key: "guardaEquipamentos", ok: true, comment: "" },
];

const comments = [
  { author: "Admin Sistema", time: "15/07/2026, 10:32", text: "Evento revisado. Score calibrado aprovado pela diretoria." },
  { author: "Maria Rh", time: "14/07/2026, 16:04", text: "Conformidade registrada. Destaque: Carlos Menezes." },
];

const tabs = ["Visão Geral", "Quesitos", "Equipe", "Conformidade"];

function MiniBar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#e8eae0] overflow-hidden">
        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[9px] font-black italic whitespace-nowrap" style={{ color }}>{value}/{total}</span>
    </div>
  );
}

function TabVisaoGeral() {
  return (
    <div className="flex gap-4 h-full">
      {/* ── Left: main content ── */}
      <div className="flex-1 space-y-3 min-w-0">

        {/* Score + progress cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Score Final", value: "87.3", sub: "Calibrado", color: "bg-[#191c1e]", textColor: "text-[#ccff00]", subColor: "text-[#9aa088]" },
            { label: "Nota Avaliador", value: "82.1", sub: "Média bruta", color: "bg-white", textColor: "text-[#191c1e]", subColor: "text-[#747a60]" },
            { label: "Participantes", value: "24", sub: "Confirmados", color: "bg-white", textColor: "text-[#191c1e]", subColor: "text-[#747a60]" },
            { label: "Diárias Totais", value: "11", sub: "Realizadas", color: "bg-white", textColor: "text-[#191c1e]", subColor: "text-[#747a60]" },
          ].map(card => (
            <div key={card.label} className={`${card.color} border-2 border-[#191c1e] px-4 py-3`}>
              <p className="text-[9px] font-black italic uppercase text-[#747a60] mb-1">{card.label}</p>
              <p className={`text-[28px] font-black italic leading-none ${card.textColor}`}>{card.value}</p>
              <p className={`text-[9px] italic mt-0.5 ${card.subColor}`}>{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Criterion results table */}
        <div className="bg-white border-2 border-[#191c1e]">
          <div className="px-3 py-2 border-b-2 border-[#191c1e] bg-[#f8fdf0] flex items-center justify-between">
            <span className="text-[11px] font-black italic uppercase text-[#191c1e]">Resultado por Quesito</span>
            <span className="text-[9px] font-bold italic uppercase text-[#506600] flex items-center gap-1">
              <ShieldCheck size={10} /> 4/4 Pub. Final
            </span>
          </div>
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-[#e8eae0]">
                {["Quesito", "Área", "Peso", "Avaliador", "Calibrado", "Δ", "Status"].map(h => (
                  <th key={h} className="px-3 py-2 text-[9px] font-black italic uppercase text-[#747a60] text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {criteria.map((c, i) => {
                const diff = c.calibrado - c.avaliador;
                return (
                  <tr key={c.id} className={`border-b border-[#f0f2ea] ${i % 2 !== 0 ? "bg-[#fafcf5]" : ""}`}>
                    <td className="px-3 py-2 font-black italic text-[#191c1e]">{c.name}</td>
                    <td className="px-3 py-2 italic text-[#747a60] text-[10px]">{c.area}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="text-[11px] font-black italic border border-[#d0d2ca] px-1.5 py-0.5">{c.weight}</span>
                    </td>
                    <td className="px-3 py-2 text-center text-[14px] font-black italic text-[#747a60]">{c.avaliador}</td>
                    <td className="px-3 py-2 text-center text-[14px] font-black italic text-[#191c1e]">{c.calibrado}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-[10px] font-black italic ${diff > 0 ? "text-[#506600]" : diff < 0 ? "text-[#b02f00]" : "text-[#c4c9ac]"}`}>
                        {diff > 0 ? `+${diff}` : diff === 0 ? "=" : diff}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[8px] font-black italic uppercase bg-[#191c1e] text-[#ccff00] border border-[#506600] px-1.5 py-0.5 flex items-center gap-0.5 w-fit">
                        <ShieldCheck size={8} /> Final
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Comments */}
        <div className="bg-white border-2 border-[#191c1e]">
          <div className="px-3 py-2 border-b-2 border-[#191c1e] flex items-center justify-between">
            <span className="text-[11px] font-black italic uppercase text-[#191c1e] flex items-center gap-1.5">
              <MessageSquare size={12} /> Comentários <span className="text-[#747a60]">({comments.length})</span>
            </span>
          </div>
          <div className="divide-y divide-[#f0f2ea]">
            {comments.map((c, i) => (
              <div key={i} className="px-3 py-2">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[9px] font-black italic uppercase text-[#191c1e]">{c.author}</span>
                  <span className="text-[9px] italic text-[#9aa088]">{c.time}</span>
                </div>
                <p className="text-[11px] italic text-[#444933] leading-snug">{c.text}</p>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-[#e8eae0] flex gap-2">
            <input placeholder="Adicionar comentário…" className="flex-1 text-[11px] italic border border-[#d0d2ca] bg-[#f8f9fb] px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#ccff00]" />
            <button className="h-7 px-3 bg-[#191c1e] text-[#ccff00] text-[9px] font-black italic uppercase hover:bg-[#506600] transition-colors">Enviar</button>
          </div>
        </div>
      </div>

      {/* ── Right sidebar ── */}
      <div className="w-72 space-y-3 shrink-0">

        {/* Quick actions */}
        <div className="bg-white border-2 border-[#191c1e]">
          <div className="px-3 py-2 bg-[#191c1e] border-b-2 border-[#191c1e]">
            <span className="text-[10px] font-black italic uppercase text-[#ccff00]">Ações Rápidas</span>
          </div>
          <div className="p-2 space-y-1.5">
            <button className="w-full h-8 bg-[#506600] text-[#ccff00] text-[10px] font-black italic uppercase flex items-center gap-2 px-3 hover:bg-[#3c4d00] transition-colors">
              <ShieldCheck size={11} /> Ver Calibrações
            </button>
            <button className="w-full h-8 border-2 border-[#191c1e] bg-white text-[#191c1e] text-[10px] font-black italic uppercase flex items-center gap-2 px-3 hover:bg-[#f2f4f6] transition-colors">
              <BarChart3 size={11} /> Resultados
            </button>
            <button className="w-full h-8 border border-[#d0d2ca] bg-[#f8f9fb] text-[#747a60] text-[10px] font-bold italic uppercase flex items-center gap-2 px-3 hover:border-[#191c1e] transition-colors">
              <Flag size={11} /> Publicar Parcial
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-white border-2 border-[#191c1e] px-3 py-2.5 space-y-2">
          <span className="text-[10px] font-black italic uppercase text-[#444933] block mb-1">Progresso</span>
          <div>
            <span className="text-[8px] font-bold italic uppercase text-[#747a60] block mb-1">Avaliações</span>
            <MiniBar value={event.evaluated} total={event.total} color="#506600" />
          </div>
          <div>
            <span className="text-[8px] font-bold italic uppercase text-[#747a60] block mb-1">Calibrações</span>
            <MiniBar value={event.calCount} total={event.total} color="#506600" />
          </div>
          <div>
            <span className="text-[8px] font-bold italic uppercase text-[#747a60] block mb-1">Pub. Final</span>
            <MiniBar value={event.finalCal} total={event.total} color="#191c1e" />
          </div>
        </div>

        {/* Team summary */}
        <div className="bg-white border-2 border-[#191c1e]">
          <div className="px-3 py-2 border-b-2 border-[#191c1e] flex items-center justify-between">
            <span className="text-[10px] font-black italic uppercase text-[#444933] flex items-center gap-1.5"><Users size={11}/> Equipe ({team.length})</span>
          </div>
          <div className="divide-y divide-[#f0f2ea]">
            {team.map(m => (
              <div key={m.name} className="px-3 py-1.5 flex items-center gap-2">
                <div className={`w-5 h-5 flex items-center justify-center text-[8px] font-black italic border-2 shrink-0 ${m.confirmed ? "border-[#191c1e] bg-[#191c1e] text-[#ccff00]" : "border-[#d0d2ca] bg-white text-[#747a60]"}`}>
                  {m.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black italic text-[#191c1e] truncate">{m.name}</p>
                  <p className="text-[8px] italic text-[#9aa088] truncate">{m.fn}</p>
                </div>
                <span className="text-[9px] font-black italic text-[#506600] bg-[#e8f5d0] border border-[#c4cda8] px-1 py-px shrink-0">{m.diarias}d</span>
              </div>
            ))}
          </div>
        </div>

        {/* Conformidade */}
        <div className="bg-white border-2 border-[#191c1e]">
          <div className="px-3 py-2 border-b-2 border-[#191c1e] flex items-center justify-between">
            <span className="text-[10px] font-black italic uppercase text-[#444933] flex items-center gap-1.5"><ShieldCheck size={11}/> Conformidade</span>
            <span className="text-[8px] font-black italic uppercase text-[#b02f00]">1 não-conf.</span>
          </div>
          <div className="p-2 grid grid-cols-2 gap-1.5">
            {conformity.map(c => (
              <div key={c.key} className={`flex items-center justify-between gap-1 px-2 py-1.5 border ${c.ok ? "bg-[#f2ffd6] border-[#506600]" : "bg-[#ffede9] border-[#b02f00]"}`} title={c.comment || undefined}>
                <span className="text-[9px] font-bold italic uppercase text-[#191c1e] truncate">{c.label}</span>
                <span className={`text-[8px] font-black italic px-1 py-px shrink-0 ${c.ok ? "bg-[#ccff00] text-[#161e00]" : "bg-[#ff5722] text-white"}`}>
                  {c.ok ? "OK" : "Não"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabQuesitos() {
  return (
    <div className="bg-white border-2 border-[#191c1e]">
      <div className="px-3 py-2 bg-[#f8fdf0] border-b-2 border-[#191c1e] flex items-center justify-between">
        <span className="text-[11px] font-black italic uppercase">Critérios, Pesos e Avaliadores</span>
        <div className="flex items-center gap-2">
          <span className="text-[9px] italic text-[#b02f00] flex items-center gap-1"><Lock size={9}/> Critérios bloqueados — pesos editáveis</span>
          <button className="h-7 px-2.5 bg-[#191c1e] text-[#ccff00] text-[9px] font-black italic uppercase flex items-center gap-1 hover:bg-[#506600]"><Save size={9}/> Salvar</button>
        </div>
      </div>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-[#e8eae0] bg-[#f8f9fb]">
            {["Quesito", "Área", "Avaliador", "Peso", "Resultado", ""].map(h => (
              <th key={h} className="px-3 py-2 text-[9px] font-black italic uppercase text-[#747a60] text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {criteria.map((c, i) => (
            <tr key={c.id} className={`border-b border-[#eceef0] ${i % 2 !== 0 ? "bg-[#fafcf5]" : ""}`}>
              <td className="px-3 py-2.5">
                <span className="font-black italic text-[#191c1e]">{c.name}</span>
              </td>
              <td className="px-3 py-2.5">
                <span className="text-[9px] italic font-bold bg-[#eceef0] text-[#747a60] border border-[#d0d2ca] px-1.5 py-0.5">{c.area}</span>
              </td>
              <td className="px-3 py-2.5">
                <select className="text-[10px] italic border border-[#d0d2ca] px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#ccff00]">
                  <option>Carlos Menezes</option>
                </select>
              </td>
              <td className="px-3 py-2.5">
                <input type="number" defaultValue={c.weight} min={0} max={10} className="w-12 text-center text-[11px] font-black italic border-2 border-[#ccff00] bg-[#f8fdf0] py-1 focus:outline-none focus:ring-1 focus:ring-[#506600]" />
              </td>
              <td className="px-3 py-2.5 text-center">
                <span className="text-[14px] font-black italic text-[#191c1e]">{c.calibrado}</span>
              </td>
              <td className="px-3 py-2.5">
                <button className="h-6 w-6 flex items-center justify-center border border-[#e8eae0] text-[#c4c9ac] hover:border-[#b02f00] hover:text-[#b02f00] transition-colors">
                  <Trash2 size={9} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-2 border-t border-[#e8eae0] flex items-center justify-between">
        <button className="h-7 px-2.5 border border-[#d0d2ca] text-[9px] font-bold italic uppercase text-[#747a60] flex items-center gap-1 hover:border-[#191c1e]"><Plus size={9}/> Duplicar Quesito</button>
        <button className="h-7 px-2.5 border border-[#d0d2ca] text-[9px] font-bold italic uppercase text-[#747a60] flex items-center gap-1 hover:border-[#191c1e]"><RefreshCw size={9}/> Sincronizar</button>
      </div>
    </div>
  );
}

export function EventDetail() {
  const [activeTab, setActiveTab] = useState("Visão Geral");

  return (
    <div className="min-h-screen bg-[#f2f4f6] font-['Plus_Jakarta_Sans',sans-serif] flex flex-col">

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-30 bg-[#191c1e] border-b-4 border-[#ccff00]">
        {/* Breadcrumb + status */}
        <div className="px-5 py-2 flex items-center gap-3">
          <button className="flex items-center gap-1 text-[#747a60] hover:text-[#ccff00] text-[10px] italic font-bold transition-colors">
            <ArrowLeft size={11} /> Eventos
          </button>
          <span className="text-[#444933]">/</span>
          <span className="text-[10px] font-black italic uppercase text-white truncate max-w-xs">{event.name}</span>
          <span className="ml-1 text-[8px] font-black italic uppercase bg-[#191c1e] text-[#ccff00] border border-[#506600] px-2 py-0.5 flex items-center gap-1">
            <ShieldCheck size={8} /> Pub. Final
          </span>

          {/* Key metrics inline */}
          <div className="flex items-center gap-3 ml-auto">
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-bold italic uppercase text-[#747a60]">Nota Final</span>
              <span className="text-[20px] font-black italic text-[#ccff00] leading-none">{event.score}</span>
            </div>
            <div className="w-px h-8 bg-[#333]" />
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-bold italic uppercase text-[#747a60]">Avaliações</span>
              <span className="text-[14px] font-black italic text-white leading-none">{event.evaluated}/{event.total}</span>
            </div>
            <div className="w-px h-8 bg-[#333]" />
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-bold italic uppercase text-[#747a60]">Calibrações</span>
              <span className="text-[14px] font-black italic text-[#ccff00] leading-none">{event.calCount}/{event.total}</span>
            </div>
            <div className="w-px h-8 bg-[#333]" />
            <div className="flex items-center gap-1.5 text-[#9aa088] text-[10px] italic">
              <Calendar size={10} />
              <span>{event.date}</span>
              <MapPin size={10} className="ml-1" />
              <span>{event.city}</span>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex px-5 gap-0">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-[10px] font-black italic uppercase transition-colors border-b-2 ${
                activeTab === tab
                  ? "text-[#ccff00] border-[#ccff00]"
                  : "text-[#747a60] border-transparent hover:text-[#9aa088]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 p-4">
        {activeTab === "Visão Geral" && <TabVisaoGeral />}
        {activeTab === "Quesitos" && <TabQuesitos />}
        {activeTab === "Equipe" && (
          <div className="bg-white border-2 border-[#191c1e] p-4 text-center text-[11px] italic text-[#747a60]">
            Gestão completa da equipe alocada — adicionar, remover, editar diárias e confirmar participação.
          </div>
        )}
        {activeTab === "Conformidade" && (
          <div className="bg-white border-2 border-[#191c1e] p-4 text-center text-[11px] italic text-[#747a60]">
            Matriz de conformidade detalhada — EPI, Estaiamento, Conduta, Guarda de Equipamentos, Faltas/Atrasos, Destaque.
          </div>
        )}
      </div>
    </div>
  );
}
