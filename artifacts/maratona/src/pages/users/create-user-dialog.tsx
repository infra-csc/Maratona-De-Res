// "Novo usuário": nome, e-mail, senha inicial, papel (com o que ele faz),
// área e colaborador vinculado. Erro do servidor fica no diálogo.
import { useState } from "react";
import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  DialogHeading, FieldErrorText, FieldLabel, FOCUS_RING, btnPrimary, btnSecondary, dialogCls, dialogFooterCls, inputCls, invalidCls, useReturnFocus,
} from "./users-ui";
import { requiredText } from "./helpers";
import { AreaField, EmployeeField, RoleField } from "./user-form-fields";
import type { CreateUserFormState } from "./use-create-user";
import type { NamedOption } from "./types";

export function CreateUserDialog({ state, areas, employees }: {
  state: CreateUserFormState;
  areas: NamedOption[] | undefined;
  employees: NamedOption[];
}) {
  const { open, setCreateOpen, form, createMutation, serverError } = state;
  const { register, handleSubmit, setValue, watch, formState: { errors } } = form;
  const pending = createMutation.isPending;
  const onCloseAutoFocus = useReturnFocus(open);
  const [showPw, setShowPw] = useState(false);
  const role = watch("role") ?? "avaliador";
  const areaId = watch("areaId") ?? null;
  const employeeId = watch("employeeId") ?? null;

  return (
    <Dialog open={open} onOpenChange={o => { if (!pending) { setCreateOpen(o); setShowPw(false); } }}>
      <DialogContent className={cn(dialogCls, "max-w-[560px] max-h-[92dvh] overflow-y-auto")} data-testid="create-user-dialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeading icon={UserPlus} tone="brand" Title={DialogTitle} Description={DialogDescription} title="Novo usuário"
          description="A pessoa entra com este e-mail e a senha inicial. Passe a senha por um canal reservado." />
        <form onSubmit={handleSubmit(d => createMutation.mutate({ data: { ...d, name: d.name.trim(), email: d.email.trim() } }))} className="space-y-4" noValidate>
          <div>
            <FieldLabel htmlFor="create-user-name" required>Nome completo</FieldLabel>
            <input id="create-user-name" data-testid="input-user-name" autoComplete="off" aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "create-user-name-error" : undefined}
              {...register("name", requiredText("Informe o nome completo."))} placeholder="Nome e sobrenome"
              className={cn(inputCls, errors.name && invalidCls)} />
            <FieldErrorText id="create-user-name-error" message={errors.name?.message} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <FieldLabel htmlFor="create-user-email" required>E-mail</FieldLabel>
              <input id="create-user-email" data-testid="input-user-email" type="email" autoComplete="off" aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "create-user-email-error" : undefined}
                {...register("email", requiredText("Informe o e-mail."))} placeholder="nome@empresa.com.br"
                className={cn(inputCls, errors.email && invalidCls)} />
              <FieldErrorText id="create-user-email-error" message={errors.email?.message} />
            </div>
            <div className="min-w-0">
              <FieldLabel htmlFor="create-user-password" required hint="mín. 6 caracteres">Senha inicial</FieldLabel>
              <div className="relative">
                <input id="create-user-password" data-testid="input-user-password" type={showPw ? "text" : "password"} autoComplete="new-password"
                  aria-invalid={!!errors.password} aria-describedby={errors.password ? "create-user-password-error" : undefined}
                  {...register("password", {
                    ...requiredText("Informe a senha inicial."),
                    validate: (v: unknown) => {
                      const s = typeof v === "string" ? v : "";
                      if (!s.trim()) return "Informe a senha inicial.";
                      return s.length >= 6 || "A senha precisa ter pelo menos 6 caracteres.";
                    },
                  })}
                  className={cn(inputCls, "pr-12", errors.password && invalidCls)} />
                <button type="button" onClick={() => setShowPw(v => !v)} aria-pressed={showPw} aria-label={showPw ? "Esconder senha" : "Mostrar senha"}
                  className={cn("absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-150", FOCUS_RING)}>
                  {showPw ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                </button>
              </div>
              <FieldErrorText id="create-user-password-error" message={errors.password?.message} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <RoleField id="create-user-role" testId="select-user-role" value={role} onChange={v => setValue("role", v)} />
            <AreaField id="create-user-area" testId="select-user-area" value={areaId} role={role} areas={areas ?? []}
              onChange={v => setValue("areaId", v)} />
          </div>
          <EmployeeField id="create-user-employee" testId="select-user-employee" value={employeeId} employees={employees}
            onChange={v => setValue("employeeId", v)} />
          {serverError && <p role="alert" className="text-[13px] font-semibold text-[var(--status-danger-text)]">{serverError}</p>}
          <div className={dialogFooterCls}>
            <button type="button" onClick={() => setCreateOpen(false)} disabled={pending} className={btnSecondary}>Cancelar</button>
            <button type="submit" data-testid="button-submit-user" disabled={pending} aria-busy={pending || undefined} className={btnPrimary}>
              {pending && <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" />}
              {pending ? "Criando…" : "Criar usuário"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
