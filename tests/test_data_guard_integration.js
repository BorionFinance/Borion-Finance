'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
function loadSource(name){ return fs.readFileSync(path.join(root,'js',name),'utf8'); }

function makeSandbox(){
  const store={};
  const sandbox={
    console, Object, Array, String, Number, JSON, Math, Promise, Date,
    localStorage:{ getItem:k=>store[k]??null, setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];} },
    document:{ querySelector:()=>null, createElement:()=>({}), head:{appendChild(){}}, addEventListener(){} },
    navigator:{ onLine:true },
    addEventListener(){},
    fetch:async ()=>{ throw new Error('fetch não deveria ser chamado neste teste (a checagem de segurança tem que interromper ANTES da rede).'); },
    toast(){}, // no-op
    window:null
  };
  sandbox.window=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(loadSource('01d-data-guard.js'),sandbox,{filename:'01d-data-guard.js'});
  // GoogleDriveAuth/GoogleDriveFS são `const` de topo de arquivo, não exportados em
  // window — só o objeto GoogleDriveProvider é. Para o teste conseguir injetar um
  // token falso e substituir GoogleDriveFS por um stub (sem rede real), expomos os
  // dois também em window, rodando essa linha extra NO MESMO contexto/escopo do
  // arquivo real (não é uma reimplementação — são os mesmos objetos por referência).
  const providerSource = loadSource('01c-google-drive-provider.js') + '\nwindow.GoogleDriveAuth=GoogleDriveAuth;\nwindow.GoogleDriveFS=GoogleDriveFS;\n';
  vm.runInContext(providerSource,sandbox,{filename:'01c-google-drive-provider.js'});
  return sandbox;
}

function assert(cond,msg){ if(!cond) throw new Error('FALHOU: '+msg); }

function accountPayload(profilesCounts){
  const profiles = Object.keys(profilesCounts).map(id=>({id,name:id}));
  const dataByProfile = {};
  Object.keys(profilesCounts).forEach(id=>{
    const c = profilesCounts[id];
    dataByProfile[id] = {
      transacoes: new Array(c.transacoes||0).fill(0), fixas:[], fixaPagamentos:[], liquidez:[], bens:[],
      contas:[], cartoes:[], boletos:[], transferencias:[], agenda:[], metas:[], assinaturas:[],
      investimentos:{emCaixa:[],ativos:[]}, cheques:{items:[]}
    };
  });
  return { profiles, dataByProfile };
}

// 1) _assertSafeToForceWrite NÃO lança quando não há baseline (primeira vez)
{
  const sb = makeSandbox();
  const provider = sb.GoogleDriveProvider;
  provider.folderId = 'folder-1';
  const payload = accountPayload({ pedro:{transacoes:0} });
  let threw=false;
  try{ provider._assertSafeToForceWrite(payload,{}); }catch(e){ threw=true; }
  assert(!threw, '_assertSafeToForceWrite não deveria lançar sem baseline conhecida');
}

// 2) _assertSafeToForceWrite BLOQUEIA uma queda suspeita usando a baseline do localStorage
{
  const sb = makeSandbox();
  const provider = sb.GoogleDriveProvider;
  provider.folderId = 'folder-2';
  sb.BorionDataGuard.writeLastGoodCounts('folder-2', sb.BorionDataGuard.countAccountRecords(accountPayload({ pedro:{transacoes:500} })));
  const emptyPayload = accountPayload({ pedro:{transacoes:0} });
  let err=null;
  try{ provider._assertSafeToForceWrite(emptyPayload,{}); }catch(e){ err=e; }
  assert(err, '_assertSafeToForceWrite deveria lançar quando os dados zeram');
  assert(err.code==='SUSPICIOUS_ACCOUNT_DROP', 'código do erro deveria ser SUSPICIOUS_ACCOUNT_DROP, veio '+ (err&&err.code));
}

// 3) options.acknowledgeSuspicious=true deixa passar mesmo com queda suspeita
{
  const sb = makeSandbox();
  const provider = sb.GoogleDriveProvider;
  provider.folderId = 'folder-3';
  sb.BorionDataGuard.writeLastGoodCounts('folder-3', sb.BorionDataGuard.countAccountRecords(accountPayload({ pedro:{transacoes:500} })));
  const emptyPayload = accountPayload({ pedro:{transacoes:0} });
  let threw=false;
  try{ provider._assertSafeToForceWrite(emptyPayload,{acknowledgeSuspicious:true}); }catch(e){ threw=true; }
  assert(!threw, 'acknowledgeSuspicious:true deveria permitir a gravação mesmo com queda suspeita');
}

// 4) syncNow() bloqueia e NUNCA chama fetch quando a queda é suspeita (a proteção
//    tem que interromper antes de qualquer chamada de rede, não só depois)
(async () => {
{
  const sb = makeSandbox();
  const provider = sb.GoogleDriveProvider;
  provider.folderId = 'folder-4';
  provider.currentFileId = 'file-4';
  provider.currentFileMeta = { modifiedTime: '2026-01-01T00:00:00.000Z' };
  provider.dirty = true;
  sb.BorionDataGuard.writeLastGoodCounts('folder-4', sb.BorionDataGuard.countAccountRecords(accountPayload({ pedro:{transacoes:500} })));
  sb.GoogleDriveAuth.user = { sub:'test', email:'test@example.invalid' };
  sb.GoogleDriveAuth.accessToken = 'tok';
  sb.GoogleDriveAuth.tokenExpiresAt = Date.now()+3600000;
  // getFileMeta usa fetch — como não queremos testar a rede aqui, simulamos "sem
  // conflito" respondendo com o mesmo modifiedTime já conhecido.
  sb.GoogleDriveFS.getFileMeta = async()=>({ modifiedTime: provider.currentFileMeta.modifiedTime });
  sb.GoogleDriveFS.updateFile = async()=>{ throw new Error('updateFile NÃO deveria ser chamado — a gravação deveria ter sido bloqueada antes.'); };
  sb.buildFullBackupPayload = async ()=> accountPayload({ pedro:{transacoes:0} });
  await provider.syncNow();
  assert(provider.dirty===true, 'depois de bloquear, dirty deveria continuar true (tenta de novo depois)');
  assert(!!provider.blockedSuspicious, 'blockedSuspicious deveria estar preenchido depois do bloqueio');
}

console.log('OK: todos os testes de integração do guard no google-drive-provider passaram.');
})();
