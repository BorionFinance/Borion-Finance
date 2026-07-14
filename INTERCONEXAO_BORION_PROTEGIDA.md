# Camada protegida de interconexão — Borion Interop v1.0.0

## Regra de manutenção
Esta camada não deve ser alterada, removida, reformatada ou incorporada a outros módulos sem pedido explícito de mudança na interconexão. Atualizações estéticas e funcionais comuns devem preservar integralmente os arquivos e os pontos de extensão marcados como `PROTECTED INTEGRATION BOUNDARY` ou `protected interop seam`.

## Contrato
- Amanda Estética publica `amanda-estetica.bridge.json`.
- Marco Iris publica `marco-iris.bridge.json`.
- Borion responde com os arquivos `.ack.json` correspondentes.
- O aplicativo de origem é o dono do registro operacional.
- O Borion é o dono do lançamento financeiro materializado.
- IDs permanentes e fingerprints impedem duplicidade.
- Edição, pagamento, cancelamento e exclusão são reconciliados no mesmo lançamento.
- Receitas pendentes não entram no saldo; despesas pendentes entram como “Em aberto”.
- Dinheiro usa a Carteira; demais formas usam a conta padrão configurada.

## Transporte
Funciona por pasta local compartilhada e por pasta `Borion_Integracoes` no Google Drive. Os aplicativos operacionais criam essa pasta automaticamente dentro da pasta principal já conectada.

## Requisito Google Drive
Para manter o escopo seguro `drive.file`, os três front-ends devem usar o mesmo projeto/cliente OAuth do Google Cloud e ter seus domínios do GitHub Pages cadastrados como origens autorizadas. Não ampliar para acesso ao Drive inteiro.

## Tratamento conservador do crédito
Receitas em cartão entram na conta padrão escolhida. Despesas em cartão são registradas como Crédito e não reduzem o saldo bancário imediatamente. Elas não são ligadas automaticamente a uma fatura específica porque os aplicativos de origem ainda não informam um identificador seguro de cartão/fatura; isso evita lançar no cartão errado.
