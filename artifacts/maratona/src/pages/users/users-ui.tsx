// Peças visuais da tela Usuários. A base — Chip, Eyebrow, botões, cabeçalho
// de diálogo, campos, faixa de indicadores, blocos de vazio/erro, foco
// devolvido — vem das telas já redesenhadas (Critérios, Colaboradores,
// Áreas): um produto só.
import type { ComponentType } from "react";
import { Briefcase, ClipboardCheck, Eye, ShieldCheck, UserCog, Wrench } from "lucide-react";
import { ApiError } from "@workspace/api-client-react";
import { Chip, type Tone } from "../criteria/criteria-ui";

export {
  Chip, Eyebrow, DialogHeading, btnPrimary, btnSecondary, btnSmall, btnGhost, inputCls, dialogCls, Bone, FOCUS_RING,
  EmptyBlock, ErrorBlock, Notice, surfaceCls, FieldLabel, FieldErrorText, iconBtn, StatCell, SearchField, type Tone,
  Segmented, menuItemCls, btnDanger, dialogFooterCls, useReturnFocus, triggerMemo, rememberTrigger, ConsequenceList, selectCls,
} from "../criteria/criteria-ui";
export { Avatar } from "../employees/ui";

/** Borda vermelha do campo com erro. */
export const invalidCls = "border-[var(--status-danger)] focus:border-[var(--status-danger)]";

type Icon = ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
type RoleMeta = { value: string; label: string; tone: Tone; icon: Icon; hint: string };

/** Papéis na ordem de poder, com o que cada um faz (ajuda a escolher no formulário). */
export const ROLE_META: RoleMeta[] = [
  { value: "admin", label: "Administrador", tone: "brand", icon: ShieldCheck, hint: "Tudo, inclusive outros admins, integração e auditoria." },
  { value: "rh", label: "RH", tone: "ok", icon: UserCog, hint: "Cadastros, calibração e resultados. Não altera admins." },
  { value: "diretoria", label: "Diretoria", tone: "info", icon: Briefcase, hint: "Consulta calibração, resultados, análises e ciclos." },
  { value: "operador", label: "Operador", tone: "neutral", icon: Wrench, hint: "Confirma equipes e envia avaliações; nunca vê notas." },
  { value: "avaliador", label: "Avaliador", tone: "neutral", icon: ClipboardCheck, hint: "Responde os critérios da própria área." },
  { value: "visualizador", label: "Visualizador", tone: "neutral", icon: Eye, hint: "Colaborador: vê só o próprio desempenho." },
];

export function roleMeta(role: string): RoleMeta {
  return ROLE_META.find(r => r.value === role) ?? { value: role, label: role, tone: "neutral", icon: Eye, hint: "" };
}

/** Papel em selo: ícone + texto (a cor nunca é o único sinal). */
export function RoleChip({ role, className }: { role: string; className?: string }) {
  const m = roleMeta(role);
  return <Chip tone={m.tone} icon={m.icon} className={className} title={m.hint || undefined}>{m.label}</Chip>;
}

/** CPF de login com pontos e traço (só formatação do que a tela já mostrava). */
export function fmtCpf(cpf: string | null | undefined): string {
  const d = (cpf ?? "").replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : (cpf ?? "");
}

/** Mensagem do servidor (`{ error }`), sem o prefixo HTTP do cliente gerado. */
export function serverMessage(e: unknown, fallback = "Tente novamente."): string {
  if (e instanceof ApiError) {
    const data = e.data as { error?: unknown } | null;
    if (typeof data?.error === "string" && data.error.trim()) return data.error;
  }
  const data = (e as { data?: { error?: unknown } } | null)?.data;
  if (data && typeof data.error === "string" && data.error.trim()) return data.error;
  const msg = (e as { message?: string } | null)?.message ?? "";
  return msg.replace(/^HTTP \d{3}[^:]*:\s*/, "") || fallback;
}

/** Status HTTP do erro (409 = conflito, ex.: dados de ciclo fechado). */
export function errorStatus(e: unknown): number | undefined {
  return (e as { status?: number } | null)?.status;
}
