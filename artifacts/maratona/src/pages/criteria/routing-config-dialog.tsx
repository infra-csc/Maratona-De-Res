// "Roteamento e link" de um critério: avaliador principal, para onde pode
// redirecionar e se permite link para freela. O PUT substitui o roteamento
// inteiro, então o que a tela não edita (comentário obrigatório, avaliador da
// matriz) é reenviado como estava.
import { useState } from "react";
import type { Criterion } from "@workspace/api-client-react";
import { AlertTriangle, Check, Info, Loader2, Route, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useSaveCriterionRouting } from "@/lib/routing-api";
import type { CriterionRouting } from "@/lib/routing-api";
import { displayCriterionName } from "@/lib/criterion-name";
import { cn, plural } from "@/lib/utils";
import { SwitchRow } from "../cycles/cycles-ui";
import { DialogHeading, Eyebrow, FOCUS_RING, FieldLabel, Notice, Segmented, btnPrimary, btnSecondary, dialogCls, dialogFooterCls, inputCls, useReturnFocus } from "./criteria-ui";
import { evaluatorsForArea, serverMessage } from "./helpers";
import { extraAreasOf } from "./evaluating-areas";
import type { AreaOption, EvaluatorOption } from "./types";

type RedirectMode = "none" | "area" | "specific";

/** Casca do diálogo; o formulário monta de novo a cada critério aberto. */
export function CriterionRoutingDialog({
  criterionId, criterion, currentRouting, areas, evaluators, areaMode, onClose,
}: {
  criterionId: number | null;
  criterion: Criterion | null | undefined;
  currentRouting: CriterionRouting | undefined;
  areas: AreaOption[];
  evaluators: (EvaluatorOption & { areaId?: number | null })[];
  areaMode: boolean;
  onClose: () => void;
}) {
  const open = criterionId !== null;
  const onCloseAutoFocus = useReturnFocus(open);
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !pending) onClose(); }}>
      <DialogContent className={cn(dialogCls, "max-w-[560px] max-h-[92dvh] overflow-y-auto")} data-testid="routing-dialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeading icon={Route} Title={DialogTitle} Description={DialogDescription} title="Roteamento e link"
          description={criterion ? <><span className="font-semibold text-foreground">{displayCriterionName(criterion.name)}</span>{criterion.responsibleAreaName ? ` · ${criterion.responsibleAreaName}` : ""}</> : undefined} />
        {criterionId !== null && criterion && (
          <RoutingForm
            key={criterionId}
            criterion={criterion}
            currentRouting={currentRouting}
            areas={areas}
            evaluators={evaluatorsForArea(evaluators, criterion.responsibleAreaId)}
            areaMode={areaMode}
            onPendingChange={setPending}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RoutingForm({ criterion, currentRouting, areas, evaluators, areaMode, onPendingChange, onClose }: {
  criterion: Criterion;
  currentRouting: CriterionRouting | undefined;
  areas: AreaOption[];
  evaluators: EvaluatorOption[];
  areaMode: boolean;
  onPendingChange: (p: boolean) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const saveMutation = useSaveCriterionRouting(criterion.id);
  const id = `routing-${criterion.id}`;

  const [defaultEvaluatorId, setDefaultEvaluatorId] = useState<number | null>(currentRouting?.defaultEvaluatorId ?? null);
  const [redirectMode, setRedirectMode] = useState<RedirectMode>(currentRouting?.redirectMode ?? "none");
  const [redirectAreaId, setRedirectAreaId] = useState<number | null>(currentRouting?.redirectAreaId ?? null);
  const [selectedRedirectUsers, setSelectedRedirectUsers] = useState<Set<number>>(new Set(currentRouting?.redirectUsers?.map(u => u.id) ?? []));
  const [evalSearch, setEvalSearch] = useState("");
  const [redirectSearch, setRedirectSearch] = useState("");
  const [allowPublicLink, setAllowPublicLink] = useState(currentRouting?.allowPublicLink ?? false);
  const [error, setError] = useState<string | null>(null);

  const extras = extraAreasOf(criterion, areas);
  const evalQ = evalSearch.trim().toLowerCase();
  const filteredEvaluators = evaluators.filter(u => u.name.toLowerCase().includes(evalQ));
  const redirectQ = redirectSearch.trim().toLowerCase();
  const filteredRedirect = evaluators.filter(u => u.name.toLowerCase().includes(redirectQ));
  const pending = saveMutation.isPending;

  const toggleRedirectUser = (userId: number) => {
    setSelectedRedirectUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  const handleSave = () => {
    setError(null);
    onPendingChange(true);
    saveMutation.mutate({
      defaultEvaluatorId,
      conformityEvaluatorId: currentRouting?.conformityEvaluatorId ?? null,
      commentRequired: currentRouting?.commentRequired ?? true,
      redirectMode,
      redirectAreaId: redirectMode === "area" ? redirectAreaId : null,
      redirectUserIds: redirectMode === "specific" ? Array.from(selectedRedirectUsers) : undefined,
      allowPublicLink,
    }, {
      onSuccess: () => { onPendingChange(false); toast({ title: "Roteamento salvo", description: displayCriterionName(criterion.name) }); onClose(); },
      onError: (e: unknown) => { onPendingChange(false); setError(serverMessage(e)); },
    });
  };

  return (
    <div className="space-y-5">
      {areaMode && (
        <Notice icon={Info} tone="info" testId="routing-area-mode-notice">
          <span className="font-semibold text-foreground">Ciclo por área:</span> qualquer avaliador da área responde e a primeira resposta enviada fecha o critério. Avaliador principal e redirecionamento valem nos ciclos com designação.
        </Notice>
      )}

      {/* Avaliador principal */}
      <section aria-labelledby={`${id}-main`} className="space-y-2">
        <div>
          <Eyebrow as="h3" id={`${id}-main`}>Avaliador principal</Eyebrow>
          <p className="mt-1 text-[13px] text-muted-foreground">Vem designado ao liberar as avaliações de um evento.</p>
        </div>
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="relative border-b border-border">
            <Search size={14} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input type="search" value={evalSearch} onChange={e => setEvalSearch(e.target.value)} aria-label="Buscar avaliador principal" placeholder="Buscar avaliador"
              className="w-full h-11 bg-card pl-9 pr-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-secondary/40 [&::-webkit-search-cancel-button]:hidden" />
          </div>
          <div role="radiogroup" aria-labelledby={`${id}-main`} className="max-h-44 overflow-y-auto p-1">
            {filteredEvaluators.length === 0 && (
              <p className="px-3 py-4 text-center text-[13px] text-muted-foreground">{evaluators.length === 0 ? "Nenhum avaliador ativo nesta área." : <>Ninguém com “{evalSearch.trim()}”.</>}</p>
            )}
            {filteredEvaluators.map(u => {
              const on = u.id === defaultEvaluatorId;
              return (
                <button key={u.id} type="button" role="radio" aria-checked={on} disabled={pending} onClick={() => setDefaultEvaluatorId(u.id)}
                  className={cn("w-full flex items-center gap-2 min-h-11 lg:min-h-9 px-2.5 rounded-md text-left text-[14px] transition-colors duration-150 hover:bg-secondary", on && "bg-secondary/70 font-semibold", FOCUS_RING, "focus-visible:ring-offset-0")}>
                  <span className={cn("w-4 h-4 shrink-0 rounded-full border flex items-center justify-center", on ? "border-foreground bg-foreground text-background" : "border-border")}>
                    {on && <Check size={10} aria-hidden strokeWidth={3} />}
                  </span>
                  <span className="truncate">{u.name}</span>
                </button>
              );
            })}
          </div>
        </div>
        {defaultEvaluatorId == null && (
          areaMode
            ? <p className="text-[12.5px] text-muted-foreground">Sem principal: neste ciclo é o normal.</p>
            : <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--status-warn-text)]"><AlertTriangle size={13} aria-hidden /> Sem avaliador principal: ninguém vem designado ao liberar o evento.</p>
        )}
      </section>

      {/* Redirecionamento */}
      <section aria-labelledby={`${id}-redirect`} className="space-y-2.5 pt-4 border-t border-border">
        <div>
          <Eyebrow as="h3" id={`${id}-redirect`}>Quando o principal não puder</Eyebrow>
          <p className="mt-1 text-[13px] text-muted-foreground">Para quem ele pode passar a avaliação.</p>
        </div>
        <Segmented<RedirectMode>
          label="Redirecionamento"
          value={redirectMode}
          onChange={v => setRedirectMode(v)}
          disabled={pending}
          options={[
            { value: "none", label: "Não redireciona", testId: "redirect-mode-none" },
            { value: "area", label: "Uma área", testId: "redirect-mode-area" },
            { value: "specific", label: "Pessoas", testId: "redirect-mode-specific" },
          ]}
        />
        {redirectMode === "area" && (
          <div>
            <FieldLabel htmlFor={`${id}-redirect-area`}>Área de redirecionamento</FieldLabel>
            <Select value={redirectAreaId != null ? String(redirectAreaId) : undefined} onValueChange={v => setRedirectAreaId(parseInt(v))} disabled={pending}>
              <SelectTrigger id={`${id}-redirect-area`} className={cn(inputCls, "justify-between")}>
                <SelectValue placeholder="Selecione a área…" />
              </SelectTrigger>
              <SelectContent>
                {areas.filter(a => a.active !== false || a.id === redirectAreaId).map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">Qualquer usuário dessa área pode receber.</p>
          </div>
        )}
        {redirectMode === "specific" && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/40">
              <span className="text-[13px] font-semibold text-foreground" aria-live="polite">
                {selectedRedirectUsers.size === 0 ? "Ninguém marcado" : plural(selectedRedirectUsers.size, "pessoa marcada", "pessoas marcadas")}
              </span>
              <div className="relative ml-auto w-[min(200px,50%)]">
                <Search size={13} aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input type="search" value={redirectSearch} onChange={e => setRedirectSearch(e.target.value)} aria-label="Buscar pessoa para redirecionamento" placeholder="Buscar"
                  className="w-full h-11 lg:h-8 rounded-md border border-border bg-card pl-8 pr-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 [&::-webkit-search-cancel-button]:hidden" />
              </div>
            </div>
            <div className="max-h-44 overflow-y-auto p-1">
              {filteredRedirect.length === 0 ? (
                <p className="px-3 py-4 text-center text-[13px] text-muted-foreground">Ninguém com “{redirectSearch.trim()}”.</p>
              ) : filteredRedirect.map(u => {
                const on = selectedRedirectUsers.has(u.id);
                const cbId = `${id}-redirect-user-${u.id}`;
                return (
                  <label key={u.id} htmlFor={cbId} className={cn("flex items-center gap-2.5 min-h-11 lg:min-h-9 px-2.5 rounded-md cursor-pointer text-[14px] transition-colors duration-150 hover:bg-secondary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring", on && "bg-secondary/70")}>
                    <input id={cbId} type="checkbox" checked={on} onChange={() => toggleRedirectUser(u.id)} disabled={pending} className="w-4 h-4 shrink-0 accent-[var(--foreground)]" />
                    <span className={cn("truncate", on && "font-semibold")}>{u.name}</span>
                    {u.id === defaultEvaluatorId && <span className="ml-auto font-condensed text-[11.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground">Principal</span>}
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Link para freela */}
      <div className="pt-4 border-t border-border">
        <SwitchRow
          id={`${id}-public-link`}
          testId="routing-public-link"
          title="Permite link para freela"
          control={<Switch id={`${id}-public-link`} checked={allowPublicLink} onCheckedChange={setAllowPublicLink} disabled={pending} className="data-[state=unchecked]:bg-muted-foreground/40" />}
        >
          Libera um link de avaliação sem conta no sistema, para quem é freela. Use nas áreas que recebem freelas (Ativação, Produção, Cenografia); Logística e Atendimento são time da casa.
          {extras.length > 0 && <span className="block mt-1 font-semibold text-foreground">Vale para todas as {1 + extras.length} áreas que avaliam este critério.</span>}
        </SwitchRow>
      </div>

      {error && (
        <Notice icon={AlertTriangle} tone="danger" testId="routing-save-error">
          <p className="font-semibold text-foreground">Não foi possível salvar o roteamento</p>
          <p className="mt-0.5">{error}</p>
        </Notice>
      )}

      <div className={dialogFooterCls}>
        <button type="button" onClick={onClose} disabled={pending} className={btnSecondary}>Cancelar</button>
        <button type="button" data-testid="button-save-routing" disabled={pending} aria-busy={pending || undefined} onClick={handleSave} className={btnPrimary}>
          {pending && <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" />}
          {pending ? "Salvando…" : "Salvar roteamento"}
        </button>
      </div>
    </div>
  );
}
