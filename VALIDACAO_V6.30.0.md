# Validação — Borion Finance v6.30.0

- 88/88 testes regressivos aprovados.
- 10/10 testes específicos de integrações inteligentes aprovados.
- 223/223 verificações de integridade estrutural aprovadas.
- Todos os arquivos JavaScript passaram em `node --check`.
- Cache do PWA atualizado para `borion-finance-v6-30-0-smart-integrations`.
- Versionamento dos arquivos estáticos atualizado para `6.30.0`.

## Cenários específicos validados

1. Conversão de categoria, tipo, forma, conta, origem da receita e status.
2. Lançamento importado criado como nativo e editável.
3. Edição local preservada em sincronizações posteriores.
4. Antiduplicidade mantida após edição.
5. Exclusão com liberação para nova importação.
6. Exclusão com bloqueio permanente.
7. Exclusão na origem não apaga lançamento já nativo.
8. Receita pendente aguarda e entra uma única vez após recebimento.
9. Descoberta automática dos campos do aplicativo externo.
10. Presença das abas Conexão e Vínculos para Amanda e Marco.
