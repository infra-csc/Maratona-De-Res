import { useState } from "react";
import { useGetRules, useUpdateRule, useGetPlatoonRules, useUpdatePlatoonRule, useCreatePlatoonRule, getGetRulesQueryKey, getGetPlatoonRulesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save, Calculator, CircleDollarSign, Plus } from "lucide-react";

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function RulesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const rulesQKey = getGetRulesQueryKey();
  const platoonQKey = getGetPlatoonRulesQueryKey();

  const { data: rules } = useGetRules({ query: { queryKey: rulesQKey } });
  const { data: platoonRules } = useGetPlatoonRules({ query: { queryKey: platoonQKey } });

  const [ruleValues, setRuleValues] = useState<Record<string, string>>({});
  const [platoonValues, setPlatoonValues] = useState<Record<number, Partial<{ minScore: number; maxScore: number; bonusValue: number; bonusPerExtraEvent: number }>>>({});

  const updateRuleMutation = useUpdateRule({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: rulesQKey });
        toast({ title: "Regra atualizada com sucesso" });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
    },
  });

  const updatePlatoonMutation = useUpdatePlatoonRule({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: platoonQKey });
        toast({ title: "Faixa atualizada com sucesso" });
      },
    },
  });

  const [newPlatoon, setNewPlatoon] = useState({ minScore: "", maxScore: "", bonusValue: "", bonusPerExtraEvent: "" });

  const createPlatoonMutation = useCreatePlatoonRule({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: platoonQKey });
        toast({ title: "Faixa adicionada com sucesso" });
        setNewPlatoon({ minScore: "", maxScore: "", bonusValue: "", bonusPerExtraEvent: "" });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao adicionar faixa", description: e.message, variant: "destructive" }),
    },
  });

  function handleCreatePlatoon() {
    if (newPlatoon.minScore === "" || newPlatoon.maxScore === "") {
      toast({ title: "Preencha nota mínima e máxima", variant: "destructive" });
      return;
    }
    const min = parseFloat(newPlatoon.minScore);
    const max = parseFloat(newPlatoon.maxScore);
    createPlatoonMutation.mutate({
      data: {
        name: `${min}-${max}`,
        color: "#94a3b8",
        minScore: min,
        maxScore: max,
        bonusValue: parseFloat(newPlatoon.bonusValue || "0"),
        bonusPerExtraEvent: parseFloat(newPlatoon.bonusPerExtraEvent || "0"),
      },
    });
  }

  function getRuleValue(key: string, defaultVal: string) {
    return ruleValues[key] ?? defaultVal;
  }

  return (
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-10">
        {/* Page header */}
        <section className="border-l-8 border-[#ccff00] pl-6 py-1">
          <h1 data-testid="text-page-title" className="text-4xl md:text-5xl italic uppercase tracking-tighter font-black leading-none">
            Regras do Sistema
          </h1>
          <p className="text-base md:text-lg text-[#444933] italic mt-2 max-w-2xl">
            Defina os parâmetros de cálculo e as faixas de bônus financeiro do ciclo.
          </p>
        </section>

        {/* Parâmetros de Cálculo */}
        <section className="bg-white border-2 border-[#191c1e] overflow-hidden">
          <div className="bg-[#191c1e] text-[#ccff00] px-6 py-4 flex items-center gap-3 italic">
            <Calculator size={20} />
            <div>
              <h3 className="text-base font-black uppercase tracking-wider">Cálculo de Bônus</h3>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#ccff00]/70 not-italic">Variáveis utilizadas no cálculo da pontuação final</p>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(rules ?? []).map(rule => (
                <div key={rule.key} data-testid={`row-rule-${rule.key}`} className="bg-[#f2f4f6] p-5 border-2 border-[#191c1e] flex flex-col gap-3">
                  <div>
                    <p className="text-sm font-black italic uppercase tracking-tight text-[#191c1e]">{rule.description}</p>
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <Input
                      data-testid={`input-rule-${rule.key}`}
                      className="h-11 rounded-none border-2 border-[#191c1e] bg-white font-mono text-sm focus-visible:ring-0"
                      value={getRuleValue(rule.key, rule.value)}
                      onChange={e => setRuleValues(v => ({ ...v, [rule.key]: e.target.value }))}
                    />
                    <button
                      data-testid={`button-save-rule-${rule.key}`}
                      className={`h-11 px-4 shrink-0 flex items-center bg-[#ccff00] border-2 border-[#191c1e] font-bold text-sm italic uppercase disabled:opacity-40 disabled:pointer-events-none ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
                      disabled={updateRuleMutation.isPending || !ruleValues[rule.key] || ruleValues[rule.key] === rule.value}
                      onClick={() => updateRuleMutation.mutate({ key: rule.key, data: { value: ruleValues[rule.key] ?? rule.value } })}
                    >
                      <Save size={16} className="mr-1.5" /> Salvar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Faixas de Bônus & Premiação */}
        <section className="bg-white border-2 border-[#191c1e] overflow-hidden">
          <div className="bg-[#191c1e] text-[#ccff00] px-6 py-4 flex items-center gap-3 italic">
            <CircleDollarSign size={20} />
            <div>
              <h3 className="text-base font-black uppercase tracking-wider">Faixas de Bônus &amp; Premiação</h3>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#ccff00]/70 not-italic">Defina as faixas de nota e os valores de bônus Caju correspondentes</p>
            </div>
          </div>

          {/* Fórmula explicativa */}
          <div className="px-6 py-4 bg-[#f7f9fb] border-b-2 border-[#191c1e] text-sm italic text-[#444933]">
            <span className="font-black text-[#191c1e]">Bônus Total</span> = Prêmio Base da faixa + (Eventos Extras × Bônus por Evento Extra da faixa)
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-[#191c1e] bg-[#eceef0]">
                  <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Faixa de Nota</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Prêmio Base (R$)</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Bônus p/ Evento Extra (R$)</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Total (Base + 3 Extra)</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#eceef0]">
                {(platoonRules ?? []).map(p => {
                  const isDirty = platoonValues[p.id] !== undefined;
                  const currentBonus = platoonValues[p.id]?.bonusValue ?? p.bonusValue;
                  const currentExtra = platoonValues[p.id]?.bonusPerExtraEvent ?? (p.bonusPerExtraEvent ?? 0);
                  const total3 = currentBonus + 3 * currentExtra;

                  return (
                    <tr key={p.id} data-testid={`row-platoon-${p.id}`} className="hover:bg-[#f2f4f6] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Input
                            data-testid={`input-platoon-min-${p.id}`}
                            type="number" min="0" max="100" step="1"
                            className="w-20 text-center h-11 font-black italic rounded-none border-2 border-[#191c1e] bg-white focus-visible:ring-0"
                            value={platoonValues[p.id]?.minScore ?? p.minScore}
                            onChange={e => setPlatoonValues(v => ({ ...v, [p.id]: { ...v[p.id], minScore: parseFloat(e.target.value) } }))}
                          />
                          <span className="text-[#747a60] font-bold italic uppercase text-xs">–</span>
                          <Input
                            data-testid={`input-platoon-max-${p.id}`}
                            type="number" min="0" max="100" step="1"
                            className="w-20 text-center h-11 font-black italic rounded-none border-2 border-[#191c1e] bg-white focus-visible:ring-0"
                            value={platoonValues[p.id]?.maxScore ?? p.maxScore}
                            onChange={e => setPlatoonValues(v => ({ ...v, [p.id]: { ...v[p.id], maxScore: parseFloat(e.target.value) } }))}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="relative max-w-[130px] mx-auto">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#506600] font-black italic text-xs z-10">R$</span>
                          <Input
                            data-testid={`input-platoon-bonus-${p.id}`}
                            type="number" min="0" step="10"
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
                            type="number" min="0" step="10"
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
                        <button
                          data-testid={`button-save-platoon-${p.id}`}
                          className={`inline-flex items-center px-4 py-2 border-2 border-[#191c1e] font-bold text-sm italic uppercase transition-all disabled:opacity-40 disabled:pointer-events-none ${isDirty ? `bg-[#ccff00] text-[#161e00] ${HARD_SHADOW} ${HARD_SHADOW_HOVER}` : "bg-white text-[#444933] hover:bg-[#eceef0]"}`}
                          disabled={!isDirty || updatePlatoonMutation.isPending}
                          onClick={() => platoonValues[p.id] && updatePlatoonMutation.mutate({ id: p.id, data: platoonValues[p.id] })}
                        >
                          <Save size={16} className="mr-1.5" /> Salvar
                        </button>
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
                <label className="text-[10px] font-bold uppercase text-[#747a60] tracking-widest">Nota Mínima</label>
                <Input
                  data-testid="input-new-platoon-min"
                  type="number" min="0" max="100" step="1"
                  value={newPlatoon.minScore}
                  onChange={e => setNewPlatoon(v => ({ ...v, minScore: e.target.value }))}
                  className="h-11 w-24 text-center font-black italic rounded-none border-2 border-[#191c1e] bg-white focus-visible:ring-0"
                  placeholder="0"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#747a60] tracking-widest">Nota Máxima</label>
                <Input
                  data-testid="input-new-platoon-max"
                  type="number" min="0" max="100" step="1"
                  value={newPlatoon.maxScore}
                  onChange={e => setNewPlatoon(v => ({ ...v, maxScore: e.target.value }))}
                  className="h-11 w-24 text-center font-black italic rounded-none border-2 border-[#191c1e] bg-white focus-visible:ring-0"
                  placeholder="100"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#747a60] tracking-widest">Prêmio Base (R$)</label>
                <Input
                  data-testid="input-new-platoon-bonus"
                  type="number" min="0" step="10"
                  value={newPlatoon.bonusValue}
                  onChange={e => setNewPlatoon(v => ({ ...v, bonusValue: e.target.value }))}
                  className="h-11 w-32 text-right font-black italic text-[#506600] rounded-none border-2 border-[#191c1e] bg-white focus-visible:ring-0"
                  placeholder="0"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#747a60] tracking-widest">Bônus Extra (R$/evento)</label>
                <Input
                  data-testid="input-new-platoon-extra"
                  type="number" min="0" step="10"
                  value={newPlatoon.bonusPerExtraEvent}
                  onChange={e => setNewPlatoon(v => ({ ...v, bonusPerExtraEvent: e.target.value }))}
                  className="h-11 w-36 text-right font-black italic text-[#506600] rounded-none border-2 border-[#191c1e] bg-white focus-visible:ring-0"
                  placeholder="0"
                />
              </div>
              <button
                data-testid="button-add-platoon"
                className={`h-11 px-5 flex items-center bg-[#ccff00] border-2 border-[#191c1e] font-bold text-sm italic uppercase disabled:opacity-40 disabled:pointer-events-none ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
                disabled={createPlatoonMutation.isPending}
                onClick={handleCreatePlatoon}
              >
                <Plus size={16} className="mr-1.5" /> Adicionar
              </button>
            </div>
            <p className="text-[11px] text-[#747a60] italic mt-3 max-w-2xl">
              As faixas devem cobrir de 0 a 100 sem lacunas ou sobreposições. Ajuste os limites das faixas existentes antes de adicionar uma nova.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
