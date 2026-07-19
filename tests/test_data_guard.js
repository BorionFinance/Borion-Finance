'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js','01d-data-guard.js'),'utf8');
const sandbox={ console, Object, Array, String, Number, JSON, Math, window:null, localStorage:{ _s:{}, getItem(k){ return this._s[k]??null; }, setItem(k,v){ this._s[k]=String(v); }, removeItem(k){ delete this._s[k]; } } };
sandbox.window=sandbox;
vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:'01d-data-guard.js'});

const G = sandbox.BorionDataGuard;
if(!G) throw new Error('window.BorionDataGuard não foi exposto.');

function assert(cond, msg){ if(!cond) throw new Error('FALHOU: '+msg); }

function profileData(counts={}){
  return {
    transacoes: new Array(counts.transacoes||0).fill(0).map((_,i)=>({id:'t'+i})),
    fixas: new Array(counts.fixas||0).fill(0),
    fixaPagamentos: [], liquidez: [], bens: [], contas: [], cartoes: [],
    boletos: [], transferencias: [], agenda: [], metas: [], assinaturas: [],
    investimentos: { emCaixa: [], ativos: new Array(counts.ativos||0).fill(0) },
    cheques: { items: [] }
  };
}
function accountPayload(profilesCounts){
  const profiles = Object.keys(profilesCounts).map(id=>({id, name:id}));
  const dataByProfile = {};
  Object.keys(profilesCounts).forEach(id=>{ dataByProfile[id] = profileData(profilesCounts[id]); });
  return { profiles, dataByProfile };
}

// 1) Contagem soma corretamente entre perfis
{
  const payload = accountPayload({ pedro:{transacoes:10}, amanda:{transacoes:5,ativos:3} });
  const counts = G.countAccountRecords(payload);
  assert(counts.transacoes===15, 'soma de transacoes entre perfis deveria ser 15, veio '+counts.transacoes);
  assert(counts['investimentos.ativos']===3, 'contagem de ativos deveria ser 3');
  assert(counts.__profileCount===2, 'deveria contar 2 perfis');
}

// 2) Sem baseline nunca acusa (primeira sincronização)
{
  const counts = G.countAccountRecords(accountPayload({ pedro:{} }));
  const result = G.detectSuspiciousAccountDrop(counts, null);
  assert(result.suspicious===false, 'sem baseline não deveria acusar suspeita');
}

// 3) Base preenchida virando zero é bloqueada (o cenário do incidente, adaptado)
{
  const baseline = G.countAccountRecords(accountPayload({ pedro:{transacoes:400}, amanda:{transacoes:300} }));
  const next = G.countAccountRecords(accountPayload({ pedro:{}, amanda:{} }));
  const result = G.detectSuspiciousAccountDrop(next, baseline);
  assert(result.suspicious===true, 'transacoes zeradas deveriam ser suspeitas');
  assert(result.reasons.some(r=>r.key==='transacoes' && r.kind==='zeroed'), 'motivo deveria citar transacoes zeradas');
}

// 4) Perfil inteiro sumindo (a checagem antiga) continua funcionando
{
  const baseline = G.countAccountRecords(accountPayload({ pedro:{transacoes:5}, amanda:{transacoes:5} }));
  const next = G.countAccountRecords({ profiles: [], dataByProfile: {} });
  const result = G.detectSuspiciousAccountDrop(next, baseline);
  assert(result.suspicious===true, 'todos os perfis sumindo deveria ser suspeito');
  assert(result.reasons.some(r=>r.key==='__profiles'), 'motivo deveria citar __profiles');
}

// 5) Queda pequena/legítima não é bloqueada
{
  const baseline = G.countAccountRecords(accountPayload({ pedro:{transacoes:100} }));
  const next = G.countAccountRecords(accountPayload({ pedro:{transacoes:92} }));
  const result = G.detectSuspiciousAccountDrop(next, baseline);
  assert(result.suspicious===false, 'queda pequena e legítima não deveria ser bloqueada');
}

// 6) Queda grande (>40%) sem zerar também é bloqueada
{
  const baseline = G.countAccountRecords(accountPayload({ pedro:{transacoes:100} }));
  const next = G.countAccountRecords(accountPayload({ pedro:{transacoes:40} }));
  const result = G.detectSuspiciousAccountDrop(next, baseline);
  assert(result.suspicious===true, 'queda de 60% deveria ser bloqueada');
}

// 7) Persistência de última contagem confiável
{
  G.writeLastGoodCounts('folder123', {transacoes:10});
  const read = G.readLastGoodCounts('folder123');
  assert(read && read.transacoes===10, 'deveria persistir e reler a última contagem confiável');
  assert(G.readLastGoodCounts('outra-pasta')===null, 'pasta sem histórico deveria retornar null');
}

console.log('OK: todos os testes de BorionDataGuard passaram.');
