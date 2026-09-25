import { useGetPenaltyTypes } from "@workspace/api-client-react";
import type { EntryKind } from "./types";

/**
 * Catálogo de tipos de lançamento (penalidades e méritos) e as consultas por
 * slug usadas na grade e no formulário. Tipos inativos continuam resolvendo
 * rótulo/pontos para os lançamentos antigos.
 */
export function usePenaltyTypes() {
  const { data: penaltyTypes } = useGetPenaltyTypes();

  const activeTypes = (penaltyTypes ?? []).filter(t => t.active);
  const getTypeInfo = (slug: string) => activeTypes.find(t => t.slug === slug) ?? penaltyTypes?.find(t => t.slug === slug);
  const typeLabel = (slug: string) => getTypeInfo(slug)?.label ?? slug;
  const typeKind = (slug: string): EntryKind => (getTypeInfo(slug)?.kind as EntryKind) ?? "penalty";
  const typePoints = (slug: string) => getTypeInfo(slug)?.points ?? 0;
  const typeRequiresEvent = (slug: string) => getTypeInfo(slug)?.requiresEvent ?? false;

  const defaultType = activeTypes[0]?.slug ?? "falta";

  return { activeTypes, typeLabel, typeKind, typePoints, typeRequiresEvent, defaultType };
}

export type PenaltyTypeLookup = ReturnType<typeof usePenaltyTypes>;
