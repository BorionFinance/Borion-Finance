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
    const snap=await run(ctx,`finalizeBackupSnapshot({type:'borion-account-backup',appVersion:'6.24.1',exportedAt:'2026-07-12T12:00:00.000Z',profiles:[],dataByProfile:{},integrity:{}},'manual_drive_local','backup manual conjunto Drive e dispositivo')`);
    assert.ok(snap.snapshotId); assert.strictEqual(snap.snapshotBaseDate,'2026-07-12T12:00:00.000Z'); assert.strictEqual(snap.appVersion,'6.24.1'); assert.strictEqual(snap.snapshotChecksum,snap.integrity.snapshotSha256); assert.strictEqual(snap.snapshotChecksum.length,64);
    const local=JSON.stringify(snap),drive=JSON.stringify(snap); assert.strictEqual(local,drive);
    const settings=fs.readFileSync(path.join(ROOT,'js/13-settings.js'),'utf8');
    assert.match(settings,/GoogleDriveProvider\.createBackup\('manual_drive_local',\{payload:sharedSnapshot\}\)/);
    assert.match(settings,/Settings\._saveSnapshotLocally\(sharedSnapshot,'manual_drive_local'\)/);
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

  test('26 — Backup rápido local e Drive&Local usam a pasta e o mesmo snapshot',()=>{
    const src=fs.readFileSync(path.join(ROOT,'js/13-settings.js'),'utf8');
    assert.match(src,/BackupFS\.writeToFolder\(snapshot,'borion-backup-local',\{interactive:false\}\)/);
    assert.match(src,/Settings\._prepareLocalFolderAccess\(\)/);
    assert.match(src,/Settings\._saveSnapshotLocally\(sharedSnapshot,'manual_drive_local'\)/);
    assert.match(src,/GoogleDriveProvider\.createBackup\('manual_drive_local',\{payload:sharedSnapshot\}\)/);
    const local=fs.readFileSync(path.join(ROOT,'js/02-backup-local.js'),'utf8');
    assert.match(local,/scheduleAutoBackup\(\)/); assert.match(local,/getFileHandle\(filename, \{create:true\}\)/); assert.match(local,/m\$\{pad\(d\.getSeconds\(\)\)\}s\$\{ms\}/);
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
    assert.match(index,/js\/20-smartphone-mode\.js\?v=6\.24\.1/);
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
    assert.match(index,/js\/21-smartphone-history\.js\?v=6\.24\.1/);
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
    assert.match(index,/js\/22-mobile-experience\.js\?v=6\.24\.1/);
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
    assert.match(src,/SALVAR DRIVE & LOCAL/);
    assert.match(css,/data-interface-mode="pro"\] \.pro-sidebar-actions/);
    assert.match(css,/data-interface-mode="smartphone"\] \.smart-sidebar-actions/);
    assert.match(shell,/SmartphoneMode\.renderSidebarActions\(\)/);
  });

  test('45 — Rodapé técnico preserva lançamento original e autoria, atualizando apenas a versão',()=>{
    const src=fs.readFileSync(path.join(ROOT,'js/13-settings.js'),'utf8');
    const backup=fs.readFileSync(path.join(ROOT,'js/02-backup-local.js'),'utf8');
    assert.match(src,/<strong>Versão:<\/strong> 6\.24\.1/);
    assert.match(src,/<strong>Lançamento:<\/strong> 07\/07\/2026/);
    assert.match(src,/Desenvolvido por <strong>Pedro Bardella<\/strong>/);
    assert.match(src,/© 2026 Pedro Bardella\. Todos os direitos reservados\./);
    assert.match(backup,/BORION_APP_VERSION = '6\.24\.1'/);
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
  const report={generatedAt:new Date().toISOString(),appVersion:'6.24.1',total:results.length,passed:results.length-failures.length,failed:failures.length,results};
  fs.writeFileSync(path.join(__dirname,'regression-results.json'),JSON.stringify(report,null,2));
  for(const r of results){
    console.log(`${r.status==='PASS'?'✓':'✗'} ${r.name}`);
    if(r.error) console.error(r.error);
  }
  console.log(`\nResultado: ${report.passed}/${report.total} testes aprovados.`);
  if(failures.length) process.exit(1);
})().catch(error=>{console.error(error);process.exit(1);});
