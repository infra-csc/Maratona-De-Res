// As duas colunas do cadastro (Penalidades · descontam / Méritos · somam):
// cada tipo com nome, identificador, pontos padrão, uso no ciclo, situação
// (ativar/desativar na linha) e as ações.
import type { PenaltyType } from "@workspace/api-client-react";
import { Award, Loader2, MapPin, MinusCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn, plural } from "@/lib/utils";
import { Chip, SignedNumber, btnGhost, iconBtn, surfaceCls } from "../absences/absences-ui";

export function TypeColumn({ kind, types, usage, canEdit, togglingId, onCreate, onEdit, onDelete, onToggle }: {
  kind: "penalty" | "merit";
  types: PenaltyType[];
  usage: Map<string, number>;
  canEdit: boolean;
  togglingId: number | null;
  onCreate: () => void;
  onEdit: (t: PenaltyType) => void;
  onDelete: (t: PenaltyType) => void;
  onToggle: (t: PenaltyType, active: boolean) => void;
}) {
  const merit = kind === "merit";
  const Icon = merit ? Award : MinusCircle;
  const active = types.filter(t => t.active).length;
  return (
    <section aria-labelledby={`types-${kind}-title`} data-testid={`types-${kind}`} className={cn(surfaceCls, "overflow-hidden flex flex-col")}>
      <header className="px-4 sm:px-5 py-3.5 flex items-center gap-3 border-b border-border">
        <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", merit ? "bg-[var(--status-ok-bg)] text-[var(--status-ok-text)]" : "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]")}>
          <Icon size={16} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`types-${kind}-title`} className="font-condensed text-[18px] font-black uppercase leading-none tracking-[-0.01em] text-foreground">
            {merit ? "Méritos" : "Penalidades"}
          </h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {merit ? "Somam pontos na nota" : "Descontam pontos da nota"} · {plural(active, merit ? "ativo" : "ativa", merit ? "ativos" : "ativas")}
            {types.length > active && ` · ${plural(types.length - active, merit ? "inativo" : "inativa", merit ? "inativos" : "inativas")}`}
          </p>
        </div>
        {canEdit && (
          <button type="button" onClick={onCreate} data-testid={`button-new-${kind}`} className={cn(btnGhost, "px-2.5 shrink-0")} aria-label={merit ? "Novo mérito" : "Nova penalidade"}>
            <Plus size={15} aria-hidden /><span className="hidden sm:inline">{merit ? "Novo" : "Nova"}</span>
          </button>
        )}
      </header>
      {types.length === 0 ? (
        <div className="px-6 py-10 text-center flex-1">
          <p className="font-condensed text-[17px] font-black uppercase text-foreground">{merit ? "Nenhum mérito cadastrado" : "Nenhuma penalidade cadastrada"}</p>
          <p className="mt-1 text-[13.5px] text-muted-foreground">{merit ? "Méritos somam pontos para quem se destacou." : "Penalidades descontam pontos por faltas, atrasos e afins."}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {types.map(t => (
            <TypeRow key={t.id} type={t} uses={usage.get(t.slug) ?? 0} canEdit={canEdit} toggling={togglingId === t.id}
              onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </section>
  );
}

function TypeRow({ type: t, uses, canEdit, toggling, onEdit, onDelete, onToggle }: {
  type: PenaltyType; uses: number; canEdit: boolean; toggling: boolean;
  onEdit: (t: PenaltyType) => void; onDelete: (t: PenaltyType) => void; onToggle: (t: PenaltyType, active: boolean) => void;
}) {
  const merit = t.kind === "merit";
  const switchId = `type-active-${t.id}`;
  return (
    <li data-testid={`type-row-${t.slug}`} className={cn("px-4 sm:px-5 py-3.5 flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-3 transition-colors duration-150 hover:bg-secondary/30", !t.active && "bg-secondary/30")}>
      <div className={cn("min-w-0 flex-1 basis-[60%]", !t.active && "opacity-70")}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-foreground leading-tight">{t.label}</span>
          {t.requiresEvent && <Chip icon={MapPin} className="h-5 text-[11px]" title="Ao lançar, é obrigatório escolher o evento">Exige evento</Chip>}
          {!t.active && <Chip className="h-5 text-[11px]">Inativo</Chip>}
        </div>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          <span className="font-mono">{t.slug}</span>
          <span aria-hidden> · </span>
          {uses > 0 ? `usado ${uses === 1 ? "1 vez" : `${uses.toLocaleString("pt-BR")} vezes`} neste ciclo` : "sem uso neste ciclo"}
        </p>
      </div>
      <div className="shrink-0 ml-auto sm:ml-0 flex items-baseline gap-1" title="Pontos padrão de cada lançamento">
        <SignedNumber kind={t.kind} className="text-[24px]">{merit ? "+" : "−"}{t.points}</SignedNumber>
        <span className="font-condensed text-[13px] font-bold uppercase tracking-[0.04em] text-muted-foreground">pts</span>
      </div>
      {canEdit && (
        <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
          <label htmlFor={switchId} className="flex items-center gap-2 mr-auto sm:mr-1.5 cursor-pointer min-h-11 lg:min-h-9">
            <span className="text-[12.5px] text-muted-foreground sm:sr-only">{t.active ? "Ativo" : "Inativo"}</span>
            {toggling ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin text-muted-foreground" /> : null}
            <Switch id={switchId} checked={t.active} disabled={toggling} onCheckedChange={v => onToggle(t, v)}
              aria-label={`${t.label}: ${t.active ? "ativo — desativar" : "inativo — ativar"}`} data-testid={`switch-type-active-${t.slug}`} />
          </label>
          <button type="button" onClick={() => onEdit(t)} title="Editar" aria-label={`Editar ${t.label}`} data-testid={`button-edit-type-${t.slug}`} className={iconBtn}>
            <Pencil size={14} aria-hidden />
          </button>
          <button type="button" onClick={() => onDelete(t)} title="Remover" aria-label={`Remover ${t.label}`} data-testid={`button-delete-type-${t.slug}`}
            className={cn(iconBtn, "text-muted-foreground hover:text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)] hover:border-[var(--status-danger)]/40")}>
            <Trash2 size={14} aria-hidden />
          </button>
        </div>
      )}
    </li>
  );
}
