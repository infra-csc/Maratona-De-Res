/** "1 evento" / "3 eventos" — mensagens ao usuário sem "evento(s)". */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}
