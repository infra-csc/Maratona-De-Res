import { cn } from "@/lib/utils";
import { CONDENSED } from "@/lib/premium-theme";

export function ScoreButton({ score, current, onClick, disabled, label }: { score: number, current: number | null, onClick: () => void, disabled: boolean, label?: string }) {
  const isSelected = current === score;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      className={cn(
        "border border-border rounded-lg py-3 flex items-center justify-center transition-all w-full",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:-translate-y-1 active:translate-y-0",
        isSelected
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-foreground"
      )}
    >
      <span className="text-lg md:text-xl font-black" style={{ fontFamily: CONDENSED }}>{score}</span>
    </button>
  );
}
