'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),nodeCrypto=require('crypto');
const root=path.resolve(__dirname,'..');
function source(name){return fs.readFileSync(path.join(root,'js',name),'utf8');}
function assert(cond,msg){if(!cond)throw new Error('FALHOU: '+msg);}
function clone(v){return JSON.parse(JSON.stringify(v));}
function makeSandbox(){
  const ls={};
  const sb={console,Object,Array,String,Number,JSON,Math,Promise,Date,Map,Set,TextEncoder,crypto:nodeCrypto.webcrypto,
    window:null,localStorage:{getItem:k=>ls[k]??null,setItem:(k,v)=>{ls[k]=String(v)},removeItem:k=>delete ls[k]}};
  sb.window=sb;vm.createContext(sb);
  vm.runInContext(source('01e-sync-core-v640.js')+'\nwindow.BorionSyncCore=BorionSyncCore;',sb);
  vm.runInContext(source('01g-drive-journal-v640.js')+'\nwindow.BorionDriveJournal640=BorionDriveJournal640;',sb);
  return sb;
}
function basePayload(Core){
  const data={transacoes:[],fixas:[],categorias:{receita:['Base'],fixa:['Base'],variavel:['Base']},__syncMeta:Core.emptySyncMeta()};
  return {type:'borion-account-backup',profiles:[{id:'p1',name:'Pedro'}],dataByProfile:{p1:data},config:{theme:'dark'},__syncMeta640:{appliedOperationIds:['already'],consolidatedThrough:'2099-01-01T00:00:00.000Z'}};
}
(async()=>{
  const sb=makeSandbox(),Core=sb.BorionSyncCore,Journal=sb.BorionDriveJournal640;
  const files=new Map();let seq=0;
  const folderMime='application/vnd.google-apps.folder';
  const addFolder=(id,name,parent,createdTime)=>files.set(id,{id,name,mimeType:folderMime,parents:[parent],createdTime});
  addFolder('sync-a','Borion_Sync','main','2026-01-01T00:00:00.000Z');
  addFolder('sync-b','Borion_Sync','main','2026-01-01T00:00:01.000Z');
  addFolder('ops-a','operations','sync-a','2026-01-01T00:00:00.000Z');
  addFolder('ops-b','operations','sync-b','2026-01-01T00:00:01.000Z');
  addFolder('snap-a','snapshots','sync-a','2026-01-01T00:00:00.000Z');
  addFolder('conf-a','conflicts','sync-a','2026-01-01T00:00:00.000Z');
  const Drive={
    async findChildren(parent,name,mime){return Array.from(files.values()).filter(f=>!f.trashed&&(f.parents||[]).includes(parent)&&f.name===name&&(!mime||f.mimeType===mime));},
    async createFolder(parent,name){const id='folder-'+(++seq);addFolder(id,name,parent,new Date().toISOString());return files.get(id);},
    async createFile(parent,name,obj){const id='file-'+(++seq);const f={id,name,mimeType:'application/json',parents:[parent],createdTime:new Date().toISOString(),content:clone(obj)};files.set(id,f);return f;},
    async listChildren(parent){return Array.from(files.values()).filter(f=>!f.trashed&&(f.parents||[]).includes(parent)).map(({content,...meta})=>clone(meta));},
    async readFile(id){return clone(files.get(id).content);},
    async trashFile(id){files.get(id).trashed=true;return {id,trashed:true};}
  };
  sb.GoogleDriveFS=Drive;
  const initial=basePayload(Core);
  const makePayload=(id,value)=>{
    const p=basePayload(Core);p.__syncMeta640={appliedOperationIds:[]};
    p.dataByProfile.p1.transacoes=[{id,nome:id,valor:value,createdAt:'2020-01-01T00:00:00.000Z',updatedAt:'2020-01-01T00:00:00.000Z',revision:1}];
    return p;
  };
  async function addOp(folder,operationId,createdAt,payload,checksumOverride){
    const op={operationId,deviceId:'device-x',profileId:'p1',schemaVersion:6401,createdAt,basePayload:basePayload(Core),payload};
    op.checksum=checksumOverride===undefined?await Core.checksumOf(payload):checksumOverride;
    const id='opfile-'+(++seq);files.set(id,{id,name:'op_'+operationId+'.json',mimeType:'application/json',parents:[folder],createdTime:createdAt,content:op});return id;
  }
  await addOp('ops-a','old-clock','2020-01-01T00:00:00.000Z',makePayload('tx-old',10));
  await addOp('ops-b','old-clock','2020-01-01T00:00:00.000Z',makePayload('tx-old',10)); // duplicada em árvore concorrente
  await addOp('ops-b','other-tree','2021-01-01T00:00:00.000Z',makePayload('tx-other',20));
  await addOp('ops-a','already','2019-01-01T00:00:00.000Z',makePayload('tx-applied',999));

  const topology=await Journal.discoverTopology('main',{force:true});
  assert(topology.canonicalSyncFolder.id==='sync-a','pasta canônica deve ser escolhida deterministicamente');
  assert(topology.opsFolders.length===2&&topology.duplicates.sync.length===1,'duas árvores concorrentes devem ser detectadas e consideradas');

  const first=await Journal.consolidate('main',clone(initial));
  const ids=first.consolidated.dataByProfile.p1.transacoes.map(x=>x.id).sort();
  assert(ids.join(',')==='tx-old,tx-other','operação anterior ao cursor futuro deve ser aplicada e operação já aplicada deve ser ignorada');
  assert(first.newlyApplied.length===2,'operationId duplicado em duas pastas deve ser aplicado uma única vez');
  assert(first.consolidated.__syncMeta640.journalFolderDuplicates.sync.includes('sync-b'),'snapshot deve registrar a árvore duplicada para diagnóstico');

  // Operação aparece depois, com relógio ainda mais atrasado: não pode ser perdida.
  await addOp('ops-b','late-visible','2010-01-01T00:00:00.000Z',makePayload('tx-late',30));
  const second=await Journal.consolidate('main',clone(first.consolidated));
  assert(second.consolidated.dataByProfile.p1.transacoes.some(x=>x.id==='tx-late'),'operação visível tardiamente deve entrar mesmo sendo anterior a consolidatedThrough');
  assert(second.newlyApplied.length===1&&second.newlyApplied[0].operationId==='late-visible','somente a operação ainda não aplicada deve ser consolidada');
  const valid=await Journal.validateSnapshot(second.consolidated,'late-visible');
  assert(valid.valid,'snapshot consolidado deve ter checksum válido e confirmar operationId');

  // Adulteração precisa bloquear a consolidação, sem avanço parcial silencioso.
  const badId=await addOp('ops-a','tampered','2022-01-01T00:00:00.000Z',makePayload('tx-bad',40),'checksum-falso');
  let tamper=null;try{await Journal.consolidate('main',clone(second.consolidated));}catch(e){tamper=e;}
  assert(tamper&&tamper.code==='JOURNAL_OPERATION_TAMPERED','operação adulterada deve ser rejeitada pelo checksum');
  files.delete(badId);

  // Mesmo operationId com conteúdo diferente é colisão/adulteração, nunca retry válido.
  const collisionPayload=makePayload('tx-collision',777);
  const collisionOp={operationId:'old-clock',deviceId:'device-y',profileId:'p1',schemaVersion:6401,createdAt:'2026-01-01T00:00:00.000Z',basePayload:basePayload(Core),payload:collisionPayload,checksum:await Core.checksumOf(collisionPayload)};
  let collision=null;try{await Journal.writeOperation('main',collisionOp);}catch(e){collision=e;}
  assert(collision&&collision.code==='OPERATION_ID_COLLISION','operationId repetido com payload diferente deve bloquear como colisão');

  // Compactação interrompida: para no primeiro erro e nunca faz exclusão definitiva.
  let trashCalls=0;Drive.trashFile=async id=>{trashCalls++;if(trashCalls===2)throw new Error('falha simulada no meio');files.get(id).trashed=true;return {id,trashed:true};};
  const cleanup=await Journal.cleanupAppliedOperations('main',second.consolidated,{backupValidated:true,deviceGraceSatisfied:true,retentionMs:30*24*60*60*1000});
  assert(cleanup.interrupted===true&&cleanup.trashed===1,'compactação deve parar e informar interrupção quando falhar no meio');
  assert(trashCalls===2,'não deve continuar limpando depois da falha');

  // A criação retornada pelo POST já é utilizável mesmo se a listagem ainda não a
  // mostrar (consistência eventual). Isso impede falha/segunda criação imediata.
  const sb2=makeSandbox(),Journal2=sb2.BorionDriveJournal640;let folderSeq=0;
  sb2.GoogleDriveFS={
    async findChildren(){return [];},
    async createFolder(parent,name){return {id:'new-folder-'+(++folderSeq),name,mimeType:folderMime,parents:[parent],createdTime:'2026-01-01T00:00:00.000Z'};}
  };
  const delayed=await Journal2.discoverTopology('fresh-main',{force:true});
  assert(delayed.canonicalSyncFolder.id&&delayed.canonicalOpsFolder.id&&delayed.canonicalSnapshotsFolder.id&&delayed.canonicalConflictsFolder.id,'estrutura recém-criada deve funcionar antes de aparecer na listagem');

  console.log('OK: journal ignora relógio como verdade, recupera operação tardia, detecta colisão/pastas duplicadas, tolera consistência eventual e compacta sem exclusão definitiva.');
})().catch(e=>{console.error(e);process.exit(1);});
