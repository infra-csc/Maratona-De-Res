import { cn } from "@/lib/utils";

interface PlatoonBadgeProps {
  platoon: string | null | undefined;
  className?: string;
  colorHex?: string | null;
}

export function PlatoonBadge({ platoon, className, colorHex }: PlatoonBadgeProps) {
  if (!platoon) return <span className="text-muted-foreground text-xs">—</span>;

  let colorClass = "bg-slate-100 text-slate-700 border-slate-200";
  
  if (platoon.toLowerCase().includes("quênia")) {
    colorClass = "bg-[#fef9c3] text-[#854d0e] border-[#fef08a]";
  } else if (platoon.toLowerCase().includes("azul")) {
    colorClass = "bg-blue-100 text-blue-800 border-blue-200";
  } else if (platoon.toLowerCase().includes("verde")) {
    colorClass = "bg-green-100 text-green-800 border-green-200";
  } else if (platoon.toLowerCase().includes("branco")) {
    colorClass = "bg-slate-100 text-slate-700 border-slate-200";
  }

  return (
    <span 
      className={cn("text-xs px-2.5 py-0.5 rounded-full font-medium border inline-flex items-center", colorClass, className)}
      style={colorHex ? { backgroundColor: `${colorHex}15`, color: colorHex, borderColor: `${colorHex}30` } : undefined}
    >
      {platoon}
    </span>
  );
}
