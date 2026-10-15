// "Como funciona" (todos os papéis): o guia da Maratona. O conteúdo e as
// regras são os mesmos; a leitura ganhou topo fixo, resumo em 4 passos,
// índice (lateral no desktop, com a seção atual marcada) e busca, exemplos com
// a conta à vista e a tabela de faixas legível no celular. Peças em ./como-funciona/.
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Gift, HelpCircle, ListOrdered, MinusCircle, ShieldCheck, Star, Tags, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUS_RING, SearchField, type Icon } from "./como-funciona/cf-ui";
import { useGuideData } from "./como-funciona/use-guide-data";
import { ConformitySection, CycleSection, Overview, ScoreSection } from "./como-funciona/sections-a";
import { AdjustmentsSection, BonusSection, EligibilitySection } from "./como-funciona/sections-b";
import { FaqSection, StatusSection } from "./como-funciona/sections-c";

const SECTIONS: { id: string; title: string; icon: Icon; keywords: string }[] = [
  { id: "ciclo", title: "O ciclo de avaliação", icon: CalendarDays, keywords: "ciclo período eventos avaliação área dia seguinte" },
  { id: "nota", title: "Como sua nota é calculada", icon: Star, keywords: "nota média cálculo conta soma divisão" },
  { id: "conformidade", title: "Matriz de conformidade", icon: ShieldCheck, keywords: "matriz conformidade epi aterramento ferramentas conduta desconto" },
  { id: "penalidades", title: "Penalidades e méritos", icon: MinusCircle, keywords: "penalidade mérito falta atraso pontos" },
  { id: "elegibilidade", title: "Elegibilidade ao bônus", icon: Trophy, keywords: "elegível mínimo eventos meta" },
  { id: "bonus", title: "O Bônus Caju", icon: Gift, keywords: "bônus caju faixa valor extra pagamento" },
  { id: "status", title: "O que significa cada selo", icon: Tags, keywords: "status selo avaliado parcial pendente aguardando" },
  { id: "faq", title: "Dúvidas frequentes", icon: HelpCircle, keywords: "dúvidas perguntas avaliador rh" },
];

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Seção que está na tela agora (para marcar no índice). */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;
    const obs = new IntersectionObserver(entries => {
      const top = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setActive(top.target.id);
    }, { rootMargin: "-80px 0px -60% 0px" });
    ids.forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [ids]);
  return active;
}

function Toc({ visible, active, className, onNavigate }: { visible: typeof SECTIONS; active: string | null; className?: string; onNavigate?: () => void }) {
  return (
    <nav id="guide-toc" aria-label="Índice do guia" className={className}>
      <ol className="space-y-0.5">
        {visible.map(s => {
          const n = SECTIONS.findIndex(x => x.id === s.id) + 1;
          const on = active === s.id;
          return (
            <li key={s.id}>
              <a href={`#${s.id}`} aria-current={on ? "location" : undefined} onClick={onNavigate}
                className={cn("group flex items-center gap-3 min-h-11 lg:min-h-9 rounded-lg px-2.5 text-[14px] font-semibold transition-colors duration-150",
                  on ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60", FOCUS_RING)}>
                <span className={cn("w-6 shrink-0 font-condensed text-[13px] font-bold tabular-nums", on ? "text-foreground" : "text-muted-foreground")}>{String(n).padStart(2, "0")}</span>
                <span className="min-w-0 leading-snug">{s.title}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default function ComoFuncionaPage() {
  const [search, setSearch] = useState("");
  const [tocOpen, setTocOpen] = useState(false);
  const d = useGuideData();

  const q = fold(search.trim());
  const visible = useMemo(() => SECTIONS.filter(s => !q || fold(`${s.title} ${s.keywords}`).includes(q)), [q]);
  const ids = useMemo(() => visible.map(s => s.id), [visible]);
  const active = useActiveSection(ids);
  const show = (id: string) => ids.includes(id);
  const num = (id: string) => SECTIONS.findIndex(s => s.id === id) + 1;

  return (
    <div className="min-h-full flex flex-col min-w-0 font-body">
      <div className="md:sticky md:top-0 z-30 bg-card border-b border-border px-4 md:px-6 py-3 md:py-0 md:h-16 flex items-center gap-4">
        <h1 data-testid="text-page-title" className="font-condensed text-[22px] sm:text-[26px] uppercase tracking-[-0.01em] font-black leading-[0.95] text-foreground">Como funciona</h1>
        <p className="hidden lg:block min-w-0 truncate text-[13px] text-muted-foreground">O guia da Maratona de Resultados: regras, nota e bônus.</p>
      </div>

      <div className="flex-1 w-full max-w-[1180px] mx-auto px-4 md:px-6 py-6 md:py-8 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
        <aside className="lg:sticky lg:top-24 lg:self-start space-y-3 mb-6 lg:mb-0">
          <SearchField value={search} onChange={setSearch} label="Buscar no guia" placeholder="Buscar no guia" testId="input-search-guide" />
          <div className="rounded-2xl border border-border bg-card p-1.5 lg:border-0 lg:bg-transparent lg:p-0">
            <p className="hidden lg:block px-2.5 pt-2 pb-1 font-condensed text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Neste guia</p>
            {/* Celular/tablet: o índice fica recolhido num botão (o guia começa logo abaixo). */}
            <button type="button" onClick={() => setTocOpen(o => !o)} aria-expanded={tocOpen || !!q} aria-controls="guide-toc" data-testid="button-toggle-toc"
              className={cn("lg:hidden w-full flex items-center gap-2 min-h-11 px-2.5 rounded-lg font-condensed text-[13.5px] font-bold uppercase tracking-[0.06em] text-foreground", FOCUS_RING)}>
              <ListOrdered size={16} aria-hidden className="text-muted-foreground" />
              Neste guia <span className="tabular-nums text-muted-foreground">· {visible.length}</span>
              <ChevronDown size={16} aria-hidden className={cn("ml-auto text-muted-foreground transition-transform duration-200 motion-reduce:transition-none", (tocOpen || !!q) && "rotate-180")} />
            </button>
            {visible.length > 0 ? <Toc visible={visible} active={active} onNavigate={() => setTocOpen(false)} className={cn("lg:block", tocOpen || q ? "block" : "hidden")} /> : (
              <p className="px-2.5 py-3 text-[13.5px] text-muted-foreground" role="status">Nada encontrado para “{search}”.</p>
            )}
          </div>
        </aside>

        <div className="min-w-0 space-y-10">
          <div className="space-y-4">
            <p className="text-[16px] leading-relaxed text-muted-foreground max-w-[60ch]">
              Guia completo da Maratona de Resultados — entenda as regras, como sua nota é calculada e como conquistar o bônus.
            </p>
            {!q && <Overview />}
          </div>

          <div className="space-y-10">
            {show("ciclo") && <CycleSection n={num("ciclo")} d={d} />}
            {show("nota") && <ScoreSection n={num("nota")} />}
            {show("conformidade") && <ConformitySection n={num("conformidade")} d={d} />}
            {show("penalidades") && <AdjustmentsSection n={num("penalidades")} d={d} />}
            {show("elegibilidade") && <EligibilitySection n={num("elegibilidade")} d={d} />}
            {show("bonus") && <BonusSection n={num("bonus")} d={d} />}
            {show("status") && <StatusSection n={num("status")} />}
            {show("faq") && <FaqSection n={num("faq")} d={d} />}
            {visible.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
                <p className="font-condensed text-[20px] font-black uppercase text-foreground">Nada encontrado no guia</p>
                <p className="mt-1 text-[14px] text-muted-foreground">Tente outra palavra, como “bônus”, “faixa” ou “matriz”.</p>
                <button type="button" onClick={() => setSearch("")} className={cn("mt-3 font-condensed text-[13px] font-bold uppercase tracking-[0.06em] underline underline-offset-4 text-foreground rounded", FOCUS_RING)}>Limpar busca</button>
              </div>
            )}
          </div>

          <footer className="border-t border-border pt-6 text-center">
            <p className="font-condensed text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Maratona de Resultados · Cenográfica Eventos</p>
            <p className="mt-1 text-[13px] text-muted-foreground">As regras podem ser ajustadas a cada ciclo pelo RH. Consulte seu gestor para informações atualizadas.</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
