# Componentes compartilhados (`@/components/shared`)

Blocos de página com a linguagem premium (Barlow / Barlow Condensed, tokens de
`src/index.css`). `components/ui/*` continua sendo a base shadcn (botão, input,
diálogo…); aqui ficam as composições que toda tela repete.

## Regra número 1: cores completas nas variáveis

Toda variável em `src/index.css` já é uma cor completa (`#hex` ou `rgba(...)`).
Use `var(--x)` direto, em style inline ou via utility Tailwind (`bg-card`,
`text-muted-foreground`). **Nunca `hsl(var(--x))`** — gera `hsl(#fff)`, inválido,
e o elemento fica sem cor (foi o que apagou botões e cards em setembro).

## Tokens disponíveis

| Uso | Token | Observação |
|---|---|---|
| Fundo da página | `--background` | `#f2f1ec` claro / `#0c0c0c` escuro |
| Texto principal | `--foreground` | |
| Superfície de card | `--card`, `--card-foreground`, `--card-border` | escuro é neutro (`#141414` / `#2a2a2a`) |
| Menus e popovers | `--popover`, `--popover-foreground`, `--popover-border` | |
| Bordas finas | `--border` | rgba translúcida; funciona sobre qualquer superfície |
| Texto secundário | `--muted-foreground` | ≥ 5,7:1 sobre card, background e muted |
| Fundo apagado | `--muted` | chips neutros, trilha da ProgressBar |
| Ação primária | `--primary`, `--primary-foreground` | preto no claro, lima no escuro |
| Marca (fundos/barras) | `--accent` | lima — 2,45:1 sobre branco, **não use como texto** |
| Marca como texto | `--accent-text` (ou `ACCENT_TEXT`) | legível nos dois temas |
| Perigo | `--destructive`, `--destructive-foreground` | `#dc2626` claro (4,8:1 c/ branco) |
| Campo de formulário | `--input`, `--ring` | |
| Status | `--status-{ok,warn,danger,info}`, `--status-*-text`, `--status-*-bg` | usados pelo `StatusBadge` |

Constantes JS em `@/lib/premium-theme`: `CONDENSED`, `BODY` (fontes),
`WARNING`, `GOOD`, `AMBER`, `INFO` (cores fixas para ícones/barras),
`ACCENT_TEXT`. Os objetos `lightTokens`/`darkTokens` são só espelhos do CSS
para quem precisa do hex em runtime (gráficos) — o CSS é a fonte de verdade.

## Escala tipográfica

| px | Uso | Fonte |
|---|---|---|
| 11 | rótulos de seção, eyebrow, cabeçalho de tabela (uppercase, tracking 0.08em) | Condensed 700 |
| 12 | metadados, valores em chips, eixos de gráfico | Condensed 700 ou Body 500 |
| 13 | texto corrido, descrições, células | Body 400/500 |
| 15 | títulos de item/card pequeno | Condensed 800 |
| 19 | títulos de card e de diálogo | Condensed 900, uppercase |
| 24 (→32 md) | h1 da página (`PageHeader`) | Condensed 900, uppercase, tracking -0.02em |

Não crie tamanhos fora da escala; se parecer pequeno demais, suba um degrau.

## Quando usar cada componente

- **PageHeader** — topo de toda tela: eyebrow opcional, `title` (único h1), descrição, `actions` à direita. Mantém `data-testid="text-page-title"` no h1.
- **SectionLabel** — divide blocos dentro da página/card ("Próximos eventos", "Filtros"). `as="h2"|"h3"` quando abre uma seção; `trailing` para contador ou link.
- **EmptyState** — lista/consulta sem resultados. Diga *o que fazer* na descrição e ofereça a ação. `compact` dentro de cards e tabelas.
- **LoadingState** — enquanto a query carrega. `lines` ≈ número de linhas esperadas; `withHeader` quando há título. Nunca deixe "Carregando..." em texto solto.
- **ProgressBar** — progresso de avaliações, metas, ciclos. `value`/`total`; `color` só com cores completas (`var(--accent)`, `WARNING`). Sem `label`, passe `aria-label`.
- **StatusBadge** — estado de algo (ok/warn/danger/info/neutral). O `label` é obrigatório: cor nunca é o único sinal. Mapeie status de domínio → variant na página (ex.: `submitted` → ok, `pending` → warn).
- **ConfirmDialog** — qualquer ação que apaga, publica ou fecha algo. `destructive` para irreversíveis; `confirmText` quando o dano é grande (excluir evento com avaliações). O diálogo não fecha sozinho: chame `onOpenChange(false)` no `onSuccess` da mutação e passe `isPending`.

## Acessibilidade embutida

- `ProgressBar`: `role="progressbar"` + `aria-valuenow/min/max`, rótulo ligado por `aria-labelledby`.
- `EmptyState`/`LoadingState`: `role="status"`; o loading anuncia "Carregando…" via `sr-only`.
- `ConfirmDialog`: Radix AlertDialog (foco preso, Esc, `role="alertdialog"`); não fecha durante `isPending`.
- Ícones são sempre `aria-hidden`; o texto carrega o significado.

Todos aceitam `data-testid` opcional. Os usos nas páginas ainda não foram
migrados — cada tela adota estes componentes na sua própria revisão.
