import { useState } from "react";
import { bulkUpdateUserEmails } from "@workspace/api-client-react";
import type { EmailMigrationPreviewItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { serverErrorMessage } from "./helpers";

/** "Migrar Emails Office 365" em dois passos: prévia (dryRun) → confirmar e aplicar. */
export function useEmailMigration(qKey: QueryKey) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [emailMigOpen, setEmailMigOpen] = useState(false);
  const [emailMigPreview, setEmailMigPreview] = useState<EmailMigrationPreviewItem[] | null>(null);
  const [emailMigLoading, setEmailMigLoading] = useState(false);

  async function runEmailMigration(dryRun: boolean) {
    setEmailMigLoading(true);
    try {
      const data = await bulkUpdateUserEmails({ dryRun });
      if (!dryRun) {
        toast({ title: `${data.updated ?? 0} e-mail(s) atualizado(s) com sucesso` });
        qc.invalidateQueries({ queryKey: qKey });
        setEmailMigOpen(false);
        setEmailMigPreview(null);
      } else {
        setEmailMigPreview(data.preview ?? []);
      }
    } catch (e: unknown) {
      toast({ title: "Não foi possível migrar os e-mails", description: serverErrorMessage(e, "Não foi possível migrar os e-mails. Tente novamente."), variant: "destructive" });
    } finally {
      setEmailMigLoading(false);
    }
  }

  /** Abrir sempre começa sem prévia. */
  function openMigration() {
    setEmailMigOpen(true);
    setEmailMigPreview(null);
  }

  function closeMigration() {
    setEmailMigOpen(false);
    setEmailMigPreview(null);
  }

  /** onOpenChange do Dialog: fechar (X, Esc, clique fora) descarta a prévia. */
  function onMigrationOpenChange(o: boolean) {
    setEmailMigOpen(o);
    if (!o) setEmailMigPreview(null);
  }

  return { emailMigOpen, emailMigPreview, emailMigLoading, runEmailMigration, openMigration, closeMigration, onMigrationOpenChange };
}

export type EmailMigrationState = ReturnType<typeof useEmailMigration>;
