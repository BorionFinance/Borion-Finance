# MAPA DO APP — Borion Finance

## Objetivo

Borion Finance é um gestor financeiro pessoal offline para computador/notebook, feito em HTML, CSS e JavaScript puro.

A ideia é abrir pelo `index.html`, instalar como app pelo Chrome/Edge quando possível e manter os dados localmente no navegador.

## Regra de ouro para manutenção com IA

Não mande o projeto inteiro para pequenas alterações.

Para qualquer melhoria, envie:

1. Este arquivo `MAPA_DO_APP.md`
2. O arquivo JS/CSS relacionado à área que será alterada
3. O pedido específico

A IA deve fazer alteração localizada, sem reescrever o app inteiro.

## Estrutura

```text
Borion Finance/
├─ index.html
├─ manifest.json
├─ sw.js
├─ LEIA-ME.md
├─ MAPA_DO_APP.md
├─ PROMPT_PADRAO_IA.md
├─ CHANGELOG.md
├─ css/
│  └─ styles.css
└─ js/
   ├─ 00-utils.js
   ├─ 01-storage-data-state.js
   ├─ 02-backup-local.js
   ├─ 03-modals-shared.js
   ├─ 04-gate-shell.js
   ├─ 05-calculations-charts.js
   ├─ 06-overview.js
   ├─ 07-budget.js
   ├─ 08-investments.js
   ├─ 09-patrimony-goals.js
   ├─ 10-cards-accounts.js
   ├─ 11-agenda-notifications.js
   ├─ 12-bank-filter-search.js
   ├─ 13-settings.js
   └─ 14-events-boot-pwa.js
```

## Arquivo de entrada

`index.html`

Este arquivo deve permanecer simples. Ele carrega:

- `css/styles.css`
- Todos os arquivos JS da pasta `js/`, na ordem correta

Não coloque lógica grande de volta dentro do `index.html`.

## Mapa dos módulos

### `css/styles.css`

Contém toda a aparência do app:

- tema escuro
- cards
- sidebar
- topbar
- tabelas
- gráficos
- modais
- calendário
- filtros
- responsividade

Enviar este arquivo quando o pedido for sobre layout, visual, espaçamento, cor, botão, tabela ou responsividade.

---

### `js/00-utils.js`

Contém funções utilitárias usadas pelo app inteiro:

- seletor `$`
- criação de elemento `el`
- `uid`
- escape HTML
- formatação BRL
- porcentagem
- datas e meses
- cores
- iniciais/avatar
- toast
- máscara de dinheiro

Enviar junto quando a mudança mexer em formatação, data, moeda, toast ou utilitários gerais.

---

### `js/01-storage-data-state.js`

Contém:

- chaves do localStorage
- configuração global
- perfis
- sessão
- categorias padrão
- dados iniciais
- migração de dados antigos
- lista de bancos
- filtro por banco
- estado global `S`
- salvar dados atuais

Enviar quando a mudança mexer em dados, categorias, localStorage, perfis, estado global, migração ou estrutura base.

---

### `js/02-backup-local.js`

Contém:

- backup automático em pasta local
- IndexedDB para guardar handle da pasta
- exportação/importação de backup
- permissões de pasta
- sincronização local

Enviar quando o pedido for sobre backup automático, pasta do Google Drive, exportar, importar ou restaurar dados.

---

### `js/03-modals-shared.js`

Contém:

- sistema genérico de modais
- formulários CRUD
- modal de escolha
- criação rápida de categorias dentro de selects

Enviar quando o pedido for sobre janelas/modal, formulário, botão de salvar/cancelar, campos ou criação rápida.

---

### `js/04-gate-shell.js`

Contém:

- tela inicial/login/perfis
- criação e seleção de perfil
- estrutura principal do app
- menu lateral
- troca de telas
- topbar base

Enviar quando o pedido for sobre login, perfis, menu lateral, navegação ou estrutura geral.

---

### `js/05-calculations-charts.js`

Contém:

- cálculos financeiros principais
- cálculo de parcelas
- competência de cartão
- gráficos donut/barra/linha
- tooltip de gráfico
- histórico de patrimônio

Enviar quando o pedido for sobre cálculo, soma, totais, gráficos, evolução, parcelas ou competência.

---

### `js/06-overview.js`

Contém a tela **Visão Geral**:

- cards principais
- indicadores
- resumo do mês
- gráfico de gastos
- gráfico de evolução
- listas/resumos exibidos na visão geral

Enviar quando o pedido for sobre a tela inicial/visão geral/dashboard.

---

### `js/07-budget.js`

Contém a tela de orçamento/lançamentos:

- receitas
- despesas fixas
- despesas variáveis
- filtros por busca/categoria
- modais de lançamento único
- modal de despesa fixa recorrente

Enviar quando o pedido for sobre receitas, despesas, lançamento, filtros de orçamento ou categorias de gasto.

---

### `js/08-investments.js`

Contém a tela **Investimentos**:

- investimentos em caixa
- ativos
- mercado BR/EUA
- rendimento
- edição de investimentos

Enviar quando o pedido for sobre investimentos, CDI, ativos, rendimento ou carteira.

---

### `js/09-patrimony-goals.js`

Contém a tela **Patrimônio**:

- liquidez
- bens
- dívidas
- metas
- progresso das metas
- cartões de patrimônio

Enviar quando o pedido for sobre patrimônio, bens, liquidez, dívidas, metas ou objetivos.

---

### `js/10-cards-accounts.js`

Contém a tela **Contas e Cartões**:

- cadastro de contas/bancos
- cadastro de cartões
- parcelas
- faturas/cartões
- edição/exclusão de cartão ou parcela

Enviar quando o pedido for sobre bancos, contas, cartões, parcelas ou faturas.

---

### `js/11-agenda-notifications.js`

Contém:

- agenda financeira
- calendário
- vencimentos
- notificações
- sino de notificações
- marcar como pago/lido

Enviar quando o pedido for sobre agenda, calendário, vencimentos, lembretes internos ou notificações.

---

### `js/12-bank-filter-search.js`

Contém:

- filtro multibancos do topo
- seleção de um banco, múltiplos bancos ou todos
- busca global

Enviar quando o pedido for sobre filtro por banco, busca global ou seleção de bancos.

---

### `js/13-settings.js`

Contém a tela **Configurações**:

- categorias
- perfis
- backup/importação
- personalização de cores
- fonte
- configurações gerais

Enviar quando o pedido for sobre configurações, categorias, personalização, importar/exportar ou perfil.

---

### `js/14-events-boot-pwa.js`

Contém:

- eventos dinâmicos
- listeners gerais
- splash screen
- inicialização do app
- registro do service worker
- instalação PWA

Enviar quando o pedido for sobre inicialização, app instalado, splash, abrir como programa, cache ou PWA.

## Como pedir alteração do jeito certo

Modelo:

```text
Estou alterando o Borion Finance.

Contexto:
Segue o MAPA_DO_APP.md.

Pedido:
[explique exatamente o que quer]

Arquivo enviado:
[js/arquivo-certo.js]

Regras:
- Não reescreva o app inteiro.
- Não altere arquivos não relacionados.
- Preserve layout, nomes e comportamentos existentes.
- Faça a menor alteração segura possível.
- Entregue em formato de substituição localizada.
- Diga exatamente onde colar.
- Se faltar contexto, peça somente o arquivo/trecho necessário.
```

## Regra de teste

Depois de qualquer alteração, testar:

1. Abrir `index.html`
2. Ver se o app carrega
3. Entrar no perfil
4. Ir até a tela alterada
5. Fazer um lançamento/edição de teste
6. Recarregar a página
7. Conferir se os dados continuam salvos

## Observação importante

Os arquivos JS usam variáveis e funções globais. Por isso, a ordem dos scripts no `index.html` é importante.

Não mude a ordem dos `<script src="js/...">` sem necessidade.

## Regra de dados iniciais
- Todo perfil novo deve iniciar zerado, inclusive o primeiro perfil criado em navegador limpo.
- Não usar dados de demonstração/seed em produção.
- Pode manter categorias padrão, mas transações, contas, cartões, investimentos, liquidez, bens, agenda, metas e histórico devem começar vazios.


## Módulo de cheques
- `js/15-cheques.js`: módulo opcional de cheques recebidos/emitidos, resumo, lotes, baixa e devolução.
- `js/13-settings.js`: ativa/desativa o módulo em Configurações.
- `js/04-gate-shell.js`: exibe a guia Cheques no menu quando o módulo está ativo.

- `js/16-import-statement.js`: módulo Importar Extrato; lê CSV/OFX/TXT/PDF textual, detecta banco, monta revisão editável, sinaliza duplicados e lança receitas/despesas.

## V5.18 — Novidades importantes
- `js/09-patrimony-goals.js`: Patrimônio, metas e Reserva.
- `js/13-settings.js`: Configurações reorganizadas em abas, módulos, dashboard flexível, perfis/avatar e backups.
- `js/06-overview.js`: Visão Geral com blocos configuráveis.
- `js/01-storage-data-state.js`: migração de dados para módulos, dashboard e reservas.


## V5.20
- `js/09-patrimony-goals.js`: Patrimônio, metas e nova tela separada Reserva.
- `js/13-settings.js`: módulos, dashboard, notificações popup e tema claro/sistema.
- `js/04-gate-shell.js`: menu lateral com Reserva abaixo de Patrimônio.

## V5.27 — Receita direto para Reserva e rendimentos
- `js/07-budget.js`: adiciona destino de receita para Conta livre, Direto para reserva ou Dividir entre conta e reserva. A movimentação vinculada é criada automaticamente na Reserva como `Receita direta`.
- `js/09-patrimony-goals.js`: adiciona painel recolhível de rendimentos mensais das reservas e melhora os rótulos de total reservado.
- `js/01-storage-data-state.js`: migração leve para garantir campos das movimentações de reserva e estado do painel de rendimentos.
- `css/styles.css`: estilos do bloco de destino de receita e do painel de rendimentos.

## V5.29 — Lançamentos, fatura/boleto pago, transferências e Meta de Patrimônio na Reserva
- Guia "Orçamento" (menu e título) virou "Lançamentos"; a chave interna de view continua `budget`, sem mudança de função.
- `js/01-storage-data-state.js`: novo campo `transacoes[].origem` ('propria'|'reembolso'|'repasse'), novo array `S.data.transferencias`, `cartoes[].faturasPagas`, `boletos[].pagamentos`, `boletos[].categoria`, `parcelas[].categoria`, `reservas.boxes[].metaId`, `metas[].reservaId`. Helpers novos: `requireBanco`, `adjustLiquidez`, `findLiquidezEntry`, `txOrigemToKey/Label`. Migração atualizada para preencher tudo isso sem duplicar/perder dados antigos.
- `js/05-calculations-charts.js`: `receitaMes` agora só conta origem 'propria'; novas `receitaExtraMes/reembolsosMes/repassesMes`; `computeCardsDebt`/`computeBoletosDebt` reescritos para pular competências já pagas (via `isFaturaPaga`/`isBoletoCompetenciaPaga` e `parcelaRestanteValor`/`boletoRestanteValor`); novas `cartaoFaturaDoMes`/`boletoParcelaDoMes`.
- `js/10-cards-accounts.js`: botão "Marcar fatura como paga" (cartão) e "Marcar como paga" (boleto), com escolha obrigatória do banco de pagamento — debita a liquidez desse banco e permite desfazer. Campo Categoria em parcela e boleto. Nova seção de Transferências entre contas (debita/credita liquidez de origem/destino).
- `js/06-overview.js`: separa "Crédito usado em cartões" de "Boletos a pagar" (antes somados via `computeCardsDebt().total`).
- `js/09-patrimony-goals.js`: Meta de Patrimônio agora é criada/editada dentro de `Reservas.edit` (abaixo da Meta da Reserva), reaproveitando `EMOJI_PALETTE`. `Metas.edit` redireciona para `Reservas.edit` quando a meta está vinculada a uma reserva (`reservaId`). `syncMetaFromReserva` mantém a meta em dia sempre que o valor da reserva muda.
- `js/07-budget.js`: campo "Origem da receita" no modal de lançamento; banco/conta agora obrigatório em receita, despesa e despesa fixa (via `requireBanco`).
