// Esqueletos da Central (carregando): o panorama, a fila e o painel do evento
// com a mesma geometria do conteúdo real — nada "pula" quando os dados chegam.
import { Bone, surfaceCls } from "./console-ui";
import { cn } from "@/lib/utils";

export function ConsoleSkeleton() {
  return (
    <div role="status" aria-label="Carregando a Central de Avaliações" className="space-y-5" data-testid="console-loading">
      <div className={cn(surfaceCls, "overflow-hidden grid grid-cols-2 lg:grid-cols-4 gap-px bg-border")}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="bg-card px-4 py-3.5 lg:px-5 lg:py-4 space-y-2.5">
            <Bone className="h-3 w-28" /><Bone className="h-8 w-16" /><Bone className="h-3 w-36" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)] gap-5 items-start">
        <div className={cn(surfaceCls, "overflow-hidden")}>
          <div className="p-4 space-y-3 border-b border-border">
            <Bone className="h-3 w-28" /><Bone className="h-10 w-full rounded-lg" /><Bone className="h-10 w-full rounded-lg" /><Bone className="h-8 w-full rounded-lg" />
          </div>
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="px-4 py-3.5 space-y-2 border-b border-border/60"><Bone className="h-4 w-3/4" /><Bone className="h-3 w-1/2" /><Bone className="h-1.5 w-full" /></div>
          ))}
        </div>
        <ViewSkeleton />
      </div>
      <span className="sr-only">Carregando eventos…</span>
    </div>
  );
}

/** Painel/aba carregando (detalhe do evento ainda não chegou). */
export function ViewSkeleton() {
  return (
    <div className={cn(surfaceCls, "overflow-hidden")} aria-hidden>
      <div className="px-6 pt-5 pb-4 space-y-3"><Bone className="h-3 w-32" /><Bone className="h-8 w-2/3" /><Bone className="h-3 w-48" /></div>
      <div className="border-t border-border px-6 py-4 space-y-2.5"><Bone className="h-7 w-24" /><Bone className="h-2 w-full" /></div>
      <div className="border-t border-border p-6 grid gap-3 md:grid-cols-2">
        {[0, 1, 2, 3].map(i => <Bone key={i} className="h-40 w-full rounded-xl" />)}
      </div>
    </div>
  );
}
