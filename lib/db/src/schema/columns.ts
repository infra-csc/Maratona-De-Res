import { customType } from "drizzle-orm/pg-core";

/**
 * Data-hora com fuso (`timestamp with time zone`) para TODAS as colunas de
 * instante do app. Grava sempre ISO em UTC.
 *
 * Por que não `timestamp(..., { withTimezone: true })` do Drizzle: ele lê a
 * string do banco com `new Date(valor)`. Enquanto a produção ainda tiver as
 * colunas antigas (sem fuso — entre publicar o app e rodar a migração 0002),
 * o valor chega como "2026-09-25 10:00:00", e `new Date` o leria no fuso do
 * servidor. Aqui, valor sem fuso é tratado como UTC (o que as colunas antigas
 * sempre guardaram), e valor com fuso é lido como veio. Assim o app novo lê
 * certo antes E depois da migração, em qualquer fuso de servidor.
 */
const HAS_OFFSET = /(?:[zZ]|[+-]\d{2}(?::?\d{2})?)$/;

export function parseDbTimestamp(value: string | Date): Date {
  if (value instanceof Date) return value;
  return new Date(HAS_OFFSET.test(value) ? value : `${value.replace(" ", "T")}Z`);
}

export const timestamptz = customType<{ data: Date; driverData: string | Date }>({
  dataType: () => "timestamp with time zone",
  toDriver: (value) => value.toISOString(),
  fromDriver: (value) => parseDbTimestamp(value),
});
