import { useState } from "react";
import type { EventDetail } from "@workspace/api-client-react";
import {
  useCreateAdminPublicToken, useAllPublicTokens,
  useCreateConformityPublicToken, useCreateFerramentasPublicToken,
  type AdminPublicToken,
} from "@/lib/routing-api";
import { CENOGRAFIA_AREA_ID, sameIdSet } from "./helpers";
import type { ToastFn } from "./use-event-mutations";
import type { BatchLink, ConformityLinkDialogState, CritRow, EnrichedEvent, LinkDialogState } from "./types";

/** Estado dos diálogos de link (freelancer por critério, "Gerar todos" e
 *  matriz de conformidade). Vive no componente principal: é preservado entre
 *  aberturas exatamente como antes. */
export function useLinkDialogState() {
  // --- Link Freelancer dialog (critério) ---
  const [linkDialog, setLinkDialog] = useState<LinkDialogState | null>(null);
  const [linkRecipientName, setLinkRecipientName] = useState("");
  const [generatedLinkUrl, setGeneratedLinkUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  // --- "Gerar todos os links" (um por avaliador/área, Cenografia já combina critério + matriz) ---
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchLinks, setBatchLinks] = useState<BatchLink[]>([]);
  const [batchAllCopied, setBatchAllCopied] = useState(false);
  // --- Link dialog para Matriz de Conformidade ---
  const [conformityLinkDialog, setConformityLinkDialog] = useState<ConformityLinkDialogState | null>(null);
  const [conformityLinkRecipientName, setConformityLinkRecipientName] = useState("");
  const [conformityLinkUrl, setConformityLinkUrl] = useState<string | null>(null);
  const [conformityLinkCopied, setConformityLinkCopied] = useState(false);
  return {
    linkDialog, setLinkDialog, linkRecipientName, setLinkRecipientName,
    generatedLinkUrl, setGeneratedLinkUrl, linkCopied, setLinkCopied,
    batchOpen, setBatchOpen, batchRunning, setBatchRunning, batchLinks, setBatchLinks, batchAllCopied, setBatchAllCopied,
    conformityLinkDialog, setConformityLinkDialog, conformityLinkRecipientName, setConformityLinkRecipientName,
    conformityLinkUrl, setConformityLinkUrl, conformityLinkCopied, setConformityLinkCopied,
  };
}

export type LinkDialogStore = ReturnType<typeof useLinkDialogState>;

/** Geração de links públicos (tokens) do evento selecionado. */
export function useLinkActions({ linkState, selected, selectedEventId, selectedDetail, toast }: {
  linkState: LinkDialogStore;
  selected: EnrichedEvent | null;
  selectedEventId: number | null;
  selectedDetail: EventDetail | undefined;
  toast: ToastFn;
}) {
  const {
    linkDialog, setLinkDialog, linkRecipientName, setLinkRecipientName, setGeneratedLinkUrl, setLinkCopied,
    setBatchOpen, setBatchRunning, setBatchLinks, setBatchAllCopied,
    conformityLinkDialog, conformityLinkRecipientName, setConformityLinkUrl,
  } = linkState;

  const createAdminToken = useCreateAdminPublicToken(selectedEventId ?? 0);
  // Tokens de TODOS os formulários do evento selecionado — sempre carregados
  // (1 requisição por evento selecionado) para que "Gerar Todos os Links"
  // reaproveite links pendentes em vez de criar tokens novos a cada clique.
  const { data: allTokens, refetch: refetchAllTokens } = useAllPublicTokens(selectedEventId);
  const createConformityToken = useCreateConformityPublicToken(selectedEventId ?? 0);
  const createFerramentasToken = useCreateFerramentasPublicToken(selectedEventId ?? 0);
  const evalUrl = (tokenId: string) => `${window.location.origin}/eval/${tokenId}`;

  function openLinkDialog(c: CritRow) {
    if (!c.assignedToId || !c.assignedToName) return;
    // Bundle all criteria from the same area+evaluator into a single questionnaire
    const siblings = (selected?.criteria ?? []).filter(
      r => r.areaId === c.areaId && r.assignedToId === c.assignedToId,
    );
    const criterionIds = siblings.length > 1 ? siblings.map(r => r.criterionId) : [c.criterionId];
    const criterionNames = siblings.length > 1 ? siblings.map(r => r.criterionName) : [c.criterionName];
    const includeConformity = c.areaId === CENOGRAFIA_AREA_ID;
    setLinkDialog({ criterionIds, criterionNames, assignedToId: c.assignedToId, assignedToName: c.assignedToName, includeConformity });
    setLinkRecipientName("");
    setGeneratedLinkUrl(null);
    setLinkCopied(false);
    refetchAllTokens();
  }

  function handleGenerateLink() {
    if (!linkDialog || !selected) return;
    createAdminToken.mutate(
      { assignedToUserId: linkDialog.assignedToId, criterionIds: linkDialog.criterionIds, recipientName: linkRecipientName.trim() || undefined, includeConformity: linkDialog.includeConformity },
      {
        onSuccess: (data) => {
          setGeneratedLinkUrl(evalUrl(data.tokenId));
          refetchAllTokens();
        },
        onError: (e: Error) => toast({ title: "Erro ao gerar link", description: e.message, variant: "destructive" }),
      },
    );
  }

  // Gera TODOS os links do evento de uma vez: agrupa os critérios por
  // área + avaliador (mesmo agrupamento do link individual, então um avaliador
  // responde seus critérios num questionário só). Na Cenografia o link já vem
  // combinado com a Matriz de Conformidade (critério + matriz no mesmo form).
  async function handleGenerateAllLinks() {
    if (!selected) return;
    const pending = (selected.criteria ?? []).filter(c => c.assignedToId != null && c.state !== "done");
    const groups = new Map<string, CritRow[]>();
    for (const c of pending) {
      const key = `${c.areaId}|${c.assignedToId}`;
      const arr = groups.get(key) ?? [];
      arr.push(c);
      groups.set(key, arr);
    }
    if (groups.size === 0) {
      toast({ title: "Nenhum critério pendente com avaliador atribuído", description: "Aplique os avaliadores padrão (ou atribua) antes de gerar os links.", variant: "destructive" });
      return;
    }
    setBatchRunning(true);
    setBatchOpen(true);
    setBatchAllCopied(false);
    // Lista atual de tokens do evento (refetch garante que não decidimos
    // reaproveitar com base numa cópia velha do cache).
    const tokensNow: AdminPublicToken[] = (await refetchAllTokens()).data ?? allTokens ?? [];
    const pendingTokens = tokensNow.filter(t => t.usedAt == null);
    const results: BatchLink[] = [];
    for (const [key, rows] of groups) {
      const first = rows[0];
      const includeConformity = first.areaId === CENOGRAFIA_AREA_ID;
      const criterionIds = rows.map(r => r.criterionId);
      const base: Omit<BatchLink, "url" | "error" | "reused"> = {
        key,
        evaluatorName: first.assignedToName ?? "Avaliador",
        areaName: first.areaName,
        criterionNames: rows.map(r => r.criterionName),
        includeConformity,
      };
      // Reuso: já existe um link PENDENTE deste mesmo avaliador (o token admin
      // grava createdByUserId = avaliador designado) cobrindo EXATAMENTE estes
      // critérios, com o mesmo formato (com/sem matriz)? Então é o mesmo link —
      // não faz sentido gerar outro e deixar o anterior órfão.
      const existing = pendingTokens.find(t =>
        t.tokenType === (includeConformity ? "criteria_with_conformity" : "criteria")
        && t.createdByUserId === first.assignedToId
        && sameIdSet(t.criterionIds ?? [], criterionIds),
      );
      if (existing) {
        results.push({ ...base, url: evalUrl(existing.id), error: null, reused: true });
        continue;
      }
      try {
        const data = await createAdminToken.mutateAsync({
          assignedToUserId: first.assignedToId!,
          criterionIds,
          includeConformity,
        });
        results.push({ ...base, url: evalUrl(data.tokenId), error: null, reused: false });
      } catch (e) {
        results.push({ ...base, url: null, error: (e as Error).message, reused: false });
      }
    }
    // Matriz de Cenografia: normalmente já vai combinada no link do critério da
    // Cenografia (Carga). Só gera link próprio dela se NÃO houve grupo da
    // Cenografia (evento sem esse critério), pra não deixar a matriz de fora.
    const hadCenoGroup = [...groups.values()].some(rows => rows[0].areaId === CENOGRAFIA_AREA_ID);
    if (!hadCenoGroup) {
      const cenoEvaluatorName = selectedDetail?.conformityEvaluatorName ?? "Sem avaliador";
      const cenoBase: Omit<BatchLink, "url" | "error" | "reused"> = { key: "ceno-matrix", evaluatorName: cenoEvaluatorName, areaName: "Cenografia", criterionNames: ["EPI · Estaiamentos · Conduta · Faltas · Destaque"], includeConformity: true };
      const existingCeno = pendingTokens.find(t => t.tokenType === "conformity_cenografia");
      if (existingCeno) {
        results.push({ ...cenoBase, url: evalUrl(existingCeno.id), error: null, reused: true });
      } else {
        try {
          const data = await createConformityToken.mutateAsync({ recipientName: "Matriz Cenografia" });
          results.push({ ...cenoBase, url: evalUrl(data.tokenId), error: null, reused: false });
        } catch (e) {
          results.push({ ...cenoBase, url: null, error: (e as Error).message, reused: false });
        }
      }
    }
    // Matriz de Ferramentas (Guarda de Equipamentos): 1 item, sempre com link
    // próprio — não tem critério pra combinar.
    const ferramentasEvaluatorName = selectedDetail?.conformityEvaluatorFerramentasName ?? "Sem avaliador";
    const ferrBase: Omit<BatchLink, "url" | "error" | "reused"> = { key: "ferr-matrix", evaluatorName: ferramentasEvaluatorName, areaName: "Ferramentas", criterionNames: ["Guarda de Equipamentos"], includeConformity: true };
    const existingFerr = pendingTokens.find(t => t.tokenType === "conformity_ferramentas");
    if (existingFerr) {
      results.push({ ...ferrBase, url: evalUrl(existingFerr.id), error: null, reused: true });
    } else {
      try {
        const data = await createFerramentasToken.mutateAsync({ recipientName: "Matriz Ferramentas" });
        results.push({ ...ferrBase, url: evalUrl(data.tokenId), error: null, reused: false });
      } catch (e) {
        results.push({ ...ferrBase, url: null, error: (e as Error).message, reused: false });
      }
    }

    setBatchLinks(results);
    setBatchRunning(false);
    refetchAllTokens();
    const ok = results.filter(r => r.url).length;
    const reused = results.filter(r => r.reused).length;
    const created = ok - reused;
    toast({
      title: `${created} link(s) gerado(s)${reused > 0 ? ` · ${reused} reaproveitado(s)` : ""}${ok < results.length ? ` · ${results.length - ok} com erro` : ""}`,
    });
  }

  function handleGenerateConformityLink() {
    if (!conformityLinkDialog || !selected) return;
    const recipientName = conformityLinkRecipientName.trim();
    if (!recipientName) { toast({ title: "Informe o nome do destinatário", variant: "destructive" }); return; }
    const mut = conformityLinkDialog.key === "cenografia" ? createConformityToken : createFerramentasToken;
    mut.mutate(
      { recipientName },
      {
        onSuccess: (data) => {
          setConformityLinkUrl(evalUrl(data.tokenId));
        },
        onError: (e: Error) => toast({ title: "Erro ao gerar link", description: e.message, variant: "destructive" }),
      },
    );
  }

  return {
    createAdminToken, allTokens, createConformityToken, createFerramentasToken,
    openLinkDialog, handleGenerateLink, handleGenerateAllLinks, handleGenerateConformityLink,
  };
}

export type LinkActions = ReturnType<typeof useLinkActions>;
