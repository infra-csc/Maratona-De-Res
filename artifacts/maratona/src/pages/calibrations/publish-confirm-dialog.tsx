// Confirmação do "Publicar": mostra exatamente o que vai passar a valer —
// cada critério calibrado, a nota salva e se sai como parcial ou final (o
// seletor de cada critério). A publicação em si é a mesma de antes.
import { Loader2, Send } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn, plural } from "@/lib/utils";
import { Chip, DialogHeading, Eyebrow, btnPrimary, btnSecondary, dialogCls } from "../evaluations/ui";
import { fmtCalScore } from "./helpers";
import type { PublishIntent } from "./types";

export type PublishItem = { id: number; name: string; score: number | string | null; intent: PublishIntent; pending: boolean };

export function PublishConfirmDialog({ open, onOpenChange, publishing, items, eventName, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publishing: boolean;
  items: PublishItem[];
  eventName: string | undefined;
  onConfirm: () => void;
}) {
  const finals = items.filter(i => i.intent === "final").length;
  const partials = items.length - finals;
  const parts = [finals > 0 ? `${finals} como final` : null, partials > 0 ? `${partials} como parcial` : null].filter(Boolean).join(" e ");
  return (
    <AlertDialog open={open} onOpenChange={o => { if (!publishing) onOpenChange(o); }}>
      <AlertDialogContent className={cn(dialogCls, "max-w-[520px]")} data-testid="dialog-confirm-publish">
        <DialogHeading
          icon={Send}
          tone="brand"
          Title={AlertDialogTitle}
          Description={AlertDialogDescription}
          title="Publicar calibração"
          description={<>
            {plural(items.length, "critério", "critérios")} de <b className="font-semibold text-foreground">{eventName}</b> — {parts}.
            {" "}Depois de publicar, o colaborador vê estas notas e a nota oficial do evento é recalculada.
          </>}
        />
        <div>
          <Eyebrow className="mb-2">O que vai valer</Eyebrow>
          <ul className="rounded-xl border border-border divide-y divide-border max-h-64 overflow-y-auto">
            {items.map(i => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-foreground leading-snug break-words">{i.name}</span>
                  {i.pending && <span className="block text-[12px] text-[var(--status-warn-text)] font-semibold">Salva, ainda não publicada</span>}
                </span>
                <Chip tone={i.intent === "final" ? "brand" : "neutral"}>{i.intent === "final" ? "Final" : "Parcial"}</Chip>
                <span className="font-condensed w-10 text-right shrink-0 text-[20px] font-black tabular-nums leading-none text-foreground">{fmtCalScore(i.score)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12.5px] text-muted-foreground">Para mudar entre parcial e final, feche e troque o seletor “Publicar como” do critério.</p>
        </div>
        <AlertDialogFooter className="gap-2 sm:gap-2 sm:space-x-0">
          <AlertDialogCancel disabled={publishing} data-testid="button-cancel-publish" className={cn(btnSecondary, "mt-0")}>Voltar</AlertDialogCancel>
          <AlertDialogAction
            data-testid="button-confirm-publish"
            disabled={publishing}
            onClick={e => { e.preventDefault(); onConfirm(); }}
            className={btnPrimary}
          >
            {publishing ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Publicando…</> : <>Publicar {plural(items.length, "critério", "critérios")}</>}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
