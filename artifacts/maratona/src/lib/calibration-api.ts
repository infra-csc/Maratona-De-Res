/**
 * Hooks de raw fetch para comentários e logs de auditoria de calibração.
 * Não usa openapi.yaml/codegen — endpoints adicionados diretamente.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "./custom-fetch";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface CalibrationComment {
  id: number;
  eventId: number;
  criterionId: number;
  text: string;
  createdByUserId: number;
  createdByName: string | null;
  createdAt: string;
}

export interface CalibrationAuditEntry {
  id: number;
  userId: number | null;
  userName: string | null;
  action: string;
  criterionId: number | null;
  criterionName: string | null;
  beforeJson: string | null;
  afterJson: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const calibrationCommentsKey = (eventId: number) =>
  ["calibration-comments", eventId] as const;
export const calibrationAuditKey = (eventId: number) =>
  ["calibration-audit", eventId] as const;

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useCalibrationComments(eventId: number | null) {
  return useQuery<CalibrationComment[]>({
    queryKey: calibrationCommentsKey(eventId ?? 0),
    queryFn: () => apiFetch<CalibrationComment[]>(`/api/calibrations/comments?eventId=${eventId}`),
    enabled: !!eventId,
  });
}

export function useAddCalibrationComment(eventId: number) {
  const qc = useQueryClient();
  return useMutation<CalibrationComment, Error, { criterionId: number; text: string }>({
    mutationFn: (body) =>
      apiFetch<CalibrationComment>("/api/calibrations/comments", {
        method: "POST",
        body: JSON.stringify({ eventId, ...body }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calibrationCommentsKey(eventId) });
    },
  });
}

export function useDeleteCalibrationComment(eventId: number) {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (id) =>
      apiFetch<void>(`/api/calibrations/comments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calibrationCommentsKey(eventId) });
    },
  });
}

export function useCalibrationAudit(eventId: number | null) {
  return useQuery<CalibrationAuditEntry[]>({
    queryKey: calibrationAuditKey(eventId ?? 0),
    queryFn: () => apiFetch<CalibrationAuditEntry[]>(`/api/calibrations/audit?eventId=${eventId}`),
    enabled: !!eventId,
  });
}
