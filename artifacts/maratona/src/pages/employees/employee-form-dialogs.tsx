import type { FieldErrors, UseFormHandleSubmit, UseFormRegister, UseFormSetValue } from "react-hook-form";
import type { EmployeeInput } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { CONDENSED, DANGER_TEXT } from "@/lib/premium-theme";
import { fieldStyle, requiredText } from "./utils";
import type { EmploymentType } from "./types";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="text-[11px] font-bold" style={{ color: DANGER_TEXT }}>{message}</p>;
}

/** "Novo Colaborador": botão-gatilho + diálogo. O formulário (react-hook-form) vive no pai. */
export function CreateEmployeeDialog({
  open,
  onOpenChange,
  register,
  handleSubmit,
  errors,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  register: UseFormRegister<EmployeeInput>;
  handleSubmit: UseFormHandleSubmit<EmployeeInput>;
  errors: FieldErrors<EmployeeInput>;
  onSubmit: (d: EmployeeInput) => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          data-testid="button-create-employee"
          className="h-10 px-4 rounded-lg font-black text-xs uppercase tracking-wide flex items-center gap-2 transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <Plus size={16} /> Novo Colaborador
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Novo Colaborador</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5 pt-4"
        >
          <div className="space-y-1.5">
            <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nome Completo <span style={{ color: DANGER_TEXT }}>*</span></Label>
            <Input data-testid="input-employee-name" aria-invalid={!!errors.name} {...register("name", requiredText("Informe o nome completo."))} placeholder="Nome do colaborador" className="h-11 rounded-lg" style={fieldStyle} />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>CPF</Label>
            <Input data-testid="input-employee-document" {...register("document")} placeholder="000.000.000-00" className="h-11 rounded-lg" style={fieldStyle} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>E-mail</Label>
              <Input data-testid="input-employee-email" type="email" {...register("email")} placeholder="email@exemplo.com" className="h-11 rounded-lg" style={fieldStyle} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Telefone</Label>
              <Input data-testid="input-employee-phone" {...register("phone")} placeholder="(11) 99999-9999" className="h-11 rounded-lg" style={fieldStyle} />
            </div>
          </div>
          <div className="rounded-lg px-3.5 py-2.5 flex items-center gap-2" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Tipo de Contratação</span>
            <span className="ml-auto text-xs font-black uppercase" style={{ color: "var(--foreground)" }}>Casa</span>
          </div>
          <p className="text-[11px] -mt-3" style={{ color: "var(--muted-foreground)" }}>
            Cadastro manual é sempre "Casa" — colaboradores Freela vêm pela sincronização. Para alterar depois, edite o colaborador.
          </p>
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <button type="button" onClick={() => onOpenChange(false)} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
            <button
              data-testid="button-submit-employee"
              type="submit"
              disabled={isPending}
              className="h-10 px-5 rounded-lg font-bold text-sm uppercase disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              {isPending ? "Criando..." : "Criar Colaborador"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** "Editar Colaborador": aberto quando há colaborador em edição. O formulário vive no pai. */
export function EditEmployeeDialog({
  open,
  onClose,
  register,
  handleSubmit,
  errors,
  setValue,
  functionName,
  employmentType,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  register: UseFormRegister<EmployeeInput>;
  handleSubmit: UseFormHandleSubmit<EmployeeInput>;
  errors: FieldErrors<EmployeeInput>;
  setValue: UseFormSetValue<EmployeeInput>;
  functionName: EmployeeInput["functionName"];
  employmentType: EmployeeInput["employmentType"];
  onSubmit: (d: EmployeeInput) => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Editar Colaborador</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5 pt-4"
        >
          <div className="space-y-1.5">
            <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nome Completo <span style={{ color: DANGER_TEXT }}>*</span></Label>
            <Input data-testid="input-edit-employee-name" aria-invalid={!!errors.name} {...register("name", requiredText("Informe o nome completo."))} placeholder="Nome do colaborador" className="h-11 rounded-lg" style={fieldStyle} />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>CPF</Label>
            <Input data-testid="input-edit-employee-document" {...register("document")} placeholder="000.000.000-00" className="h-11 rounded-lg" style={fieldStyle} />
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Função</Label>
            <Select value={functionName} onValueChange={v => setValue("functionName", v)}>
              <SelectTrigger data-testid="select-edit-employee-func" className="h-11 rounded-lg" style={fieldStyle}>
                <SelectValue placeholder="Selecione a função..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cenotécnica">Cenotécnica</SelectItem>
                <SelectItem value="Sup Ceno">Sup Ceno</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>E-mail</Label>
              <Input data-testid="input-edit-employee-email" type="email" {...register("email")} placeholder="email@exemplo.com" className="h-11 rounded-lg" style={fieldStyle} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Telefone</Label>
              <Input data-testid="input-edit-employee-phone" {...register("phone")} placeholder="(11) 99999-9999" className="h-11 rounded-lg" style={fieldStyle} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Tipo de Contratação</Label>
            <Select value={employmentType} onValueChange={v => setValue("employmentType", v as EmploymentType)}>
              <SelectTrigger data-testid="select-edit-employment-type" className="h-11 rounded-lg" style={fieldStyle}>
                <SelectValue placeholder="Selecione o tipo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="casa">Casa</SelectItem>
                <SelectItem value="freela">Freela</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
            <button
              data-testid="button-submit-edit-employee"
              type="submit"
              disabled={isPending}
              className="h-10 px-5 rounded-lg font-bold text-sm uppercase disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              {isPending ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
