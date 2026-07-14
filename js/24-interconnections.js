(() => {
  'use strict';

  /* ========================================================================
     BORION INTEROP SINK v1.0.0 — PROTECTED INTEGRATION BOUNDARY
     DO NOT MODIFY, REFORMAT OR REMOVE WITHOUT AN EXPLICIT INTERCONNECTION REQUEST.
     Source applications own operational records. Borion owns imported transactions.
     ======================================================================== */
  const SPEC = Object.freeze({ schemaVersion: 1, bridgeVersion: '1.0.0', folderName: 'Borion_Integracoes' });
  const SOURCES = Object.freeze({
    'amanda-estetica': { name:'Amanda Estética', snapshotFile:'amanda-estetica.bridge.json', ackFile:'amanda-estetica.ack.json', expectedAlias:'estetica' },
    'marco-iris': { name:'Marco Iris Tecnologia', snapshotFile:'marco-iris.bridge.json', ackFile:'marco-iris.ack.json', expectedAlias:'default' }
  });
  const HANDLE_DB = 'borion_interop_handles_v1';
  const HANDLE_STORE = 'handles';
  let syncing = false;

  function clone(value){ return JSON.parse(JSON.stringify(value)); }
  function normalize(value){ return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase(); }
  function escHtml(value){ return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }
  function nowIso(){ return new Date().toISOString(); }
  function stableStringify(value){
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key)+':'+stableStringify(value[key])).join(',') + '}';
  }
  function hash(value){
    const text = typeof value === 'string' ? value : stableStringify(value);
    let h = 2166136261;
    for(let i=0;i<text.length;i+=1){ h ^= text.charCodeAt(i); h = Math.imul(h,16777619); }
    return ('00000000'+(h>>>0).toString(16)).slice(-8);
  }
  function dateText(value){
    if(!value) return 'Nunca';
    try{return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value));}catch(_){return String(value);}
  }

  function ensureInterop(data){
    if(!data.interconnections || typeof data.interconnections !== 'object') data.interconnections = {};
    const root = data.interconnections;
    root.schemaVersion = 1;
    root.protectedBoundary = true;
    root.changePolicy = 'explicit-request-only';
    root.sources ||= {};
    root.imported ||= {};
    root.pending ||= [];
    root.audit ||= [];
    return root;
  }
  function profileData(profileId){
    if(S.currentProfile && String(S.currentProfile.id)===String(profileId) && S.data) return S.data;
    return migrateData(getProfileData(profileId) || emptyData());
  }
  function saveProfileData(profileId, data){
    setProfileData(profileId, data);
    if(S.currentProfile && String(S.currentProfile.id)===String(profileId)) S.data = data;
    if(window.GoogleDriveProvider && GoogleDriveProvider.isConnected()) GoogleDriveProvider.queueSave();
    if(window.CloudStorage && CloudStorage.user) CloudStorage.queueSave(profileId, data);
    try{ BackupFS.markDirty(); }catch(_){ }
  }
  function allSourceConfigs(){
    const rows=[];
    (S.profiles||[]).forEach(profile=>{
      const data=profileData(profile.id), interop=ensureInterop(data);
      Object.entries(interop.sources||{}).forEach(([sourceAppId,config])=>rows.push({sourceAppId,config,profile,data}));
    });
    return rows;
  }
  function findSourceConfig(sourceAppId){ return allSourceConfigs().find(row=>row.sourceAppId===sourceAppId) || null; }

  function openHandleDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(HANDLE_DB,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(HANDLE_STORE))req.result.createObjectStore(HANDLE_STORE);};
      req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
    });
  }
  async function handleTx(mode,key,value){
    const db=await openHandleDb();
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(HANDLE_STORE,mode), store=tx.objectStore(HANDLE_STORE);
      const req=value===undefined?store.get(key):store.put(value,key); let result;
      req.onsuccess=()=>{result=req.result;}; req.onerror=()=>reject(req.error);
      tx.oncomplete=()=>{db.close();resolve(result);}; tx.onerror=()=>{db.close();reject(tx.error);};
    });
  }
  function handleKey(sourceAppId,profileId){ return `${sourceAppId}:${profileId}`; }
  async function putHandle(sourceAppId,profileId,handle){ return handleTx('readwrite',handleKey(sourceAppId,profileId),handle); }
  async function getHandle(sourceAppId,profileId){ return handleTx('readonly',handleKey(sourceAppId,profileId)); }

  async function readLocalSnapshot(row){
    const handle=await getHandle(row.sourceAppId,row.profile.id);
    if(!handle) throw new Error('A pasta local da integração ainda não foi conectada neste navegador.');
    const permission=await handle.queryPermission({mode:'readwrite'});
    if(permission!=='granted' && await handle.requestPermission({mode:'readwrite'})!=='granted') throw new Error('Acesso à pasta local não autorizado.');
    const fh=await handle.getFileHandle(SOURCES[row.sourceAppId].snapshotFile);
    return JSON.parse(await (await fh.getFile()).text());
  }
  async function writeLocalAck(row,ack){
    const handle=await getHandle(row.sourceAppId,row.profile.id); if(!handle)return;
    const fh=await handle.getFileHandle(SOURCES[row.sourceAppId].ackFile,{create:true});
    const writable=await fh.createWritable();
    await writable.write(new Blob([JSON.stringify(ack,null,2)],{type:'application/json'}));
    await writable.close();
  }
  async function readDriveSnapshot(row){
    if(!(window.GoogleDriveProvider&&GoogleDriveProvider.isConnected())) throw new Error('Conecte primeiro o Borion ao Google Drive.');
    await GoogleDriveAuth.ensureFreshToken();
    const file=await GoogleDriveFS.findChild(row.config.folderId,SOURCES[row.sourceAppId].snapshotFile,'application/json');
    if(!file) throw new Error('O arquivo de integração não foi encontrado na pasta selecionada. Abra o aplicativo de origem e faça ao menos um salvamento.');
    return await GoogleDriveFS.readFile(file.id);
  }
  async function writeDriveAck(row,ack){
    const name=SOURCES[row.sourceAppId].ackFile;
    const existing=await GoogleDriveFS.findChild(row.config.folderId,name,'application/json');
    if(existing) await GoogleDriveFS.updateFile(existing.id,ack); else await GoogleDriveFS.createFile(row.config.folderId,name,ack);
  }

  function validateSnapshot(snapshot,sourceAppId){
    if(!snapshot || snapshot.schema!=='borion.interop.snapshot') throw new Error('Arquivo não é um snapshot de interconexão do Borion.');
    if(Number(snapshot.schemaVersion)!==1) throw new Error('Versão de protocolo incompatível.');
    if(snapshot.sourceAppId!==sourceAppId) throw new Error(`A pasta contém dados de ${snapshot.sourceAppId||'outro aplicativo'}, não de ${sourceAppId}.`);
    if(!snapshot.instanceId || !Array.isArray(snapshot.records) || !Array.isArray(snapshot.tombstones)) throw new Error('Snapshot incompleto ou corrompido.');
    const ids=new Set();
    const expectedPrefix=`${sourceAppId}:${snapshot.instanceId}:`;
    snapshot.records.forEach(record=>{
      if(!record.aggregateId || !record.entityId) throw new Error('Existe um registro sem identificador permanente.');
      if(!String(record.aggregateId).startsWith(expectedPrefix)) throw new Error('Snapshot rejeitado: identificador fora da instância de origem.');
      if(ids.has(record.aggregateId)) throw new Error('Snapshot rejeitado: identificador de registro duplicado.');
      ids.add(record.aggregateId);
      if(!['income','expense'].includes(record.direction)) throw new Error('Direção financeira inválida.');
      if(!Number.isFinite(Number(record.amount)) || Number(record.amount)<0) throw new Error('Valor financeiro inválido.');
    });
    (snapshot.tombstones||[]).forEach(item=>{
      if(!item.aggregateId || !String(item.aggregateId).startsWith(expectedPrefix)) throw new Error('Snapshot rejeitado: exclusão fora da instância de origem.');
    });
    const calculatedHash=hash({records:snapshot.records,tombstones:snapshot.tombstones});
    if(snapshot.contentHash && snapshot.contentHash!==calculatedHash) throw new Error('Snapshot rejeitado: conteúdo alterado ou incompleto.');
    return true;
  }

  function accountByIdIn(data,accountId){ return (data.contas||[]).find(account=>String(account.id)===String(accountId)); }
  function accountName(data,accountId){ return accountByIdIn(data,accountId)?.nome || ''; }
  function ensureLedger(data,accountId){
    data.liquidez=Array.isArray(data.liquidez)?data.liquidez:[];
    let ledger=data.liquidez.find(item=>item&&item.ledgerType==='account_delta'&&String(item.accountId)===String(accountId));
    if(!ledger){
      const account=accountByIdIn(data,accountId);
      if(!account) return null;
      ledger={id:'bridge-ledger-'+hash(accountId),accountId,ledgerType:'account_delta',nome:account.nome||'Conta',banco:account.nome||'',valor:0,createdAt:Date.now()};
      data.liquidez.push(ledger);
    }
    return ledger;
  }
  function txDelta(tx){
    if(!tx||!tx.accountId)return 0;
    if(tx.tipo==='receita')return (Number(tx.valor)||0)-(Number(tx.reservaValor)||0);
    if(tx.tipo==='variavel'&&tx.statusPagamento!=='Em aberto'&&tx.origemPagamento!=='reserva'&&tx.formaPagamento!=='Crédito')return -(Number(tx.valor)||0);
    return 0;
  }
  function adjust(data,accountId,delta){
    if(!delta)return true;
    const ledger=ensureLedger(data,accountId); if(!ledger)return false;
    ledger.valor=Math.round(((Number(ledger.valor)||0)+Number(delta))*100)/100;
    return true;
  }
  function reverseExisting(data,tx){ const delta=txDelta(tx); return delta?adjust(data,tx.accountId,-delta):true; }
  function applyNew(data,tx){ const delta=txDelta(tx); return delta?adjust(data,tx.accountId,delta):true; }
  function paymentForm(method){
    const m=normalize(method);
    if(m.includes('dinheiro'))return 'Dinheiro';
    if(m.includes('debito'))return 'Débito';
    if(m.includes('credito'))return 'Crédito';
    return 'Pix';
  }
  function targetAccountId(data,config,record){
    if(normalize(record.paymentMethod).includes('dinheiro')) return CARTEIRA_CONTA_ID;
    return config.accountId || '';
  }
  function ensureCategory(data,type,category){
    data.categorias ||= defaultCategories();
    const bucket=type==='receita'?'receita':'variavel';
    data.categorias[bucket]=Array.isArray(data.categorias[bucket])?data.categorias[bucket]:[];
    const value=String(category||'Outro').trim()||'Outro';
    if(!data.categorias[bucket].includes(value))data.categorias[bucket].push(value);
    data.categoryColors ||= {receita:{},fixa:{},variavel:{}};
    data.categoryColors[bucket] ||= {};
    if(!data.categoryColors[bucket][value])data.categoryColors[bucket][value]=baseCatColor(value);
    return value;
  }
  function removeManagedTransaction(data,aggregateId){
    const existing=(data.transacoes||[]).find(tx=>tx.integrationManaged&&tx.integrationAggregateId===aggregateId);
    if(!existing)return null;
    if(!reverseExisting(data,existing))throw new Error('Não foi possível reverter o saldo do lançamento integrado.');
    data.transacoes=data.transacoes.filter(tx=>tx!==existing);
    return existing;
  }
  function makeTransaction(data,config,record,existing){
    const accountId=targetAccountId(data,config,record);
    if(!accountByIdIn(data,accountId))throw new Error(`A conta de destino não existe mais para ${record.description}.`);
    const isIncome=record.direction==='income';
    const category=ensureCategory(data,isIncome?'receita':'variavel',record.category);
    const base={
      id:existing?.id||('bridge-'+hash(record.aggregateId)),
      nome:record.description||'Lançamento integrado',
      data:record.date||new Date().toISOString().slice(0,10),
      categoria:category,
      valor:Math.round((Number(record.amount)||0)*100)/100,
      accountId,
      banco:accountName(data,accountId),
      integrationManaged:true,
      integrationAggregateId:record.aggregateId,
      integrationSourceAppId:config.sourceAppId,
      integrationEntityId:record.entityId,
      integrationFingerprint:record.fingerprint||hash(record),
      integrationUpdatedAt:record.sourceUpdatedAt||nowIso(),
      integrationExternalReference:record.externalReference||'',
      integrationClientName:record.clientName||'',
      integrationNotes:record.notes||'',
      integrationPaymentMethod:record.paymentMethod||''
    };
    if(isIncome){
      return Object.assign(base,{tipo:'receita',origem:'propria',reservaValor:0,destinoModo:'Conta livre',formaPagamento:paymentForm(record.paymentMethod)});
    }
    return Object.assign(base,{tipo:'variavel',statusPagamento:record.settled?'Pago':'Em aberto',origemPagamento:'conta',formaPagamento:paymentForm(record.paymentMethod),localCompra:''});
  }

  function reconcileSnapshot(data,config,snapshot){
    validateSnapshot(snapshot,config.sourceAppId);
    const interop=ensureInterop(data);
    const state=interop.imported[config.sourceAppId] ||= {instanceId:'',lastRevision:0,lastContentHash:'',records:{},lastSyncAt:'',lastError:''};
    state.records ||= {};
    const results=[];
    const pending=[];
    const incomingIds=new Set(snapshot.records.map(item=>item.aggregateId));
    const tombstones=new Set((snapshot.tombstones||[]).map(item=>item.aggregateId));

    // Explicit tombstones always win.
    tombstones.forEach(aggregateId=>{
      const removed=removeManagedTransaction(data,aggregateId);
      delete state.records[aggregateId];
      results.push({aggregateId,status:'deleted',borionTransactionId:removed?.id||'',message:'Registro removido na origem.'});
    });

    // A complete snapshot is authoritative. This also cleans stale records after a
    // reinstall/reset where the source no longer has its old tombstone history.
    (data.transacoes||[]).filter(tx=>tx.integrationManaged&&tx.integrationSourceAppId===config.sourceAppId).slice().forEach(tx=>{
      if(incomingIds.has(tx.integrationAggregateId)||tombstones.has(tx.integrationAggregateId))return;
      const removed=removeManagedTransaction(data,tx.integrationAggregateId);
      delete state.records[tx.integrationAggregateId];
      results.push({aggregateId:tx.integrationAggregateId,entityId:tx.integrationEntityId||'',status:'deleted',borionTransactionId:removed?.id||'',message:'Registro ausente no snapshot completo da origem.'});
    });
    Object.keys(state.records).forEach(aggregateId=>{if(!incomingIds.has(aggregateId)&&!tombstones.has(aggregateId))delete state.records[aggregateId];});

    snapshot.records.forEach(record=>{
      if(tombstones.has(record.aggregateId))return;
      const previous=(data.transacoes||[]).find(tx=>tx.integrationManaged&&tx.integrationAggregateId===record.aggregateId);
      const shouldImport=record.active!==false && (record.direction==='expense' || record.settled===true);
      if(!shouldImport){
        if(previous)removeManagedTransaction(data,record.aggregateId);
        state.records[record.aggregateId]={fingerprint:record.fingerprint||hash(record),status:'waiting',entityId:record.entityId,updatedAt:record.sourceUpdatedAt||''};
        pending.push({sourceAppId:config.sourceAppId,aggregateId:record.aggregateId,entityId:record.entityId,description:record.description,status:record.status,direction:record.direction,amount:record.amount});
        results.push({aggregateId:record.aggregateId,entityId:record.entityId,status:record.active===false?'cancelled':'waiting',borionTransactionId:'',message:record.active===false?'Cancelado na origem.':'Aguardando recebimento/pagamento na origem.'});
        return;
      }
      if(previous && previous.integrationFingerprint===(record.fingerprint||hash(record))){
        state.records[record.aggregateId]={fingerprint:previous.integrationFingerprint,status:'imported',txId:previous.id,entityId:record.entityId,updatedAt:record.sourceUpdatedAt||''};
        results.push({aggregateId:record.aggregateId,entityId:record.entityId,status:'unchanged',borionTransactionId:previous.id,message:'Já estava sincronizado.'});
        return;
      }
      if(previous && !reverseExisting(data,previous))throw new Error('Não foi possível reverter o lançamento anterior antes da atualização.');
      const tx=makeTransaction(data,config,record,previous);
      if(previous)Object.assign(previous,tx);else{data.transacoes=Array.isArray(data.transacoes)?data.transacoes:[];data.transacoes.push(tx);}
      if(!applyNew(data,tx))throw new Error('Não foi possível aplicar o saldo do lançamento integrado.');
      state.records[record.aggregateId]={fingerprint:tx.integrationFingerprint,status:'imported',txId:tx.id,entityId:record.entityId,updatedAt:record.sourceUpdatedAt||''};
      results.push({aggregateId:record.aggregateId,entityId:record.entityId,status:previous?'updated':'created',borionTransactionId:tx.id,message:previous?'Lançamento atualizado.':'Lançamento criado.'});
    });

    // Keep pending records from other sources and replace only this source's pending set.
    interop.pending=(interop.pending||[]).filter(item=>item.sourceAppId!==config.sourceAppId).concat(pending);
    state.instanceId=snapshot.instanceId;
    state.lastRevision=Number(snapshot.revision)||0;
    state.lastContentHash=snapshot.contentHash||hash({records:snapshot.records,tombstones:snapshot.tombstones});
    state.lastSyncAt=nowIso();
    state.lastError='';
    config.lastSyncAt=state.lastSyncAt;
    config.lastRevision=state.lastRevision;
    config.lastError='';
    config.lastResult={created:results.filter(x=>x.status==='created').length,updated:results.filter(x=>x.status==='updated').length,deleted:results.filter(x=>x.status==='deleted'||x.status==='cancelled').length,waiting:results.filter(x=>x.status==='waiting').length,unchanged:results.filter(x=>x.status==='unchanged').length};
    interop.audit.unshift({id:'interop-'+Date.now(),at:state.lastSyncAt,sourceAppId:config.sourceAppId,revision:state.lastRevision,result:clone(config.lastResult)});
    interop.audit=interop.audit.slice(0,300);
    return {results,pending,summary:config.lastResult};
  }

  async function syncSource(sourceAppId,{silent=false}={}){
    const row=findSourceConfig(sourceAppId);
    if(!row)throw new Error('Esta integração ainda não foi configurada.');
    if(syncing)throw new Error('Outra integração já está sincronizando.');
    syncing=true;
    try{
      const snapshot=row.config.transport==='drive'?await readDriveSnapshot(row):await readLocalSnapshot(row);
      const before=clone(row.data);
      let result;
      try{ result=reconcileSnapshot(row.data,row.config,snapshot); }
      catch(error){ Object.keys(row.data).forEach(key=>delete row.data[key]);Object.assign(row.data,before);throw error; }
      saveProfileData(row.profile.id,row.data);
      const ack={schema:'borion.interop.ack',schemaVersion:1,bridgeVersion:SPEC.bridgeVersion,sourceAppId,instanceId:snapshot.instanceId,sourceRevision:Number(snapshot.revision)||0,targetProfileId:row.profile.id,targetProfileName:row.profile.name,processedAt:nowIso(),summary:result.summary,records:result.results};
      if(row.config.transport==='drive')await writeDriveAck(row,ack);else await writeLocalAck(row,ack);
      if(S.currentProfile&&String(S.currentProfile.id)===String(row.profile.id)){saveCurrentData();if(typeof renderView==='function')renderView();}
      if(!silent&&typeof toast==='function')toast(`${SOURCES[sourceAppId].name}: ${result.summary.created} criado(s), ${result.summary.updated} atualizado(s), ${result.summary.waiting} aguardando.`);
      return result;
    }catch(error){
      row.config.lastError=error.message||String(error);row.config.lastAttemptAt=nowIso();saveProfileData(row.profile.id,row.data);
      if(!silent&&typeof alert==='function')alert(row.config.lastError);
      throw error;
    }finally{syncing=false;}
  }

  async function configure(sourceAppId,transport,profileId,accountId){
    if(!SOURCES[sourceAppId])throw new Error('Aplicativo de origem desconhecido.');
    const data=profileData(profileId),interop=ensureInterop(data);
    if(!accountByIdIn(data,accountId)&&accountId!==CARTEIRA_CONTA_ID)throw new Error('Escolha uma conta válida do perfil de destino.');
    let folderId='';
    if(transport==='local'){
      if(!window.showDirectoryPicker)throw new Error('Este navegador não permite escolher uma pasta local. Use Chrome ou Edge.');
      const handle=await window.showDirectoryPicker({mode:'readwrite'});
      // Accept either the exact integration folder or an app root containing it.
      let integrationHandle=handle;
      if(handle.name!==SPEC.folderName){
        try{integrationHandle=await handle.getDirectoryHandle(SPEC.folderName);}catch(_){throw new Error('Selecione a pasta Borion_Integracoes criada pelo aplicativo de origem.');}
      }
      try{await integrationHandle.getFileHandle(SOURCES[sourceAppId].snapshotFile);}catch(_){throw new Error(`O arquivo ${SOURCES[sourceAppId].snapshotFile} não existe nessa pasta. Salve primeiro no aplicativo de origem.`);}
      await putHandle(sourceAppId,profileId,integrationHandle);
    }else if(transport==='drive'){
      if(!(window.GoogleDriveProvider&&GoogleDriveProvider.isConnected()))throw new Error('Conecte primeiro o Borion ao Google Drive.');
      await GoogleDriveAuth.ensureFreshToken();
      const selected=await openDriveFolderPicker();folderId=selected.id;
      const file=await GoogleDriveFS.findChild(folderId,SOURCES[sourceAppId].snapshotFile,'application/json');
      if(!file)throw new Error(`A pasta escolhida não contém ${SOURCES[sourceAppId].snapshotFile}.`);
    }else throw new Error('Meio de sincronização inválido.');

    interop.sources[sourceAppId]={sourceAppId,enabled:true,transport,folderId,accountId,targetProfileId:profileId,configuredAt:nowIso(),lastSyncAt:'',lastError:'',protectedBoundary:true};
    saveProfileData(profileId,data);
    await syncSource(sourceAppId,{silent:true});
    if(typeof renderView==='function')renderView();
    if(typeof toast==='function')toast(`${SOURCES[sourceAppId].name} conectado ao perfil escolhido.`);
  }

  function accountOptions(profileId){
    const data=profileData(profileId);
    return (data.contas||[]).filter(account=>account&&!account.archived).map(account=>({id:account.id,name:account.nome||'Conta'}));
  }
  function setupDialog(sourceAppId,transport){
    const source=SOURCES[sourceAppId];
    const profiles=(S.profiles||[]);
    if(!profiles.length){alert('Crie um perfil no Borion antes de configurar a integração.');return;}
    const initialProfile=S.currentProfile?.id||profiles[0].id;
    const overlay=document.createElement('div');overlay.className='modal-overlay';
    overlay.innerHTML=`<div class="modal-box"><div class="modal-head"><h2>Conectar ${escHtml(source.name)}</h2><button data-close>&times;</button></div><p class="modal-sub">Escolha exatamente qual perfil receberá os lançamentos. Essa associação fica protegida dentro da integração.</p><label class="field"><span>Perfil de destino</span><select id="interop_profile">${profiles.map(p=>`<option value="${escHtml(p.id)}" ${p.id===initialProfile?'selected':''}>${escHtml(p.name)}</option>`).join('')}</select></label><label class="field"><span>Conta padrão para recebimentos, Pix, débito, boleto e transferência</span><select id="interop_account"></select><small>Pagamentos em dinheiro entram automaticamente na Carteira.</small></label><div class="form-actions"><button class="btn-outline" data-close>Cancelar</button><button class="btn btn-primary" id="interop_connect">Conectar ${transport==='drive'?'Google Drive':'pasta local'}</button></div></div>`;
    const root=document.getElementById('modal-root');root.innerHTML='';root.appendChild(overlay);
    const psel=overlay.querySelector('#interop_profile'),asel=overlay.querySelector('#interop_account');
    const refresh=()=>{const options=accountOptions(psel.value);asel.innerHTML=options.map(a=>`<option value="${escHtml(a.id)}">${escHtml(a.name)}</option>`).join('');};refresh();psel.onchange=refresh;
    overlay.querySelectorAll('[data-close]').forEach(btn=>btn.onclick=()=>{root.innerHTML='';});
    overlay.querySelector('#interop_connect').onclick=async()=>{
      const btn=overlay.querySelector('#interop_connect');btn.disabled=true;btn.textContent='Conectando…';
      try{await configure(sourceAppId,transport,psel.value,asel.value);root.innerHTML='';}
      catch(error){alert(error.message||String(error));btn.disabled=false;btn.textContent='Tentar novamente';}
    };
  }
  function disconnect(sourceAppId){
    const row=findSourceConfig(sourceAppId);if(!row)return;
    if(!confirm(`Desconectar ${SOURCES[sourceAppId].name}? Os lançamentos já importados serão preservados e continuarão protegidos.`))return;
    delete ensureInterop(row.data).sources[sourceAppId];saveProfileData(row.profile.id,row.data);renderView();
  }
  function showManagedInfo(tx){
    alert(`Este lançamento é gerenciado por ${SOURCES[tx.integrationSourceAppId]?.name||tx.integrationSourceAppId}. Edite, pague, cancele ou exclua no aplicativo de origem; o Borion atualizará o mesmo registro sem duplicar.`);
  }

  function renderSourceCard(sourceAppId){
    const source=SOURCES[sourceAppId],row=findSourceConfig(sourceAppId);
    if(!row)return `<div class="settings-section"><h3>${escHtml(source.name)}</h3><p class="desc">Ainda não conectado. O aplicativo já está preparado para gerar o arquivo protegido de integração.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn-outline btn-sm" onclick="BorionInterop.setupDialog('${sourceAppId}','local')">Conectar pasta local</button><button class="btn btn-primary btn-sm" onclick="BorionInterop.setupDialog('${sourceAppId}','drive')">Conectar Google Drive</button></div></div>`;
    const c=row.config,r=c.lastResult||{};
    return `<div class="settings-section"><h3>${escHtml(source.name)} <span class="pill ok">Conectado</span></h3><p class="desc">Destino: <b>${escHtml(row.profile.name)}</b> · Conta padrão: <b>${escHtml(accountName(row.data,c.accountId)||'Carteira')}</b> · Meio: <b>${c.transport==='drive'?'Google Drive':'pasta local'}</b></p><div class="gold-box">Última sincronização: ${escHtml(dateText(c.lastSyncAt))} · Criados ${Number(r.created||0)} · Atualizados ${Number(r.updated||0)} · Aguardando ${Number(r.waiting||0)}${c.lastError?`<br><b>Erro:</b> ${escHtml(c.lastError)}`:''}</div><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px"><button class="btn btn-primary btn-sm" onclick="BorionInterop.syncSource('${sourceAppId}')">Sincronizar agora</button><button class="btn-outline btn-sm" onclick="BorionInterop.setupDialog('${sourceAppId}','${c.transport}')">Reconfigurar</button><button class="btn-outline btn-sm" onclick="BorionInterop.disconnect('${sourceAppId}')">Desconectar</button></div></div>`;
  }
  function renderSettings(){
    return `<div class="settings-page"><div class="settings-section settings-hero-section"><h3>Interconexões de aplicativos</h3><p class="desc">Amanda e Marco enviam registros financeiros por IDs permanentes. O Borion reconcilia criação, edição, pagamento, cancelamento e exclusão sem duplicar. Esta camada está protegida contra alterações acidentais.</p></div>${renderSourceCard('amanda-estetica')}${renderSourceCard('marco-iris')}<div class="settings-section"><h3>Regras de segurança</h3><p class="desc">O aplicativo de origem continua sendo o dono do lançamento. Registros importados não podem ser editados diretamente no Borion. Dinheiro vai para a Carteira; outras formas usam a conta padrão escolhida. Receitas pendentes aguardam confirmação e não alteram o saldo.</p></div></div>`;
  }

  async function syncAll({silent=true}={}){
    const rows=allSourceConfigs();const out=[];
    for(const row of rows){try{out.push(await syncSource(row.sourceAppId,{silent}));}catch(error){console.warn('[BORION_INTEROP] Auto sync:',error);}}
    return out;
  }
  function start(){
    setTimeout(()=>syncAll({silent:true}),2500);
    setInterval(()=>syncAll({silent:true}),60000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncAll({silent:true});});
    window.addEventListener('online',()=>syncAll({silent:true}));
  }

  window.BorionInterop=Object.freeze({
    spec:SPEC,sources:SOURCES,renderSettings,setupDialog,configure,syncSource,syncAll,disconnect,showManagedInfo,start,
    __test:{hash,stableStringify,ensureInterop,validateSnapshot,reconcileSnapshot,txDelta,adjust,paymentForm,targetAccountId,makeTransaction}
  });
})();
