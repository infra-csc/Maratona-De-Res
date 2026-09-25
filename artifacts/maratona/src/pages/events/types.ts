// Tipos compartilhados pela tela "Eventos do Ciclo" (events.tsx e seus módulos).
import type { Event } from "@workspace/api-client-react";

/** Um evento como vem de GET /events. */
export type EventItem = Event;

/** Referência mínima a um evento (mesclar / excluir). */
export type EventRef = { id: number; name: string };

/** Evento em edição no diálogo "Editar Evento". */
export type EditingEvent = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  clientName?: string | null;
  city?: string | null;
  state?: string | null;
  location?: string | null;
};

/** Valores do formulário de edição. */
export type EditEventInput = { name: string; startDate: string; endDate: string; clientName?: string; city?: string; state?: string; location?: string };

/** Contagens devolvidas pelo servidor quando o duplicado já tem dado gravado. */
export type MergeConflict = { evaluations: number; calibrations: number; conformities: number; results: number };

/** Item da lista congelada do diálogo de confirmação em lote. */
export type BulkConfirmItem = { id: number; name: string; startDate: string };
