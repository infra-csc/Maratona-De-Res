import type { MyPerformanceEvent } from "@workspace/api-client-react";

// Tipos do contrato (GET /my-performance em lib/api-spec/openapi.yaml).
export type EventSummary = MyPerformanceEvent;

/** Filtro de status do "Histórico de Eventos". */
export type StatusFilter = "all" | "avaliado" | "em_avaliacao";
