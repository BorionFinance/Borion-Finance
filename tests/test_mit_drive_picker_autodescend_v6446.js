'use strict';
/* V6.45.0 — A conexão por Google Drive não descia sozinha até a subpasta
   Borion_Integracoes quando a pessoa escolhia a pasta principal do app de
   origem (a conexão por pasta local já fazia isso desde a 6.44.5). Este
   teste cobre os três cenários: pasta certa direto, pasta principal (desce
   um nível) e pasta sem o arquivo em lugar nenhum (erro claro). */
const fs=require('fs'),vm=require('vm'),path=require('path');
function assert(c,m){if(!c)throw new Error('FALHOU: '+m)}
const SRC=fs.readFileSync(path.join(__dirname,'../js/24-interconnections.js'),'utf8');


function emptySnapshot(){
  return {schema:'borion.interop.snapshot',schemaVersion:1,sourceAppId:'marco-iris',instanceId:'i1',revision:0,records:[],tombstones:[],contentHash:''};
}

function buildContext(){
  const context={console,crypto:global.crypto,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone:global.structuredClone};
  context.window=context;context.globalThis=context;context.addEventListener=()=>{};
  context.document={addEventListener(){},querySelectorAll(){return[]},querySelector(){return null},getElementById(){return null},createElement(){return{}}};
  context.CARTEIRA_CONTA_ID='wallet';context.FORMAS_PAGAMENTO=['Dinheiro','Pix','Débito','Crédito'];
  context.defaultCategories=()=>({receita:[],fixa:[],variavel:[]});context.baseCatColor=()=>'#888';context.todayISO=()=>'2026-07-20';
  context.uid=()=>'uid-'+Math.random();
  const profileStore={};
  context.S={profiles:[{id:'p1',name:'Perfil 1'}],currentProfile:{id:'p1',name:'Perfil 1'},data:null};
  context.getProfileData=id=>profileStore[id]||null;
  context.setProfileData=(id,data)=>{profileStore[id]=data;};
  context.migrateData=x=>x;context.emptyData=()=>({transacoes:[],contas:[{id:'wallet',nome:'Carteira',isCarteira:true}],interconnections:{sources:{},imported:{},ignored:{},pending:[],audit:[]}});
  context.BackupFS={markDirty(){}};
  context.GoogleDriveProvider={isConnected:()=>true,queueSave(){}};
  context.GoogleDriveAuth={ensureFreshToken:async()=>true};
  vm.createContext(context);
  vm.runInContext(SRC,context,{filename:'24-interconnections.js'});
  const seedData=context.emptyData();
  context.S.data=seedData;
  context.getProfileData=id=>id==='p1'?seedData:null;
  return context;
}

// Cenário 1: a pessoa escolhe direto a pasta Borion_Integracoes — comportamento de sempre.
(function pickedFolderHasFileDirectly(){
  const context=buildContext();
  context.openDriveFolderPicker=async()=>({id:'folder-integracoes'});
  context.GoogleDriveFS={
    async findChild(folderId,name,mimeType){
      if(folderId==='folder-integracoes'&&name==='marco-iris.bridge.json') return {id:'file-1'};
      return null;
    },
    async readFile(){return emptySnapshot();}
  };
  return context.BorionInterop.configure('marco-iris','drive','p1','wallet').then(()=>{
    console.log('OK: escolher direto a pasta Borion_Integracoes continua funcionando.');
  });
})()

// Cenário 2: a pessoa escolhe a pasta principal do Marco Iris (contém a subpasta) — deve descer sozinho.
.then(()=>{
  const context=buildContext();
  context.openDriveFolderPicker=async()=>({id:'folder-raiz-marco'});
  context.GoogleDriveFS={
    async findChild(folderId,name,mimeType){
      if(folderId==='folder-raiz-marco'&&name==='marco-iris.bridge.json') return null; // não está direto na raiz
      if(folderId==='folder-raiz-marco'&&name==='Borion_Integracoes'&&mimeType==='application/vnd.google-apps.folder') return {id:'subpasta-integracoes'};
      if(folderId==='subpasta-integracoes'&&name==='marco-iris.bridge.json') return {id:'file-2'};
      return null;
    },
    async readFile(){return emptySnapshot();}
  };
  return context.BorionInterop.configure('marco-iris','drive','p1','wallet').then(()=>{
    console.log('OK: escolher a pasta principal do Marco Iris agora desce sozinho até Borion_Integracoes.');
  });
})

// Cenário 3: o arquivo não existe em lugar nenhum — erro continua claro, sem falso-positivo.
.then(()=>{
  const context=buildContext();
  context.openDriveFolderPicker=async()=>({id:'folder-errada'});
  context.GoogleDriveFS={async findChild(){return null;}};
  return context.BorionInterop.configure('marco-iris','drive','p1','wallet').then(
    ()=>{throw new Error('FALHOU: deveria ter rejeitado uma pasta sem o arquivo em lugar nenhum');},
    err=>{
      assert(/Borion_Integracoes/.test(err.message)&&/marco-iris\.bridge\.json/.test(err.message),'mensagem de erro deve continuar orientando qual pasta escolher');
      console.log('OK: pasta sem o arquivo em nenhum nível continua dando erro claro, sem falso-positivo.');
    }
  );
})
.then(()=>{
  console.log('OK: conexão por Google Drive desce sozinha até Borion_Integracoes, igual à pasta local.');
})
.catch(err=>{
  console.error(err);
  process.exit(1);
});
