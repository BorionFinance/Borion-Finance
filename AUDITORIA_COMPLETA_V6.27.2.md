# Borion Finance V6.27.2 — Auditoria estrutural e de vínculos

## Escopo executado

Foi revisada a estrutura completa deste pacote: carregamento, armazenamento, perfis, navegação, lançamentos, receitas, despesas fixas e variáveis, cartões, contas, boletos, transferências, assinaturas, investimentos, patrimônio, metas, Cofrinhos/Reservas, cheques, agenda, notificações, importação de extrato, backups, Google Drive, Supabase, modo Smartphone, personalização e PWA.

## Resultado

- 76 testes funcionais/regressivos existentes aprovados.
- Validação sintática de todos os JavaScript aprovada.
- Todos os handlers `onclick` apontam para funções ou métodos existentes.
- Todos os módulos carregados pelo HTML existem no pacote.
- Todos os módulos locais carregados pelo HTML estão incluídos no cache do service worker.
- As regras de status Pago/Em aberto entre Lançamentos, Cartões e Contas permanecem sincronizadas e idempotentes.
- Assinaturas, despesas variáveis, despesas fixas, faturas e boletos continuam sem duplicação de baixa ou estorno.
- IDs de contas/cartões e migrações defensivas continuam isolando homônimos e impedindo herança de saldo excluído.

## Alterações realizadas

1. Criado `tests/system-integrity-audit.js`, que verifica automaticamente arquivos ausentes, módulos sem cache offline, handlers de botões sem destino, módulos principais ausentes e divergência de versão no HTML.
2. Versão dos recursos atualizada para `6.27.2`, forçando o navegador/PWA a buscar os arquivos revisados.
3. Cache do service worker atualizado para `borion-finance-v6-27-2-system-integrity-audit`, evitando permanência indevida da versão anterior.
4. Criado este relatório técnico dentro do pacote.

## Limite real do pacote analisado

Este ZIP é o Borion Finance. Não existem nele módulos de produtos, estoque, clientes, ordens de serviço ou geração/envio de PDF pelo WhatsApp. Portanto, nenhuma integração dessas áreas foi alterada ou simulada; elas pertencem a outro sistema/versão e não seria seguro inventá-las neste código.

## Observação sobre IDs repetidos

Alguns IDs literais aparecem mais de uma vez no código-fonte porque pertencem a telas/modais alternativos, criados em momentos diferentes e não simultaneamente. Não foi feita renomeação automática, pois isso quebraria seletores e eventos sem ganho funcional. A auditoria priorizou defeitos reproduzíveis e vínculos reais.
