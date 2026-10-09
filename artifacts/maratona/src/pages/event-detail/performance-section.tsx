// Performance Individual (Equipe): score equivalente e elegibilidade de cada
// participante no evento.
import { BarChart3, CheckCircle2, XCircle } from "lucide-react";
import { fmt } from "./helpers";
import { Avatar, Chip, Eyebrow, Section } from "./detail-ui";
import type { EventTeamParticipant } from "./types";

export function PerformanceSection({ participants }: { participants: EventTeamParticipant[] }) {
  return (
    <Section id="event-performance" title="Performance individual" icon={BarChart3} count={participants.length}
      description="Score equivalente de cada participante neste evento e se ele conta para a elegibilidade.">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="px-4 sm:px-5 py-2.5"><Eyebrow as="span">Colaborador</Eyebrow></th>
              <th scope="col" className="px-4 sm:px-5 py-2.5 text-right"><Eyebrow as="span">Score equivalente</Eyebrow></th>
              <th scope="col" className="px-4 sm:px-5 py-2.5 text-right"><Eyebrow as="span">Elegibilidade</Eyebrow></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {participants.map(p => (
              <tr key={p.employeeId} data-testid={`row-event-result-${p.employeeId}`} className="transition-colors hover:bg-secondary/35">
                <td className="px-4 sm:px-5 py-3">
                  <span className="flex items-center gap-3 min-w-0">
                    <Avatar name={p.employeeName} className="w-8 h-8 text-[12px]" />
                    <span className="font-condensed text-[16px] font-bold uppercase leading-tight text-foreground">{p.employeeName}</span>
                  </span>
                </td>
                <td className="px-4 sm:px-5 py-3 text-right">
                  <span className="font-condensed text-[22px] font-black tabular-nums leading-none text-foreground">{fmt(p.eventScore)}</span>
                </td>
                <td className="px-4 sm:px-5 py-3 text-right">
                  {p.eligible === false
                    ? <Chip tone="danger" icon={XCircle}>Inativo/Inelegível</Chip>
                    : <Chip tone="ok" icon={CheckCircle2}>Elegível</Chip>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
