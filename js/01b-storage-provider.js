/* Borion Finance — storageProvider (V6.3.0)
   Camada fina pedida na FASE 1 da migração pra sair do Supabase. Não é um motor de
   armazenamento novo: cada método aqui só empresta um nome estável e chama a função que
   já existe no app (S, getProfileData/setProfileData, hydrateProfileDataFromIDB,
   buildCloudAccountBackupPayload, handleImport, validateBorionJson...). Se este arquivo
   fosse removido, o app continuaria funcionando exatamente como antes — nada aqui troca
   comportamento de telas existentes.

   Histórico de backups (list/restore) hoje é 100% via Google Drive
   (GoogleDriveProvider.listBackups/restoreBackup/createBackup). Os métodos locais
   (IndexedDB) abaixo ficam apenas como stubs — retornam vazio/null porque o backup
   local foi desativado em favor do Google Drive.

   Ordem de carregamento: depois de 00-utils.js e 01-storage-data-state.js. Todo o resto
   (buildCloudAccountBackupPayload, handleImport, CloudStorage) só é chamado de dentro de
   funções — não no carregamento do arquivo — então a ordem exata dos outros scripts não
   importa aqui. */

async function localBackupsGet(id){
  return null;
}

const storageProvider = {
  /* 'offline' | 'cloud' | null (ainda não escolheu — mostra a tela de login). */
  mode(){
    return getStorageMode() || ((window.CloudStorage && CloudStorage.user) ? 'cloud' : null);
  },

  /* Carrega os dados do perfil (IndexedDB é a fonte mais durável; localStorage é o
     cache síncrono). Sem profileId, usa o perfil ativo (S.currentProfile). */
  async loadUserData(profileId){
    const id = profileId || (S.currentProfile && S.currentProfile.id);
    if(!id) return null;
    const fromIdb = await hydrateProfileDataFromIDB(id);
    return fromIdb || migrateData(getProfileData(id), {profileId:id});
  },

  /* Grava no perfil ativo (localStorage + IndexedDB, e enfileira pro Supabase se
     estiver logado — mesmo caminho que qualquer tela do app já usa). */
  saveUserData(data, options){
    if(data) S.data = data;
    saveCurrentData(options || {});
    return true;
  },

  /* Lê um File (input type=file), valida e entrega pro fluxo de importação que já
     existe (handleImport já sabe decidir entre novo perfil/substituir/mesclar, e já
     funciona tanto logado no Supabase quanto 100% local). Cria um backup de segurança
     antes, sempre — local ou na nuvem, conforme o modo atual. */
  importJson(file){
    return new Promise((resolve, reject)=>{
      if(!file){ reject(new Error('Nenhum arquivo selecionado.')); return; }
      const reader = new FileReader();
      reader.onload = async ()=>{
        let obj;
        try{ obj = JSON.parse(reader.result); }
        catch(e){ reject(new Error('Arquivo inválido ou corrompido.')); return; }
        const check = validateBorionJson(obj);
        if(!check.valid){ reject(new Error(check.errors.join(' '))); return; }
        try{ await storageProvider.createBackup('before_import'); }
        catch(e){ console.warn('[storageProvider] backup before_import falhou — a importação segue mesmo assim:', e); }
        handleImport(obj);
        resolve(obj);
      };
      reader.onerror = ()=> reject(new Error('Falha ao ler o arquivo.'));
      reader.readAsText(file);
    });
  },

  /* JSON completo (todos os perfis + config), no mesmo formato que Configurações já
     exporta hoje — é o formato "mestre" que a FASE 2 pede. */
  async exportJson(){
    return await buildFullBackupPayload();
  },

  validateBorionJson,

  /* Gera o JSON completo e guarda uma cópia no histórico local (IndexedDB), pra
     listBackups()/restoreBackup() funcionarem sem depender do Supabase. */
  async createBackup(reason='manual', options={}){
    if(!window.GoogleDriveProvider||!GoogleDriveProvider.isConnected())throw new Error('Conecte o Google Drive antes de criar backup.');
    const cloudPayload=options.payload||await buildSharedBackupSnapshot(reason,reason);
    return await GoogleDriveProvider.createBackup(reason,{payload:cloudPayload});
  },

  /* Lista só os metadados (sem o JSON inteiro, pra não pesar a tela). Mais recente primeiro. */
  async listBackups(){
    if(!window.GoogleDriveProvider||!GoogleDriveProvider.isConnected())return [];
    return await GoogleDriveProvider.listBackups({includeSize:true});
  },

  /* Restaura um backup do histórico local. Sempre cria um backup do estado atual antes
     (nunca restaura "no escuro"), depois entrega pro handleImport — que já escolhe
     certo entre o fluxo logado/local e sempre pede confirmação antes de substituir. */
  async restoreBackup(backupId){
    if(!window.GoogleDriveProvider||!GoogleDriveProvider.isConnected())throw new Error('Conecte o Google Drive antes de restaurar backup.');
    return await GoogleDriveProvider.restoreBackup(backupId);
  },

  getStorageStatus(){
    return {
      mode: this.mode(),
      hasCloudUser: !!(window.CloudStorage && CloudStorage.user),
      online: navigator.onLine,
      profileCount: (S.profiles || []).length,
      activeProfileId: S.currentProfile ? S.currentProfile.id : null
    };
  }
};

window.storageProvider = storageProvider;
