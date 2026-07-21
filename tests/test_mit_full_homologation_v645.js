'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const assert=(c,m)=>{if(!c)throw new Error('FALHOU: '+m)};
const context={console,crypto:global.crypto,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone:global.structuredClone};
context.window=context;context.globalThis=context;context.addEventListener=()=>{};
context.document={addEventListener(){},querySelectorAll(){return[]},querySelector(){return null},getElementById(){return null}};
context.CARTEIRA_CONTA_ID='wallet';context.FORMAS_PAGAMENTO=['Dinheiro','Pix','Débito','Crédito'];context.defaultCategories=()=>({receita:[],fixa:[],variavel:[]});context.baseCatColor=()=> '#888';context.todayISO=()=> '2026-07-20';
context.S={profiles:[],currentProfile:null,data:null};context.getProfileData=()=>null;context.setProfileData=()=>{};context.migrateData=x=>x;context.emptyData=()=>({});context.BackupFS={markDirty(){}};
vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/24-interconnections.js'),'utf8'),context,{filename:'24-interconnections.js'});
const api=context.BorionInterop.__test;
const methods=['pix','money','debit',...Array.from({length:12},(_,i)=>'credit'+(i+1))];
const rules=Object.fromEntries(methods.map(key=>[key,{category:'Serviços MIT',destinationKind:key==='money'?'wallet':(key==='credit1'?'reserve':'account'),accountId:key==='money'?'wallet':(key==='credit1'?null:'bank1'),reserveId:key==='credit1'?'reserve1':null,target:key==='money'?'wallet':(key==='credit1'?'reserve:reserve1':'account:bank1')}]))
const config={sourceAppId:'marco-iris',mappingReady:true,accountId:'bank1',transport:'drive',folderId:'folder',mitRevenueRules:rules};
const data={transacoes:[],contas:[{id:'wallet',nome:'Carteira',isCarteira:true},{id:'bank1',nome:'Nubank'}],liquidez:[],categorias:{receita:['Serviços MIT'],fixa:[],variavel:['Outro']},categoryColors:{receita:{},fixa:{},variavel:{}},modules:{reserves:true},reservas:{enabled:true,boxes:[{id:'reserve1',nome:'Casa',accountId:'bank1',banco:'Nubank',valorAtual:0}],moves:[]},interconnections:{sources:{'marco-iris':config},imported:{},ignored:{},pending:[],audit:[]}};
const instance='homolog-v645';
function income(id,order,client,method,amount=100,extra={}){return Object.assign({aggregateId:`marco-iris:${instance}:receipt:${id}`,entityId:id,receiptId:id,direction:'income',amount,date:'2026-07-20',paymentDate:'2026-07-20',status:'paid',settled:true,active:true,description:`${order} • ${client}`,orderNumber:order,clientName:client,paymentMethod:method,externalReference:`${order}:${id}`,sourceUpdatedAt:'2026-07-20T12:00:00Z'},extra)}
function expense(id,status,settled,extra={}){return Object.assign({aggregateId:`marco-iris:${instance}:expense:${id}`,entityId:id,receiptId:id,direction:'expense',amount:80,date:'2026-07-20',status,settled,active:true,name:`Despesa ${id}`,description:`Despesa ${id}`,localPurchase:'Fornecedor',category:'Peças',paymentMethod:'Pix',externalReference:id},extra)}
function snapshot(records,revision){const tombstones=[];return {schema:'borion.interop.snapshot',schemaVersion:1,sourceAppId:'marco-iris',instanceId:instance,revision,generatedAt:'2026-07-20T12:00:00Z',records,tombstones,contentHash:api.hash({records,tombstones})}}
const records=[
 income('R001','OSV-001','Cliente 1','Pix'),
 income('R002','OSV-002','Cliente 2','Dinheiro'),
 income('R003','OSV-003','Cliente 3','Débito'),
 income('R004','OSV-004','Cliente 4','Crédito (À Vista)',100,{installments:1}),
 income('R005','OSV-005','Cliente 5','Crédito 2x',100,{installments:2}),
 income('R006','OSV-005','Cliente 5','Pix',50,{paymentDate:'',status:'open',settled:false}),
 income('R007','OSV-006','Cliente 6','Crédito 3x',100,{installments:3}),
 income('R008','OSV-006','Cliente 6','Crédito 4x',100,{installments:4}),
 income('R009','OSV-007','Cliente 7','Crédito 5x',100,{installments:5}),
 income('R010','OSV-007','Cliente 7','Crédito 6x',100,{installments:6}),
 income('R011','OSV-008','Cliente 8','Crédito 7x',100,{installments:7}),
 income('R012','OSV-008','Cliente 8','Crédito 8x',100,{installments:8}),
 income('R013','OSV-009','Cliente 9','Crédito 9x',100,{installments:9}),
 income('R014','OSV-009','Cliente 9','Crédito 10x',100,{installments:10}),
 income('R015','OSV-009','Cliente 9','Crédito 11x',100,{installments:11}),
 income('R016','OSV-010','Cliente 10','Crédito 12x',100,{installments:12}),
 income('R017','OSV-010','Cliente 10','Pix'),
 income('R018','OSV-010','Cliente 10','Dinheiro'),
 expense('D-A','paid',true),expense('D-B','open',false)
];
let result=api.reconcileMitSnapshot(data,config,snapshot(records,1));
assert(result.summary.created===17,'primeira sincronização deve criar exatamente 17 receitas elegíveis');
assert(data.transacoes.length===17,'devem existir exatamente 17 lançamentos nativos');
assert(result.summary.waitingReceipts===1,'pagamento sem Data de Pagamento deve aguardar');
assert(result.summary.pendingExpenses===2&&data.interconnections.pending.length===2,'duas despesas devem ficar em revisão, sem importação automática');
assert(data.interconnections.pending.find(x=>x.entityId==='D-A').status==='Pago','Despesa A deve aparecer como Pago');
assert(data.interconnections.pending.find(x=>x.entityId==='D-B').status==='Em aberto','Despesa B deve aparecer como Em aberto');
assert(new Set(data.transacoes.map(tx=>tx.integrationReceiptId)).size===17,'cada recebimento deve manter identidade própria');
assert(data.transacoes.filter(tx=>tx.integrationOrderNumber==='OSV-010').length===3,'múltiplas formas da mesma OSV devem gerar três receitas independentes');
assert(data.transacoes.find(tx=>tx.integrationReceiptId==='R004').formaPagamento==='Crédito','Crédito à vista deve permanecer Crédito');
assert(data.transacoes.find(tx=>tx.integrationReceiptId==='R004').data==='2026-07-20','paymentDate civil deve permanecer no mesmo dia');
assert(data.reservas.boxes[0].valorAtual===100&&data.reservas.moves.length===1,'destino Reserva deve ser aplicado exatamente uma vez');

const paidLater=records.map(r=>r.entityId==='R006'?Object.assign({},r,{paymentDate:'2026-07-21',date:'2026-07-21',status:'paid',settled:true,sourceUpdatedAt:'2026-07-21T10:00:00Z'}):r);
result=api.reconcileMitSnapshot(data,config,snapshot(paidLater,2));
assert(result.summary.created===1&&data.transacoes.length===18,'segunda sincronização deve criar exatamente a receita que ficou paga depois');
assert(new Set(data.transacoes.map(tx=>tx.integrationReceiptId)).size===18,'as 17 receitas anteriores não podem duplicar');

const changed=[...paidLater].reverse().map(r=>r.direction==='income'?Object.assign({},r,{description:r.description+' atualizado',clientName:r.clientName+' Silva'}):r);
result=api.reconcileMitSnapshot(data,config,snapshot(changed,3));
assert(result.summary.created===0&&data.transacoes.length===18,'reordenação e mudança de descrição/cliente não podem duplicar');
assert(data.reservas.moves.length===1&&data.reservas.boxes[0].valorAtual===100,'nova revisão não pode recriar movimento de reserva');

// Reconstrução de índices antigos a partir dos metadados dos lançamentos.
delete data.interconnections.mitImported;
data.interconnections.imported['marco-iris'].records={};
result=api.reconcileMitSnapshot(data,config,snapshot(changed,4));
assert(result.summary.created===0&&data.transacoes.length===18,'índice ausente deve ser reconstruído dos lançamentos existentes');
assert(Object.keys(data.interconnections.mitImported.receipts).length===18,'índice reconstruído deve conter os 18 receiptIds');

// Importação manual da Despesa A: não deve reaparecer; B permanece.
data.interconnections.mitImported.expenses['D-A']={borionId:'expense-native-A',importedAt:'2026-07-21T12:00:00Z'};
data.interconnections.pending=data.interconnections.pending.filter(x=>x.entityId!=='D-A');
result=api.reconcileMitSnapshot(data,config,snapshot(changed,5));
assert(!data.interconnections.pending.some(x=>x.entityId==='D-A'),'Despesa A importada manualmente não pode reaparecer');
assert(data.interconnections.pending.some(x=>x.entityId==='D-B'),'Despesa B deve permanecer aguardando revisão');
assert(result.results.some(x=>x.entityId==='D-A'&&x.status==='unchanged'),'Despesa A deve ser reconhecida como já importada');

// Corte de importação registra e repete com segurança sem criar receita.
config.importCutoffAt='2026-07-01T00:00:00.000Z';
const old=income('R-OLD','OSV-000','Cliente Antigo','Pix',100,{date:'2026-06-30',paymentDate:'2026-06-30'});
result=api.reconcileMitSnapshot(data,config,snapshot(changed.concat(old),6));
assert(result.summary.ignoredBeforeCutoff===1&&!data.transacoes.some(tx=>tx.integrationReceiptId==='R-OLD'),'registro anterior ao corte deve ser ignorado');
result=api.reconcileMitSnapshot(data,config,snapshot(changed.concat(old),7));
assert(result.summary.created===0&&!data.transacoes.some(tx=>tx.integrationReceiptId==='R-OLD'),'registro ignorado pelo corte não pode aparecer em repetição');
config.importCutoffAt='';

// Atomicidade: um 13x inválido depois de um novo registro válido não pode aplicar parcialmente nada.
const beforeHash=api.hash(data),beforeCount=data.transacoes.length,beforeReserveMoves=data.reservas.moves.length;
const validNew=income('R019','OSV-011','Cliente 11','Pix');
const invalid=income('R020','OSV-012','Cliente 12','Crédito 13x',100,{installments:13});
let failed=false;try{api.reconcileMitSnapshot(data,config,snapshot(changed.concat(validNew,invalid),8))}catch(error){failed=/entre 1 e 12/.test(error.message)}
assert(failed,'Crédito 13x deve cancelar a sincronização');
assert(data.transacoes.length===beforeCount&&data.reservas.moves.length===beforeReserveMoves&&api.hash(data)===beforeHash,'falha deve restaurar integralmente o estado anterior');

assert(api.beforeImportCutoff({importCutoffAt:'2026-07-01T00:00:00.000Z'},'2026-06-30')===true,'data civil anterior ao corte deve ser ignorada');
assert(api.beforeImportCutoff({importCutoffAt:'2026-07-01T00:00:00.000Z'},'2026-07-01')===false,'data civil no próprio dia do corte não pode mudar pelo fuso horário');
assert(data.interconnections.audit.length<=300&&data.interconnections.audit[0].sourceAppId==='marco-iris','histórico deve ser limitado e identificar a origem');
console.log('OK: homologação MIT criou 17+1 receitas, manteve despesas em revisão, bloqueou duplicidade, respeitou corte e garantiu atomicidade.');
