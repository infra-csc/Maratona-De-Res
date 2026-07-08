import { BookOpen, Calendar, Star, Trophy, Gift, Flag, CheckCircle2, Clock, AlertTriangle, HelpCircle } from "lucide-react";

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";

interface SectionProps {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  accent?: string;
}

function Section({ icon: Icon, title, children, accent = "#ccff00" }: SectionProps) {
  return (
    <section className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
      <div className="px-6 py-4 flex items-center gap-3 italic border-b-2 border-[#191c1e]" style={{ backgroundColor: accent }}>
        <Icon size={20} className="shrink-0" style={{ color: accent === "#191c1e" ? "#ccff00" : "#191c1e" }} />
        <h2 className="text-base font-black uppercase tracking-wider" style={{ color: accent === "#191c1e" ? "#ccff00" : "#161e00" }}>
          {title}
        </h2>
      </div>
      <div className="p-6 space-y-3 text-[#444933]">
        {children}
      </div>
    </section>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-start gap-3 p-3 border-2 border-[#191c1e] ${highlight ? "bg-[#ccff00]" : "bg-[#f2f4f6]"}`}>
      <span className="text-[10px] font-black italic uppercase tracking-wider text-[#747a60] w-32 shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm font-bold italic leading-snug ${highlight ? "text-[#161e00]" : "text-[#191c1e]"}`}>{value}</span>
    </div>
  );
}

function StatusBadge({ label, color, text }: { label: string; color: string; text: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-[#eceef0] last:border-b-0">
      <span className={`shrink-0 mt-0.5 text-[9px] font-black uppercase italic px-2 py-0.5 border-2 border-[#191c1e] ${color}`}>{label}</span>
      <span className="text-sm text-[#444933] italic leading-snug">{text}</span>
    </div>
  );
}

export default function ComoFuncionaPage() {
  return (
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-10 max-w-4xl mx-auto">

        {/* Header */}
        <section className="border-l-8 border-[#ccff00] pl-6 py-1">
          <h1 className="text-4xl md:text-5xl italic uppercase tracking-tighter font-black leading-none">
            Como Funciona
          </h1>
          <p className="text-base md:text-lg text-[#444933] italic mt-2 max-w-2xl">
            Guia completo da Maratona de Resultados — entenda as regras, como sua nota é calculada e como conquistar o bônus.
          </p>
        </section>

        {/* 1. O Ciclo */}
        <Section icon={Calendar} title="O Ciclo de Avaliação">
          <p className="text-sm italic leading-relaxed">
            A Maratona funciona em ciclos periódicos. Cada ciclo tem uma data de início e fim. Durante o ciclo, você participa de eventos — cada evento é uma oportunidade de ser avaliado e acumular pontuação.
          </p>
          <div className="space-y-2 mt-2">
            <InfoRow label="Duração" value="Cada ciclo cobre um período específico definido pelo RH (ex.: um trimestre)." />
            <InfoRow label="Eventos" value="São as atividades/trabalhos em que você participa. Cada evento tem critérios de avaliação com pesos diferentes." />
            <InfoRow label="Avaliação" value="Após cada evento, um avaliador designado pontua você em cada critério. A nota final do evento é a média ponderada dos critérios." />
          </div>
        </Section>

        {/* 2. Como a nota é calculada */}
        <Section icon={Star} title="Como Sua Nota é Calculada">
          <p className="text-sm italic leading-relaxed">
            Sua nota final é a <strong>média das notas de todos os eventos confirmados</strong> do ciclo, com ajustes de penalidades e méritos.
          </p>
          <div className="space-y-2 mt-2">
            <InfoRow label="Nota do Evento" value="Média ponderada dos critérios avaliados (cada critério tem um peso). Escala de 0 a 10, convertida para 0 a 100." />
            <InfoRow label="Média do Ciclo" value="Média simples de todos os eventos com nota confirmada que contam para a sua pontuação." highlight />
            <InfoRow label="Penalidades" value="Descontam pontos da sua média final (ex.: faltas, advertências). O desconto pode reduzir sua nota até o mínimo de 0." />
            <InfoRow label="Méritos" value="Somam pontos à sua média final, podendo aumentar até o máximo de 100." />
            <InfoRow label="Nota Final" value="= Média do Ciclo − Penalidades + Méritos (limitada entre 0 e 100)." highlight />
          </div>
          <div className="mt-4 p-4 bg-[#f2f4f6] border-l-4 border-[#506600] italic text-sm text-[#444933] leading-relaxed">
            <strong>Exemplo:</strong> Se sua média do ciclo for 78 pontos, você tem 5 pontos de penalidade e 2 de mérito, sua nota final será: 78 − 5 + 2 = <strong>75 pontos</strong>.
          </div>
        </Section>

        {/* 3. Elegibilidade ao Bônus */}
        <Section icon={Trophy} title="Elegibilidade ao Bônus" accent="#191c1e">
          <p className="text-sm italic leading-relaxed text-[#ccff00]/90">
            Para ter direito ao Bônus Caju, você precisa atingir o número mínimo de <strong className="text-[#ccff00]">eventos confirmados</strong> no ciclo.
          </p>
          <div className="space-y-2 mt-2">
            <div className="flex items-start gap-3 p-3 border-2 border-[#ccff00] bg-[#ccff00]/10">
              <span className="text-[10px] font-black italic uppercase tracking-wider text-[#ccff00] w-32 shrink-0 pt-0.5">Meta mínima</span>
              <span className="text-sm font-bold italic text-[#ccff00] leading-snug">8 eventos confirmados no ciclo (com nota lançada e validada pelo RH)</span>
            </div>
            <div className="flex items-start gap-3 p-3 border-2 border-[#ccff00]/40 bg-transparent">
              <span className="text-[10px] font-black italic uppercase tracking-wider text-[#747a60] w-32 shrink-0 pt-0.5">Não elegível</span>
              <span className="text-sm font-bold italic text-[#747a60] leading-snug">Se você tiver menos de 8 eventos confirmados, o bônus aparecerá como "—" (não elegível para este ciclo).</span>
            </div>
            <div className="flex items-start gap-3 p-3 border-2 border-[#ccff00]/40 bg-transparent">
              <span className="text-[10px] font-black italic uppercase tracking-wider text-[#747a60] w-32 shrink-0 pt-0.5">Eventos extras</span>
              <span className="text-sm font-bold italic text-[#747a60] leading-snug">Eventos acima de 8 podem gerar bônus adicional. Cada evento extra dentro da sua faixa de pelotão soma um valor extra ao bônus.</span>
            </div>
          </div>
          <p className="text-xs italic text-[#ccff00]/70 mt-3">
            Atenção: participações que "não contam para nota" (indicadas com badge laranja nos seus eventos) não entram na contagem de elegibilidade nem na sua média.
          </p>
        </Section>

        {/* 4. O Bônus Caju */}
        <Section icon={Gift} title="O Bônus Caju">
          <p className="text-sm italic leading-relaxed">
            O Bônus Caju é o benefício financeiro que você recebe ao ser elegível e atingir uma boa pontuação no ciclo.
          </p>
          <div className="space-y-2 mt-2">
            <InfoRow label="Como é calculado" value="Depende da sua Nota Final no ciclo. Quanto maior a nota, maior o bônus (definido por faixas de pontuação)." />
            <InfoRow label="Bônus Base" value="É o valor fixo correspondente à sua faixa de nota (pelotão)." />
            <InfoRow label="Bônus Extra" value="Para cada evento que você participou além dos 8 mínimos, você recebe um valor adicional proporcional à sua faixa." highlight />
            <InfoRow label="Pagamento" value="O bônus é pago via Caju Saldo Livre após o fechamento e aprovação do ciclo pelo RH." />
          </div>
          <div className="mt-4 p-4 bg-[#f2f4f6] border-l-4 border-[#506600] italic text-sm text-[#444933]">
            As faixas de pontuação e os valores de bônus são definidos pelo RH e podem variar entre ciclos. Consulte seu gestor para detalhes do ciclo atual.
          </div>
        </Section>

        {/* 5. Status dos Eventos */}
        <Section icon={Clock} title="O Que Significa Cada Status">
          <div className="divide-y divide-[#eceef0]">
            <StatusBadge
              label="Em Avaliação"
              color="bg-[#d8dadc] text-[#444933]"
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
              color="bg-[#f2f4f6] text-[#747a60]"
              text="O critério ainda não foi avaliado (aparece nos detalhes do evento). Quando a nota for lançada, o status mudará."
            />
            <StatusBadge
              label="Avaliado"
              color="bg-white text-[#506600]"
              text="O critério específico já tem nota lançada pelo avaliador."
            />
            <StatusBadge
              label="Não conta p/ nota"
              color="bg-[#862200]/10 text-[#862200] border-[#862200]"
              text="Sua participação neste evento é apenas histórica/informativa. A nota não entra na sua média nem na contagem de elegibilidade."
            />
          </div>
        </Section>

        {/* 6. Sinalizar Revisão */}
        <Section icon={Flag} title="Sinalizar Revisão de Nota">
          <p className="text-sm italic leading-relaxed">
            Se você acredita que alguma nota não reflete corretamente sua participação, você pode sinalizar uma revisão para o RH analisar.
          </p>
          <div className="space-y-2 mt-2">
            <InfoRow label="Quando usar" value="Somente quando o evento ou critério já tiver nota lançada. Não é possível sinalizar revisão de itens ainda pendentes." />
            <InfoRow label="Por evento" value="Sinaliza que você discorda de algum aspecto da avaliação do evento inteiro. Use quando não souber exatamente qual critério contestar." />
            <InfoRow label="Por critério" value="Sinaliza que você discorda de uma nota específica (ex.: 'Qualidade da Entrega'). Mais preciso e facilita a análise do RH." highlight />
            <InfoRow label="O que acontece" value="O RH será notificado e analisará seu pedido. A revisão pode ser resolvida (com ou sem alteração de nota) ou mantida pendente enquanto estiver em análise." />
            <InfoRow label="Reabertura" value="Após uma revisão ser resolvida, você pode sinalizá-la novamente se necessário." />
          </div>
          <div className="mt-4 p-3 bg-[#fff3cd] border-2 border-[#191c1e] flex items-start gap-3">
            <AlertTriangle size={16} className="text-[#a15c00] shrink-0 mt-0.5" />
            <p className="text-xs italic text-[#664d03]">
              A sinalização de revisão é uma comunicação formal com o RH. Use-a quando tiver uma dúvida genuína sobre sua nota — não como recurso de rotina.
            </p>
          </div>
        </Section>

        {/* 7. FAQ */}
        <Section icon={HelpCircle} title="Dúvidas Frequentes">
          <div className="space-y-4">
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
                a: "Ótimo! Você acumula bônus extras proporcionais à sua faixa de pontuação para cada evento adicional acima do mínimo de 8.",
              },
              {
                q: "Tenho dúvidas que não estão aqui. O que faço?",
                a: "Entre em contato com o RH. Eles podem esclarecer dúvidas específicas sobre sua situação, penalidades ou o processo de aprovação do bônus.",
              },
            ].map(({ q, a }, i) => (
              <div key={i} className="border-2 border-[#eceef0] p-4">
                <p className="text-sm font-black italic text-[#191c1e] mb-2 flex items-start gap-2">
                  <span className="shrink-0 bg-[#ccff00] border border-[#191c1e] text-[#161e00] font-black text-[10px] px-1.5 py-0.5 mt-0.5">P</span>
                  {q}
                </p>
                <p className="text-sm italic text-[#444933] pl-7 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Footer note */}
        <div className="bg-[#f2f4f6] border-2 border-[#191c1e] p-4 text-center">
          <p className="text-[10px] font-black uppercase italic text-[#506600] tracking-widest">
            Maratona de Resultados · Cenográfica Eventos
          </p>
          <p className="text-xs text-[#747a60] font-medium mt-1 italic">
            As regras podem ser ajustadas a cada ciclo pelo RH. Consulte seu gestor para informações atualizadas.
          </p>
        </div>

      </div>
    </div>
  );
}
