// Lista de Eventos no ciclo por ÁREA: a barra de Avaliações conta RESPOSTAS
// POR ÁREA (as cópias dos critérios multiárea uma a uma), a mesma conta da
// Central. O servidor já manda a conta pronta em GET /events (areaResponses:
// critérios ativos do evento; feito = enviado ou publicado) — sem consultas
// extras na tela.
import type { AreaResponseCount } from "./criteria-rules";
import type { EventItem } from "./types";

export function areaCountsOf(ev: EventItem): AreaResponseCount | null {
  return ev.areaResponses ?? null;
}
