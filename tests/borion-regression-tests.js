#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const results = [];

function createContext(){
  const storage = new Map();
  const document = {
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    getElementById(){ return null; },
    addEventListener(){},
    body:{style:{},appendChild(){},removeChild(){},classList:{add(){},remove(){},toggle(){}}},
    documentElement:{setAttribute(){}},
    createElement(tag){
      return {
        tagName:String(tag||'').toUpperCase(),style:{},dataset:{},value:'',checked:false,disabled:false,
        classList:{add(){},remove(){},toggle(){}},content:{firstElementChild:null},
        appendChild(){},remove(){},setAttribute(){},addEventListener(){},querySelector(){return null;},querySelectorAll(){return []}
      };
    }
  };
  const ctx = {
    console,
    document,
    navigator:{onLine:false},
    localStorage:{
      getItem:k=>storage.has(k)?storage.get(k):null,
      setItem:(k,v)=>storage.set(k,String(v)),
      removeItem:k=>storage.delete(k)
    },
    crypto:crypto.webcrypto,
    Date, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, RegExp, Promise,
    setTimeout, clearTimeout,
    setInterval(){ return 0; }, clearInterval(){},
    Blob:function(){},
    URL:{createObjectURL(){return 'blob:test';},revokeObjectURL(){}},
    alert(){}, confirm(){return true;},
    fetch:async()=>({ok:false,json:async()=>({}),text:async()=>''}),
    TextEncoder, TextDecoder,
    indexedDB:{open(){ throw new Error('IndexedDB não deve ser usado nesta suíte unitária.'); }}
  };
  ctx.window=ctx;
  ctx.window.matchMedia=()=>({matches:false,addEventListener(){}});
  ctx.window.addEventListener=()=>{};
  ctx.BackupFS={markDirty(){},maybeAutoBackup(){}};
  ctx.saveCurrentData=()=>true;
  ctx.renderView=()=>{};
  ctx.renderApp=()=>{};
  ctx.renderGate=()=>{};
  ctx.toast=()=>{};
  ctx.closeModal=()=>{};
  ctx.openModal=()=>{};
  ctx.showBankRequiredModal=()=>{};
  ctx.openConfirmModal=({onConfirm})=>{ if(onConfirm) onConfirm(); };
  vm.createContext(ctx);
  return ctx;
}

function load(ctx, file){
  vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),ctx,{filename:file});
}
function run(ctx, code){ return vm.runInContext(code,ctx,{timeout:5000}); }
function test(name, fn){
  try{ fn(); results.push({name,status:'PASS'}); }
  catch(error){ results.push({name,status:'FAIL',error:error.stack||String(error)}); }
}
async function testAsync(name, fn){
  try{ await fn(); results.push({name,status:'PASS'}); }
  catch(error){ results.push({name,status:'FAIL',error:error.stack||String(error)}); }
}

(async()=>{
  const ctx=createContext();
  load(ctx,'js/00-utils.js');
  load(ctx,'js/01-storage-data-state.js');
  load(ctx,'js/05-calculations-charts.js');
  load(ctx,'js/09-patrimony-goals.js');
  load(ctx,'js/19-subscriptions.js');
  run(ctx,"todayISO=()=> '2026-07-12'; todayYM=()=>({y:2026,m:6}); toast=()=>{}; S.month={y:2026,m:6};");

  test('1 — Nubank excluída e recriada não herda −R$ 6.000, inclusive após recarregar',()=>{
    const out=run(ctx,`(()=>{
      S.data=migrateData(emptyData());
      const old={id:uid(),accountKind:'bank',active:true,createdAt:1,nome:'Nubank',tipo:'Conta corrente',saldoInicial:0};
      S.data.contas.push(old); adjustLiquidez(old.id,-6000);
      old.active=false; old.archivedAt=Date.now(); old.deletedAt=old.archivedAt;
      const fresh={id:uid(),accountKind:'bank',active:true,createdAt:Date.now(),nome:'Nubank',tipo:'Conta corrente',saldoInicial:0};
      S.data.contas.push(fresh);
      const before=contaSaldoAtual(fresh);
      const persisted=JSON.parse(JSON.stringify(S.data)); S.data=migrateData(persisted);
      const after=contaSaldoAtual(S.data.contas.find(c=>c.id===fresh.id));
      return {before,after,oldId:old.id,newId:fresh.id,oldBalance:contaSaldoAtual(S.data.contas.find(c=>c.id===old.id))};
    })()`);
    assert.notStrictEqual(out.oldId,out.newId);
    assert.strictEqual(out.before,0);
    assert.strictEqual(out.after,0);
    assert.strictEqual(out.oldBalance,-6000);
  });

  test('2 — Nova Nubank com saldo inicial R$ 1.000 começa em R$ 1.000',()=>{
    const out=run(ctx,`(()=>{S.data=migrateData(emptyData());const a={id:uid(),accountKind:'bank',active:true,createdAt:Date.now(),nome:'Nubank',saldoInicial:1000};S.data.contas.push(a);return contaSaldoAtual(a);})()`);
    assert.strictEqual(out,1000);
  });

  test('3 — Cartão/fatura Nubank de R$ 6.000 não reduz conta bancária de R$ 2.000',()=>{
    const out=run(ctx,`(()=>{S.data=migrateData(emptyData());const a={id:uid(),accountKind:'bank',active:true,nome:'Nubank',saldoInicial:2000};S.data.contas.push(a);S.data.cartoes.push({id:uid(),banco:'Nubank',limite:10000,faturasPagas:[],parcelas:[{id:uid(),descricao:'Fatura teste',valorParcela:6000,parcelaTotal:1,dataCompra:'2026-07'}]});return {conta:contaSaldoAtual(a),total:saldoEmContasTotal()};})()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out)),{conta:2000,total:2000});
  });

  test('4 — Duas contas Bradesco com mesmo nome permanecem independentes',()=>{
    const out=run(ctx,`(()=>{S.data=migrateData(emptyData());const a={id:uid(),accountKind:'bank',active:true,nome:'Bradesco',saldoInicial:30000};const b={id:uid(),accountKind:'bank',active:true,nome:'Bradesco',saldoInicial:15000};S.data.contas.push(a,b);adjustLiquidez(a.id,5000);return {a:contaSaldoAtual(a),b:contaSaldoAtual(b),total:contaSaldoAtual(a)+contaSaldoAtual(b),options:accountSelectOptions().filter(o=>o.label.startsWith('Bradesco'))};})()`);
    assert.strictEqual(out.a,35000); assert.strictEqual(out.b,15000); assert.strictEqual(out.total,50000);
    assert.strictEqual(out.options.length,2); assert.notStrictEqual(out.options[0].value,out.options[1].value);
  });

  test('5 — Renomear conta preserva saldo e histórico pelo mesmo accountId',()=>{
    const out=run(ctx,`(()=>{S.data=migrateData(emptyData());const a={id:uid(),accountKind:'bank',active:true,nome:'Bradesco',saldoInicial:30000};S.data.contas.push(a);const tx={id:uid(),tipo:'receita',nome:'Entrada',data:'2026-07-01',categoria:'Outro',valor:5000,accountId:a.id,banco:a.nome};S.data.transacoes.push(tx);applyTxSaldoEffect(tx);a.nome='Bradesco Principal';return {saldo:contaSaldoAtual(a),txAccountId:tx.accountId,accountId:a.id,ledgerAccountId:findLiquidezEntry(a.id,false).accountId};})()`);
    assert.strictEqual(out.saldo,35000); assert.strictEqual(out.txAccountId,out.accountId); assert.strictEqual(out.ledgerAccountId,out.accountId);
  });

  test('6 — Assinatura futura aparece em Despesa variável como Em aberto sem alterar saldo',()=>{
    const out=run(ctx,`(()=>{S.data=migrateData(emptyData());const a={id:uid(),accountKind:'bank',active:true,nome:'Conta teste',saldoInicial:1000};S.data.contas.push(a);const sub={id:'sub-futura',status:'ativa',createdKey:'2026-07',createdAt:1,versions:[{id:'v1',effectiveFrom:'2026-07',nome:'Streaming',categoria:'Assinaturas',tipo:'mensal',valor:100,diaVencimento:31,mesVencimento:null,formaPagamento:'Pix',accountId:a.id,banco:a.nome,cartaoId:null}],activityPeriods:[{from:'2026-07',to:null}],pauseHistory:[]};S.data.assinaturas.push(sub);Assinaturas.sync();const rec=assinaturaCobrancaFor(sub.id,'2026-07');const tx=S.data.transacoes.find(t=>t.assinaturaCobrancaId===rec.id);return {saldo:contaSaldoAtual(a),status:rec&&rec.status,forecast:assinaturasMes(2026,6),variavel:variavelMes(2026,6),despesas:despesasMes(2026,6),txStatus:tx&&tx.statusPagamento,count:S.data.assinaturaCobrancas.length};})()`);
    assert.strictEqual(out.saldo,1000); assert.strictEqual(out.status,'prevista'); assert.strictEqual(out.forecast,0); assert.strictEqual(out.variavel,100); assert.strictEqual(out.despesas,100); assert.strictEqual(out.txStatus,'Em aberto'); assert.strictEqual(out.count,1);
  });

  test('7 — Pausar em março e retomar em julho não cria março–junho nem retroatividade',()=>{
    const out=run(ctx,`(()=>{S.data=migrateData(emptyData());const a={id:uid(),accountKind:'bank',active:true,nome:'Conta',saldoInicial:5000};S.data.contas.push(a);const sub={id:'sub-pausa',status:'ativa',createdKey:'2026-01',versions:[{id:'v1',effectiveFrom:'2026-01',nome:'Academia',categoria:'Assinaturas',tipo:'mensal',valor:50,diaVencimento:31,formaPagamento:'Pix',accountId:a.id,banco:a.nome}],activityPeriods:[{from:'2026-01',to:null}],pauseHistory:[]};S.data.assinaturas.push(sub);S.month={y:2026,m:2};Assinaturas.pause(sub.id);S.month={y:2026,m:6};Assinaturas.resume(sub.id);const periods=S.data.assinaturaCobrancas.filter(r=>r.assinaturaId===sub.id).map(r=>r.period).sort();return {periods,activity:sub.activityPeriods,pause:sub.pauseHistory,mar:assinaturaActiveInPeriod(sub,'2026-03'),jun:assinaturaActiveInPeriod(sub,'2026-06'),jul:assinaturaActiveInPeriod(sub,'2026-07')};})()`);
    assert.strictEqual(out.mar,false); assert.strictEqual(out.jun,false); assert.strictEqual(out.jul,true);
    ['2026-03','2026-04','2026-05','2026-06'].forEach(k=>assert.ok(!out.periods.includes(k),k+' não deveria existir'));
  });

  test('8 — Editar assinatura para R$ 80 em julho mantém janeiro em R$ 50',()=>{
    const out=run(ctx,`(()=>{S.data=migrateData(emptyData());const sub={id:'sub-versionada',status:'ativa',createdKey:'2026-01',versions:[{id:'v1',effectiveFrom:'2026-01',nome:'Serviço',categoria:'Assinaturas',tipo:'mensal',valor:50,diaVencimento:10,formaPagamento:'Pix',accountId:'acc'}],activityPeriods:[{from:'2026-01',to:null}],pauseHistory:[]};S.data.assinaturas.push(sub);S.data.assinaturaCobrancas.push({id:'occ-jan',assinaturaId:sub.id,period:'2026-01',status:'cobrada',valor:50,snapshot:{valor:50,nome:'Serviço'}});sub.versions.push({id:'v2',effectiveFrom:'2026-07',nome:'Serviço',categoria:'Assinaturas',tipo:'mensal',valor:80,diaVencimento:10,formaPagamento:'Pix',accountId:'acc'});return {janRule:assinaturaVersionFor(sub,'2026-01').valor,julRule:assinaturaVersionFor(sub,'2026-07').valor,janOccurrence:S.data.assinaturaCobrancas[0].valor,janSnapshot:S.data.assinaturaCobrancas[0].snapshot.valor};})()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out)),{janRule:50,julRule:80,janOccurrence:50,janSnapshot:50});
  });

  test('9 — Excluir assinatura remove o cadastro e não deixa card fantasma',()=>{
    const out=run(ctx,`(()=>{S.data=migrateData(emptyData());S.month={y:2026,m:6};const sub={id:'sub-delete',status:'ativa',createdKey:'2026-01',versions:[{id:'v1',effectiveFrom:'2026-01',nome:'Serviço',categoria:'Assinaturas',tipo:'mensal',valor:50,diaVencimento:10,formaPagamento:'Pix',accountId:null}],activityPeriods:[{from:'2026-01',to:null}],pauseHistory:[]};S.data.assinaturas.push(sub);S.data.assinaturaCobrancas.push({id:'jan',assinaturaId:sub.id,period:'2026-01',status:'cobrada',valor:50,nome:'Serviço'},{id:'aug',assinaturaId:sub.id,period:'2026-08',status:'prevista',valor:50,nome:'Serviço'});Assinaturas.remove(sub.id);const html=renderAssinaturas();return {exists:S.data.assinaturas.some(a=>a.id===sub.id),linked:S.data.assinaturaCobrancas.filter(r=>r.assinaturaId===sub.id).length,records:S.data.assinaturaCobrancas.map(r=>({id:r.id,status:r.status,assinaturaId:r.assinaturaId,formerAssinaturaId:r.formerAssinaturaId,subscriptionDeleted:r.subscriptionDeleted})),ghost:/Excluída|Serviço/.test(html)};})()`);
    assert.strictEqual(out.exists,false); assert.strictEqual(out.linked,0); assert.strictEqual(out.ghost,false);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out.records)),[{id:'jan',status:'cobrada',assinaturaId:null,formerAssinaturaId:'sub-delete',subscriptionDeleted:true}]);
  });

  test('9B — Assinatura sem cobrança é apagada junto com todas as previsões',()=>{
    const out=run(ctx,`(()=>{S.data=migrateData(emptyData());const sub={id:'sub-clean',status:'ativa',createdKey:'2026-07',versions:[{id:'v1',effectiveFrom:'2026-07',nome:'Teste rápido',categoria:'Assinaturas',tipo:'mensal',valor:10,diaVencimento:31,formaPagamento:'Pix',accountId:null}],activityPeriods:[{from:'2026-07',to:null}],pauseHistory:[]};S.data.assinaturas.push(sub);S.data.assinaturaCobrancas.push({id:'prev',assinaturaId:sub.id,period:'2026-07',status:'prevista',valor:10});Assinaturas.remove(sub.id);return {subscriptions:S.data.assinaturas.length,occurrences:S.data.assinaturaCobrancas.length,html:renderAssinaturas()};})()`);
    assert.strictEqual(out.subscriptions,0); assert.strictEqual(out.occurrences,0); assert.doesNotMatch(out.html,/Teste rápido|Excluída/);
  });

  test('9C — Ghosts de versões antigas são limpos automaticamente ao sincronizar',()=>{
    const out=run(ctx,`(()=>{S.data=migrateData(emptyData());S.data.assinaturas=[{id:'ghost-old',nome:'Fantasma',status:'excluida',deletedFromKey:'2026-07'}];S.data.assinaturaCobrancas=[{id:'old-prev',assinaturaId:'ghost-old',period:'2026-08',status:'prevista'},{id:'old-paid',assinaturaId:'ghost-old',period:'2026-06',status:'paga',nome:'Fantasma'}];Assinaturas.sync();return {subscriptions:S.data.assinaturas.length,occurrences:S.data.assinaturaCobrancas.map(r=>({id:r.id,assinaturaId:r.assinaturaId,formerAssinaturaId:r.formerAssinaturaId,status:r.status}))};})()`);
    assert.strictEqual(out.subscriptions,0);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out.occurrences)),[{id:'old-paid',assinaturaId:null,formerAssinaturaId:'ghost-old',status:'paga'}]);
  });

  test('10 — Cartão inválido gera Falhou e nova tentativa não duplica',()=>{
    const out=run(ctx,`(()=>{S.data=migrateData(emptyData());S.month={y:2026,m:6};const sub={id:'sub-card',status:'ativa',createdKey:'2026-07',versions:[{id:'v1',effectiveFrom:'2026-07',nome:'Cloud',categoria:'Assinaturas',tipo:'mensal',valor:29.9,diaVencimento:1,formaPagamento:'Crédito',cartaoId:'card-x',accountId:null,banco:''}],activityPeriods:[{from:'2026-07',to:null}],pauseHistory:[]};S.data.assinaturas.push(sub);Assinaturas.sync();const rec=assinaturaCobrancaFor(sub.id,'2026-07');const failed={status:rec.status,error:rec.lastError,count:S.data.assinaturaCobrancas.length};S.data.cartoes.push({id:'card-x',banco:'Nubank',limite:1000,parcelas:[],faturasPagas:[]});Assinaturas.retry(rec.id);Assinaturas.retry(rec.id);Assinaturas.sync();return {failed,finalStatus:rec.status,occurrences:S.data.assinaturaCobrancas.filter(r=>r.assinaturaId===sub.id).length,parcelas:S.data.cartoes[0].parcelas.length,attempts:rec.attemptCount};})()`);
    assert.strictEqual(out.failed.status,'falhou'); assert.match(out.failed.error,/Cartão/);
    assert.strictEqual(out.finalStatus,'cobrada'); assert.strictEqual(out.occurrences,1); assert.strictEqual(out.parcelas,1); assert.strictEqual(out.attempts,2);
  });

  test('11 — Mutação financeira atômica restaura lançamento e saldo em caso de erro',()=>{
    const out=run(ctx,`(()=>{S.data=migrateData(emptyData());const a={id:'acc-atomic',accountKind:'bank',active:true,nome:'Conta',saldoInicial:1000};S.data.contas.push(a);const old={id:'tx-old',tipo:'variavel',nome:'Antigo',data:'2026-07-01',categoria:'Outro',valor:100,accountId:a.id,banco:a.nome,formaPagamento:'Pix',origemPagamento:'conta'};S.data.transacoes.push(old);applyTxSaldoEffect(old);const before=contaSaldoAtual(a);const ok=runAtomicFinancialMutation(()=>{reverseTxSaldoEffect(old);old.valor=999;applyTxSaldoEffect(old);throw new Error('falha simulada');});const current=S.data.contas.find(c=>c.id===a.id);const tx=S.data.transacoes.find(t=>t.id===old.id);return {ok,before,after:contaSaldoAtual(current),valor:tx.valor,count:S.data.transacoes.length};})()`);
    assert.strictEqual(out.ok,false); assert.strictEqual(out.before,900); assert.strictEqual(out.after,900); assert.strictEqual(out.valor,100); assert.strictEqual(out.count,1);
  });

  test('12 — Persistência mantém IDs isolados e ocorrências únicas',()=>{
    const out=run(ctx,`(()=>{S.data=migrateData(emptyData());const a={id:'persist-a',accountKind:'bank',active:true,nome:'Banco igual',saldoInicial:100};const b={id:'persist-b',accountKind:'bank',active:true,nome:'Banco igual',saldoInicial:200};S.data.contas.push(a,b);adjustLiquidez(a.id,25);S.data.assinaturaCobrancas=[{id:'occ',assinaturaId:'sub',period:'2026-07',status:'prevista'}];const json=JSON.stringify(S.data);S.data=migrateData(JSON.parse(json));return {a:contaSaldoAtual(S.data.contas.find(c=>c.id==='persist-a')),b:contaSaldoAtual(S.data.contas.find(c=>c.id==='persist-b')),occ:S.data.assinaturaCobrancas.filter(r=>r.assinaturaId==='sub'&&r.period==='2026-07').length};})()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out)),{a:125,b:200,occ:1});
  });

  test('Migração defensiva — único vínculo migra; homônimo ambíguo não migra; backup é anterior',()=>{
    const out=run(ctx,`(()=>{let d=emptyData();d.contas=[{nome:'Nubank',saldoInicial:0},{nome:'Bradesco',saldoInicial:0},{nome:'Bradesco',saldoInicial:0}];d.transacoes=[{id:'t1',tipo:'receita',nome:'A',valor:1,banco:'Nubank'},{id:'t2',tipo:'receita',nome:'B',valor:1,banco:'Bradesco'}];d=migrateData(d);const t1=d.transacoes.find(t=>t.id==='t1'),t2=d.transacoes.find(t=>t.id==='t2');const raw=d.migrationBackups.find(b=>b.kind==='before_account_id_v6231').snapshot;return {t1:!!t1.accountId,t2:t2.accountId||null,status:t2.accountMigrationStatus,review:d.accountMigrationReview.filter(r=>r.entityId==='t2').length,rawHadId:Object.prototype.hasOwnProperty.call(raw.contas[0],'id')};})()`);
    assert.strictEqual(out.t1,true); assert.strictEqual(out.t2,null); assert.strictEqual(out.status,'ambiguous'); assert.strictEqual(out.review,1); assert.strictEqual(out.rawHadId,false);
  });

  test('Migração defensiva — conta arquivada + nova homônima nunca recebe legado aleatoriamente',()=>{
    const out=run(ctx,`(()=>{let d=emptyData();d.contas=[{id:'old',nome:'Nubank',saldoInicial:0,active:false,archivedAt:1},{id:'new',nome:'Nubank',saldoInicial:0,active:true}];d.transacoes=[{id:'legacy',tipo:'receita',nome:'Legado',valor:1,banco:'Nubank'}];d=migrateData(d);const t=d.transacoes[0];return {accountId:t.accountId||null,status:t.accountMigrationStatus,candidates:d.accountMigrationReview[0]&&d.accountMigrationReview[0].candidateAccountIds};})()`);
    assert.strictEqual(out.accountId,null); assert.strictEqual(out.status,'ambiguous'); assert.deepStrictEqual(Array.from(out.candidates).sort(),['new','old']);
  });

  test('Cartões e seletores — crédito não recebe accountId e Banco/Conta exclui cartão/arquivada',()=>{
    const out=run(ctx,`(()=>{let d=emptyData();d.contas=[{id:'active',nome:'Conta Ativa',active:true},{id:'arch',nome:'Conta Arquivada',active:false,archivedAt:1}];d.cartoes=[{id:'card',banco:'Cartão Nubank',parcelas:[],faturasPagas:[]}];d.transacoes=[{id:'credit',tipo:'variavel',nome:'Compra',valor:100,banco:'Conta Ativa',formaPagamento:'Crédito',viaCartaoId:'card'}];S.data=migrateData(d);return {txAccountId:S.data.transacoes[0].accountId||null,accountOptions:accountSelectOptions().map(o=>o.value),cardOptions:cardSelectOptions().map(o=>o.value)};})()`);
    assert.strictEqual(out.txAccountId,null); assert.deepStrictEqual(Array.from(out.accountOptions),['carteira-fixa','active']); assert.deepStrictEqual(Array.from(out.cardOptions),['card']);
  });


  test('13 — Migração cria o histórico mensal e elimina duplicatas preservando o primeiro fechamento',()=>{
    const out=run(ctx,`(()=>{let d=emptyData();d.reservas.monthlyReports=[
      {id:'old',monthKey:'2026-03',closedAt:'2026-04-01T00:00:00.000Z',total:100,boxes:[],moves:[]},
      {id:'new',monthKey:'2026-03',closedAt:'2026-04-02T00:00:00.000Z',total:999,boxes:[],moves:[]},
      {id:'invalid',monthKey:'2026-13',total:1}
    ];d=migrateData(d);return {count:d.reservas.monthlyReports.length,id:d.reservas.monthlyReports[0].id,total:d.reservas.monthlyReports[0].total,summary:d.reservas.monthlyReports[0].summary};})()`);
    assert.strictEqual(out.count,1); assert.strictEqual(out.id,'old'); assert.strictEqual(out.total,100);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out.summary)),{entradas:0,saidas:0,rendimentos:0,movimentacoes:0});
  });

  test('14 — Fechamento dos Cofrinhos congela valores e somente movimentações da competência',()=>{
    const out=run(ctx,`(()=>{S.data=migrateData(emptyData());S.data.reservas.boxes=[
      {id:'box-a',nome:'Emergência',banco:'Nubank',valorAtual:3000,valorMeta:10000,status:'Ativa',cor:'#111111'},
      {id:'box-b',nome:'Viagem',banco:'Inter',valorAtual:1200,valorMeta:5000,status:'Pausada',cor:'#222222'}
    ];S.data.reservas.moves=[
      {id:'m1',boxId:'box-a',tipo:'Reservar',data:'2026-03-02',valor:500,descricao:'Aporte'},
      {id:'m2',boxId:'box-a',tipo:'Rendimento',data:'2026-03-31',valor:20,descricao:'Rendimento'},
      {id:'m3',boxId:'box-b',tipo:'Resgatar',data:'2026-04-01',valor:100,descricao:'Outro mês'}
    ];const saved=saveReservaMonthlyReport('2026-03');S.data.reservas.boxes[0].valorAtual=9000;S.data.reservas.boxes[0].nome='Emergência atualizada';S.data.reservas.moves[0].valor=999;const r=saved.report;return {created:saved.created,total:r.total,boxValue:r.boxes[0].valorAtual,boxName:r.boxes[0].nome,moves:r.moves.map(m=>m.id),moveValue:r.moves[0].valor,summary:r.summary};})()`);
    assert.strictEqual(out.created,true); assert.strictEqual(out.total,4200); assert.strictEqual(out.boxValue,3000); assert.strictEqual(out.boxName,'Emergência');
    assert.deepStrictEqual(Array.from(out.moves),['m1','m2']); assert.strictEqual(out.moveValue,500);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out.summary)),{entradas:520,saidas:0,rendimentos:20,movimentacoes:2});
  });

  test('15 — Mesmo mês fecha uma única vez e o snapshot sobrevive à serialização',()=>{
    const out=run(ctx,`(()=>{S.data=migrateData(emptyData());S.data.reservas.boxes=[{id:'b1',nome:'Casa',valorAtual:1000,valorMeta:50000,status:'Ativa'}];const a=saveReservaMonthlyReport('2026-05');S.data.reservas.boxes[0].valorAtual=2000;const b=saveReservaMonthlyReport('2026-05');const json=JSON.stringify(S.data);S.data=migrateData(JSON.parse(json));const r=S.data.reservas.monthlyReports[0];return {firstCreated:a.created,secondCreated:b.created,sameId:a.report.id===b.report.id,count:S.data.reservas.monthlyReports.length,total:r.total,boxValue:r.boxes[0].valorAtual};})()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out)),{firstCreated:true,secondCreated:false,sameId:true,count:1,total:1000,boxValue:1000});
  });

  test('16 — Comparação histórica usa ID, separa nomes iguais e identifica criado/removido',()=>{
    const out=run(ctx,`(()=>{S.data=migrateData(emptyData());const report={monthKey:'2026-06',total:300,boxes:[{id:'a',nome:'Reserva',valorAtual:100},{id:'b',nome:'Reserva',valorAtual:200}],moves:[],summary:{}};S.data.reservas.boxes=[{id:'a',nome:'Reserva',valorAtual:150},{id:'c',nome:'Reserva',valorAtual:50}];return reservaReportComparison(report).map(x=>({id:x.old.id,now:x.now&&x.now.id,createdAfter:x.createdAfter,removed:x.removed,old:x.old.valorAtual,current:x.now&&x.now.valorAtual}));})()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out)),[
      {id:'a',now:'a',createdAfter:false,removed:false,old:100,current:150},
      {id:'b',now:null,createdAfter:false,removed:true,old:200,current:null},
      {id:'c',now:'c',createdAfter:true,removed:false,old:0,current:50}
    ]);
  });

  test('17 — Conteúdo do relatório é somente leitura e não oferece ações de edição',()=>{
    const html=run(ctx,`(()=>{S.data=migrateData(emptyData());S.data.reservas.boxes=[{id:'b1',nome:'Reserva',valorAtual:100}];const r=buildReservaMonthlyReport('2026-07');return renderReservaMonthlyReport(r);})()`);
    assert.match(html,/somente para visualização/);
    assert.ok(!/<input\b/i.test(html)); assert.ok(!/contenteditable/i.test(html)); assert.ok(!/onclick=/i.test(html)); assert.ok(!/Reservas\.(edit|move|delete)/.test(html));
  });


  test('18 — Modal do histórico sobrescreve o limite global de 400px e usa rolagem interna',()=>{
    const css=fs.readFileSync(path.join(ROOT,'css/styles.css'),'utf8');
    const src=fs.readFileSync(path.join(ROOT,'js/09-patrimony-goals.js'),'utf8');
    assert.match(css,/\.reserve-report-modal\s*\{[\s\S]*?max-width:1180px!important/);
    assert.match(css,/\.reserve-report-modal\s*\{[\s\S]*?height:min\(900px,calc\(100vh - 36px\)\)/);
    assert.match(css,/\.reserve-report-scroll\s*\{[\s\S]*?overflow:auto/);
    assert.match(css,/\.reserve-report-summary strong\s*\{[\s\S]*?white-space:nowrap/);
    assert.match(src,/modal-overlay reserve-report-overlay/);
    assert.match(src,/id="rr_content" class="reserve-report-scroll"/);
  });

  test('19 — Acesso ao histórico ficou discreto e integrado à barra dos Cofrinhos',()=>{
    const css=fs.readFileSync(path.join(ROOT,'css/styles.css'),'utf8');
    const src=fs.readFileSync(path.join(ROOT,'js/09-patrimony-goals.js'),'utf8');
    assert.ok(!/function renderReservaReportsBanner\(/.test(src));
    assert.ok(!/reserve-history-banner/.test(src));
    assert.match(src,/function renderReservaReportsControls\(/);
    assert.match(src,/class="reserve-history-link"/);
    assert.match(src,/class="reserva-toolbar-actions"/);
    assert.match(css,/\.reserve-history-link,\.reserve-close-month-link\s*\{[\s\S]*?background:transparent/);
    assert.match(css,/\.reserve-history-link\s*\{[\s\S]*?opacity:\.72/);
  });

  load(ctx,'js/02-backup-local.js');
  await testAsync('Backup Drive&Local — snapshot possui mesmo ID, data-base, versão e checksum',async()=>{
    const snap=await run(ctx,`finalizeBackupSnapshot({type:'borion-account-backup',appVersion:'6.24.6',exportedAt:'2026-07-12T12:00:00.000Z',profiles:[],dataByProfile:{},integrity:{}},'manual_drive_local','backup manual conjunto Drive e dispositivo')`);
    assert.ok(snap.snapshotId); assert.strictEqual(snap.snapshotBaseDate,'2026-07-12T12:00:00.000Z'); assert.strictEqual(snap.appVersion,'6.24.6'); assert.strictEqual(snap.snapshotChecksum,snap.integrity.snapshotSha256); assert.strictEqual(snap.snapshotChecksum.length,64);
    const local=JSON.stringify(snap),drive=JSON.stringify(snap); assert.strictEqual(local,drive);
    const settings=fs.readFileSync(path.join(ROOT,'js/13-settings.js'),'utf8');
    assert.match(settings,/GoogleDriveProvider\.createBackup\(reason,\{payload:sharedSnapshot\}\)/);
    assert.match(settings,/Settings\._saveSnapshotLocally\(sharedSnapshot,reason,\{interactive:options\.interactive!==false\}\)/);
    const driveSource=fs.readFileSync(path.join(ROOT,'js/01c-google-drive-provider.js'),'utf8');
    assert.match(driveSource,/options\.payload \? options\.payload : await buildSharedBackupSnapshot/);
  });

  test('20 — Organizar módulos e itens aparece em Personalização, não em Módulos',()=>{
    const src=fs.readFileSync(path.join(ROOT,'js/13-settings.js'),'utf8');
    const modules=src.slice(src.indexOf('function renderSettingsModules()'),src.indexOf('function renderSettingsDashboard()'));
    const personalization=src.slice(src.indexOf('function renderSettingsPersonalization()'),src.indexOf('const Settings ='));
    assert.ok(!/renderModulesOrganizePanel/.test(modules));
    assert.match(personalization,/OrderPreferences\.renderModulesOrganizePanel\(\)/);
  });

  test('21 — Menu de ordem inicia em ORDEM e só revela Organizar ordem após escolher personalizada',()=>{
    if(!run(ctx,"typeof OrderPreferences!=='undefined'")) load(ctx,'js/18-order-preferences.js');
    const initial=run(ctx,"OrderPreferences.controlSelection={}; OrderPreferences.sortSelectHTML('reservas')");
    assert.match(initial,/<option value="" selected disabled>ORDEM<\/option>/);
    assert.match(initial,/>A a Z<\/option>/);
    assert.match(initial,/>Z a A<\/option>/);
    assert.match(initial,/>Mais recente primeiro<\/option>/);
    assert.match(initial,/>Mais antigo primeiro<\/option>/);
    assert.match(initial,/>Ordem personalizada<\/option>/);
    assert.ok(!/data-order-organize-type="reservas"/.test(initial));
    const custom=run(ctx,"OrderPreferences.controlSelection.reservas='manual'; OrderPreferences.sortSelectHTML('reservas')");
    assert.match(custom,/data-order-organize-type="reservas"/);
  });

  test('22 — Salvar organização faz o botão sumir e o menu voltar para ORDEM',()=>{
    const out=run(ctx,`(()=>{OrderPreferences.active=true;OrderPreferences.activeType='reservas';OrderPreferences.controlSelection={reservas:'manual'};OrderPreferences.pending={reservas:['c2','c1']};OrderPreferences.saveAll();return {active:OrderPreferences.active,selection:OrderPreferences.controlSelection,html:OrderPreferences.sortSelectHTML('reservas'),saved:OrderPreferences.getSavedOrder('reservas')};})()`);
    assert.strictEqual(out.active,false);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out.selection)),{});
    assert.match(out.html,/>ORDEM<\/option>/);
    assert.ok(!/data-order-organize-type="reservas"/.test(out.html));
    assert.deepStrictEqual(Array.from(out.saved),['c2','c1']);
  });

  await testAsync('23 — Autosave do Google Drive constrói snapshot válido e grava autosave-N.json',async()=>{
    const driveCtx=createContext();
    run(driveCtx,"const BORION_APP_VERSION='6.23.5'; async function buildSharedBackupSnapshot(type,reason){return {type,reason,profiles:[],snapshotId:'auto-test'};} async function buildFullBackupPayload(){return {profiles:[],snapshotId:'force-test'};} function validateBorionJson(){return {valid:true,errors:[]};} function applyAccountPayloadSilently(){} function setStorageMode(){} function setProfiles(){} function emptyData(){return {};} function migrateData(x){return x;} function getProfileData(){return null;} function idbGetProfileData(){return null;} function renderGoogleDriveOnboarding(){} function renderGoogleDriveReconnect(){} function renderGate(){} function toast(){};");
    load(driveCtx,'js/01c-google-drive-provider.js');
    run(driveCtx,`GoogleDriveAuth.user={sub:'u',email:'u@x.com'};GoogleDriveProvider.folderId='folder';GoogleDriveProvider.autosaveDirtySinceLast=true;GoogleDriveProvider._autosaveRevision=1;window.__driveWrites=[];GoogleDriveProvider.writeRotatingSnapshot=async(kind,slots,payload)=>{window.__driveWrites.push({kind,slots,payload});};`);
    const ok=await run(driveCtx,'GoogleDriveProvider.runAutosaveTick()');
    const writes=run(driveCtx,'window.__driveWrites');
    assert.strictEqual(ok,true); assert.strictEqual(writes.length,1); assert.strictEqual(writes[0].kind,'autosave'); assert.strictEqual(writes[0].slots,20); assert.strictEqual(writes[0].payload.snapshotId,'auto-test');
    assert.strictEqual(run(driveCtx,'GoogleDriveProvider.autosaveDirtySinceLast'),false);
    const src=fs.readFileSync(path.join(ROOT,'js/01c-google-drive-provider.js'),'utf8');
    const fn=src.slice(src.indexOf('async runAutosaveTick()'),src.indexOf('async syncNow()'));
    assert.ok(!/options\.payload/.test(fn)); assert.ok(!/document\.visibilityState===['"]hidden['"]/.test(fn));
  });

  await testAsync('24 — Um único Ctrl+S aguarda sincronização em andamento e cria forcesave',async()=>{
    const driveCtx=createContext();
    run(driveCtx,"const BORION_APP_VERSION='6.23.5'; async function buildSharedBackupSnapshot(){return {profiles:[]};} async function buildFullBackupPayload(){return {profiles:[{id:'p1'}],snapshotId:'force-one'};} function validateBorionJson(){return {valid:true,errors:[]};} function applyAccountPayloadSilently(){} function setStorageMode(){} function setProfiles(){} function toast(){};");
    load(driveCtx,'js/01c-google-drive-provider.js');
    run(driveCtx,`GoogleDriveAuth.user={sub:'u',email:'u@x.com'};GoogleDriveProvider.folderId='folder';GoogleDriveProvider.currentFileId='current';GoogleDriveProvider._syncInFlight=true;window.__forceWrites=[];GoogleDriveFS.updateFile=async(id,payload)=>({id,modifiedTime:String(Date.now()),payload});GoogleDriveProvider.writeRotatingSnapshot=async(kind,slots,payload)=>{window.__forceWrites.push({kind,slots,payload});};`);
    const promise=run(driveCtx,'GoogleDriveProvider.forceSyncNow()');
    setTimeout(()=>run(driveCtx,'GoogleDriveProvider._syncInFlight=false'),120);
    const ok=await promise;
    const writes=run(driveCtx,'window.__forceWrites');
    assert.strictEqual(ok,true); assert.strictEqual(writes.length,1); assert.strictEqual(writes[0].kind,'forcesave'); assert.strictEqual(writes[0].slots,40); assert.strictEqual(writes[0].payload.snapshotId,'force-one');
  });

  await testAsync('25 — Criar backup local grava um arquivo JSON real na pasta autorizada',async()=>{
    run(ctx,`window.__folderText='';window.__folderName='';BackupFS.dirHandle={queryPermission:async()=> 'granted',getFileHandle:async(name)=>{window.__folderName=name;return {createWritable:async()=>({write:async text=>{window.__folderText=text;},close:async()=>{}})};}};`);
    const result=await run(ctx,`BackupFS.writeToFolder({snapshotId:'local-json',profiles:[{id:'p'}]},'borion-backup-local',{interactive:true})`);
    assert.ok(result); assert.match(result.filename,/^borion-backup-local-.*\.json$/); assert.strictEqual(result.filename,run(ctx,'window.__folderName'));
    const written=JSON.parse(run(ctx,'window.__folderText')); assert.strictEqual(written.snapshotId,'local-json'); assert.strictEqual(written.profiles[0].id,'p');
  });

  test('26 — Backup rápido é atalho do manual e o local sempre produz JSON',()=>{
    const src=fs.readFileSync(path.join(ROOT,'js/13-settings.js'),'utf8');
    assert.match(src,/async manualBackup\(options=\{\}\)/);
    assert.match(src,/quickBackupBoth\(\)[\s\S]*?Settings\.manualBackup\(\{targets:'both',reason:'manual_drive_local'\}\)/);
    assert.match(src,/BackupFS\.verifyFolderConnection\(interactive\)/);
    assert.match(src,/BackupFS\.writeToFolder\(snapshot,'borion-backup-local',\{interactive:false\}\)/);
    assert.match(src,/downloadJSON\(snapshot,filename\)/);
    assert.match(src,/GoogleDriveProvider\.forceSyncNow\(\{payload:sharedSnapshot\}\)/);
    assert.match(src,/GoogleDriveProvider\.createBackup\(reason,\{payload:sharedSnapshot\}\)/);
    const local=fs.readFileSync(path.join(ROOT,'js/02-backup-local.js'),'utf8');
    assert.match(local,/async verifyFolderConnection\(interactive=false\)/);
    assert.match(local,/startupFolderStatus='connected'/);
    assert.match(local,/getFileHandle\(filename, \{create:true\}\)/);
  });

  test('27 — Reserva desligada oculta metas ligadas aos Cofrinhos e mantém metas independentes editáveis',()=>{
    const out=run(ctx,`(()=>{
      S.data=migrateData(emptyData());
      S.data.modules.reserves=false; S.data.reservas.enabled=false;
      S.data.reservas.boxes=[{id:'cofre-antigo',nome:'Emergência',valorAtual:5000,valorMeta:10000,metaId:'meta-ligada'}];
      S.data.metas=[
        {id:'meta-ligada',nome:'Emergência',valorAtual:5000,valorMeta:10000,reservaId:'cofre-antigo'},
        {id:'meta-livre',nome:'Casa',valorAtual:2000,valorMeta:80000}
      ];
      const visible=metasPatrimonioVisible().map(m=>m.id);
      const html=renderMetasList();
      const page=renderPatrimony();
      return {visible,html,page};
    })()`);
    assert.deepStrictEqual(Array.from(out.visible),['meta-livre']);
    assert.match(out.html,/Casa/); assert.ok(!/Emergência/.test(out.html));
    assert.match(out.page,/\+ Adicionar meta/); assert.match(out.page,/adicionar, editar e excluir/);
  });

  test('28 — Metas independentes viram Cofrinhos uma única vez e Cofrinhos antigos são preservados',()=>{
    const out=run(ctx,`(()=>{
      S.data=migrateData(emptyData());
      S.data.modules.reserves=false; S.data.reservas.enabled=false;
      S.data.contas.push({id:'acc1',nome:'Nubank',accountKind:'bank',active:true,saldoInicial:0});
      S.data.reservas.boxes=[{id:'antigo',nome:'Reserva antiga',valorAtual:700,valorMeta:1000,metaId:'meta-antiga'}];
      S.data.metas=[
        {id:'meta-antiga',nome:'Reserva antiga',valorAtual:700,valorMeta:1000,reservaId:'antigo'},
        {id:'meta-nova',nome:'Casa',emoji:'🏠',valorAtual:2500,valorMeta:90000,accountId:'acc1',banco:'Nubank',prazo:'2028-01-01',createdAt:10}
      ];
      const first=convertStandaloneMetasToReservas();
      const second=convertStandaloneMetasToReservas();
      const box=S.data.reservas.boxes.find(b=>b.convertedFromMetaId==='meta-nova');
      const meta=S.data.metas.find(m=>m.id==='meta-nova');
      return {first:first.length,second:second.length,count:S.data.reservas.boxes.length,oldStill:!!S.data.reservas.boxes.find(b=>b.id==='antigo'),box,meta};
    })()`);
    assert.strictEqual(out.first,1); assert.strictEqual(out.second,0); assert.strictEqual(out.count,2); assert.strictEqual(out.oldStill,true);
    assert.strictEqual(out.box.nome,'Casa'); assert.strictEqual(out.box.valorAtual,2500); assert.strictEqual(out.box.valorMeta,90000);
    assert.strictEqual(out.box.accountId,'acc1'); assert.strictEqual(out.meta.reservaId,out.box.id); assert.strictEqual(out.box.metaId,'meta-nova');
  });

  test('29 — Ligar Reserva em Configurações converte metas e mantém a conversão após desligar/ligar novamente',()=>{
    if(!run(ctx,"typeof Settings!=='undefined'")) load(ctx,'js/13-settings.js');
    const out=run(ctx,`(()=>{
      S.data=migrateData(emptyData());
      S.data.modules.reserves=false; S.data.reservas.enabled=false;
      S.data.reservas.boxes=[{id:'existente',nome:'Existente',valorAtual:100,valorMeta:500}];
      S.data.metas=[{id:'m1',nome:'Viagem',valorAtual:300,valorMeta:5000,createdAt:1}];
      Settings.toggleReservas();
      const afterFirst={enabled:reservasEnabled(),boxes:S.data.reservas.boxes.length,converted:S.data.reservas.boxes.filter(b=>b.convertedFromMetaId==='m1').length};
      Settings.toggleReservas();
      const hidden=metasPatrimonioVisible().map(m=>m.id);
      Settings.toggleReservas();
      const afterSecond={enabled:reservasEnabled(),boxes:S.data.reservas.boxes.length,converted:S.data.reservas.boxes.filter(b=>b.convertedFromMetaId==='m1').length};
      return {afterFirst,hidden,afterSecond};
    })()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out.afterFirst)),{enabled:true,boxes:2,converted:1});
    assert.deepStrictEqual(Array.from(out.hidden),[]);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out.afterSecond)),{enabled:true,boxes:2,converted:1});
  });

  test('30 — Modo automático usa Smartphone no celular e Pro no computador, com opção de forçar',()=>{
    const out=run(ctx,`(()=>{
      const original=window.matchMedia;
      S.config.uiMode='auto'; window.matchMedia=q=>({matches:q.includes('max-width'),addEventListener(){}}); const autoPhone=resolvedInterfaceMode();
      window.matchMedia=q=>({matches:false,addEventListener(){}}); const autoDesktop=resolvedInterfaceMode();
      S.config.uiMode='smartphone'; const forcedPhone=resolvedInterfaceMode();
      S.config.uiMode='pro'; const forcedPro=resolvedInterfaceMode();
      window.matchMedia=original;
      return {autoPhone,autoDesktop,forcedPhone,forcedPro};
    })()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out)),{autoPhone:'smartphone',autoDesktop:'pro',forcedPhone:'smartphone',forcedPro:'pro'});
  });

  test('31 — Smartphone Mode oferece início simples, ações rápidas e navegação inferior sem remover o menu completo',()=>{
    if(!run(ctx,"typeof SmartphoneMode!=='undefined'")) load(ctx,'js/20-smartphone-mode.js');
    const out=run(ctx,`(()=>{
      S.config.uiMode='smartphone';
      S.data=migrateData(emptyData());
      S.data.modules.reserves=true; S.data.reservas.enabled=true;
      S.data.contas.push({id:'acc',nome:'Nubank',accountKind:'bank',active:true,saldoInicial:1000});
      S.data.transacoes.push({id:'t1',tipo:'variavel',nome:'Mercado',data:'2026-07-12',categoria:'Mercado',valor:50,accountId:'acc',banco:'Nubank'});
      S.view='overview';
      return {home:renderSmartphoneOverview(),nav:SmartphoneMode.renderBottomNav()};
    })()`);
    assert.match(out.home,/Saldo em contas/); assert.match(out.home,/Entrada rápida/); assert.match(out.home,/Saída rápida/);
    assert.match(out.home,/Movimentar cofrinho/); assert.match(out.home,/Transferir/); assert.match(out.home,/Mercado/);
    assert.match(out.nav,/smart-bottom-nav/); assert.match(out.nav,/Lançar/); assert.match(out.nav,/Reservas/); assert.match(out.nav,/MobileMenu\.open/);
  });

  test('32 — Smartphone Mode está no HTML, no cache offline e possui estilos próprios',()=>{
    const index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
    const sw=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
    const css=fs.readFileSync(path.join(ROOT,'css/styles.css'),'utf8');
    assert.match(index,/js\/20-smartphone-mode\.js\?v=6\.27\.3/);
    assert.match(sw,/js\/20-smartphone-mode\.js/);
    assert.match(css,/html\[data-interface-mode="smartphone"\] \.smart-bottom-nav/);
    assert.match(css,/\.smart-quick-grid/); assert.match(css,/\.smart-launch-modal/);
  });



  test('33 — Botão Voltar fecha modal, volta ao Início e só então pede confirmação para sair',()=>{
    const modalRoot={children:[],_html:'',appendChild(node){this.children=[node];},get innerHTML(){return this._html;},set innerHTML(v){this._html=String(v);if(v==='')this.children=[];}};
    const sidebar={classList:{contains(){return false;}}};
    const buttons={smart_exit_stay:{},smart_exit_confirm:{}};
    const originalGet=ctx.document.getElementById, originalQuery=ctx.document.querySelector, originalEl=ctx.window.el;
    ctx.document.getElementById=id=>id==='modal-root'?modalRoot:(buttons[id]||null);
    ctx.document.querySelector=sel=>sel==='.sidebar'?sidebar:null;
    ctx.window.el=html=>({html});
    ctx.window.location={href:'https://borionfinance.github.io/Borion-Finance/',reload(){this.reloaded=true;}};
    ctx.window.history={state:null,replaced:0,pushed:0,lastGo:null,replaceState(s){this.state=s;this.replaced++;},pushState(s){this.state=s;this.pushed++;},go(n){this.lastGo=n;}};
    if(!run(ctx,"typeof SmartphoneHistory!=='undefined'")) load(ctx,'js/21-smartphone-history.js');
    const out=run(ctx,`(()=>{
      S.config.uiMode='smartphone'; S.currentProfile={id:'p1',name:'Teste'}; S.data=migrateData(emptyData()); S.view='budget';
      SmartphoneHistory.active=false; SmartphoneHistory.exitPromptOpen=false; SmartphoneHistory.lastLogicalBackAt=0; SmartphoneHistory.activate();
      const activated=history.state.__borionSmartHistory===SmartphoneHistory.GUARD && history.state.__borionSmartDepth===SmartphoneHistory.GUARD_DEPTH;
      history.state=SmartphoneHistory.makeState(7);
      const root=document.getElementById('modal-root'); root.children=[{}];
      SmartphoneHistory.lastLogicalBackAt=0; SmartphoneHistory.onPopState();
      const modalClosed=root.children.length===0 && history.state.__borionSmartDepth===SmartphoneHistory.GUARD_DEPTH && S.view==='budget';
      history.state=SmartphoneHistory.makeState(7); SmartphoneHistory.lastLogicalBackAt=0;
      SmartphoneHistory.onPopState();
      const wentHome=S.view==='overview' && history.state.__borionSmartDepth===SmartphoneHistory.GUARD_DEPTH;
      history.state=SmartphoneHistory.makeState(7); SmartphoneHistory.lastLogicalBackAt=0;
      SmartphoneHistory.onPopState();
      const askedExit=SmartphoneHistory.exitPromptOpen && root.children.length===1;
      return {activated,modalClosed,wentHome,askedExit};
    })()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out)),{activated:true,modalClosed:true,wentHome:true,askedExit:true});
    ctx.document.getElementById=originalGet; ctx.document.querySelector=originalQuery; ctx.window.el=originalEl;
  });

  test('34 — Confirmação explícita atravessa a reserva de oito sentinelas e evita segundo aviso',()=>{
    const originalTimeout=ctx.window.setTimeout;
    ctx.window.setTimeout=fn=>{fn();return 0;};
    run(ctx,`(()=>{ history.lastGo=null; window.__borionConfirmedExit=false; window.__borionInternalReload=false; SmartphoneHistory.confirmExit(); })()`);
    assert.strictEqual(ctx.history.lastGo,-9);
    assert.strictEqual(ctx.__borionConfirmedExit,true);
    ctx.window.setTimeout=originalTimeout;
  });

  test('35 — Gestos rápidos de Voltar contam como uma única ação lógica',()=>{
    const out=run(ctx,`(()=>{
      window.__borionConfirmedExit=false; window.__borionInternalReload=false;
      SmartphoneHistory.exitPromptOpen=false; SmartphoneHistory.lastLogicalBackAt=0; S.view='budget';
      history.state=SmartphoneHistory.makeState(7); SmartphoneHistory.onPopState();
      const afterFirst=S.view;
      history.state=SmartphoneHistory.makeState(7); SmartphoneHistory.onPopState();
      return {afterFirst,afterSecond:S.view,prompt:SmartphoneHistory.exitPromptOpen,depth:history.state.__borionSmartDepth};
    })()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out)),{afterFirst:'overview',afterSecond:'overview',prompt:false,depth:8});
  });

  test('36 — Histórico insistente está no HTML, cache offline e possui fallback beforeunload',()=>{
    const index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
    const sw=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
    const src=fs.readFileSync(path.join(ROOT,'js/21-smartphone-history.js'),'utf8');
    assert.match(index,/js\/21-smartphone-history\.js\?v=6\.27\.3/);
    assert.match(sw,/js\/21-smartphone-history\.js/);
    assert.match(src,/GUARD_DEPTH:8/);
    assert.match(src,/BACK_BURST_MS:650/);
    assert.match(src,/onBeforeUnload\(event\)/);
    assert.match(src,/history\.go\(-\(this\.GUARD_DEPTH\+1\)\)/);
  });

  test('37 — Mais oferece Salvar e atualizar com backup local, force save, update e reload',()=>{
    if(!run(ctx,"typeof SmartphoneMode!=='undefined'")) load(ctx,'js/20-smartphone-mode.js');
    const html=run(ctx,`(()=>{S.config.uiMode='smartphone';return SmartphoneMode.renderSidebarActions();})()`);
    assert.match(html,/Salvar e atualizar/);
    assert.match(html,/Force save \+ recarregar/);
    const src=fs.readFileSync(path.join(ROOT,'js/20-smartphone-mode.js'),'utf8');
    const shell=fs.readFileSync(path.join(ROOT,'js/04-gate-shell.js'),'utf8');
    const boot=fs.readFileSync(path.join(ROOT,'js/14-events-boot-pwa.js'),'utf8');
    assert.match(src,/storageProvider\.createBackup\('manual_quick'\)/);
    assert.match(src,/GoogleDriveProvider\.forceSyncNow\(\)/);
    assert.match(src,/registration\.update\(\)/);
    assert.match(src,/location\.reload\(\)/);
    assert.match(shell,/SmartphoneMode\.renderSidebarActions\(\)/);
    assert.match(boot,/registration\.update\(\)\.catch/);
  });


  test('38 — Dispensar popup preserva a notificação no sino e impede que o popup reapareça',()=>{
    if(!run(ctx,"typeof Notifs!=='undefined'")) load(ctx,'js/11-agenda-notifications.js');
    const out=run(ctx,`(()=>{
      S.data=migrateData(emptyData());
      S.data.agenda=[{id:'ag1',titulo:'Conta de luz',data:'2026-07-12',pago:false}];
      S.data.notificacoes=[{id:'n1',lembreteId:'ag1',tipo:'vencimento',lida:false,criadaEm:Date.now(),popupDispensadaEm:Date.now()}];
      return {popup:Notifs.unreadForPopup().length,total:S.data.notificacoes.length,lida:S.data.notificacoes[0].lida};
    })()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out)),{popup:0,total:1,lida:false});
  });

  test('39 — Marcar notificação como não lida rearma somente o popup, sem recriar o registro',()=>{
    if(!run(ctx,"typeof Notifs!=='undefined'")) load(ctx,'js/11-agenda-notifications.js');
    const out=run(ctx,`(()=>{
      S.data=migrateData(emptyData());
      S.data.agenda=[{id:'ag2',titulo:'Cartão',data:'2026-07-12',pago:false}];
      S.data.notificacoes=[{id:'n2',lembreteId:'ag2',tipo:'vencimento',lida:true,criadaEm:Date.now(),popupDispensadaEm:Date.now()}];
      Notifs.panelOpen=false; Notifs.toggleRead('n2');
      return {count:S.data.notificacoes.length,lida:S.data.notificacoes[0].lida,popupDispensadaEm:S.data.notificacoes[0].popupDispensadaEm,popup:Notifs.unreadForPopup().length};
    })()`);
    assert.strictEqual(out.count,1); assert.strictEqual(out.lida,false); assert.strictEqual(out.popupDispensadaEm,null); assert.strictEqual(out.popup,1);
  });

  test('40 — Notificações possuem gesto horizontal, exclusão com desfazer e central em bottom sheet',()=>{
    const src=fs.readFileSync(path.join(ROOT,'js/11-agenda-notifications.js'),'utf8');
    const css=fs.readFileSync(path.join(ROOT,'css/styles.css'),'utf8');
    assert.match(src,/bindSwipe\(node/);
    assert.match(src,/popupDispensadaEm/);
    assert.match(src,/removeWithUndo\(id\)/);
    assert.match(src,/showUndoToast\('Notificação excluída\.'/);
    assert.match(css,/\.notif-swipe-shell/);
    assert.match(css,/\.notif-panel-handle/);
    assert.match(css,/\.floating-notif\.is-swiping/);
  });

  test('41 — Camada Mobile Experience está no HTML, no cache offline e inclui viewport, haptics e bottom sheets',()=>{
    const index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
    const sw=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
    const src=fs.readFileSync(path.join(ROOT,'js/22-mobile-experience.js'),'utf8');
    assert.match(index,/js\/22-mobile-experience\.js\?v=6\.27\.3/);
    assert.match(sw,/js\/22-mobile-experience\.js/);
    assert.match(src,/visualViewport/);
    assert.match(src,/navigator\.vibrate/);
    assert.match(src,/decorateModalOverlay/);
    assert.match(src,/document\.startViewTransition/);
    assert.match(src,/showConnectivity/);
  });

  test('42 — CSS mobile respeita safe areas, teclado, movimento reduzido e alvos de toque',()=>{
    const css=fs.readFileSync(path.join(ROOT,'css/styles.css'),'utf8');
    assert.match(css,/--borion-keyboard/);
    assert.match(css,/env\(safe-area-inset-bottom\)/);
    assert.match(css,/keyboard-open \.smart-bottom-nav/);
    assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
    assert.match(css,/min-height:44px/);
  });

  test('43 — Manifesto PWA possui identidade, foco na instância existente e display standalone',()=>{
    const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.json'),'utf8'));
    assert.strictEqual(manifest.id,'./');
    assert.ok(Array.isArray(manifest.display_override));
    assert.ok(manifest.display_override.includes('standalone'));
    assert.strictEqual(manifest.launch_handler.client_mode,'focus-existing');
    assert.strictEqual(manifest.lang,'pt-BR');
  });


  test('44 — Atalho Drive & Local aparece somente no Modo Pro e Smartphone mantém Salvar e atualizar',()=>{
    const src=fs.readFileSync(path.join(ROOT,'js/20-smartphone-mode.js'),'utf8');
    const css=fs.readFileSync(path.join(ROOT,'css/styles.css'),'utf8');
    const shell=fs.readFileSync(path.join(ROOT,'js/04-gate-shell.js'),'utf8');
    assert.match(src,/if\(isSmartphoneMode\(\)\)/);
    assert.match(src,/smart-sidebar-save-reload/);
    assert.match(src,/pro-sidebar-save-drive-local/);
    assert.match(src,/FORCE SAVE/);
    assert.match(src,/Mesmo salvamento do Ctrl\+S/);
    assert.match(css,/data-interface-mode="pro"\] \.pro-sidebar-actions/);
    assert.match(css,/data-interface-mode="smartphone"\] \.smart-sidebar-actions/);
    assert.match(shell,/SmartphoneMode\.renderSidebarActions\(\)/);
  });

  test('45 — Rodapé técnico preserva lançamento original e autoria, atualizando apenas a versão',()=>{
    const src=fs.readFileSync(path.join(ROOT,'js/13-settings.js'),'utf8');
    const backup=fs.readFileSync(path.join(ROOT,'js/02-backup-local.js'),'utf8');
    assert.match(src,/<strong>Versão:<\/strong> 6\.27\.3/);
    assert.match(src,/<strong>Lançamento:<\/strong> 14\/07\/2026/);
    assert.match(src,/Desenvolvido por <strong>Pedro Bardella<\/strong>/);
    assert.match(src,/© 2026 Pedro Bardella\. Todos os direitos reservados\./);
    assert.match(backup,/BORION_APP_VERSION = '6\.27\.3'/);
  });


  test('46 — Reservas no Modo Pro oferecem grade de 2, 3 ou 4 colunas com slots arrastáveis',()=>{
    const order=fs.readFileSync(path.join(ROOT,'js/18-order-preferences.js'),'utf8');
    const reservas=fs.readFileSync(path.join(ROOT,'js/09-patrimony-goals.js'),'utf8');
    const css=fs.readFileSync(path.join(ROOT,'css/styles.css'),'utf8');
    assert.match(order,/\[2,3,4\]/);
    assert.match(order,/reservaColumnsStorageKey/);
    assert.match(order,/reservaLayoutControlsHTML/);
    assert.match(order,/borionStartReservaSlotDrag/);
    assert.match(reservas,/reserva-grid-organizer/);
    assert.match(reservas,/--reserva-cols/);
    assert.match(css,/repeat\(var\(--reserva-cols,3\)/);
    assert.match(css,/data-interface-mode="smartphone"\] \.reserva-grid\.reserva-layout-custom/);
  });

  test('47 — Quantidade de colunas é confirmada no OK e cancelamento preserva a configuração anterior',()=>{
    const ctx=createContext();
    load(ctx,'js/00-utils.js');
    run(ctx,"toast=function(){}; function readJSON(k,f){try{const v=localStorage.getItem(k);return v==null?f:JSON.parse(v);}catch(e){return f;}} function writeJSON(k,v){localStorage.setItem(k,JSON.stringify(v));} S={currentProfile:{id:'perfil-teste'},data:{}};");
    load(ctx,'js/18-order-preferences.js');
    run(ctx,"OrderPreferences.setActive(true,'reservas'); OrderPreferences.setReservaColumns(4);");
    assert.strictEqual(run(ctx,'OrderPreferences.workingReservaColumns()'),4);
    run(ctx,'OrderPreferences.saveAll()');
    assert.strictEqual(run(ctx,'OrderPreferences.getReservaColumns()'),4);
    run(ctx,"OrderPreferences.setActive(true,'reservas'); OrderPreferences.setReservaColumns(2); OrderPreferences.cancelAll();");
    assert.strictEqual(run(ctx,'OrderPreferences.getReservaColumns()'),4);
  });


  test('52 — Despesa variável em aberto não mexe no saldo e Pago aplica/estorna exatamente uma vez',()=>{
    const c=createContext();
    load(c,'js/00-utils.js'); load(c,'js/01-storage-data-state.js'); load(c,'js/05-calculations-charts.js'); load(c,'js/09-patrimony-goals.js'); load(c,'js/07-budget.js');
    const out=run(c,`(()=>{S.data=migrateData(emptyData());const a={id:'acc-status',accountKind:'bank',active:true,nome:'Conta teste',saldoInicial:1000};S.data.contas.push(a);const tx={id:'tx-status',tipo:'variavel',nome:'Compra',data:'2026-07-13',categoria:'Outro',valor:125,accountId:a.id,banco:a.nome,origemPagamento:'conta',formaPagamento:'Pix',statusPagamento:'Em aberto'};S.data.transacoes.push(tx);const aberto=contaSaldoAtual(a);const pagoOk=setVariavelStatus(tx,'Pago');const pago=contaSaldoAtual(a);const abertoOk=setVariavelStatus(tx,'Em aberto');const estornado=contaSaldoAtual(a);return {aberto,pagoOk,pago,abertoOk,estornado,status:tx.statusPagamento};})()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out)),{aberto:1000,pagoOk:true,pago:875,abertoOk:true,estornado:1000,status:'Em aberto'});
  });

  test('53 — Transferência entre reservas gera saída e entrada vinculadas e reversíveis',()=>{
    const c=createContext();
    load(c,'js/00-utils.js'); load(c,'js/01-storage-data-state.js'); load(c,'js/05-calculations-charts.js'); load(c,'js/09-patrimony-goals.js');
    const out=run(c,`(()=>{S.data=migrateData(emptyData());const a={id:'ra',nome:'Origem',valorAtual:500},b={id:'rb',nome:'Destino',valorAtual:100};S.data.reservas.boxes=[a,b];const id='tr-1',out={id:'m1',reservaTransferId:id,boxId:a.id,tipo:'Envio para outra reserva',valor:150},inn={id:'m2',reservaTransferId:id,boxId:b.id,tipo:'Recebimento de outra reserva',valor:150};Reservas.applyMoveEffect(out);Reservas.applyMoveEffect(inn);const depois=[a.valorAtual,b.valorAtual];Reservas.reverseMoveEffect(out);Reservas.reverseMoveEffect(inn);return {depois,antes:[a.valorAtual,b.valorAtual],positive:Reservas.POSITIVE_TYPES.includes(inn.tipo),negative:Reservas.NEGATIVE_TYPES.includes(out.tipo)};})()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out)),{depois:[350,250],antes:[500,100],positive:true,negative:true});
  });

  test('54 — Atualização visual contém todos os novos campos e integrações solicitados',()=>{
    const budget=fs.readFileSync(path.join(ROOT,'js/07-budget.js'),'utf8');
    const reservas=fs.readFileSync(path.join(ROOT,'js/09-patrimony-goals.js'),'utf8');
    const settings=fs.readFileSync(path.join(ROOT,'js/13-settings.js'),'utf8');
    const subs=fs.readFileSync(path.join(ROOT,'js/19-subscriptions.js'),'utf8');
    assert.match(budget,/Local da compra/); assert.match(budget,/data-value="carteira"/); assert.match(budget,/data-value="conta"/); assert.match(budget,/data-value="reserva"/); assert.match(budget,/data-value="credito"/);
    assert.match(budget,/Em aberto registra a despesa sem retirar dinheiro/); assert.match(budget,/Entre reservas/); assert.match(budget,/diaEntrada:diaCompra/); assert.match(budget,/Rendimento e receita própria contam como renda/);
    assert.match(reservas,/Gerar lembrete/); assert.match(reservas,/Enviar para outra reserva/); assert.match(reservas,/Recebimento de outra reserva/);
    assert.match(settings,/cat_receita|cat_/); assert.match(settings,/Escolha A–Z, Z–A, recentes, antigas ou uma ordem personalizada/);
    assert.match(subs,/orderedCategories\('variavel'\)/);
  });

  test('55 — Ordem das categorias aceita A–Z, Z–A, recentes, antigas e personalizada por perfil',()=>{
    const c=createContext();
    load(c,'js/00-utils.js');
    run(c,"function readJSON(k,f){try{const v=localStorage.getItem(k);return v==null?f:JSON.parse(v);}catch(e){return f;}} function writeJSON(k,v){localStorage.setItem(k,JSON.stringify(v));} S={currentProfile:{id:'perfil-cat'},data:{}};");
    load(c,'js/18-order-preferences.js');
    const out=run(c,`(()=>{const items=[{id:'Mercado',nome:'Mercado'},{id:'Academia',nome:'Academia'},{id:'Viagem',nome:'Viagem'}];OrderPreferences.setSortMode('cat_variavel','az');const az=OrderPreferences.applyOrder('cat_variavel',items).map(x=>x.id);OrderPreferences.setSortMode('cat_variavel','za');const za=OrderPreferences.applyOrder('cat_variavel',items).map(x=>x.id);OrderPreferences.setSortMode('cat_variavel','recent');const recent=OrderPreferences.applyOrder('cat_variavel',items).map(x=>x.id);OrderPreferences.setSortMode('cat_variavel','old');const old=OrderPreferences.applyOrder('cat_variavel',items).map(x=>x.id);OrderPreferences.saveOrderLocal('cat_variavel',['Viagem','Mercado','Academia']);OrderPreferences.setSortMode('cat_variavel','manual');const manual=OrderPreferences.applyOrder('cat_variavel',items).map(x=>x.id);return {az,za,recent,old,manual};})()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out)),{az:['Academia','Mercado','Viagem'],za:['Viagem','Mercado','Academia'],recent:['Viagem','Academia','Mercado'],old:['Mercado','Academia','Viagem'],manual:['Viagem','Mercado','Academia']});
  });


  test('56 — Rendimento entra na Receita do mês sem transformar reembolso ou repasse em renda',()=>{
    const c=createContext();
    load(c,'js/00-utils.js'); load(c,'js/01-storage-data-state.js'); load(c,'js/05-calculations-charts.js');
    const out=run(c,`(()=>{S.data=migrateData(emptyData());S.month={y:2026,m:6};S.data.transacoes=[{id:'r1',tipo:'receita',data:'2026-07-01',valor:100,origem:'propria',banco:''},{id:'r2',tipo:'receita',data:'2026-07-02',valor:25,origem:'rendimento',banco:''},{id:'r3',tipo:'receita',data:'2026-07-03',valor:40,origem:'reembolso',banco:''},{id:'r4',tipo:'receita',data:'2026-07-04',valor:60,origem:'repasse',banco:''}];return {renda:receitaMes(),extras:receitaExtraMes()};})()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out)),{renda:125,extras:100});
  });

  test('57 — Assinatura no crédito entra imediatamente no cartão e em Despesa variável sem duplicar',()=>{
    const c=createContext();
    load(c,'js/00-utils.js');load(c,'js/01-storage-data-state.js');load(c,'js/05-calculations-charts.js');load(c,'js/19-subscriptions.js');
    run(c,"todayISO=()=> '2026-07-12'; todayYM=()=>({y:2026,m:6}); toast=()=>{}; S.month={y:2026,m:6};");
    const out=run(c,`(()=>{S.data=migrateData(emptyData());S.data.cartoes.push({id:'card-sub',banco:'Nubank',limite:1000,parcelas:[],faturasPagas:[]});const sub={id:'sub-credit-now',status:'ativa',createdKey:'2026-07',versions:[{id:'v1',effectiveFrom:'2026-07',nome:'Streaming',categoria:'Assinaturas',tipo:'mensal',valor:39.9,diaVencimento:31,formaPagamento:'Crédito',cartaoId:'card-sub'}],activityPeriods:[{from:'2026-07',to:null}],pauseHistory:[]};S.data.assinaturas.push(sub);Assinaturas.sync();Assinaturas.sync();const rec=assinaturaCobrancaFor(sub.id,'2026-07');const tx=S.data.transacoes.filter(t=>t.viaAssinaturaId===sub.id);return {status:rec.status,parcelas:S.data.cartoes[0].parcelas.length,txCount:tx.length,txStatus:tx[0]&&tx[0].statusPagamento,variavel:variavelMes(2026,6),assinaturas:assinaturasMes(2026,6),despesas:despesasMes(2026,6)};})()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out)),{status:'cobrada',parcelas:1,txCount:1,txStatus:'Pago',variavel:39.9,assinaturas:0,despesas:39.9});
  });

  test('58 — Assinatura vencida por conta paga uma vez e mantém um único lançamento variável',()=>{
    const c=createContext();
    load(c,'js/00-utils.js');load(c,'js/01-storage-data-state.js');load(c,'js/05-calculations-charts.js');load(c,'js/19-subscriptions.js');
    run(c,"todayISO=()=> '2026-07-12'; todayYM=()=>({y:2026,m:6}); toast=()=>{}; S.month={y:2026,m:6};");
    const out=run(c,`(()=>{S.data=migrateData(emptyData());const a={id:'acc-sub',accountKind:'bank',active:true,nome:'Conta',saldoInicial:1000};S.data.contas.push(a);const sub={id:'sub-account-due',status:'ativa',createdKey:'2026-07',versions:[{id:'v1',effectiveFrom:'2026-07',nome:'Academia',categoria:'Assinaturas',tipo:'mensal',valor:80,diaVencimento:1,formaPagamento:'Pix',accountId:a.id,banco:a.nome}],activityPeriods:[{from:'2026-07',to:null}],pauseHistory:[]};S.data.assinaturas.push(sub);Assinaturas.sync();Assinaturas.sync();const rec=assinaturaCobrancaFor(sub.id,'2026-07');const tx=S.data.transacoes.filter(t=>t.viaAssinaturaId===sub.id);return {saldo:contaSaldoAtual(a),status:rec.status,balanceApplied:rec.balanceApplied,txCount:tx.length,txStatus:tx[0]&&tx[0].statusPagamento};})()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out)),{saldo:920,status:'cobrada',balanceApplied:true,txCount:1,txStatus:'Pago'});
  });

  test('59 — Despesa fixa suporta Pago/Em aberto com aplicação e estorno idempotentes',()=>{
    const c=createContext();
    load(c,'js/00-utils.js');load(c,'js/01-storage-data-state.js');load(c,'js/05-calculations-charts.js');load(c,'js/07-budget.js');
    run(c,"todayISO=()=> '2026-07-12'; todayYM=()=>({y:2026,m:6}); toast=()=>{}; renderView=()=>{}; saveCurrentData=()=>true; S.month={y:2026,m:6};");
    const out=run(c,`(()=>{S.data=migrateData(emptyData());const a={id:'acc-fixa',accountKind:'bank',active:true,nome:'Conta',saldoInicial:1000};S.data.contas.push(a);const f={id:'fixa-status',nome:'Internet',categoria:'Casa',valor:100,dia:10,startMonth:'2026-07',endMonth:null,accountId:a.id,banco:a.nome,formaPagamento:'Pix',origemPagamento:'conta'};S.data.fixas.push(f);payFixaOcorrencia(f,'2026-07',{persist:false,notify:false});payFixaOcorrencia(f,'2026-07',{persist:false,notify:false});const paid={saldo:contaSaldoAtual(a),count:S.data.fixaPagamentos.length,status:fixaOcorrenciaStatus(f,'2026-07')};undoFixaOcorrencia(f,'2026-07',{persist:false,notify:false});undoFixaOcorrencia(f,'2026-07',{persist:false,notify:false});return {paid,open:{saldo:contaSaldoAtual(a),count:S.data.fixaPagamentos.length,status:fixaOcorrenciaStatus(f,'2026-07')}};})()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out)),{paid:{saldo:900,count:1,status:'Pago'},open:{saldo:1000,count:0,status:'Vencido'}});
  });

  test('60 — Formulários novos contêm fluxo visual completo e categoria dinâmica da parcela',()=>{
    const budget=fs.readFileSync(path.join(ROOT,'js/07-budget.js'),'utf8');
    const cards=fs.readFileSync(path.join(ROOT,'js/10-cards-accounts.js'),'utf8');
    assert.match(budget,/Status deste mês/);
    assert.match(budget,/fm_pagamento_origem_group/);
    assert.match(budget,/data-value="carteira"/);
    assert.match(budget,/data-value="conta"/);
    assert.match(budget,/reservasEnabled\(\)\?`<button[^`]+data-value="reserva"/);
    assert.match(budget,/data-value="credito"/);
    assert.match(cards,/wireParcelaCategoriaPorTipo/);
    assert.match(cards,/orderedCategories\(tipo\)/);
    assert.match(cards,/tipoEl\.addEventListener\('change',refresh\)/);
  });

  test('61 — Cartão e Lançamentos compartilham o mesmo Pago/Em aberto da despesa fixa',()=>{
    const c=createContext();
    load(c,'js/00-utils.js');load(c,'js/01-storage-data-state.js');load(c,'js/05-calculations-charts.js');load(c,'js/09-patrimony-goals.js');load(c,'js/07-budget.js');load(c,'js/10-cards-accounts.js');
    run(c,"todayISO=()=> '2026-07-14'; todayYM=()=>({y:2026,m:6}); toast=()=>{}; renderView=()=>{}; saveCurrentData=()=>true; S.month={y:2026,m:6};");
    const out=run(c,`(()=>{S.data=migrateData(emptyData());const card={id:'card-sync',banco:'Nubank',limite:1000,parcelas:[],faturasPagas:[]};const p={id:'p-sync',descricao:'Internet',categoria:'Contas Fixas',valorParcela:100,parcelaTotal:1,dataCompra:'2026-07',diaEntrada:10,apareceDespesas:true,despesaTipo:'fixa',despesaTransacaoIds:[],despesaFixaId:null};card.parcelas.push(p);S.data.cartoes.push(card);linkParcelaToDespesa(card,p);const f=S.data.fixas.find(x=>x.id===p.despesaFixaId);const antes=fixaOcorrenciaStatus(f,'2026-07');Budget.toggleFixaPago(f.id);const pago={fixa:fixaOcorrenciaStatus(f,'2026-07'),cartao:parcelaCompetenciaPaga(card.id,p,'2026-07'),html:/sync-payment-toggle/.test(renderCards())&&/PAGO/.test(renderCards())};Cards.toggleParcelaPagamento(card.id,p.id,'2026-07');return {antes,pago,depois:{fixa:fixaOcorrenciaStatus(f,'2026-07'),cartao:parcelaCompetenciaPaga(card.id,p,'2026-07')}};})()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out)),{antes:'Vencido',pago:{fixa:'Pago',cartao:true,html:true},depois:{fixa:'Vencido',cartao:false}});
  });

  test('62 — Fatura paga atualiza Lançamentos e desfazer preserva somente baixas individuais',()=>{
    const c=createContext();
    load(c,'js/00-utils.js');load(c,'js/01-storage-data-state.js');load(c,'js/05-calculations-charts.js');
    run(c,"todayISO=()=> '2026-07-14'; todayYM=()=>({y:2026,m:6}); S.month={y:2026,m:6};");
    const out=run(c,`(()=>{S.data=migrateData(emptyData());const card={id:'card-fatura',banco:'Inter',parcelas:[],faturasPagas:[]};const p={id:'p-fatura',descricao:'Seguro',valorParcela:200,parcelaTotal:1,dataCompra:'2026-07',apareceDespesas:true,despesaTipo:'fixa',pagamentosIndividuais:[]};card.parcelas.push(p);S.data.cartoes.push(card);linkParcelaToDespesa(card,p);const f=S.data.fixas.find(x=>x.id===p.despesaFixaId);card.faturasPagas.push({id:'fat-1',competencia:'2026-07',valor:200});const viaFatura=fixaOcorrenciaStatus(f,'2026-07');card.faturasPagas=[];const reaberta=fixaOcorrenciaStatus(f,'2026-07');setParcelaCompetenciaPagoManual(card.id,p.id,'2026-07',true);card.faturasPagas.push({id:'fat-2',competencia:'2026-07',valor:200});card.faturasPagas=[];return {viaFatura,reaberta,manualPreservado:fixaOcorrenciaStatus(f,'2026-07')};})()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out)),{viaFatura:'Pago',reaberta:'Vencido',manualPreservado:'Pago'});
  });

  test('63 — Boleto pago ou reaberto em Cartões e Contas reflete na despesa fixa',()=>{
    const c=createContext();
    load(c,'js/00-utils.js');load(c,'js/01-storage-data-state.js');load(c,'js/05-calculations-charts.js');
    run(c,"todayISO=()=> '2026-07-14'; todayYM=()=>({y:2026,m:6}); S.month={y:2026,m:6};");
    const out=run(c,`(()=>{S.data=migrateData(emptyData());const b={id:'bol-sync',descricao:'Curso',categoria:'Educação',valorParcela:150,parcelaTotal:1,dataInicio:'2026-07',diaVencimento:20,status:'Ativo',pagamentos:[],apareceDespesas:true,despesaTipo:'fixa'};S.data.boletos.push(b);linkBoletoToDespesa(b);const f=S.data.fixas.find(x=>x.id===b.despesaFixaId);const aberto=fixaOcorrenciaStatus(f,'2026-07');b.pagamentos.push({id:'pg',competencia:'2026-07',valor:150});const pago=fixaOcorrenciaStatus(f,'2026-07');b.pagamentos=[];return {aberto,pago,reaberto:fixaOcorrenciaStatus(f,'2026-07')};})()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out)),{aberto:'Pendente',pago:'Pago',reaberto:'Pendente'});
  });

  test('64 — Botão de despesa fixa não é ocultado por cartão/boleto e Cartões mostra seção sincronizada',()=>{
    const budget=fs.readFileSync(path.join(ROOT,'js/07-budget.js'),'utf8');
    const cards=fs.readFileSync(path.join(ROOT,'js/10-cards-accounts.js'),'utf8');
    assert.ok(!/isLinked\?'':`<button onclick=\"Budget\.toggleFixaPago/.test(budget));
    assert.match(budget,/setParcelaCompetenciaPagoManual/);
    assert.match(cards,/Despesas vinculadas às contas/);
    assert.match(cards,/Os botões Pago e Em aberto usam o mesmo status de Lançamentos/);
    assert.match(cards,/syncedPaymentButtonsHTML/);
    assert.match(cards,/toggleParcelaPagamento/);
  });

  test('65 — Despesa variável do cartão usa o mesmo status em Cartões e em Lançamentos',()=>{
    const c=createContext();
    load(c,'js/00-utils.js');load(c,'js/01-storage-data-state.js');load(c,'js/05-calculations-charts.js');load(c,'js/09-patrimony-goals.js');load(c,'js/07-budget.js');load(c,'js/10-cards-accounts.js');
    run(c,"todayISO=()=> '2026-07-14'; todayYM=()=>({y:2026,m:6}); toast=()=>{}; renderView=()=>{}; saveCurrentData=()=>true; S.month={y:2026,m:6};");
    const out=run(c,`(()=>{S.data=migrateData(emptyData());const card={id:'card-var-sync',banco:'Nubank',limite:1000,parcelas:[],faturasPagas:[]};const p={id:'p-var-sync',descricao:'Compra variável',categoria:'Outro',valorParcela:120,parcelaTotal:1,dataCompra:'2026-07',diaEntrada:10,apareceDespesas:true,despesaTipo:'variavel',statusPagamento:'Em aberto',despesaTransacaoIds:[],despesaFixaId:null};card.parcelas.push(p);S.data.cartoes.push(card);linkParcelaToDespesa(card,p);const tx=linkedParcelaTransactionForCompetencia(p.id,'2026-07');const antes=variavelStatus(tx);Budget.setVariavelPago(tx.id,'Pago');const pago={tx:variavelStatus(tx),card:parcelaDespesaStatus(card.id,p,'2026-07'),html:/Budget\.setVariavelPago/.test(renderCards())&&/sync-payment-toggle/.test(renderCards())};Budget.setVariavelPago(tx.id,'Em aberto');return {antes,pago,depois:{tx:variavelStatus(tx),card:parcelaDespesaStatus(card.id,p,'2026-07')}};})()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out)),{antes:'Em aberto',pago:{tx:'Pago',card:'Pago',html:true},depois:{tx:'Em aberto',card:'Em aberto'}});
  });

  test('66 — Despesa variável da conta aparece em Cartões e Contas e aplica/estorna o saldo uma vez',()=>{
    const c=createContext();
    load(c,'js/00-utils.js');load(c,'js/01-storage-data-state.js');load(c,'js/05-calculations-charts.js');load(c,'js/09-patrimony-goals.js');load(c,'js/07-budget.js');load(c,'js/10-cards-accounts.js');
    run(c,"todayISO=()=> '2026-07-14'; todayYM=()=>({y:2026,m:6}); toast=()=>{}; renderView=()=>{}; saveCurrentData=()=>true; S.month={y:2026,m:6};");
    const out=run(c,`(()=>{S.data=migrateData(emptyData());const a={id:'acc-var-sync',accountKind:'bank',active:true,nome:'Inter',saldoInicial:1000};S.data.contas.push(a);const tx={id:'tx-account-sync',tipo:'variavel',nome:'Energia',data:'2026-07-10',categoria:'Casa',valor:100,accountId:a.id,banco:a.nome,formaPagamento:'Pix',origemPagamento:'conta',statusPagamento:'Em aberto'};S.data.transacoes.push(tx);const html=renderCards();Budget.setVariavelPago(tx.id,'Pago');const paid={saldo:contaSaldoAtual(a),status:variavelStatus(tx)};Budget.setVariavelPago(tx.id,'Em aberto');return {html:/Despesas vinculadas às contas/.test(html)&&/Energia/.test(html)&&/sync-payment-toggle/.test(html),paid,open:{saldo:contaSaldoAtual(a),status:variavelStatus(tx)}};})()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out)),{html:true,paid:{saldo:900,status:'Pago'},open:{saldo:1000,status:'Em aberto'}});
  });

  test('67 — Boleto variável pago ou reaberto sincroniza lançamento e saldo da conta',()=>{
    const c=createContext();
    load(c,'js/00-utils.js');load(c,'js/01-storage-data-state.js');load(c,'js/05-calculations-charts.js');load(c,'js/09-patrimony-goals.js');load(c,'js/07-budget.js');load(c,'js/10-cards-accounts.js');
    run(c,"todayISO=()=> '2026-07-14'; todayYM=()=>({y:2026,m:6}); toast=()=>{}; renderView=()=>{}; saveCurrentData=()=>true; S.month={y:2026,m:6};");
    const out=run(c,`(()=>{S.data=migrateData(emptyData());const a={id:'acc-bol-sync',accountKind:'bank',active:true,nome:'Conta boleto',saldoInicial:1000};S.data.contas.push(a);const b={id:'bol-var-sync',descricao:'Curso',credor:'Escola',accountId:a.id,banco:a.nome,categoria:'Educação',valorParcela:150,parcelaTotal:1,dataInicio:'2026-07',diaVencimento:20,status:'Ativo',pagamentos:[],apareceDespesas:true,despesaTipo:'variavel'};S.data.boletos.push(b);linkBoletoToDespesa(b);const tx=linkedBoletoTransactionForCompetencia(b.id,'2026-07');tx.statusPagamento='Em aberto';openModal=cfg=>cfg.onSave({accountId:a.id,valor:150,data:'2026-07-14'});Budget.setVariavelPago(tx.id,'Pago');const paid={saldo:contaSaldoAtual(a),status:variavelStatus(tx),pagamentos:b.pagamentos.length,cardStatus:boletoDespesaStatus(b,'2026-07')};Budget.setVariavelPago(tx.id,'Em aberto');return {paid,open:{saldo:contaSaldoAtual(a),status:variavelStatus(tx),pagamentos:b.pagamentos.length,cardStatus:boletoDespesaStatus(b,'2026-07')}};})()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out)),{paid:{saldo:850,status:'Pago',pagamentos:1,cardStatus:'Pago'},open:{saldo:1000,status:'Em aberto',pagamentos:0,cardStatus:'Em aberto'}});
  });

  test('68 — Pagar fatura sincroniza variáveis e desfazer restaura o estado individual anterior',()=>{
    const c=createContext();
    load(c,'js/00-utils.js');load(c,'js/01-storage-data-state.js');load(c,'js/05-calculations-charts.js');load(c,'js/09-patrimony-goals.js');load(c,'js/07-budget.js');load(c,'js/10-cards-accounts.js');
    run(c,"todayISO=()=> '2026-07-14'; todayYM=()=>({y:2026,m:6}); toast=()=>{}; renderView=()=>{}; saveCurrentData=()=>true; S.month={y:2026,m:6};");
    const out=run(c,`(()=>{S.data=migrateData(emptyData());const a={id:'acc-fat-sync',accountKind:'bank',active:true,nome:'Conta fatura',saldoInicial:1000};S.data.contas.push(a);const card={id:'card-fat-var',banco:'Cartão teste',limite:2000,parcelas:[],faturasPagas:[]};const p1={id:'p-fat-open',descricao:'Compra aberta',categoria:'Outro',valorParcela:100,parcelaTotal:1,dataCompra:'2026-07',apareceDespesas:true,despesaTipo:'variavel',statusPagamento:'Em aberto'};const p2={id:'p-fat-paid',descricao:'Compra paga',categoria:'Outro',valorParcela:50,parcelaTotal:1,dataCompra:'2026-07',apareceDespesas:true,despesaTipo:'variavel',statusPagamento:'Pago'};card.parcelas.push(p1,p2);S.data.cartoes.push(card);linkParcelaToDespesa(card,p1);linkParcelaToDespesa(card,p2);const t1=linkedParcelaTransactionForCompetencia(p1.id,'2026-07'),t2=linkedParcelaTransactionForCompetencia(p2.id,'2026-07');openModal=cfg=>cfg.onSave({accountId:a.id,valor:150,data:'2026-07-14'});Cards.payFatura(card.id);const paid={saldo:contaSaldoAtual(a),t1:variavelStatus(t1),t2:variavelStatus(t2),faturas:card.faturasPagas.length};Cards.undoFaturaPagamento(card.id,card.faturasPagas[0].id);return {paid,undone:{saldo:contaSaldoAtual(a),t1:variavelStatus(t1),t2:variavelStatus(t2),faturas:card.faturasPagas.length}};})()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out)),{paid:{saldo:850,t1:'Pago',t2:'Pago',faturas:1},undone:{saldo:1000,t1:'Em aberto',t2:'Pago',faturas:0}});
  });

  test('Código completo — todos os JavaScript passam na validação sintática',()=>{
    const files=fs.readdirSync(path.join(ROOT,'js')).filter(f=>f.endsWith('.js'));
    files.forEach(f=>execFileSync(process.execPath,['--check',path.join(ROOT,'js',f)],{stdio:'pipe'}));
  });

  test('Cobertura estática — formulários Banco/Conta não usam allBankNames nem key banco',()=>{
    const files=['js/15-cheques.js','js/16-import-statement.js','js/09-patrimony-goals.js','js/19-subscriptions.js'];
    files.forEach(f=>{
      const src=fs.readFileSync(path.join(ROOT,f),'utf8');
      assert.ok(!/key:'banco'.*type:'select'/.test(src),f+' ainda contém select textual');
    });
    assert.ok(!/allBankNames\(\)/.test(fs.readFileSync(path.join(ROOT,'js/15-cheques.js'),'utf8')));
    assert.ok(!/allBankNames\(\)/.test(fs.readFileSync(path.join(ROOT,'js/16-import-statement.js'),'utf8')));
  });

  test('48 — Ctrl+S usa a mesma rotina manual dos botões',()=>{
    const boot=fs.readFileSync(path.join(ROOT,'js/14-events-boot-pwa.js'),'utf8');
    assert.match(boot,/backupModule\.manualBackup\(\{targets:'both',reason:'manual_drive_local',interactive:true\}\)/);
    assert.match(boot,/if\(forceManualSaveInFlight\) return forceManualSaveInFlight/);
    assert.match(boot,/e\.preventDefault\(\);\s*forceManualSave\(\)/);
  });

  test('49 — Atalho fixo do Modo Pro chama exatamente o mesmo force save do Ctrl+S',()=>{
    const src=fs.readFileSync(path.join(ROOT,'js/20-smartphone-mode.js'),'utf8');
    const fn=src.slice(src.indexOf('async quickSaveBoth()'),src.indexOf('async saveAndReload()'));
    assert.match(fn,/forceManualSave\(\)/);
    assert.ok(!/Settings\.quickBackupBoth\(/.test(fn));
  });

  test('50 — Pasta local é verificada ao abrir e avisa quando precisa reconectar',()=>{
    const local=fs.readFileSync(path.join(ROOT,'js/02-backup-local.js'),'utf8');
    const boot=fs.readFileSync(path.join(ROOT,'js/14-events-boot-pwa.js'),'utf8');
    const shell=fs.readFileSync(path.join(ROOT,'js/04-gate-shell.js'),'utf8');
    assert.match(local,/const handle = await idbGet\('backupDir'\)/);
    assert.match(local,/handle\.queryPermission\(\{mode:'readwrite'\}\)/);
    assert.match(local,/notifyStartupFolderStatus\(\)/);
    assert.match(boot,/const backupFolderInit=BackupFS\.init\(\)/);
    assert.match(boot,/await backupFolderInit/);
    assert.match(shell,/BackupFS\.notifyStartupFolderStatus\(\)/);
  });

  await testAsync('51 — Force save aceita e reutiliza o snapshot manual compartilhado',async()=>{
    const driveCtx=createContext();
    run(driveCtx,"const BORION_APP_VERSION='6.24.6'; async function buildSharedBackupSnapshot(){return {profiles:[]};} async function buildFullBackupPayload(){throw new Error('não deve reconstruir');} function validateBorionJson(){return {valid:true,errors:[]};} function applyAccountPayloadSilently(){} function setStorageMode(){} function setProfiles(){} function toast(){};");
    load(driveCtx,'js/01c-google-drive-provider.js');
    run(driveCtx,`GoogleDriveAuth.user={sub:'u',email:'u@x.com'};GoogleDriveProvider.folderId='folder';GoogleDriveProvider.currentFileId='current';window.__payloads=[];GoogleDriveFS.updateFile=async(id,payload)=>{window.__payloads.push(payload);return {id};};GoogleDriveProvider.writeRotatingSnapshot=async(kind,slots,payload)=>{window.__payloads.push(payload);};`);
    const ok=await run(driveCtx,"GoogleDriveProvider.forceSyncNow({payload:{profiles:[{id:'p'}],snapshotId:'shared-manual'}})");
    const payloads=run(driveCtx,'window.__payloads');
    assert.strictEqual(ok,true); assert.strictEqual(payloads.length,2); assert.strictEqual(payloads[0].snapshotId,'shared-manual'); assert.strictEqual(payloads[1].snapshotId,'shared-manual');
  });

  test('V6.24.6 — Settings é exportado globalmente para Ctrl+S e botão fixo',()=>{
    const fs=require('fs');
    const settings=fs.readFileSync(path.join(ROOT,'js/13-settings.js'),'utf8');
    assert.match(settings,/window\.Settings\s*=\s*Settings/);
  });

  test('V6.24.6 — botão fixo do Modo Pro usa exatamente forceManualSave',()=>{
    const fs=require('fs');
    const mobile=fs.readFileSync(path.join(ROOT,'js/20-smartphone-mode.js'),'utf8');
    const boot=fs.readFileSync(path.join(ROOT,'js/14-events-boot-pwa.js'),'utf8');
    assert.match(mobile,/const result=await forceManualSave\(\)/);
    assert.match(mobile,/Mesmo salvamento do Ctrl\+S/);
    assert.match(boot,/async function forceManualSave\(\)/);
    assert.match(boot,/backupModule\.manualBackup\(\{targets:'both'/);
  });

  test('V6.24.4 — importação completa usa tela de revisão e não mesclagem silenciosa',()=>{
    const fs=require('fs');
    const boot=fs.readFileSync(path.join(ROOT,'js/14-events-boot-pwa.js'),'utf8');
    const review=fs.readFileSync(path.join(ROOT,'js/23-profile-import-review.js'),'utf8');
    assert.match(boot,/openAccountImportReview\(obj,\{cloud:false\}\)/);
    assert.match(boot,/openAccountImportReview\(obj,\{cloud:true\}\)/);
    assert.match(review,/Mesmo ID do perfil atual/);
    assert.match(review,/Substituir:/);
    assert.match(review,/Excluir este perfil atual/);
    assert.match(review,/before_import/);
  });

  test('V6.24.4 — service worker inclui módulo de revisão de perfis',()=>{
    const fs=require('fs');
    const sw=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
    assert.match(sw,/23-profile-import-review\.js/);
    assert.match(sw,/v6-27-3-payment-status-sync/);
  });

  const failures=results.filter(r=>r.status==='FAIL');
  const report={generatedAt:new Date().toISOString(),appVersion:'6.27.3',total:results.length,passed:results.length-failures.length,failed:failures.length,results};
  fs.writeFileSync(path.join(__dirname,'regression-results.json'),JSON.stringify(report,null,2));
  for(const r of results){
    console.log(`${r.status==='PASS'?'✓':'✗'} ${r.name}`);
    if(r.error) console.error(r.error);
  }
  console.log(`\nResultado: ${report.passed}/${report.total} testes aprovados.`);
  if(failures.length) process.exit(1);
})().catch(error=>{console.error(error);process.exit(1);});
