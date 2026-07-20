'use strict';
/* Testes do Data Guard por perfil (item 13 do pedido) — js/01d-data-guard.js. */
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
function source(name){ return fs.readFileSync(path.join(root,'js',name),'utf8'); }
function assert(cond,msg){ if(!cond) throw new Error('FALHOU: '+msg); }

function makeSandbox(){
  const store={};
  const sandbox={
    console, Object, Array, String, Number, JSON, Math, Promise, Date,
    localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}},
    window:null, CARTEIRA_CONTA_ID:'carteira-fixa'
  };
  sandbox.window=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source('01d-data-guard.js'),sandbox);
  return sandbox.BorionDataGuard;
}
const Guard = makeSandbox();

function emptyProfileData(){
  return { transacoes:[], fixas:[], fixaPagamentos:[], liquidez:[], bens:[], contas:[], cartoes:[],
    boletos:[], transferencias:[], agenda:[], metas:[], assinaturas:[], assinaturaCobrancas:[],
    investimentos:{emCaixa:[],ativos:[]}, cheques:{items:[]} };
}

(function testProfileIndexIntegrity(){
  const payload = { profiles:[{id:'p1'}], dataByProfile:{ p1: emptyProfileData(), p2: emptyProfileData() } };
  const problems = Guard.checkProfileIndexIntegrity(payload);
  assert(problems.some(p=>p.profileId==='p2' && p.severity==='warning'), 'p2 órfão (sem estar na lista de perfis) deve ser sinalizado');

  const payload2 = { profiles:[{id:'p1'},{id:'p3'}], dataByProfile:{ p1: emptyProfileData() } };
  const problems2 = Guard.checkProfileIndexIntegrity(payload2);
  assert(problems2.some(p=>p.profileId==='p3' && p.severity==='critical'), 'p3 listado sem dataByProfile deve ser crítico');
  console.log('OK: integridade do índice de perfis (item 13)');
})();

(function testPerProfileDrop(){
  // Um perfil zera uma coleção crítica mesmo que o TOTAL da conta (outro
  // perfil compensando) pareça normal — a checagem agregada antiga não pegaria
  // isso; a por-perfil precisa pegar.
  const baseline = { p1: Guard.countProfileRecords({transacoes:new Array(50).fill(0)}), p2: Guard.countProfileRecords({transacoes:new Array(1).fill(0)}) };
  const next = { profiles:[{id:'p1'},{id:'p2'}], dataByProfile:{
    p1: Object.assign(emptyProfileData(), {transacoes:[]}), // p1 zerou (era 50)
    p2: Object.assign(emptyProfileData(), {transacoes:new Array(60).fill(0)}) // p2 cresceu bastante — compensa no agregado
  }};
  const drops = Guard.detectPerProfileDrop(next, baseline, {});
  assert(drops.p1 && drops.p1.some(r=>r.kind==='zeroed'), 'p1 zerado deve ser detectado mesmo com o total da conta parecendo saudável');
  assert(!drops.p2, 'p2 que só cresceu não deveria disparar nada');
  console.log('OK: queda suspeita detectada por perfil, mesmo compensada no agregado (item 13)');
})();

(function testDuplicateIds(){
  const data = Object.assign(emptyProfileData(), { transacoes:[{id:'dup'},{id:'dup'},{id:'unico'}] });
  const dups = Guard.findDuplicateIds(data);
  assert(dups.length===1 && dups[0].id==='dup' && dups[0].count===2, 'deve detectar exatamente um id duplicado com contagem 2');
  console.log('OK: detecção de IDs duplicados (item 13)');
})();

(function testBrokenReferences(){
  const data = Object.assign(emptyProfileData(), {
    fixas: [{id:'fixaA'}],
    fixaPagamentos: [{id:'pgOk', fixaId:'fixaA'}, {id:'pgOrfao', fixaId:'fixaInexistente'}],
    assinaturas: [{id:'assA'}],
    assinaturaCobrancas: [{id:'cobOk', assinaturaId:'assA'}, {id:'cobOrfa', assinaturaId:'assX'}],
    contas: [{id:'contaA'}],
    transferencias: [
      {id:'trOk', origemTipo:'conta', origemId:'contaA', destinoTipo:'conta', destinoId:'contaA'},
      {id:'trSemOrigem', origemTipo:'conta', origemId:'contaFantasma', destinoTipo:'conta', destinoId:'contaA'},
      {id:'trSemDestino', origemTipo:'conta', origemId:'contaA', destinoTipo:'conta', destinoId:'contaFantasma'}
    ]
  });
  const broken = Guard.findBrokenReferences(data);
  assert(broken.some(b=>b.kind==='pagamento_sem_despesa' && b.id==='pgOrfao'), 'pagamento sem despesa correspondente deve ser detectado');
  assert(broken.some(b=>b.kind==='cobranca_sem_assinatura' && b.id==='cobOrfa'), 'cobrança sem assinatura correspondente deve ser detectada');
  assert(broken.some(b=>b.kind==='transferencia_sem_origem' && b.id==='trSemOrigem'), 'transferência sem origem deve ser detectada');
  assert(broken.some(b=>b.kind==='transferencia_sem_destino' && b.id==='trSemDestino'), 'transferência sem destino deve ser detectada');
  assert(!broken.some(b=>b.id==='trOk' || b.id==='pgOk' || b.id==='cobOk'), 'referências válidas não podem gerar falso positivo');
  console.log('OK: detecção de referências quebradas (item 13)');
})();

(function testInvalidValues(){
  const data = Object.assign(emptyProfileData(), { transacoes:[{id:'t1', valor: NaN},{id:'t2', valor: Infinity},{id:'t3', valor: 10}] });
  const invalid = Guard.findInvalidValues(data);
  assert(invalid.some(i=>i.id==='t1') && invalid.some(i=>i.id==='t2'), 'NaN e Infinity devem ser sinalizados');
  assert(!invalid.some(i=>i.id==='t3'), 'valor numérico válido não pode gerar falso positivo');
  console.log('OK: detecção de valores inválidos (NaN/Infinity) (item 13)');
})();

console.log('OK: todos os testes do Data Guard por perfil (item 13) passaram.');
