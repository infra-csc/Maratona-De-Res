import { useState } from "react";
import {
  useGetRules, useUpdateRule,
  useGetPlatoonRules, useUpdatePlatoonRule, useCreatePlatoonRule, useDeletePlatoonRule,
  getGetRulesQueryKey, getGetPlatoonRulesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Save, CircleDollarSign, Plus, Settings, ShieldCheck, Trash2, HelpCircle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePremiumTheme, CONDENSED, BODY } from "@/lib/premium-theme";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const PAYMENT_OPTIONS = [
  { value: "caju", label: "Caju" },
  { value: "pix", label: "PIX" },
  { value: "transferencia", label: "Transferência Bancária" },
  { value: "outro", label: "Outro" },
];

const RULE_META: Record<string, { group: string; label: string; help: string; inputType: "text" | "number" | "select" }> = {
  max_score: {
    group: "avaliacao",
    label: "Pontuação Máxima por Critério",
    help: "Pontuação máxima por critério em cada avaliação (escala 0–10 por padrão). Atenção: alterar esse valor não recalcula avaliações já lançadas. Recomenda-se mudar somente antes do primeiro evento do ciclo.",
    inputType: "number",
  },
  min_evaluations_to_close: {
    group: "avaliacao",
    label: "Mínimo de Avaliações para Fechar Evento",
    help: "Número mínimo de avaliadores que precisam submeter a avaliação de um evento para que ele possa ser fechado e enviado para calibragem. Por exemplo, se configurado como 1, basta um avaliador submeter para o evento estar fechável.",
    inputType: "number",
  },
  absence_penalty_per_absence: {
    group: "elegibilidade",
    label: "Penalidade por Ausência Não Comunicada",
    help: "Desconto (em pontos, escala 0–100) aplicado à nota final do colaborador por cada lançamento de 'Ausência Não Comunicada' registrado na tela de Penalidades e Méritos. O sistema NÃO lança faltas automaticamente — o RH ou Admin registra cada ocorrência manualmente.",
    inputType: "number",
  },
  min_events_eligibility: {
    group: "elegibilidade",
    label: "Mínimo de Eventos para Elegibilidade ao Bônus",
    help: "Número mínimo de eventos que o colaborador deve ter participado no ciclo para ser elegível ao bônus. Este número reflete em todas as telas: Dashboard do Colaborador, Bônus & Pagamentos e Simulador de Bônus.",
    inputType: "number",
  },
  cycle_bonus_paid_by: {
    group: "pagamento",
    label: "Forma de Pagamento do Bônus do Ciclo",
    help: "Como o bônus do ciclo será pago aos colaboradores. Aparece nas exportações e relatórios para consistência. Escolha uma das opções padronizadas.",
    inputType: "select",
  },
};

const GROUP_META = {
  avaliacao: {
    icon: Settings,
    title: "Regras de Avaliação",
    subtitle: "Parâmetros que controlam o cálculo das notas e o processo de avaliação de eventos",
    color: "bg-[#191c1e]",
  },
  elegibilidade: {
    icon: ShieldCheck,
    title: "Elegibilidade & Penalidade",
    subtitle: "Critérios de elegibilidade ao bônus e desconto por penalidades",
    color: "bg-[#191c1e]",
  },
  pagamento: {
    icon: CircleDollarSign,
    title: "Pagamento & Bônus",
    subtitle: "Forma de pagamento e simulador de faixas de bônus",
    color: "bg-[#191c1e]",
  },
};

export default function RulesPage() {
  const { toast } = useToast();
  usePremiumTheme();
  const qc = useQueryClient();

  const rulesQKey = getGetRulesQueryKey();
  const platoonQKey = getGetPlatoonRulesQueryKey();

  const { data: rules } = useGetRules({ query: { queryKey: rulesQKey } });
  const { data: platoonRules } = useGetPlatoonRules({ query: { queryKey: platoonQKey } });

  const [ruleValues, setRuleValues] = useState<Record<string, string>>({});
  const [platoonValues, setPlatoonValues] = useState<Record<number, Partial<{ name: string; minScore: number; maxScore: number; bonusValue: number; bonusPerExtraEvent: number }>>>({});
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  const updateRuleMutation = useUpdateRule({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: rulesQKey }); toast({ title: "Regra atualizada com sucesso" }); },
      onError: (e: { message?: string }) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
    },
  });

  const updatePlatoonMutation = useUpdatePlatoonRule({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: platoonQKey }); toast({ title: "Faixa atualizada com sucesso" }); },
    },
  });

  const [newBand, setNewBand] = useState({ name: "", minScore: "", maxScore: "", bonusValue: "", bonusPerExtraEvent: "" });

  const createPlatoonMutation = useCreatePlatoonRule({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: platoonQKey });
        toast({ title: "Faixa adicionada com sucesso" });
        setNewBand({ name: "", minScore: "", maxScore: "", bonusValue: "", bonusPerExtraEvent: "" });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao adicionar faixa", description: e.message, variant: "destructive" }),
    },
  });

  const deletePlatoonMutation = useDeletePlatoonRule({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: platoonQKey }); setDeleteTargetId(null); toast({ title: "Faixa removida" }); },
      onError: () => toast({ title: "Erro ao remover faixa", variant: "destructive" }),
    },
  });

  function findOverlappingBand(min: number, max: number, excludeId?: number) {
    return (platoonRules ?? []).find(p => p.id !== excludeId && min <= Number(p.maxScore) && max >= Number(p.minScore));
  }

  function handleCreateBand() {
    if (newBand.minScore === "" || newBand.maxScore === "") {
      toast({ title: "Preencha nota mínima e máxima", variant: "destructive" });
      return;
    }
    const min = parseFloat(newBand.minScore);
    const max = parseFloat(newBand.maxScore);
    if (min > max) {
      toast({ title: "Nota mínima não pode ser maior que a máxima", variant: "destructive" });
      return;
    }
    const conflict = findOverlappingBand(min, max);
    if (conflict) {
      toast({ title: "Faixa sobreposta", description: `O intervalo ${min}–${max} sobrepõe a faixa "${conflict.name}" (${conflict.minScore}–${conflict.maxScore}).`, variant: "destructive" });
      return;
    }
    const bandName = newBand.name.trim() || `${min}–${max}`;
    createPlatoonMutation.mutate({
      data: {
        name: bandName,
        color: "#94a3b8",
        minScore: min,
        maxScore: max,
        bonusValue: parseFloat(newBand.bonusValue || "0"),
        bonusPerExtraEvent: parseFloat(newBand.bonusPerExtraEvent || "0"),
      },
    });
  }

  function getRuleValue(key: string, defaultVal: string) {
    return ruleValues[key] ?? defaultVal;
  }

  const rulesByGroup = {
    avaliacao: (rules ?? []).filter(r => RULE_META[r.key]?.group === "avaliacao"),
    elegibilidade: (rules ?? []).filter(r => RULE_META[r.key]?.group === "elegibilidade"),
    pagamento: (rules ?? []).filter(r => RULE_META[r.key]?.group === "pagamento"),
    unknown: (rules ?? []).filter(r => !RULE_META[r.key]),
  };

  return (
    <div className="min-h-full" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>
      <div className="p-6 md:p-10 space-y-8">

        {/* ── Header ── */}
        <section className="flex items-start gap-4">
          <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: "var(--accent)", minHeight: "3.5rem" }} />
          <div>
            <h1 data-testid="text-page-title" className="font-black uppercase leading-none" style={{ fontFamily: CONDENSED, fontSize: "clamp(2rem,5vw,3.2rem)", letterSpacing: "-0.02em" }}>
              Regras do <span style={{ color: "var(--accent)" }}>Sistema</span>
            </h1>
            <p className="text-sm mt-1.5 max-w-2xl" style={{ color: "var(--muted-foreground)" }}>
              Defina os parâmetros de cálculo e as bonificações financeiras por faixa de nota. A agressividade das regras dita o ritmo da corrida.
            </p>
          </div>
        </section>

        <RuleSection groupKey="avaliacao" rules={rulesByGroup.avaliacao} ruleValues={ruleValues} setRuleValues={setRuleValues} getRuleValue={getRuleValue} updateRuleMutation={updateRuleMutation} />
        <RuleSection groupKey="elegibilidade" rules={rulesByGroup.elegibilidade} ruleValues={ruleValues} setRuleValues={setRuleValues} getRuleValue={getRuleValue} updateRuleMutation={updateRuleMutation} />

        {/* ── Pagamento & Bônus ── */}
        <section className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-3.5 flex items-center gap-3" style={{ backgroundColor: "#191c1e" }}>
            <CircleDollarSign size={18} style={{ color: "#d4ff00" }} />
            <div>
              <h3 className="font-black uppercase tracking-wider text-sm" style={{ color: "#d4ff00", fontFamily: CONDENSED }}>Pagamento & Bônus</h3>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "rgba(212,255,0,0.55)" }}>Forma de pagamento e simulador de faixas de bônus financeiro</p>
            </div>
          </div>

          {rulesByGroup.pagamento.map(rule => {
            const meta = RULE_META[rule.key];
            const currentVal = getRuleValue(rule.key, rule.value);
            const isDirty = ruleValues[rule.key] !== undefined && ruleValues[rule.key] !== rule.value;
            return (
              <div key={rule.key} className="p-5" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-start gap-2 mb-3">
                  <p className="text-sm font-black uppercase tracking-tight flex-1" style={{ color: "var(--foreground)" }}>{meta?.label ?? rule.description}</p>
                  <HelpTooltip text={meta?.help ?? ""} />
                </div>
                <div className="flex gap-2 max-w-xs">
                  <Select
                    value={PAYMENT_OPTIONS.some(o => o.value === currentVal) ? currentVal : "outro"}
                    onValueChange={v => setRuleValues(prev => ({ ...prev, [rule.key]: v }))}
                  >
                    <SelectTrigger className="h-10 rounded-lg text-xs font-bold uppercase" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <button
                    data-testid={`button-save-rule-${rule.key}`}
                    className="h-10 px-4 shrink-0 flex items-center rounded-lg font-bold text-xs uppercase disabled:opacity-40 disabled:pointer-events-none transition-opacity hover:opacity-80"
                    style={{ backgroundColor: isDirty ? "var(--accent)" : "var(--secondary)", color: isDirty ? "var(--accent-foreground)" : "var(--muted-foreground)", border: "1px solid var(--border)" }}
                    disabled={updateRuleMutation.isPending || !isDirty}
                    onClick={() => updateRuleMutation.mutate({ key: rule.key, data: { value: currentVal } })}
                  >
                    <Save size={14} className="mr-1.5" /> Salvar
                  </button>
                </div>
              </div>
            );
          })}

          <div className="px-5 py-3 text-sm italic" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>
            <span className="font-black" style={{ color: "var(--foreground)" }}>Bônus Total</span> = Prêmio Base da faixa + (Eventos Extras × Bônus por Evento Extra da faixa)
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nome / Nota</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-center" style={{ color: "var(--muted-foreground)" }}>Prêmio Base (R$)</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-center" style={{ color: "var(--muted-foreground)" }}>Bônus/Evento Extra (R$)</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-center" style={{ color: "var(--muted-foreground)" }}>Exemplo (Base+3)</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-right" style={{ color: "var(--muted-foreground)" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {(platoonRules ?? []).map(p => {
                  const isDirty = platoonValues[p.id] !== undefined;
                  const currentBonus = platoonValues[p.id]?.bonusValue ?? Number(p.bonusValue);
                  const currentExtra = platoonValues[p.id]?.bonusPerExtraEvent ?? Number(p.bonusPerExtraEvent ?? 0);
                  const currentName = platoonValues[p.id]?.name ?? p.name ?? "";
                  const total3 = currentBonus + 3 * currentExtra;
                  return (
                    <tr
                      key={p.id}
                      data-testid={`row-platoon-${p.id}`}
                      className="transition-colors"
                      style={{ borderTop: "1px solid var(--border)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "var(--secondary)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"; }}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1.5">
                          <Input placeholder="Nome (opcional)" className="w-36 h-8 rounded-lg text-xs font-bold" value={currentName} onChange={e => setPlatoonValues(v => ({ ...v, [p.id]: { ...v[p.id], name: e.target.value } }))} />
                          <div className="flex items-center gap-1">
                            <Input data-testid={`input-platoon-min-${p.id}`} type="number" min="0" max="100" step="1" className="w-16 text-center h-8 rounded-lg text-sm font-black" value={platoonValues[p.id]?.minScore ?? p.minScore} onChange={e => setPlatoonValues(v => ({ ...v, [p.id]: { ...v[p.id], minScore: parseFloat(e.target.value) } }))} />
                            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>–</span>
                            <Input data-testid={`input-platoon-max-${p.id}`} type="number" min="0" max="100" step="1" className="w-16 text-center h-8 rounded-lg text-sm font-black" value={platoonValues[p.id]?.maxScore ?? p.maxScore} onChange={e => setPlatoonValues(v => ({ ...v, [p.id]: { ...v[p.id], maxScore: parseFloat(e.target.value) } }))} />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="relative max-w-[120px] mx-auto">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black z-10" style={{ color: "var(--accent)" }}>R$</span>
                          <Input data-testid={`input-platoon-bonus-${p.id}`} type="number" min="0" step="100" className="w-full text-right h-10 rounded-lg font-black" value={currentBonus} onChange={e => setPlatoonValues(v => ({ ...v, [p.id]: { ...v[p.id], bonusValue: parseFloat(e.target.value) } }))} />
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="relative max-w-[120px] mx-auto">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black z-10" style={{ color: "var(--accent)" }}>R$</span>
                          <Input data-testid={`input-platoon-extra-${p.id}`} type="number" min="0" step="50" className="w-full text-right h-10 rounded-lg font-black" value={currentExtra} onChange={e => setPlatoonValues(v => ({ ...v, [p.id]: { ...v[p.id], bonusPerExtraEvent: parseFloat(e.target.value) } }))} />
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="text-sm font-black" style={{ color: "var(--foreground)" }}>{fmtBRL(total3)}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            data-testid={`button-save-platoon-${p.id}`}
                            className="inline-flex items-center px-3 py-1.5 rounded-lg font-bold text-xs uppercase disabled:opacity-40 disabled:pointer-events-none transition-opacity hover:opacity-80"
                            style={{ backgroundColor: isDirty ? "var(--accent)" : "var(--secondary)", color: isDirty ? "var(--accent-foreground)" : "var(--muted-foreground)", border: "1px solid var(--border)" }}
                            disabled={!isDirty || updatePlatoonMutation.isPending}
                            onClick={() => {
                              if (!platoonValues[p.id]) return;
                              const min = platoonValues[p.id]?.minScore ?? Number(p.minScore);
                              const max = platoonValues[p.id]?.maxScore ?? Number(p.maxScore);
                              if (min > max) { toast({ title: "Nota mínima não pode ser maior que a máxima", variant: "destructive" }); return; }
                              const conflict = findOverlappingBand(min, max, p.id);
                              if (conflict) { toast({ title: "Faixa sobreposta", description: `O intervalo ${min}–${max} sobrepõe a faixa "${conflict.name}" (${conflict.minScore}–${conflict.maxScore}).`, variant: "destructive" }); return; }
                              updatePlatoonMutation.mutate({ id: p.id, data: platoonValues[p.id] });
                            }}
                          >
                            <Save size={13} className="mr-1" /> Salvar
                          </button>
                          <button
                            data-testid={`button-delete-platoon-${p.id}`}
                            className="p-1.5 rounded transition-colors"
                            style={{ color: "var(--muted-foreground)" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#e5484d"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted-foreground)"; }}
                            onClick={() => setDeleteTargetId(p.id)}
                            title="Remover faixa"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Adicionar nova faixa */}
          <div className="p-5" style={{ borderTop: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
            <h4 className="text-sm font-black uppercase tracking-tight mb-4 flex items-center gap-2" style={{ fontFamily: CONDENSED, color: "var(--foreground)" }}>
              <Plus size={15} /> Adicionar Faixa
            </h4>
            <div className="flex flex-wrap items-end gap-3">
              {[
                { label: "Nome (opcional)", testId: "", w: "w-32", placeholder: "Ex: Elite", type: "text", val: newBand.name, onChange: (v: string) => setNewBand(b => ({ ...b, name: v })) },
              ].map(f => (
                <div key={f.label} className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>{f.label}</label>
                  <Input type={f.type} value={f.val} onChange={e => f.onChange(e.target.value)} className={`h-10 ${f.w} rounded-lg font-bold`} placeholder={f.placeholder} />
                </div>
              ))}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>Nota Mínima</label>
                <Input data-testid="input-new-platoon-min" type="number" min="0" max="100" step="1" value={newBand.minScore} onChange={e => setNewBand(v => ({ ...v, minScore: e.target.value }))} className="h-10 w-20 text-center rounded-lg font-black" placeholder="0" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>Nota Máxima</label>
                <Input data-testid="input-new-platoon-max" type="number" min="0" max="100" step="1" value={newBand.maxScore} onChange={e => setNewBand(v => ({ ...v, maxScore: e.target.value }))} className="h-10 w-20 text-center rounded-lg font-black" placeholder="100" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>Prêmio Base (R$)</label>
                <Input data-testid="input-new-platoon-bonus" type="number" min="0" step="100" value={newBand.bonusValue} onChange={e => setNewBand(v => ({ ...v, bonusValue: e.target.value }))} className="h-10 w-28 text-right rounded-lg font-black" placeholder="0" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>Bônus Extra (R$/ev.)</label>
                <Input data-testid="input-new-platoon-extra" type="number" min="0" step="50" value={newBand.bonusPerExtraEvent} onChange={e => setNewBand(v => ({ ...v, bonusPerExtraEvent: e.target.value }))} className="h-10 w-28 text-right rounded-lg font-black" placeholder="0" />
              </div>
              <button
                data-testid="button-add-platoon"
                className="h-10 px-5 flex items-center rounded-lg font-bold text-sm uppercase disabled:opacity-40 disabled:pointer-events-none transition-opacity hover:opacity-80"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
                disabled={createPlatoonMutation.isPending}
                onClick={handleCreateBand}
              >
                <Plus size={15} className="mr-1.5" /> Adicionar
              </button>
            </div>
            <p className="text-[11px] italic mt-3 max-w-2xl" style={{ color: "var(--muted-foreground)" }}>
              As faixas devem cobrir de 0 a 100 sem lacunas ou sobreposições. Ajuste os limites das faixas existentes antes de adicionar uma nova.
            </p>
          </div>
        </section>

        {rulesByGroup.unknown.length > 0 && (
          <section className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="px-5 py-3.5 flex items-center gap-3" style={{ backgroundColor: "#191c1e" }}>
              <Settings size={18} style={{ color: "#d4ff00" }} />
              <h3 className="font-black uppercase tracking-wider text-sm" style={{ color: "#d4ff00", fontFamily: CONDENSED }}>Outras Regras</h3>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {rulesByGroup.unknown.map(rule => (
                <RuleCard key={rule.key} rule={rule} ruleValues={ruleValues} setRuleValues={setRuleValues} getRuleValue={getRuleValue} updateRuleMutation={updateRuleMutation} />
              ))}
            </div>
          </section>
        )}
      </div>

      <AlertDialog open={deleteTargetId !== null} onOpenChange={v => { if (!v) setDeleteTargetId(null); }}>
        <AlertDialogContent className="rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED, color: "var(--foreground)" }}>
              <Trash2 size={18} /> Remover faixa
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: "var(--muted-foreground)" }}>
              Esta faixa de bônus será removida permanentemente. Colaboradores que já atingiram essa faixa no ciclo atual podem ser afetados no próximo reprocessamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg font-bold uppercase text-xs" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTargetId && deletePlatoonMutation.mutate({ id: deleteTargetId })} className="rounded-lg font-bold uppercase text-xs" style={{ backgroundColor: "#e5484d", color: "white", border: "none" }}>
              Sim, remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HelpTooltip({ text }: { text: string }) {
  if (!text) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="shrink-0 transition-opacity hover:opacity-60" style={{ color: "var(--muted-foreground)" }}>
          <HelpCircle size={14} />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs font-medium rounded-xl p-3 leading-relaxed" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

interface RuleSectionProps {
  groupKey: "avaliacao" | "elegibilidade";
  rules: Array<{ key: string; value: string; description: string }>;
  ruleValues: Record<string, string>;
  setRuleValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  getRuleValue: (key: string, def: string) => string;
  updateRuleMutation: { isPending: boolean; mutate: (args: { key: string; data: { value: string } }) => void };
}

function RuleSection({ groupKey, rules, ruleValues, setRuleValues, getRuleValue, updateRuleMutation }: RuleSectionProps) {
  const meta = GROUP_META[groupKey];
  const Icon = meta.icon;
  if (rules.length === 0) return null;
  return (
    <section className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="px-5 py-3.5 flex items-center gap-3" style={{ backgroundColor: "#191c1e" }}>
        <Icon size={18} style={{ color: "#d4ff00" }} />
        <div>
          <h3 className="font-black uppercase tracking-wider text-sm" style={{ color: "#d4ff00", fontFamily: CONDENSED }}>{meta.title}</h3>
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "rgba(212,255,0,0.55)" }}>{meta.subtitle}</p>
        </div>
      </div>
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {rules.map(rule => (
          <RuleCard key={rule.key} rule={rule} ruleValues={ruleValues} setRuleValues={setRuleValues} getRuleValue={getRuleValue} updateRuleMutation={updateRuleMutation} />
        ))}
      </div>
    </section>
  );
}

interface RuleCardProps {
  rule: { key: string; value: string; description: string };
  ruleValues: Record<string, string>;
  setRuleValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  getRuleValue: (key: string, def: string) => string;
  updateRuleMutation: { isPending: boolean; mutate: (args: { key: string; data: { value: string } }) => void };
}

function RuleCard({ rule, ruleValues, setRuleValues, getRuleValue, updateRuleMutation }: RuleCardProps) {
  const meta = RULE_META[rule.key];
  const isDirty = ruleValues[rule.key] !== undefined && ruleValues[rule.key] !== rule.value;
  const currentVal = getRuleValue(rule.key, rule.value);
  return (
    <div data-testid={`row-rule-${rule.key}`} className="p-4 rounded-xl flex flex-col gap-3" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
      <div className="flex items-start gap-2">
        <p className="text-sm font-black uppercase tracking-tight flex-1" style={{ color: "var(--foreground)" }}>
          {meta?.label ?? rule.description}
        </p>
        <HelpTooltip text={meta?.help ?? ""} />
      </div>
      {meta?.help && (
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
          {meta.help.length > 120 ? meta.help.slice(0, 120) + "…" : meta.help}
        </p>
      )}
      <div className="flex gap-2 mt-auto">
        <Input
          data-testid={`input-rule-${rule.key}`}
          type={meta?.inputType === "number" ? "number" : "text"}
          className="h-10 rounded-lg font-mono text-sm"
          value={currentVal}
          onChange={e => setRuleValues(v => ({ ...v, [rule.key]: e.target.value }))}
        />
        <button
          data-testid={`button-save-rule-${rule.key}`}
          className="h-10 px-4 shrink-0 flex items-center rounded-lg font-bold text-xs uppercase disabled:opacity-40 disabled:pointer-events-none transition-opacity hover:opacity-80"
          style={{ backgroundColor: isDirty ? "var(--accent)" : "var(--card)", color: isDirty ? "var(--accent-foreground)" : "var(--muted-foreground)", border: "1px solid var(--border)" }}
          disabled={updateRuleMutation.isPending || !isDirty}
          onClick={() => updateRuleMutation.mutate({ key: rule.key, data: { value: currentVal } })}
        >
          <Save size={14} className="mr-1.5" /> Salvar
        </button>
      </div>
    </div>
  );
}
