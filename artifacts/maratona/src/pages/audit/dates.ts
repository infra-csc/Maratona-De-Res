// Datas da trilha sempre no horário de Brasília, independente do navegador
// (o banco guarda UTC).
const TZ = "America/Sao_Paulo";

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const longDayFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });

/** "2026-09-25" do instante, em Brasília. */
export function dayKey(iso: string | Date): string {
  return dayKeyFmt.format(typeof iso === "string" ? new Date(iso) : iso);
}

export function fmtTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

/** Cabeçalho do grupo: "Hoje", "Ontem" ou "terça-feira, 23/09/2026". */
export function dayHeading(key: string, now = new Date()): string {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000));
  if (key === today) return "Hoje";
  if (key === yesterday) return "Ontem";
  const s = longDayFmt.format(new Date(`${key}T12:00:00-03:00`));
  return s.charAt(0).toUpperCase() + s.slice(1);
}
