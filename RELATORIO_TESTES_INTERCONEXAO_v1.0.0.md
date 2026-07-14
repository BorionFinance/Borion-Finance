# Relatório de validação — Borion Interop v1.0.0

**Versões entregues**
- Amanda Estética v1.8.6
- Marco Iris Tecnologia v1.6.1
- Borion Finance v6.29.0

## Resultado
- Testes específicos de interconexão: **25/25 aprovados**.
- Regressão completa do Borion: **88/88 aprovados**.
- Arquivos JavaScript validados sintaticamente: **60**.
- Referências de HTML e service worker ausentes: **0**.
- Alterações visuais não solicitadas: **0**; a comparação com os ZIPs originais mostrou somente arquivos e pontos de extensão da integração, versão, cache e documentação.

## Cobertura executada
Foram testados criação, idempotência, edição, mudança de valor, estorno/reaplicação de saldo, receita pendente, despesa em aberto, pagamento, parcial, atraso, cancelamento, exclusão, tombstone, reinstalação/reset da origem, isolamento de perfis, mapeamento para o perfil Estética, Carteira, conta padrão, crédito conservador, categorias, ACK de retorno, pasta local, Google Drive simulado, dados adulterados, origem incorreta, instância incorreta, IDs duplicados, valores inválidos, registros sem ID e valores zerados.

## Proteções implementadas
- `aggregateId` permanente por instalação e registro.
- `fingerprint` e `contentHash` para detectar alteração ou corrupção.
- Snapshot completo e tombstones para limpar registros antigos.
- Reversão do efeito anterior antes de aplicar uma atualização.
- Transação importada marcada como `integrationManaged` e bloqueada para edição direta.
- Configuração armazenada dentro do perfil do Borion.
- Camada marcada como `explicit-request-only` e documentada em cada projeto.

## Limite do teste atual
A lógica, os transportes e as APIs de arquivo foram testados localmente e com mocks determinísticos. O login real do Google, o Picker e a gravação em uma conta Drive real exigem os domínios finais do GitHub Pages, as credenciais OAuth e a autorização de Amanda/Marco; portanto, essa última validação acontece no momento da ativação. O código já inclui mensagens de erro e diagnóstico para pasta, permissão, arquivo ausente e conta de destino inválida.
