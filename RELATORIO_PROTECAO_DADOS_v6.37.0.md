# Borion Finance v6.37.0 — Proteção de dados e entrada só por Google

## Base utilizada

- Borion Finance v6.36.0 — Central do Borion.
- Nenhuma tela de lançamentos, investimentos, cartões, agenda ou importação foi alterada.
- Formato do `current.json` ganhou um uso adicional (contagem de registros comparada antes de gravar) — nenhum campo existente foi removido ou renomeado.

## O que você pediu

1. Tirar o cache do navegador do caminho de decisão (igual ao Amanda Estética).
2. Só entrar com Google (sem login local/Supabase como opção nova).
3. Salvar o arquivo mais rápido — e já que o Borion não tem fotos, mais rápido que o Amanda.

## Diagnóstico: o Borion já estava bem mais protegido que o Amanda estava

Antes de mexer em qualquer coisa, conferi o `js/01c-google-drive-provider.js` inteiro. Boas notícias primeiro:

- **O boot já não confia no cache local antes de falar com o Drive.** Quando `getStorageMode()==='google_drive'`, o `boot()` chama `GoogleDriveProvider.connect(false)` — que autentica, confere a pasta e chama `loadFromDrive()` ANTES de mostrar qualquer tela editável. Isso já é exatamente o modelo "Drive é a fonte da verdade" que corrigimos no Amanda.
- **A gravação de rotina (`syncNow`) já era enxuta**: 1 consulta de metadados (`modifiedTime`, pra detectar conflito) + 1 gravação do conteúdo. Sem download completo antes, sem snapshot antes, sem releitura de confirmação depois. Isso explica por que o Borion já era mais rápido que o Amanda era antes da correção de performance de lá — ele nunca teve o problema das 4 transferências completas por salvamento.

Ou seja, a arquitetura de vocês já estava no caminho certo. Encontrei três brechas reais, não o mesmo tipo de falha grave do Amanda:

### 1. O Service Worker cacheava as próprias chamadas ao Google Drive

Esse é o achado mais sério. O `sw.js` interceptava **qualquer requisição GET**, sem checar a origem — inclusive `https://www.googleapis.com/drive/v3/files/...`. Como a leitura do `current.json` (`?alt=media`) e a checagem de conflito (`?fields=...,modifiedTime`) usam sempre a mesma URL (o ID do arquivo não muda), o Service Worker podia servir uma resposta **antiga, direto do cache dele**, tanto na leitura da conta quanto na checagem de conflito — o mesmo tipo de risco de "cache decidindo por dados velhos" que motivou a correção no Amanda, só que na camada do Service Worker em vez do IndexedDB/localStorage.

**Corrigido**: o `sw.js` agora ignora completamente qualquer requisição de outra origem — nunca mais intercepta nem cacheia chamadas ao Google. (O Amanda Estética já fazia essa checagem corretamente; o Borion não fazia.)

### 2. A proteção contra "gravação vazia" só olhava se TODOS os perfis sumiam

`syncNow()` só recusava gravar quando `payload.profiles.length === 0`. Se os dados de **um perfil específico** (transações, cartões, investimentos de uma pessoa) zerassem por qualquer motivo — sem o perfil em si sumir da lista —, nada detectava.

**Corrigido**: nova checagem (`js/01d-data-guard.js`) compara a contagem de transações, fixas, contas, cartões, boletos, transferências, agenda, metas, assinaturas, investimentos e cheques de **cada perfil**, somadas, com a última base confiável conhecida nesta pasta. Uma coleção que tinha registros e zera, ou que cai mais de 40% numa gravação só, bloqueia o salvamento — local e mensagem parecida com o que já existia para "todos os perfis sumindo", só que agora cobrindo qualquer perfil individual também. Aplicado em `syncNow()` (automático), `forceSyncNow()` (Ctrl+S) e no "catch-up" de reconexão (item 3 abaixo). Roda inteiramente em memória — nenhuma chamada de rede a mais, então não deixa nada mais lento.

### 3. O "catch-up" de reconexão podia reenviar dados incompletos

Se a aba fechasse antes do envio de uma alteração terminar, uma flag "pendente" ficava salva; ao reconectar, o app tratava o dado local como o mais novo e reenviava — comportamento correto na maioria das vezes, mas sem nenhuma checagem contra os dados realmente estarem incompletos (ex.: se o IndexedDB tivesse sido parcialmente limpo entre uma sessão e outra, mas a flag "pendente" sobrevivesse no localStorage).

**Corrigido**: antes de reenviar, a mesma checagem do item 2 roda; se parecer suspeito, o app ignora o "catch-up", limpa a flag antiga, avisa que a alteração pendente não foi enviada, e carrega o Drive normalmente (nunca sobrescreve).

## Só Google Drive como forma de entrar

- Removido o botão **"Usar sem conta"** da tela de login limpa — não é mais possível escolher modo 100% local a partir de uma entrada nova.
- Removido o **"Entrar com e-mail e senha"** (Supabase) do painel "Instruções e mais opções" — não é mais possível iniciar um login novo por e-mail/senha.
- **Ninguém que já estava logado é desconectado**: quem já tinha uma sessão Supabase aberta continua entrando direto (o `boot()` nem passa pela tela de login nesse caso); quem já estava em modo local antes continua acessando os próprios dados — só não aparece mais a opção de escolher esses caminhos a partir de uma entrada nova. O link "Entrar com uma conta na nuvem" (que já existia para quem está em modo local) agora leva direto para a tela só-Google.
- Recuperação de senha por link mágico do Supabase (para quem ainda estiver usando) continua funcionando — isso não é uma entrada nova, é a continuação de uma conta já existente.

Se quiser que eu vá além — por exemplo, bloquear de vez o acesso de quem ainda estiver em modo local/Supabase e forçar a migração para o Google Drive agora — me avisa e eu faço uma tela específica para isso. Preferi não fazer isso sozinho porque não sei se o Gustavo ou o Marco ainda usam algum desses caminhos.

## Velocidade

Como o `syncNow()` já era enxuta (sem o problema das 4 transferências que o Amanda tinha), a única mudança de velocidade real aqui foi a do Service Worker (item 1) — que podia estar fazendo o app *parecer* mais lento ou "voltar no tempo" ao servir uma versão cacheada em vez da atual. A checagem de segurança nova (item 2) não usa rede, então não deixa nada mais lento. Resumindo: o Borion deve continuar tão rápido quanto já era (ou mais previsível, com o Service Worker corrigido), e sem fotos ele realmente tende a ficar bem mais rápido que o Amanda no dia a dia.

## Arquivos alterados

| Arquivo | O que mudou |
|---|---|
| `js/01d-data-guard.js` *(novo)* | Contagem de registros por conta/perfil e detecção de queda suspeita. Módulo puro, testado em Node. |
| `js/01c-google-drive-provider.js` | `syncNow()`, `forceSyncNow()` e o "catch-up" de `loadFromDrive()` passaram a usar a checagem de queda suspeita. Novo campo `blockedSuspicious` no status. |
| `js/17-borion-cloud.js` | Tela de login: removido "Usar sem conta" e "Entrar com e-mail e senha" das opções de entrada nova. |
| `js/04-gate-shell.js` | Selo do topo mostra quando um salvamento foi bloqueado por segurança. |
| `js/14-events-boot-pwa.js` | Só a versão do registro do Service Worker (`sw.js?v=6.37.0`). |
| `sw.js` | **Correção crítica**: nunca mais intercepta/cacheia chamadas de outra origem (Google Drive, Google Auth). Versão do cache trocada (limpa o cache antigo automaticamente). |
| `index.html` | Inclui o novo arquivo, versões atualizadas. |

## Testes automatizados (rodam de verdade, incluídos em `/tests`)

Não tenho acesso de rede às APIs do Google a partir daqui, então o fluxo real de login OAuth + Picker de pasta só um teste manual no navegador consegue cobrir. O que dá pra testar sem rede, testei:

- `tests/test_data_guard.js` — 7 casos: contagem entre múltiplos perfis, sem baseline nunca acusa, base zerando é bloqueada, perfis inteiros sumindo continua detectado, queda pequena/legítima passa, queda grande (>40%) bloqueia, persistência da última contagem confiável.
- `tests/test_data_guard_integration.js` — 4 casos carregando o `js/01c-google-drive-provider.js` **real** num sandbox Node: `_assertSafeToForceWrite` não acusa sem histórico, bloqueia com histórico e queda suspeita, `acknowledgeSuspicious:true` permite prosseguir, e `syncNow()` bloqueia **antes de qualquer chamada de rede** quando os dados parecem suspeitos (verificado com um `fetch` que lança erro se for chamado indevidamente).
- Testes já existentes do projeto (`test_help_center.js`, `test_importador_legado.js`, `test_importacao_prints_core.js`) continuam passando sem alteração — nada quebrou.

Rodar: `node tests/test_data_guard.js && node tests/test_data_guard_integration.js`

## Checklist manual (precisa do navegador/conta Google — não pude rodar aqui)

- [ ] Confirmar que a tela de login mostra só "Continuar com Google" (sem "Usar sem conta" nem e-mail/senha).
- [ ] Limpar dados do site num dispositivo já conectado ao Drive → reabrir → confirmar que não abre nada editável até carregar do Drive.
- [ ] Editar em duas abas/dispositivos e confirmar que o selo "Conflito — recarregar" continua funcionando.
- [ ] Forçar uma queda grande de propósito (ex.: apagar quase todas as transações de um perfil de teste) e confirmar que aparece o selo "Salvamento bloqueado — ver" e o toast com o motivo.
- [ ] Instalar a versão anterior, publicar esta, e confirmar que o Service Worker atualiza e limpa o cache antigo.

## Versão

- `index.html`, `sw.js`: **v6.37.0**.
- Cache do Service Worker: `borion-finance-v6-37-0-protecao-dados`.
