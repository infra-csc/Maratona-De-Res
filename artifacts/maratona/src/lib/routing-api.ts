/**
 * Hooks de raw fetch para o sistema de roteamento de critérios.
 * Segue o mesmo padrão de /my-performance: não usa openapi.yaml/codegen
 * porque são endpoints novos ainda não incluídos no spec.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "./custom-fetch";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface CriterionRouting {
  id?: number;
  criterionId: number;
  defaultEvaluatorId: number | null;
  defaultEvaluatorName: string | null;
  conformityEvaluatorId: number | null;
  conformityEvaluatorName: string | null;
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
  criterionAreaId: number | null;
  assignedToId: number | null;
  assignedToName: string | null;
  status: "pending" | "suggested" | "confirmed" | "submitted";
  redirectedFromId: number | null;
  redirectedFromName: string | null;
  confirmedAt: string | null;
  updatedAt: string | null;
  createdAt: string | null;
}

export interface PrincipalArea {
  id: number;
  name: string;
}

export interface PublicToken {
  id: string;
  recipientName: string | null;
  submitterName: string | null;
  usedAt: string | null;
  createdAt: string | null;
  createdByName: string | null;
  criterionIds?: number[];
  createdByUserId?: number;
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
export const publicTokensKey = (eventId: number) => ["public-tokens", eventId];
export const publicLinkEligibleCriteriaKey = (eventId: number) => ["public-link-eligible-criteria", eventId];

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(url, {
    ...init,
    headers,
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

/** Fetch simples (sem hook) das atribuições de critérios de um evento —
 *  usado em useQueries() para checar vários eventos de uma vez (ex.: a
 *  visão "A Fazer" do avaliador, que precisa saber se um critério foi
 *  redirecionado para outra pessoa antes de listar o evento como pendente). */
export function getEventCriterionAssignments(eventId: number) {
  return apiFetch<CriterionAssignment[]>(`/api/events/${eventId}/criterion-assignments`);
}

/** Atribuições de critérios para um evento. */
export function useEventCriterionAssignments(eventId: number | null) {
  return useQuery<CriterionAssignment[]>({
    queryKey: eventCriterionAssignmentsKey(eventId ?? 0),
    queryFn: () => getEventCriterionAssignments(eventId ?? 0),
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

/** Áreas em que o usuário logado é avaliador principal (default evaluator de algum critério da área). */
export function useMyPrincipalAreas() {
  return useQuery<PrincipalArea[]>({
    queryKey: ["my-principal-areas"],
    queryFn: () => apiFetch<PrincipalArea[]>("/api/users/my-principal-areas"),
  });
}

/** Confirma / reatribui / redireciona / atribui (avaliador principal) uma atribuição. */
export function usePatchCriterionAssignment(eventId: number) {
  const qc = useQueryClient();
  return useMutation<
    CriterionAssignment,
    Error,
    { criterionId: number; assignedToId?: number | null; action?: "confirm" | "redirect" | "assign" }
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

/** Critérios do questionário deste avaliador no evento que podem entrar num link público. */
export function usePublicLinkEligibleCriteria(eventId: number | null) {
  return useQuery<{ criterionId: number; criterionName: string | null }[]>({
    queryKey: publicLinkEligibleCriteriaKey(eventId ?? 0),
    queryFn: () => apiFetch<{ criterionId: number; criterionName: string | null }[]>(
      `/api/events/${eventId}/public-link-eligible-criteria`,
    ),
    enabled: eventId != null,
  });
}

/** Cria um token de avaliação pública cobrindo um formulário/área do avaliador no evento.
 *  Se criterionIds for fornecido, o token cobre apenas esses critérios (intersecção com elegíveis).
 *  Sem criterionIds, cobre todos os critérios elegíveis do avaliador no evento. */
export function useCreatePublicToken(eventId: number) {
  const qc = useQueryClient();
  return useMutation<{ tokenId: string }, Error, { recipientName: string; criterionIds?: number[]; includeConformity?: boolean }>({
    mutationFn: (body) =>
      apiFetch<{ tokenId: string }>(
        `/api/events/${eventId}/public-token`,
        { method: "POST", body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: publicTokensKey(eventId) });
    },
  });
}

/** Lista tokens de avaliação pública (critérios) gerados pelo avaliador logado para o evento. */
export function usePublicTokens(eventId: number | null) {
  return useQuery<PublicToken[]>({
    queryKey: publicTokensKey(eventId ?? 0),
    queryFn: () =>
      apiFetch<PublicToken[]>(
        `/api/events/${eventId}/public-tokens`,
      ),
    enabled: eventId != null,
  });
}

/** Cria um token de avaliação pública para o formulário de conformidade Cenografia. */
export function useCreateConformityPublicToken(eventId: number) {
  const qc = useQueryClient();
  return useMutation<{ tokenId: string }, Error, { recipientName: string }>({
    mutationFn: (body) =>
      apiFetch<{ tokenId: string }>(
        `/api/events/${eventId}/public-token/conformity`,
        { method: "POST", body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conformity-public-tokens", eventId] });
    },
  });
}

/** Cria um token de avaliação pública para o formulário de conformidade Ferramentas. */
export function useCreateFerramentasPublicToken(eventId: number) {
  const qc = useQueryClient();
  return useMutation<{ tokenId: string }, Error, { recipientName: string }>({
    mutationFn: (body) =>
      apiFetch<{ tokenId: string }>(
        `/api/events/${eventId}/public-token/conformity-ferramentas`,
        { method: "POST", body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conformity-ferramentas-public-tokens", eventId] });
    },
  });
}

/** Lista tokens de conformidade Cenografia gerados pelo avaliador logado. */
export function useConformityPublicTokens(eventId: number | null) {
  return useQuery<PublicToken[]>({
    queryKey: ["conformity-public-tokens", eventId ?? 0],
    queryFn: () =>
      apiFetch<PublicToken[]>(`/api/events/${eventId}/public-tokens/conformity`),
    enabled: eventId != null,
  });
}

/** Lista tokens de conformidade Ferramentas gerados pelo avaliador logado. */
export function useFerramentasPublicTokens(eventId: number | null) {
  return useQuery<PublicToken[]>({
    queryKey: ["conformity-ferramentas-public-tokens", eventId ?? 0],
    queryFn: () =>
      apiFetch<PublicToken[]>(`/api/events/${eventId}/public-tokens/conformity-ferramentas`),
    enabled: eventId != null,
  });
}

/** Admin/RH: todos os links públicos gerados para o evento, de qualquer avaliador/formulário. */
export function useAllPublicTokens(eventId: number | null) {
  return useQuery<(PublicToken & { tokenType: "criteria" | "conformity_cenografia" | "conformity_ferramentas" })[]>({
    queryKey: ["all-public-tokens", eventId ?? 0],
    queryFn: () => apiFetch(`/api/events/${eventId}/public-tokens/all`),
    enabled: eventId != null,
  });
}

/** Admin/RH/Diretoria: gera link público para o questionário de um avaliador designado (bypassa allowPublicLink). */
export function useCreateAdminPublicToken(eventId: number) {
  const qc = useQueryClient();
  return useMutation<{ tokenId: string }, Error, { assignedToUserId: number; criterionIds: number[]; recipientName?: string; includeConformity?: boolean }>({
    mutationFn: (data) => apiFetch<{ tokenId: string }>(`/api/events/${eventId}/admin-public-token`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-public-tokens", eventId] });
    },
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
