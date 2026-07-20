'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'js/01c-google-drive-provider.js'),'utf8');
function assert(cond,msg){if(!cond)throw new Error('FALHOU: '+msg);}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}

function makeRuntime(){
  const ls={};
  const persisted={config:{theme:'old'},profiles:[{id:'old',name:'Antigo'}],data:{old:{transacoes:[{id:'old-tx',valor:1}]}}};
  const counters={config:0,profiles:0,data:0};
  const sb={console,Object,Array,String,Number,JSON,Math,Promise,Date,Map,Set,TextEncoder,
    window:null,navigator:{onLine:true},location:{hash:'',search:'',protocol:'https:'},
    document:{hidden:false,visibilityState:'visible',activeElement:null,querySelector(){return null},getElementById(){return null},addEventListener(){}},
    localStorage:{getItem:k=>ls[k]??null,setItem:(k,v)=>{ls[k]=String(v)},removeItem:k=>delete ls[k]},
    setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},clearInterval(){},addEventListener(){},
    S:{config:clone(persisted.config),profiles:clone(persisted.profiles),currentProfile:{id:'old',name:'Antigo'},data:clone(persisted.data.old)},
    setConfig(v){counters.config++;persisted.config=clone(v)},setProfiles(v){counters.profiles++;persisted.profiles=clone(v)},
    getProfileData(id){return clone(persisted.data[id]||null)},setProfileData(id,v){counters.data++;persisted.data[id]=clone(v)},
    idbDeleteProfileData(){return Promise.resolve(true)},
    getProfileTombstones6401(){return {}},setProfileTombstones6401(){},applyProfileTombstones6401(){},
    migrateData(v){return Object.assign({},v,{migrated:true})},emptyData(){return {transacoes:[]}},
    validateBorionJson(){return {valid:true,errors:[]}},readJSON(){return null},writeJSON(){},
    setStorageMode(){},toast(){},renderGate(){},renderView(){},clearExitSavePending(){},
    BorionSyncCore:{BORION_DATA_SCHEMA_VERSION:6401,checksumOf:async()=> 'checksum'},
    BorionSyncState:{set(){}},BorionDriveJournal640:{},BorionDataGuard:null
  };
  sb.window=sb;vm.createContext(sb);
  vm.runInContext(src+'\nwindow.__prepare=prepareAccountPayload6401;window.__apply=applyAccountPayloadSilently;',sb);
  return {sb,persisted,counters};
}

(function migrationInterruptionIsAtomic(){
  const {sb,persisted,counters}=makeRuntime();let calls=0;
  sb.migrateData=v=>{calls++;if(calls===2)throw Object.assign(new Error('interrupção simulada'),{code:'MIGRATION_INTERRUPTED'});return Object.assign({},v,{migrated:true});};
  const payload={profiles:[{id:'p1'},{id:'p2'}],dataByProfile:{p1:{transacoes:[]},p2:{transacoes:[]}},config:{theme:'new'}};
  let error=null;try{sb.__apply(payload);}catch(e){error=e;}
  assert(error&&error.code==='MIGRATION_INTERRUPTED','interrupção da migração deve ser propagada');
  assert(counters.config===0&&counters.profiles===0&&counters.data===0,'nenhuma persistência pode começar antes de todos os perfis migrarem');
  assert(sb.S.config.theme==='old'&&sb.S.profiles.length===1&&sb.S.profiles[0].id==='old','estado em memória deve continuar integralmente anterior');
  assert(persisted.config.theme==='old'&&persisted.profiles[0].id==='old','estado persistido deve continuar anterior');
})();

(function invalidProfileIndexesAreBlocked(){
  const {sb}=makeRuntime();
  let duplicate=null;try{sb.__prepare({profiles:[{id:'p1'},{id:'p1'}],dataByProfile:{p1:{}},config:{}});}catch(e){duplicate=e;}
  assert(duplicate&&duplicate.code==='PROFILE_ID_DUPLICATE','ID de perfil duplicado deve bloquear a aplicação');
  let orphan=null;try{sb.__prepare({profiles:[{id:'p1'}],dataByProfile:{p1:{},fantasma:{}},config:{}});}catch(e){orphan=e;}
  assert(orphan&&orphan.code==='PROFILE_DATA_ORPHANED','dados de perfil órfão devem bloquear a aplicação');
})();

(function storageFailureRollsBack(){
  const {sb,persisted}=makeRuntime();
  const realSet=sb.setProfileData;sb.setProfileData=(id,v)=>{if(id==='p2')throw Object.assign(new Error('quota simulada'),{code:'QUOTA'});return realSet(id,v);};
  let error=null;try{sb.__apply({profiles:[{id:'p1'},{id:'p2'}],dataByProfile:{p1:{transacoes:[]},p2:{transacoes:[]}},config:{theme:'new'}});}catch(e){error=e;}
  assert(error&&error.code==='QUOTA','falha de persistência deve ser propagada');
  assert(sb.S.config.theme==='old'&&sb.S.profiles.length===1&&sb.S.profiles[0].id==='old','rollback deve restaurar estado em memória');
  assert(persisted.config.theme==='old'&&persisted.profiles.length===1&&persisted.profiles[0].id==='old','rollback deve restaurar configuração e índice de perfis persistidos');
})();

(function validPayloadAppliesAllProfiles(){
  const {sb,persisted}=makeRuntime();
  const result=sb.__apply({profiles:[{id:'p1',name:'Pedro'},{id:'p2',name:'Amanda'}],dataByProfile:{p1:{transacoes:[{id:'a'}]},p2:{transacoes:[{id:'b'}]}},config:{theme:'dark'}});
  assert(result.profileRemoved===false&&sb.S.profiles.length===2,'payload válido deve aplicar todos os perfis de uma vez');
  assert(persisted.data.p1.migrated===true&&persisted.data.p2.migrated===true,'todos os perfis devem estar migrados antes da confirmação');
})();

console.log('OK: aplicação de conta é atômica; interrupção, quota, IDs duplicados e dados órfãos não deixam migração parcial.');
