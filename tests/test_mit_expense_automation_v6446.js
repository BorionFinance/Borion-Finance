'use strict';
/* V6.45.1 — Despesas do Marco Iris deixam de exigir revisão manual para
   Carteira/Pix/Débito/Reserva (Crédito continua manual de propósito).
   Também cobre a correção do ReferenceError em "localCompra" que travava
   toda importação manual de despesa fora do Crédito. */
const fs=require('fs'),vm=require('vm'),path=require('path');
function assert(c,m){if(!c)throw new Error('FALHOU: '+m)}
const SRC_PATH=path.join(__dirname,'../js/24-interconnections.js');
const SRC=fs.readFileSync(SRC_PATH,'utf8');

// Guarda de regressão: o bug original usava `localCompra` como atalho de objeto sem
// que essa variável existisse no escopo (só `localPurchase` existia), o que derrubava
// com ReferenceError qualquer despesa manual fora do Crédito. Garante que o padrão
// quebrado não volte e que a correção (`localCompra:localPurchase`) está presente.
(function localCompraRegressionGuard(){
  assert(!/nome:name,localCompra,/.test(SRC),'não pode reaparecer o atalho localCompra sem valor (ReferenceError)');
  assert((SRC.match(/localCompra:localPurchase/g)||[]).length>=2,'o modal de revisão manual deve gravar localCompra:localPurchase nos dois ramos (fixa e variável)');
  console.log('OK: padrão que causava o ReferenceError em localCompra não existe mais no modal de revisão manual.');
})();

let uidCounter=0;
function buildContext(){
  const context={console,crypto:global.crypto,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone:global.structuredClone};
  context.window=context;context.globalThis=context;context.addEventListener=()=>{};
  context.document={addEventListener(){},querySelectorAll(){return[]},querySelector(){return null},getElementById(){return null},createElement(){return{}}};
  context.CARTEIRA_CONTA_ID='wallet';context.FORMAS_PAGAMENTO=['Dinheiro','Pix','Débito','Crédito','Transferência'];
  context.defaultCategories=()=>({receita:[],fixa:[],variavel:[]});context.baseCatColor=()=>'#888';context.todayISO=()=>'2026-07-20';
  context.uid=()=>'uid-'+(++uidCounter);
  context.S={profiles:[],currentProfile:null,data:null};
  context.getProfileData=()=>null;context.setProfileData=()=>{};context.migrateData=x=>x;context.emptyData=()=>({});
  context.BackupFS={markDirty(){}};
  vm.createContext(context);
  vm.runInContext(SRC,context,{filename:'24-interconnections.js'});
  return context;
}
const context=buildContext();
const api=context.BorionInterop.__test;

function baseData(){
  return {
    transacoes:[],fixas:[],fixaPagamentos:[],
    contas:[{id:'wallet',nome:'Carteira',isCarteira:true},{id:'mp',nome:'Mercado Pago'},{id:'nubank',nome:'Nubank'}],
    liquidez:[],cartoes:[{id:'card1',banco:'Nubank Cartão'}],
    categorias:{receita:['Serviços','Serviços Marco Iris'],fixa:[],variavel:['Compras Marco Iris']},categoryColors:{receita:{},fixa:{},variavel:{}},
    modules:{reserves:true},
    reservas:{enabled:true,boxes:[{id:'house',nome:'Casa',accountId:'mp',banco:'Mercado Pago',valorAtual:500}],moves:[]},
    interconnections:{sources:{},imported:{},ignored:{},pending:[],audit:[]}
  };
}
function baseConfig(){
  return {
    sourceAppId:'marco-iris',mappingReady:true,accountId:'mp',
    mitRevenueRules:{},
    mitExpenseMappingReady:true,
    mitExpenseRules:{
      carteira:{key:'carteira',category:'Compras Marco Iris',destinationKind:'wallet',accountId:'wallet'},
      pix:{key:'pix',category:'Compras Marco Iris',destinationKind:'account',accountId:'mp'},
      debito:{key:'debito',category:'Compras Marco Iris',destinationKind:'account',accountId:'nubank'},
      credito:{key:'credito',category:'Compras Marco Iris',destinationKind:'card',cardId:'card1'},
      reserva:{key:'reserva',category:'Compras Marco Iris',destinationKind:'reserve',reserveId:'house'}
    }
  };
}
function expenseRecord(overrides={}){
  return Object.assign({
    aggregateId:'marco-iris:i:expense:'+(overrides.entityId||'e1'),
    entityId:'e1',direction:'expense',amount:80,date:'2026-07-20',dueDate:'2026-07-20',
    settled:true,active:true,status:'paid',name:'Peça para conserto',description:'Peça para conserto',
    localPurchase:'Loja do Zé',category:'',paymentOrigin:'Carteira',paymentMethod:'Dinheiro',
    expenseType:'variavel',externalReference:'e1'
  },overrides);
}

// mitExpenseMethodKey: classifica pela origem enviada, com fallback pela forma antiga.
(function methodKeyClassification(){
  assert(api.mitExpenseMethodKey({paymentOrigin:'Carteira'})==='carteira','Carteira deve mapear para carteira');
  assert(api.mitExpenseMethodKey({paymentOrigin:'Pix'})==='pix','Pix deve mapear para pix');
  assert(api.mitExpenseMethodKey({paymentOrigin:'Débito'})==='debito','Débito deve mapear para debito');
  assert(api.mitExpenseMethodKey({paymentOrigin:'Crédito'})==='credito','Crédito deve mapear para credito');
  assert(api.mitExpenseMethodKey({paymentOrigin:'Reserva'})==='reserva','Reserva deve mapear para reserva');
  assert(api.mitExpenseMethodKey({paymentOrigin:'',paymentMethod:'Dinheiro'})==='carteira','registro antigo sem paymentOrigin deve inferir pelo paymentMethod (Dinheiro→carteira)');
  assert(api.mitExpenseMethodKey({paymentOrigin:'',paymentMethod:'PIX'})==='pix','registro antigo sem paymentOrigin deve inferir Pix como padrão restante');
  console.log('OK: mitExpenseMethodKey classifica origem nova e infere registros antigos sem quebrar.');
})();

// validateMitExpenseRules: Crédito nunca bloqueia a validação das outras origens.
(function validationSkipsCard(){
  const data=baseData(),cfg=baseConfig();
  cfg.mitExpenseRules.credito.cardId=null; // cartão não configurado
  const rules=api.validateMitExpenseRules(data,cfg,cfg.mitExpenseRules);
  assert(rules.carteira.accountId==='wallet'&&rules.pix.accountId==='mp'&&rules.reserva.reserveId==='house','demais origens devem validar normalmente mesmo com Crédito sem cartão');
  assert(rules.credito.destinationKind==='card','Crédito deve permanecer marcado como destino card (nunca auto-aplica)');
  let failed=false;const bad=baseConfig();bad.mitExpenseRules.reserva.reserveId=null;
  try{api.validateMitExpenseRules(data,bad,bad.mitExpenseRules)}catch(err){failed=/Escolha a reserva/.test(err.message)}
  assert(failed,'reserva não configurada deve bloquear apenas a validação da própria regra de reserva');
  console.log('OK: validateMitExpenseRules nunca deixa o Crédito travar as demais origens.');
})();

// commitMitExpenseAuto: Carteira variável paga aplica saldo e não precisa de revisão.
(function autoCarteiraVariavel(){
  const data=baseData(),cfg=baseConfig();
  const walletLedgerBefore=(data.liquidez||[]).find(l=>l.accountId==='wallet');
  assert(!walletLedgerBefore,'carteira não deve ter lançamento de saldo antes da despesa');
  const record=expenseRecord({entityId:'e1',paymentOrigin:'Carteira',amount:45.5,localPurchase:'Loja A'});
  const txId=api.commitMitExpenseAuto(data,cfg,record);
  const tx=data.transacoes.find(t=>t.id===txId);
  assert(tx&&tx.tipo==='variavel'&&tx.accountId==='wallet'&&tx.valor===45.5,'despesa via Carteira deve criar transação variável na conta Carteira');
  assert(tx.localCompra==='Loja A','local da compra enviado pelo Marco Iris deve chegar em localCompra (prova viva da correção do bug)');
  assert(tx.statusPagamento==='Pago'&&tx.integrationImportMode==='native-automatic','despesa paga deve ficar marcada como Paga e com o modo de importação automático');
  const walletLedger=(data.liquidez||[]).find(l=>l.accountId==='wallet');
  assert(walletLedger&&walletLedger.valor===-45.5,'saldo da Carteira deve ser debitado em 45.50');
  console.log('OK: despesa automática via Carteira cria a transação, aplica o saldo e preserva o local da compra.');
})();

// commitMitExpenseAuto: Reserva sem saldo suficiente falha (cai para revisão manual no fluxo completo).
(function autoReservaSaldoInsuficiente(){
  const data=baseData(),cfg=baseConfig();
  data.reservas.boxes[0].valorAtual=10; // saldo menor que o valor da despesa
  const record=expenseRecord({entityId:'e2',paymentOrigin:'Reserva',amount:80});
  let failed=false;
  try{api.commitMitExpenseAuto(data,cfg,record)}catch(err){failed=true}
  assert(failed,'despesa via Reserva sem saldo suficiente deve lançar erro (para cair na revisão manual)');
  assert(data.transacoes.length===0,'nenhuma transação parcial pode sobrar quando a reserva falha');
  console.log('OK: despesa automática via Reserva sem saldo falha sem deixar rastro, protegendo a fila de revisão.');
})();

// commitMitExpenseAuto: Crédito sempre lança erro — nunca aplica sozinho.
(function autoCreditoSempreManual(){
  const data=baseData(),cfg=baseConfig();
  const record=expenseRecord({entityId:'e3',paymentOrigin:'Crédito',amount:200});
  let failed=false,message='';
  try{api.commitMitExpenseAuto(data,cfg,record)}catch(err){failed=true;message=err.message;}
  assert(failed&&/revisão manual/.test(message),'despesa via Crédito deve sempre exigir revisão manual, mesmo com cartão configurado');
  console.log('OK: despesa via Crédito nunca é aplicada sozinha pela sincronização automática.');
})();

// commitMitExpenseAuto: despesa fixa via conta usa o helper seguro (não toca em S.*).
(function autoDespesaFixaSegura(){
  const data=baseData(),cfg=baseConfig();
  const record=expenseRecord({entityId:'e4',paymentOrigin:'Pix',amount:120,expenseType:'fixa',name:'Assinatura de software'});
  const fixedId=api.commitMitExpenseAuto(data,cfg,record);
  const fixed=data.fixas.find(f=>f.id===fixedId);
  assert(fixed&&fixed.origemPagamento==='conta'&&fixed.accountId==='mp','despesa fixa via Pix deve ser criada na conta configurada');
  const pagamento=data.fixaPagamentos.find(p=>p.fixaId===fixedId);
  assert(pagamento&&pagamento.pago===true,'despesa fixa paga deve gerar a ocorrência de pagamento do mês');
  const accountLedger=(data.liquidez||[]).find(l=>l.accountId==='mp');
  assert(accountLedger&&accountLedger.valor===-120,'saldo da conta deve refletir o pagamento da despesa fixa');
  assert(context.S.data===null&&context.S.reservas===undefined,'nada disso pode ter tocado no estado global S (a sincronização roda sobre um clone de outro perfil)');
  console.log('OK: despesa fixa automática usa o helper seguro e nunca mexe no estado global S.*.');
})();

// Fluxo completo via reconcileMitSnapshot: mistura de origens automáticas + Crédito manual.
(function fullReconcileMix(){
  const data=baseData(),cfg=baseConfig();
  function snap(records,revision){return {schema:'borion.interop.snapshot',schemaVersion:1,sourceAppId:'marco-iris',instanceId:'i',revision,records,tombstones:[],contentHash:api.hash({records,tombstones:[]})};}
  const records=[
    expenseRecord({entityId:'r1',aggregateId:'marco-iris:i:expense:r1',paymentOrigin:'Carteira',amount:30}),
    expenseRecord({entityId:'r2',aggregateId:'marco-iris:i:expense:r2',paymentOrigin:'Pix',amount:40}),
    expenseRecord({entityId:'r3',aggregateId:'marco-iris:i:expense:r3',paymentOrigin:'Débito',amount:50}),
    expenseRecord({entityId:'r4',aggregateId:'marco-iris:i:expense:r4',paymentOrigin:'Reserva',amount:60}),
    expenseRecord({entityId:'r5',aggregateId:'marco-iris:i:expense:r5',paymentOrigin:'Crédito',amount:70})
  ];
  let out=api.reconcileMitSnapshot(data,cfg,snap(records,1),{mode:'automatic'});
  assert(out.summary.createdExpenses===4,'quatro despesas (Carteira/Pix/Débito/Reserva) devem entrar sozinhas');
  assert(out.summary.pendingExpenses===1,'a despesa no Crédito deve ficar aguardando revisão');
  const pendingCredito=data.interconnections.pending.find(p=>p.aggregateId==='marco-iris:i:expense:r5');
  assert(pendingCredito,'a despesa no Crédito precisa aparecer na fila de revisão');
  assert(data.transacoes.filter(t=>t.integrationSourceAppId==='marco-iris').length===4,'quatro lançamentos nativos devem existir após a sincronização');

  // Segunda sincronização com o mesmo snapshot não pode duplicar nem reprocessar.
  out=api.reconcileMitSnapshot(data,cfg,snap(records,2),{mode:'automatic'});
  assert(out.summary.createdExpenses===0&&out.summary.unchanged===4,'segunda sincronização não pode recriar despesas já importadas automaticamente');
  assert(data.transacoes.filter(t=>t.integrationSourceAppId==='marco-iris').length===4,'quantidade de lançamentos não pode crescer na resincronização');
  console.log('OK: sincronização completa mistura despesas automáticas e despesa em Crédito aguardando revisão, sem duplicar.');
})();

// Sem a configuração de despesas ainda salva, tudo cai em revisão manual (comportamento antigo preservado).
(function fallbackWithoutExpenseMapping(){
  const data=baseData(),cfg=baseConfig();
  cfg.mitExpenseMappingReady=false;
  function snap(records,revision){return {schema:'borion.interop.snapshot',schemaVersion:1,sourceAppId:'marco-iris',instanceId:'i',revision,records,tombstones:[],contentHash:api.hash({records,tombstones:[]})};}
  const out=api.reconcileMitSnapshot(data,cfg,snap([expenseRecord({entityId:'r1',paymentOrigin:'Carteira',amount:30})],1),{mode:'automatic'});
  assert(out.summary.createdExpenses===0&&out.summary.pendingExpenses===1,'sem salvar as opções de despesa, tudo deve continuar indo para revisão manual (nada muda sem ação explícita)');
  console.log('OK: sem a configuração de despesas salva, o comportamento antigo (revisão manual) é preservado.');
})();

console.log('OK: automação de despesas do Marco Iris (Carteira/Pix/Débito/Reserva) validada; Crédito permanece manual por segurança.');
