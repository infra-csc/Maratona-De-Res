import type { Dispatch, SetStateAction } from "react";
import { copyToClipboard, COPY_FAILED_TOAST } from "@/lib/clipboard";
import { Copy, X, RotateCcw } from "lucide-react";
import { CONDENSED, GOOD_TEXT, AMBER_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import type { ToastFn } from "./use-event-mutations";
import type { BatchLink, EnrichedEvent } from "./types";

/** Todos os links (batch) — resultado de "Gerar Todos os Links". */
export function BatchLinksDialog({ selected, batchRunning, batchLinks, batchAllCopied, setBatchAllCopied, setBatchOpen, batchEventHeader, toast }: {
  selected: EnrichedEvent | null;
  batchRunning: boolean;
  batchLinks: BatchLink[];
  batchAllCopied: boolean;
  setBatchAllCopied: Dispatch<SetStateAction<boolean>>;
  setBatchOpen: Dispatch<SetStateAction<boolean>>;
  batchEventHeader: string;
  toast: ToastFn;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="rounded-xl w-full max-w-lg overflow-hidden flex flex-col" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", maxHeight: "85vh" }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
          <div className="min-w-0">
            <h3 className="font-black uppercase text-sm truncate" style={{ fontFamily: CONDENSED }} title={selected?.name}>{selected?.name}</h3>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>{batchRunning ? "Gerando links..." : `${batchLinks.filter(l => l.url).length} link(s) prontos`}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {batchLinks.some(l => l.url) && (
              <button
                type="button"
                onClick={async () => {
                  const text = [
                    batchEventHeader,
                    "",
                    ...batchLinks.filter(l => l.url).map(l => `${l.evaluatorName} (${l.areaName}${l.includeConformity ? " + Matriz" : ""}): ${l.url}`),
                  ].join("\n");
                  if (await copyToClipboard(text)) { setBatchAllCopied(true); setTimeout(() => setBatchAllCopied(false), 2000); }
                  else toast(COPY_FAILED_TOAST);
                }}
                className="rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase flex items-center gap-1.5 transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                <Copy size={12} /> {batchAllCopied ? "Copiado!" : "Copiar Todos"}
              </button>
            )}
            <button type="button" onClick={() => setBatchOpen(false)} aria-label="Fechar lista de links" title="Fechar" className="rounded-lg p-1.5 transition-colors hover:opacity-80" style={{ border: "1px solid var(--border)" }}>
              <X size={14} />
            </button>
          </div>
        </div>
        <div className="px-5 py-4 space-y-2.5 overflow-y-auto">
          {batchRunning && batchLinks.length === 0 && (
            <p className="text-[11px] text-center py-6" style={{ color: "var(--muted-foreground)" }}>Gerando os links, aguarde…</p>
          )}
          {batchLinks.map(l => (
            <div key={l.key} className="rounded-lg p-3" style={{ border: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[11px] font-black uppercase" style={{ fontFamily: CONDENSED }}>{l.evaluatorName}</span>
                <span className="text-[11px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>{l.areaName}</span>
                {l.includeConformity && (
                  <span className="text-[11px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(154,176,0,0.14)", color: GOOD_TEXT }}>+ Matriz</span>
                )}
                {l.reused && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-bold uppercase px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: "rgba(232,162,61,0.14)", color: AMBER_TEXT }}
                    title="Já existia um link pendente com estes mesmos critérios para este avaliador — nenhum token novo foi criado."
                  >
                    <RotateCcw size={9} /> Link já existente (reaproveitado)
                  </span>
                )}
              </div>
              <p className="text-[11px] leading-snug mb-2" style={{ color: "var(--muted-foreground)" }}>{l.criterionNames.join(" · ")}</p>
              {l.url ? (
                <div className="flex gap-2 items-center">
                  <span className="text-[11px] font-bold break-all flex-1 select-all" style={{ color: "var(--foreground)" }}>{l.url}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      const text = `${batchEventHeader} — ${l.evaluatorName} (${l.areaName}${l.includeConformity ? " + Matriz" : ""}): ${l.url}`;
                      if (await copyToClipboard(text)) toast({ title: `Link de ${l.evaluatorName} copiado`, description: batchEventHeader });
                      else toast(COPY_FAILED_TOAST);
                    }}
                    className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase flex items-center gap-1 transition-opacity hover:opacity-90"
                    style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                  >
                    <Copy size={11} /> Copiar
                  </button>
                </div>
              ) : (
                <p className="text-[11px] font-bold" style={{ color: DANGER_TEXT }}>{l.error ?? "Falha ao gerar"}</p>
              )}
            </div>
          ))}
          {!batchRunning && (
            <p className="text-[11px] leading-snug pt-1" style={{ color: "var(--muted-foreground)" }}>
              A Matriz de Conformidade da Cenografia já vai junto no link do avaliador dessa área (critério + matriz no mesmo questionário). A matriz de Ferramentas (Guarda de Equipamentos) vem com link próprio aqui na lista.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
