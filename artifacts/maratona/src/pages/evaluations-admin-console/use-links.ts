import { plural } from "@/lib/utils";
import { useState } from "react";
import type { EventDetail } from "@workspace/api-client-react";
import {
  useCreateAdminPublicToken, useAllPublicTokens,
  useCreateConformityPublicToken, useCreateFerramentasPublicToken,
  type AdminPublicToken,
} from "@/lib/routing-api";
import { CENOGRAFIA_AREA_ID, sameIdSet } from "./helpers";
import { cenografiaItemsLabel } from "../evaluations/constants";
import type { ToastFn } from "./use-event-mutations";
import type { AreaBatchPlanRow, BatchLink, ConformityLinkDialogState, CritRow, EnrichedEvent, LinkDialogState } from "./types";
import { displayCriterionName } from "../../lib/criterion-name";

/** Estado dos diálogos de link (freelancer por critério, "Gerar todos" e
 *  matriz de conformidade). Vive no componente principal: é preservado entre
 *  aberturas exatamente como antes. */
export function useLinkDialogState() {
  // --- Link Freelancer dialog (critério) ---
  const [linkDialog, setLinkDialog] = useState<LinkDialogState | null>(null);
  const [linkRecipientName, setLinkRecipientName] = useState("");
  const [generatedLinkUrl, setGeneratedLinkUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  /** A API devolveu um link pendente já existente (reused) — com o nome atualizado para este valor. */
  const [linkReusedName, setLinkReusedName] = useState<string | null>(null);
  // --- "Gerar todos os links" (um por avaliador/área, Cenografia já combina critério + matriz) ---
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchLinks, setBatchLinks] = useState<BatchLink[]>([]);
  const [batchAllCopied, setBatchAllCopied] = useState(false);
  /** Ciclo por área: plano de "Gerar todos" (uma linha por área) à espera da escolha do avaliador. */
  const [batchPlan, setBatchPlan] = useState<AreaBatchPlanRow[] | null>(null);
  // --- Link dialog para Matriz de Conformidade ---
  const [conformityLinkDialog, setConformityLinkDialog] = useState<ConformityLinkDialogState | null>(null);
  const [conformityLinkRecipientName, setConformityLinkRecipientName] = useState("");
  const [conformityLinkUrl, setConformityLinkUrl] = useState<string | null>(null);
  const [conformityLinkCopied, setConformityLinkCopied] = useState(false);
  return {
    linkDialog, setLinkDialog, linkRecipientName, setLinkRecipientName,
    generatedLinkUrl, setGeneratedLinkUrl, linkCopied, setLinkCopied, linkReusedName, setLinkReusedName,
    batchOpen, setBatchOpen, batchRunning, setBatchRunning, batchLinks, setBatchLinks, batchAllCopied, setBatchAllCopied,
    batchPlan, setBatchPlan,
    conformityLinkDialog, setConformityLinkDialog, conformityLinkRecipientName, setConformityLinkRecipientName,
    conformityLinkUrl, setConformityLinkUrl, conformityLinkCopied, setConformityLinkCopied,
  };
}

export type LinkDialogStore = ReturnType<typeof useLinkDialogState>;

/** Um link a gerar: critérios de uma área, em nome de um avaliador. */
interface LinkGroup {
  key: string;
  areaName: string;
  evaluatorId: number;
  evaluatorName: string;
  criterionIds: number[];
  criterionNames: string[];
  includeConformity: boolean;
}

/** Critérios do ciclo por área que ainda aceitam link: abertos, agrupados por área. */
export function pendingAreaGroups(selected: EnrichedEvent | null): AreaBatchPlanRow[] {
  const byArea = new Map<number, AreaBatchPlanRow>();
  for (const c of selected?.criteria ?? []) {
    if (c.state === "done" || c.areaId == null) continue;
    const row = byArea.get(c.areaId) ?? {
      areaId: c.areaId, areaName: c.areaName, criterionIds: [], criterionNames: [],
      // A matriz da Cenografia vai junto no link da área — só enquanto ninguém a respondeu.
      includeConformity: c.areaId === CENOGRAFIA_AREA_ID && !!selected?.conformityNeeded && !selected?.conformityCenografiaDone,
      evaluatorId: null, evaluatorName: null,
    };
    row.criterionIds.push(c.criterionId);
    row.criterionNames.push(displayCriterionName(c.criterionName));
    byArea.set(c.areaId, row);
  }
  return [...byArea.values()].sort((a, b) => a.areaName.localeCompare(b.areaName, "pt-BR"));
}

/** Geração de links públicos (tokens) do evento selecionado. */
export function useLinkActions({ linkState, selected, selectedEventId, selectedDetail, toast }: {
  linkState: LinkDialogStore;
  selected: EnrichedEvent | null;
  selectedEventId: number | null;
  selectedDetail: EventDetail | undefined;
  toast: ToastFn;
}) {
  const {
    linkDialog, setLinkDialog, linkRecipientName, setLinkRecipientName, setGeneratedLinkUrl, setLinkCopied, setLinkReusedName,
    setBatchOpen, setBatchRunning, setBatchLinks, setBatchAllCopied, batchPlan, setBatchPlan,
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
    setLinkRecipientName("");
    setGeneratedLinkUrl(null);
    setLinkCopied(false);
    setLinkReusedName(null);
    if (c.areaMode) {
      // Ciclo por área: um link por área com todos os critérios ainda abertos
      // dela; o admin escolhe em nome de qual avaliador da área (a designação
      // antiga não vale — a API recusaria com 409 AREA_MODE_OTHER_AREA).
      const group = pendingAreaGroups(selected).find(g => g.areaId === c.areaId);
      if (!group) return;
      setLinkDialog({
        criterionIds: group.criterionIds, criterionNames: group.criterionNames,
        assignedToId: null, assignedToName: null, includeConformity: group.includeConformity,
        areaMode: true, areaId: group.areaId, areaName: group.areaName,
      });
      refetchAllTokens();
      return;
    }
    if (!c.assignedToId || !c.assignedToName) return;
    // Bundle all criteria from the same area+evaluator into a single questionnaire
    const siblings = (selected?.criteria ?? []).filter(
      r => r.areaId === c.areaId && r.assignedToId === c.assignedToId,
    );
    const criterionIds = siblings.length > 1 ? siblings.map(r => r.criterionId) : [c.criterionId];
    const criterionNames = (siblings.length > 1 ? siblings.map(r => r.criterionName) : [c.criterionName]).map(displayCriterionName);
    const includeConformity = c.areaId === CENOGRAFIA_AREA_ID;
    setLinkDialog({
      criterionIds, criterionNames, assignedToId: c.assignedToId, assignedToName: c.assignedToName, includeConformity,
      areaMode: false, areaId: c.areaId, areaName: c.areaName,
    });
    refetchAllTokens();
  }

  function handleGenerateLink() {
    if (!linkDialog || !selected) return;
    if (linkDialog.assignedToId == null) {
      toast({ title: "Escolha o avaliador da área", description: `O link sai em nome de um avaliador de ${linkDialog.areaName}.`, variant: "destructive" });
      return;
    }
    const recipientName = linkRecipientName.trim();
    createAdminToken.mutate(
      { assignedToUserId: linkDialog.assignedToId, criterionIds: linkDialog.criterionIds, recipientName: recipientName || undefined, includeConformity: linkDialog.includeConformity },
      {
        onSuccess: (data) => {
          setGeneratedLinkUrl(evalUrl(data.tokenId));
          setLinkCopied(false);
          // Mesmo link pendente devolvido pela API — o nome de quem responde foi atualizado.
          setLinkReusedName(data.reused ? (recipientName || linkDialog.assignedToName || "o avaliador") : null);
          refetchAllTokens();
        },
        onError: (e: Error) => toast({ title: "Não foi possível gerar o link", description: e.message, variant: "destructive" }),
      },
    );
  }

  /** Gera (ou reaproveita) um link por grupo e as matrizes; abre a lista pronta. */
  async function generateGroups(groups: LinkGroup[]) {
    setBatchRunning(true);
    setBatchOpen(true);
    setBatchAllCopied(false);
    setBatchLinks([]);
    // Lista atual de tokens do evento (refetch garante que não decidimos
    // reaproveitar com base numa cópia velha do cache).
    const tokensNow: AdminPublicToken[] = (await refetchAllTokens()).data ?? allTokens ?? [];
    const pendingTokens = tokensNow.filter(t => t.usedAt == null);
    const results: BatchLink[] = [];
    for (const g of groups) {
      const base: Omit<BatchLink, "url" | "error" | "reused"> = {
        key: g.key,
        evaluatorName: g.evaluatorName,
        areaName: g.areaName,
        criterionNames: g.criterionNames,
        includeConformity: g.includeConformity,
      };
      // Reuso: já existe um link PENDENTE deste mesmo avaliador (o token admin
      // grava createdByUserId = avaliador) cobrindo EXATAMENTE estes
      // critérios, com o mesmo formato (com/sem matriz)? Então é o mesmo link —
      // não faz sentido gerar outro e deixar o anterior órfão.
      const existing = pendingTokens.find(t =>
        t.tokenType === (g.includeConformity ? "criteria_with_conformity" : "criteria")
        && t.createdByUserId === g.evaluatorId
        && sameIdSet(t.criterionIds ?? [], g.criterionIds),
      );
      if (existing) {
        results.push({ ...base, url: evalUrl(existing.id), error: null, reused: true });
        continue;
      }
      try {
        const data = await createAdminToken.mutateAsync({
          assignedToUserId: g.evaluatorId,
          criterionIds: g.criterionIds,
          includeConformity: g.includeConformity,
        });
        results.push({ ...base, url: evalUrl(data.tokenId), error: null, reused: !!data.reused });
      } catch (e) {
        results.push({ ...base, url: null, error: (e as Error).message, reused: false });
      }
    }
    // Matriz de Cenografia: normalmente já vai combinada no link do critério da
    // Cenografia (Carga). Só gera link próprio dela se NÃO houve grupo da
    // Cenografia combinado (evento sem esse critério), pra não deixar a matriz de fora.
    const hadCenoGroup = groups.some(g => g.includeConformity);
    if (!hadCenoGroup && !(selected?.areaMode && selected.conformityCenografiaDone)) {
      const cenoEvaluatorName = selectedDetail?.conformityEvaluatorName ?? "Sem avaliador";
      const cenoBase: Omit<BatchLink, "url" | "error" | "reused"> = { key: "ceno-matrix", evaluatorName: cenoEvaluatorName, areaName: "Cenografia", criterionNames: [cenografiaItemsLabel(selectedDetail?.conformityWithoutConduta)], includeConformity: true };
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
    if (!(selected?.areaMode && selected.conformityFerramentasDone)) {
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
    }

    setBatchLinks(results);
    setBatchRunning(false);
    refetchAllTokens();
    const ok = results.filter(r => r.url).length;
    const reused = results.filter(r => r.url && r.reused).length;
    const created = ok - reused;
    const failed = results.length - ok;
    toast({
      title: [
        created > 0 || reused === 0 ? plural(created, "link gerado", "links gerados") : null,
        reused > 0 ? plural(reused, "link reaproveitado", "links reaproveitados") : null,
        failed > 0 ? `${failed} com erro` : null,
      ].filter(Boolean).join(" · "),
      ...(failed > 0 ? { variant: "destructive" as const } : {}),
    });
  }

  // Gera TODOS os links do evento de uma vez: agrupa os critérios por
  // área + avaliador (mesmo agrupamento do link individual, então um avaliador
  // responde seus critérios num questionário só). Na Cenografia o link já vem
  // combinado com a Matriz de Conformidade (critério + matriz no mesmo form).
  // Ciclo por área: abre primeiro a lista das áreas para o admin escolher em
  // nome de qual avaliador de cada área (runAreaBatch gera depois).
  async function handleGenerateAllLinks() {
    if (!selected) return;
    if (selected.areaMode) {
      const plan = pendingAreaGroups(selected);
      if (plan.length === 0) {
        toast({ title: "Nenhum critério aberto", description: "Todos os critérios deste evento já foram respondidos pela área." });
        return;
      }
      setBatchLinks([]);
      setBatchAllCopied(false);
      setBatchPlan(plan);
      setBatchOpen(true);
      return;
    }
    const pending = (selected.criteria ?? []).filter(c => c.assignedToId != null && c.state !== "done");
    const byKey = new Map<string, CritRow[]>();
    for (const c of pending) {
      const key = `${c.areaId}|${c.assignedToId}`;
      byKey.set(key, [...(byKey.get(key) ?? []), c]);
    }
    if (byKey.size === 0) {
      toast({ title: "Nenhum critério pendente com avaliador atribuído", description: "Aplique os avaliadores padrão (ou atribua) antes de gerar os links.", variant: "destructive" });
      return;
    }
    setBatchPlan(null);
    await generateGroups([...byKey].map(([key, rows]) => ({
      key,
      areaName: rows[0].areaName,
      evaluatorId: rows[0].assignedToId!,
      evaluatorName: rows[0].assignedToName ?? "Avaliador",
      criterionIds: rows.map(r => r.criterionId),
      criterionNames: rows.map(r => displayCriterionName(r.criterionName)),
      includeConformity: rows[0].areaId === CENOGRAFIA_AREA_ID,
    })));
  }

  /** Ciclo por área: gera os links das áreas com avaliador escolhido no plano. */
  async function runAreaBatch() {
    const rows = (batchPlan ?? []).filter(r => r.evaluatorId != null);
    if (rows.length === 0) {
      toast({ title: "Escolha ao menos um avaliador", description: "Cada link sai em nome de um avaliador da área.", variant: "destructive" });
      return;
    }
    await generateGroups(rows.map(r => ({
      key: `area-${r.areaId}`,
      areaName: r.areaName,
      evaluatorId: r.evaluatorId!,
      evaluatorName: r.evaluatorName ?? "Avaliador",
      criterionIds: r.criterionIds,
      criterionNames: r.criterionNames,
      includeConformity: r.includeConformity,
    })));
    setBatchPlan(null);
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
        onError: (e: Error) => toast({ title: "Não foi possível gerar o link", description: e.message, variant: "destructive" }),
      },
    );
  }

  return {
    createAdminToken, allTokens, createConformityToken, createFerramentasToken,
    openLinkDialog, handleGenerateLink, handleGenerateAllLinks, runAreaBatch, handleGenerateConformityLink,
  };
}

export type LinkActions = ReturnType<typeof useLinkActions>;
