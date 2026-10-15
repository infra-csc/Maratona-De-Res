import { useMemo, useState } from "react";
import type { Absence } from "@workspace/api-client-react";
import { absenceHaystack, normalize, totalPoints } from "./helpers";
import type { FilterKind } from "./types";

/**
 * Filtros da lista (busca, natureza, evento, colaborador, período) e os
 * totais de desconto/bônus calculados sobre as linhas filtradas.
 */
export function useAbsenceFilters(absences: Absence[] | undefined, typeLabel: (slug: string) => string) {
  const [search, setSearch] = useState("");
  const [filterKind, setFilterKind] = useState<FilterKind>("all");
  const [filterEventId, setFilterEventId] = useState<string>("__all");
  const [filterEmployeeId, setFilterEmployeeId] = useState<number | null>(null);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Mais recentes primeiro (data da ocorrência; empate → o lançado por último).
  const sorted = useMemo(() => (absences ?? []).slice().sort((a, b) =>
    b.date.localeCompare(a.date) || (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || b.id - a.id), [absences]);

  /** Tudo menos a natureza: base das contagens do seletor Todos/Penalidades/Méritos. */
  const withoutKind = useMemo(() => {
    const q = normalize(search);
    return sorted.filter(a => {
      if (q && !absenceHaystack(a, typeLabel).includes(q)) return false;
      if (filterEmployeeId != null && a.employeeId !== filterEmployeeId) return false;
      if (filterEventId !== "__all") {
        if (filterEventId === "__none" && a.eventId != null) return false;
        if (filterEventId !== "__none" && String(a.eventId) !== filterEventId) return false;
      }
      if (filterDateFrom && a.date < filterDateFrom) return false;
      if (filterDateTo && a.date > filterDateTo) return false;
      return true;
    });
  }, [sorted, search, filterEmployeeId, filterEventId, filterDateFrom, filterDateTo, typeLabel]);

  const filteredAbsences = filterKind === "all" ? withoutKind : withoutKind.filter(a => (a.kind === "merit" ? "merit" : "penalty") === filterKind);
  const kindCounts = {
    all: withoutKind.length,
    penalty: withoutKind.filter(a => a.kind !== "merit").length,
    merit: withoutKind.filter(a => a.kind === "merit").length,
  };

  const totalPenaltyPoints = filteredAbsences.filter(a => a.kind !== "merit").reduce((acc, a) => acc + totalPoints(a), 0);
  const totalMeritPoints = filteredAbsences.filter(a => a.kind === "merit").reduce((acc, a) => acc + totalPoints(a), 0);

  const hasActiveFilters = filterKind !== "all" || filterEventId !== "__all" || filterEmployeeId != null || !!filterDateFrom || !!filterDateTo || search.trim() !== "";

  function clearFilters() {
    setSearch(""); setFilterKind("all"); setFilterEventId("__all"); setFilterEmployeeId(null); setFilterDateFrom(""); setFilterDateTo("");
  }

  return {
    search, setSearch, filterKind, setFilterKind, filterEventId, setFilterEventId, filterEmployeeId, setFilterEmployeeId,
    filterDateFrom, setFilterDateFrom, filterDateTo, setFilterDateTo,
    filteredAbsences, kindCounts, totalPenaltyPoints, totalMeritPoints, hasActiveFilters, clearFilters,
  };
}

export type AbsenceFilters = ReturnType<typeof useAbsenceFilters>;
