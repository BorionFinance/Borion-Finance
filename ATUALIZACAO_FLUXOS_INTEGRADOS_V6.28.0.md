# Borion Finance V6.28.0 — Relatório de atualização

**Data:** 14/07/2026  
**Base atualizada:** V6.27.4  
**Versão entregue:** V6.28.0  
**Escopo:** receitas, assinaturas, transferências, boletos, edição de parcelas, persistência da organização e Patrimônio.

## Resultado da validação

- **88/88 testes regressivos aprovados.**
- **214/214 verificações de integridade aprovadas.**
- **302 verificações automatizadas aprovadas no total.**
- Todos os arquivos JavaScript passaram na validação sintática do Node.js.
- O cache do PWA foi alterado para `borion-finance-v6-28-0-integrated-financial-flows`.
- Investimentos e Agenda não tiveram seus arquivos funcionais alterados.

## 1. Receita — formulário próprio

A janela de Receita deixou de usar o título genérico e agora abre como **Adicionar receita** ou **Editar receita**.

Ordem aplicada:

1. Nome
2. Categoria
3. Valor
4. Data
5. Origem da receita
6. Onde a receita entra

A origem passou a usar botões:

- Receita própria
- Rendimento
- Reembolso recebido
- Repasse de terceiros

O destino passou a usar botões:

- Carteira
- Conta
- Reserva
- Dividir entre Conta e Reserva

Regras implantadas:

- Carteira credita automaticamente o dinheiro em espécie.
- Conta exige uma conta bancária ativa.
- Reserva exige um Cofrinho e utiliza seu vínculo bancário.
- Divisão exige uma conta, uma reserva e dois valores cuja soma seja exatamente o total da receita.
- Receita própria e rendimento continuam compondo a Receita do mês; reembolso e repasse continuam separados.

## 2. Despesa fixa

O formulário de Despesa fixa foi preservado. Nenhuma reorganização foi aplicada nele.

## 3. Despesa variável

A única alteração visual do formulário foi o título:

- **Adicionar despesa variável**
- **Editar despesa variável**

Os campos, fontes de pagamento e regras existentes foram preservados.

## 4. Assinaturas

O título passou de **Nova assinatura** para **Adicionar assinatura**.

Ordem aplicada:

1. Mensal / Anual
2. Nome
3. Local
4. Categoria
5. Valor mensal ou anual, conforme a periodicidade
6. Dia do vencimento
7. De onde será pago

Melhorias implantadas:

- A categoria lista categorias de Despesas Fixas e Despesas Variáveis, identificadas pelo grupo.
- O pagamento usa botões Carteira, Conta, Reserva e Crédito.
- Carteira usa dinheiro em espécie.
- Conta lista apenas contas bancárias, sem repetir a Carteira.
- Reserva desconta do Cofrinho escolhido quando a cobrança é processada.
- Crédito cria a parcela no cartão selecionado.
- O modelo de versão da assinatura preserva meses já consolidados.

## 5. Ordem personalizada salva no perfil

A organização deixou de depender apenas do armazenamento local do navegador. Agora fica também em:

`S.data.uiPreferences.orderPreferences`

São persistidos por perfil:

- ordem dos módulos do menu;
- bancos e contas;
- cartões;
- reservas;
- categorias;
- módulos do Patrimônio;
- modos de ordenação;
- quantidade de colunas de Reservas e Patrimônio.

Isso permite que a ordem sobreviva a reinicializações, atualização de versão, backup e restauração do perfil.

## 6. Renomeação para Transferências

Todos os pontos visuais da antiga aba **Entre reservas** foram renomeados para **Transferências**.

O título **Movimentações entre reservas** também foi substituído pela nova central **Transferências**.

## 7. Central única de Transferências

A página em Lançamentos agora reúne movimentações entre Carteira, Contas e Reservas.

Filtros disponíveis:

- Todas
- Carteira → Conta
- Conta → Conta
- Conta → Reserva
- Reserva → Reserva

O botão permanece como **+ Nova transferência**.

## 8. Transferências removidas de Cartões e Contas

A página visual de Transferências foi removida de Cartões e Contas. A funcionalidade ficou centralizada em:

**Lançamentos → Transferências**

O código financeiro compartilhado continua em um único controlador interno, sem duplicar regras nem telas.

## 9. Janela única de transferência

O botão **+ Nova transferência** e o botão **+ Movimentação** das Reservas abrem exatamente a mesma janela.

A primeira escolha é a origem do dinheiro:

- Carteira
- Conta
- Reserva

## 10. Regras financeiras das transferências

### Carteira

Permitido:

- Carteira → Conta

Bloqueado:

- Carteira → Reserva

### Conta

Permitido:

- Conta → Conta
- Conta → Reserva

Ao escolher Conta → Reserva, aparecem somente as Reservas vinculadas à conta de origem.

### Reserva

Tipos disponíveis:

- Resgatar
- Rendimento
- Ajuste manual
- Enviar para outra reserva

Regras:

- Resgatar devolve automaticamente à conta vinculada à Reserva.
- Rendimento aumenta diretamente o saldo da própria Reserva.
- Ajuste manual altera somente o saldo da própria Reserva.
- Enviar para outra reserva solicita apenas a Reserva de destino.
- Reserva → Reserva permanece permitido, mesmo entre Cofrinhos de contas diferentes.

Todos os efeitos possuem rotina de reversão. Editar ou excluir devolve os saldos ao estado anterior antes de aplicar a nova operação.

## 11. Edição de despesas do cartão

Ao editar em Lançamentos uma Despesa fixa ou variável que veio do cartão, o Borion abre diretamente:

`Cards.editParcela(cartao.id, parcela.id)`

Assim, Lançamentos e Cartões e Contas usam a mesma janela **Editar parcela**, sem formulário paralelo.

## 12. Boletos

O formulário foi reorganizado para:

1. Descrição do boleto
2. Para quem / Empresa
3. Origem do pagamento
4. Categoria
5. Valor de cada boleto
6. Quantidade de boletos
7. Mês do primeiro boleto
8. Dia de vencimento
9. Status
10. Observação
11. Aparecer também em Despesas

Origem do pagamento:

- Carteira
- Conta

Crédito não aparece como opção.

Categorias:

- Despesa variável mostra apenas categorias variáveis.
- Despesa fixa mostra apenas categorias fixas.
- A lista é reconstruída automaticamente ao trocar o tipo.

Status padronizados:

- Em Aberto
- Pago
- Cancelado

A migração converte visualmente dados antigos `Ativo` para `Em Aberto` e `Quitado` para `Pago`.

## 13. Organização do Patrimônio

A página Patrimônio ganhou:

- arrastar e soltar módulos;
- setas para mover ao início, acima, abaixo ou ao final;
- escolha de 1, 2 ou 3 colunas;
- persistência da ordem e das colunas no perfil.

Módulos contemplados:

- Composição do patrimônio
- Saldo em contas
- Metas de patrimônio
- Bens
- Reservas
- Rendimento das reservas
- Dívidas

## Arquivos principais alterados

- `js/07-budget.js`
- `js/10-cards-accounts.js`
- `js/09-patrimony-goals.js`
- `js/19-subscriptions.js`
- `js/18-order-preferences.js`
- `js/01-storage-data-state.js`
- `js/05-calculations-charts.js`
- `css/styles.css`
- `index.html`
- `sw.js`
- `js/02-backup-local.js`
- `js/13-settings.js`
- `tests/borion-regression-tests.js`

## Testes novos adicionados

- Estrutura e ordem do formulário de Receita.
- Centralização das Transferências em Lançamentos.
- Reutilização da mesma janela pelas Reservas.
- Edição de cartão usando a janela Editar parcela.
- Categorias e fontes de pagamento das Assinaturas.
- Origem, status e categorias dinâmicas dos Boletos.
- Organização e colunas do Patrimônio.
- Aplicação e reversão real dos saldos nos fluxos de transferência.
- Persistência da ordem dentro do perfil mesmo sem localStorage.

## Observação técnica

A validação foi feita por simulação programática dos fluxos financeiros, testes regressivos e auditoria estrutural. Ela não substitui uma rodada visual manual em cada navegador e tamanho de tela, mas cobre sintaxe, vínculos, efeitos de saldo, reversões, persistência, handlers, cache offline e regressões já conhecidas do Borion.
