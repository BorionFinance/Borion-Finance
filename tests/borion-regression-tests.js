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
    body:{style:{},appendChild(){},removeChild(){}},
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

  test('6 — Assinatura futura fica Prevista e não altera saldo antes do vencimento',()=>{
    const out=run(ctx,`(()=>{S.data=migrateData(emptyData());const a={id:uid(),accountKind:'bank',active:true,nome:'Conta teste',saldoInicial:1000};S.data.contas.push(a);const sub={id:'sub-futura',status:'ativa',createdKey:'2026-07',createdAt:1,versions:[{id:'v1',effectiveFrom:'2026-07',nome:'Streaming',categoria:'Assinaturas',tipo:'mensal',valor:100,diaVencimento:31,mesVencimento:null,formaPagamento:'Pix',accountId:a.id,banco:a.nome,cartaoId:null}],activityPeriods:[{from:'2026-07',to:null}],pauseHistory:[]};S.data.assinaturas.push(sub);Assinaturas.sync();const rec=assinaturaCobrancaFor(sub.id,'2026-07');return {saldo:contaSaldoAtual(a),status:rec&&rec.status,forecast:assinaturasMes(2026,6),count:S.data.assinaturaCobrancas.length};})()`);
    assert.strictEqual(out.saldo,1000); assert.strictEqual(out.status,'prevista'); assert.strictEqual(out.forecast,100); assert.strictEqual(out.count,1);
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

  test('9 — Excluir assinatura interrompe futuro e preserva ocorrência histórica',()=>{
    const out=run(ctx,`(()=>{S.data=migrateData(emptyData());S.month={y:2026,m:6};const sub={id:'sub-delete',status:'ativa',createdKey:'2026-01',versions:[{id:'v1',effectiveFrom:'2026-01',nome:'Serviço',categoria:'Assinaturas',tipo:'mensal',valor:50,diaVencimento:10,formaPagamento:'Pix',accountId:null}],activityPeriods:[{from:'2026-01',to:null}],pauseHistory:[]};S.data.assinaturas.push(sub);S.data.assinaturaCobrancas.push({id:'jan',assinaturaId:sub.id,period:'2026-01',status:'cobrada',valor:50},{id:'aug',assinaturaId:sub.id,period:'2026-08',status:'prevista',valor:50});Assinaturas.remove(sub.id);return {status:sub.status,deletedFrom:sub.deletedFromKey,records:S.data.assinaturaCobrancas.filter(r=>r.assinaturaId===sub.id).map(r=>({id:r.id,period:r.period,status:r.status}))};})()`);
    assert.strictEqual(out.status,'excluida'); assert.strictEqual(out.deletedFrom,'2026-07');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(out.records)),[{id:'jan',period:'2026-01',status:'cobrada'}]);
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

  load(ctx,'js/02-backup-local.js');
  await testAsync('Backup Drive&Local — snapshot possui mesmo ID, data-base, versão e checksum',async()=>{
    const snap=await run(ctx,`finalizeBackupSnapshot({type:'borion-account-backup',appVersion:'6.23.2',exportedAt:'2026-07-12T12:00:00.000Z',profiles:[],dataByProfile:{},integrity:{}},'manual_drive_local','backup manual conjunto Drive e dispositivo')`);
    assert.ok(snap.snapshotId); assert.strictEqual(snap.snapshotBaseDate,'2026-07-12T12:00:00.000Z'); assert.strictEqual(snap.appVersion,'6.23.2'); assert.strictEqual(snap.snapshotChecksum,snap.integrity.snapshotSha256); assert.strictEqual(snap.snapshotChecksum.length,64);
    const local=JSON.stringify(snap),drive=JSON.stringify(snap); assert.strictEqual(local,drive);
    const settings=fs.readFileSync(path.join(ROOT,'js/13-settings.js'),'utf8');
    assert.match(settings,/GoogleDriveProvider\.createBackup\('manual_drive_local',\{payload:sharedSnapshot\}\)/);
    assert.match(settings,/storageProvider\.createBackup\('manual_drive_local',\{payload:sharedSnapshot\}\)/);
    const driveSource=fs.readFileSync(path.join(ROOT,'js/01c-google-drive-provider.js'),'utf8');
    assert.match(driveSource,/options\.payload \? options\.payload : await buildSharedBackupSnapshot/);
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

  const failures=results.filter(r=>r.status==='FAIL');
  const report={generatedAt:new Date().toISOString(),appVersion:'6.23.2',total:results.length,passed:results.length-failures.length,failed:failures.length,results};
  fs.writeFileSync(path.join(__dirname,'regression-results.json'),JSON.stringify(report,null,2));
  for(const r of results){
    console.log(`${r.status==='PASS'?'✓':'✗'} ${r.name}`);
    if(r.error) console.error(r.error);
  }
  console.log(`\nResultado: ${report.passed}/${report.total} testes aprovados.`);
  if(failures.length) process.exit(1);
})().catch(error=>{console.error(error);process.exit(1);});
