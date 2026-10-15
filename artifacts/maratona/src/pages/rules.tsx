// Tela "Regras do Sistema": as regras GERAIS (valem quando o ciclo não
// define a sua) e as faixas de bônus. O topo mostra o que o ciclo atual usa
// de fato — as regras próprias do ciclo se mudam em Ciclos. Peças em
// ./rules/ (regras, faixas, diálogos e o hook das faixas).
import { useState } from "react";
import {
  useGetRules, useUpdateRule, useGetPlatoonRules, useGetCurrentCycle,
  getGetRulesQueryKey, getGetPlatoonRulesQueryKey,
} from "@workspace/api-client-react";
import type { Rule } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, hasRole } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Bone, Chip, ErrorBlock, serverMessage, surfaceCls } from "./rules/rules-ui";
import { RULE_META, type GroupKey } from "./rules/rule-meta";
import { CycleRulesPanel, RulesGroup, type RuleEditing } from "./rules/general-rules";
import { BandsSection } from "./rules/bands-section";
import { useBands } from "./rules/use-bands";
import { DeleteBandDialog, ReplaceBandsDialog } from "./rules/rules-dialogs";

function RulesSkeleton() {
  return (
    <div role="status" aria-label="Carregando regras" className="space-y-6">
      <div className={cn(surfaceCls, "h-[150px]")}><div className="p-5 space-y-3"><Bone className="h-4 w-64 max-w-full" /><Bone className="h-3 w-96 max-w-full" /></div></div>
      {[0, 1].map(s => (
        <div key={s} className="space-y-2.5">
          <Bone className="h-3 w-40" />
          <div className={cn(surfaceCls, "divide-y divide-border")}>
            {[0, 1].map(i => <div key={i} className="px-5 py-4 flex items-start gap-6"><div className="flex-1 space-y-2"><Bone className="h-4 w-56 max-w-full" /><Bone className="h-3 w-[420px] max-w-full" /></div><Bone className="h-10 w-40" /></div>)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RulesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  // Espelha o backend: PATCH /rules e /platoon-rules = admin|rh|diretoria; DELETE /platoon-rules/:id = admin|rh.
  const canEdit = hasRole(user, "admin") || hasRole(user, "rh") || hasRole(user, "diretoria");
  const canDeleteBand = hasRole(user, "admin") || hasRole(user, "rh");

  const rulesQKey = getGetRulesQueryKey();
  const bandsQKey = getGetPlatoonRulesQueryKey();
  const { data: rules, isLoading, isError, refetch } = useGetRules({ query: { queryKey: rulesQKey } });
  const { data: bands, isLoading: bandsLoading, isError: bandsError, refetch: refetchBands } = useGetPlatoonRules({ query: { queryKey: bandsQKey } });
  const { data: cycle } = useGetCurrentCycle();
  const bandsState = useBands(bandsQKey, bands);

  const [values, setValues] = useState<Record<string, string>>({});
  const updateRule = useUpdateRule({
    mutation: {
      onSuccess: (_r, vars) => {
        qc.invalidateQueries({ queryKey: rulesQKey });
        setValues(prev => { const n = { ...prev }; delete n[vars.key]; return n; });
        toast({ title: "Regra salva", description: RULE_META[vars.key]?.label });
      },
      onError: (e: unknown) => toast({ title: "Não foi possível salvar a regra", description: serverMessage(e), variant: "destructive" }),
    },
  });
  const editing: RuleEditing = {
    values,
    setValue: (k, v) => setValues(prev => ({ ...prev, [k]: v })),
    reset: k => setValues(prev => { const n = { ...prev }; delete n[k]; return n; }),
    save: (key, value) => updateRule.mutate({ key, data: { value } }),
    savingKey: updateRule.isPending ? updateRule.variables?.key ?? null : null,
    canEdit,
  };

  const byGroup = (g: GroupKey) => (rules ?? []).filter(r => RULE_META[r.key]?.group === g);
  const others: Rule[] = (rules ?? []).filter(r => !RULE_META[r.key]);
  const generalMin = (rules ?? []).find(r => r.key === "min_events_eligibility")?.value;

  return (
    <div className="min-h-full flex flex-col min-w-0 font-body">
      <div className="md:sticky md:top-0 z-30 bg-card border-b border-border px-4 md:px-6 py-3 lg:py-0 lg:h-16 flex items-center gap-3 lg:gap-5">
        <h1 data-testid="text-page-title" className="min-w-0 font-condensed text-[24px] sm:text-[26px] uppercase tracking-[-0.01em] font-black leading-none text-foreground truncate">Regras do Sistema</h1>
        <p className="hidden xl:block min-w-0 truncate text-[13px] text-muted-foreground">Regras gerais do cálculo e as faixas de bônus. O que é de cada ciclo fica em Ciclos.</p>
        {!canEdit && <Chip icon={Eye} className="ml-auto" title="Seu perfil só consulta as regras">Só consulta</Chip>}
      </div>

      <div className="flex-1 px-4 md:px-6 py-5 space-y-7 max-w-[1280px] w-full mx-auto">
        {isLoading ? <RulesSkeleton /> : isError || !rules ? (
          <ErrorBlock title="Não foi possível carregar as regras" onRetry={() => { void refetch(); }} />
        ) : (
          <>
            <CycleRulesPanel cycle={cycle} generalMin={generalMin} />
            <div className="space-y-7">
              <RulesGroup group="elegibilidade" rules={byGroup("elegibilidade")} editing={editing} cycle={cycle} />
              <RulesGroup group="avaliacao" rules={byGroup("avaliacao")} editing={editing} cycle={cycle} />
              <RulesGroup group="pagamento" rules={byGroup("pagamento")} editing={editing} cycle={cycle} />
            </div>
            {bandsLoading ? (
              <div role="status" aria-label="Carregando faixas" className={cn(surfaceCls, "p-5 space-y-3")}><Bone className="h-7 w-full" />{[0, 1, 2].map(i => <Bone key={i} className="h-10 w-full" />)}</div>
            ) : bandsError || !bands ? (
              <ErrorBlock title="Não foi possível carregar as faixas" onRetry={() => { void refetchBands(); }} />
            ) : (
              <BandsSection bands={bands} state={bandsState} canEdit={canEdit} canDelete={canDeleteBand} />
            )}
            <RulesGroup group="outras" rules={others} editing={editing} cycle={cycle} />
          </>
        )}
      </div>

      <DeleteBandDialog state={bandsState} />
      <ReplaceBandsDialog state={bandsState} currentCount={bands?.length ?? 0} />
    </div>
  );
}
