import type { Event } from "@workspace/api-client-react";
import { Users, Calendar, MapPin, Rocket } from "lucide-react";
import { fmtDate } from "@/lib/utils";
import { CONDENSED } from "@/lib/premium-theme";

// Estado vazio: nenhum evento selecionado na sidebar.
export function NoEventSelected() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-8">
      <div className="border border-border rounded-xl bg-card p-10 max-w-sm w-full flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-xl bg-primary flex items-center justify-center">
          <Rocket className="text-primary-foreground" size={36} />
        </div>
        <div>
          <h2 className="text-2xl uppercase font-black tracking-tight text-foreground leading-tight" style={{ fontFamily: CONDENSED }}>
            Pronto para avaliar
          </h2>
          <p className="text-muted-foreground text-sm mt-1.5 leading-relaxed">
            Selecione um evento ao lado para iniciar ou continuar sua avaliação.
          </p>
        </div>
      </div>
    </div>
  );
}

// Faixa compacta com nome, cliente, local, datas e participantes do evento.
export function EventHeaderStrip({ currentEvent }: { currentEvent: Event }) {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Faixa de título do evento */}
      <div className="bg-card px-5 py-3 flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-black uppercase tracking-tight text-foreground leading-tight" style={{ fontFamily: CONDENSED }}>{currentEvent.name}</h2>
            {currentEvent.cycleName && (
              <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded border border-border text-muted-foreground bg-secondary">{currentEvent.cycleName}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
            {currentEvent.clientName && <span className="text-foreground font-bold">{currentEvent.clientName}</span>}
            {(currentEvent.city || currentEvent.location) && (
              <span className="flex items-center gap-1"><MapPin size={9} />{currentEvent.city ? `${currentEvent.city}${currentEvent.state ? `, ${currentEvent.state}` : ""}` : currentEvent.location}</span>
            )}
            <span className="flex items-center gap-1"><Calendar size={9} />{fmtDate(currentEvent.startDate, { day: "2-digit", month: "2-digit", year: "numeric" })} — {fmtDate(currentEvent.endDate, { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] font-black uppercase px-2.5 py-1 rounded bg-accent text-accent-foreground">Aberto</span>
          <span className="text-[11px] font-black text-muted-foreground flex items-center gap-1"><Users size={11} />{currentEvent.participantCount} part.</span>
        </div>
      </div>
    </div>
  );
}
