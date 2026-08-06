import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function extractBalanced(source, marker) {
  const start=source.indexOf(marker);assert.notEqual(start,-1,`Trecho não encontrado: ${marker}`);
  const signatureTail=source.slice(start).match(/\)\s*\{/);assert.ok(signatureTail,`Início do corpo não encontrado: ${marker}`);
  const open=start+signatureTail.index+signatureTail[0].lastIndexOf('{');
  let depth=0,quote=null,escaped=false,lineComment=false,blockComment=false;
  for(let i=open;i<source.length;i++){
    const ch=source[i],next=source[i+1];
    if(lineComment){if(ch==='\n')lineComment=false;continue;}
    if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i++;}continue;}
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote=null;continue;}
    if(ch==='/'&&next==='/'){lineComment=true;i++;continue;}
    if(ch==='/'&&next==='*'){blockComment=true;i++;continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`Bloco sem fechamento: ${marker}`);
}

const subscriptions=read('js/19-subscriptions.js');
const context={S:{data:{assinaturas:[{id:'sub-1',apareceDespesas:true}],assinaturaCobrancas:[{id:'occ-1',assinaturaId:'sub-1',period:'2026-08',apareceDespesas:true}]}},window:{}};
vm.createContext(context);
vm.runInContext(extractBalanced(subscriptions,'function assinaturaApareceDespesasDesejado'),context);
vm.runInContext(extractBalanced(subscriptions,'function assinaturaRegistrarPreferenciaDespesas'),context);
const purchase={viaAssinaturaId:'sub-1',assinaturaCobrancaId:'occ-1',dataCompra:'2026-08'};
assert.equal(context.assinaturaRegistrarPreferenciaDespesas(purchase,false),true);
assert.equal(context.S.data.assinaturas[0].apareceDespesas,false);
assert.equal(context.S.data.assinaturaCobrancas[0].apareceDespesas,false);
assert.equal(context.assinaturaApareceDespesasDesejado(context.S.data.assinaturaCobrancas[0]),false);
context.assinaturaRegistrarPreferenciaDespesas(purchase,true);
assert.equal(context.S.data.assinaturas[0].apareceDespesas,true);
assert.equal(context.S.data.assinaturaCobrancas[0].apareceDespesas,true);

const settings=read('js/13-settings.js');
const live=settings.indexOf('S.profiles=ordered'),persisted=settings.indexOf('setProfiles(S.profiles)',live),queued=settings.indexOf("saveCurrentData({source:'financial_profiles_reorder'})",persisted);
assert.ok(live>=0&&persisted>live&&queued>persisted,'A ordem deve atualizar memória, armazenamento e fila do Drive.');
assert.ok(!/profile-order-(?:up|down)|profilesMove(?:Up|Down)/.test(settings),'As setas de perfis não podem voltar.');

const cards=read('js/10-cards-accounts.js');
assert.match(cards,/instantExpenseVisibility[\s\S]*assinaturaRegistrarPreferenciaDespesas[\s\S]*saveCurrentData/);
const budget=read('js/07-budget.js');
assert.match(budget,/instantLinkedVisibility[\s\S]*syncLinkedCardPurchaseFromExpense\(existing,\{\},false\)[\s\S]*saveCurrentData/);
assert.match(budget,/instantFixedLinkedVisibility[\s\S]*syncLinkedCardPurchaseFromExpense\(existing,\{\},false\)[\s\S]*saveCurrentData/);

const drive=read('js/01c-google-drive-provider.js');
const downloadMethod=extractBalanced(drive,'async downloadText(fileId,options={})');
const downloadText=vm.runInNewContext(`({${downloadMethod}}).downloadText`,{TextDecoder,Uint8Array});
const ranges=[],total=3*1024*1024+17;
const fake={_downloadTimeoutForBytes:()=>90000,async _downloadPart(_url,options){ranges.push(options.headers?.Range||'full');const range=options.headers?.Range;if(!range)return{ok:true,status:200,buffer:new Uint8Array(total).fill(97).buffer};const[,from,to]=/bytes=(\d+)-(\d+)/.exec(range);return{ok:true,status:206,buffer:new Uint8Array(Number(to)-Number(from)+1).fill(97).buffer};}};
const downloaded=await downloadText.call(fake,'current',{size:total});
assert.equal(downloaded.length,total);assert.ok(ranges.length>=5);assert.equal(ranges[0],'bytes=0-786431');
assert.match(extractBalanced(drive,'async _downloadPart(url,options={})'),/arrayBuffer\(\)[\s\S]*finally\{if\(timer\)clearTimeout\(timer\);\}/);
assert.match(read('js/01i-boot-progress-v642.js'),/async retry\(\)\{location\.reload\(\);\}/);
const wal=read('js/29-fast-wal-v700-64665.js');
assert.match(wal,/AES-GCM/,'A recuperacao temporaria deve permanecer criptografada.');
assert.match(wal,/generateKey\(\{name:'AES-GCM',length:256\},false/,'A chave local deve ser nao exportavel.');
assert.match(wal,/async function recover\(folderId,remoteSnapshot\)/,'A pendencia deve ser recuperavel no proximo boot.');
assert.match(wal,/async function confirm\(folderId,operationId,confirmedSequence\)[\s\S]*dbDelete/,'A copia temporaria so deve ser removida apos confirmacao.');
assert.doesNotMatch(wal,/cloud_only_no_local_business_data/,'O WAL nao pode continuar desativado no modo Drive.');
assert.match(read('js/14-events-boot-pwa.js'),/beforeunload[\s\S]*hasAnyPendingExitWork[\s\S]*returnValue/,'O fechamento com gravacao pendente deve continuar protegido.');
console.log('REGRESSION_OK: 18 verificações concluídas.');
