import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, KeyRound, Mail, UserCircle } from "lucide-react";
import { CONDENSED, DANGER_TEXT } from "@/lib/premium-theme";
import { fieldStyle, requiredText, ROLES } from "./helpers";
import { FieldError } from "./form-bits";
import type { CreateUserFormState } from "./use-create-user";
import type { NamedOption } from "./types";

/** Botão "Novo Usuário" + diálogo "Adicionar Acesso". */
export function CreateUserDialog({
  state, areas, employees,
}: {
  state: CreateUserFormState;
  areas: NamedOption[] | undefined;
  employees: NamedOption[];
}) {
  const { open, setCreateOpen, form, createMutation } = state;
  const { register, handleSubmit, setValue, formState: { errors } } = form;
  return (
    <Dialog open={open} onOpenChange={setCreateOpen}>
      <DialogTrigger asChild>
        <button
          data-testid="button-create-user"
          className="h-10 px-4 rounded-lg font-black text-xs uppercase tracking-wide flex items-center gap-2 whitespace-nowrap transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <Plus size={16} /> Novo Usuário
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Adicionar Acesso</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(d => createMutation.mutate({ data: d }))} className="space-y-5 pt-4">
          <div className="space-y-1.5">
            <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nome Completo <span style={{ color: DANGER_TEXT }}>*</span></Label>
            <div className="relative">
              <UserCircle size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
              <Input data-testid="input-user-name" aria-invalid={!!errors.name} {...register("name", requiredText("Informe o nome completo."))} placeholder="Nome do usuário" className="pl-9 h-11 rounded-lg" style={fieldStyle} />
            </div>
            <FieldError message={errors.name?.message} />
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>E-mail Corporativo <span style={{ color: DANGER_TEXT }}>*</span></Label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
              <Input data-testid="input-user-email" type="email" aria-invalid={!!errors.email} {...register("email", requiredText("Informe o e-mail."))} placeholder="email@cenografica.com.br" className="pl-9 h-11 rounded-lg" style={fieldStyle} />
            </div>
            <FieldError message={errors.email?.message} />
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Senha Inicial <span style={{ color: DANGER_TEXT }}>*</span></Label>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
              <Input data-testid="input-user-password" type="password" aria-invalid={!!errors.password} {...register("password", requiredText("Informe a senha inicial."))} placeholder="••••••••" className="pl-9 h-11 rounded-lg" style={fieldStyle} />
            </div>
            <FieldError message={errors.password?.message} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nível de Permissão <span style={{ color: DANGER_TEXT }}>*</span></Label>
              <Select defaultValue="avaliador" onValueChange={v => setValue("role", v)}>
                <SelectTrigger data-testid="select-user-role" className="h-11 rounded-lg font-bold uppercase text-xs" style={fieldStyle}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Área Responsável (Opcional)</Label>
              <Select onValueChange={v => setValue("areaId", Number(v))}>
                <SelectTrigger data-testid="select-user-area" className="h-11 rounded-lg font-bold uppercase text-xs" style={fieldStyle}>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {(areas ?? []).map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Vincular a Colaborador (Opcional)</Label>
            <Select onValueChange={v => setValue("employeeId", v === "__none" ? null : Number(v))}>
              <SelectTrigger data-testid="select-user-employee" className="h-11 rounded-lg font-bold uppercase text-xs" style={fieldStyle}>
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
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <button type="button" onClick={() => setCreateOpen(false)} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
            <button
              data-testid="button-submit-user"
              type="submit"
              disabled={createMutation.isPending}
              className="h-10 px-5 rounded-lg font-bold text-sm uppercase disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              {createMutation.isPending ? "Criando..." : "Criar Usuário"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
