'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js','26-help-center.js'),'utf8');
const store={};
const sandbox={
  console,Set,Array,Object,String,Number,Math,JSON,Date,Promise,
  S:{currentProfile:{id:'test-profile',name:'Teste'},helpCenter:{tab:'guides',query:'',category:'all'}},
  esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  localStorage:{getItem:key=>store[key]??null,setItem:(key,value)=>{store[key]=value;}},
  document:{
    querySelector:()=>null,
    querySelectorAll:()=>[],
    createElement:()=>({value:'',style:{},select(){},remove(){}}),
    body:{appendChild(){}}
  },
  navigator:{clipboard:{writeText:async()=>{}}},
  toast(){},renderView(){},
  setTimeout(fn){fn();return 1;},
  window:null
};
sandbox.window=sandbox;
vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:'26-help-center.js'});

if(!sandbox.BorionHelp) throw new Error('window.BorionHelp não foi exposto.');
const guides=sandbox.BorionHelp.render();
for(const text of ['CENTRAL DO BORION','Guias passo a passo','Checklist completo','Como começou','Adicionar uma receita','Importar prints de extrato com OCR local']){
  if(!guides.includes(text)) throw new Error('Conteúdo obrigatório ausente: '+text);
}

sandbox.S.helpCenter.tab='checklist';
const checklist=sandbox.BorionHelp.render();
const total=Number((checklist.match(/de (\d+) funções verificadas/)||[])[1]);
if(!Number.isFinite(total)||total<600) throw new Error('Checklist incompleto: '+total);
if(!checklist.includes('Organizar e redimensionar módulos') && !checklist.includes('Redimensionar largura dos módulos')) throw new Error('Itens de organização não encontrados.');

sandbox.S.helpCenter.tab='origin';
const origin=sandbox.BorionHelp.render();
for(const text of ['B + ÓRION','07/07/2026','Pedro Bardella','Borion System']){
  if(!origin.includes(text)) throw new Error('História incompleta: '+text);
}

console.log(`OK: Central do Borion renderiza guias, história e ${total} verificações.`);
