# Borion Finance — v6.35.4
## Correção: mudar a data da compra no cartão não atualizava o dia da fatura

### Escopo desta versão
Correção pontual em `js/10-cards-accounts.js` (funções `editParcela` e `addParcela`).
Nenhuma outra regra financeira, de saldo ou de vínculo foi alterada. Os demais arquivos
só tiveram a string de versão atualizada de 6.35.3 para 6.35.4 (cache-busting).

### Onde essa tela aparece
Isso não é a mesma janela de "Adicionar despesa variável"/"Adicionar despesa fixa" que
corrigimos na v6.35.3. É uma tela diferente: quando você clica em **editar** (✎) numa
despesa variável ou fixa que veio de uma compra no crédito, o app não abre o formulário
comum — ele redireciona direto para **Cartões e Contas → Editar parcela**
(`Cards.editParcela`), porque essas despesas precisam ficar sincronizadas com a compra
original no cartão.

### Sintoma relatado
Escolher a data no dia 15, lançar, perceber que era dia 16, editar e trocar a data —
mas o dia salvo continua sendo 15, como se a mudança não tivesse efeito.

### Testei nos outros campos do programa — só acontece aqui
Fui atrás de todo lugar do app que lida com data para confirmar se o problema se repetia
em outro canto. Resultado: esse bug específico só existe em **Editar parcela / Adicionar
compra parcelada**, dentro de Cartões e Contas — porque é a única tela do Borion que tem
**dois campos separados representando o mesmo dia ao mesmo tempo**:
- "Data da compra (1ª parcela)" — um seletor de data completo (dia/mês/ano).
- "Dia do mês que entra na fatura" — um campo numérico avulso, só com o dia.

Nenhum outro formulário do app (Receita, Despesa fixa/variável fora do crédito, Boletos,
Cheques, Assinaturas, Investimentos, Metas, Agenda) tem essa duplicação — todos usam um
único campo de data como fonte da verdade, então não sofrem desse problema.

### Causa raiz
Ao abrir "Editar parcela", o campo numérico "Dia do mês que entra na fatura" já vem
pré-preenchido com o dia **antigo** (o valor salvo da última vez). Se você só mexe no
seletor de data — sem tocar nesse segundo campo — ele continua ali, parado no valor
velho. Na hora de salvar, o código decidia o dia assim:

```js
const diaCompra = Math.max(1, Math.min(31,
  Number(v.diaEntrada) || parseInt(dataCompraCompleta.slice(8,10), 10) || 1
));
```

Ou seja: **o campo numérico antigo tinha prioridade sobre a data nova.** Como ele quase
sempre está preenchido com algum número (o valor antigo, pré-carregado), a data que você
acabou de escolher só seria usada se o campo numérico estivesse vazio — o que nunca
acontece ao editar, só ao adicionar uma parcela nova do zero.

### Correção aplicada
Invertida a prioridade: o dia agora vem primeiro da própria data escolhida
(`dataCompraCompleta`), e só cai para o campo numérico "Dia do mês que entra na fatura"
se a data vier vazia por algum motivo:

```js
const diaCompra = Math.max(1, Math.min(31,
  parseInt(dataCompraCompleta.slice(8,10), 10) || Number(v.diaEntrada) || p.diaEntrada || 1
));
```

Aplicado tanto em `editParcela` (onde o bug acontecia) quanto em `addParcela` (onde não
dava pra reproduzir, mas ficava com o mesmo risco em aberto).

### Observação — não corrigido agora, por escopo
Os dois campos ("Data da compra" e "Dia da fatura") continuam existindo separadamente na
tela. Com a correção, a data sempre manda no dia, então não há mais como esse conflito
se repetir — mas se um dia você quiser, dá pra simplificar a tela removendo o campo
numérico duplicado e deixando só a data. Isso é só uma sugestão de limpeza futura, não
algo que precisava ser feito para resolver o bug relatado.

### Validação técnica
- `node --check js/10-cards-accounts.js`: sem erros.
- Nenhuma outra função do arquivo foi tocada.
- Referências de versão em `index.html` e `sw.js` atualizadas para `?v=6.35.4`.
- `CACHE_NAME` do Service Worker atualizado para forçar atualização do cache.
