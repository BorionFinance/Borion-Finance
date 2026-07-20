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
    indexedDB:{open(){throw new Error('idb off')}},setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},clearInterval(){},addEventListener(){},
    alert(){},confirm(){return true},renderView(){},renderGate(){},logout(){sb.S.currentProfile=null;sb.S.data=null;},
    BackupFS:{markDirty(){},maybeAutoBackup(){}},CloudStorage:null};
  sb.window=sb;vm.createContext(sb);
  vm.runInContext(source('00-utils.js'),sb);
  vm.runInContext(source('01e-sync-core-v640.js')+'\nwindow.BorionSyncCore=BorionSyncCore;',sb);
  vm.runInContext(source('01-storage-data-state.js')+'\nwindow.S=S;window.Actions=BorionDataActions6401;',sb);
  return {sb,store};
}

(async()=>{
  const {sb,store}=makeRuntime();
  const provider={
    _queueOperationId:null,_deviceId:'device-cell',queueCalls:0,forceCalls:0,
    isConnected(){return true;},
    queueSave(){this.queueCalls++;},
    async forceSyncNow(){this.forceCalls++;return true;}
  };
  sb.GoogleDriveProvider=provider;
  const p1={id:'p1',name:'Pedro'},p2={id:'p2',name:'Teste'};
  sb.S.profiles=[p1,p2];sb.setProfiles(sb.S.profiles);sb.S.currentProfile=p1;sb.S.data=sb.emptyData();
  sb.setProfileData('p1',sb.S.data);sb.setProfileData('p2',sb.emptyData());

  const result=await sb.Actions.deleteProfileAndSync('p2','test_delete');
  assert(result.deleted===true,'ação central deve excluir o perfil');
  assert(provider.queueCalls===1,'exclusão deve chamar queueSave imediatamente');
  assert(provider.forceCalls===1,'exclusão online deve tentar confirmação imediata');
  assert(!sb.S.profiles.some(p=>p.id==='p2'),'perfil deve desaparecer da lista local');
  assert(store.mc_data_p2==null,'cache local do perfil excluído deve ser removido');
  const tomb=sb.getProfileTombstones6401().p2;
  assert(tomb&&tomb.operationId,'exclusão deve registrar tombstone com operationId');
  assert(tomb.operationId===provider._queueOperationId,'tombstone e operação do Drive devem usar o mesmo operationId');

  const Core=sb.BorionSyncCore;
  const base={profiles:[{id:'p2',name:'Teste',updatedAt:'2026-07-20T10:00:00.000Z'}],dataByProfile:{p2:{transacoes:[{id:'tx',valor:10}],categorias:{receita:[],fixa:[],variavel:[]},__syncMeta:Core.emptySyncMeta()}},config:{},__syncMeta640:{profileTombstones:{}}};
  const staleEdit=clone(base);staleEdit.profiles[0].name='Teste editado no PC';staleEdit.profiles[0].updatedAt='2026-07-20T12:00:00.000Z';
  const deleted=clone(base);deleted.profiles=[];deleted.dataByProfile={};deleted.__syncMeta640.profileTombstones.p2={profileId:'p2',deletedAt:'2026-07-20T11:00:00.000Z',deviceId:'cell',operationId:'op-delete',reason:'user_delete'};
  const merged=Core.mergeAccountPayload(base,staleEdit,deleted);
  assert(!merged.profiles.some(p=>p.id==='p2'),'edição de dispositivo antigo não pode ressuscitar perfil tombstonado');
  assert(!Object.prototype.hasOwnProperty.call(merged.dataByProfile,'p2'),'dados ativos do perfil excluído não podem reaparecer');
  const conflict=(merged.__syncMeta640.accountConflicts||[]).find(c=>c.kind==='profile_edit_vs_delete'&&c.profileId==='p2');
  assert(conflict&&conflict.preservedEdit&&conflict.preservedEdit.name==='Teste editado no PC','edição concorrente deve permanecer recuperável no conflito');

  const settings=fs.readFileSync(path.join(root,'js/13-settings.js'),'utf8');
  const providerSource=fs.readFileSync(path.join(root,'js/01c-google-drive-provider.js'),'utf8');
  assert(settings.includes("deleteProfileAndSync(id,'settings_delete')"),'interface real deve usar a ação central sincronizada');
  assert(providerSource.includes('handleRemovedActiveProfile6402(applied'), 'snapshot confirmado deve retirar imediatamente a UI do perfil removido');
  assert(providerSource.includes('applySharedAccountUpdateFromLeader6402'), 'abas secundárias devem receber exclusão aplicada pela líder');

  console.log('OK: exclusão de perfil é enfileirada e confirmada imediatamente, usa operationId único, não ressuscita e fecha o perfil aberto em outras abas/dispositivos.');
})().catch(e=>{console.error(e);process.exit(1);});
