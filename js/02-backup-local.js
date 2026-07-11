/* Borion Finance — Backup e segurança de dados V5.36.0
   Camadas:
   1) backup manual completo em arquivo JSON;
   2) backup em pasta local escolhida pelo usuário (File System Access API);
   3) snapshots no Supabase em public.borion_backups;
   4) backup automático antes de ações perigosas;
   5) aceite interno de proteção de dados por conta/dispositivo. */

/* ---------------- Backup em pasta local (File System Access API — Chrome/Edge) ---------------- */
const FS_ACCESS_SUPPORTED = typeof window!=='undefined' && 'showDirectoryPicker' in window;
const IDB_NAME = 'borion_handles', IDB_STORE = 'handles';
const BORION_APP_VERSION = '6.17.0';
const BORION_BACKUP_CONSENT_PREFIX = 'borion_backup_consent_v2_';
const BORION_BACKUP_LAST_CLOUD_PREFIX = 'borion_backup_last_cloud_v1_';
const BORION_BACKUP_SNOOZE_PREFIX = 'borion_backup_consent_snooze_v1_';

function idbOpen(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = ()=>{ if(!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE); };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}
async function idbGet(key){
  const db = await idbOpen();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(IDB_STORE, 'readonly');
    const rq = tx.objectStore(IDB_STORE).get(key);
    rq.onsuccess = ()=> resolve(rq.result || null);
    rq.onerror = ()=> reject(rq.error);
  });
}
async function idbSet(key, val){
  const db = await idbOpen();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = ()=> resolve(true);
    tx.onerror = ()=> reject(tx.error);
  });
}
async function idbDel(key){
  const db = await idbOpen();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = ()=> resolve(true);
    tx.onerror = ()=> reject(tx.error);
  });
}

function backupDateSlug(){
  const d = new Date();
  const pad = n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}-${pad(d.getHours())}h${pad(d.getMinutes())}`;
}
function backupFilename(prefix='borion-backup-conta'){
  return `${prefix}-${backupDateSlug()}.json`;
}
function backupUserKey(){
  const user = window.CloudStorage && CloudStorage.user;
  return user && user.id ? user.id : 'local';
}
function normalizeProfileForBackup(p){
  return {
    id:p.id,
    name:p.name||'Perfil',
    email:p.email||'',
    avatarColor:p.avatarColor||p.avatar_color||'#1f8a5b',
    avatarImage:p.avatarImage||p.avatar_image||'',
    passwordHash:p.passwordHash||p.password_hash||null,
    salt:p.salt||p.password_salt||null,
    createdAt:p.createdAt||p.created_at||null,
    updatedAt:p.updatedAt||p.updated_at||null,
    cloud:!!p.cloud
  };
}
function backupSafeClone(obj){ try{return JSON.parse(JSON.stringify(obj));}catch(e){return obj;} }
function backupProfileSelectColumns(){
  return (window.CloudStorage && CloudStorage.profilePasswordColumnsReady===false)
    ? 'id,name,avatar_color,avatar_image,created_at,updated_at'
    : 'id,name,avatar_color,avatar_image,password_hash,password_salt,created_at,updated_at';
}
async function buildLocalAccountBackupPayload(backupType='manual', reason=''){
  const profiles=(S.profiles||[]).map(normalizeProfileForBackup);
  const dataByProfile = {};
  for(const p of profiles){
    let d = (S.currentProfile && p.id===S.currentProfile.id && S.data) ? S.data : getProfileData(p.id);
    if(!d && typeof idbGetProfileData==='function') d = await idbGetProfileData(p.id);
    dataByProfile[p.id] = migrateData(d || emptyData());
  }
  const compact = {profiles, dataByProfile, config:S.config||{}};
  const hash = typeof sha256Hex==='function' ? await sha256Hex(JSON.stringify(compact)) : '';
  return {
    type:'borion-account-backup',
    backupSchema:5352,
    app:'Borion Finance',
    appVersion:BORION_APP_VERSION,
    backupType,
    reason:reason||'',
    source:'local_runtime',
    exportedAt:new Date().toISOString(),
    account:{
      userId:(window.CloudStorage&&CloudStorage.user&&CloudStorage.user.id)||null,
      email:(window.CloudStorage&&CloudStorage.user&&CloudStorage.user.email)||''
    },
    config:S.config||{},
    profileCount:profiles.length,
    profiles,
    dataByProfile,
    integrity:{sha256:hash, profileIds:profiles.map(p=>p.id), dataProfileIds:Object.keys(dataByProfile)}
  };
}
async function buildCloudAccountBackupPayload(backupType='manual', reason=''){
  const cloud = window.CloudStorage;
  if(!cloud || !cloud.client || !cloud.user || !navigator.onLine) return await buildLocalAccountBackupPayload(backupType, reason);
  try{
    let {data:profileRows,error:profileError}=await cloud.client
      .from('profiles')
      .select(backupProfileSelectColumns())
      .eq('user_id',cloud.user.id)
      .order('created_at',{ascending:true});
    if(profileError && typeof cloudIsMissingProfilePasswordColumns==='function' && cloudIsMissingProfilePasswordColumns(profileError)){
      cloud.profilePasswordColumnsReady=false;
      const retry=await cloud.client
        .from('profiles')
        .select('id,name,avatar_color,avatar_image,created_at,updated_at')
        .eq('user_id',cloud.user.id)
        .order('created_at',{ascending:true});
      profileRows=retry.data; profileError=retry.error;
    }
    if(profileError) throw profileError;
    const profiles=(profileRows||[]).map(r=>normalizeProfileForBackup({
      id:r.id, name:r.name, email:cloud.user.email, avatarColor:r.avatar_color, avatarImage:r.avatar_image,
      passwordHash:r.password_hash||null, salt:r.password_salt||null,
      createdAt:r.created_at?Date.parse(r.created_at):null, updatedAt:r.updated_at?Date.parse(r.updated_at):null, cloud:true
    }));
    const {data:dataRows,error:dataError}=await cloud.client
      .from('borion_profile_data')
      .select('profile_id,data,updated_at,sync_version')
      .eq('user_id',cloud.user.id);
    if(dataError) throw dataError;
    const dataByProfile={};
    (dataRows||[]).forEach(r=>{ dataByProfile[r.profile_id]=migrateData(r.data||emptyData()); });
    for(const p of profiles){
      if(!dataByProfile[p.id]){
        let local = (S.currentProfile && p.id===S.currentProfile.id && S.data) ? S.data : getProfileData(p.id);
        if(!local && typeof idbGetProfileData==='function') local = await idbGetProfileData(p.id);
        dataByProfile[p.id]=migrateData(local||emptyData());
      }
    }
    const compact={profiles,dataByProfile,config:S.config||{}};
    const hash=typeof sha256Hex==='function' ? await sha256Hex(JSON.stringify(compact)) : '';
    return {
      type:'borion-account-backup',
      backupSchema:5352,
      app:'Borion Finance',
      appVersion:BORION_APP_VERSION,
      backupType,
      reason:reason||'',
      source:'supabase_fresh_read',
      exportedAt:new Date().toISOString(),
      account:{userId:cloud.user.id,email:cloud.user.email||''},
      config:S.config||{},
      profileCount:profiles.length,
      profiles,
      dataByProfile,
      integrity:{sha256:hash, profileIds:profiles.map(p=>p.id), dataProfileIds:Object.keys(dataByProfile)}
    };
  }catch(e){
    console.warn('[BORION_BACKUP][BUILD_CLOUD_PAYLOAD][FALLBACK_LOCAL]', e);
    const fallback = await buildLocalAccountBackupPayload(backupType, reason||'fallback_local_after_cloud_error');
    fallback.source='local_runtime_after_cloud_error';
    fallback.cloudReadError=(typeof cloudErrorMessage==='function')?cloudErrorMessage(e):(e&&e.message?e.message:String(e));
    return fallback;
  }
}
async function buildFullBackupPayload(){ return await buildCloudAccountBackupPayload('manual','backup manual completo'); }

const BackupFS = {
  dirHandle: null,
  pendingHandle: null,
  needsReconnect: false,
  dirty: false,
  lastAutoBackupAt: 0,

  safeRefreshUI(){
    // V5.36.0 — a tela de aceite de backup pode aparecer antes de um perfil
    // financeiro estar aberto. Nesse estado S.data é null; portanto não podemos
    // chamar renderView(), que depende de notificacoes/transacoes do perfil.
    try{
      if(S.currentProfile && S.data && document.querySelector('#view-root')){ renderView(); return; }
      if(typeof renderGate==='function' && document.querySelector('#root')) renderGate();
    }catch(e){ console.warn('[BORION_BACKUP][SAFE_REFRESH_UI][SKIP]', e); }
  },

  markDirty(){ this.dirty = true; },
  consentKey(){ return BORION_BACKUP_CONSENT_PREFIX+backupUserKey(); },
  snoozeKey(){ return BORION_BACKUP_SNOOZE_PREFIX+backupUserKey(); },
  lastCloudKey(){ return BORION_BACKUP_LAST_CLOUD_PREFIX+backupUserKey(); },
  hasConsent(){ return readJSON(this.consentKey(), null); },
  setConsent(mode){ writeJSON(this.consentKey(), {accepted:true, mode:mode||'manual', acceptedAt:Date.now(), appVersion:BORION_APP_VERSION}); },
  snoozeConsent(){ writeJSON(this.snoozeKey(), {at:Date.now()}); },
  shouldShowConsent(){
    if(this.hasConsent()) return false;
    const s=readJSON(this.snoozeKey(), null);
    if(s && s.at && Date.now()-s.at < 24*60*60*1000) return false;
    return true;
  },

  async init(){
    if(!FS_ACCESS_SUPPORTED) return;
    try{
      const handle = await idbGet('backupDir');
      if(!handle) return;
      const perm = await handle.queryPermission({mode:'readwrite'});
      if(perm === 'granted'){ this.dirHandle = handle; }
      else { this.pendingHandle = handle; this.needsReconnect = true; }
    }catch(e){ console.warn('Não foi possível restaurar a pasta de backups', e); }
  },

  async choose(){
    if(!FS_ACCESS_SUPPORTED){
      alert('Escolher uma pasta de backups funciona no Chrome ou Edge. Você ainda pode baixar backups manuais em JSON.');
      return false;
    }
    try{
      const rootHandle = await window.showDirectoryPicker({id:'borion-backup', mode:'readwrite'});
      const backupsHandle = await rootHandle.getDirectoryHandle('Backups_Borion', {create:true});
      await idbSet('backupDir', backupsHandle);
      this.dirHandle = backupsHandle;
      this.pendingHandle = null;
      this.needsReconnect = false;
      this.setConsent('folder');
      toast('Pasta de backups configurada: '+rootHandle.name+'/Backups_Borion');
      this.safeRefreshUI();
      return true;
    }catch(e){
      if(e.name!=='AbortError') alert('Não foi possível configurar a pasta: '+e.message);
      return false;
    }
  },

  async reconnect(){
    if(!this.pendingHandle) return this.choose();
    try{
      const perm = await this.pendingHandle.requestPermission({mode:'readwrite'});
      if(perm==='granted'){
        this.dirHandle = this.pendingHandle;
        this.needsReconnect = false;
        this.setConsent('folder');
        toast('Pasta de backups reconectada.');
        this.safeRefreshUI();
      } else {
        toast('Permissão não concedida.');
      }
    }catch(e){ alert('Não foi possível reconectar: '+e.message); }
  },

  async disconnect(){
    this.dirHandle = null; this.pendingHandle = null; this.needsReconnect = false;
    await idbDel('backupDir');
    toast('Pasta de backups desconectada.');
    this.safeRefreshUI();
  },

  async writeToFolder(payload, prefix='borion-backup-conta'){
    if(!this.dirHandle) return false;
    try{
      const fh = await this.dirHandle.getFileHandle(backupFilename(prefix), {create:true});
      const w = await fh.createWritable();
      await w.write(JSON.stringify(payload, null, 2));
      await w.close();
      return true;
    }catch(e){ console.warn('Falha ao gravar backup na pasta', e); return false; }
  },

  async manualBackupNow(){
    const payload = await buildCloudAccountBackupPayload('manual','backup manual baixado/salvo pelo usuário');
    const wroteFolder = this.dirHandle ? await this.writeToFolder(payload) : false;
    if(wroteFolder){ this.dirty=false; this.lastAutoBackupAt=Date.now(); toast('Backup completo salvo na pasta configurada.'); return payload; }
    downloadJSON(payload, backupFilename());
    toast('Backup completo baixado em JSON. Configure uma pasta para salvar automaticamente.');
    return payload;
  },

  async maybeAutoBackup(){
    if(!this.dirHandle || !this.dirty) return;
    const now = Date.now();
    if(now - this.lastAutoBackupAt < 3*60*1000) return;
    const payload = await buildCloudAccountBackupPayload('auto_local','backup automático local por alteração');
    const ok = await this.writeToFolder(payload, 'borion-auto');
    if(ok){ this.lastAutoBackupAt = now; this.dirty = false; }
  },

  async maybeDailyCloudBackup(){
    const cloud=window.CloudStorage;
    if(!cloud || !cloud.user || !navigator.onLine) return false;
    const last=readJSON(this.lastCloudKey(), null);
    if(last && last.at && Date.now()-last.at < 24*60*60*1000) return false;
    try{
      const row=await this.createCloudBackup('auto_daily','backup diário criado automaticamente quando o Borion abriu/sincronizou',{silent:true});
      if(row) writeJSON(this.lastCloudKey(), {at:Date.now(), rowId:row.id});
      return !!row;
    }catch(e){ console.warn('[BORION_BACKUP][AUTO_DAILY][ERROR]', e); return false; }
  },

  async createCloudBackup(backupType='manual', reason='backup manual', options={}){
    const cloud=window.CloudStorage;
    if(!cloud || !cloud.client || !cloud.user) throw new Error('Entre na conta Borion Cloud para salvar backup no Supabase.');
    if(!navigator.onLine) throw new Error('Sem internet. Não foi possível criar backup no Supabase agora.');
    if(S.currentProfile && S.data){ try{ await cloud.syncNow(); }catch(e){} }
    const payload=await buildCloudAccountBackupPayload(backupType, reason);
    const meta={
      user_id:cloud.user.id,
      backup_type:backupType,
      app_version:BORION_APP_VERSION,
      profile_count:payload.profileCount||((payload.profiles||[]).length),
      backup_json:payload,
      reason:reason||'',
      source:payload.source||'app',
      checksum:(payload.integrity&&payload.integrity.sha256)||'',
      created_at:new Date().toISOString()
    };
    console.log('[BORION_BACKUP][CREATE_CLOUD_BACKUP][START]', {backupType, reason, profileCount:meta.profile_count});
    const {data,error}=await cloud.client
      .from('borion_backups')
      .insert(meta)
      .select('id,created_at,backup_type,profile_count,app_version,reason,source,checksum')
      .single();
    if(error) throw new Error('CREATE_CLOUD_BACKUP: '+((typeof cloudErrorMessage==='function')?cloudErrorMessage(error):(error.message||String(error))));
    console.log('[BORION_BACKUP][CREATE_CLOUD_BACKUP][SUCCESS]', data);
    if(!options.silent) toast('Backup salvo no Supabase em borion_backups.');
    return data;
  },

  async listCloudBackups(){
    const cloud=window.CloudStorage;
    if(!cloud || !cloud.client || !cloud.user) throw new Error('Entre na conta Borion Cloud para ver backups.');
    const {data,error}=await cloud.client
      .from('borion_backups')
      .select('id,created_at,backup_type,profile_count,app_version,reason,source,checksum')
      .eq('user_id',cloud.user.id)
      .order('created_at',{ascending:false})
      .limit(30);
    if(error) throw new Error('LIST_CLOUD_BACKUPS: '+((typeof cloudErrorMessage==='function')?cloudErrorMessage(error):(error.message||String(error))));
    return data||[];
  },

  async readCloudBackup(id){
    const cloud=window.CloudStorage;
    if(!cloud || !cloud.client || !cloud.user) throw new Error('Entre na conta Borion Cloud para ler backups.');
    const {data,error}=await cloud.client
      .from('borion_backups')
      .select('id,created_at,backup_type,profile_count,app_version,reason,source,checksum,backup_json')
      .eq('id',id)
      .eq('user_id',cloud.user.id)
      .single();
    if(error) throw new Error('READ_CLOUD_BACKUP: '+((typeof cloudErrorMessage==='function')?cloudErrorMessage(error):(error.message||String(error))));
    return data;
  },

  async downloadCloudBackup(id){
    try{
      const row=await this.readCloudBackup(id);
      downloadJSON(row.backup_json, backupFilename('borion-backup-supabase'));
      toast('Backup do Supabase baixado em JSON.');
    }catch(e){ alert(e.message||String(e)); }
  },

  async restoreCloudBackup(id){
    try{
      const row=await this.readCloudBackup(id);
      this.confirmRestoreAccountPayload(row.backup_json, `backup salvo em ${new Date(row.created_at).toLocaleString('pt-BR')}`);
    }catch(e){ alert(e.message||String(e)); }
  },

  confirmRestoreAccountPayload(payload, label='arquivo de backup'){
    const count=(payload&&payload.profiles&&payload.profiles.length)||0;
    openConfirmModal({
      title:'Restaurar backup completo',
      text:`Você vai substituir os perfis e dados financeiros desta conta pelo ${label}. O Borion cria um backup de segurança antes da restauração. Perfis no backup: ${count}.`,
      confirmLabel:'Restaurar conta',
      cancelLabel:'Cancelar',
      variant:'danger',
      onConfirm:()=>this.restoreAccountPayloadToCloud(payload)
    });
  },

  async restoreAccountPayloadToCloud(payload){
    const cloud=window.CloudStorage;
    if(!cloud || !cloud.client || !cloud.user) throw new Error('Entre na conta Borion Cloud para restaurar backup completo.');
    if(!payload || !payload.profiles || !payload.dataByProfile) throw new Error('Backup completo inválido ou incompleto.');
    if((payload.profiles||[]).length>5) throw new Error('Este backup tem mais de 5 perfis. O Borion permite até 5 perfis por conta.');
    try{
      await this.createCloudBackup('before_restore_account','backup automático antes de restaurar conta',{silent:true});
      console.warn('[BORION_BACKUP][RESTORE_ACCOUNT][START]', {profiles:(payload.profiles||[]).length});
      const idMap={};
      const profileRows=(payload.profiles||[]).map(p=>{
        const newId=(typeof isValidUUID==='function' && isValidUUID(p.id)) ? p.id : uid();
        idMap[p.id]=newId;
        return {
          id:newId,
          user_id:cloud.user.id,
          name:p.name||'Perfil restaurado',
          avatar_color:p.avatarColor||p.avatar_color||'#1f8a5b',
          avatar_image:p.avatarImage||p.avatar_image||'',
          password_hash:p.passwordHash||p.password_hash||null,
          password_salt:p.salt||p.password_salt||null,
          updated_at:new Date().toISOString()
        };
      });
      const {error:delError}=await cloud.client.from('profiles').delete().eq('user_id',cloud.user.id);
      if(delError) throw new Error('RESTORE delete profiles: '+((typeof cloudErrorMessage==='function')?cloudErrorMessage(delError):(delError.message||String(delError))));
      const {data:insertedProfiles,error:insError}=await cloud.client
        .from('profiles')
        .insert(profileRows)
        .select('id,name');
      if(insError) throw new Error('RESTORE insert profiles: '+((typeof cloudErrorMessage==='function')?cloudErrorMessage(insError):(insError.message||String(insError))));
      const dataRows=profileRows.map(p=>{
        const originalId=Object.keys(idMap).find(k=>idMap[k]===p.id) || p.id;
        return {
          user_id:cloud.user.id,
          profile_id:p.id,
          data:migrateData((payload.dataByProfile||{})[originalId]||(payload.dataByProfile||{})[p.id]||emptyData()),
          sync_version:Date.now(),
          updated_at:new Date().toISOString()
        };
      });
      const {error:dataError}=await cloud.client.from('borion_profile_data').insert(dataRows);
      if(dataError) throw new Error('RESTORE insert borion_profile_data: '+((typeof cloudErrorMessage==='function')?cloudErrorMessage(dataError):(dataError.message||String(dataError))));
      if(payload.config){ S.config=payload.config; setConfig(S.config); applyFont(); applyTheme(); }
      await cloud.loadProfiles();
      S.data=null; S.currentProfile=null; S.gate={mode:'list',error:''};
      closeModal();
      renderGate();
      toast('Backup restaurado. Escolha o perfil para entrar.');
      console.log('[BORION_BACKUP][RESTORE_ACCOUNT][SUCCESS]', {insertedProfiles});
    }catch(e){
      console.error('[BORION_BACKUP][RESTORE_ACCOUNT][ERROR]', e);
      alert('Restauração não concluída:\n\n'+(e.message||String(e))+'\n\nSe algo ficou errado, restaure o backup before_restore_account em borion_backups.');
    }
  },

  async restoreAccountPayloadFromFile(payload){
    this.confirmRestoreAccountPayload(payload, 'arquivo JSON selecionado');
  },

  showConsentModal(){
    const userEmail=(window.CloudStorage&&CloudStorage.user&&CloudStorage.user.email)||'';
    const box = el(`
      <div class="modal-overlay">
        <div class="modal-box backup-consent-box">
          <div class="modal-head"><h2>Proteção de dados do Borion</h2><button id="bk_close">&times;</button></div>
          <p class="modal-sub">Dados financeiros são sensíveis. Antes de usar a nuvem com tranquilidade, configure sua política de backup.</p>
          <div class="backup-consent-list">
            <div><b>1. Backup completo</b><span>Inclui perfis, cores, senhas de perfil em hash e todos os dados financeiros.</span></div>
            <div><b>2. Supabase</b><span>Snapshots ficam em <code>public.borion_backups</code>, separados dos dados vivos.</span></div>
            <div><b>3. Computador</b><span>No Chrome/Edge você pode escolher uma pasta local, de preferência dentro do Google Drive/OneDrive.</span></div>
            <div><b>4. Segurança</b><span>Antes de excluir/restaurar dados, o Borion tenta criar um backup de segurança.</span></div>
          </div>
          <div class="info-box">Conta atual: <b>${esc(userEmail||'local')}</b>. O navegador só permite salvar em pasta fixa depois que você autoriza manualmente.</div>
          <div class="row-btns" style="margin-top:12px;">
            <button class="btn btn-primary btn-block" id="bk_accept_folder">Concordo e escolher pasta</button>
            <button class="btn-outline btn-block" id="bk_accept_cloud">Concordo, usar só Supabase/JSON</button>
          </div>
          <button class="link-btn" id="bk_later" style="width:100%;margin-top:10px;">Lembrar depois</button>
        </div>
      </div>`);
    $('#modal-root').innerHTML=''; $('#modal-root').appendChild(box); attachModalGuard(box);
    $('#bk_close').onclick=()=>{ this.snoozeConsent(); closeModal(); };
    $('#bk_later').onclick=()=>{ this.snoozeConsent(); closeModal(); };
    $('#bk_accept_folder').onclick=async ()=>{ this.setConsent('folder_requested'); closeModal(); await this.choose(); try{ await this.createCloudBackup('first_setup','backup inicial após aceite de proteção de dados',{silent:true}); }catch(e){ console.warn('[BORION_BACKUP][FIRST_SETUP][ERROR]', e); } };
    $('#bk_accept_cloud').onclick=async ()=>{ this.setConsent('cloud_json'); closeModal(); try{ await this.createCloudBackup('first_setup','backup inicial após aceite de proteção de dados'); }catch(e){ alert('Aceite salvo, mas o backup no Supabase falhou. Rode o SQL V5.35.1 e tente em Configurações > Backups.\n\n'+(e.message||String(e))); } };
  },

  maybeShowConsentOnLogin(){
    if(!this.shouldShowConsent()) { this.maybeDailyCloudBackup(); return; }
    setTimeout(()=>{ if(typeof openConfirmModal==='function') this.showConsentModal(); }, 650);
  }
};

window.BackupFS = BackupFS;
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden') BackupFS.maybeAutoBackup(); });
window.addEventListener('pagehide', ()=>{ BackupFS.maybeAutoBackup(); });
setInterval(()=> BackupFS.maybeAutoBackup(), 5*60*1000);
setInterval(()=> BackupFS.maybeDailyCloudBackup(), 60*60*1000);
