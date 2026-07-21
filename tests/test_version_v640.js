'use strict';
/* Item 31 do pedido: versionamento consistente em todos os lugares relevantes,
   e nenhuma referência funcional apontando ainda para a versão anterior. */
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
function read(p){ return fs.readFileSync(path.join(root,p),'utf8'); }
function assert(cond,msg){ if(!cond) throw new Error('FALHOU: '+msg); }

const NEW_VERSION='6.45.2';
const OLD_VERSION='6.45.1';

(function noStaleVersionReferences(){
  const filesToCheck=['index.html','sw.js','manifest.json','js/02-backup-local.js','js/13-settings.js','js/14-events-boot-pwa.js'];
  filesToCheck.forEach(f=>{
    const content=read(f);
    assert(!content.includes(OLD_VERSION), f+' não pode conter mais referências funcionais à versão anterior ('+OLD_VERSION+')');
  });
  console.log('OK: nenhuma referência a '+OLD_VERSION+' sobrou nos arquivos funcionais.');
})();

(function versionAppearsEverywhereExpected(){
  const indexHtml=read('index.html');
  const swJs=read('sw.js');
  const manifestJson=JSON.parse(read('manifest.json'));
  const backupLocal=read('js/02-backup-local.js');
  const settings=read('js/13-settings.js');

  assert(indexHtml.includes('?v='+NEW_VERSION), 'index.html deve referenciar a nova versão nos scripts/estilos');
  assert(swJs.includes('?v='+NEW_VERSION), 'sw.js deve referenciar a nova versão nos assets');
  assert(swJs.includes('6-45-2'), 'sw.js deve ter um CACHE_NAME novo (nome de cache muda a cada versão — item 26)');
  assert(manifestJson.version===NEW_VERSION, 'manifest.json "version" deve ser '+NEW_VERSION);
  assert(backupLocal.includes("BORION_APP_VERSION = '"+NEW_VERSION+"'"), 'BORION_APP_VERSION deve ser '+NEW_VERSION);
  assert(settings.includes('6.45.2'), 'tela de Configurações deve exibir a versão 6.45.2 visível ao usuário');
  console.log('OK: versão '+NEW_VERSION+' ("6.45.2 — Aprovação de Importação MIT") está presente em todos os locais esperados.');
})();

(function newModulesAreRegisteredEverywhere(){
  const newFiles=['01e-sync-core-v640.js','01f-sync-queue-v640.js','01g-drive-journal-v640.js','01h-multitab-v640.js'];
  const indexHtml=read('index.html');
  const swJs=read('sw.js');
  newFiles.forEach(f=>{
    assert(fs.existsSync(path.join(root,'js',f)), 'arquivo novo '+f+' deve existir em js/');
    assert(indexHtml.includes(f), 'arquivo novo '+f+' deve estar incluído no index.html');
    assert(swJs.includes(f), 'arquivo novo '+f+' deve estar no cache do service worker (senão fica preso na versão antiga offline)');
  });
  console.log('OK: os 4 módulos novos do motor de sincronização estão registrados no index.html e no cache do service worker.');
})();

(function noPermanentDriveDeletion(){
  const provider=read('js/01c-google-drive-provider.js');
  const journal=read('js/01g-drive-journal-v640.js');
  assert(!/method\s*:\s*['"]DELETE['"]/.test(provider+journal),'limpeza do Drive deve usar lixeira, nunca DELETE definitivo');
  console.log('OK: nenhuma limpeza do Drive usa exclusão definitiva.');
})();

console.log('OK: versionamento consistente (item 31), cache novo e limpeza recuperável.');
