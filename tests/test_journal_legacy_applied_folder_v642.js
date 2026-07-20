'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),code=fs.readFileSync(path.join(root,'js/01g-drive-journal-v640.js'),'utf8');
const assert=(c,m)=>{if(!c)throw new Error('FALHOU: '+m)};const store={};
const sb={console,Object,Array,String,Number,JSON,Math,Promise,Date,Map,Set,window:null,localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]}};sb.window=sb;vm.createContext(sb);vm.runInContext(code+'\nwindow.Journal=BorionDriveJournal640;',sb);
store['borion_journal_topology_v642_main']=JSON.stringify({sync:'sync',operations:'ops',snapshots:'snap',conflicts:'conf',duplicates:{sync:[],operations:[],snapshots:[],conflicts:[]}});
let created=0,available=false;
sb.GoogleDriveFS={async findChildren(parent,name,mime){assert(parent==='ops'&&name==='applied','somente a subpasta aplicada deve ser consultada');return available?[{id:'applied-new',name:'applied',parents:['ops'],mimeType:mime,createdTime:'1'}]:[];},async createFolder(parent,name){created++;available=true;return{id:'applied-new',name,parents:[parent],createdTime:'1'}}};
(async()=>{const folder=await sb.Journal.ensureAppliedFolder('main');assert(folder.id==='applied-new'&&created===1,'estrutura antiga deve receber applied uma única vez');const saved=JSON.parse(store['borion_journal_topology_v642_main']);assert(saved.applied==='applied-new','ID da pasta applied deve ser persistido');const again=await sb.Journal.ensureAppliedFolder('main');assert(again.id==='applied-new'&&created===1,'segunda abertura deve usar cache, sem recriar');console.log('OK: estrutura 6.40/6.41 ganha pasta applied gradualmente e depois reutiliza o ID persistido.');})().catch(e=>{console.error(e);process.exit(1)});
