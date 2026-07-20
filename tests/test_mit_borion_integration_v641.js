'use strict';
const fs=require('fs');
const vm=require('vm');
const path=require('path');
function assert(cond,msg){if(!cond)throw new Error('FALHOU: '+msg);}
const context={console,crypto:global.crypto,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone:global.structuredClone};
context.window=context;context.globalThis=context;
context.document={addEventListener(){},querySelectorAll(){return[]},getElementById(){return null}};
context.addEventListener=()=>{};
context.CARTEIRA_CONTA_ID='carteira';
context.FORMAS_PAGAMENTO=['Pix','Dinheiro','Débito','Crédito'];
context.defaultCategories=()=>({receita:[],fixa:[],variavel:[]});
context.baseCatColor=()=> '#888';
context.todayISO=()=> '2026-07-20';
context.S={profiles:[],currentProfile:null,data:null};
context.getProfileData=()=>null;context.setProfileData=()=>{};context.migrateData=x=>x;context.emptyData=()=>({});
context.BackupFS={markDirty(){}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/24-interconnections.js'),'utf8'),context,{filename:'24-interconnections.js'});
const api=context.BorionInterop.__test;
const data={
  transacoes:[],contas:[{id:'carteira',nome:'Carteira',isCarteira:true},{id:'bank1',nome:'Nubank'}],
  liquidez:[],categorias:{receita:['Serviços MIT'],fixa:[],variavel:[]},categoryColors:{receita:{},fixa:{},variavel:{}},
  reservas:{boxes:[{id:'reserve1',nome:'Reserva MIT',banco:'Nubank',accountId:'bank1',valorAtual:0}],moves:[]},
  interconnections:{sources:{},imported:{},ignored:{},pending:[],audit:[]}
};
const config={sourceAppId:'marco-iris',mappingReady:true,accountId:'bank1',mitRevenueRules:{
  pix:{category:'Serviços MIT',target:'account:bank1'},
  money:{category:'Serviços MIT'},
  debit:{category:'Serviços MIT',target:'reserve:reserve1'},
  credit2:{category:'Serviços MIT',target:'account:bank1'}
}};
['pix','money','debit',...Array.from({length:12},(_,i)=>'credit'+(i+1))].forEach(key=>{
  if(!config.mitRevenueRules[key]) config.mitRevenueRules[key]={category:'Serviços MIT',target:'account:bank1'};
});
const instance='inst-test';
function rec(id,extra={}){
  return Object.assign({aggregateId:`marco-iris:${instance}:receipt:${id}`,entityId:id,receiptId:id,direction:'income',amount:150,date:'2026-07-20',paymentDate:'2026-07-20',status:'paid',settled:true,active:true,description:'OSV-000286 • Cliente Teste',orderNumber:'OSV-000286',clientName:'Cliente Teste',paymentMethod:'Pix',externalReference:`OSV-000286:${id}`},extra);
}
function expense(id,extra={}){
  return Object.assign({aggregateId:`marco-iris:${instance}:expense:${id}`,entityId:id,receiptId:id,direction:'expense',amount:80,date:'2026-07-20',status:'open',settled:false,active:true,name:'Peça comprada',description:'Peça comprada',localPurchase:'Fornecedor X',paymentMethod:'Pix',externalReference:id},extra);
}
function snapshot(records,revision=1){const tombstones=[];return {schema:'borion.interop.snapshot',schemaVersion:1,sourceAppId:'marco-iris',instanceId:instance,revision,records,tombstones,contentHash:api.hash({records,tombstones})};}
const records=[
  rec('REC-000001'),
  rec('REC-000002',{paymentDate:'2026-07-21',date:'2026-07-21',paymentMethod:'Crédito 2x'}),
  rec('REC-000003',{paymentDate:'',settled:false,status:'open'}),
  rec('REC-000004',{paymentMethod:'Dinheiro',amount:40}),
  rec('REC-000005',{paymentMethod:'Débito',amount:60}),
  expense('DES-000001')
];
let result=api.reconcileMitSnapshot(data,config,snapshot(records));
assert(result.summary.created===4,'Pix, crédito, dinheiro e débito pagos devem gerar quatro receitas');
assert(data.transacoes.length===4,'quatro RECs pagos devem criar exatamente quatro lançamentos');
assert(data.transacoes.every(tx=>tx.nome==='OSV-000286 • Cliente Teste'),'descrição deve ser OSV • Cliente');
assert(new Set(data.transacoes.map(tx=>tx.integrationReceiptId)).size===4,'cada REC deve permanecer independente');
const cash=data.transacoes.find(tx=>tx.integrationReceiptId==='REC-000004');
assert(cash.accountId==='carteira'&&cash.formaPagamento==='Dinheiro','Dinheiro deve entrar obrigatoriamente na Carteira');
const debit=data.transacoes.find(tx=>tx.integrationReceiptId==='REC-000005');
assert(debit.reservaBoxId==='reserve1'&&data.reservas.boxes[0].valorAtual===60,'Débito configurado para reserva deve creditar a reserva');
assert(data.interconnections.pending.length===1,'somente a despesa deve entrar em Aguardando Revisão');
assert(data.interconnections.pending[0].status==='Em aberto','status aberto do MIT deve ser preservado');
result=api.reconcileMitSnapshot(data,config,snapshot(records,2));
assert(result.summary.created===0&&data.transacoes.length===4,'segunda sincronização não pode duplicar REC');
const updated=records.map(r=>r.entityId==='REC-000003'?Object.assign({},r,{paymentDate:'2026-07-22',date:'2026-07-22',settled:true,status:'paid'}):r.entityId==='DES-000001'?Object.assign({},r,{settled:true,status:'paid',paymentDate:'2026-07-22'}):r);
result=api.reconcileMitSnapshot(data,config,snapshot(updated,3));
assert(result.summary.created===1&&data.transacoes.length===5,'REC deve entrar assim que recebe data de pagamento');
assert(data.interconnections.pending[0].status==='Pago','mudança da despesa para Pago deve atualizar a fila sem importar automaticamente');
// Simula a conclusão manual da revisão para confirmar que a despesa não volta.
data.interconnections.mitImported.expenses['DES-000001']={borionId:'expense-native-1',importedAt:'2026-07-22T12:00:00Z'};
data.interconnections.pending=[];
result=api.reconcileMitSnapshot(data,config,snapshot(updated,4));
assert(data.interconnections.pending.length===0,'despesa marcada como importada não pode reaparecer');
assert(result.results.some(row=>row.entityId==='DES-000001'&&row.status==='unchanged'),'despesa já importada deve retornar como unchanged');
// Renderização da área simplificada do MIT.
data.interconnections.sources['marco-iris']=config;
context.S.profiles=[{id:'p1',name:'Perfil Teste'}];context.S.currentProfile={id:'p1',name:'Perfil Teste'};context.S.data=data;
context.BorionInterop.setSettingsSource('marco-iris');
context.BorionInterop.setSettingsTab('links');
const html=context.BorionInterop.renderSettings();
assert(html.includes('Receitas e despesas')&&html.includes('Crédito 12x')&&html.includes('Aguardando Revisão'),'painel simplificado do MIT deve renderizar regras e fila de revisão');
console.log('OK: MIT/Borion importa receitas por REC, aceita pagamentos parciais, mapeia Pix/Dinheiro/Débito/Crédito, bloqueia duplicidade e mantém despesas em revisão.');
