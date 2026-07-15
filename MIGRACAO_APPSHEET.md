# Migração do AppSheet — pacote corrigido v1.1.0

## Conteúdo final

| Base | Quantidade |
|---|---:|
| Clientes | 139 |
| Ordens de serviço | 286 |
| Itens válidos de ordens | 111 |
| Lançamentos financeiros | 292 |
| Produtos | 33 |
| Serviços | 43 |
| Insumos | 9 |
| Movimentações válidas de estoque | 13 |
| Fotos | 17 |
| PDFs históricos | 56 |

## Correções feitas na migração

- 17 nomes gravados nas OS foram sincronizados com o cadastro atual do cliente.
- O item `ITM-000099` foi removido porque não apontava para produto, serviço nem insumo e tinha valor zero.
- A movimentação `MOV-000014` foi removida porque não apontava para produto nem insumo e era derivada do item inválido.
- A estrutura passou para o esquema 2, com termos, anexos por OS e proteção contra estoque negativo.
- 10 nomes de PDFs com códigos de acentuação do AppSheet foram convertidos para nomes legíveis.
- Nenhum valor financeiro foi modificado automaticamente.

## Revisão financeira preservada

As OS abaixo possuem recebimentos pagos acima do total cadastrado:

- `OSV-000245`: recebido R$ 400,00; total R$ 390,00.
- `OSV-000266`: recebido R$ 100,00; total R$ 80,00.
- `OSV-000272`: recebido R$ 70,00; total R$ 60,00.

Esses valores podem representar acréscimo, gorjeta, serviço não incluído no total ou lançamento histórico duplicado. Por segurança, o sistema apenas mostra o alerta.

## Ordem correta de importação

1. Abra a versão 1.1.0.
2. Importe `Marco_Iris_Importacao_Privada.json`.
3. Importe a pasta raiz do pacote privado para vincular fotos, PDFs e anexos pelo código `OSV-xxxxxx`.
4. Abra `Configurações` e confira o diagnóstico.
5. Conecte o Google Drive.
6. Sincronize e faça `Salvar tudo`.

A importação do JSON substitui a base deste navegador, mas cria um backup local antes. A importação de arquivos não substitui clientes ou ordens.

## Segurança

O pacote privado contém informações reais de clientes, valores, diagnósticos técnicos e senhas de acesso de alguns equipamentos. Não publique no GitHub, site, grupo ou pasta pública.
## Validação da importação de mídias

A versão 1.1.0 foi testada com todos os 73 arquivos históricos do pacote corrigido: 56 PDFs e 17 fotos. Todos foram associados às respectivas OS, gravados com conteúdo binário não vazio no armazenamento local e sem duplicação de metadados.

