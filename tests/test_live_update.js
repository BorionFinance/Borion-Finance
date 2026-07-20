'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
function loadSource(name){ return fs.readFileSync(path.join(root,'js',name),'utf8'); }

function makeSandbox(opts={}){
  const store={};
  const profileDataStore={};
  let profilesList=[];
  const domState = { modalOpen: !!opts.modalOpen, activeTag: opts.activeTag||null, hidden: !!opts.hidden };
  const renders = { view:0, gate:0 };
  const toasts = [];

  const sandbox={
    console, Object, Array, String, Number, JSON, Math, Promise, Date, Set, setTimeout(){return 1;}, clearTimeout(){},
    CustomEvent:function(type,options){this.type=type;this.detail=options&&options.detail;},
    addEventListener(){}, dispatchEvent(){},
    localStorage:{ getItem:k=>store[k]??null, setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];} },
    document:{
      readyState:'complete', __borionEditGuardInstalled:false,
      hidden: domState.hidden,
      querySelector:(sel)=>{
        if(sel==='.modal-overlay') return domState.modalOpen ? {} : null;
        if(sel==='.gate-wrap') return domState.gateWrapPresent ? {} : null;
        return null;
      },
      activeElement: domState.activeTag ? { tagName: domState.activeTag, isContentEditable:false } : null,
      querySelectorAll(){ return []; },
      addEventListener(){}
    },
    navigator:{ onLine:true },
    window:null,
    // ---- stubs do resto do app (não fazem parte do arquivo testado) ----
    S: { currentProfile:null, data:null, profiles:[], gate:{mode:'list',error:''}, view:'overview', config:{} },
    setConfig(c){ sandbox.S.config=c; },
    setProfiles(list){ profilesList=list; sandbox.S.profiles=list; },
    getProfiles(){ return profilesList; },
    setProfileData(id,data){ profileDataStore[id]=data; },
    migrateData(d){ return d || {}; },
    emptyData(){ return {}; },
    validateBorionJson(obj){ return { valid: !!(obj && obj.type==='borion-account-backup'), errors: obj&&obj.type==='borion-account-backup'?[]:['tipo inválido'] }; },
    buildFullBackupPayload: async ()=>({ type:'borion-account-backup', profiles:[], dataByProfile:{} }),
    renderView(){ renders.view++; },
    renderGate(){ renders.gate++; },
    toast(msg){ toasts.push(msg); },
    setStorageMode(){}
  };
  sandbox.window=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(loadSource('01d-data-guard.js'),sandbox,{filename:'01d-data-guard.js'});
  vm.runInContext(loadSource('01j-remote-update-v642.js'),sandbox,{filename:'01j-remote-update-v642.js'});
  const providerSource = loadSource('01c-google-drive-provider.js') + '\nwindow.GoogleDriveFS=GoogleDriveFS;\nwindow.GoogleDriveAuth=GoogleDriveAuth;\n';
  vm.runInContext(providerSource,sandbox,{filename:'01c-google-drive-provider.js'});
  sandbox.GoogleDriveAuth.user = { sub:'test-user', email:'test@example.invalid' };
  sandbox.__renders = renders;
  sandbox.__toasts = toasts;
  sandbox.__domState = domState;
  return sandbox;
}

function assert(cond,msg){ if(!cond) throw new Error('FALHOU: '+msg); }

(async () => {

// 1) Nada mudou remotamente -> não faz nada, não chama readFile
{
  const sb = makeSandbox();
  const provider = sb.GoogleDriveProvider;
  provider.folderId='f1'; provider.currentFileId='file1';
  provider.currentFileMeta = { modifiedTime: '2026-01-01T00:00:00.000Z' };
  sb.GoogleDriveFS.getFileMeta = async ()=>({ modifiedTime: '2026-01-01T00:00:00.000Z' });
  sb.GoogleDriveFS.readFile = async ()=>{ throw new Error('readFile não deveria ser chamado quando nada mudou'); };
  const changed = await provider.checkForRemoteUpdate();
  assert(changed===false, 'checkForRemoteUpdate deveria retornar false quando modifiedTime não mudou');
  assert(sb.__renders.view===0 && sb.__renders.gate===0, 'não deveria re-renderizar nada');
}

// 2) Mudou remotamente, ninguém digitando, dentro de um perfil -> atualiza e chama renderView
{
  const sb = makeSandbox();
  const provider = sb.GoogleDriveProvider;
  provider.folderId='f2'; provider.currentFileId='file2';
  provider.currentFileMeta = { modifiedTime: '2026-01-01T00:00:00.000Z' };
  sb.S.currentProfile = { id:'pedro', name:'Pedro' };
  sb.S.data = { transacoes: [] };
  sb.GoogleDriveFS.getFileMeta = async ()=>({ modifiedTime: '2026-01-01T00:05:00.000Z' });
  sb.GoogleDriveFS.readFile = async ()=>({
    type:'borion-account-backup', profiles:[{id:'pedro',name:'Pedro'}],
    dataByProfile:{ pedro: { transacoes:[{id:'novo'}] } }
  });
  const changed = await provider.checkForRemoteUpdate();
  assert(changed===true, 'checkForRemoteUpdate deveria retornar true quando algo mudou e era seguro aplicar');
  assert(sb.__renders.view===1, 'deveria ter chamado renderView() uma vez');
  assert(sb.S.data.transacoes.length===1, 'S.data deveria refletir os dados novos do Drive');
  assert(provider.currentFileMeta.modifiedTime==='2026-01-01T00:05:00.000Z', 'currentFileMeta deveria ser atualizado');
  assert(sb.__toasts.length===1, 'deveria mostrar um toast avisando da atualização');
}

// 3) Mudou remotamente, mas existe uma alteração local pendente (dirty) -> NUNCA aplica
{
  const sb = makeSandbox();
  const provider = sb.GoogleDriveProvider;
  provider.folderId='f3'; provider.currentFileId='file3';
  provider.currentFileMeta = { modifiedTime: '2026-01-01T00:00:00.000Z' };
  provider.dirty = true;
  sb.GoogleDriveFS.getFileMeta = async ()=>{ throw new Error('nem deveria consultar metadados com dirty=true'); };
  const changed = await provider.checkForRemoteUpdate();
  assert(changed===false, 'com dirty=true, checkForRemoteUpdate não deveria fazer nada');
}

// 4) Mudou remotamente e há formulário realmente sujo -> baixa/valida, mas enfileira sem aplicar
{
  const sb = makeSandbox({ modalOpen:true });
  const provider = sb.GoogleDriveProvider;
  provider.folderId='f4'; provider.currentFileId='file4';
  provider.currentFileMeta = { modifiedTime: '2026-01-01T00:00:00.000Z' };
  sb.S.currentProfile = { id:'pedro', name:'Pedro' };
  sb.S.data = { transacoes: [] };
  sb.BorionEditGuard.markDirty('lancamento');
  let reads=0;
  sb.GoogleDriveFS.getFileMeta = async ()=>({ modifiedTime: '2026-01-01T00:05:00.000Z' });
  sb.GoogleDriveFS.readFile = async ()=>{reads++;return {type:'borion-account-backup',profiles:[{id:'pedro',name:'Pedro'}],dataByProfile:{pedro:{transacoes:[{id:'remoto'}]}}};};
  const changed = await provider.checkForRemoteUpdate();
  assert(changed===false, 'formulário sujo deve adiar a aplicação');
  assert(reads===1 && sb.RemoteUpdateQueue.hasPending(), 'snapshot remoto deve ser baixado, validado e mantido em fila');
  assert(sb.S.data.transacoes.length===0, 'formulário em andamento não pode ser sobrescrito');
  sb.RemoteUpdateQueue.clear();
}

// 5) Campo de pesquisa/input apenas focado, sem formulário sujo -> NÃO bloqueia atualização
{
  const sb = makeSandbox({ activeTag:'INPUT' });
  const provider = sb.GoogleDriveProvider;
  provider.folderId='f5'; provider.currentFileId='file5';
  provider.currentFileMeta = { modifiedTime: '2026-01-01T00:00:00.000Z' };
  sb.S.currentProfile = { id:'pedro', name:'Pedro' };
  sb.S.data = { transacoes: [] };
  sb.GoogleDriveFS.getFileMeta = async ()=>({ modifiedTime: '2026-01-01T00:05:00.000Z' });
  sb.GoogleDriveFS.readFile = async ()=>({type:'borion-account-backup',profiles:[{id:'pedro',name:'Pedro'}],dataByProfile:{pedro:{transacoes:[{id:'novo-pesquisa'}]}}});
  const changed = await provider.checkForRemoteUpdate();
  assert(changed===true, 'input apenas focado não pode bloquear atualização financeira');
  assert(sb.S.data.transacoes.length===1, 'dados remotos devem ser aplicados com campo de pesquisa focado');
}

// 6) Perfil ativo foi removido em outro dispositivo -> volta pro Gate com aviso
{
  const sb = makeSandbox();
  const provider = sb.GoogleDriveProvider;
  provider.folderId='f6'; provider.currentFileId='file6';
  provider.currentFileMeta = { modifiedTime: '2026-01-01T00:00:00.000Z' };
  sb.S.currentProfile = { id:'pedro', name:'Pedro' };
  sb.S.data = { transacoes: [] };
  sb.GoogleDriveFS.getFileMeta = async ()=>({ modifiedTime: '2026-01-01T00:05:00.000Z' });
  sb.GoogleDriveFS.readFile = async ()=>({
    type:'borion-account-backup', profiles:[{id:'amanda',name:'Amanda'}],
    dataByProfile:{ amanda: { transacoes:[] } }
  });
  await provider.checkForRemoteUpdate();
  assert(sb.S.currentProfile===null, 'deveria sair do perfil removido');
  assert(sb.__renders.gate===1, 'deveria renderizar o Gate depois do perfil sumir');
}

// 7) document.hidden=true (aba em segundo plano) -> não faz nada
{
  const sb = makeSandbox({ hidden:true });
  const provider = sb.GoogleDriveProvider;
  provider.folderId='f7'; provider.currentFileId='file7';
  provider.currentFileMeta = { modifiedTime: '2026-01-01T00:00:00.000Z' };
  sb.GoogleDriveFS.getFileMeta = async ()=>{ throw new Error('não deveria consultar nada com a aba em segundo plano'); };
  const changed = await provider.checkForRemoteUpdate();
  assert(changed===false, 'com document.hidden=true, não deveria fazer nada');
}

console.log('OK: todos os testes de checkForRemoteUpdate (atualização ao vivo) passaram.');
})().catch(e=>{ console.error(e); process.exit(1); });
