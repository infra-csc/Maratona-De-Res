import { useState } from "react";
import { BookOpen, Calendar, Star, Trophy, Gift, Flag, Clock, AlertTriangle, HelpCircle, ShieldCheck, Minus, Search, X } from "lucide-react";

const SECTIONS = [
  { id: "ciclo", title: "O Ciclo de Avaliação", icon: Calendar },
  { id: "nota", title: "Como Sua Nota é Calculada", icon: Star },
  { id: "conformidade", title: "Matriz de Conformidade", icon: ShieldCheck },
  { id: "penalidades", title: "Penalidades e Méritos", icon: Minus },
  { id: "elegibilidade", title: "Elegibilidade ao Bônus", icon: Trophy },
  { id: "bonus", title: "O Bônus Caju", icon: Gift },
  { id: "status", title: "O Que Significa Cada Status", icon: Clock },
  { id: "revisao", title: "Sinalizar Revisão de Nota", icon: Flag },
  { id: "faq", title: "Dúvidas Frequentes", icon: HelpCircle },
];

interface SectionProps {
  id: string;
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  dark?: boolean;
}

function Section({ id, icon: Icon, title, children, dark }: SectionProps) {
  return (
    <section id={id} className="rounded-xl overflow-hidden scroll-mt-24" style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
      <div
        className="px-5 py-3.5 flex items-center gap-3"
        style={dark
          ? { backgroundColor: "#191c1e", borderBottom: "1px solid rgba(255,255,255,0.08)" }
          : { backgroundColor: "#ccff00", borderBottom: "1px solid rgba(0,0,0,0.08)" }
        }
      >
        <Icon size={18} className="shrink-0" style={{ color: dark ? "#ccff00" : "#161e00" }} />
        <h2 className="font-black text-[15px] uppercase tracking-wide" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: dark ? "#ccff00" : "#161e00" }}>
          {title}
        </h2>
      </div>
      <div className="p-5 space-y-3 text-foreground">
        {children}
      </div>
    </section>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 p-3 rounded-lg"
      style={highlight
        ? { backgroundColor: "#ccff00" }
        : { backgroundColor: "var(--muted)", border: "1px solid var(--border)" }
      }
    >
      <span className="text-[10px] font-black uppercase tracking-wider sm:w-36 sm:shrink-0 sm:pt-0.5" style={{ color: highlight ? "#506600" : "var(--muted-foreground)" }}>{label}</span>
      <span className="text-[13px] font-bold leading-snug" style={{ color: highlight ? "#161e00" : "var(--foreground)" }}>{value}</span>
    </div>
  );
}

function StatusBadge({ label, color, text }: { label: string; color: string; text: string }) {
  return (
    <div className="flex items-start gap-3 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
      <span className={`shrink-0 mt-0.5 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${color}`}>{label}</span>
      <span className="text-[13px] text-muted-foreground leading-snug">{text}</span>
    </div>
  );
}

export default function ComoFuncionaPage() {
  const [search, setSearch] = useState("");

  const q = search.toLowerCase().trim();
  const visibleIds = new Set(
    SECTIONS.filter(s => !q || s.title.toLowerCase().includes(q)).map(s => s.id)
  );

  return (
    <div className="min-h-full text-foreground" style={{ backgroundColor: "var(--background)" }}>
      <div className="p-4 sm:p-6 md:p-10 space-y-8 max-w-4xl mx-auto">

        {/* Header */}
        <header className="border-l-4 border-[#ccff00] pl-5 py-1">
          <h1 className="font-black text-[42px] md:text-[52px] uppercase tracking-tight leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--accent)" }}>
            Como Funciona
          </h1>
          <p className="text-[14px] leading-relaxed text-muted-foreground mt-2 max-w-2xl">
            Guia completo da Maratona de Resultados — entenda as regras, como sua nota é calculada e como conquistar o bônus.
          </p>
        </header>

        {/* Índice + Busca */}
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
          <div className="px-5 py-3 flex items-center gap-3" style={{ backgroundColor: "#191c1e" }}>
            <BookOpen size={15} style={{ color: "#ccff00" }} />
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: "#ccff00", fontFamily: "'Barlow Condensed', sans-serif" }}>Índice do Guia</span>
          </div>

          <div className="p-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar seção nesta página..."
                className="w-full pl-9 pr-8 h-10 rounded-lg text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  <X size={13} />
                </button>
              )}
            </div>
            {q && visibleIds.size === 0 && (
              <p className="text-[11px] text-muted-foreground mt-2">Nenhuma seção encontrada para "{search}".</p>
            )}
          </div>

          <div>
            {SECTIONS.map((s, i) => {
              const matched = visibleIds.has(s.id);
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={`flex items-center gap-4 px-5 py-3 transition-colors ${matched ? "hover:brightness-95 text-foreground" : "opacity-25 pointer-events-none"}`}
                  style={i > 0 ? { borderTop: "1px solid var(--border)" } : {}}
                >
                  <span className="text-[10px] font-black text-muted-foreground w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <s.icon size={13} className="shrink-0" style={{ color: matched ? "var(--accent)" : "var(--muted-foreground)" }} />
                  <span className="text-[13px] font-bold uppercase tracking-tight">{s.title}</span>
                </a>
              );
            })}
          </div>
        </div>

        {/* 1. O Ciclo */}
        {visibleIds.has("ciclo") && (
          <Section id="ciclo" icon={Calendar} title="O Ciclo de Avaliação">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              A Maratona funciona em ciclos periódicos. Cada ciclo tem uma data de início e fim. Durante o ciclo, você participa de eventos — cada evento é uma oportunidade de ser avaliado e acumular pontuação.
            </p>
            <div className="space-y-2 mt-2">
              <InfoRow label="Duração" value="Cada ciclo cobre um período específico definido pelo RH (ex.: um trimestre)." />
              <InfoRow label="Eventos" value="São as atividades/trabalhos em que você participa. Cada evento tem critérios de avaliação com pesos diferentes." />
              <InfoRow label="Avaliação" value="Após cada evento, um avaliador designado pontua você em cada critério. A nota final do evento é a média ponderada dos critérios." />
            </div>
          </Section>
        )}

        {/* 2. Como a nota é calculada */}
        {visibleIds.has("nota") && (
          <Section id="nota" icon={Star} title="Como Sua Nota é Calculada">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Sua nota final é a <strong className="text-foreground">média das notas de todos os eventos confirmados</strong> do ciclo, com ajustes de penalidades e méritos.
            </p>
            <div className="space-y-2 mt-2">
              <InfoRow label="Nota do Evento" value="Média ponderada dos critérios avaliados (cada critério tem um peso). Escala de 0 a 10, convertida para 0 a 100." />
              <InfoRow label="Matriz de Conformidade" value="Checklist de itens obrigatórios. Cada item marcado como 'Não' desconta 10 pontos da nota daquele evento." />
              <InfoRow label="Média do Ciclo" value="Média simples de todos os eventos com nota confirmada que contam para a sua pontuação." highlight />
              <InfoRow label="Penalidades" value="Descontam pontos do total acumulado de notas antes de calcular a média final (ex.: faltas, advertências). O desconto pode reduzir sua nota até o mínimo de 0." />
              <InfoRow label="Méritos" value="Somam pontos ao total acumulado de notas antes de calcular a média final, podendo aumentar até o máximo de 100." />
              <InfoRow label="Nota Final" value="= (Soma das notas dos eventos − Penalidades + Méritos) ÷ Nº de eventos (limitada entre 0 e 100)." highlight />
            </div>
            <div className="mt-4 p-4 rounded-lg text-[13px] leading-relaxed" style={{ backgroundColor: "var(--muted)", borderLeft: "3px solid #ccff00" }}>
              <strong>Exemplo:</strong> 5 eventos com média 78 (soma total = 390), 5 pontos de penalidade e 2 de mérito: (390 − 5 + 2) ÷ 5 = <strong>77,4 pontos</strong>.
            </div>
          </Section>
        )}

        {/* 3. Matriz de Conformidade */}
        {visibleIds.has("conformidade") && (
          <Section id="conformidade" icon={ShieldCheck} title="Matriz de Conformidade">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              A Matriz de Conformidade é um checklist de requisitos de segurança e conduta avaliado em cada evento. Cada item respondido como <strong className="text-foreground">"Não"</strong> desconta <strong className="text-foreground">10 pontos direto da nota daquele evento</strong> — antes da média do ciclo ser calculada.
            </p>
            <div className="mt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { item: "Uso de EPI", desc: "Equipamentos de Proteção Individual utilizados corretamente durante o evento." },
                  { item: "Estaiamento / Aterramento", desc: "Estruturas devidamente fixadas e aterradas conforme as normas de segurança." },
                  { item: "Equipamentos", desc: "Ferramentas e equipamentos em bom estado e utilizados adequadamente." },
                  { item: "Conduta", desc: "Comportamento profissional adequado durante toda a execução do evento." },
                ].map(({ item, desc }) => (
                  <div key={item} className="p-4 rounded-lg" style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border)" }}>
                    <p className="text-[11px] font-black uppercase text-foreground mb-1">{item}</p>
                    <p className="text-[12px] text-muted-foreground leading-snug">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 p-4 rounded-lg flex items-start gap-3" style={{ backgroundColor: "rgba(186,26,26,0.08)", border: "1px solid rgba(186,26,26,0.25)" }}>
              <AlertTriangle size={15} className="text-[#ba1a1a] shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#ba1a1a] leading-relaxed">
                Cada resposta <strong>"Não"</strong> na Matriz de Conformidade desconta <strong>10 pontos</strong> da nota daquele evento específico. Se todos os 4 itens forem "Não", o evento perde 40 pontos antes de entrar na sua média.
              </p>
            </div>
          </Section>
        )}

        {/* 4. Penalidades e Méritos */}
        {visibleIds.has("penalidades") && (
          <Section id="penalidades" icon={Minus} title="Penalidades e Méritos">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Além da nota dos eventos, seu resultado final pode ser ajustado por penalidades (descontos) e méritos (acréscimos) registrados pelo RH ao longo do ciclo.
            </p>

            <div className="mt-3 space-y-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#ba1a1a]">Penalidades (descontam pontos)</p>
              <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid var(--border)" }}>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: "rgba(186,26,26,0.10)", borderBottom: "1px solid var(--border)" }}>
                      <th className="px-4 py-2.5 text-[10px] font-black uppercase text-[#ba1a1a]">Tipo</th>
                      <th className="px-4 py-2.5 text-[10px] font-black uppercase text-[#ba1a1a] text-right">Desconto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { tipo: "Ausência Não Comunicada", pts: "−5 pts" },
                      { tipo: "Atraso Superior a 30 Minutos", pts: "−3 pts" },
                      { tipo: "Advertência / Registro Disciplinar", pts: "−10 pts" },
                    ].map((r, i) => (
                      <tr key={r.tipo} style={i > 0 ? { borderTop: "1px solid var(--border)" } : {}}>
                        <td className="px-4 py-3 text-[13px] font-bold text-foreground">{r.tipo}</td>
                        <td className="px-4 py-3 text-[13px] font-black text-[#ba1a1a] text-right">{r.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-[10px] font-black uppercase tracking-wider text-[#506600]">Méritos (somam pontos)</p>
              <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid var(--border)" }}>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: "#ccff00", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                      <th className="px-4 py-2.5 text-[10px] font-black uppercase text-[#161e00]">Tipo</th>
                      <th className="px-4 py-2.5 text-[10px] font-black uppercase text-[#161e00] text-right">Acréscimo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { tipo: "Rei do Galpão (destaque de armazém)", pts: "+5 pts" },
                      { tipo: "Estrela do Evento (melhor performance)", pts: "+5 pts" },
                      { tipo: "Colega Top (indicação pelos pares)", pts: "+3 pts" },
                    ].map((r, i) => (
                      <tr key={r.tipo} style={i > 0 ? { borderTop: "1px solid var(--border)" } : {}}>
                        <td className="px-4 py-3 text-[13px] font-bold text-foreground">{r.tipo}</td>
                        <td className="px-4 py-3 text-[13px] font-black text-[#506600] text-right">{r.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-lg text-[13px] leading-relaxed text-muted-foreground" style={{ backgroundColor: "var(--muted)", borderLeft: "3px solid #ccff00" }}>
              Os valores acima são exemplos comuns. O RH pode registrar outros tipos de penalidades e méritos conforme as regras do ciclo. A nota final nunca ultrapassa 100 nem fica abaixo de 0.
            </div>
          </Section>
        )}

        {/* 5. Elegibilidade ao Bônus */}
        {visibleIds.has("elegibilidade") && (
          <Section id="elegibilidade" icon={Trophy} title="Elegibilidade ao Bônus" dark>
            <p className="text-[13px] leading-relaxed text-[rgba(255,255,255,0.75)]">
              Para ter direito ao Bônus Caju, você precisa atingir o número mínimo de <strong className="text-[#ccff00]">eventos confirmados</strong> no ciclo.
            </p>
            <div className="space-y-2 mt-2">
              <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 p-3 rounded-lg" style={{ backgroundColor: "rgba(204,255,0,0.12)", border: "1px solid rgba(204,255,0,0.3)" }}>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#ccff00] sm:w-36 sm:shrink-0 sm:pt-0.5">Meta mínima</span>
                <span className="text-[13px] font-bold text-[#ccff00] leading-snug">8 eventos confirmados no ciclo (com nota lançada e validada pelo RH)</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 p-3 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <span className="text-[10px] font-black uppercase tracking-wider text-[rgba(255,255,255,0.4)] sm:w-36 sm:shrink-0 sm:pt-0.5">Não elegível</span>
                <span className="text-[13px] font-bold text-[rgba(255,255,255,0.5)] leading-snug">Se você tiver menos de 8 eventos confirmados, o bônus aparecerá como "—" (não elegível para este ciclo).</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 p-3 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <span className="text-[10px] font-black uppercase tracking-wider text-[rgba(255,255,255,0.4)] sm:w-36 sm:shrink-0 sm:pt-0.5">Eventos extras</span>
                <span className="text-[13px] font-bold text-[rgba(255,255,255,0.5)] leading-snug">Eventos acima de 8 podem gerar bônus adicional. Cada evento extra dentro da sua faixa de nota soma um valor extra ao bônus.</span>
              </div>
            </div>
            <p className="text-[11px] text-[rgba(204,255,0,0.6)] mt-3">
              Atenção: participações que "não contam para nota" (indicadas com badge laranja nos seus eventos) não entram na contagem de elegibilidade nem na sua média.
            </p>
          </Section>
        )}

        {/* 6. O Bônus Caju */}
        {visibleIds.has("bonus") && (
          <Section id="bonus" icon={Gift} title="O Bônus Caju">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              O Bônus Caju é o benefício financeiro que você recebe ao ser elegível e atingir uma boa pontuação no ciclo.
            </p>
            <div className="space-y-2 mt-2">
              <InfoRow label="Como é calculado" value="Depende da sua Nota Final no ciclo. Quanto maior a nota, maior o bônus (definido por faixas de nota)." />
              <InfoRow label="Bônus Base" value="É o valor fixo correspondente à sua faixa de nota." />
              <InfoRow label="Bônus Extra" value="Para cada evento que você participou além dos 8 mínimos, você recebe um valor adicional proporcional à sua faixa de nota." highlight />
              <InfoRow label="Pagamento" value="O bônus é pago via Caju Saldo Livre após o fechamento e aprovação do ciclo pelo RH." />
            </div>
            <div className="mt-4 p-4 rounded-lg text-[13px] leading-relaxed text-muted-foreground" style={{ backgroundColor: "var(--muted)", borderLeft: "3px solid #ccff00" }}>
              As faixas de nota e os valores de bônus são definidos pelo RH e podem variar entre ciclos. Consulte seu gestor para detalhes do ciclo atual.
            </div>
          </Section>
        )}

        {/* 7. Status dos Eventos */}
        {visibleIds.has("status") && (
          <Section id="status" icon={Clock} title="O Que Significa Cada Status">
            <div>
              <StatusBadge
                label="Em Avaliação"
                color="text-muted-foreground"
                text="O evento está sendo avaliado pelos avaliadores designados. Sua nota ainda não foi publicada. Aguarde a conclusão da avaliação."
              />
              <StatusBadge
                label="Avaliação Parcial"
                color="bg-[#ccff00] text-[#191c1e]"
                text="Parte dos critérios já foi avaliada e publicada. Você pode ver essas notas parciais, mas a avaliação ainda está em andamento."
              />
              <StatusBadge
                label="Avaliação Final"
                color="bg-[#191c1e] text-[#ccff00]"
                text="A avaliação do evento foi concluída e publicada oficialmente. Essa é a nota definitiva para este evento."
              />
              <StatusBadge
                label="Pendente"
                color="text-muted-foreground"
                text="O critério ainda não foi avaliado (aparece nos detalhes do evento). Quando a nota for lançada, o status mudará."
              />
              <StatusBadge
                label="Avaliado"
                color="text-[#506600]"
                text="O critério específico já tem nota lançada pelo avaliador."
              />
              <StatusBadge
                label="Não conta p/ nota"
                color="bg-[#862200]/10 text-[#862200]"
                text="Sua participação neste evento é apenas histórica/informativa. A nota não entra na sua média nem na contagem de elegibilidade."
              />
            </div>
          </Section>
        )}

        {/* 8. Sinalizar Revisão */}
        {visibleIds.has("revisao") && (
          <Section id="revisao" icon={Flag} title="Sinalizar Revisão de Nota">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Se você acredita que alguma nota não reflete corretamente sua participação, você pode sinalizar uma revisão para o RH analisar.
            </p>
            <div className="space-y-2 mt-2">
              <InfoRow label="Quando usar" value="Somente quando o evento ou critério já tiver nota lançada. Não é possível sinalizar revisão de itens ainda pendentes." />
              <InfoRow label="Por evento" value="Sinaliza que você discorda de algum aspecto da avaliação do evento inteiro. Use quando não souber exatamente qual critério contestar." />
              <InfoRow label="Por critério" value="Sinaliza que você discorda de uma nota específica (ex.: 'Qualidade da Entrega'). Mais preciso e facilita a análise do RH." highlight />
              <InfoRow label="O que acontece" value="O RH será notificado e analisará seu pedido. A revisão pode ser resolvida (com ou sem alteração de nota) ou mantida pendente enquanto estiver em análise." />
              <InfoRow label="Reabertura" value="Após uma revisão ser resolvida, você pode sinalizá-la novamente se necessário." />
            </div>
            <div className="mt-4 p-4 rounded-lg flex items-start gap-3" style={{ backgroundColor: "rgba(232,162,61,0.10)", border: "1px solid rgba(232,162,61,0.3)" }}>
              <AlertTriangle size={15} className="text-[#c98a1f] shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#c98a1f] leading-relaxed">
                A sinalização de revisão é uma comunicação formal com o RH. Use-a quando tiver uma dúvida genuína sobre sua nota — não como recurso de rotina.
              </p>
            </div>
          </Section>
        )}

        {/* 9. FAQ */}
        {visibleIds.has("faq") && (
          <Section id="faq" icon={HelpCircle} title="Dúvidas Frequentes">
            <div className="space-y-3">
              {[
                {
                  q: "Por que minha nota do ciclo ainda não aparece?",
                  a: "Sua nota só é calculada quando há pelo menos um evento confirmado (com nota publicada e validada pelo RH). Enquanto o ciclo está em andamento, a nota exibida é uma projeção parcial.",
                },
                {
                  q: "O que é 'Projeção Parcial'?",
                  a: "É uma estimativa baseada nos eventos já avaliados. Ela pode mudar conforme novos eventos forem avaliados e confirmados. O valor oficial só é definido no fechamento do ciclo.",
                },
                {
                  q: "Posso ver quem me avaliou?",
                  a: "Não. A identidade dos avaliadores é confidencial para garantir a imparcialidade da avaliação. Apenas comentários coletivos são exibidos.",
                },
                {
                  q: "O que acontece se eu participar de mais de 8 eventos?",
                  a: "Ótimo! Você acumula bônus extras proporcionais à sua faixa de nota para cada evento adicional acima do mínimo de 8.",
                },
                {
                  q: "A Matriz de Conformidade pode zerar minha nota do evento?",
                  a: "Sim. Se todos os itens da Matriz forem marcados como 'Não', a nota do evento perde 40 pontos (4 × 10). Isso pode resultar em nota zero para aquele evento se a nota base for baixa.",
                },
                {
                  q: "Tenho dúvidas que não estão aqui. O que faço?",
                  a: "Entre em contato com o RH. Eles podem esclarecer dúvidas específicas sobre sua situação, penalidades ou o processo de aprovação do bônus.",
                },
              ].map(({ q, a }, i) => (
                <div key={i} className="p-4 rounded-xl" style={{ border: "1px solid var(--border)", backgroundColor: "var(--muted)" }}>
                  <p className="text-[13px] font-black text-foreground mb-2 flex items-start gap-2">
                    <span className="shrink-0 bg-[#ccff00] text-[#161e00] font-black text-[9px] px-1.5 py-0.5 rounded mt-0.5">P</span>
                    {q}
                  </p>
                  <p className="text-[13px] text-muted-foreground pl-6 leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Footer note */}
        <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Maratona de Resultados · Cenográfica Eventos
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            As regras podem ser ajustadas a cada ciclo pelo RH. Consulte seu gestor para informações atualizadas.
          </p>
        </div>

      </div>
    </div>
  );
}
