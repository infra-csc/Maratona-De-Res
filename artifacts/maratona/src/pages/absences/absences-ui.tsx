// Peças visuais da tela Penalidades e méritos (e do cadastro de tipos). A
// base — Chip, Eyebrow, botões, cabeçalho de diálogo, campos, faixa de
// indicadores, blocos de vazio/erro, foco devolvido — vem das telas já
// redesenhadas (Avaliações, Eventos, Resultados, Ciclos, Colaboradores e
// Critérios): um produto só.
import { Award, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "../criteria/criteria-ui";

export {
  Chip, Eyebrow, DialogHeading, btnPrimary, btnSecondary, btnSmall, btnGhost, inputCls, dialogCls, Bone, FOCUS_RING,
  EmptyBlock, ErrorBlock, Notice, surfaceCls, FieldLabel, FieldErrorText, iconBtn, StatCell, SearchField, type Tone,
  Segmented, menuItemCls, btnDanger, dialogFooterCls, useReturnFocus, triggerMemo, rememberTrigger, selectCls, ConsequenceList,
} from "../criteria/criteria-ui";
export { Avatar } from "../employees/ui";
export { SwitchRow } from "../cycles/cycles-ui";

/** Cor do texto de penalidade/mérito (contraste AA nos dois temas). */
export const kindText = (kind: string | undefined) =>
  kind === "merit" ? "text-[var(--status-ok-text)]" : kind === "none" ? "text-foreground" : "text-[var(--status-danger-text)]";

/** Campo inválido (borda vermelha). */
export const invalidCls = "border-[var(--status-danger)] focus:border-[var(--status-danger)]";

/** Selo do tipo de lançamento: ícone + nome, tom da natureza (cor nunca é o único sinal). */
export function KindChip({ kind, children, className, testId }: { kind: string | undefined; children: React.ReactNode; className?: string; testId?: string }) {
  const merit = kind === "merit";
  return (
    <Chip tone={merit ? "ok" : "danger"} icon={merit ? Award : MinusCircle} className={cn("max-w-full", className)} data-testid={testId}>
      <span className="truncate">{children}</span>
      <span className="sr-only">{merit ? " (mérito)" : " (penalidade)"}</span>
    </Chip>
  );
}

/** Número com sinal no estilo do produto (condensado, tabular, tom da natureza). */
export function SignedNumber({ kind, children, className }: { kind: string | undefined; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("font-condensed font-black tabular-nums leading-none tracking-[-0.01em] whitespace-nowrap", kindText(kind), className)}>
      {children}
    </span>
  );
}
