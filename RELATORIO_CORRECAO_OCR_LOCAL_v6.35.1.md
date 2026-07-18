# Correção do OCR local — Borion Finance v6.35.0 → v6.35.1

## Resumo

O pacote v6.35.0 tinha a arquitetura de importação por print pronta
(`js/16a-import-statement-images.js`), mas faltavam os quatro arquivos
oficiais do Tesseract.js dentro de `vendor/tesseract/`. Sem eles, o OCR
local só funcionava em navegadores com `TextDetector` nativo (Chrome/Edge
recentes) — em qualquer outro navegador, a importação por print falhava.

Esta correção baixou os arquivos oficiais e versionados do Tesseract.js
diretamente do registro npm, validou sua integridade, instalou-os em
`vendor/tesseract/`, testou o motor de OCR de ponta a ponta contra o
parser de produção, e publicou a versão **6.35.1**.

Nenhuma arquitetura financeira foi alterada. Nenhum novo importador foi
criado. O módulo `js/16a-import-statement-images.js` foi mantido — apenas
o comentário de cabeçalho foi atualizado.

## O que foi feito

### 1. Download dos arquivos oficiais

```
npm pack tesseract.js@5.1.1
npm pack tesseract.js-core@5.1.1
```

Endereços oficiais usados (registro npm):

- `https://registry.npmjs.org/tesseract.js/-/tesseract.js-5.1.1.tgz`
  (shasum oficial do npm: `7bfaca1c103ba0ce3ddf5e101f0692802a01f880`)
- `https://registry.npmjs.org/tesseract.js-core/-/tesseract.js-core-5.1.1.tgz`
  (shasum oficial do npm: `2b6f3ef28dd109bf4efdbc8fff70bd11adac8b85`)

**Versão do `tesseract.js-core` usada:** 5.1.1. O `package.json` oficial
de `tesseract.js@5.1.1` declara `"tesseract.js-core": "^5.1.1"` como
dependência; 5.1.1 é a versão mais recente dentro dessa faixa disponível
no npm, então foi essa a instalada — não uma versão aleatória.

Nenhum `@latest` foi usado em nenhum passo.

### 2. Arquivos instalados em `vendor/tesseract/`

| Arquivo | Origem no pacote oficial | Tamanho |
|---|---|---|
| `tesseract.min.js` | `dist/tesseract.min.js` (tesseract.js@5.1.1) | 66.695 bytes |
| `worker.min.js` | `dist/worker.min.js` (tesseract.js@5.1.1) | 123.724 bytes |
| `tesseract-core.wasm.js` | raiz do pacote (tesseract.js-core@5.1.1) | 4.734.777 bytes |
| `tesseract-core.wasm` | raiz do pacote (tesseract.js-core@5.1.1) | 3.457.035 bytes |

O `por.traineddata.gz` já existente **não foi tocado** — apenas revalidado
(`gzip -t`, sem erro).

### 3. Validações de integridade

- Nenhum dos quatro arquivos é HTML de erro/404/login — confirmado por
  inspeção binária dos primeiros bytes.
- `node --check` passou sem erro nos três arquivos JavaScript.
- `tesseract-core.wasm` tem assinatura WebAssembly válida (`00 61 73 6d`).
- Hashes SHA-256 de todos os cinco arquivos calculados e registrados em
  `MANIFESTO_SHA256_OCR_v6.35.1.txt`.

### 4. Teste real do motor OCR (não simulado)

Como este ambiente de execução não tem navegador gráfico, o teste do
motor foi feito executando o **próprio pacote oficial tesseract.js@5.1.1
via Node.js**, mas apontando explicitamente para os mesmos arquivos
`tesseract-core.wasm.js` / `tesseract-core.wasm` que foram copiados para
`vendor/tesseract/` do projeto — ou seja, os bytes exatos que o navegador
vai carregar.

Uma imagem PNG sintética foi gerada com o texto do cenário de referência
(as sete movimentações do enunciado). O motor leu a imagem e devolveu
texto real, com 93% de confiança média, reconhecendo corretamente todos
os valores monetários, sinais (+/-), horários e a maior parte dos
sufixos de movimento (pequenas trocas 0↔O típicas de reconhecimento de
caractere, que não afetaram o resultado final do parser).

Esse texto/palavras reconhecidos foram então passados, sem edição manual,
pelo pipeline de produção real (`normalizeOcrResult` → `parseImageStatement`
→ `parseMercadoPagoImage` → `commitImageStatementImport`), e o resultado
financeiro bateu exatamente com o esperado:

```
Receitas:                          R$ 150,00
Despesas:                          R$ 117,90
Receita - Despesa:                 R$ 32,10
Variação líquida final da Conta:   R$ 32,10
Reservas: Parcela YAS-62 = 3,36 | Pessoal = 196,73 |
          Borion 1 = 0,00 | Borion 2 = 0,00
Transferências geradas: 5
```

Detalhes completos em `VALIDACAO_TECNICA_OCR_LOCAL_v6.35.1.txt`.

**Limitação declarada:** não havia um print real do Mercado Pago
disponível junto ao projeto para este teste — foi usada uma imagem
sintética com o mesmo texto do cenário de referência. Isso confirma que o
motor de OCR real funciona e que o pipeline completo (OCR → parser →
commit) produz o resultado financeiro correto, mas não substitui um teste
com um print real do aplicativo.

### 5. Testes de regressão

```
node tests/test_importacao_prints_core.js   → OK (parser, commit, rollback)
node tests/test_importador_legado.js        → OK (CSV, OFX, TXT)
node --check em todos os arquivos js/*.js   → sem erros
node --check sw.js                          → sem erro
```

Executados antes e depois da correção, com resultado idêntico — nada foi
quebrado.

### 6. Versão e cache

Atualizado de 6.35.0 para **6.35.1** em: `index.html` (32 query strings),
`manifest.json`, `sw.js` (`CACHE_NAME` e query strings),
`js/02-backup-local.js` (`BORION_APP_VERSION`), `js/13-settings.js`
(tag de versão, rodapé, `SETTINGS_VERSION`), e
`js/14-events-boot-pwa.js` (registro do service worker).

`OCR_RUNTIME_CACHE` alterado de `borion-ocr-runtime-v1` para
`borion-ocr-runtime-v2`. A lógica já existente de `activate` no
`sw.js` apaga automaticamente qualquer cache fora da lista
`[CACHE_NAME, OCR_RUNTIME_CACHE]` — isso já cobre a limpeza do cache
principal antigo e do runtime v1, sem precisar de código adicional.

Comentários de código que documentam quando uma funcionalidade
específica foi adicionada no passado (ex.: "V6.35.0 — controle central
e defensivo da rolagem global" em `03-modals-shared.js`) foram mantidos
como estão — são anotações históricas, não a versão atual do app.

### 7. Privacidade

Auditoria por `fetch(`, `XMLHttpRequest`, `axios`, `base64`, `FileReader`,
`localStorage`, `indexedDB`, `drive`, `upload` dentro do módulo de
importação por imagem: nenhuma ocorrência. O único `fetch` envolvido é o
que o próprio navegador faz para buscar os arquivos locais do
`vendor/tesseract/`, o que é esperado e permitido.

## O que **não** foi alterado

Parser do Mercado Pago, importador CSV/OFX/TXT/PDF textual, revisão de
movimentações, deduplicação, commit atômico, rollback, Contas, Reservas,
transferências, Google Drive, armazenamento local, perfis, layout mobile,
scroll Android, PWA, temas claro/escuro — nada disso foi tocado.

## Limitações honestas

- Sem navegador gráfico real neste ambiente: os testes de UI (clique em
  "Cancelar leitura", scroll mobile em 320–480px, ciclo offline completo
  com modo avião) não foram executados interativamente. A lógica de
  código para esses três pontos foi revisada linha a linha e está
  correta e inalterada da base v6.35.0, mas isso não substitui um teste
  visual real no navegador.
- Nenhum print real do Mercado Pago foi testado — apenas uma imagem
  sintética com o mesmo texto do cenário de referência.
- Recomenda-se que Pedro confirme visualmente ao publicar em
  `borionfinance.github.io`: abrir `Importar Extrato → Prints do
  extrato`, processar um print real, e (se possível) testar o modo
  offline depois do primeiro carregamento.

Ver `VALIDACAO_TECNICA_OCR_LOCAL_v6.35.1.txt` para o checklist completo,
item a item.
