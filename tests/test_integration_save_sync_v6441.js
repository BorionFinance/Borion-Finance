'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const assert=(c,m)=>{if(!c)throw new Error('FALHOU: '+m)};
const source=fs.readFileSync(path.resolve(__dirname,'../js/24-interconnections.js'),'utf8');

assert(source.includes("BorionInterop.saveMappings('${sourceAppId}')\">Salvar opções"),'Amanda deve ter botão exclusivo para salvar opções');
assert(source.includes("BorionInterop.syncSource('${sourceAppId}')")&&source.includes('>Sincronizar agora</button>'),'Amanda deve ter botão separado para sincronizar');
assert(source.includes("BorionInterop.saveMitSettings({button:this})\">Salvar opções"),'Marco deve ter botão exclusivo para salvar opções');
assert(source.includes("BorionInterop.syncSource('marco-iris',{button:this})"),'Marco deve ter botão separado para sincronizar');
assert(!source.includes("saveMappings('${sourceAppId}',{sync:true})")&&!source.includes('saveMitSettings({sync:true})'),'nenhum botão pode juntar salvar e sincronizar');
assert(source.includes('Nenhuma importação foi executada'),'confirmação deve deixar claro que salvar não sincroniza');

(async()=>{
  let persisted=0,queued=0,rendered=0;
  const data={transacoes:[],contas:[{id:'carteira',nome:'Carteira',isCarteira:true},{id:'bank1',nome:'Nubank'}],liquidez:[],reservas:{enabled:true,boxes:[],moves:[]},modules:{reserves:true},categorias:{receita:['Outro'],fixa:[],variavel:['Outro']},interconnections:{sources:{'amanda-estetica':{sourceAppId:'amanda-estetica',mappingReady:false,mappings:{},discovered:{}},'marco-iris':{sourceAppId:'marco-iris',mappingReady:false,accountId:'bank1',transport:'drive',folderId:'folder',mitRevenueRules:{}}},imported:{},ignored:{},pending:[],audit:[]}};
  const context={console,crypto:global.crypto,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone:global.structuredClone};
  context.window=context;context.globalThis=context;context.addEventListener=()=>{};
  context.CARTEIRA_CONTA_ID='carteira';context.FORMAS_PAGAMENTO=['Pix','Dinheiro','Débito','Crédito'];context.defaultCategories=()=>({receita:['Outro'],fixa:[],variavel:['Outro']});context.baseCatColor=()=> '#888';context.todayISO=()=> '2026-07-20';
  context.S={profiles:[{id:'p1',name:'Perfil'}],currentProfile:{id:'p1',name:'Perfil'},data};
  context.getProfileData=()=>data;context.setProfileData=()=>{persisted++};context.migrateData=x=>x;context.emptyData=()=>({});
  context.GoogleDriveProvider={isConnected:()=>true,queueSave:()=>{queued++}};context.BackupFS={markDirty(){}};context.renderView=()=>{rendered++};context.toast=()=>{};context.alert=msg=>{throw new Error(msg)};
  const methods=['pix','money','debit',...Array.from({length:12},(_,i)=>'credit'+(i+1))];
  const ruleRows=methods.map(key=>({
    dataset:{mitRule:key},
    querySelector(sel){
      if(sel==='[data-mit-category]')return {value:'Outro'};
      if(sel==='[data-mit-destination-kind]')return {value:key==='money'?'wallet':'account'};
      if(sel==='[data-mit-account]')return {value:'bank1'};
      if(sel==='[data-mit-reserve]')return {value:''};
      return null;
    }
  }));
  context.document={addEventListener(){},querySelectorAll(sel){return sel==='[data-mit-rule]'?ruleRows:[]},querySelector(){return null},getElementById(){return null}};
  vm.createContext(context);vm.runInContext(source,context,{filename:'24-interconnections.js'});

  await context.BorionInterop.saveMappings('amanda-estetica');
  assert(data.interconnections.sources['amanda-estetica'].mappingReady===true,'salvar opções da Amanda deve marcar a configuração como pronta');
  assert(persisted===1&&queued===1&&rendered===1,'salvar Amanda deve persistir, enfileirar Drive e renderizar uma vez');

  const txBefore=data.transacoes.length;
  await context.BorionInterop.saveMitSettings();
  const mit=data.interconnections.sources['marco-iris'];
  assert(mit.mappingReady===true,'salvar opções do Marco deve marcar a configuração como pronta');
  assert(Object.keys(mit.mitRevenueRules).length===15,'salvar opções deve persistir as 15 regras');
  assert(mit.mitRevenueRules.money.destinationKind==='wallet'&&mit.mitRevenueRules.money.accountId==='carteira','Dinheiro deve persistir na Carteira');
  assert(!Object.values(mit.mitRevenueRules).some(rule=>'entryMethod' in rule||'entryMethodMode' in rule||'form' in rule),'novo formato não deve persistir controles antigos');
  assert(data.transacoes.length===txBefore,'Salvar opções não pode importar nem alterar lançamentos');
  assert(persisted===2&&queued===2&&rendered===2,'salvar Marco deve persistir e enfileirar sem sincronizar');
  console.log('OK: Amanda e Marco mantêm Salvar opções separado de Sincronizar agora; salvar persiste 15 regras e não altera saldos.');
})().catch(error=>{console.error(error);process.exit(1)});
