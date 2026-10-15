// Seções 7–8: o que significa cada selo (iguais aos de Meu desempenho) e as
// dúvidas frequentes (acordeão nativo: abre com toque, Enter ou espaço).
import type { ReactNode } from "react";
import { CheckCircle2, ChevronDown, Clock, HelpCircle, Hourglass, Tags } from "lucide-react";
import { Chip, Eyebrow, GuideSection, type Tone } from "./cf-ui";
import type { GuideData } from "./use-guide-data";

type Row = { chip: ReactNode; text: string };

function Glossary({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <Eyebrow as="h3" className="px-4 pt-4 pb-3 sm:px-5 border-b border-border">{title}</Eyebrow>
      <dl className="divide-y divide-border">
        {rows.map((r, i) => (
          <div key={i} className="grid gap-1.5 px-4 py-3.5 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-5 sm:px-5 sm:items-start">
            <dt>{r.chip}</dt>
            <dd className="text-[14.5px] leading-relaxed text-muted-foreground">{r.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const chip = (label: string, tone: Tone = "neutral", icon?: typeof Clock) => <Chip tone={tone} icon={icon}>{label}</Chip>;

export function StatusSection({ n }: { n: number }) {
  return (
    <GuideSection id="status" n={n} icon={Tags} title="O que significa cada selo"
      lead="Os selos que aparecem nos seus eventos, em Meu desempenho.">
      <Glossary title="No evento" rows={[
        { chip: chip("Aguardando", "neutral", Hourglass), text: "O evento ainda não tem notas publicadas. A avaliação está em andamento ou aguardando a resposta da área." },
        { chip: chip("Em avaliação", "warn", Hourglass), text: "Os critérios do evento já foram definidos e as áreas estão avaliando. Ainda não há nota publicada." },
        { chip: chip("Nota parcial", "info", Clock), text: "O RH publicou notas provisórias para este evento. Você já pode ver as notas, mas elas ainda podem ser ajustadas antes da confirmação final." },
        { chip: chip("Avaliado", "ok", CheckCircle2), text: "Todos os critérios avaliados têm nota final publicada (ou o RH liberou o feedback oficial do evento). Esta é a nota definitiva." },
        { chip: chip("Não conta para a nota", "danger"), text: "Sua participação neste evento é apenas histórica/informativa. A nota não entra na sua média nem na contagem de elegibilidade." },
      ]} />
      <Glossary title="Em cada critério (dentro do evento)" rows={[
        { chip: chip("Pendente"), text: "Este critério ainda não tem nota lançada. Aguarde o avaliador da área responder." },
        { chip: chip("Nota parcial", "info", Clock), text: "Nota publicada provisoriamente pelo RH. Ainda pode ser ajustada antes da confirmação final." },
        { chip: chip("Avaliado", "ok", CheckCircle2), text: "Nota final publicada oficialmente para este critério. Valor definitivo." },
      ]} />
    </GuideSection>
  );
}

export function FaqSection({ n, d }: { n: number; d: GuideData }) {
  const items = d.conformityItems.length;
  const faq = [
    { q: "Por que minha nota do ciclo ainda não aparece?", a: "Sua nota só é calculada quando há pelo menos um evento confirmado (com nota publicada e validada pelo RH). Enquanto o ciclo está em andamento, a nota exibida é uma projeção parcial." },
    { q: "O que é “Parcial”?", a: "É uma estimativa baseada nos eventos já avaliados. Ela pode mudar conforme novos eventos forem avaliados e confirmados. O valor oficial só é definido no fechamento do ciclo." },
    { q: "Posso ver quem me avaliou?", a: "Não. A identidade dos avaliadores é confidencial para garantir a imparcialidade da avaliação. Apenas comentários coletivos são exibidos." },
    { q: "O que acontece se eu participar de mais eventos do que o mínimo exigido?", a: "Ótimo! Cada evento confirmado acima do mínimo gera um bônus extra no valor por evento adicional da faixa da sua nota média. A nota de cada evento entra na média, mas não muda o valor pago por evento extra. Veja o número mínimo do ciclo atual em “Eventos que contam”, em Meu desempenho." },
    { q: "A Matriz de Conformidade pode zerar minha nota do evento?", a: `Sim. Se todos os itens da Matriz forem marcados como “Não”, a nota do evento perde ${items * 10} pontos (${items} × 10). Isso pode resultar em nota zero para aquele evento se a nota base for baixa.` },
    { q: "Tenho dúvidas que não estão aqui. O que faço?", a: "Entre em contato com o RH. Eles podem esclarecer dúvidas específicas sobre sua situação, penalidades ou o processo de aprovação do bônus." },
  ];
  return (
    <GuideSection id="faq" n={n} icon={HelpCircle} title="Dúvidas frequentes">
      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden" data-testid="guide-faq">
        {faq.map(({ q, a }) => (
          <details key={q} className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 sm:px-5 min-h-11 text-[15px] font-semibold leading-snug text-foreground transition-colors duration-150 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <span className="flex-1 min-w-0">{q}</span>
              <ChevronDown size={17} aria-hidden className="shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
            </summary>
            <p className="px-4 pb-4 sm:px-5 -mt-1 text-[14.5px] leading-relaxed text-muted-foreground max-w-[70ch]">{a}</p>
          </details>
        ))}
      </div>
    </GuideSection>
  );
}
