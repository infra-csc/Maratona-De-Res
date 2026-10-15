import type { User } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Loader2, LogOut } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { FieldErrorText, FieldLabel, Notice, btnPrimary, btnSecondary, dialogFooterCls, inputCls, invalidCls } from "./users-ui";
import { requiredText } from "./helpers";
import { AreaField, EmployeeField, RoleField } from "./user-form-fields";
import type { EditUserFormValues, NamedOption } from "./types";

/** Formulário de edição; o próprio usuário não troca o papel nem se desativa. */
export function EditUserForm({ user, areas, employees, isSelf, isPending, serverError, onCancel, onSubmit }: {
  user: User;
  areas: NamedOption[];
  employees: NamedOption[];
  isSelf: boolean;
  isPending: boolean;
  serverError: string | null;
  onCancel: () => void;
  onSubmit: (data: EditUserFormValues) => void;
}) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<EditUserFormValues>({
    defaultValues: {
      name: user.name,
      email: user.email ?? "",
      role: user.role,
      areaId: user.areaId ?? null,
      employeeId: user.employeeId ?? null,
      active: user.active,
    },
  });
  const active = watch("active");
  const role = watch("role");
  const areaId = watch("areaId");
  const employeeId = watch("employeeId");
  // O servidor encerra as sessões abertas quando o acesso é desativado ou o papel/vínculo muda.
  const endsSessions = (user.active && !active) || role !== user.role || (employeeId ?? null) !== (user.employeeId ?? null);

  return (
    <form onSubmit={handleSubmit(d => onSubmit({ ...d, name: d.name.trim(), email: d.email.trim() }))} className="space-y-4" noValidate>
      <div>
        <FieldLabel htmlFor="edit-user-name" required>Nome completo</FieldLabel>
        <input id="edit-user-name" data-testid="input-edit-user-name" autoComplete="off" aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "edit-user-name-error" : undefined}
          {...register("name", requiredText("Informe o nome completo."))} className={cn(inputCls, errors.name && invalidCls)} />
        <FieldErrorText id="edit-user-name-error" message={errors.name?.message} />
      </div>
      <div>
        <FieldLabel htmlFor="edit-user-email" required>E-mail</FieldLabel>
        <input id="edit-user-email" data-testid="input-edit-user-email" type="email" autoComplete="off" aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "edit-user-email-error" : undefined}
          {...register("email", requiredText("Informe o e-mail."))} className={cn(inputCls, errors.email && invalidCls)} />
        <FieldErrorText id="edit-user-email-error" message={errors.email?.message} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <RoleField id="edit-user-role" testId="select-edit-user-role" value={role} onChange={v => setValue("role", v)} disabled={isSelf}
          lockedNote={isSelf ? "Você não pode mudar o próprio papel." : undefined} />
        <AreaField id="edit-user-area" testId="select-edit-user-area" value={areaId} role={role} areas={areas} onChange={v => setValue("areaId", v)} />
      </div>
      <EmployeeField id="edit-user-employee" testId="select-edit-user-employee" value={employeeId} employees={employees} onChange={v => setValue("employeeId", v)} />
      <label htmlFor="edit-user-active" className={cn("flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors duration-150",
        isSelf ? "border-border bg-secondary/50 cursor-not-allowed" : "border-border hover:border-foreground/25 cursor-pointer")}>
        <span className="pt-0.5">
          <Switch id="edit-user-active" data-testid="switch-edit-user-active" checked={active} disabled={isSelf}
            onCheckedChange={v => setValue("active", v)} className="data-[state=unchecked]:bg-muted-foreground/40" />
        </span>
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold text-foreground">{active ? "Acesso ativo" : "Acesso desativado"}</span>
          <span className="block mt-0.5 text-[13px] leading-snug text-muted-foreground">
            {isSelf ? "Você não pode desativar o próprio acesso." : active ? "Entra no sistema normalmente." : "Não entra mais; o histórico de avaliações fica."}
          </span>
        </span>
      </label>
      {endsSessions && (
        <Notice icon={LogOut} tone="warn" testId="edit-user-sessions-notice">
          Ao salvar, as sessões abertas desta pessoa são encerradas e ela entra de novo.
        </Notice>
      )}
      {serverError && <p role="alert" className="text-[13px] font-semibold text-[var(--status-danger-text)]">{serverError}</p>}
      <div className={dialogFooterCls}>
        <button type="button" onClick={onCancel} disabled={isPending} className={btnSecondary}>Cancelar</button>
        <button type="submit" data-testid="button-submit-edit-user" disabled={isPending} aria-busy={isPending || undefined} className={btnPrimary}>
          {isPending && <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" />}
          {isPending ? "Salvando…" : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
