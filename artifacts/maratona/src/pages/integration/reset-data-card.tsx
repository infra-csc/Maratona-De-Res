import { useResetAllData } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Trash2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { CONDENSED } from "@/lib/premium-theme";
import { DIALOG_STYLE } from "./shared";

const RESET_CONFIRM_PHRASE = "ZERAR TUDO";

/**
 * "Zona de Risco" (só admin): reset dos dados operacionais, liberado apenas
 * depois de digitar a frase de confirmação no diálogo.
 */
export function ResetDataCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");

  const resetMutation = useResetAllData({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Dados apagados", description: data.message });
        setResetDialogOpen(false);
        setResetConfirmText("");
        qc.invalidateQueries();
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Falha ao resetar dados", description: e.message ?? "Tente novamente.", variant: "destructive" });
      },
    },
  });

  return (
    <>
      <Card className="bg-card border border-border shadow-none overflow-hidden border-l-4 border-l-destructive">
        <CardHeader className="bg-destructive/10 border-b border-destructive/30 pb-4">
          <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2 text-destructive" style={{ fontFamily: CONDENSED }}>
            <ShieldAlert size={18} /> Zona de Risco
          </CardTitle>
          <CardDescription className="text-destructive/80">
            Reset de dados operacionais de produção. Ação irreversível.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Apaga <strong>eventos, avaliações/notas, colaboradores e usuários</strong> (exceto o seu próprio login).
            Áreas, quesitos, ciclo atual e faixas de bônus <strong>são preservados</strong>.
            Use para reiniciar o cadastro de produção do zero.
          </p>
          <Button
            data-testid="button-open-reset-dialog"
            variant="destructive"
            className="w-full"
            onClick={() => setResetDialogOpen(true)}
          >
            <Trash2 size={16} className="mr-2" /> Resetar Dados Operacionais
          </Button>
        </CardContent>
      </Card>

      <Dialog open={resetDialogOpen} onOpenChange={(open) => { setResetDialogOpen(open); if (!open) setResetConfirmText(""); }}>
        <DialogContent className="sm:max-w-md rounded-xl border-border" style={DIALOG_STYLE} data-testid="dialog-reset-confirm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="text-destructive" size={20} />
              Confirmar reset de dados
            </DialogTitle>
            <DialogDescription>
              Isso vai apagar permanentemente <strong>todos os eventos, avaliações/notas, colaboradores e usuários</strong> (menos o seu login).
              Áreas, quesitos, ciclo e regras não serão afetados. Não é possível desfazer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-sm font-medium text-foreground">
              Digite <span className="font-mono font-bold">{RESET_CONFIRM_PHRASE}</span> para confirmar
            </label>
            <Input
              data-testid="input-reset-confirm"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder={RESET_CONFIRM_PHRASE}
              autoComplete="off"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setResetDialogOpen(false)}
              disabled={resetMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              data-testid="button-confirm-reset"
              variant="destructive"
              disabled={resetConfirmText !== RESET_CONFIRM_PHRASE || resetMutation.isPending}
              onClick={() => resetMutation.mutate({ data: { confirm: resetConfirmText } })}
            >
              <Trash2 size={16} className="mr-2" />
              {resetMutation.isPending ? "Apagando..." : "Apagar dados"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
