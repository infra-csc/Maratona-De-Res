/**
 * Hooks do sistema de roteamento de critérios, atribuições por evento e links
 * públicos de avaliação.
 *
 * Todos os endpoints estão no contrato (lib/api-spec/openapi.yaml) e as
 * chamadas passam pelas funções geradas do @workspace/api-client-react — este
 * arquivo só mantém a API estável que as telas já usam (nomes, assinaturas,
 * chaves de cache e mensagens de erro em pt-BR vindas do servidor).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMyPrincipalAreas,
  getGetMyPrincipalAreasQueryKey,
  getAllCriterionRoutings,
  getGetAllCriterionRoutingsQueryKey,
  getCriterionRouting,
  getGetCriterionRoutingQueryKey,
  saveCriterionRouting,
  getEventCriterionAssignments as fetchEventCriterionAssignments,
  getGetEventCriterionAssignmentsQueryKey,
  generateCriterionAssignments,
  updateCriterionAssignment,
  getCriterionRedirectOptions,
  getGetCriterionRedirectOptionsQueryKey,
  getPublicLinkEligibleCriteria,
  getGetPublicLinkEligibleCriteriaQueryKey,
  createPublicToken,
  createAdminPublicToken,
  getPublicTokens,
  getGetPublicTokensQueryKey,
  createConformityPublicToken,
  createFerramentasPublicToken,
  getConformityPublicTokens,
  getGetConformityPublicTokensQueryKey,
  getFerramentasPublicTokens,
  getGetFerramentasPublicTokensQueryKey,
  getAllPublicTokens,
  getGetAllPublicTokensQueryKey,
  deletePublicEvalToken,
  getUsersByArea,
  getGetUsersByAreaQueryKey,
  type CriterionRouting as GeneratedCriterionRouting,
  type CriterionRoutingInput,
  type CriterionRoutingRow,
  type EventCriterionAssignment,
  type EventCriterionAssignmentRow,
  type CriterionAssignmentUpdate,
  type GenerateAssignmentsResult,
  type PrincipalArea as GeneratedPrincipalArea,
  type PublicToken as GeneratedPublicToken,
  type AdminPublicToken as GeneratedAdminPublicToken,
  type PublicTokenType as GeneratedPublicTokenType,
  type PublicTokenCreated,
  type PublicTokenInput,
  type AdminPublicTokenInput,
  type ConformityPublicTokenInput,
  type PublicLinkEligibleCriterion,
  type OkResponse,
} from "@workspace/api-client-react";
import { withServerMessage } from "./calibration-api";

// ---------------------------------------------------------------------------
// Tipos (aliases dos tipos gerados a partir do openapi.yaml)
// ---------------------------------------------------------------------------

export type CriterionRouting = GeneratedCriterionRouting;
/** Linha de atribuição (inclui as linhas "virtuais" do avaliador principal, com id null). */
export type CriterionAssignment = EventCriterionAssignment;
export type PrincipalArea = GeneratedPrincipalArea;
/** Nas listas de conformidade o servidor não manda `createdByName`. */
export type PublicToken = GeneratedPublicToken;
export type RouteUser = { id: number; name: string; role?: string };
export type PublicTokenType = GeneratedPublicTokenType;
export type AdminPublicToken = GeneratedAdminPublicToken;

type AssignmentAction = NonNullable<CriterionAssignmentUpdate["action"]>;

// ---------------------------------------------------------------------------
// Query keys — são as chaves geradas, para que invalidações feitas aqui ou
// pelos hooks gerados atinjam a mesma entrada de cache.
// ---------------------------------------------------------------------------

// Aceitam `null` quando ainda não há evento/critério selecionado (query
// desabilitada): a chave vira ".../null/...", nunca colide com um id real.
export const criterionRoutingKey = (criterionId: number | null) => getGetCriterionRoutingQueryKey(criterionId as number);
export const allCriterionRoutingsKey = () => getGetAllCriterionRoutingsQueryKey();
export const eventCriterionAssignmentsKey = (eventId: number | null) => getGetEventCriterionAssignmentsQueryKey(eventId as number);
export const redirectOptionsKey = (eventId: number | null, criterionId: number | null) =>
  getGetCriterionRedirectOptionsQueryKey(eventId as number, criterionId as number);
export const publicTokensKey = (eventId: number | null) => getGetPublicTokensQueryKey(eventId as number);
export const publicLinkEligibleCriteriaKey = (eventId: number | null) => getGetPublicLinkEligibleCriteriaQueryKey(eventId as number);
export const allPublicTokensKey = (eventId: number | null) => getGetAllPublicTokensQueryKey(eventId as number);
export const conformityPublicTokensKey = (eventId: number | null) => getGetConformityPublicTokensQueryKey(eventId as number);
export const ferramentasPublicTokensKey = (eventId: number | null) => getGetFerramentasPublicTokensQueryKey(eventId as number);
export const usersByAreaKey = (areaId: number | null) => getGetUsersByAreaQueryKey(areaId as number);

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Roteamento de todos os critérios (admin/rh). */
export function useAllCriterionRoutings() {
  return useQuery<CriterionRouting[]>({
    queryKey: allCriterionRoutingsKey(),
    queryFn: ({ signal }) => withServerMessage(getAllCriterionRoutings({ signal })),
  });
}

/** Roteamento de um critério específico (admin/rh). */
export function useCriterionRouting(criterionId: number | null) {
  return useQuery<CriterionRouting | null>({
    queryKey: criterionRoutingKey(criterionId),
    queryFn: ({ signal }) => withServerMessage(getCriterionRouting(criterionId as number, { signal })),
    enabled: !!criterionId,
  });
}

/** Salva (PUT) o roteamento de um critério. Devolve a linha gravada. */
export function useSaveCriterionRouting(criterionId: number) {
  const qc = useQueryClient();
  return useMutation<CriterionRoutingRow, Error, CriterionRoutingInput>({
    mutationFn: (data) => withServerMessage(saveCriterionRouting(criterionId, data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: criterionRoutingKey(criterionId) });
      qc.invalidateQueries({ queryKey: allCriterionRoutingsKey() });
    },
  });
}

/** Busca simples (sem hook) das atribuições de critérios de um evento —
 *  usado em useQueries() para checar vários eventos de uma vez (ex.: a
 *  visão "A Fazer" do avaliador, que precisa saber se um critério foi
 *  redirecionado para outra pessoa antes de listar o evento como pendente). */
export function getEventCriterionAssignments(eventId: number): Promise<CriterionAssignment[]> {
  return withServerMessage(fetchEventCriterionAssignments(eventId));
}

/** Atribuições de critérios para um evento. */
export function useEventCriterionAssignments(eventId: number | null) {
  return useQuery<CriterionAssignment[]>({
    queryKey: eventCriterionAssignmentsKey(eventId),
    queryFn: () => getEventCriterionAssignments(eventId as number),
    enabled: !!eventId,
  });
}

/** PATCH (sem hook) de uma atribuição — usado em laços sequenciais
 *  (atribuição em lote) onde a tela invalida o cache UMA vez ao final,
 *  em vez de uma invalidação por critério. Devolve a linha gravada. */
export function patchCriterionAssignment(
  eventId: number,
  { criterionId, ...body }: { criterionId: number; assignedToId?: number | null; action?: AssignmentAction },
): Promise<EventCriterionAssignmentRow> {
  return withServerMessage(updateCriterionAssignment(eventId, criterionId, body));
}

/** Gera atribuições sugeridas para o evento a partir dos defaults de roteamento. */
export function useGenerateCriterionAssignments(eventId: number) {
  const qc = useQueryClient();
  return useMutation<GenerateAssignmentsResult, Error, void>({
    mutationFn: () => withServerMessage(generateCriterionAssignments(eventId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventCriterionAssignmentsKey(eventId) });
    },
  });
}

/** Áreas em que o usuário logado é avaliador principal (default evaluator de algum critério da área). */
export function useMyPrincipalAreas() {
  return useQuery<PrincipalArea[]>({
    queryKey: getGetMyPrincipalAreasQueryKey(),
    queryFn: ({ signal }) => withServerMessage(getMyPrincipalAreas({ signal })),
  });
}

/** Confirma / reatribui / redireciona / atribui (avaliador principal) uma atribuição. */
export function usePatchCriterionAssignment(eventId: number) {
  const qc = useQueryClient();
  return useMutation<
    EventCriterionAssignmentRow,
    Error,
    { criterionId: number; assignedToId?: number | null; action?: AssignmentAction }
  >({
    mutationFn: (vars) => patchCriterionAssignment(eventId, vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventCriterionAssignmentsKey(eventId) });
    },
  });
}

/** Opções de redirecionamento para um critério (filtradas pelo routing). */
export function useRedirectOptions(eventId: number | null, criterionId: number | null) {
  return useQuery<RouteUser[]>({
    queryKey: redirectOptionsKey(eventId, criterionId),
    queryFn: ({ signal }) => withServerMessage(getCriterionRedirectOptions(eventId as number, criterionId as number, { signal })),
    enabled: !!eventId && !!criterionId,
  });
}

/** Critérios do questionário deste avaliador no evento que podem entrar num link público. */
export function usePublicLinkEligibleCriteria(eventId: number | null) {
  return useQuery<PublicLinkEligibleCriterion[]>({
    queryKey: publicLinkEligibleCriteriaKey(eventId),
    queryFn: ({ signal }) => withServerMessage(getPublicLinkEligibleCriteria(eventId as number, { signal })),
    enabled: !!eventId,
  });
}

/** Cria um token de avaliação pública cobrindo um formulário/área do avaliador no evento.
 *  Se criterionIds for fornecido, o token cobre apenas esses critérios (intersecção com elegíveis).
 *  Sem criterionIds, cobre todos os critérios elegíveis do avaliador no evento. */
export function useCreatePublicToken(eventId: number) {
  const qc = useQueryClient();
  return useMutation<PublicTokenCreated, Error, PublicTokenInput>({
    mutationFn: (body) => withServerMessage(createPublicToken(eventId, body)),
    onSuccess: () => {
      // A lista do avaliador e a lista global (admin) mostram o mesmo token —
      // as duas precisam ser invalidadas, senão uma delas fica defasada.
      qc.invalidateQueries({ queryKey: publicTokensKey(eventId) });
      qc.invalidateQueries({ queryKey: allPublicTokensKey(eventId) });
    },
  });
}

/** Lista tokens de avaliação pública (critérios) gerados pelo avaliador logado para o evento. */
export function usePublicTokens(eventId: number | null) {
  return useQuery<PublicToken[]>({
    queryKey: publicTokensKey(eventId),
    queryFn: ({ signal }) => withServerMessage(getPublicTokens(eventId as number, { signal })),
    enabled: !!eventId,
  });
}

/** Cria um token de avaliação pública para o formulário de conformidade Cenografia. */
export function useCreateConformityPublicToken(eventId: number) {
  const qc = useQueryClient();
  return useMutation<PublicTokenCreated, Error, ConformityPublicTokenInput>({
    mutationFn: (body) => withServerMessage(createConformityPublicToken(eventId, body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: conformityPublicTokensKey(eventId) });
      qc.invalidateQueries({ queryKey: allPublicTokensKey(eventId) });
    },
  });
}

/** Cria um token de avaliação pública para o formulário de conformidade Ferramentas. */
export function useCreateFerramentasPublicToken(eventId: number) {
  const qc = useQueryClient();
  return useMutation<PublicTokenCreated, Error, ConformityPublicTokenInput>({
    mutationFn: (body) => withServerMessage(createFerramentasPublicToken(eventId, body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ferramentasPublicTokensKey(eventId) });
      qc.invalidateQueries({ queryKey: allPublicTokensKey(eventId) });
    },
  });
}

/** Lista tokens de conformidade Cenografia gerados pelo avaliador logado. */
export function useConformityPublicTokens(eventId: number | null) {
  return useQuery<PublicToken[]>({
    queryKey: conformityPublicTokensKey(eventId),
    queryFn: ({ signal }) => withServerMessage(getConformityPublicTokens(eventId as number, { signal })),
    enabled: !!eventId,
  });
}

/** Lista tokens de conformidade Ferramentas gerados pelo avaliador logado. */
export function useFerramentasPublicTokens(eventId: number | null) {
  return useQuery<PublicToken[]>({
    queryKey: ferramentasPublicTokensKey(eventId),
    queryFn: ({ signal }) => withServerMessage(getFerramentasPublicTokens(eventId as number, { signal })),
    enabled: !!eventId,
  });
}

/** Admin/RH: todos os links públicos gerados para o evento, de qualquer avaliador/formulário. */
export function useAllPublicTokens(eventId: number | null) {
  return useQuery<AdminPublicToken[]>({
    queryKey: allPublicTokensKey(eventId),
    queryFn: ({ signal }) => withServerMessage(getAllPublicTokens(eventId as number, { signal })),
    enabled: !!eventId,
  });
}

/** Admin/RH/Diretoria: gera link público para o questionário de um avaliador designado (bypassa allowPublicLink). */
export function useCreateAdminPublicToken(eventId: number) {
  const qc = useQueryClient();
  return useMutation<PublicTokenCreated, Error, AdminPublicTokenInput>({
    mutationFn: (data) => withServerMessage(createAdminPublicToken(eventId, data)),
    onSuccess: () => {
      // O token admin também aparece na lista "meus links" do avaliador
      // designado (createdByUserId = assignedToUserId) — invalida as duas.
      qc.invalidateQueries({ queryKey: allPublicTokensKey(eventId) });
      qc.invalidateQueries({ queryKey: publicTokensKey(eventId) });
    },
  });
}

/** Exclui um token pendente (não usado). Só funciona se usedAt for null. */
export function useDeletePublicToken(eventId: number) {
  const qc = useQueryClient();
  return useMutation<OkResponse, Error, { tokenId: string }>({
    mutationFn: ({ tokenId }) => withServerMessage(deletePublicEvalToken(tokenId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: publicTokensKey(eventId) });
      qc.invalidateQueries({ queryKey: conformityPublicTokensKey(eventId) });
      qc.invalidateQueries({ queryKey: ferramentasPublicTokensKey(eventId) });
      qc.invalidateQueries({ queryKey: allPublicTokensKey(eventId) });
    },
  });
}

/** Usuários de uma área (para popular pickers). */
export function useUsersByArea(areaId: number | null) {
  return useQuery<RouteUser[]>({
    queryKey: usersByAreaKey(areaId),
    queryFn: ({ signal }) => withServerMessage(getUsersByArea(areaId as number, { signal })),
    enabled: !!areaId,
  });
}
