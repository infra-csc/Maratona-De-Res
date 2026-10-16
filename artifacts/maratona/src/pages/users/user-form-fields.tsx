// Campos repetidos entre "Novo usuário" e "Editar": papel (com o que ele
// faz), área (com o aviso do avaliador sem área) e o colaborador vinculado.
import { AlertTriangle, Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { FieldLabel, ROLE_META, inputCls, roleMeta } from "./users-ui";
import type { NamedOption } from "./types";

const triggerCls = cn(inputCls, "justify-between font-semibold text-[14.5px]");
const hintCls = "mt-1.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-muted-foreground";

export function RoleField({ id, value, onChange, disabled, lockedNote, testId }: {
  id: string; value: string; onChange: (v: string) => void; disabled?: boolean; lockedNote?: string; testId: string;
}) {
  const m = roleMeta(value);
  return (
    <div className="min-w-0">
      <FieldLabel htmlFor={id} required>Papel</FieldLabel>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} data-testid={testId} className={triggerCls}><SelectValue /></SelectTrigger>
        <SelectContent>
          {ROLE_META.map(r => (
            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className={hintCls}>{lockedNote ?? m.hint}</p>
    </div>
  );
}

export function AreaField({ id, value, onChange, areas, role, testId }: {
  id: string; value: number | null; onChange: (v: number | null) => void; areas: NamedOption[]; role: string; testId: string;
}) {
  const missing = role === "avaliador" && value == null;
  return (
    <div className="min-w-0">
      <FieldLabel htmlFor={id} hint={role === "avaliador" ? undefined : "opcional"}>Área</FieldLabel>
      <Select value={value != null ? String(value) : "__none"} onValueChange={v => onChange(v === "__none" ? null : Number(v))}>
        <SelectTrigger id={id} data-testid={testId} className={triggerCls}><SelectValue placeholder="Nenhuma" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">Nenhuma</SelectItem>
          {areas.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}{a.active === false ? " (inativa)" : ""}</SelectItem>)}
        </SelectContent>
      </Select>
      {missing ? (
        <p className={cn(hintCls, "text-[var(--status-warn-text)] font-semibold")}><AlertTriangle size={13} aria-hidden className="mt-[2px] shrink-0" /> Sem área, o avaliador não responde nenhum critério no ciclo por área.</p>
      ) : role === "avaliador" ? (
        <p className={hintCls}>Cada avaliador tem uma área só e responde os critérios dela.</p>
      ) : null}
    </div>
  );
}

export function EmployeeField({ id, value, onChange, employees, testId }: {
  id: string; value: number | null; onChange: (v: number | null) => void; employees: NamedOption[]; testId: string;
}) {
  return (
    <div className="min-w-0">
      <FieldLabel htmlFor={id} hint="opcional">Colaborador vinculado</FieldLabel>
      <Select value={value != null ? String(value) : "__none"} onValueChange={v => onChange(v === "__none" ? null : Number(v))}>
        <SelectTrigger id={id} data-testid={testId} className={triggerCls}><SelectValue placeholder="Nenhum" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">Nenhum</SelectItem>
          {employees.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <p className={hintCls}><Info size={13} aria-hidden className="mt-[2px] shrink-0" /> Com vínculo, a pessoa vê os próprios resultados em “Meu desempenho”.</p>
    </div>
  );
}
