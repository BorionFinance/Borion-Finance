/* Borion Finance — Google Drive Provider (V6.40.1 — Dados e Segurança)

   Arquitetura 6.40.1: current.json é apenas o snapshot consolidado. Toda alteração
   é protegida primeiro como operação imutável, identificada por operationId, e só
   depois consolidada e confirmada por checksum. O carregamento recupera operações
   pendentes antes de apresentar a conta; horários servem apenas para ordenação.

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
/* V6.38.0 — pedido: quando um lançamento é feito num dispositivo (ex.: computador),
   os outros dispositivos já abertos (ex.: celular) devem enxergar a mudança sozinhos,
   sem precisar sair do app e entrar de novo. A cada GOOGLE_DRIVE_LIVE_POLL_MS, se este
   dispositivo NÃO tem nenhuma alteração local pendente, ele confere só os METADADOS do
   current.json (mesma chamada barata já usada pela checagem de conflito do syncNow —
   nenhum conteúdo é baixado à toa). Se o `modifiedTime` mudou, é porque outro
   dispositivo salvou — aí sim busca o conteúdo novo e atualiza a tela sozinho. Ver
   checkForRemoteUpdate() mais abaixo. */
const GOOGLE_DRIVE_LIVE_POLL_MS = 6 * 1000;
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
/* Uma operação pode já estar durável no journal e ainda não ter entrado no
   current.json. Esse marcador é separado da edição local pendente para que a
   interface nunca confunda "protegido" com "snapshot confirmado". */
const LS_GDRIVE_CONSOLIDATION_PREFIX = 'borion_gdrive_consolidation_';
function gdriveConsolidationKey(folderId){ return LS_GDRIVE_CONSOLIDATION_PREFIX + folderId; }

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
      let settled = false;
      const finishOk = (token)=>{
        if(settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve(token);
      };
      const finishError = (error)=>{
        if(settled) return;
        settled = true;
        clearTimeout(timeoutId);
        reject(error instanceof Error ? error : new Error(String(error||'Falha no acesso ao Google.')));
      };
      const timeoutId = setTimeout(()=>finishError(new Error('O Google não respondeu à renovação do acesso. Reconecte sua conta.')), 20000);
      try{
        this.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: GOOGLE_DRIVE_SCOPES,
          callback: (resp)=>{
            if(resp && resp.error){ finishError(new Error('Google recusou o acesso: ' + resp.error)); return; }
            if(!resp || !resp.access_token){ finishError(new Error('O Google não devolveu um token de acesso válido.')); return; }
            this.accessToken = resp.access_token;
            this.tokenExpiresAt = Date.now() + ((resp.expires_in || 3300) * 1000);
            finishOk(resp.access_token);
          },
          error_callback: (err)=>{ finishError(new Error((err && (err.message||err.type)) || 'Login com Google cancelado ou falhou.')); }
        });
        this.tokenClient.requestAccessToken({ prompt: interactive ? 'consent' : '' });
      }catch(e){ finishError(e); }
    });
  },

  async login(interactive){
    await this.ensureLoaded();
    await this.requestToken(interactive);
    return await this.fetchUserInfo();
  },

  async ensureFreshToken(interactive=false){
    if(this.accessToken && Date.now() < this.tokenExpiresAt - 60000) return this.accessToken;
    await this.ensureLoaded();
    return await this.requestToken(!!interactive);
  },

  invalidateToken(){
    this.accessToken = null;
    this.tokenExpiresAt = 0;
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

  /* V6.38.1 — todas as chamadas ao Drive passam por aqui. Se o Google invalidar
     um token antes do horário estimado, a chamada 401 limpa o token e tenta uma
     renovação silenciosa uma única vez, em vez de deixar a sessão presa usando um
     token aparentemente válido porém recusado. */
  async request(url, options={}){
    let response=null;
    const retryable=new Set([429,500,502,503,504]);
    let authRetried=false;
    for(let attempt=0;attempt<5;attempt++){
      const headers=Object.assign({},options.headers||{},await this.authHeaders());
      try{response=await fetch(url,Object.assign({},options,{headers}));}
      catch(e){
        if(attempt===4) throw e;
        await new Promise(r=>setTimeout(r,Math.min(8000,400*Math.pow(2,attempt))));
        continue;
      }
      if(response.status===401&&!authRetried){GoogleDriveAuth.invalidateToken();authRetried=true;continue;}
      if(!retryable.has(response.status)||attempt===4) return response;
      const retryAfter=Number(response.headers&&response.headers.get&&response.headers.get('Retry-After'))||0;
      await new Promise(r=>setTimeout(r,retryAfter?retryAfter*1000:Math.min(8000,500*Math.pow(2,attempt))));
    }
    return response;
  },

  async findChildren(parentId,name,mimeType,options={}){
    const safeName=String(name).replace(/'/g,"\\'");
    let q=`'${parentId}' in parents and name='${safeName}' and trashed=false`;
    if(mimeType) q+=` and mimeType='${mimeType}'`;
    const files=await this.listQuery(q,Object.assign({orderBy:'createdTime,name'},options));
    return files.sort((a,b)=>String(a.createdTime||'').localeCompare(String(b.createdTime||''))||String(a.id).localeCompare(String(b.id)));
  },

  async findChild(parentId,name,mimeType){
    const files=await this.findChildren(parentId,name,mimeType);
    return files[0]||null;
  },

  async createFolder(parentId, name){
    const res = await this.request('https://www.googleapis.com/drive/v3/files?fields=id,name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] })
    });
    if(!res.ok) throw Object.assign(new Error('Falha ao criar pasta \"' + name + '\" no Google Drive (status ' + res.status + ').'),{status:res.status});
    return await res.json();
  },

  async findOrCreateFolder(parentId, name){
    const existing = await this.findChild(parentId, name, 'application/vnd.google-apps.folder');
    if(existing) return existing;
    return await this.createFolder(parentId, name);
  },

  async readFile(fileId){
    const res = await this.request('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media');
    if(!res.ok) throw Object.assign(new Error('Falha ao ler arquivo do Google Drive (status ' + res.status + ').'),{status:res.status});
    return await res.json();
  },

  async readFileText(fileId){
    const res=await this.request('https://www.googleapis.com/drive/v3/files/'+fileId+'?alt=media');
    if(!res.ok) throw Object.assign(new Error('Falha ao ler bytes do arquivo no Google Drive (status '+res.status+').'),{status:res.status});
    return await res.text();
  },

  async getFileMeta(fileId){
    const res = await this.request('https://www.googleapis.com/drive/v3/files/' + fileId + '?fields=id,name,modifiedTime,createdTime,mimeType,trashed,parents');
    if(!res.ok){
      const err = new Error('Falha ao consultar metadados do arquivo no Drive (status ' + res.status + ').');
      err.status = res.status;
      throw err;
    }
    return await res.json();
  },

  async createTextFile(parentId,name,text,mimeType='application/json'){
    const boundary='borion_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const metadata={name,parents:[parentId],mimeType};
    const body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n'
      +'--'+boundary+'\r\nContent-Type: '+mimeType+'; charset=UTF-8\r\n\r\n'+String(text)+'\r\n--'+boundary+'--';
    const res=await this.request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,createdTime',{
      method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body
    });
    if(!res.ok) throw Object.assign(new Error('Falha ao criar arquivo bruto \"'+name+'\" no Google Drive (status '+res.status+').'),{status:res.status});
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
    const res = await this.request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
      body
    });
    if(!res.ok) throw Object.assign(new Error('Falha ao criar arquivo \"' + name + '\" no Google Drive (status ' + res.status + ').'),{status:res.status});
    return await res.json();
  },

  async updateFile(fileId, obj){
    const res = await this.request('https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media&fields=id,name,modifiedTime', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obj)
    });
    if(!res.ok) throw Object.assign(new Error('Falha ao salvar no Google Drive (status ' + res.status + ').'),{status:res.status});
    return await res.json();
  },

  /* V6.40.1 — paginação completa. Uma falha em qualquer página lança erro;
     o journal não avança parcialmente. */
  async listQuery(q,options={}){
    const pageSize=Math.min(1000,Math.max(1,Number(options.pageSize)||1000));
    const maxPages=Math.max(1,Number(options.maxPages)||1000);
    const maxItems=Math.max(1,Number(options.maxItems)||250000);
    const orderBy=options.orderBy||'name';
    const fields=options.fields||'nextPageToken,files(id,name,modifiedTime,createdTime,mimeType,parents,size)';
    const all=[],seen=new Set(); let pageToken=null,pages=0;
    do{
      if(++pages>maxPages) throw Object.assign(new Error('Limite de segurança de páginas do Google Drive excedido.'),{code:'DRIVE_LIST_LIMIT'});
      let url='https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)+'&pageSize='+pageSize+'&fields='+encodeURIComponent(fields)+'&orderBy='+encodeURIComponent(orderBy);
      if(pageToken) url+='&pageToken='+encodeURIComponent(pageToken);
      const res=await this.request(url);
      if(!res.ok) throw Object.assign(new Error('Falha ao listar página '+pages+' do Google Drive (status '+res.status+').'),{code:'DRIVE_LIST_INCOMPLETE',status:res.status,page:pages});
      const data=await res.json();
      for(const f of (data.files||[])){if(!f||!f.id||seen.has(f.id))continue;seen.add(f.id);all.push(f);if(all.length>maxItems)throw Object.assign(new Error('Limite de segurança de itens do Google Drive excedido.'),{code:'DRIVE_LIST_LIMIT'});}
      pageToken=data.nextPageToken||null;
    }while(pageToken);
    return all.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''))||String(a.createdTime||'').localeCompare(String(b.createdTime||''))||String(a.id).localeCompare(String(b.id)));
  },

  async listChildren(parentId,options={}){
    const q=`'${parentId}' in parents and trashed=false`;
    return await this.listQuery(q,options);
  },

  async moveFile(fileId,newParentId,oldParentId){
    let url='https://www.googleapis.com/drive/v3/files/'+fileId+'?addParents='+encodeURIComponent(newParentId)+'&fields=id,parents';
    if(oldParentId) url+='&removeParents='+encodeURIComponent(oldParentId);
    const res=await this.request(url,{method:'PATCH'});
    if(!res.ok) throw Object.assign(new Error('Falha ao mover arquivo no Google Drive (status '+res.status+').'),{status:res.status});
    return await res.json();
  },

  /* V6.40 — move para a lixeira em vez de apagar de forma permanente (DELETE) —
     um arquivo de operação só é limpo bem depois de já estar refletido num
     snapshot consolidado e validado (ver cleanupAppliedOperations), mas mesmo
     assim preferimos "recuperável por 30 dias na lixeira do Drive" a "apagado
     sem volta", como proteção extra contra qualquer bug de limpeza. */
  async trashFile(fileId){
    const res = await this.request('https://www.googleapis.com/drive/v3/files/' + fileId + '?fields=id,trashed', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true })
    });
    if(!res.ok) throw Object.assign(new Error('Falha ao mover arquivo para a lixeira do Google Drive (status ' + res.status + ').'),{status:res.status});
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
function cloneAccountValue6401(value){
  return value==null ? value : JSON.parse(JSON.stringify(value));
}

/* Prepara TODA a conta em memória antes de tocar no estado persistido. Assim, uma
   exceção no segundo/terceiro perfil não deixa configurações novas combinadas com
   somente parte dos perfis migrados. Dados órfãos e IDs de perfil duplicados entram
   em recuperação em vez de serem ignorados. */
function prepareAccountPayload6401(obj){
  if(!obj||typeof obj!=='object'||Array.isArray(obj)) throw Object.assign(new Error('Payload de conta inválido.'),{code:'ACCOUNT_PAYLOAD_INVALID'});
  const nextProfiles=cloneAccountValue6401(obj.profiles||[]);
  const rawData=obj.dataByProfile;
  if(!Array.isArray(nextProfiles)||!rawData||typeof rawData!=='object'||Array.isArray(rawData)) throw Object.assign(new Error('Conta sem índice íntegro de perfis.'),{code:'ACCOUNT_PROFILE_INDEX_INVALID'});
  const ids=new Set();
  for(const profile of nextProfiles){
    const id=profile&&profile.id!=null?String(profile.id):'';
    if(!id) throw Object.assign(new Error('Perfil sem ID; aplicação bloqueada.'),{code:'PROFILE_ID_MISSING'});
    if(ids.has(id)) throw Object.assign(new Error('ID de perfil duplicado: '+id+'.'),{code:'PROFILE_ID_DUPLICATE',profileId:id});
    ids.add(id);
    if(!Object.prototype.hasOwnProperty.call(rawData,id)) throw Object.assign(new Error('Perfil '+id+' sem dados correspondentes.'),{code:'PROFILE_DATA_MISSING',profileId:id});
  }
  const orphanIds=Object.keys(rawData).filter(id=>!ids.has(String(id)));
  if(orphanIds.length) throw Object.assign(new Error('Dados órfãos de perfil detectados: '+orphanIds.join(', ')+'.'),{code:'PROFILE_DATA_ORPHANED',profileIds:orphanIds});
  const nextDataByProfile={};
  for(const profile of nextProfiles){
    const id=String(profile.id);
    const raw=cloneAccountValue6401(rawData[id]);
    nextDataByProfile[id]=migrateData(raw||emptyData(),{profileId:id});
  }
  return {
    config:cloneAccountValue6401(obj.config!=null?obj.config:(S.config||{})),
    profiles:nextProfiles,
    dataByProfile:nextDataByProfile,
    profileTombstones:cloneAccountValue6401(obj.__syncMeta640&&obj.__syncMeta640.profileTombstones)
  };
}

async function buildMigratedSnapshot6401(obj){
  const prepared=prepareAccountPayload6401(obj);
  const out=cloneAccountValue6401(obj);
  out.config=prepared.config;out.profiles=prepared.profiles;out.dataByProfile=prepared.dataByProfile;
  out.profileCount=prepared.profiles.length;
  out.appVersion=BORION_APP_VERSION;
  out.__syncMeta640=Object.assign({},out.__syncMeta640||{}, {
    schemaVersion:BorionSyncCore.BORION_DATA_SCHEMA_VERSION,
    profileTombstones:prepared.profileTombstones||((out.__syncMeta640&&out.__syncMeta640.profileTombstones)||{})
  });
  const canonical=cloneAccountValue6401(out);delete canonical.integrity;
  out.integrity=Object.assign({},out.integrity||{}, {
    algorithm:'SHA-256',checksum:await BorionSyncCore.checksumOf(canonical),
    schemaVersion:BorionSyncCore.BORION_DATA_SCHEMA_VERSION,generatedAt:new Date().toISOString(),
    recordCount:(window.BorionDataGuard?BorionDataGuard.countAccountRecords(out).__total:undefined),
    profileCount:prepared.profiles.length
  });
  return out;
}

function commitPreparedAccountPayload6401(prepared,options={}){
  const previous={
    config:cloneAccountValue6401(S.config||{}),profiles:cloneAccountValue6401(S.profiles||[]),
    currentProfile:cloneAccountValue6401(S.currentProfile),data:cloneAccountValue6401(S.data),
    tombstones:typeof getProfileTombstones6401==='function'?cloneAccountValue6401(getProfileTombstones6401()):null,
    dataByProfile:{}
  };
  for(const p of previous.profiles||[]) if(p&&p.id!=null){const id=String(p.id);const stored=typeof getProfileData==='function'?getProfileData(id):((S.currentProfile&&String(S.currentProfile.id)===id)?S.data:null);previous.dataByProfile[id]=cloneAccountValue6401(stored);}
  const nextIds=new Set((prepared.profiles||[]).map(p=>String(p.id)));
  try{
    // Persistência só começa depois que todos os perfis terminaram a migração em memória.
    setConfig(prepared.config);setProfiles(prepared.profiles);
    for(const p of prepared.profiles) setProfileData(String(p.id),prepared.dataByProfile[String(p.id)]);
    if(prepared.profileTombstones&&typeof applyProfileTombstones6401==='function') applyProfileTombstones6401(prepared.profileTombstones);
    S.config=prepared.config;S.profiles=prepared.profiles;
    if(options.preserveCurrentProfile&&previous.currentProfile){
      const active=prepared.profiles.find(p=>String(p.id)===String(previous.currentProfile.id));
      if(active){S.currentProfile=active;S.data=prepared.dataByProfile[String(active.id)];return {profileRemoved:false};}
      S.currentProfile=null;S.data=null;return {profileRemoved:true};
    }
    S.currentProfile=null;S.data=null;return {profileRemoved:false};
  }catch(error){
    // Rollback melhor-esforço: nunca deixa uma conta parcialmente aplicada por uma
    // falha de armazenamento/quota. O snapshot remoto e o journal permanecem intactos.
    try{
      setConfig(previous.config);setProfiles(previous.profiles);
      for(const [id,data] of Object.entries(previous.dataByProfile)) if(data!=null)setProfileData(id,data);
      for(const id of nextIds) if(!Object.prototype.hasOwnProperty.call(previous.dataByProfile,id)){
        try{localStorage.removeItem('mc_data_'+id);}catch(_e){}
        try{if(typeof idbDeleteProfileData==='function')idbDeleteProfileData(id);}catch(_e){}
      }
      if(previous.tombstones&&typeof setProfileTombstones6401==='function')setProfileTombstones6401(previous.tombstones);
      S.config=previous.config;S.profiles=previous.profiles;S.currentProfile=previous.currentProfile;S.data=previous.data;
    }catch(rollbackError){console.error('[GoogleDriveProvider] rollback local da conta falhou:',rollbackError);}
    throw Object.assign(error instanceof Error?error:new Error(String(error)),{code:(error&&error.code)||'ACCOUNT_COMMIT_FAILED'});
  }
}

function applyAccountPayloadSilently(obj){
  const prepared=prepareAccountPayload6401(obj);
  return commitPreparedAccountPayload6401(prepared,{preserveCurrentProfile:false});
}

/* V6.38.0 — versão "gentil" da função acima, usada pela atualização automática em
   segundo plano (checkForRemoteUpdate): atualiza os perfis e os dados de TODOS eles
   (assim como applyAccountPayloadSilently), mas NÃO derruba a pessoa de volta pro
   seletor de perfil — se ela já estava dentro de um perfil, continua nele, só com os
   números atualizados. Só sai do perfil atual no caso raro de ele ter sido apagado
   em outro dispositivo enquanto esta aba estava aberta. */
function applyAccountPayloadForLiveUpdate(obj){
  const prepared=prepareAccountPayload6401(obj);
  return commitPreparedAccountPayload6401(prepared,{preserveCurrentProfile:true});
}

/* V6.38.0 — nunca aplica uma atualização automática em cima de algo que a pessoa
   está digitando ou de um modal aberto (ex.: criando um lançamento) — isso poderia
   apagar o que ela estava preenchendo ou mudar o conteúdo debaixo dela sem aviso.
   Se não for seguro agora, a próxima checagem (poucos segundos depois) tenta de
   novo sozinha — nenhuma atualização é perdida, só adiada. */
function borionLiveUpdateSafeToApplyNow(){
  if(document.querySelector('.modal-overlay')) return false;
  const active = document.activeElement;
  if(active){
    const tag = (active.tagName||'').toUpperCase();
    if(tag==='INPUT' || tag==='TEXTAREA' || tag==='SELECT') return false;
    if(active.isContentEditable) return false;
  }
  return true;
}

/* ---------------- Provider principal ---------------- */
const GoogleDriveProvider = {
  folderId: null,
  currentFileId: null,
  _backupsFolderId:null,_backupsFolderIds:[],_backupsFolderDuplicates:[],_backupsFolderPromise:null,
  currentFileMeta: null,
  dirty: false,
  syncTimer: null,
  autosaveTimer: null,
  autosaveKickTimer: null,
  liveTimer: null,
  _liveCheckInFlight: false,
  autosaveSlotIndex: 0,
  forcesaveSlotIndex: 0,
  autosaveDirtySinceLast: false,
  lastAutosaveAt: 0,
  _autosaveRevision: 0,
  _autosaveInFlight: false,
  _syncInFlight: false,
  _syncAgain: false,
  _syncRevision: 0,
  _forceRequested: false,
  _forceSavePromise: null,
  syncRetryTimer: null,
  syncRetryAttempt: 0,
  lastSyncAt: 0,
  lastSyncError: '',
  authRequired: false,
  _lastFailureToastAt: 0,
  // V6.40 — journal de operações imutáveis + merge de três vias.
  _deviceId: null,
  _lastConsolidatedPayload: null,
  _operationBasePayload: null,
  _queueOperationId: null,
  _consolidateCount: 0,
  pendingMergeConflicts: [],

  isConnected(){ return !!(GoogleDriveAuth.user && this.folderId); },

  hasPersistedPending(){
    try{ return !!(this.folderId && localStorage.getItem(gdrivePendingKey(this.folderId))); }
    catch(e){ return false; }
  },

  hasPersistedConsolidation(){
    try{ return !!(this.folderId && localStorage.getItem(gdriveConsolidationKey(this.folderId))); }
    catch(e){ return false; }
  },

  _persistConsolidationPending(operationId){
    this._protectedOperationId=operationId||this._protectedOperationId||null;
    try{localStorage.setItem(gdriveConsolidationKey(this.folderId),JSON.stringify({operationId:this._protectedOperationId,createdAt:new Date().toISOString()}));}catch(e){}
  },

  _readPersistedConsolidationOperationId(){
    try{const raw=localStorage.getItem(gdriveConsolidationKey(this.folderId));if(!raw)return this._protectedOperationId||null;const obj=JSON.parse(raw);return obj&&obj.operationId||this._protectedOperationId||null;}catch(e){return this._protectedOperationId||null;}
  },

  _clearConsolidationPending(){
    this._protectedOperationId=null;
    try{if(this.folderId)localStorage.removeItem(gdriveConsolidationKey(this.folderId));}catch(e){}
  },

  _isAuthError(error){
    if(error&&Number(error.status)===401) return true;
    const msg = String((error && error.message) || error || '');
    return /status\s*401|oauth|token|google recusou|login com google|renova|popup|access[_ -]?denied|interaction[_ -]?required/i.test(msg);
  },

  _refreshStatusUI(){
    if(typeof document==='undefined'||typeof document.getElementById!=='function')return;
    const el=document.getElementById('cloud_status_badge');if(!el||!this.isConnected())return;
    el.onclick=()=>this.handleStatusClick();
    const state=(window.BorionSyncState&&BorionSyncState.current)||'';
    if(this.blockedSuspicious){el.className='cloud-status offline';el.textContent='Salvamento bloqueado — ver';el.title=this.blockedSuspicious;return;}
    if(this.pendingMergeConflicts&&this.pendingMergeConflicts.length&&!this.dirty&&!this._syncInFlight){el.className='cloud-status offline';el.textContent='Conflito precisa de revisão';el.title=this.pendingMergeConflicts.length+' conflito(s) preservado(s) para revisão.';return;}
    if(state==='RECOVERY'||state==='JOURNAL_ERROR'){el.className='cloud-status offline';el.textContent=state==='RECOVERY'?'Modo de recuperação':'Erro no journal';el.title=this.lastSyncError||'O último snapshot válido foi preservado.';return;}
    if(this.authRequired||state==='AUTH_REQUIRED'){el.className='cloud-status offline';el.textContent='Google Drive — reconectar';el.title=this.lastSyncError||'Autenticação necessária.';return;}
    if(!navigator.onLine||state==='OFFLINE_PENDING'){el.className='cloud-status offline';el.textContent='Salvo neste dispositivo';el.title='Offline. A alteração está preservada localmente e será enviada quando a internet voltar.';return;}
    if(state==='PROTECTING_DRIVE'){el.className='cloud-status syncing';el.textContent='Protegendo alteração no Drive';el.title='Criando a operação imutável no Google Drive.';return;}
    if(state==='DRIVE_PROTECTED'||this.hasPersistedConsolidation()){el.className='cloud-status syncing';el.textContent='Alteração protegida no Drive';el.title='A operação existe no Drive, mas o snapshot ainda precisa ser consolidado.';return;}
    if(state==='MERGING'){el.className='cloud-status syncing';el.textContent='Consolidando dados';el.title='Aplicando operações ao snapshot e validando checksum.';return;}
    if(this.dirty||this._syncInFlight||this.hasPersistedPending()||state==='QUEUED'){el.className='cloud-status syncing';el.textContent='Operação pendente';el.title='Salvo neste dispositivo; aguardando proteção e consolidação no Drive.';return;}
    if(this.lastSyncError){el.className='cloud-status offline';el.textContent='Erro de sincronização';el.title=this.lastSyncError;return;}
    el.className='cloud-status local';el.textContent='Sincronizado com o Drive';el.title='Snapshot consolidado e confirmado'+(this.lastSyncAt?' às '+new Date(this.lastSyncAt).toLocaleTimeString('pt-BR'):'')+'.';
  },

  _clearRetry(){
    if(this.syncRetryTimer){ clearTimeout(this.syncRetryTimer); this.syncRetryTimer=null; }
    this.syncRetryAttempt=0;
  },

  _scheduleRetry(delayOverride){
    if(!this.isConnected() || (!this.dirty&&!this.hasPersistedConsolidation()) || this.conflict || this.blockedSuspicious) return;
    if(this.syncRetryTimer) return;
    const delay = Number.isFinite(delayOverride)
      ? Math.max(1000, delayOverride)
      : Math.min(60000, 3000 * Math.pow(2, Math.min(this.syncRetryAttempt, 4)));
    this.syncRetryAttempt++;
    this.syncRetryTimer=setTimeout(()=>{
      this.syncRetryTimer=null;
      if(this.dirty||this.hasPersistedConsolidation()) this.syncNow({source:'retry'});
    }, delay);
  },

  _recordSyncFailure(error, options={}){
    const msg = String((error && error.message) || error || 'Falha desconhecida ao acessar o Google Drive.');
    this.lastSyncError = msg;
    this.authRequired = this._isAuthError(error);
    this.dirty = true;
    this._refreshStatusUI();
    this._scheduleRetry(this.authRequired ? 15000 : undefined);
    const now=Date.now();
    if(!options.silent && now-this._lastFailureToastAt>12000){
      this._lastFailureToastAt=now;
      toast((this.authRequired?'A conexão com o Google expirou. Toque no selo para reconectar. ':'Não foi possível confirmar no Google Drive. ')+'Os dados continuam salvos neste dispositivo.');
    }
  },

  _recordSyncSuccess(){
    this.lastSyncAt=Date.now();
    this.lastSyncError='';
    this.authRequired=false;
    this._clearRetry();
    if(S && S.currentProfile && typeof clearExitSavePending==='function') clearExitSavePending(S.currentProfile.id);
    this._refreshStatusUI();
  },

  async resumePendingSync(source='resume'){
    if(!this.isConnected()) return false;
    if(window.BorionMultiTab640&&!BorionMultiTab640.isLeader()){BorionMultiTab640.requestSync({folderId:this.folderId,source});return {delegated:true,synced:false};}
    if(this.hasPersistedPending()) this.dirty=true;
    if(!this.dirty&&this.hasPersistedConsolidation()) return await this.syncNow({source,consolidationOnly:true});
    if(!this.dirty){
      this._refreshStatusUI();
      return await this.checkForRemoteUpdate();
    }
    if(!navigator.onLine){
      this.lastSyncError='Sem internet. A alteração está salva somente neste dispositivo por enquanto.';
      this.authRequired=false;
      this._refreshStatusUI();
      this._scheduleRetry(5000);
      return false;
    }
    return await this.syncNow({source});
  },

  async handleStatusClick(){
    if(this.blockedSuspicious){ await this.reload(); return false; }
    if(this.pendingMergeConflicts && this.pendingMergeConflicts.length && !this.dirty){
      // V6.40 — item 24: nenhum dado é apagado por clicar aqui. Isto só
      // mostra um resumo dos campos em conflito (as duas versões já foram
      // preservadas pelo merge) e limpa o indicador visual — uma tela de
      // revisão completa (aceitar local/remoto/duplicar) fica para uma
      // próxima entrega; por enquanto, a revisão manual do current.json e do
      // registro em __syncMeta.conflicts (por perfil) mostra os valores.
      const summary = this.pendingMergeConflicts.slice(0,5).map(c=>{
        if(c.kind==='field_conflict') return `${c.collection}#${c.id}.${c.field}`;
        return `${c.collection}#${c.id} (${c.kind})`;
      }).join(', ');
      toast('Conflito(s) de sincronização preservados sem perda de dados: '+summary+(this.pendingMergeConflicts.length>5?'…':'')+'. Detalhes completos em cada perfil, dataByProfile.<perfil>.__syncMeta.conflicts.');
      this.pendingMergeConflicts = [];
      this._refreshStatusUI();
      return true;
    }
    try{
      if(this.authRequired){
        const previousSub=GoogleDriveAuth.user && GoogleDriveAuth.user.sub;
        await GoogleDriveAuth.login(true);
        if(previousSub && GoogleDriveAuth.user && GoogleDriveAuth.user.sub!==previousSub){
          throw new Error('Reconecte usando a mesma conta Google que já estava vinculada a esta pasta.');
        }
        this.lastSyncError=''; this.authRequired=false;
      }
      const ok=await this.resumePendingSync('status_click');
      if(ok || !this.dirty) toast('Google Drive sincronizado e confirmado.');
      return !!ok;
    }catch(e){
      this._recordSyncFailure(e);
      return false;
    }
  },

  /* Login + (primeira vez) escolher pasta + carregar/ou perguntar o que fazer. Essa
     função já decide sozinha pra qual tela ir (Gate normal ou onboarding de pasta
     vazia) — quem chama connect() não precisa mais renderizar nada depois. */
  async connect(interactive){
    await GoogleDriveAuth.login(interactive);
    // V6.40 — identidade estável do dispositivo (item 7 do pedido): UUID sem
    // nenhuma informação pessoal, criado uma única vez, com cópia de
    // recuperação no localStorage além do IndexedDB. sessionId é novo a cada
    // carregamento do app. Ambos viajam dentro de cada operação gravada no
    // journal (01g), permitindo saber quem/quando sem expor e-mail/nome nos
    // arquivos de sincronização.
    if(!this._deviceId && window.BorionDevice640) this._deviceId = await BorionDevice640.getOrCreateDeviceId();
    if(window.BorionDevice640) BorionDevice640.newSessionId();
    if(window.BorionMultiTab640 && !BorionMultiTab640.tabId){
      BorionMultiTab640.init({
        onBecomeLeader: ()=>{ if(this.dirty || this.hasPersistedPending() || this.hasPersistedConsolidation()) this.resumePendingSync('multitab_leader'); },
        onPendingFromFollower: ()=>{ if(this.hasPersistedPending()) this.dirty = true; this.resumePendingSync('multitab_follower_notify'); }
      });
    }
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
    this.startLivePollLoop();
    // O backup exato pré-migração já foi validado dentro de loadFromDrive(), antes de migrateData.
    if(window.BackupFS) BackupFS.maybeDailyDriveSnapshot().catch(e=>console.warn('[GoogleDriveProvider] ponto diário imutável falhou (não crítico):',e));
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
    const file=await GoogleDriveFS.findChild(this.folderId,'current.json');
    if(!file) return {empty:true};
    this.currentFileId=file.id;this.currentFileMeta=file;

    const rawText=await GoogleDriveFS.readFileText(file.id);
    let migrationBackupResult={notRequired:false};
    if(window.BackupFS){
      try{migrationBackupResult=await BackupFS.ensureRawSchemaMigrationBackup({rawText,sourceFileId:file.id});}
      catch(e){
        this.lastSyncError='Migração bloqueada: '+String(e&&e.message||e);this.authRequired=false;
        if(window.BorionSyncState) BorionSyncState.set('RECOVERY',{error:this.lastSyncError});
        this._refreshStatusUI();
        throw e;
      }
    }
    let remoteSnapshot;
    try{remoteSnapshot=JSON.parse(rawText);}catch(e){throw new Error('O current.json desta pasta está truncado ou contém JSON malformado.');}
    const sourceCheck=validateBorionJson(remoteSnapshot);
    if(!sourceCheck.valid) throw new Error('O current.json desta pasta parece corrompido: '+sourceCheck.errors.join(' '));

    // Captura a base local pendente antes de aplicar qualquer snapshot remoto.
    const pendingSince=localStorage.getItem(gdrivePendingKey(this.folderId));
    let localPendingPayload=null;
    if(pendingSince){
      try{localPendingPayload=await buildFullBackupPayload();}
      catch(e){console.warn('[GoogleDriveProvider] não foi possível montar a pendência local no boot:',e);}
    }

    let visibleSnapshot=remoteSnapshot,journalPending=false,journalError=null;
    try{
      if(window.BorionSyncState) BorionSyncState.set('MERGING',{source:'boot'});
      const result=await BorionDriveJournal640.consolidate(this.folderId,remoteSnapshot);
      const migrationRequired=!(migrationBackupResult&&migrationBackupResult.notRequired);
      if(result.newlyApplied.length||migrationRequired){
        // A migração ocorre integralmente em memória, depois do backup bruto e antes
        // de qualquer PATCH. Mesmo sem operação nova, o schema 6401 é persistido uma
        // única vez; assim a base não é remigrada a cada inicialização.
        visibleSnapshot=await buildMigratedSnapshot6401(result.consolidated);
        const precheck=await BorionDriveJournal640.validateSnapshot(visibleSnapshot);
        if(!precheck.valid) throw new Error('Snapshot consolidado/migrado falhou na validação antes da gravação: '+precheck.reason);
        const updated=await GoogleDriveFS.updateFile(this.currentFileId,visibleSnapshot);
        const confirmed=await GoogleDriveFS.readFile(this.currentFileId);
        const requiredId=result.newlyApplied.length?result.newlyApplied[result.newlyApplied.length-1].operationId:undefined;
        const confirmCheck=await BorionDriveJournal640.validateSnapshot(confirmed,requiredId);
        if(!confirmCheck.valid) throw new Error('Snapshot gravado não confirmou a migração/operação: '+confirmCheck.reason);
        visibleSnapshot=confirmed;this.currentFileMeta=updated;
      }else visibleSnapshot=remoteSnapshot;
      this._lastConsolidatedPayload=visibleSnapshot;
      this._surfaceMergeConflicts(visibleSnapshot);
      const bootRequiredOperationId=this._readPersistedConsolidationOperationId();
      const bootValidation=await BorionDriveJournal640.validateSnapshot(visibleSnapshot,bootRequiredOperationId||undefined);
      if(!bootValidation.valid) throw new Error('O journal foi lido, mas a operação protegida ainda não apareceu no snapshot: '+bootValidation.reason);
      this._clearConsolidationPending();
      if(window.BorionSyncState) BorionSyncState.set('SNAPSHOT_CONFIRMED');
    }catch(e){
      journalPending=true;journalError=e;
      visibleSnapshot=remoteSnapshot;
      this._persistConsolidationPending(this._readPersistedConsolidationOperationId());
      this.lastSyncError='Existem operações no journal aguardando recuperação: '+String(e&&e.message||e);
      if(window.BorionSyncState) BorionSyncState.set('JOURNAL_ERROR',{error:this.lastSyncError});
      console.warn('[GoogleDriveProvider] journal não pôde ser consolidado no boot; último snapshot válido carregado:',e);
    }

    if(localPendingPayload){
      visibleSnapshot=BorionSyncCore.mergeAccountPayload(remoteSnapshot,localPendingPayload,visibleSnapshot);
      this.dirty=true;
      try{localStorage.setItem(gdrivePendingKey(this.folderId),String(Date.now()));}catch(e){}
    }
    try{applyAccountPayloadSilently(visibleSnapshot);}
    catch(e){
      this.lastSyncError='Aplicação/migração local bloqueada: '+String(e&&e.message||e);
      if(window.BorionSyncState)BorionSyncState.set('RECOVERY',{error:this.lastSyncError,code:e&&e.code});
      this._refreshStatusUI();
      throw e;
    }
    this.lastKnownProfileCount=(visibleSnapshot.profiles||[]).length;
    this._operationBasePayload=this._lastConsolidatedPayload?JSON.parse(JSON.stringify(this._lastConsolidatedPayload)):JSON.parse(JSON.stringify(remoteSnapshot));
    if(window.BorionDataGuard){
      const counts=BorionDataGuard.countAccountRecords(visibleSnapshot);this._lastGoodCounts=counts;BorionDataGuard.writeLastGoodCounts(this.folderId,counts);
    }
    if(localPendingPayload){
      if(!window.BorionMultiTab640||BorionMultiTab640.isLeader()) await this.syncNow({source:'boot_pending',payloadOverride:visibleSnapshot});
      else BorionMultiTab640.requestSync({folderId:this.folderId,source:'boot_pending'});
    }else if(!journalPending){
      this.lastSyncAt=Date.now();this.lastSyncError='';this.authRequired=false;this.dirty=false;
    }
    this._refreshStatusUI();
    return {empty:false,pending:this.dirty||journalPending,journalError:journalError?String(journalError.message||journalError):null};
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
    this.dirty = false; this.conflict = false; this.lastSyncError=''; this.authRequired=false;
    clearTimeout(this.syncTimer);
    this._clearRetry();
    try{ if(this.folderId) localStorage.removeItem(gdrivePendingKey(this.folderId)); }catch(e){}
    this._clearConsolidationPending();
    if(S && S.currentProfile && typeof clearExitSavePending==='function') clearExitSavePending(S.currentProfile.id);
    const result = await this.loadFromDrive();
    if(result && result.empty){ renderGoogleDriveOnboarding(); }
    else { S.gate = { mode: 'list', error: '' }; renderGate(); }
  },

  /* Chamado de dentro de saveCurrentData() (mesmo gancho que o Supabase usa) — só
     marca como pendente e agenda 250ms antes de mandar pro Drive, pra não fazer uma
     chamada de rede a cada tecla digitada. Continua em 250ms (V6.38.1) — a
     V6.40 não muda esse tempo, só o que acontece quando o timer dispara (ver
     syncNow abaixo): em vez de "ler modifiedTime e sobrescrever", agora grava
     uma operação imutável e consolida com merge de três vias. */
  queueSave(){
    if(!this.isConnected()) return;
    // V6.40 — captura a "base" desta leva de alterações (o último snapshot
    // consolidado conhecido) na TRANSIÇÃO de limpo->sujo, não a cada tecla —
    // é o que permite ao merge de três vias (01e) saber o que realmente mudou
    // neste dispositivo desde a última sincronização, mesmo que a operação só
    // seja de fato enviada bem depois (rede lenta, várias edições seguidas).
    if(!this.dirty && !this._operationBasePayload && this._lastConsolidatedPayload){
      try{ this._operationBasePayload = JSON.parse(JSON.stringify(this._lastConsolidatedPayload)); }catch(e){ this._operationBasePayload = null; }
    }
    this.dirty = true;
    this.autosaveDirtySinceLast = true;
    this._autosaveRevision++;
    this._syncRevision++;
    this.lastSyncError='';
    this.authRequired=false;
    if(window.BorionSyncState) BorionSyncState.set(navigator.onLine ? 'QUEUED' : 'OFFLINE_PENDING');
    this._refreshStatusUI();
    // V6.16.0 — grava um marcador PERSISTENTE (sobrevive a reload/fechar aba) de que
    // existe uma alteração ainda não confirmada no Drive. Ver loadFromDrive(): se esse
    // marcador ainda estiver presente na próxima conexão, o dado local é tratado como
    // o mais recente, em vez de deixar a leitura do Drive (possivelmente desatualizada)
    // sobrescrever uma alteração que nunca chegou a ser enviada.
    try{ localStorage.setItem(gdrivePendingKey(this.folderId), String(Date.now())); }catch(e){}
    // V6.40 — fila durável no IndexedDB (item 9 do pedido): a pendência só é
    // removida dali depois de confirmação remota real (ver confirmRemote em
    // syncNow), nunca antes — mesmo que a aba feche entre este ponto e o envio.
    if(window.BorionDurableQueue && window.BorionDevice640){
      if(!this._queueOperationId) this._queueOperationId = BorionSyncCore.uuid640();
      BorionDurableQueue.enqueue({
        id: this._queueOperationId, operationId: this._queueOperationId,
        deviceId: this._deviceId||null, sessionId: BorionDevice640.sessionId(),
        profileId: (S.currentProfile&&S.currentProfile.id)||null,
        schemaVersion: BorionSyncCore.BORION_DATA_SCHEMA_VERSION
      }).catch(e=>console.warn('[GoogleDriveProvider] falha ao gravar fila durável (não bloqueia o salvamento local):', e));
    }
    const _leader=!window.BorionMultiTab640||BorionMultiTab640.isLeader();
    if(!_leader){ BorionMultiTab640.requestSync({folderId:this.folderId,operationId:this._queueOperationId}); clearTimeout(this.syncTimer); }
    else { clearTimeout(this.syncTimer); this.syncTimer=setTimeout(()=>this.syncNow({source:'queue'}),250); }
    this.scheduleAutosaveSoon();
  },

  /* V6.10.0 — rede de segurança extra, além do current.json (que já salva ~250ms
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

  /* V6.38.0 — "atualização ao vivo": confere a cada poucos segundos se outro
     dispositivo salvou algo novo, e se sim atualiza a tela sozinho, sem precisar
     sair do app e entrar de novo. Ver checkForRemoteUpdate() para os detalhes e
     as travas de segurança (nunca roda por cima de uma alteração local pendente,
     nunca interrompe quem está digitando). */
  startLivePollLoop(){
    this.stopLivePollLoop();
    this.liveTimer = setInterval(()=>{ this.checkForRemoteUpdate(); }, GOOGLE_DRIVE_LIVE_POLL_MS);
  },
  stopLivePollLoop(){
    if(this.liveTimer){ clearInterval(this.liveTimer); this.liveTimer = null; }
  },

  /* Só confere METADADOS (this.currentFileMeta.modifiedTime) — a mesma chamada
     barata que o syncNow() já usa pra detectar conflito, sem baixar o conteúdo à
     toa. Só busca o conteúdo completo quando a data realmente mudou. Nunca roda
     enquanto: não está conectado; existe uma alteração local pendente (dirty —
     nesse caso é o próprio syncNow()/conflito que decide, não a atualização ao
     vivo); já existe uma checagem ao vivo ou uma sincronização em andamento; a
     aba está em segundo plano (document.hidden); ou já existe um conflito
     aguardando decisão da pessoa. */
  async checkForRemoteUpdate(){
    if(window.BorionMultiTab640&&!BorionMultiTab640.isLeader()) return false;
    if(this.hasPersistedConsolidation()) return await this.syncNow({source:'live_journal',consolidationOnly:true});
    if(!this.isConnected() || !this.currentFileId) return false;
    if(this.dirty || this.conflict) return false;
    if(this._liveCheckInFlight || this._syncInFlight || this._autosaveInFlight) return false;
    if(typeof document!=='undefined' && document.hidden) return false;
    this._liveCheckInFlight = true;
    try{
      const freshMeta = await GoogleDriveFS.getFileMeta(this.currentFileId);
      if(!this.currentFileMeta || !this.currentFileMeta.modifiedTime || !freshMeta.modifiedTime) return false;
      if(freshMeta.modifiedTime === this.currentFileMeta.modifiedTime){
        if(this.lastSyncError && !this.dirty){ this.lastSyncError=''; this.authRequired=false; this._refreshStatusUI(); }
        return false; // nada novo
      }

      // Algo mudou no Drive desde a última leitura deste dispositivo. Só aplica
      // agora se não for atrapalhar a pessoa (modal aberto, campo em edição) —
      // senão adia pra próxima checagem, poucos segundos depois, sem perder o
      // sinal de que existe algo novo (currentFileMeta só é atualizado quando a
      // atualização é realmente aplicada).
      if(!borionLiveUpdateSafeToApplyNow()) return false;

      const data = await GoogleDriveFS.readFile(this.currentFileId);
      const check = validateBorionJson(data);
      if(!check.valid){ console.warn('[GoogleDriveProvider] atualização ao vivo ignorada: current.json parecia inválido.'); return false; }

      const result = applyAccountPayloadForLiveUpdate(data);
      this.currentFileMeta = freshMeta;
      this.lastKnownProfileCount = (data.profiles || []).length;
      // V6.40 — como isto só roda com this.dirty===false (checado acima), não
      // existe uma leva de alterações locais em andamento cuja base precisa
      // ser preservada — é seguro adotar este snapshot como a nova base.
      this._lastConsolidatedPayload = data;
      this._operationBasePayload = null;
      if(window.BorionDataGuard){
        const counts = BorionDataGuard.countAccountRecords(data);
        this._lastGoodCounts = counts;
        BorionDataGuard.writeLastGoodCounts(this.folderId, counts);
      }

      if(result.profileRemoved){
        toast('O perfil que estava aberto foi removido em outro dispositivo.');
        S.gate = { mode: 'list', error: '' };
        renderGate();
      } else if(S.currentProfile && S.data){
        renderView();
        toast('Atualizado com uma alteração feita em outro dispositivo.');
      } else if(document.querySelector('.gate-wrap') && (!S.gate || S.gate.mode==='list')){
        // Fora do modo "list" (ex.: preenchendo senha ou criando perfil), os
        // dados já foram atualizados silenciosamente acima — só a tela não é
        // redesenhada agora, pra não apagar um formulário em andamento. Aparece
        // sozinho na próxima vez que a pessoa voltar pra lista de perfis.
        renderGate();
      }
      return true;
    }catch(e){
      // Falha de rede/token aqui não é grave — é só uma checagem de fundo; a
      // próxima tentativa (poucos segundos depois) resolve sozinha.
      console.warn('[GoogleDriveProvider] checagem de atualização ao vivo falhou (tenta de novo em breve):', e);
      this.lastSyncError=String((e&&e.message)||e||'Falha ao consultar o Google Drive.');
      this.authRequired=this._isAuthError(e);
      this._refreshStatusUI();
      return false;
    }finally{
      this._liveCheckInFlight = false;
    }
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
      const existing = (await this.findBackupFilesByName(name))[0]||null;
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
      // Sempre cria também um ponto de recuperação neste dispositivo. Assim, mesmo
      // que o token do Google expire ou a rede caia, o autosave do minuto não some.
      if(window.storageProvider && typeof storageProvider.createBackup==='function'){
        try{ await storageProvider.createBackup('auto', {payload}); }
        catch(localError){ console.warn('[GoogleDriveProvider] autosave local extra falhou (não crítico):', localError); }
      }
      if(this.dirty && !this._syncInFlight) await this.syncNow({source:'autosave'});
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

  /* V6.40 — reescrito para eliminar a corrida "last writer wins" descrita no
     pedido: em vez de conferir modifiedTime e sobrescrever current.json
     diretamente, grava uma OPERAÇÃO IMUTÁVEL (arquivo novo, nome único — o
     Drive garante que isso nunca colide) e consolida via merge de três vias
     (js/01e + js/01g). Se a consolidação perder uma corrida contra outro
     dispositivo consolidando ao mesmo tempo, nada se perde: a operação deste
     dispositivo continua existindo como arquivo e entra na próxima
     consolidação (deste ou de qualquer outro dispositivo). */
  async syncNow(options={}){
    if(!this.isConnected()||!this.currentFileId) return false;
    if(window.BorionMultiTab640&&!BorionMultiTab640.isLeader()){
      BorionMultiTab640.requestSync({folderId:this.folderId,source:options.source||'syncNow'});
      return {delegated:true,synced:false};
    }
    if(this.hasPersistedPending()) this.dirty=true;
    if(!this.dirty&&this.hasPersistedConsolidation()) options.consolidationOnly=true;
    if(!this.dirty&&!options.payloadOverride&&!options.consolidationOnly){this._recordSyncSuccess();if(window.BorionSyncState)BorionSyncState.set('SNAPSHOT_CONFIRMED');return true;}
    if(this._syncInFlight){this._syncAgain=true;return false;}
    if(!navigator.onLine){this._recordSyncFailure(new Error('Sem internet. Alteração salva somente neste dispositivo.'),{silent:true});if(window.BorionSyncState)BorionSyncState.set('OFFLINE_PENDING');return false;}
    this._syncInFlight=true;
    if(options.consolidationOnly){
      const requiredOperationId=this._readPersistedConsolidationOperationId();
      try{
        if(window.BorionSyncState)BorionSyncState.set('MERGING',{operationId:requiredOperationId,source:options.source||'retry'});
        const remoteRaw=await GoogleDriveFS.readFile(this.currentFileId);
        const remoteCheck=validateBorionJson(remoteRaw);if(!remoteCheck.valid)throw new Error('Snapshot remoto inválido: '+remoteCheck.errors.join(' '));
        const result=await BorionDriveJournal640.consolidate(this.folderId,remoteRaw);
        const candidate=await buildMigratedSnapshot6401(result.consolidated);
        const precheck=await BorionDriveJournal640.validateSnapshot(candidate,requiredOperationId||undefined);
        if(!precheck.valid)throw new Error('Consolidação pendente não foi confirmada: '+precheck.reason);
        // Entrou neste ramo porque existe um marcador durável de consolidação/reparo.
        // Portanto grava e relê mesmo quando a operação já constava como aplicada ou
        // quando a pendência era apenas persistir a migração 6401.
        const updated=await GoogleDriveFS.updateFile(this.currentFileId,candidate);
        const confirmed=await GoogleDriveFS.readFile(this.currentFileId);
        const confirmedCheck=await BorionDriveJournal640.validateSnapshot(confirmed,requiredOperationId||undefined);
        if(!confirmedCheck.valid)throw new Error('Snapshot relido não confirmou a consolidação: '+confirmedCheck.reason);
        this.currentFileMeta=updated||this.currentFileMeta;this._lastConsolidatedPayload=confirmed;this._operationBasePayload=JSON.parse(JSON.stringify(confirmed));
        this._surfaceMergeConflicts(confirmed);try{applyAccountPayloadForLiveUpdate(confirmed);}catch(e){console.warn('[GoogleDriveProvider] consolidação confirmada; atualização visual adiada:',e);}
        this._clearConsolidationPending();this.lastSyncError='';this._recordSyncSuccess();
        if(window.BorionSyncState)BorionSyncState.set('SNAPSHOT_CONFIRMED',{operationId:requiredOperationId,checksum:confirmedCheck.checksum});
        return true;
      }catch(e){
        this.lastSyncError='Alteração protegida no Drive, mas ainda não consolidada: '+String(e&&e.message||e);
        this.authRequired=this._isAuthError(e);this._persistConsolidationPending(requiredOperationId);this._scheduleRetry();
        if(window.BorionSyncState)BorionSyncState.set('DRIVE_PROTECTED',{operationId:requiredOperationId,error:this.lastSyncError});
        return false;
      }finally{
        this._syncInFlight=false;this._refreshStatusUI();
      }
    }
    if(window.BorionSyncState)BorionSyncState.set('PROTECTING_DRIVE');
    this._refreshStatusUI();
    const revision=this._syncRevision;
    let operationProtected=false,operationId=null;
    try{
      const payload=options.payloadOverride||await buildFullBackupPayload();
      const nextCounts=window.BorionDataGuard?BorionDataGuard.countAccountRecords(payload):null;
      const baseline=window.BorionDataGuard?(this._lastGoodCounts||BorionDataGuard.readLastGoodCounts(this.folderId)):null;
      const check=(nextCounts&&baseline)?BorionDataGuard.detectSuspiciousAccountDrop(nextCounts,baseline):{suspicious:false,reasons:[]};
      if(check.suspicious&&!options.acknowledgeSuspicious){
        const reasonText=BorionDataGuard.describeSuspiciousAccountReasons(check.reasons);this.blockedSuspicious=reasonText;this.lastSyncError='Salvamento bloqueado por segurança: '+reasonText;this.dirty=true;
        if(window.BorionSyncState)BorionSyncState.set('BLOCKED_SUSPICIOUS',{reason:reasonText});this._refreshStatusUI();return false;
      }
      this.blockedSuspicious=null;
      operationId=this._queueOperationId||BorionSyncCore.uuid640();this._queueOperationId=operationId;
      if(window.BorionDurableQueue)await BorionDurableQueue.enqueue({id:operationId,operationId,deviceId:this._deviceId||null,sessionId:window.BorionDevice640?BorionDevice640.sessionId():null,profileId:(S.currentProfile&&S.currentProfile.id)||null,schemaVersion:BorionSyncCore.BORION_DATA_SCHEMA_VERSION}).catch(()=>{});
      const operation={
        operationId,deviceId:this._deviceId||null,sessionId:window.BorionDevice640?BorionDevice640.sessionId():null,
        profileId:(S.currentProfile&&S.currentProfile.id)||null,createdAt:new Date().toISOString(),
        schemaVersion:BorionSyncCore.BORION_DATA_SCHEMA_VERSION,format:'full-snapshot-v1',
        basePayload:this._operationBasePayload||this._lastConsolidatedPayload||null,payload,
        checksum:await BorionSyncCore.checksumOf(payload),forced:!!options.force
      };
      await BorionDriveJournal640.writeOperation(this.folderId,operation);
      operationProtected=true;
      this._persistConsolidationPending(operationId);
      if(window.BorionDurableQueue)await BorionDurableQueue.confirmRemote(operationId).catch(()=>{});
      if(window.BorionSyncState)BorionSyncState.set('DRIVE_PROTECTED',{operationId});
      this.lastSyncError='Alteração protegida no Drive; aguardando consolidação do snapshot.';
      this._refreshStatusUI();

      if(window.BorionSyncState)BorionSyncState.set('MERGING',{operationId});
      const remoteRaw=await GoogleDriveFS.readFile(this.currentFileId);
      const remoteCheck=validateBorionJson(remoteRaw);if(!remoteCheck.valid)throw new Error('Snapshot remoto inválido: '+remoteCheck.errors.join(' '));
      const result=await BorionDriveJournal640.consolidate(this.folderId,remoteRaw);
      const precheck=await BorionDriveJournal640.validateSnapshot(result.consolidated,operationId);
      if(!precheck.valid)throw new Error('Consolidação não incorporou a operação '+operationId+': '+precheck.reason);
      const updated=await GoogleDriveFS.updateFile(this.currentFileId,result.consolidated);
      const confirmed=await GoogleDriveFS.readFile(this.currentFileId);
      const confirmedCheck=await BorionDriveJournal640.validateSnapshot(confirmed,operationId);
      if(!confirmedCheck.valid)throw new Error('O snapshot relido não confirmou a operação: '+confirmedCheck.reason);

      this.currentFileMeta=updated;this._lastConsolidatedPayload=confirmed;this._operationBasePayload=JSON.parse(JSON.stringify(confirmed));
      this._clearConsolidationPending();
      this._surfaceMergeConflicts(confirmed);
      try{applyAccountPayloadForLiveUpdate(confirmed);}catch(e){console.warn('[GoogleDriveProvider] snapshot confirmado, mas atualização local da UI foi adiada:',e);}
      this.conflict=false;this.lastKnownProfileCount=(confirmed.profiles||[]).length;
      if(window.BorionDataGuard){const counts=BorionDataGuard.countAccountRecords(confirmed);this._lastGoodCounts=counts;BorionDataGuard.writeLastGoodCounts(this.folderId,counts);}
      this.dirty=revision!==this._syncRevision;this._syncAgain=this.dirty;this._queueOperationId=null;
      if(!this.dirty)try{localStorage.removeItem(gdrivePendingKey(this.folderId));}catch(e){}
      this.lastSyncError='';this._recordSyncSuccess();
      if(window.BorionSyncState)BorionSyncState.set('SNAPSHOT_CONFIRMED',{operationId,checksum:confirmedCheck.checksum});
      return !this.dirty;
    }catch(e){
      this.dirty=true;
      try{localStorage.setItem(gdrivePendingKey(this.folderId),String(Date.now()));}catch(_e){}
      if(operationProtected){
        const newerLocalEdit=revision!==this._syncRevision;
        this.lastSyncError='Alteração protegida no Drive, mas ainda não consolidada: '+String(e&&e.message||e);
        this.authRequired=this._isAuthError(e);this._persistConsolidationPending(operationId);
        this.dirty=newerLocalEdit;this._queueOperationId=null;
        if(!newerLocalEdit)try{localStorage.removeItem(gdrivePendingKey(this.folderId));}catch(_e){}
        this._scheduleRetry();
        if(window.BorionSyncState)BorionSyncState.set('DRIVE_PROTECTED',{operationId,error:this.lastSyncError});
        console.warn('[GoogleDriveProvider] operação protegida; consolidação será repetida:',e);
        return !newerLocalEdit;
      }else{
        this._recordSyncFailure(e,{silent:options.source==='retry'});
        if(window.BorionSyncState)BorionSyncState.set(this.authRequired?'AUTH_REQUIRED':'ERROR');
      }
      return false;
    }finally{
      this._syncInFlight=false;this._refreshStatusUI();
      if(this._syncAgain&&!this._forceRequested){this._syncAgain=false;this.dirty=true;setTimeout(()=>this.syncNow({source:'follow_up'}),0);}
      else if((this.dirty||this.hasPersistedConsolidation())&&!this.conflict&&!this.blockedSuspicious)this._scheduleRetry();
    }
  },

  /* V6.40 — item 24 do pedido (tela de resolução de conflitos): registra os
     conflitos de campo/edição-x-exclusão encontrados pela consolidação mais
     recente em BorionSyncState, sem bloquear nada — os dois lados do conflito
     já foram preservados pelo merge (ver 01e); isto só torna a existência do
     conflito visível para quem for revisar em Configurações → Nuvem. Nenhum
     dado é apagado aqui; é só um índice para leitura humana depois. */
  _surfaceMergeConflicts(consolidated){
    try{
      const all = [];
      Object.keys((consolidated && consolidated.dataByProfile) || {}).forEach(pid=>{
        const meta = consolidated.dataByProfile[pid] && consolidated.dataByProfile[pid].__syncMeta;
        if(meta && Array.isArray(meta.conflicts) && meta.conflicts.length){
          meta.conflicts.forEach(c=>all.push(Object.assign({profileId:pid}, c)));
        }
      });
      this.pendingMergeConflicts = all;
      if(all.length && window.BorionSyncState) BorionSyncState.set('CONFLICT', {conflicts: all});
    }catch(e){ console.warn('[GoogleDriveProvider] falha ao coletar conflitos de merge (não crítico):', e); }
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
  /* V6.40 — item 16 do pedido: Ctrl+S deixa de significar "sobrescrever a
     versão remota mesmo que outro dispositivo tenha dados mais novos". Agora
     ele grava uma operação imutável (mesmo mecanismo do syncNow normal) e
     consolida com merge de três vias — a única diferença do fluxo automático
     é que Ctrl+S dispara isso IMEDIATAMENTE, sem esperar o debounce de 250ms,
     e sempre grava também no rodízio forcesave (histórico dos momentos em que
     você mesmo pediu pra salvar). Nada aqui decide "minha versão vale mais" —
     quem decide é o merge, como em qualquer outra sincronização. */
  async forceSyncNow(options={}){
    if(!this.isConnected()||!this.currentFileId)return false;
    if(window.BorionMultiTab640&&!BorionMultiTab640.isLeader()){
      BorionMultiTab640.requestSync({folderId:this.folderId,source:'force'});
      return {delegated:true,synced:false};
    }
    if(this._forceSavePromise)return this._forceSavePromise;
    this._forceRequested=true;
    this._forceSavePromise=(async()=>{
      clearTimeout(this.syncTimer);
      const payload=options.payload||await buildFullBackupPayload();
      this._assertSafeToForceWrite(payload,options);
      this.dirty=true;this._syncRevision++;
      const ok=await this.syncNow({source:'force',payloadOverride:payload,force:true,acknowledgeSuspicious:options.acknowledgeSuspicious});
      if(ok===true)await this.writeRotatingSnapshot('forcesave',GOOGLE_DRIVE_FORCESAVE_SLOTS,payload);
      return ok;
    })();
    try{return await this._forceSavePromise;}
    finally{this._forceRequested=false;this._forceSavePromise=null;}
  },

  async ensureBackupsFolder(){
    if(this._backupsFolderPromise) return this._backupsFolderPromise;
    this._backupsFolderPromise=(async()=>{
      let folders=await GoogleDriveFS.findChildren(this.folderId,'backups','application/vnd.google-apps.folder');
      if(!folders.length){
        const created=await GoogleDriveFS.createFolder(this.folderId,'backups');
        const relisted=await GoogleDriveFS.findChildren(this.folderId,'backups','application/vnd.google-apps.folder');
        folders=relisted.slice();
        if(created&&created.id&&!folders.some(f=>f.id===created.id))folders.push(Object.assign({parents:[this.folderId]},created));
      }
      const seen=new Set();folders=folders.filter(f=>f&&f.id&&!seen.has(f.id)&&(seen.add(f.id),true));
      folders.sort((a,b)=>String(a.createdTime||'').localeCompare(String(b.createdTime||''))||String(a.id).localeCompare(String(b.id)));
      if(!folders.length)throw new Error('Não foi possível localizar/criar a pasta de backups.');
      // Canônica determinística em todos os dispositivos. O ID local é apenas cache
      // diagnóstico e é revalidado em cada descoberta, nunca autoridade exclusiva.
      const canonical=folders[0];
      this._backupsFolderId=canonical.id;this._backupsFolderIds=folders.map(f=>f.id);
      this._backupsFolderDuplicates=folders.slice(1).map(f=>f.id);
      gdriveWriteBackupsFolderId(this.folderId,canonical.id);
      if(this._backupsFolderDuplicates.length)console.warn('[GoogleDriveProvider] pastas backups duplicadas detectadas; todas serão consideradas:',this._backupsFolderDuplicates);
      return canonical.id;
    })();
    try{return await this._backupsFolderPromise;}finally{this._backupsFolderPromise=null;}
  },

  async findBackupFilesByName(name){
    await this.ensureBackupsFolder();
    const all=[],seen=new Set();
    for(const folderId of this._backupsFolderIds){
      const files=await GoogleDriveFS.findChildren(folderId,name);
      for(const f of files)if(f&&f.id&&!seen.has(f.id)){seen.add(f.id);all.push(f);}
    }
    return all.sort((a,b)=>String(a.createdTime||'').localeCompare(String(b.createdTime||''))||String(a.id).localeCompare(String(b.id)));
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

  /* Limpeza conservadora: pagina todas as pastas duplicadas, preserva backups
     manuais/pré-migração e move os demais para a lixeira — nunca DELETE definitivo. */
  async pruneBackupsBySize(maxBytes){
    maxBytes=maxBytes||GOOGLE_DRIVE_BACKUP_MAX_BYTES;
    const files=await this.listBackups({includeSize:true});
    files.sort((a,b)=>String(b.modifiedTime||'').localeCompare(String(a.modifiedTime||''))||String(a.id).localeCompare(String(b.id)));
    let cumulative=0;const toTrash=[];
    const protectedReasons=['manual','manual_quick','manual_drive_local','before_import','before_restore','before_schema_migration'];
    for(const f of files){
      cumulative+=Number(f.size||0);
      const name=String(f.name||'');
      const protectedFile=name.includes('backup_original_pre_migracao_')||protectedReasons.some(r=>name.endsWith('_'+r+'.json'));
      if(cumulative>maxBytes&&!protectedFile)toTrash.push(f.id);
    }
    let trashed=0;
    for(const id of toTrash){
      try{await GoogleDriveFS.trashFile(id);trashed++;}
      catch(e){console.warn('[GoogleDriveProvider] falha ao mover backup antigo para a lixeira ('+id+'):',e);break;}
    }
    return {trashed,totalBytes:cumulative,interrupted:trashed<toTrash.length};
  },

  async listBackups(options={}){
    await this.ensureBackupsFolder();
    const all=[],seen=new Set();
    for(const folderId of this._backupsFolderIds){
      const files=await GoogleDriveFS.listChildren(folderId,{maxItems:250000,maxPages:1000,fields:'nextPageToken,files(id,name,modifiedTime,createdTime,size,parents)'});
      for(const f of files)if(f&&f.id&&!seen.has(f.id)){seen.add(f.id);all.push(f);}
    }
    all.sort((a,b)=>String(b.modifiedTime||'').localeCompare(String(a.modifiedTime||''))||String(a.id).localeCompare(String(b.id)));
    return all.map(f=>({id:f.id,name:f.name,modifiedTime:f.modifiedTime,createdTime:f.createdTime,size:options.includeSize?Number(f.size||0):undefined,parents:f.parents||[]}));
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
    data = migrateData(data || emptyData(), {profileId});
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
    this.stopLivePollLoop();
    this.folderId = null; this.currentFileId = null; this.currentFileMeta = null;
    this._backupsFolderId=null;this._backupsFolderIds=[];this._backupsFolderDuplicates=[]; this.conflict = false; this.dirty = false;
    this.autosaveDirtySinceLast = false; this._forceRequested = false; this._forceSavePromise = null;
    this._lastGoodCounts = null; this.blockedSuspicious = null;
    this._lastConsolidatedPayload = null; this._operationBasePayload = null; this._queueOperationId = null;
    this.pendingMergeConflicts = [];
    this._clearRetry(); this.lastSyncAt=0; this.lastSyncError=''; this.authRequired=false;
    setStorageMode(null);
  },

  getStatus(){
    return {
      connected: this.isConnected(),
      email: GoogleDriveAuth.user ? GoogleDriveAuth.user.email : null,
      folderId: this.folderId,
      folderName: this.folderName || null,
      folderLink: this.folderId ? ('https://drive.google.com/drive/folders/' + this.folderId) : null,
      pending: this.dirty || this.hasPersistedPending() || this.hasPersistedConsolidation(),
      conflict: this.conflict,
      blockedSuspicious: this.blockedSuspicious || null,
      lastSyncAt: this.lastSyncAt || 0,
      lastSyncError: this.lastSyncError || '',
      authRequired: !!this.authRequired
    };
  }
};

window.GoogleDriveProvider = GoogleDriveProvider;

/* V6.38.0 — além do poll de fundo (GOOGLE_DRIVE_LIVE_POLL_MS), confere na hora
   quando a pessoa volta pro app (troca de aba, tira do segundo plano no celular) —
   é exatamente o momento em que mais faz sentido já estar atualizado, sem esperar
   o próximo tick do timer. */
if(typeof document!=='undefined'){
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState==='visible' && window.GoogleDriveProvider && GoogleDriveProvider.isConnected()){
      if(GoogleDriveProvider.dirty || GoogleDriveProvider.hasPersistedPending() || GoogleDriveProvider.hasPersistedConsolidation()) GoogleDriveProvider.resumePendingSync('visibility');
      else GoogleDriveProvider.checkForRemoteUpdate();
    }
  });
}
if(typeof window!=='undefined'){
  window.addEventListener('focus', ()=>{
    if(!window.GoogleDriveProvider || !GoogleDriveProvider.isConnected()) return;
    if(GoogleDriveProvider.dirty || GoogleDriveProvider.hasPersistedPending() || GoogleDriveProvider.hasPersistedConsolidation()) GoogleDriveProvider.resumePendingSync('focus');
    else GoogleDriveProvider.checkForRemoteUpdate();
  });
  window.addEventListener('online', ()=>{
    if(window.GoogleDriveProvider && GoogleDriveProvider.isConnected()) GoogleDriveProvider.resumePendingSync('online');
  });
  window.addEventListener('offline', ()=>{
    if(window.GoogleDriveProvider && GoogleDriveProvider.isConnected() && (GoogleDriveProvider.dirty || GoogleDriveProvider.hasPersistedPending() || GoogleDriveProvider.hasPersistedConsolidation())){
      GoogleDriveProvider.lastSyncError='Sem internet. A alteração está salva somente neste dispositivo por enquanto.';
      GoogleDriveProvider.authRequired=false;
      GoogleDriveProvider._refreshStatusUI();
    }
  });
}

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
