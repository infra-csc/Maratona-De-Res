// Helpers puros da página de Detalhe do Evento: parse das observações
// importadas, casamento de critério por nome, cargos de participante,
// itens da Matriz de Conformidade e estilos compartilhados.
import type React from "react";
import { fmtNum } from "@/lib/utils";
import type {
  ConformityItem,
  CriterionJustification,
  Evaluation,
  ImportedConformityRatio,
  ImportedCriterionScore,
} from "./types";

export const fieldStyle: React.CSSProperties = { backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" };

/** Nota com 1 casa decimal (vírgula), como no restante da página. */
export const fmt = (v: number) => `${fmtNum(v, 1)}`;

export function parseImportedConformityRatio(notes: string): ImportedConformityRatio | null {
  const m = notes.match(/Conformidade:\s*(\d+)\s*\/\s*(\d+)\s*itens/i);
  if (!m) return null;
  return { sim: parseInt(m[1], 10), total: parseInt(m[2], 10) };
}

export function parseImportedCriteriaScores(notes: string): ImportedCriterionScore[] {
  const marker = notes.match(/Performance\s*\(peso\/nota\):\s*([\s\S]*?)(?:\.\s*Performance\s*=|\.\s*Pontua[çc][ãa]o|$)/i);
  const segment = marker ? marker[1] : "";
  if (!segment) return [];
  return segment
    .split(";")
    .map(s => s.trim())
    .filter(Boolean)
    .map(entry => {
      const m = entry.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*(?:-\s*(.*))?$/);
      if (!m) return null;
      // Formato das notas importadas: "<nome> <peso>/<nota>" — m[2]=peso, m[3]=nota
      const peso = parseFloat(m[2].replace(",", "."));
      const nota = parseFloat(m[3].replace(",", "."));
      return { rawName: m[1].trim(), score: nota, scale: 10, excluded: peso === 0, comment: m[4]?.trim() || undefined };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

function normalizeForMatch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const MATCH_STOP_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "ou", "no", "na", "em", "a", "o", "as", "os"]);

function significantWords(norm: string): string[] {
  return norm.split(/\s+/).filter(w => w.length >= 3 && !MATCH_STOP_WORDS.has(w));
}

export function matchCriterionByName(rawName: string, criteria: { criterionId: number; criterionName: string }[]): number | null {
  const norm = normalizeForMatch(rawName);
  if (!norm) return null;

  // 1. Exact match
  for (const c of criteria) {
    if (normalizeForMatch(c.criterionName) === norm) return c.criterionId;
  }

  // 2. Substring / prefix match
  let substringBest: { id: number; score: number } | null = null;
  for (const c of criteria) {
    const cn = normalizeForMatch(c.criterionName);
    if (cn.includes(norm) || norm.includes(cn)) {
      const score = Math.min(cn.length, norm.length);
      if (!substringBest || score > substringBest.score) substringBest = { id: c.criterionId, score };
    }
  }
  if (substringBest) return substringBest.id;

  // 3. Word-overlap fallback — counts significant shared words
  const rawWords = significantWords(norm);
  if (rawWords.length === 0) return null;
  let overlapBest: { id: number; score: number } | null = null;
  for (const c of criteria) {
    const cnWords = significantWords(normalizeForMatch(c.criterionName));
    const overlap = rawWords.filter(w => cnWords.includes(w)).length;
    if (overlap > 0) {
      const score = overlap / Math.max(rawWords.length, cnWords.length);
      if (!overlapBest || score > overlapBest.score) overlapBest = { id: c.criterionId, score };
    }
  }
  return overlapBest?.id ?? null;
}

/** Justificativas (avaliações enviadas) de um critério, na ordem recebida da API. */
export function justificationsFor(evaluations: Evaluation[] | undefined, critId: number): CriterionJustification[] {
  return (evaluations ?? [])
    .filter(e => e.criterionId === critId && e.status === "submitted")
    .map(e => ({ name: e.evaluatorName ?? "Avaliador", score: Number(e.score), comment: (e.comments ?? "").trim(), audioUrl: e.audioUrl ?? null }));
}

// Funções comuns pré-definidas para o seletor de participante.
export const PARTICIPANT_FUNCTIONS = [
  "Cenotécnica",
  "Cenotécnica Local",
  "Cenotécnico",
  "Sup Ceno",
  "Sup Ceno Local",
  "Colaborador",
] as const;
export const DEFAULT_FUNCTION = "Cenotécnica";

/**
 * Retorna a opção pré-definida que melhor corresponde ao functionName do
 * colaborador. Cargo gravado que não está na lista (ex.: "Motorista") é
 * mantido como opção própria no select — antes caía em "Cenotécnica" e
 * qualquer troca gravava o cargo errado.
 */
export function matchParticipantFunction(fn?: string | null): string {
  if (!fn) return DEFAULT_FUNCTION;
  const norm = fn.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const exact = PARTICIPANT_FUNCTIONS.find(
    o => o.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === norm
  );
  if (exact) return exact;
  const prefix = PARTICIPANT_FUNCTIONS.find(
    o => norm.startsWith(o.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())
  );
  return prefix ?? fn.trim();
}

/** Opções do select: as padrão + o cargo atual quando ele não está na lista. */
export function functionOptionsFor(fn?: string | null): string[] {
  const current = matchParticipantFunction(fn);
  return (PARTICIPANT_FUNCTIONS as readonly string[]).includes(current) ? [...PARTICIPANT_FUNCTIONS] : [current, ...PARTICIPANT_FUNCTIONS];
}

// Itens da Matriz de Conformidade (antes recriados a cada render dentro da
// página; o conteúdo é constante, então vive aqui).
export const CONFORMITY_ITEMS: ConformityItem[] = [
  { key: "epi", label: "Uso de EPI", commentKey: "epiComment", group: "cenografia" },
  { key: "estaiamentos", label: "Estaiamentos / Aterramentos", commentKey: "estaiamentosComment", group: "cenografia" },
  { key: "guardaEquipamentos", label: "Guarda de Equipamentos", commentKey: "guardaEquipamentosComment", group: "ferramentas" },
  { key: "conduta", label: "Conduta", commentKey: "condutaComment", group: "cenografia" },
];
