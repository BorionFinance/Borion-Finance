'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/01c-google-drive-provider.js'),'utf8');
function assert(cond,msg){if(!cond)throw new Error('FALHOU: '+msg);}
function makeSandbox(){
  const sb={console,Object,Array,String,Number,JSON,Math,Promise,Date,Map,Set,URL,TextEncoder,
    window:null,navigator:{onLine:true},location:{protocol:'https:',hash:'',search:''},
    document:{hidden:false,visibilityState:'visible',addEventListener(){},getElementById(){return null},querySelector(){return null}},
    localStorage:{getItem(){return null},setItem(){},removeItem(){}},
    setTimeout(fn){fn();return 1},clearTimeout(){},setInterval(){return 1},clearInterval(){},addEventListener(){},fetch:null};
  sb.window=sb;vm.createContext(sb);
  vm.runInContext(source+'\nwindow.GoogleDriveFS=GoogleDriveFS;window.GoogleDriveAuth=GoogleDriveAuth;',sb);
  return sb;
}
(async()=>{
  const sb=makeSandbox(),FS=sb.GoogleDriveFS;
  const pages={
    '':{files:Array.from({length:1000},(_,i)=>({id:'id-'+String(i).padStart(4,'0'),name:'op-'+String(i).padStart(4,'0')})),nextPageToken:'p2'},
    p2:{files:Array.from({length:1000},(_,i)=>({id:'id-'+String(i+1000).padStart(4,'0'),name:'op-'+String(i+1000).padStart(4,'0')})),nextPageToken:'p3'},
    p3:{files:Array.from({length:500},(_,i)=>({id:'id-'+String(i+2000).padStart(4,'0'),name:'op-'+String(i+2000).padStart(4,'0')}))}
  };
  // Insere um duplicado entre páginas; a listagem final deve deduplicar por fileId.
  pages.p2.files.push({id:'id-0001',name:'op-0001'});
  FS.request=async url=>{
    const token=new URL(url).searchParams.get('pageToken')||'';
    return {ok:true,status:200,json:async()=>pages[token]};
  };
  const all=await FS.listQuery("'ops' in parents and trashed=false",{maxPages:10,maxItems:3000});
  assert(all.length===2500,'deve retornar todas as 2.500 operações das três páginas, sem duplicação');
  assert(all[0].id==='id-0000'&&all[2499].id==='id-2499','ordenação deve ser estável e determinística');

  let calls=0;
  FS.request=async url=>{
    calls++;
    const token=new URL(url).searchParams.get('pageToken')||'';
    if(token==='p2')return {ok:false,status:500,json:async()=>({})};
    return {ok:true,status:200,json:async()=>pages[token]};
  };
  let failed=null;try{await FS.listQuery("'ops' in parents and trashed=false",{maxPages:10,maxItems:3000});}catch(e){failed=e;}
  assert(failed&&failed.code==='DRIVE_LIST_INCOMPLETE'&&failed.page===2,'falha na segunda página deve abortar a listagem como incompleta');
  assert(calls===2,'não deve continuar nem avançar consolidação depois da página incompleta');

  // Retentativas HTTP: 429 e 500 são transitórios; 403 não é repetido.
  const sbRetry=makeSandbox(),RetryFS=sbRetry.GoogleDriveFS;
  RetryFS.authHeaders=async()=>({Authorization:'Bearer test'});
  let retryCalls=0;
  sbRetry.fetch=async()=>{
    retryCalls++;
    const status=retryCalls===1?429:(retryCalls===2?500:200);
    return {ok:status===200,status,headers:{get(){return null}},json:async()=>({ok:true})};
  };
  const retryRes=await RetryFS.request('https://example.invalid');
  assert(retryRes.status===200&&retryCalls===3,'429/500 devem usar retentativa exponencial e concluir quando a rede voltar');
  retryCalls=0;
  sbRetry.fetch=async()=>{retryCalls++;return {ok:false,status:403,headers:{get(){return null}}};};
  const forbidden=await RetryFS.request('https://example.invalid');
  assert(forbidden.status===403&&retryCalls===1,'403 deve retornar imediatamente, sem loop de retentativa');

  console.log('OK: paginação completa retorna 2.500 itens, deduplica, falha fechada em página incompleta e trata 429/500/403 corretamente.');
})().catch(e=>{console.error(e);process.exit(1);});
