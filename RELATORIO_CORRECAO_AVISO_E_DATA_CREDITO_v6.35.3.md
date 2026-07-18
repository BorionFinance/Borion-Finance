# Borion Finance — v6.35.3
## Correção: aviso de validação apagando o formulário + data errada (dia 01) em despesas variáveis via crédito

### Escopo desta versão
Duas correções pontuais, sem qualquer alteração de regra financeira além do descrito abaixo:
1. `js/03-modals-shared.js` — o aviso "Digite um valor maior que zero" (e qualquer outro `alert()`) não
   destrói mais o formulário que estava aberto por trás.
2. `js/05-calculations-charts.js` — despesas variáveis criadas a partir de compra no crédito (à vista
   ou parcelada) passam a usar o dia real da compra, em vez de ficarem travadas no dia 01.

Os demais arquivos só tiveram a string de versão atualizada de 6.35.2 para 6.35.3 (cache-busting).

---

### Bug 1 — aviso de valor fecha tudo e apaga o que foi digitado

**Sintoma relatado:** ao esquecer de preencher o valor em Receita, Despesa fixa ou Despesa variável,
o app avisa "Digite um valor maior que zero", mas ao fechar o aviso o formulário inteiro some — nome,
categoria, data, tudo que já tinha sido digitado precisa ser refeito.

**Causa raiz:** desde a v6.33.3, `window.alert()` foi substituído por um modal com a identidade visual
do Borion (para não quebrar a estética com a caixa cinza nativa do navegador). Esse `alert()` customizado
fazia `$('#modal-root').innerHTML=''` antes de desenhar o próprio aviso — ou seja, ele **apagava
completamente** o conteúdo de `#modal-root`, inclusive o formulário de receita/despesa que já estava
aberto ali dentro. Ao clicar em "Entendi", `closeModal()` limpava `#modal-root` de novo, e não havia
mais nada para recuperar: o formulário original já tinha sido destruído no passo anterior, não pelo
fechamento do aviso.

Isso não é um bug exclusivo da validação de valor — qualquer chamada a `alert()` feita com uma janela
de lançamento aberta atrás tinha o mesmo efeito. Por isso acontece igual nas três janelas (Receita,
Despesa fixa, Despesa variável): as três chamam a mesma validação (`if(valor<=0){alert(...)}`) em
`07-budget.js`.

**Correção aplicada:** o aviso agora é anexado diretamente no `<body>`, empilhado **por cima** do
`#modal-root` (via `z-index`), em vez de substituir o seu conteúdo. Fechar o aviso (botão "Entendi", X,
clique fora, ou tecla Esc) remove apenas o próprio aviso — o formulário por baixo permanece intacto,
com todos os campos exatamente como o usuário deixou.

---

### Bug 2 — despesa variável no crédito aparece com data 01, mesmo escolhendo outro dia

**Sintoma relatado:** ao lançar uma despesa variável pagando no crédito à vista (ex.: compra do dia
15/07, ainda em aberto), ela aparece na lista com a data 01/07 em vez de 15/07.

**Causa raiz — a lógica por trás:** quando uma despesa variável é paga no crédito (à vista ou
parcelada), o app não cria a transação diretamente com a data escolhida no formulário. Em vez disso,
ela primeiro vira uma "parcela" dentro do cartão (`cartao.parcelas`), guardando a data completa da
compra e o dia calculado de entrada na fatura (`diaEntrada`). Essa parcela então é *espelhada* como
uma ou mais transações do tipo despesa variável — uma por mês/parcela — através da função
`createParcelaDespesaVariavel()`.

O problema: essa função, ao montar a data de cada transação espelhada, usava sempre
`data: ym + '-01'` — ou seja, **mês certo, mas dia fixo em 01**, ignorando completamente o
`diaEntrada` que já tinha sido calculado corretamente a partir da data escolhida no formulário.
O `diaEntrada` continuava existindo e sendo usado em outros lugares (ex.: no detalhe do cartão,
onde aparece "Dia 15"), só não era aplicado na data da despesa espelhada — que é o campo que a
lista de Despesas variáveis efetivamente exibe.

Isso explica por que o bug parece "não corrigir mesmo escolhendo a data": o formulário salva a data
certa na parcela do cartão, mas a transação que você vê na lista de despesas variáveis é uma cópia
gerada à parte, com o dia hardcoded.

**Por que só acontece no crédito:** despesa variável paga em conta, carteira ou reserva grava a
`data` do formulário diretamente na transação, sem passar por esse espelhamento — por isso não tem
esse problema. Despesa fixa no crédito também não é afetada, porque usa uma estrutura diferente
(campo `dia` separado, não embutido numa string de data). Recebimentos (receitas) nunca passam por
essa função, já que não existe opção de "receita no crédito" — por isso também não são afetados.

**Correção aplicada:** `createParcelaDespesaVariavel()` agora monta a data de cada parcela usando o
dia real (`diaEntrada`) informado, em vez de forçar o dia 01. Uma compra parcelada em 3x no dia 15
agora aparece como dia 15 nos três meses, em vez de dia 01.

### Validação técnica
- `node --check` executado nos dois arquivos alterados: sem erros.
- Nenhuma outra regra de saldo, conta ou reserva foi tocada.
- Todas as referências de versão em `index.html` e `sw.js` atualizadas para `?v=6.35.3`.
- `CACHE_NAME` do Service Worker atualizado para forçar atualização do cache no próximo carregamento.

### Não incluído nesta versão
Por foco no escopo pedido, não foram alteradas `openConfirmModal()`/`openChoiceModal()` em
`03-modals-shared.js`, que usam o mesmo padrão antigo de "substituir #modal-root" — elas não entraram
no fluxo relatado (são usadas só para confirmações de exclusão, não para validação de formulário), mas
valem uma correção futura por consistência, se você quiser.
