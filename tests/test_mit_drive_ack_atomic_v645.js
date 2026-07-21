'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const assert=(condition,message)=>{if(!condition)throw new Error('FALHOU: '+message)};

(async()=>{
  const source=fs.readFileSync(path.resolve(__dirname,'../js/24-interconnections.js'),'utf8');
  const methods=['pix','money','debit',...Array.from({length:12},(_,index)=>'credit'+(index+1))];
  const rules=Object.fromEntries(methods.map(key=>[key,{
    category:'Serviços MIT',destinationKind:key==='money'?'wallet':'account',
    accountId:key==='money'?'wallet':'bank1',reserveId:null,
    target:key==='money'?'wallet':'account:bank1'
  }]));
  const config={sourceAppId:'marco-iris',enabled:true,mappingReady:true,transport:'drive',folderId:'folder-mit',accountId:'bank1',mitRevenueRules:rules};
  const data={
    transacoes:[],contas:[{id:'wallet',nome:'Carteira',isCarteira:true},{id:'bank1',nome:'Nubank'}],liquidez:[],
    categorias:{receita:['Serviços MIT'],fixa:[],variavel:['Outro']},categoryColors:{receita:{},fixa:{},variavel:{}},
    modules:{reserves:true},reservas:{enabled:true,boxes:[],moves:[]},
    interconnections:{sources:{'marco-iris':config},imported:{},ignored:{},pending:[],audit:[]}
  };
  const record={aggregateId:'marco-iris:ack-test:receipt:ACK-001',entityId:'ACK-001',receiptId:'ACK-001',direction:'income',amount:125.5,date:'2026-07-20',paymentDate:'2026-07-20',status:'paid',settled:true,active:true,description:'OSV-ACK • Cliente',orderNumber:'OSV-ACK',clientName:'Cliente',paymentMethod:'Pix',externalReference:'OSV-ACK:ACK-001',sourceUpdatedAt:'2026-07-20T12:00:00Z'};
  const snapshot={schema:'borion.interop.snapshot',schemaVersion:1,sourceAppId:'marco-iris',instanceId:'ack-test',revision:1,generatedAt:'2026-07-20T12:00:00Z',records:[record],tombstones:[]};

  let ackExists=false,failAck=true,ackWrites=0,persisted=0,queued=0,concurrentEditInjected=false;
  const context={console,crypto:global.crypto,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone:global.structuredClone};
  context.window=context;context.globalThis=context;context.addEventListener=()=>{};
  context.document={addEventListener(){},querySelectorAll(){return[]},querySelector(){return null},getElementById(){return null},hidden:false};
  context.CARTEIRA_CONTA_ID='wallet';context.FORMAS_PAGAMENTO=['Dinheiro','Pix','Débito','Crédito'];
  context.defaultCategories=()=>({receita:[],fixa:[],variavel:[]});context.baseCatColor=()=> '#888';context.todayISO=()=> '2026-07-20';
  context.S={profiles:[{id:'p1',name:'Perfil ACK'}],currentProfile:null,data:null,view:'home',settingsTab:''};
  context.getProfileData=()=>data;context.setProfileData=()=>{persisted++};
  context.migrateData=value=>value;context.emptyData=()=>({});context.BackupFS={markDirty(){}};
  context.GoogleDriveProvider={isConnected:()=>true,queueSave:()=>{queued++}};
  context.GoogleDriveAuth={ensureFreshToken:async()=>true};
  context.GoogleDriveFS={
    async findChild(_folderId,name){
      if(name==='marco-iris.bridge.json')return{id:'snapshot-file'};
      if(name==='marco-iris.ack.json')return ackExists?{id:'ack-file'}:null;
      return null;
    },
    async readFile(id){assert(id==='snapshot-file','deve ler o snapshot correto');return structuredClone(snapshot)},
    async createFile(_folderId,name,ack){
      assert(name==='marco-iris.ack.json','deve escrever o ACK correto');ackWrites++;
      if(failAck)throw new Error('Falha simulada ao gravar ACK');
      assert(ack.summary.created===1,'ACK deve descrever a receita preparada');if(!concurrentEditInjected){concurrentEditInjected=true;data.transacoes.push({id:'direct-borion',tipo:'receita',nome:'Receita direta durante ACK',valor:33,data:'2026-07-20'});data.interconnections.sources['marco-iris'].importCutoffAt='2026-07-01T00:00:00.000Z';}ackExists=true;return{id:'ack-file'};
    },
    async updateFile(_id,ack){ackWrites++;assert(ack.summary.created===0,'segunda confirmação não pode recriar receita')}
  };
  context.toast=()=>{};context.alert=()=>{};
  vm.createContext(context);vm.runInContext(source,context,{filename:'24-interconnections.js'});

  let failed=false;
  try{await context.BorionInterop.syncSource('marco-iris',{silent:true})}catch(error){failed=/Falha simulada/.test(error.message)}
  assert(failed,'falha do ACK deve ser propagada');
  assert(data.transacoes.length===0,'falha do ACK não pode confirmar lançamento local parcial');
  assert(!data.interconnections.mitImported||Object.keys(data.interconnections.mitImported.receipts||{}).length===0,'falha do ACK não pode confirmar índice de recebimentos');
  assert(data.interconnections.sources['marco-iris'].lastError==='Falha simulada ao gravar ACK','falha deve ficar registrada para nova tentativa');

  failAck=false;
  const firstSuccess=await context.BorionInterop.syncSource('marco-iris',{silent:true});
  assert(firstSuccess.summary.created===1&&data.transacoes.length===2,'nova tentativa deve aplicar a receita uma vez sem apagar lançamento direto criado durante o ACK');
  assert(data.transacoes.some(tx=>tx.integrationReceiptId==='ACK-001'),'lançamento deve preservar o identificador permanente');
  assert(data.transacoes.some(tx=>tx.id==='direct-borion'),'sincronização não pode substituir o perfil por um clone anterior ao ACK');
  assert(data.interconnections.sources['marco-iris'].importCutoffAt==='2026-07-01T00:00:00.000Z','data de corte salva durante a sincronização não pode voltar ao valor anterior');
  const secondSuccess=await context.BorionInterop.syncSource('marco-iris',{silent:true});
  assert(secondSuccess.summary.created===0&&data.transacoes.length===2,'sincronização posterior deve ser idempotente e preservar receita direta');
  assert(ackWrites===3&&persisted>=2&&queued>=2,'ACK deve ocorrer em todas as tentativas, mas snapshot idêntico não pode enfileirar nova gravação no Drive');
  console.log('OK: ACK é atômico; edição direta e data de corte feitas durante a espera são preservadas, sem duplicidade.');
})().catch(error=>{console.error(error);process.exit(1)});
