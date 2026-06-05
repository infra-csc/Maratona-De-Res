import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, PlayCircle, AlertCircle, LockKeyhole, FileCheck2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const map: Record<string, { label: string; class: string; icon: React.ElementType }> = {
    open: { label: "Em avaliação", class: "bg-blue-50 text-blue-700 border-blue-200", icon: PlayCircle },
    closed: { label: "Fechado", class: "bg-slate-100 text-slate-700 border-slate-200", icon: LockKeyhole },
    calibration: { label: "Calibração", class: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertCircle },
    draft: { label: "Rascunho", class: "bg-slate-50 text-slate-600 border-slate-200", icon: Clock },
    submitted: { label: "Submetido", class: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
    pending: { label: "Pendente", class: "bg-orange-50 text-orange-700 border-orange-200", icon: Clock },
    calibrated: { label: "Calibrado", class: "bg-purple-50 text-purple-700 border-purple-200", icon: FileCheck2 },
    computed: { label: "Computado no trimestre", class: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  };

  const info = map[status] ?? { label: status, class: "bg-slate-100 text-slate-700 border-slate-200", icon: AlertCircle };
  const Icon = info.icon;

  return (
    <Badge variant="outline" className={cn("gap-1 text-xs font-medium whitespace-nowrap", info.class, className)}>
      <Icon size={12} /> {info.label}
    </Badge>
  );
}
