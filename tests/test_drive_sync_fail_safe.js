'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const nodeCrypto=require('crypto');

const root=path.resolve(__dirname,'..');
function source(name){ return fs.readFileSync(path.join(root,'js',name),'utf8'); }
function assert(cond,msg){ if(!cond) throw new Error('FALHOU: '+msg); }

/* Mock mínimo de IndexedDB — só o suficiente para BorionIDB640 (open/put/get/
   getAll/delete com um único object store por transação). Não é uma
   implementação completa da API, só cobre o que 01f de fato usa. */
function makeFakeIndexedDB(){
  const dbs={};
  function fakeRequest(){ return {result:undefined,error:null,onsuccess:null,onerror:null,onupgradeneeded:null}; }
  return {
    open(name, version){
      const req=fakeRequest();
      setTimeout(()=>{
        if(!dbs[name]) dbs[name]={stores:{}, version:0};
        const db=dbs[name];
        const isNew = (version||1)>db.version;
        const fakeDb={
          objectStoreNames:{contains:n=>!!db.stores[n]},
          createObjectStore(n){ db.stores[n]={}; },
          transaction(storeNames){
            const tx={oncomplete:null,onerror:null};
            tx.objectStore=(n)=>{
              const store=db.stores[n]||(db.stores[n]={});
              return {
                put(rec){ store[rec.id]=rec; const r=fakeRequest(); setTimeout(()=>{ r.onsuccess&&r.onsuccess(); tx.oncomplete&&tx.oncomplete(); },0); return r; },
                get(key){ const r=fakeRequest(); setTimeout(()=>{ r.result=store[key]; r.onsuccess&&r.onsuccess(); },0); return r; },
                getAll(){ const r=fakeRequest(); setTimeout(()=>{ r.result=Object.values(store); r.onsuccess&&r.onsuccess(); },0); return r; },
                delete(key){ delete store[key]; const r=fakeRequest(); setTimeout(()=>{ r.onsuccess&&r.onsuccess(); tx.oncomplete&&tx.oncomplete(); },0); return r; }
              };
            };
            return tx;
          }
        };
        db.version=Math.max(db.version,version||1);
        if(isNew && req.onupgradeneeded){ req.result=fakeDb; req.onupgradeneeded(); }
        req.result=fakeDb;
        req.onsuccess && req.onsuccess();
      },0);
      return req;
    }
  };
}

function makeSandbox(){
  const store={};
  const timers=[];
  const toasts=[];
  const testConsole=Object.assign({},console,{warn(...args){if(/operação protegida; consolidação será repetida|journal não pôde ser consolidado no boot/.test(String(args[0]||'')))return;console.warn(...args);}});
  const sandbox={
    console:testConsole, Object, Array, String, Number, JSON, Math, Promise, Date, Map, Set,
    TextEncoder,
    crypto: nodeCrypto.webcrypto,
    indexedDB: makeFakeIndexedDB(),
    BroadcastChannel: class { postMessage(){} },
    setTimeout(fn,ms){ timers.push({fn,ms}); return timers.length; },
    clearTimeout(){}, setInterval(){ return 1; }, clearInterval(){},
    localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}},
    navigator:{onLine:true},
    document:{hidden:false,visibilityState:'visible',querySelector:()=>null,getElementById:()=>null,activeElement:null,addEventListener(){}},
    addEventListener(){},
    window:null,
    S:{currentProfile:{id:'pedro',name:'Pedro'},data:{transacoes:[{id:'t1'}]},profiles:[{id:'pedro',name:'Pedro'}],config:{}},
    toast(msg){toasts.push(msg);},
    setStorageMode(){}, setConfig(){}, setProfiles(){}, setProfileData(){}, migrateData:d=>d||{}, emptyData:()=>({}),
    clearExitSavePending(){},
    validateBorionJson:()=>({valid:true,errors:[]}),
    buildFullBackupPayload:async()=>({type:'borion-account-backup',profiles:[{id:'pedro'}],dataByProfile:{pedro:{transacoes:[{id:'t1'}]}}}),
    buildSharedBackupSnapshot:async()=>({type:'borion-account-backup',profiles:[{id:'pedro'}],dataByProfile:{pedro:{transacoes:[{id:'t1'}]}}}),
    renderGate(){},renderView(){},writeJSON(){},readJSON(){return null;},
    BORION_APP_VERSION:'6.40.2'
  };
  sandbox.window=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source('01d-data-guard.js'),sandbox);
  vm.runInContext(source('01e-sync-core-v640.js')+'\nwindow.BorionSyncCore=BorionSyncCore;',sandbox);
  vm.runInContext(source('01f-sync-queue-v640.js')+'\nwindow.BorionIDB640=BorionIDB640;window.BorionDevice640=BorionDevice640;window.BorionSyncState=BorionSyncState;window.BorionDurableQueue=BorionDurableQueue;',sandbox);
  vm.runInContext(source('01g-drive-journal-v640.js')+'\nwindow.BorionDriveJournal640=BorionDriveJournal640;',sandbox);
  vm.runInContext(source('01c-google-drive-provider.js')+'\nwindow.GoogleDriveProvider=GoogleDriveProvider;window.GoogleDriveFS=GoogleDriveFS;window.GoogleDriveAuth=GoogleDriveAuth;',sandbox);
  sandbox.GoogleDriveAuth.user={sub:'u1',email:'pedro@example.invalid'};
  sandbox.GoogleDriveProvider.folderId='folder';
  sandbox.GoogleDriveProvider.currentFileId='current';
  sandbox.GoogleDriveProvider.currentFileMeta={modifiedTime:'2026-07-19T17:00:00.000Z'};
  sandbox.GoogleDriveProvider._deviceId='device-1';

  // Drive em memória compatível com a topologia v6.40.2. Assim o teste cobre
  // a operação real do journal (descoberta de pastas, listagem, leitura,
  // consolidação e confirmação do snapshot), sem chamar OAuth ou DOM.
  const driveFiles=new Map();
  let seq=0;
  const folderMime='application/vnd.google-apps.folder';
  function addFolder(id,name,parent){ driveFiles.set(id,{id,name,mimeType:folderMime,parents:[parent],createdTime:'2026-01-01T00:00:00.000Z'}); }
  addFolder('sync','Borion_Sync','folder');
  addFolder('ops','operations','sync');
  addFolder('snaps','snapshots','sync');
  addFolder('conflicts','conflicts','sync');
  let currentPayload={type:'borion-account-backup',profiles:[{id:'pedro'}],dataByProfile:{pedro:{transacoes:[]}},config:{}};
  driveFiles.set('current',{id:'current',name:'current.json',parents:['folder'],mimeType:'application/json',content:currentPayload,modifiedTime:'2026-07-19T17:00:00.000Z'});
  sandbox.GoogleDriveFS.findChildren=async(parentId,name,mimeType)=>Array.from(driveFiles.values()).filter(f=>(f.parents||[]).includes(parentId)&&f.name===name&&(!mimeType||f.mimeType===mimeType)&&!f.trashed);
  sandbox.GoogleDriveFS.findChild=async(parentId,name,mimeType)=>(await sandbox.GoogleDriveFS.findChildren(parentId,name,mimeType))[0]||null;
  sandbox.GoogleDriveFS.createFolder=async(parentId,name)=>{const id='folder_'+(++seq);addFolder(id,name,parentId);return driveFiles.get(id);};
  sandbox.GoogleDriveFS.createFile=async(parentId,name,obj)=>{const id='file_'+(++seq);const f={id,name,parents:[parentId],mimeType:'application/json',content:JSON.parse(JSON.stringify(obj)),createdTime:new Date().toISOString()};driveFiles.set(id,f);return f;};
  sandbox.GoogleDriveFS.readFile=async(fileId)=>JSON.parse(JSON.stringify((driveFiles.get(fileId)||{}).content));
  sandbox.GoogleDriveFS.readFileText=async(fileId)=>JSON.stringify((driveFiles.get(fileId)||{}).content);
  sandbox.GoogleDriveFS.listChildren=async(parentId)=>Array.from(driveFiles.values()).filter(f=>(f.parents||[]).includes(parentId)&&!f.trashed).map(f=>({id:f.id,name:f.name,parents:f.parents,createdTime:f.createdTime,modifiedTime:f.modifiedTime,mimeType:f.mimeType}));
  sandbox.GoogleDriveFS.updateFile=async(fileId,obj)=>{const f=driveFiles.get(fileId);f.content=JSON.parse(JSON.stringify(obj));f.modifiedTime='2026-07-19T17:01:00.000Z';currentPayload=f.content;return {id:fileId,modifiedTime:f.modifiedTime};};
  sandbox.GoogleDriveFS.getFileMeta=async()=>({modifiedTime:(driveFiles.get('current')||{}).modifiedTime});
  sandbox.__driveFiles=driveFiles;
  sandbox.__store=store; sandbox.__timers=timers; sandbox.__toasts=toasts;
  return sandbox;
}

(async()=>{
  // 0) A aba secundária nunca pode executar chamada remota: apenas delega à líder.
  {
    const sb=makeSandbox();
    const p=sb.GoogleDriveProvider;
    p.dirty=true;p._syncRevision=1;
    let delegated=0,uploads=0;
    sb.BorionMultiTab640={isLeader:()=>false,requestSync(){delegated++;}};
    const realCreate=sb.GoogleDriveFS.createFile;
    sb.GoogleDriveFS.createFile=async(...args)=>{uploads++;return realCreate(...args);};
    const result=await p.syncNow({source:'follower_test'});
    assert(result&&result.delegated===true&&result.synced===false,'follower deve retornar delegação explícita');
    assert(delegated===1&&uploads===0,'follower não pode criar operação nem chamar o Drive');
  }

  // 1) Falha de rede/token ao GRAVAR A OPERAÇÃO (o passo que dá durabilidade)
  // não pode apagar o marcador pendente nem fingir sucesso. V6.40: o passo que
  // corresponde ao antigo "PATCH direto no current.json" agora é o createFile
  // do arquivo de operação imutável — é ali que uma falha de fato significa
  // "nada foi salvo no Drive ainda".
  {
    const sb=makeSandbox();
    const p=sb.GoogleDriveProvider;
    p.dirty=true; p._syncRevision=1;
    sb.localStorage.setItem('borion_gdrive_pending_folder','1');
    sb.GoogleDriveFS.createFile=async()=>{ throw new Error('Falha ao salvar no Google Drive (status 401).'); };
    const ok=await p.syncNow();
    assert(ok===false,'syncNow deveria retornar false quando o Drive falha');
    assert(p.dirty===true,'dirty deve continuar true após falha');
    assert(sb.localStorage.getItem('borion_gdrive_pending_folder'),'marcador pendente deve continuar persistido');
    assert(p.authRequired===true,'erro 401 deve exigir reconexão');
    assert(p.lastSyncError.includes('401'),'erro deve ficar visível no estado');
    assert(sb.__timers.length>0,'deve agendar nova tentativa automática');
  }

  // 2) Ao voltar ao app, uma pendência persistida precisa ser reenviada e limpa só após confirmação.
  {
    const sb=makeSandbox();
    const p=sb.GoogleDriveProvider;
    p.dirty=false; p._syncRevision=2;
    sb.localStorage.setItem('borion_gdrive_pending_folder','1');
    const ok=await p.resumePendingSync('visibility');
    assert(ok===true,'resumePendingSync deveria confirmar a pendência');
    assert(p.dirty===false,'dirty deve limpar depois da confirmação real');
    assert(!sb.localStorage.getItem('borion_gdrive_pending_folder'),'marcador só deve ser removido após sucesso');
    assert(p.lastSyncAt>0,'última confirmação deve ser registrada');
  }

  // 3) Uma edição nova durante o upload não pode ser engolida pela confirmação da versão anterior.
  {
    const sb=makeSandbox();
    const p=sb.GoogleDriveProvider;
    p.dirty=true; p._syncRevision=5;
    sb.localStorage.setItem('borion_gdrive_pending_folder','1');
    const realCreate=sb.GoogleDriveFS.createFile;
    sb.GoogleDriveFS.createFile=async(...args)=>{
      const created=await realCreate(...args);
      p._syncRevision=6; // representa uma nova alteração entrando durante o upload
      p.dirty=true;
      sb.localStorage.setItem('borion_gdrive_pending_folder','2');
      return created;
    };
    const ok=await p.syncNow();
    assert(ok===false,'upload antigo não deve declarar a edição mais nova como confirmada');
    assert(p.dirty===true,'nova edição deve continuar pendente');
    assert(sb.localStorage.getItem('borion_gdrive_pending_folder'),'marcador da edição nova deve permanecer');
  }

  // 4) V6.40 — mesmo que a CONSOLIDAÇÃO (o merge/PATCH do current.json) falhe
  // depois da operação já ter sido gravada com sucesso, o dado do usuário não
  // pode ser tratado como perdido: a pendência local é liberada (já está
  // durável no Drive como operação imutável) e a próxima sincronização
  // termina de consolidar sozinha.
  {
    const sb=makeSandbox();
    const p=sb.GoogleDriveProvider;
    p.dirty=true; p._syncRevision=9;
    sb.localStorage.setItem('borion_gdrive_pending_folder','1');
    sb.GoogleDriveFS.updateFile=async()=>{ throw new Error('Falha ao salvar no Google Drive (status 500).'); };
    const ok=await p.syncNow();
    assert(ok===true,'a operação em si já confirmou — falha só na consolidação deve retornar proteção confirmada');
    assert(p.dirty===false,'dirty local deve limpar: o dado já está durável no Drive como operação');
    assert(!sb.localStorage.getItem('borion_gdrive_pending_folder'),'marcador da edição local deve ser liberado após a operação confirmada');
    assert(p.hasPersistedConsolidation(),'deve existir marcador separado de consolidação pendente');
    assert(sb.BorionSyncState.current==='DRIVE_PROTECTED','status não pode dizer sincronizado antes do snapshot');

    // A retomada seguinte consolida a operação existente sem criar uma segunda.
    sb.GoogleDriveFS.updateFile=async(fileId,obj)=>{const f=sb.__driveFiles.get(fileId);f.content=JSON.parse(JSON.stringify(obj));f.modifiedTime='2026-07-19T17:02:00.000Z';return {id:fileId,modifiedTime:f.modifiedTime};};
    const resumed=await p.resumePendingSync('restart');
    assert(resumed===true,'reinício deve consolidar automaticamente a operação protegida');
    assert(!p.hasPersistedConsolidation(),'marcador de consolidação deve limpar após confirmação do snapshot');
    assert(sb.BorionSyncState.current==='SNAPSHOT_CONFIRMED','status final deve confirmar o snapshot');
  }

  // 5) Boot de uma base legada, depois do backup bruto, deve persistir o schema
  // migrado mesmo sem operação nova. Caso contrário a mesma base seria migrada em
  // memória a cada abertura e o current.json continuaria antigo.
  {
    const sb=makeSandbox(),p=sb.GoogleDriveProvider;
    let updates=0;
    sb.BackupFS={ensureRawSchemaMigrationBackup:async()=>({notRequired:false,exactBytes:true})};
    const realUpdate=sb.GoogleDriveFS.updateFile;
    sb.GoogleDriveFS.updateFile=async(...args)=>{updates++;return await realUpdate(...args);};
    const loaded=await p.loadFromDrive();
    const current=sb.__driveFiles.get('current').content;
    assert(loaded.empty===false&&updates===1,'boot legado deve gravar uma única vez o snapshot migrado/validado');
    assert(current.__syncMeta640&&current.__syncMeta640.schemaVersion===6401,'current.json deve receber schema 6401 no boot');
    assert(current.integrity&&current.integrity.checksum,'snapshot migrado deve ter checksum confirmado');
    assert((current.profiles||[]).length===1&&current.profiles[0].id==='pedro','migração de boot deve preservar o perfil existente');
  }

  // 6) Se o PATCH da migração falhar no boot, o marcador de recuperação deve
  // sobreviver e a retomada precisa persistir a mesma migração sem criar operação.
  {
    const sb=makeSandbox(),p=sb.GoogleDriveProvider;
    sb.BackupFS={ensureRawSchemaMigrationBackup:async()=>({notRequired:false,exactBytes:true})};
    const realUpdate=sb.GoogleDriveFS.updateFile;let failedOnce=false;
    sb.GoogleDriveFS.updateFile=async(...args)=>{if(!failedOnce){failedOnce=true;throw Object.assign(new Error('falha de rede no PATCH da migração'),{status:500});}return await realUpdate(...args);};
    const loaded=await p.loadFromDrive();
    assert(loaded.pending===true&&p.hasPersistedConsolidation(),'falha no PATCH da migração deve manter recuperação pendente');
    const resumed=await p.resumePendingSync('migration_restart');
    const current=sb.__driveFiles.get('current').content;
    assert(resumed===true&&!p.hasPersistedConsolidation(),'retomada deve concluir e limpar o marcador de migração');
    assert(current.__syncMeta640&&current.__syncMeta640.schemaVersion===6401&&current.integrity.checksum,'retomada deve persistir snapshot migrado e validado');
  }

  console.log('OK: sincronização fail-safe v6.40.2 preserva pendências, retoma migração interrompida, persiste o schema no boot e separa operação protegida de snapshot confirmado.');
})().catch(e=>{console.error(e);process.exit(1);});
