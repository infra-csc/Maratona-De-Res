/**
 * Matriz de Conformidade: o que está respondido, pendente ou completo — a
 * MESMA conta na lista de Eventos (GET /events), na tela do avaliador
 * (GET /evaluations/my-area) e onde mais o status da matriz aparecer (B3).
 *
 * Itens por lado:
 *  - Cenografia: EPI, Estaiamentos, Conduta (só nos ciclos em que ela está na
 *    matriz — cycles.conformity_without_conduta = false), Destaque e Faltas/
 *    atrasos. "Faltas/atrasos" conta como respondido com o relato preenchido
 *    (o formulário atual exige o texto) ou, nos registros antigos, com a
 *    resposta "não houve" (absencesResponse = false);
 *  - Ferramentas: Guarda de Equipamentos.
 * Só conta o lado que tem responsável designado no evento.
 */
export interface ConformityAnswers {
  epi: boolean | null;
  estaiamentos: boolean | null;
  conduta: boolean | null;
  standoutResponse: boolean | null;
  absencesResponse: boolean | null;
  absencesReport: string | null;
  guardaEquipamentos: boolean | null;
}

export interface ConformityProgress {
  cenoFilled: number; cenoTotal: number; cenoDone: boolean;
  ferrFilled: number; ferrTotal: number; ferrDone: boolean;
  filled: number; total: number;
  /** Todos os itens dos lados designados respondidos (sem lado designado: false). */
  complete: boolean;
}

export function cenografiaAnswered(conf: ConformityAnswers | null | undefined, withoutConduta: boolean): boolean[] {
  const absences = !!conf?.absencesReport?.trim() || conf?.absencesResponse === false;
  return [
    conf?.epi != null,
    conf?.estaiamentos != null,
    ...(withoutConduta ? [] : [conf?.conduta != null]),
    conf?.standoutResponse != null,
    absences,
  ];
}

export function conformityProgress(
  conf: ConformityAnswers | null | undefined,
  opts: { cenografia: boolean; ferramentas: boolean; withoutConduta: boolean },
): ConformityProgress {
  const ceno = opts.cenografia ? cenografiaAnswered(conf, opts.withoutConduta) : [];
  const cenoFilled = ceno.filter(Boolean).length;
  const cenoTotal = ceno.length;
  const ferrTotal = opts.ferramentas ? 1 : 0;
  const ferrFilled = opts.ferramentas && conf?.guardaEquipamentos != null ? 1 : 0;
  const filled = cenoFilled + ferrFilled;
  const total = cenoTotal + ferrTotal;
  return {
    cenoFilled, cenoTotal, cenoDone: opts.cenografia && cenoFilled === cenoTotal,
    ferrFilled, ferrTotal, ferrDone: opts.ferramentas && ferrFilled === ferrTotal,
    filled, total, complete: total > 0 && filled === total,
  };
}
