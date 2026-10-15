// Topo fixo: o único h1, "Mais ações" (só admin: migrar e-mails e mesclar
// duplicados) e "Novo usuário". No modo de mescla, o topo vira a barra do
// modo (o que fazer e "Sair do modo").
import { ChevronDown, GitMerge, Mail, MoreHorizontal, Plus, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { btnGhost, btnPrimary, btnSecondary, menuItemCls, triggerMemo } from "./users-ui";

export function UsersHeader({ isAdmin, mergeMode, onOpenEmailMigration, onToggleMergeMode, onCreate }: {
  isAdmin: boolean;
  mergeMode: boolean;
  onOpenEmailMigration: () => void;
  onToggleMergeMode: () => void;
  onCreate: () => void;
}) {
  const actions = [
    { key: "merge", label: "Mesclar duplicados", hint: "Junta contas repetidas de avaliador numa só; o histórico vai para a conta mantida.", Icon: GitMerge, testId: "button-merge-mode", onClick: onToggleMergeMode },
    { key: "emails", label: "Migrar e-mails (Office 365)", hint: "Mostra uma prévia do que muda antes de aplicar.", Icon: Mail, testId: "button-email-migration", onClick: onOpenEmailMigration },
  ];
  return (
    <div className="md:sticky md:top-0 z-30 bg-card border-b border-border px-4 md:px-6 py-3 lg:py-0 lg:h-16 flex items-center gap-3 lg:gap-5">
      <h1 data-testid="text-page-title" className="min-w-0 font-condensed text-[24px] sm:text-[26px] uppercase tracking-[-0.01em] font-black leading-none text-foreground truncate">Usuários</h1>
      <p className="hidden xl:block min-w-0 truncate text-[13px] text-muted-foreground">Quem entra no sistema, com que papel e por qual área avalia.</p>
      <div className="ml-auto flex items-center gap-2 shrink-0">
        {mergeMode ? (
          <button type="button" data-testid="button-merge-mode" onClick={onToggleMergeMode} className={cn(btnSecondary, "min-h-11 lg:min-h-9 px-3.5 text-[13px]")}>
            <X size={15} aria-hidden /> Sair<span className="hidden sm:inline"> da mescla</span>
          </button>
        ) : (
          <>
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" data-testid="button-users-more-actions" aria-label="Mais ações" {...triggerMemo}
                    className={cn(btnGhost, "px-2.5 lg:px-3 data-[state=open]:bg-secondary data-[state=open]:text-foreground")}>
                    <MoreHorizontal size={16} aria-hidden />
                    <span className="hidden lg:inline">Mais ações</span>
                    <ChevronDown size={14} aria-hidden className="hidden lg:block opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={6} className="font-body w-[min(330px,calc(100vw-24px))] rounded-xl border-border bg-popover text-popover-foreground p-1.5 shadow-lg">
                  <DropdownMenuLabel className="font-condensed px-2.5 pt-1.5 pb-1 text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Manutenção</DropdownMenuLabel>
                  {actions.map(a => (
                    <DropdownMenuItem key={a.key} data-testid={a.testId} onClick={a.onClick} className={cn(menuItemCls, "items-start py-2 h-auto")}>
                      <a.Icon size={15} aria-hidden className="mt-0.5 shrink-0" />
                      <span className="min-w-0">
                        <span className="block">{a.label}</span>
                        <span className="font-body block mt-0.5 text-[12.5px] font-normal normal-case tracking-normal text-muted-foreground leading-snug">{a.hint}</span>
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <button type="button" data-testid="button-create-user" onClick={onCreate} className={cn(btnPrimary, "min-h-11 lg:min-h-9 px-3.5 lg:px-4 text-[13px]")}>
              <Plus size={15} aria-hidden /> Novo<span className="hidden sm:inline"> usuário</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
