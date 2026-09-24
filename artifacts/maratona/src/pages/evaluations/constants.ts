import type { CSSProperties } from "react";
import { AMBER, INFO, AMBER_TEXT, INFO_TEXT } from "@/lib/premium-theme";

// Estados semânticos fixos (iguais nos dois temas) onde não existe classe de
// token: pendente / em andamento = AMBER, informativo = INFO, erro = WARNING.
export const AMBER_TINT: CSSProperties = { backgroundColor: "rgba(232,162,61,0.12)", color: AMBER_TEXT, borderColor: AMBER };
export const INFO_TINT: CSSProperties = { backgroundColor: "rgba(91,141,239,0.12)", color: INFO_TEXT, borderColor: INFO };

// Áreas fixas da Matriz de Conformidade (usuários para os popups de redirecionar).
export const CENOGRAFIA_AREA_ID = 13;
export const FERRAMENTAS_AREA_ID = 16;

// Rótulos das extremidades da escala de nota (0 e 10).
export const SCORE_LABELS: Record<number, string> = {
  0: "Crítico, não atendeu ao básico",
  10: "Perfeição, atendeu completamente e sem erros",
};

export type CenografiaKey = "epi" | "estaiamentos" | "conduta";
export type CenografiaCommentKey = "epiComment" | "estaiamentosComment" | "condutaComment";

// Perguntas Sim/Não da matriz de Cenografia (cada uma com comentário próprio).
export const CENOGRAFIA_ITEMS: { key: CenografiaKey; commentKey: CenografiaCommentKey; label: string; question: string }[] = [
  { key: "epi", commentKey: "epiComment", label: "Uso de EPI", question: "Todos usaram EPI na arena?" },
  { key: "estaiamentos", commentKey: "estaiamentosComment", label: "Estaiamentos / Aterramentos", question: "Estaiamento e Aterramento foram feitos de maneira correta?" },
  { key: "conduta", commentKey: "condutaComment", label: "Conduta", question: "Conduta e comportamento foram adequados? (horários, ordens e regras)" },
];
