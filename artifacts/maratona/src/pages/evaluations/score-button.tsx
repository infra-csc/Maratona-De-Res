import { cn } from "@/lib/utils";

// Uma nota da escala 0–10. Nome acessível = o número; selecionada = aria-pressed.
export function ScoreButton({ score, current, onClick, disabled, label }: { score: number, current: number | null, onClick: () => void, disabled: boolean, label?: string }) {
  const isSelected = current === score;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-pressed={isSelected}
      className={cn(
        "font-condensed relative min-h-12 @2xl:min-h-11 min-w-11 w-full rounded-lg border text-[20px] font-black leading-none tabular-nums",
        "flex items-center justify-center transition-[background-color,border-color,color,transform,box-shadow] duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer motion-safe:active:scale-95",
        isSelected
          ? "bg-primary text-primary-foreground border-primary shadow-[0_6px_16px_-8px_rgba(0,0,0,0.45)] motion-safe:scale-[1.04]"
          : "bg-card text-foreground border-border hover:border-foreground/35 hover:bg-secondary",
      )}
    >
      {score}
    </button>
  );
}
