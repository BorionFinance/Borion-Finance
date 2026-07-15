# Borion Finance v6.30.0 — Integrações inteligentes

## Caminho

Configurações → Integrações → Amanda Estética ou Marco Iris Tecnologia.

Cada aplicativo possui duas abas:

- **Conexão**: perfil, conta padrão, pasta local/Google Drive e sincronização.
- **Vínculos**: conversão de tipos, categorias, origem da receita, formas de pagamento, contas e status.

## Regra de propriedade

O aplicativo externo é responsável apenas por entregar um registro novo. Depois da primeira importação, o lançamento se torna nativo do Borion e pode ser editado normalmente.

Alterações locais não voltam para o aplicativo de origem e não são sobrescritas por alterações posteriores do registro externo.

## Antiduplicidade

O Borion mantém `integrationSourceAppId` e `integrationAggregateId` como referência interna. Esses campos não dependem de nome, valor, categoria, data, conta ou status; portanto, editar o lançamento não gera nova importação.

## Exclusão

Ao excluir um lançamento importado:

1. **Excluir e permitir importar novamente** remove o marcador de importação. Se o registro ainda existir na origem, ele volta na próxima sincronização.
2. **Excluir e ignorar permanentemente** mantém o ID na lista interna de ignorados. O registro não volta.

## Compatibilidade

Lançamentos importados pela versão 6.29.0 são migrados automaticamente para o modo nativo/editável. A conexão existente passa a exigir uma única revisão da aba Vínculos antes de continuar sincronizando.
