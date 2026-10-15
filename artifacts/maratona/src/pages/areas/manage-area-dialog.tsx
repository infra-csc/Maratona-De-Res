// "Critérios e pessoas" de uma área: os critérios de que ela é a responsável
// e as pessoas que fazem parte dela. Cada marcação grava na hora (a mesma
// chamada de antes: PATCH do critério / do usuário) — por isso não há
// "Salvar", só "Concluir".
import { useEffect, useMemo, useRef, useState } from "react";
import type { Area, Criterion, User } from "@workspace/api-client-react";
import { ArrowRightLeft, Building2, Check, ListChecks, Loader2, SearchX, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { displayCriterionName } from "@/lib/criterion-name";
import { cn, plural } from "@/lib/utils";
import { roleMeta } from "../users/users-ui";
import { evaluatingAreaIdsOf } from "../criteria/helpers";
import { Chip, DialogHeading, Notice, SearchField, btnPrimary, btnSmall, dialogCls, useReturnFocus } from "./areas-ui";
import { norm } from "./model";

type Tab = "criteria" | "users";

export function ManageAreaDialog({ area: areaProp, areas, criteria, users, onToggleCriterion, onToggleUser, pendingCriterionId, pendingUserId, onClose }: {
  area: Area | null;
  areas: Area[];
  criteria: Criterion[];
  users: User[];
  onToggleCriterion: (c: Criterion, belongs: boolean) => void;
  onToggleUser: (u: User, belongs: boolean) => void;
  pendingCriterionId: number | null;
  pendingUserId: number | null;
  onClose: () => void;
}) {
  const open = areaProp !== null;
  // Guarda a última área: o conteúdo fica durante a animação de saída e o foco volta ao gatilho.
  const last = useRef(areaProp);
  if (areaProp) last.current = areaProp;
  const area = areaProp ?? last.current;
  const onCloseAutoFocus = useReturnFocus(open);
  const [tab, setTab] = useState<Tab>("criteria");
  const [search, setSearch] = useState("");
  const [onlyHere, setOnlyHere] = useState(false);
  useEffect(() => { if (open) { setTab("criteria"); setSearch(""); setOnlyHere(false); } }, [open, area?.id]);

  const q = norm(search);
  const critList = useMemo(() => criteria.slice()
    .sort((a, b) => Number(b.active) - Number(a.active) || displayCriterionName(a.name).localeCompare(displayCriterionName(b.name), "pt-BR")),
  [criteria]);
  const userList = useMemo(() => users.slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [users]);

  if (!area) return null;

  const critHere = critList.filter(c => c.responsibleAreaId === area.id);
  const usersHere = userList.filter(u => u.areaId === area.id);
  const critShown = critList.filter(c => (!onlyHere || c.responsibleAreaId === area.id)
    && (!q || norm(displayCriterionName(c.name)).includes(q) || norm(c.responsibleAreaName).includes(q)));
  const usersShown = userList.filter(u => (!onlyHere || u.areaId === area.id)
    && (!q || norm(u.name).includes(q) || norm(u.email).includes(q) || norm(roleMeta(u.role).label).includes(q)));
  const saving = pendingCriterionId != null || pendingUserId != null;

  const tabCls = "font-condensed flex-1 inline-flex items-center justify-center gap-1.5 min-h-11 lg:min-h-9 rounded-md px-3 text-[13px] font-bold uppercase tracking-[0.04em] text-muted-foreground transition-[background-color,color,box-shadow] duration-150 hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent data-testid="manage-area-dialog" onCloseAutoFocus={onCloseAutoFocus}
        className={cn(dialogCls, "max-w-[640px] max-h-[92dvh] flex flex-col gap-4 overflow-hidden")}>
        <DialogHeading icon={Building2} Title={DialogTitle} Description={DialogDescription} title={area.name}
          description="Os critérios de que a área é responsável e as pessoas que fazem parte dela. Cada marcação é gravada na hora." />

        <Tabs value={tab} onValueChange={v => setTab(v as Tab)} className="flex-1 min-h-0 flex flex-col gap-3">
          <TabsList className="grid grid-cols-2 w-full h-auto gap-0.5 rounded-lg bg-secondary p-0.5">
            <TabsTrigger value="criteria" data-testid="tab-area-criteria" className={tabCls}>
              <ListChecks size={14} aria-hidden /> Critérios <span className="tabular-nums opacity-70">{critHere.length}</span>
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-area-users" className={tabCls}>
              <Users size={14} aria-hidden /> Pessoas <span className="tabular-nums opacity-70">{usersHere.length}</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <SearchField value={search} onChange={setSearch} className="flex-1"
              label={tab === "criteria" ? "Buscar critério" : "Buscar pessoa"} placeholder={tab === "criteria" ? "Critério ou área" : "Nome, e-mail ou papel"}
              testId="input-search-manage" />
            <button type="button" aria-pressed={onlyHere} onClick={() => setOnlyHere(v => !v)} data-testid="button-only-here"
              className={cn(btnSmall, "shrink-0 px-3", onlyHere && "bg-secondary border-foreground/30")}>
              {onlyHere && <Check size={14} aria-hidden />} Só desta área
            </button>
          </div>

          <TabsContent value="criteria" className="mt-0 flex-1 min-h-0 flex flex-col gap-2.5 data-[state=inactive]:hidden">
            <Notice icon={ArrowRightLeft} className="text-[12.5px]">
              Cada critério tem <span className="font-semibold text-foreground">uma área responsável</span>. Marcar um critério de outra área traz a responsabilidade para cá.
            </Notice>
            <ListBox empty={critShown.length === 0} emptyText={critList.length === 0 ? "Nenhum critério cadastrado." : "Nenhum critério com esta busca."}>
              {critShown.map(c => {
                const belongs = c.responsibleAreaId === area.id;
                const elsewhere = c.responsibleAreaId != null && !belongs;
                const alsoHere = !belongs && evaluatingAreaIdsOf(c, areas).has(area.id);
                return (
                  <Row key={c.id} testId={`manage-criterion-${c.id}`} id={`mc-${c.id}`} belongs={belongs}
                    pending={pendingCriterionId === c.id} disabled={saving}
                    onToggle={() => onToggleCriterion(c, belongs)}
                    title={displayCriterionName(c.name)}
                    meta={<>
                      {!c.active && <Chip className="h-5 text-[11px]">Inativo</Chip>}
                      {elsewhere && <span className="inline-flex items-center gap-1 text-[var(--status-warn-text)] font-semibold"><ArrowRightLeft size={11} aria-hidden /> Hoje em {c.responsibleAreaName}</span>}
                      {!c.responsibleAreaId && <span>Sem área responsável</span>}
                      {alsoHere && <span>Esta área também responde</span>}
                    </>} />
                );
              })}
            </ListBox>
          </TabsContent>

          <TabsContent value="users" className="mt-0 flex-1 min-h-0 flex flex-col gap-2.5 data-[state=inactive]:hidden">
            <Notice icon={ArrowRightLeft} className="text-[12.5px]">
              Cada pessoa fica em <span className="font-semibold text-foreground">uma área só</span>. Marcar alguém de outra área muda a pessoa para cá; o avaliador passa a responder os critérios desta área.
            </Notice>
            <ListBox empty={usersShown.length === 0} emptyText={userList.length === 0 ? "Nenhum usuário cadastrado." : "Ninguém com esta busca."}>
              {usersShown.map(u => {
                const belongs = u.areaId === area.id;
                const elsewhere = u.areaId != null && !belongs;
                return (
                  <Row key={u.id} testId={`manage-user-${u.id}`} id={`mu-${u.id}`} belongs={belongs}
                    pending={pendingUserId === u.id} disabled={saving}
                    onToggle={() => onToggleUser(u, belongs)}
                    title={u.name}
                    titleCls="normal-case font-body text-[14px] font-semibold tracking-normal"
                    meta={<>
                      <span className="font-semibold text-foreground/80">{roleMeta(u.role).label}</span>
                      {u.email && <span className="truncate max-w-[24ch]">{u.email}</span>}
                      {!u.active && <Chip className="h-5 text-[11px]">Inativo</Chip>}
                      {elsewhere && <span className="inline-flex items-center gap-1 text-[var(--status-warn-text)] font-semibold"><ArrowRightLeft size={11} aria-hidden /> Hoje em {u.areaName}</span>}
                    </>} />
                );
              })}
            </ListBox>
          </TabsContent>
        </Tabs>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-t border-border pt-4 -mx-5 sm:-mx-6 px-5 sm:px-6">
          <p role="status" aria-live="polite" className="sm:mr-auto text-[12.5px] text-muted-foreground inline-flex items-center gap-1.5 min-h-5">
            {saving
              ? <><Loader2 size={13} aria-hidden className="motion-safe:animate-spin" /> Gravando…</>
              : <>{plural(critHere.length, "critério", "critérios")} · {plural(usersHere.length, "pessoa", "pessoas")} nesta área</>}
          </p>
          <button type="button" data-testid="button-close-manage" onClick={onClose} className={btnPrimary}>Concluir</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ListBox({ empty, emptyText, children }: { empty: boolean; emptyText: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 min-h-[180px] sm:min-h-[300px] overflow-y-auto overscroll-contain rounded-xl border border-border">
      {empty ? (
        <div className="h-full min-h-[180px] flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <SearchX size={20} aria-hidden className="text-muted-foreground" />
          <p className="text-[13.5px] text-muted-foreground">{emptyText}</p>
        </div>
      ) : <ul className="divide-y divide-border">{children}</ul>}
    </div>
  );
}

function Row({ id, testId, belongs, pending, disabled, onToggle, title, titleCls, meta }: {
  id: string; testId: string; belongs: boolean; pending: boolean; disabled: boolean;
  onToggle: () => void; title: string; titleCls?: string; meta: React.ReactNode;
}) {
  return (
    <li>
      <label htmlFor={id} data-testid={testId}
        className={cn(
          "flex items-center gap-3 px-3.5 py-2.5 min-h-[52px] transition-colors duration-150",
          disabled ? "cursor-wait" : "cursor-pointer hover:bg-secondary/50",
          belongs && "bg-secondary/60 shadow-[inset_3px_0_0_var(--foreground)]",
        )}>
        <span className="w-5 h-5 shrink-0 inline-flex items-center justify-center">
          {pending
            ? <Loader2 size={15} aria-label="Gravando" className="motion-safe:animate-spin text-muted-foreground" />
            : <Checkbox id={id} checked={belongs} disabled={disabled} onCheckedChange={onToggle} className="h-[18px] w-[18px] rounded-[5px]" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block font-condensed text-[15px] font-bold uppercase tracking-[0.02em] leading-tight text-foreground truncate", titleCls)}>{title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] leading-snug text-muted-foreground">{meta}</span>
        </span>
        {belongs && !pending && <Chip tone="ok" className="h-5 text-[11px] hidden sm:inline-flex">Nesta área</Chip>}
      </label>
    </li>
  );
}
