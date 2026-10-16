// Topo fixo, aviso de acesso restrito (usuário sem colaborador), carregando e
// a nota de sigilo do rodapé.
import { useGetCurrentCycle } from "@workspace/api-client-react";
import { CalendarRange, Lock, UserX } from "lucide-react";
import { formatCyclePeriod } from "@/components/cycle-badge";
import { cn } from "@/lib/utils";
import { Bone, Chip, surfaceCls } from "./mp-ui";

export function PageHeader() {
  const { data: cycle } = useGetCurrentCycle();
  const period = cycle ? formatCyclePeriod(cycle.startDate, cycle.endDate) : null;
  return (
    <div className="md:sticky md:top-0 z-30 bg-card border-b border-border px-4 md:px-6 py-3 md:py-0 md:h-16 flex items-center gap-3">
      <h1 data-testid="text-page-title" className="min-w-0 font-condensed text-[22px] sm:text-[26px] uppercase tracking-[-0.01em] font-black leading-[0.95] text-foreground">
        Meu desempenho
      </h1>
      {cycle && (
        <span className="ml-auto flex items-center gap-2 min-w-0" data-testid="badge-cycle-period">
          <Chip icon={CalendarRange} title={period ? `Ciclo ${cycle.name}: ${period}` : undefined}>{cycle.name}</Chip>
          {period && <span className="hidden md:inline text-[12.5px] tabular-nums text-muted-foreground truncate">{period}</span>}
        </span>
      )}
    </div>
  );
}

/** Usuário sem colaborador vinculado: o painel é só de quem participa da Maratona. */
export function RestrictedAccessNotice() {
  return (
    <div className="min-h-full flex flex-col font-body">
      <PageHeader />
      <div className="flex-1 px-4 py-10 md:py-16">
        <div className={cn(surfaceCls, "max-w-lg mx-auto px-6 py-10 text-center")} data-testid="my-performance-restricted">
          <span className="mx-auto w-12 h-12 rounded-full bg-secondary text-muted-foreground flex items-center justify-center"><UserX size={22} aria-hidden /></span>
          <p className="mt-4 font-condensed text-[24px] font-black uppercase leading-tight text-foreground">Seu acesso não está ligado a um colaborador</p>
          <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">
            Esta página mostra a nota de quem participa da Maratona de Resultados. Peça ao RH ou ao administrador para ligar o seu usuário ao seu cadastro de colaborador.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Carregando: identidade, nota e blocos. */
export function PerformanceSkeleton() {
  return (
    <div role="status" aria-label="Carregando seu desempenho" className="space-y-6">
      <div className={cn(surfaceCls, "grid lg:grid-cols-[1.25fr_1fr] overflow-hidden")}>
        <div className="p-6 space-y-4"><Bone className="h-3 w-32" /><Bone className="h-20 w-48" /><Bone className="h-2 w-full" /><Bone className="h-4 w-64 max-w-full" /></div>
        <div className="p-6 space-y-4 border-t lg:border-t-0 lg:border-l border-border"><Bone className="h-3 w-28" /><Bone className="h-9 w-36" /><Bone className="h-2 w-full" /></div>
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="space-y-3"><Bone className="h-5 w-52" /><div className={cn(surfaceCls, "p-5 space-y-3")}><Bone className="h-4 w-3/4" /><Bone className="h-4 w-1/2" /></div></div>
      ))}
    </div>
  );
}

/** Sigilo no rodapé. */
export function PrivacyNote() {
  return (
    <p className="flex items-start justify-center gap-2 text-center text-[12.5px] leading-snug text-muted-foreground max-w-xl mx-auto pt-2" data-testid="my-privacy-note">
      <Lock size={13} aria-hidden className="mt-0.5 shrink-0" />
      <span>As notas e os comentários aparecem juntos, sem o nome de quem avaliou. Quem avalia fica em sigilo.</span>
    </p>
  );
}
