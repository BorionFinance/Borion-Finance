'use strict';
/* Testes de checksum canônico (item 14) e migração idempotente de schema (item 25). */
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

(async()=>{
  // 1) Checksum canônico não pode depender da ordem de inserção das propriedades.
  {
    const a = { z:1, a:{y:2,x:1}, m:[3,1,2] };
    const b = { a:{x:1,y:2}, z:1, m:[3,1,2] }; // mesmas chaves, ordem diferente; arrays na MESMA ordem
    const checksumA = await Core.checksumOf(a);
    const checksumB = await Core.checksumOf(b);
    assert(checksumA===checksumB, 'checksum deve ser igual para objetos logicamente idênticos com ordem de propriedades diferente');
  }

  // 2) Mas precisa mudar se o conteúdo realmente mudar (não pode ser um checksum burro/constante).
  {
    const checksum1 = await Core.checksumOf({valor:100});
    const checksum2 = await Core.checksumOf({valor:101});
    assert(checksum1!==checksum2, 'checksum deve mudar quando o conteúdo muda');
  }

  // 3) Ordem de ARRAY é dado, não ruído de serialização — precisa mudar o checksum.
  {
    const checksum1 = await Core.checksumOf({lista:[1,2,3]});
    const checksum2 = await Core.checksumOf({lista:[3,2,1]});
    assert(checksum1!==checksum2, 'ordem de array é dado — checksum deve mudar se a ordem mudar');
  }

  // 4) Migração de schema 6400 é idempotente: rodar duas vezes não troca nenhum
  // ID já atribuído e não duplica nada.
  {
    const data = { transacoes: [ {valor:10}, {id:'já-tinha', valor:20} ], __syncMeta:null };
    Core.migrateDataToSchema640(data, 'device-x');
    const idsAfterFirst = data.transacoes.map(t=>t.id);
    assert(idsAfterFirst[0], 'registro sem id deve receber um id');
    assert(idsAfterFirst[1]==='já-tinha', 'registro que já tinha id não pode ser trocado');
    Core.migrateDataToSchema640(data, 'device-x');
    const idsAfterSecond = data.transacoes.map(t=>t.id);
    assert(JSON.stringify(idsAfterFirst)===JSON.stringify(idsAfterSecond), 'rodar a migração de novo não pode gerar IDs novos nem reordenar');
    assert(data.__syncMeta.schemaVersion===Core.BORION_DATA_SCHEMA_VERSION, 'schemaVersion deve ficar marcada como 6400');
  }

  // 5) Migração nunca sobrescreve um valor de campo já existente (só preenche o que falta).
  {
    const data = { transacoes: [ {id:'t1', createdAt:'2020-01-01T00:00:00Z', revision:5, valor:999} ] };
    Core.migrateDataToSchema640(data, 'device-x');
    const t = data.transacoes[0];
    assert(t.createdAt==='2020-01-01T00:00:00Z', 'createdAt existente não pode ser sobrescrito');
    assert(t.revision===5, 'revision existente não pode ser sobrescrito');
    assert(t.valor===999, 'campos de negócio não podem ser tocados pela migração de identidade');
  }

  console.log('OK: checksum canônico é determinístico e a migração de schema 6400 é idempotente e não-destrutiva.');
})().catch(e=>{ console.error(e); process.exit(1); });
