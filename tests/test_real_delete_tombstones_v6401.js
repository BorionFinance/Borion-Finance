'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),nodeCrypto=require('crypto');
const root=path.resolve(__dirname,'..');
function source(name){return fs.readFileSync(path.join(root,'js',name),'utf8');}
function assert(cond,msg){if(!cond)throw new Error('FALHOU: '+msg);}
function clone(v){return JSON.parse(JSON.stringify(v));}
function makeRuntime(){
  const store={};
  const testConsole=Object.assign({},console,{warn(...args){if(String(args[0]||'').startsWith('IndexedDB'))return;console.warn(...args);}});
  const sb={console:testConsole,Object,Array,String,Number,JSON,Math,Promise,Date,Map,Set,TextEncoder,TextDecoder,crypto:nodeCrypto.webcrypto,
    window:null,navigator:{onLine:true},location:{hash:'',search:'',protocol:'https:'},
    document:{getElementById(){return null},querySelector(){return null},querySelectorAll(){return []},addEventListener(){},body:{classList:{add(){},remove(){},toggle(){}}},documentElement:{style:{setProperty(){}}}},
    localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>delete store[k]},
    indexedDB:{open(){throw new Error('idb off')}},setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},clearInterval(){},addEventListener(){},alert(){},confirm(){return true},
    BackupFS:{markDirty(){},maybeAutoBackup(){}},GoogleDriveProvider:null,CloudStorage:null};
  sb.window=sb;vm.createContext(sb);
  vm.runInContext(source('00-utils.js'),sb);
  vm.runInContext(source('01e-sync-core-v640.js')+'\nwindow.BorionSyncCore=BorionSyncCore;',sb);
  vm.runInContext(source('01-storage-data-state.js')+'\nwindow.__S=S;window.__Actions=BorionDataActions6401;',sb);
  return sb;
}
const sb=makeRuntime(),Core=sb.BorionSyncCore,Actions=sb.__Actions;
sb.recordPatrimonioSnapshot=()=>{};sb.markExitSavePending=()=>{};sb.clearExitSavePending=()=>{};
const data=sb.emptyData();
Object.assign(data,{
  transacoes:[{id:'tx1',nome:'Receita',valor:10}],fixas:[{id:'fx1',nome:'Fixa',valor:5}],
  transferencias:[{id:'tr1',valor:3}],contas:[{id:'ct1',nome:'Conta'}],cartoes:[{id:'ca1',nome:'Cartão'}],
  agenda:[{id:'ag1',titulo:'Agenda'}],metas:[{id:'me1',nome:'Meta'}],assinaturas:[{id:'as1',nome:'Assinatura'}],
  investimentos:{emCaixa:[],ativos:[{id:'iv1',nome:'Ativo'}]},
  reservas:{enabled:true,boxes:[{id:'rs1',nome:'Reserva'}],moves:[{id:'rm1',boxId:'rs1'}],monthlyReports:[]},
  categorias:{receita:['Base','Excluir'],fixa:['Base'],variavel:['Base']}
});
sb.migrateData(data,{profileId:'p1'});

// Função central real de exclusão usada pela aplicação.
sb.__S.currentProfile={id:'p1',name:'Pedro'};sb.__S.profiles=[sb.__S.currentProfile];sb.__S.data=clone(data);sb.setProfileData('p1',clone(data));
const deleted=Actions.deleteEntity({profileId:'p1',collection:'transacoes',entityId:'tx1',reason:'test_real_delete'});
assert(deleted===true,'deleteEntity real deve excluir a entidade');
assert(!sb.__S.data.transacoes.some(x=>x.id==='tx1'),'registro deve desaparecer visualmente');
assert(sb.__S.data.__syncMeta.tombstones.transacoes.tx1.operationId,'exclusão real deve registrar tombstone com operationId');
assert(sb.__S.data.__syncMeta.tombstones.transacoes.tx1.deviceId===null||typeof sb.__S.data.__syncMeta.tombstones.transacoes.tx1.deviceId==='string','tombstone deve possuir deviceId explícito');

// Captura central cobre TODOS os caminhos antigos que removem de arrays e depois
// chamam saveCurrentData(). O inventário é o mesmo usado pelo merge real.
const previous=sb.emptyData();
const expected=[];
for(const pathSpec of Core.BORION_SYNCABLE_COLLECTIONS){
  const key=Core.pathKey(pathSpec),id='del_'+key.replace(/[^a-z0-9]/gi,'_');
  let record={id,nome:key,valor:1};
  if(key==='fixaPagamentos')record={id,fixaId:'del_fixas',monthKey:'2026-01'};
  if(key==='reservas.monthlyReports')record={id,monthKey:'2026-01',closedAt:'2026-02-01T00:00:00.000Z',total:1};
  Core.pathSet(previous,pathSpec,[record]);expected.push([key,id]);
}
previous.categorias={receita:['Base','Excluir Receita'],fixa:['Base','Excluir Fixa'],variavel:['Base','Excluir Variável']};
sb.migrateData(previous,{profileId:'p1'});
const current=clone(previous);
for(const pathSpec of Core.BORION_SYNCABLE_COLLECTIONS)Core.pathSet(current,pathSpec,[]);
current.categorias={receita:['Base','Outro'],fixa:['Base','Outro'],variavel:['Base','Outro']};
const result=Actions.captureImplicitDeletions(previous,current,'p1');
assert(result.entities>=Core.BORION_SYNCABLE_COLLECTIONS.length,'captura deve cobrir cada coleção sincronizável do inventário real');
assert(result.primitives===3,'captura deve cobrir categorias removidas dos três tipos');
for(const [collection,id] of expected){
  assert(current.__syncMeta.tombstones[collection]&&current.__syncMeta.tombstones[collection][id],collection+' deve possuir tombstone');
  const tomb=current.__syncMeta.tombstones[collection][id];
  assert(tomb.operationId&&tomb.deletedAt&&Object.prototype.hasOwnProperty.call(tomb,'deviceId'),collection+' deve registrar operationId/deletedAt/deviceId');
}
for(const type of ['receita','fixa','variavel'])assert(Object.keys(current.__syncMeta.tombstones['categorias.'+type]||{}).length===1,'categoria '+type+' removida deve possuir tombstone');

// Dispositivo antigo com cópia inalterada não pode ressuscitar; edição concorrente
// contra exclusão deve virar conflito e preservar a edição para revisão.
const base={transacoes:[{id:'old',valor:10,createdAt:'2026-01-01',updatedAt:'2026-01-01',revision:1}],categorias:{receita:['Base'],fixa:[],variavel:[]},__syncMeta:Core.emptySyncMeta()};
const removed=clone(base);removed.transacoes=[];Actions.captureImplicitDeletions(base,removed,'p1');
const stale=clone(base);
const noResurrection=Core.mergeProfileData(base,removed,stale);
assert(noResurrection.transacoes.length===0,'dispositivo antigo não pode ressuscitar registro excluído');
const edited=clone(base);edited.transacoes[0].valor=99;edited.transacoes[0].updatedAt='2026-02-01';
const conflict=Core.mergeProfileData(base,removed,edited);
assert(conflict.transacoes.some(x=>x.id==='old'&&x.valor===99),'edição concorrente deve ser preservada para revisão');
assert(conflict.__syncMeta.conflicts.some(c=>c.kind==='edit_vs_delete'&&c.id==='old'),'edição x exclusão deve gerar conflito explícito');

const profileTomb=Actions.deleteProfile('p1','test_profile_delete');
assert(profileTomb&&profileTomb.operationId&&profileTomb.deletedAt,'exclusão de perfil deve registrar tombstone durável');
console.log('OK: exclusões reais e implícitas criam tombstones; registro antigo não ressuscita e edição concorrente vira conflito preservado.');
