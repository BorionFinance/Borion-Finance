# Borion V6.24.6 — Exclusão limpa de assinaturas

## Problema corrigido
Ao excluir uma assinatura, o cadastro recebia status `excluida` e continuava aparecendo na tela como um card fantasma.

## Novo comportamento
- A assinatura é removida do cadastro principal.
- Ocorrências previstas, vencidas, pausadas ou com falha são removidas junto.
- Se nunca houve cobrança, não resta nenhum registro da assinatura.
- Cobranças já pagas ou efetivamente cobradas permanecem somente como registros financeiros independentes.
- Esses registros consolidados são desvinculados do cadastro removido e não reaparecem na aba Assinaturas.
- Parcelas de cartão já geradas permanecem no histórico do cartão, mas deixam de apontar para uma assinatura ativa/excluída.

## Compatibilidade
Na primeira sincronização, assinaturas antigas marcadas como `excluida` ou com `deletedFromKey` são removidas automaticamente da lista. Previsões antigas são apagadas; ocorrências consolidadas são preservadas e desvinculadas.

## Informações
- Versão: 6.24.6
- Lançamento: 07/07/2026
- Desenvolvido por Pedro Bardella
- © 2026 Pedro Bardella. Todos os direitos reservados.
