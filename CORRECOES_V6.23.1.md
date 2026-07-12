# Borion Finance V6.23.1 — Correções de integridade financeira

## Escopo preservado

Esta atualização corrige os vínculos financeiros entre contas, lançamentos, assinaturas, importações e backups sem reestruturar o projeto, trocar bibliotecas ou alterar o visual geral. O cálculo e o comportamento de Reservas e Cofrinhos foram preservados, inclusive a regra de que Reservas deixam de participar do patrimônio quando o módulo é desativado.

## Causa do saldo da Nubank reaparecer

A causa estrutural estava no livro de saldo de contas (`liquidez`) e em registros legados vinculados pelo texto do banco. A versão anterior procurava a linha de saldo por `conta.nome`/`banco`. Ao excluir uma conta, o cadastro desaparecia, mas a linha histórica de `liquidez` podia permanecer. Ao cadastrar outra conta chamada “Nubank”, o sistema encontrava a mesma linha antiga pelo nome e reaplicava o acumulado, inclusive um valor como −R$ 6.000.

Assim, os registros reutilizados pelo erro eram principalmente:

- a linha acumuladora em `liquidez` identificada por nome;
- lançamentos e pagamentos antigos com campos como `banco`, `bankName`, `account`, `accountName` ou equivalentes, sem `accountId`;
- transferências antigas cujas pontas eram gravadas como nome da conta.

O mecanismo de herança vinha da conta/ledger e de movimentações antigas vinculadas por nome. Cartões e faturas não devem compor o saldo bancário e agora estão isolados. O projeto-fonte não continha o banco de dados vivo do perfil que apresentou exatamente −R$ 6.000; portanto, não é possível apontar com honestidade o ID individual daquele registro nem afirmar se o acumulado original nasceu de um pagamento de fatura específico. O defeito de código que fazia o valor reaparecer foi identificado e reproduzido diretamente.

## Novo vínculo por accountId

- Cada conta possui um `accountId` único e imutável.
- O nome é apenas um rótulo visual.
- Lançamentos, pagamentos, transferências, investimentos, bens, metas, cheques, importações e assinaturas gravam o `accountId` selecionado.
- O saldo passa a ser calculado por `saldoInicial + ledger(accountId)`.
- Duas contas com o mesmo nome permanecem independentes.
- Renomear uma conta altera somente o rótulo; histórico e saldo continuam no mesmo ID.
- Cartões, faturas, limites, dívidas e boletos não entram no card “Saldo em Contas”.

## Exclusão segura

A exclusão de conta passou a ser arquivamento:

- a conta deixa de aparecer entre as contas ativas;
- deixa de participar do saldo atual;
- preserva o `accountId` e o histórico;
- uma nova conta com o mesmo nome recebe outro ID;
- o ledger antigo permanece preso ao ID arquivado;
- antes de arquivar, o sistema informa quantos vínculos financeiros existem.

## Migração defensiva

Antes da migração automática, o Borion cria um snapshot interno `before_account_id_v6231`.

- Se houver exatamente uma conta compatível, o registro legado recebe o ID dela.
- Se houver duas contas homônimas, nenhuma é escolhida aleatoriamente.
- Se houver conta arquivada e conta nova com o mesmo nome, o vínculo permanece ambíguo.
- Registros sem correspondência segura ficam em `accountMigrationReview` com status `ambiguous` ou `unresolved`.
- Valores financeiros não são alterados silenciosamente para “forçar” um vínculo.

## Assinaturas

Assinaturas foram separadas em três camadas:

1. cadastro/regra atual;
2. versões da regra por competência;
3. ocorrências financeiras independentes.

Resultados:

- vencimento futuro fica como `Prevista` e não altera saldo;
- somente ocorrência cobrada/paga altera a conta;
- pausa encerra o período ativo e não apaga o passado;
- retomada começa na competência atual, sem cobrança retroativa;
- edição cria nova versão para o mês atual e futuros;
- ocorrências consolidadas mantêm nome, valor, categoria, conta/cartão, vencimento e forma de pagamento da época;
- exclusão interrompe o futuro e mantém pagamentos anteriores;
- cartão inexistente gera `Falhou`, registra motivo e permite nova tentativa sem duplicar.

## Edição atômica de lançamentos

O novo fluxo é:

1. ler o lançamento atual;
2. validar conta, valor, categoria, datas e demais campos novos;
3. criar snapshot do estado financeiro;
4. desfazer o efeito antigo;
5. aplicar o novo efeito;
6. salvar;
7. em qualquer falha, restaurar o snapshot integral.

## Backup Drive&Local

O botão `SALVAR DRIVE&LOCAL` gera um único objeto de snapshot e entrega o mesmo conteúdo aos dois destinos.

Os dois backups compartilham:

- `snapshotId`;
- `snapshotBaseDate`;
- `appVersion`;
- `snapshotChecksum` / `integrity.snapshotSha256`;
- conteúdo integral.

Backups com motivos `manual`, `manual_quick`, `manual_drive_local`, `before_import`, `before_restore` e `before_schema_migration` são protegidos da limpeza automática.

## Arquivos alterados

- `CHANGELOG.md`
- `index.html`
- `sw.js`
- `js/01-storage-data-state.js`
- `js/01b-storage-provider.js`
- `js/01c-google-drive-provider.js`
- `js/02-backup-local.js`
- `js/03-modals-shared.js`
- `js/05-calculations-charts.js`
- `js/06-overview.js`
- `js/07-budget.js`
- `js/08-investments.js`
- `js/09-patrimony-goals.js`
- `js/10-cards-accounts.js`
- `js/11-agenda-notifications.js`
- `js/13-settings.js`
- `js/15-cheques.js`
- `js/16-import-statement.js`
- `js/19-subscriptions.js`
- `tests/borion-regression-tests.js`
- `tests/regression-results.json`

## Resultado dos testes

| # | Cenário | Resultado |
|---|---|---|
| 1 | Nubank antiga −R$ 6.000, arquivar, recriar com R$ 0 e recarregar | PASSOU |
| 2 | Nova Nubank com saldo inicial R$ 1.000 | PASSOU |
| 3 | Conta Nubank R$ 2.000 + cartão/fatura R$ 6.000 | PASSOU — saldo em contas R$ 2.000 |
| 4 | Duas contas Bradesco homônimas; entrada em apenas uma | PASSOU |
| 5 | Renomear conta mantendo saldo e histórico | PASSOU |
| 6 | Assinatura futura prevista sem débito | PASSOU |
| 7 | Pausar em março e retomar em julho sem retroatividade | PASSOU |
| 8 | Editar assinatura de R$ 50 para R$ 80 sem alterar janeiro | PASSOU |
| 9 | Excluir assinatura preservando ocorrências históricas | PASSOU |
| 10 | Cartão inválido → Falhou → nova tentativa sem duplicidade | PASSOU |
| 11 | Erro na edição → rollback integral de lançamento e saldo | PASSOU |
| 12 | Persistência após serializar/recarregar dados | PASSOU |
| 13 | Migração única versus homônima ambígua + backup anterior | PASSOU |
| 14 | Conta arquivada + nova homônima não recebe legado | PASSOU |
| 15 | Cartões fora do seletor Banco/Conta | PASSOU |
| 16 | Snapshot Drive&Local com mesmo ID/data/versão/checksum | PASSOU |
| 17 | Validação sintática de todos os JavaScript | PASSOU |
| 18 | Cobertura estática dos seletores Banco/Conta | PASSOU |

**Total: 18/18 testes aprovados.**

A suíte executa as funções reais do Borion em ambiente isolado e testa recarga por serialização JSON. Conexões reais com Supabase e Google Drive não foram acionadas porque o ZIP não inclui credenciais nem o perfil vivo do usuário.
