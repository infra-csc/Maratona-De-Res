import { Users, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { useUsersByArea } from "@/lib/routing-api";
import { cn } from "@/lib/utils";
import { displayCriterionName } from "./helpers";
import { Chip, DialogHeading, Eyebrow, btnSmall, dialogCls } from "./ui";
import type { AreaAssignTarget, CriterionAssignmentRow, PrincipalAreaRow } from "./types";

type AreaUser = NonNullable<ReturnType<typeof useUsersByArea>["data"]>[number];

interface PrincipalAreaCriteriaSectionProps {
  myPrincipalAreas: PrincipalAreaRow[];
  criterionAssignments: CriterionAssignmentRow[] | undefined;
  userId: number | undefined;
  onTakeCriterion: (criterionId: number) => void;
  onAssignCriterion: (target: AreaAssignTarget) => void;
}

// "Quesitos da Minha Área": visão do avaliador principal sobre todos os
// quesitos das áreas dele no evento, com atribuir / pegar para mim.
export function PrincipalAreaCriteriaSection({
  myPrincipalAreas, criterionAssignments, userId, onTakeCriterion, onAssignCriterion,
}: PrincipalAreaCriteriaSectionProps) {
  const principalAreaIds = new Set(myPrincipalAreas.map(a => a.id));
  // Deriva das atribuições do evento: para o avaliador principal, o servidor
  // já devolve TODOS os critérios ativos da área dele (os ainda sem atribuição
  // vêm como linhas "virtuais", com o avaliador padrão do roteamento) — sem
  // precisar ler a lista completa de critérios do evento.
  const areaCriteria = (criterionAssignments ?? [])
    .filter(a => a.criterionAreaId != null && principalAreaIds.has(a.criterionAreaId))
    .map(a => ({
      criterionId: a.criterionId,
      criterionName: displayCriterionName(a.criterionName),
      criterionAreaId: a.criterionAreaId as number,
      assignedToId: a.assignedToId ?? null,
      assignedToName: a.assignedToName ?? null,
      status: a.status ?? "pending",
    }));
  if (areaCriteria.length === 0) return null;
  const areaNameById = new Map(myPrincipalAreas.map(a => [a.id, a.name]));
  return (
    <section aria-labelledby="principal-area-title" className="rounded-2xl border border-border bg-card">
      <header className="px-5 sm:px-7 pt-5 pb-4 border-b border-border">
        <Eyebrow className="flex items-center gap-1.5"><Users size={13} aria-hidden /> Avaliador principal</Eyebrow>
        <h3 id="principal-area-title" className="font-condensed mt-1.5 text-[22px] font-black uppercase leading-none text-foreground">Quesitos da minha área</h3>
        <p className="mt-2 text-[14px] text-muted-foreground leading-relaxed max-w-2xl">
          Você vê todos os quesitos da sua área neste evento e pode atribuir, tomar para si ou passar para outro colega.
        </p>
      </header>
      <ul className="divide-y divide-border">
        {areaCriteria.map(a => {
          const isMine = a.assignedToId === userId;
          const isSubmitted = a.status === "submitted";
          return (
            <li key={a.criterionId} className={cn("px-5 sm:px-7 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3", isMine && "bg-[var(--status-ok-bg)]")}>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-foreground">{displayCriterionName(a.criterionName)}</p>
                <p className="text-[13px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{areaNameById.get(a.criterionAreaId!)}</span>
                  <span aria-hidden>·</span>
                  <span>{a.assignedToName ?? "Sem avaliador"}{isMine ? " (você)" : ""}</span>
                  {isSubmitted && <Chip tone="ok">Enviada</Chip>}
                </p>
              </div>
              {!isSubmitted && (
                <div className="flex items-center gap-2 shrink-0">
                  {!isMine && (
                    <button type="button" data-testid={`button-take-criterion-${a.criterionId}`} onClick={() => onTakeCriterion(a.criterionId)} className={btnSmall}>
                      Pegar para mim
                    </button>
                  )}
                  <button
                    type="button"
                    data-testid={`button-assign-criterion-${a.criterionId}`}
                    onClick={() => onAssignCriterion({ criterionId: a.criterionId, criterionName: a.criterionName ?? "", areaId: a.criterionAreaId! })}
                    className={btnSmall}
                  >
                    Atribuir a...
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface AreaAssignDialogProps {
  target: AreaAssignTarget | null;
  users: AreaUser[] | undefined;
  userId: number | undefined;
  onClose: () => void;
  onPickUser: (userId: number) => void;
}

export function AreaAssignDialog({ target, users, userId, onClose, onPickUser }: AreaAssignDialogProps) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className={dialogCls}>
        <DialogHeading
          icon={UserPlus}
          Title={DialogTitle}
          Description={DialogDescription}
          title={`Atribuir "${displayCriterionName(target?.criterionName)}"`}
          description="Escolha o avaliador da área que vai responder este quesito."
        />
        <div className="rounded-xl border border-border divide-y divide-border max-h-72 overflow-y-auto">
          {(users ?? []).map(u => (
            <button
              key={u.id}
              type="button"
              data-testid={`option-assign-user-${u.id}`}
              onClick={() => onPickUser(u.id)}
              className="w-full min-h-12 text-left px-4 text-[15px] text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:bg-secondary"
            >
              <span className={u.id === userId ? "font-semibold" : ""}>{u.name}</span>{u.id === userId ? <span className="text-muted-foreground"> (você)</span> : ""}
            </button>
          ))}
          {users?.length === 0 && (
            <p className="px-4 py-6 text-center text-[14px] text-muted-foreground">Nenhum usuário ativo encontrado nesta área.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
