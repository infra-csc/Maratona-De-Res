// Zona de risco (só admin): apagar os dados operacionais, liberado só depois
// de digitar a frase de confirmação. Mesma chamada de antes.
import { useState } from "react";
import { useResetAllData } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { serverMessage } from "../criteria/helpers";
import { ActionDialog, ConsequenceList, ErrorBox, FieldLabel, ToolRow, btnDanger, btnSecondary, dialogFooterCls, inputCls } from "./integration-ui";

const RESET_CONFIRM_PHRASE = "ZERAR TUDO";

export function ResetDataCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  const resetMutation = useResetAllData({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Dados apagados", description: data.message });
        setOpen(false); setTyped("");
        qc.invalidateQueries();
      },
      onError: (e: unknown) => setError(serverMessage(e)),
    },
  });
  const close = () => { if (!resetMutation.isPending) { setOpen(false); setTyped(""); setError(null); } };

  return (
    <>
      <ToolRow icon={ShieldAlert} tone="danger" title="Apagar os dados operacionais" testId="tool-reset"
        traits={[{ label: "Não dá para desfazer", tone: "danger" }, { label: "Pede ZERAR TUDO", tone: "warn" }]}
        action={<button type="button" data-testid="button-open-reset-dialog" onClick={() => { setError(null); setOpen(true); }} className={cn(btnDanger, "min-h-11 md:min-h-9 px-3 text-[13px]")}>
          <Trash2 size={14} aria-hidden /> Apagar dados…
        </button>}>
        Apaga <span className="font-semibold text-foreground">eventos, avaliações e notas, colaboradores e usuários</span> (menos o seu login). Áreas, critérios, ciclo atual e faixas de bônus ficam. Para recomeçar o cadastro do zero.
      </ToolRow>

      <ActionDialog open={open} onOpenChange={o => { if (!o) close(); }} busy={resetMutation.isPending} icon={ShieldAlert} tone="danger" testId="dialog-reset-confirm"
        title="Apagar todos os dados operacionais?" description="Ação permanente: não existe desfazer.">
        <ConsequenceList items={[
          <>Some: <span className="font-semibold text-foreground">todos os eventos, avaliações e notas, colaboradores e usuários</span> — menos o seu login.</>,
          <>Fica: áreas, critérios, ciclo atual, regras e faixas de bônus.</>,
        ]} />
        <div>
          <FieldLabel htmlFor="reset-confirm-phrase">Digite {RESET_CONFIRM_PHRASE} para confirmar</FieldLabel>
          <input id="reset-confirm-phrase" data-testid="input-reset-confirm" value={typed} onChange={e => setTyped(e.target.value)} placeholder={RESET_CONFIRM_PHRASE} autoComplete="off"
            className={cn(inputCls, "font-mono tracking-[0.08em]")} />
        </div>
        <ErrorBox message={error} title="Falha ao apagar" />
        <div className={dialogFooterCls}>
          <button type="button" onClick={close} disabled={resetMutation.isPending} className={btnSecondary}>Cancelar</button>
          <button type="button" data-testid="button-confirm-reset" disabled={typed !== RESET_CONFIRM_PHRASE || resetMutation.isPending} aria-busy={resetMutation.isPending || undefined}
            onClick={() => resetMutation.mutate({ data: { confirm: typed } })} className={btnDanger}>
            {resetMutation.isPending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <Trash2 size={15} aria-hidden />}
            {resetMutation.isPending ? "Apagando…" : "Apagar dados"}
          </button>
        </div>
      </ActionDialog>
    </>
  );
}
