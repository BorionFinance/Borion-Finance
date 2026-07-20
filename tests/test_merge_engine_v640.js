'use strict';
/* Testes do motor de mesclagem de três vias (js/01e-sync-core-v640.js).
   Cobre os cenários obrigatórios do item 27.1 do pedido:
   A) perfis diferentes; B) mesmo perfil, registros diferentes;
   C) mesmo registro, campos diferentes; D) mesmo campo (conflito);
   E) edição contra exclusão; F) idempotência de operação repetida
      (mais o caso de duas exclusões do mesmo registro). */
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const nodeCrypto=require('crypto');

const root=path.resolve(__dirname,'..');
function source(name){ return fs.readFileSync(path.join(root,'js',name),'utf8'); }
function assert(cond,msg){ if(!cond) throw new Error('FALHOU: '+msg); }

function makeSandbox(){
  const sandbox={ console, Object, Array, String, Number, JSON, Math, Promise, Date, Map, Set, TextEncoder, crypto: nodeCrypto.webcrypto, window:null };
  sandbox.window=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source('01e-sync-core-v640.js')+'\nwindow.BorionSyncCore=BorionSyncCore;',sandbox);
  return sandbox.BorionSyncCore;
}
const Core = makeSandbox();

function rec(id, fields){ return Object.assign({id}, fields); }
function profileWith(txs){ return { transacoes: txs, __syncMeta: Core.emptySyncMeta() }; }

(function scenarioA_differentProfiles(){
  // A e B leem a mesma versão; A altera o perfil "pedro"; B altera "amanda".
  // Ambos os perfis devem sobreviver na conta consolidada — nenhum é descartado
  // só porque um dos lados não tem dados dele.
  const base = { profiles:[{id:'pedro'},{id:'amanda'}], dataByProfile:{ pedro: profileWith([rec('t1',{valor:10,updatedAt:'2026-01-01T00:00:00Z'})]), amanda: profileWith([]) } };
  const local = JSON.parse(JSON.stringify(base));
  local.dataByProfile.pedro.transacoes.push(rec('t2',{valor:20,updatedAt:'2026-01-02T00:00:00Z'}));
  const remote = JSON.parse(JSON.stringify(base));
  remote.dataByProfile.amanda.transacoes.push(rec('t3',{valor:30,updatedAt:'2026-01-02T00:00:00Z'}));

  const merged = Core.mergeAccountPayload(base, local, remote);
  assert(merged.dataByProfile.pedro.transacoes.some(t=>t.id==='t2'), 'A: alteração local em pedro deve sobreviver');
  assert(merged.dataByProfile.amanda.transacoes.some(t=>t.id==='t3'), 'A: alteração remota em amanda deve sobreviver');
  console.log('OK cenário A (perfis diferentes)');
})();

(function scenarioB_differentRecordsSameProfile(){
  // A cria uma receita; B cria uma despesa (mesmo perfil) — os dois devem permanecer.
  const base = { transacoes: [], fixas: [], __syncMeta: Core.emptySyncMeta() };
  const local = JSON.parse(JSON.stringify(base));
  local.transacoes.push(rec('rec1',{valor:100,updatedAt:'2026-02-01T00:00:00Z'}));
  const remote = JSON.parse(JSON.stringify(base));
  remote.fixas.push(rec('fixa1',{valor:50,updatedAt:'2026-02-01T00:00:00Z'}));

  const merged = Core.mergeProfileData(base, local, remote);
  assert(merged.transacoes.some(t=>t.id==='rec1'), 'B: receita local deve permanecer');
  assert(merged.fixas.some(f=>f.id==='fixa1'), 'B: despesa remota deve permanecer');
  console.log('OK cenário B (registros diferentes, mesmo perfil)');
})();

(function scenarioC_sameRecordDifferentFields(){
  // A altera a descrição; B altera a categoria do MESMO registro — os dois campos
  // devem ser preservados juntos (nenhum é descartado).
  const base = profileWith([rec('t1',{descricao:'original', categoria:'Outro', updatedAt:'2026-03-01T00:00:00Z'})]);
  const local = JSON.parse(JSON.stringify(base));
  local.transacoes[0].descricao='Mercado'; local.transacoes[0].updatedAt='2026-03-02T00:00:00Z';
  const remote = JSON.parse(JSON.stringify(base));
  remote.transacoes[0].categoria='Alimentação'; remote.transacoes[0].updatedAt='2026-03-02T00:00:00Z';

  const merged = Core.mergeProfileData(base, local, remote);
  const t = merged.transacoes.find(x=>x.id==='t1');
  assert(t.descricao==='Mercado', 'C: descrição alterada localmente deve ser preservada');
  assert(t.categoria==='Alimentação', 'C: categoria alterada remotamente deve ser preservada');
  assert(merged.__syncMeta.conflicts.length===0, 'C: campos diferentes não geram conflito, só mesclam');
  console.log('OK cenário C (campos diferentes no mesmo registro)');
})();

(function scenarioD_sameFieldConflict(){
  // A altera valor para X; B altera valor para Y — não pode haver escolha
  // silenciosa: deve virar conflito com as duas versões preservadas.
  const base = profileWith([rec('t1',{valor:100, updatedAt:'2026-04-01T00:00:00Z'})]);
  const local = JSON.parse(JSON.stringify(base));
  local.transacoes[0].valor=200; local.transacoes[0].updatedAt='2026-04-02T00:00:00Z';
  const remote = JSON.parse(JSON.stringify(base));
  remote.transacoes[0].valor=300; remote.transacoes[0].updatedAt='2026-04-02T00:05:00Z'; // remoto é "mais novo" só no relógio — não deve vencer por isso

  const merged = Core.mergeProfileData(base, local, remote);
  assert(merged.__syncMeta.conflicts.length===1, 'D: deve registrar exatamente um conflito de campo');
  const c = merged.__syncMeta.conflicts[0];
  assert(c.field==='valor' && c.base===100 && c.local===200 && c.remote===300, 'D: conflito deve preservar base/local/remoto');
  console.log('OK cenário D (mesmo campo alterado nos dois lados — conflito, sem perda)');
})();

(function scenarioE_editVsDelete(){
  // A edita um registro; B exclui o mesmo registro — o sistema deve bloquear a
  // perda silenciosa e criar conflito, preservando o registro.
  const base = profileWith([rec('t1',{valor:100, updatedAt:'2026-05-01T00:00:00Z'})]);
  const local = JSON.parse(JSON.stringify(base)); // local exclui
  local.transacoes = [];
  Core.recordTombstone(local, 'transacoes', 't1', 'device-A', 'op-1');
  const remote = JSON.parse(JSON.stringify(base)); // remoto editou depois da base
  remote.transacoes[0].valor=999; remote.transacoes[0].updatedAt='2026-05-02T00:00:00Z';

  const merged = Core.mergeProfileData(base, local, remote);
  assert(merged.transacoes.some(t=>t.id==='t1'), 'E: registro não pode desaparecer silenciosamente por causa de uma exclusão concorrente');
  assert(merged.__syncMeta.conflicts.some(c=>c.kind==='edit_vs_delete'), 'E: deve registrar conflito de edição-x-exclusão');
  console.log('OK cenário E (edição x exclusão — bloqueado, registrado, preservado)');
})();

(function scenarioF_idempotency(){
  // Duas exclusões do mesmo registro (idempotente — não gera conflito) e a
  // mesma operação sendo aplicada duas vezes não deve duplicar nada.
  const base = profileWith([rec('t1',{valor:100, updatedAt:'2026-06-01T00:00:00Z'})]);
  const localA = JSON.parse(JSON.stringify(base)); localA.transacoes=[];
  Core.recordTombstone(localA,'transacoes','t1','device-A','op-A');
  const localB = JSON.parse(JSON.stringify(base)); localB.transacoes=[];
  Core.recordTombstone(localB,'transacoes','t1','device-B','op-B');

  const merged = Core.mergeProfileData(base, localA, localB);
  assert(merged.transacoes.length===0, 'F: duas exclusões do mesmo registro devem resultar em uma única exclusão (idempotente)');
  assert(!merged.__syncMeta.conflicts.some(c=>c.id==='t1'), 'F: duas exclusões não devem virar conflito');

  // Aplicar a MESMA operação duas vezes (via mergeAccountPayload simulando
  // consolidação repetida) não deve duplicar registros.
  const accBase = { profiles:[{id:'p1'}], dataByProfile:{ p1: profileWith([]) } };
  const opPayload = { profiles:[{id:'p1'}], dataByProfile:{ p1: profileWith([rec('novo',{valor:50,updatedAt:'2026-06-05T00:00:00Z'})]) } };
  const afterFirst = Core.mergeAccountPayload(accBase, opPayload, accBase);
  const afterSecond = Core.mergeAccountPayload(accBase, opPayload, afterFirst); // reaplicar a MESMA operação
  const countFirst = afterFirst.dataByProfile.p1.transacoes.length;
  const countSecond = afterSecond.dataByProfile.p1.transacoes.length;
  assert(countFirst===1 && countSecond===1, 'F: reaplicar a mesma operação não deve duplicar o registro (idempotência por id)');
  console.log('OK cenário F (idempotência: duas exclusões e operação repetida)');
})();

(function neverDropsWholeProfile(){
  // "Nunca descarte um perfil inteiro apenas porque não existe no cache local."
  const base = { profiles:[{id:'p1'}], dataByProfile:{ p1: profileWith([]) } };
  const local = { profiles:[{id:'p1'}], dataByProfile:{ p1: profileWith([]) } }; // não conhece p2 ainda
  const remote = { profiles:[{id:'p1'},{id:'p2'}], dataByProfile:{ p1: profileWith([]), p2: profileWith([rec('x',{valor:1,updatedAt:'2026-07-01T00:00:00Z'})]) } };
  const merged = Core.mergeAccountPayload(base, local, remote);
  assert(merged.dataByProfile.p2 && merged.dataByProfile.p2.transacoes.length===1, 'perfil p2 (só remoto) nunca pode ser descartado');
  console.log('OK: perfil que só existe remotamente nunca é descartado');
})();

(function protoPollutionGuard(){
  // Item 21: a mesclagem nunca pode confiar em __proto__/constructor/prototype
  // como se fossem campos de dado legítimos — um JSON malicioso poderia usar
  // isso para tentar poluir o protótipo de objetos genéricos.
  const base = profileWith([rec('t1',{valor:10,updatedAt:'2026-08-01T00:00:00Z'})]);
  const malicious = JSON.parse('{"transacoes":[{"id":"t1","valor":10,"updatedAt":"2026-08-02T00:00:00Z","__proto__":{"polluted":true}}],"__syncMeta":{"tombstones":{},"conflicts":[],"revision":0}}');
  const remote = JSON.parse(JSON.stringify(base));

  const merged = Core.mergeProfileData(base, malicious, remote);
  assert(({}).polluted===undefined, 'Object.prototype não pode ter sido poluído pela mesclagem');
  assert(Array.isArray(merged.transacoes), 'a mesclagem deve continuar funcionando normalmente mesmo recebendo uma chave perigosa');
  console.log('OK: mesclagem protegida contra prototype pollution (item 21)');
})();

console.log('OK: todos os cenários de mesclagem de três vias (item 27.1) passaram sem perda de dados.');
