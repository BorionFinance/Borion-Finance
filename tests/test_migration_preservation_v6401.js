'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),nodeCrypto=require('crypto');
const root=path.resolve(__dirname,'..');
function source(name){return fs.readFileSync(path.join(root,'js',name),'utf8');}
function assert(cond,msg){if(!cond)throw new Error('FALHOU: '+msg);}
function clone(v){return JSON.parse(JSON.stringify(v));}
function makeRuntime(deviceId){
  const store={'borion_device_id_v640':deviceId};
  const sb={console,Object,Array,String,Number,JSON,Math,Promise,Date,Map,Set,TextEncoder,TextDecoder,crypto:nodeCrypto.webcrypto,
    window:null,navigator:{onLine:true},location:{hash:'',search:'',protocol:'https:'},
    document:{getElementById(){return null},querySelector(){return null},querySelectorAll(){return []},addEventListener(){},body:{classList:{add(){},remove(){},toggle(){}}},documentElement:{style:{setProperty(){}}}},
    localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>delete store[k]},
    indexedDB:{open(){throw new Error('IndexedDB desativado no teste');}},setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},clearInterval(){},addEventListener(){},alert(){},confirm(){return true},BackupFS:{markDirty(){}}};
  sb.window=sb;vm.createContext(sb);
  vm.runInContext(source('00-utils.js'),sb);
  vm.runInContext(source('01e-sync-core-v640.js')+'\nwindow.BorionSyncCore=BorionSyncCore;',sb);
  vm.runInContext(source('01-storage-data-state.js')+'\nwindow.__S=S;window.BorionDataActions6401=BorionDataActions6401;',sb);
  return sb;
}
function legacyProfile(label){
  return {
    categorias:{receita:['Salário',label],fixa:['Moradia'],variavel:['Mercado']},
    transacoes:[
      {tipo:'receita',nome:label+' receita repetida',valor:100,data:'2026-01-02'},
      {tipo:'receita',nome:label+' receita repetida',valor:100,data:'2026-01-02'},
      {tipo:'variavel',nome:label+' mercado',valor:25,data:'2026-01-03',banco:label+' Banco'}
    ],
    fixas:[{nome:label+' aluguel',valor:50,startMonth:'2026-01'}],
    contas:[{nome:label+' Banco',tipo:'Conta corrente',saldoInicial:500}],
    cartoes:[{nome:label+' Cartão',banco:label+' Banco',parcelas:[]}],
    transferencias:[],agenda:[{titulo:label+' compromisso',data:'2026-02-01'}],metas:[{nome:label+' meta',valorAlvo:1000}],
    investimentos:{emCaixa:[],ativos:[{nome:label+' ativo',valorAtual:200}]},
    reservas:{enabled:true,boxes:[{nome:label+' reserva',saldo:300}],moves:[],monthlyReports:[]},
    cheques:{enabled:false,items:[]},modules:{reserves:true},dashboard:{widgets:['summary']},
    uiPreferences:{customOrder:['a','b']},interconnections:{origins:{[label]:{enabled:true}}}
  };
}
function idsByCollection(Core,data){
  const out={};
  for(const path of Core.BORION_SYNCABLE_COLLECTIONS){const key=Core.pathKey(path),arr=Core.pathGet(data,path)||[];out[key]=arr.map(x=>x&&x.id);}
  return out;
}
function countsByCollection(Core,data){
  const out={};for(const path of Core.BORION_SYNCABLE_COLLECTIONS){const key=Core.pathKey(path);out[key]=(Core.pathGet(data,path)||[]).length;}return out;
}
function financialTotal(data){
  return [...(data.transacoes||[]),...(data.fixas||[])].reduce((s,x)=>s+(Number(x.valor)||0),0)
    +(data.investimentos&&data.investimentos.ativos||[]).reduce((s,x)=>s+(Number(x.valorAtual)||0),0)
    +(data.reservas&&data.reservas.boxes||[]).reduce((s,x)=>s+(Number(x.saldo)||0),0);
}
(async()=>{
  const envA=makeRuntime('device-A'),envB=makeRuntime('device-B');
  const sourceData=legacyProfile('Pedro');
  const beforeTotal=financialTotal(sourceData);
  const migratedA=envA.migrateData(clone(sourceData),{profileId:'pedro'});
  const migratedB=envB.migrateData(clone(sourceData),{profileId:'pedro'});
  const idsA=idsByCollection(envA.BorionSyncCore,migratedA),idsB=idsByCollection(envB.BorionSyncCore,migratedB);
  assert(JSON.stringify(idsA)===JSON.stringify(idsB),'dois dispositivos devem gerar exatamente os mesmos IDs para a mesma base legada');
  assert(migratedA.transacoes[0].id!==migratedA.transacoes[1].id,'registros legitimamente iguais e repetidos devem continuar distintos');
  assert(financialTotal(migratedA)===beforeTotal,'migração não pode alterar totais financeiros');
  const once=JSON.stringify(idsA);envA.migrateData(migratedA,{profileId:'pedro'});
  assert(JSON.stringify(idsByCollection(envA.BorionSyncCore,migratedA))===once,'executar migração duas vezes não pode trocar IDs');
  const merged=envA.BorionSyncCore.mergeProfileData(null,migratedA,migratedB);
  assert(merged.transacoes.length===migratedA.transacoes.length,'merge de duas migrações idênticas não pode duplicar registros');

  for(const profileCount of [2,5]){
    const profiles=Array.from({length:profileCount},(_,i)=>({id:'perfil-'+(i+1),name:'Perfil '+(i+1)}));
    const legacyAccount={profiles:clone(profiles),config:{theme:'dark',interfaceMode:'desktop',links:{preserve:true}},dataByProfile:{}};
    const before={};
    for(const p of profiles){
      const d=legacyProfile(p.name);legacyAccount.dataByProfile[p.id]=d;
      before[p.id]={counts:countsByCollection(envA.BorionSyncCore,d),total:financialTotal(d),categories:clone(d.categorias),links:clone(d.interconnections)};
    }
    const migratedAccount=clone(legacyAccount);
    for(const p of migratedAccount.profiles)migratedAccount.dataByProfile[p.id]=envA.migrateData(migratedAccount.dataByProfile[p.id],{profileId:p.id});
    assert(migratedAccount.profiles.length===profileCount,'nenhum perfil pode desaparecer em conta com '+profileCount+' perfis');
    assert(migratedAccount.profiles.map(p=>p.id).join('|')===profiles.map(p=>p.id).join('|'),'IDs dos perfis não podem mudar');
    assert(migratedAccount.config.theme==='dark'&&migratedAccount.config.links.preserve===true,'configurações da conta devem permanecer');
    for(const p of profiles){
      const after=migratedAccount.dataByProfile[p.id];
      assert(after.transacoes.every(t=>String(t.nome).startsWith(p.name)),'registro não pode migrar para outro perfil: '+p.id);
      assert(financialTotal(after)===before[p.id].total,'total financeiro do perfil deve permanecer: '+p.id);
      assert(after.categorias.receita.includes(p.name),'categorias específicas do perfil devem permanecer: '+p.id);
      assert(after.interconnections.origins[p.name].enabled===true,'vínculos específicos do perfil devem permanecer: '+p.id);
    }
    // Fechar/abrir novamente = serializar, reler e migrar de novo.
    const reopened=JSON.parse(JSON.stringify(migratedAccount));
    for(const p of reopened.profiles)reopened.dataByProfile[p.id]=envB.migrateData(reopened.dataByProfile[p.id],{profileId:p.id});
    assert(reopened.profiles.length===profileCount&&reopened.profiles.map(p=>p.id).join('|')===profiles.map(p=>p.id).join('|'),'reabertura deve preservar todos os perfis e IDs');
    for(const p of profiles)assert(JSON.stringify(idsByCollection(envA.BorionSyncCore,reopened.dataByProfile[p.id]))===JSON.stringify(idsByCollection(envA.BorionSyncCore,migratedAccount.dataByProfile[p.id])),'reabertura não pode gerar IDs novos: '+p.id);
  }

  console.log('OK: migração real é determinística entre dispositivos, idempotente, preserva duplicatas legítimas, totais, configurações, vínculos e contas com 2/5 perfis.');
})().catch(e=>{console.error(e);process.exit(1);});
