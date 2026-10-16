// Uma linha do catálogo (tabela nas telas largas, cartão no celular/tablet):
// nome e descrição, quem avalia, peso com a fatia no total, avaliador padrão,
// situação e o menu de ações.
import type { Criterion } from "@workspace/api-client-react";
import { CalendarDays, Copy, Link2, Loader2, MoreHorizontal, Pencil, Route, Shuffle, Users } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import type { CriterionRouting } from "@/lib/routing-api";
import { displayCriterionName } from "@/lib/criterion-name";
import { cn, plural } from "@/lib/utils";
import { Eyebrow, FOCUS_RING, iconBtn, menuItemCls, surfaceCls, triggerMemo } from "./criteria-ui";
import { CriterionWeightCell } from "./weight-cell";
import { EvaluatorPickerCell } from "./evaluator-pickers";
import { EvaluatingAreasCell } from "./evaluating-areas";
import type { AreaOption, EvaluatorOption } from "./types";

export type CriterionRowProps = {
  criterion: Criterion;
  /** Fatia do peso no total dos ativos (0–100). */
  share: number | null;
  routing: CriterionRouting | undefined;
  pickerEvaluators: EvaluatorOption[];
  areas: AreaOption[];
  canEdit: boolean;
  areaMode: boolean;
  savingWeight: boolean;
  togglingActive: boolean;
  onSaveWeight: (c: Criterion, value: number) => void;
  onToggleActive: (c: Criterion, next: boolean) => void;
  onDuplicate: (c: Criterion) => void;
  onOpenRouting: (id: number) => void;
  onEditAreas: (c: Criterion) => void;
  onRoutingSaved: () => void;
};

const eventCountOf = (c: Criterion) => (c as { eventCount?: number }).eventCount ?? 0;

function NameBlock({ c }: { c: Criterion }) {
  return (
    <div className="min-w-0">
      <p className="font-condensed text-[17px] font-black uppercase leading-tight tracking-[0.01em] text-foreground break-words">{displayCriterionName(c.name)}</p>
      {c.description && <p className="mt-1 text-[13px] leading-snug text-muted-foreground line-clamp-2 max-w-[52ch]" title={c.description}>{c.description}</p>}
    </div>
  );
}

/** Quem avalia (botão que abre "Áreas que avaliam" para quem edita). */
function AreasBlock({ c, areas, canEdit, onEditAreas }: Pick<CriterionRowProps, "areas" | "canEdit" | "onEditAreas"> & { c: Criterion }) {
  const cell = <EvaluatingAreasCell criterion={c} areas={areas} />;
  if (!canEdit) return cell;
  return (
    <button type="button" data-testid={`button-criterion-areas-${c.id}`} onClick={() => onEditAreas(c)}
      aria-label={`Áreas que avaliam o critério ${displayCriterionName(c.name)}. Editar`} title="Definir as áreas que avaliam"
      className={cn("group/a -mx-2 -my-1.5 px-2 py-1.5 rounded-lg flex items-start gap-1.5 text-left max-w-full transition-colors duration-150 hover:bg-secondary", FOCUS_RING)}>
      {cell}
      <Pencil size={12} aria-hidden className="mt-1.5 shrink-0 text-muted-foreground lg:opacity-0 lg:group-hover/a:opacity-100 lg:group-focus-visible/a:opacity-100 transition-opacity duration-150" />
    </button>
  );
}

/** Roteamento fora do padrão (link para freela, redirecionamento), em texto curto. */
function RoutingHints({ routing, areaMode }: { routing: CriterionRouting | undefined; areaMode: boolean }) {
  if (!routing) return null;
  const redirect = !areaMode && routing.redirectMode !== "none"
    ? routing.redirectMode === "area"
      ? `Redireciona p/ ${routing.redirectAreaName ?? "uma área"}`
      : `Redireciona p/ ${plural(routing.redirectUsers?.length ?? 0, "pessoa", "pessoas")}`
    : null;
  if (!routing.allowPublicLink && !redirect) return null;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">
      {routing.allowPublicLink && <span className="inline-flex items-center gap-1" data-testid={`hint-public-link-${routing.criterionId}`}><Link2 size={12} aria-hidden /> Link para freela</span>}
      {redirect && <span className="inline-flex items-center gap-1"><Shuffle size={12} aria-hidden /> {redirect}</span>}
    </span>
  );
}

function StatusBlock({ c, canEdit, toggling, onToggleActive, align = "end" }: Pick<CriterionRowProps, "canEdit" | "onToggleActive"> & { c: Criterion; toggling: boolean; align?: "start" | "end" }) {
  const events = eventCountOf(c);
  const name = displayCriterionName(c.name);
  return (
    <div className={cn("flex flex-col gap-1.5", align === "end" ? "items-end" : "items-start")}>
      <label className={cn("inline-flex items-center gap-2.5 min-h-11 lg:min-h-0", canEdit ? "cursor-pointer" : "cursor-default")}>
        <span className={cn("font-condensed text-[13px] font-bold uppercase tracking-[0.05em]", c.active ? "text-[var(--status-ok-text)]" : "text-muted-foreground")}>
          {toggling ? <Loader2 size={13} aria-label="Salvando" className="inline motion-safe:animate-spin" /> : c.active ? "Ativo" : "Inativo"}
        </span>
        <Switch
          data-testid={`switch-criterion-${c.id}`}
          aria-label={`${name}: ${c.active ? "ativo" : "inativo"}`}
          checked={c.active}
          disabled={!canEdit || toggling}
          onCheckedChange={v => onToggleActive(c, v)}
          className="data-[state=unchecked]:bg-muted-foreground/40"
        />
      </label>
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] tabular-nums text-muted-foreground" title="Eventos em que o critério está ativo hoje">
        <CalendarDays size={12} aria-hidden /> {events > 0 ? plural(events, "evento", "eventos") : "Nenhum evento"}
      </span>
    </div>
  );
}

function RowMenu({ c, onOpenRouting, onDuplicate, onEditAreas }: Pick<CriterionRowProps, "onOpenRouting" | "onDuplicate" | "onEditAreas"> & { c: Criterion }) {
  const name = displayCriterionName(c.name);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Mais ações para ${name}`} title="Mais ações" data-testid={`button-criterion-menu-${c.id}`} {...triggerMemo}
          className={cn(iconBtn, "data-[state=open]:bg-secondary")}>
          <MoreHorizontal size={16} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="font-body min-w-[250px] rounded-xl border-border bg-popover text-popover-foreground p-1.5 shadow-lg">
        <DropdownMenuItem data-testid={`button-routing-criterion-${c.id}`} onClick={() => onOpenRouting(c.id)} className={menuItemCls}>
          <Route size={15} aria-hidden /> Roteamento e link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEditAreas(c)} className={menuItemCls}>
          <Users size={15} aria-hidden /> Áreas que avaliam
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1 bg-border" />
        <DropdownMenuItem data-testid={`button-duplicate-criterion-${c.id}`} onClick={() => onDuplicate(c)} className={menuItemCls}>
          <Copy size={15} aria-hidden /> Duplicar para outra área
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Weight(p: CriterionRowProps) {
  const c = p.criterion;
  return (
    <CriterionWeightCell criterionId={c.id} criterionName={displayCriterionName(c.name)} weight={Number(c.defaultWeight)}
      share={c.active ? p.share : null} active={c.active} canEdit={p.canEdit} isSaving={p.savingWeight}
      onSave={v => p.onSaveWeight(c, v)} />
  );
}

function Evaluator(p: CriterionRowProps) {
  const c = p.criterion;
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <EvaluatorPickerCell criterionId={c.id} criterionName={displayCriterionName(c.name)} currentRouting={p.routing}
        evaluators={p.pickerEvaluators} onSaved={p.onRoutingSaved} areaMode={p.areaMode} canEdit={p.canEdit} />
      <RoutingHints routing={p.routing} areaMode={p.areaMode} />
    </div>
  );
}

/** Linha da tabela (telas largas). */
export function CriterionRow(p: CriterionRowProps) {
  const c = p.criterion;
  return (
    <tr data-testid={`row-criterion-${c.id}`}
      className={cn("border-t border-border align-top transition-colors duration-150 hover:bg-secondary/35", !c.active && "bg-secondary/25")}>
      <td className="pl-5 pr-3 py-4"><div className={cn(!c.active && "opacity-70")}><NameBlock c={c} /></div></td>
      <td className="px-3 py-4"><AreasBlock c={c} areas={p.areas} canEdit={p.canEdit} onEditAreas={p.onEditAreas} /></td>
      <td className="px-3 py-4"><Weight {...p} /></td>
      <td className="px-3 py-4"><Evaluator {...p} /></td>
      <td className="px-3 py-4"><StatusBlock c={c} canEdit={p.canEdit} toggling={p.togglingActive} onToggleActive={p.onToggleActive} /></td>
      <td className="pl-1 pr-4 py-3.5 w-14">{p.canEdit && <RowMenu c={c} onOpenRouting={p.onOpenRouting} onDuplicate={p.onDuplicate} onEditAreas={p.onEditAreas} />}</td>
    </tr>
  );
}

/** Cartão (celular e tablet). */
export function CriterionCard(p: CriterionRowProps) {
  const c = p.criterion;
  return (
    <li data-testid={`row-criterion-${c.id}`} className={cn(surfaceCls, "p-4 flex flex-col gap-3.5", !c.active && "bg-secondary/30")}>
      <div className="flex items-start gap-3">
        <div className={cn("min-w-0 flex-1", !c.active && "opacity-75")}><NameBlock c={c} /></div>
        {p.canEdit && <RowMenu c={c} onOpenRouting={p.onOpenRouting} onDuplicate={p.onDuplicate} onEditAreas={p.onEditAreas} />}
      </div>
      <div>
        <Eyebrow as="p" className="mb-2">Quem avalia</Eyebrow>
        <AreasBlock c={c} areas={p.areas} canEdit={p.canEdit} onEditAreas={p.onEditAreas} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3">
        <div className="min-w-0"><dt><Eyebrow as="span">Peso</Eyebrow></dt><dd className="mt-2"><Weight {...p} /></dd></div>
        <div className="min-w-0"><dt><Eyebrow as="span">Situação</Eyebrow></dt><dd className="mt-1"><StatusBlock c={c} canEdit={p.canEdit} toggling={p.togglingActive} onToggleActive={p.onToggleActive} align="start" /></dd></div>
        <div className="min-w-0 col-span-2"><dt><Eyebrow as="span">Avaliador padrão</Eyebrow></dt><dd className="mt-1.5"><Evaluator {...p} /></dd></div>
      </dl>
    </li>
  );
}
