import { useState } from "react";
import type { Criterion } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, Route, UserCheck, ChevronDown, ChevronUp, Users, AlertCircle } from "lucide-react";
import { useSaveCriterionRouting } from "@/lib/routing-api";
import type { CriterionRouting } from "@/lib/routing-api";
import { CONDENSED, DANGER_TEXT } from "@/lib/premium-theme";
import { fieldStyle, evaluatorsForArea } from "./helpers";
import type { AreaOption, EvaluatorOption } from "./types";

/** Diálogo "Roteamento — {critério}": casca do Dialog + formulário de roteamento. */
export function CriterionRoutingDialog({
  criterionId, criterion, currentRouting, areas, evaluators, onClose,
}: {
  criterionId: number | null;
  criterion: Criterion | null | undefined;
  currentRouting: CriterionRouting | undefined;
  areas: AreaOption[];
  evaluators: (EvaluatorOption & { areaId?: number | null })[];
  onClose: () => void;
}) {
  return (
    <Dialog open={criterionId !== null} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
            <Route size={18} /> Roteamento — {criterion?.name}
          </DialogTitle>
        </DialogHeader>
        {criterionId !== null && criterion && (
          <RoutingConfigDialog
            criterionId={criterionId}
            criterionName={criterion.name}
            currentRouting={currentRouting}
            areas={areas}
            evaluators={evaluatorsForArea(evaluators, criterion.responsibleAreaId)}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RoutingConfigDialog({
  criterionId, currentRouting, areas, evaluators, onClose,
}: {
  criterionId: number;
  criterionName: string;
  currentRouting: CriterionRouting | undefined;
  areas: AreaOption[];
  evaluators: EvaluatorOption[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const saveMutation = useSaveCriterionRouting(criterionId);

  const [defaultEvaluatorId, setDefaultEvaluatorId] = useState<number | null>(currentRouting?.defaultEvaluatorId ?? null);
  const [redirectMode, setRedirectMode] = useState<"none" | "area" | "specific">(currentRouting?.redirectMode ?? "none");
  const [redirectAreaId, setRedirectAreaId] = useState<number | null>(currentRouting?.redirectAreaId ?? null);
  const [selectedRedirectUsers, setSelectedRedirectUsers] = useState<Set<number>>(
    new Set(currentRouting?.redirectUsers?.map(u => u.id) ?? []),
  );
  const [redirectSearch, setRedirectSearch] = useState("");
  const [redirectCollapsed, setRedirectCollapsed] = useState(true);
  const [evalSearch, setEvalSearch] = useState("");
  const [allowPublicLink, setAllowPublicLink] = useState(currentRouting?.allowPublicLink ?? false);

  const toggleRedirectUser = (userId: number) => {
    setSelectedRedirectUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  const filteredRedirectEvaluators = evaluators.filter(u =>
    u.name.toLowerCase().includes(redirectSearch.toLowerCase()),
  );

  const filteredEvaluators = evaluators.filter(u =>
    u.name.toLowerCase().includes(evalSearch.toLowerCase()),
  );

  const redirectCount = selectedRedirectUsers.size;

  const handleSave = () => {
    saveMutation.mutate({
      defaultEvaluatorId,
      redirectMode,
      redirectAreaId: redirectMode === "area" ? redirectAreaId : null,
      redirectUserIds: redirectMode === "specific" ? Array.from(selectedRedirectUsers) : undefined,
      allowPublicLink,
    }, {
      onSuccess: () => { toast({ title: "Roteamento salvo" }); onClose(); },
      onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-5 pt-2">
      {/* Avaliador Principal */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Avaliador Principal</Label>
          <span className="rounded px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wider" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>Obrigatório</span>
        </div>
        <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Responsável padrão por este critério. Pré-selecionado ao gerar atribuições para um evento.</p>
        <Input placeholder="Buscar avaliador..." value={evalSearch} onChange={e => setEvalSearch(e.target.value)} className="h-9 rounded-lg text-sm" style={fieldStyle} />
        <div className="rounded-lg max-h-40 overflow-y-auto" style={{ border: "1px solid var(--border)" }}>
          {defaultEvaluatorId == null && (
            <button type="button" onClick={() => setDefaultEvaluatorId(null)} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-left" style={{ backgroundColor: "var(--secondary)" }}>
              <span>— Sem avaliador</span>
            </button>
          )}
          {filteredEvaluators.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setDefaultEvaluatorId(u.id)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-left transition-colors hover:opacity-90"
              style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none", backgroundColor: u.id === defaultEvaluatorId ? "rgba(154,176,0,0.10)" : "transparent", color: u.id === defaultEvaluatorId ? "var(--accent)" : "var(--foreground)" }}
            >
              {u.id === defaultEvaluatorId && <Check size={11} className="shrink-0" style={{ color: "var(--accent-text)" }} />}
              <span className="flex items-center gap-2"><UserCheck size={13} style={{ color: "var(--accent-text)" }} />{u.name}</span>
            </button>
          ))}
        </div>
        {defaultEvaluatorId == null && (
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase" style={{ color: DANGER_TEXT }}>
            <AlertCircle size={12} /> Sem avaliador principal definido
          </p>
        )}
      </div>

      {/* Redirecionamento */}
      <div className="space-y-2 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Pode Redirecionar Para</Label>
        <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Quando o principal não puder avaliar, para onde pode redirecionar?</p>
        <Select value={redirectMode} onValueChange={v => { setRedirectMode(v as "none" | "area" | "specific"); setRedirectCollapsed(true); }}>
          <SelectTrigger className="h-11 rounded-lg font-bold uppercase text-xs" style={fieldStyle}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem redirecionamento</SelectItem>
            <SelectItem value="area">Qualquer usuário da área</SelectItem>
            <SelectItem value="specific">Usuários específicos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {redirectMode === "area" && (
        <div className="space-y-2">
          <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Área de Redirecionamento</Label>
          <Select value={redirectAreaId != null ? String(redirectAreaId) : "__none"} onValueChange={v => setRedirectAreaId(v === "__none" ? null : parseInt(v))}>
            <SelectTrigger className="h-11 rounded-lg font-bold uppercase text-xs" style={fieldStyle}>
              <SelectValue placeholder="Selecione a área..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">— Selecione</SelectItem>
              {areas.map(a => (
                <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {redirectMode === "specific" && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setRedirectCollapsed(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors hover:opacity-90"
            style={{ backgroundColor: "var(--secondary)" }}
          >
            <span className="flex items-center gap-2 font-bold uppercase text-xs" style={{ color: "var(--muted-foreground)" }}>
              <Users size={13} />
              {redirectCount === 0
                ? "Nenhum avaliador de backup selecionado"
                : `${redirectCount} avaliador${redirectCount > 1 ? "es" : ""} de backup selecionado${redirectCount > 1 ? "s" : ""}`}
            </span>
            {redirectCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>

          {!redirectCollapsed && (
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <Input placeholder="Buscar avaliador..." value={redirectSearch} onChange={e => setRedirectSearch(e.target.value)} className="h-8 rounded-lg text-sm" style={fieldStyle} />
              </div>
              <div className="max-h-44 overflow-y-auto">
                {filteredRedirectEvaluators.length === 0 ? (
                  <p className="px-4 py-3 text-xs" style={{ color: "var(--muted-foreground)" }}>Nenhum resultado para "{redirectSearch}"</p>
                ) : filteredRedirectEvaluators.map((u, i) => (
                  <label key={u.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:opacity-90" style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none", backgroundColor: selectedRedirectUsers.has(u.id) ? "rgba(154,176,0,0.10)" : "transparent" }}>
                    <input type="checkbox" checked={selectedRedirectUsers.has(u.id)} onChange={() => toggleRedirectUser(u.id)} className="h-4 w-4" />
                    <span className="text-sm font-bold uppercase">{u.name}</span>
                    {u.id === defaultEvaluatorId && (
                      <span className="ml-auto text-[11px] font-black uppercase rounded px-1.5 py-0.5" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>Principal</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Link Freelancer */}
      <div className="space-y-2 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={allowPublicLink} onChange={e => setAllowPublicLink(e.target.checked)} className="h-4 w-4 mt-0.5" />
          <span>
            <span className="block font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Permite Link Freelancer</span>
            <span className="block text-[11px]" style={{ color: "var(--muted-foreground)" }}>Libera gerar um link público de avaliação (sem conta no sistema) para este critério — use só para áreas que recebem freelancers (ex.: Ativação, Produção, Cenografia). Logística e Atendimento são sempre time da casa, não precisam disso.</span>
          </span>
        </label>
      </div>

      <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg font-bold uppercase text-xs transition-colors hover:opacity-80" style={{ border: "1px solid var(--border)" }}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={saveMutation.isPending}
          onClick={handleSave}
          className="px-5 py-2.5 rounded-lg font-bold uppercase text-xs disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {saveMutation.isPending ? "Salvando..." : "Salvar Roteamento"}
        </button>
      </div>
    </div>
  );
}
