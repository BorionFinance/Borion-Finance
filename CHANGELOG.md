## V6.4.0 — Google Drive (FASE 3 da migração) (10/07/2026)

Primeira versão do armazenamento por Google Drive, no modelo "central" que você
escolheu: cada pessoa entra com a própria conta Google; os dados ficam guardados numa
pasta que você (dono do Drive) compartilha com o e-mail de cada uma. Nenhum backend
extra, nenhuma senha/token compartilhado — a segurança é a do próprio Google Drive.

- **Login "Entrar com Google (Drive)"** na tela de login, ao lado de "Usar sem conta".
- **Primeira conexão**: abre o seletor nativo do Google (Picker) pra pessoa escolher a
  pasta compartilhada. Depois disso, o ID da pasta fica salvo neste navegador — nunca
  mais precisa abrir o seletor de novo.
- **`current.json`** dentro da pasta: mesmo formato do backup completo que o app já usa
  (`borion-account-backup`, `profiles[]` + `dataByProfile{}`) — continua suportando
  vários perfis por conta, igual ao modelo Netflix que você descreveu.
- **Sincronização automática**: qualquer alteração salva localmente (mesmo gancho que já
  existe para o Supabase) também enfileira uma gravação no Drive, com debounce de 800ms.
- **Reconexão silenciosa no boot**: se o token expirar, tenta renovar sem popup; se
  falhar, mostra uma tela simples de reconectar (nunca trava o app).
- Selo no topo do app e aba "Nuvem" em Configurações ganharam uma variante própria pro
  Google Drive (antes só existiam variantes Supabase/local).

**Isso ainda não tem**: histórico de backups dentro do Drive (pasta `backups/`),
detecção de conflito por `modifiedTime` (duas pessoas editando ao mesmo tempo), e a
tela de "nenhum dado encontrado, importar ou começar do zero" pra pasta vazia (hoje só
cria um `current.json` vazio direto). Ficam pro próximo incremento, depois de validar
que o básico (entrar → escolher pasta → ler/escrever) funciona de verdade.

**Importante**: diferente do modo offline, essa parte só se prova testando ao vivo
(OAuth, Picker e Drive API não dá pra simular sem navegador). Espere precisar de ajustes
depois do primeiro teste real.

## V6.3.0 — Modo offline (Incremento 1 da migração pra sair do Supabase) (10/07/2026)

Primeiro passo do plano de migração: dá pra abrir e usar o Borion **sem login no
Supabase**. Nenhum código do Supabase foi removido ou alterado em comportamento — tudo
aqui é aditivo, e quem já usa conta na nuvem não percebe nenhuma diferença.

- **Novo botão "Usar sem conta (só neste dispositivo)"** na tela de login. Escolhendo
  essa opção, o Borion vai direto pro seletor de perfil local (mesma tela "Quem é você?"
  de sempre) e nunca mais mostra a tela de login Supabase sozinho — só se você pedir
  ("Entrar com uma conta na nuvem", agora disponível no rodapé do seletor de perfil).
- **Perfis locais nunca são perdidos ao logar numa conta depois**: antes, se você criasse
  perfis 100% locais e depois logasse numa conta Supabase no mesmo navegador, o registro
  desses perfis sumia da lista (`mergeLocalAndCloudProfiles`, em `17-borion-cloud.js`).
  Corrigido — os perfis locais continuam salvos e voltam a aparecer quando você sair da
  conta ou usar "sem conta" de novo.
- **`validateBorionJson(data)`** (`01-storage-data-state.js`): validação central de um
  JSON de backup antes de importar, reaproveitável por qualquer tela.
- **`storageProvider`** (novo arquivo `01b-storage-provider.js`): camada única com
  `loadUserData`, `saveUserData`, `importJson`, `exportJson`, `createBackup`,
  `listBackups`, `restoreBackup`, `validateBorionJson` e `getStorageStatus` — todos
  envelopando funções que já existiam no app, sem duplicar lógica.
- **Histórico de backups 100% local** (nova store IndexedDB, `storageProvider.
  createBackup/listBackups/restoreBackup`): antes, listar e restaurar backups só existia
  via Supabase. Agora existe também offline, com a mesma regra de retenção (manual,
  before_import e before_restore nunca são apagados sozinhos).
- `importJson` sempre cria um backup `before_import` antes de importar; `restoreBackup`
  sempre cria um backup `before_restore` antes de restaurar — nunca sobrescreve sem rede
  de segurança.

**Auditoria pós-teste** (garantindo que nenhuma tela quebra sem Supabase, critério #11
da FASE 1): a tela "Status da nuvem" em Configurações mostrava botões como "Sincronizar
agora", "Diagnóstico Supabase" e "Trocar senha da conta" mesmo sem login — clicar neles
gerava erro de Supabase sem sentido no modo local. Agora, sem conta, essa tela mostra um
painel próprio ("Armazenamento") só com o que funciona localmente. O selo de status no
topo do app ("Sincronizando...") também ficava travado nesse texto para sempre no modo
local — agora mostra "Modo local" com estilo neutro (não é mais o vermelho de erro).

**Nova tela**: Configurações → Backups → "Ver backups deste dispositivo" — lista, baixa
e restaura o histórico de backups local (IndexedDB) criado pelo `storageProvider`.

**Bug corrigido antes de ir pro ar**: `js/13-settings.js` tem 3 funções com o mesmo nome
declaradas duas vezes cada (`renderSettingsCloud`, `renderSettingsBackup`,
`renderSettingsProfiles` — provavelmente de sessões antigas). Em JavaScript, a segunda
declaração "vence" e a primeira vira código morto sem erro nenhum — então meu primeiro
patch da tela de backups foi parar silenciosamente na cópia morta e nunca apareceu.
Corrigido para editar a cópia que realmente roda. `renderSettingsProfiles` continua
duplicada (não mexi, não relacionada a este incremento) — vale uma limpeza futura.

**Limpeza**: removidas as 3 cópias mortas (`renderSettingsProfiles`, `renderSettingsCloud`,
`renderSettingsBackup`) do `13-settings.js`. Nenhuma removida tinha efeito — eram sempre
sobrescritas pela segunda declaração — mas deixavam a próxima edição (minha ou sua)
vulnerável ao mesmo tropeço.

(OAuth, Picker e Drive API não dá pra simular sem navegador). Espere precisar de ajustes
depois do primeiro teste real.

Maior mudança conceitual do Borion desde o lançamento das Reservas. Antes, retirar dinheiro
de uma reserva (cofrinho) exigia lançar uma Receita falsa para depois lançar a Despesa de
verdade — o que nunca deveria ter contado como renda. A partir da V6.0 isso deixa de existir.

- **Fluxo Financeiro** (Receitas e Despesas) passa a representar só dinheiro novo entrando
  ou dinheiro realmente saindo. Reserva nunca mais gera Receita.
- **Transferências** (`js/10-cards-accounts.js`) deixam de ser só "conta → conta": agora
  aceitam Conta→Reserva, Reserva→Conta, Reserva→Reserva e Conta→Conta. Nunca alteram
  patrimônio, receita ou despesa — só trocam onde o dinheiro está guardado. Cada uma tem
  histórico próprio e, quando envolve uma reserva, aparece também no extrato dela.
- **Despesa variável** (`js/07-budget.js`) ganhou o campo "Origem do pagamento": Conta ou
  Reserva. Escolhendo Reserva, o Borion desconta o valor da reserva e cria a despesa num
  único clique — sem Receita, sem passo intermediário. Editar essa despesa devolve o valor
  antigo à reserva antes de aplicar o novo (inclusive ao trocar de reserva); excluir devolve
  o saldo automaticamente. O Desfazer (5s após excluir) restaura despesa, saldo e histórico
  juntos, porque tudo usa o mesmo mecanismo de snapshot completo do perfil.
- **Proteção contra reserva negativa**: nenhuma reserva pode ficar negativa em nenhum fluxo
  (pagamento direto, transferência ou resgate manual). Sem saldo suficiente, o Borion mostra
  um aviso elegante e não deixa salvar.
- **Extrato da reserva** (`js/09-patrimony-goals.js`) agora mostra "Pagamento direto" (despesa
  paga direto da reserva) e "Transferência enviada/recebida", com o mesmo padrão visual do
  extrato existente. Itens vindos de uma despesa ou transferência só podem ser editados pela
  origem, para nunca dessincronizar os dois lados (mesmo padrão já usado por cartão/boleto).
- **Novo Dashboard** (`js/06-overview.js`): cards principais agora são Patrimônio Total,
  Disponível em Conta, Receitas do período, Despesas do período e Resultado do período
  (Receitas − Despesas, sem contar Transferências). Patrimônio Total nunca depende de
  Receita — continua somando contas + reservas + investimentos + bens − dívidas
  (`patrimonioTotal()`, sem mudança de fórmula). Gráficos e estatísticas continuam
  considerando só Receitas e Despesas reais; Transferências nunca entram neles (já era assim
  antes e continua sendo).
- **Migração automática e conservadora**: ao abrir um perfil antigo, o Borion procura Receitas
  cujo nome bate com um padrão claro de "retirada/resgate/saque de reserva" (ex: "Retirada de
  reserva"). Quando dá pra identificar com segurança qual reserva era (só existe uma reserva
  no perfil, ou o nome da reserva aparece no lançamento), converte para uma Transferência
  histórica (Reserva → Conta) e a receita some da lista — nunca mais entra nos seus números de
  Receita. A conversão NUNCA mexe no saldo atual da reserva ou da conta: é só uma
  reclassificação do registro para fins de histórico, e o lançamento original inteiro fica
  guardado dentro da transferência (nada é apagado). Quando não dá pra identificar com
  segurança, o lançamento antigo é mantido exatamente como estava.
- **Banco de dados**: nenhuma tabela nova foi criada no Supabase. Todo o perfil financeiro do
  Borion (incluindo reservas, transferências e despesas) já é sincronizado como um único
  documento (`borion_profile_data.data jsonb`) — os novos campos entram nesse mesmo documento
  e sincronizam normalmente, sem precisar de migração de schema.
- Compatibilidade total: login, perfis, Supabase, backup local, importação/exportação,
  categorias, cartões, boletos, cheques, patrimônio, metas, agenda e notificações continuam
  funcionando exatamente como antes. Nenhum layout, animação ou identidade visual foi alterado
  — só os campos novos necessários foram adicionados.

## V5.39.6 — Exclusão de conta com link mágico (09/07/2026)

- Recolocada a etapa de confirmação por e-mail no fluxo de exclusão de conta.
- O Borion agora usa o link mágico padrão do Supabase: o usuário recebe o e-mail, clica em **Sign in** e volta para o Borion.
- A tela do app explica claramente que o e-mail virá como **Supabase Auth**, com assunto **Your sign-in link**, e que o botão/link será **Sign in**.
- A exclusão só continua depois do retorno pelo link mágico, mantendo aviso forte, senha inicial, confirmação de e-mail e senha final.
- Atualizado o cache do PWA para forçar carregamento da nova versão.

## V5.39.5 — Correção do fluxo de excluir conta (09/07/2026)
- Corrigido o fluxo de exclusão de conta para não depender de código OTP por e-mail.
- Motivo: o Supabase Auth, por padrão, envia link mágico de login em vez de código numérico no template de e-mail.
- A exclusão agora exige aviso forte, digitar EXCLUIR, confirmar a senha, digitar o e-mail da conta e confirmar a senha novamente.
- Mantida a chamada RPC delete_own_account para apagar dados do Supabase e auth.users.
- Atualizado cache do app para forçar carregamento da versão nova.

## V5.39.4 — Exclusão de conta segura (09/07/2026)

- Adicionado fluxo completo para excluir conta Borion Cloud em Configurações > Nuvem.
- A exclusão agora passa por: aviso de perda total dos dados, digitar EXCLUIR, senha da conta, código enviado ao e-mail pelo Supabase, senha novamente e confirmação final.
- O aviso deixa claro que e-mail, login, todos os perfis financeiros e dados monetários serão apagados e não poderão ser recuperados pelo app.
- Após excluir, o Borion limpa sessão, cache local dos perfis e mostra a mensagem: “Sua conta foi cancelada. Todos os dados foram apagados. Esperamos vê-lo em breve novamente.”
- O botão Excluir conta também aparece junto dos botões principais da tela Nuvem, além da zona de perigo.

## V5.39.3 — Investimentos negativos e salvamento final (09/07/2026)

- Investimentos: rendimento negativo em ativos agora aparece em vermelho, incluindo valor e porcentagem. Ex.: investiu R$ 1.000 e está R$ 900, mostra perda de R$ 100 / -10% em vermelho.
- Card geral de Rendimento em Investimentos também usa vermelho quando o total estiver negativo.
- Adicionado aviso interno para confirmar um último salvamento após alterações no perfil.
- Ao tentar fechar/recarregar no PC, o Borion força um salvamento local e mostra o aviso nativo do navegador quando houver alteração pendente de confirmação.
- No celular/PWA, onde o navegador pode bloquear aviso de fechamento, o Borion faz salvamento final automático ao esconder/fechar a página pelo `visibilitychange/pagehide`.

## V5.39.2 — Parcelas corretas em Despesas (09/07/2026)

- Corrigido o erro em que compra no crédito parcelado aparecia em Despesas pelo valor total da compra.
- Agora, despesa variável no crédito cria uma ocorrência por mês, sempre com o valor da parcela. Ex.: R$ 1.000 em 4x vira R$ 250 em cada mês.
- Despesa fixa no crédito também pode ser lançada como compra parcelada: o Borion calcula a parcela e cria uma fixa temporária até a última parcela.
- O campo de valor muda para “Valor total da compra” quando a forma de pagamento é Crédito.
- A quantidade de parcelas mostra o valor de cada parcela em tempo real.
- Migração defensiva: compras parceladas já salvas com o valor total são reconstruídas como parcelas mensais corretas.
- A mesma correção foi aplicada aos boletos espelhados em Despesas variáveis.

## V5.39.1 — Correção do vínculo cartão/boleto ↔ Despesas + avisos internos (09/07/2026)
- Corrigido bug em que uma compra parcelada com "Aparecer também em Despesas?" marcado sumia da lista de Lançamentos (e dos totais) sempre que o filtro de banco/cartão estava ativo — a despesa espelhada era salva com banco em branco e nunca batia com o filtro. Agora ela herda o banco/nome do próprio cartão, então aparece de forma consistente em Lançamentos e em Cartões e Contas. Dados antigos são corrigidos automaticamente na primeira abertura do app.
- Renomear um cartão agora também atualiza o banco das despesas já espelhadas por ele.
- Boletos (Adicionar/Editar boleto) ganharam a mesma opção "Aparecer também em Despesas?" com escolha entre Despesa fixa/variável, com o mesmo vínculo em mão dupla do cartão (editar/excluir o boleto atualiza ou remove a despesa espelhada; não duplica). Testado com vários boletos simultâneos.
- O aviso nativo do navegador ao desfazer pagamento de fatura/boleto virou uma tela de confirmação dentro do app, no mesmo estilo dos outros avisos.
- Reserva: rótulo do topo simplificado para "◈ Reservado: R$ 0,00" (sem repetir "Reserva").
- Cartões e Contas: linha da Carteira simplificada para "Carteira · (dinheiro físico) · Saldo inicial: R$ 0,00 · Não rende · Não pode ser excluída".



- Corrigido: lançar uma despesa em crédito na tela de Orçamento agora aparece em Cartões e Contas **e** em Despesas (despesa variável), como deveria — antes só aparecia no cartão.
- Nova opção "Aparecer também em Despesas?" ao adicionar/editar uma compra parcelada direto em Cartões e Contas. Se marcar Sim, aparece um alternador (estilo on/off) pra escolher se ela entra como Despesa fixa ou Despesa variável.
- O vínculo é sempre em mão dupla e sem duplicar: editar valor/categoria/parcelas da compra no cartão atualiza a despesa espelhada; desmarcar a opção ou excluir a compra remove a despesa espelhada junto. Editar essas despesas espelhadas só é possível pela compra no cartão (Cartões e Contas), pra nunca dessincronizar os dois lados.
- Despesa fixa espelhada de uma compra parcelada dura exatamente o número de parcelas (começa e termina junto com a fatura); despesa variável espelhada mostra o valor total da compra.
- Linhas de despesas vindas do cartão ganham a etiqueta "🔗 Via cartão" na lista de Orçamento.


## V5.38.0 — Ajustes de UX: forma de pagamento, filtro de período e reserva (09/07/2026)
- No lançamento de despesa, "Forma de pagamento" agora vem antes do campo de banco/conta, e é ela quem manda: escolher "Dinheiro" trava o campo automaticamente na Carteira (sem opção de trocar); "Pix"/"Débito" mostram só bancos reais cadastrados (sem Carteira); "Crédito" esconde o banco e mostra o cartão.
- Nova reserva: o campo de banco/conta agora só mostra Carteira e bancos reais — cartão de crédito não aparece mais lá.
- Orçamento (Receita, Despesa fixa, Despesa variável): novo filtro de período com "de" e "até", podendo incluir meses anteriores ao selecionado no topo do app. Despesas fixas no período somam todas as ocorrências ativas nos meses cobertos.
- Scroll de todas as janelas flutuantes (modais, painéis, listas internas) agora usa a cor dourada do sistema em vez do scroll padrão do navegador.
- Reserva: a barra de porcentagem só aparece quando a reserva tem uma meta definida; agora dá pra escolher separadamente a cor do valor e a cor da barra de progresso.
- Configurações: mensagem sobre troca de perfis simplificada.


## V5.37.0 — Banco/Conta, Carteira e Cartão como entidades separadas (09/07/2026)
- Nova conta fixa "Carteira" (dinheiro físico): já existe por padrão, não pode ser excluída, e funciona como qualquer conta para entrada/saída de dinheiro. Migração defensiva cria a Carteira automaticamente em dados antigos e nunca duplica em migrações repetidas.
- No lançamento de receita/despesa e nas despesas fixas, o campo "Banco/Conta" agora mostra só a Carteira e os bancos/contas cadastrados — cartão de crédito não aparece mais nessa lista.
- Nova "Forma de pagamento" no lançamento de despesa: Dinheiro, Pix, Débito ou Crédito. Escolher a Carteira trava a forma em Dinheiro automaticamente.
- Escolher "Crédito" troca o campo de banco por um campo exclusivo de cartão (só cartões cadastrados aparecem) e pergunta se a compra é à vista ou parcelada; a compra vira automaticamente uma parcela vinculada ao cartão (igual ao "+ Compra parcelada" de Cartões e Contas) e não desconta o banco/carteira na hora — só a fatura paga mexe no saldo, como já funcionava.
- Pagamento de fatura de cartão, pagamento de boleto, cadastro de boleto e transferências entre contas agora só aceitam Carteira/bancos reais como origem — nunca outro cartão de crédito.
- Compatibilidade total com JSON export/import e coluna do Supabase: a Carteira é só mais um item em `contas`, sem mudança de formato de arquivo.


## V5.36.0 — Categorias, conta e UX de lançamentos (09/07/2026)
- Categorias agora têm cor própria e podem ser reutilizadas em vários recebimentos/despesas.
- Excluir categoria vinculada agora é bloqueado por modal interno, sem bagunçar lançamentos antigos.
- Senha com botão de visualizar/ocultar no login, criação de conta e criação/entrada de perfil.
- Tema escuro corrige nome do perfil com fonte clara.
- Conta Borion Cloud agora tem fluxo de exclusão com confirmação de e-mail e senha.
- Backup JSON completo na nuvem agora permite importar todos os perfis vinculados à conta.
- Aviso de banco/conta obrigatório saiu do alerta do navegador e virou tela flutuante com botão para cadastrar banco.
- Inclui SQL SUPABASE_V5.36_DELETE_ACCOUNT.sql para habilitar exclusão total da conta no Supabase.


## V5.35.2 — Backup Null Guard
- Corrigido erro ao aceitar/configurar pasta de backups antes de abrir um perfil financeiro.
- `renderView()` agora não é chamado quando `S.data` ainda está nulo.
- `renderApp()` ganhou guarda defensiva para voltar à tela de perfis caso não exista perfil ativo carregado.
- Contador de notificações agora usa lista vazia quando o perfil ainda não está carregado.

# V5.35.1 — Backup Security Foundation (09/07/2026)

- Adicionado backup completo da conta em JSON (`borion-account-backup`).
- Adicionada tabela `public.borion_backups` no Supabase para snapshots históricos.
- Backups agora aparecem em Configurações → Backups, com opção de baixar e restaurar.
- Adicionado aceite interno de proteção de dados e configuração de pasta local `Backups_Borion`.
- Antes de ações perigosas, como excluir perfil, substituir por JSON ou restaurar conta, o Borion tenta criar backup de segurança (`before_*`).
- Adicionado diagnóstico Supabase para testar INSERT em `borion_backups`.
- Mantidas as funções da V5.35.0/V5.34.9: perfis estilo Netflix, menu mobile, importação JSON, senha por perfil e troca de senha da conta.

# V5.35.0 — Perfis estilo Netflix (09/07/2026)

- Depois de logar na conta, o app agora sempre mostra a tela "Quem é você?" para escolher o perfil financeiro, em vez de entrar direto no último perfil usado.
- Adicionado botão "Trocar de perfil" (⇄) na barra lateral, ao lado do botão de sair — volta para a tela de escolha de perfil sem encerrar a sessão da conta.
- Adicionado link "Sair da conta" nas telas de escolha de perfil, para trocar de conta sem precisar entrar em um perfil primeiro.
- Reforçada a separação já existente em Configurações: aba "Perfis" cuida do nome, senha e foto do perfil financeiro; aba "Nuvem" cuida do e-mail/senha da conta e logout.

# V5.34.9 — Menu mobile/tablet portrait (09/07/2026)

- Adicionado botão de menu tipo hamburger em celulares e tablets na vertical.
- Sidebar agora abre como gaveta lateral com fundo escurecido e botão de fechar.
- Menu fecha por toque fora, botão X, tecla ESC ou escolha de uma seção.
- Mantidas as correções da V5.34.8: importação JSON, senha por perfil e troca de senha da conta.

# V5.34.8 — Importação JSON e Senhas (09/07/2026)

- Importação `.json` na nuvem agora oferece: importar como novo perfil, substituir perfil atual ou mesclar com perfil atual.
- Importação como novo perfil cria linha em `profiles` e linha em `borion_profile_data` já com os dados do JSON.
- Adicionada senha por perfil financeiro, separada da senha da conta/login.
- Adicionadas opções para colocar, trocar e remover senha do perfil.
- Tela de seleção de perfis agora pede senha quando o perfil financeiro tem senha.
- Botão de troca da senha da conta/login ficou visível nas telas de Perfis e Nuvem.
- SQL atualizado com colunas `profiles.password_hash` e `profiles.password_salt`.


## V5.34.7 — Runtime State Fix

- Corrige perfis que só apareciam/deletavam após F5.
- Depois de CREATE/UPDATE/DELETE confirmado pelo Supabase, atualiza CloudStorage, S.profiles, S.currentProfile e localStorage imediatamente.
- Criação de perfil não recarrega a lista inteira logo após o INSERT para evitar lista antiga derrubar o perfil recém-confirmado.
- DELETE agora exige confirmação real da tabela profiles antes de atualizar a tela.

# V5.34.7 — Correção CloudStorage Global (09/07/2026)

- Corrigido bug crítico em `js/17-borion-cloud.js`: `CloudStorage` agora é exportado explicitamente em `window.CloudStorage`.
- O navegador não coloca `const CloudStorage = ...` automaticamente dentro de `window`; por isso verificações como `window.CloudStorage && CloudStorage.user` falhavam.
- Isso fazia o app cair em modo local, não chamar as rotinas reais de Supabase para criar perfil, salvar cor/avatar ou persistir dados.
- Atualizado versionamento do `index.html` e cache do `sw.js` para forçar JS novo no Netlify/PWA.



## V5.34.7 — Supabase Diagnostic Fix

- Removeu a dependência de `upsert(... onConflict: profile_id)` para salvar `borion_profile_data`.
- Agora `SAVE_PROFILE_DATA` faz `SELECT` + `UPDATE` ou `INSERT`, mostrando exatamente se a falha é SELECT, INSERT, UPDATE, RLS, grant ou schema.
- Ao criar perfil, o app confirma `profiles` primeiro e tenta criar a linha inicial em `borion_profile_data` com `INSERT` direto.
- Adicionado botão `Diagnóstico Supabase` em Configurações > Nuvem.
- Adicionada função de console `BorionCloudDiagnostic()`.
- SQL do Supabase reforçado com `create extension pgcrypto`, reparo de colunas antigas, constraint única, grants e reload de schema cache.

# V5.34.4 — Cloud Profile Persistence Fix (09/07/2026)

- Perfis na nuvem agora só mostram sucesso depois de confirmação real do Supabase.
- CREATE_PROFILE confirma insert em `profiles` e cria/valida a linha inicial em `borion_profile_data`.
- UPDATE_PROFILE_META salva `avatar_color` e `avatar_image` em `profiles` com `.select().single()` para confirmar o update.
- LOAD_PROFILES carrega direto de `profiles` ao atualizar a página; localStorage fica apenas como fallback offline.
- LOAD_PROFILE_DATA e SAVE_PROFILE_DATA ganharam logs claros e exibem `error.message/details/hint/code` completos.
- Service Worker atualizado para buscar HTML/JS/CSS primeiro pela rede e evitar cache antigo após deploy no Netlify.

# v5.34.3 - 08/07/2026 — Correção crítica: vazamento de dados entre perfis + cor não persistia + troca de senha real
**Arquivos tocados nesta versão**: `js/17-borion-cloud.js`, `js/13-settings.js`, `js/01-storage-data-state.js`, `js/04-gate-shell.js` (`js/02-backup-local.js` foi revisado e não precisou de mudanças — já isolava dados por perfil corretamente).

- **Bug grave de isolamento entre perfis (corrigido)**: identificada uma janela de corrida em `CloudStorage.switchProfile()`/`enterCloudUser()`: entre o momento em que `activeProfileId` já apontava para o perfil novo e o momento em que `S.data` terminava de carregar (um `await` de rede), uma sincronização automática disparada nesse meio-tempo (aba escondida, `visibilitychange`, `pagehide`, timer de debounce pendente) podia gravar dados do perfil errado. Corrigido zerando `S.data = null` **antes** de trocar `activeProfileId`/`S.currentProfile` em `switchProfile()`, `enterCloudUser()` e `enterProfile()` (modo local) — nesse intervalo, `syncNow()` não faz nada porque já exige `S.data` preenchido.
- **`saveCurrentData()` agora passa o `profileId` explicitamente** para `CloudStorage.queueSave(profileId, data)`, em vez de depender só da variável interna `activeProfileId`. `queueSave`/`syncNow`/`saveNow` cruzam os dois valores e, em caso de divergência (não deveria mais acontecer), usam `CloudStorage.activeProfileId` — nunca `S.currentProfile.id` sozinho — e avisam no console.
- **`createProfile()`**: agora verifica o erro do insert inicial (semente) em `borion_profile_data`, que antes era ignorado silenciosamente; perfil novo sempre nasce com `emptyData()` (nunca herda dados do perfil anterior).
- **Ferramenta de conferência**: `CloudStorage.debugCheckRowsPerProfile()` no console do navegador lista quantas linhas existem em `borion_profile_data` por `profile_id` (usado para validar o teste obrigatório abaixo).
- **Cor/avatar do perfil não persistia (corrigido)**: `renameProfile()` só tentava gravar no Supabase `if(navigator.onLine)` — essa API do navegador é pouco confiável e podia bloquear a gravação real mesmo com internet, revertendo a cor no próximo carregamento. Agora sempre tenta salvar; se falhar de verdade, guarda como pendente (`borion_profile_meta_pending_v1_*`) e tenta de novo sozinho quando a internet volta ou na próxima carga de perfis.
- **Troca de senha real**: novo fluxo com senha atual + nova senha + confirmação (modal, não mais `prompt()`). Reautentica com a senha atual (`signInWithPassword`) antes de chamar `updateUser({password})`; se a senha atual estiver errada, mostra erro e não altera nada. Usuário continua logado após trocar.

# v5.34.2 - 08/07/2026 — Correção crítica: IDs inválidos enviados ao Supabase (uuid)
- **Causa raiz**: `uid()` (usado em todo o app para gerar ids) produzia strings como `id_mrcnv2m73trtphy`, que não são UUID. Perfis locais/importados criados com esse formato podiam acabar em `S.currentProfile.id` e, dali, em `CloudStorage.syncNow()`, que enviava esse valor para a coluna `profile_id` (uuid) de `borion_profile_data` — gerando o erro `invalid input syntax for type uuid` no Supabase.
- **Correção na origem**: `uid()` agora gera um UUID v4 de verdade (`crypto.randomUUID()`, com fallback manual via `crypto.getRandomValues` para contextos sem HTTPS). Isso corrige automaticamente todos os call-sites do app (perfis, transações, contas, cartões, metas, reservas, cheques, agenda, importação de extrato etc.) sem precisar editar um por um.
- **Defesa em profundidade no Cloud Foundation** (`js/17-borion-cloud.js`): adicionado `isValidUUID()` e validação antes de qualquer leitura/escrita em `borion_profile_data` ou `profiles`: `saveActiveProfileId`, `getSavedActiveProfileId`, `loadProfiles` (branch offline), `createProfile`, `switchProfile`, `loadData` e `saveNow`/`syncNow`. Um id antigo/errado nunca mais chega a uma chamada ao Supabase: em vez disso, o app descarta o valor inválido, avisa no console/status e pede para reabrir o perfil, sem travar.
- `syncNow()` agora prioriza `CloudStorage.activeProfileId` (sempre validado como UUID) em vez de confiar direto em `S.currentProfile.id`, fechando a divergência de estado que permitia o envio do id inválido.
- Banco de dados **não foi alterado** — `profiles.id` e `borion_profile_data.profile_id` continuam `uuid`, como pedido.

# v5.34.1 - 08/07/2026 — Revisão e correção da Cloud Foundation
- Saída controlada: sair da conta ou trocar de perfil com sincronização pendente agora abre um aviso com "Salvar e sincronizar agora", "Sair mesmo assim" e "Cancelar" (além do aviso nativo do navegador ao fechar a aba, que continua ativo).
- PWA: banner de instalação agora identifica Android/computador (com botão nativo de instalar) e mostra instrução específica para iPhone/iPad (Safari), já que o Safari não oferece o prompt automático. Adicionado card "Instalar o app" em Configurações → Nuvem.
- manifest.json: adicionado ícone 512×512 com purpose "any" (além do maskable) para melhorar a checagem de instalabilidade no Android.
- IndexedDB: os dados financeiros de cada perfil agora são gravados de verdade no IndexedDB (write-through) a cada alteração, com hidratação a partir do IndexedDB no login local, troca de perfil e fallback offline da nuvem. localStorage segue como cache rápido/síncrono e para configurações simples.
- Supabase/SQL: RLS de `borion_profile_data` reforçado — além de checar o dono da linha (`user_id = auth.uid()`), agora também valida que `profile_id` pertence a um perfil do mesmo usuário autenticado (via EXISTS em `profiles`), nas policies de select/insert/update/delete. Adicionado trigger `borion_profile_data_owner_check` como defesa em profundidade.
- Importação: removida a definição duplicada/morta de `handleImport` (o arquivo tinha duas funções com o mesmo nome; só a segunda — ciente do perfil ativo na nuvem — realmente rodava). Restaurado o suporte a backup completo (`multicap-full-backup`) no fluxo local/sem login, que tinha sido perdido nessa limpeza.
- Importação de extrato (CSV/OFX/TXT/PDF): adicionadas as ações "Revisar duplicidade" (lista só os possíveis duplicados e pede confirmação explícita antes de incluí-los), "Revisar antes de importar" (mostra a lista final antes de gravar) e "Importar como saldo de reserva" (lança os itens selecionados como movimentações de uma reserva, em vez de lançamentos comuns).
- sw.js: cache renomeado para `borion-finance-v5-34-1-cloud-hardening` para forçar atualização após o deploy.

# v5.25 - 07/07/2026
- Primeira versão oficial de lançamento do Borion Finance.

# CHANGELOG — Borion Finance

## 2026-07-06 — Modularização inicial

- Extraído CSS do `index.html` para `css/styles.css`.
- Extraído JavaScript do `index.html` para arquivos separados em `js/`.
- Criado `MAPA_DO_APP.md` para orientar futuras alterações com IA.
- Criado `PROMPT_PADRAO_IA.md` para pedir alterações menores e economizar tokens.
- Atualizado `LEIA-ME.md` com instruções da nova estrutura modular.
- Atualizado `sw.js` para cachear os novos arquivos CSS/JS.
- Mantido `index.html` como arquivo principal de abertura do app.

## 2026-07-07 — Perfis novos zerados
- Removido o uso de dados de demonstração no primeiro perfil.
- Todo perfil novo agora inicia com transações, contas, cartões, investimentos, liquidez, bens, agenda, metas e histórico vazios.
- Mantidas apenas as categorias padrão para facilitar lançamentos.
- Atualizado o cache do service worker para `borion-finance-v4-modular-zero`.

## 2026-07-06 — Tema Borion Private
- Visual refinado para aparência mais premium e financeira.
- Sidebar com estado ativo mais discreto e institucional.
- Cards, painéis, botões e campos suavizados com menos blocos coloridos.
- Fundo/identidade visual atualizado com nova logo e opacidade reduzida no plano de fundo.
- Ícones principais do menu simplificados.
- Mantida a correção para iniciar perfis novos zerados.

## 2026-07-06 — Ajustes finos do visual
- Tela de entrada agora usa o emblema em PNG transparente, sem o retângulo escuro da arte completa.
- Cards-resumo da tela Orçamento receberam ícones mais finos e discretos no lugar dos emojis.

## 2026-07-06 — V3 Private Banking
- Refinamento visual geral com aparência mais luxuosa e institucional.
- Ícones de Patrimônio, Orçamento, Cartões/Contas, Agenda, Configurações e topo foram suavizados para reduzir aparência de emoji.
- Tela inicial/login recebeu acabamento mais premium com emblema transparente e moldura sutil.
- Cards e painéis receberam acabamento mais sofisticado.
- Corrigido bug do filtro por banco na tela Orçamento: receitas e despesas variáveis agora obedecem ao filtro global de banco.
- Cartões e contas também passam a respeitar o filtro global de banco na listagem.

## 2026-07-07 — Módulo de Cheques
- Adicionado módulo opcional de cheques em Configurações.
- Nova guia Cheques aparece no menu quando ativada.
- Controle de cheques recebidos e emitidos, com status, banco, número, valor, pessoa, lote, datas, baixa e devolução.
- Gerador de cheques em lote com intervalo de dias.
- Resumo com recebidos/emitidos em aberto, próximos 7 dias, vencidos, devolvidos e compensados no mês.
- O filtro global de banco também afeta a tela de cheques.

## 2026-07-07 — V5.17 Importador de Extratos
- Nova guia Importar Extrato acima de Configurações; se Cheques estiver ativo, fica abaixo de Cheques.
- Importação assistida de CSV, OFX, TXT e PDF textual.
- Detecção automática provável de banco/conta pelo conteúdo do arquivo e nome do arquivo.
- Tela de revisão antes de lançar, com edição de data, descrição, valor, tipo, categoria e banco.
- Duplicados são sinalizados e desmarcados por segurança.
- Importação seletiva para receitas, despesas variáveis e, se escolhido manualmente, despesas fixas recorrentes.
## 2026-07-07 — V5.18 Reservas, Configurações e Dashboard Flexível
- Adicionado módulo de Reserva dentro de Patrimônio.
- Configurações reorganizadas em abas: módulos, dashboard, perfis, categorias, personalização e backups.
- Cheques, Reservas e Importador de Extratos agora podem ser ativados/desativados.
- Visão Geral ganhou controle individual de blocos/gráficos, com ativação trazendo o bloco para o topo.
- Perfil agora permite foto de avatar ou cor personalizada para as iniciais.

## 2026-07-07 — Correção da máscara de valores no splash
- Corrigido bug em que a animação de carregamento mostrava literalmente `<span class="value-mask">...</span>` quando os valores estavam ocultos.
- A animação inicial agora usa formatação monetária sem máscara, independente da opção de ocultar valores.
- A opção de mostrar/ocultar valores continua funcionando normalmente dentro do app.

## 2026-07-07 — V5.20 Reserva, Dashboard e Tema
- Reserva virou guia separada no menu, abaixo de Patrimônio.
- Patrimônio agora mostra Reserva como resumo recolhível, com total incluído no patrimônio.
- Configurações do Dashboard mantêm os botões em ordem fixa; só a Visão Geral muda/reordena os blocos ativos.
- Adicionado liga/desliga dos popups de notificação e duração de 30, 40 ou 50 segundos.
- Adicionado tema Claro/Branco e opção Tema do sistema.

## 2026-07-07 — V5.21 Correção do tema claro
- Ajustado contraste do seletor de mês no tema claro.
- Corrigidas abas/segmentadores no tema claro, incluindo Orçamento e BR/US em Investimentos.
- Corrigida a tela Cartões e Contas, removendo cartões escuros ilegíveis no tema claro.
- Refinados botões de filtro por banco e painel do filtro no tema claro.

## 2026-07-07 — Splash respeita tema escolhido
- Tela de carregamento agora respeita a última escolha do usuário: escuro, claro ou sistema.
- Adicionado pré-carregamento do tema antes do CSS para evitar flash visual.
- Animação de R$ 0,00 a R$ 1.000.000,00 continua independente da máscara de valores.

## 2026-07-07 — V5.23 Ajuste do calendário no tema claro
- Corrigido o seletor de mês no topo para respeitar o tema claro.
- Removido o visual preto do calendário/seletor mensal no tema branco.
- Aplicado acabamento branco, dourado e discreto para combinar com o tema claro premium.

## 2026-07-07 — V5.24 Popup ao entrar no app
- Corrigido o comportamento d