// Nota do evento no topo da Calibração: a média das avaliações enviadas e,
// quando há calibração (salva ou digitada), a nota com ela. Mesma conta do
// servidor, antes do desconto da Matriz de Conformidade.
import { fmtNum } from "@/lib/utils";
import { CONDENSED } from "@/lib/premium-theme";

export function EventScoreStrip({ average, calibrated }: { average: number | null; calibrated: number | null }) {
  return (
    <div data-testid="calibration-event-score" className="rounded-xl px-4 py-3 flex flex-wrap items-end gap-x-8 gap-y-2"
      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Nota do evento · média das avaliações</p>
        <p className="font-black text-2xl leading-none mt-1" style={{ fontFamily: CONDENSED }} data-testid="calibration-event-score-average">
          {average != null ? fmtNum(average, 1) : "—"}
        </p>
        {average == null && <p className="text-[11px] mt-1" style={{ color: "var(--muted-foreground)" }}>Sem avaliações enviadas</p>}
      </div>
      {calibrated != null && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Com a calibração</p>
          <p className="font-black text-2xl leading-none mt-1" style={{ fontFamily: CONDENSED }} data-testid="calibration-event-score-calibrated">
            {fmtNum(calibrated, 1)}
          </p>
        </div>
      )}
      <p className="text-[11px] basis-full sm:basis-auto sm:ml-auto" style={{ color: "var(--muted-foreground)" }}>
        Média ponderada pelos pesos; critério de várias áreas entra pela média das áreas. Sem o desconto da Matriz de Conformidade.
      </p>
    </div>
  );
}
