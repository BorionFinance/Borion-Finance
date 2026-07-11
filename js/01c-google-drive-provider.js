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

const LS_GDRIVE_FOLDER_PREFIX = 'borion_gdrive_folder_'; // + googleSub -> folderId
const LS_GDRIVE_USER = 'borion_gdrive_user'; // cache do último usuário Google {sub,email,name,picture}

function gdriveReadFolderId(sub){ return localStorage.getItem(LS_GDRIVE_FOLDER_PREFIX + sub) || null; }
function gdriveWriteFolderId(sub, id){ localStorage.setItem(LS_GDRIVE_FOLDER_PREFIX + sub, id); }
function gdriveForgetFolderId(sub){ localStorage.removeItem(LS_GDRIVE_FOLDER_PREFIX + sub); }

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
    if(!res.ok) throw new Error('Falha ao consultar metadados do arquivo no Drive.');
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
    const result = await this.loadFromDrive();
    if(result && result.empty){
      renderGoogleDriveOnboarding();
    } else {
      S.gate = { mode: 'list', error: '' };
      renderGate();
    }
  },

  async _folderStillExists(folderId){
    try{
      const meta = await GoogleDriveFS.getFileMeta(folderId);
      return !!(meta && meta.id);
    }catch(e){ return false; }
  },

  /* Só localiza e lê o current.json — não cria nada. Retorna {empty:true} se a pasta
     ainda não tiver backup nenhum, pra quem chamou decidir o que mostrar. */
  async loadFromDrive(){
    const file = await GoogleDriveFS.findChild(this.folderId, 'current.json');
    if(!file) return { empty: true };
    this.currentFileId = file.id; this.currentFileMeta = file;
    const data = await GoogleDriveFS.readFile(file.id);
    const check = validateBorionJson(data);
    if(!check.valid) throw new Error('O current.json desta pasta parece corrompido: ' + check.errors.join(' '));
    applyAccountPayloadSilently(data);
    this.lastKnownProfileCount = (data.profiles || []).length;
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
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(()=>this.syncNow(), 800);
  },

  async syncNow(){
    if(!this.isConnected() || !this.dirty || !this.currentFileId) return;
    try{
      // V6.5.0 — proteção contra conflito: se outro dispositivo (celular, outro PC)
      // salvou depois da última vez que ESTE dispositivo leu o arquivo, não escreve
      // por cima — avisa e espera a pessoa decidir (botão "Recarregar" no selo do topo).
      const freshMeta = await GoogleDriveFS.getFileMeta(this.currentFileId);
      if(this.currentFileMeta && this.currentFileMeta.modifiedTime && freshMeta.modifiedTime && freshMeta.modifiedTime !== this.currentFileMeta.modifiedTime){
        this.conflict = true;
        toast('Existe uma versão mais recente no Google Drive. Clique no selo "Conflito" no topo pra recarregar.');
        return;
      }
      const payload = await buildFullBackupPayload();
      // V6.5.0 — nunca sobrescreve um current.json que tinha perfis com um payload
      // vazio (0 perfis) — isso só aconteceria por bug, nunca por ação normal da
      // pessoa (excluir perfil é uma ação explícita em outra tela, não por aqui).
      if((payload.profiles || []).length === 0 && this.lastKnownProfileCount > 0){
        console.warn('[GoogleDriveProvider] gravação automática bloqueada: tentaria salvar 0 perfis por cima de um arquivo que tinha ' + this.lastKnownProfileCount + '.');
        this.dirty = true;
        return;
      }
      this.dirty = false;
      const updated = await GoogleDriveFS.updateFile(this.currentFileId, payload);
      this.currentFileMeta = updated;
      this.conflict = false;
      this.lastKnownProfileCount = (payload.profiles || []).length;
    }catch(e){
      console.warn('[GoogleDriveProvider] falha ao sincronizar com o Drive (tenta de novo na próxima alteração):', e);
      this.dirty = true;
    }
  },

  /* ---------------- Histórico de backups (pasta "backups" dentro da pasta principal) ---------------- */
  async ensureBackupsFolder(){
    if(this._backupsFolderId) return this._backupsFolderId;
    const folder = await GoogleDriveFS.findOrCreateFolder(this.folderId, 'backups');
    this._backupsFolderId = folder.id;
    return folder.id;
  },

  async createBackup(reason){
    reason = reason || 'manual';
    const folderId = await this.ensureBackupsFolder();
    const payload = await buildFullBackupPayload();
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const name = 'backup_' + ts + '_v' + BORION_APP_VERSION + '_' + reason + '.json';
    const created = await GoogleDriveFS.createFile(folderId, name, payload);
    this.pruneBackupsBySize().catch(e=>console.warn('[GoogleDriveProvider] limpeza automática de backups falhou (não crítico):', e));
    return { id: created.id, name, createdAt: Date.now(), reasonType: reason };
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
    files.forEach(f=>{
      const size = Number(f.size || 0);
      cumulative += size;
      if(cumulative > maxBytes) toDelete.push(f.id);
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
    this.folderId = null; this.currentFileId = null; this.currentFileMeta = null;
    this._backupsFolderId = null; this.conflict = false; this.dirty = false;
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
      conflict: this.conflict
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
    CloudAuth.mode='login'; CloudAuth.error=''; CloudAuth.info='';
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
    CloudAuth.mode='login'; CloudAuth.error=''; CloudAuth.info='';
    CloudAuth.render();
  };
}
