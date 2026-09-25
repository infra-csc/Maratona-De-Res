// Tela "Penalidades e Méritos": dados e orquestração. As peças visuais vivem
// em ./absences/: cabeçalho (exportar/novo), barra de filtros com os totais,
// grade (tabela + linha), diálogos (registrar/editar e excluir) e os hooks do
// catálogo de tipos, dos filtros, do formulário e da exclusão (use-*.ts).
import { useGetAbsences, useGetEmployees, useGetEvents, getGetAbsencesQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { usePremiumTheme, BODY } from "@/lib/premium-theme";
import { usePenaltyTypes } from "./absences/use-penalty-types";
import { useAbsenceFilters } from "./absences/use-absence-filters";
import { useAbsenceForm } from "./absences/use-absence-form";
import { useAbsenceDelete } from "./absences/use-absence-delete";
import { AbsencesHeader } from "./absences/absences-header";
import { AbsencesFiltersBar } from "./absences/absences-filters";
import { AbsencesTable } from "./absences/absences-table";
import { AbsenceFormDialog } from "./absences/absence-form-dialog";
import { DeleteAbsenceDialog } from "./absences/delete-absence-dialog";

export default function AbsencesPage() {
  const { user } = useAuth();
  usePremiumTheme();

  const qKey = getGetAbsencesQueryKey();
  const { data: absences, isLoading } = useGetAbsences(undefined, { query: { queryKey: qKey } });
  const { data: employees } = useGetEmployees({ active: true });
  const { data: events } = useGetEvents();

  const types = usePenaltyTypes();
  const filters = useAbsenceFilters(absences);
  const form = useAbsenceForm(qKey, employees, events, types);
  const removal = useAbsenceDelete(qKey);

  const canEdit = user && ["admin", "rh", "diretoria"].includes(user.role);

  return (
    <div className="min-h-full" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>
      <div className="p-6 md:p-10 space-y-8">

        {/* ── Header ── */}
        <AbsencesHeader canEdit={canEdit} onCreate={form.openCreate} />

        {/* ── Filters ── */}
        <AbsencesFiltersBar filters={filters} events={events} />

        {/* ── Table ── */}
        {isLoading ? (
          <div className="text-center py-20 text-sm font-bold uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>
            Carregando registros...
          </div>
        ) : (
          <AbsencesTable
            rows={filters.filteredAbsences}
            canEdit={canEdit}
            typeLabel={types.typeLabel}
            onEdit={form.openEdit}
            onDelete={removal.setDeleteTargetId}
          />
        )}
      </div>

      {/* ── Create / Edit modal ── */}
      <AbsenceFormDialog form={form} types={types} employees={employees} events={events} />

      {/* ── Delete confirmation ── */}
      <DeleteAbsenceDialog state={removal} />
    </div>
  );
}
