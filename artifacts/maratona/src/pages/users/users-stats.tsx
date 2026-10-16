// Panorama dos acessos: quem entra, quem avalia (e se tem área), quem
// administra e quem ainda precisa trocar a senha. Os dois de atenção são
// atalhos de filtro (aria-pressed).
import { cn, plural } from "@/lib/utils";
import { StatCell, surfaceCls } from "./users-ui";

export type UsersQuick = "noArea" | "mustChange" | null;

export function UsersStats({ total, active, evaluators, evaluatorsNoArea, admins, rh, mustChange, quick, onQuick }: {
  total: number;
  active: number;
  evaluators: number;
  evaluatorsNoArea: number;
  admins: number;
  rh: number;
  mustChange: number;
  quick: UsersQuick;
  onQuick: (q: UsersQuick) => void;
}) {
  const toggle = (q: Exclude<UsersQuick, null>) => onQuick(quick === q ? null : q);
  const inactive = total - active;
  return (
    <section aria-label="Panorama dos acessos" className={cn(surfaceCls, "overflow-hidden grid grid-cols-2 lg:grid-cols-4 gap-px bg-border")}>
      <StatCell testId="stat-ativos" label="Ativos" value={active} unit={`de ${total}`}
        sub={inactive > 0 ? `${plural(inactive, "inativo", "inativos")}, sem entrar no sistema` : "Ninguém desativado"} />
      <StatCell testId="stat-avaliadores" label="Avaliadores" value={evaluators}
        sub={evaluatorsNoArea > 0
          ? <span className="text-[var(--status-warn-text)] font-semibold">{evaluatorsNoArea} sem área definida</span>
          : "Todos com área definida"}
        onClick={evaluatorsNoArea > 0 || quick === "noArea" ? () => toggle("noArea") : undefined}
        pressed={evaluatorsNoArea > 0 || quick === "noArea" ? quick === "noArea" : undefined}
        action={quick === "noArea" ? "Ver todos" : "Ver quais"} />
      <StatCell testId="stat-admins" label="Administradores" value={admins}
        sub={rh > 0 ? `e ${plural(rh, "pessoa", "pessoas")} do RH` : "Nenhum usuário de RH"} />
      <StatCell testId="stat-must-change" label="Trocar senha" value={mustChange}
        sub={mustChange > 0 ? "Entram e precisam criar senha nova" : "Ninguém com troca pendente"}
        onClick={mustChange > 0 || quick === "mustChange" ? () => toggle("mustChange") : undefined}
        pressed={mustChange > 0 || quick === "mustChange" ? quick === "mustChange" : undefined}
        action={quick === "mustChange" ? "Ver todos" : "Ver quais"} />
    </section>
  );
}
