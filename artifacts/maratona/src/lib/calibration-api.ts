/**
 * Hooks de comentários e da trilha de auditoria de calibração.
 *
 * Os endpoints estão no contrato (lib/api-spec/openapi.yaml); as chamadas
 * passam pelas funções geradas do @workspace/api-client-react. Este arquivo
 * mantém os nomes/assinaturas que a tela de Calibração já usa.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  getCalibrationComments,
  getGetCalibrationCommentsQueryKey,
  createCalibrationComment,
  deleteCalibrationComment,
  getCalibrationAudit,
  getGetCalibrationAuditQueryKey,
  type CalibrationComment as GeneratedCalibrationComment,
  type CalibrationAuditEntry as GeneratedCalibrationAuditEntry,
} from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Tipos (aliases dos tipos gerados a partir do openapi.yaml)
// ---------------------------------------------------------------------------

export type CalibrationComment = GeneratedCalibrationComment;
export type CalibrationAuditEntry = GeneratedCalibrationAuditEntry;

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

/**
 * Erro HTTP com `status` e a mensagem em pt-BR que o servidor mandou em
 * `{ error }` — para que a tela possa distinguir 401/403 (sessão expirada) de
 * falhas comuns e mostrar o texto do servidor sem o prefixo "HTTP 400 ...".
 */
export class ApiRequestError extends Error {
  override readonly name = "ApiRequestError";
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.status = status;
  }
}

/**
 * Converte o `ApiError` do cliente gerado em `ApiRequestError` com a mensagem
 * do servidor. Em 401 avisa o AuthProvider (sessão expirada), como antes.
 */
export async function withServerMessage<T>(request: Promise<T>): Promise<T> {
  try {
    return await request;
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 401) window.dispatchEvent(new CustomEvent("auth:unauthorized"));
      const data = e.data as { error?: unknown } | null;
      const message = typeof data?.error === "string" && data.error.trim() ? data.error : `HTTP ${e.status}`;
      throw new ApiRequestError(e.status, message);
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Query keys (as chaves geradas)
// ---------------------------------------------------------------------------

export const calibrationCommentsKey = (eventId: number) => getGetCalibrationCommentsQueryKey({ eventId });
export const calibrationAuditKey = (eventId: number) => getGetCalibrationAuditQueryKey({ eventId });

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useCalibrationComments(eventId: number | null) {
  return useQuery<CalibrationComment[]>({
    queryKey: calibrationCommentsKey(eventId ?? 0),
    queryFn: ({ signal }) => withServerMessage(getCalibrationComments({ eventId: eventId as number }, { signal })),
    enabled: !!eventId,
  });
}

export function useAddCalibrationComment(eventId: number) {
  const qc = useQueryClient();
  return useMutation<CalibrationComment, Error, { criterionId: number; text: string }>({
    mutationFn: (body) => withServerMessage(createCalibrationComment({ eventId, ...body })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calibrationCommentsKey(eventId) });
    },
  });
}

export function useDeleteCalibrationComment(eventId: number) {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (id) => withServerMessage(deleteCalibrationComment(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calibrationCommentsKey(eventId) });
    },
  });
}

export function useCalibrationAudit(eventId: number | null) {
  return useQuery<CalibrationAuditEntry[]>({
    queryKey: calibrationAuditKey(eventId ?? 0),
    queryFn: ({ signal }) => withServerMessage(getCalibrationAudit({ eventId: eventId as number }, { signal })),
    enabled: !!eventId,
  });
}
