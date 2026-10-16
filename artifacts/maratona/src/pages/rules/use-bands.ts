// Estado e chamadas das faixas de bônus: edição por linha (com as mesmas
// checagens de antes — números, mínimo ≤ máximo, sem sobreposição), nova
// faixa, remover e "restaurar as faixas de 2026". Erros ficam na linha ou
// no diálogo que os causou.
import { useState } from "react";
import {
  useUpdatePlatoonRule, useCreatePlatoonRule, useDeletePlatoonRule, replaceAllPlatoonRules,
} from "@workspace/api-client-react";
import type { PlatoonRule } from "@workspace/api-client-react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { NEW_TIERS_2026 } from "./rule-meta";
import { score, serverMessage } from "./rules-ui";

export type BandEdit = Partial<{ name: string; minScore: number; maxScore: number; bonusValue: number; bonusPerExtraEvent: number }>;
export type NewBand = { name: string; minScore: string; maxScore: string; bonusValue: string; bonusPerExtraEvent: string };
const EMPTY: NewBand = { name: "", minScore: "", maxScore: "", bonusValue: "", bonusPerExtraEvent: "" };

export function useBands(qKey: QueryKey, bands: PlatoonRule[] | undefined) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<number, BandEdit>>({});
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [newBand, setNewBand] = useState<NewBand>(EMPTY);
  const [newError, setNewError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PlatoonRule | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [replaceOpen, setReplaceOpenState] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);

  const setRowError = (id: number, msg: string | null) => setRowErrors(prev => {
    const next = { ...prev };
    if (msg) next[id] = msg; else delete next[id];
    return next;
  });

  const updateMutation = useUpdatePlatoonRule({
    mutation: {
      onSuccess: (_r, vars) => {
        qc.invalidateQueries({ queryKey: qKey });
        setEdits(prev => { const n = { ...prev }; delete n[vars.id]; return n; });
        setRowError(vars.id, null);
        toast({ title: "Faixa salva" });
      },
      onError: (e: unknown, vars) => setRowError(vars.id, serverMessage(e, "Não foi possível salvar a faixa.")),
    },
  });

  const createMutation = useCreatePlatoonRule({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Faixa adicionada" });
        setNewBand(EMPTY);
        setNewError(null);
        setAddOpen(false);
      },
      onError: (e: unknown) => setNewError(serverMessage(e, "Não foi possível adicionar a faixa.")),
    },
  });

  const deleteMutation = useDeletePlatoonRule({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); setDeleteTarget(null); toast({ title: "Faixa removida" }); },
      onError: (e: unknown) => setDeleteError(serverMessage(e, "Não foi possível remover a faixa.")),
    },
  });

  function overlapping(min: number, max: number, excludeId?: number) {
    return (bands ?? []).find(p => p.id !== excludeId && min <= Number(p.maxScore) && max >= Number(p.minScore));
  }

  function editField(id: number, field: keyof BandEdit, value: string) {
    setRowError(id, null);
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: field === "name" ? value : parseFloat(value) } }));
  }
  function discard(id: number) {
    setRowError(id, null);
    setEdits(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  function save(p: PlatoonRule) {
    const e = edits[p.id];
    if (!e) return;
    // Campo apagado vira NaN no estado — rejeita antes de mandar para a API.
    const bad = (["minScore", "maxScore", "bonusValue", "bonusPerExtraEvent"] as const).some(k => e[k] !== undefined && !Number.isFinite(e[k]));
    if (bad) { setRowError(p.id, "Preencha as notas e os valores em R$ com números."); return; }
    const min = e.minScore ?? Number(p.minScore);
    const max = e.maxScore ?? Number(p.maxScore);
    if (min > max) { setRowError(p.id, "A nota mínima não pode ser maior que a máxima."); return; }
    const c = overlapping(min, max, p.id);
    if (c) { setRowError(p.id, `${score(min)}–${score(max)} sobrepõe a faixa “${c.name}” (${score(Number(c.minScore))}–${score(Number(c.maxScore))}).`); return; }
    updateMutation.mutate({ id: p.id, data: e });
  }

  function create() {
    setNewError(null);
    if (newBand.minScore.trim() === "" || newBand.maxScore.trim() === "") { setNewError("Preencha a nota mínima e a máxima."); return; }
    const min = parseFloat(newBand.minScore);
    const max = parseFloat(newBand.maxScore);
    const bonus = newBand.bonusValue.trim() === "" ? 0 : parseFloat(newBand.bonusValue);
    const extra = newBand.bonusPerExtraEvent.trim() === "" ? 0 : parseFloat(newBand.bonusPerExtraEvent);
    if (![min, max, bonus, extra].every(Number.isFinite)) { setNewError("Notas e valores em R$ precisam ser números."); return; }
    if (min > max) { setNewError("A nota mínima não pode ser maior que a máxima."); return; }
    const c = overlapping(min, max);
    if (c) { setNewError(`${score(min)}–${score(max)} sobrepõe a faixa “${c.name}” (${score(Number(c.minScore))}–${score(Number(c.maxScore))}). Ajuste os limites dela antes.`); return; }
    createMutation.mutate({
      data: { name: newBand.name.trim() || `${min}–${max}`, color: "#94a3b8", minScore: min, maxScore: max, bonusValue: bonus, bonusPerExtraEvent: extra },
    });
  }

  async function replaceAll() {
    setReplacing(true);
    setReplaceError(null);
    try {
      await replaceAllPlatoonRules({ rules: NEW_TIERS_2026 });
      qc.invalidateQueries({ queryKey: qKey });
      setEdits({});
      setRowErrors({});
      setReplaceOpenState(false);
      toast({ title: "Faixas de 2026 aplicadas", description: `${NEW_TIERS_2026.length} faixas no lugar das anteriores.` });
    } catch (e: unknown) {
      setReplaceError(serverMessage(e, "Não foi possível substituir as faixas. Tente novamente."));
    } finally {
      setReplacing(false);
    }
  }

  return {
    edits, rowErrors, editField, discard, save, savingId: updateMutation.isPending ? updateMutation.variables?.id ?? null : null,
    newBand, setNewBand: (f: keyof NewBand, v: string) => { setNewError(null); setNewBand(b => ({ ...b, [f]: v })); }, newError, create, creating: createMutation.isPending,
    addOpen, setAddOpen: (o: boolean) => { setAddOpen(o); if (!o) { setNewBand(EMPTY); setNewError(null); } },
    deleteTarget, setDeleteTarget: (p: PlatoonRule | null) => { setDeleteError(null); setDeleteTarget(p); }, deleteError, deleteMutation,
    replaceOpen, setReplaceOpen: (o: boolean) => { if (!replacing) { setReplaceError(null); setReplaceOpenState(o); } }, replacing, replaceError, replaceAll,
  };
}

export type BandsState = ReturnType<typeof useBands>;
