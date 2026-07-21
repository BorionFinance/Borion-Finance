'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const assert=(c,m)=>{if(!c)throw new Error('FALHOU: '+m)};
const source=fs.readFileSync(path.resolve(__dirname,'../js/24-interconnections.js'),'utf8');
const context={console,crypto:global.crypto,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone:global.structuredClone};
context.window=context;context.globalThis=context;context.addEventListener=()=>{};
context.document={addEventListener(){},querySelectorAll(){return[]},querySelector(){return null},getElementById(){return null},hidden:false};
context.CARTEIRA_CONTA_ID='wallet';context.FORMAS_PAGAMENTO=['Dinheiro','Pix','Débito','Crédito'];context.defaultCategories=()=>({receita:[],fixa:[],variavel:[]});context.baseCatColor=()=> '#888';context.todayISO=()=> '2026-07-21';
context.BorionSyncCore={recordTombstone(data,path,id,_device,_op,opts={}){data.__syncMeta||={tombstones:{}};data.__syncMeta.tombstones||={};data.__syncMeta.tombstones[path]||={};return data.__syncMeta.tombstones[path][String(id)]={entityId:String(id),reason:opts.reason||'delete'};}};
context.S={profiles:[],currentProfile:null,data:null};context.getProfileData=()=>null;context.setProfileData=()=>{};context.migrateData=v=>v;context.emptyData=()=>({});context.toast=()=>{};context.alert=()=>{};
vm.createContext(context);vm.runInContext(source,context,{filename:'24-interconnections.js'});
const methods=['pix','money','debit',...Array.from({length:12},(_,i)=>'credit'+(i+1))];
const rules=Object.fromEntries(methods.map(key=>[key,{category:'Receitas MIT',destinationKind:key==='money'?'wallet':'account',accountId:key==='money'?'wallet':'bank1',reserveId:null,target:key==='money'?'wallet':'account:bank1'}]));
const makeData=()=>({transacoes:[{id:'tx-imported',tipo:'receita',valor:100,reservaValor:0,accountId:'bank1',integrationSourceAppId:'marco-iris',integrationReceiptId:'REC-OLD',integrationEntityId:'REC-OLD',integrationAggregateId:'old-agg'}],contas:[{id:'wallet',nome:'Carteira',isCarteira:true},{id:'bank1',nome:'Banco'}],liquidez:[{id:'ledger-bank1',accountId:'bank1',ledgerType:'account_delta',nome:'Banco',valor:100}],categorias:{receita:['Receitas MIT'],fixa:[],variavel:[]},categoryColors:{receita:{},fixa:{},variavel:{}},modules:{},reservas:{boxes:[],moves:[]},interconnections:{sources:{},imported:{'marco-iris':{records:{'old-agg':{status:'imported',entityId:'REC-OLD',txId:'tx-imported'}}}},ignored:{},pending:[],audit:[],mitImported:{receipts:{'REC-OLD':{borionId:'tx-imported',aggregateId:'old-agg'}},expenses:{}}}});
const config={sourceAppId:'marco-iris',enabled:true,mappingReady:true,mitRevenueRules:rules,accountId:'bank1',mitExpenseRules:{},mitExpenseMappingReady:false,importCutoffAt:''};
const cancelled=(id,aggregate)=>({aggregateId:aggregate,sourceRecordId:'marco:receipt:'+id,entityId:id,receiptId:id,direction:'income',amount:100,date:'2026-07-20',paymentDate:'2026-07-20',status:'cancelled',active:false,settled:false,operationType:'cancel',sourceUpdatedAt:'2026-07-21T01:00:00Z'});
const snapshot={schema:'borion.interop.snapshot',schemaVersion:2,sourceAppId:'marco-iris',companyInstanceId:'company-ok',deviceId:'device-a',revision:5,recordCount:2,isCompleteSnapshot:true,records:[cancelled('REC-OLD','marco-iris:company-ok:receipt:REC-OLD'),cancelled('REC-NEW','marco-iris:company-ok:receipt:REC-NEW')],tombstones:[]};
const data=makeData();data.interconnections.sources['marco-iris']=config;
const result=context.BorionInterop.__test.reconcileMitSnapshot(data,config,snapshot,{mode:'automatic'});
assert(result.results.find(x=>x.entityId==='REC-OLD').result==='cancelled','receita importada e cancelada deve retornar cancelled');
assert(!data.transacoes.some(x=>x.id==='tx-imported'),'cancelamento deve remover o lançamento já importado');
assert(data.liquidez.find(x=>x.accountId==='bank1').valor===0,'cancelamento deve estornar o saldo aplicado');
assert(data.__syncMeta?.tombstones?.transacoes?.['tx-imported'],'cancelamento deve gravar tombstone contra ressurreição no Drive');
assert(data.interconnections.mitImported.receipts['REC-OLD'].status==='cancelled','ID antigo deve ficar aposentado para não ser reutilizado');
assert(result.results.find(x=>x.entityId==='REC-NEW').result==='cancelled','receita não importada e cancelada deve ser encerrada');
assert(data.transacoes.length===0,'receita cancelada sem importação não pode criar lançamento');
console.log('OK: cancelamento de receita remove lançamento importado, estorna saldo, grava tombstone e aposenta o ID antigo.');

const paid=(id,aggregate)=>({
  aggregateId:aggregate,sourceRecordId:'marco:receipt:'+id,entityId:id,receiptId:id,
  direction:'income',amount:100,date:'2026-07-21',paymentDate:'2026-07-21',
  status:'paid',active:true,settled:true,operationType:'upsert',
  description:'OSV-000286 • João da Silva',orderNumber:'OSV-000286',clientName:'João da Silva',
  paymentMethod:'Pix',sourceUpdatedAt:'2026-07-21T02:00:00Z'
});
const relaunchedId='REC-RELAUNCH';
const relaunchedAggregate='marco-iris:company-ok:receipt:'+relaunchedId;
const relaunchSnapshot={schema:'borion.interop.snapshot',schemaVersion:2,sourceAppId:'marco-iris',companyInstanceId:'company-ok',deviceId:'device-a',revision:6,recordCount:1,isCompleteSnapshot:true,records:[paid(relaunchedId,relaunchedAggregate)],tombstones:[]};
const relaunch=context.BorionInterop.__test.reconcileMitSnapshot(data,config,relaunchSnapshot,{mode:'automatic'});
const newResult=relaunch.results.find(x=>x.entityId===relaunchedId);
assert(newResult?.result==='imported','novo lançamento da mesma OSV, com novo REC, deve ser importado');
assert(newResult.borionTransactionId&&newResult.borionTransactionId!=='tx-imported','novo lançamento deve receber vínculo Borion totalmente novo');
assert(data.transacoes.length===1&&data.transacoes[0].integrationReceiptId===relaunchedId,'somente o novo REC deve permanecer ativo no Borion');
assert(data.liquidez.find(x=>x.accountId==='bank1').valor===100,'novo lançamento deve aplicar o saldo uma única vez');

const deleteSnapshot={
  schema:'borion.interop.snapshot',schemaVersion:2,sourceAppId:'marco-iris',companyInstanceId:'company-ok',deviceId:'device-a',revision:7,
  recordCount:0,isCompleteSnapshot:true,records:[],
  tombstones:[{sourceRecordId:'marco:receipt:'+relaunchedId,aggregateId:'marco:receipt:'+relaunchedId,operationType:'delete',deletedAt:'2026-07-21T03:00:00Z',reason:'source-record-removed'}]
};
const deleted=context.BorionInterop.__test.reconcileMitSnapshot(data,config,deleteSnapshot,{mode:'automatic'});
assert(deleted.results.find(x=>x.entityId===relaunchedId)?.result==='cancelled','tombstone do novo REC deve ser reconhecido como exclusão definitiva');
assert(data.transacoes.length===0,'exclusão definitiva deve remover o novo lançamento do Borion');
assert(data.liquidez.find(x=>x.accountId==='bank1').valor===0,'exclusão definitiva deve estornar o saldo do novo lançamento');
assert(data.interconnections.mitImported.receipts[relaunchedId].status==='cancelled','novo REC excluído também deve ser aposentado');
console.log('OK: relançamento da mesma OSV cria vínculo novo e a exclusão definitiva remove e estorna esse novo lançamento.');
