import { useState } from "react";
import { useGetRules, useUpdateRule, useGetPlatoonRules, useUpdatePlatoonRule, getGetRulesQueryKey, getGetPlatoonRulesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save, Calculator, CircleDollarSign } from "lucide-react";
import { PlatoonBadge } from "@/components/ui/platoon-badge";

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";

export default function RulesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const rulesQKey = getGetRulesQueryKey();
  const platoonQKey = getGetPlatoonRulesQueryKey();

  const { data: rules } = useGetRules({ query: { queryKey: rulesQKey } });
  const { data: platoonRules } = useGetPlatoonRules({ query: { queryKey: platoonQKey } });

  const [ruleValues, setRuleValues] = useState<Record<string, string>>({});
  const [platoonValues, setPlatoonValues] = useState<Record<number, Partial<{ minScore: number; maxScore: number; bonusValue: number }>>>({});

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
        toast({ title: "Configuração do pelotão atualizada" });
      },
    },
  });

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
            Defina os limites de performance e as bonificações financeiras dos pelotões. A agressividade das regras dita o ritmo da corrida.
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
                    <p className="text-[10px] uppercase font-bold text-[#747a60] mt-1 tracking-widest">{rule.key}</p>
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
            <div className="mt-6 p-4 bg-[#f2f4f6] border-l-4 border-[#506600] italic font-medium text-[15px] text-[#444933]">
              "O bônus é calculado sobre o atingimento individual somado à performance coletiva do pelotão."
            </div>
          </div>
        </section>

        {/* Pelotões & Premiação */}
        <section className="bg-white border-2 border-[#191c1e] overflow-hidden">
          <div className="bg-[#191c1e] text-[#ccff00] px-6 py-4 flex items-center gap-3 italic">
            <CircleDollarSign size={20} />
            <div>
              <h3 className="text-base font-black uppercase tracking-wider">Pelotões &amp; Premiação</h3>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#ccff00]/70 not-italic">Defina as faixas de notas e o bônus financeiro Caju correspondente</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-[#191c1e] bg-[#eceef0]">
                  <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Pelotão Oficial</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Intervalo de Pontos (0-100)</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Bônus Caju (R$)</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#eceef0]">
                {(platoonRules ?? []).map(p => {
                  const isDirty = platoonValues[p.id] !== undefined;

                  return (
                    <tr key={p.id} data-testid={`row-platoon-${p.id}`} className="hover:bg-[#f2f4f6] transition-colors">
                      <td className="px-6 py-4">
                        <PlatoonBadge platoon={p.name} colorHex={p.color} className="text-sm px-3 py-1" />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Input
                            data-testid={`input-platoon-min-${p.id}`}
                            type="number" min="0" max="100" step="1"
                            className="w-20 text-center h-11 font-black italic rounded-none border-2 border-[#191c1e] bg-white focus-visible:ring-0"
                            value={platoonValues[p.id]?.minScore ?? p.minScore}
                            onChange={e => setPlatoonValues(v => ({ ...v, [p.id]: { ...v[p.id], minScore: parseFloat(e.target.value) } }))}
                          />
                          <span className="text-[#747a60] font-bold italic uppercase text-xs px-1">até</span>
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
                            value={platoonValues[p.id]?.bonusValue ?? p.bonusValue}
                            onChange={e => setPlatoonValues(v => ({ ...v, [p.id]: { ...v[p.id], bonusValue: parseFloat(e.target.value) } }))}
                          />
                        </div>
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
        </section>
      </div>
    </div>
  );
}
