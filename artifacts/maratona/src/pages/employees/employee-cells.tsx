// Pedaços de uma pessoa da lista, iguais na LINHA (telas largas) e no CARTÃO
// (celular e tablet): nome, tipo, situação no ciclo, elegibilidade, acesso e
// as ações (editar + menu).
import { CheckCircle2, Eye, KeyRound, Loader2, MoreHorizontal, Pencil, UserMinus, UserPlus, Users } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Avatar, Chip, btnSmall, iconBtn, menuItemCls, triggerMemo } from "./ui";
import { cycleStatus, employmentTypeLabel, fromPreviousCycleOnly, getEligibilityStatus, toTitleCase } from "./utils";
import type { EmployeeWithCycle } from "./types";

/** Avatar, nome legível (o dado em CAIXA ALTA do RH não muda), selos e e-mail. */
export function NameBlock({ emp, canonical = false, duplicate = false, showEmail = true }: {
  emp: EmployeeWithCycle; canonical?: boolean; duplicate?: boolean; showEmail?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <Avatar name={emp.name} highlight={canonical} />
      <div className="min-w-0">
        <p className="font-semibold text-[15px] leading-snug text-foreground break-words" title={emp.name}>{toTitleCase(emp.name)}</p>
        {(canonical || duplicate || !emp.active) && (
          <div className="mt-1 flex flex-wrap gap-1">
            {canonical && <Chip tone="brand" className="h-5 px-1.5 text-[11px]">Fica este</Chip>}
            {duplicate && <Chip tone="warn" icon={Users} className="h-5 px-1.5 text-[11px]" title="Outro cadastro tem o mesmo nome: pode ser a mesma pessoa">Nome repetido</Chip>}
            {!emp.active && <Chip className="h-5 px-1.5 text-[11px]" title="Cadastro inativo">Inativo</Chip>}
          </div>
        )}
        {showEmail && emp.email && <p className="text-[12.5px] text-muted-foreground mt-0.5 break-all">{emp.email}</p>}
      </div>
    </div>
  );
}

/** Casa (conta no ranking) × Freela (não pontua). */
export function TypeChip({ type }: { type?: string }) {
  const freela = type === "freela";
  return (
    <Chip className={cn(freela && "bg-transparent border border-border")} title={freela ? "Freela: não entra no ranking nem no bônus" : "Casa: entra no ranking e no bônus"}>
      {employmentTypeLabel(type)}
    </Chip>
  );
}

/** Situação no ciclo: eventos com nota, "Do ciclo anterior", "Fora do ciclo" (com o motivo) ou "Sem nota". */
export function CycleCell({ emp, align = "start" }: { emp: EmployeeWithCycle; align?: "start" | "center" }) {
  const status = cycleStatus(emp);
  const box = cn("flex flex-col gap-1 min-w-0", align === "center" ? "items-center text-center" : "items-start");
  if (status === "out") {
    return (
      <div className={box}>
        <Chip tone="danger" icon={UserMinus}>Fora do ciclo</Chip>
        {emp.cycleExcludedReason && <span className="text-[12.5px] leading-snug text-muted-foreground line-clamp-2 max-w-[220px]" title={emp.cycleExcludedReason}>{emp.cycleExcludedReason}</span>}
      </div>
    );
  }
  if (status === "none") {
    return (
      <div className={box}>
        <Chip className="bg-transparent border border-dashed border-border">Sem nota</Chip>
      </div>
    );
  }
  // Ciclo novo: quem estava no ciclo anterior aparece já, ainda sem nota.
  if (fromPreviousCycleOnly(emp)) {
    return (
      <div className={box} data-testid={`cycle-previous-${emp.id}`}>
        <Chip tone="info">Do ciclo anterior</Chip>
        <span className="text-[12.5px] leading-snug text-muted-foreground">sem nota neste ciclo ainda</span>
      </div>
    );
  }
  const n = emp.cycleEventsCount ?? 0;
  return (
    <div className={box}>
      <span className="font-condensed text-[17px] font-black leading-none tabular-nums whitespace-nowrap">{n} <span className="text-[13px] font-bold uppercase tracking-[0.04em]">{n === 1 ? "evento" : "eventos"}</span></span>
      <span className="text-[12.5px] text-muted-foreground">com nota</span>
    </div>
  );
}

/** Elegibilidade ao bônus no ciclo atual (+ eventos que contam). */
export function EligibilityCell({ emp, align = "start" }: { emp: EmployeeWithCycle; align?: "start" | "center" }) {
  const box = cn("flex flex-col gap-1 min-w-0", align === "center" ? "items-center text-center" : "items-start");
  const count = emp.participatedEventsCount;
  const events = count != null && <span className="text-[12.5px] text-muted-foreground tabular-nums whitespace-nowrap">{count} {count === 1 ? "evento conta" : "eventos contam"}</span>;
  // Ainda sem nota no ciclo novo: elegibilidade ainda não se aplica ("—", não "inelegível").
  if (fromPreviousCycleOnly(emp)) {
    return <div className={box}><span className="font-condensed text-[17px] font-bold text-muted-foreground" title="Sem nota neste ciclo ainda"><span aria-hidden>—</span><span className="sr-only">Ainda não se aplica: sem nota neste ciclo</span></span></div>;
  }
  const status = getEligibilityStatus(emp);
  if (status === "freela") return <div className={box}><Chip className="bg-transparent border border-border text-muted-foreground" title="Freela não entra no ranking nem no bônus">Não pontua</Chip></div>;
  if (status === "eligible") return <div className={box}><Chip tone="ok" icon={CheckCircle2}>Elegível</Chip>{events}</div>;
  if (status === "not_eligible") return <div className={box}><Chip>Não elegível</Chip>{events}</div>;
  return <div className={box}><span className="text-[13px] text-muted-foreground">Sem dados</span></div>;
}

type AccessProps = {
  emp: EmployeeWithCycle;
  canBulk: boolean;
  previewingId: number | null;
  generatingPinId: number | null;
  onGeneratePin: (emp: EmployeeWithCycle) => void;
};

/** Acesso ao app: com/sem login; casa sem acesso ganha o atalho "Criar acesso". */
export function AccessCell({ emp, canBulk, previewingId, generatingPinId, onGeneratePin, align = "start" }: AccessProps & { align?: "start" | "center" }) {
  const box = cn("flex flex-col gap-1.5 min-w-0", align === "center" ? "items-center" : "items-start");
  const generating = generatingPinId === emp.id;
  const busy = previewingId === emp.id
    ? <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground" role="status"><Loader2 size={12} aria-hidden className="motion-safe:animate-spin" /> Abrindo a visão…</span>
    : generating && emp.hasAccess
      ? <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground" role="status"><Loader2 size={12} aria-hidden className="motion-safe:animate-spin" /> Redefinindo…</span>
      : null;
  if (emp.hasAccess) return <div className={box}><Chip tone="ok">Com acesso</Chip>{busy}</div>;
  const casa = emp.employmentType === "casa";
  return (
    <div className={box}>
      <Chip tone={casa ? "warn" : "neutral"} title={casa ? "Ainda não entra no app" : undefined}>Sem acesso</Chip>
      {casa && canBulk && (
        <button
          type="button"
          data-testid={`button-create-access-${emp.id}`}
          onClick={() => onGeneratePin(emp)}
          disabled={generating}
          aria-busy={generating || undefined}
          title={`Criar o acesso de ${toTitleCase(emp.name)} (a senha é o CPF)`}
          className={cn(btnSmall, "min-h-11 lg:min-h-8 px-2.5 text-[12px]")}
        >
          {generating ? <Loader2 size={13} aria-hidden className="motion-safe:animate-spin" /> : <KeyRound size={13} aria-hidden />}
          {generating ? "Criando…" : "Criar acesso"}
        </button>
      )}
    </div>
  );
}

type ActionsProps = AccessProps & {
  canEdit: boolean;
  isAdmin: boolean;
  onEdit: (emp: EmployeeWithCycle) => void;
  onPreviewAs: (emp: EmployeeWithCycle) => void;
  onToggleCycle?: (emp: EmployeeWithCycle) => void;
  variant: "row" | "card";
};

/** Editar (sempre à vista), "Devolver ao ciclo" à vista em quem está fora, e o resto no menu. */
export function RowActions({ emp, canEdit, canBulk, isAdmin, previewingId, generatingPinId, onEdit, onGeneratePin, onPreviewAs, onToggleCycle, variant }: ActionsProps) {
  if (!canEdit) return null;
  const name = toTitleCase(emp.name);
  const status = cycleStatus(emp);
  const canPin = canBulk && emp.employmentType === "casa";
  const canPreview = isAdmin && emp.hasAccess && !!emp.linkedUserId;
  // Sem nota no ciclo: não há o que tirar do ciclo (entra sozinho quando tiver nota).
  const canExclude = !!onToggleCycle && status === "in";
  const canInclude = !!onToggleCycle && status === "out";
  const hasMenu = canPin || canPreview || canExclude;
  return (
    <div className={cn("flex items-center gap-1.5", variant === "row" ? "justify-end" : "flex-wrap")}>
      {canInclude && (
        <button type="button" data-testid={`button-cycle-include-${emp.id}`} onClick={() => onToggleCycle!(emp)}
          className={cn(btnSmall, "bg-primary text-primary-foreground border-primary enabled:hover:bg-primary hover:opacity-90")}>
          <UserPlus size={14} aria-hidden /> Devolver<span className={variant === "row" ? "sr-only" : undefined}> ao ciclo</span>
        </button>
      )}
      {variant === "card" ? (
        <button type="button" data-testid={`button-edit-employee-${emp.id}`} aria-label={`Editar ${name}`} onClick={() => onEdit(emp)} className={btnSmall}>
          <Pencil size={14} aria-hidden /> Editar
        </button>
      ) : (
        <button type="button" data-testid={`button-edit-employee-${emp.id}`} aria-label={`Editar ${name}`} title="Editar" onClick={() => onEdit(emp)} className={iconBtn}>
          <Pencil size={15} aria-hidden />
        </button>
      )}
      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={`Mais ações para ${name}`} title="Mais ações" data-testid={`button-employee-menu-${emp.id}`} {...triggerMemo}
              className={cn(iconBtn, "data-[state=open]:bg-secondary")}>
              <MoreHorizontal size={16} aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="font-body min-w-[230px] rounded-xl border-border bg-popover text-popover-foreground p-1.5 shadow-lg">
            {canPin && (
              <DropdownMenuItem data-testid={`button-generate-pin-${emp.id}`} disabled={generatingPinId === emp.id} onClick={() => onGeneratePin(emp)} className={menuItemCls}>
                <KeyRound size={15} aria-hidden /> {emp.hasAccess ? "Redefinir senha (CPF)" : "Criar acesso"}
              </DropdownMenuItem>
            )}
            {canPreview && (
              <DropdownMenuItem data-testid={`button-preview-as-${emp.id}`} disabled={previewingId === emp.id} onClick={() => onPreviewAs(emp)} className={menuItemCls}>
                <Eye size={15} aria-hidden /> Ver como colaborador
              </DropdownMenuItem>
            )}
            {canExclude && (canPin || canPreview) && <DropdownMenuSeparator className="my-1 bg-border" />}
            {canExclude && (
              <DropdownMenuItem data-testid={`button-cycle-exclude-${emp.id}`} onClick={() => onToggleCycle!(emp)}
                className={cn(menuItemCls, "text-[var(--status-danger-text)] focus:text-[var(--status-danger-text)] focus:bg-[var(--status-danger-bg)] data-[highlighted]:bg-[var(--status-danger-bg)]")}>
                <UserMinus size={15} aria-hidden /> Tirar do ciclo
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
