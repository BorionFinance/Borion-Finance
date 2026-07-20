/* Borion Finance — Fila durável, identidade de dispositivo e máquina de estados
   (V6.40.1 — Dados e Segurança)

   Depende de js/01e-sync-core-v640.js (uuid640, checksumOf). Não depende do
   Google Drive nem de nenhum outro provider — só de IndexedDB. Isso permite
   testar a parte de estado (state machine) isoladamente, e mantém este módulo
   reutilizável se um dia outro provider de nuvem for adicionado. */

const BORION_IDB640_NAME = 'borion_sync_v640';
const BORION_IDB640_VERSION = 1;
const BORION_IDB640_STORES = ['pending_operations','sync_metadata','base_snapshots','conflicts','dead_letter','device_info','integrity_records'];

function borionIdb640Open(){
  return new Promise((resolve, reject)=>{
    if(typeof indexedDB==='undefined'){ reject(new Error('IndexedDB indisponível.')); return; }
    const req = indexedDB.open(BORION_IDB640_NAME, BORION_IDB640_VERSION);
    req.onupgradeneeded = ()=>{
      const db = req.result;
      BORION_IDB640_STORES.forEach(name=>{
        if(!db.objectStoreNames.contains(name)) db.createObjectStore(name, {keyPath:'id'});
      });
    };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
}
async function borionIdb640Put(store, record){
  const db = await borionIdb640Open();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(record);
    tx.oncomplete = ()=>resolve(record);
    tx.onerror = ()=>reject(tx.error);
  });
}
async function borionIdb640Delete(store, id){
  const db = await borionIdb640Open();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = ()=>resolve(true);
    tx.onerror = ()=>reject(tx.error);
  });
}
async function borionIdb640Get(store, id){
  const db = await borionIdb640Open();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(store, 'readonly');
    const rq = tx.objectStore(store).get(id);
    rq.onsuccess = ()=>resolve(rq.result||null);
    rq.onerror = ()=>reject(rq.error);
  });
}
async function borionIdb640GetAll(store){
  const db = await borionIdb640Open();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(store, 'readonly');
    const rq = tx.objectStore(store).getAll();
    rq.onsuccess = ()=>resolve(rq.result||[]);
    rq.onerror = ()=>reject(rq.error);
  });
}

/* ---------------- deviceId / sessionId ----------------
   deviceId: UUID estável, gravado no IndexedDB (fonte durável) com cópia de
   recuperação no localStorage (leitura síncrona rápida e resistente a um
   IndexedDB parcialmente apagado). Nunca contém e-mail/nome — só o UUID.
   sessionId: novo a cada carregamento do app (aba/processo). */
const LS_BORION_DEVICE_ID = 'borion_device_id_v640';
let _borionSessionId = null;

async function borionGetOrCreateDeviceId(){
  try{
    const cached = localStorage.getItem(LS_BORION_DEVICE_ID);
    const rec = await borionIdb640Get('device_info', 'device').catch(()=>null);
    if(rec && rec.deviceId){
      if(cached!==rec.deviceId) localStorage.setItem(LS_BORION_DEVICE_ID, rec.deviceId);
      return rec.deviceId;
    }
    // IndexedDB não tinha (primeira vez, ou foi parcialmente apagado) — usa a
    // cópia do localStorage se existir, em vez de gerar um ID novo à toa.
    const deviceId = cached || BorionSyncCore.uuid640();
    await borionIdb640Put('device_info', {id:'device', deviceId, createdAt:new Date().toISOString()}).catch(()=>{});
    localStorage.setItem(LS_BORION_DEVICE_ID, deviceId);
    return deviceId;
  }catch(e){
    // Pior caso (IndexedDB totalmente indisponível): ainda funciona com o
    // localStorage sozinho, só perde a camada extra de durabilidade.
    let deviceId = localStorage.getItem(LS_BORION_DEVICE_ID);
    if(!deviceId){ deviceId = BorionSyncCore.uuid640(); try{ localStorage.setItem(LS_BORION_DEVICE_ID, deviceId); }catch(_){} }
    return deviceId;
  }
}
function borionNewSessionId(){ _borionSessionId = BorionSyncCore.uuid640(); return _borionSessionId; }
function borionSessionId(){ return _borionSessionId || borionNewSessionId(); }

/* ---------------- Máquina de estados da sincronização ----------------
   Estados do item 8 do pedido. Centraliza a mudança de estado numa única
   função (setSyncState) em vez de várias flags booleanas espalhadas — todo
   código (novo ou antigo) que quiser saber "o que está acontecendo" lê
   BorionSyncState.current, e toda tela que quiser reagir a mudanças escuta
   via subscribe(). GoogleDriveProvider.getStatus() (01c) continua existindo
   sem mudanças de assinatura — só passa a derivar seu texto a partir daqui. */
const BORION_SYNC_STATES = [
  'LOCAL_SAVED','QUEUED','PROTECTING_DRIVE','DRIVE_PROTECTED','MERGING',
  'SNAPSHOT_CONFIRMED','SYNCING','SYNCED','OFFLINE_PENDING','AUTH_REQUIRED',
  'REMOTE_CHANGED','CONFLICT','BLOCKED_SUSPICIOUS','RETRY_WAIT',
  'RECOVERING','RECOVERY','JOURNAL_ERROR','ERROR'
];
const BORION_SYNC_STATE_LABELS = {
  LOCAL_SAVED: 'Salvo neste dispositivo',
  QUEUED: 'Operação pendente',
  PROTECTING_DRIVE: 'Protegendo alteração no Drive',
  DRIVE_PROTECTED: 'Alteração protegida no Drive',
  MERGING: 'Consolidando dados',
  SNAPSHOT_CONFIRMED: 'Sincronizado com o Drive',
  SYNCING: 'Protegendo alteração no Drive',
  SYNCED: 'Sincronizado com o Drive',
  OFFLINE_PENDING: 'Offline — alterações protegidas',
  AUTH_REQUIRED: 'Login do Google necessário',
  REMOTE_CHANGED: 'Alteração remota detectada',
  CONFLICT: 'Conflito precisa de revisão',
  BLOCKED_SUSPICIOUS: 'Salvamento bloqueado por segurança',
  RETRY_WAIT: 'Aguardando Google Drive',
  RECOVERING: 'Recuperação de dados em andamento',
  RECOVERY: 'Modo de recuperação',
  JOURNAL_ERROR: 'Erro no journal — recuperação necessária',
  ERROR: 'Erro de sincronização'
};

const BorionSyncState = {
  current: 'LOCAL_SAVED',
  meta: {},
  _subscribers: [],
  set(state, meta={}){
    if(BORION_SYNC_STATES.indexOf(state)===-1){ console.warn('[BorionSyncState] estado desconhecido ignorado:', state); return; }
    this.current = state;
    this.meta = meta||{};
    this._subscribers.forEach(fn=>{ try{ fn(state, this.meta); }catch(e){ console.warn('[BorionSyncState] assinante falhou', e); } });
  },
  subscribe(fn){ this._subscribers.push(fn); return ()=>{ this._subscribers = this._subscribers.filter(f=>f!==fn); }; },
  label(state){ return BORION_SYNC_STATE_LABELS[state||this.current] || ''; }
};

/* ---------------- Fila durável (pending_operations) ----------------
   Contrato do item 9: nada é removido da fila antes de existir confirmação de
   persistência remota. "Confirmação remota" aqui = o arquivo de operação
   imutável foi criado com sucesso no Drive (ver 01g) — não apenas "o
   current.json foi sobrescrito", que é justamente o passo inseguro que este
   projeto está eliminando. */
const BorionDurableQueue = {
  async enqueue(op){
    const record = Object.assign({
      status: 'pending', attempts: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    }, op);
    await borionIdb640Put('pending_operations', record);
    try{ localStorage.setItem('borion_queue_marker_v640', String(Date.now())); }catch(e){}
    return record;
  },
  async markAttempt(operationId, error){
    const rec = await borionIdb640Get('pending_operations', operationId);
    if(!rec) return null;
    rec.attempts = (rec.attempts||0)+1;
    rec.lastError = error ? (error.message||String(error)) : null;
    rec.updatedAt = new Date().toISOString();
    await borionIdb640Put('pending_operations', rec);
    return rec;
  },
  async confirmRemote(operationId){
    // Não apaga: arquiva com status 'confirmed'. A limpeza definitiva só
    // acontece depois de uma consolidação validada (ver 01g), como pede o
    // item 6.2 ("limpeza apenas depois de backup validado").
    const rec = await borionIdb640Get('pending_operations', operationId);
    if(!rec) return null;
    rec.status = 'confirmed';
    rec.confirmedAt = new Date().toISOString();
    await borionIdb640Put('pending_operations', rec);
    return rec;
  },
  async archive(operationId){ return await borionIdb640Delete('pending_operations', operationId); },
  async pendingOnly(){ return (await borionIdb640GetAll('pending_operations')).filter(r=>r.status==='pending'); },
  async all(){ return await borionIdb640GetAll('pending_operations'); },
  async moveToDeadLetter(operationId, reason){
    const rec = await borionIdb640Get('pending_operations', operationId);
    if(!rec) return null;
    rec.deadLetterReason = reason;
    rec.deadLetterAt = new Date().toISOString();
    await borionIdb640Put('dead_letter', rec);
    await borionIdb640Delete('pending_operations', operationId);
    return rec;
  }
};

window.BorionIDB640 = {
  open: borionIdb640Open, put: borionIdb640Put, get: borionIdb640Get,
  getAll: borionIdb640GetAll, delete: borionIdb640Delete, STORES: BORION_IDB640_STORES
};
window.BorionDevice640 = { getOrCreateDeviceId: borionGetOrCreateDeviceId, newSessionId: borionNewSessionId, sessionId: borionSessionId };
window.BorionSyncState = BorionSyncState;
window.BORION_SYNC_STATE_LABELS = BORION_SYNC_STATE_LABELS;
window.BorionDurableQueue = BorionDurableQueue;
