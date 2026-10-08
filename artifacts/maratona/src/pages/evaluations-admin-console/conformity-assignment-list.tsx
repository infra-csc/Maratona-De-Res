import type { Dispatch, SetStateAction } from "react";
import { Eye, Link2, ShieldCheck, UserRound, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Bone, Chip, Eyebrow, btnSmall, type Tone } from "./console-ui";
import { InlinePicker } from "./pickers";
import type { SelectedEventDetail } from "./use-event-mutations";
import type { ConformityKey, ConformityLinkDialogState, ConformityRow, EnrichedEvent } from "./types";

type SetState<T> = Dispatch<SetStateAction<T>>;

/** Bloco "Matriz de conformidade" do evento selecionado: responsável, situação, ver, link e trocar. */
export function ConformityAssignmentList(props: {
  selected: EnrichedEvent;
  conformityRows: ConformityRow[];
  /** Detalhe do evento ainda carregando (responsável e itens desconhecidos). */
  loading?: boolean;
  canManage: boolean;
  canViewSubmissions: boolean;
  openConformityPicker: ConformityKey | null;
  setOpenConformityPicker: SetState<ConformityKey | null>;
  setViewConformity: SetState<ConformityKey | null>;
  setConformityLinkDialog: SetState<ConformityLinkDialogState | null>;
  setConformityLinkRecipientName: SetState<string>;
  setConformityLinkUrl: SetState<string | null>;
  setConformityLinkCopied: SetState<boolean>;
  setConformityEvaluatorMutation: SelectedEventDetail["setConformityEvaluatorMutation"];
  setConformityEvaluatorFerramentasMutation: SelectedEventDetail["setConformityEvaluatorFerramentasMutation"];
}) {
  const {
    selected, conformityRows, loading, canManage, canViewSubmissions, openConformityPicker, setOpenConformityPicker, setViewConformity,
    setConformityLinkDialog, setConformityLinkRecipientName, setConformityLinkUrl, setConformityLinkCopied,
    setConformityEvaluatorMutation, setConformityEvaluatorFerramentasMutation,
  } = props;
  // Evento do próximo ciclo: a API recusa link e resposta (409 EVENT_NEXT_CYCLE)
  // até o ciclo novo existir — sem "Link". O responsável da Matriz pode ser
  // escolhido já (preparação).
  const canLink = canManage && !selected.nextCycle;
  const saving = setConformityEvaluatorMutation.isPending || setConformityEvaluatorFerramentasMutation.isPending;
  return (
    <section aria-labelledby="conformity-title" className="mt-6">
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <Eyebrow as="h3" id="conformity-title">Matriz de conformidade</Eyebrow>
        <span className="text-[12.5px] text-muted-foreground">Responde quem é o responsável</span>
      </div>
      <ul className="rounded-xl border border-border divide-y divide-border overflow-hidden">
        {conformityRows.map(cf => {
          const complete = cf.total > 0 && cf.filled === cf.total;
          const tone: Tone = cf.evaluatorId == null ? "danger" : complete ? "ok" : cf.filled > 0 ? "warn" : "neutral";
          const status = cf.evaluatorId == null ? "Sem responsável" : complete ? "Respondida" : cf.filled > 0 ? "Em andamento" : "Pendente";
          const pickerOpen = openConformityPicker === cf.key;
          const Icon = cf.key === "cenografia" ? ShieldCheck : Wrench;
          return (
            <li key={cf.key} className="px-3.5 py-3" data-testid={`conformity-row-${cf.key}`}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
                <span className="w-9 h-9 shrink-0 rounded-lg bg-secondary text-foreground flex items-center justify-center"><Icon size={16} aria-hidden /></span>
                <div className="min-w-0 flex-1 basis-56">
                  <p className="font-condensed text-[15px] font-black uppercase leading-tight text-foreground">{cf.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-muted-foreground">
                    <span>{cf.scope}</span>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1 min-w-0">
                      <UserRound size={13} aria-hidden className="shrink-0" />
                      {loading ? <Bone className="h-3.5 w-24" /> : cf.evaluatorName
                        ? <span className="truncate font-semibold text-foreground" title="Responsável pela Matriz">{cf.evaluatorName}</span>
                        : <span className="text-[var(--status-danger-text)] font-semibold">Ninguém definido</span>}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end ml-auto">
                  <Chip tone={tone} title={`${cf.filled} de ${cf.total} itens respondidos`}>{status} · {cf.filled}/{cf.total}</Chip>
                  {cf.filled > 0 && canViewSubmissions && (
                    <button type="button" onClick={() => setViewConformity(cf.key)} className={cn(btnSmall, "min-h-11 lg:min-h-8 px-2.5 text-[12.5px]")} aria-label={`Ver respostas: ${cf.name}`}>
                      <Eye size={13} aria-hidden /> Ver
                    </button>
                  )}
                  {canLink && (
                    <button
                      type="button"
                      onClick={() => { setConformityLinkDialog({ key: cf.key, label: cf.name, evaluatorId: cf.evaluatorId, evaluatorName: cf.evaluatorName }); setConformityLinkRecipientName(""); setConformityLinkUrl(null); setConformityLinkCopied(false); }}
                      className={cn(btnSmall, "min-h-11 lg:min-h-8 px-2.5 text-[12.5px]")}
                      title="Gerar link de conformidade para freela"
                      aria-label={`Link para freela: ${cf.name}`}
                    >
                      <Link2 size={13} aria-hidden /> Link
                    </button>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      aria-expanded={pickerOpen}
                      onClick={() => setOpenConformityPicker(pickerOpen ? null : cf.key)}
                      className={cn(btnSmall, "min-h-11 lg:min-h-8 px-2.5 text-[12.5px]", cf.evaluatorId == null && "bg-primary text-primary-foreground border-transparent enabled:hover:bg-primary enabled:hover:opacity-90", pickerOpen && cf.evaluatorId != null && "bg-secondary")}
                    >
                      {cf.evaluatorId == null ? "Definir" : pickerOpen ? "Fechar" : "Trocar"}
                    </button>
                  )}
                </div>
              </div>
              {pickerOpen && (
                <div className="mt-3 rounded-lg bg-secondary/50 p-3 motion-safe:animate-in motion-safe:fade-in-0 duration-150">
                  <Eyebrow className="mb-2">{saving ? "Salvando…" : `Quem responde · ${cf.key === "cenografia" ? "Cenografia" : "Ferramentas"}`}</Eyebrow>
                  <InlinePicker
                    areaId={cf.areaId}
                    excludeId={cf.evaluatorId}
                    disabled={saving}
                    onPick={(uid) => {
                      if (cf.key === "cenografia") setConformityEvaluatorMutation.mutate({ id: selected.id, data: { userId: uid } });
                      else setConformityEvaluatorFerramentasMutation.mutate({ id: selected.id, data: { userId: uid } });
                    }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
