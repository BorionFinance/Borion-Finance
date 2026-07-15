(() => {
  'use strict';

  /* ========================================================================
     BORION INTEROP SOURCE v1.0.0 — PROTECTED INTEGRATION BOUNDARY
     DO NOT MODIFY, REFORMAT OR REMOVE WITHOUT AN EXPLICIT INTERCONNECTION REQUEST.
     This module is intentionally isolated from the operational application.
     ======================================================================== */
  const SPEC = Object.freeze({
    schema: 'borion.interop.snapshot',
    schemaVersion: 1,
    bridgeVersion: '1.0.0',
    sourceAppId: 'marco-iris',
    sourceAppName: 'Marco Iris Tecnologia',
    sourceAppVersion: '1.6.4',
    targetProfileAlias: 'default',
    snapshotFile: 'marco-iris.bridge.json',
    ackFile: 'marco-iris.ack.json',
    integrationFolder: 'Borion_Integracoes'
  });

  let timer = null;
  let publishing = false;
  let pendingState = null;
  let stateGetter = null;

  function clone(value){ return JSON.parse(JSON.stringify(value)); }
  function nowIso(){ return new Date().toISOString(); }
  function randomId(){
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
    return 'inst_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
  }
  function normalize(value){
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  }
  function stableStringify(value){
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
  }
  function hash(value){
    const text = typeof value === 'string' ? value : stableStringify(value);
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1){ h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }
  function activeData(state){
    if (!state || !state.dataByProfile) return null;
    const profileId = state.activeProfileId || (state.profiles && state.profiles[0] && state.profiles[0].id);
    return profileId ? state.dataByProfile[profileId] : null;
  }
  function ensureBridgeState(state){
    if (!state.interconnections || typeof state.interconnections !== 'object') state.interconnections = {};
    if (!state.interconnections.borion || typeof state.interconnections.borion !== 'object'){
      state.interconnections.borion = {
        schemaVersion: 1,
        protectedBoundary: true,
        changePolicy: 'explicit-request-only',
        sourceAppId: SPEC.sourceAppId,
        instanceId: randomId(),
        targetProfileAlias: SPEC.targetProfileAlias,
        revision: 0,
        shadow: {},
        tombstones: [],
        lastContentHash: '',
        lastPublishAt: '',
        lastPublishStatus: 'prepared-offline',
        lastError: '',
        lastAckAt: '',
        lastAckRevision: 0,
        recordAcks: {}
      };
    }
    const bridge = state.interconnections.borion;
    bridge.schemaVersion = 1;
    bridge.protectedBoundary = true;
    bridge.changePolicy = 'explicit-request-only';
    bridge.sourceAppId = SPEC.sourceAppId;
    bridge.targetProfileAlias = SPEC.targetProfileAlias;
    bridge.instanceId ||= randomId();
    bridge.shadow ||= {};
    bridge.tombstones = Array.isArray(bridge.tombstones) ? bridge.tombstones : [];
    bridge.recordAcks ||= {};
    return bridge;
  }

  function statusCode(status){
    const s = normalize(status);
    if (s.includes('cancel')) return 'cancelled';
    if (s === 'pago' || s === 'recebido' || s === 'realizado' || s === 'parcial') return 'paid';
    if (s.includes('atras')) return 'overdue';
    return 'open';
  }

  function projectRecord(item, state, bridge){
    if (!item || !item.id) return null;
    const data = activeData(state) || {};
    const order = (data.serviceOrders || []).find(orderItem => String(orderItem.id) === String(item.orderId));
    const status = statusCode(item.status);
    const direction = normalize(item.type) === 'despesa' ? 'expense' : 'income';
    const amount = Math.round((Number(item.value) || 0) * 100) / 100;
    const entityId = String(item.id);
    const aggregateId = `${SPEC.sourceAppId}:${bridge.instanceId}:payment:${entityId}`;
    const orderLabel = item.orderId ? `OS ${item.orderId}` : 'Lançamento avulso';
    const payload = {
      aggregateId,
      entityType: 'payment',
      entityId,
      direction,
      amount,
      currency: 'BRL',
      date: (status === 'paid' ? item.paymentDate : item.dueDate) || item.paymentDate || item.dueDate || new Date().toISOString().slice(0,10),
      dueDate: item.dueDate || '',
      paymentDate: item.paymentDate || '',
      status,
      active: status !== 'cancelled' && amount > 0,
      settled: status === 'paid',
      description: `${orderLabel}${order && order.clientName ? ' · ' + order.clientName : ''}`,
      category: direction === 'income' ? 'Serviços' : 'Custos operacionais',
      paymentMethod: item.paymentMethod || '',
      clientName: (order && order.clientName) || '',
      origin: 'Marco Iris Tecnologia',
      notes: item.notes || '',
      externalReference: item.orderId || entityId,
      sourceUpdatedAt: item.updatedAt || state.updatedAt || nowIso()
    };
    payload.fingerprint = hash(payload);
    return payload;
  }

  function projectRecords(state){
    const bridge = ensureBridgeState(state);
    const data = activeData(state);
    const items = data && Array.isArray(data.payments) ? data.payments : [];
    const dedupe = new Map();
    items.forEach(item => {
      try{
        const record = projectRecord(item, state, bridge);
        if (record && record.entityId) dedupe.set(record.aggregateId, record);
      }catch(error){ console.warn('[BORION_INTEROP_SOURCE] Record ignored:', error); }
    });
    return [...dedupe.values()].sort((a,b) => a.aggregateId.localeCompare(b.aggregateId));
  }

  function reconcileState(state){
    const bridge = ensureBridgeState(state);
    const records = projectRecords(state);
    const current = new Map(records.map(record => [record.aggregateId, record]));
    const previousIds = Object.keys(bridge.shadow || {});
    const tombstoneMap = new Map((bridge.tombstones || []).map(t => [t.aggregateId, t]));

    previousIds.forEach(aggregateId => {
      if (!current.has(aggregateId)){
        tombstoneMap.set(aggregateId, {
          aggregateId,
          deletedAt: nowIso(),
          reason: 'source-record-removed'
        });
      }
    });
    current.forEach((_record, aggregateId) => tombstoneMap.delete(aggregateId));

    bridge.shadow = Object.fromEntries(records.map(record => [record.aggregateId, record.fingerprint]));
    const cutoff = Date.now() - (366 * 24 * 60 * 60 * 1000);
    bridge.tombstones = [...tombstoneMap.values()]
      .filter(item => !item.deletedAt || new Date(item.deletedAt).getTime() >= cutoff)
      .sort((a,b) => String(a.aggregateId).localeCompare(String(b.aggregateId)))
      .slice(-4000);

    const content = { records, tombstones: bridge.tombstones };
    const contentHash = hash(content);
    if (contentHash !== bridge.lastContentHash){
      bridge.revision = Math.max(0, Number(bridge.revision) || 0) + 1;
      bridge.lastContentHash = contentHash;
    }

    return {
      schema: SPEC.schema,
      schemaVersion: SPEC.schemaVersion,
      bridgeVersion: SPEC.bridgeVersion,
      sourceAppId: SPEC.sourceAppId,
      sourceAppName: SPEC.sourceAppName,
      sourceAppVersion: SPEC.sourceAppVersion,
      instanceId: bridge.instanceId,
      targetProfileAlias: SPEC.targetProfileAlias,
      revision: bridge.revision,
      generatedAt: nowIso(),
      completeSnapshot: true,
      contentHash,
      records,
      tombstones: clone(bridge.tombstones)
    };
  }

  async function writeJsonToDirectory(rootHandle, filename, object){
    const integrationDir = rootHandle.name === SPEC.integrationFolder
      ? rootHandle
      : await rootHandle.getDirectoryHandle(SPEC.integrationFolder, { create: true });
    const fileHandle = await integrationDir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(new Blob([JSON.stringify(object, null, 2)], { type: 'application/json' }));
    await writable.close();
    return integrationDir;
  }
  async function readJsonFromDirectory(rootHandle, filename){
    try{
      const integrationDir = rootHandle.name === SPEC.integrationFolder
        ? rootHandle
        : await rootHandle.getDirectoryHandle(SPEC.integrationFolder);
      const fileHandle = await integrationDir.getFileHandle(filename);
      return JSON.parse(await (await fileHandle.getFile()).text());
    }catch(error){
      if (error && (error.name === 'NotFoundError' || error.name === 'TypeMismatchError')) return null;
      throw error;
    }
  }

  function applyAcknowledgement(state, ack){
    if (!ack || ack.schema !== 'borion.interop.ack' || ack.sourceAppId !== SPEC.sourceAppId) return false;
    const bridge = ensureBridgeState(state);
    if (ack.instanceId && ack.instanceId !== bridge.instanceId) return false;
    bridge.lastAckAt = ack.processedAt || nowIso();
    bridge.lastAckRevision = Number(ack.sourceRevision) || 0;
    bridge.recordAcks = {};
    (ack.records || []).forEach(item => { if (item.aggregateId) bridge.recordAcks[item.aggregateId] = item; });

    const data = activeData(state);
    const sourceItems = data && Array.isArray(data.payments) ? data.payments : [];
    const byEntity = new Map((ack.records || []).filter(x => x.entityId).map(x => [String(x.entityId), x]));
    sourceItems.forEach(item => {
      const result = byEntity.get(String(item.id));
      if (!result) return;
      item.borionSync = {
        status: result.status || 'processed',
        borionTransactionId: result.borionTransactionId || '',
        targetProfileId: ack.targetProfileId || '',
        processedAt: ack.processedAt || nowIso(),
        message: result.message || ''
      };
    });
    return true;
  }

  async function publish(state){
    if (!state || publishing) return null;
    publishing = true;
    const bridge = ensureBridgeState(state);
    let snapshot;
    const destinations = [];
    const errors = [];
    try{
      snapshot = reconcileState(state);
      await MarcoStorage.save(state);

      try{
        const handle = await MarcoStorage.getFolderHandle();
        if (handle && await MarcoStorage.ensurePermission(handle, false)){
          await writeJsonToDirectory(handle, SPEC.snapshotFile, snapshot);
          destinations.push('local-folder');
          const ack = await readJsonFromDirectory(handle, SPEC.ackFile);
          if (ack && applyAcknowledgement(state, ack)) destinations.push('local-ack');
        }
      }catch(error){ errors.push('Pasta local: ' + (error.message || String(error))); }

      try{
        const drive = window.GoogleDriveMarco;
        if (drive && drive.isConfigured && drive.isConfigured() && drive.writeIntegrationJson){
          await drive.writeIntegrationJson(SPEC.snapshotFile, snapshot);
          destinations.push('google-drive');
          const ack = await drive.readIntegrationJson(SPEC.ackFile);
          if (ack && applyAcknowledgement(state, ack)) destinations.push('google-ack');
        }
      }catch(error){ errors.push('Google Drive: ' + (error.message || String(error))); }

      bridge.lastPublishAt = nowIso();
      bridge.lastPublishStatus = destinations.length ? 'published' : 'prepared-offline';
      bridge.lastError = errors.join(' | ');
      await MarcoStorage.save(state);
      return { snapshot, destinations, errors };
    }finally{
      publishing = false;
      if (pendingState && pendingState !== state){ const next = pendingState; pendingState = null; schedule(next, 50); }
    }
  }

  function schedule(state, delay = 650){
    if (!state) return;
    pendingState = state;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const next = pendingState;
      pendingState = null;
      publish(next).catch(error => console.warn('[BORION_INTEROP_SOURCE] Publish failed:', error));
    }, delay);
  }

  function start(getter){
    if (typeof getter === 'function') stateGetter = getter;
    const tick = () => {
      const state = stateGetter ? stateGetter() : null;
      if (state) schedule(state, 50);
    };
    setTimeout(tick, 800);
    setInterval(tick, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
    window.addEventListener('online', tick);
  }

  window.MarcoBorionInterop = Object.freeze({
    spec: SPEC,
    start,
    schedule,
    publish,
    forceSync: state => publish(state || (stateGetter && stateGetter())),
    getStatus(state){ return clone(ensureBridgeState(state || (stateGetter && stateGetter()))); },
    __test: { hash, stableStringify, projectRecords, reconcileState, applyAcknowledgement, statusCode }
  });
})();
