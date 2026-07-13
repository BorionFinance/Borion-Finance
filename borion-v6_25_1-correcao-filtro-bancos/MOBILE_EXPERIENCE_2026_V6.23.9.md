# Borion V6.23.9 — Mobile Experience 2026

## Objetivo

Transformar o Smartphone Mode em uma experiência mais próxima de um aplicativo nativo, mantendo a mesma base financeira, os mesmos perfis, backups, contas, Reservas, Cofrinhos e cálculos do Modo Pro.

## Notificações

### Popups flutuantes

- Podem ser arrastados para a esquerda ou para a direita.
- Ao ultrapassar o limite do gesto, saem da tela com animação e feedback tátil.
- Fechar ou arrastar dispensa somente o popup.
- O registro continua disponível no sino de notificações.
- A dispensa é gravada para o popup não reaparecer a cada abertura do aplicativo.
- O encerramento automático após o tempo configurado segue a mesma regra: o popup some, mas o registro permanece no sino.

### Central de notificações

- No celular, abre como uma folha inferior (bottom sheet).
- Pode ser fechada puxando a alça para baixo.
- Cada notificação pode ser arrastada lateralmente para ser excluída.
- A exclusão oferece a opção **Desfazer** durante cinco segundos.
- Mantém as ações de marcar como lida ou não lida.
- Inclui ação para marcar todas como lidas.
- Exibe estado relativo de tempo, como “agora”, “há 5 min”, “ontem”.

## Modais e formulários

- Formulários comuns abrem como bottom sheets no Smartphone Mode.
- Possuem alça de arraste e animação baseada em transformação, evitando travamentos.
- O gesto para baixo fecha a folha.
- Caso existam alterações digitadas, exige um gesto mais forte, reduzindo fechamentos acidentais.
- Adaptação ao teclado virtual e às safe areas do Android/iOS.
- O botão físico Voltar continua fechando primeiro a camada aberta.

## Navegação e sensação de fluidez

- Transições entre telas usam a View Transitions API quando disponível.
- Navegadores sem suporte continuam funcionando normalmente.
- A posição de rolagem de cada módulo é preservada durante a navegação mobile.
- Feedback tátil curto em ações importantes em aparelhos compatíveis.
- Animações utilizam `transform` e `opacity`, priorizando fluidez.
- Pessoas com “reduzir movimento” ativado recebem transições praticamente instantâneas.

## Estrutura visual refinada

- Topo fixo com transparência e desfoque.
- Barra inferior com safe area real, indicador ativo e melhor resposta ao toque.
- A barra inferior some durante a digitação quando o teclado ocupa a tela.
- Toasts aparecem acima da navegação inferior.
- Alvos de toque principais possuem pelo menos 44 px.
- Campos usam 16 px no celular, evitando zoom automático em navegadores móveis.
- Cartões e botões receberam microinterações curtas, sem animação exagerada.

## Conectividade

- Ao perder internet, o Smartphone Mode informa que os dados continuam protegidos no aparelho.
- Ao recuperar a conexão, exibe confirmação temporária e o fluxo de sincronização continua normalmente.

## PWA

- Novo cache `borion-finance-v6-23-9-mobile-experience`.
- A nova camada de experiência está disponível offline.
- Manifesto recebeu identidade estável, idioma, categorias e preferência por reutilizar a instância já aberta do aplicativo.
- O comportamento de atualização instalado continua usando Service Worker e **Salvar e atualizar**.

## Arquivos principais alterados

- `js/11-agenda-notifications.js`
- `js/22-mobile-experience.js` — novo
- `css/styles.css`
- `index.html`
- `sw.js`
- `manifest.json`
- `js/02-backup-local.js`
- `tests/borion-regression-tests.js`

## Escopo preservado

Não foram modificados:

- cálculos financeiros;
- saldo de contas;
- `accountId`;
- funcionamento de cartões e faturas;
- regras de assinaturas;
- Reservas ou Cofrinhos;
- conversão de metas;
- Google Drive, snapshots e rotação de backups;
- proteção do botão Voltar.

## Validação

- 49 de 49 testes de regressão aprovados.
- Todos os JavaScript passaram na validação sintática.
- Service Worker passou na validação sintática.
- Manifesto PWA passou na validação JSON.
- CSS analisado sem erros de parsing.
