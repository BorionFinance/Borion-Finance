# RELATÓRIO DE CORREÇÃO DE SCROLL — BORION FINANCE v6.34.4

**Data:** 17/07/2026  
**Objetivo:** corrigir a ausência de rolagem vertical na tela principal do Smartphone Mode, mantendo a rolagem própria do menu, modais e painéis.

## 1. Resultado da investigação

A versão 6.34.3 corrigia classes órfãs de modais e menu, mas ainda mantinha o documento como proprietário da rolagem principal.

A falha foi reproduzida em Chromium com viewport mobile de 390 × 844 px:

- `document.scrollingElement.scrollHeight`: 8.578 px;
- `document.scrollingElement.clientHeight`: 757 px;
- havia altura suficiente para rolar;
- roda do mouse e gesto touch não alteravam `scrollTop`;
- o menu lateral continuava rolando porque `.sb-nav` já possuía seu próprio `overflow-y:auto`.

### Causa raiz confirmada

No Smartphone Mode, `html` e `body` viravam contêineres de rolagem concorrentes.

A regra antiga `body { overflow-x:hidden; }`, combinada com a tentativa posterior de usar `overflow-y:visible`, fazia o valor computado de `overflow-y` do `body` virar `auto`. Isso acontece pelas regras de computação dos eixos de `overflow`.

O resultado era:

- `html` com altura rolável;
- `body` também tratado como contêiner de overflow;
- o gesto entregue ao `body`, que não possuía uma área rolável independente;
- a cadeia de scroll não chegava de forma confiável ao documento em Chrome/WebView/PWA;
- menu funcionando por ter um scroller interno separado.

Essa causa corresponde exatamente ao comportamento informado: a gaveta do menu rola, mas Lançamentos, Reservas/Rendimentos e demais telas principais não.

## 2. Correção implementada

### 2.1. Um único proprietário da rolagem mobile

No Smartphone Mode:

- `html`, `body`, `#root` e `.shell` passam apenas a delimitar o viewport;
- todos ficam com `overflow:hidden`;
- `#view-root.main` passa a ser o único contêiner rolável da tela principal;
- `#view-root.main` usa:
  - `overflow-y:auto`;
  - `touch-action:pan-y`;
  - `-webkit-overflow-scrolling:touch`;
  - altura baseada em `--borion-vh`;
  - `overscroll-behavior-y:auto`.

Isso remove a concorrência entre `html` e `body`.

### 2.2. Bloqueio correto das camadas

A área `#view-root` é bloqueada somente quando existe uma camada real aberta:

- modal;
- menu lateral;
- painel de notificações.

O `body` não é mais colocado em `position:fixed` no Smartphone Mode para bloquear modais.

### 2.3. Preservação da posição

A rotina de posição de scroll agora usa `borionPrimaryScrollElement()`:

- Smartphone Mode: `#view-root`;
- Modo Pro ou telas sem aplicação aberta: `document.scrollingElement`.

Ao fechar um modal, a posição do `#view-root` é restaurada.

### 2.4. Notificações órfãs

A classe `notif-panel-open` agora é reconciliada com a existência real de `#notif-panel`.

Também foram adicionadas limpezas ao:

- abrir/fechar notificações;
- reconstruir a aplicação;
- sincronizar o estado global.

### 2.5. Menu durante animação de saída

A sidebar fechada recebe `pointer-events:none` imediatamente. Assim, ela não captura roda ou touch durante os milissegundos da animação de fechamento.

### 2.6. Cache/PWA

- versão dos assets: `?v=6.34.4`;
- cache: `borion-finance-v6-34-4-single-main-scroll-container`;
- versão do manifest: `6.34.4`;
- Service Worker registrado como `sw.js?v=6.34.4`;
- `updateViaCache:'none'`;
- `skipWaiting()` e `clients.claim()` mantidos;
- caches anteriores são excluídos na ativação.

## 3. Arquivos alterados

- `css/styles.css`
- `index.html`
- `manifest.json`
- `sw.js`
- `js/02-backup-local.js`
- `js/03-modals-shared.js`
- `js/04-gate-shell.js`
- `js/11-agenda-notifications.js`
- `js/13-settings.js`
- `js/14-events-boot-pwa.js`

## 4. Testes executados

### 4.1. Teste sintético de página longa

Viewport: 390 × 844 px.

Estado:

- `#view-root.scrollHeight`: 8.578 px;
- `#view-root.clientHeight`: 757 px;
- `overflow-y`: `auto`;
- `touch-action`: `pan-y`;
- `html/body`: `overflow:hidden`.

Resultados:

- roda do mouse: `#view-root.scrollTop` de 0 para 600 px — **PASS**;
- gesto touch vertical: `#view-root.scrollTop` de 600 para aproximadamente 1.400 px — **PASS**.

### 4.2. Tela real de Lançamentos

Foram criados 80 lançamentos de teste e aberta a aba Central:

- título confirmado: `Lançamentos`;
- 30 linhas renderizadas na primeira página;
- `scrollHeight`: 6.257 px;
- `clientHeight`: 757 px;
- roda do mouse: `scrollTop` de 0 para 700 px — **PASS**.

### 4.3. Tela real de Reservas/Rendimentos

Foram criadas 30 reservas de teste:

- título confirmado: `Reserva`;
- 30 cards renderizados;
- `scrollHeight`: 6.223 px;
- `clientHeight`: 757 px;
- roda do mouse: `scrollTop` de 0 para 650 px — **PASS**.

### 4.4. Modal

- antes de abrir: posição 500 px;
- modal aberto: `#view-root` com `overflow-y:hidden`;
- roda não alterou a posição — **PASS**;
- fechamento: posição restaurada em 500 px;
- roda após fechar: posição passou para 750 px — **PASS**.

### 4.5. Menu lateral

- menu aberto: área principal bloqueada — **PASS**;
- menu fechado: área principal voltou a `overflow-y:auto` — **PASS**;
- roda após fechar: posição passou de 750 para 1.000 px — **PASS**.

### 4.6. Notificação órfã

- painel aberto: área principal bloqueada — **PASS**;
- painel removido diretamente do DOM e reconciliação executada;
- `notif-panel-open` removida;
- área principal voltou a `overflow-y:auto`;
- roda voltou a mover a tela — **PASS**.

### 4.7. Repetição

30 ciclos consecutivos de:

1. abrir modal;
2. fechar modal;
3. abrir menu;
4. fechar menu;
5. reconciliar estado.

Resultado:

- zero ciclos com falha;
- nenhuma classe órfã;
- nenhum overlay aberto;
- `#view-root` final com `overflow-y:auto` — **PASS**.

### 4.8. Sintaxe

Todos os arquivos JavaScript e o Service Worker foram verificados com `node --check` — **PASS**.

## 5. Limitação do ambiente de teste

Os testes de roda e touch foram executados em Chromium real, por automação do protocolo do navegador, com viewport mobile. Não houve acesso a um aparelho Android físico ou PWA instalado físico neste ambiente.

A correção, porém, foi validada no mesmo mecanismo Chromium/WebView usado pelo Chrome Android e baseada na reprodução direta do problema anterior.

## 6. Publicação

Publicar todos os arquivos do ZIP, sem misturar com a versão anterior.

Após publicar:

1. confirmar em Configurações a versão **6.34.4**;
2. fechar completamente o PWA e abrir novamente;
3. caso ainda apareça 6.34.3, limpar os dados/cache do site uma única vez e reabrir;
4. testar Lançamentos e Reservas iniciando o gesto sobre cards, textos e espaços vazios.
