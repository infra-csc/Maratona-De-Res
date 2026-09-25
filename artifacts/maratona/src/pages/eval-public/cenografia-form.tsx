import type { Dispatch, SetStateAction } from "react";
import { CONDENSED, DANGER_TEXT } from "@/lib/premium-theme";
import { Card, YesNoToggle } from "./ui";
import type { ConformityAnswers } from "./types";

const items: { key: "epi" | "estaiamentos" | "conduta"; commentKey: "epiComment" | "estaiamentosComment" | "condutaComment"; question: string }[] = [
  { key: "epi", commentKey: "epiComment", question: "Todos usaram EPI na arena?" },
  { key: "estaiamentos", commentKey: "estaiamentosComment", question: "Estaiamento e Aterramento foram feitos de maneira correta?" },
  { key: "conduta", commentKey: "condutaComment", question: "Conduta e comportamento foram adequados?" },
];

/** Matriz de Conformidade de Cenografia: 3 Sim/Não, faltas/atrasos e destaque. */
export function CenografiaForm({ cenoAnswers, setCenoAnswers, cenoStandoutMissing }: {
  cenoAnswers: ConformityAnswers;
  setCenoAnswers: Dispatch<SetStateAction<ConformityAnswers>>;
  cenoStandoutMissing: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="text-[11px] font-bold tracking-[0.18em] uppercase" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>Matriz de Conformidade</span>
        </div>
        {items.map((item, i) => {
          const val = cenoAnswers[item.key];
          const isNao = val === false;
          return (
            <div key={item.key} id={`ceno-${item.key}`} className="px-5 py-4" style={i < items.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm leading-snug flex-1">{item.question}</p>
                <div className="flex items-center gap-2 shrink-0">
                  {isNao && <span className="text-[11px] font-bold uppercase whitespace-nowrap" style={{ fontFamily: CONDENSED, color: DANGER_TEXT }}>-10 pts</span>}
                  <YesNoToggle value={val} onChange={(v) => setCenoAnswers(f => ({ ...f, [item.key]: v }))} />
                </div>
              </div>
              {val !== null && (
                <div className="mt-3 space-y-1">
                  <label className="text-[11px] font-bold tracking-[0.1em] uppercase" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>
                    Comentário {isNao ? <span className="normal-case font-semibold" style={{ color: DANGER_TEXT }}>* obrigatório</span> : <span className="font-normal normal-case">(opcional)</span>}
                  </label>
                  <textarea
                    id={`ceno-${item.key}-comment`}
                    rows={2}
                    placeholder={isNao ? "Descreva o que aconteceu..." : "Alguma observação? (opcional)"}
                    value={cenoAnswers[item.commentKey]}
                    onChange={e => setCenoAnswers(f => ({ ...f, [item.commentKey]: e.target.value }))}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                    style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                  />
                  {isNao && !cenoAnswers[item.commentKey].trim() && (
                    <p className="text-[11px] font-bold" style={{ color: DANGER_TEXT }}>Comentário obrigatório quando a resposta é Não.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </Card>

      <Card className="p-5 space-y-1">
        <label className="block text-sm font-semibold">
          Alguém faltou ou atrasou por mais de 30 minutos? Especifique. <span style={{ color: DANGER_TEXT }}>*</span> obrigatório
        </label>
        <textarea
          id="ceno-absences"
          rows={3}
          placeholder='Ex.: "João Silva — faltou sem aviso." Se ninguém faltou/atrasou, escreva "Ninguém faltou ou atrasou".'
          value={cenoAnswers.absencesReport}
          onChange={e => setCenoAnswers(f => ({ ...f, absencesReport: e.target.value }))}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
          style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
        />
        {!cenoAnswers.absencesReport.trim() && <p className="text-[11px] font-bold" style={{ color: DANGER_TEXT }}>Especifique antes de enviar.</p>}
      </Card>

      <Card className="p-5 space-y-3">
        <label className="block text-sm font-semibold">
          Algum profissional teve um desempenho fora da curva? <span style={{ color: DANGER_TEXT }}>*</span>
        </label>
        <div className="flex gap-2">
          <button type="button"
            onClick={() => setCenoAnswers(f => ({ ...f, standoutResponse: false, standoutJustification: "" }))}
            className="flex-1 px-4 py-2.5 rounded-lg text-xs font-bold uppercase transition-all"
            style={{
              fontFamily: CONDENSED,
              backgroundColor: cenoAnswers.standoutResponse === false ? "var(--primary)" : "transparent",
              color: cenoAnswers.standoutResponse === false ? "var(--primary-foreground)" : "var(--muted-foreground)",
              border: cenoAnswers.standoutResponse === false ? "1px solid var(--primary)" : "1px solid var(--border)",
            }}
          >Não, dentro do padrão esperado</button>
          <button type="button"
            onClick={() => setCenoAnswers(f => ({ ...f, standoutResponse: true }))}
            className="flex-1 px-4 py-2.5 rounded-lg text-xs font-bold uppercase transition-all"
            style={{
              fontFamily: CONDENSED,
              backgroundColor: cenoAnswers.standoutResponse === true ? "var(--accent)" : "transparent",
              color: cenoAnswers.standoutResponse === true ? "var(--accent-foreground)" : "var(--muted-foreground)",
              border: cenoAnswers.standoutResponse === true ? "1px solid var(--accent)" : "1px solid var(--border)",
            }}
          >Sim, houve um grande destaque</button>
        </div>
        {cenoAnswers.standoutResponse === true && (
          <div className="space-y-1">
            <label className="text-[11px] font-bold tracking-[0.1em] uppercase" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>Detalhe o destaque <span>*</span> obrigatório</label>
            <textarea
              id="ceno-standout-justification"
              rows={2}
              placeholder="Nome do profissional e por que se destacou..."
              value={cenoAnswers.standoutJustification}
              onChange={e => setCenoAnswers(f => ({ ...f, standoutJustification: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
              style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
            />
            {cenoStandoutMissing && <p className="text-[11px] font-bold" style={{ color: DANGER_TEXT }}>Descreva o destaque antes de enviar.</p>}
          </div>
        )}
      </Card>
    </div>
  );
}
