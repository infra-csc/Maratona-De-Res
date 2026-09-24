import type { UserSummary } from "@workspace/api-client-react";
import { ArrowRight, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface ConformityRedirectPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: UserSummary[] | undefined;
  selectedUserId: number | null;
  onSelectUser: (userId: number) => void;
}

// Botão "Redirecionar" da Matriz de Conformidade (Cenografia / Ferramentas):
// busca um avaliador da área e transfere a responsabilidade na hora.
export function ConformityRedirectPopover({ open, onOpenChange, users, selectedUserId, onSelectUser }: ConformityRedirectPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase border border-border rounded-lg bg-card hover:bg-secondary transition-colors">
          <ArrowRight size={12} /> Redirecionar
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="p-0 rounded-xl border-border w-64 overflow-hidden" style={{ backgroundColor: "var(--card)", color: "var(--foreground)" }}>
        <Command className="rounded-xl">
          <CommandInput placeholder="Buscar avaliador..." />
          <CommandList className="max-h-[240px]">
            <CommandEmpty className="py-4 text-center text-xs font-bold uppercase text-muted-foreground">Nenhum encontrado.</CommandEmpty>
            <CommandGroup>
              {(users ?? []).map(u => (
                <CommandItem key={u.id} value={u.name}
                  onSelect={() => onSelectUser(u.id)}
                  className="rounded-lg cursor-pointer aria-selected:bg-primary aria-selected:text-primary-foreground py-2 gap-3"
                >
                  <Check size={14} className={cn("shrink-0", selectedUserId === u.id ? "opacity-100" : "opacity-0")} />
                  <span className="text-xs font-bold uppercase truncate">{u.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
