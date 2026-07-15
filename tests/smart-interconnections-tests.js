#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const results = [];

function context(){
  const storage = new Map();
  const ctx = {
    console, Date, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, RegExp, Promise,
    crypto:crypto.webcrypto,
    localStorage:{getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
    document:{
      hidden:false,
      addEventListener(){}, querySelectorAll(){return [];}, getElementById(){return null;},
      createElement(){return {className:'',innerHTML:'',querySelector(){return null;},querySelectorAll(){return [];}};},
      body:{style:{},classList:{toggle(){}}}, documentElement:{setAttribute(){}}
    },
    navigator:{onLine:false},
    indexedDB:{open(){throw new Error('IndexedDB not used');}},
    setTimeout(){return 0;}, setInterval(){return 0;}, clearTimeout(){}, clearInterval(){},
    alert(){}, confirm(){return true;}, Blob:function(){},
    BackupFS:{markDirty(){}},
    renderView(){}, saveCurrentData(){}, toast(){},
    URL:{createObjectURL(){return 'blob:test';},revokeObjectURL(){}},
    TextEncoder, TextDecoder
  };
  ctx.window = ctx;
  ctx.window.addEventListener = ()=>{};
  ctx.window.matchMedia = ()=>({matches:false,addEventListener(){}});
  vm.createContext(ctx);
  return ctx;
}
function load(ctx, file){ vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),ctx,{filename:file}); }
function run(ctx, code){ return vm.runInContext(code,ctx,{timeout:5000}); }
function test(name, fn){
  try{ fn(); results.push({name,status:'PASS'}); }
  catch(error){ results.push({name,status:'FAIL',error:error.stack||String(error)}); }
}

const ctx = context();
load(ctx,'js/00-utils.js');
load(ctx,'js/01-storage-data-state.js');
load(ctx,'js/24-interconnections.js');

run(ctx, `
  function testData(){
    const data=migrateData(emptyData());
    data.contas.push({id:'bank-1',nome:'Conta Principal',tipo:'Conta corrente',saldoInicial:0,active:true,createdAt:1});
    return data;
  }
  function testConfig(){
    return {
      sourceAppId:'amanda-estetica',accountId:'bank-1',mappingReady:true,
      mappings:{
        directions:{income:'receita',expense:'variavel'},transactionKinds:{},
        categories:{income:{produto:'Venda de Produtos'},expense:{comissao:'Comissões'}},
        paymentMethods:{pix:{form:'Pix',accountId:'bank-1'},dinheiro:{form:'Dinheiro',accountId:'__carteira__'}},
        statuses:{pago:'paid',pendente:'auto'},
        revenueOrigins:{produto:'propria'}
      }
    };
  }
  function snapshot(records,tombstones=[]){
    const s={schema:'borion.interop.snapshot',schemaVersion:1,sourceAppId:'amanda-estetica',instanceId:'inst-1',revision:1,records,tombstones};
    s.contentHash=BorionInterop.__test.hash({records:s.records,tombstones:s.tombstones});
    return s;
  }
  function income(overrides={}){
    return Object.assign({aggregateId:'amanda-estetica:inst-1:r1',entityId:'r1',direction:'income',amount:100,date:'2026-07-14',description:'Produto vendido',category:'Produto',paymentMethod:'Pix',status:'Pago',settled:true,active:true,fingerprint:'fp-1'},overrides);
  }
`);

test('Vínculos convertem categoria, forma, conta e origem antes de criar',()=>{
  const out = run(ctx, `(()=>{const data=testData(),config=testConfig();const result=BorionInterop.__test.reconcileSnapshot(data,config,snapshot([income()]));const tx=data.transacoes[0];return {summary:result.summary,tx,ledger:data.liquidez.find(x=>x.accountId==='bank-1')};})()`);
  assert.strictEqual(out.summary.created,1);
  assert.strictEqual(out.tx.categoria,'Venda de Produtos');
  assert.strictEqual(out.tx.formaPagamento,'Pix');
  assert.strictEqual(out.tx.accountId,'bank-1');
  assert.strictEqual(out.tx.origem,'propria');
  assert.strictEqual(out.tx.integrationImported,true);
  assert.strictEqual(out.tx.integrationManaged,false);
  assert.strictEqual(out.tx.integrationImportMode,'native');
  assert.strictEqual(out.ledger.valor,100);
});

test('Nova sincronização não sobrescreve edição local nem duplica saldo',()=>{
  const out = run(ctx, `(()=>{const data=testData(),config=testConfig();BorionInterop.__test.reconcileSnapshot(data,config,snapshot([income()]));const tx=data.transacoes[0];tx.nome='Nome editado no Borion';tx.valor=150;const second=income({description:'Nome alterado na origem',amount:999,fingerprint:'fp-2'});const result=BorionInterop.__test.reconcileSnapshot(data,config,snapshot([second]));return {count:data.transacoes.length,nome:tx.nome,valor:tx.valor,ledger:data.liquidez.find(x=>x.accountId==='bank-1').valor,summary:result.summary};})()`);
  assert.strictEqual(out.count,1);
  assert.strictEqual(out.nome,'Nome editado no Borion');
  assert.strictEqual(out.valor,150);
  assert.strictEqual(out.ledger,100);
  assert.strictEqual(out.summary.unchanged,1);
});

test('Edição mantém referência e a referência continua bloqueando duplicidade',()=>{
  const out = run(ctx, `(()=>{const data=testData(),config=testConfig();BorionInterop.__test.reconcileSnapshot(data,config,snapshot([income()]));const tx=data.transacoes[0];Object.assign(tx,{categoria:'Receitas Diversas',formaPagamento:'Dinheiro',accountId:CARTEIRA_CONTA_ID});BorionInterop.__test.reconcileSnapshot(data,config,snapshot([income({fingerprint:'fp-3'})]));return {count:data.transacoes.length,aggregateId:tx.integrationAggregateId,categoria:tx.categoria};})()`);
  assert.strictEqual(out.count,1);
  assert.strictEqual(out.aggregateId,'amanda-estetica:inst-1:r1');
  assert.strictEqual(out.categoria,'Receitas Diversas');
});

test('Excluir e permitir importar novamente libera o ID',()=>{
  const out = run(ctx, `(()=>{const data=testData(),config=testConfig();BorionInterop.__test.reconcileSnapshot(data,config,snapshot([income()]));const old=data.transacoes[0];BorionInterop.__test.markImportedDeletion(old,'reimport',data);data.transacoes=[];data.liquidez.find(x=>x.accountId==='bank-1').valor=0;const result=BorionInterop.__test.reconcileSnapshot(data,config,snapshot([income()]));return {count:data.transacoes.length,created:result.summary.created,ignored:data.interconnections.ignored['amanda-estetica'][old.integrationAggregateId]||null};})()`);
  assert.strictEqual(out.count,1);
  assert.strictEqual(out.created,1);
  assert.strictEqual(out.ignored,null);
});

test('Excluir e ignorar permanentemente nunca reimporta',()=>{
  const out = run(ctx, `(()=>{const data=testData(),config=testConfig();BorionInterop.__test.reconcileSnapshot(data,config,snapshot([income()]));const old=data.transacoes[0];BorionInterop.__test.markImportedDeletion(old,'permanent',data);data.transacoes=[];data.liquidez.find(x=>x.accountId==='bank-1').valor=0;const result=BorionInterop.__test.reconcileSnapshot(data,config,snapshot([income()]));return {count:data.transacoes.length,ignored:result.summary.ignored,marker:data.interconnections.ignored['amanda-estetica'][old.integrationAggregateId]};})()`);
  assert.strictEqual(out.count,0);
  assert.strictEqual(out.ignored,1);
  assert.ok(out.marker);
});

test('Exclusão na origem preserva lançamento já nativo no Borion',()=>{
  const out = run(ctx, `(()=>{const data=testData(),config=testConfig();BorionInterop.__test.reconcileSnapshot(data,config,snapshot([income()]));const tx=data.transacoes[0];const tomb=[{aggregateId:tx.integrationAggregateId}];const result=BorionInterop.__test.reconcileSnapshot(data,config,snapshot([],tomb));return {count:data.transacoes.length,nome:data.transacoes[0].nome,status:result.results[0].status};})()`);
  assert.strictEqual(out.count,1);
  assert.strictEqual(out.nome,'Produto vendido');
  assert.strictEqual(out.status,'preserved');
});

test('Receita pendente espera e entra uma única vez quando recebida',()=>{
  const out = run(ctx, `(()=>{const data=testData(),config=testConfig();const pending=income({status:'Pendente',settled:false,fingerprint:'fp-p'});const a=BorionInterop.__test.reconcileSnapshot(data,config,snapshot([pending]));const paid=income({status:'Pago',settled:true,fingerprint:'fp-paid'});const b=BorionInterop.__test.reconcileSnapshot(data,config,snapshot([paid]));const c=BorionInterop.__test.reconcileSnapshot(data,config,snapshot([paid]));return {first:a.summary,second:b.summary,third:c.summary,count:data.transacoes.length};})()`);
  assert.strictEqual(out.first.waiting,1);
  assert.strictEqual(out.second.created,1);
  assert.strictEqual(out.third.unchanged,1);
  assert.strictEqual(out.count,1);
});

test('Leitura da origem descobre categorias, status, formas e tipos',()=>{
  const out = run(ctx, `(()=>{const records=[income({recordType:'Produto'}),income({aggregateId:'amanda-estetica:inst-1:r2',entityId:'r2',category:'Serviço',paymentMethod:'Dinheiro',status:'Pendente',recordType:'Serviço'})];return BorionInterop.__test.discoverSnapshot(snapshot(records),{});})()`);
  assert.strictEqual(out.categories.length,2);
  assert.strictEqual(out.paymentMethods.length,2);
  assert.strictEqual(out.statuses.length,2);
  assert.strictEqual(out.transactionKinds.length,2);
});

test('Interface contém seleção por aplicativo e aba Vínculos',()=>{
  run(ctx,"S.profiles=[];S.currentProfile=null;S.data=null;");
  const html = run(ctx,"BorionInterop.renderSettings()");
  assert.match(html,/Amanda Estética/);
  assert.match(html,/Marco Iris Tecnologia/);
  assert.match(html,/>Vínculos</);
  assert.match(html,/Integrações inteligentes/);
});

test('Editor de lançamentos não bloqueia importados e oferece exclusão inteligente',()=>{
  const src = fs.readFileSync(path.join(ROOT,'js/07-budget.js'),'utf8');
  assert.ok(!/showManagedInfo\(existing\)/.test(src));
  assert.match(src,/openImportedDeleteDialog\(existing,performDelete\)/);
  assert.match(src,/markImportedDeletion\(existing,integrationMode,S\.data\)/);
  assert.match(src,/Este lançamento agora é nativo do Borion/);
});

const failed = results.filter(x=>x.status==='FAIL');
results.forEach(r=>console.log(`${r.status==='PASS'?'✓':'✗'} ${r.name}${r.error?'\n'+r.error:''}`));
const report={generatedAt:new Date().toISOString(),appVersion:'6.30.0',total:results.length,passed:results.length-failed.length,failed:failed.length,results};
fs.writeFileSync(path.join(__dirname,'smart-interconnections-results.json'),JSON.stringify(report,null,2));
console.log(`\nResultado: ${report.passed}/${report.total} testes aprovados.`);
if(failed.length) process.exit(1);
