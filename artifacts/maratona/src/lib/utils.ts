import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatEventSubtitle(e: { clientName?: string | null; city?: string | null; state?: string | null }): string {
  const place = [e.city, e.state].filter(Boolean).join("/");
  return [e.clientName, place].filter(Boolean).join(" · ");
}

/**
 * Formata uma string de data "YYYY-MM-DD" vinda do backend como UTC.
 * Usar new Date("YYYY-MM-DD") interpreta como meia-noite UTC e converte para
 * o fuso local (UTC-3 no Brasil), mostrando o dia anterior. Resolver
 * anexando T12:00:00Z (meio-dia UTC = 9h Brasília) evita a travessia de meia-noite.
 */
export function fmtDate(
  dateStr: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit" },
  locale = "pt-BR",
): string {
  if (!dateStr) return "—";
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString(locale, opts);
}

/**
 * Formata um timestamp ISO completo (ex.: "2026-09-23T14:05:00.000Z") com data e
 * hora no fuso local. Diferente de `fmtDate`, que recebe só "YYYY-MM-DD".
 */
export function fmtDateTime(
  value: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" },
  locale = "pt-BR",
): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(locale, opts);
}

export interface CycleWeekend {
  /** Sábado, "YYYY-MM-DD". */
  sat: string;
  /** Domingo, "YYYY-MM-DD". */
  sun: string;
  /** Rótulo curto "DD–DD/MM" (ou "DD/MM–DD/MM" na virada do mês). */
  label: string;
}

/**
 * Fim da faixa de fins de semana: o fim do ciclo OU o último evento do ciclo,
 * o que vier depois. Evento criado depois do fim do ciclo (ex.: outubro com o
 * ciclo de jun–set ainda aberto) também precisa de chip — antes ele sumia.
 */
export function weekendsEnd(cycleEnd: string | null | undefined, events: { endDate?: string | null; startDate?: string | null }[] | undefined): string | null {
  let end = cycleEnd ?? null;
  for (const e of events ?? []) {
    const d = (e.endDate ?? e.startDate ?? "").slice(0, 10);
    if (d && (!end || d > end)) end = d;
  }
  return end;
}

/**
 * Onde o evento cai em relação ao período do ciclo — critério ÚNICO do app
 * (o mesmo de eventPeriodPosition na API): vale a DATA DE INÍCIO do evento.
 * "after" = começa depois do fim do ciclo: não conta neste ciclo e passa para
 * o próximo quando ele for criado. "before" = começa antes do início (ex.:
 * histórico importado): continua contando no ciclo em que está.
 */
export function eventPeriodPosition(ev: { startDate?: string | null; periodPosition?: "before" | "inside" | "after" | null }, cycle: { startDate?: string | null; endDate?: string | null } | null | undefined): "before" | "inside" | "after" {
  // GET /events já manda a posição calculada no servidor: ela vale.
  if (ev.periodPosition) return ev.periodPosition;
  const d = (ev.startDate ?? "").slice(0, 10);
  if (!d || !cycle) return "inside";
  if (cycle.endDate && d > cycle.endDate) return "after";
  if (cycle.startDate && d < cycle.startDate) return "before";
  return "inside";
}

/** O evento cai fora do período do ciclo (antes do início ou depois do fim). */
export function isOutsideCycle(ev: { startDate?: string | null }, cycle: { startDate?: string | null; endDate?: string | null } | null | undefined): boolean {
  return eventPeriodPosition(ev, cycle) !== "inside";
}

/**
 * Lista os fins de semana (sáb–dom) dentro do período do ciclo.
 * Usado pela lista de eventos (chips de fim de semana), pelo dashboard e pela
 * calibração — com o fim estendido por weekendsEnd até o último evento.
 */
export function getCycleWeekends(startDate?: string | null, endDate?: string | null): CycleWeekend[] {
  if (!startDate || !endDate) return [];
  const result: CycleWeekend[] = [];
  const end = new Date(endDate + "T12:00:00");
  const d = new Date(startDate + "T12:00:00");
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  while (d <= end) {
    const sat = d.toISOString().split("T")[0];
    const sunD = new Date(d); sunD.setDate(sunD.getDate() + 1);
    const sun = sunD.toISOString().split("T")[0];
    const dd = (x: Date) => String(x.getDate()).padStart(2, "0");
    const mm = (x: Date) => String(x.getMonth() + 1).padStart(2, "0");
    // Fim de semana que vira o mês leva os dois meses ("31/10–01/11"); antes
    // saía "31–01/10", com o domingo no mês errado.
    const label = d.getMonth() === sunD.getMonth()
      ? `${dd(d)}–${dd(sunD)}/${mm(d)}`
      : `${dd(d)}/${mm(d)}–${dd(sunD)}/${mm(sunD)}`;
    result.push({ sat, sun, label });
    d.setDate(d.getDate() + 7);
  }
  return result;
}

/**
 * Número para exibição no padrão brasileiro (vírgula decimal), com casas fixas.
 * Use no lugar de `.toFixed()` em qualquer valor mostrado na tela.
 */
export function fmtNum(value: number, digits = 1): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Nota 0–100 sempre com 1 casa ("79,0"); vazio vira "—". */
export function fmtScore(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? "—" : fmtNum(value, 1);
}

/** "1 evento", "3 eventos" — plural certo, sem sufixo entre parênteses. */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? singular : pluralForm}`;
}

/** "DD/MM" do dia em que a avaliação abre: o dia seguinte ao fim do evento. */
export function evaluationOpensOn(ev: { startDate?: string | null; endDate?: string | null }): string | null {
  const end = (ev.endDate ?? ev.startDate ?? "").slice(0, 10);
  if (!end) return null;
  const d = new Date(`${end}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Hoje em Brasília, "AAAA-MM-DD". */
export function todayBR(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * Data curta de "Abre em …": "DD/MM" quando falta menos de 12 meses (sem
 * ambiguidade) e "DD/MM/AA" quando é mais longe — o selo cabe na coluna.
 */
export function fmtOpensOn(opensOn: string | null | undefined, todayStr: string = todayBR()): string {
  if (!opensOn) return "—";
  const [y, m, d] = opensOn.slice(0, 10).split("-");
  const days = (Date.parse(`${opensOn.slice(0, 10)}T12:00:00Z`) - Date.parse(`${todayStr}T12:00:00Z`)) / 86_400_000;
  return days >= 0 && days < 365 ? `${d}/${m}` : `${d}/${m}/${y.slice(2)}`;
}

/** Texto único do evento que é do PRÓXIMO ciclo (começa depois do fim do ciclo). */
export const NEXT_CYCLE_OPENS_TEXT = "Abre quando o ciclo novo for criado";

/** Código de erro da API para evento do próximo ciclo (409): não aceita avaliação até o ciclo novo existir. */
export const EVENT_NEXT_CYCLE = "EVENT_NEXT_CYCLE";

/** `code` do corpo de erro da API (`{ error, code }`), venha do ApiError gerado ou do ApiRequestError. */
export function apiErrorCode(e: unknown): string | null {
  if (!e || typeof e !== "object") return null;
  const direct = (e as { code?: unknown }).code;
  if (typeof direct === "string" && direct) return direct;
  const data = (e as { data?: { code?: unknown } | null }).data;
  return data && typeof data.code === "string" && data.code ? data.code : null;
}

/**
 * Mensagem do servidor (`{ error }` do corpo) para o toast, venha do ApiError
 * gerado ou do ApiRequestError; sem corpo, o texto padrão.
 */
export function apiErrorMessage(e: unknown, fallback: string): string {
  if (e && typeof e === "object") {
    const data = (e as { data?: { error?: unknown } | null }).data;
    if (data && typeof data.error === "string" && data.error.trim()) return data.error;
    const direct = (e as { error?: unknown }).error;
    if (typeof direct === "string" && direct.trim()) return direct;
  }
  return fallback;
}

/**
 * Cor muito clara (ex.: faixa "Branco Corrida", #f1f5f9): some no fundo claro.
 * Luminância relativa (WCAG) acima de 0,8.
 */
export function isLightColor(hex: string | null | undefined): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.8;
}

/** Contorno para barras/selos de faixa com cor clara (nas escuras, nada muda). */
export function faixaEdge(hex: string | null | undefined): { boxShadow?: string } {
  return isLightColor(hex) ? { boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.22)" } : {};
}
