'use strict';
/* Testes da fila durável (item 9) e identidade de dispositivo/sessão (item 7).
   Usa um mock mínimo de IndexedDB PERSISTENTE ENTRE "REINÍCIOS" (duas sandboxes
   diferentes apontando para o mesmo banco fake) para simular "a aba fechou e
   o app abriu de novo" — o cenário central do item 9 do pedido. */
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const nodeCrypto=require('crypto');

const root=path.resolve(__dirname,'..');
function source(name){ return fs.readFileSync(path.join(root,'js',name),'utf8'); }
function assert(cond,msg){ if(!cond) throw new Error('FALHOU: '+msg); }

/* Fábrica de um "banco fake" que pode ser compartilhado entre múltiplas
   sandboxes (múltiplos `indexedDB.open`) — é isso que simula sobreviver a um
   reload/fechar aba: o dado mora fora de qualquer sandbox individual. */
function makeSharedFakeDbBackend(){
  const dbs={};
  return {
    open(name, version){
      const req={result:undefined,error:null,onsuccess:null,onerror:null,onupgradeneeded:null};
      setTimeout(()=>{
        if(!dbs[name]) dbs[name]={stores:{}, version:0};
        const db=dbs[name];
        const isNew=(version||1)>db.version;
        const fakeDb={
          objectStoreNames:{contains:n=>!!db.stores[n]},
          createObjectStore(n){ db.stores[n]={}; },
          transaction(storeNames){
            const tx={oncomplete:null,onerror:null};
            tx.objectStore=(n)=>{
              const store=db.stores[n]||(db.stores[n]={});
              return {
                put(rec){ store[rec.id]=rec; const r={}; setTimeout(()=>{ r.onsuccess&&r.onsuccess(); tx.oncomplete&&tx.oncomplete(); },0); return r; },
                get(key){ const r={}; setTimeout(()=>{ r.result=store[key]; r.onsuccess&&r.onsuccess(); },0); return r; },
                getAll(){ const r={}; setTimeout(()=>{ r.result=Object.values(store); r.onsuccess&&r.onsuccess(); },0); return r; },
                delete(key){ delete store[key]; const r={}; setTimeout(()=>{ r.onsuccess&&r.onsuccess(); tx.oncomplete&&tx.oncomplete(); },0); return r; }
              };
            };
            return tx;
          }
        };
        db.version=Math.max(db.version,version||1);
        if(isNew && req.onupgradeneeded){ req.result=fakeDb; req.onupgradeneeded(); }
        req.result=fakeDb;
        req.onsuccess&&req.onsuccess();
      },0);
      return req;
    }
  };
}

function makeSandbox(sharedIdb, sharedLocalStorageBackingStore){
  const store = sharedLocalStorageBackingStore || {};
  const sandbox={
    console, Object, Array, String, Number, JSON, Math, Promise, Date, Map, Set,
    TextEncoder, crypto: nodeCrypto.webcrypto,
    indexedDB: sharedIdb,
    localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}},
    window:null
  };
  sandbox.window=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source('01e-sync-core-v640.js')+'\nwindow.BorionSyncCore=BorionSyncCore;',sandbox);
  vm.runInContext(source('01f-sync-queue-v640.js')+'\nwindow.BorionIDB640=BorionIDB640;window.BorionDevice640=BorionDevice640;window.BorionDurableQueue=BorionDurableQueue;window.BorionSyncState=BorionSyncState;',sandbox);
  return { sandbox, store };
}

(async()=>{
  const sharedIdb = makeSharedFakeDbBackend();
  const sharedLS = {};

  // "Sessão 1": grava uma operação pendente e a aba fecha ANTES de confirmar.
  const session1 = makeSandbox(sharedIdb, sharedLS);
  const deviceId1 = await session1.sandbox.BorionDevice640.getOrCreateDeviceId();
  await session1.sandbox.BorionDurableQueue.enqueue({ id:'op-1', operationId:'op-1', deviceId:deviceId1, profileId:'pedro' });
  let pendingSession1 = await session1.sandbox.BorionDurableQueue.pendingOnly();
  assert(pendingSession1.length===1, 'a operação deve aparecer como pendente logo após ser enfileirada');

  // "Sessão 2": simula reabrir o app (nova sandbox, mesmo banco fake por baixo).
  const session2 = makeSandbox(sharedIdb, sharedLS);
  const deviceId2 = await session2.sandbox.BorionDevice640.getOrCreateDeviceId();
  assert(deviceId1===deviceId2, 'deviceId deve ser o mesmo entre sessões (estável, vindo do IndexedDB/localStorage)');
  const pendingSession2 = await session2.sandbox.BorionDurableQueue.pendingOnly();
  assert(pendingSession2.length===1 && pendingSession2[0].id==='op-1', 'a operação pendente deve reaparecer na próxima sessão — nada foi perdido por fechar a aba');

  // Só agora "confirma" (equivalente a: o arquivo de operação foi criado com
  // sucesso no Drive) — a partir daqui pode ser arquivada.
  await session2.sandbox.BorionDurableQueue.confirmRemote('op-1');
  const stillPendingAfterConfirm = await session2.sandbox.BorionDurableQueue.pendingOnly();
  assert(stillPendingAfterConfirm.length===0, 'depois de confirmada, a operação não deve mais aparecer como pendente');
  const allAfterConfirm = await session2.sandbox.BorionDurableQueue.all();
  assert(allAfterConfirm.length===1 && allAfterConfirm[0].status==='confirmed', 'a operação confirmada continua registrada (arquivada), não é apagada instantaneamente');

  // sessionId, ao contrário de deviceId, deve ser NOVO a cada sessão.
  const session1Id = session1.sandbox.BorionDevice640.sessionId();
  const session2Id = session2.sandbox.BorionDevice640.sessionId();
  assert(session1Id !== session2Id, 'sessionId deve ser renovado a cada sessão/carregamento do app');

  console.log('OK: fila durável sobrevive ao fechamento da aba, só é liberada após confirmação remota real, e deviceId é estável entre sessões enquanto sessionId é renovado.');
})().catch(e=>{ console.error(e); process.exit(1); });
