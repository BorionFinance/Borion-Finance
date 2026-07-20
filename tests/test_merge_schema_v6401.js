'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),nodeCrypto=require('crypto');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'js/01e-sync-core-v640.js'),'utf8');
function assert(cond,msg){if(!cond)throw new Error('FALHOU: '+msg);}
function clone(v){return JSON.parse(JSON.stringify(v));}
const sb={console,Object,Array,String,Number,JSON,Math,Promise,Date,Map,Set,TextEncoder,crypto:nodeCrypto.webcrypto,window:null};sb.window=sb;vm.createContext(sb);vm.runInContext(src+'\nwindow.Core=BorionSyncCore;',sb);const Core=sb.Core;
const base={
  categorias:{receita:['Base'],fixa:['Base'],variavel:['Base']},
  modules:{agenda:true,reserves:true,investments:true},
  dashboard:{widgets:['summary','cashflow'],visibility:{summary:true,cashflow:true}},
  uiPreferences:{theme:'dark',customOrder:['a','b'],cards:{patrimonio:true}},
  interconnections:{origins:{base:{enabled:true}},mappings:{}},
  configByProfile:{fontSize:14,compact:false},
  transacoes:[],__syncMeta:Core.emptySyncMeta()
};
const local=clone(base),remote=clone(base);
local.categorias.receita.push('Local');remote.categorias.receita.push('Remoto');
local.modules.agenda=false;remote.modules.investments=false;
local.dashboard.visibility.summary=false;remote.dashboard.visibility.cashflow=false;
local.uiPreferences.theme='nebula';remote.uiPreferences.theme='light';
local.uiPreferences.customOrder=['b','a','local'];remote.uiPreferences.customOrder=['a','b','remoto'];
local.interconnections.origins.local={enabled:true};remote.interconnections.origins.remoto={enabled:true};
local.configByProfile.fontSize=16;remote.configByProfile.compact=true;
const merged=Core.mergeProfileData(base,local,remote);
assert(merged.categorias.receita.includes('Local')&&merged.categorias.receita.includes('Remoto'),'categorias adicionadas nos dois dispositivos devem sobreviver');
assert(merged.modules.agenda===false&&merged.modules.investments===false,'mudanças em módulos diferentes devem ser combinadas');
assert(merged.dashboard.visibility.summary===false&&merged.dashboard.visibility.cashflow===false,'visibilidade de cards alterada em campos distintos deve ser preservada');
assert(merged.interconnections.origins.local.enabled&&merged.interconnections.origins.remoto.enabled,'vínculos simultâneos devem ser combinados');
assert(merged.configByProfile.fontSize===16&&merged.configByProfile.compact===true,'configurações em propriedades diferentes devem ser mescladas em três vias');
assert(merged.uiPreferences.customOrder.join(',')==='b,a,local,remoto','ordem personalizada deve preservar IDs conhecidos e combinar novos de forma estável');
assert(merged.uiPreferences.theme==='nebula','conflito no mesmo campo deve preservar uma versão sem descarte silencioso');
assert(merged.__syncMeta.conflicts.some(c=>c.path==='uiPreferences.theme'&&c.base==='dark'&&c.local==='nebula'&&c.remote==='light'),'mesmo campo alterado nos dois lados deve gerar conflito com base/local/remoto');
assert(merged.__syncMeta.conflicts.some(c=>c.path==='uiPreferences.customOrder'&&c.kind==='array_conflict'),'ordem concorrente deve ficar registrada para revisão');
console.log('OK: merge explícito preserva categorias, módulos, cards, configurações, ordens e vínculos; conflitos no mesmo campo ficam registrados.');
