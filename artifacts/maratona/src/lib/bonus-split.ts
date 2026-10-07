/**
 * Bônus OFICIAL (ciclos fechados) × PROJETADO (ciclo aberto, muda até o
 * fechamento): como mostrar o total sem misturar as duas coisas. Regra do
 * dono: a soma oficial + projetado NUNCA é o número principal — com as duas
 * partes, a tela mostra as duas lado a lado, rotuladas. Sem os campos
 * separados (API antiga), cai no texto genérico do chamador.
 */
export interface BonusSplitInput {
  bonusTotal: number;
  bonusOfficial?: number;
  bonusProjected?: number;
}

export interface BonusSplit {
  /** Rótulo do indicador ("Bônus oficial", "Bônus projetado", "Bônus oficial e projetado"). */
  label: string;
  /** Linha de apoio. */
  detail: string;
  /** Trecho de frase, sem somar as partes: "R$ 2.000 oficiais (ciclos fechados) e R$ 1.900 projetados (ciclo aberto)". */
  sentence: string;
  /** As duas partes existem (> 0): a tela mostra as duas, lado a lado, em vez de um número só. */
  both: boolean;
  /** Valor único quando há só uma parte (ou a API antiga); null quando `both`. */
  single: number | null;
  official: number | null;
  projected: number | null;
}

export function bonusSplit(k: BonusSplitInput, brl: (v: number) => string, fallback: { label: string; detail: string }): BonusSplit {
  const off = k.bonusOfficial;
  const proj = k.bonusProjected;
  if (off == null || proj == null) return { ...fallback, sentence: brl(k.bonusTotal), both: false, single: k.bonusTotal, official: null, projected: null };
  if (off > 0 && proj > 0) {
    return {
      label: "Bônus oficial e projetado",
      detail: "Oficial = ciclos fechados · projetado = ciclo aberto (muda até o fechamento)",
      sentence: `${brl(off)} oficiais (ciclos fechados) e ${brl(proj)} projetados (ciclo aberto, muda até o fechamento)`,
      both: true, single: null, official: off, projected: proj,
    };
  }
  if (off > 0) return { label: "Bônus oficial", detail: "Ciclo fechado — valor apurado", sentence: `${brl(off)} oficiais`, both: false, single: off, official: off, projected: proj };
  return { label: "Bônus projetado", detail: "Ciclo aberto — muda até o fechamento", sentence: `${brl(proj)} projetados`, both: false, single: proj, official: off, projected: proj };
}
