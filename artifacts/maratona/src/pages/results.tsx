import { useState } from "react";
import { CycleBadge } from "@/components/cycle-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Table2, ListOrdered } from "lucide-react";
import { useAuth, hasRole } from "@/lib/auth-context";
import { CONDENSED, BODY } from "@/lib/premium-theme";
import { RankingTab } from "./results/ranking-tab";
import { ConsolidationTab } from "./results/consolidation-tab";
import { PaymentsTab } from "./results/payments-tab";

// Partes da página ficam em ./results/: abas (ranking-tab, consolidation-tab, payments-tab),
// pódio, modal de detalhe do colaborador (com a composição do bônus), painel de faixas,
// diálogos de fechar ciclo e de pagamento, e helpers puros (helpers.ts).

/* ------------------------------------------------------------------ */
/* PAGE                                                                */
/* ------------------------------------------------------------------ */

export default function ResultsPage() {
  const { user } = useAuth();
  // Um só flag: quem gerencia resultados (exporta consolidação, fecha/recalcula ciclo, edita pagamentos).
  const isManager = ["admin", "rh", "diretoria"].some(r => hasRole(user, r));
  const [tab, setTab] = useState("ranking");

  return (
    <div className="min-h-full" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>
      <div className="p-6 md:p-10 space-y-7">
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <h1 data-testid="text-page-title" className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-none" style={{ fontFamily: CONDENSED }}>
              Resultados &amp; Ranking
            </h1>
            <p className="text-[11px] font-bold uppercase tracking-wide mt-1.5" style={{ color: "var(--muted-foreground)" }}>Classificação geral do ciclo</p>
          </div>
          <CycleBadge />
        </section>

        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="rounded-lg p-1 h-auto flex-wrap gap-1 w-fit" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <TabsTrigger
              value="ranking"
              data-testid="tab-ranking"
              className="rounded-md font-bold uppercase text-xs tracking-wide px-4 py-2 flex items-center gap-2 shadow-none data-[state=active]:shadow-none"
              style={{ fontFamily: CONDENSED, backgroundColor: tab === "ranking" ? "var(--primary)" : "transparent", color: tab === "ranking" ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
            >
              <ListOrdered size={14} /> Ranking
            </TabsTrigger>
            <TabsTrigger
              value="consolidacao"
              data-testid="tab-consolidacao"
              className="rounded-md font-bold uppercase text-xs tracking-wide px-4 py-2 flex items-center gap-2 shadow-none data-[state=active]:shadow-none"
              style={{ fontFamily: CONDENSED, backgroundColor: tab === "consolidacao" ? "var(--primary)" : "transparent", color: tab === "consolidacao" ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
            >
              <Table2 size={14} /> Consolidação
            </TabsTrigger>
            {isManager && (
              <TabsTrigger
                value="bonus"
                data-testid="tab-bonus"
                className="rounded-md font-bold uppercase text-xs tracking-wide px-4 py-2 flex items-center gap-2 shadow-none data-[state=active]:shadow-none"
                style={{ fontFamily: CONDENSED, backgroundColor: tab === "bonus" ? "var(--primary)" : "transparent", color: tab === "bonus" ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
              >
                <Wallet size={14} /> Bônus &amp; Pagamentos
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="ranking" className="mt-0">
            <RankingTab canViewDetail={true} />
          </TabsContent>
          <TabsContent value="consolidacao" className="mt-0">
            <ConsolidationTab isManager={isManager} />
          </TabsContent>
          {isManager && (
            <TabsContent value="bonus" className="mt-0">
              <PaymentsTab canManage={isManager} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
