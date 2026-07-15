import { ShieldCheck, Flag, Send, Copy, Users, AlertTriangle, MessageSquare } from "lucide-react";

const criteria = [
  { id: 1, name: "EPI e Segurança", area: "LOGÍSTICA", weight: 4, avaliador: 8, calibrado: 9, justificativa: "Carga um pouco desorganizada", status: "final", ts: "15/07/2026, 16:20" },
  { id: 2, name: "Prazo de Entrega", area: "PRODUÇÃO", weight: 5, avaliador: 3, calibrado: 8, justificativa: "Cenografia: identificamos duas falhas de impressão na testeira da Colgate. Além disso, foi necessário cortar o backdrop do palco porque a madeira entregue não estava de acordo com o projeto. Esses imprevistos atrasaram a entrega final da arena, que foi concluída por volta das 20h.", status: "final", ts: "15/07/2026, 16:20" },
  { id: 3, name: "Perda de Material", area: "LOGÍSTICA", weight: 3, avaliador: 4, calibrado: null, justificativa: "", status: null, ts: null },
  { id: 4, name: "Conduta e Comportamento", area: "PRODUÇÃO", weight: 4, avaliador: 9, calibrado: null, justificativa: "", status: null, ts: null },
];

const team = [
  { name: "Carlos Menezes", fn: "Coordenador", diarias: 3 },
  { name: "Ana Figueiredo", fn: "Assistente", diarias: 2 },
  { name: "Roberto Luz", fn: "Técnico", diarias: 3 },
];

const conformity = [
  { label: "EPI", ok: true },
  { label: "Estaiamento", ok: true },
  { label: "Conduta", ok: false },
  { label: "Guarda Equip.", ok: true },
];

export function VarianteA() {
  return (
    <div className="min-h-screen bg-[#f2f4f6] font-['Plus_Jakarta_Sans',sans-serif]">
      {/* ── Sticky context bar ── */}
      <div className="sticky top-0 z-20 bg-[#191c1e] border-b-4 border-[#ccff00] px-4 py-2.5 flex flex-wrap gap-x-6 gap-y-2 items-start">
        {/* Event info */}
        <div className="flex flex-col min-w-[200px]">
          <span className="text-[9px] font-black italic uppercase text-[#747a60] tracking-wider">Evento</span>
          <span className="text-[13px] font-black italic uppercase text-white leading-tight">Tech Summit 2026</span>
          <span className="text-[10px] italic text-[#9aa088]">Área: Logística & Produção</span>
        </div>

        {/* Scores */}
        <div className="flex gap-3 items-end">
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black italic uppercase text-[#747a60]">Avaliador</span>
            <span className="text-[22px] font-black italic text-[#ccff00] leading-none">7.2</span>
          </div>
          <div className="w-px h-8 bg-[#333]" />
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black italic uppercase text-[#ccff00]">Calibrado</span>
            <span className="text-[22px] font-black italic text-white leading-none">8.5</span>
          </div>
        </div>

        {/* Team pills */}
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black italic uppercase text-[#747a60] flex items-center gap-1"><Users size={9} /> Equipe</span>
          <div className="flex flex-wrap gap-1">
            {team.map(m => (
              <span key={m.name} className="text-[9px] italic font-bold bg-[#2a2e30] text-[#c4cda8] border border-[#3a3e40] px-2 py-0.5 whitespace-nowrap">
                {m.name} · <span className="text-[#ccff00]">{m.diarias}d</span>
              </span>
            ))}
          </div>
        </div>

        {/* Conformity mini pills */}
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black italic uppercase text-[#747a60] flex items-center gap-1"><ShieldCheck size={9} /> Conformidade</span>
          <div className="flex gap-1 flex-wrap">
            {conformity.map(c => (
              <span key={c.label} className={`text-[9px] italic font-black px-2 py-0.5 border whitespace-nowrap ${c.ok ? "bg-[#1a2a00] text-[#ccff00] border-[#506600]" : "bg-[#3b0900] text-[#ffb5a0] border-[#b02f00]"}`}>
                {c.label} {c.ok ? "✓" : "✗"}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="flex items-center gap-1 text-[9px] italic font-bold text-[#ffb5a0] border border-[#b02f00] bg-[#3b0900] px-2 py-1">
            <AlertTriangle size={9} /> 1 revisão
          </span>
          <span className="flex items-center gap-1 text-[9px] italic font-bold text-[#9aa088] border border-[#3a3e40] px-2 py-1">
            <MessageSquare size={9} /> 3 comentários
          </span>
        </div>
      </div>

      {/* ── Full-width table ── */}
      <div className="p-4">
        <div className="bg-white border border-[#d0d2ca]">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-[#f8fdf0] border-b-2 border-[#c4cda8]">
                <th className="text-left px-3 py-2 text-[10px] font-black italic uppercase text-[#444933]">Quesito</th>
                <th className="text-center px-2 py-2 text-[10px] font-black italic uppercase text-[#444933] w-20">Peso</th>
                <th className="text-center px-2 py-2 text-[10px] font-black italic uppercase text-[#444933] w-24">Avaliador</th>
                <th className="text-center px-2 py-2 text-[10px] font-black italic uppercase text-[#444933] w-24">Calibrado</th>
                <th className="px-3 py-2 text-[10px] font-black italic uppercase text-[#444933]">Justificativa / Comentário Avaliador</th>
                <th className="text-center px-2 py-2 text-[10px] font-black italic uppercase text-[#444933] w-28">Publicação</th>
              </tr>
            </thead>
            <tbody>
              {criteria.map((c, i) => (
                <tr key={c.id} className={`border-b border-[#e8eae0] ${i % 2 === 0 ? "bg-white" : "bg-[#fafcf5]"}`}>
                  {/* Quesito */}
                  <td className="px-3 py-2.5 align-top">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black italic uppercase text-[#191c1e] leading-tight">{c.name}</span>
                      <span className="text-[8px] font-bold italic bg-[#eceef0] text-[#747a60] border border-[#d0d2ca] px-1 py-px whitespace-nowrap">{c.area}</span>
                    </div>
                  </td>
                  {/* Peso */}
                  <td className="px-2 py-2.5 text-center align-top">
                    <span className="text-[11px] font-black italic text-[#191c1e] border border-[#191c1e] px-2 py-1 inline-block w-8">{c.weight}</span>
                  </td>
                  {/* Avaliador */}
                  <td className="px-2 py-2.5 text-center align-top">
                    <span className="text-[16px] font-black italic text-[#444933]">{c.avaliador}</span>
                  </td>
                  {/* Calibrado */}
                  <td className="px-2 py-2.5 text-center align-top">
                    {c.calibrado !== null ? (
                      <span className="text-[16px] font-black italic text-[#191c1e]">{c.calibrado}</span>
                    ) : (
                      <span className="text-[11px] italic text-[#b0b8a0]">—</span>
                    )}
                  </td>
                  {/* Justificativa + comentário avaliador inline */}
                  <td className="px-3 py-2.5 align-top">
                    {/* Comentário avaliador (read-only) */}
                    {c.justificativa && (
                      <div className="mb-2 pb-2 border-b border-dashed border-[#c4cda8]">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[8px] font-black italic uppercase bg-[#e8f5d0] text-[#506600] px-1 py-px">Avaliador</span>
                          <span className="text-[9px] italic text-[#747a60]">Carlos Menezes</span>
                          <button className="ml-auto h-4 w-4 flex items-center justify-center text-[#506600] hover:bg-[#ccff00]">
                            <Copy size={9} />
                          </button>
                        </div>
                        <p className="text-[11px] italic text-[#444933] leading-snug line-clamp-2">{c.justificativa}</p>
                      </div>
                    )}
                    {/* Calibração textarea */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[8px] font-black italic uppercase bg-[#eceef0] text-[#747a60] px-1 py-px">Calibração</span>
                      </div>
                      <textarea
                        rows={1}
                        defaultValue={c.justificativa}
                        placeholder="Escreva a justificativa…"
                        className="w-full px-2 py-1 text-[11px] italic border border-[#e0e2da] bg-[#fafafa] focus:outline-none focus:ring-1 focus:ring-[#ccff00] placeholder:text-[#b0b8a0] resize-none leading-snug"
                      />
                    </div>
                  </td>
                  {/* Publicação */}
                  <td className="px-2 pt-2.5 pb-2 text-center align-top">
                    <div className="flex flex-col items-center gap-1">
                      {c.status === "final" && (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[9px] font-bold italic uppercase bg-[#506600] text-[#ccff00] border border-[#506600] px-1.5 py-0.5 flex items-center gap-0.5 whitespace-nowrap">
                            <ShieldCheck size={9} /> Final
                          </span>
                          <span className="text-[8px] italic text-[#747a60] whitespace-nowrap">{c.ts}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-0.5">
                        <button className="h-6 px-1.5 border border-[#191c1e] bg-white text-[#191c1e] hover:bg-[#191c1e] hover:text-white transition-colors">
                          <Flag size={10} />
                        </button>
                        <button className={`h-6 px-1.5 border text-[9px] font-black italic uppercase transition-colors ${c.status === "final" ? "bg-[#506600] text-[#ccff00] border-[#506600]" : "bg-[#191c1e] text-[#ccff00] border-[#191c1e]"}`}>
                          <ShieldCheck size={10} />
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer totals */}
        <div className="mt-2 flex items-center justify-end gap-6 px-3 py-2 bg-white border border-[#d0d2ca] border-t-2 border-t-[#191c1e]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black italic uppercase text-[#747a60]">Nota Avaliador</span>
            <span className="text-[18px] font-black italic text-[#444933]">7.2</span>
          </div>
          <div className="w-px h-6 bg-[#d0d2ca]" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black italic uppercase text-[#506600]">Nota Calibrada</span>
            <span className="text-[18px] font-black italic text-[#191c1e]">8.5</span>
          </div>
          <div className="w-px h-6 bg-[#d0d2ca]" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black italic uppercase text-[#747a60]">Calibrados</span>
            <span className="text-[12px] font-black italic text-[#191c1e] border border-[#191c1e] px-2 py-0.5">2 / 4</span>
          </div>
        </div>
      </div>
    </div>
  );
}
