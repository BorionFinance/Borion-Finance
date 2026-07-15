# Camada de integração — Borion Smart Import v2.0.0

## Contrato

- Amanda Estética publica `amanda-estetica.bridge.json`.
- Marco Iris Tecnologia publica `marco-iris.bridge.json`.
- O Borion responde com os arquivos `.ack.json` correspondentes.
- O aplicativo externo é a origem operacional do registro.
- Depois da primeira conversão, o Borion é o dono do lançamento financeiro materializado.
- A comunicação continua somente de entrada; edições locais não são enviadas de volta.

## Vínculos

Cada origem mantém regras próprias para:

- tipo de lançamento;
- categoria;
- origem da receita;
- forma de pagamento;
- conta ou Carteira;
- status.

As regras são salvas dentro do perfil de destino e aplicadas apenas na primeira importação de cada identificador externo.

## Antiduplicidade

`integrationSourceAppId` e `integrationAggregateId` formam a referência permanente. Nome, valor, categoria, data, conta ou status podem ser editados sem liberar uma nova importação.

## Exclusões

A lista interna de ignorados é separada do histórico de importados. O usuário controla explicitamente se um ID excluído pode voltar ou deve permanecer bloqueado.

## Transporte

Funciona por pasta local compartilhada e por pasta `Borion_Integracoes` no Google Drive.
