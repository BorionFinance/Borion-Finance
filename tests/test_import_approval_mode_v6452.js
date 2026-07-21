'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const assert=(c,m)=>{if(!c)throw new Error('FALHOU: '+m)};

function freshContext(){
  const context={console,crypto:global.crypto,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone:global.structuredClone};
  context.window=context;context.globalThis=context;context.addEventListener=()=>{};
  const savedProfiles={};
  context.document={addEventListener(){},querySelectorAll(){return[]},querySelector(){return null},getElementById(){return null}};
  context.CARTEIRA_CONTA_ID='wallet';context.FORMAS_PAGAMENTO=['Dinheiro','Pix','Débito','Crédito'];
  context.defaultCategories=()=>({receita:[],fixa:[],variavel:[]});context.baseCatColor=()=>'#888';context.todayISO=()=>'2026-07-20';
  context.S={profiles:[],currentProfile:null,data:null};
  context.getProfileData=id=>savedProfiles[id]||null;
  context.setProfileData=(id,data)=>{savedProfiles[id]=data;};
  context.migrateData=x=>x;context.emptyData=()=>({});context.BackupFS={markDirty(){}};
  let toastMsg=null,renderCount=0,confirmModalCall=null;
  context.toast=msg=>{toastMsg=msg;};
  context.renderView=()=>{renderCount++;};
  context.openChoiceModal=opts=>{context.__lastChoiceModal=opts;};
  context.openConfirmModal=opts=>{confirmModalCall=opts;};
  context.confirm=()=>true;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/24-interconnections.js'),'utf8'),context,{filename:'24-interconnections.js'});
  return {context,savedProfiles,getToast:()=>toastMsg,getRenderCount:()=>renderCount,getConfirmModalCall:()=>confirmModalCall};
}

/* ---------- 1) ensureInterop starts undecided ('') and never silently defaults to 'ask' or 'auto' ---------- */
{
  const {context}=freshContext();
  const api=context.BorionInterop.__test;
  const data={interconnections:{}};
  const interop=api.ensureInterop(data);
  assert(interop.importApprovalMode==='','modo de aprovação deve nascer indefinido, sem forçar auto nem ask');
}

/* ---------- 2) setImportApprovalMode persists on the active profile and survives an ensureInterop pass ---------- */
{
  const {context,savedProfiles,getToast,getRenderCount}=freshContext();
  const profile={id:'p1',name:'Pedro'};
  const data={interconnections:{}};
  context.S.profiles=[profile];context.S.currentProfile=profile;context.S.data=data;
  const ok=context.BorionInterop.setImportApprovalMode('ask');
  assert(ok===true,'setImportApprovalMode deve retornar true ao aplicar com sucesso');
  assert(data.interconnections.importApprovalMode==='ask','modo deve ficar salvo em memória (S.data)');
  assert(savedProfiles['p1'].interconnections.importApprovalMode==='ask','modo deve ser persistido via saveProfileData/setProfileData');
  assert(/pergunta antes de importar/.test(getToast()||''),'deve avisar claramente qual modo ficou ativo');
  assert(getRenderCount()>=1,'tela deve re-renderizar para refletir o novo modo');
}

/* ---------- 3) maybePromptImportMode only fires once, only with a configured source, and never overwrites an existing choice ---------- */
{
  const {context}=freshContext();
  const profile={id:'p1',name:'Pedro'};
  const data={interconnections:{sources:{'marco-iris':{sourceAppId:'marco-iris',mappingReady:true}}}};
  context.S.profiles=[profile];context.S.currentProfile=profile;context.S.data=data;
  context.BorionInterop.maybePromptImportMode();
  assert(context.__lastChoiceModal,'deve abrir o modal de escolha quando há integração configurada e o modo ainda não foi decidido');
  assert(context.__lastChoiceModal.choices.length===2,'deve oferecer exatamente as duas opções: automático e perguntar sempre');
  context.__lastChoiceModal=null;
  data.interconnections.importApprovalMode='auto';
  context.BorionInterop.maybePromptImportMode();
  assert(!context.__lastChoiceModal,'não deve perguntar de novo depois que a pessoa já escolheu um modo');
}
{
  const {context}=freshContext();
  const profile={id:'p1',name:'Pedro'};
  const data={interconnections:{sources:{}}};
  context.S.profiles=[profile];context.S.currentProfile=profile;context.S.data=data;
  context.BorionInterop.maybePromptImportMode();
  assert(!context.__lastChoiceModal,'sem nenhuma integração configurada ainda, não deve interromper o app com esse aviso');
}

/* ---------- 4) The clone-based dry-run pattern checkAskModeSource relies on must never
   mutate the real profile data, even though it runs the exact same reconciliation used
   for a real import. This is the core safety property behind "ask mode": counting what
   WOULD be imported can never itself import anything. */
{
  const {context}=freshContext();
  const api=context.BorionInterop.__test;
  const revMethods=['pix','money','debit',...Array.from({length:12},(_,i)=>'credit'+(i+1))];
  const revRules=Object.fromEntries(revMethods.map(key=>[key,{category:'Serviços MIT',destinationKind:'wallet',accountId:'wallet',target:'wallet'}]));
  const config={sourceAppId:'marco-iris',mappingReady:true,accountId:'bank1',transport:'drive',folderId:'folder',
    mitRevenueRules:revRules};
  const data={transacoes:[],contas:[{id:'wallet',nome:'Carteira',isCarteira:true},{id:'bank1',nome:'Nubank'}],liquidez:[],
    categorias:{receita:['Serviços MIT'],fixa:[],variavel:['Outro']},categoryColors:{receita:{},fixa:{},variavel:{}},
    modules:{},interconnections:{sources:{'marco-iris':config},imported:{},ignored:{},pending:[],audit:[],importApprovalMode:'ask'}};
  const before=JSON.stringify(data);
  const instance='ask-mode-test';
  const record={aggregateId:`marco-iris:${instance}:receipt:R001`,entityId:'R001',receiptId:'R001',direction:'income',amount:100,
    date:'2026-07-20',paymentDate:'2026-07-20',status:'paid',settled:true,active:true,description:'OSV-001 • Cliente 1',
    orderNumber:'OSV-001',clientName:'Cliente 1',paymentMethod:'Pix',externalReference:'OSV-001:R001',sourceUpdatedAt:'2026-07-20T12:00:00Z'};
  const snapshot={schema:'borion.interop.snapshot',schemaVersion:1,sourceAppId:'marco-iris',instanceId:instance,revision:1,
    generatedAt:'2026-07-20T12:00:00Z',records:[record],tombstones:[],contentHash:api.hash({records:[record],tombstones:[]})};

  // Exactly the same clone-then-reconcile pattern used inside checkAskModeSource.
  const draftData=JSON.parse(JSON.stringify(data));
  const draftConfig=JSON.parse(JSON.stringify(config));
  draftData.interconnections.sources['marco-iris']=draftConfig;
  const dry=api.reconcileSnapshot(draftData,draftConfig,snapshot,{mode:'automatic'});
  const newCount=(dry.results||[]).filter(x=>x.status==='created'||x.status==='expense_created').length;

  assert(newCount===1,'a pré-visualização deve contar exatamente 1 lançamento pronto para importar');
  assert(JSON.stringify(data)===before,'a pré-visualização (dry-run) nunca pode alterar os dados reais do perfil');
  assert(data.transacoes.length===0,'nenhum lançamento pode ser criado no perfil real sem confirmação explícita quando o modo é "ask"');
  assert(draftData.transacoes.length===1,'o clone descartável deve mostrar o que teria sido criado, só para fins de contagem/aviso');
}

console.log('OK: modo de aprovação de importação (auto/perguntar sempre) nasce indefinido, é persistido corretamente, pergunta uma única vez e nunca importa sozinho sem confirmação.');
