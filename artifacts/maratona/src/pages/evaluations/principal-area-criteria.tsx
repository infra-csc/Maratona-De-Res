import type { EventCriterion } from "@workspace/api-client-react";
import { Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { useUsersByArea } from "@/lib/routing-api";
import { CONDENSED } from "@/lib/premium-theme";
import type { AreaAssignTarget, CriterionAssignmentRow, PrincipalAreaRow } from "./types";

type AreaUser = NonNullable<ReturnType<typeof useUsersByArea>["data"]>[number];

interface PrincipalAreaCriteriaSectionProps {
  myPrincipalAreas: PrincipalAreaRow[];
  criterionAssignments: CriterionAssignmentRow[] | undefined;
  activeCriteria: EventCriterion[];
  userId: number | undefined;
  onTakeCriterion: (criterionId: number) => void;
  onAssignCriterion: (target: AreaAssignTarget) => void;
}

// "Quesitos da Minha Área": visão do avaliador principal sobre todos os
// quesitos da(s) área(s) dele no evento, com atribuir / pegar para mim.
export function PrincipalAreaCriteriaSection({
  myPrincipalAreas, criterionAssignments, activeCriteria, userId, onTakeCriterion, onAssignCriterion,
}: PrincipalAreaCriteriaSectionProps) {
  const principalAreaIds = new Set(myPrincipalAreas.map(a => a.id));
  // Deriva a partir dos critérios ATIVOS do evento (não das atribuições já
  // geradas) — assim a área principal enxerga e gerencia seus quesitos desde
  // o primeiro momento, mesmo que ninguém tenha rodado "Gerar Sugestões"
  // ainda para este evento (a linha de atribuição é criada na hora, no
  // primeiro "Pegar para mim"/"Atribuir a...", como já acontece no backend).
  const assignmentByCriterionId = new Map((criterionAssignments ?? []).map(a => [a.criterionId, a]));
  const areaCriteria = activeCriteria
    .filter(c => c.responsibleAreaId != null && principalAreaIds.has(c.responsibleAreaId))
    .map(c => {
      const a = assignmentByCriterionId.get(c.criterionId);
      return {
        criterionId: c.criterionId,
        criterionName: c.criterionName,
        criterionAreaId: c.responsibleAreaId as number,
        assignedToId: a?.assignedToId ?? null,
        assignedToName: a?.assignedToName ?? null,
        status: a?.status ?? "pending",
      };
    });
  if (areaCriteria.length === 0) return null;
  const areaNameById = new Map(myPrincipalAreas.map(a => [a.id, a.name]));
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Users size={22} />
        <h3 className="text-xl md:text-2xl uppercase font-black tracking-tight" style={{ fontFamily: CONDENSED }}>Quesitos da Minha Área</h3>
      </div>
      <p className="text-sm text-muted-foreground px-1 -mt-1">
        Como avaliador principal, você vê todos os quesitos da sua área neste evento e pode atribuir, tomar para si ou passar para outro colega.
      </p>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-secondary">
              <th className="px-4 py-3 text-xs font-bold uppercase text-muted-foreground">Critério</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-muted-foreground">Área</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-muted-foreground">Avaliador Atual</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-muted-foreground text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {areaCriteria.map(a => {
              const isMine = a.assignedToId === userId;
              const isSubmitted = a.status === "submitted";
              return (
                <tr key={a.criterionId} className={isMine ? "bg-accent/10" : ""}>
                  <td className="px-4 py-3 font-bold text-sm">{a.criterionName}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{areaNameById.get(a.criterionAreaId!)}</td>
                  <td className="px-4 py-3 text-sm">
                    {a.assignedToName ?? <span className="text-muted-foreground/50">Sem avaliador</span>}
                    {isSubmitted && <span className="ml-2 text-[11px] font-black uppercase text-accent-text">Enviada</span>}
                  </td>
                  <td className="px-4 py-3 text-right w-px">
                    {isSubmitted ? (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    ) : (
                      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                        {!isMine && (
                          <button
                            type="button"
                            data-testid={`button-take-criterion-${a.criterionId}`}
                            onClick={() => onTakeCriterion(a.criterionId)}
                            className="text-[11px] font-black uppercase border border-border rounded-lg px-2 py-1 hover:bg-primary hover:text-primary-foreground whitespace-nowrap"
                          >
                            Pegar para mim
                          </button>
                        )}
                        <button
                          type="button"
                          data-testid={`button-assign-criterion-${a.criterionId}`}
                          onClick={() => onAssignCriterion({ criterionId: a.criterionId, criterionName: a.criterionName ?? "", areaId: a.criterionAreaId! })}
                          className="text-[11px] font-black uppercase border border-border rounded-lg px-2 py-1 hover:bg-secondary whitespace-nowrap"
                        >
                          Atribuir a...
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
      <DialogContent className="rounded-xl border-border" style={{ backgroundColor: "var(--card)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="text-xl uppercase font-black tracking-tight" style={{ fontFamily: CONDENSED }}>Atribuir "{target?.criterionName}"</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs uppercase text-muted-foreground">Escolha o avaliador da área</Label>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {(users ?? []).map(u => (
              <button
                key={u.id}
                type="button"
                data-testid={`option-assign-user-${u.id}`}
                onClick={() => onPickUser(u.id)}
                className={`w-full text-left px-3 py-2 border border-border rounded-lg text-sm hover:bg-primary hover:text-primary-foreground ${u.id === userId ? "font-bold" : ""}`}
              >
                {u.name}{u.id === userId ? " (você)" : ""}
              </button>
            ))}
            {users?.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum usuário ativo encontrado nesta área.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
