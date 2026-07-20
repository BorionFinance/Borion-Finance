/* Borion Finance — Journal imutável no Google Drive (V6.40.1)
   Horário serve só para ordenação/diagnóstico. Aplicação é decidida unicamente
   por operationId persistido em __syncMeta640.appliedOperationIds. */
const BORION_SYNC_FOLDER_NAME='Borion_Sync';
const BORION_OPS_FOLDER_NAME='operations';
const BORION_SNAPSHOTS_FOLDER_NAME='snapshots';
const BORION_CONFLICTS_FOLDER_NAME='conflicts';
const BORION_OPERATION_RETENTION_MS=30*24*60*60*1000;
const BORION_OPERATION_MAX_BYTES=15*1024*1024;
const BORION_CANONICAL_FOLDER_PREFIX='borion_journal_canonical_v6401_';

const BorionDriveJournal640={
  _topologyCache:new Map(),
  _folderSort(a,b){return String(a.createdTime||'').localeCompare(String(b.createdTime||''))||String(a.id).localeCompare(String(b.id));},
  _canonicalKey(mainFolderId,kind){return BORION_CANONICAL_FOLDER_PREFIX+mainFolderId+'_'+kind;},
  _readPersisted(mainFolderId,kind){try{return localStorage.getItem(this._canonicalKey(mainFolderId,kind));}catch(e){return null;}},
  _persist(mainFolderId,kind,id){try{localStorage.setItem(this._canonicalKey(mainFolderId,kind),id);}catch(e){}},

  async _discoverFolders(parentId,name,createIfMissing){
    let folders=await GoogleDriveFS.findChildren(parentId,name,'application/vnd.google-apps.folder');
    if(!folders.length&&createIfMissing){
      const created=await GoogleDriveFS.createFolder(parentId,name);
      // A listagem do Drive pode demorar a refletir a criação. O ID retornado pelo
      // POST já é válido e entra como candidato imediatamente; a próxima descoberta
      // forçada reunirá também qualquer pasta gêmea criada por outro dispositivo.
      const relisted=await GoogleDriveFS.findChildren(parentId,name,'application/vnd.google-apps.folder');
      folders=relisted.slice();
      if(created&&created.id&&!folders.some(f=>f.id===created.id)) folders.push(Object.assign({parents:[parentId]},created));
    }
    const seen=new Set();
    return folders.filter(f=>f&&f.id&&!seen.has(f.id)&&(seen.add(f.id),true)).sort((a,b)=>this._folderSort(a,b));
  },

  async discoverTopology(mainFolderId,options={}){
    const cached=this._topologyCache.get(mainFolderId);
    if(cached&&!options.force&&Date.now()-cached.discoveredAt<15000) return cached;
    const syncFolders=await this._discoverFolders(mainFolderId,BORION_SYNC_FOLDER_NAME,true);
    if(!syncFolders.length) throw new Error('Não foi possível criar ou localizar Borion_Sync.');
    const persistedSync=this._readPersisted(mainFolderId,'sync');
    const canonicalSync=syncFolders.find(f=>f.id===persistedSync)||syncFolders[0];
    this._persist(mainFolderId,'sync',canonicalSync.id);

    const opsFolders=[],snapshotFolders=[],conflictFolders=[];
    for(const sf of syncFolders){
      const create=sf.id===canonicalSync.id;
      opsFolders.push(...await this._discoverFolders(sf.id,BORION_OPS_FOLDER_NAME,create));
      snapshotFolders.push(...await this._discoverFolders(sf.id,BORION_SNAPSHOTS_FOLDER_NAME,create));
      conflictFolders.push(...await this._discoverFolders(sf.id,BORION_CONFLICTS_FOLDER_NAME,create));
    }
    const choose=(list,kind,parentId)=>{
      const sorted=list.slice().sort((a,b)=>this._folderSort(a,b));
      const persisted=this._readPersisted(mainFolderId,kind);
      const inCanonicalParent=sorted.filter(f=>(f.parents||[]).includes(parentId));
      const selected=inCanonicalParent.find(f=>f.id===persisted)||inCanonicalParent[0]||sorted.find(f=>f.id===persisted)||sorted[0];
      if(!selected) throw new Error('Estrutura do journal incompleta: pasta '+kind+' ausente.');
      this._persist(mainFolderId,kind,selected.id); return selected;
    };
    const topology={
      mainFolderId,syncFolders,opsFolders,snapshotFolders,conflictFolders,
      canonicalSyncFolder:canonicalSync,
      canonicalOpsFolder:choose(opsFolders,'operations',canonicalSync.id),
      canonicalSnapshotsFolder:choose(snapshotFolders,'snapshots',canonicalSync.id),
      canonicalConflictsFolder:choose(conflictFolders,'conflicts',canonicalSync.id),
      duplicates:{sync:syncFolders.filter(f=>f.id!==canonicalSync.id),operations:[],snapshots:[],conflicts:[]},
      discoveredAt:Date.now()
    };
    topology.duplicates.operations=opsFolders.filter(f=>f.id!==topology.canonicalOpsFolder.id);
    topology.duplicates.snapshots=snapshotFolders.filter(f=>f.id!==topology.canonicalSnapshotsFolder.id);
    topology.duplicates.conflicts=conflictFolders.filter(f=>f.id!==topology.canonicalConflictsFolder.id);
    this._topologyCache.set(mainFolderId,topology);
    return topology;
  },

  async ensureOperationsFolder(mainFolderId){return (await this.discoverTopology(mainFolderId)).canonicalOpsFolder.id;},
  compactTimestamp(iso){return String(iso||'').replace(/[-:]/g,'').replace('.','');},
  operationFileName(op){return 'op_'+String(op.operationId)+'.json';},

  async writeOperation(mainFolderId,operation){
    if(!operation||!operation.operationId) throw new Error('Operação sem operationId.');
    const raw=JSON.stringify(operation);
    const bytes=typeof TextEncoder!=='undefined'?new TextEncoder().encode(raw).byteLength:raw.length;
    if(bytes>BORION_OPERATION_MAX_BYTES) throw Object.assign(new Error('Operação excedeu o limite seguro de '+BORION_OPERATION_MAX_BYTES+' bytes.'),{code:'OPERATION_TOO_LARGE',bytes});
    const topology=await this.discoverTopology(mainFolderId,{force:true});
    const name=this.operationFileName(operation);
    const existing=[];
    for(const folder of topology.opsFolders) existing.push(...await GoogleDriveFS.findChildren(folder.id,name));
    if(existing.length){
      existing.sort((a,b)=>this._folderSort(a,b));
      for(const file of existing){
        const stored=await GoogleDriveFS.readFile(file.id);
        await this._validateOperation(stored,file);
        const sameId=String(stored.operationId)===String(operation.operationId);
        const expectedChecksum=operation.checksum||await BorionSyncCore.checksumOf(operation.payload);
        const storedChecksum=stored.checksum||await BorionSyncCore.checksumOf(stored.payload);
        if(!sameId||storedChecksum!==expectedChecksum) throw Object.assign(new Error('Colisão/adulteração no operationId '+operation.operationId+'.'),{code:'OPERATION_ID_COLLISION',operationId:operation.operationId,fileId:file.id});
      }
      return Object.assign({alreadyExisted:true},existing[0]);
    }
    operation.format=operation.format||'full-snapshot-v1';
    operation.sizeBytes=bytes;
    return await GoogleDriveFS.createFile(topology.canonicalOpsFolder.id,name,operation);
  },

  async listPendingOperationFiles(mainFolderId){
    const topology=await this.discoverTopology(mainFolderId,{force:true});
    const all=[],seen=new Set();
    for(const folder of topology.opsFolders){
      const files=await GoogleDriveFS.listChildren(folder.id,{maxItems:250000,maxPages:1000});
      for(const f of files){if(!f||!f.id||seen.has(f.id))continue;seen.add(f.id);all.push(Object.assign({},f,{journalFolderId:folder.id}));}
    }
    return all.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''))||String(a.id).localeCompare(String(b.id)));
  },

  async _validateOperation(op,file){
    if(!op||typeof op!=='object'||!op.operationId||!op.payload) throw Object.assign(new Error('Operação inválida em '+(file&&file.name||'arquivo desconhecido')+'.'),{code:'JOURNAL_OPERATION_INVALID'});
    if(op.checksum){
      const actual=await BorionSyncCore.checksumOf(op.payload);
      if(actual!==op.checksum) throw Object.assign(new Error('Checksum inválido na operação '+op.operationId+'.'),{code:'JOURNAL_OPERATION_TAMPERED',operationId:op.operationId});
    }
    return true;
  },

  async consolidate(mainFolderId,remoteCurrentPayload){
    const pendingFiles=await this.listPendingOperationFiles(mainFolderId);
    const meta=(remoteCurrentPayload&&remoteCurrentPayload.__syncMeta640)||{};
    const applied=new Set(Array.isArray(meta.appliedOperationIds)?meta.appliedOperationIds:Object.keys(meta.appliedOperationIds||{}));
    const operations=[];
    for(const f of pendingFiles){
      let op;
      try{op=await GoogleDriveFS.readFile(f.id);await this._validateOperation(op,f);}
      catch(e){e.fileId=f.id;e.fileName=f.name;throw e;}
      if(applied.has(String(op.operationId))) continue;
      operations.push({file:f,op});
    }
    operations.sort((a,b)=>String(a.op.createdAt||'').localeCompare(String(b.op.createdAt||''))||String(a.op.operationId).localeCompare(String(b.op.operationId))||String(a.file.id).localeCompare(String(b.file.id)));
    let acc=remoteCurrentPayload||{profiles:[],dataByProfile:{},config:{}};
    const newlyApplied=[];
    for(const item of operations){
      const op=item.op;
      if(applied.has(String(op.operationId))) continue;
      acc=BorionSyncCore.mergeAccountPayload(op.basePayload||null,op.payload,acc);
      applied.add(String(op.operationId));
      newlyApplied.push({fileId:item.file.id,name:item.file.name,operationId:String(op.operationId),createdAt:op.createdAt||null,journalFolderId:item.file.journalFolderId});
    }
    const previousMeta=acc.__syncMeta640&&typeof acc.__syncMeta640==='object'?acc.__syncMeta640:{};
    acc.__syncMeta640=Object.assign({},previousMeta,{
      schemaVersion:BorionSyncCore.BORION_DATA_SCHEMA_VERSION,
      appliedOperationIds:Array.from(applied).sort(),
      consolidatedThrough:operations.reduce((m,x)=>String(x.op.createdAt||'')>m?String(x.op.createdAt||''):m,String(previousMeta.consolidatedThrough||'')),
      lastConsolidatedAt:new Date().toISOString(),
      journalFolderDuplicates:Object.fromEntries(Object.entries((await this.discoverTopology(mainFolderId)).duplicates).map(([kind,items])=>[kind,(items||[]).map(x=>x&&x.id).filter(Boolean).sort()]))
    });
    const canonical=JSON.parse(JSON.stringify(acc));delete canonical.integrity;
    acc.integrity=Object.assign({},acc.integrity||{}, {
      algorithm:'SHA-256',checksum:await BorionSyncCore.checksumOf(canonical),
      schemaVersion:BorionSyncCore.BORION_DATA_SCHEMA_VERSION,generatedAt:new Date().toISOString(),
      recordCount:(window.BorionDataGuard?BorionDataGuard.countAccountRecords(acc).__total:undefined),
      profileCount:(acc.profiles||[]).length
    });
    return {consolidated:acc,newlyApplied,topology:await this.discoverTopology(mainFolderId)};
  },

  async validateSnapshot(snapshot,requiredOperationId){
    if(!snapshot||!snapshot.integrity||!snapshot.integrity.checksum) return {valid:false,reason:'checksum_ausente'};
    const canonical=JSON.parse(JSON.stringify(snapshot));delete canonical.integrity;
    const actual=await BorionSyncCore.checksumOf(canonical);
    if(actual!==snapshot.integrity.checksum) return {valid:false,reason:'checksum_divergente',actual};
    const ids=new Set((snapshot.__syncMeta640&&snapshot.__syncMeta640.appliedOperationIds)||[]);
    if(requiredOperationId&&!ids.has(String(requiredOperationId))) return {valid:false,reason:'operacao_nao_confirmada'};
    return {valid:true,checksum:actual};
  },

  async cleanupAppliedOperations(mainFolderId,snapshot,options={}){
    const valid=await this.validateSnapshot(snapshot);
    if(!valid.valid) return {trashed:0,blocked:'snapshot_invalid'};
    if(!options.backupValidated) return {trashed:0,blocked:'backup_not_validated'};
    if(!options.deviceGraceSatisfied) return {trashed:0,blocked:'device_grace_not_satisfied'};
    const applied=new Set((snapshot.__syncMeta640&&snapshot.__syncMeta640.appliedOperationIds)||[]);
    const files=await this.listPendingOperationFiles(mainFolderId),cutoff=Date.now()-(Number(options.retentionMs)||BORION_OPERATION_RETENTION_MS);
    let trashed=0;const errors=[];
    for(const f of files){
      try{
        const op=await GoogleDriveFS.readFile(f.id);if(!op||!applied.has(String(op.operationId)))continue;
        const t=Date.parse(op.createdAt||f.createdTime||f.modifiedTime||'');if(!Number.isFinite(t)||t>cutoff)continue;
        await GoogleDriveFS.trashFile(f.id);trashed++;
      }catch(e){errors.push({fileId:f.id,error:String(e&&e.message||e)});break;}
    }
    return {trashed,errors,interrupted:errors.length>0};
  }
};
window.BorionDriveJournal640=BorionDriveJournal640;
