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
    bridgeVersion: '2.0.0',
    mappingVersion: 1,
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
  function sourceName(sourceAppId){ return SOURCES[sourceAppId]?.name || sourceAppId || 'aplicativo externo'; }
  function displaySourceValue(value){ return String(value || '').trim() || '(Sem informação)'; }

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
    return {
      directions: Array.isArray(value.directions) ? value.directions : [],
      transactionKinds: Array.isArray(value.transactionKinds) ? value.transactionKinds : [],
      categories: Array.isArray(value.categories) ? value.categories : [],
      paymentMethods: Array.isArray(value.paymentMethods) ? value.paymentMethods : [],
      statuses: Array.isArray(value.statuses) ? value.statuses : []
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
    return config;
  }
  function profileData(profileId){
    if(S.currentProfile && String(S.currentProfile.id) === String(profileId) && S.data) return S.data;
    return migrateData(getProfileData(profileId) || emptyData());
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
  function findSourceConfig(sourceAppId){ return allSourceConfigs().find(row => row.sourceAppId === sourceAppId) || null; }

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
    if(!list.some(existing => identity(existing) === key)) list.push(item);
  }
  function transactionKindValue(record){
    return record.recordType ?? record.entityType ?? record.kind ?? record.type ?? '';
  }
  function discoverSnapshot(snapshot, current){
    const discovered = normalizeDiscovered(clone(current || {}));
    snapshot.records.forEach(record => {
      if(!discovered.directions.includes(record.direction)) discovered.directions.push(record.direction);
      const categoryValue = String(record.category || '').trim();
      mergeUnique(discovered.categories, {
        key:mappingKey(categoryValue), value:categoryValue, direction:record.direction
      }, item => `${item.direction}:${item.key}`);
      const paymentValue = String(record.paymentMethod || '').trim();
      mergeUnique(discovered.paymentMethods, {
        key:mappingKey(paymentValue), value:paymentValue
      }, item => item.key);
      const statusValue = String(record.status || '').trim();
      mergeUnique(discovered.statuses, {
        key:mappingKey(statusValue), value:statusValue
      }, item => item.key);
      const kindValue = String(transactionKindValue(record) || '').trim();
      if(kindValue){
        mergeUnique(discovered.transactionKinds, {
          key:mappingKey(kindValue), value:kindValue, direction:record.direction
        }, item => `${item.direction}:${item.key}`);
      }
    });
    discovered.directions.sort();
    discovered.categories.sort((a,b) => `${a.direction}:${a.value}`.localeCompare(`${b.direction}:${b.value}`, 'pt-BR'));
    discovered.paymentMethods.sort((a,b) => a.value.localeCompare(b.value, 'pt-BR'));
    discovered.statuses.sort((a,b) => a.value.localeCompare(b.value, 'pt-BR'));
    discovered.transactionKinds.sort((a,b) => `${a.direction}:${a.value}`.localeCompare(`${b.direction}:${b.value}`, 'pt-BR'));
    return discovered;
  }

  function accountByIdIn(data, accountId){ return (data.contas || []).find(account => String(account.id) === String(accountId)); }
  function accountName(data, accountId){ return accountByIdIn(data, accountId)?.nome || ''; }
  function ensureLedger(data, accountId){
    data.liquidez = Array.isArray(data.liquidez) ? data.liquidez : [];
    let ledger = data.liquidez.find(item => item && item.ledgerType === 'account_delta' && String(item.accountId) === String(accountId));
    if(!ledger){
      const account = accountByIdIn(data, accountId);
      if(!account) return null;
      ledger = {
        id:'bridge-ledger-' + hash(accountId), accountId, ledgerType:'account_delta',
        nome:account.nome || 'Conta', banco:account.nome || '', valor:0, createdAt:Date.now()
      };
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
  function applyNew(data, tx){
    const delta = txDelta(tx);
    return delta ? adjust(data, tx.accountId, delta) : true;
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

    const statusRule = mappings.statuses[mappingKey(record.status)] || 'auto';
    if(statusRule === 'ignore') return {skip:true, reason:'Status configurado para ignorar'};
    const settled = statusRule === 'paid' ? true : (statusRule === 'open' ? false : record.settled === true);

    const categorySource = String(record.category || '').trim();
    const category = String(mappings.categories?.[direction]?.[mappingKey(categorySource)] || categorySource || 'Outro').trim() || 'Outro';
    const methodSource = String(record.paymentMethod || '').trim();
    const paymentRule = mappings.paymentMethods[mappingKey(methodSource)] || {};
    const form = FORMAS_PAGAMENTO.includes(paymentRule.form) ? paymentRule.form : paymentForm(methodSource);
    let accountId = paymentRule.accountId || '__default__';
    if(accountId === '__default__') accountId = form === 'Dinheiro' ? CARTEIRA_CONTA_ID : config.accountId;
    if(accountId === '__carteira__') accountId = CARTEIRA_CONTA_ID;

    const revenueOrigin = mappings.revenueOrigins[mappingKey(categorySource)] || inferRevenueOrigin(categorySource);
    return Object.assign({}, record, {
      _borionType: targetType,
      _mappedCategory: category,
      _mappedPaymentForm: form,
      _mappedAccountId: accountId,
      _mappedRevenueOrigin: revenueOrigin,
      _mappedSettled: settled,
      _mappingVersion: SPEC.mappingVersion
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
    const accountId = record._mappedAccountId || (paymentForm(record.paymentMethod) === 'Dinheiro' ? CARTEIRA_CONTA_ID : config.accountId);
    return accountByIdIn(data, accountId) ? accountId : '';
  }
  function makeTransaction(data, config, record){
    const accountId = targetAccountId(data, config, record);
    if(!accountId) throw new Error(`A conta vinculada ao campo “${record.paymentMethod || 'sem forma de pagamento'}” não existe mais no Borion.`);
    const isIncome = record._borionType === 'receita';
    const category = ensureCategory(data, isIncome ? 'receita' : 'variavel', record._mappedCategory);
    const base = {
      id:'bridge-' + hash(record.aggregateId),
      nome:record.description || 'Lançamento integrado',
      data:record.date || new Date().toISOString().slice(0,10),
      categoria:category,
      valor:Math.round((Number(record.amount) || 0) * 100) / 100,
      accountId,
      banco:accountName(data, accountId),
      integrationImported:true,
      integrationManaged:false,
      integrationImportMode:'native',
      integrationAggregateId:record.aggregateId,
      integrationSourceAppId:config.sourceAppId,
      integrationEntityId:record.entityId,
      integrationOriginalFingerprint:record.fingerprint || hash(record),
      integrationImportedAt:nowIso(),
      integrationSourceUpdatedAt:record.sourceUpdatedAt || '',
      integrationExternalReference:record.externalReference || '',
      integrationClientName:record.clientName || '',
      integrationNotes:record.notes || '',
      integrationOriginalCategory:record.category || '',
      integrationOriginalPaymentMethod:record.paymentMethod || '',
      integrationOriginalStatus:record.status || '',
      integrationMappingVersion:SPEC.mappingVersion
    };
    if(isIncome){
      return Object.assign(base, {
        tipo:'receita',
        origem:record._mappedRevenueOrigin || 'propria',
        reservaValor:0,
        destinoModo:'Conta livre',
        formaPagamento:record._mappedPaymentForm
      });
    }
    return Object.assign(base, {
      tipo:'variavel',
      statusPagamento:record._mappedSettled ? 'Pago' : 'Em aberto',
      origemPagamento:'conta',
      formaPagamento:record._mappedPaymentForm,
      localCompra:''
    });
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

  function reconcileSnapshot(data, config, snapshot){
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

    tombstones.forEach(aggregateId => {
      const marker = state.records[aggregateId];
      if(marker?.status === 'waiting') delete state.records[aggregateId];
      const nativeTx = findImportedTransaction(data, config.sourceAppId, aggregateId);
      results.push({
        aggregateId,
        status:nativeTx || marker?.status === 'imported' ? 'preserved' : 'source_deleted',
        borionTransactionId:nativeTx?.id || marker?.txId || '',
        message:nativeTx || marker?.status === 'imported'
          ? 'O registro foi excluído na origem, mas o lançamento nativo foi preservado no Borion.'
          : 'Registro removido na origem antes da importação.'
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
    if(!silent && typeof toast === 'function') toast(`${sourceName(sourceAppId)}: campos da origem lidos. Configure os Vínculos.`);
    return snapshot;
  }

  async function syncSource(sourceAppId, {silent=false}={}){
    const row = findSourceConfig(sourceAppId);
    if(!row) throw new Error('Esta integração ainda não foi configurada.');
    if(!row.config.mappingReady) throw new Error('Abra a aba Vínculos, confira os mapeamentos e clique em “Salvar vínculos e sincronizar”.');
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
        if(typeof renderView === 'function') renderView();
      }
      if(!silent && typeof toast === 'function'){
        toast(`${sourceName(sourceAppId)}: ${result.summary.created} novo(s), ${result.summary.unchanged} já importado(s), ${result.summary.waiting} aguardando.`);
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
    root.innerHTML = '';
    root.appendChild(overlay);
    const psel = overlay.querySelector('#interop_profile');
    const asel = overlay.querySelector('#interop_account');
    const refresh = () => {
      const options = accountOptions(psel.value);
      asel.innerHTML = options.map(a => `<option value="${escHtml(a.id)}" ${String(a.id) === String(existing?.config.accountId || '') ? 'selected' : ''}>${escHtml(a.name)}</option>`).join('');
    };
    refresh();
    psel.onchange = refresh;
    overlay.querySelectorAll('[data-close]').forEach(btn => btn.onclick = () => { root.innerHTML = ''; });
    overlay.querySelector('#interop_connect').onclick = async () => {
      const btn = overlay.querySelector('#interop_connect');
      btn.disabled = true;
      btn.textContent = 'Conectando…';
      try{ await configure(sourceAppId, transport, psel.value, asel.value); root.innerHTML = ''; }
      catch(error){ alert(error.message || String(error)); btn.disabled = false; btn.textContent = 'Tentar novamente'; }
    };
  }

  function disconnect(sourceAppId){
    const row = findSourceConfig(sourceAppId);
    if(!row) return;
    if(!confirm(`Desconectar ${sourceName(sourceAppId)}? Os lançamentos já importados continuarão normalmente no Borion.`)) return;
    delete ensureInterop(row.data).sources[sourceAppId];
    saveProfileData(row.profile.id, row.data);
    if(typeof renderView === 'function') renderView();
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

  function transactionTypeOptions(selected){
    const options = [
      ['receita','Receita'], ['variavel','Despesa variável'], ['ignore','Não importar']
    ];
    return options.map(([value,label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
  }
  function statusOptions(selected){
    const options = [
      ['auto','Usar status enviado pela origem'], ['paid','Sempre Pago/Recebido'],
      ['open','Sempre Em aberto'], ['ignore','Não importar este status']
    ];
    return options.map(([value,label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
  }
  function paymentOptions(selected){
    return FORMAS_PAGAMENTO.map(value => `<option value="${escHtml(value)}" ${selected === value ? 'selected' : ''}>${escHtml(value)}</option>`).join('');
  }
  function accountMappingOptions(data, selected, fallbackForm){
    const selectedValue = selected || '__default__';
    const options = [
      ['__default__', fallbackForm === 'Dinheiro' ? 'Automático (Carteira)' : 'Conta padrão da integração'],
      ['__carteira__','Carteira']
    ].concat((data.contas || []).filter(account => account && !account.isCarteira && !account.archivedAt && account.active !== false).map(account => [account.id, account.nome || 'Conta']));
    return options.map(([value,label]) => `<option value="${escHtml(value)}" ${String(selectedValue) === String(value) ? 'selected' : ''}>${escHtml(label)}</option>`).join('');
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

  function renderConnectionTab(sourceAppId, row){
    const source = SOURCES[sourceAppId];
    if(!row){
      return `<div class="interop-pane"><div class="interop-empty"><div class="interop-empty-icon">⇄</div><h4>${escHtml(source.name)} ainda não está conectado</h4><p>Conecte a pasta gerada pelo aplicativo. Nenhum lançamento será importado antes de você revisar e salvar os Vínculos.</p><div class="interop-actions"><button class="btn-outline btn-sm" onclick="BorionInterop.setupDialog('${sourceAppId}','local')">Conectar pasta local</button><button class="btn btn-primary btn-sm" onclick="BorionInterop.setupDialog('${sourceAppId}','drive')">Conectar Google Drive</button></div></div></div>`;
    }
    const c = row.config;
    const r = c.lastResult || {};
    const mappingLabel = c.mappingReady ? '<span class="pill ok">Vínculos configurados</span>' : '<span class="pill warn">Vínculos pendentes</span>';
    return `<div class="interop-pane"><div class="interop-status-grid"><div><span>Perfil de destino</span><strong>${escHtml(row.profile.name)}</strong></div><div><span>Conta padrão</span><strong>${escHtml(accountName(row.data, c.accountId) || 'Carteira')}</strong></div><div><span>Meio</span><strong>${c.transport === 'drive' ? 'Google Drive' : 'Pasta local'}</strong></div><div><span>Mapeamento</span><strong>${mappingLabel}</strong></div></div><div class="gold-box interop-sync-box"><b>Última sincronização:</b> ${escHtml(dateText(c.lastSyncAt))}<br><span>${Number(r.created || 0)} novo(s) · ${Number(r.unchanged || 0)} já importado(s) · ${Number(r.waiting || 0)} aguardando · ${Number(r.ignored || 0)} ignorado(s)</span>${c.lastError ? `<br><b>Erro:</b> ${escHtml(c.lastError)}` : ''}</div><div class="interop-actions"><button class="btn btn-primary btn-sm" onclick="BorionInterop.syncSource('${sourceAppId}')" ${c.mappingReady ? '' : 'disabled title="Configure os Vínculos primeiro"'}>Sincronizar agora</button><button class="btn-outline btn-sm" onclick="BorionInterop.inspectSource('${sourceAppId}')">Ler campos da origem</button><button class="btn-outline btn-sm" onclick="BorionInterop.setupDialog('${sourceAppId}','${c.transport}')">Reconfigurar conexão</button><button class="btn-outline btn-sm" onclick="BorionInterop.disconnect('${sourceAppId}')">Desconectar</button></div>${!c.mappingReady ? '<div class="interop-next-step"><b>Próximo passo:</b> abra a aba <b>Vínculos</b>, confira as conversões e salve. Só depois os lançamentos serão importados.</div>' : ''}</div>`;
  }

  function renderLinksTab(sourceAppId, row){
    if(!row){
      return `<div class="interop-pane"><div class="interop-empty"><h4>Conecte o aplicativo primeiro</h4><p>Os campos reais da origem precisam ser lidos antes que os vínculos possam ser configurados.</p><button class="btn btn-primary btn-sm" onclick="BorionInterop.setSettingsTab('connection')">Ir para Conexão</button></div></div>`;
    }
    const c = row.config;
    const d = normalizeDiscovered(c.discovered);
    const m = normalizeMappings(c.mappings);
    const hasFields = d.categories.length || d.paymentMethods.length || d.statuses.length || d.transactionKinds.length || d.directions.length;
    if(!hasFields){
      return `<div class="interop-pane"><div class="interop-empty"><h4>Nenhum campo da origem foi lido</h4><p>Use o botão abaixo para analisar o arquivo atual sem importar lançamentos.</p><button class="btn btn-primary btn-sm" onclick="BorionInterop.inspectSource('${sourceAppId}')">Ler campos da origem</button></div></div>`;
    }

    const directionRows = (d.directions.length ? d.directions : ['income','expense']).map(direction => {
      const target = m.directions[direction] || (direction === 'income' ? 'receita' : 'variavel');
      return `<div class="interop-map-row"><div class="interop-source-value"><small>Origem</small><strong>${direction === 'income' ? 'Entrada / Receita' : 'Saída / Despesa'}</strong></div><div class="interop-arrow">→</div><label><small>Tipo no Borion</small><select data-interop-direction="${direction}">${transactionTypeOptions(target)}</select></label></div>`;
    }).join('');

    const kindRows = d.transactionKinds.map(item => {
      const mapId = `${item.direction}:${item.key}`;
      const target = m.transactionKinds[mapId] || '';
      return `<div class="interop-map-row"><div class="interop-source-value"><small>Origem · ${item.direction === 'income' ? 'entrada' : 'saída'}</small><strong>${escHtml(displaySourceValue(item.value))}</strong></div><div class="interop-arrow">→</div><label><small>Tipo no Borion</small><select data-interop-kind="${escHtml(mapId)}"><option value="" ${!target ? 'selected' : ''}>Usar regra geral</option>${transactionTypeOptions(target)}</select></label></div>`;
    }).join('');

    const categoryRows = d.categories.map(item => {
      const target = m.categories?.[item.direction]?.[item.key] || item.value || 'Outro';
      return `<div class="interop-map-row interop-map-row-category"><div class="interop-source-value"><small>Origem · ${item.direction === 'income' ? 'receita' : 'despesa'}</small><strong>${escHtml(displaySourceValue(item.value))}</strong></div><div class="interop-arrow">→</div><label><small>Categoria no Borion</small><input type="text" list="interop-cat-${item.direction}" value="${escHtml(target)}" data-interop-category data-direction="${item.direction}" data-key="${escHtml(item.key)}" placeholder="Categoria do Borion"></label>${item.direction === 'income' ? `<label><small>Origem da receita</small><select data-interop-revenue-origin data-key="${escHtml(item.key)}">${revenueOriginOptions(m.revenueOrigins[item.key] || inferRevenueOrigin(item.value))}</select></label>` : ''}</div>`;
    }).join('');

    const paymentRows = d.paymentMethods.map(item => {
      const rule = m.paymentMethods[item.key] || {};
      const form = FORMAS_PAGAMENTO.includes(rule.form) ? rule.form : paymentForm(item.value);
      return `<div class="interop-map-row interop-map-row-payment"><div class="interop-source-value"><small>Origem</small><strong>${escHtml(displaySourceValue(item.value))}</strong></div><div class="interop-arrow">→</div><label><small>Forma no Borion</small><select data-interop-payment-form data-key="${escHtml(item.key)}">${paymentOptions(form)}</select></label><label><small>Conta / destino</small><select data-interop-payment-account data-key="${escHtml(item.key)}">${accountMappingOptions(row.data, rule.accountId, form)}</select></label></div>`;
    }).join('');

    const statusRows = d.statuses.map(item => {
      const target = m.statuses[item.key] || 'auto';
      return `<div class="interop-map-row"><div class="interop-source-value"><small>Origem</small><strong>${escHtml(displaySourceValue(item.value))}</strong></div><div class="interop-arrow">→</div><label><small>Status no Borion</small><select data-interop-status data-key="${escHtml(item.key)}">${statusOptions(target)}</select></label></div>`;
    }).join('');

    return `<div class="interop-pane interop-links-pane"><div class="interop-links-intro"><div><h4>Conversão de ${escHtml(sourceName(sourceAppId))}</h4><p>Essas regras são aplicadas somente no primeiro recebimento de cada ID. Depois disso, o lançamento fica livre para edição no Borion.</p></div><span class="pill ${c.mappingReady ? 'ok' : 'warn'}">${c.mappingReady ? 'Configurado' : 'Revisão necessária'}</span></div><datalist id="interop-cat-income">${categoryDatalist(row.data, 'income')}</datalist><datalist id="interop-cat-expense">${categoryDatalist(row.data, 'expense')}</datalist><section class="interop-map-section"><h5>Tipos de lançamento</h5><p>Define se entradas e saídas viram Receita, Despesa variável ou não são importadas.</p>${directionRows}${kindRows}</section><section class="interop-map-section"><h5>Categorias e origem da receita</h5><p>Converte as nomenclaturas do aplicativo para as categorias já usadas no Borion.</p>${categoryRows || '<div class="interop-map-empty">Nenhuma categoria encontrada.</div>'}</section><section class="interop-map-section"><h5>Formas de pagamento e contas</h5><p>Escolha a forma equivalente e a conta usada para movimentar o saldo.</p>${paymentRows || '<div class="interop-map-empty">Nenhuma forma de pagamento encontrada.</div>'}</section><section class="interop-map-section"><h5>Status</h5><p>Você pode respeitar o status enviado, forçar Pago/Em aberto ou ignorar determinados estados.</p>${statusRows || '<div class="interop-map-empty">Nenhum status encontrado.</div>'}</section><div class="interop-save-bar"><button class="btn-outline btn-sm" onclick="BorionInterop.inspectSource('${sourceAppId}')">Atualizar campos da origem</button><button class="btn btn-primary" onclick="BorionInterop.saveMappings('${sourceAppId}',{sync:true})">Salvar vínculos e sincronizar</button></div></div>`;
  }

  function renderSourceWorkspace(sourceAppId){
    const source = SOURCES[sourceAppId];
    const row = findSourceConfig(sourceAppId);
    return `<div class="settings-section interop-workspace"><div class="interop-workspace-head"><div><h3>${escHtml(source.name)}</h3><p class="desc">Configurações específicas desta integração.</p></div>${row ? '<span class="pill ok">Conectado</span>' : '<span class="pill">Não conectado</span>'}</div><div class="interop-subtabs"><button class="${uiTab === 'connection' ? 'active' : ''}" onclick="BorionInterop.setSettingsTab('connection')">Conexão</button><button class="${uiTab === 'links' ? 'active' : ''}" onclick="BorionInterop.setSettingsTab('links')">Vínculos</button></div>${uiTab === 'links' ? renderLinksTab(sourceAppId, row) : renderConnectionTab(sourceAppId, row)}</div>`;
  }

  function renderSettings(){
    if(!SOURCES[uiSourceAppId]) uiSourceAppId = 'amanda-estetica';
    return `<div class="settings-page interop-settings-page"><div class="settings-section settings-hero-section"><h3>Integrações inteligentes</h3><p class="desc">Os aplicativos enviam registros; o Borion converte cada campo conforme seus Vínculos e cria lançamentos nativos, editáveis e sem sincronização de volta.</p></div><div class="interop-app-tabs">${Object.entries(SOURCES).map(([id, source]) => {
      const row = findSourceConfig(id);
      return `<button class="interop-app-tab ${uiSourceAppId === id ? 'active' : ''}" onclick="BorionInterop.setSettingsSource('${id}')"><span>${escHtml(source.name)}</span><small>${row ? (row.config.mappingReady ? 'Conectado e configurado' : 'Conectado · vínculos pendentes') : 'Não conectado'}</small></button>`;
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
    document.querySelectorAll('[data-interop-payment-account]').forEach(select => {
      const key = select.dataset.key;
      mappings.paymentMethods[key] ||= {};
      mappings.paymentMethods[key].accountId = select.value;
    });
    document.querySelectorAll('[data-interop-status]').forEach(select => {
      mappings.statuses[select.dataset.key] = select.value;
    });

    row.config.mappings = mappings;
    row.config.mappingReady = true;
    row.config.mappingSavedAt = nowIso();
    saveProfileData(row.profile.id, row.data);
    if(typeof toast === 'function') toast('Vínculos salvos.');
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
    root.innerHTML = '';
    root.appendChild(overlay);
    overlay.querySelectorAll('[data-close]').forEach(btn => btn.onclick = () => { root.innerHTML = ''; });
    overlay.querySelectorAll('[data-choice]').forEach(btn => btn.onclick = () => {
      const choice = btn.dataset.choice === 'permanent' ? 'permanent' : 'reimport';
      root.innerHTML = '';
      if(typeof onChoice === 'function') onChoice(choice);
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
    setInterval(() => syncAll({silent:true}), 60000);
    document.addEventListener('visibilitychange', () => { if(!document.hidden) syncAll({silent:true}); });
    window.addEventListener('online', () => syncAll({silent:true}));
  }

  window.BorionInterop = Object.freeze({
    spec:SPEC, sources:SOURCES, sourceName,
    renderSettings, setSettingsSource, setSettingsTab,
    setupDialog, configure, inspectSource, saveMappings,
    syncSource, syncAll, disconnect,
    markImportedDeletion, openImportedDeleteDialog,
    captureImportReference, transferImportReference,
    start,
    __test:{
      hash, stableStringify, ensureInterop, validateSnapshot,
      discoverSnapshot, mappedRecord, reconcileSnapshot,
      txDelta, adjust, paymentForm, targetAccountId, makeTransaction,
      markImportedDeletion
    }
  });
})();
