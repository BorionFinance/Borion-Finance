# Relatório de validação — versão 1.1.0

## Validação estática

- Todos os arquivos JavaScript passaram na verificação de sintaxe.
- `manifest.json` foi validado.
- 68 ações declaradas na interface foram comparadas com o roteador de ações; nenhuma ficou sem tratamento.
- O pacote público foi separado da base privada.

## Validação em navegador

A aplicação foi executada em Chromium headless com a base corrigida real.

- Nove módulos renderizados: painel, OS, agenda, clientes, financeiro, estoque, catálogos, documentos e configurações.
- Nenhum erro de página ou console nos fluxos normais.
- Criação e exclusão de cliente testadas.
- Agenda convertida em OS com vínculo de ida e volta testado.
- Termo criado, editado, vinculado e excluído.
- Produto e movimentação manual criados, editados e excluídos.
- Arquivamento e restauração testados em cliente, OS e produto.
- Exclusão de OS testada com limpeza dos vínculos.
- Importação completa das 56 ordens em PDF e 17 fotos históricas testada com arquivos binários reais; os 73 registros ficaram vinculados às OS, com conteúdo não vazio no armazenamento local e sem duplicidade de metadados.

## Estoque automático

Cenário de teste:

1. Produto A com saldo 10 usado em uma OS na quantidade 3: saldo 7.
2. OS editada para Produto B com saldo 20 e quantidade 4.
3. Produto A voltou para 10; Produto B ficou com 16.
4. OS excluída: Produto B voltou para 20 e todas as movimentações automáticas da OS foram removidas.
5. Uma tentativa de baixar 3 unidades de um item com saldo 2 foi bloqueada antes de salvar a OS.

## PDF e WhatsApp

- PDF gerado com cabeçalho `%PDF`, tamanho de teste de 106.578 bytes e download concluído.
- Atalho validado com o telefone do cliente e a mensagem codificada:
  `Segue o pedido do serviço realizado OSV-000285`.
- Telefone sem DDD ou ausente é bloqueado com orientação para corrigir o cliente.

## Base migrada

- Sem IDs duplicados.
- Sem OS sem cliente.
- Sem itens sem OS.
- Sem itens apontando para catálogo inexistente.
- Sem pagamentos apontando para OS inexistente.
- Sem movimentações apontando para produto/insumo inexistente.
- Três recebimentos acima do total foram preservados e sinalizados para revisão manual.

## Validação dependente da publicação

O login OAuth real, o Google Picker, a criação de pastas e o upload no Google Drive dependem do domínio final do GitHub Pages e das credenciais do projeto Google Cloud. Essa parte precisa ser confirmada depois de cadastrar a origem autorizada. Nenhum teste offline pode substituir essa validação real.
