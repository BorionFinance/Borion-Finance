# Borion Finance — v6.35.2
## Correção: janelas suspensas esticadas no Desktop + estouro de tela no Mobile

### Escopo desta versão
Correção **exclusivamente visual/CSS**, sem qualquer alteração de regra financeira,
fluxo de dados ou funcionalidade. Nenhum outro arquivo além de `css/styles.css` foi
alterado no conteúdo (os demais arquivos só tiveram a string de versão atualizada
de 6.35.1 para 6.35.2, para cache-busting).

### Janelas afetadas
- Adicionar/editar receita
- Adicionar/editar despesa variável
- Adicionar/editar despesa fixa

(As três são geradas pelas mesmas funções `openTransactionModal` e `openFixaModal`
em `js/07-budget.js`, que usam as classes `.transaction-modal-overlay` / `.transaction-modal`.)

### Causa raiz identificada
Comparando v6.34.0 (comportamento correto) com v6.35.1 (com bug):

1. Em `07-budget.js`, essas três janelas passaram a receber as classes CSS
   `transaction-modal-overlay` / `transaction-modal` / `fixed-expense-modal`
   — essa foi a única mudança funcional nesse arquivo entre as duas versões.
2. Em `styles.css`, o bloco de regras criado para conter esses formulários
   **no Smartphone Mode** foi escrito sem o seletor
   `html[data-interface-mode="smartphone"]`. Como `.transaction-modal{max-width:100%}`
   tem a mesma especificidade de `.modal-box{max-width:400px}` e aparece depois no
   arquivo, ele vencia a cascata **também no Desktop**, esticando a janela para a
   largura total disponível. O mesmo bloco também forçava `overflow:hidden`, cortando
   a rolagem interna do formulário — origem dos cliques que "não funcionavam" (campos/
   botão Salvar ficavam fora da área visível).
3. No Mobile, o sheet dessas mesmas janelas usava `width:100vw` / `max-width:100vw`
   sem nenhuma margem de segurança — um caso clássico onde `100vw` pode ultrapassar a
   largura real da tela visível, empurrando a janela para fora dos limites do aparelho.

### Correção aplicada
- Todo o bloco de contenção passou a ser escopado com
  `html[data-interface-mode="smartphone"]`, restaurando no Desktop o comportamento
  padrão de `.modal-box` (máx. 400px, exatamente como na v6.34.0).
- `width:100vw` / `max-width:100vw` substituídos por `width:100%` / `max-width:100%`
  nas duas regras do sheet mobile, eliminando o estouro de tela.

### Validação técnica
- `node --check` executado em todos os arquivos `.js` do pacote (incluindo `sw.js`): sem erros.
- Chaves de `styles.css` e `borion-hub.css` balanceadas (contagem `{`/`}` idêntica).
- `manifest.json` validado como JSON válido.
- Todas as referências de versão em `index.html` e `sw.js` atualizadas de forma
  consistente para `?v=6.35.2` (32 arquivos referenciados em cada).
- Diff final de `styles.css` revisado linha a linha: nenhuma regra fora do escopo
  pretendido foi tocada.

### Não incluído nesta versão
Por instrução explícita, nenhuma outra funcionalidade foi alterada — apenas a
correção das janelas suspensas descrita acima.
