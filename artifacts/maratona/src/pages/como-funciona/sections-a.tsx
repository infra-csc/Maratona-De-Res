// Resumo em 4 passos e as seções 1–3: o ciclo, como a nota é calculada e a
// Matriz de conformidade. Textos e regras são os mesmos do guia anterior.
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardCheck, Gift, ShieldCheck, Star, Users } from "lucide-react";
import { Def, DefList, Example, GuideSection, MathLine, Notice } from "./cf-ui";
import type { GuideData } from "./use-guide-data";

const STEPS = [
  { icon: CalendarDays, title: "Você trabalha nos eventos", text: "Cada evento do ciclo é uma chance de somar nota." },
  { icon: Users, title: "As áreas avaliam no dia seguinte", text: "A avaliação abre sozinha no dia seguinte ao fim do evento." },
  { icon: Star, title: "Sua nota é a média", text: "A média dos eventos, com penalidades e méritos." },
  { icon: Gift, title: "A média define a faixa e o bônus", text: "Com o mínimo de eventos, você entra no bônus da sua faixa." },
];

export function Overview() {
  return (
    <section aria-label="Em resumo" className="rounded-2xl border border-border bg-card overflow-hidden" data-testid="guide-overview">
      <p className="px-4 pt-4 sm:px-5 font-condensed text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Em resumo</p>
      <ol className="mt-3 grid gap-px bg-border border-t border-border sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="bg-card px-4 py-4 sm:px-5 flex gap-3">
            <span className="w-9 h-9 shrink-0 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-condensed text-[17px] font-black">{i + 1}</span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[15px] font-bold leading-snug text-foreground"><s.icon size={15} aria-hidden className="shrink-0 text-muted-foreground" />{s.title}</span>
              <span className="mt-0.5 block text-[13.5px] leading-snug text-muted-foreground">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function CycleSection({ n, d }: { n: number; d: GuideData }) {
  return (
    <GuideSection id="ciclo" n={n} icon={CalendarDays} title="O ciclo de avaliação"
      lead="A Maratona funciona em ciclos periódicos. Cada ciclo tem uma data de início e fim. Durante o ciclo, você participa de eventos — cada evento é uma oportunidade de ser avaliado e acumular pontuação.">
      <DefList>
        <Def term="Duração">Cada ciclo cobre um período específico definido pelo RH (ex.: um trimestre).</Def>
        <Def term="Eventos">São as atividades/trabalhos em que você participa. Cada evento tem critérios de avaliação com pesos diferentes.</Def>
        <Def term="Avaliação" strong>
          {d.areaEvaluation
            ? "A avaliação abre sozinha no dia seguinte ao fim do evento: os avaliadores de cada área avaliam os critérios da sua área, e a primeira resposta da área é a que vale. Critério avaliado por várias áreas entra pela média das áreas. A nota final do evento é a média ponderada dos critérios."
            : "A avaliação abre sozinha no dia seguinte ao fim do evento: os avaliadores pontuam você em cada critério. A nota final do evento é a média ponderada dos critérios."}
        </Def>
      </DefList>
    </GuideSection>
  );
}

export function ScoreSection({ n }: { n: number }) {
  return (
    <GuideSection id="nota" n={n} icon={Star} title="Como sua nota é calculada"
      lead={<>Sua nota final é a <strong className="text-foreground">média das notas de todos os eventos confirmados</strong> do ciclo, com ajustes de penalidades e méritos.</>}>
      <DefList>
        <Def term="Nota do evento">Média ponderada dos critérios avaliados (cada critério tem um peso). Escala de 0 a 10, convertida para 0 a 100.</Def>
        <Def term="Matriz de conformidade">Checklist de itens obrigatórios. Cada item marcado como “Não” desconta 10 pontos da nota daquele evento.</Def>
        <Def term="Nota média" strong>Média simples de todos os eventos com nota confirmada que contam para a sua pontuação.</Def>
        <Def term="Penalidades">Descontam pontos do total acumulado de notas antes de calcular a média final (ex.: faltas, advertências). O desconto pode reduzir sua nota até o mínimo de 0.</Def>
        <Def term="Méritos">Somam pontos ao total acumulado de notas antes de calcular a média final, podendo aumentar até o máximo de 100.</Def>
        <Def term="Nota final" strong>(Soma das notas dos eventos − Penalidades + Méritos) ÷ Nº de eventos (limitada entre 0 e 100).</Def>
      </DefList>
      <Example>
        <p className="text-muted-foreground">5 eventos com média 78 (soma total = 390), 5 pontos de penalidade e 2 de mérito:</p>
        <div className="mt-2 max-w-sm" aria-label="(390 − 5 + 2) ÷ 5 = 77,4 pontos">
          <MathLine label="Soma das notas (5 eventos)" value="390" />
          <MathLine op="−" label="Penalidades" value="5" tone="danger" />
          <MathLine op="+" label="Méritos" value="2" tone="ok" />
          <MathLine op="÷" label="Número de eventos" value="5" />
          <MathLine op="=" label="Nota final" value="77,4" total />
        </div>
      </Example>
    </GuideSection>
  );
}

export function ConformitySection({ n, d }: { n: number; d: GuideData }) {
  const count = d.conformityItems.length;
  return (
    <GuideSection id="conformidade" n={n} icon={ShieldCheck} title="Matriz de conformidade"
      lead={<>A Matriz de Conformidade é um checklist de requisitos de segurança e conduta avaliado em cada evento. Cada item respondido como <strong className="text-foreground">“Não”</strong> desconta <strong className="text-foreground">10 pontos direto da nota daquele evento</strong> — antes da média do ciclo ser calculada.</>}>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {d.conformityItems.map(({ item, desc }) => (
          <li key={item} className="rounded-2xl border border-border bg-card px-4 py-3.5 flex gap-3">
            <ClipboardCheck size={18} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block text-[15px] font-bold leading-snug text-foreground">{item}</span>
              <span className="mt-0.5 block text-[13.5px] leading-snug text-muted-foreground">{desc}</span>
            </span>
          </li>
        ))}
      </ul>
      {d.withoutConduta && (
        <Notice icon={CheckCircle2} tone="info">
          Neste ciclo a <strong className="text-foreground">Conduta saiu da Matriz</strong>: ela é avaliada no critério Proatividade/Conduta e, na matriz, conta como “Sim”.
        </Notice>
      )}
      <Notice icon={AlertTriangle} tone="danger">
        Cada resposta <strong>“Não”</strong> na Matriz de Conformidade desconta <strong>10 pontos</strong> da nota daquele evento específico. Se todos os {count} itens forem “Não”, o evento perde {count * 10} pontos antes de entrar na sua média.
      </Notice>
    </GuideSection>
  );
}
