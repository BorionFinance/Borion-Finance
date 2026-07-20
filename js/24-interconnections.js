(() => {
  'use strict';

  /* ========================================================================
     BORION SMART IMPORT v2.0.0
     Entrada unidirecional: aplicativo externo -> Borion.
     Depois da conversão, o lançamento passa a ser nativo e editável no Borion.
     A referência externa existe somente para impedir duplicidades e controlar exclusões.
     ======================================================================== */
  const SPEC = Object.freeze({
    schemaVersion: 1,
    bridgeVersion: '2.2.0',
    mappingVersion: 2,
    folderName: 'Borion_Integracoes'
  });
  const SOURCES = Object.freeze({
    'amanda-estetica': {
      name: 'Amanda Estética',
      snapshotFile: 'amanda-estetica.bridge.json',
      ackFile: 'amanda-estetica.ack.json',
      expectedAlias: 'estetica'
    },
    'marco-iris': {
      name: 'Marco Iris Tecnologia',
      snapshotFile: 'marco-iris.bridge.json',
      ackFile: 'marco-iris.ack.json',
      expectedAlias: 'default'
    }
  });
  const HANDLE_DB = 'borion_interop_handles_v1';
  const HANDLE_STORE = 'handles';
  const EMPTY_KEY = '__empty__';
  let syncing = false;
  let uiSourceAppId = 'amanda-estetica';
  let uiTab = 'connection';

  function clone(value){ return JSON.parse(JSON.stringify(value)); }
  function normalize(value){
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  }
  function mappingKey(value){ return normalize(value) || EMPTY_KEY; }
  function escHtml(value){
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
  function nowIso(){ return new Date().toISOString(); }
  function stableStringify(value){
    if(value === null || typeof value !== 'object') return JSON.stringify(value);
    if(Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
  }
  function hash(value){
    const text = typeof value === 'string' ? value : stableStringify(value);
    let h = 2166136261;
    for(let i=0;i<text.length;i+=1){ h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }
  function dateText(value){
    if(!value) return 'Nunca';
    try{
      return new Intl.DateTimeFormat('pt-BR', {dateStyle:'short', timeStyle:'short'}).format(new Date(value));
    }catch(_){ return String(value); }
  }
  // V6.44.3 — corte de importação: lançamentos da origem com data anterior a
  // config.importCutoffAt nunca entram sozinhos no Borion (nem viram receita
  // automática, nem viram pendência para revisão). Feito para testes e histórico
  // antigo do aplicativo de origem não baterem no Borion sem controle. Não afeta
  // nada que já tenha sido importado antes do corte ser definido.
  function toCutoffTimestamp(value){
    if(!value) return 0;
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  function beforeImportCutoff(config, recordDateLike){
    const cutoff = toCutoffTimestamp(config && config.importCutoffAt);
    if(!cutoff) return false;
    const recordTime = toCutoffTimestamp(recordDateLike);
    if(!recordTime) return false;
    return recordTime < cutoff;
  }
  function importCutoffControlHTML(sourceAppId, config){
    const cutoffAt = config && config.importCutoffAt ? String(config.importCutoffAt) : '';
    const inputValue = cutoffAt ? cutoffAt.slice(0,10) : '';
    return `<div class="gold-box interop-cutoff-box">
      <b>A partir de quando importar sozinho</b>
      <p>Lançamentos de ${escHtml(sourceName(sourceAppId))} com data anterior a este ponto nunca entram automaticamente no Borion — útil para testes e histórico antigo não baterem aqui. Nada do que já foi importado antes é afetado.</p>
      <div class="interop-cutoff-controls">
        <input type="date" id="interop_cutoff_${escHtml(sourceAppId)}" value="${escHtml(inputValue)}">
        <button type="button" class="btn btn-primary btn-sm" onclick="BorionInterop.setImportCutoff('${escHtml(sourceAppId)}', document.getElementById('interop_cutoff_${escHtml(sourceAppId)}').value)">Salvar data</button>
        <button type="button" class="btn-outline btn-sm" onclick="BorionInterop.setImportCutoffNow('${escHtml(sourceAppId)}')">Só a partir de agora</button>
        ${cutoffAt ? `<button type="button" class="btn-outline btn-sm" onclick="BorionInterop.clearImportCutoff('${escHtml(sourceAppId)}')">Importar todo o histórico</button>` : ''}
      </div>
      <small>${cutoffAt ? ('Corte atual: ' + escHtml(dateText(cutoffAt))) : 'Sem corte definido: todo o histórico pode ser importado automaticamente.'}</small>
    </div>`;
  }
  function sourceName(sourceAppId){ return SOURCES[sourceAppId]?.name || sourceAppId || 'aplicativo externo'; }
  function displaySourceValue(value){ return String(value || '').trim() || '(Sem informação)'; }

  /* V6.44.2 — vocabulário de usuário final para a tela de vínculos.
     As chaves originais continuam intactas internamente para não quebrar a integração. */
  const FRIENDLY_FIELD_LABELS = Object.freeze({
    amount:'Valor', value:'Valor', total:'Valor total', price:'Preço', cost:'Custo',
    category:'Categoria', clientname:'Cliente', customername:'Cliente', name:'Nome',
    date:'Data do lançamento', paymentdate:'Data do pagamento', createdat:'Data de criação', updatedat:'Última atualização',
    description:'Descrição', externalreference:'Referência do lançamento', paymentmethod:'Forma de pagamento',
    recordtype:'Tipo de registro', entitytype:'Tipo de registro', kind:'Tipo de registro', type:'Tipo de registro',
    status:'Status', direction:'Movimento financeiro', localpurchase:'Local da compra',
    receiptid:'Identificador do recebimento', ordernumber:'Número da ordem de serviço',
    serviceordernumber:'Número da ordem de serviço', aggregateid:'Identificador da integração',
    entityid:'Identificador do registro', settled:'Pagamento confirmado', active:'Registro ativo',
    installments:'Quantidade de parcelas', notes:'Observações', observation:'Observações'
  });
  const FRIENDLY_VALUE_LABELS = Object.freeze({
    income:'Entrada / Receita', entrada:'Entrada / Receita', revenue:'Entrada / Receita', receita:'Entrada / Receita',
    expense:'Saída / Despesa', saida:'Saída / Despesa', despesa:'Saída / Despesa',
    finance:'Lançamento financeiro', financial:'Lançamento financeiro',
    paid:'Pago / Recebido', pago:'Pago / Recebido', received:'Pago / Recebido', recebido:'Pago / Recebido',
    open:'Em aberto', aberto:'Em aberto', pending:'Pendente', pendente:'Pendente',
    cancelled:'Cancelado', canceled:'Cancelado', cancelado:'Cancelado',
    money:'Dinheiro', cash:'Dinheiro', dinheiro:'Dinheiro', pix:'Pix',
    debit:'Débito', debito:'Débito', credit:'Crédito', credito:'Crédito',
    true:'Sim', false:'Não', yes:'Sim', no:'Não'
  });
  function compactFieldKey(value){ return normalize(value).replace(/[^a-z0-9]/g,''); }
  function friendlyFieldName(value){
    const key=compactFieldKey(value);
    return FRIENDLY_FIELD_LABELS[key] || String(value || 'Informação recebida').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').replace(/^./,ch=>ch.toUpperCase());
  }
  function friendlyDirection(value){ return normalize(value)==='expense'?'Saída / Despesa':'Entrada / Receita'; }
  function sourceNumber(value){
    let raw=String(value??'').trim().replace(/R\$/gi,'').replace(/\s/g,'');
    if(raw.includes(',')&&raw.includes('.')) raw=raw.replace(/\./g,'').replace(',','.');
    else if(raw.includes(',')) raw=raw.replace(',','.');
    const number=Number(raw);
    return Number.isFinite(number)?number:null;
  }
  function friendlySourceValue(value, fieldName=''){
    const raw=displaySourceValue(value);
    const field=compactFieldKey(fieldName);
    if(['amount','value','total','price','cost'].includes(field)){
      const number=sourceNumber(value);
      if(number!==null) return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(number);
    }
    if(['date','paymentdate','createdat','updatedat'].includes(field)){
      const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
      if(match) return `${match[3]}/${match[2]}/${match[1]}`;
    }
    return FRIENDLY_VALUE_LABELS[normalize(raw)] || raw;
  }
  function sourceContextLabel(field, direction=''){
    const key=compactFieldKey(field);
    const labels={
      direction:'Movimento recebido', recordtype:'Tipo de registro recebido', entitytype:'Tipo de registro recebido',
      kind:'Tipo de registro recebido', type:'Tipo de registro recebido', category:'Categoria recebida',
      paymentmethod:'Forma de pagamento recebida', status:'Status recebido'
    };
    const base=labels[key]||friendlyFieldName(field);
    return direction?`${base} · ${direction==='income'?'Entrada':'Saída'}`:base;
  }

  const MIT_REVENUE_METHODS = Object.freeze([
    {key:'pix', label:'Pix', originalForm:'Pix'},
    {key:'money', label:'Dinheiro', originalForm:'Dinheiro', fixedDestination:'wallet'},
    {key:'debit', label:'Débito', originalForm:'Débito'},
    ...Array.from({length:12}, (_, index) => ({key:`credit${index + 1}`, label:`Crédito ${index + 1}x`, originalForm:'Crédito'}))
  ]);
  const MIT_ENTRY_METHODS = Object.freeze(['Pix','Dinheiro','Débito','Crédito','Transferência']);
  function mitMethodDefinition(key){ return MIT_REVENUE_METHODS.find(method=>method.key===key)||MIT_REVENUE_METHODS[0]; }
  function canonicalMitEntryMethod(value){
    const wanted=normalize(value);
    return MIT_ENTRY_METHODS.find(method=>normalize(method)===wanted)||'';
  }
  function defaultMitRevenueRules(config={}){
    return Object.fromEntries(MIT_REVENUE_METHODS.map(method => {
      const wallet=method.fixedDestination==='wallet';
      const accountId=wallet?CARTEIRA_CONTA_ID:String(config.accountId||'');
      return [method.key, {
        key:method.key,label:method.label,category:'Serviços Marco Iris',
        entryMethodMode:wallet?'custom':'original',entryMethod:wallet?'Dinheiro':null,
        destinationKind:wallet?'wallet':'account',accountId:wallet?CARTEIRA_CONTA_ID:(accountId||null),reserveId:null,
        target:wallet?'wallet':(accountId?`account:${accountId}`:'__default__')
      }];
    }));
  }
  function mitLegacyDestination(current,method,config){
    const explicitKind=String(current.destinationKind||'').toLowerCase();
    if(['wallet','account','reserve'].includes(explicitKind)){
      if(explicitKind==='wallet') return {kind:'wallet',accountId:CARTEIRA_CONTA_ID,reserveId:null};
      if(explicitKind==='reserve') return {kind:'reserve',accountId:null,reserveId:String(current.reserveId||'')||null};
      return {kind:'account',accountId:String(current.accountId||config.accountId||'')||null,reserveId:null};
    }
    const target=String(current.target||'');
    if(target==='wallet'||target==='__carteira__') return {kind:'wallet',accountId:CARTEIRA_CONTA_ID,reserveId:null};
    if(target.startsWith('account:')) return {kind:'account',accountId:target.slice(8)||null,reserveId:null};
    if(target.startsWith('reserve:')) return {kind:'reserve',accountId:null,reserveId:target.slice(8)||null};
    if(target==='__default__'||target==='default') return {kind:'account',accountId:String(config.accountId||'')||null,reserveId:null};
    if(current.reserveId) return {kind:'reserve',accountId:null,reserveId:String(current.reserveId),};
    if(current.accountId&&current.accountId!=='__default__'){
      if(current.accountId==='__carteira__'||String(current.accountId)===String(CARTEIRA_CONTA_ID)) return {kind:'wallet',accountId:CARTEIRA_CONTA_ID,reserveId:null};
      return {kind:'account',accountId:String(current.accountId),reserveId:null};
    }
    if(method.fixedDestination==='wallet') return {kind:'wallet',accountId:CARTEIRA_CONTA_ID,reserveId:null};
    return {kind:'account',accountId:String(config.accountId||'')||null,reserveId:null};
  }
  function normalizeMitRevenueRules(input,config={}){
    const base=defaultMitRevenueRules(config),value=input&&typeof input==='object'?input:{};
    Object.keys(base).forEach(key=>{
      const method=mitMethodDefinition(key),current=value[key]&&typeof value[key]==='object'?value[key]:{};
      const destination=mitLegacyDestination(current,method,config);
      let entryMethodMode=current.entryMethodMode==='custom'?'custom':(current.entryMethodMode==='original'?'original':'');
      let entryMethod=canonicalMitEntryMethod(current.entryMethod);
      if(!entryMethodMode){
        const legacyForm=canonicalMitEntryMethod(current.form);
        if(legacyForm){
          entryMethodMode=legacyForm===method.originalForm?'original':'custom';
          entryMethod=entryMethodMode==='custom'?legacyForm:'';
        }else{
          entryMethodMode=method.fixedDestination==='wallet'?'custom':'original';
        }
      }
      if(entryMethodMode==='original') entryMethod=null;
      else entryMethod=entryMethod||method.originalForm;
      if(destination.kind==='wallet'){
        entryMethodMode='custom';entryMethod='Dinheiro';destination.accountId=CARTEIRA_CONTA_ID;destination.reserveId=null;
      }
      const target=destination.kind==='wallet'?'wallet':(destination.kind==='reserve'?`reserve:${destination.reserveId||''}`:(destination.accountId?`account:${destination.accountId}`:'__default__'));
      base[key]={
        key,label:method.label,category:String(current.category||base[key].category||'').trim()||'Serviços Marco Iris',
        entryMethodMode,entryMethod,
        destinationKind:destination.kind,accountId:destination.accountId||null,reserveId:destination.reserveId||null,target
      };
    });
    return base;
  }
  function mitOriginalInstallments(record,key=mitMethodKey(record)){
    const direct=Number(record?.installments);
    if(Number.isFinite(direct)&&direct>0) return Math.max(1,Math.min(12,Math.trunc(direct)));
    const match=String(key||'').match(/^credit(\d{1,2})$/);
    return match?Math.max(1,Math.min(12,Number(match[1])||1)):1;
  }
  function resolveMitEntryMethod(rule,record){
    if(rule?.destinationKind==='wallet') return 'Dinheiro';
    if(rule?.entryMethodMode==='custom') return canonicalMitEntryMethod(rule.entryMethod);
    return paymentForm(record?.paymentMethod||mitMethodDefinition(mitMethodKey(record)).originalForm);
  }
  function mitAccountActive(account){ return !!(account&&!account.archivedAt&&account.active!==false); }
  function mitWalletAccount(account){ return !!(account&&(String(account.id)===String(CARTEIRA_CONTA_ID)||account.isCarteira)); }
  function mitReserveActive(reserve){ return !!(reserve&&!reserve.archivedAt&&reserve.active!==false); }
  function mitReservesEnabled(data){ return !!(data?.modules?.reserves!==false&&data?.reservas?.enabled!==false); }
  function mitReserveLinkedAccount(data,reserve){
    if(!reserve) return null;
    const direct=accountByIdIn(data,reserve.accountId);
    if(mitAccountActive(direct)&&!mitWalletAccount(direct)) return direct;
    const byName=(data.contas||[]).find(account=>mitAccountActive(account)&&!mitWalletAccount(account)&&normalize(account.nome)===normalize(reserve.banco));
    return byName||null;
  }
  function mitRuleTarget(rule){
    if(rule.destinationKind==='wallet') return {kind:'wallet',id:CARTEIRA_CONTA_ID};
    if(rule.destinationKind==='reserve') return {kind:'reserve',id:String(rule.reserveId||'')};
    return {kind:'account',id:String(rule.accountId||'')};
  }
  function validateMitRevenueRules(data,config,rulesInput=config?.mitRevenueRules){
    const rules=normalizeMitRevenueRules(rulesInput,config||{});
    const categories=Array.isArray(data?.categorias?.receita)?data.categorias.receita:[];
    for(const method of MIT_REVENUE_METHODS){
      const rule=rules[method.key],label=method.label;
      if(!categories.includes(rule.category)) throw new Error(`Escolha uma categoria válida para ${label}.`);
      if(!['original','custom'].includes(rule.entryMethodMode)) throw new Error(`Escolha como o valor de ${label} entra no Borion.`);
      if(rule.entryMethodMode==='custom'&&!canonicalMitEntryMethod(rule.entryMethod)) throw new Error(`Escolha como o valor de ${label} entra no Borion.`);
      if(rule.destinationKind==='wallet'){
        const wallet=accountByIdIn(data,CARTEIRA_CONTA_ID);
        if(!mitAccountActive(wallet)) throw new Error('A Carteira não está disponível no perfil de destino.');
        rule.entryMethodMode='custom';rule.entryMethod='Dinheiro';rule.accountId=CARTEIRA_CONTA_ID;rule.reserveId=null;rule.target='wallet';
      }else if(rule.destinationKind==='account'){
        const account=accountByIdIn(data,rule.accountId);
        if(!mitAccountActive(account)||mitWalletAccount(account)) throw new Error(`Escolha a conta que receberá ${label}.`);
        rule.reserveId=null;rule.target=`account:${account.id}`;
      }else if(rule.destinationKind==='reserve'){
        if(!mitReservesEnabled(data)) throw new Error(`Ative o módulo de Reservas antes de usar a reserva de ${label}.`);
        const reserve=reserveByIdIn(data,rule.reserveId);
        if(!mitReserveActive(reserve)) throw new Error(`Escolha a reserva que receberá ${label}.`);
        const account=mitReserveLinkedAccount(data,reserve);
        if(!account) throw new Error(`A reserva escolhida para ${label} não possui uma conta vinculada válida.`);
        rule.accountId=null;rule.target=`reserve:${reserve.id}`;
      }else{
        throw new Error(`Escolha onde o valor de ${label} entra no Borion.`);
      }
    }
    return rules;
  }
  function ensureMitState(data){
    const interop=ensureInterop(data);
    interop.mitImported ||= {receipts:{},expenses:{}};
    interop.mitImported.receipts ||= {};
    interop.mitImported.expenses ||= {};
    return interop.mitImported;
  }
  function mitMethodKey(record){
    const text=normalize(record?.paymentMethod);
    if(text.includes('dinheiro')) return 'money';
    if(text.includes('debito')) return 'debit';
    if(text.includes('credito')){
      const match=text.match(/(?:credito\s*)?(\d{1,2})\s*x/);
      const count=Math.max(1,Math.min(12,Number(match?.[1]||record?.installments||1)||1));
      return `credit${count}`;
    }
    return 'pix';
  }
  function defaultMappings(){
    return {
      version: SPEC.mappingVersion,
      directions: {income:'receita', expense:'variavel'},
      transactionKinds: {},
      categories: {income:{}, expense:{}},
      paymentMethods: {},
      statuses: {},
      revenueOrigins: {}
    };
  }
  function normalizeMappings(input){
    const base = defaultMappings();
    const value = input && typeof input === 'object' ? input : {};
    base.directions = Object.assign(base.directions, value.directions || value.direction || {});
    base.transactionKinds = Object.assign({}, value.transactionKinds || {});
    base.categories.income = Object.assign({}, value.categories?.income || {});
    base.categories.expense = Object.assign({}, value.categories?.expense || {});
    base.paymentMethods = Object.assign({}, value.paymentMethods || {});
    base.statuses = Object.assign({}, value.statuses || {});
    base.revenueOrigins = Object.assign({}, value.revenueOrigins || {});
    return base;
  }
  function normalizeDiscovered(input){
    const value = input && typeof input === 'object' ? input : {};
    const directional = list => (Array.isArray(list) ? list : []).flatMap(item => item && item.direction ? [item] : ['income','expense'].map(direction => Object.assign({}, item || {}, {direction})));
    return {
      directions: Array.isArray(value.directions) ? value.directions : [],
      transactionKinds: Array.isArray(value.transactionKinds) ? value.transactionKinds : [],
      categories: Array.isArray(value.categories) ? value.categories : [],
      paymentMethods: directional(value.paymentMethods),
      statuses: directional(value.statuses),
      fields: Array.isArray(value.fields) ? value.fields : []
    };
  }
  function ensureInterop(data){
    if(!data.interconnections || typeof data.interconnections !== 'object') data.interconnections = {};
    const root = data.interconnections;
    root.schemaVersion = 2;
    root.importMode = 'smart-native-one-way';
    root.sources ||= {};
    root.imported ||= {};
    root.ignored ||= {};
    root.pending ||= [];
    root.audit ||= [];
    (data.transacoes || []).forEach(tx => {
      if(!tx || !tx.integrationAggregateId || !tx.integrationSourceAppId) return;
      tx.integrationImported = true;
      tx.integrationManaged = false;
      tx.integrationImportMode = 'native';
    });
    Object.entries(root.sources).forEach(([sourceAppId, config]) => {
      if(!config || typeof config !== 'object') return;
      config.sourceAppId = sourceAppId;
      config.mappings = normalizeMappings(config.mappings);
      config.discovered = normalizeDiscovered(config.discovered);
      config.mappingReady = config.mappingReady === true;
      config.importMode = 'smart-native';
    });
    return root;
  }
  function ensureSourceConfig(config){
    if(!config || typeof config !== 'object') return config;
    config.mappings = normalizeMappings(config.mappings);
    config.discovered = normalizeDiscovered(config.discovered);
    config.mappingReady = config.mappingReady === true;
    config.importMode = 'smart-native';
    if(config.sourceAppId === 'marco-iris') config.mitRevenueRules = normalizeMitRevenueRules(config.mitRevenueRules,config);
    // V6.34 — padrão é excluir automaticamente aqui quando o registro some na
    // origem; só fica "preserve" se o usuário desligar explicitamente no toggle.
    config.deletionPolicy = config.deletionPolicy === 'preserve' ? 'preserve' : 'delete';
    // '' = sem corte, importa qualquer data. Preenchido = ignora tudo antes disso.
    config.importCutoffAt = config.importCutoffAt || '';
    return config;
  }
  function profileData(profileId){
    if(S.currentProfile && String(S.currentProfile.id) === String(profileId) && S.data) return S.data;
    return migrateData(getProfileData(profileId) || emptyData(), {profileId});
  }
  function saveProfileData(profileId, data){
    setProfileData(profileId, data);
    if(S.currentProfile && String(S.currentProfile.id) === String(profileId)) S.data = data;
    if(window.GoogleDriveProvider && GoogleDriveProvider.isConnected()) GoogleDriveProvider.queueSave();
    if(window.CloudStorage && CloudStorage.user) CloudStorage.queueSave(profileId, data);
    try{ BackupFS.markDirty(); }catch(_){ }
  }
  function allSourceConfigs(){
    const rows = [];
    (S.profiles || []).forEach(profile => {
      const data = profileData(profile.id);
      const interop = ensureInterop(data);
      Object.entries(interop.sources || {}).forEach(([sourceAppId, config]) => {
        rows.push({sourceAppId, config:ensureSourceConfig(config), profile, data});
      });
    });
    return rows;
  }
  function findSourceConfig(sourceAppId){
    const rows=allSourceConfigs().filter(row=>row.sourceAppId===sourceAppId);
    const currentId=S.currentProfile?.id;
    return rows.find(row=>String(row.profile.id)===String(currentId))||rows[0]||null;
  }

  function openHandleDb(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(HANDLE_DB, 1);
      req.onupgradeneeded = () => {
        if(!req.result.objectStoreNames.contains(HANDLE_STORE)) req.result.createObjectStore(HANDLE_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function handleTx(mode, key, value){
    const db = await openHandleDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE, mode);
      const store = tx.objectStore(HANDLE_STORE);
      const req = value === undefined ? store.get(key) : store.put(value, key);
      let result;
      req.onsuccess = () => { result = req.result; };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }
  function handleKey(sourceAppId, profileId){ return `${sourceAppId}:${profileId}`; }
  async function putHandle(sourceAppId, profileId, handle){ return handleTx('readwrite', handleKey(sourceAppId, profileId), handle); }
  async function getHandle(sourceAppId, profileId){ return handleTx('readonly', handleKey(sourceAppId, profileId)); }

  async function readLocalSnapshot(row){
    const handle = await getHandle(row.sourceAppId, row.profile.id);
    if(!handle) throw new Error('A pasta local da integração ainda não foi conectada neste navegador.');
    const permission = await handle.queryPermission({mode:'readwrite'});
    if(permission !== 'granted' && await handle.requestPermission({mode:'readwrite'}) !== 'granted') throw new Error('Acesso à pasta local não autorizado.');
    const fh = await handle.getFileHandle(SOURCES[row.sourceAppId].snapshotFile);
    return JSON.parse(await (await fh.getFile()).text());
  }
  async function writeLocalAck(row, ack){
    const handle = await getHandle(row.sourceAppId, row.profile.id);
    if(!handle) return;
    const fh = await handle.getFileHandle(SOURCES[row.sourceAppId].ackFile, {create:true});
    const writable = await fh.createWritable();
    await writable.write(new Blob([JSON.stringify(ack, null, 2)], {type:'application/json'}));
    await writable.close();
  }
  async function readDriveSnapshot(row){
    if(!(window.GoogleDriveProvider && GoogleDriveProvider.isConnected())) throw new Error('Conecte primeiro o Borion ao Google Drive.');
    await GoogleDriveAuth.ensureFreshToken();
    const file = await GoogleDriveFS.findChild(row.config.folderId, SOURCES[row.sourceAppId].snapshotFile, 'application/json');
    if(!file) throw new Error('O arquivo de integração não foi encontrado na pasta selecionada. Abra o aplicativo de origem e faça ao menos um salvamento.');
    return await GoogleDriveFS.readFile(file.id);
  }
  async function writeDriveAck(row, ack){
    const name = SOURCES[row.sourceAppId].ackFile;
    const existing = await GoogleDriveFS.findChild(row.config.folderId, name, 'application/json');
    if(existing) await GoogleDriveFS.updateFile(existing.id, ack);
    else await GoogleDriveFS.createFile(row.config.folderId, name, ack);
  }
  async function readSnapshot(row){
    return row.config.transport === 'drive' ? readDriveSnapshot(row) : readLocalSnapshot(row);
  }

  function validateSnapshot(snapshot, sourceAppId){
    if(!snapshot || snapshot.schema !== 'borion.interop.snapshot') throw new Error('Arquivo não é um snapshot de interconexão do Borion.');
    if(Number(snapshot.schemaVersion) !== 1) throw new Error('Versão de protocolo incompatível.');
    if(snapshot.sourceAppId !== sourceAppId) throw new Error(`A pasta contém dados de ${snapshot.sourceAppId || 'outro aplicativo'}, não de ${sourceAppId}.`);
    if(!snapshot.instanceId || !Array.isArray(snapshot.records) || !Array.isArray(snapshot.tombstones)) throw new Error('Snapshot incompleto ou corrompido.');
    const ids = new Set();
    const expectedPrefix = `${sourceAppId}:${snapshot.instanceId}:`;
    snapshot.records.forEach(record => {
      if(!record.aggregateId || !record.entityId) throw new Error('Existe um registro sem identificador permanente.');
      if(!String(record.aggregateId).startsWith(expectedPrefix)) throw new Error('Snapshot rejeitado: identificador fora da instância de origem.');
      if(ids.has(record.aggregateId)) throw new Error('Snapshot rejeitado: identificador de registro duplicado.');
      ids.add(record.aggregateId);
      if(!['income','expense'].includes(record.direction)) throw new Error('Direção financeira inválida.');
      if(!Number.isFinite(Number(record.amount)) || Number(record.amount) < 0) throw new Error('Valor financeiro inválido.');
    });
    (snapshot.tombstones || []).forEach(item => {
      if(!item.aggregateId || !String(item.aggregateId).startsWith(expectedPrefix)) throw new Error('Snapshot rejeitado: exclusão fora da instância de origem.');
    });
    const calculatedHash = hash({records:snapshot.records, tombstones:snapshot.tombstones});
    if(snapshot.contentHash && snapshot.contentHash !== calculatedHash) throw new Error('Snapshot rejeitado: conteúdo alterado ou incompleto.');
    return true;
  }

  function mergeUnique(list, item, identity){
    const key = identity(item);
    const existing = list.find(current => identity(current) === key);
    if(!existing) list.push(item);
    else if(item.label && (!existing.label || existing.label === existing.value)) existing.label = item.label;
  }
  function transactionKindValue(record){
    return record.recordType ?? record.entityType ?? record.kind ?? record.type ?? '';
  }
  function sourceBag(record){
    const candidates=[record?.raw,record?.sourceValues,record?.original,record?.source,record?.payload];
    return candidates.find(value=>value&&typeof value==='object'&&!Array.isArray(value))||{};
  }
  function sourceLabel(record, field, fallback){
    const aliases={
      category:['categoryLabel','categoriaLabel','sourceCategoryLabel'],
      paymentMethod:['paymentMethodLabel','formaPagamentoLabel','sourcePaymentMethodLabel'],
      status:['statusLabel','sourceStatusLabel'],
      recordType:['recordTypeLabel','typeLabel','tipoLabel','sourceTypeLabel'],
      direction:['directionLabel','sourceDirectionLabel']
    };
    const labels=record?.sourceLabels&&typeof record.sourceLabels==='object'?record.sourceLabels:{};
    const raw=sourceBag(record);
    const names=[field].concat(aliases[field]||[]);
    for(const name of names){
      if(labels[name]!==undefined&&labels[name]!==null&&String(labels[name]).trim()) return String(labels[name]).trim();
      if(raw[name]!==undefined&&raw[name]!==null&&String(raw[name]).trim()) return String(raw[name]).trim();
      if(record?.[name]!==undefined&&record?.[name]!==null&&String(record[name]).trim()&&name!==field) return String(record[name]).trim();
    }
    return String(fallback??record?.[field]??'').trim();
  }
  function sourceItem(value, record, field, extra={}){
    const rawValue=String(value??'').trim();
    return Object.assign({key:mappingKey(rawValue),value:rawValue,label:sourceLabel(record,field,rawValue),field},extra);
  }
  function discoverSourceFields(record, discovered){
    const raw=sourceBag(record);
    const entries=Object.keys(raw).length?Object.entries(raw):[
      ['recordType',transactionKindValue(record)],['category',record.category],['paymentMethod',record.paymentMethod],
      ['status',record.status],['description',record.description],['date',record.date],['amount',record.amount],
      ['clientName',record.clientName],['externalReference',record.externalReference]
    ];
    entries.forEach(([name,value])=>{
      if(value===undefined||value===null||typeof value==='object') return;
      mergeUnique(discovered.fields,{key:String(name),sourceName:String(name),sample:String(value),label:sourceLabel(record,String(name),String(name))},item=>item.key);
    });
  }
  function discoverSnapshot(snapshot, current){
    const discovered = normalizeDiscovered(clone(current || {}));
    snapshot.records.forEach(record => {
      if(!discovered.directions.includes(record.direction)) discovered.directions.push(record.direction);
      const categoryValue = String(record.category || '').trim();
      mergeUnique(discovered.categories, sourceItem(categoryValue,record,'category',{direction:record.direction}), item => `${item.direction}:${item.key}`);
      const paymentValue = String(record.paymentMethod || '').trim();
      mergeUnique(discovered.paymentMethods, sourceItem(paymentValue,record,'paymentMethod',{direction:record.direction}), item => `${item.direction}:${item.key}`);
      const statusValue = String(record.status || '').trim();
      mergeUnique(discovered.statuses, sourceItem(statusValue,record,'status',{direction:record.direction}), item => `${item.direction}:${item.key}`);
      const kindValue = String(transactionKindValue(record) || '').trim();
      if(kindValue) mergeUnique(discovered.transactionKinds, sourceItem(kindValue,record,'recordType',{direction:record.direction}), item => `${item.direction}:${item.key}`);
      discoverSourceFields(record,discovered);
    });
    discovered.directions.sort();
    discovered.categories.sort((a,b) => `${a.direction}:${a.label||a.value}`.localeCompare(`${b.direction}:${b.label||b.value}`, 'pt-BR'));
    discovered.paymentMethods.sort((a,b) => `${a.direction}:${a.label||a.value}`.localeCompare(`${b.direction}:${b.label||b.value}`, 'pt-BR'));
    discovered.statuses.sort((a,b) => `${a.direction}:${a.label||a.value}`.localeCompare(`${b.direction}:${b.label||b.value}`, 'pt-BR'));
    discovered.transactionKinds.sort((a,b) => `${a.direction}:${a.label||a.value}`.localeCompare(`${b.direction}:${b.label||b.value}`, 'pt-BR'));
    discovered.fields=discovered.fields.slice(0,60).sort((a,b)=>String(a.sourceName).localeCompare(String(b.sourceName),'pt-BR'));
    return discovered;
  }

  function accountByIdIn(data, accountId){ return (data.contas || []).find(account => String(account.id) === String(accountId)); }
  function accountName(data, accountId){ return accountByIdIn(data, accountId)?.nome || ''; }
  function reserveByIdIn(data,reserveId){ return (data.reservas?.boxes||[]).find(box=>String(box.id)===String(reserveId))||null; }
  function reserveAccountId(data,reserve,config){
    if(!reserve) return '';
    if(accountByIdIn(data,reserve.accountId)) return reserve.accountId;
    const byName=(data.contas||[]).find(account=>normalize(account.nome)===normalize(reserve.banco));
    if(byName) return byName.id;
    return accountByIdIn(data,config.accountId)?config.accountId:'';
  }
  function normalizeTarget(rule,form){
    if(rule?.target){
      const target=String(rule.target);
      if(target==='__default__'||target==='default') return {kind:'default',id:''};
      if(target==='__carteira__'||target==='wallet') return {kind:'wallet',id:CARTEIRA_CONTA_ID};
      if(target.startsWith('account:')) return {kind:'account',id:target.slice(8)};
      if(target.startsWith('reserve:')) return {kind:'reserve',id:target.slice(8)};
    }
    const legacy=rule?.accountId;
    if(legacy==='__carteira__') return {kind:'wallet',id:CARTEIRA_CONTA_ID};
    if(legacy&&legacy!=='__default__') return {kind:'account',id:legacy};
    return {kind:form==='Dinheiro'?'wallet':'default',id:form==='Dinheiro'?CARTEIRA_CONTA_ID:''};
  }
  function resolveFinancialTarget(data,config,record){
    const mapped=record._mappedTarget||{kind:'default',id:''};
    if(mapped.kind==='reserve'){
      const reserve=reserveByIdIn(data,mapped.id);
      return reserve?{kind:'reserve',id:reserve.id,reserve,accountId:reserveAccountId(data,reserve,config)}:null;
    }
    const candidate=mapped.kind==='wallet'?CARTEIRA_CONTA_ID:(mapped.kind==='account'?mapped.id:record._mappedAccountId||config.accountId);
    const account=accountByIdIn(data,candidate);
    return account?{kind:mapped.kind==='wallet'?'wallet':'account',id:account.id,accountId:account.id,account}:null;
  }
  function ensureLedger(data, accountId){
    data.liquidez = Array.isArray(data.liquidez) ? data.liquidez : [];
    let ledger = data.liquidez.find(item => item && item.ledgerType === 'account_delta' && String(item.accountId) === String(accountId));
    if(!ledger){
      const account = accountByIdIn(data, accountId);
      if(!account) return null;
      ledger = {id:'bridge-ledger-' + hash(accountId),accountId,ledgerType:'account_delta',nome:account.nome||'Conta',banco:account.nome||'',valor:0,createdAt:Date.now()};
      data.liquidez.push(ledger);
    }
    return ledger;
  }
  function txDelta(tx){
    if(!tx || !tx.accountId) return 0;
    if(tx.tipo === 'receita') return (Number(tx.valor) || 0) - (Number(tx.reservaValor) || 0);
    if(tx.tipo === 'variavel' && tx.statusPagamento !== 'Em aberto' && tx.origemPagamento !== 'reserva' && tx.formaPagamento !== 'Crédito') return -(Number(tx.valor) || 0);
    return 0;
  }
  function adjust(data, accountId, delta){
    if(!delta) return true;
    const ledger = ensureLedger(data, accountId);
    if(!ledger) return false;
    ledger.valor = Math.round(((Number(ledger.valor) || 0) + Number(delta)) * 100) / 100;
    return true;
  }
  function applyReserveLink(data,tx){
    if(!tx) return true;
    data.reservas ||= {boxes:[],moves:[]};
    data.reservas.boxes=Array.isArray(data.reservas.boxes)?data.reservas.boxes:[];
    data.reservas.moves=Array.isArray(data.reservas.moves)?data.reservas.moves:[];
    if(tx.tipo==='receita'&&tx.reservaBoxId){
      const box=reserveByIdIn(data,tx.reservaBoxId),value=Number(tx.reservaValor)||0;
      if(!box||value<=0) return false;
      if(data.reservas.moves.some(move=>move.transacaoId===tx.id)) return true;
      const move={id:'bridge-reserve-'+hash(tx.id),boxId:box.id,tipo:tx.origem==='rendimento'?'Rendimento':'Receita direta',data:tx.data,valor:value,banco:box.banco||tx.banco||'',descricao:(tx.origem==='rendimento'?'Rendimento integrado: ':'Receita enviada direto para reserva: ')+(tx.nome||'Sem nome'),origem:'receita',transacaoId:tx.id,createdAt:Date.now()};
      data.reservas.moves.push(move); box.valorAtual=Math.round(((Number(box.valorAtual)||0)+value)*100)/100; tx.reservaMoveId=move.id; tx.destinoReserva=true; return true;
    }
    if(tx.tipo==='variavel'&&tx.origemPagamento==='reserva'&&tx.statusPagamento!=='Em aberto'){
      const box=reserveByIdIn(data,tx.reservaOrigemId),value=Number(tx.valor)||0;
      if(!box||value<=0||(Number(box.valorAtual)||0)<value-1e-9) return false;
      if(data.reservas.moves.some(move=>move.despesaTransacaoId===tx.id)) return true;
      const move={id:'bridge-reserve-out-'+hash(tx.id),boxId:box.id,tipo:'Pagamento direto',data:tx.data,valor:value,banco:box.banco||'',descricao:'Pagamento direto integrado: '+(tx.nome||'Despesa'),despesaTransacaoId:tx.id,createdAt:Date.now()};
      data.reservas.moves.push(move); box.valorAtual=Math.round(((Number(box.valorAtual)||0)-value)*100)/100; tx.reservaOrigemMoveId=move.id; return true;
    }
    return true;
  }
  function applyNew(data, tx){
    if(!applyReserveLink(data,tx)) return false;
    const delta = txDelta(tx);
    return delta ? adjust(data, tx.accountId, delta) : true;
  }
  /* V6.34 — EXCLUSÃO SINCRONIZADA COM TRAVA DE SEGURANÇA
     Assinatura dos campos que o usuário pode editar livremente no Borion depois
     que o lançamento vira nativo. Guardada no momento da criação e recalculada
     no momento em que a origem manda excluir: se bater, o lançamento nunca foi
     tocado manualmente e pode ser excluído com segurança; se não bater, alguém
     editou esse lançamento no Borion depois da importação e ele é preservado
     em vez de apagado, mesmo com a exclusão automática ligada. */
  function editableSnapshotHash(tx){
    return hash({
      nome:tx.nome||'', data:tx.data||'', categoria:tx.categoria||'', valor:Number(tx.valor)||0,
      accountId:tx.accountId||'', banco:tx.banco||'', formaPagamento:tx.formaPagamento||'',
      statusPagamento:tx.statusPagamento||'', origem:tx.origem||'', origemPagamento:tx.origemPagamento||'',
      reservaOrigemId:tx.reservaOrigemId||'', reservaBoxId:tx.reservaBoxId||'', destinoReserva:!!tx.destinoReserva
    });
  }
  function reverseReserveLink(data, tx){
    if(!tx || !data.reservas) return;
    data.reservas.moves = Array.isArray(data.reservas.moves) ? data.reservas.moves : [];
    if(tx.reservaMoveId){
      const idx = data.reservas.moves.findIndex(m => m.id === tx.reservaMoveId);
      if(idx >= 0){
        const mv = data.reservas.moves[idx];
        const box = reserveByIdIn(data, mv.boxId);
        if(box) box.valorAtual = Math.round(Math.max(0, (Number(box.valorAtual)||0) - (Number(mv.valor)||0)) * 100) / 100;
        data.reservas.moves.splice(idx, 1);
      }
    }
    if(tx.reservaOrigemMoveId){
      const idx = data.reservas.moves.findIndex(m => m.id === tx.reservaOrigemMoveId);
      if(idx >= 0){
        const mv = data.reservas.moves[idx];
        const box = reserveByIdIn(data, mv.boxId);
        if(box) box.valorAtual = Math.round(((Number(box.valorAtual)||0) + (Number(mv.valor)||0)) * 100) / 100;
        data.reservas.moves.splice(idx, 1);
      }
    }
  }
  function reverseImportedTransaction(data, tx){
    reverseReserveLink(data, tx);
    const delta = txDelta(tx);
    if(delta) adjust(data, tx.accountId, -delta);
    data.transacoes = (data.transacoes || []).filter(item => item.id !== tx.id);
  }
  function paymentForm(method){
    const m = normalize(method);
    if(m.includes('dinheiro')) return 'Dinheiro';
    if(m.includes('debito')) return 'Débito';
    if(m.includes('credito')) return 'Crédito';
    return 'Pix';
  }
  function inferRevenueOrigin(category){
    const value = normalize(category);
    if(value.includes('reembolso')) return 'reembolso';
    if(value.includes('rendimento') || value.includes('juros')) return 'rendimento';
    if(value.includes('repasse')) return 'repasse';
    return 'propria';
  }
  function mappedRecord(config, record){
    const mappings = normalizeMappings(config.mappings);
    const direction = record.direction;
    const kind = String(transactionKindValue(record) || '').trim();
    const kindTarget = kind ? mappings.transactionKinds[`${direction}:${mappingKey(kind)}`] : '';
    const targetType = kindTarget || mappings.directions[direction] || (direction === 'income' ? 'receita' : 'variavel');
    if(targetType === 'ignore') return {skip:true, reason:'Tipo configurado para ignorar'};

    const statusRule = mappings.statuses[`${direction}:${mappingKey(record.status)}`] || mappings.statuses[mappingKey(record.status)] || 'auto';
    if(statusRule === 'ignore') return {skip:true, reason:'Status configurado para ignorar'};
    const settled = statusRule === 'paid' ? true : (statusRule === 'open' ? false : record.settled === true);

    const categorySource = String(record.category || '').trim();
    const category = String(mappings.categories?.[direction]?.[mappingKey(categorySource)] || categorySource || 'Outro').trim() || 'Outro';
    const methodSource = String(record.paymentMethod || '').trim();
    const paymentRule = mappings.paymentMethods[`${direction}:${mappingKey(methodSource)}`] || mappings.paymentMethods[mappingKey(methodSource)] || {};
    const form = FORMAS_PAGAMENTO.includes(paymentRule.form) ? paymentRule.form : paymentForm(methodSource);
    const target=normalizeTarget(paymentRule,form);
    let accountId=target.kind==='wallet'?CARTEIRA_CONTA_ID:(target.kind==='account'?target.id:config.accountId);

    const revenueOrigin = mappings.revenueOrigins[mappingKey(categorySource)] || inferRevenueOrigin(categorySource);
    return Object.assign({}, record, {
      _borionType: targetType,_mappedCategory: category,_mappedPaymentForm: form,
      _mappedAccountId: accountId,_mappedTarget:target,_mappedRevenueOrigin: revenueOrigin,
      _mappedSettled: settled,_mappingVersion: SPEC.mappingVersion
    });
  }
  function ensureCategory(data, type, category){
    data.categorias ||= defaultCategories();
    const bucket = type === 'receita' ? 'receita' : 'variavel';
    data.categorias[bucket] = Array.isArray(data.categorias[bucket]) ? data.categorias[bucket] : [];
    const value = String(category || 'Outro').trim() || 'Outro';
    if(!data.categorias[bucket].includes(value)) data.categorias[bucket].push(value);
    data.categoryColors ||= {receita:{}, fixa:{}, variavel:{}};
    data.categoryColors[bucket] ||= {};
    if(!data.categoryColors[bucket][value]) data.categoryColors[bucket][value] = baseCatColor(value);
    return value;
  }
  function targetAccountId(data, config, record){
    const target=resolveFinancialTarget(data,config,record);
    return target?.accountId||'';
  }
  function makeTransaction(data, config, record){
    const target=resolveFinancialTarget(data,config,record);
    if(!target) throw new Error(`O destino vinculado ao campo “${record.paymentMethod || 'sem forma de pagamento'}” não existe mais no Borion.`);
    const isIncome = record._borionType === 'receita';
    const category = ensureCategory(data, isIncome ? 'receita' : 'variavel', record._mappedCategory);
    const amount=Math.round((Number(record.amount)||0)*100)/100;
    const reserve=target.kind==='reserve'?target.reserve:null;
    const accountId=reserve?(target.accountId||null):target.accountId;
    const bank=reserve?(reserve.banco||accountName(data,accountId)):accountName(data,accountId);
    const base = {
      id:'bridge-' + hash(record.aggregateId),nome:record.description || 'Lançamento integrado',
      data:record.date || new Date().toISOString().slice(0,10),categoria:category,valor:amount,
      accountId,banco:bank,integrationImported:true,integrationManaged:false,integrationImportMode:'native',
      integrationAggregateId:record.aggregateId,integrationSourceAppId:config.sourceAppId,integrationEntityId:record.entityId,
      integrationOriginalFingerprint:record.fingerprint || hash(record),integrationImportedAt:nowIso(),
      integrationSourceUpdatedAt:record.sourceUpdatedAt || '',integrationExternalReference:record.externalReference || '',
      integrationClientName:record.clientName || '',integrationNotes:record.notes || '',
      integrationOriginalCategory:record.category || '',integrationOriginalPaymentMethod:record.paymentMethod || '',
      integrationOriginalStatus:record.status || '',integrationOriginalSourceValues:clone(sourceBag(record)),integrationMappingVersion:SPEC.mappingVersion
    };
    const tx = isIncome
      ? Object.assign(base,{tipo:'receita',origem:record._mappedRevenueOrigin||'propria',reservaValor:reserve?amount:0,destinoModo:reserve?'Direto para reserva':'Conta livre',reservaBoxId:reserve?reserve.id:null,destinoReserva:!!reserve,formaPagamento:record._mappedPaymentForm})
      : Object.assign(base,{tipo:'variavel',accountId:reserve?null:accountId,statusPagamento:record._mappedSettled?'Pago':'Em aberto',origemPagamento:reserve?'reserva':'conta',formaPagamento:reserve?null:record._mappedPaymentForm,reservaOrigemId:reserve?reserve.id:null,reservaOrigemMoveId:null,localCompra:''});
    tx.integrationEditGuardHash = editableSnapshotHash(tx);
    return tx;
  }

  function importedState(data, sourceAppId){
    const interop = ensureInterop(data);
    return interop.imported[sourceAppId] ||= {
      instanceId:'', lastRevision:0, lastContentHash:'', records:{}, lastSyncAt:'', lastError:''
    };
  }
  function ignoredState(data, sourceAppId){
    const interop = ensureInterop(data);
    return interop.ignored[sourceAppId] ||= {};
  }
  function findImportedTransaction(data, sourceAppId, aggregateId){
    return (data.transacoes || []).find(tx =>
      tx && tx.integrationAggregateId === aggregateId && tx.integrationSourceAppId === sourceAppId
    ) || null;
  }

  function findMitImportedIncome(data, receiptId){
    const wanted=String(receiptId||'');
    return (data.transacoes||[]).find(tx=>tx&&tx.integrationSourceAppId==='marco-iris'&&String(tx.integrationReceiptId||tx.integrationEntityId||'')===wanted)||null;
  }
  function makeMitIncomeTransaction(data,config,record){
    const key=mitMethodKey(record),rules=validateMitRevenueRules(data,config,config.mitRevenueRules),rule=rules[key]||rules.pix;
    const target=mitRuleTarget(rule),entryMethod=resolveMitEntryMethod(rule,record);
    if(!entryMethod) throw new Error(`Escolha como o valor de ${mitMethodDefinition(key).label} entra no Borion.`);
    const converted=Object.assign({},record,{
      date:record.paymentDate||record.date,
      _borionType:'receita',_mappedCategory:rule.category,_mappedPaymentForm:entryMethod,
      _mappedAccountId:target.kind==='account'?target.id:config.accountId,_mappedTarget:target,
      _mappedRevenueOrigin:'propria',_mappedSettled:true,_mappingVersion:SPEC.mappingVersion
    });
    const tx=makeTransaction(data,config,converted);
    tx.nome=record.description||`${record.orderNumber||'Sem OSV'} • ${record.clientName||'Cliente não informado'}`;
    tx.integrationReceiptId=String(record.receiptId||record.entityId||'');
    tx.integrationOrderNumber=record.orderNumber||'';
    tx.integrationClientName=record.clientName||'';
    tx.integrationExternalReference=record.externalReference||'';
    tx.integrationPaymentMethodOriginal=record.paymentMethod||'';
    tx.integrationOriginalPaymentMethod=record.paymentMethod||'';
    tx.integrationOriginalInstallments=mitOriginalInstallments(record,key);
    tx.integrationEntryMethod=entryMethod;
    tx.integrationEntryMethodMode=rule.entryMethodMode;
    tx.integrationDestinationKind=rule.destinationKind;
    return tx;
  }
  function reconcileMitSnapshot(data,config,snapshot){
    validateSnapshot(snapshot,config.sourceAppId);
    ensureSourceConfig(config);
    if(!config.mappingReady) throw new Error('Configure as receitas do Marco Iris antes de sincronizar esta integração.');
    config.mitRevenueRules=validateMitRevenueRules(data,config,config.mitRevenueRules);
    const interop=ensureInterop(data),state=importedState(data,config.sourceAppId),mitState=ensureMitState(data);
    state.records ||= {};
    const results=[],pendingById=new Map((interop.pending||[]).filter(item=>item.sourceAppId==='marco-iris').map(item=>[String(item.entityId),item]));
    const incomingExpenseIds=new Set();
    (snapshot.records||[]).forEach(record=>{
      const entityId=String(record.receiptId||record.entityId||'');
      if(record.direction==='expense'){
        incomingExpenseIds.add(entityId);
        if(record.active===false||normalize(record.status)==='cancelled'){
          pendingById.delete(entityId); delete state.records[record.aggregateId];
          results.push({aggregateId:record.aggregateId,entityId,status:'cancelled',borionTransactionId:'',message:'Despesa cancelada na origem; retirada da revisão.'});
          return;
        }
        if(mitState.expenses[entityId]){
          pendingById.delete(entityId);
          state.records[record.aggregateId]=Object.assign({},state.records[record.aggregateId]||{},{status:'imported',entityId,importedAt:mitState.expenses[entityId].importedAt||''});
          results.push({aggregateId:record.aggregateId,entityId,status:'unchanged',borionTransactionId:mitState.expenses[entityId].borionId||'',message:'Despesa já importada manualmente.'});
          return;
        }
        if(beforeImportCutoff(config,record.date||record.dueDate)){
          pendingById.delete(entityId);
          state.records[record.aggregateId]={status:'ignored',entityId,reason:'before_cutoff',updatedAt:record.sourceUpdatedAt||''};
          results.push({aggregateId:record.aggregateId,entityId,status:'ignored_before_cutoff',borionTransactionId:'',message:'Fora do período configurado para importação automática.'});
          return;
        }
        const pending={
          sourceAppId:'marco-iris',aggregateId:record.aggregateId,entityId,
          name:record.name||record.description||'Despesa do Marco Iris',description:record.description||record.name||'Despesa do Marco Iris',
          localPurchase:record.localPurchase||'',category:record.category||'',amount:Number(record.amount)||0,
          date:record.date||record.dueDate||todayISO(),origin:'Marco Iris',status:record.settled?'Pago':'Em aberto',
          paymentMethod:record.paymentMethod||'',externalReference:record.externalReference||'',record:clone(record),
          updatedAt:record.sourceUpdatedAt||snapshot.generatedAt||nowIso()
        };
        pendingById.set(entityId,pending);
        state.records[record.aggregateId]={status:'waiting',entityId,fingerprint:record.fingerprint||hash(record),updatedAt:pending.updatedAt};
        results.push({aggregateId:record.aggregateId,entityId,status:'waiting',borionTransactionId:'',message:'Aguardando revisão manual no Borion.'});
        return;
      }

      const receiptId=entityId;
      const nativeTx=findMitImportedIncome(data,receiptId);
      if(nativeTx||mitState.receipts[receiptId]){
        const txId=nativeTx?.id||mitState.receipts[receiptId]?.borionId||'';
        mitState.receipts[receiptId] ||= {borionId:txId,importedAt:nativeTx?.integrationImportedAt||nowIso()};
        state.records[record.aggregateId]={status:'imported',txId,entityId:receiptId,importedAt:mitState.receipts[receiptId].importedAt};
        results.push({aggregateId:record.aggregateId,entityId:receiptId,status:'unchanged',borionTransactionId:txId,message:'REC já importado; duplicidade bloqueada.'});
        return;
      }
      if(beforeImportCutoff(config,record.paymentDate||record.date)){
        state.records[record.aggregateId]={status:'ignored',entityId:receiptId,reason:'before_cutoff',updatedAt:record.sourceUpdatedAt||''};
        results.push({aggregateId:record.aggregateId,entityId:receiptId,status:'ignored_before_cutoff',borionTransactionId:'',message:'Fora do período configurado para importação automática.'});
        return;
      }
      if(record.active===false||record.settled!==true||!record.paymentDate){
        state.records[record.aggregateId]={status:'waiting',entityId:receiptId,reason:'not-paid',updatedAt:record.sourceUpdatedAt||''};
        results.push({aggregateId:record.aggregateId,entityId:receiptId,status:'waiting',borionTransactionId:'',message:'Recebimento ainda sem Data de Pagamento.'});
        return;
      }
      const tx=makeMitIncomeTransaction(data,config,record);
      data.transacoes=Array.isArray(data.transacoes)?data.transacoes:[];
      if(data.transacoes.some(item=>item.id===tx.id)) tx.id += '-' + hash(receiptId+nowIso());
      data.transacoes.push(tx);
      if(!applyNew(data,tx)){ data.transacoes=data.transacoes.filter(item=>item.id!==tx.id); throw new Error('Não foi possível aplicar o destino financeiro da receita '+receiptId+'.'); }
      mitState.receipts[receiptId]={borionId:tx.id,aggregateId:record.aggregateId,importedAt:tx.integrationImportedAt,externalReference:record.externalReference||''};
      state.records[record.aggregateId]={status:'imported',txId:tx.id,entityId:receiptId,importedAt:tx.integrationImportedAt,fingerprint:tx.integrationOriginalFingerprint};
      results.push({aggregateId:record.aggregateId,entityId:receiptId,status:'created',borionTransactionId:tx.id,message:'Receita recebida e importada automaticamente.'});
    });
    [...pendingById.keys()].forEach(entityId=>{ if(!incomingExpenseIds.has(entityId)) pendingById.delete(entityId); });
    interop.pending=(interop.pending||[]).filter(item=>item.sourceAppId!=='marco-iris').concat([...pendingById.values()]);
    state.instanceId=snapshot.instanceId; state.lastRevision=Number(snapshot.revision)||0;
    state.lastContentHash=snapshot.contentHash||hash({records:snapshot.records,tombstones:snapshot.tombstones});
    state.lastSyncAt=nowIso(); state.lastError='';
    config.lastSyncAt=state.lastSyncAt; config.lastRevision=state.lastRevision; config.lastError='';
    config.lastResult={
      created:results.filter(x=>x.status==='created').length,deleted:0,
      waiting:results.filter(x=>x.status==='waiting').length,
      unchanged:results.filter(x=>x.status==='unchanged').length,ignored:0,sourceDeleted:0
    };
    interop.audit.unshift({id:'interop-mit-'+Date.now(),at:state.lastSyncAt,sourceAppId:'marco-iris',revision:state.lastRevision,mode:'automatic-income-assisted-expense',result:clone(config.lastResult)});
    interop.audit=interop.audit.slice(0,300);
    return {results,pending:[...pendingById.values()],summary:config.lastResult};
  }

  function reconcileSnapshot(data, config, snapshot){
    if(config.sourceAppId === 'marco-iris') return reconcileMitSnapshot(data, config, snapshot);
    validateSnapshot(snapshot, config.sourceAppId);
    ensureSourceConfig(config);
    if(!config.mappingReady) throw new Error('Configure e salve a aba Vínculos antes de sincronizar esta integração.');

    const interop = ensureInterop(data);
    const state = importedState(data, config.sourceAppId);
    state.records ||= {};
    const ignored = ignoredState(data, config.sourceAppId);
    const results = [];
    const pending = [];
    const incomingIds = new Set(snapshot.records.map(item => item.aggregateId));
    const tombstones = new Set((snapshot.tombstones || []).map(item => item.aggregateId));

    const deletionPolicy = config.deletionPolicy === 'preserve' ? 'preserve' : 'delete';
    tombstones.forEach(aggregateId => {
      const marker = state.records[aggregateId];
      if(marker?.status === 'waiting') delete state.records[aggregateId];
      const nativeTx = findImportedTransaction(data, config.sourceAppId, aggregateId);

      if(!nativeTx){
        results.push({
          aggregateId, status:'source_deleted', borionTransactionId:marker?.txId || '',
          message:'Registro removido na origem antes da importação.'
        });
        return;
      }

      const editedSinceImport = !!nativeTx.integrationEditGuardHash && nativeTx.integrationEditGuardHash !== editableSnapshotHash(nativeTx);
      if(deletionPolicy === 'delete' && !editedSinceImport){
        try{
          reverseImportedTransaction(data, nativeTx);
          delete state.records[aggregateId];
          results.push({
            aggregateId, status:'deleted', borionTransactionId:nativeTx.id,
            message:'Excluído automaticamente: o registro foi removido na origem.'
          });
        }catch(error){
          results.push({
            aggregateId, status:'preserved', borionTransactionId:nativeTx.id,
            message:'Não foi possível excluir automaticamente (' + (error.message || error) + '). Lançamento preservado.'
          });
        }
        return;
      }

      results.push({
        aggregateId, status:'preserved', borionTransactionId:nativeTx.id,
        message:editedSinceImport
          ? 'O registro foi excluído na origem, mas este lançamento foi editado manualmente no Borion depois da importação — não foi excluído automaticamente.'
          : 'O registro foi excluído na origem, mas o lançamento nativo foi preservado no Borion (exclusão automática desativada para esta integração).'
      });
    });

    Object.keys(state.records).forEach(aggregateId => {
      if(state.records[aggregateId]?.status === 'waiting' && !incomingIds.has(aggregateId) && !tombstones.has(aggregateId)) delete state.records[aggregateId];
    });

    snapshot.records.forEach(record => {
      if(tombstones.has(record.aggregateId)) return;
      if(ignored[record.aggregateId]){
        results.push({aggregateId:record.aggregateId, entityId:record.entityId, status:'ignored', borionTransactionId:'', message:'Ignorado permanentemente pelo usuário.'});
        return;
      }

      const marker = state.records[record.aggregateId];
      const nativeTx = findImportedTransaction(data, config.sourceAppId, record.aggregateId);
      if(nativeTx || marker?.status === 'imported'){
        if(nativeTx){
          state.records[record.aggregateId] = Object.assign({}, marker || {}, {
            status:'imported', txId:nativeTx.id, entityId:record.entityId,
            fingerprint:marker?.fingerprint || nativeTx.integrationOriginalFingerprint || record.fingerprint || hash(record),
            importedAt:marker?.importedAt || nativeTx.integrationImportedAt || nowIso()
          });
        }
        results.push({
          aggregateId:record.aggregateId,
          entityId:record.entityId,
          status:'unchanged',
          borionTransactionId:nativeTx?.id || marker?.txId || '',
          message:'Já importado. Alterações locais do Borion foram preservadas.'
        });
        return;
      }

      if(record.active === false){
        state.records[record.aggregateId] = {status:'waiting', entityId:record.entityId, reason:'inactive', updatedAt:record.sourceUpdatedAt || ''};
        results.push({aggregateId:record.aggregateId, entityId:record.entityId, status:'cancelled', borionTransactionId:'', message:'Cancelado na origem antes da importação.'});
        return;
      }

      if(beforeImportCutoff(config, record.date)){
        state.records[record.aggregateId] = {status:'ignored', entityId:record.entityId, reason:'before_cutoff', updatedAt:record.sourceUpdatedAt || ''};
        results.push({aggregateId:record.aggregateId, entityId:record.entityId, status:'ignored_before_cutoff', borionTransactionId:'', message:'Fora do período configurado para importação automática.'});
        return;
      }

      const converted = mappedRecord(config, record);
      if(converted.skip){
        state.records[record.aggregateId] = {status:'waiting', entityId:record.entityId, reason:'mapping_ignore', updatedAt:record.sourceUpdatedAt || ''};
        results.push({aggregateId:record.aggregateId, entityId:record.entityId, status:'ignored_by_rule', borionTransactionId:'', message:converted.reason});
        return;
      }

      const shouldImport = converted._borionType === 'variavel' || converted._mappedSettled === true;
      if(!shouldImport){
        state.records[record.aggregateId] = {
          fingerprint:record.fingerprint || hash(record), status:'waiting', entityId:record.entityId,
          updatedAt:record.sourceUpdatedAt || ''
        };
        pending.push({
          sourceAppId:config.sourceAppId, aggregateId:record.aggregateId, entityId:record.entityId,
          description:record.description, status:record.status, direction:record.direction, amount:record.amount
        });
        results.push({aggregateId:record.aggregateId, entityId:record.entityId, status:'waiting', borionTransactionId:'', message:'Aguardando confirmação de recebimento na origem.'});
        return;
      }

      const tx = makeTransaction(data, config, converted);
      data.transacoes = Array.isArray(data.transacoes) ? data.transacoes : [];
      if(data.transacoes.some(item => item.id === tx.id)) tx.id = tx.id + '-' + hash(nowIso() + Math.random());
      data.transacoes.push(tx);
      if(!applyNew(data, tx)) throw new Error('Não foi possível aplicar o saldo do lançamento convertido.');
      state.records[record.aggregateId] = {
        fingerprint:tx.integrationOriginalFingerprint,
        status:'imported', txId:tx.id, entityId:record.entityId,
        importedAt:tx.integrationImportedAt, updatedAt:record.sourceUpdatedAt || ''
      };
      results.push({aggregateId:record.aggregateId, entityId:record.entityId, status:'created', borionTransactionId:tx.id, message:'Convertido e criado como lançamento nativo do Borion.'});
    });

    interop.pending = (interop.pending || []).filter(item => item.sourceAppId !== config.sourceAppId).concat(pending);
    state.instanceId = snapshot.instanceId;
    state.lastRevision = Number(snapshot.revision) || 0;
    state.lastContentHash = snapshot.contentHash || hash({records:snapshot.records, tombstones:snapshot.tombstones});
    state.lastSyncAt = nowIso();
    state.lastError = '';
    config.lastSyncAt = state.lastSyncAt;
    config.lastRevision = state.lastRevision;
    config.lastError = '';
    config.lastResult = {
      created:results.filter(x => x.status === 'created').length,
      deleted:results.filter(x => x.status === 'deleted').length,
      waiting:results.filter(x => x.status === 'waiting').length,
      unchanged:results.filter(x => x.status === 'unchanged' || x.status === 'preserved').length,
      ignored:results.filter(x => x.status === 'ignored' || x.status === 'ignored_by_rule').length,
      sourceDeleted:results.filter(x => x.status === 'source_deleted').length
    };
    interop.audit.unshift({
      id:'interop-' + Date.now(), at:state.lastSyncAt, sourceAppId:config.sourceAppId,
      revision:state.lastRevision, mode:'smart-native', result:clone(config.lastResult)
    });
    interop.audit = interop.audit.slice(0, 300);
    return {results, pending, summary:config.lastResult};
  }

  async function inspectSource(sourceAppId, {silent=false}={}){
    const row = findSourceConfig(sourceAppId);
    if(!row) throw new Error('Esta integração ainda não foi configurada.');
    const snapshot = await readSnapshot(row);
    validateSnapshot(snapshot, sourceAppId);
    row.config.discovered = discoverSnapshot(snapshot, row.config.discovered);
    row.config.lastInspectedAt = nowIso();
    row.config.lastSeenRevision = Number(snapshot.revision) || 0;
    saveProfileData(row.profile.id, row.data);
    uiSourceAppId = sourceAppId;
    uiTab = 'links';
    if(typeof renderView === 'function') renderView();
    if(!silent && typeof toast === 'function') toast(sourceAppId==='marco-iris'?'Marco Iris atualizado. Configure as receitas e revise as despesas.':`${sourceName(sourceAppId)}: campos da origem lidos. Configure os Vínculos.`);
    return snapshot;
  }

  async function syncSource(sourceAppId, {silent=false}={}){
    const row = findSourceConfig(sourceAppId);
    if(!row) throw new Error('Esta integração ainda não foi configurada.');
    if(!row.config.mappingReady) throw new Error(sourceAppId==='marco-iris'?'Abra “Receitas e despesas” e salve a configuração das receitas.':'Abra a aba Vínculos, confira os mapeamentos e clique em “Salvar opções”.');
    if(syncing) throw new Error('Outra integração já está sincronizando.');
    syncing = true;
    try{
      const snapshot = await readSnapshot(row);
      row.config.discovered = discoverSnapshot(snapshot, row.config.discovered);
      const before = clone(row.data);
      let result;
      try{ result = reconcileSnapshot(row.data, row.config, snapshot); }
      catch(error){ Object.keys(row.data).forEach(key => delete row.data[key]); Object.assign(row.data, before); throw error; }
      saveProfileData(row.profile.id, row.data);
      const ack = {
        schema:'borion.interop.ack', schemaVersion:1, bridgeVersion:SPEC.bridgeVersion,
        importMode:'smart-native', sourceAppId, instanceId:snapshot.instanceId,
        sourceRevision:Number(snapshot.revision) || 0,
        targetProfileId:row.profile.id, targetProfileName:row.profile.name,
        processedAt:nowIso(), summary:result.summary, records:result.results
      };
      if(row.config.transport === 'drive') await writeDriveAck(row, ack);
      else await writeLocalAck(row, ack);
      if(S.currentProfile && String(S.currentProfile.id) === String(row.profile.id)){
        saveCurrentData();
        // V6.44.3 — a sincronização automática (setInterval de 15s, silenciosa) não
        // pode redesenhar a tela por cima de uma edição não salva. Antes disso, um
        // renderView() aqui reconstruía a aba Integrações a partir da configuração
        // já salva, apagando qualquer seleção feita no formulário (ex.: trocar
        // "Manter forma original" em "Como o valor entra no Borion") antes da
        // pessoa clicar em "Salvar opções". Os dados sincronizados continuam
        // salvos normalmente; só a repintura da tela é adiada.
        const editingIntegrationSettings = silent && S.view === 'settings' && S.settingsTab === 'integrations';
        if(typeof renderView === 'function' && !editingIntegrationSettings) renderView();
      }
      if(!silent && typeof toast === 'function'){
        const deletedPart = result.summary.deleted ? `, ${result.summary.deleted} excluído(s)` : '';
        toast(`${sourceName(sourceAppId)}: ${result.summary.created} novo(s)${deletedPart}, ${result.summary.unchanged} já importado(s), ${result.summary.waiting} aguardando.`);
      }
      return result;
    }catch(error){
      row.config.lastError = error.message || String(error);
      row.config.lastAttemptAt = nowIso();
      saveProfileData(row.profile.id, row.data);
      if(!silent && typeof alert === 'function') alert(row.config.lastError);
      throw error;
    }finally{ syncing = false; }
  }

  async function configure(sourceAppId, transport, profileId, accountId){
    if(!SOURCES[sourceAppId]) throw new Error('Aplicativo de origem desconhecido.');
    const data = profileData(profileId);
    const interop = ensureInterop(data);
    if(!accountByIdIn(data, accountId) && accountId !== CARTEIRA_CONTA_ID) throw new Error('Escolha uma conta válida do perfil de destino.');
    let folderId = '';
    if(transport === 'local'){
      if(!window.showDirectoryPicker) throw new Error('Este navegador não permite escolher uma pasta local. Use Chrome ou Edge.');
      const handle = await window.showDirectoryPicker({mode:'readwrite'});
      let integrationHandle = handle;
      if(handle.name !== SPEC.folderName){
        try{ integrationHandle = await handle.getDirectoryHandle(SPEC.folderName); }
        catch(_){ throw new Error('Selecione a pasta Borion_Integracoes criada pelo aplicativo de origem.'); }
      }
      try{ await integrationHandle.getFileHandle(SOURCES[sourceAppId].snapshotFile); }
      catch(_){ throw new Error(`O arquivo ${SOURCES[sourceAppId].snapshotFile} não existe nessa pasta. Salve primeiro no aplicativo de origem.`); }
      await putHandle(sourceAppId, profileId, integrationHandle);
    }else if(transport === 'drive'){
      if(!(window.GoogleDriveProvider && GoogleDriveProvider.isConnected())) throw new Error('Conecte primeiro o Borion ao Google Drive.');
      await GoogleDriveAuth.ensureFreshToken();
      const selected = await openDriveFolderPicker();
      folderId = selected.id;
      const file = await GoogleDriveFS.findChild(folderId, SOURCES[sourceAppId].snapshotFile, 'application/json');
      if(!file) throw new Error(`A pasta escolhida não contém ${SOURCES[sourceAppId].snapshotFile}.`);
    }else throw new Error('Meio de sincronização inválido.');

    // Uma origem só pode apontar para um perfil por vez. Ao trocar o destino,
    // remove a configuração antiga sem tocar nos lançamentos que já viraram nativos.
    (S.profiles || []).forEach(profile => {
      if(String(profile.id) === String(profileId)) return;
      const otherData = profileData(profile.id);
      const otherInterop = ensureInterop(otherData);
      if(otherInterop.sources[sourceAppId]){
        delete otherInterop.sources[sourceAppId];
        saveProfileData(profile.id, otherData);
      }
    });
    const previous = interop.sources[sourceAppId] || {};
    interop.sources[sourceAppId] = ensureSourceConfig(Object.assign({}, previous, {
      sourceAppId, enabled:true, transport, folderId, accountId,
      targetProfileId:profileId, configuredAt:previous.configuredAt || nowIso(),
      reconfiguredAt:previous.configuredAt ? nowIso() : '',
      lastSyncAt:previous.lastSyncAt || '', lastError:'',
      mappingReady:previous.mappingReady === true,
      importMode:'smart-native'
    }));
    saveProfileData(profileId, data);
    uiSourceAppId = sourceAppId;
    uiTab = 'links';
    await inspectSource(sourceAppId, {silent:true});
    if(typeof toast === 'function') toast(`${sourceName(sourceAppId)} conectado. Agora confira e salve os Vínculos.`);
  }

  function accountOptions(profileId){
    const data = profileData(profileId);
    return (data.contas || []).filter(account => account && !account.archivedAt && account.active !== false).map(account => ({id:account.id, name:account.nome || 'Conta'}));
  }
  function setupDialog(sourceAppId, transport){
    const source = SOURCES[sourceAppId];
    const profiles = S.profiles || [];
    if(!profiles.length){ alert('Crie um perfil no Borion antes de configurar a integração.'); return; }
    const initialProfile = S.currentProfile?.id || profiles[0].id;
    const existing = findSourceConfig(sourceAppId);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal-box"><div class="modal-head"><h2>Conectar ${escHtml(source.name)}</h2><button data-close>&times;</button></div><p class="modal-sub">Escolha o perfil que receberá os lançamentos convertidos. A conta abaixo será o destino padrão; depois você poderá criar vínculos diferentes por forma de pagamento.</p><label class="field"><span>Perfil de destino</span><select id="interop_profile">${profiles.map(p => `<option value="${escHtml(p.id)}" ${String(p.id) === String(existing?.profile.id || initialProfile) ? 'selected' : ''}>${escHtml(p.name)}</option>`).join('')}</select></label><label class="field"><span>Conta padrão</span><select id="interop_account"></select><small>Você poderá trocar a conta para cada forma de pagamento na aba Vínculos.</small></label><div class="form-actions"><button class="btn-outline" data-close>Cancelar</button><button class="btn btn-primary" id="interop_connect">Conectar ${transport === 'drive' ? 'Google Drive' : 'pasta local'}</button></div></div>`;
    const root = document.getElementById('modal-root');
    root.replaceChildren(overlay);
    if(typeof attachModalGuard==='function') attachModalGuard(overlay);
    const psel = overlay.querySelector('#interop_profile');
    const asel = overlay.querySelector('#interop_account');
    const refresh = () => {
      const options = accountOptions(psel.value);
      asel.innerHTML = options.map(a => `<option value="${escHtml(a.id)}" ${String(a.id) === String(existing?.config.accountId || '') ? 'selected' : ''}>${escHtml(a.name)}</option>`).join('');
    };
    refresh();
    psel.onchange = refresh;
    overlay.querySelectorAll('[data-close]').forEach(btn => btn.onclick = () => { closeModal(); });
    overlay.querySelector('#interop_connect').onclick = async () => {
      const btn = overlay.querySelector('#interop_connect');
      btn.disabled = true;
      btn.textContent = 'Conectando…';
      try{ await configure(sourceAppId, transport, psel.value, asel.value); closeModal(); }
      catch(error){ alert(error.message || String(error)); btn.disabled = false; btn.textContent = 'Tentar novamente'; }
    };
  }

  function disconnect(sourceAppId){
    const row = findSourceConfig(sourceAppId);
    if(!row) return;
    const confirmText = `Desconectar ${sourceName(sourceAppId)}? Os lançamentos já importados continuarão normalmente no Borion.`;
    const doDisconnect = ()=>{
      delete ensureInterop(row.data).sources[sourceAppId];
      saveProfileData(row.profile.id, row.data);
      if(typeof renderView === 'function') renderView();
    };
    if(typeof openConfirmModal==='function'){
      openConfirmModal({title:'Desconectar integração', text:confirmText, confirmLabel:'Desconectar', cancelLabel:'Cancelar', variant:'danger', onConfirm:doDisconnect});
    } else if(confirm(confirmText)){
      doDisconnect();
    }
  }

  function setSettingsSource(sourceAppId){
    if(!SOURCES[sourceAppId]) return;
    uiSourceAppId = sourceAppId;
    uiTab = 'connection';
    if(typeof renderView === 'function') renderView();
  }
  function setSettingsTab(tab){
    uiTab = tab === 'links' ? 'links' : 'connection';
    if(typeof renderView === 'function') renderView();
  }
  function setDeletionPolicy(sourceAppId, policy){
    const row = findSourceConfig(sourceAppId);
    if(!row) return;
    row.config.deletionPolicy = policy === 'preserve' ? 'preserve' : 'delete';
    saveProfileData(row.profile.id, row.data);
    if(typeof toast === 'function'){
      toast(row.config.deletionPolicy === 'delete'
        ? 'Exclusão automática ativada: lançamentos removidos na origem serão excluídos aqui (exceto os que você já editou).'
        : 'Exclusão automática desativada: lançamentos removidos na origem continuarão preservados aqui.');
    }
    if(typeof renderView === 'function') renderView();
  }
  // V6.44.3 — corte de importação (pedido do usuário): permite dizer "só importe
  // a partir de tal data/agora", pra testes e histórico antigo do aplicativo de
  // origem não virarem lançamento no Borion sozinhos. Nada do que já foi
  // importado antes é afetado — só passa a valer para os próximos lançamentos.
  function setImportCutoff(sourceAppId, dateValue){
    const row = findSourceConfig(sourceAppId);
    if(!row) return false;
    const trimmed = String(dateValue || '').trim();
    if(!trimmed){ return clearImportCutoff(sourceAppId); }
    const parsed = new Date(trimmed.length <= 10 ? trimmed + 'T00:00:00' : trimmed);
    if(isNaN(parsed.getTime())){ if(typeof alert === 'function') alert('Data inválida.'); return false; }
    row.config.importCutoffAt = parsed.toISOString();
    saveProfileData(row.profile.id, row.data);
    if(typeof toast === 'function') toast('A partir de agora, só entram sozinhos lançamentos de ' + sourceName(sourceAppId) + ' a partir de ' + dateText(row.config.importCutoffAt) + '. O que já foi importado antes continua como está.');
    if(typeof renderView === 'function') renderView();
    return true;
  }
  function setImportCutoffNow(sourceAppId){
    const row = findSourceConfig(sourceAppId);
    if(!row) return false;
    row.config.importCutoffAt = nowIso();
    saveProfileData(row.profile.id, row.data);
    if(typeof toast === 'function') toast('Definido: a partir de agora, só entram sozinhos lançamentos novos de ' + sourceName(sourceAppId) + '. Testes e histórico anteriores a agora não serão importados automaticamente.');
    if(typeof renderView === 'function') renderView();
    return true;
  }
  function clearImportCutoff(sourceAppId){
    const row = findSourceConfig(sourceAppId);
    if(!row) return false;
    row.config.importCutoffAt = '';
    saveProfileData(row.profile.id, row.data);
    if(typeof toast === 'function') toast('Corte removido: todo o histórico de ' + sourceName(sourceAppId) + ' volta a valer para importação automática.');
    if(typeof renderView === 'function') renderView();
    return true;
  }

  function transactionTypeOptions(selected){
    const options = [
      ['receita','Receita'], ['variavel','Despesa variável'], ['ignore','Não importar']
    ];
    return options.map(([value,label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
  }
  function statusOptions(selected){
    const options = [
      ['auto','Manter o status enviado pelo aplicativo'], ['paid','Marcar sempre como Pago/Recebido'],
      ['open','Marcar sempre como Em aberto'], ['ignore','Não importar lançamentos com este status']
    ];
    return options.map(([value,label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
  }
  function paymentOptions(selected){
    return FORMAS_PAGAMENTO.map(value => `<option value="${escHtml(value)}" ${selected === value ? 'selected' : ''}>${escHtml(value)}</option>`).join('');
  }
  function financialTargetOptions(data, selected, fallbackForm){
    const selectedValue=String(selected||'__default__');
    const options=[
      ['__default__',fallbackForm==='Dinheiro'?'Automático (Carteira)':'Conta padrão da integração'],
      ['wallet','Carteira']
    ];
    (data.contas||[]).filter(account=>account&&!account.isCarteira&&!account.archivedAt&&account.active!==false).forEach(account=>options.push([`account:${account.id}`,`Conta · ${account.nome||'Sem nome'}`]));
    (data.reservas?.boxes||[]).filter(box=>box&&!box.archivedAt&&box.active!==false).forEach(box=>options.push([`reserve:${box.id}`,`Reserva · ${box.nome||'Sem nome'}${box.banco?' · '+box.banco:''}`]));
    return options.map(([value,label])=>`<option value="${escHtml(value)}" ${selectedValue===String(value)?'selected':''}>${escHtml(label)}</option>`).join('');
  }
  function paymentRuleTarget(rule,form){
    if(rule?.target) return rule.target;
    if(rule?.accountId==='__carteira__') return 'wallet';
    if(rule?.accountId&&rule.accountId!=='__default__') return `account:${rule.accountId}`;
    return '__default__';
  }
  function revenueOriginOptions(selected){
    const options = [
      ['propria','Receita própria'], ['rendimento','Rendimento'],
      ['reembolso','Reembolso recebido'], ['repasse','Repasse de terceiros']
    ];
    return options.map(([value,label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
  }
  function categoryDatalist(data, direction){
    const bucket = direction === 'income' ? 'receita' : 'variavel';
    return (data.categorias?.[bucket] || []).map(value => `<option value="${escHtml(value)}"></option>`).join('');
  }

  const MAPPING_HELP = Object.freeze({
    fields:{
      title:'Dados recebidos do aplicativo',
      summary:'Esta área é apenas uma conferência. Ela mostra uma amostra dos dados que chegaram da Amanda Estética ou do Marco Iris, já traduzidos para uma linguagem simples.',
      steps:['Confira se valor, cliente, data, descrição, forma de pagamento e status fazem sentido.','Nenhum dado é alterado nesta área. Ela serve somente para confirmar que a conexão está lendo o arquivo correto.','Caso os dados estejam antigos, use “Atualizar dados da origem” no final da página.'],
      example:['Valor: R$ 120,00','Cliente: Pedro Henrique Bardella','Status: Pago / Recebido']
    },
    types:{
      title:'Tipos de lançamento',
      summary:'Define em qual grupo do Borion Finance cada entrada ou saída será criada.',
      steps:['Na regra de Entrada, escolha Receita ou Não importar.','Na regra de Saída, escolha Despesa variável ou Não importar.','Quando aparecer um tipo específico, como “Lançamento financeiro”, você pode seguir a regra acima ou criar uma exceção somente para esse tipo.'],
      example:['Entrada / Receita → Receita','Saída / Despesa → Despesa variável','Lançamento financeiro → Seguir a regra de entrada/saída']
    },
    categories:{
      title:'Categorias e origem da receita',
      summary:'Converte a categoria enviada pelo outro aplicativo para a categoria que será usada dentro do Borion Finance.',
      steps:['Veja à esquerda a categoria recebida, por exemplo “Atendimento”.','Digite ou selecione a categoria correspondente do Borion.','Para entradas, escolha também se o dinheiro é Receita própria, Rendimento, Reembolso recebido ou Repasse de terceiros.'],
      example:['Atendimento → Categoria “Atendimento”','Origem da receita → Receita própria']
    },
    payments:{
      title:'Formas de pagamento e destino financeiro',
      summary:'Define como o pagamento será registrado e em qual conta, carteira ou reserva o valor entrará ou sairá.',
      steps:['Confira a forma recebida, como Pix ou Dinheiro.','Escolha a forma de pagamento equivalente no Borion.','Escolha o destino financeiro. “Conta padrão da integração” usa a conta escolhida na aba Conexão.','Dinheiro pode ser direcionado automaticamente para a Carteira; Pix pode ir para uma conta específica.'],
      example:['Dinheiro → Dinheiro → Carteira','Pix → Pix → Conta padrão da integração','Pix → Pix → Conta · Nubank']
    },
    status:{
      title:'Status',
      summary:'Define se o Borion deve respeitar o status recebido ou aplicar uma regra fixa.',
      steps:['“Manter o status enviado” preserva Pago/Recebido ou Em aberto conforme o aplicativo de origem.','“Marcar sempre como Pago/Recebido” força todos os itens desse status como concluídos.','“Marcar sempre como Em aberto” cria o lançamento sem baixa financeira.','“Não importar” ignora lançamentos que chegarem com esse status.'],
      example:['Pago / Recebido → Manter o status enviado pelo aplicativo','Pendente → Marcar sempre como Em aberto']
    },
    mitEntryMethod:{
      title:'Como o valor entra no Borion',
      summary:'A forma recebida no Marco Iris mostra como o cliente pagou. Aqui você escolhe como o valor realmente entrou no seu financeiro.',
      steps:['Use “Manter forma original” para converter Pix em Pix, Dinheiro em Dinheiro, Débito em Débito e qualquer Crédito parcelado em Crédito.','Escolha outra forma quando a liquidação real for diferente da venda.','A forma original e a quantidade de parcelas continuam preservadas para consulta e auditoria.'],
      example:['Crédito 3x no Marco Iris → Pix no Borion','Débito no Marco Iris → Transferência no Borion']
    },
    mitDestination:{
      title:'Onde o valor entra',
      summary:'Escolha se o valor será adicionado à Carteira, a uma conta bancária ou diretamente a uma reserva.',
      steps:['Carteira registra automaticamente como Dinheiro em espécie.','Conta exige a escolha de uma conta ativa do perfil de destino.','Reserva exige uma reserva ativa e usa a conta vinculada a ela.'],
      example:['Pix → Conta · Mercado Pago','Pix → Reserva · Casa','Dinheiro → Carteira']
    },
    mitReceipts:{
      title:'Receitas automáticas do Marco Iris',
      summary:'Cada pagamento confirmado no Marco Iris entra automaticamente no Borion Finance, sem esperar a ordem de serviço inteira ser quitada.',
      steps:['Escolha a categoria do Borion para cada forma recebida.','Dinheiro entra obrigatoriamente na Carteira.','Para Pix, Débito e Crédito, escolha a conta ou reserva de destino.','Salve a configuração. Os próximos recebimentos serão importados automaticamente e sem duplicidade.'],
      example:['Pix → Serviços Marco Iris → Conta · Nubank','Dinheiro → Serviços Marco Iris → Carteira']
    },
    mitExpenses:{
      title:'Despesas aguardando revisão',
      summary:'Despesas do Marco Iris nunca entram automaticamente. Elas ficam nesta lista até você revisar e confirmar.',
      steps:['Clique em Revisar na despesa desejada.','Confira nome, local da compra, categoria, valor e data.','Escolha se é despesa variável ou fixa, de onde será paga e o status.','Clique em Importar. Somente então a despesa será criada no Borion Finance.'],
      example:['Peça comprada → Despesa variável → Categoria “Manutenção” → Conta · Nubank']
    }
  });
  function interopSectionHeading(title, helpTopic, helpLabel=title){
    return `<div class="interop-section-title"><h5>${escHtml(title)}</h5><button type="button" class="interop-help-btn" onclick="BorionInterop.openMappingHelp('${escHtml(helpTopic)}')" aria-label="Ajuda sobre ${escHtml(helpLabel)}" title="Ver explicação e exemplos">?</button></div>`;
  }
  function openMappingHelp(topic){
    const content=MAPPING_HELP[topic];
    const root=document.getElementById('modal-root');
    if(!content||!root) return false;
    const close=()=>{ if(typeof closeModal==='function') closeModal(); else root.replaceChildren(); };
    const overlay=document.createElement('div');
    const titleId=`interop-help-${String(topic).replace(/[^a-z0-9_-]/gi,'')}`;
    overlay.className='modal-overlay interop-help-overlay';
    overlay.innerHTML=`<div class="modal-box interop-help-modal" role="dialog" aria-modal="true" aria-labelledby="${titleId}"><div class="modal-head"><div><span class="interop-help-kicker">Central de ajuda da integração</span><h2 id="${titleId}">${escHtml(content.title)}</h2></div><button type="button" data-close aria-label="Fechar">&times;</button></div><p class="modal-sub">${escHtml(content.summary)}</p><div class="interop-help-steps"><h3>Passo a passo</h3><ol>${content.steps.map(step=>`<li>${escHtml(step)}</li>`).join('')}</ol></div><div class="interop-help-example"><strong>Exemplo prático</strong>${content.example.map(line=>`<span>${escHtml(line)}</span>`).join('')}</div><div class="form-actions"><button type="button" class="btn btn-primary" data-close>Entendi</button></div></div>`;
    root.replaceChildren(overlay);
    if(typeof attachModalGuard==='function') attachModalGuard(overlay);
    overlay.querySelectorAll('[data-close]').forEach(button=>button.onclick=close);
    return true;
  }

  function renderConnectionTab(sourceAppId, row){
    const source = SOURCES[sourceAppId];
    if(!row){
      const intro=sourceAppId==='marco-iris'?'Conecte a pasta gerada pelo Marco Iris Tecnologia. Depois configure as categorias e os destinos das receitas; despesas sempre exigirão revisão.':'Conecte a pasta gerada pelo aplicativo. Nenhum lançamento será importado antes de você revisar e salvar os Vínculos.';
      return `<div class="interop-pane"><div class="interop-empty"><div class="interop-empty-icon">⇄</div><h4>${escHtml(source.name)} ainda não está conectado</h4><p>${intro}</p><div class="interop-actions"><button class="btn-outline btn-sm" onclick="BorionInterop.setupDialog('${sourceAppId}','local')">Conectar pasta local</button><button class="btn btn-primary btn-sm" onclick="BorionInterop.setupDialog('${sourceAppId}','drive')">Conectar Google Drive</button></div></div></div>`;
    }
    const c = row.config;
    if(sourceAppId==='marco-iris'){
      const r=c.lastResult||{},pending=(ensureInterop(row.data).pending||[]).filter(item=>item.sourceAppId==='marco-iris').length;
      const setup=c.mappingReady?'<span class="pill ok">Receitas configuradas</span>':'<span class="pill warn">Configuração pendente</span>';
      return `<div class="interop-pane"><div class="interop-status-grid"><div><span>Perfil de destino</span><strong>${escHtml(row.profile.name)}</strong></div><div><span>Conta padrão</span><strong>${escHtml(accountName(row.data,c.accountId)||'Carteira')}</strong></div><div><span>Meio</span><strong>${c.transport==='drive'?'Google Drive':'Pasta local'}</strong></div><div><span>Automação</span><strong>${setup}</strong></div></div><div class="gold-box interop-sync-box"><b>Última sincronização:</b> ${escHtml(dateText(c.lastSyncAt))}<br><span>${Number(r.created||0)} receita(s) nova(s) · ${Number(r.unchanged||0)} já processado(s) · ${pending} despesa(s) aguardando revisão</span>${c.lastError?`<br><b>Erro:</b> ${escHtml(c.lastError)}`:''}</div><div class="info-box"><b>Regra ativa:</b> cada pagamento com Data de Pagamento entra automaticamente. Despesas nunca entram sem revisão.</div><div class="interop-actions"><button class="btn btn-primary btn-sm" onclick="BorionInterop.syncSource('marco-iris')" ${c.mappingReady?'':'disabled title="Configure as receitas primeiro"'}>Sincronizar agora</button><button class="btn-outline btn-sm" onclick="BorionInterop.setSettingsTab('links')">Configurar receitas e revisar despesas</button><button class="btn-outline btn-sm" onclick="BorionInterop.setupDialog('marco-iris','${c.transport}')">Reconfigurar conexão</button><button class="btn-outline btn-sm" onclick="BorionInterop.disconnect('marco-iris')">Desconectar</button></div>${!c.mappingReady?'<div class="interop-next-step"><b>Próximo passo:</b> abra <b>Receitas e despesas</b>, selecione categorias e destinos e salve.</div>':''}</div>`;
    }
    const r = c.lastResult || {};
    const mappingLabel = c.mappingReady ? '<span class="pill ok">Vínculos configurados</span>' : '<span class="pill warn">Vínculos pendentes</span>';
    const deletionOn = c.deletionPolicy !== 'preserve';
    return `<div class="interop-pane"><div class="interop-status-grid"><div><span>Perfil de destino</span><strong>${escHtml(row.profile.name)}</strong></div><div><span>Conta padrão</span><strong>${escHtml(accountName(row.data, c.accountId) || 'Carteira')}</strong></div><div><span>Meio</span><strong>${c.transport === 'drive' ? 'Google Drive' : 'Pasta local'}</strong></div><div><span>Mapeamento</span><strong>${mappingLabel}</strong></div></div><div class="gold-box interop-sync-box"><b>Última sincronização:</b> ${escHtml(dateText(c.lastSyncAt))}<br><span>${Number(r.created || 0)} novo(s) · ${Number(r.deleted || 0)} excluído(s) · ${Number(r.unchanged || 0)} já importado(s) · ${Number(r.waiting || 0)} aguardando · ${Number(r.ignored || 0)} ignorado(s)</span>${c.lastError ? `<br><b>Erro:</b> ${escHtml(c.lastError)}` : ''}</div><label class="interop-deletion-toggle"><input type="checkbox" ${deletionOn ? 'checked' : ''} onchange="BorionInterop.setDeletionPolicy('${sourceAppId}', this.checked ? 'delete' : 'preserve')"><span><b>Excluir aqui automaticamente</b> quando o lançamento for removido na origem<br><small>Lançamentos que você já editou manualmente no Borion (categoria, valor, conta...) nunca são excluídos automaticamente, mesmo com isto ligado.</small></span></label><div class="interop-actions"><button class="btn btn-primary btn-sm" onclick="BorionInterop.syncSource('${sourceAppId}')" ${c.mappingReady ? '' : 'disabled title="Configure os Vínculos primeiro"'}>Sincronizar agora</button><button class="btn-outline btn-sm" onclick="BorionInterop.inspectSource('${sourceAppId}')">Ler campos da origem</button><button class="btn-outline btn-sm" onclick="BorionInterop.setupDialog('${sourceAppId}','${c.transport}')">Reconfigurar conexão</button><button class="btn-outline btn-sm" onclick="BorionInterop.disconnect('${sourceAppId}')">Desconectar</button></div>${!c.mappingReady ? '<div class="interop-next-step"><b>Próximo passo:</b> abra a aba <b>Vínculos</b>, confira as conversões e salve. Só depois os lançamentos serão importados.</div>' : ''}</div>`;
  }

  function renderLinksTab(sourceAppId, row){
    if(!row){
      return `<div class="interop-pane"><div class="interop-empty"><h4>Conecte o aplicativo primeiro</h4><p>Os dados reais da origem precisam ser lidos antes que os vínculos possam ser configurados.</p><button class="btn btn-primary btn-sm" onclick="BorionInterop.setSettingsTab('connection')">Ir para Conexão</button></div></div>`;
    }
    const c=row.config,d=normalizeDiscovered(c.discovered),m=normalizeMappings(c.mappings);
    const hasFields=d.categories.length||d.paymentMethods.length||d.statuses.length||d.transactionKinds.length||d.directions.length||d.fields.length;
    if(!hasFields) return `<div class="interop-pane"><div class="interop-empty"><h4>Nenhum dado da origem foi lido</h4><p>Use o botão abaixo para analisar o arquivo atual sem importar lançamentos.</p><button class="btn btn-primary btn-sm" onclick="BorionInterop.inspectSource('${sourceAppId}')">Ler dados da origem</button></div></div>`;
    const sourceDisplay=item=>`<strong>${escHtml(friendlySourceValue(item.label||item.value,item.field))}</strong>`;
    const directionRows=(d.directions.length?d.directions:['income','expense']).map(direction=>{
      const target=m.directions[direction]||(direction==='income'?'receita':'variavel');
      return `<div class="interop-map-row"><div class="interop-source-value"><small>Movimento recebido</small><strong>${escHtml(friendlyDirection(direction))}</strong></div><div class="interop-arrow" aria-hidden="true">→</div><label><small>Como será salvo no Borion</small><select data-interop-direction="${direction}">${transactionTypeOptions(target)}</select></label></div>`;
    }).join('');
    const kindRows=d.transactionKinds.map(item=>{
      const mapId=`${item.direction}:${item.key}`,target=m.transactionKinds[mapId]||'';
      return `<div class="interop-map-row"><div class="interop-source-value"><small>${escHtml(sourceContextLabel(item.field||'recordType'))}</small>${sourceDisplay(item)}</div><div class="interop-arrow" aria-hidden="true">→</div><label><small>Regra para este tipo no Borion</small><select data-interop-kind="${escHtml(mapId)}"><option value="" ${!target?'selected':''}>Seguir a regra de entrada/saída definida acima</option>${transactionTypeOptions(target)}</select></label></div>`;
    }).join('');
    const categoryRows=d.categories.map(item=>{
      const target=m.categories?.[item.direction]?.[item.key]||item.label||item.value||'Outro';
      return `<div class="interop-map-row interop-map-row-category"><div class="interop-source-value"><small>Categoria recebida</small>${sourceDisplay(item)}</div><div class="interop-arrow" aria-hidden="true">→</div><label><small>Categoria no Borion</small><input type="text" list="interop-cat-${item.direction}" value="${escHtml(target)}" data-interop-category data-direction="${item.direction}" data-key="${escHtml(item.key)}" placeholder="Escolha ou digite uma categoria"></label>${item.direction==='income'?`<label><small>Origem da receita no Borion</small><select data-interop-revenue-origin data-key="${escHtml(item.key)}">${revenueOriginOptions(m.revenueOrigins[item.key]||inferRevenueOrigin(item.value))}</select></label>`:''}</div>`;
    }).join('');
    const paymentRows=d.paymentMethods.map(item=>{
      const mapId=`${item.direction}:${item.key}`,rule=m.paymentMethods[mapId]||m.paymentMethods[item.key]||{},form=FORMAS_PAGAMENTO.includes(rule.form)?rule.form:paymentForm(item.value),target=paymentRuleTarget(rule,form);
      return `<div class="interop-map-row interop-map-row-payment"><div class="interop-source-value"><small>${escHtml(sourceContextLabel(item.field||'paymentMethod',item.direction))}</small>${sourceDisplay(item)}</div><div class="interop-arrow" aria-hidden="true">→</div><label><small>Forma de pagamento no Borion</small><select data-interop-payment-form data-key="${escHtml(mapId)}">${paymentOptions(form)}</select></label><label><small>Conta, carteira ou reserva de destino</small><select data-interop-payment-target data-key="${escHtml(mapId)}">${financialTargetOptions(row.data,target,form)}</select></label></div>`;
    }).join('');
    const statusRows=d.statuses.map(item=>{
      const mapId=`${item.direction}:${item.key}`,target=m.statuses[mapId]||m.statuses[item.key]||'auto';
      return `<div class="interop-map-row"><div class="interop-source-value"><small>${escHtml(sourceContextLabel(item.field||'status',item.direction))}</small>${sourceDisplay(item)}</div><div class="interop-arrow" aria-hidden="true">→</div><label><small>Regra de status no Borion</small><select data-interop-status data-key="${escHtml(mapId)}">${statusOptions(target)}</select></label></div>`;
    }).join('');
    const fieldRows=d.fields.map(item=>`<div class="interop-field-preview"><div><small>Informação</small><strong>${escHtml(friendlyFieldName(item.sourceName))}</strong></div><div><small>Exemplo recebido</small><span>${escHtml(friendlySourceValue(item.sample,item.sourceName))}</span></div></div>`).join('');
    return `<div class="interop-pane interop-links-pane"><div class="interop-links-intro"><div><h4>Configuração da integração com ${escHtml(sourceName(sourceAppId))}</h4><p>Confira o que chega do aplicativo e escolha, à direita, como cada informação será registrada no Borion Finance. As regras são usadas na primeira importação de cada lançamento.</p></div><span class="pill ${c.mappingReady?'ok':'warn'}">${c.mappingReady?'Configurado':'Revisão necessária'}</span></div><div class="interop-map-legend"><div class="origin"><small>ORIGEM</small><b>${escHtml(sourceName(sourceAppId))}</b><span>Dados enviados pelo aplicativo, exibidos em linguagem simples.</span></div><div class="destination"><small>DESTINO</small><b>Borion Finance</b><span>Como o lançamento será salvo: tipo, categoria, status, forma e destino financeiro.</span></div></div>${importCutoffControlHTML(sourceAppId,c)}<datalist id="interop-cat-income">${categoryDatalist(row.data,'income')}</datalist><datalist id="interop-cat-expense">${categoryDatalist(row.data,'expense')}</datalist><section class="interop-map-section">${interopSectionHeading('Dados recebidos do aplicativo','fields')}<p>Somente leitura. Use esta amostra para confirmar que a conexão está trazendo as informações corretas.</p><div class="interop-field-grid">${fieldRows||'<div class="interop-map-empty">Nenhuma informação adicional identificada.</div>'}</div></section><section class="interop-map-section">${interopSectionHeading('Tipos de lançamento','types')}<p>Escolha se cada entrada ou saída será uma receita, uma despesa variável ou não será importada.</p>${directionRows}${kindRows}</section><section class="interop-map-section">${interopSectionHeading('Categorias e origem da receita','categories')}<p>Associe cada categoria recebida à categoria correspondente do Borion e defina a origem das receitas.</p>${categoryRows||'<div class="interop-map-empty">Nenhuma categoria encontrada.</div>'}</section><section class="interop-map-section">${interopSectionHeading('Formas de pagamento e destino financeiro','payments')}<p>Defina a forma usada no Borion e em qual conta, carteira ou reserva o valor será registrado.</p>${paymentRows||'<div class="interop-map-empty">Nenhuma forma de pagamento encontrada.</div>'}</section><section class="interop-map-section">${interopSectionHeading('Status','status')}<p>Escolha se o Borion deve manter o status recebido, forçar um status ou ignorar o lançamento.</p>${statusRows||'<div class="interop-map-empty">Nenhum status encontrado.</div>'}</section><div class="interop-save-bar"><button class="btn-outline btn-sm" onclick="BorionInterop.inspectSource('${sourceAppId}')">Atualizar dados da origem</button><button class="btn btn-primary" onclick="BorionInterop.saveMappings('${sourceAppId}')">Salvar opções</button><button class="btn-outline" onclick="BorionInterop.syncSource('${sourceAppId}')" ${c.mappingReady?'':'disabled title="Salve as opções antes de sincronizar"'}>Sincronizar agora</button></div></div>`;
  }

  function mitCategoryOptions(data,selected){
    const categories=Array.isArray(data.categorias?.receita)?data.categorias.receita:[];
    const missing=selected&&!categories.includes(selected)?`<option value="" selected disabled>Categoria removida — escolha outra</option>`:'';
    const placeholder=!selected?'<option value="" selected disabled>Escolha uma categoria</option>':'';
    return placeholder+missing+categories.map(category=>`<option value="${escHtml(category)}" ${selected===category?'selected':''}>${escHtml(category)}</option>`).join('');
  }
  function mitEntryMethodOptions(rule){
    const selected=rule.entryMethodMode==='custom'?`custom:${rule.entryMethod}`:'original';
    const options=[['original','Manter forma original'],...MIT_ENTRY_METHODS.map(method=>[`custom:${method}`,method])];
    const missing=!options.some(([value])=>value===selected)?`<option value="" selected disabled>Forma removida — escolha outra</option>`:'';
    return missing+options.map(([value,label])=>`<option value="${escHtml(value)}" ${selected===value?'selected':''}>${escHtml(label)}</option>`).join('');
  }
  function mitAccountOptions(data,selected){
    const accounts=(data.contas||[]).filter(account=>mitAccountActive(account)&&!mitWalletAccount(account));
    const missing=selected&&!accounts.some(account=>String(account.id)===String(selected))?'<option value="" selected disabled>Conta removida — escolha outra</option>':'';
    const placeholder=!selected?'<option value="" selected disabled>Escolha uma conta</option>':'';
    return placeholder+missing+accounts.map(account=>`<option value="${escHtml(account.id)}" ${String(account.id)===String(selected)?'selected':''}>${escHtml(account.nome||'Conta sem nome')}</option>`).join('');
  }
  function mitReserveOptions(data,selected){
    const reserves=(data.reservas?.boxes||[]).filter(reserve=>mitReserveActive(reserve)&&mitReserveLinkedAccount(data,reserve));
    const missing=selected&&!reserves.some(reserve=>String(reserve.id)===String(selected))?'<option value="" selected disabled>Reserva removida — escolha outra</option>':'';
    const placeholder=!selected?'<option value="" selected disabled>Escolha uma reserva</option>':'';
    return placeholder+missing+reserves.map(reserve=>`<option value="${escHtml(reserve.id)}" ${String(reserve.id)===String(selected)?'selected':''}>${escHtml((reserve.nome||'Reserva sem nome')+(reserve.banco?' — '+reserve.banco:''))}</option>`).join('');
  }
  function setMitDestination(button,key){
    const row=button?.closest?.(`[data-mit-rule="${key}"]`)||button?.closest?.('[data-mit-rule]');
    if(!row||button.disabled||button.getAttribute('aria-disabled')==='true') return false;
    const kind=button.dataset.value,hidden=row.querySelector('[data-mit-destination-kind]'),entry=row.querySelector('[data-mit-entry-selection]');
    const previous=hidden?.value;
    row.querySelectorAll('[data-mit-destination-button]').forEach(item=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active));});
    if(hidden) hidden.value=kind;
    row.querySelectorAll('[data-mit-destination-panel]').forEach(panel=>panel.classList.toggle('hidden',panel.dataset.mitDestinationPanel!==kind));
    const walletNote=row.querySelector('[data-mit-wallet-note]'); if(walletNote) walletNote.classList.toggle('hidden',kind!=='wallet');
    if(entry){
      if(kind==='wallet'){
        if(previous!=='wallet'&&entry.value!=='custom:Dinheiro') row.dataset.previousEntrySelection=entry.value||'original';
        entry.value='custom:Dinheiro';entry.disabled=true;entry.setAttribute('aria-disabled','true');
      }else{
        entry.disabled=false;entry.setAttribute('aria-disabled','false');
        if(previous==='wallet') entry.value=row.dataset.previousEntrySelection||'original';
      }
    }
    return true;
  }
  function rememberMitEntryMethod(select){
    const row=select?.closest?.('[data-mit-rule]');
    if(row&&select.value) row.dataset.previousEntrySelection=select.value;
    return true;
  }
  function renderMitLinksTab(row){
    if(!row) return `<div class="interop-pane"><div class="interop-empty"><h4>Conecte o Marco Iris Tecnologia primeiro</h4><button class="btn btn-primary btn-sm" onclick="BorionInterop.setSettingsTab('connection')">Ir para Conexão</button></div></div>`;
    const rules=normalizeMitRevenueRules(row.config.mitRevenueRules,row.config);
    const pending=(ensureInterop(row.data).pending||[]).filter(item=>item.sourceAppId==='marco-iris');
    const reservesEnabled=mitReservesEnabled(row.data),validReserves=(row.data.reservas?.boxes||[]).filter(reserve=>mitReserveActive(reserve)&&mitReserveLinkedAccount(row.data,reserve));
    const revenueRows=MIT_REVENUE_METHODS.map(method=>{
      const rule=rules[method.key],kind=rule.destinationKind||'account',wallet=kind==='wallet';
      const reserveDisabled=!reservesEnabled||!validReserves.length;
      const walletNote=wallet?'':'hidden';
      return `<div class="mit-rule-row" data-mit-rule="${escHtml(method.key)}" data-previous-entry-selection="${escHtml(rule.entryMethodMode==='custom'?`custom:${rule.entryMethod}`:'original')}">
        <div class="mit-origin"><small>Forma recebida do Marco Iris</small><strong>${escHtml(method.label)}</strong><span>Somente leitura</span></div>
        <label><small>Categoria de receita no Borion</small><select data-mit-category="${escHtml(method.key)}">${mitCategoryOptions(row.data,rule.category)}</select></label>
        <label><span class="mit-field-label"><small>Como o valor entra no Borion</small><button type="button" class="interop-help-btn mit-inline-help" onclick="BorionInterop.openMappingHelp('mitEntryMethod')" aria-label="Ajuda sobre como o valor entra no Borion" title="Ver explicação">?</button></span><select data-mit-entry-selection="${escHtml(method.key)}" onchange="BorionInterop.rememberMitEntryMethod(this)" ${wallet?'disabled aria-disabled="true"':''}>${mitEntryMethodOptions(rule)}</select><span class="mit-wallet-note ${walletNote}" data-mit-wallet-note>Entradas na Carteira são registradas automaticamente como dinheiro em espécie.</span></label>
        <div class="mit-destination-field"><span class="mit-field-label"><small>Onde o valor entra</small><button type="button" class="interop-help-btn mit-inline-help" onclick="BorionInterop.openMappingHelp('mitDestination')" aria-label="Ajuda sobre onde o valor entra" title="Ver explicação">?</button></span><div class="segmented-toggle revenue-destination-toggle mit-destination-toggle" role="group" aria-label="Onde o valor de ${escHtml(method.label)} entra"><button type="button" class="seg-btn ${kind==='wallet'?'active':''}" data-mit-destination-button data-value="wallet" aria-pressed="${kind==='wallet'}" onclick="BorionInterop.setMitDestination(this,'${escHtml(method.key)}')">Carteira</button><button type="button" class="seg-btn ${kind==='account'?'active':''}" data-mit-destination-button data-value="account" aria-pressed="${kind==='account'}" onclick="BorionInterop.setMitDestination(this,'${escHtml(method.key)}')">Conta</button><button type="button" class="seg-btn ${kind==='reserve'?'active':''}" data-mit-destination-button data-value="reserve" aria-pressed="${kind==='reserve'}" aria-disabled="${reserveDisabled}" ${reserveDisabled?'disabled':''} title="${!reservesEnabled?'Ative o módulo de Reservas':(!validReserves.length?'Crie uma reserva primeiro':'') }" onclick="BorionInterop.setMitDestination(this,'${escHtml(method.key)}')">Reserva</button></div><input type="hidden" data-mit-destination-kind="${escHtml(method.key)}" value="${escHtml(kind)}">${!reservesEnabled?'<span class="mit-destination-warning">Reservas estão desativadas. Configurações antigas são preservadas, mas não podem ser salvas até o módulo ser ativado.</span>':(!validReserves.length?'<span class="mit-destination-warning">Crie uma reserva primeiro para usar este destino.</span>':'')}</div>
        <div class="mit-specific-destination"><div class="payment-source-panel ${kind==='account'?'':'hidden'}" data-mit-destination-panel="account"><label><small>Conta que receberá</small><select data-mit-account="${escHtml(method.key)}">${mitAccountOptions(row.data,rule.accountId)}</select></label></div><div class="payment-source-panel ${kind==='reserve'?'':'hidden'}" data-mit-destination-panel="reserve"><label><small>Reserva que receberá</small><select data-mit-reserve="${escHtml(method.key)}">${mitReserveOptions(row.data,rule.reserveId)}</select></label></div><div class="payment-source-panel mit-wallet-panel ${kind==='wallet'?'':'hidden'}" data-mit-destination-panel="wallet"><strong>Carteira</strong><span>Conta fixa: dinheiro em espécie</span></div></div>
      </div>`;
    }).join('');
    const pendingRows=pending.length?pending.map(item=>`<div class="mit-pending-row"><div><strong>${escHtml(item.name||item.description)}</strong><small>${escHtml(item.localPurchase||'Sem local informado')}</small></div><span>${typeof brl==='function'?brl(Number(item.amount)||0):('R$ '+(Number(item.amount)||0).toFixed(2).replace('.',','))}</span><span>${escHtml(item.date||'')}</span><span>Marco Iris</span><span class="pill ${item.status==='Pago'?'ok':'warn'}">${escHtml(item.status||'Em aberto')}</span><button class="btn btn-primary btn-sm" onclick="BorionInterop.openMitExpenseImport('${escHtml(item.aggregateId)}')">Revisar</button></div>`).join(''):'<div class="interop-map-empty">Nenhuma despesa aguardando revisão.</div>';
    return `<div class="interop-pane mit-integration-pane"><div class="interop-links-intro"><div><h4>Receitas automáticas e despesas revisadas</h4><p>Pagamentos confirmados no Marco Iris entram automaticamente. Despesas só entram depois da sua revisão.</p></div><span class="pill ${row.config.mappingReady?'ok':'warn'}">${row.config.mappingReady?'Configurado':'Configuração necessária'}</span></div><div class="interop-map-legend"><div class="origin"><small>ORIGEM</small><b>Marco Iris Tecnologia</b><span>Forma recebida, parcelas, OSV, cliente e referência original.</span></div><div class="destination"><small>DESTINO</small><b>Borion Finance</b><span>Categoria, forma financeira efetiva e destino escolhidos por você.</span></div></div>${importCutoffControlHTML('marco-iris',row.config)}<section class="interop-map-section">${interopSectionHeading('Como as receitas serão registradas no Borion','mitReceipts','receitas automáticas do Marco Iris')}<p>Escolha a categoria, como o valor realmente entra no Borion e onde ele será adicionado. A forma original recebida no Marco Iris será preservada para consulta e auditoria.</p><div class="mit-rules-list">${revenueRows}</div><div class="interop-save-bar"><button class="btn-outline btn-sm" onclick="BorionInterop.inspectSource('marco-iris')">Atualizar dados da origem</button><button class="btn btn-primary" onclick="BorionInterop.saveMitSettings()">Salvar opções</button><button class="btn-outline" onclick="BorionInterop.syncSource('marco-iris')" ${row.config.mappingReady?'':'disabled title="Salve as opções antes de sincronizar"'}>Sincronizar agora</button></div></section><section class="interop-map-section"><div class="mit-pending-head"><div>${interopSectionHeading('Aguardando Revisão','mitExpenses','despesas aguardando revisão')}<p>Despesas nunca entram automaticamente. Revise categoria, origem financeira, tipo e status.</p></div><span class="pill ${pending.length?'warn':'ok'}">${pending.length} pendente(s)</span></div><div class="mit-pending-labels"><span>Nome</span><span>Valor</span><span>Data</span><span>Origem</span><span>Status</span><span></span></div><div class="mit-pending-list">${pendingRows}</div></section></div>`;
  }
  async function saveMitSettings({sync=false}={}){
    const row=findSourceConfig('marco-iris');
    if(!row) throw new Error('Integração com o Marco Iris não configurada.');
    const draft=normalizeMitRevenueRules(row.config.mitRevenueRules,row.config);
    document.querySelectorAll('[data-mit-rule]').forEach(ruleRow=>{
      const key=ruleRow.dataset.mitRule,rule=draft[key]; if(!rule) return;
      rule.category=String(ruleRow.querySelector('[data-mit-category]')?.value||'').trim();
      const entrySelection=String(ruleRow.querySelector('[data-mit-entry-selection]')?.value||'');
      if(entrySelection==='original'){rule.entryMethodMode='original';rule.entryMethod=null;}
      else if(entrySelection.startsWith('custom:')){rule.entryMethodMode='custom';rule.entryMethod=entrySelection.slice(7);}
      else {rule.entryMethodMode='';rule.entryMethod=null;}
      rule.destinationKind=String(ruleRow.querySelector('[data-mit-destination-kind]')?.value||'');
      if(rule.destinationKind==='wallet'){
        rule.entryMethodMode='custom';rule.entryMethod='Dinheiro';rule.accountId=CARTEIRA_CONTA_ID;rule.reserveId=null;rule.target='wallet';
      }else if(rule.destinationKind==='account'){
        rule.accountId=String(ruleRow.querySelector('[data-mit-account]')?.value||'')||null;rule.reserveId=null;rule.target=rule.accountId?`account:${rule.accountId}`:'__default__';
      }else if(rule.destinationKind==='reserve'){
        rule.reserveId=String(ruleRow.querySelector('[data-mit-reserve]')?.value||'')||null;rule.accountId=null;rule.target=rule.reserveId?`reserve:${rule.reserveId}`:'reserve:';
      }
    });
    const candidate=Object.assign({},row.config,{mitRevenueRules:draft});
    const validated=validateMitRevenueRules(row.data,candidate,draft);
    row.config.mitRevenueRules=validated;row.config.mappingReady=true;row.config.mappingSavedAt=nowIso();
    saveProfileData(row.profile.id,row.data);
    if(typeof toast==='function') toast('Opções salvas. Esta configuração continuará igual depois de sair e entrar novamente.');
    if(sync) return await syncSource('marco-iris',{silent:false});
    if(typeof renderView==='function') renderView();
    return true;
  }
  function mitExpenseIntegrationMeta(item){
    const record=item.record||{};
    return {
      integrationImported:true,integrationManaged:false,integrationImportMode:'native-assisted',
      integrationAggregateId:item.aggregateId,integrationSourceAppId:'marco-iris',integrationEntityId:item.entityId,
      integrationExpenseId:item.entityId,integrationImportedAt:nowIso(),integrationExternalReference:item.externalReference||record.externalReference||'',
      integrationOriginalStatus:item.status||record.status||'',integrationOriginalPaymentMethod:item.paymentMethod||record.paymentMethod||'',
      integrationOriginalSourceValues:clone(sourceBag(record)),integrationMappingVersion:SPEC.mappingVersion
    };
  }
  function ensureMitExpenseCategory(data,type,category){
    data.categorias ||= defaultCategories();
    const bucket=type==='fixa'?'fixa':'variavel';
    data.categorias[bucket]=Array.isArray(data.categorias[bucket])?data.categorias[bucket]:[];
    const value=String(category||'Outro').trim()||'Outro';
    if(!data.categorias[bucket].includes(value)) data.categorias[bucket].push(value);
    data.categoryColors ||= {receita:{},fixa:{},variavel:{}}; data.categoryColors[bucket] ||= {};
    if(!data.categoryColors[bucket][value]) data.categoryColors[bucket][value]=baseCatColor(value);
    return value;
  }
  function completeMitExpenseImport(row,item,borionId){
    const interop=ensureInterop(row.data),mitState=ensureMitState(row.data),state=importedState(row.data,'marco-iris');
    mitState.expenses[String(item.entityId)]={borionId:borionId||'',aggregateId:item.aggregateId,importedAt:nowIso()};
    state.records[item.aggregateId]=Object.assign({},state.records[item.aggregateId]||{},{status:'imported',entityId:item.entityId,txId:borionId||'',importedAt:mitState.expenses[String(item.entityId)].importedAt});
    interop.pending=(interop.pending||[]).filter(pending=>!(pending.sourceAppId==='marco-iris'&&pending.aggregateId===item.aggregateId));
    saveProfileData(row.profile.id,row.data);
    if(S.currentProfile&&String(S.currentProfile.id)===String(row.profile.id)) saveCurrentData();
  }
  function openMitExpenseImport(aggregateId){
    const row=findSourceConfig('marco-iris');
    if(!row) return;
    if(!S.currentProfile||String(S.currentProfile.id)!==String(row.profile.id)){ if(typeof toast==='function')toast('Abra o perfil '+row.profile.name+' para revisar esta despesa.'); return; }
    const item=(ensureInterop(row.data).pending||[]).find(pending=>pending.sourceAppId==='marco-iris'&&pending.aggregateId===aggregateId);
    if(!item){ if(typeof toast==='function') toast('Esta despesa não está mais aguardando revisão.'); return; }
    const data=row.data,accounts=(data.contas||[]).filter(a=>a&&!a.archivedAt&&a.active!==false),reserves=(data.reservas?.boxes||[]).filter(r=>r&&!r.archivedAt&&r.active!==false),cards=(data.cartoes||[]).filter(c=>c&&!c.archivedAt&&c.active!==false);
    const initialStatus=item.status==='Pago'?'Pago':'Em aberto';
    const root=document.getElementById('modal-root'),overlay=document.createElement('div'); overlay.className='modal-overlay transaction-modal-overlay';
    overlay.innerHTML=`<div class="modal-box transaction-modal mit-expense-modal"><div class="modal-head"><h2>Importar Despesa</h2><button data-close>&times;</button></div><p class="modal-sub">Revise os dados recebidos do Marco Iris. A despesa só será criada após clicar em Importar.</p><div class="field"><label>Tipo</label><div class="segmented-toggle" id="mit_exp_type_group"><button type="button" class="seg-btn active" data-value="variavel">Despesa Variável</button><button type="button" class="seg-btn" data-value="fixa">Despesa Fixa</button></div><input type="hidden" id="mit_exp_type" value="variavel"></div><div class="field"><label>Nome</label><input id="mit_exp_name" value="${escHtml(item.name||item.description||'Despesa do Marco Iris')}"></div><div class="field"><label>Local da Compra</label><input id="mit_exp_local" value="${escHtml(item.localPurchase||'')}"></div><div class="field"><label>Categoria</label><input id="mit_exp_category" list="mit-exp-categories" value=""><datalist id="mit-exp-categories">${[...(data.categorias?.variavel||[]),...(data.categorias?.fixa||[])].filter((v,i,a)=>a.indexOf(v)===i).map(v=>`<option value="${escHtml(v)}"></option>`).join('')}</datalist></div><div class="field"><label>Valor</label><input id="mit_exp_value" type="number" min="0.01" step="0.01" value="${Number(item.amount)||0}"></div><div class="field"><label>Data</label><input id="mit_exp_date" type="date" value="${escHtml(item.date||todayISO())}"></div><div class="field"><label>De onde será pago</label><div class="segmented-toggle payment-source-toggle" id="mit_exp_source_group"><button type="button" class="seg-btn active" data-value="carteira">Carteira</button><button type="button" class="seg-btn" data-value="conta">Conta</button><button type="button" class="seg-btn" data-value="reserva" ${reserves.length?'':'disabled'}>Reserva</button><button type="button" class="seg-btn" data-value="credito" ${cards.length?'':'disabled'}>Crédito</button></div><input type="hidden" id="mit_exp_source" value="carteira"></div><div id="mit_exp_account_panel" class="payment-source-panel hidden"><div class="field"><label>Conta</label><select id="mit_exp_account">${accounts.filter(a=>!a.isCarteira).map(a=>`<option value="${escHtml(a.id)}">${escHtml(a.nome||'Conta')}</option>`).join('')}</select></div><div class="field"><label>Forma</label><select id="mit_exp_account_form"><option>Pix</option><option>Débito</option></select></div></div><div id="mit_exp_reserve_panel" class="payment-source-panel hidden"><div class="field"><label>Reserva</label><select id="mit_exp_reserve">${reserves.map(r=>`<option value="${escHtml(r.id)}">${escHtml(r.nome||'Reserva')}</option>`).join('')}</select></div></div><div id="mit_exp_credit_panel" class="payment-source-panel hidden"><div class="field"><label>Cartão de crédito</label><select id="mit_exp_card">${cards.map(c=>`<option value="${escHtml(c.id)}">${escHtml(c.banco||c.nome||'Cartão')}</option>`).join('')}</select></div></div><div class="field"><label>Status deste mês</label><div class="segmented-toggle" id="mit_exp_status_group"><button type="button" class="seg-btn ${initialStatus==='Pago'?'active':''}" data-value="Pago">Pago</button><button type="button" class="seg-btn ${initialStatus==='Em aberto'?'active':''}" data-value="Em aberto">Em Aberto</button></div><input type="hidden" id="mit_exp_status" value="${initialStatus}"></div><div class="row-btns"><button class="btn btn-primary btn-block" id="mit_exp_import">Importar</button></div></div>`;
    root.replaceChildren(overlay); if(typeof attachModalGuard==='function') attachModalGuard(overlay);
    const q=id=>overlay.querySelector(id),wire=(group,hidden,change)=>q(group)?.querySelectorAll('.seg-btn:not([disabled])').forEach(btn=>btn.onclick=()=>{q(group).querySelectorAll('.seg-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');q(hidden).value=btn.dataset.value;change?.(btn.dataset.value);});
    overlay.querySelectorAll('[data-close]').forEach(btn=>btn.onclick=()=>closeModal());
    wire('#mit_exp_type_group','#mit_exp_type'); wire('#mit_exp_status_group','#mit_exp_status');
    wire('#mit_exp_source_group','#mit_exp_source',source=>{q('#mit_exp_account_panel').classList.toggle('hidden',source!=='conta');q('#mit_exp_reserve_panel').classList.toggle('hidden',source!=='reserva');q('#mit_exp_credit_panel').classList.toggle('hidden',source!=='credito');});
    q('#mit_exp_import').onclick=()=>{
      const type=q('#mit_exp_type').value,name=String(q('#mit_exp_name').value||'Despesa do Marco Iris').trim(),localPurchase=String(q('#mit_exp_local').value||'').trim(),category=ensureMitExpenseCategory(data,type,q('#mit_exp_category').value),value=Math.round((Number(q('#mit_exp_value').value)||0)*100)/100,date=q('#mit_exp_date').value||todayISO(),source=q('#mit_exp_source').value,status=q('#mit_exp_status').value==='Pago'?'Pago':'Em aberto',meta=mitExpenseIntegrationMeta(item);
      if(value<=0){ alert('Digite um valor maior que zero.'); return; }
      let borionId='';
      const beforeImport=clone(data);
      try{
        if(source==='credito'){
          const card=cards.find(c=>String(c.id)===String(q('#mit_exp_card').value)); if(!card) throw new Error('Escolha um cartão válido.');
          card.parcelas=Array.isArray(card.parcelas)?card.parcelas:[];
          const parcel={id:uid(),descricao:name,local:localPurchase,categoria:category,valorParcela:value,parcelaTotal:1,dataCompra:date.slice(0,7),dataCompraCompleta:date,diaEntrada:Math.max(1,Number(date.slice(8,10))||1),apareceDespesas:true,despesaTipo:type,statusPagamento:status,statusFaturaPorCompetencia:{},despesaTransacaoId:null,despesaTransacaoIds:[],despesaFixaId:null};
          card.parcelas.push(parcel); linkParcelaToDespesa(card,parcel);
          if(type==='fixa'){
            const fixed=(data.fixas||[]).find(f=>f.id===parcel.despesaFixaId); if(!fixed) throw new Error('Falha ao criar a despesa fixa no cartão.'); Object.assign(fixed,meta); borionId=fixed.id;
          }else{
            (parcel.despesaTransacaoIds||[]).forEach(id=>{const tx=(data.transacoes||[]).find(t=>t.id===id);if(tx)Object.assign(tx,meta);}); borionId=parcel.despesaTransacaoId||'';
          }
        }else if(type==='fixa'){
          let accountId=null,banco='',origemPagamento='conta',formaPagamento=null,reserve=null;
          if(source==='carteira'){ accountId=CARTEIRA_CONTA_ID; if(!accountByIdIn(data,accountId))throw new Error('A Carteira não está disponível.'); banco=accountName(data,accountId); formaPagamento='Dinheiro'; }
          else if(source==='conta'){ accountId=q('#mit_exp_account').value; if(!accountByIdIn(data,accountId))throw new Error('Escolha uma conta válida.'); banco=accountName(data,accountId); formaPagamento=q('#mit_exp_account_form').value; }
          else { reserve=reserves.find(r=>String(r.id)===String(q('#mit_exp_reserve').value)); if(!reserve) throw new Error('Escolha uma reserva válida.'); origemPagamento='reserva'; banco=reserve.banco||''; }
          const fixed=Object.assign({id:uid(),nome:name,localCompra,category,categoria:category,valor:value,dia:Math.max(1,Number(date.slice(8,10))||1),dataCadastro:date,startMonth:date.slice(0,7),endMonth:null,accountId:origemPagamento==='conta'?accountId:null,banco,formaPagamento:origemPagamento==='conta'?formaPagamento:null,origemPagamento,reservaOrigemId:reserve?.id||null},meta);
          data.fixas=Array.isArray(data.fixas)?data.fixas:[]; data.fixaPagamentos=Array.isArray(data.fixaPagamentos)?data.fixaPagamentos:[]; data.fixas.push(fixed); borionId=fixed.id;
          if(status==='Pago'&&!payFixaOcorrencia(fixed,fixed.startMonth,{persist:false,notify:false})){data.fixas=data.fixas.filter(f=>f.id!==fixed.id);throw new Error('Não foi possível aplicar o pagamento da despesa fixa.');}
        }else{
          let accountId=null,banco='',origemPagamento='conta',formaPagamento=null,reserve=null;
          if(source==='carteira'){accountId=CARTEIRA_CONTA_ID;if(!accountByIdIn(data,accountId))throw new Error('A Carteira não está disponível.');banco=accountName(data,accountId);formaPagamento='Dinheiro';}
          else if(source==='conta'){accountId=q('#mit_exp_account').value;if(!accountByIdIn(data,accountId))throw new Error('Escolha uma conta válida.');banco=accountName(data,accountId);formaPagamento=q('#mit_exp_account_form').value;}
          else {reserve=reserves.find(r=>String(r.id)===String(q('#mit_exp_reserve').value));if(!reserve)throw new Error('Escolha uma reserva válida.');origemPagamento='reserva';banco=reserve.banco||'';}
          const tx=Object.assign({id:uid(),tipo:'variavel',nome:name,localCompra,categoria:category,valor:value,data,statusPagamento:status,accountId:origemPagamento==='conta'?accountId:null,banco,origemPagamento,formaPagamento:origemPagamento==='conta'?formaPagamento:null,reservaOrigemId:reserve?.id||null,reservaOrigemMoveId:null},meta);
          data.transacoes=Array.isArray(data.transacoes)?data.transacoes:[];data.transacoes.push(tx);borionId=tx.id;
          if(status==='Pago'&&!applyNew(data,tx)){data.transacoes=data.transacoes.filter(t=>t.id!==tx.id);throw new Error('Não foi possível aplicar o saldo da despesa.');}
        }
        completeMitExpenseImport(row,item,borionId); closeModal(); if(typeof renderView==='function')renderView(); if(typeof toast==='function')toast('Despesa do Marco Iris importada com sucesso.');
      }catch(error){
        Object.keys(data).forEach(key=>delete data[key]); Object.assign(data,beforeImport); S.data=data;
        if(typeof renderView==='function')renderView();
        alert(error.message||String(error));
      }
    };
  }

  function renderSourceWorkspace(sourceAppId){
    const source = SOURCES[sourceAppId];
    const row = findSourceConfig(sourceAppId);
    const linksLabel=sourceAppId==='marco-iris'?'Receitas e despesas':'Vínculos';
    const linksContent=sourceAppId==='marco-iris'?renderMitLinksTab(row):renderLinksTab(sourceAppId,row);
    return `<div class="settings-section interop-workspace"><div class="interop-workspace-head"><div><h3>${escHtml(source.name)}</h3><p class="desc">Configurações específicas desta integração.</p></div>${row ? '<span class="pill ok">Conectado</span>' : '<span class="pill">Não conectado</span>'}</div><div class="interop-subtabs"><button class="${uiTab === 'connection' ? 'active' : ''}" onclick="BorionInterop.setSettingsTab('connection')">Conexão</button><button class="${uiTab === 'links' ? 'active' : ''}" onclick="BorionInterop.setSettingsTab('links')">${linksLabel}</button></div>${uiTab === 'links' ? linksContent : renderConnectionTab(sourceAppId, row)}</div>`;
  }

  function renderSettings(){
    if(!SOURCES[uiSourceAppId]) uiSourceAppId = 'amanda-estetica';
    return `<div class="settings-page interop-settings-page"><div class="settings-section settings-hero-section"><h3>Integrações inteligentes</h3><p class="desc">Receitas recebidas entram automaticamente. Despesas do Marco Iris ficam aguardando revisão; outras integrações continuam usando seus próprios vínculos.</p></div><div class="interop-app-tabs">${Object.entries(SOURCES).map(([id, source]) => {
      const row = findSourceConfig(id);
      return `<button class="interop-app-tab ${uiSourceAppId === id ? 'active' : ''}" onclick="BorionInterop.setSettingsSource('${id}')"><span>${escHtml(source.name)}</span><small>${row ? (row.config.mappingReady ? 'Conectado e configurado' : (id==='marco-iris'?'Conectado · configurar receitas':'Conectado · vínculos pendentes')) : 'Não conectado'}</small></button>`;
    }).join('')}</div>${renderSourceWorkspace(uiSourceAppId)}<div class="settings-section interop-rules-summary"><h3>Como a sincronização funciona</h3><div class="interop-rule-grid"><div><b>1. Identifica</b><span>Confere o ID permanente do registro externo.</span></div><div><b>2. Converte</b><span>Aplica tipos, categorias, status, formas e contas configuradas.</span></div><div><b>3. Torna nativo</b><span>O lançamento pode ser editado livremente no Borion.</span></div><div><b>4. Não duplica</b><span>O ID continua registrado mesmo após qualquer edição local.</span></div></div></div></div>`;
  }

  async function saveMappings(sourceAppId, {sync=false}={}){
    const row = findSourceConfig(sourceAppId);
    if(!row) throw new Error('Integração não configurada.');
    const mappings = normalizeMappings(row.config.mappings);

    document.querySelectorAll('[data-interop-direction]').forEach(select => {
      mappings.directions[select.dataset.interopDirection] = select.value;
    });
    document.querySelectorAll('[data-interop-kind]').forEach(select => {
      const key = select.dataset.interopKind;
      if(select.value) mappings.transactionKinds[key] = select.value;
      else delete mappings.transactionKinds[key];
    });
    document.querySelectorAll('[data-interop-category]').forEach(input => {
      const direction = input.dataset.direction;
      const key = input.dataset.key;
      const value = String(input.value || '').trim() || 'Outro';
      mappings.categories[direction] ||= {};
      mappings.categories[direction][key] = value;
    });
    document.querySelectorAll('[data-interop-revenue-origin]').forEach(select => {
      mappings.revenueOrigins[select.dataset.key] = select.value;
    });
    document.querySelectorAll('[data-interop-payment-form]').forEach(select => {
      const key = select.dataset.key;
      mappings.paymentMethods[key] ||= {};
      mappings.paymentMethods[key].form = select.value;
    });
    document.querySelectorAll('[data-interop-payment-target]').forEach(select => {
      const key = select.dataset.key;
      mappings.paymentMethods[key] ||= {};
      mappings.paymentMethods[key].target = select.value;
      delete mappings.paymentMethods[key].accountId;
    });
    document.querySelectorAll('[data-interop-status]').forEach(select => {
      mappings.statuses[select.dataset.key] = select.value;
    });

    row.config.mappings = mappings;
    row.config.mappingReady = true;
    row.config.mappingSavedAt = nowIso();
    saveProfileData(row.profile.id, row.data);
    if(typeof toast === 'function') toast('Opções salvas. Esta configuração continuará igual depois de sair e entrar novamente.');
    if(sync) return await syncSource(sourceAppId, {silent:false});
    if(typeof renderView === 'function') renderView();
    return true;
  }

  function markImportedDeletion(tx, mode, data=S.data){
    if(!tx?.integrationAggregateId || !tx?.integrationSourceAppId) return false;
    const sourceAppId = tx.integrationSourceAppId;
    const aggregateId = tx.integrationAggregateId;
    const state = importedState(data, sourceAppId);
    const ignored = ignoredState(data, sourceAppId);
    if(mode === 'permanent'){
      ignored[aggregateId] = {
        ignoredAt:nowIso(), sourceAppId, aggregateId,
        entityId:tx.integrationEntityId || '', txId:tx.id || ''
      };
      state.records[aggregateId] = {
        status:'ignored', txId:'', entityId:tx.integrationEntityId || '', ignoredAt:ignored[aggregateId].ignoredAt
      };
    }else{
      delete ignored[aggregateId];
      delete state.records[aggregateId];
    }
    const interop = ensureInterop(data);
    interop.pending = (interop.pending || []).filter(item => !(item.sourceAppId === sourceAppId && item.aggregateId === aggregateId));
    interop.audit.unshift({
      id:'interop-delete-' + Date.now(), at:nowIso(), sourceAppId, aggregateId,
      action:mode === 'permanent' ? 'delete-and-ignore' : 'delete-and-reimport'
    });
    interop.audit = interop.audit.slice(0, 300);
    return true;
  }

  function openImportedDeleteDialog(tx, onChoice){
    const root = document.getElementById('modal-root');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal-box interop-delete-modal"><div class="modal-head"><h2>Excluir lançamento importado</h2><button data-close>&times;</button></div><p class="modal-sub">Este lançamento veio de <b>${escHtml(sourceName(tx.integrationSourceAppId))}</b>. Escolha o que deve acontecer na próxima sincronização.</p><button class="interop-delete-choice" data-choice="reimport"><strong>Excluir e permitir importar novamente</strong><span>Remove o lançamento e libera o ID. Se ele ainda existir na origem, voltará na próxima sincronização.</span></button><button class="interop-delete-choice danger" data-choice="permanent"><strong>Excluir e ignorar permanentemente</strong><span>Remove o lançamento e grava o ID na lista de ignorados. Ele não voltará.</span></button><button class="btn-outline btn-block" data-close>Cancelar</button></div>`;
    root.replaceChildren(overlay);
    if(typeof attachModalGuard==='function') attachModalGuard(overlay);
    overlay.querySelectorAll('[data-close]').forEach(btn => btn.onclick = () => { closeModal(); });
    overlay.querySelectorAll('[data-choice]').forEach(btn => btn.onclick = () => {
      const choice=btn.dataset.choice==='permanent'?'permanent':'reimport';
      closeModal();
      if(typeof onChoice==='function') onChoice(choice);
    });
  }

  function captureImportReference(tx){
    if(!tx?.integrationAggregateId || !tx?.integrationSourceAppId) return null;
    const out = {};
    Object.keys(tx).filter(key => key.startsWith('integration')).forEach(key => { out[key] = clone(tx[key]); });
    out.integrationImported = true;
    out.integrationManaged = false;
    out.integrationImportMode = 'native';
    return out;
  }
  function transferImportReference(sourceTx, targetIds, data=S.data){
    const reference = captureImportReference(sourceTx);
    if(!reference) return false;
    const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
    const targets = (data.transacoes || []).filter(tx => ids.includes(tx.id));
    targets.forEach((tx, index) => Object.assign(tx, clone(reference), {integrationDerivedIndex:index + 1, integrationDerivedCount:targets.length}));
    const first = targets[0];
    if(first){
      const state = importedState(data, reference.integrationSourceAppId);
      const marker = state.records[reference.integrationAggregateId] || {};
      state.records[reference.integrationAggregateId] = Object.assign(marker, {status:'imported', txId:first.id});
    }
    return targets.length > 0;
  }

  async function syncAll({silent=true}={}){
    const rows = allSourceConfigs();
    const out = [];
    for(const row of rows){
      if(!row.config.mappingReady) continue;
      try{ out.push(await syncSource(row.sourceAppId, {silent})); }
      catch(error){ console.warn('[BORION_INTEROP] Auto sync:', error); }
    }
    return out;
  }
  function start(){
    setTimeout(() => syncAll({silent:true}), 2500);
    setInterval(() => syncAll({silent:true}), 15000);
    document.addEventListener('visibilitychange', () => { if(!document.hidden) syncAll({silent:true}); });
    window.addEventListener('online', () => syncAll({silent:true}));
  }

  window.BorionInterop = Object.freeze({
    spec:SPEC, sources:SOURCES, sourceName,
    renderSettings, setSettingsSource, setSettingsTab, setDeletionPolicy, openMappingHelp,
    setupDialog, configure, inspectSource, saveMappings, saveMitSettings, setMitDestination, rememberMitEntryMethod, openMitExpenseImport,
    syncSource, syncAll, disconnect,
    setImportCutoff, setImportCutoffNow, clearImportCutoff,
    markImportedDeletion, openImportedDeleteDialog,
    captureImportReference, transferImportReference,
    start,
    __test:{
      hash, stableStringify, ensureInterop, validateSnapshot,
      discoverSnapshot, mappedRecord, reconcileSnapshot, reconcileMitSnapshot, makeMitIncomeTransaction, mitMethodKey, normalizeMitRevenueRules, validateMitRevenueRules, resolveMitEntryMethod, mitOriginalInstallments, mitRuleTarget, sourceLabel, friendlyFieldName, friendlySourceValue, normalizeTarget, resolveFinancialTarget,
      txDelta, adjust, applyReserveLink, paymentForm, targetAccountId, makeTransaction,
      markImportedDeletion, editableSnapshotHash, reverseImportedTransaction,
      beforeImportCutoff
    }
  });
})();
