'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),nodeCrypto=require('crypto');
const root=path.resolve(__dirname,'..');
function source(name){return fs.readFileSync(path.join(root,'js',name),'utf8');}
function assert(cond,msg){if(!cond)throw new Error('FALHOU: '+msg);}
function makeRuntime(){
  const store={};
  const sb={console,Object,Array,String,Number,JSON,Math,Promise,Date,Map,Set,TextEncoder,TextDecoder,crypto:nodeCrypto.webcrypto,
    window:null,navigator:{onLine:true},location:{hash:'',search:'',protocol:'https:'},
    document:{hidden:false,visibilityState:'visible',getElementById(){return null},querySelector(){return null},querySelectorAll(){return []},addEventListener(){},body:{classList:{add(){},remove(){},toggle(){}}},documentElement:{style:{setProperty(){}}}},
    localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>delete store[k]},
    indexedDB:{open(){throw new Error('idb off')}},setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},clearInterval(){},addEventListener(){},alert(){},confirm(){return true},fetch:async()=>{throw new Error('fetch não esperado')}};
  sb.window=sb;vm.createContext(sb);
  vm.runInContext(source('00-utils.js'),sb);
  vm.runInContext(source('01e-sync-core-v640.js')+'\nwindow.BorionSyncCore=BorionSyncCore;',sb);
  vm.runInContext(source('01-storage-data-state.js')+'\nwindow.__S=S;',sb);
  vm.runInContext(source('02-backup-local.js')+'\nwindow.BackupFS=BackupFS;',sb);
  return {sb,store};
}
(async()=>{
  // Fontes malformadas ou truncadas são recusadas antes de qualquer criação.
  {
    const {sb}=makeRuntime();let creates=0;
    sb.GoogleDriveProvider={folderId:'malformed',isConnected:()=>true,ensureBackupsFolder:async()=> 'backups'};
    sb.GoogleDriveFS={createTextFile:async()=>{creates++;return {id:'x'}},readFileText:async()=>''};
    let malformed=null;try{await sb.BackupFS.ensureRawSchemaMigrationBackup({rawText:'{\"type\":',sourceFileId:'current'});}catch(e){malformed=e;}
    assert(malformed&&malformed.code==='MIGRATION_SOURCE_INVALID'&&creates===0,'JSON malformado deve bloquear antes de criar backup/migrar');
    const truncated=JSON.stringify({type:'borion-account-backup',profiles:[],dataByProfile:{}});
    let truncError=null;try{await sb.BackupFS.ensureRawSchemaMigrationBackup({rawText:truncated,sourceFileId:'current'});}catch(e){truncError=e;}
    assert(truncError&&truncError.code==='MIGRATION_SOURCE_INVALID'&&creates===0,'snapshot truncado/sem perfis deve ser recusado');
  }

  const {sb,store}=makeRuntime();
  const raw=JSON.stringify({type:'borion-account-backup',profiles:[{id:'p1',name:'Pedro'}],dataByProfile:{p1:{transacoes:[{nome:'legado',valor:10}]}},config:{theme:'dark'}});
  sb.GoogleDriveProvider={folderId:'folder-a',isConnected:()=>true,ensureBackupsFolder:async()=> 'backups'};
  sb.GoogleDriveFS={createTextFile:async()=>{throw new Error('falha simulada ao criar backup')},readFileText:async()=>raw};
  let failed=null;try{await sb.BackupFS.ensureRawSchemaMigrationBackup({rawText:raw,sourceFileId:'current'});}catch(e){failed=e;}
  assert(failed,'falha na criação do backup deve bloquear o fluxo');
  assert(!Object.keys(store).some(k=>k.includes('schema6401_raw_backup_done')),'falha não pode gravar marcador falso de backup concluído');

  sb.GoogleDriveFS.createTextFile=async()=>({id:'bad-checksum',name:'bad.json'});
  sb.GoogleDriveFS.readFileText=async()=>raw.replace('10','11');
  let checksumError=null;try{await sb.BackupFS.ensureRawSchemaMigrationBackup({rawText:raw,sourceFileId:'current'});}catch(e){checksumError=e;}
  assert(checksumError&&checksumError.code==='MIGRATION_BACKUP_VERIFY_FAILED','backup relido com bytes diferentes deve bloquear a migração');

  let creates=0;
  sb.GoogleDriveFS.createTextFile=async(parent,name,text)=>{creates++;assert(text===raw,'backup deve preservar exatamente os bytes originais');return {id:'raw-backup',name};};
  sb.GoogleDriveFS.readFileText=async()=>raw;
  const ok=await sb.BackupFS.ensureRawSchemaMigrationBackup({rawText:raw,sourceFileId:'current'});
  assert(ok.exactBytes===true&&ok.backup.id==='raw-backup','backup exato deve ser criado, relido e validado');
  const again=await sb.BackupFS.ensureRawSchemaMigrationBackup({rawText:raw,sourceFileId:'current'});
  assert(again.alreadyDone===true&&creates===1,'backup pré-migração confirmado deve ser idempotente');

  // Integração de boot: se o backup obrigatório falhar, loadFromDrive encerra
  // antes de qualquer migrateData/aplicação no estado local.
  vm.runInContext(source('01c-google-drive-provider.js')+'\nwindow.GoogleDriveProvider=GoogleDriveProvider;window.GoogleDriveFSProvider=GoogleDriveFS;',sb);
  const Provider=sb.GoogleDriveProvider;
  Provider.folderId='folder-b';
  let migrateCalls=0;const originalMigrate=sb.migrateData;sb.migrateData=(...args)=>{migrateCalls++;return originalMigrate(...args);};
  sb.GoogleDriveFSProvider.findChild=async()=>({id:'current-b',name:'current.json'});
  sb.GoogleDriveFSProvider.readFileText=async()=>raw;
  sb.BackupFS.ensureRawSchemaMigrationBackup=async()=>{throw Object.assign(new Error('backup indisponível'),{code:'MIGRATION_BACKUP_REQUIRED'});};
  let bootError=null;try{await Provider.loadFromDrive();}catch(e){bootError=e;}
  assert(bootError&&bootError.code==='MIGRATION_BACKUP_REQUIRED','boot deve propagar bloqueio de backup');
  assert(migrateCalls===0,'nenhuma migração deve acontecer quando o backup pré-migração falha');
  assert(sb.BorionSyncState?sb.BorionSyncState.current==='RECOVERY':Provider.lastSyncError.includes('Migração bloqueada'),'aplicativo deve entrar em recuperação/leitura segura');

  console.log('OK: backup pré-migração preserva bytes exatos, valida checksum/restauração, é idempotente e bloqueia o boot antes de qualquer migração quando falha.');
})().catch(e=>{console.error(e);process.exit(1);});
