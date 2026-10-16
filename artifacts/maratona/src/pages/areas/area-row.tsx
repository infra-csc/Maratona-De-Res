// Uma área da lista: TABELA nas telas largas, CARTÃO no celular/tablet.
// Nome e descrição, quem avalia por ela, critérios (responsável e "também
// responde"), outras pessoas, situação e o atalho "Critérios e pessoas".
import { AlertTriangle, Loader2, Settings2, Users } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { displayCriterionName } from "@/lib/criterion-name";
import { cn, plural } from "@/lib/utils";
import { Avatar, Chip, Eyebrow, btnSmall, surfaceCls } from "./areas-ui";
import type { AreaSummary } from "./model";

export type AreaRowProps = {
  s: AreaSummary;
  canEdit: boolean;
  toggling: boolean;
  onToggle: (s: AreaSummary, next: boolean) => void;
  onManage: (s: AreaSummary) => void;
};

function NameBlock({ s }: { s: AreaSummary }) {
  const a = s.area;
  return (
    <div className="min-w-0">
      <p className={cn("font-condensed text-[18px] font-black uppercase leading-tight tracking-[0.01em] break-words", a.active ? "text-foreground" : "text-muted-foreground")}>{a.name}</p>
      {a.description
        ? <p className="mt-1 text-[13px] leading-snug text-muted-foreground line-clamp-2 max-w-[48ch]" title={a.description}>{a.description}</p>
        : <p className="mt-1 text-[13px] italic text-muted-foreground/80">Sem descrição</p>}
    </div>
  );
}

/** Quem avalia pela área: até três nomes, o resto em "+n". */
function EvaluatorsBlock({ s }: { s: AreaSummary }) {
  const list = s.evaluators;
  if (list.length === 0) {
    return s.needsEvaluator
      ? <Chip tone="warn" icon={AlertTriangle} title="Há critério para a área responder e ninguém para responder" data-testid={`area-no-evaluator-${s.area.id}`}>Sem avaliador</Chip>
      : <span className="text-[13px] text-muted-foreground">Nenhum avaliador</span>;
  }
  const shown = list.slice(0, 3);
  const rest = list.length - shown.length;
  return (
    <ul className="space-y-1.5 min-w-0" aria-label={`Avaliadores: ${list.map(u => u.name).join(", ")}`}>
      {shown.map(u => (
        <li key={u.id} className="flex items-center gap-2 min-w-0">
          <Avatar name={u.name} className="w-7 h-7 rounded-md text-[11px]" />
          <span className="text-[13.5px] font-semibold text-foreground truncate" title={u.email ?? undefined}>{u.name}</span>
        </li>
      ))}
      {rest > 0 && <li className="pl-9 text-[12.5px] font-semibold text-muted-foreground" title={list.slice(3).map(u => u.name).join(", ")}>+ {plural(rest, "avaliador", "avaliadores")}</li>}
    </ul>
  );
}

function CriteriaBlock({ s }: { s: AreaSummary }) {
  const r = s.responsible.length;
  const also = s.alsoEvaluates.length;
  const names = (list: AreaSummary["responsible"]) => list.map(c => displayCriterionName(c.name)).join(", ");
  return (
    <div className="min-w-0 space-y-1">
      <p data-testid={`count-criteria-${s.area.id}`} className="flex items-baseline gap-1.5 text-[13.5px] text-foreground" title={r ? names(s.responsible) : undefined}>
        <span className="font-condensed text-[20px] font-black leading-none tabular-nums">{r}</span>
        <span className="text-muted-foreground">{r === 1 ? "responsável" : "responsáveis"}</span>
      </p>
      {also > 0 && (
        <p className="text-[12.5px] leading-snug text-muted-foreground" title={names(s.alsoEvaluates)}>
          + também responde {plural(also, "critério", "critérios")}
        </p>
      )}
    </div>
  );
}

function PeopleCount({ s }: { s: AreaSummary }) {
  const total = s.evaluators.length + s.others.length;
  return (
    <span data-testid={`count-users-${s.area.id}`} className="inline-flex flex-col gap-0.5 text-[13px] tabular-nums text-muted-foreground"
      title={s.others.length ? `Também na área: ${s.others.map(u => u.name).join(", ")}` : undefined}>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Users size={13} aria-hidden /> {plural(total, "pessoa", "pessoas")}</span>
      {s.others.length > 0 && <span className="pl-[19px] text-[12px] leading-snug whitespace-nowrap">{s.others.length === 1 ? "1 não avalia" : `${s.others.length} não avaliam`}</span>}
    </span>
  );
}

function StatusSwitch({ s, canEdit, toggling, onToggle, align = "end" }: Pick<AreaRowProps, "s" | "canEdit" | "toggling" | "onToggle"> & { align?: "start" | "end" }) {
  const a = s.area;
  return (
    <label className={cn("inline-flex items-center gap-2.5 min-h-11 lg:min-h-0", align === "end" && "justify-end", canEdit ? "cursor-pointer" : "cursor-default")}>
      <span className={cn("font-condensed text-[13px] font-bold uppercase tracking-[0.05em] leading-none pt-[3px] w-12", align === "end" && "text-right", a.active ? "text-[var(--status-ok-text)]" : "text-muted-foreground")}>
        {toggling ? <Loader2 size={13} aria-label="Salvando" className="inline motion-safe:animate-spin" /> : a.active ? "Ativa" : "Inativa"}
      </span>
      <Switch
        data-testid={`switch-area-${a.id}`}
        aria-label={`Área ${a.name} ${a.active ? "ativa" : "inativa"}`}
        checked={a.active}
        disabled={!canEdit || toggling}
        onCheckedChange={v => onToggle(s, v)}
        className="data-[state=unchecked]:bg-muted-foreground/40"
      />
    </label>
  );
}

function ManageButton({ s, onManage, compact }: Pick<AreaRowProps, "s" | "onManage"> & { compact?: boolean }) {
  return (
    <button type="button" data-testid={`button-manage-area-${s.area.id}`} onClick={() => onManage(s)}
      aria-label={`Critérios e pessoas de ${s.area.name}`} title="Relacionar critérios e pessoas"
      className={cn(btnSmall, compact ? "px-2.5" : "w-full sm:w-auto")}>
      <Settings2 size={14} aria-hidden />
      <span className={compact ? "hidden xl:inline" : undefined}>Critérios e pessoas</span>
    </button>
  );
}

/** Linha da tabela (telas largas). */
export function AreaRow(p: AreaRowProps) {
  const { s } = p;
  return (
    <tr data-testid={`card-area-${s.area.id}`}
      className={cn("border-t border-border align-top transition-colors duration-150 hover:bg-secondary/35", !s.area.active && "bg-secondary/25")}>
      <td className="pl-5 pr-3 py-4"><NameBlock s={s} /></td>
      <td className="px-3 py-4"><EvaluatorsBlock s={s} /></td>
      <td className="px-3 py-4"><CriteriaBlock s={s} /></td>
      <td className="px-3 py-4 pt-[19px]"><PeopleCount s={s} /></td>
      <td className="px-3 py-3"><StatusSwitch {...p} /></td>
      <td className="pl-1 pr-4 py-3 text-right">{p.canEdit && <ManageButton s={s} onManage={p.onManage} compact />}</td>
    </tr>
  );
}

/** Cartão (celular e tablet). */
export function AreaCard(p: AreaRowProps) {
  const { s } = p;
  return (
    <li data-testid={`card-area-${s.area.id}`} className={cn(surfaceCls, "p-4 flex flex-col gap-3.5", !s.area.active && "bg-secondary/30")}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1"><NameBlock s={s} /></div>
        <StatusSwitch {...p} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3">
        <div className="min-w-0 col-span-2 sm:col-span-1">
          <dt className="mb-2"><Eyebrow as="span">Avaliadores</Eyebrow></dt>
          <dd><EvaluatorsBlock s={s} /></dd>
        </div>
        <div className="min-w-0 col-span-2 sm:col-span-1">
          <dt className="mb-2"><Eyebrow as="span">Critérios</Eyebrow></dt>
          <dd><CriteriaBlock s={s} /></dd>
        </div>
      </dl>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 border-t border-border pt-3">
        <PeopleCount s={s} />
        {p.canEdit && <div className="sm:ml-auto"><ManageButton s={s} onManage={p.onManage} /></div>}
      </div>
    </li>
  );
}
