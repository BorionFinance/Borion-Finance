# Mapa de módulos e integrações — v1.1.0

## Cliente

Um cliente pode possuir OS, agendamentos e termos. Seu nome é mantido como referência histórica nos registros relacionados, e a ferramenta de diagnóstico corrige diferenças seguras. A exclusão definitiva é bloqueada enquanto houver dependências; arquivar preserva tudo.

## Agenda

O agendamento pode existir sozinho ou ser convertido em OS. Na conversão:

- a OS recebe o cliente, a observação e o código do agendamento;
- o agendamento recebe o código da OS;
- o status do agendamento passa para `Concluído`;
- se a OS for apagada, o agendamento continua, mas perde apenas o vínculo da OS.

## Ordem de serviço

A OS é o centro operacional. Ela integra:

- cliente e equipamento;
- defeito, diagnóstico e observações;
- produtos, serviços e insumos;
- baixa e devolução de estoque;
- receitas e pagamentos;
- fotos, PDFs e anexos técnicos;
- termos de autorização;
- geração de PDF e WhatsApp.

Ao editar itens, o sistema devolve ao estoque o que deixou de ser usado e baixa o novo saldo. Ao excluir a OS, as movimentações automáticas são removidas e o estoque retorna ao estado anterior.

## Catálogos e estoque

- **Produto:** custo, preço, estoque inicial, mínimo, itens de OS e movimentações.
- **Insumo:** custo, estoque inicial, mínimo, itens de OS e movimentações.
- **Serviço:** preço e itens de OS, sem baixa de estoque.

Movimentos manuais podem ser criados, editados e excluídos. Movimentos automáticos ficam travados e apontam para a OS de origem. A proteção contra estoque negativo vale tanto para saídas manuais quanto para itens baixados na OS.

## Financeiro

Receitas e despesas podem ser independentes ou vinculadas a uma OS. O detalhe da OS mostra os lançamentos relacionados e permite criar, editar e excluir. A situação financeira da OS considera valores recebidos com status `Pago` ou `Parcial`.

O diagnóstico sinaliza recebimentos acima do total, mas não altera valores automaticamente.

## Termos e documentos

O módulo `Documentos` possui duas áreas:

- **Termos e autorizações:** criar, vincular a cliente/OS, editar, marcar aceite, revogar, imprimir/salvar em PDF e excluir.
- **Arquivos das OS:** consultar PDFs e anexos, abrir a OS e remover arquivos quando permitido.

As observações internas do termo não aparecem na impressão entregue ao cliente.

## Fotos, PDFs e anexos

- Fotos são compactadas e vinculadas à OS.
- PDFs podem ser históricos ou gerados pelo sistema.
- Anexos aceitam laudos, notas, configurações e outros arquivos técnicos.
- Arquivos ficam no IndexedDB e podem ser enviados ao Google Drive em pastas separadas.
- A exclusão remove o arquivo local e envia o arquivo do Drive para a lixeira, quando conectado.

## Persistência e proteção

- IndexedDB: estado, mídias e backups locais.
- Pasta local: JSON principal e backups.
- Google Drive: dados, backups, fotos, PDFs e anexos.
- `Ctrl+S`: salvamento completo.
- PIN local: trava a interface do dispositivo.
- Diagnóstico: vínculos, totais, duplicidade, estoque, pagamentos e registros órfãos.
