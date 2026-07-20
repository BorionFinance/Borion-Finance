'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
function source(name){ return fs.readFileSync(path.join(root,'js',name),'utf8'); }
function assert(cond,msg){ if(!cond) throw new Error('FALHOU: '+msg); }

function makeSandbox(){
  const store={};
  const timers=[];
  const toasts=[];
  const sandbox={
    console, Object, Array, String, Number, JSON, Math, Promise, Date,
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
    renderGate(){},renderView(){},writeJSON(){},readJSON(){return null;}
  };
  sandbox.window=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source('01d-data-guard.js'),sandbox);
  vm.runInContext(source('01c-google-drive-provider.js')+'\nwindow.GoogleDriveProvider=GoogleDriveProvider;window.GoogleDriveFS=GoogleDriveFS;window.GoogleDriveAuth=GoogleDriveAuth;',sandbox);
  sandbox.GoogleDriveAuth.user={sub:'u1',email:'pedro@example.invalid'};
  sandbox.GoogleDriveProvider.folderId='folder';
  sandbox.GoogleDriveProvider.currentFileId='current';
  sandbox.GoogleDriveProvider.currentFileMeta={modifiedTime:'2026-07-19T17:00:00.000Z'};
  sandbox.__store=store; sandbox.__timers=timers; sandbox.__toasts=toasts;
  return sandbox;
}

(async()=>{
  // 1) Falha de rede/token não pode apagar o marcador pendente nem fingir sucesso.
  {
    const sb=makeSandbox();
    const p=sb.GoogleDriveProvider;
    p.dirty=true; p._syncRevision=1;
    sb.localStorage.setItem('borion_gdrive_pending_folder','1');
    sb.GoogleDriveFS.getFileMeta=async()=>({modifiedTime:p.currentFileMeta.modifiedTime});
    sb.GoogleDriveFS.updateFile=async()=>{ throw new Error('Falha ao salvar no Google Drive (status 401).'); };
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
    sb.GoogleDriveFS.getFileMeta=async()=>({modifiedTime:p.currentFileMeta.modifiedTime});
    sb.GoogleDriveFS.updateFile=async()=>({id:'current',modifiedTime:'2026-07-19T17:01:00.000Z'});
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
    sb.GoogleDriveFS.getFileMeta=async()=>({modifiedTime:p.currentFileMeta.modifiedTime});
    sb.GoogleDriveFS.updateFile=async()=>{
      p._syncRevision=6; // representa uma nova alteração entrando durante o upload
      p.dirty=true;
      sb.localStorage.setItem('borion_gdrive_pending_folder','2');
      return {id:'current',modifiedTime:'2026-07-19T17:02:00.000Z'};
    };
    const ok=await p.syncNow();
    assert(ok===false,'upload antigo não deve declarar a edição mais nova como confirmada');
    assert(p.dirty===true,'nova edição deve continuar pendente');
    assert(sb.localStorage.getItem('borion_gdrive_pending_folder'),'marcador da edição nova deve permanecer');
  }

  console.log('OK: sincronização fail-safe preserva pendências, retoma ao voltar e protege edições concorrentes.');
})().catch(e=>{console.error(e);process.exit(1);});
