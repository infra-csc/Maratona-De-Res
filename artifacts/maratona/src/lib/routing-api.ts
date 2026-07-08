/**
 * Hooks de raw fetch para o sistema de roteamento de critérios.
 * Segue o mesmo padrão de /my-performance: não usa openapi.yaml/codegen
 * porque são endpoints novos ainda não incluídos no spec.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface CriterionRouting {
  id?: number;
  criterionId: number;
  defaultEvaluatorId: number | null;
  defaultEvaluatorName: string | null;
  commentRequired: boolean;
  redirectMode: "none" | "area" | "specific";
  redirectAreaId: number | null;
  redirectAreaName: string | null;
  allowPublicLink: boolean;
  redirectUsers?: { id: number; name: string }[];
}

export interface CriterionAssignment {
  id: number;
  eventId: number;
  criterionId: number;
  criterionName: string | null;
  assignedToId: number | null;
  assignedToName: string | null;
  status: "pending" | "suggested" | "confirmed" | "submitted";
  redirectedFromId: number | null;
  redirectedFromName: string | null;
  confirmedAt: string | null;
  updatedAt: string | null;
  createdAt: string | null;
}

export interface PublicToken {
  id: string;
  recipientName: string | null;
  submitterName: string | null;
  usedAt: string | null;
  createdAt: string | null;
  createdByName: string | null;
}

export interface RouteUser {
  id: number;
  name: string;
  role?: string;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const criterionRoutingKey = (criterionId: number) => ["criterion-routing", criterionId];
export const allCriterionRoutingsKey = () => ["criterion-routing-all"];
export const eventCriterionAssignmentsKey = (eventId: number) => ["event-criterion-assignments", eventId];
export const redirectOptionsKey = (eventId: number, criterionId: number) => ["redirect-options", eventId, criterionId];
export const publicTokensKey = (eventId: number, criterionId: number) => ["public-tokens", eventId, criterionId];

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Roteamento de todos os critérios (admin/rh). */
export function useAllCriterionRoutings() {
  return useQuery<CriterionRouting[]>({
    queryKey: allCriterionRoutingsKey(),
    queryFn: () => apiFetch<CriterionRouting[]>("/api/criterion-routing"),
  });
}

/** Roteamento de um critério específico (admin/rh). */
export function useCriterionRouting(criterionId: number | null) {
  return useQuery<CriterionRouting | null>({
    queryKey: criterionRoutingKey(criterionId ?? 0),
    queryFn: () => apiFetch<CriterionRouting | null>(`/api/criteria/${criterionId}/routing`),
    enabled: criterionId != null,
  });
}

/** Salva (PUT) o roteamento de um critério. */
export function useSaveCriterionRouting(criterionId: number) {
  const qc = useQueryClient();
  return useMutation<CriterionRouting, Error, Partial<CriterionRouting> & { redirectUserIds?: number[] }>({
    mutationFn: (data) => apiFetch<CriterionRouting>(`/api/criteria/${criterionId}/routing`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: criterionRoutingKey(criterionId) });
      qc.invalidateQueries({ queryKey: allCriterionRoutingsKey() });
    },
  });
}

/** Atribuições de critérios para um evento. */
export function useEventCriterionAssignments(eventId: number | null) {
  return useQuery<CriterionAssignment[]>({
    queryKey: eventCriterionAssignmentsKey(eventId ?? 0),
    queryFn: () => apiFetch<CriterionAssignment[]>(`/api/events/${eventId}/criterion-assignments`),
    enabled: eventId != null,
  });
}

/** Gera atribuições sugeridas para o evento a partir dos defaults de roteamento. */
export function useGenerateCriterionAssignments(eventId: number) {
  const qc = useQueryClient();
  return useMutation<{ generated: number; skipped: number }, Error, void>({
    mutationFn: () => apiFetch<{ generated: number; skipped: number }>(
      `/api/events/${eventId}/criterion-assignments/generate`,
      { method: "POST" },
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventCriterionAssignmentsKey(eventId) });
    },
  });
}

/** Confirma / reatribui / redireciona uma atribuição. */
export function usePatchCriterionAssignment(eventId: number) {
  const qc = useQueryClient();
  return useMutation<
    CriterionAssignment,
    Error,
    { criterionId: number; assignedToId?: number | null; action?: "confirm" | "redirect" }
  >({
    mutationFn: ({ criterionId, ...body }) =>
      apiFetch<CriterionAssignment>(`/api/events/${eventId}/criterion-assignments/${criterionId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventCriterionAssignmentsKey(eventId) });
    },
  });
}

/** Opções de redirecionamento para um critério (filtradas pelo routing). */
export function useRedirectOptions(eventId: number | null, criterionId: number | null) {
  return useQuery<RouteUser[]>({
    queryKey: redirectOptionsKey(eventId ?? 0, criterionId ?? 0),
    queryFn: () => apiFetch<RouteUser[]>(
      `/api/events/${eventId}/criterion-assignments/redirect-options/${criterionId}`,
    ),
    enabled: eventId != null && criterionId != null,
  });
}

/** Cria um token de avaliação pública para freelancer. */
export function useCreatePublicToken(eventId: number, criterionId: number) {
  const qc = useQueryClient();
  return useMutation<{ tokenId: string }, Error, { recipientName: string }>({
    mutationFn: (body) =>
      apiFetch<{ tokenId: string }>(
        `/api/events/${eventId}/criterion-assignments/${criterionId}/public-token`,
        { method: "POST", body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: publicTokensKey(eventId, criterionId) });
    },
  });
}

/** Lista tokens de avaliação pública para um critério/evento. */
export function usePublicTokens(eventId: number | null, criterionId: number | null) {
  return useQuery<PublicToken[]>({
    queryKey: publicTokensKey(eventId ?? 0, criterionId ?? 0),
    queryFn: () =>
      apiFetch<PublicToken[]>(
        `/api/events/${eventId}/criterion-assignments/${criterionId}/public-tokens`,
      ),
    enabled: eventId != null && criterionId != null,
  });
}

/** Usuários de uma área (para popular pickers). */
export function useUsersByArea(areaId: number | null) {
  return useQuery<RouteUser[]>({
    queryKey: ["users-by-area", areaId ?? 0],
    queryFn: () => apiFetch<RouteUser[]>(`/api/users/by-area/${areaId}`),
    enabled: areaId != null,
  });
}
