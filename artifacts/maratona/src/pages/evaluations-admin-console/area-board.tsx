// Quadro do ciclo com avaliação POR ÁREA (Central → Eventos e Tabela): um
// cartão compacto por ÁREA com os critérios dela como linhas curtas
// ("✓ Nome · dd/mm hh:mm", "via link", "Rascunho", "Pendente") e um botão
// "Link" por área; ou, na alternância "Por critério", um cartão por critério
// de origem com as áreas como linhas. Linha respondida abre a resposta.
import { CheckCircle2, ChevronRight, CircleDashed, Clock, Link2 } from "lucide-react";
import type { AdminPublicToken } from "@/lib/routing-api";
import { cn, plural } from "@/lib/utils";
import { displayCriterionName } from "@/lib/criterion-name";
import { fmtDT } from "./helpers";
import { Chip, EmptyBlock, btnSmall, STATE_BAR, type Tone } from "./console-ui";
import type { CritFilter, CritRow, CritState, EnrichedEvent } from "./types";
import { ListX } from "lucide-react";

export type AreaBoardMode = "area" | "criterion";

/** Grupo (área ou critério de origem) com o estado agregado. */
export interface BoardGroup {
  key: string;
  label: string;
  rows: CritRow[];
  done: number;
  state: Exclude<CritState, "unassigned">;
}

/** Rótulos do estado de um grupo (área/critério) no ciclo por área. */
export const GROUP_LABEL: Record<BoardGroup["state"], string> = { pending: "Pendente", partial: "Em andamento", done: "Completo" };
const GROUP_TONE: Record<BoardGroup["state"], Tone> = { pending: "neutral", partial: "warn", done: "ok" };

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

/** Contadores das pílulas (Todos/Pendentes/Em andamento/Completos) em GRUPOS. */
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
      <span className="inline-flex items-center gap-1.5 min-w-0" title={full}>
        <CheckCircle2 size={14} className="shrink-0 text-[var(--status-ok-text)]" aria-hidden />
        <span className="truncate font-semibold text-foreground">{name ?? "Publicado na calibração"}</span>
        {link && <Chip tone="info" className="h-5 px-1.5 text-[11px] shrink-0">Link</Chip>}
        {when && <span className="shrink-0 text-muted-foreground tabular-nums">{when}</span>}
        <span className="sr-only">{full}</span>
      </span>
    );
  }
  if (c.state === "partial") {
    return (
      <span className="inline-flex items-center gap-1.5 min-w-0" title={`Rascunho${c.formSubmitterName ? ` de ${c.formSubmitterName}` : ""} (não enviado)`}>
        <Clock size={14} className="shrink-0 text-[var(--status-warn-text)]" aria-hidden />
        <span className="font-semibold text-[var(--status-warn-text)] shrink-0">Rascunho</span>
        {c.formSubmitterName && <span className="truncate text-muted-foreground">{c.formSubmitterName}</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <CircleDashed size={14} className="shrink-0" aria-hidden /> Pendente
    </span>
  );
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
      <div className="rounded-xl border border-dashed border-border">
        <EmptyBlock icon={ListX} className="py-8" title={selected.criteria.length === 0 ? "Nenhum critério ativo" : mode === "area" ? "Nenhuma área neste filtro" : "Nenhum critério neste filtro"}>
          {selected.criteria.length === 0 ? "Este evento ainda não tem critérios. Confira na aba Critérios." : "Troque o filtro acima para ver as demais."}
        </EmptyBlock>
      </div>
    );
  }
  const canLink = canManage && !selected.nextCycle;
  return (
    <ul className="grid gap-3 @2xl:grid-cols-2 @6xl:grid-cols-3 items-start" data-testid={`area-board-${mode}`} aria-label={mode === "area" ? "Critérios por área" : "Critérios e áreas"}>
      {groups.map(g => {
        const firstOpen = g.rows.find(r => r.state !== "done");
        const pct = g.rows.length > 0 ? Math.round((g.done / g.rows.length) * 100) : 0;
        return (
          <li key={g.key} className="@container rounded-xl border border-border bg-card overflow-hidden" data-testid={`board-group-${g.key}`}>
            <div className="flex items-center gap-2 pl-3.5 pr-2 py-2">
              <h3 className="min-w-0 truncate font-condensed font-black uppercase text-[15px] leading-tight tracking-[-0.005em] text-foreground" title={g.label}>{g.label}</h3>
              <span className="font-condensed shrink-0 text-[13px] font-bold tabular-nums text-muted-foreground" aria-label={`${g.done} de ${plural(g.rows.length, "respondido", "respondidos")}`}>{g.done}/{g.rows.length}</span>
              <Chip tone={GROUP_TONE[g.state]} className="ml-auto shrink-0">{GROUP_LABEL[g.state]}</Chip>
              {/* Um link por ÁREA (o formulário da área, em nome de um avaliador dela). */}
              {mode === "area" && canLink && firstOpen && firstOpen.areaId != null && (
                <button
                  type="button"
                  onClick={() => openLinkDialog(firstOpen)}
                  data-testid={`button-area-link-${firstOpen.areaId}`}
                  aria-label={`Link para freela da área ${g.label}`}
                  title="Gerar link para freela (em nome de um avaliador da área)"
                  className={cn(btnSmall, "shrink-0 min-h-11 lg:min-h-8 px-2.5 text-[12.5px]")}
                >
                  <Link2 size={13} aria-hidden /> Link
                </button>
              )}
            </div>
            <span className="block h-[3px] bg-secondary" aria-hidden>
              <span className={cn("block h-full transition-[width] duration-300 motion-reduce:transition-none", STATE_BAR[g.state === "done" ? "done" : g.state === "partial" ? "partial" : "pending"])} style={{ width: `${Math.max(pct, 0)}%` }} />
            </span>
            <ul className="divide-y divide-border/70">
              {g.rows.map(c => {
                const label = mode === "area" ? displayCriterionName(c.criterionName) : c.areaName;
                const viewable = c.score != null && c.state === "done" && canViewSubmissions;
                // Cartão estreito: nome em cima e a situação embaixo (nada corta);
                // cartão largo: uma linha só (nome · situação · nota).
                const inner = (
                  <>
                    <span className="min-w-0 truncate font-semibold text-[13.5px] text-foreground" title={label}>{label}</span>
                    <span className="col-start-1 row-start-2 @md:col-start-2 @md:row-start-1 flex items-center min-w-0 @md:justify-end text-[12.5px]">
                      <Situation c={c} tokens={tokens} />
                    </span>
                    <span className="col-start-2 row-start-1 row-span-2 @md:col-start-3 @md:row-span-1 flex items-center gap-1.5 justify-end">
                      {c.score != null && c.state === "done" && (
                        <span className="font-condensed shrink-0 min-w-7 h-7 px-1 rounded-md bg-secondary inline-flex items-center justify-center text-[15px] font-black tabular-nums text-foreground" title="Nota enviada (0 a 10)">{c.score}</span>
                      )}
                      {viewable && <ChevronRight size={15} aria-hidden className="shrink-0 -mr-0.5 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />}
                    </span>
                  </>
                );
                const rowCls = "relative w-full grid grid-cols-[minmax(0,1fr)_auto] @md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] items-center gap-x-3 gap-y-0.5 pl-3.5 pr-2.5 min-h-11 lg:min-h-10 py-2 text-left";
                return (
                  <li key={c.criterionId} data-testid={`board-row-${c.criterionId}`}>
                    {viewable ? (
                      <button
                        type="button"
                        onClick={() => setViewEvalCrit(c)}
                        title="Ver resposta enviada"
                        className={cn(rowCls, "group transition-colors duration-150 hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring")}
                      >
                        <span className="sr-only">Ver resposta de {displayCriterionName(c.criterionName)} · {c.areaName}: </span>
                        {inner}
                      </button>
                    ) : <div className={rowCls}>{inner}</div>}
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
