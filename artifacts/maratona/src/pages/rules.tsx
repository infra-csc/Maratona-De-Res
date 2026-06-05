import { useState } from "react";
import { useGetRules, useUpdateRule, useGetPlatoonRules, useUpdatePlatoonRule, getGetRulesQueryKey, getGetPlatoonRulesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Settings, Save, SlidersHorizontal, Calculator, CircleDollarSign } from "lucide-react";
import { PlatoonBadge } from "@/components/ui/platoon-badge";

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
    <div className="p-6 md:p-8 space-y-8 max-w-5xl mx-auto bg-slate-50/30 min-h-full">
      <div>
        <h1 data-testid="text-page-title" className="text-3xl font-bold flex items-center gap-3 tracking-tight text-foreground">
          <SlidersHorizontal size={28} className="text-primary" /> Regras do Sistema
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Configurações globais de cálculo de bônus, penalidades e limites dos pelotões.</p>
      </div>

      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Calculator size={18} className="text-primary" /> Parâmetros de Cálculo
          </CardTitle>
          <CardDescription>Variáveis utilizadas no cálculo da pontuação final.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(rules ?? []).map(rule => (
              <div key={rule.key} data-testid={`row-rule-${rule.key}`} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">{rule.description}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-400 mt-1 tracking-wider">{rule.key}</p>
                </div>
                <div className="flex gap-2 mt-auto">
                  <Input
                    data-testid={`input-rule-${rule.key}`}
                    className="h-10 bg-white font-mono text-sm shadow-sm"
                    value={getRuleValue(rule.key, rule.value)}
                    onChange={e => setRuleValues(v => ({ ...v, [rule.key]: e.target.value }))}
                  />
                  <Button
                    data-testid={`button-save-rule-${rule.key}`}
                    className="h-10 px-4 shrink-0 shadow-sm"
                    disabled={updateRuleMutation.isPending || !ruleValues[rule.key] || ruleValues[rule.key] === rule.value}
                    onClick={() => updateRuleMutation.mutate({ key: rule.key, data: { value: ruleValues[rule.key] ?? rule.value } })}
                  >
                    <Save size={16} className="mr-1.5" /> Salvar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <CircleDollarSign size={18} className="text-green-600" /> Pelotões & Premiação
          </CardTitle>
          <CardDescription>Defina os ranges de notas e o bônus financeiro Caju correspondente.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white border-b border-slate-100">
                  <th className="px-6 py-4 text-left font-semibold text-slate-500 uppercase tracking-wider text-xs">Pelotão Oficial</th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-500 uppercase tracking-wider text-xs bg-slate-50/50">Intervalo de Pontos (0-100)</th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-500 uppercase tracking-wider text-xs">Bônus Caju (R$)</th>
                  <th className="px-6 py-4 text-right font-semibold text-slate-500 uppercase tracking-wider text-xs">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(platoonRules ?? []).map(p => {
                  const isDirty = platoonValues[p.id] !== undefined;
                  
                  return (
                    <tr key={p.id} data-testid={`row-platoon-${p.id}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <PlatoonBadge platoon={p.name} colorHex={p.color} className="text-sm px-3 py-1" />
                      </td>
                      <td className="px-6 py-4 text-center bg-slate-50/50">
                        <div className="flex items-center justify-center gap-2">
                          <Input
                            data-testid={`input-platoon-min-${p.id}`}
                            type="number" min="0" max="100" step="1" 
                            className="w-20 text-center h-10 font-bold bg-white"
                            value={platoonValues[p.id]?.minScore ?? p.minScore}
                            onChange={e => setPlatoonValues(v => ({ ...v, [p.id]: { ...v[p.id], minScore: parseFloat(e.target.value) } }))}
                          />
                          <span className="text-slate-400 font-medium px-1">até</span>
                          <Input
                            data-testid={`input-platoon-max-${p.id}`}
                            type="number" min="0" max="100" step="1" 
                            className="w-20 text-center h-10 font-bold bg-white"
                            value={platoonValues[p.id]?.maxScore ?? p.maxScore}
                            onChange={e => setPlatoonValues(v => ({ ...v, [p.id]: { ...v[p.id], maxScore: parseFloat(e.target.value) } }))}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="relative max-w-[120px] mx-auto">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-700 font-bold text-xs">R$</span>
                          <Input
                            data-testid={`input-platoon-bonus-${p.id}`}
                            type="number" min="0" step="10" 
                            className="w-full text-right h-10 font-bold text-green-700 border-green-200 focus-visible:ring-green-500"
                            value={platoonValues[p.id]?.bonusValue ?? p.bonusValue}
                            onChange={e => setPlatoonValues(v => ({ ...v, [p.id]: { ...v[p.id], bonusValue: parseFloat(e.target.value) } }))}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          data-testid={`button-save-platoon-${p.id}`}
                          variant={isDirty ? "default" : "outline"}
                          className={`shadow-sm ${isDirty ? "animate-pulse" : ""}`}
                          disabled={!isDirty || updatePlatoonMutation.isPending}
                          onClick={() => platoonValues[p.id] && updatePlatoonMutation.mutate({ id: p.id, data: platoonValues[p.id] })}
                        >
                          <Save size={16} className="mr-1.5" /> Salvar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
