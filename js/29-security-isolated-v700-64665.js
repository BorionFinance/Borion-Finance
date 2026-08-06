/* Borion Finance — v7.0.2 SECURITY — Base v6.46.67
   Checkpoints, auditoria e diagnóstico em Worker isolado.
   Não envolve login, token, Drive, saveCurrentData, senha ou migração. */
(function(global){
'use strict';
const RELEASE=(global.BORION_RELEASE&&BORION_RELEASE.label)||'7.0';
const WORKER_URL='js/29b-security-worker-v700-64665.js?v='+((global.BORION_RELEASE&&BORION_RELEASE.releaseId)||'borion-7.1.2');
const PERIODIC_INTERVAL_MS=12000;
const CAPTURE_DEBOUNCE_MS=250;
let worker=null,timer=null,lastStatus=null,lastError='',lastCaptureAt=0;

function profileSnapshot(){
  try{
    if(typeof S==='undefined'||!S||!S.currentProfile||!S.data)return null;
    return {id:String(S.currentProfile.id||''),name:String(S.currentProfile.name||'Perfil'),data:S.data};
  }catch(_){return null;}
}
function ensureWorker(){
  if(worker)return worker;
  try{
    worker=new Worker(WORKER_URL);
    worker.onmessage=e=>{const msg=e&&e.data||{};if(msg.type==='status'){lastStatus=msg.status||null;lastError='';}else if(msg.type==='error')lastError=String(msg.error||'Falha no diagnóstico isolado');};
    worker.onerror=e=>{lastError=String(e&&e.message||'Falha no diagnóstico isolado');};
    return worker;
  }catch(error){lastError=String(error&&error.message||error);return null;}
}
function send(reason='periodic'){
  const p=profileSnapshot(),w=ensureWorker();
  if(!p||!w)return false;
  try{
    w.postMessage({type:'snapshot',release:RELEASE,profileId:p.id,profileName:p.name,capturedAt:new Date().toISOString(),reason:String(reason||'capture'),data:p.data});
    lastCaptureAt=Date.now();return true;
  }catch(error){lastError=String(error&&error.message||error);return false;}
}
function captureCurrent(reason='data_change',options={}){
  clearTimeout(timer);
  if(options.immediate)return send(reason);
  timer=setTimeout(()=>{timer=null;send(reason);},Math.max(0,Number(options.delayMs)||CAPTURE_DEBOUNCE_MS));
  return true;
}
function periodic(){if(Date.now()-lastCaptureAt>=PERIODIC_INTERVAL_MS)send('periodic');}
function status(){return {release:RELEASE,mode:'isolated-worker',started:!!worker,lastCaptureAt,lastStatus,lastError};}
function suspend(){clearTimeout(timer);timer=null;if(worker){try{worker.postMessage({type:'suspend'});}catch(_){}}}
setInterval(periodic,1000);
global.BorionSecurity700={status,captureCurrent,suspend};
})(window);
