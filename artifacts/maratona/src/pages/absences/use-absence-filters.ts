import { useState } from "react";
import type { Absence } from "@workspace/api-client-react";
import type { FilterKind } from "./types";

/**
 * Filtros da grade (colaborador, tipo, evento, período) e os totais de
 * desconto/bônus calculados sobre as linhas filtradas.
 */
export function useAbsenceFilters(absences: Absence[] | undefined) {
  const [search, setSearch] = useState("");
  const [filterKind, setFilterKind] = useState<FilterKind>("all");
  const [filterEventId, setFilterEventId] = useState<string>("__all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const filteredAbsences = (absences ?? []).filter(a => {
    if (search && !(a.employeeName ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filterKind !== "all" && a.kind !== filterKind) return false;
    if (filterEventId !== "__all") {
      if (filterEventId === "__none" && a.eventId != null) return false;
      if (filterEventId !== "__none" && String(a.eventId) !== filterEventId) return false;
    }
    if (filterDateFrom && a.date < filterDateFrom) return false;
    if (filterDateTo && a.date > filterDateTo) return false;
    return true;
  });

  const penaltyRows = filteredAbsences.filter(a => a.kind !== "merit");
  const meritRows = filteredAbsences.filter(a => a.kind === "merit");
  const totalPenaltyPoints = penaltyRows.reduce((acc, curr) => acc + curr.points * curr.quantity, 0);
  const totalMeritPoints = meritRows.reduce((acc, curr) => acc + curr.points * curr.quantity, 0);

  const hasActiveFilters = filterKind !== "all" || filterEventId !== "__all" || filterDateFrom || filterDateTo || search;

  function clearFilters() {
    setSearch(""); setFilterKind("all"); setFilterEventId("__all"); setFilterDateFrom(""); setFilterDateTo("");
  }

  return {
    search, setSearch, filterKind, setFilterKind, filterEventId, setFilterEventId,
    filterDateFrom, setFilterDateFrom, filterDateTo, setFilterDateTo,
    filteredAbsences, totalPenaltyPoints, totalMeritPoints, hasActiveFilters, clearFilters,
  };
}

export type AbsenceFilters = ReturnType<typeof useAbsenceFilters>;
