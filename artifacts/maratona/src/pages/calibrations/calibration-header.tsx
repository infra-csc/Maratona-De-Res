// Topo da tela: o único h1, o seletor de evento e o ciclo. Fixo no tablet e no
// desktop; no celular rola junto (a barra do app já fica presa no topo).
import { Chip } from "../evaluations/ui";
import { EventPicker, type EventPickerProps } from "./event-picker";

export type CalibrationHeaderProps = {
  pickerProps: EventPickerProps;
  cycleName: string | null;
};

export function CalibrationHeader({ pickerProps, cycleName }: CalibrationHeaderProps) {
  return (
    <div className="md:sticky md:top-0 z-30 bg-card border-b border-border px-4 md:px-6 py-3 lg:py-0 lg:h-16 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-5">
      <div className="flex items-center justify-between gap-3 shrink-0">
        <h1 data-testid="text-page-title" className="font-condensed text-[26px] uppercase tracking-[-0.01em] font-black leading-none text-foreground">
          Calibrações
        </h1>
        {cycleName && <Chip className="lg:hidden max-w-[50vw] truncate">{cycleName}</Chip>}
      </div>
      <div className="flex-1 min-w-0 lg:max-w-[640px]">
        <EventPicker {...pickerProps} />
      </div>
      {cycleName && <Chip className="hidden lg:inline-flex ml-auto max-w-[220px] truncate">{cycleName}</Chip>}
    </div>
  );
}
