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
import { Save, Calculator, CircleDollarSign, Plus, Settings, ShieldCheck, Trash2, HelpCircle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";

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
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-10">
        {/* Page header */}
        <section className="border-l-8 border-[#ccff00] pl-6 py-1">
          <h1 data-testid="text-page-title" className="text-4xl md:text-5xl italic uppercase tracking-tighter font-black leading-none">
            Regras do Sistema
          </h1>
          <p className="text-base md:text-lg text-[#444933] italic mt-2 max-w-2xl">
            Defina os parâmetros de cálculo e as bonificações financeiras por faixa de nota. A agressividade das regras dita o ritmo da corrida.
          </p>
        </section>

        {/* SEÇÃO: Regras de Avaliação */}
        <RuleSection
          groupKey="avaliacao"
          rules={rulesByGroup.avaliacao}
          ruleValues={ruleValues}
          setRuleValues={setRuleValues}
          getRuleValue={getRuleValue}
          updateRuleMutation={updateRuleMutation}
        />

        {/* SEÇÃO: Elegibilidade & Penalidade */}
        <RuleSection
          groupKey="elegibilidade"
          rules={rulesByGroup.elegibilidade}
          ruleValues={ruleValues}
          setRuleValues={setRuleValues}
          getRuleValue={getRuleValue}
          updateRuleMutation={updateRuleMutation}
        />

        {/* SEÇÃO: Pagamento & Bônus (inclui forma de pagamento + simulador de faixas) */}
        <section className="bg-white border-2 border-[#191c1e] overflow-hidden">
          <div className="bg-[#191c1e] text-[#ccff00] px-6 py-4 flex items-center gap-3 italic">
            <CircleDollarSign size={20} />
            <div>
              <h3 className="text-base font-black uppercase tracking-wider">Pagamento & Bônus</h3>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#ccff00]/70 not-italic">Forma de pagamento e simulador de faixas de bônus financeiro</p>
            </div>
          </div>

          {/* Forma de Pagamento */}
          {rulesByGroup.pagamento.map(rule => {
            const meta = RULE_META[rule.key];
            const currentVal = getRuleValue(rule.key, rule.value);
            const isDirty = ruleValues[rule.key] !== undefined && ruleValues[rule.key] !== rule.value;
            return (
              <div key={rule.key} className="p-6 border-b-2 border-[#eceef0]">
                <div className="flex items-start gap-2 mb-3">
                  <p className="text-sm font-black italic uppercase tracking-tight text-[#191c1e]">{meta?.label ?? rule.description}</p>
                  <HelpTooltip text={meta?.help ?? ""} />
                </div>
                <div className="flex gap-2 max-w-xs">
                  <Select
                    value={PAYMENT_OPTIONS.some(o => o.value === currentVal) ? currentVal : "outro"}
                    onValueChange={v => setRuleValues(prev => ({ ...prev, [rule.key]: v }))}
                  >
                    <SelectTrigger className="h-11 rounded-none border-2 border-[#191c1e] focus:ring-0 font-bold italic uppercase text-xs tracking-wider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    data-testid={`button-save-rule-${rule.key}`}
                    className={`h-11 px-4 shrink-0 flex items-center border-2 border-[#191c1e] font-bold text-sm italic uppercase disabled:opacity-40 disabled:pointer-events-none ${isDirty ? `bg-[#ccff00] ${HARD_SHADOW} ${HARD_SHADOW_HOVER}` : "bg-white text-[#444933] hover:bg-[#eceef0]"}`}
                    disabled={updateRuleMutation.isPending || !isDirty}
                    onClick={() => updateRuleMutation.mutate({ key: rule.key, data: { value: currentVal } })}
                  >
                    <Save size={16} className="mr-1.5" /> Salvar
                  </button>
                </div>
              </div>
            );
          })}

          {/* Fórmula */}
          <div className="px-6 py-4 bg-[#f7f9fb] border-b-2 border-[#191c1e] text-sm italic text-[#444933]">
            <span className="font-black text-[#191c1e]">Bônus Total</span> = Prêmio Base da faixa + (Eventos Extras × Bônus por Evento Extra da faixa)
          </div>

          {/* Tabela de faixas */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-[#191c1e] bg-[#eceef0]">
                  <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Nome / Nota</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Prêmio Base (R$)</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Bônus p/ Evento Extra (R$)</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Exemplo (Base + 3 Extra)</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#eceef0]">
                {(platoonRules ?? []).map(p => {
                  const isDirty = platoonValues[p.id] !== undefined;
                  const currentBonus = platoonValues[p.id]?.bonusValue ?? Number(p.bonusValue);
                  const currentExtra = platoonValues[p.id]?.bonusPerExtraEvent ?? Number(p.bonusPerExtraEvent ?? 0);
                  const currentName = platoonValues[p.id]?.name ?? p.name ?? "";
                  const total3 = currentBonus + 3 * currentExtra;

                  return (
                    <tr key={p.id} data-testid={`row-platoon-${p.id}`} className="hover:bg-[#f2f4f6] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <Input
                            placeholder="Nome da faixa (opcional)"
                            className="w-40 h-8 rounded-none border-2 border-[#191c1e] bg-white text-xs font-bold italic focus-visible:ring-0"
                            value={currentName}
                            onChange={e => setPlatoonValues(v => ({ ...v, [p.id]: { ...v[p.id], name: e.target.value } }))}
                          />
                          <div className="flex items-center gap-1">
                            <Input
                              data-testid={`input-platoon-min-${p.id}`}
                              type="number" min="0" max="100" step="1"
                              className="w-20 text-center h-9 font-black italic rounded-none border-2 border-[#191c1e] bg-white focus-visible:ring-0 text-sm"
                              value={platoonValues[p.id]?.minScore ?? p.minScore}
                              onChange={e => setPlatoonValues(v => ({ ...v, [p.id]: { ...v[p.id], minScore: parseFloat(e.target.value) } }))}
                            />
                            <span className="text-[#747a60] font-bold italic text-xs">–</span>
                            <Input
                              data-testid={`input-platoon-max-${p.id}`}
                              type="number" min="0" max="100" step="1"
                              className="w-20 text-center h-9 font-black italic rounded-none border-2 border-[#191c1e] bg-white focus-visible:ring-0 text-sm"
                              value={platoonValues[p.id]?.maxScore ?? p.maxScore}
                              onChange={e => setPlatoonValues(v => ({ ...v, [p.id]: { ...v[p.id], maxScore: parseFloat(e.target.value) } }))}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="relative max-w-[130px] mx-auto">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#506600] font-black italic text-xs z-10">R$</span>
                          <Input
                            data-testid={`input-platoon-bonus-${p.id}`}
                            type="number" min="0" step="100"
                            className="w-full text-right h-11 font-black italic text-[#506600] rounded-none border-2 border-[#191c1e] bg-white focus-visible:ring-0"
                            value={currentBonus}
                            onChange={e => setPlatoonValues(v => ({ ...v, [p.id]: { ...v[p.id], bonusValue: parseFloat(e.target.value) } }))}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="relative max-w-[130px] mx-auto">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#506600] font-black italic text-xs z-10">R$</span>
                          <Input
                            data-testid={`input-platoon-extra-${p.id}`}
                            type="number" min="0" step="50"
                            className="w-full text-right h-11 font-black italic text-[#506600] rounded-none border-2 border-[#191c1e] bg-white focus-visible:ring-0"
                            value={currentExtra}
                            onChange={e => setPlatoonValues(v => ({ ...v, [p.id]: { ...v[p.id], bonusPerExtraEvent: parseFloat(e.target.value) } }))}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-black italic text-[#191c1e]">{fmtBRL(total3)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            data-testid={`button-save-platoon-${p.id}`}
                            className={`inline-flex items-center px-4 py-2 border-2 border-[#191c1e] font-bold text-sm italic uppercase transition-all disabled:opacity-40 disabled:pointer-events-none ${isDirty ? `bg-[#ccff00] text-[#161e00] ${HARD_SHADOW} ${HARD_SHADOW_HOVER}` : "bg-white text-[#444933] hover:bg-[#eceef0]"}`}
                            disabled={!isDirty || updatePlatoonMutation.isPending}
                            onClick={() => {
                              if (!platoonValues[p.id]) return;
                              const min = platoonValues[p.id]?.minScore ?? Number(p.minScore);
                              const max = platoonValues[p.id]?.maxScore ?? Number(p.maxScore);
                              if (min > max) {
                                toast({ title: "Nota mínima não pode ser maior que a máxima", variant: "destructive" });
                                return;
                              }
                              const conflict = findOverlappingBand(min, max, p.id);
                              if (conflict) {
                                toast({ title: "Faixa sobreposta", description: `O intervalo ${min}–${max} sobrepõe a faixa "${conflict.name}" (${conflict.minScore}–${conflict.maxScore}).`, variant: "destructive" });
                                return;
                              }
                              updatePlatoonMutation.mutate({ id: p.id, data: platoonValues[p.id] });
                            }}
                          >
                            <Save size={15} className="mr-1.5" /> Salvar
                          </button>
                          <button
                            data-testid={`button-delete-platoon-${p.id}`}
                            className="p-2 border-2 border-transparent text-[#747a60] hover:border-[#191c1e] hover:text-[#ba1a1a] hover:bg-[#ffdad6] transition-all"
                            onClick={() => setDeleteTargetId(p.id)}
                            title="Remover faixa"
                          >
                            <Trash2 size={15} />
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
          <div className="border-t-2 border-[#191c1e] p-6 bg-[#f7f9fb]">
            <h4 className="text-sm font-black uppercase italic tracking-tight mb-4 flex items-center gap-2">
              <Plus size={16} /> Adicionar Faixa
            </h4>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#747a60] tracking-widest">Nome (opcional)</label>
                <Input
                  type="text"
                  value={newBand.name}
                  onChange={e => setNewBand(v => ({ ...v, name: e.target.value }))}
                  className="h-11 w-36 font-bold italic rounded-none border-2 border-[#191c1e] bg-white focus-visible:ring-0"
                  placeholder="Ex: Elite"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#747a60] tracking-widest">Nota Mínima</label>
                <Input
                  data-testid="input-new-platoon-min"
                  type="number" min="0" max="100" step="1"
                  value={newBand.minScore}
                  onChange={e => setNewBand(v => ({ ...v, minScore: e.target.value }))}
                  className="h-11 w-24 text-center font-black italic rounded-none border-2 border-[#191c1e] bg-white focus-visible:ring-0"
                  placeholder="0"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#747a60] tracking-widest">Nota Máxima</label>
                <Input
                  data-testid="input-new-platoon-max"
                  type="number" min="0" max="100" step="1"
                  value={newBand.maxScore}
                  onChange={e => setNewBand(v => ({ ...v, maxScore: e.target.value }))}
                  className="h-11 w-24 text-center font-black italic rounded-none border-2 border-[#191c1e] bg-white focus-visible:ring-0"
                  placeholder="100"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#747a60] tracking-widest">Prêmio Base (R$)</label>
                <Input
                  data-testid="input-new-platoon-bonus"
                  type="number" min="0" step="100"
                  value={newBand.bonusValue}
                  onChange={e => setNewBand(v => ({ ...v, bonusValue: e.target.value }))}
                  className="h-11 w-32 text-right font-black italic text-[#506600] rounded-none border-2 border-[#191c1e] bg-white focus-visible:ring-0"
                  placeholder="0"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#747a60] tracking-widest">Bônus Extra (R$/evento)</label>
                <Input
                  data-testid="input-new-platoon-extra"
                  type="number" min="0" step="50"
                  value={newBand.bonusPerExtraEvent}
                  onChange={e => setNewBand(v => ({ ...v, bonusPerExtraEvent: e.target.value }))}
                  className="h-11 w-36 text-right font-black italic text-[#506600] rounded-none border-2 border-[#191c1e] bg-white focus-visible:ring-0"
                  placeholder="0"
                />
              </div>
              <button
                data-testid="button-add-platoon"
                className={`h-11 px-5 flex items-center bg-[#ccff00] border-2 border-[#191c1e] font-bold text-sm italic uppercase disabled:opacity-40 disabled:pointer-events-none ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
                disabled={createPlatoonMutation.isPending}
                onClick={handleCreateBand}
              >
                <Plus size={16} className="mr-1.5" /> Adicionar
              </button>
            </div>
            <p className="text-[11px] text-[#747a60] italic mt-3 max-w-2xl">
              As faixas devem cobrir de 0 a 100 sem lacunas ou sobreposições. Ajuste os limites das faixas existentes antes de adicionar uma nova.
            </p>
          </div>
        </section>

        {/* Regras não mapeadas (fallback) */}
        {rulesByGroup.unknown.length > 0 && (
          <section className="bg-white border-2 border-[#191c1e] overflow-hidden">
            <div className="bg-[#191c1e] text-[#ccff00] px-6 py-4 flex items-center gap-3 italic">
              <Settings size={20} />
              <h3 className="text-base font-black uppercase tracking-wider">Outras Regras</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {rulesByGroup.unknown.map(rule => (
                <RuleCard
                  key={rule.key}
                  rule={rule}
                  ruleValues={ruleValues}
                  setRuleValues={setRuleValues}
                  getRuleValue={getRuleValue}
                  updateRuleMutation={updateRuleMutation}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteTargetId !== null} onOpenChange={v => { if (!v) setDeleteTargetId(null); }}>
        <AlertDialogContent className="rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl italic uppercase font-black text-[#191c1e] flex items-center gap-2">
              <Trash2 size={20} /> Remover faixa
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#444933] font-bold italic">
              Esta faixa de bônus será removida permanentemente. Colaboradores que já atingiram essa faixa no ciclo atual podem ser afetados no próximo reprocessamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none border-2 border-[#191c1e] font-bold italic uppercase text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTargetId && deletePlatoonMutation.mutate({ id: deleteTargetId })}
              className="rounded-none bg-[#ba1a1a] text-white border-2 border-[#191c1e] font-bold italic uppercase text-xs hover:bg-[#93000a]"
            >
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
        <button type="button" className="text-[#747a60] hover:text-[#191c1e] shrink-0 transition-colors">
          <HelpCircle size={15} />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs font-bold rounded-none border-2 border-[#191c1e] bg-white text-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e] p-3 leading-relaxed">
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
    <section className="bg-white border-2 border-[#191c1e] overflow-hidden">
      <div className="bg-[#191c1e] text-[#ccff00] px-6 py-4 flex items-center gap-3 italic">
        <Icon size={20} />
        <div>
          <h3 className="text-base font-black uppercase tracking-wider">{meta.title}</h3>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#ccff00]/70 not-italic">{meta.subtitle}</p>
        </div>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rules.map(rule => (
            <RuleCard
              key={rule.key}
              rule={rule}
              ruleValues={ruleValues}
              setRuleValues={setRuleValues}
              getRuleValue={getRuleValue}
              updateRuleMutation={updateRuleMutation}
            />
          ))}
        </div>
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
  const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
  const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";
  const meta = RULE_META[rule.key];
  const isDirty = ruleValues[rule.key] !== undefined && ruleValues[rule.key] !== rule.value;
  const currentVal = getRuleValue(rule.key, rule.value);

  return (
    <div key={rule.key} data-testid={`row-rule-${rule.key}`} className="bg-[#f2f4f6] p-5 border-2 border-[#191c1e] flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <p className="text-sm font-black italic uppercase tracking-tight text-[#191c1e] flex-1">
          {meta?.label ?? rule.description}
        </p>
        <HelpTooltip text={meta?.help ?? ""} />
      </div>
      {meta?.help && (
        <p className="text-[11px] text-[#747a60] italic leading-relaxed">
          {meta.help.length > 120 ? meta.help.slice(0, 120) + "…" : meta.help}
        </p>
      )}
      <div className="flex gap-2 mt-auto">
        <Input
          data-testid={`input-rule-${rule.key}`}
          type={meta?.inputType === "number" ? "number" : "text"}
          className="h-11 rounded-none border-2 border-[#191c1e] bg-white font-mono text-sm focus-visible:ring-0"
          value={currentVal}
          onChange={e => setRuleValues(v => ({ ...v, [rule.key]: e.target.value }))}
        />
        <button
          data-testid={`button-save-rule-${rule.key}`}
          className={`h-11 px-4 shrink-0 flex items-center border-2 border-[#191c1e] font-bold text-sm italic uppercase disabled:opacity-40 disabled:pointer-events-none ${isDirty ? `bg-[#ccff00] ${HARD_SHADOW} ${HARD_SHADOW_HOVER}` : "bg-white text-[#444933] hover:bg-[#eceef0]"}`}
          disabled={updateRuleMutation.isPending || !isDirty}
          onClick={() => updateRuleMutation.mutate({ key: rule.key, data: { value: currentVal } })}
        >
          <Save size={16} className="mr-1.5" /> Salvar
        </button>
      </div>
    </div>
  );
}
