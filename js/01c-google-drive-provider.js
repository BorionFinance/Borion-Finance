/* Borion Finance — Google Drive Provider (V6.4.0, FASE 3 da migração)

   Modelo "central" que você escolheu: cada pessoa entra com a PRÓPRIA conta Google
   (login e token de acesso individuais, nada de segredo compartilhado). A primeira vez,
   ela escolhe (via seletor nativo do Google — o "Picker") a pasta que você compartilhou
   com o e-mail dela. Depois disso, o Borion guarda o ID dessa pasta neste navegador e
   nunca mais precisa abrir o seletor — lê e escreve direto nela pela Drive API.

   Isso É ADITIVO: ninguém que usa modo local ou conta Supabase é afetado. Só entra em
   ação quando a pessoa escolhe "Entrar com Google (Drive)" ou quando STORAGE_MODE já
   salvo for 'google_drive'.

   Arquivo principal por pasta: current.json — o mesmo formato de "backup completo da
   conta" que o app já usa (type: borion-account-backup, profiles[], dataByProfile{}).
   Isso significa que o current.json de qualquer pessoa já é abrível/legível pelo botão
   normal de "Importar backup" do app, mesmo fora do fluxo Google.

   Autenticação: Google Identity Services (token client, OAuth 2.0 implícito) — só
   pede o escopo drive.file (a pessoa só concede acesso à pasta que ela mesma abrir pelo
   Picker, nunca ao Drive inteiro dela) + openid/email/profile só pra saber quem é quem.
*/

const GOOGLE_CLIENT_ID = '946105310952-gp143h81mm3704lrq3877hsie49njgak.apps.googleusercontent.com';
const GOOGLE_API_KEY = 'AIzaSyAMm_8CtFg_YP2ssG4XaiBbOc7wuJFq7xs';
const GOOGLE_PROJECT_NUMBER = '946105310952';
const GOOGLE_DRIVE_SCOPES = 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/drive.file';
/* V6.8.0 — teto de tamanho da pasta "backups" no Drive, combinado com você: 10GB.
   Com arquivos de ~1MB cada, dá muito espaço de sobra; o histórico completo continua
   no disco local de qualquer forma, então apagar os mais antigos do Drive é seguro. */
const GOOGLE_DRIVE_BACKUP_MAX_BYTES = 10 * 1024 * 1024 * 1024;
/* V6.20.0 — pedido: trocar os 3 slots girando a cada ~4-5min (90s × 3) por uma janela
   bem mais fina — 1 save por minuto, girando entre 20 slots (autosave-1.json ...
   autosave-20.json). Dá ~20 minutos de histórico curto granular, minuto a minuto. */
const GOOGLE_DRIVE_AUTOSAVE_INTERVAL_MS = 60 * 1000;
const GOOGLE_DRIVE_AUTOSAVE_IDLE_KICK_MS = 3 * 1000;
const GOOGLE_DRIVE_AUTOSAVE_RETRY_MS = 15 * 1000;
const GOOGLE_DRIVE_AUTOSAVE_SLOTS = 20;
/* V6.20.0 — novo: além do autosave automático acima, cada Ctrl+S (forceSyncNow)
   agora também grava num rodízio PRÓPRIO de até 40 slots (forcesave-1.json ...
   forcesave-40.json), separado do autosave normal — histórico só dos momentos em que
   você mesmo decidiu "salvar agora", que tende a ser justamente antes/depois dos
   pontos que você quer poder voltar. Ver forceSyncNow(). */
const GOOGLE_DRIVE_FORCESAVE_SLOTS = 40;

const LS_GDRIVE_FOLDER_PREFIX = 'borion_gdrive_folder_'; // + googleSub -> folderId
const LS_GDRIVE_USER = 'borion_gdrive_user'; // cache do último usuário Google {sub,email,name,picture}

function gdriveReadFolderId(sub){ return localStorage.getItem(LS_GDRIVE_FOLDER_PREFIX + sub) || null; }
function gdriveWriteFolderId(sub, id){ localStorage.setItem(LS_GDRIVE_FOLDER_PREFIX + sub, id); }
function gdriveForgetFolderId(sub){ localStorage.removeItem(LS_GDRIVE_FOLDER_PREFIX + sub); }

/* V6.11.0 — persiste o ID da subpasta "backups", keyed pela pasta principal (não pela
   conta) — assim, qualquer sessão que conecte na mesma pasta principal reaproveita a
   mesma subpasta de backups sem precisar buscar por nome de novo (ver ensureBackupsFolder). */
const LS_GDRIVE_BACKUPS_FOLDER_PREFIX = 'borion_gdrive_backups_folder_';
function gdriveReadBackupsFolderId(mainFolderId){ return localStorage.getItem(LS_GDRIVE_BACKUPS_FOLDER_PREFIX + mainFolderId) || null; }
function gdriveWriteBackupsFolderId(mainFolderId, id){ localStorage.setItem(LS_GDRIVE_BACKUPS_FOLDER_PREFIX + mainFolderId, id); }

/* V6.12.0 — mesma ideia, agora pro arquivo de cada slot de autosave (evita duplicar
   autosave-1.json/2.json/3.json quando duas abas ou sessões calculam o mesmo slot perto
   uma da outra). Keyed por pasta de backups + número do slot. */
/* V6.20.0 — generalizado pra servir os dois rodízios (autosave e forcesave), cada um
   com seu próprio "namespace" de slots — sem isso, "slot 5" do autosave e "slot 5" do
   forcesave colidiriam na mesma chave e um pisaria no ID de arquivo do outro. */
const LS_GDRIVE_AUTOSAVE_FILE_PREFIX = 'borion_gdrive_autosave_file_';
function gdriveReadAutosaveFileId(folderId, kind, slot){ return localStorage.getItem(LS_GDRIVE_AUTOSAVE_FILE_PREFIX + kind + '_' + folderId + '_' + slot) || null; }
function gdriveWriteAutosaveFileId(folderId, kind, slot, id){ localStorage.setItem(LS_GDRIVE_AUTOSAVE_FILE_PREFIX + kind + '_' + folderId + '_' + slot, id); }

/* V6.20.0 — bug real corrigido: o índice de rotação (qual slot é "o próximo") vivia
   só em memória (this.autosaveSlotIndex = 0 sempre no boot). Como o Google Drive não
   é consultado pra descobrir "qual slot foi escrito por último", cada F5/fechar-e-abrir
   aba fazia a rotação recomeçar do slot 1 — o que podia sobrescrever um slot recente
   fora de ordem e deixar, por um tempo, um slot MAIS ANTIGO com "cara" de mais recente
   dentro da pasta (ex: reabrir o app 2x seguidas dava a impressão de "voltar" pra uma
   versão de alguns minutos atrás, até a rotação se realinhar sozinha depois de mais
   alguns ciclos). Agora o índice fica salvo por pasta, sobrevive a reload/fechar aba,
   e cada slot novo é sempre realmente o próximo depois do último gravado nesta pasta,
   nunca o slot 1 de novo por acaso. Mesma lógica serve autosave e forcesave (Ctrl+S),
   com chaves separadas (kind='autosave' | 'forcesave'). */
const LS_GDRIVE_SLOT_INDEX_PREFIX = 'borion_gdrive_slot_index_';
function gdriveReadSlotIndex(folderId, kind){
  const raw = localStorage.getItem(LS_GDRIVE_SLOT_INDEX_PREFIX + kind + '_' + folderId);
  const n = raw != null ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
function gdriveWriteSlotIndex(folderId, kind, index){
  try{ localStorage.setItem(LS_GDRIVE_SLOT_INDEX_PREFIX + kind + '_' + folderId, String(index)); }catch(e){}
}

/* V6.16.0 — marcador "existe alteração local ainda não confirmada no Drive",
   persistido (sobrevive a reload/fechar aba) — ver queueSave()/syncNow()/loadFromDrive(). */
const LS_GDRIVE_PENDING_PREFIX = 'borion_gdrive_pending_';
function gdrivePendingKey(folderId){ return LS_GDRIVE_PENDING_PREFIX + folderId; }

/* ---------------- Autenticação (Google Identity Services) ---------------- */
const GoogleDriveAuth = {
  tokenClient: null,
  accessToken: null,
  tokenExpiresAt: 0,
  user: null, // {sub, email, name, picture}
  _gisReady: false,
  _gapiReady: false,

  loadScript(src){
    return new Promise((resolve, reject)=>{
      if(document.querySelector(`script[src="${src}"]`)){ resolve(); return; }
      const s = document.createElement('script');
      s.src = src; s.async = true; s.defer = true;
      s.onload = ()=>resolve();
      s.onerror = ()=>reject(new Error('Falha ao carregar script do Google (' + src + '). Verifique sua internet.'));
      document.head.appendChild(s);
    });
  },

  async ensureLoaded(){
    if(!this._gisReady){
      await this.loadScript('https://accounts.google.com/gsi/client');
      this._gisReady = true;
    }
    if(!this._gapiReady){
      await this.loadScript('https://apis.google.com/js/api.js');
      await new Promise((resolve)=>{ gapi.load('picker', resolve); });
      this._gapiReady = true;
    }
  },

  /* interactive=true abre popup de consentimento; false tenta renovar token em
     silêncio (só funciona se a pessoa já autorizou antes nesta sessão do navegador). */
  requestToken(interactive){
    return new Promise((resolve, reject)=>{
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_DRIVE_SCOPES,
        callback: (resp)=>{
          if(resp.error){ reject(new Error('Google recusou o acesso: ' + resp.error)); return; }
          this.accessToken = resp.access_token;
          this.tokenExpiresAt = Date.now() + ((resp.expires_in || 3300) * 1000);
          resolve(resp.access_token);
        },
        error_callback: (err)=>{ reject(new Error((err && err.message) || 'Login com Google cancelado ou falhou.')); }
      });
      this.tokenClient.requestAccessToken({ prompt: interactive ? 'consent' : '' });
    });
  },

  async login(interactive){
    await this.ensureLoaded();
    await this.requestToken(interactive);
    return await this.fetchUserInfo();
  },

  async ensureFreshToken(){
    if(this.accessToken && Date.now() < this.tokenExpiresAt - 60000) return this.accessToken;
    await this.ensureLoaded();
    return await this.requestToken(false);
  },

  async fetchUserInfo(){
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + this.accessToken }
    });
    if(!res.ok) throw new Error('Não foi possível confirmar a conta Google (status ' + res.status + ').');
    const info = await res.json();
    this.user = { sub: info.sub, email: info.email, name: info.name || info.email, picture: info.picture || '' };
    writeJSON(LS_GDRIVE_USER, this.user);
    return this.user;
  },

  signOut(){
    if(this.accessToken){ try{ google.accounts.oauth2.revoke(this.accessToken, ()=>{}); }catch(e){} }
    this.accessToken = null; this.tokenExpiresAt = 0; this.user = null;
    localStorage.removeItem(LS_GDRIVE_USER);
  }
};

/* ---------------- Chamadas cruas à Drive API ---------------- */
const GoogleDriveFS = {
  async authHeaders(){
    const token = await GoogleDriveAuth.ensureFreshToken();
    return { Authorization: 'Bearer ' + token };
  },

  async findChild(parentId, name, mimeType){
    const safeName = name.replace(/'/g, "\\'");
    let q = `'${parentId}' in parents and name='${safeName}' and trashed=false`;
    if(mimeType) q += ` and mimeType='${mimeType}'`;
    const url = 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) + '&fields=' + encodeURIComponent('files(id,name,modifiedTime,mimeType)');
    const res = await fetch(url, { headers: await this.authHeaders() });
    if(!res.ok) throw new Error('Falha ao consultar o Google Drive (status ' + res.status + ').');
    const data = await res.json();
    return (data.files && data.files[0]) || null;
  },

  async createFolder(parentId, name){
    const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, await this.authHeaders()),
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] })
    });
    if(!res.ok) throw new Error('Falha ao criar pasta "' + name + '" no Google Drive.');
    return await res.json();
  },

  async findOrCreateFolder(parentId, name){
    const existing = await this.findChild(parentId, name, 'application/vnd.google-apps.folder');
    if(existing) return existing;
    return await this.createFolder(parentId, name);
  },

  async readFile(fileId){
    const res = await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media', { headers: await this.authHeaders() });
    if(!res.ok) throw new Error('Falha ao ler arquivo do Google Drive (status ' + res.status + ').');
    return await res.json();
  },

  async getFileMeta(fileId){
    const res = await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?fields=id,name,modifiedTime', { headers: await this.authHeaders() });
    if(!res.ok){
      const err = new Error('Falha ao consultar metadados do arquivo no Drive (status ' + res.status + ').');
      err.status = res.status;
      throw err;
    }
    return await res.json();
  },

  async createFile(parentId, name, obj){
    const boundary = 'borion_' + Date.now();
    const metadata = { name, parents: [parentId], mimeType: 'application/json' };
    const body = '--' + boundary + '\r\n'
      + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + '\r\n'
      + '--' + boundary + '\r\n'
      + 'Content-Type: application/json\r\n\r\n' + JSON.stringify(obj) + '\r\n'
      + '--' + boundary + '--';
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'multipart/related; boundary=' + boundary }, await this.authHeaders()),
      body
    });
    if(!res.ok) throw new Error('Falha ao criar arquivo "' + name + '" no Google Drive.');
    return await res.json();
  },

  async updateFile(fileId, obj){
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media&fields=id,name,modifiedTime', {
      method: 'PATCH',
      headers: Object.assign({ 'Content-Type': 'application/json' }, await this.authHeaders()),
      body: JSON.stringify(obj)
    });
    if(!res.ok) throw new Error('Falha ao salvar no Google Drive (status ' + res.status + ').');
    return await res.json();
  }
};

/* Abre o seletor nativo do Google ("Picker") pra pessoa escolher a pasta que foi
   compartilhada com ela. Só roda na primeira conexão — depois o folderId fica salvo. */
function openDriveFolderPicker(){
  return new Promise((resolve, reject)=>{
    const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
      .setSelectFolderEnabled(true)
      .setIncludeFolders(true)
      .setMimeTypes('application/vnd.google-apps.folder');
    const picker = new google.picker.PickerBuilder()
      .setTitle('Escolha a pasta do Borion Finance compartilhada com você')
      .addView(view)
      .setOAuthToken(GoogleDriveAuth.accessToken)
      .setDeveloperKey(GOOGLE_API_KEY)
      .setAppId(GOOGLE_PROJECT_NUMBER)
      .setCallback((data)=>{
        if(data.action === google.picker.Action.PICKED){ resolve(data.docs[0]); }
        else if(data.action === google.picker.Action.CANCEL){ reject(new Error('Nenhuma pasta selecionada.')); }
      })
      .build();
    picker.setVisible(true);
  });
}

/* Aplica um payload de conta (mesmo formato de buildFullBackupPayload) direto no
   estado local, SEM mostrar modal de escolha — é o equivalente, pro Google Drive, do
   que enterCloudUser() faz para o Supabase: carregar e pronto, sem perguntar nada,
   porque é o carregamento normal de entrada, não uma importação manual. */
function applyAccountPayloadSilently(obj){
  S.config = obj.config || S.config;
  S.profiles = (obj.profiles || []).slice(0, 5);
  setConfig(S.config); setProfiles(S.profiles);
  Object.keys(obj.dataByProfile || {}).forEach(pid=>{
    const d = migrateData((obj.dataByProfile || {})[pid] || emptyData());
    setProfileData(pid, d);
  });
  S.currentProfile = null; S.data = null;
}

/* ---------------- Provider principal ---------------- */
const GoogleDriveProvider = {
  folderId: null,
  currentFileId: null,
  currentFileMeta: null,
  dirty: false,
  syncTimer: null,
  autosaveTimer: null,
  autosaveKickTimer: null,
  autosaveSlotIndex: 0,
  forcesaveSlotIndex: 0,
  autosaveDirtySinceLast: false,
  lastAutosaveAt: 0,
  _autosaveRevision: 0,
  _autosaveInFlight: false,
  _syncInFlight: false,
  _syncAgain: false,
  _forceRequested: false,
  _forceSavePromise: null,

  isConnected(){ return !!(GoogleDriveAuth.user && this.folderId); },

  /* Login + (primeira vez) escolher pasta + carregar/ou perguntar o que fazer. Essa
     função já decide sozinha pra qual tela ir (Gate normal ou onboarding de pasta
     vazia) — quem chama connect() não precisa mais renderizar nada depois. */
  async connect(interactive){
    await GoogleDriveAuth.login(interactive);
    const sub = GoogleDriveAuth.user.sub;
    let folderId = gdriveReadFolderId(sub);
    let justPicked = false;
    if(folderId){
      // V6.7.0 — a pasta salva pode ter sido excluída/movida (ex: você apagou uma
      // pasta de teste no Drive). Sem essa checagem, o app tentava usar um ID que não
      // existe mais e caía numa tela de "pasta vazia" enganosa. Confirma que a pasta
      // ainda existe antes de pular o seletor.
      const stillThere = await this._folderStillExists(folderId);
      if(!stillThere){
        gdriveForgetFolderId(sub);
        folderId = null;
      }
    }
    if(!folderId){
      const folder = await openDriveFolderPicker();
      folderId = folder.id;
      gdriveWriteFolderId(sub, folderId);
      justPicked = true;
    }
    this.folderId = folderId;
    // V6.8.0 — nome da pasta é buscado sempre fresco (não fica salvo), pra sempre
    // bater com o nome atual no Drive mesmo se você renomear a pasta depois. É pra
    // resolver a confusão de "não sei onde tá salvando" — agora aparece em
    // Configurações → Nuvem, com link direto pra abrir a pasta.
    try{ const meta = await GoogleDriveFS.getFileMeta(folderId); this.folderName = meta.name; }
    catch(e){ this.folderName = null; }
    if(justPicked){
      toast('Conectado à pasta "' + (this.folderName||'') + '" — confira em Configurações → Nuvem.');
    }
    setStorageMode('google_drive');
    // V6.20.0 — retoma a rotação de onde parou nesta pasta, em vez de sempre do slot 1
    // (ver comentário em gdriveReadSlotIndex/gdriveWriteSlotIndex acima).
    this.autosaveSlotIndex = gdriveReadSlotIndex(this.folderId, 'autosave');
    this.forcesaveSlotIndex = gdriveReadSlotIndex(this.folderId, 'forcesave');
    const result = await this.loadFromDrive();
    this.startAutosaveLoop();
    if(result && result.empty){
      renderGoogleDriveOnboarding();
    } else {
      S.gate = { mode: 'list', error: '' };
      renderGate();
    }
  },

  /* V6.13.0 — bug real corrigido: essa função tratava QUALQUER erro (rede
     instável, token ainda renovando, limite de taxa da API) como "a pasta foi
     apagada" — e o connect() então esquecia o vínculo salvo e forçava escolher a
     pasta nervamente, o que podia levar a pessoa (sem querer) a conectar numa pasta
     diferente/errada e ver "nenhum dado encontrado" mesmo com o perfil intacto na
     pasta certa. Agora só considera "apagada de verdade" quando a API responde 404 —
     qualquer outro erro propaga (o connect() mostra uma mensagem de falha e tenta de
     novo depois, sem mexer no vínculo salvo). */
  async _folderStillExists(folderId){
    try{
      const meta = await GoogleDriveFS.getFileMeta(folderId);
      return !!(meta && meta.id);
    }catch(e){
      if(e && e.status === 404) return false;
      throw e;
    }
  },

  /* Só localiza e lê o current.json — não cria nada. Retorna {empty:true} se a pasta
     ainda não tiver backup nenhum, pra quem chamou decidir o que mostrar. */
  async loadFromDrive(){
    const file = await GoogleDriveFS.findChild(this.folderId, 'current.json');
    if(!file) return { empty: true };
    this.currentFileId = file.id; this.currentFileMeta = file;
    // V6.16.0 — bug real corrigido: se a página fechou/recarregou enquanto uma
    // alteração ainda não tinha sido confirmada no Drive (o debounce de 800ms não
    // teve tempo de terminar), essa conexão nova simplesmente buscava o current.json
    // do Drive — que podia estar desatualizado — e SOBRESCREVIA o dado local correto
    // com o valor antigo. Corrigido: se existe uma alteração local pendente de antes,
    // ela é tratada como a mais recente, e o Drive recebe ela de novo, em vez do
    // caminho inverso.
    const pendingSince = localStorage.getItem(gdrivePendingKey(this.folderId));
    if(pendingSince){
      // V6.37.0 — antes de tratar cegamente o dado LOCAL como "mais recente" e
      // reenviá-lo, confere se ele não está suspeitosamente menor que a última
      // base confiável conhecida nesta pasta. Isso cobre o caso raro em que a
      // flag "pendente" sobreviveu no localStorage mas o IndexedDB/dado real
      // foi parcialmente perdido entre uma sessão e outra — sem essa checagem,
      // essa reconexão reenviaria uma base ruim por cima de uma boa no Drive.
      const payload = await buildFullBackupPayload();
      const nextCounts = window.BorionDataGuard ? BorionDataGuard.countAccountRecords(payload) : null;
      const baseline = window.BorionDataGuard ? BorionDataGuard.readLastGoodCounts(this.folderId) : null;
      const check = (nextCounts && baseline) ? BorionDataGuard.detectSuspiciousAccountDrop(nextCounts, baseline) : { suspicious:false, reasons:[] };
      if(check.suspicious){
        console.warn('[GoogleDriveProvider] alteração pendente parecia suspeita ao reconectar — ignorando o "catch-up" e lendo o Drive normalmente:', BorionDataGuard.describeSuspiciousAccountReasons(check.reasons));
        try{ localStorage.removeItem(gdrivePendingKey(this.folderId)); }catch(e){}
        toast('Uma alteração pendente deste dispositivo parecia incompleta e não foi enviada ao Google Drive. Os dados mais recentes da nuvem foram carregados normalmente.');
        // segue para a leitura normal abaixo, em vez de dar return aqui
      } else {
        this.dirty = true;
        await this.syncNow();
        return { empty: false };
      }
    }
    const data = await GoogleDriveFS.readFile(file.id);
    const check = validateBorionJson(data);
    if(!check.valid) throw new Error('O current.json desta pasta parece corrompido: ' + check.errors.join(' '));
    applyAccountPayloadSilently(data);
    this.lastKnownProfileCount = (data.profiles || []).length;
    if(window.BorionDataGuard){
      const counts = BorionDataGuard.countAccountRecords(data);
      this._lastGoodCounts = counts;
      BorionDataGuard.writeLastGoodCounts(this.folderId, counts);
    }
    return { empty: false };
  },

  /* Cria o current.json inicial vazio (escolha "Começar do zero" no onboarding). */
  async createEmptyCurrentFile(){
    const empty = {
      type: 'borion-account-backup', backupSchema: 5352, app: 'Borion Finance',
      appVersion: BORION_APP_VERSION, backupType: 'initial',
      reason: 'primeira conexão com o Google Drive', source: 'google_drive',
      exportedAt: new Date().toISOString(),
      account: { userId: GoogleDriveAuth.user.sub, email: GoogleDriveAuth.user.email },
      config: {}, profileCount: 0, profiles: [], dataByProfile: {}
    };
    const created = await GoogleDriveFS.createFile(this.folderId, 'current.json', empty);
    this.currentFileId = created.id; this.currentFileMeta = created;
    this.lastKnownProfileCount = 0;
    S.profiles = []; setProfiles([]); S.currentProfile = null; S.data = null;
  },

  /* Recarrega o current.json mais recente do Drive, descartando qualquer alteração
     local ainda não sincronizada — usado depois de um conflito detectado. */
  async reload(){
    this.dirty = false; this.conflict = false;
    clearTimeout(this.syncTimer);
    const result = await this.loadFromDrive();
    if(result && result.empty){ renderGoogleDriveOnboarding(); }
    else { S.gate = { mode: 'list', error: '' }; renderGate(); }
  },

  /* Chamado de dentro de saveCurrentData() (mesmo gancho que o Supabase usa) — só
     marca como pendente e debate 800ms antes de mandar pro Drive, pra não fazer uma
     chamada de rede a cada tecla digitada. */
  queueSave(){
    if(!this.isConnected()) return;
    this.dirty = true;
    this.autosaveDirtySinceLast = true;
    this._autosaveRevision++;
    // V6.16.0 — grava um marcador PERSISTENTE (sobrevive a reload/fechar aba) de que
    // existe uma alteração ainda não confirmada no Drive. Ver loadFromDrive(): se esse
    // marcador ainda estiver presente na próxima conexão, o dado local é tratado como
    // o mais recente, em vez de deixar a leitura do Drive (possivelmente desatualizada)
    // sobrescrever uma alteração que nunca chegou a ser enviada.
    try{ localStorage.setItem(gdrivePendingKey(this.folderId), String(Date.now())); }catch(e){}
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(()=>this.syncNow(), 800);
    this.scheduleAutosaveSoon();
  },

  /* V6.10.0 — rede de segurança extra, além do current.json (que já salva ~800ms
     depois de qualquer mudança): a cada GOOGLE_DRIVE_AUTOSAVE_INTERVAL_MS, se algo
     mudou desde o último autosave, grava um snapshot completo num rodízio de slots
     fixos (autosave-1 → autosave-2 → ... → autosave-20 → autosave-1 de novo — V6.20.0:
     eram só 3 slots a cada 90s, agora são 20 a cada 1 minuto). Não cria arquivo novo a
     cada vez — só revezam os mesmos slots, então não acumula. Protege contra
     current.json corrompido, conflito mal resolvido, ou qualquer coisa que dê errado
     bem no meio de uma sessão longa de lançamentos. */
  startAutosaveLoop(){
    this.stopAutosaveLoop();
    this.autosaveTimer = setInterval(()=>{ this.runAutosaveTick(); }, GOOGLE_DRIVE_AUTOSAVE_INTERVAL_MS);
    if(this.autosaveDirtySinceLast) this.scheduleAutosaveSoon();
  },

  scheduleAutosaveSoon(delayOverride){
    if(!this.isConnected() || !this.autosaveDirtySinceLast) return;
    clearTimeout(this.autosaveKickTimer);
    const elapsed = this.lastAutosaveAt ? (Date.now() - this.lastAutosaveAt) : GOOGLE_DRIVE_AUTOSAVE_INTERVAL_MS;
    const delay = Number.isFinite(delayOverride)
      ? Math.max(GOOGLE_DRIVE_AUTOSAVE_IDLE_KICK_MS, delayOverride)
      : Math.max(GOOGLE_DRIVE_AUTOSAVE_IDLE_KICK_MS, GOOGLE_DRIVE_AUTOSAVE_INTERVAL_MS - elapsed);
    this.autosaveKickTimer = setTimeout(()=>{ this.autosaveKickTimer=null; this.runAutosaveTick(); }, delay);
  },

  stopAutosaveLoop(){
    if(this.autosaveTimer){ clearInterval(this.autosaveTimer); this.autosaveTimer = null; }
    if(this.autosaveKickTimer){ clearTimeout(this.autosaveKickTimer); this.autosaveKickTimer = null; }
  },

  /* V6.20.0 — lógica de rodízio compartilhada entre o autosave automático
     ('autosave', 20 slots) e o rodízio de Ctrl+S ('forcesave', 40 slots) — mesma regra
     nos dois: descobre o próximo slot a partir do índice PERSISTIDO desta pasta (nunca
     mais reseta pro slot 1 sozinho por causa de um reload no meio do caminho — ver
     gdriveReadSlotIndex/gdriveWriteSlotIndex), grava o payload nele e avança o índice. */
  async writeRotatingSnapshot(kind, totalSlots, payload){
    const folderId = await this.ensureBackupsFolder();
    const indexProp = kind + 'SlotIndex';
    const slot = (this[indexProp] % totalSlots) + 1;
    const name = kind + '-' + slot + '.json';
    // V6.12.0 — mesma correção da pasta de backups: guarda o ID real do arquivo deste
    // slot assim que descoberto, pra nunca mais precisar buscar por nome de novo (a
    // busca por nome tem consistência eventual + risco de corrida entre abas/sessões,
    // o que gerava arquivo duplicado).
    let fileId = gdriveReadAutosaveFileId(folderId, kind, slot);
    if(fileId && !(await this._folderStillExists(fileId))) fileId = null;
    if(fileId){
      await GoogleDriveFS.updateFile(fileId, payload);
    } else {
      const existing = await GoogleDriveFS.findChild(folderId, name);
      if(existing){ fileId = existing.id; await GoogleDriveFS.updateFile(fileId, payload); }
      else { fileId = (await GoogleDriveFS.createFile(folderId, name, payload)).id; }
      gdriveWriteAutosaveFileId(folderId, kind, slot, fileId);
    }
    this[indexProp]++;
    gdriveWriteSlotIndex(folderId, kind, this[indexProp]);
  },

  async runAutosaveTick(){
    if(!this.isConnected() || !this.autosaveDirtySinceLast) return false;
    if(this._autosaveInFlight) return false;
    this._autosaveInFlight = true;
    const revision = this._autosaveRevision;
    try{
      /* V6.23.4 — corrigido o erro que referenciava `options` e `reason` inexistentes.
         O snapshot agora é construído explicitamente e também pode rodar com a aba em
         segundo plano, evitando que Alt+Tab impeça o arquivo autosave-N.json de nascer. */
      const payload = await buildSharedBackupSnapshot('auto', 'autosave automático do Google Drive');
      await this.writeRotatingSnapshot('autosave', GOOGLE_DRIVE_AUTOSAVE_SLOTS, payload);
      this.lastAutosaveAt = Date.now();
      if(revision===this._autosaveRevision) this.autosaveDirtySinceLast = false;
      return true;
    }catch(e){
      console.warn('[GoogleDriveProvider] autosave rotativo falhou (será tentado novamente):', e);
      this.scheduleAutosaveSoon(GOOGLE_DRIVE_AUTOSAVE_RETRY_MS);
      return false;
    }finally{
      this._autosaveInFlight = false;
      if(this.autosaveDirtySinceLast && !this.autosaveKickTimer) this.scheduleAutosaveSoon();
    }
  },

  async syncNow(){
    if(!this.isConnected() || !this.dirty || !this.currentFileId) return;
    // V6.19.0 — bug real corrigido: sem essa trava, edições rápidas (ou rede lenta)
    // podiam disparar DUAS execuções de syncNow() ao mesmo tempo — cada uma conferindo
    // "mudou desde a última leitura?" de forma independente, o que podia gerar um
    // conflito falso contra a própria sessão, ou deixar uma gravação com dado
    // desatualizado "vencer" por acaso. Agora, se já tem uma sincronização rodando,
    // só marca pra rodar de novo assim que a atual terminar.
    if(this._syncInFlight){ this._syncAgain = true; return; }
    this._syncInFlight = true;
    try{
      // V6.5.0 — proteção contra conflito: se outro dispositivo (celular, outro PC)
      // salvou depois da última vez que ESTE dispositivo leu o arquivo, não escreve
      // por cima — avisa e espera a pessoa decidir (botão "Recarregar" no selo do topo,
      // ou Ctrl+S pra forçar sua versão como a mais recente).
      const freshMeta = await GoogleDriveFS.getFileMeta(this.currentFileId);
      if(this.currentFileMeta && this.currentFileMeta.modifiedTime && freshMeta.modifiedTime && freshMeta.modifiedTime !== this.currentFileMeta.modifiedTime){
        this.conflict = true;
        toast('Existe uma versão mais recente no Google Drive. Ctrl+S força salvar a sua, ou clique no selo pra recarregar.');
        return;
      }
      const payload = await buildFullBackupPayload();
      // V6.37.0 — checagem ampliada: antes só bloqueava se TODOS os perfis
      // sumissem (payload.profiles.length===0). Agora também compara a
      // contagem de transações, cartões, investimentos etc. de CADA perfil
      // com a última base confiável conhecida — pega o caso em que os dados
      // de UM perfil específico zeram (cache/IndexedDB corrompido) sem o
      // perfil em si desaparecer da lista. Ver js/01d-data-guard.js.
      const nextCounts = window.BorionDataGuard ? BorionDataGuard.countAccountRecords(payload) : null;
      const baseline = window.BorionDataGuard ? (this._lastGoodCounts || BorionDataGuard.readLastGoodCounts(this.folderId)) : null;
      const check = (nextCounts && baseline) ? BorionDataGuard.detectSuspiciousAccountDrop(nextCounts, baseline) : { suspicious:false, reasons:[] };
      if(check.suspicious){
        const reasonText = BorionDataGuard.describeSuspiciousAccountReasons(check.reasons);
        console.warn('[GoogleDriveProvider] gravação automática bloqueada por segurança: ' + reasonText);
        this.blockedSuspicious = reasonText;
        toast('Salvamento no Google Drive bloqueado por segurança: os dados desta sessão parecem menores que o esperado (' + reasonText + '). Nada foi substituído.');
        this.dirty = true;
        return;
      }
      this.blockedSuspicious = null;
      this.dirty = false;
      const updated = await GoogleDriveFS.updateFile(this.currentFileId, payload);
      this.currentFileMeta = updated;
      this.conflict = false;
      this.lastKnownProfileCount = (payload.profiles || []).length;
      if(nextCounts && window.BorionDataGuard){ this._lastGoodCounts = nextCounts; BorionDataGuard.writeLastGoodCounts(this.folderId, nextCounts); }
      try{ localStorage.removeItem(gdrivePendingKey(this.folderId)); }catch(e){}
    }catch(e){
      console.warn('[GoogleDriveProvider] falha ao sincronizar com o Drive (tenta de novo na próxima alteração):', e);
      this.dirty = true;
    }finally{
      this._syncInFlight = false;
      if(this._syncAgain && !this._forceRequested){
        this._syncAgain = false;
        this.dirty = true;
        this.syncNow();
      }
    }
  },

  /* V6.37.0 — mesma checagem de queda suspeita do syncNow(), só que usada pelo
     Ctrl+S/forceSyncNow. Continua bloqueando por padrão mesmo sendo uma ação
     explícita — "forçar" deveria resolver um CONFLITO de versões, não abrir
     uma exceção para gravar uma base vazia por engano. Quem chama pode passar
     options.acknowledgeSuspicious=true depois de confirmar com a pessoa (ex.:
     um diálogo "tem certeza?") para prosseguir mesmo assim. */
  _assertSafeToForceWrite(payload, options={}){
    if(!window.BorionDataGuard || options.acknowledgeSuspicious) return;
    const nextCounts = BorionDataGuard.countAccountRecords(payload);
    const baseline = this._lastGoodCounts || BorionDataGuard.readLastGoodCounts(this.folderId);
    const check = baseline ? BorionDataGuard.detectSuspiciousAccountDrop(nextCounts, baseline) : { suspicious:false, reasons:[] };
    if(check.suspicious){
      const reasonText = BorionDataGuard.describeSuspiciousAccountReasons(check.reasons);
      const err = new Error('Salvamento bloqueado por segurança: os dados desta sessão parecem menores que o esperado (' + reasonText + '). Nada foi substituído no Google Drive. Se isso for esperado (ex.: você excluiu bastante coisa de propósito), confirme novamente para continuar.');
      err.code = 'SUSPICIOUS_ACCOUNT_DROP';
      err.reasons = check.reasons;
      throw err;
    }
  },

  /* V6.19.0 — "Ctrl+S": ignora a checagem de conflito de propósito e grava o estado
     local por cima do que estiver no Drive agora — é o botão de escape explícito pra
     quando a pessoa sabe que a versão dela é a certa e só quer resolver o conflito.
     V6.20.0 — além de current.json, cada Ctrl+S agora também grava num rodízio próprio
     de até 40 slots (forcesave-1.json...forcesave-40.json), pra dar um histórico dos
     momentos em que você mesmo pediu pra salvar — ver writeRotatingSnapshot(). Isso é
     redundância de segurança; se falhar (rede, etc.) não desfaz o Ctrl+S em si, que já
     terminou com sucesso no current.json. */
  async forceSyncNow(options={}){
    if(!this.isConnected() || !this.currentFileId) return false;
    if(this._forceSavePromise) return this._forceSavePromise;
    this._forceRequested = true;
    this._forceSavePromise = (async()=>{
      clearTimeout(this.syncTimer);
      const waitStarted = Date.now();
      while(this._syncInFlight){
        if(Date.now()-waitStarted > 15000) throw new Error('A sincronização anterior demorou demais. Tente novamente.');
        await new Promise(resolve=>setTimeout(resolve, 60));
      }
      this._syncAgain = false;
      this._syncInFlight = true;
      try{
        let payload = null;
        let updated = null;
        /* Se uma alteração entrar enquanto o Ctrl+S está enviando, repete a leitura até
           três vezes. Assim um único Ctrl+S realmente gera o forcesave, em vez de ser
           ignorado só porque o autosave/current.json já estava em andamento. */
        if(options && options.payload){
          payload = options.payload;
          this.dirty = false;
          this._syncAgain = false;
          this._assertSafeToForceWrite(payload, options);
          updated = await GoogleDriveFS.updateFile(this.currentFileId, payload);
        }else{
          for(let attempt=0; attempt<3; attempt++){
            this.dirty = false;
            this._syncAgain = false;
            payload = await buildFullBackupPayload();
            this._assertSafeToForceWrite(payload, options);
            updated = await GoogleDriveFS.updateFile(this.currentFileId, payload);
            if(!this.dirty && !this._syncAgain) break;
          }
        }
        this.currentFileMeta = updated;
        this.conflict = false;
        this.dirty = false;
        this._syncAgain = false;
        this.lastKnownProfileCount = (payload.profiles || []).length;
        if(window.BorionDataGuard){
          const counts = BorionDataGuard.countAccountRecords(payload);
          this._lastGoodCounts = counts;
          BorionDataGuard.writeLastGoodCounts(this.folderId, counts);
        }
        this.blockedSuspicious = null;
        try{ localStorage.removeItem(gdrivePendingKey(this.folderId)); }catch(e){}
        await this.writeRotatingSnapshot('forcesave', GOOGLE_DRIVE_FORCESAVE_SLOTS, payload);
        return true;
      }finally{
        this._syncInFlight = false;
      }
    })();
    try{ return await this._forceSavePromise; }
    finally{
      this._forceRequested = false;
      this._forceSavePromise = null;
      if(this._syncAgain || this.dirty){
        this._syncAgain = false;
        this.dirty = true;
        this.syncNow();
      }
    }
  },

  /* ---------------- Histórico de backups (pasta "backups" dentro da pasta principal) ---------------- */
  /* V6.11.0 — corrige um bug real: a busca por nome do Drive (`files.list`) tem
     "consistência eventual" — uma pasta recém-criada pode não aparecer numa busca
     feita logo em seguida, fazendo o código (sem saber) criar outra pasta "backups"
     duplicada. Corrigido guardando o ID da pasta assim que ela é achada/criada — a
     busca por nome só roda mesmo na primeira vez de cada pasta principal, nunca mais
     depois disso. Também trava chamadas simultâneas (ex: autosave rodando junto com
     um clique manual) pra não disparar duas criações ao mesmo tempo. */
  async ensureBackupsFolder(){
    if(this._backupsFolderId) return this._backupsFolderId;
    if(this._backupsFolderPromise) return this._backupsFolderPromise;
    this._backupsFolderPromise = (async ()=>{
      const saved = gdriveReadBackupsFolderId(this.folderId);
      if(saved){
        const stillThere = await this._folderStillExists(saved);
        if(stillThere){ this._backupsFolderId = saved; return saved; }
      }
      const folder = await GoogleDriveFS.findOrCreateFolder(this.folderId, 'backups');
      this._backupsFolderId = folder.id;
      gdriveWriteBackupsFolderId(this.folderId, folder.id);
      return folder.id;
    })();
    try{ return await this._backupsFolderPromise; }
    finally{ this._backupsFolderPromise = null; }
  },

  async createBackup(reason, options={}){
    reason = reason || 'manual';
    const folderId = await this.ensureBackupsFolder();
    const payload = options.payload ? options.payload : await buildSharedBackupSnapshot(reason, reason);
    const ts = String(payload.snapshotBaseDate||payload.exportedAt||new Date().toISOString()).replace(/[:.]/g, '-');
    const name = 'backup_' + ts + '_v' + BORION_APP_VERSION + '_' + reason + '.json';
    const created = await GoogleDriveFS.createFile(folderId, name, payload);
    this.pruneBackupsBySize().catch(e=>console.warn('[GoogleDriveProvider] limpeza automática de backups falhou (não crítico):', e));
    return { id: created.id, name, createdAt: Date.now(), reasonType: reason, snapshotId:payload.snapshotId||null, snapshotChecksum:payload.snapshotChecksum||'' };
  },

  /* V6.8.0 — mantém a pasta "backups" do Drive dentro de um teto de tamanho (padrão
     10GB, o que dá pra durar anos com arquivos de ~1MB cada). Como o histórico
     completo também fica no disco local (pasta de backup automático + IndexedDB),
     apagar os mais antigos do Drive quando passar do teto é seguro. Roda sozinho
     depois de cada createBackup(); não bloqueia a criação do backup se falhar. */
  async pruneBackupsBySize(maxBytes){
    maxBytes = maxBytes || GOOGLE_DRIVE_BACKUP_MAX_BYTES;
    const folderId = await this.ensureBackupsFolder();
    const q = "'" + folderId + "' in parents and trashed=false";
    const url = 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q)
      + '&fields=' + encodeURIComponent('files(id,name,modifiedTime,size)')
      + '&orderBy=' + encodeURIComponent('modifiedTime desc') + '&pageSize=1000';
    const res = await fetch(url, { headers: await GoogleDriveFS.authHeaders() });
    if(!res.ok) throw new Error('Falha ao conferir o tamanho da pasta de backups no Drive.');
    const data = await res.json();
    const files = data.files || [];
    let cumulative = 0;
    const toDelete = [];
    const protectedReasons=['manual','manual_quick','manual_drive_local','before_import','before_restore','before_schema_migration'];
    files.forEach(f=>{
      const size=Number(f.size||0);cumulative+=size;
      const protectedFile=protectedReasons.some(r=>String(f.name||'').endsWith('_'+r+'.json'));
      if(cumulative>maxBytes&&!protectedFile)toDelete.push(f.id);
    });
    for(const id of toDelete){
      try{
        await fetch('https://www.googleapis.com/drive/v3/files/' + id, { method: 'DELETE', headers: await GoogleDriveFS.authHeaders() });
      }catch(e){ console.warn('[GoogleDriveProvider] falha ao apagar backup antigo (' + id + '):', e); }
    }
    return { deleted: toDelete.length, totalBytes: cumulative };
  },

  async listBackups(){
    const folderId = await this.ensureBackupsFolder();
    const q = "'" + folderId + "' in parents and trashed=false";
    const url = 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q)
      + '&fields=' + encodeURIComponent('files(id,name,modifiedTime)') + '&orderBy=' + encodeURIComponent('modifiedTime desc');
    const res = await fetch(url, { headers: await GoogleDriveFS.authHeaders() });
    if(!res.ok) throw new Error('Falha ao listar backups no Drive.');
    const data = await res.json();
    return (data.files || []).map(f=>({ id: f.id, name: f.name, modifiedTime: f.modifiedTime }));
  },

  async restoreBackup(fileId){
    const data = await GoogleDriveFS.readFile(fileId);
    const check = validateBorionJson(data);
    if(!check.valid) throw new Error('Backup corrompido: ' + check.errors.join(' '));
    await this.createBackup('before_restore');
    applyAccountPayloadSilently(data);
    this.lastKnownProfileCount = (data.profiles || []).length;
    this.dirty = true;
    await this.syncNow();
  },

  /* V6.7.0 — grava o JSON de UM perfil específico (não a conta inteira) como arquivo
     separado dentro da pasta "backups" no Drive — pedido pra organizar um arquivo por
     pessoa (perfil-pedro.json, perfil-amanda.json, perfil-marco.json...), redundante
     com o current.json completo, só que mais fácil de identificar de qual pessoa é. */
  async exportSingleProfileToDrive(profileId){
    const p = (S.profiles || []).find(x=>x.id===profileId);
    if(!p) throw new Error('Perfil não encontrado.');
    let data = (S.currentProfile && S.currentProfile.id===profileId && S.data) ? S.data : getProfileData(profileId);
    if(!data && typeof idbGetProfileData === 'function') data = await idbGetProfileData(profileId);
    data = migrateData(data || emptyData());
    const payload = {
      type: 'multicap-profile-backup', version: 2, exportedAt: new Date().toISOString(),
      profile: { id: p.id, name: p.name, email: p.email, passwordHash: p.passwordHash, salt: p.salt, avatarColor: p.avatarColor, avatarImage: p.avatarImage },
      data
    };
    const folderId = await this.ensureBackupsFolder();
    const safeName = (p.name || 'perfil').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const name = 'perfil-' + safeName + '-' + new Date().toISOString().slice(0, 10) + '.json';
    const existing = await GoogleDriveFS.findChild(folderId, name);
    const created = existing ? await GoogleDriveFS.updateFile(existing.id, payload) : await GoogleDriveFS.createFile(folderId, name, payload);
    return { id: created.id, name };
  },

  disconnect(){
    GoogleDriveAuth.signOut();
    this.stopAutosaveLoop();
    this.folderId = null; this.currentFileId = null; this.currentFileMeta = null;
    this._backupsFolderId = null; this.conflict = false; this.dirty = false;
    this.autosaveDirtySinceLast = false; this._forceRequested = false; this._forceSavePromise = null;
    this._lastGoodCounts = null; this.blockedSuspicious = null;
    setStorageMode(null);
  },

  getStatus(){
    return {
      connected: this.isConnected(),
      email: GoogleDriveAuth.user ? GoogleDriveAuth.user.email : null,
      folderId: this.folderId,
      folderName: this.folderName || null,
      folderLink: this.folderId ? ('https://drive.google.com/drive/folders/' + this.folderId) : null,
      pending: this.dirty,
      conflict: this.conflict,
      blockedSuspicious: this.blockedSuspicious || null
    };
  }
};

window.GoogleDriveProvider = GoogleDriveProvider;

/* Tela de onboarding pra pasta compartilhada que ainda não tem nenhum current.json —
   pede pra escolher entre importar um JSON antigo (ex: exportado do Supabase) ou
   começar do zero, em vez de criar um arquivo vazio silenciosamente. */
function renderGoogleDriveOnboarding(){
  applyFont(); applyTheme();
  const root = document.getElementById('root');
  root.innerHTML = `
    <div class="gate-wrap">
      <div class="gate-box">
        <div class="gate-logo"><img src="borion-emblem.png" alt="Borion Finance"/><div class="appname">Borion Finance</div></div>
        <div class="gate-card">
          <h2>Nenhum dado encontrado nesta pasta</h2>
          <p class="gate-sub">Essa pasta do Google Drive ainda não tem nenhum backup do Borion. O que você quer fazer?</p>
          <button class="btn btn-primary btn-block" id="gdrive_start_fresh">Começar do zero</button>
          <div style="text-align:center;margin-top:10px;"><button class="link-btn" id="gdrive_import_old">Importar um JSON antigo</button></div>
          <input type="file" id="gdrive_import_file" accept="application/json" style="display:none;">
          <div style="text-align:center;margin-top:14px;"><button class="link-btn" id="gdrive_onboarding_back">Usar outra forma de entrar</button></div>
        </div>
      </div>
    </div>`;
  document.getElementById('gdrive_start_fresh').onclick = async ()=>{
    try{ await GoogleDriveProvider.createEmptyCurrentFile(); S.gate={mode:'list',error:''}; renderGate(); }
    catch(e){ alert(e.message||String(e)); }
  };
  document.getElementById('gdrive_import_old').onclick = ()=>{ document.getElementById('gdrive_import_file').click(); };
  document.getElementById('gdrive_import_file').onchange = async (ev)=>{
    const file = ev.target.files[0]; if(!file) return;
    try{
      const text = await file.text();
      const obj = JSON.parse(text);
      const check = validateBorionJson(obj);
      if(!check.valid){ alert(check.errors.join(' ')); return; }
      const created = await GoogleDriveFS.createFile(GoogleDriveProvider.folderId, 'current.json', obj);
      GoogleDriveProvider.currentFileId = created.id;
      GoogleDriveProvider.currentFileMeta = created;
      GoogleDriveProvider.lastKnownProfileCount = (obj.profiles || []).length;
      applyAccountPayloadSilently(obj);
      S.gate = { mode: 'list', error: '' };
      renderGate();
    }catch(e){ alert('Arquivo inválido: ' + (e.message || String(e))); }
  };
  document.getElementById('gdrive_onboarding_back').onclick = ()=>{
    GoogleDriveProvider.disconnect();
    CloudAuth.mode='login'; CloudAuth.error=''; CloudAuth.info=''; CloudAuth.emailExpanded=false;
    CloudAuth.render();
  };
}

/* Tela simples mostrada quando a renovação silenciosa do token do Google falha no
   boot (ex: sessão expirada, revogou acesso pela conta Google). Só tem um botão —
   não tenta adivinhar o motivo, só oferece reconectar (com popup de consentimento). */
function renderGoogleDriveReconnect(errorMessage){
  applyFont(); applyTheme();
  const root = document.getElementById('root');
  root.innerHTML = `
    <div class="gate-wrap">
      <div class="gate-box">
        <div class="gate-logo"><img src="borion-emblem.png" alt="Borion Finance"/><div class="appname">Borion Finance</div></div>
        <div class="gate-card">
          <h2>Reconectar ao Google Drive</h2>
          <p class="gate-sub">Sua sessão do Google expirou ou foi desconectada. Seus dados continuam salvos no Drive — é só entrar de novo.</p>
          <div class="info-box" style="margin-bottom:14px;">${esc(errorMessage||'')}</div>
          <button class="btn btn-primary btn-block" id="gdrive_reconnect">Reconectar Google Drive</button>
          <div style="text-align:center;margin-top:14px;"><button class="link-btn" id="gdrive_use_other">Usar outra forma de entrar</button></div>
        </div>
      </div>
    </div>`;
  document.getElementById('gdrive_reconnect').onclick = async ()=>{
    try{
      await GoogleDriveProvider.connect(true);
    }catch(e){ renderGoogleDriveReconnect(e.message||String(e)); }
  };
  document.getElementById('gdrive_use_other').onclick = ()=>{
    setStorageMode(null);
    CloudAuth.mode='login'; CloudAuth.error=''; CloudAuth.info=''; CloudAuth.emailExpanded=false;
    CloudAuth.render();
  };
}
