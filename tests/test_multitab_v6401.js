'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'js/01h-multitab-v640.js'),'utf8');
function assert(cond,msg){if(!cond)throw new Error('FALHOU: '+msg);}
const sharedStore={};
const channels=new Map();
class SharedBroadcastChannel{
  constructor(name){this.name=name;this.onmessage=null;if(!channels.has(name))channels.set(name,new Set());channels.get(name).add(this);}
  postMessage(msg){for(const peer of channels.get(this.name)||[]){if(peer!==this&&peer.onmessage)peer.onmessage({data:JSON.parse(JSON.stringify(msg))});}}
  close(){const set=channels.get(this.name);if(set)set.delete(this);}
}
let idSeq=0;
function makeTab(label,handlers,navigatorOverride={}){
  const sb={console,Object,Array,String,Number,JSON,Math,Promise,Date,Map,Set,window:null,navigator:navigatorOverride,BroadcastChannel:SharedBroadcastChannel,
    localStorage:{getItem:k=>sharedStore[k]??null,setItem:(k,v)=>{sharedStore[k]=String(v)},removeItem:k=>delete sharedStore[k]},
    setInterval(){return 1},clearInterval(){},addEventListener(){},BorionSyncCore:{uuid640:()=>label+'-'+(++idSeq)}};
  sb.window=sb;vm.createContext(sb);vm.runInContext(src+'\nwindow.Multi=BorionMultiTab640;',sb);sb.Multi.init(handlers);return sb;
}
let aLeader=0,bLeader=0,aRemote=0,bRemote=0;
const a=makeTab('A',{onBecomeLeader(){aLeader++},onPendingFromFollower(){aRemote++}});
const b=makeTab('B',{onBecomeLeader(){bLeader++},onPendingFromFollower(){bRemote++}});
assert(a.Multi.isLeader()===true&&b.Multi.isLeader()===false,'duas abas devem eleger exatamente uma líder');
assert(aLeader===1&&bLeader===0,'somente a primeira aba deve assumir a liderança inicial');
const delegated=b.Multi.requestSync({operationId:'op-1'});
assert(delegated===false,'aba secundária deve apenas delegar');
assert(aRemote===1&&bRemote===0,'somente a líder deve processar a solicitação remota da secundária');

// Heartbeat renova o lease.
const before=JSON.parse(sharedStore.borion_sync_leader_lease_v6402);
a.Multi._tickElection();
const after=JSON.parse(sharedStore.borion_sync_leader_lease_v6402);
assert(after.tabId===a.Multi.tabId&&after.expiresAt>=before.expiresAt,'heartbeat deve renovar o lease da líder');

// Simula fechamento inesperado: não chama release(), apenas deixa o lease expirar e
// remove a comunicação da aba que caiu. A secundária deve assumir na próxima eleição.
a.Multi._channel.close();a.Multi._channel=null;a.Multi.leader=false;
const stale=JSON.parse(sharedStore.borion_sync_leader_lease_v6402);stale.expiresAt=Date.now()-1;sharedStore.borion_sync_leader_lease_v6402=JSON.stringify(stale);
b.Multi._tickElection();
assert(b.Multi.isLeader()===true&&bLeader===1,'aba secundária deve assumir após expiração do heartbeat da líder que caiu');
const self=b.Multi.requestSync({operationId:'op-2'});
assert(self===true&&bRemote===1,'nova líder deve processar a fila pendente uma única vez');
assert(aRemote===1,'aba antiga não pode receber/uploadar novamente depois da transferência de liderança');

b.Multi.release();

(async()=>{
  // Quando navigator.locks existe, ele é a única autoridade; follower não tenta
  // simultaneamente conquistar o lease localStorage.
  const lockManager={holder:false,request(_name,_opts,callback){
    if(this.holder)return Promise.resolve(callback(null));
    this.holder=true;
    let result;try{result=callback({name:'borion_sync_leader_v6402'});}catch(e){this.holder=false;throw e;}
    return Promise.resolve(result).finally(()=>{this.holder=false;});
  }};
  let cLead=0,dLead=0;
  const c=makeTab('C',{onBecomeLeader(){cLead++;}},{locks:lockManager});
  const d=makeTab('D',{onBecomeLeader(){dLead++;}},{locks:lockManager});
  assert(c.Multi.isLeader()===true&&d.Multi.isLeader()===false,'navigator.locks deve permitir exatamente uma líder');
  assert(cLead===1&&dLead===0,'follower com lock indisponível não pode conquistar lease paralelo');
  c.Multi.release();
  await new Promise(resolve=>setImmediate(resolve));
  d.Multi._tickElection();
  assert(d.Multi.isLeader()===true&&dLead===1,'liberação do lock deve permitir transferência de liderança');
  d.Multi.release();
  console.log('OK: eleição mantém uma única líder, follower apenas delega, heartbeat/lock transferem liderança sem duplicar processamento.');
})().catch(e=>{console.error(e);process.exit(1);});
