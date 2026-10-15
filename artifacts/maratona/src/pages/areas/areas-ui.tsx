// Peças visuais da tela Áreas. A base — Chip, Eyebrow, botões, cabeçalho de
// diálogo, campos, faixa de indicadores, blocos de vazio/erro, foco devolvido
// — vem das telas já redesenhadas (Critérios, Colaboradores, Ciclos): um
// produto só.
export {
  Chip, Eyebrow, DialogHeading, btnPrimary, btnSecondary, btnSmall, btnGhost, inputCls, dialogCls, Bone, FOCUS_RING,
  EmptyBlock, ErrorBlock, Notice, surfaceCls, FieldLabel, FieldErrorText, iconBtn, StatCell, SearchField, type Tone,
  Segmented, menuItemCls, btnDanger, dialogFooterCls, useReturnFocus, triggerMemo, rememberTrigger, ConsequenceList,
} from "../criteria/criteria-ui";
export { Avatar } from "../employees/ui";

/** Borda vermelha do campo com erro. */
export const invalidCls = "border-[var(--status-danger)] focus:border-[var(--status-danger)]";

/** Mensagem do servidor sem o prefixo "HTTP 409 Conflict: " que o cliente gerado acrescenta. */
export { serverMessage, requiredText } from "../criteria/helpers";
