# Auditoria completa do sistema Marco Iris — v1.1.0

**Data:** 13/07/2026  
**Escopo:** uso simulado integral, vínculos, exclusões, consistência da migração, estoque, financeiro, documentos, nuvem e acabamento visual.

## 1. Resultado executivo

O sistema deixou de ser apenas um conjunto de telas com cadastros e passou a operar como uma estrutura conectada. A OS agora é o centro real: cliente, agenda, itens, estoque, financeiro, termos, fotos, PDFs, anexos e WhatsApp conversam entre si. Ações destrutivas receberam bloqueios, confirmação, backup e tratamento dos vínculos.

A base migrada foi auditada separadamente. Um item e uma movimentação estruturalmente inválidos foram retirados; 17 nomes históricos de clientes foram sincronizados. Nenhum valor financeiro foi alterado.

## 2. Defeitos encontrados e corrigidos

### Documentos e consentimentos

**Antes:** não existia um ciclo completo de termos no sistema do Marco.  
**Agora:** módulo `Documentos`, criação, edição, vínculo com cliente e OS, aceite, revogação, impressão, consulta e exclusão com backup.

### Exclusões sem tratamento

**Antes:** várias áreas permitiam criar ou gerar, mas não tinham uma saída segura para excluir ou desfazer.  
**Agora:** exclusão de termos, agenda, pagamentos, PDFs, fotos, anexos, movimentações manuais, clientes sem dependência, catálogos sem uso e OS com cascata completa.

### Agenda isolada da OS

**Antes:** a conversão apenas preenchia uma nova OS.  
**Agora:** agendamento e OS guardam o vínculo entre si; o agendamento é concluído e, se a OS for apagada, o agendamento continua sem referência quebrada.

### Estoque

**Antes:** faltavam edição/exclusão de movimentos manuais, proteção completa contra saldo negativo e limpeza de todo o histórico automático ao apagar uma OS.  
**Agora:** movimentos manuais são gerenciáveis; movimentos automáticos só mudam pela OS; edição devolve e baixa corretamente; exclusão da OS restaura o saldo; tanto saída manual quanto automática respeitam o bloqueio de estoque negativo.

### Catálogos e clientes

**Antes:** exclusão poderia comprometer históricos ou não estava disponível.  
**Agora:** arquivar/restaurar é a opção normal; exclusão definitiva só ocorre quando não existem referências.

### Arquivos técnicos

**Antes:** fotos e PDFs existiam, mas anexos genéricos não tinham fluxo completo.  
**Agora:** PDFs, fotos, laudos, notas, configurações e outros arquivos podem ser vinculados à OS, consultados e removidos; o Drive usa a pasta `Anexos`.

### Diagnóstico

**Antes:** o usuário precisava descobrir os vínculos quebrados manualmente.  
**Agora:** Configurações mostra OS sem cliente, itens órfãos, catálogo ausente, pagamentos órfãos, termos inválidos, movimentos sem item, movimentos automáticos órfãos, estoque negativo, recebimentos acima do total, totais divergentes e IDs duplicados.

## 3. Correções na base AppSheet

- 139 clientes preservados.
- 286 OS preservadas.
- 17 nomes de clientes nas OS sincronizados.
- `ITM-000099` removido: item sem referência e sem valor.
- `MOV-000014` removido: saída sem produto/insumo ligada ao item inválido.
- Resultado: 111 itens válidos e 13 movimentações válidas.
- 10 nomes de PDFs com códigos de acentuação do AppSheet foram convertidos para nomes legíveis.
- 292 pagamentos preservados sem alteração.

### Alertas financeiros mantidos

- OSV-000245: R$ 10,00 acima do total.
- OSV-000266: R$ 20,00 acima do total.
- OSV-000272: R$ 10,00 acima do total.

Não houve correção automática porque os valores podem ter justificativa operacional.

## 4. Regras de exclusão implementadas

| Registro | Comportamento |
|---|---|
| Cliente | Exclui apenas sem OS, agenda ou termo; caso contrário, orienta arquivar. |
| OS | Backup, duas confirmações, remoção de itens/pagamentos/termos/arquivos, reversão do estoque e desligamento da agenda. |
| Produto/serviço/insumo | Exclui somente sem uso; com histórico, deve ser arquivado. |
| Movimento manual | Pode editar ou excluir; saldo é recalculado. |
| Movimento automático | Bloqueado; alteração acontece pela OS. |
| Termo | Exclui com backup. |
| Agendamento | Exclui com backup e limpa o vínculo da OS, se houver. |
| PDF/foto/anexo | Remove do navegador e move o arquivo do Drive para a lixeira quando conectado. |
| Pagamento | Exclui com backup e atualiza a situação financeira da OS. |

## 5. Melhorias visuais e de uso

- Acabamento Fluent inspirado no Windows 11.
- Superfícies translúcidas, sombras suaves e fundo em camadas.
- Animações curtas de entrada, hover e clique.
- Modais com desfoque e barra de ações fixa.
- Foco visível para teclado e acessibilidade.
- Rolagem e responsividade refinadas.
- Indicadores, badges, listas e arquivos com hierarquia mais clara.
- Respeito à preferência `reduzir movimento` do sistema operacional.

## 6. Testes executados

- Todos os nove módulos abertos com a base real.
- CRUD e exclusões principais executados em navegador.
- Arquivar/restaurar cliente, OS e produto.
- Agenda → OS → exclusão da OS → agenda preservada.
- Termo criado, editado e excluído.
- Movimento manual criado, editado e excluído.
- Estoque automático testado com troca de produto e exclusão da OS.
- Bloqueio de estoque negativo testado.
- PDF real gerado e validado.
- URL do WhatsApp validada com telefone e mensagem exata.
- Importação binária validada com os 56 PDFs e as 17 fotos reais: 73 arquivos vinculados, armazenados localmente com conteúdo não vazio e sem duplicar metadados.
- Sem erros inesperados de JavaScript nos fluxos testados.

## 7. Limite da auditoria local

A parte do Google Drive está implementada, mas OAuth, Picker e upload real só podem ser validados no endereço final do GitHub Pages, com as credenciais e a origem autorizada do projeto Google Cloud do Marco. Esse é o único teste externo ainda obrigatório após a publicação.
