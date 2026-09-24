import type { EventConformity, EventCriterion } from "@workspace/api-client-react";
import type { AreaGroup, ConformityEvalForm } from "./types";

// Agrupa os critérios do avaliador por área responsável (ordem de aparição);
// critérios sem área caem no grupo -1 "Sem área definida".
export function groupCriteriaByArea(criteria: EventCriterion[]): AreaGroup[] {
  const map = new Map<number, AreaGroup>();
  for (const c of criteria) {
    const key = c.responsibleAreaId ?? -1;
    const existing = map.get(key);
    if (existing) {
      existing.criteria.push(c);
    } else {
      map.set(key, { areaId: key, areaName: c.responsibleAreaName ?? "Sem área definida", criteria: [c] });
    }
  }
  return Array.from(map.values());
}

// Uma vez que um link foi enviado para um freelancer preencher um formulário
// de conformidade, o avaliador titular deixa de ver o formulário interativo
// (evita sobrescrever a resposta do freelancer) e passa a ver só este
// histórico de envios — respondido ou não, e quando.
export function fmtDT(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

// Base das URLs públicas (/eval/:tokenId) — origem + BASE_URL sem barra final.
export function publicEvalBaseUrl(): string {
  return window.location.origin + (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
}

// Sempre um objeto novo (nunca uma constante compartilhada) para o setState
// continuar disparando render como antes.
export function emptyConformityForm(): ConformityEvalForm {
  return {
    epi: null, estaiamentos: null, guardaEquipamentos: null, conduta: null,
    epiComment: '', estaiamentosComment: '', guardaEquipamentosComment: '', condutaComment: '',
    absencesResponse: null, absencesReport: '', standoutResponse: null, standoutJustification: '',
  };
}

export function conformityFormFromData(data: EventConformity): ConformityEvalForm {
  return {
    epi: data.epi ?? null,
    estaiamentos: data.estaiamentos ?? null,
    guardaEquipamentos: data.guardaEquipamentos ?? null,
    conduta: data.conduta ?? null,
    epiComment: data.epiComment ?? '',
    estaiamentosComment: data.estaiamentosComment ?? '',
    guardaEquipamentosComment: data.guardaEquipamentosComment ?? '',
    condutaComment: data.condutaComment ?? '',
    absencesResponse: data.absencesResponse ?? null,
    absencesReport: data.absencesReport ?? '',
    standoutResponse: data.standoutResponse ?? null,
    standoutJustification: data.standoutJustification ?? '',
  };
}
