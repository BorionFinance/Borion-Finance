# Borion Finance 6.40.2 — Revisão crítica de Dados e Segurança

## Decisão arquitetural

Para o Borion atual — PWA, poucos usuários e Google Drive como armazenamento oficial — o journal de operações imutáveis continua sendo a alternativa mais segura e compatível. O `current.json` passa a ser somente snapshot consolidado. Uma alteração só chega ao estado final depois de: salvar localmente, criar uma operação imutável, consolidar, validar o checksum e reler o snapshot confirmado.

Comparação objetiva:

| Opção | Segurança e recuperação | Complexidade/desempenho | Compatibilidade/custo | Offline e limite prático |
|---|---|---|---|---|
| Journal imutável no Drive | Melhor alternativa atual; operações sobrevivem a colisões e falhas de snapshot | Moderada; exige paginação, idempotência e compactação | Mantém Drive e PWA atuais, sem backend pago | Bom offline; adequado ao grupo pequeno do Borion |
| Um arquivo por perfil | Reduz impacto de uma colisão, mas continua com last-writer-wins dentro de cada perfil | Mais simples, porém ainda precisa de journal ou trava inexistente | Migração viável | Offline razoável; não resolve edição concorrente |
| Um arquivo por entidade | Boa granularidade, recuperação localizada | Muitas chamadas, arquivos e listagens; grande complexidade | Custo operacional alto na Drive API | Pode degradar rapidamente com muitos registros |
| Backend transacional externo | Melhor consistência técnica e consultas | Exige servidor, autenticação, banco, monitoramento e migração | Maior custo e mudança de infraestrutura | Offline precisa de outro motor de fila; escala melhor |
| Apenas `current.json` | Inseguro; sobrescrita concorrente pode perder dados | Simples e rápido apenas no caso sem concorrência | Compatível, mas não aceitável | Offline frágil; inadequado até para dois dispositivos |


## Correção adicional 6.40.2 — exclusão de perfil entre dispositivos

Foi corrigido o fluxo em que um perfil excluído no celular podia continuar aberto no computador até outra alteração disparar a sincronização. Agora:

- a exclusão cria o tombstone e reserva imediatamente o mesmo `operationId` usado pela operação do journal;
- `queueSave()` é chamado obrigatoriamente após a remoção local;
- quando online e na aba líder, a consolidação é tentada imediatamente, sem aguardar o debounce;
- uma aba secundária delega o envio para a líder e recebe a aplicação do snapshot confirmado;
- se o perfil excluído estiver aberto em outro dispositivo, ele é encerrado e a tela volta para a seleção de perfis;
- uma edição pendente em dispositivo antigo não pode ressuscitar o perfil; ela fica preservada apenas em `accountConflicts` para recuperação;
- caches locais e pendências de saída do perfil tombstonado são removidos somente após existir tombstone explícito.

## Diagnósticos verificados

Todos os doze diagnósticos do pedido procediam no código original. Também foi encontrada uma falha adicional crítica: perfis eram cortados silenciosamente com `slice(0,5)` em alguns fluxos e havia bloqueios artificiais de “máximo cinco perfis”. Esses cortes foram removidos.

1. Cursor baseado em horário: substituído por deduplicação durável por `operationId`; horário ficou apenas para ordenação e retenção.
2. Paginação: `listChildren` percorre todas as páginas, deduplica, ordena de forma estável, respeita limites configuráveis e falha fechado quando uma página não pode ser lida.
3. Pastas duplicadas: todas as árvores `Borion_Sync`, `operations`, `snapshots`, `conflicts` e `backups` são descobertas; uma canônica é escolhida deterministicamente e as demais continuam sendo lidas até limpeza comprovadamente segura.
4. Múltiplas abas: follower salva localmente e delega; somente a líder chama a rede. Há `navigator.locks` quando disponível e lease/heartbeat com `BroadcastChannel` como fallback.
5. Tombstones: foi criada `BorionDataActions6401.deleteEntity/deleteProfile`; remoções reais e remoções implícitas detectadas no salvamento geram tombstones persistentes.
6. IDs legados: UUID aleatório foi substituído por hash determinístico com versão, perfil, coleção, conteúdo canônico e ocorrência histórica.
7. Merge: inventário explícito do schema; entidades por ID, listas primitivas por união estável, configurações por merge de três vias, ordens por IDs conhecidos e conflitos no mesmo campo.
8. Backup pré-migração: bytes originais são copiados antes da transformação, conferidos por checksum e relidos como backup restaurável. O marcador anterior é revalidado; falha bloqueia toda migração. A aplicação de todos os perfis é atômica e possui rollback local.
9. Consolidação no boot: o journal é descoberto, listado e consolidado antes de a conta ser aplicada à interface. Pendência mantém estado de recuperação, nunca “sincronizado”.
10. Operações com snapshot completo: mantidas temporariamente para compatibilidade, com formato declarado e teto de 15 MB. O motor aceita mutações, mas a migração completa para deltas foi adiada até todos os caminhos de escrita produzirem mutações confiáveis.
11. Compactação: uma operação só pode ir para a lixeira após constar como aplicada, ter efeito no snapshot validado, backup confirmado, janela de dispositivos e retenção cumpridas. A limpeza para na primeira falha. A limpeza antiga de backups também foi paginada e convertida de `DELETE` definitivo para lixeira.
12. Status: separado em local, pendente, protegendo no Drive, protegida, consolidando, snapshot confirmado, conflito, offline, autenticação, erro de journal e recuperação.

## Arquivos centrais modificados

- `js/01-storage-data-state.js`
- `js/01b-storage-provider.js`
- `js/01c-google-drive-provider.js`
- `js/01e-sync-core-v640.js`
- `js/01f-sync-queue-v640.js`
- `js/01g-drive-journal-v640.js`
- `js/01h-multitab-v640.js`
- `js/02-backup-local.js`
- `js/04-gate-shell.js`
- `js/13-settings.js`
- `js/14-events-boot-pwa.js`
- `js/17-borion-cloud.js`
- `js/23-profile-import-review.js`
- `js/24-interconnections.js`
- `index.html`, `manifest.json`, `sw.js`

## Novos testes

- `tests/test_atomic_account_apply_v6401.js`
- `tests/test_backup_gate_v6401.js`
- `tests/test_drive_pagination_v6401.js`
- `tests/test_journal_v6401.js`
- `tests/test_merge_schema_v6401.js`
- `tests/test_migration_preservation_v6401.js`
- `tests/test_multitab_v6401.js`
- `tests/test_real_delete_tombstones_v6401.js`
- `tests/run_all.js`

## Procedimento manual no navegador

1. Faça cópia externa da pasta atual do Drive e do ZIP que está em produção.
2. Abra a versão 6.40.2 em uma janela anônima para garantir cache limpo.
3. Conecte a pasta habitual do Google Drive; não escolha uma pasta nova.
4. Confirme que todos os perfis existentes aparecem com os mesmos nomes e IDs.
5. Em cada perfil, compare contas, cartões, reservas, categorias, configurações, vínculos e totais financeiros.
6. Crie uma receita pequena, aguarde os estados “Alteração protegida no Drive”, “Consolidando dados” e “Sincronizado com o Drive”.
7. Atualize a página. O registro deve continuar visível sem nova edição.
8. Exclua um registro de teste, atualize a página e confirme que ele não volta.
9. Desative a internet, crie outro registro, atualize um campo e confirme “Salvo neste dispositivo/operação pendente”. Reative a internet e confirme a retomada.
10. Abra Configurações e valide que o texto visual continua “6.40 — Dados e Segurança”.

## Procedimento com duas abas e dois dispositivos

1. Abra a mesma conta em duas abas do computador. Crie um registro na aba secundária e observe que ela delega; apenas a líder deve fazer upload.
2. Feche a aba líder. Após a expiração do lease, altere outro registro na aba restante e confirme a sincronização.
3. Abra a mesma pasta no celular e no computador.
4. No computador, crie uma receita. Antes de editar novamente, aguarde a confirmação do snapshot.
5. No celular, crie uma despesa com o relógio manualmente atrasado. O registro deve aparecer no computador mesmo com timestamp antigo.
6. Faça alterações simultâneas em campos diferentes do mesmo item; ambas devem sobreviver.
7. Altere o mesmo campo nos dois dispositivos; o Borion deve registrar conflito em vez de descartar silenciosamente um lado.
8. Exclua no celular e tente editar uma cópia antiga no computador; o item não pode ressuscitar automaticamente.
9. Feche ambos depois de uma operação protegida, mas antes de uma consolidação simuladamente interrompida; ao reabrir, a operação deve ser consolidada no boot.

## Rollback

1. Não apague a pasta `Borion_Sync` nem os arquivos de operação.
2. Desative a publicação da 6.40.2 e restaure o ZIP/site anterior.
3. Antes de abrir a versão antiga para escrita, copie toda a pasta do Drive.
4. Prefira restaurar o `current.json` a partir do backup `backup_original_pre_migracao_v6401_*.json` ou de um snapshot diário validado.
5. Confira checksum, quantidade/IDs dos perfis e totais por perfil antes de substituir qualquer arquivo.
6. Se houver operações posteriores ao snapshot escolhido, não as apague: mantenha a 6.40.2 em ambiente isolado para consolidá-las e exportar uma base completa.

## Limitações assumidas

- A integração real com a Google Drive API precisa de teste final com credenciais e rede reais; a suíte automatizada usa simulações determinísticas.
- Não foi fornecido um ZIP histórico real da 6.38.4 como fixture. A preservação foi testada com bases legadas representativas passando pelas funções reais de migração.
- Operações continuam contendo snapshot completo temporariamente, limitadas a 15 MB. A evolução para mutações puras deve ocorrer em uma versão posterior e somente depois de instrumentar todos os caminhos de gravação.
- Pastas duplicadas são logicamente unificadas na leitura; não são enviadas automaticamente à lixeira sem as condições conservadoras de segurança.
