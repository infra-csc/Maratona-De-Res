// Um usuário da lista: TABELA nas telas largas, CARTÃO no celular/tablet.
// Nome, e-mail e login, papel, área, colaborador vinculado, situação e as
// ações (Editar à vista; o resto no menu). No modo de mescla só avaliadores
// são selecionáveis e a ação vira "Manter esta conta".
import type { User } from "@workspace/api-client-react";
import { AlertTriangle, Building2, Check, Eye, KeyRound, LineChart, Link2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Avatar, Chip, Eyebrow, RoleChip, btnSmall, fmtCpf, iconBtn, menuItemCls, surfaceCls, triggerMemo } from "./users-ui";
import type { UserMergeState } from "./use-user-merge";
import type { UserActions } from "./use-user-actions";

export type UserRowProps = {
  user: User;
  isAdmin: boolean;
  currentUserId: number | undefined;
  merge: UserMergeState;
  actions: UserActions;
};

function Identity({ u, isSelf, canonical }: { u: User; isSelf: boolean; canonical: boolean }) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <Avatar name={u.name} highlight={canonical} className={cn(!u.active && "opacity-60")} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("text-[15px] font-semibold leading-tight break-words", u.active ? "text-foreground" : "text-muted-foreground")}>{u.name}</span>
          {isSelf && <Chip className="h-5 text-[11px]">Você</Chip>}
          {canonical && <Chip tone="brand" icon={Check} className="h-5 text-[11px]">Mantida</Chip>}
        </p>
        {u.email && <p className="mt-0.5 text-[13px] text-muted-foreground truncate" title={u.email}>{u.email}</p>}
        {u.cpfLogin && <p className="mt-0.5 text-[12.5px] tabular-nums text-muted-foreground">Login: CPF {fmtCpf(u.cpfLogin)}</p>}
      </div>
    </div>
  );
}

function AreaCell({ u }: { u: User }) {
  if (u.areaName) {
    return <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground"><Building2 size={13} aria-hidden className="text-muted-foreground shrink-0" />{u.areaName}</span>;
  }
  if (u.role === "avaliador" && u.active) {
    return <Chip tone="warn" icon={AlertTriangle} title="Sem área, o avaliador não responde critério no ciclo por área">Sem área</Chip>;
  }
  return <span className="text-[13px] text-muted-foreground">—</span>;
}

function EmployeeCell({ u }: { u: User }) {
  if (!u.employeeName) return <span className="text-[13px] text-muted-foreground">Sem vínculo</span>;
  return (
    <span className="inline-flex items-start gap-1.5 text-[13.5px] text-foreground min-w-0" title="Colaborador vinculado: vê o próprio desempenho">
      <Link2 size={13} aria-hidden className="mt-[3px] text-muted-foreground shrink-0" /><span className="break-words">{u.employeeName}</span>
    </span>
  );
}

function StatusCell({ u }: { u: User }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {u.active ? <Chip tone="ok">Ativo</Chip> : <Chip>Inativo</Chip>}
      {u.mustChangePassword && <Chip tone="warn" icon={KeyRound} title="Entra com a senha provisória e precisa criar uma nova">Trocar senha</Chip>}
    </div>
  );
}

function RowActions({ user: u, isAdmin, currentUserId, actions }: Omit<UserRowProps, "merge">) {
  const isSelf = u.id === currentUserId;
  const canPerf = isAdmin && u.employeeId != null && u.active;
  const canImpersonate = isAdmin && !isSelf && u.active;
  const canDelete = isAdmin && !isSelf;
  const busy = actions.impersonateMutation.isPending;
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button type="button" data-testid={`button-edit-user-${u.id}`} onClick={() => actions.setEditUser(u)}
        aria-label={`Editar ${u.name}`} title="Editar" className={iconBtn}>
        <Pencil size={15} aria-hidden />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={`Mais ações para ${u.name}`} title="Mais ações" data-testid={`button-user-menu-${u.id}`} {...triggerMemo}
            className={cn(iconBtn, "data-[state=open]:bg-secondary")}>
            <MoreHorizontal size={16} aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="font-body min-w-[240px] rounded-xl border-border bg-popover text-popover-foreground p-1.5 shadow-lg">
          <DropdownMenuItem data-testid={`button-reset-pw-${u.id}`} onClick={() => actions.openResetPassword(u)} className={menuItemCls}>
            <KeyRound size={15} aria-hidden /> Redefinir senha
          </DropdownMenuItem>
          {(canPerf || canImpersonate) && (
            <>
              <DropdownMenuSeparator className="my-1 bg-border" />
              <DropdownMenuLabel className="font-condensed px-2.5 pt-1 pb-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Ver como esta pessoa</DropdownMenuLabel>
              {canPerf && (
                <DropdownMenuItem data-testid={`button-view-performance-${u.id}`} disabled={busy} onClick={() => actions.impersonateUser(u.id, "/meu-desempenho")} className={menuItemCls}>
                  <LineChart size={15} aria-hidden /> Ver o desempenho
                </DropdownMenuItem>
              )}
              {canImpersonate && (
                <DropdownMenuItem data-testid={`button-impersonate-${u.id}`} disabled={busy} onClick={() => actions.impersonateUser(u.id, "/")} className={menuItemCls}>
                  <Eye size={15} aria-hidden /> Entrar como (modo dev)
                </DropdownMenuItem>
              )}
            </>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator className="my-1 bg-border" />
              <DropdownMenuItem data-testid={`button-delete-user-${u.id}`} onClick={() => actions.setDeleteTarget(u)}
                className={cn(menuItemCls, "text-[var(--status-danger-text)] focus:text-[var(--status-danger-text)]")}>
                <Trash2 size={15} aria-hidden /> Remover acesso
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function MergeSelect({ u, merge }: { u: User; merge: UserMergeState }) {
  if (u.role !== "avaliador") return <span className="sr-only">Só avaliadores podem ser mesclados</span>;
  return (
    <Checkbox checked={merge.selectedIds.has(u.id)} onCheckedChange={() => merge.toggleSelected(u.id)}
      aria-label={`Selecionar ${u.name} para mesclar`} data-testid={`check-merge-${u.id}`}
      onClick={e => e.stopPropagation()} className="h-[18px] w-[18px] rounded-[5px]" />
  );
}

function KeepButton({ u, merge }: { u: User; merge: UserMergeState }) {
  if (u.role !== "avaliador" || !merge.selectedIds.has(u.id)) return null;
  const on = merge.canonicalId === u.id;
  return (
    <button type="button" aria-pressed={on} data-testid={`button-canonical-${u.id}`}
      onClick={e => { e.stopPropagation(); merge.setCanonicalId(u.id); }}
      title={on ? "Esta conta fica; as outras são desativadas" : "Manter esta conta (as outras passam o histórico para ela)"}
      className={cn(btnSmall, on && "bg-primary text-primary-foreground border-primary enabled:hover:bg-primary")}>
      {on && <Check size={14} aria-hidden />} {on ? "Conta mantida" : "Manter esta"}
    </button>
  );
}

/** Linha da tabela (telas largas). */
export function UserRow(p: UserRowProps) {
  const { user: u, merge } = p;
  const mm = merge.mergeMode;
  const selectable = mm && u.role === "avaliador";
  const selected = merge.selectedIds.has(u.id);
  const canonical = merge.canonicalId === u.id;
  return (
    <tr data-testid={`row-user-${u.id}`} onClick={selectable ? () => merge.toggleSelected(u.id) : undefined}
      className={cn(
        "border-t border-border align-top transition-colors duration-150",
        selectable ? "cursor-pointer hover:bg-secondary/50" : "hover:bg-secondary/35",
        mm && !selectable && "opacity-45",
        selected && "bg-secondary/60",
        canonical && "shadow-[inset_3px_0_0_var(--foreground)]",
        !u.active && !mm && "bg-secondary/25",
      )}>
      {mm && <td className="pl-5 pr-1 py-4 w-10"><div className="pt-2.5"><MergeSelect u={u} merge={merge} /></div></td>}
      <td className={cn("pr-3 py-3.5", mm ? "pl-2" : "pl-5")}><Identity u={u} isSelf={u.id === p.currentUserId} canonical={canonical} /></td>
      <td className="px-3 py-4"><RoleChip role={u.role} /></td>
      <td className="px-3 py-4"><AreaCell u={u} /></td>
      <td className="px-3 py-4 max-w-[220px]"><EmployeeCell u={u} /></td>
      <td className="px-3 py-4"><StatusCell u={u} /></td>
      <td className="pl-1 pr-4 py-3 text-right">{mm ? <KeepButton u={u} merge={merge} /> : <RowActions {...p} />}</td>
    </tr>
  );
}

/** Cartão (celular e tablet). */
export function UserCard(p: UserRowProps) {
  const { user: u, merge } = p;
  const mm = merge.mergeMode;
  const selectable = mm && u.role === "avaliador";
  const canonical = merge.canonicalId === u.id;
  return (
    <li data-testid={`row-user-${u.id}`} className={cn(surfaceCls, "p-4 flex flex-col gap-3",
      mm && !selectable && "opacity-45", merge.selectedIds.has(u.id) && "bg-secondary/60", canonical && "border-foreground",
      !u.active && !mm && "bg-secondary/30")}>
      <div className="flex items-start gap-3">
        {mm && selectable && <div className="pt-2.5"><MergeSelect u={u} merge={merge} /></div>}
        <div className="min-w-0 flex-1"><Identity u={u} isSelf={u.id === p.currentUserId} canonical={canonical} /></div>
        {!mm && <RowActions {...p} />}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3">
        <div className="min-w-0"><dt className="mb-1.5"><Eyebrow as="span">Papel</Eyebrow></dt><dd><RoleChip role={u.role} /></dd></div>
        <div className="min-w-0"><dt className="mb-1.5"><Eyebrow as="span">Área</Eyebrow></dt><dd><AreaCell u={u} /></dd></div>
        <div className="min-w-0"><dt className="mb-1.5"><Eyebrow as="span">Colaborador</Eyebrow></dt><dd><EmployeeCell u={u} /></dd></div>
        <div className="min-w-0"><dt className="mb-1.5"><Eyebrow as="span">Situação</Eyebrow></dt><dd><StatusCell u={u} /></dd></div>
      </dl>
      {mm && selectable && merge.selectedIds.has(u.id) && <KeepButton u={u} merge={merge} />}
    </li>
  );
}
