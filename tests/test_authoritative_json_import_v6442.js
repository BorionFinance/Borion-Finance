'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const assert=(cond,msg)=>{if(!cond)throw new Error('FALHOU: '+msg);};
const ctx={console,TextEncoder,crypto:crypto.webcrypto,window:{}};ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'..','js','01e-sync-core-v640.js'),'utf8'),ctx);
const Core=ctx.BorionSyncCore;
const tx=n=>Array.from({length:n},(_,i)=>({id:'t'+(i+1),descricao:'L '+(i+1),valor:i+1,createdAt:'2026-01-01',updatedAt:'2026-01-01',revision:1}));
const profile=(items)=>Core.migrateDataToSchema640({transacoes:items,categorias:{receita:[],fixa:[],variavel:[]}},'dev','p1');

const old40=profile(tx(40));
const imported10=Core.markAuthoritativeImport(profile(tx(10)),{profileId:'p1',previousData:[old40],token:'import-token-1',importedAt:'2026-07-20T12:00:00.000Z'});

// 1) A importação manual vence o snapshot remoto maior.
let merged=Core.mergeProfileData(old40,imported10,old40);
assert(merged.transacoes.length===10,'backup manual de 10 lançamentos deve substituir os 40 remotos');
assert(merged.__syncMeta.authoritativeImport.token==='import-token-1','marco autoritativo deve sobreviver ao merge');

// 2) Uma aba/dispositivo antigo não pode ressuscitar os 30 registros removidos.
const stale40=profile(tx(40));
merged=Core.mergeProfileData(imported10,stale40,imported10);
assert(merged.transacoes.length===10,'snapshot antigo sem o marco não pode ressuscitar registros');

// 3) Depois que ambos conhecem o mesmo marco, novas edições voltam a mesclar.
const localAfter=JSON.parse(JSON.stringify(imported10));
localAfter.transacoes.push({id:'novo-local',descricao:'Depois da importação',valor:99,createdAt:'2026-07-21',updatedAt:'2026-07-21',revision:1});
const remoteAfter=JSON.parse(JSON.stringify(imported10));
remoteAfter.transacoes.push({id:'novo-remoto',descricao:'Outro dispositivo',valor:88,createdAt:'2026-07-21',updatedAt:'2026-07-21',revision:1});
merged=Core.mergeProfileData(imported10,localAfter,remoteAfter);
assert(merged.transacoes.length===12,'edições novas dos dois lados devem ser preservadas após a importação');
assert(merged.transacoes.some(x=>x.id==='novo-local')&&merged.transacoes.some(x=>x.id==='novo-remoto'),'novas edições devem coexistir');

// 4) O fluxo real deve confirmar conscientemente a queda suspeita apenas na importação manual.
const events=fs.readFileSync(path.resolve(__dirname,'..','js','14-events-boot-pwa.js'),'utf8');
const review=fs.readFileSync(path.resolve(__dirname,'..','js','23-profile-import-review.js'),'utf8');
assert(events.includes("source:'manual_json_authoritative_import'")&&events.includes('acknowledgeSuspicious:true'),'importação manual deve confirmar a redução esperada ao sincronizar');
assert(review.includes('importAsAuthoritativeData')&&review.includes('O JSON importado agora é a versão oficial'),'revisão de conta deve carimbar substituições como autoritativas');
console.log('OK: JSON manual substitui de forma absoluta, vence snapshots antigos e não bloqueia edições posteriores.');
