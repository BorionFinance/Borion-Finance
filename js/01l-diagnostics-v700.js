/* Borion Finance v7.0 — diagnóstico estruturado e sanitizado. */
(function(global){
'use strict';
const RELEASE=global.BORION_RELEASE||{label:'7.1.2',releaseId:'borion-7.1.2',schemaVersion:6401};
const DB_NAME='borion_diagnostics_v700';
const STORE='events';
const MAX_EVENTS=500;
let memory=[];

function now(){return new Date().toISOString();}
function maskEmail(value){
  const s=String(value||''); const at=s.indexOf('@');
  if(at<1)return s?'<mascarado>':'';
  return s.slice(0,1)+'***'+s.slice(at);
}
function sanitize(value,depth=0,key=''){
  if(depth>6)return '[limite]';
  const lower=String(key||'').toLowerCase();
  if(/token|password|senha|hash|salt|secret|credential|authorization|avatarimage|photo|foto/.test(lower))return '[mascarado]';
  if(/email/.test(lower))return maskEmail(value);
  if(value==null||typeof value==='number'||typeof value==='boolean')return value;
  if(typeof value==='string')return value.length>240?value.slice(0,240)+'…':value;
  if(Array.isArray(value))return value.slice(0,30).map((v,i)=>sanitize(v,depth+1,String(i)));
  if(typeof value==='object'){
    const out={};
    for(const k of Object.keys(value).slice(0,60))out[k]=sanitize(value[k],depth+1,k);
    return out;
  }
  return String(value);
}
function openDb(){
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){reject(new Error('IndexedDB indisponível'));return;}
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('Falha ao abrir diagnóstico'));
  });
}
async function persist(event){
  memory.unshift(event);if(memory.length>MAX_EVENTS)memory.length=MAX_EVENTS;
  try{
    const db=await openDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
      store.put(event);
      const all=store.getAll();
      all.onsuccess=()=>{
        const rows=(all.result||[]).sort((a,b)=>String(b.at).localeCompare(String(a.at)));
        for(const row of rows.slice(MAX_EVENTS))store.delete(row.id);
      };
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>{const e=tx.error;db.close();reject(e);};
    });
  }catch(_){/* memória continua disponível */}
  return event;
}
function event(code,details={},level='info'){
  const rec={
    id:(global.crypto&&crypto.randomUUID)?crypto.randomUUID():('diag_'+Date.now()+'_'+Math.random().toString(36).slice(2)),
    at:now(),level:String(level||'info'),code:String(code||'UNKNOWN'),
    module:String(details.module||''),operation:String(details.operation||''),
    profileId:details.profileId==null?null:String(details.profileId),
    deviceId:details.deviceId==null?null:String(details.deviceId),
    sessionId:details.sessionId==null?null:String(details.sessionId),
    queueState:sanitize(details.queueState),driveState:sanitize(details.driveState),
    schema:Number(details.schema||RELEASE.schemaVersion||6401),releaseId:RELEASE.releaseId,
    appVersion:RELEASE.label,result:String(details.result||''),error:sanitize(details.error),
    recoveryAction:String(details.recoveryAction||''),context:sanitize(details.context||{})
  };
  persist(rec);return rec;
}
async function list(){
  try{
    const db=await openDb();
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly'),rq=tx.objectStore(STORE).getAll();
      rq.onsuccess=()=>resolve((rq.result||[]).sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,MAX_EVENTS));
      rq.onerror=()=>reject(rq.error);tx.oncomplete=()=>db.close();
    });
  }catch(_){return memory.slice();}
}
async function exportPayload(){
  return {type:'borion-sanitized-diagnostics',release:RELEASE,exportedAt:now(),events:await list()};
}
async function download(){
  const payload=await exportPayload();
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='borion-diagnostico-'+Date.now()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  return payload;
}

global.BorionDiagnostics700={event,list,exportPayload,download,sanitize,release:RELEASE};
})(window);
