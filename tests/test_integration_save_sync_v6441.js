'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const assert=(c,m)=>{if(!c)throw new Error('FALHOU: '+m)};
const source=fs.readFileSync(path.resolve(__dirname,'../js/24-interconnections.js'),'utf8');

assert(source.includes("BorionInterop.saveMappings('${sourceAppId}')\">Salvar opções"),'Amanda deve ter botão exclusivo para salvar opções');
assert(source.includes("BorionInterop.syncSource('${sourceAppId}')")&&source.includes('>Sincronizar agora</button>'),'Amanda deve ter botão separado para sincronizar');
assert(source.includes('BorionInterop.saveMitSettings()\">Salvar opções'),'Marco deve ter botão exclusivo para salvar opções');
assert(source.includes("BorionInterop.syncSource('marco-iris')") ,'Marco deve ter botão separado para sincronizar');
assert(!source.includes("saveMappings('${sourceAppId}',{sync:true})")&&!source.includes('saveMitSettings({sync:true})'),'nenhum botão da tela pode juntar salvar e sincronizar');
assert(source.includes('continuará igual depois de sair e entrar novamente'),'confirmação deve deixar clara a persistência das opções');

(async()=>{
  let persisted=0,queued=0,rendered=0;
  const data={transacoes:[],contas:[{id:'carteira',nome:'Carteira',isCarteira:true}],reservas:{boxes:[],moves:[]},categorias:{receita:['Outro'],fixa:[],variavel:['Outro']},interconnections:{sources:{'amanda-estetica':{sourceAppId:'amanda-estetica',mappingReady:false,mappings:{},discovered:{}}},imported:{},ignored:{},pending:[],audit:[]}};
  const context={console,crypto:global.crypto,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone:global.structuredClone};
  context.window=context;context.globalThis=context;context.document={addEventListener(){},querySelectorAll(){return[]},getElementById(){return null}};context.addEventListener=()=>{};
  context.CARTEIRA_CONTA_ID='carteira';context.FORMAS_PAGAMENTO=['Pix','Dinheiro'];context.defaultCategories=()=>({receita:['Outro'],fixa:[],variavel:['Outro']});context.baseCatColor=()=> '#888';context.todayISO=()=> '2026-07-20';
  context.S={profiles:[{id:'p1',name:'Perfil'}],currentProfile:{id:'p1',name:'Perfil'},data};
  context.getProfileData=()=>data;context.setProfileData=()=>{persisted++};context.migrateData=x=>x;context.emptyData=()=>({});
  context.GoogleDriveProvider={isConnected:()=>true,queueSave:()=>{queued++}};context.BackupFS={markDirty(){}};context.renderView=()=>{rendered++};context.toast=()=>{};
  vm.createContext(context);vm.runInContext(source,context,{filename:'24-interconnections.js'});
  await context.BorionInterop.saveMappings('amanda-estetica');
  assert(data.interconnections.sources['amanda-estetica'].mappingReady===true,'salvar opções deve marcar a configuração como pronta');
  assert(persisted===1,'salvar opções deve persistir os dados do perfil');
  assert(queued===1,'salvar opções deve entrar na fila automática do Google Drive');
  assert(rendered===1,'salvar opções deve atualizar a tela sem executar importação');
  console.log('OK: Amanda e Marco têm Salvar opções e Sincronizar agora separados; salvar persiste no perfil e na fila do Drive.');
})().catch(error=>{console.error(error);process.exit(1)});
