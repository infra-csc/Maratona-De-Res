import { useState } from "react";
import { useGetRules, useUpdateRule, useGetPlatoonRules, useUpdatePlatoonRule, getGetRulesQueryKey, getGetPlatoonRulesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Settings, Save } from "lucide-react";

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
        toast({ title: "Regra atualizada" });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  const updatePlatoonMutation = useUpdatePlatoonRule({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: platoonQKey });
        toast({ title: "Pelotão atualizado" });
      },
    },
  });

  function getRuleValue(key: string, defaultVal: string) {
    return ruleValues[key] ?? defaultVal;
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 data-testid="text-page-title" className="text-2xl font-bold flex items-center gap-2">
          <Settings size={22} className="text-primary" /> Regras do Sistema
        </h1>
        <p className="text-muted-foreground text-sm">Configure parâmetros de cálculo e pelotões</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Parâmetros Gerais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(rules ?? []).map(rule => (
              <div key={rule.key} data-testid={`row-rule-${rule.key}`} className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{rule.description}</p>
                  <p className="text-xs text-muted-foreground font-mono">{rule.key}</p>
                </div>
                <Input
                  data-testid={`input-rule-${rule.key}`}
                  className="w-32 text-right"
                  value={getRuleValue(rule.key, rule.value)}
                  onChange={e => setRuleValues(v => ({ ...v, [rule.key]: e.target.value }))}
                />
                <Button
                  data-testid={`button-save-rule-${rule.key}`}
                  size="sm"
                  variant="outline"
                  disabled={updateRuleMutation.isPending || !ruleValues[rule.key] || ruleValues[rule.key] === rule.value}
                  onClick={() => updateRuleMutation.mutate({ key: rule.key, data: { value: ruleValues[rule.key] ?? rule.value } })}
                >
                  <Save size={13} />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pelotões e Bônus Caju</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Pelotão</th>
                  <th className="px-4 py-3 text-center font-medium">Score Mínimo</th>
                  <th className="px-4 py-3 text-center font-medium">Score Máximo</th>
                  <th className="px-4 py-3 text-center font-medium">Bônus (R$)</th>
                  <th className="px-4 py-3 text-center font-medium">Salvar</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(platoonRules ?? []).map(p => (
                  <tr key={p.id} data-testid={`row-platoon-${p.id}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="font-medium">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Input
                        data-testid={`input-platoon-min-${p.id}`}
                        type="number" min="0" max="1" step="0.01" className="w-24 mx-auto text-center"
                        value={platoonValues[p.id]?.minScore ?? p.minScore}
                        onChange={e => setPlatoonValues(v => ({ ...v, [p.id]: { ...v[p.id], minScore: parseFloat(e.target.value) } }))}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Input
                        data-testid={`input-platoon-max-${p.id}`}
                        type="number" min="0" max="1.01" step="0.01" className="w-24 mx-auto text-center"
                        value={platoonValues[p.id]?.maxScore ?? p.maxScore}
                        onChange={e => setPlatoonValues(v => ({ ...v, [p.id]: { ...v[p.id], maxScore: parseFloat(e.target.value) } }))}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Input
                        data-testid={`input-platoon-bonus-${p.id}`}
                        type="number" min="0" step="10" className="w-28 mx-auto text-center"
                        value={platoonValues[p.id]?.bonusValue ?? p.bonusValue}
                        onChange={e => setPlatoonValues(v => ({ ...v, [p.id]: { ...v[p.id], bonusValue: parseFloat(e.target.value) } }))}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Button
                        data-testid={`button-save-platoon-${p.id}`}
                        size="sm" variant="outline"
                        disabled={!platoonValues[p.id] || updatePlatoonMutation.isPending}
                        onClick={() => platoonValues[p.id] && updatePlatoonMutation.mutate({ id: p.id, data: platoonValues[p.id] })}
                      >
                        <Save size={13} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
