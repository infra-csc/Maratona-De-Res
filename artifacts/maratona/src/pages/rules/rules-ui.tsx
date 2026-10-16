// Peças visuais da tela Regras do Sistema. A base — Chip, Eyebrow, botões,
// cabeçalho de diálogo, campos, blocos de vazio/erro, foco devolvido — vem
// das telas já redesenhadas (Critérios, Ciclos, Áreas): um produto só.
import { ApiError } from "@workspace/api-client-react";

export {
  Chip, Eyebrow, DialogHeading, btnPrimary, btnSecondary, btnSmall, btnGhost, inputCls, dialogCls, Bone, FOCUS_RING,
  EmptyBlock, ErrorBlock, Notice, surfaceCls, FieldLabel, FieldErrorText, iconBtn, StatCell, type Tone,
  btnDanger, dialogFooterCls, useReturnFocus, ConsequenceList,
} from "../criteria/criteria-ui";
export { SectionTitle } from "../cycles/cycles-ui";

/** Borda vermelha do campo com erro. */
export const invalidCls = "border-[var(--status-danger)] focus:border-[var(--status-danger)]";

/** Campo numérico compacto das linhas (44 px no toque, 36 px com mouse). */
export const numCls = "h-11 lg:h-9 rounded-lg border border-border bg-card px-2.5 text-[14px] font-semibold tabular-nums text-foreground transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-foreground/40 focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground placeholder:font-normal";

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
/** Nota com até 2 casas, vírgula ("74,99"). */
export const score = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Mensagem do servidor (`{ error }`), sem o prefixo HTTP e com "faixa" no lugar do termo antigo. */
export function serverMessage(e: unknown, fallback = "Tente novamente."): string {
  let msg = "";
  if (e instanceof ApiError) {
    const data = e.data as { error?: unknown } | null;
    if (typeof data?.error === "string") msg = data.error;
  }
  if (!msg) {
    const data = (e as { data?: { error?: unknown } } | null)?.data;
    if (data && typeof data.error === "string") msg = data.error;
  }
  if (!msg) msg = ((e as { message?: string } | null)?.message ?? "").replace(/^HTTP \d{3}[^:]*:\s*/, "");
  msg = msg.trim();
  if (!msg) return fallback;
  return msg
    .replace(/um intervalo de pelot[aã]o/gi, "uma faixa")
    .replace(/intervalos? de pelot[aã]o/gi, "faixa")
    .replace(/pelot(ão|ao|ões|oes)/gi, m => (/õ|oe/i.test(m) ? "faixas" : "faixa"))
    .replace(/minScore deve ser menor que maxScore/i, "A nota mínima precisa ser menor que a máxima.")
    .replace(/(\d)\.(\d)/g, "$1,$2");
}
