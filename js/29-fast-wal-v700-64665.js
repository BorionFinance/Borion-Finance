/* Borion Finance - v7.9.7 - recuperacao local temporaria criptografada.
   Mantem somente o ultimo estado ainda nao confirmado pelo Google Drive e o
   remove assim que a confirmacao remota termina. Nenhum dado financeiro e
   gravado em texto puro no navegador. */
(function(global){
'use strict';

const RELEASE=(global.BORION_RELEASE&&BORION_RELEASE.label)||'7.9.7';
const DB_NAME='borion_fast_wal_v797';
const DB_VERSION=1;
const RECORDS='pending';
const KEYS='keys';
const DEVICE_KEY='device-aes-gcm-v1';
const LEGACY_DB='borion_fast_wal_v700_64665';
let keyPromise=null,drainPromise=null,queuedTask=null,sequenceSeed=Date.now();

function currentFolderId(){
  try{return String((global.GoogleDriveProvider&&GoogleDriveProvider.folderId)||'');}
  catch(_){return '';}
}
function recordKey(folderId){return 'folder:'+String(folderId||'');}
function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function openDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(RECORDS))db.createObjectStore(RECORDS);
      if(!db.objectStoreNames.contains(KEYS))db.createObjectStore(KEYS);
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('Falha ao abrir a recuperacao temporaria.'));
  });
}
async function dbGet(store,key){
  const db=await openDb();
  return await new Promise((resolve,reject)=>{
    const tx=db.transaction(store,'readonly'),req=tx.objectStore(store).get(key);
    req.onsuccess=()=>resolve(req.result||null);
    req.onerror=()=>reject(req.error||new Error('Falha ao ler a recuperacao temporaria.'));
    tx.oncomplete=()=>db.close();tx.onabort=()=>db.close();
  });
}
async function dbPut(store,key,value){
  const db=await openDb();
  return await new Promise((resolve,reject)=>{
    const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value,key);
    tx.oncomplete=()=>{db.close();resolve(true);};
    tx.onerror=()=>{const error=tx.error;db.close();reject(error||new Error('Falha ao proteger a recuperacao temporaria.'));};
    tx.onabort=tx.onerror;
  });
}
async function dbDelete(store,key){
  const db=await openDb();
  return await new Promise((resolve,reject)=>{
    const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);
    tx.oncomplete=()=>{db.close();resolve(true);};
    tx.onerror=()=>{const error=tx.error;db.close();reject(error||new Error('Falha ao limpar a recuperacao temporaria.'));};
    tx.onabort=tx.onerror;
  });
}
async function deviceKey(){
  if(keyPromise)return keyPromise;
  keyPromise=(async()=>{
    if(!global.crypto||!crypto.subtle)throw new Error('Criptografia segura indisponivel neste navegador.');
    const saved=await dbGet(KEYS,DEVICE_KEY);
    if(saved&&saved.type==='secret')return saved;
    const generated=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    await dbPut(KEYS,DEVICE_KEY,generated);
    return generated;
  })();
  try{return await keyPromise;}catch(error){keyPromise=null;throw error;}
}
function captureJson(options={}){
  if(typeof S==='undefined'||!S||!S.currentProfile||!S.data)return null;
  const folderId=String(options.folderId||currentFolderId()||'');
  if(!folderId)return null;
  const profileId=String(S.currentProfile.id||'');
  const profileTombstones=typeof getProfileTombstones==='function'?getProfileTombstones():{};
  const snapshot={
    schema:'borion.encrypted-pending-recovery.v1',
    profiles:clone(S.profiles||[]),
    profileId,
    data:clone(S.data),
    config:clone(S.config||{}),
    profileTombstones:clone(profileTombstones||{})
  };
  return {folderId,profileId,json:JSON.stringify(snapshot),reason:String(options.reason||'data_change'),operationId:String(options.operationId||'')||null,sequence:++sequenceSeed,capturedAt:Date.now()};
}
async function protect(task){
  const key=await deviceKey(),iv=crypto.getRandomValues(new Uint8Array(12));
  const plain=new TextEncoder().encode(task.json);
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain);
  const previous=await dbGet(RECORDS,recordKey(task.folderId));
  if(previous&&Number(previous.sequence)>Number(task.sequence))return previous;
  const record={
    schema:'borion.encrypted-pending-recovery.v1',release:RELEASE,folderId:task.folderId,
    profileId:task.profileId,reason:task.reason,operationId:task.operationId,
    sequence:task.sequence,capturedAt:task.capturedAt,iv:iv.buffer,cipher
  };
  await dbPut(RECORDS,recordKey(task.folderId),record);
  return record;
}
function startDrain(){
  if(drainPromise)return drainPromise;
  drainPromise=(async()=>{
    while(queuedTask){const task=queuedTask;queuedTask=null;await protect(task);}
    return true;
  })().catch(error=>{console.warn('[BORION][FAST_WAL][PERSIST_FAIL]',error);return false;}).finally(()=>{drainPromise=null;if(queuedTask)startDrain();});
  return drainPromise;
}
async function waitUntilIdle(){
  while(drainPromise||queuedTask){
    if(!drainPromise)startDrain();
    const active=drainPromise;
    if(active)await active;
  }
  return true;
}
function persistCurrent(options={}){
  try{
    const task=captureJson(options);if(!task)return Promise.resolve({saved:false,reason:'missing_current_profile_or_folder'});
    queuedTask=task;
    startDrain();
    return waitUntilIdle().then(async()=>{
      const record=await dbGet(RECORDS,recordKey(task.folderId));
      return {saved:!!(record&&Number(record.sequence)>=Number(task.sequence)),folderId:task.folderId,sequence:task.sequence};
    });
  }catch(error){console.warn('[BORION][FAST_WAL][CAPTURE_FAIL]',error);return Promise.resolve({saved:false,reason:String(error&&error.message||error)});}
}
async function waitForCurrent(reason='wait',timeoutMs=1200){
  if(typeof S!=='undefined'&&S&&S.currentProfile&&S.data)persistCurrent({reason});
  return await Promise.race([waitUntilIdle(),new Promise(resolve=>setTimeout(()=>resolve(false),Math.max(100,Number(timeoutMs)||1200)))]);
}
async function decryptRecord(record){
  const key=await deviceKey(),iv=new Uint8Array(record.iv),cipher=record.cipher;
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,cipher);
  return JSON.parse(new TextDecoder().decode(plain));
}
async function recover(folderId,remoteSnapshot){
  const id=String(folderId||currentFolderId()||'');if(!id||!remoteSnapshot)return null;
  const record=await dbGet(RECORDS,recordKey(id));if(!record)return null;
  try{
    const local=await decryptRecord(record),payload=clone(remoteSnapshot);
    const remoteProfiles=Array.isArray(payload.profiles)?payload.profiles:[];
    const localProfiles=Array.isArray(local.profiles)?local.profiles:[];
    const localIds=new Set(localProfiles.filter(Boolean).map(profile=>String(profile.id)));
    payload.profiles=localProfiles.concat(remoteProfiles.filter(profile=>profile&&!localIds.has(String(profile.id))));
    payload.dataByProfile=Object.assign({},payload.dataByProfile||{});
    if(local.profileId&&local.data)payload.dataByProfile[String(local.profileId)]=clone(local.data);
    payload.config=Object.assign({},payload.config||{},clone(local.config||{}));
    payload.__syncMeta640=Object.assign({},payload.__syncMeta640||{});
    payload.__syncMeta640.profileTombstones=Object.assign({},payload.__syncMeta640.profileTombstones||{},clone(local.profileTombstones||{}));
    return {payload,record};
  }catch(error){
    console.warn('[BORION][FAST_WAL][RECOVERY_FAIL]',error);
    return null;
  }
}
async function bindOperation(folderId,operationId,sequence){
  const id=String(folderId||currentFolderId()||'');if(!id||!operationId)return false;
  await waitUntilIdle();
  const key=recordKey(id),record=await dbGet(RECORDS,key);if(!record)return false;
  if(sequence&&Number(record.sequence)!==Number(sequence))return false;
  record.operationId=String(operationId);await dbPut(RECORDS,key,record);return true;
}
async function sequence(folderId){
  await waitUntilIdle();
  const id=String(folderId||currentFolderId()||'');if(!id)return 0;
  const record=await dbGet(RECORDS,recordKey(id));return Number(record&&record.sequence)||0;
}
async function confirm(folderId,operationId,confirmedSequence){
  await waitUntilIdle();
  const id=String(folderId||currentFolderId()||'');if(!id)return false;
  const key=recordKey(id),record=await dbGet(RECORDS,key);if(!record)return true;
  if(confirmedSequence&&Number(record.sequence)>Number(confirmedSequence))return false;
  if(operationId&&record.operationId&&String(record.operationId)!==String(operationId))return false;
  await dbDelete(RECORDS,key);return true;
}
async function status(folderId){
  const id=String(folderId||currentFolderId()||'');if(!id)return {release:RELEASE,pending:false,encrypted:true};
  const record=await dbGet(RECORDS,recordKey(id));
  return {release:RELEASE,folderId:id,pending:!!record,encrypted:true,record:record?{profileId:record.profileId,reason:record.reason,operationId:record.operationId,sequence:record.sequence,capturedAt:record.capturedAt}:null};
}

try{if(global.indexedDB)indexedDB.deleteDatabase(LEGACY_DB);}catch(_){}
deviceKey().catch(error=>console.warn('[BORION][FAST_WAL][KEY_WARMUP_FAIL]',error));
global.BorionFastWal700={release:RELEASE,persistCurrent,waitForCurrent,recover,bindOperation,sequence,confirm,status,_test:{recordKey,captureJson,decryptRecord}};
})(window);
