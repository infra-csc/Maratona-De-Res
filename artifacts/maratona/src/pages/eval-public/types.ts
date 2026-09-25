// score: null = ainda não selecionado; number = selecionado (inclusive 0)
export interface CriterionAnswer {
  score: number | null;
  comments: string;
}

// Conformity answer state for Cenografia
export interface ConformityAnswers {
  epi: boolean | null;
  estaiamentos: boolean | null;
  conduta: boolean | null;
  epiComment: string;
  estaiamentosComment: string;
  condutaComment: string;
  // `absencesResponse` não tem controle na tela (a pergunta é texto livre
  // obrigatório); o payload envia `true` fixo — ver handleSubmit*.
  absencesReport: string;
  standoutResponse: boolean | null;
  standoutJustification: string;
}

/** Item da lista "Falta preencher": rótulo + id do campo para rolar/focar. */
export type PendingItem = { label: string; targetId: string };
