# RELATÓRIO DE CORREÇÃO DE SCROLL — BORION FINANCE v6.34.3

**Data da revisão:** 17/07/2026  
**Pacote de origem:** `Borion_Finance_v6.34.2_Scroll_Estabilidade_Mobile`  
**Pacote de entrega:** `Borion_Finance_v6.34.3_SCROLL_TOUCH_WHEEL_FIX.zip`  
**Escopo:** correção do bloqueio de rolagem no Modo Smartphone, sem alteração das regras financeiras, dados, cálculos ou sincronização.

---

## 1. Resultado

Foi implantado um controle central e defensivo para que o estado de bloqueio da rolagem seja sempre derivado do DOM real.

A página permanece desbloqueada quando não existe modal ou menu realmente aberto. Ao abrir um modal, somente o fundo é bloqueado e o conteúdo interno continua rolável. Ao fechar, o bloqueio é removido e a posição anterior da página é restaurada. O menu lateral segue o mesmo princípio.

Também foi corrigido um bloqueio independente encontrado nos cards do organizador de Reservas: o card inteiro utilizava `touch-action: none`, impedindo a rolagem vertical iniciada sobre ele. Agora o card usa `touch-action: pan-y`, e somente a alça dedicada captura o gesto de arraste.

---

## 2. Causas raiz encontradas

### 2.1. Classe `modal-open` podia ficar órfã

O sistema adicionava `modal-open` ao elemento `<html>` quando um modal era aberto, mas alguns caminhos removiam o conteúdo de `#modal-root` diretamente, sem executar a rotina oficial de fechamento.

Consequência:

- o modal desaparecia visualmente;
- `#modal-root` ficava vazio;
- `html.modal-open` podia continuar ativo;
- o usuário continuava clicando nos botões;
- touch, roda do mouse e touchpad permaneciam bloqueados.

### 2.2. Classe `mobile-menu-open` podia sobreviver a um re-render

A sidebar e o backdrop podiam ser substituídos durante uma renderização estrutural, enquanto `body.mobile-menu-open` permanecia no documento.

Consequência:

- `overflow: hidden` e `touch-action: none` continuavam aplicados ao `body`;
- o menu já não estava visível;
- a rolagem continuava travada.

### 2.3. Backdrop invisível podia continuar interceptando eventos

Foi encontrado o risco de `.mobile-menu-backdrop.show` sobreviver sem uma `.sidebar.open` correspondente.

Consequência:

- o backdrop podia permanecer transparente ou visualmente incoerente;
- `pointer-events: auto` continuava ativo;
- wheel, touch e cliques eram capturados pela camada órfã.

### 2.4. `touch-action: none` aplicado ao card inteiro de Reservas

O seletor `.reserva-slot` possuía `touch-action: none`.

Consequência:

- qualquer gesto iniciado sobre o card era reservado ao componente;
- o navegador não iniciava o pan vertical nativo;
- mesmo com a lógica JavaScript de arraste restrita, o CSS ainda bloqueava a rolagem.

### 2.5. Listeners temporários de arraste não possuíam todas as rotas de limpeza

Os organizadores de ordem e módulos removiam listeners em `pointerup` e `pointercancel`, mas não cobriam integralmente:

- `lostpointercapture`;
- `window.blur`;
- aba ficando oculta;
- componente removido por re-render durante o gesto.

Consequência possível:

- estado visual de arraste preso;
- listeners temporários sobrevivendo além do gesto;
- degradação após repetidas operações.

### 2.6. Cache precisava de uma versão nova e coerente

O pacote de origem já utilizava a versão 6.34.2. Manter o mesmo identificador permitiria que o navegador ou o PWA reutilizasse arquivos antigos.

Além disso, parte da lista de pré-cache do Service Worker apontava para arquivos sem o mesmo parâmetro de versão utilizado pelo `index.html`.

Consequência possível:

- HTML novo combinado com CSS ou JavaScript antigo;
- correção aparentemente publicada, mas não carregada;
- comportamento diferente entre navegador e PWA instalado.

---

## 3. Correções implementadas

### 3.1. Controle central do estado de rolagem

Foi criada e disponibilizada globalmente a rotina:

```javascript
syncGlobalScrollLockState()
```

Ela verifica:

- se existe `.modal-overlay` real dentro de `#modal-root`;
- se existem simultaneamente `.sidebar.open` e `.mobile-menu-backdrop.show`;
- se os elementos ainda estão conectados ao DOM;
- se o modo atual é Smartphone ou Pro;
- se o `body` deve ou não permanecer congelado.

A rotina passa a reconciliar:

- `html.modal-open`;
- `body.modal-scroll-locked`;
- `body.mobile-menu-open`;
- `.sidebar.open`;
- `.mobile-menu-backdrop.show`.

Se o menu estiver incompleto, as classes visuais órfãs são removidas automaticamente.

### 3.2. Fechamento oficial de modais

`closeModal()` foi reforçada para:

1. localizar `#modal-root`;
2. emitir o evento de encerramento do modal;
3. remover todos os filhos com `replaceChildren()`;
4. remover a trava do `body`;
5. remover `modal-open` quando não houver overlay;
6. restaurar a posição da página;
7. executar a reconciliação final mesmo em caso de erro.

Foram corrigidos **oito caminhos lógicos de fechamento direto** nos arquivos:

- `js/20-smartphone-mode.js`;
- `js/21-smartphone-history.js`;
- `js/24-interconnections.js`.

Esses caminhos incluem:

- fechar mensagem de erro no salvamento mobile;
- fechar modal pelo botão voltar;
- permanecer no aplicativo;
- confirmar saída;
- cancelar conexão;
- concluir conexão;
- cancelar exclusão importada;
- confirmar a opção de exclusão importada.

### 3.3. MutationObserver defensivo

Foi instalado um `MutationObserver` único em `#modal-root`.

Objetivo:

- detectar inserção direta de overlay legado;
- detectar remoção direta de conteúdo legado;
- reaplicar ou remover a trava automaticamente;
- impedir que um trecho antigo volte a deixar `modal-open` órfã.

O observer possui proteção contra instalação duplicada.

### 3.4. Limpeza na inicialização e nos retornos da aplicação

A reconciliação é executada em:

- inicialização;
- `pageshow`;
- retorno da página ao estado visível;
- mudança de orientação;
- perda de foco da janela;
- mudança entre Pro e Smartphone;
- renderização estrutural do aplicativo;
- redimensionamento;
- abertura e fechamento de modal;
- abertura e fechamento do menu.

### 3.5. Preservação da posição da página

Antes de congelar o fundo do modal, o sistema registra a posição por meio de `document.scrollingElement`.

No fechamento:

- a classe de bloqueio é removida;
- os estilos temporários são eliminados;
- a posição original é restaurada no próximo frame.

Isso evita o salto para o topo após fechar um modal.

### 3.6. Documento como proprietário único da rolagem principal

No estado normal do Smartphone:

- `html` usa `overflow-y: auto`;
- o `body` não cria um segundo scroll vertical;
- `touch-action: pan-y` é aplicado ao documento normal;
- `.shell`, `.main` e `#view-root` apenas cortam excesso horizontal;
- não foi criado scroll vertical concorrente nesses ancestrais.

### 3.7. Modais e bottom sheets

Foi mantida a separação correta:

- o fundo fica bloqueado somente com modal aberto;
- `.mobile-sheet-scroll` continua rolando internamente;
- o conteúdo usa `touch-action: pan-y`;
- somente `.mobile-sheet-handle` usa `touch-action: none`;
- listeners de wheel/touch permanecem restritos ao overlay enquanto o modal existe;
- não existe listener global permanente de wheel ou touchmove.

### 3.8. Arraste de Reservas e Patrimônio

No touch:

- o card não inicia arraste;
- somente `.order-handle` inicia arraste;
- `.reserva-slot` permite `pan-y`;
- o movimento do dedo sobre o corpo do card volta a rolar a página.

No mouse:

- o arraste pela superfície continua disponível no modo organizador;
- a roda do mouse não é cancelada pelo listener de arraste.

### 3.9. Limpeza robusta de listeners temporários

Os arrastes de ordem e módulos agora encerram listeners em:

- `pointerup`;
- `pointercancel`;
- `lostpointercapture`;
- `window.blur`;
- `visibilitychange` quando a página fica oculta;
- remoção do componente durante um re-render.

Os listeners são instalados somente enquanto existe um gesto ativo.

### 3.10. Service Worker e versão

Nova versão:

```text
6.34.3
```

Novo cache:

```text
borion-finance-v6-34-3-scroll-lock-reconciliation
```

Também foram atualizados:

- `index.html` com `?v=6.34.3` em todos os CSS e JavaScript locais;
- `manifest.json`;
- versão exibida em Configurações;
- versão dos backups;
- lista de assets do Service Worker;
- `skipWaiting()`;
- `clients.claim()`;
- exclusão dos caches antigos na ativação.

A lista de pré-cache agora utiliza exatamente os mesmos parâmetros de versão que o `index.html`.

---

## 4. Arquivos alterados

| Arquivo | Alteração principal |
|---|---|
| `css/styles.css` | Scroll normal com `pan-y`, bloqueio legítimo de menu, correção de `.reserva-slot` e proprietário único da rolagem |
| `index.html` | Todos os assets locais atualizados para `?v=6.34.3` |
| `manifest.json` | Versão 6.34.3 |
| `sw.js` | Novo cache, assets versionados, ativação imediata e remoção de caches antigos |
| `js/01-storage-data-state.js` | Reconciliação após troca do modo de interface |
| `js/02-backup-local.js` | Versão do aplicativo nos backups |
| `js/03-modals-shared.js` | Controle central, `closeModal()`, observer, preservação de posição e limpeza de classes órfãs |
| `js/04-gate-shell.js` | Fechamento defensivo do menu antes de render e sincronização após render |
| `js/13-settings.js` | Versão visível e versão de configurações |
| `js/14-events-boot-pwa.js` | Reconciliação ao voltar à página e ao redimensionar |
| `js/18-order-preferences.js` | Arraste somente pela alça no touch e limpeza completa dos listeners temporários |
| `js/20-smartphone-mode.js` | Modal montado com guard e encerrado com `closeModal()` |
| `js/21-smartphone-history.js` | Botão voltar e confirmação de saída usando fechamento oficial |
| `js/24-interconnections.js` | Modais de conexão/exclusão usando guard e fechamento oficial |
| `js/25-module-layout.js` | Limpeza robusta dos listeners de organização de módulos |

Não foram alterados algoritmos de cálculo financeiro, lançamentos, saldos, parcelas, cartões, reservas, perfis, sincronização ou persistência de dados.

---

## 5. Classes órfãs tratadas

Foram auditadas e reconciliadas:

```text
html.modal-open
body.modal-scroll-locked
body.mobile-menu-open
.sidebar.open
.mobile-menu-backdrop.show
```

Estado obrigatório sem modal/menu:

```javascript
document.documentElement.classList.contains('modal-open') === false
document.body.classList.contains('modal-scroll-locked') === false
document.body.classList.contains('mobile-menu-open') === false
```

---

## 6. Revisões executadas

### Revisão 1 — CSS

Verificado:

- `touch-action`;
- `overflow`, `overflow-x` e `overflow-y`;
- `position: fixed`;
- overlays e backdrops;
- `pointer-events`;
- elemento proprietário da rolagem;
- scroll interno dos bottom sheets;
- prevenção de scroll horizontal.

Resultado:

- `touch-action: none` ficou restrito ao menu realmente aberto e às alças dedicadas;
- cards de reserva usam `pan-y`;
- documento normal permanece rolável.

### Revisão 2 — Ciclo de modais

Verificado:

- todas as referências a `#modal-root`;
- `innerHTML = ''`;
- `replaceChildren()`;
- `closeModal()`;
- `attachModalGuard()`;
- abertura, substituição e fechamento;
- MutationObserver;
- Escape e botão voltar.

Resultado:

- nenhum fechamento operacional de `#modal-root` ignora `closeModal()`;
- aberturas continuam protegidas pelo guard;
- observer cobre código legado.

### Revisão 3 — Menu lateral

Verificado:

- `MobileMenu.open()`;
- `MobileMenu.close()`;
- `MobileMenu.toggle()`;
- renderização de `#root`;
- backdrop;
- troca de tela;
- resize;
- troca de interface.

Resultado:

- menu só bloqueia quando sidebar e backdrop estão realmente abertos;
- re-render não deixa classe órfã;
- backdrop órfão perde `.show` e volta a `pointer-events: none`.

### Revisão 4 — Touch, pointer e wheel

Verificado:

- `preventDefault()`;
- `pointerdown`, `pointermove`, `pointerup` e `pointercancel`;
- `lostpointercapture`;
- `touchmove`;
- `wheel`;
- listeners em `document` e `window`;
- arraste de reservas, patrimônio e módulos;
- swipe de notificações e handle de bottom sheet.

Resultado:

- nenhum listener global permanente de `wheel` ou `touchmove`;
- `preventDefault()` de movimento permanece restrito a gestos realmente iniciados em alças/componentes específicos;
- listeners temporários de organização são removidos em todas as rotas de cancelamento relevantes.

---

## 7. Testes automatizáveis executados

### 7.1. Sintaxe

- **30 arquivos JavaScript analisados** com `node --check`;
- nenhum erro de sintaxe encontrado.

### 7.2. Integridade de assets

- **36 referências locais** do `index.html` verificadas;
- todos os arquivos existem;
- todos os CSS/JS usam `?v=6.34.3`.

### 7.3. Service Worker

- **39 assets** da lista de cache verificados;
- todos existem;
- todos os CSS/JS estão versionados;
- novo nome de cache confirmado;
- `skipWaiting()` confirmado;
- `clients.claim()` confirmado;
- limpeza de caches antigos confirmada.

### 7.4. Fechamento de modais

- busca estrutural por remoções de `#modal-root`;
- nenhum fechamento operacional direto restante;
- aberturas por substituição permanecem seguidas de inserção e guard.

### 7.5. CSS de toque

- documento normal com `pan-y` confirmado;
- `.reserva-slot` com `pan-y` confirmado;
- sete ocorrências de `touch-action: none` auditadas e restritas a menu aberto ou alças específicas.

### 7.6. Listeners globais

- nenhum `document.addEventListener('wheel'...)`;
- nenhum `window.addEventListener('wheel'...)`;
- nenhum `document.addEventListener('touchmove'...)`;
- nenhum `window.addEventListener('touchmove'...)`.

### 7.7. Teste de estados em Chromium headless

Cenários aprovados:

- inicialização sem trava;
- documento com altura rolável;
- `overflow-y: auto` no proprietário da rolagem;
- `touch-action: pan-y` no estado normal;
- eventos sintéticos de wheel/touch/pointer não cancelados em card comum;
- modal bloqueia o fundo;
- modal longo possui scroll interno;
- fechamento remove a trava;
- posição da página é restaurada;
- inserção direta legada ativa a trava pelo observer;
- remoção direta legada desativa a trava pelo observer;
- menu real ativa a trava;
- menu/backdrop órfãos são limpos;
- troca Smartphone → Pro libera o `body` fixo;
- **30 ciclos consecutivos** de modal/menu terminaram sem classe órfã.

O arquivo `VALIDACAO_TECNICA_AUTOMATIZADA_v6.34.3.txt` acompanha o pacote.

---

## 8. Limitações do ambiente de validação

O ambiente usado para esta revisão bloqueou a navegação do Chromium para páginas locais/servidor de teste com:

```text
net::ERR_BLOCKED_BY_ADMINISTRATOR
```

Por isso, não foi possível afirmar execução física dos seguintes testes dentro deste ambiente:

- Chrome Android em aparelho real;
- PWA realmente instalado;
- touch físico;
- touchpad físico;
- roda de mouse física;
- Page Up/Page Down como eventos confiáveis do navegador;
- Edge e Firefox reais;
- teclado virtual Android;
- minimizar e reabrir um PWA instalado;
- perda e retorno real de rede.

Esses itens não foram marcados como aprovados sem evidência. O pacote contém as correções estruturais e passou nos testes automatizáveis, mas a publicação deve ser seguida pelo checklist manual abaixo em dispositivo real.

---

## 9. Checklist manual obrigatório após publicação

### Atualização correta

- [ ] Publicar todos os arquivos do ZIP, não somente `styles.css`.
- [ ] Fechar todas as abas antigas do Borion.
- [ ] Reabrir o site e confirmar **Versão 6.34.3** em Configurações.
- [ ] No PWA, fechar completamente e abrir novamente.
- [ ] Caso ainda apareça 6.34.2, limpar dados do site/PWA uma única vez.

### Página principal

- [ ] Rolar por toque sobre card.
- [ ] Rolar por toque sobre texto.
- [ ] Rolar por toque sobre espaço vazio.
- [ ] Rolar por toque sobre card de Reserva no modo organizador.
- [ ] Rolar por roda do mouse no Modo Smartphone desktop.
- [ ] Rolar por touchpad.
- [ ] Testar Page Up, Page Down e setas.

### Menu lateral

- [ ] Abrir e fechar pelo X.
- [ ] Abrir e fechar pelo backdrop.
- [ ] Abrir e navegar para outra tela.
- [ ] Abrir e usar o botão voltar.
- [ ] Confirmar rolagem após cada fechamento.

### Modais

- [ ] Receita.
- [ ] Despesa variável.
- [ ] Despesa fixa.
- [ ] Transferência.
- [ ] Reserva.
- [ ] Rendimento.
- [ ] Conta.
- [ ] Cartão.
- [ ] Categoria.
- [ ] Assinatura.
- [ ] Backup.
- [ ] Importação.
- [ ] Integrações.
- [ ] Confirmação de exclusão.
- [ ] Troca de perfil.

Em cada modal:

- [ ] abrir;
- [ ] rolar internamente quando longo;
- [ ] fechar pelo X;
- [ ] fechar por Cancelar;
- [ ] salvar;
- [ ] voltar à página;
- [ ] confirmar que a página rola imediatamente.

### Repetição

- [ ] Executar 30 ciclos de abrir/fechar modal e menu.
- [ ] Confirmar ausência de degradação progressiva.

---

## 10. Critério de liberação

A versão pode ser liberada para uso normal após o teste manual em aparelho real confirmar:

- touch vertical funcionando;
- roda do mouse funcionando;
- touchpad funcionando;
- página desbloqueando após qualquer modal;
- página desbloqueando após o menu;
- modal longo rolando internamente;
- ausência de salto para o topo;
- versão 6.34.3 realmente carregada.

---

## 11. Conclusão

A correção não foi tratada como ajuste superficial de CSS. O ciclo completo de bloqueio foi reestruturado para que as classes reflitam o DOM real, com proteção contra código legado, re-renderizações, troca de interface, retorno do PWA, menu incompleto, backdrop órfão e gestos de arraste interrompidos.

As regras financeiras e a persistência de dados não foram modificadas.
