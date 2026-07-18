# RELATÓRIO DE IMPLEMENTAÇÃO — BORION FINANCE v6.35.0

## Importação inteligente de extratos por print

**Arquivo-base trabalhado:** `Borion_Finance_v6.34.5_LAYOUT_MOBILE_ANDROID_FIX`

**Versão resultante:** `6.35.0`

**Pacote:** `Borion_Finance_v6.35.0_IMPORTACAO_INTELIGENTE_PRINTS.zip`

## 1. Resultado geral

A versão recebeu uma nova origem de importação dentro da tela existente **Importar Extrato**, sem duplicar o item no menu. O importador anterior de CSV, OFX, TXT e PDF textual foi mantido, e o modo novo foi separado por um seletor segmentado:

- Arquivo bancário;
- Prints do extrato.

O fluxo por imagem foi integrado ao estado atual, às Contas, às Reservas, às Transferências, ao mecanismo oficial de efeitos financeiros e ao rollback atômico do Borion. Não foi criada uma segunda contabilidade ou um saldo paralelo.

A camada de interpretação reconhece a estrutura descrita para o Mercado Pago, diferencia Receita, Despesa e movimentações internas de cofres, permite revisão antes da gravação e cria chaves de importação para deduplicação.

## 2. Arquivos alterados

### `index.html`

- referências dos recursos atualizadas para `?v=6.35.0`;
- inclusão de `js/16a-import-statement-images.js?v=6.35.0` imediatamente após o importador legado;
- ordem dos demais módulos preservada.

### `manifest.json`

- versão atualizada para `6.35.0`.

### `sw.js`

- novo cache principal: `borion-finance-v6-35-0-importacao-inteligente-prints`;
- inclusão do novo módulo de imagens;
- atualização das referências dos assets para `6.35.0`;
- cache de runtime separado para arquivos locais do OCR: `borion-ocr-runtime-v1`;
- remoção dos caches antigos do aplicativo, preservando o cache de runtime do OCR.

### `js/01-storage-data-state.js`

- inclusão retrocompatível de:
  - `importPreferences.reserveMappings`;
  - `importPreferences.merchantRules`;
  - `importBatches`;
- migração defensiva sem alteração de saldos;
- histórico limitado aos 100 lotes mais recentes.

### `js/02-backup-local.js`

- versão interna atualizada para `6.35.0`.

### `js/03-modals-shared.js`

- identificação da versão atualizada, mantendo a correção central de rolagem.

### `js/04-gate-shell.js`

- mantido exatamente um item `Importar Extrato` no menu;
- limpeza defensiva dos arquivos temporários ao trocar ou sair do perfil.

### `js/13-settings.js`

- versão e descrição de lançamento atualizadas para `6.35.0`;
- módulo opcional `imports` mantido.

### `js/14-events-boot-pwa.js`

- registro do service worker atualizado para `sw.js?v=6.35.0`.

### `js/16-import-statement.js`

- criação da fábrica `createEmptyImportState()`;
- expansão retrocompatível de `ensureImportState()`;
- inclusão do estado `mode: 'file' | 'image'`;
- renderização do seletor de origem;
- preservação do importador legado;
- encaminhamento do commit de imagens para o novo módulo;
- limpeza centralizada do importador.

### `js/17-borion-cloud.js`

- cancelamento e descarte dos arquivos temporários ao trocar de sessão/perfil.

### `css/styles.css`

- novos estilos de seleção de origem, área de imagens, miniaturas, progresso, confiança, pendências, mapeamento de Reservas, tabela desktop e cards mobile;
- cards responsivos abaixo de 760 px;
- preservação de um único scroll vertical no mobile;
- uso das variáveis visuais existentes e compatibilidade com tema claro/escuro.

## 3. Arquivos criados

### `js/16a-import-statement-images.js`

Módulo responsável por:

- carregamento sob demanda do leitor OCR;
- seleção múltipla, arrastar, colar, reordenar, remover e limpar imagens;
- validação de formato, tamanho e quantidade;
- URLs temporárias com revogação;
- fingerprint SHA-256;
- pré-processamento em Canvas com escala limitada;
- segunda leitura aprimorada somente quando necessária;
- normalização de palavras, caixas e linhas;
- detecção do Mercado Pago por pontuação;
- parser específico por âncora monetária e proximidade vertical;
- parser genérico de contingência;
- resolução local de Hoje, Ontem, datas por extenso e datas numéricas;
- classificação financeira;
- associação de cofres às Reservas;
- confiança e pendências;
- deduplicação no lote e no perfil;
- revisão desktop/mobile;
- regras de classificação por descrição;
- commit financeiro atômico;
- histórico do lote;
- metadados de origem sem salvar a imagem.

### `tests/test_importacao_prints_core.js`

Teste automatizado do cenário Mercado Pago descrito, incluindo:

- sete movimentações;
- Receita e Despesa corretas;
- efeitos em Conta e Reservas;
- reimportação sem duplicidade;
- rollback forçado.

### `tests/test_importador_legado.js`

Teste de regressão básica para CSV, OFX e TXT.

### `tests/README.md`

Instruções de execução dos testes.

### `vendor/tesseract/`

Estrutura local prevista para o mecanismo OCR fixado e modelo português:

- `README.txt`;
- `VERSION.txt`;
- `lang-data/por.traineddata.gz`.

## 4. Biblioteca e carregamento OCR

A arquitetura foi fixada para **Tesseract.js 5.1.1**, carregado somente ao entrar no fluxo de prints. O carregador também usa `TextDetector` nativo quando o navegador oferece essa API e aceita um adaptador local por `window.BorionStatementOcrAdapter`.

O worker é reutilizado durante a sessão e não é recriado para cada imagem. O processamento ocorre sequencialmente, com progresso, cancelamento e liberação de Canvas/bitmap.

### Limitação real do pacote

O ambiente de execução usado nesta implementação não possui acesso à internet e não continha os quatro arquivos oficiais de frontend do Tesseract.js 5.1.1:

- `tesseract.min.js`;
- `worker.min.js`;
- `tesseract-core.wasm.js`;
- `tesseract-core.wasm`.

O modelo português `por.traineddata.gz` foi incluído, mas esses quatro arquivos ainda precisam ser colocados em `vendor/tesseract/` para garantir OCR no navegador quando `TextDetector` não estiver disponível. Portanto, **não é correto considerar o OCR aprovado em todos os navegadores neste estado**. O carregador exibe uma mensagem específica em vez de simular resultado.

Nenhum CDN foi adicionado e nenhuma imagem é enviada externamente.

## 5. Parser específico do Mercado Pago

A detecção usa pontuação combinando termos como:

- Mercado Pago;
- Extrato;
- Movimento;
- Disponível;
- Dinheiro reservado;
- Dinheiro retirado;
- Pix recebido.

A reconstrução usa o valor monetário como âncora e relaciona horário, descrição, subtítulo, código e cabeçalho de data por posição vertical relativa. Não há coordenadas fixas do print de teste.

Classificações estruturais implementadas:

- Pagamento/Compra → Despesa variável paga;
- Pix recebido → Receita, com aviso para revisar a origem;
- Pix enviado → Despesa por padrão, alterável para transferência;
- Dinheiro reservado → Conta → Reserva;
- Dinheiro retirado → Reserva → Conta;
- Rendimento associado a cofre → Rendimento de Reserva;
- Estorno/devolução → Receita de reembolso;
- operação desconhecida → pendência bloqueante e desmarcada.

As regras estruturais de cofres têm prioridade sobre regras aprendidas de estabelecimento.

## 6. Duplicidade

A chave de importação usa, quando disponível:

`banco de origem + Conta + data + sufixo externo + valor em centavos + direção`

Sem código externo, usa:

`banco de origem + Conta + data + hora + valor + direção + nome + operação`

A busca considera:

- transações;
- despesas fixas;
- transferências;
- movimentos de Reservas;
- lote atual.

Movimentos vinculados criados pela transferência não são tratados como uma segunda importação independente. Em prints sobrepostos, a linha com maior confiança permanece selecionada.

## 7. Privacidade

O novo módulo não contém chamadas de envio de Blob/imagem, nem gravação em `localStorage`, IndexedDB, Google Drive ou `S.data`.

Durante a sessão são mantidos apenas:

- referência `File` temporária;
- URL temporária;
- fingerprint;
- texto OCR temporário;
- linhas provisórias.

Na gravação, ficam somente metadados da movimentação aprovada. Blob, base64, pixels e imagem integral não entram no perfil ou backup.

Ao limpar, remover, concluir, sair ou trocar de perfil:

- URLs são revogadas;
- arquivos são descartados;
- OCR em andamento é cancelado;
- o estado temporário é reiniciado.

## 8. Lógica financeira e rollback

O commit usa as funções oficiais existentes:

- `runAtomicFinancialMutation()`;
- `applyTxSaldoEffect()`;
- `Cards.applyTransferenciaEffect()`.

Receitas e despesas são gravadas em `S.data.transacoes`. Movimentações internas são gravadas em `S.data.transferencias`.

As operações são validadas antes do commit, ordenadas cronologicamente e gravadas em uma única mutação. Uma falha em qualquer linha restaura:

- transações;
- transferências;
- Reservas criadas;
- saldos;
- histórico de lote.

Não há `saveCurrentData()` por linha.

## 9. Testes automatizados executados

### Sintaxe

`node --check` executado em todos os arquivos JavaScript e no service worker: **aprovado**.

### Importador anterior

- CSV: aprovado;
- OFX: aprovado;
- TXT: aprovado;
- PDF textual: código preservado, mas não foi executado em navegador nesta máquina.

### Cenário Mercado Pago com sete linhas

Entrada textual sintética equivalente às sete linhas esperadas:

- 7 linhas reconhecidas;
- Receita: R$ 150,00;
- Despesa: R$ 117,90;
- resultado Receita menos Despesa: R$ 32,10;
- efeito líquido das transferências na Conta: R$ 0,00;
- variação final da Conta: R$ 32,10;
- Parcela YAS-62: +R$ 3,36;
- Pessoal: +R$ 196,73;
- Borion 1: -R$ 100,05;
- Borion 2: -R$ 100,04.

### Reimportação

- 7 linhas identificadas como já importadas;
- 0 linhas selecionadas;
- 0 alteração financeira.

### Rollback

Uma falha foi forçada na última linha:

- nenhuma transação permaneceu;
- nenhuma transferência permaneceu;
- nenhum lote permaneceu;
- saldos da Conta e das Reservas foram restaurados.

### OCR sintético

Uma imagem sintética foi processada pelo executável Tesseract disponível no ambiente para validar a tolerância do parser. O parser encontrou as sete linhas e o saldo esperado, porém alguns sufixos alfanuméricos sofreram confusões normais de OCR, reforçando a necessidade da etapa de revisão.

## 10. Testes que não puderam ser executados aqui

- leitura do print real de referência, porque a imagem não foi incluída nos arquivos recebidos;
- teste manual em aparelho Android físico;
- teste manual nas cinco larguras solicitadas dentro de um navegador interativo;
- teste completo de tema claro/escuro por inspeção visual;
- instalação e atualização real do PWA em dispositivo;
- OCR Tesseract.js dentro do navegador sem os quatro assets oficiais ausentes;
- sincronização real com Google Drive após um lote, pois exige a conta/autorização do usuário.

Esses itens permanecem marcados como pendentes no arquivo de validação, sem serem apresentados como aprovados.

## 11. Conclusão técnica

A arquitetura, parser, revisão, classificação, mapeamento, duplicidade, efeitos financeiros e rollback foram implementados e passaram nos testes automatizados disponíveis. O pacote ainda não deve ser considerado totalmente aprovado para produção em todos os navegadores até que os quatro arquivos oficiais do Tesseract.js 5.1.1 sejam adicionados e o print real seja validado em navegador e Android.
