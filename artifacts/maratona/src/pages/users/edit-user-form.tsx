import type { User } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { Mail, UserCircle } from "lucide-react";
import { DANGER_TEXT } from "@/lib/premium-theme";
import { fieldStyle, requiredText, ROLES } from "./helpers";
import { FieldError } from "./form-bits";
import type { EditUserFormValues, NamedOption } from "./types";

/** Formulário de edição; o próprio usuário não troca o nível de permissão nem se desativa. */
export function EditUserForm({
  user,
  areas,
  employees,
  isSelf,
  isPending,
  onCancel,
  onSubmit,
}: {
  user: User;
  areas: NamedOption[];
  employees: NamedOption[];
  isSelf: boolean;
  isPending: boolean;
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-4">
      <div className="space-y-1.5">
        <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nome Completo <span style={{ color: DANGER_TEXT }}>*</span></Label>
        <div className="relative">
          <UserCircle size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
          <Input data-testid="input-edit-user-name" aria-invalid={!!errors.name} {...register("name", requiredText("Informe o nome completo."))} placeholder="Nome do usuário" className="pl-9 h-11 rounded-lg" style={fieldStyle} />
        </div>
        <FieldError message={errors.name?.message} />
      </div>
      <div className="space-y-1.5">
        <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>E-mail Corporativo <span style={{ color: DANGER_TEXT }}>*</span></Label>
        <div className="relative">
          <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
          <Input data-testid="input-edit-user-email" type="email" aria-invalid={!!errors.email} {...register("email", requiredText("Informe o e-mail."))} placeholder="email@cenografica.com.br" className="pl-9 h-11 rounded-lg" style={fieldStyle} />
        </div>
        <FieldError message={errors.email?.message} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nível de Permissão <span style={{ color: DANGER_TEXT }}>*</span></Label>
          <Select defaultValue={user.role} onValueChange={v => setValue("role", v)} disabled={isSelf}>
            <SelectTrigger data-testid="select-edit-user-role" className="h-11 rounded-lg font-bold uppercase text-xs" style={fieldStyle}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isSelf && <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Você não pode alterar seu próprio nível de permissão.</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Área Responsável (Opcional)</Label>
          <Select defaultValue={user.areaId != null ? String(user.areaId) : "__none"} onValueChange={v => setValue("areaId", v === "__none" ? null : Number(v))}>
            <SelectTrigger data-testid="select-edit-user-area" className="h-11 rounded-lg font-bold uppercase text-xs" style={fieldStyle}>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Nenhuma</SelectItem>
              {areas.map(a => (
                <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Vincular a Colaborador (Opcional)</Label>
        <Select defaultValue={user.employeeId != null ? String(user.employeeId) : "__none"} onValueChange={v => setValue("employeeId", v === "__none" ? null : Number(v))}>
          <SelectTrigger data-testid="select-edit-user-employee" className="h-11 rounded-lg font-bold uppercase text-xs" style={fieldStyle}>
            <SelectValue placeholder="Nenhum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Nenhum</SelectItem>
            {employees.map(e => (
              <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Necessário para o usuário ver a página "Meu Desempenho" com os próprios resultados.</p>
      </div>
      <div className="flex items-center justify-between rounded-lg px-4 py-3" style={{ backgroundColor: "var(--secondary)" }}>
        <div>
          <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Acesso Ativo</Label>
          <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{active ? "Usuário pode acessar a plataforma normalmente." : "Usuário fica bloqueado, sem excluir seu histórico."}</p>
        </div>
        <Switch
          data-testid="switch-edit-user-active"
          checked={active}
          disabled={isSelf}
          onCheckedChange={v => setValue("active", v)}
        />
      </div>
      <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <button type="button" onClick={onCancel} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
        <button
          data-testid="button-submit-edit-user"
          type="submit"
          disabled={isPending}
          className="h-10 px-5 rounded-lg font-bold text-sm uppercase disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {isPending ? "Salvando..." : "Salvar Alterações"}
        </button>
      </div>
    </form>
  );
}
