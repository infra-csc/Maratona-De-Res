// Quadro do ciclo com avaliação POR ÁREA (Central → Atribuição e Tabela).
// Antes era uma lista de um cartão por critério — com os critérios multiárea
// (3 × 6 áreas + 2 da Logística) virava 20 cartões e ficava difícil ver quem
// avaliou. Agora: um cartão compacto por ÁREA com os critérios dela como
// linhas curtas ("✓ Nome · dd/mm hh:mm", "via link: Freela", "Pendente") e um
// botão "Link" por área; ou, na alternância "Por critério", uma linha por
// critério de origem com as áreas como chips.
import { CheckCircle2, Eye, Link2 } from "lucide-react";
import type { AdminPublicToken } from "@/lib/routing-api";
import { plural } from "@/lib/utils";
import { displayCriterionName } from "@/lib/criterion-name";
import { CONDENSED, GOOD, GOOD_TEXT, AMBER_TEXT } from "@/lib/premium-theme";
import { STATE_CFG, fmtDT } from "./helpers";
import type { CritFilter, CritRow, CritState, EnrichedEvent } from "./types";

export type AreaBoardMode = "area" | "criterion";

/** Grupo (área ou critério de origem) com o estado agregado. */
export interface BoardGroup {
  key: string;
  label: string;
  rows: CritRow[];
  done: number;
  state: Exclude<CritState, "unassigned">;
}

function groupState(rows: CritRow[]): BoardGroup["state"] {
  const done = rows.filter(r => r.state === "done").length;
  if (rows.length > 0 && done === rows.length) return "done";
  if (done > 0 || rows.some(r => r.state === "partial")) return "partial";
  return "pending";
}

/** Critérios do evento agrupados por área (ou por critério de origem), na ordem do nome. */
export function boardGroups(selected: EnrichedEvent, mode: AreaBoardMode): BoardGroup[] {
  const map = new Map<string, { label: string; rows: CritRow[] }>();
  for (const c of selected.criteria) {
    const key = mode === "area" ? `a${c.areaId ?? 0}` : displayCriterionName(c.criterionName).toLocaleLowerCase("pt-BR");
    const label = mode === "area" ? c.areaName : displayCriterionName(c.criterionName);
    const g = map.get(key) ?? { label, rows: [] };
    g.rows.push(c);
    map.set(key, g);
  }
  return [...map.entries()]
    .map(([key, g]) => ({
      key, label: g.label,
      rows: [...g.rows].sort((a, b) => (mode === "area"
        ? displayCriterionName(a.criterionName).localeCompare(displayCriterionName(b.criterionName), "pt-BR")
        : a.areaName.localeCompare(b.areaName, "pt-BR"))),
      done: g.rows.filter(r => r.state === "done").length,
      state: groupState(g.rows),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

/** Contadores das pílulas (Todos/Aguardando/Parcial/Completo) em GRUPOS. */
export function boardCounts(groups: BoardGroup[]): Record<CritFilter, number> {
  return {
    all: groups.length,
    unassigned: 0,
    pending: groups.filter(g => g.state === "pending").length,
    partial: groups.filter(g => g.state === "partial").length,
    done: groups.filter(g => g.state === "done").length,
  };
}

/** Link usado para responder o critério (o token admin grava createdByUserId = avaliador em nome de quem saiu). */
function linkUsedFor(c: CritRow, tokens: AdminPublicToken[] | undefined): AdminPublicToken | null {
  if (c.state !== "done" || c.formSubmitterId == null) return null;
  return (tokens ?? []).find(t => t.usedAt != null && t.createdByUserId === c.formSubmitterId
    && (t.criterionIds ?? []).includes(c.criterionId)) ?? null;
}

/** Situação curta de um critério: quem respondeu e quando, rascunho ou pendente. */
function Situation({ c, tokens }: { c: CritRow; tokens: AdminPublicToken[] | undefined }) {
  const when = c.submittedAt ? fmtDT(c.submittedAt) : null;
  if (c.state === "done") {
    const link = linkUsedFor(c, tokens);
    const name = c.formSubmitterName ?? link?.submitterName ?? null;
    const full = link
      ? `Respondido via link por ${name ?? "freela"} (em nome de ${link.createdByName ?? "avaliador da área"})${when ? ` em ${when}` : ""}`
      : name ? `Respondido por ${name}${when ? ` em ${when}` : ""}` : "Publicado na calibração";
    return (
      <span className="inline-flex items-center gap-1 text-[11.5px] font-bold min-w-0" style={{ color: GOOD_TEXT }} title={full}>
        <CheckCircle2 size={12} className="shrink-0" aria-hidden />
        <span className="truncate">
          {name ?? "Publicado na calibração"}{link ? " (link)" : ""}
          {when && <span className="hidden @md:inline font-semibold" style={{ color: "var(--muted-foreground)" }}> · {when}</span>}
        </span>
        <span className="sr-only">{full}</span>
      </span>
    );
  }
  if (c.state === "partial") {
    return <span className="text-[11.5px] font-bold truncate" style={{ color: AMBER_TEXT }} title={`Rascunho${c.formSubmitterName ? ` de ${c.formSubmitterName}` : ""} (não enviado)`}>Rascunho{c.formSubmitterName ? ` · ${c.formSubmitterName}` : ""}</span>;
  }
  return <span className="text-[11.5px] font-bold" style={{ color: "var(--muted-foreground)" }}>Pendente</span>;
}

export function AreaBoard({ selected, groups, mode, canManage, canViewSubmissions, tokens, openLinkDialog, setViewEvalCrit }: {
  selected: EnrichedEvent;
  /** Grupos já filtrados (boardGroups + filtro de situação). */
  groups: BoardGroup[];
  mode: AreaBoardMode;
  canManage: boolean;
  canViewSubmissions: boolean;
  tokens: AdminPublicToken[] | undefined;
  openLinkDialog: (c: CritRow) => void;
  setViewEvalCrit: (c: CritRow) => void;
}) {
  if (groups.length === 0) {
    return (
      <div className="rounded-lg py-4 px-3.5 text-center text-[11px] font-bold uppercase" style={{ border: "1px dashed var(--border)", color: "var(--muted-foreground)" }}>
        {selected.criteria.length === 0 ? "Nenhum critério ativo neste evento" : mode === "area" ? "Nenhuma área neste filtro" : "Nenhum critério neste filtro"}
      </div>
    );
  }
  const canLink = canManage && !selected.nextCycle;
  return (
    <ul className="grid gap-2.5 xl:grid-cols-2" data-testid={`area-board-${mode}`} aria-label={mode === "area" ? "Critérios por área" : "Critérios e áreas"}>
      {groups.map(g => {
        const cfg = STATE_CFG[g.state];
        const firstOpen = g.rows.find(r => r.state !== "done");
        const pct = g.rows.length > 0 ? Math.round((g.done / g.rows.length) * 100) : 0;
        return (
          <li key={g.key} className="@container rounded-lg relative overflow-hidden" style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }} data-testid={`board-group-${g.key}`}>
            <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: cfg.accent }} />
            <div className="flex items-center gap-2 pl-3.5 pr-2.5 pt-2 pb-1.5">
              <p className="min-w-0 flex-1 truncate font-black uppercase text-[13.5px] leading-tight tracking-tight" style={{ fontFamily: CONDENSED }} title={g.label}>{g.label}</p>
              <span className="shrink-0 whitespace-nowrap text-[11px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
              {/* Um link por ÁREA (o formulário da área, em nome de um avaliador dela). */}
              {mode === "area" && canLink && firstOpen && firstOpen.areaId != null && (
                <button
                  type="button"
                  onClick={() => openLinkDialog(firstOpen)}
                  data-testid={`button-area-link-${firstOpen.areaId}`}
                  aria-label={`Link para freela da área ${g.label}`}
                  title="Gerar link para freela (em nome de um avaliador da área)"
                  className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase flex items-center gap-1 transition-opacity hover:opacity-80"
                  style={{ border: "1px solid var(--border)" }}
                >
                  <Link2 size={11} aria-hidden /> Link
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 pl-3.5 pr-2.5 pb-2">
              <span className="h-1.5 flex-1 max-w-[140px] rounded-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }} aria-hidden>
                <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: g.state === "done" ? GOOD : "var(--accent)" }} />
              </span>
              <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>
                {g.done} de {plural(g.rows.length, "respondido", "respondidos")}
              </span>
            </div>
            <ul className="pb-1.5" style={{ borderTop: "1px solid var(--border)" }}>
              {g.rows.map(c => {
                const label = mode === "area" ? displayCriterionName(c.criterionName) : c.areaName;
                return (
                  <li key={c.criterionId} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-2 pl-3.5 pr-1.5 py-1 text-[12px]" data-testid={`board-row-${c.criterionId}`}>
                    <span className="min-w-0 truncate font-semibold" title={label}>{label}</span>
                    <span className="flex items-center gap-1 min-w-0 justify-end">
                      <Situation c={c} tokens={tokens} />
                      {c.score != null && c.state === "done" && (
                        <span className="text-[11px] font-bold tabular-nums shrink-0" style={{ color: "var(--muted-foreground)" }} title="Nota enviada (0 a 10)">· {c.score}</span>
                      )}
                      {c.score != null && c.state === "done" && canViewSubmissions && (
                        <button
                          type="button"
                          onClick={() => setViewEvalCrit(c)}
                          aria-label={`Ver resposta de ${displayCriterionName(c.criterionName)} · ${c.areaName}`}
                          title="Ver resposta enviada"
                          className="shrink-0 rounded p-0.5 transition-opacity hover:opacity-70"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          <Eye size={13} aria-hidden />
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
