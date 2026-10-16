// "Novo colaborador" (gatilho + diálogo) e "Editar colaborador". Os
// formulários (react-hook-form) vivem no pai; aqui só o desenho.
import type { FieldErrors, UseFormHandleSubmit, UseFormRegister, UseFormSetValue } from "react-hook-form";
import type { EmployeeInput } from "@workspace/api-client-react";
import { Info, Loader2, Pencil, Plus, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DialogHeading, Eyebrow, FieldErrorText, FieldLabel, Notice, Segmented, btnPrimary, btnSecondary, dialogCls, dialogFooterCls, inputCls, useReturnFocus } from "./ui";
import { requiredText } from "./utils";
import type { EmploymentType } from "./types";

const FUNCTIONS = ["Cenotécnica", "Sup Ceno"];

/** CPF, e-mail e telefone — iguais nos dois formulários. */
function ContactFields({ prefix, register }: { prefix: "employee" | "edit-employee"; register: UseFormRegister<EmployeeInput> }) {
  return (
    <>
      <div>
        <FieldLabel htmlFor={`${prefix}-document`} hint="login do app">CPF</FieldLabel>
        <input id={`${prefix}-document`} data-testid={`input-${prefix}-document`} inputMode="numeric" autoComplete="off" {...register("document")} placeholder="000.000.000-00" className={inputCls} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor={`${prefix}-email`}>E-mail</FieldLabel>
          <input id={`${prefix}-email`} data-testid={`input-${prefix}-email`} type="email" autoComplete="off" {...register("email")} placeholder="email@exemplo.com" className={inputCls} />
        </div>
        <div>
          <FieldLabel htmlFor={`${prefix}-phone`}>Telefone</FieldLabel>
          <input id={`${prefix}-phone`} data-testid={`input-${prefix}-phone`} type="tel" autoComplete="off" {...register("phone")} placeholder="(11) 99999-9999" className={inputCls} />
        </div>
      </div>
    </>
  );
}

function NameField({ prefix, register, error }: { prefix: "employee" | "edit-employee"; register: UseFormRegister<EmployeeInput>; error?: string }) {
  const errId = `${prefix}-name-error`;
  return (
    <div>
      <FieldLabel htmlFor={`${prefix}-name`} required>Nome completo</FieldLabel>
      <input id={`${prefix}-name`} data-testid={`input-${prefix}-name`} autoComplete="off" aria-invalid={!!error} aria-describedby={error ? errId : undefined}
        {...register("name", requiredText("Informe o nome completo."))} placeholder="Nome do colaborador"
        className={cn(inputCls, error && "border-[var(--status-danger)] focus:border-[var(--status-danger)]")} />
      <FieldErrorText id={errId} message={error} />
    </div>
  );
}

/** "Novo colaborador": botão-gatilho + diálogo. */
export function CreateEmployeeDialog({ open, onOpenChange, register, handleSubmit, errors, onSubmit, isPending }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  register: UseFormRegister<EmployeeInput>;
  handleSubmit: UseFormHandleSubmit<EmployeeInput>;
  errors: FieldErrors<EmployeeInput>;
  onSubmit: (d: EmployeeInput) => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={o => { if (!isPending) onOpenChange(o); }}>
      <DialogTrigger asChild>
        <button type="button" data-testid="button-create-employee" className={cn(btnPrimary, "min-h-11 lg:min-h-9 px-3.5 lg:px-4 text-[13px]")}>
          <Plus size={15} aria-hidden /> Novo<span className="hidden sm:inline"> colaborador</span>
        </button>
      </DialogTrigger>
      <DialogContent className={cn(dialogCls, "max-w-[500px] max-h-[92dvh] overflow-y-auto")}>
        <DialogHeading icon={UserPlus} Title={DialogTitle} Description={DialogDescription} title="Novo colaborador"
          description="Entra na lista pela busca e passa para “No ciclo” quando tiver nota em algum evento." />
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <NameField prefix="employee" register={register} error={errors.name?.message} />
          <ContactFields prefix="employee" register={register} />
          <Notice icon={Info} tone="neutral">
            <span className="text-foreground font-semibold">Tipo: casa.</span> Cadastro manual é sempre casa — freela vem pela sincronização. Dá para mudar depois, em Editar.
          </Notice>
          <div className={cn(dialogFooterCls, "pt-1")}>
            <button type="button" onClick={() => onOpenChange(false)} disabled={isPending} className={btnSecondary}>Cancelar</button>
            <button data-testid="button-submit-employee" type="submit" disabled={isPending} aria-busy={isPending || undefined} className={btnPrimary}>
              {isPending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <UserPlus size={15} aria-hidden />}
              {isPending ? "Criando…" : "Criar colaborador"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** "Editar colaborador": aberto quando há colaborador em edição. */
export function EditEmployeeDialog({ open, onClose, register, handleSubmit, errors, setValue, functionName, employmentType, onSubmit, isPending }: {
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
  const onCloseAutoFocus = useReturnFocus(open);
  // Função gravada fora da lista (ex.: veio da sincronização): continua visível no campo.
  const functions = functionName && !FUNCTIONS.includes(functionName) ? [functionName, ...FUNCTIONS] : FUNCTIONS;
  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !isPending) onClose(); }}>
      <DialogContent className={cn(dialogCls, "max-w-[500px] max-h-[92dvh] overflow-y-auto")} data-testid="edit-employee-dialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeading icon={Pencil} Title={DialogTitle} Description={DialogDescription} title="Editar colaborador"
          description="Casa entra no ranking e no bônus; freela não pontua. Mudar o tipo recalcula o ciclo." />
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <NameField prefix="edit-employee" register={register} error={errors.name?.message} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="edit-employee-func">Função</FieldLabel>
              <Select value={functionName} onValueChange={v => setValue("functionName", v)}>
                <SelectTrigger id="edit-employee-func" data-testid="select-edit-employee-func" className={cn(inputCls, "justify-between")}>
                  <SelectValue placeholder="Selecione a função…" />
                </SelectTrigger>
                <SelectContent>
                  {functions.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Eyebrow as="p" className="mb-1.5">Tipo</Eyebrow>
              <div data-testid="select-edit-employment-type">
                <Segmented<EmploymentType>
                  label="Tipo de contratação"
                  value={(employmentType as EmploymentType) ?? "casa"}
                  onChange={v => setValue("employmentType", v)}
                  options={[{ value: "casa", label: "Casa", testId: "option-type-casa" }, { value: "freela", label: "Freela", testId: "option-type-freela" }]}
                />
              </div>
            </div>
          </div>
          <ContactFields prefix="edit-employee" register={register} />
          <div className={cn(dialogFooterCls, "pt-1")}>
            <button type="button" onClick={onClose} disabled={isPending} className={btnSecondary}>Cancelar</button>
            <button data-testid="button-submit-edit-employee" type="submit" disabled={isPending} aria-busy={isPending || undefined} className={btnPrimary}>
              {isPending && <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" />}
              {isPending ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
