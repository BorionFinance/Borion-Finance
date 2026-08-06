/* Borion Finance v7.0 — invariantes da conta, gerações locais confirmadas e metadados de perfil. */
(function(global){
'use strict';
const RELEASE=global.BORION_RELEASE||{label:'7.1.2',releaseId:'borion-7.1.2',schemaVersion:6401};
const DB_NAME='borion_account_generations_v700';
const DB_VERSION=1;
const STORE='records';
const MAX_GENERATIONS=5;
const PROFILE_FIELDS=['name','email','avatarColor','avatarImage','passwordHash','salt'];
const DANGEROUS=new Set(['__proto__','constructor','prototype']);

function clone(v){if(v==null)return v;try{return structuredClone(v);}catch(_){return JSON.parse(JSON.stringify(v));}}
function own(obj,key){return Object.prototype.hasOwnProperty.call(obj||{},key);}
function syncCore(){return global.BorionSyncCore||null;}
function canonical(value){const core=syncCore();return core&&core.canonicalStringify?core.canonicalStringify(value):JSON.stringify(value);}
async function checksum(value){const core=syncCore();if(core&&core.checksumOf)return core.checksumOf(value);if(global.crypto&&crypto.subtle){const bytes=new TextEncoder().encode(canonical(value)),buf=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');}return '';}
function error(code,message,path='',details={}){return {code,message,path,details};}
function profileMap(list){return new Map((Array.isArray(list)?list:[]).filter(p=>p&&p.id!=null).map(p=>[String(p.id),p]));}
function collectionEntries(data){
  const core=syncCore(),paths=core&&Array.isArray(core.BORION_SYNCABLE_COLLECTIONS)?core.BORION_SYNCABLE_COLLECTIONS:[];
  const out=[];
  for(const path of paths){
    const parts=Array.isArray(path)?path:[path];let cur=data;
    for(const key of parts)cur=cur&&cur[key];
    if(Array.isArray(cur))out.push([parts.join('.'),cur]);
  }
  return out;
}
function recordCount(payload){
  let total=0;for(const data of Object.values(payload&&payload.dataByProfile||{}))for(const [,rows] of collectionEntries(data))total+=rows.length;return total;
}
function validateAccount(payload,options={}){
  const errors=[],warnings=[];
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return {valid:false,errors:[error('ACCOUNT_PAYLOAD_INVALID','Payload de conta inválido.')],warnings,profileCount:0,recordCount:0};
  const profiles=payload.profiles,dataByProfile=payload.dataByProfile;
  if(!Array.isArray(profiles))errors.push(error('ACCOUNT_PROFILES_INVALID','A lista de perfis não é um array.','profiles'));
  if(!dataByProfile||typeof dataByProfile!=='object'||Array.isArray(dataByProfile))errors.push(error('ACCOUNT_DATA_INDEX_INVALID','dataByProfile ausente ou inválido.','dataByProfile'));
  if(errors.length)return {valid:false,errors,warnings,profileCount:0,recordCount:0};
  const profileIds=new Set(),dataIds=new Set(Object.keys(dataByProfile));
  const accountMeta=payload.__syncMeta640&&typeof payload.__syncMeta640==='object'?payload.__syncMeta640:{};
  if(profiles.length===0&&(!options.allowEmptyAccount||accountMeta.accountEverHadProfiles))errors.push(error('CURRENT_JSON_PARTIAL','Conta sem perfis não pode ser tratada como snapshot autoritativo.','profiles'));
  for(let i=0;i<profiles.length;i++){
    const p=profiles[i],path='profiles['+i+']';
    if(!p||typeof p!=='object'||Array.isArray(p)){errors.push(error('PROFILE_INVALID','Perfil inválido.',path));continue;}
    const id=p.id==null?'':String(p.id).trim();
    if(!id||DANGEROUS.has(id)){errors.push(error('PROFILE_ID_MISSING','Perfil sem ID estável.',path+'.id'));continue;}
    if(profileIds.has(id))errors.push(error('PROFILE_ID_DUPLICATE','ID de perfil duplicado: '+id+'.',path+'.id',{profileId:id}));
    profileIds.add(id);
    if(!dataIds.has(id))errors.push(error('PROFILE_DATA_MISSING','Perfil '+id+' sem dados correspondentes.','dataByProfile.'+id,{profileId:id}));
    const name=typeof p.name==='string'?p.name.trim():'';
    if(!name)errors.push(error('PROFILE_METADATA_INCOMPLETE','Perfil '+id+' sem nome válido.',path+'.name',{profileId:id}));
    if(own(p,'avatarImage')&&p.avatarImage!=null&&typeof p.avatarImage!=='string')errors.push(error('PROFILE_AVATAR_INVALID','Foto do perfil possui tipo inválido.',path+'.avatarImage',{profileId:id}));
    if(own(p,'passwordHash')&&p.passwordHash!=null&&typeof p.passwordHash!=='string')errors.push(error('PROFILE_PASSWORD_INVALID','Hash de senha possui tipo inválido.',path+'.passwordHash',{profileId:id}));
    const data=dataByProfile[id];
    if(!data||typeof data!=='object'||Array.isArray(data)){errors.push(error('PROFILE_DATA_INVALID','Dados do perfil '+id+' inválidos.','dataByProfile.'+id,{profileId:id}));continue;}
    if(!options.skipEntityValidation){
      for(const [collection,rows] of collectionEntries(data)){
        const ids=new Set();
        for(let r=0;r<rows.length;r++){
          const item=rows[r];if(!item||typeof item!=='object'||Array.isArray(item)){errors.push(error('ENTITY_INVALID','Registro inválido.','dataByProfile.'+id+'.'+collection+'['+r+']'));continue;}
          if(item.id!=null){const entityId=String(item.id);if(ids.has(entityId))errors.push(error('ENTITY_ID_DUPLICATE','ID duplicado '+entityId+'.','dataByProfile.'+id+'.'+collection,{profileId:id,entityId}));ids.add(entityId);}
          for(const f of ['valor','amount','total','saldo','limite'])if(own(item,f)&&item[f]!==''&&item[f]!=null&&!Number.isFinite(Number(item[f])))errors.push(error('ENTITY_NUMBER_INVALID','Valor numérico inválido.','dataByProfile.'+id+'.'+collection+'['+r+'].'+f,{profileId:id,entityId:item.id||null}));
        }
      }
    }
  }
  for(const id of dataIds)if(!profileIds.has(String(id)))errors.push(error('PROFILE_DATA_ORPHANED','Dados órfãos do perfil '+id+'.','dataByProfile.'+id,{profileId:id}));
  const highWater=Math.max(0,Number(accountMeta.profileCountHighWater)||0);
  if(highWater){
    const tombstoneIds=new Set(Object.keys(accountMeta.profileTombstones&&typeof accountMeta.profileTombstones==='object'?accountMeta.profileTombstones:{}));
    const historicalIds=new Set([...profileIds,...tombstoneIds]);
    if(historicalIds.size<highWater)errors.push(error('PROFILE_HISTORY_INCOMPLETE','A conta perdeu referências de perfis abaixo do maior total já confirmado.','__syncMeta640.profileCountHighWater',{highWater,activeProfiles:profileIds.size,profileTombstones:tombstoneIds.size,historicalProfiles:historicalIds.size}));
  }
  const schema=Number(payload.__syncMeta640&&payload.__syncMeta640.schemaVersion||payload.integrity&&payload.integrity.schemaVersion||0);
  if(schema>Number(RELEASE.schemaVersion||6401))errors.push(error('SCHEMA_FUTURE','Snapshot criado por schema futuro '+schema+'.','__syncMeta640.schemaVersion',{schema}));
  if(payload.profileCount!=null&&Number(payload.profileCount)!==profiles.length)errors.push(error('PROFILE_COUNT_MISMATCH','profileCount diverge da lista de perfis.','profileCount',{declared:payload.profileCount,actual:profiles.length}));
  if(payload.integrity&&payload.integrity.profileCount!=null&&Number(payload.integrity.profileCount)!==profiles.length)errors.push(error('INTEGRITY_PROFILE_COUNT_MISMATCH','Contagem de perfis da integridade diverge.','integrity.profileCount'));
  const total=recordCount(payload);
  if(payload.integrity&&payload.integrity.recordCount!=null&&Number(payload.integrity.recordCount)!==total)warnings.push(error('INTEGRITY_RECORD_COUNT_MISMATCH','Contagem de registros da integridade diverge.','integrity.recordCount',{declared:payload.integrity.recordCount,actual:total}));
  const activeId=options.activeProfileId==null?null:String(options.activeProfileId);
  if(activeId&&!profileIds.has(activeId))errors.push(error('ACTIVE_PROFILE_MISSING','Perfil ativo não existe no snapshot.','activeProfileId',{activeProfileId:activeId}));
  const minProfiles=Math.max(0,Number(options.minimumProfileCount)||0);
  if(minProfiles&&profiles.length<minProfiles&&!options.explicitProfileDeletion)errors.push(error('PROFILE_COUNT_UNEXPECTED_DROP','Quantidade de perfis caiu sem exclusão explícita.','profiles',{minimum:minProfiles,actual:profiles.length}));
  return {valid:errors.length===0,errors,warnings,profileCount:profiles.length,recordCount:total,profileIds:Array.from(profileIds)};
}
function revBag(profile){
  const bag=profile&&profile.__fieldRevisions;
  return bag&&typeof bag==='object'&&!Array.isArray(bag)?bag:{};
}
function revisionKey(rev){if(!rev)return '0000000000000|0000000000||';return String(Number(rev.revision)||0).padStart(13,'0')+'|'+String(rev.updatedAt||'')+'|'+String(rev.deviceId||'')+'|'+String(rev.operationId||'');}
function touchProfileField(profile,field,options={}){
  if(!profile||!PROFILE_FIELDS.includes(field))return profile;
  const bag=Object.assign({},revBag(profile)),prev=bag[field]||{};
  bag[field]={revision:(Number(prev.revision)||0)+1,updatedAt:new Date().toISOString(),deviceId:String(options.deviceId||''),operationId:String(options.operationId||''),explicitClear:!!options.explicitClear};
  profile.__fieldRevisions=bag;profile.updatedAt=new Date().toISOString();return profile;
}
function fieldState(profile,field){
  if(!profile)return {present:false,value:undefined,revision:null,explicitClear:false};
  const revision=revBag(profile)[field]||null;
  return {present:own(profile,field),value:profile[field],revision,explicitClear:!!(revision&&revision.explicitClear)};
}
function usableValue(field,state){
  if(state.explicitClear)return true;
  if(!state.present)return false;
  if(field==='name')return typeof state.value==='string'&&state.value.trim()&&state.value.trim()!=='Perfil';
  if(field==='avatarImage')return typeof state.value==='string'&&state.value.length>0;
  return state.value!==undefined;
}
function chooseField(field,base,local,remote){
  const b=fieldState(base,field),l=fieldState(local,field),r=fieldState(remote,field);
  const lk=revisionKey(l.revision),rk=revisionKey(r.revision);
  if(l.revision||r.revision){
    const winner=lk>=rk?l:r;
    if(winner.explicitClear)return {present:false,value:undefined,revision:winner.revision,explicitClear:true};
    if(winner.present)return winner;
  }
  const core=syncCore();
  if(core&&core.canonicalStringify){
    const same=(a,c)=>core.canonicalStringify(a)===core.canonicalStringify(c);
    const lChanged=!same(l.value,b.value),rChanged=!same(r.value,b.value);
    if(lChanged&&!rChanged&&usableValue(field,l))return l;
    if(rChanged&&!lChanged&&usableValue(field,r))return r;
    if(lChanged&&rChanged){if(usableValue(field,l)&&!usableValue(field,r))return l;if(usableValue(field,r)&&!usableValue(field,l))return r;}
  }
  if(usableValue(field,l))return l;
  if(usableValue(field,r))return r;
  if(usableValue(field,b))return b;
  return l.present?l:(r.present?r:b);
}
function mergeProfileMetadata(base,local,remote,id,conflicts=[]){
  const out=Object.assign({},clone(base||{}),clone(remote||{}),clone(local||{}),{id:String(id)}),bag={};
  for(const field of PROFILE_FIELDS){
    const chosen=chooseField(field,base,local,remote);
    if(chosen.explicitClear){delete out[field];bag[field]=clone(chosen.revision||{explicitClear:true});continue;}
    if(chosen.present)out[field]=clone(chosen.value);else delete out[field];
    if(chosen.revision)bag[field]=clone(chosen.revision);
  }
  if(Object.keys(bag).length)out.__fieldRevisions=bag;
  if(!String(out.name||'').trim()){
    const preserved=[local,remote,base].map(p=>p&&p.name).find(n=>typeof n==='string'&&n.trim());
    if(preserved)out.name=preserved;else{out.name='Perfil';conflicts.push({kind:'profile_name_recovered_default',profileId:String(id)});}
  }
  return out;
}
function profileDeletionCoverage(previousPayload,nextPayload){
  const previousProfiles=previousPayload&&Array.isArray(previousPayload.profiles)?previousPayload.profiles:[];
  const nextProfiles=nextPayload&&Array.isArray(nextPayload.profiles)?nextPayload.profiles:[];
  const previousIds=new Set(previousProfiles.filter(p=>p&&p.id!=null).map(p=>String(p.id)));
  const nextIds=new Set(nextProfiles.filter(p=>p&&p.id!=null).map(p=>String(p.id)));
  const missingIds=Array.from(previousIds).filter(id=>!nextIds.has(id));
  const previousTombstones=previousPayload&&previousPayload.__syncMeta640&&previousPayload.__syncMeta640.profileTombstones||{};
  const nextTombstones=nextPayload&&nextPayload.__syncMeta640&&nextPayload.__syncMeta640.profileTombstones||{};
  const coveredIds=[],uncoveredIds=[];
  for(const id of missingIds){
    let covered=false;
    if(own(nextTombstones,id)){
      if(!own(previousTombstones,id))covered=true;
      else covered=canonical(previousTombstones[id])!==canonical(nextTombstones[id]);
    }
    (covered?coveredIds:uncoveredIds).push(id);
  }
  return {missingIds,coveredIds,uncoveredIds,explicitProfileDeletion:missingIds.length>0&&uncoveredIds.length===0};
}
function repairProfileMetadata(candidate,baseline){
  const out=clone(candidate),cm=profileMap(out&&out.profiles),bm=profileMap(baseline&&baseline.profiles);
  if(!out||!Array.isArray(out.profiles))return out;
  out.profiles=out.profiles.map(p=>{
    const id=String(p.id),b=bm.get(id);if(!b)return p;
    return mergeProfileMetadata(b,p,b,id,[]);
  });
  return out;
}
const cloudOnlyGenerations=new Map();
async function openDb(){return {cloudOnly:true,close(){}};}
async function getRecord(id){return clone(cloudOnlyGenerations.get(String(id))||null);}
async function putRecord(rec){cloudOnlyGenerations.set(String(rec.id),clone(rec));return rec;}
async function deleteRecordById(id){cloudOnlyGenerations.delete(String(id));return true;}
try{if(global.indexedDB)indexedDB.deleteDatabase(DB_NAME);}catch(_){}
async function stageCandidate(folderId,payload,source='unknown'){
  const check=validateAccount(payload,{allowEmptyAccount:false});if(!check.valid)throw Object.assign(new Error(check.errors.map(e=>e.code).join(', ')),{code:'LOCAL_CANDIDATE_INVALID',validation:check});
  const canonicalPayload=clone(payload),sum=await checksum((()=>{const c=clone(canonicalPayload);delete c.integrity;return c;})());
  const rec={id:'pending:'+String(folderId),type:'pending-generation',folderId:String(folderId),releaseId:RELEASE.releaseId,createdAt:new Date().toISOString(),source,checksum:sum,profileCount:check.profileCount,recordCount:check.recordCount,payload:canonicalPayload};
  try{return await putRecord(rec);}catch(e){if(global.BorionDiagnostics700)BorionDiagnostics700.event('LOCAL_COMMIT_FAILED',{module:'account-integrity',operation:'stageCandidate',error:e,context:{folderId,source}},'error');throw e;}
}
async function commitConfirmed(folderId,payload,source='drive_readback'){
  const check=validateAccount(payload,{allowEmptyAccount:false});if(!check.valid)throw Object.assign(new Error('Snapshot confirmado inválido.'),{code:'CONFIRMED_SNAPSHOT_INVALID',validation:check});
  const canonicalPayload=clone(payload),sum=await checksum((()=>{const c=clone(canonicalPayload);delete c.integrity;return c;})());
  const indexId='index:'+String(folderId),index=await getRecord(indexId).catch(()=>null)||{id:indexId,type:'generation-index',folderId:String(folderId),generations:[]};
  const generationId='generation:'+String(folderId)+':'+Date.now()+':'+sum.slice(0,12);
  const rec={id:generationId,type:'confirmed-generation',folderId:String(folderId),releaseId:RELEASE.releaseId,confirmedAt:new Date().toISOString(),source,checksum:sum,profileCount:check.profileCount,recordCount:check.recordCount,payload:canonicalPayload};
  await putRecord(rec);
  const allGenerationIds=[generationId,...(index.generations||[]).filter(x=>x!==generationId)],kept=allGenerationIds.slice(0,MAX_GENERATIONS),evicted=allGenerationIds.slice(MAX_GENERATIONS);
  index.generations=kept;index.activeGeneration=generationId;index.updatedAt=rec.confirmedAt;await putRecord(index);
  for(const staleId of evicted)await deleteRecordById(staleId).catch(()=>{});
  try{await putRecord({id:'pending:'+String(folderId),type:'cleared-pending',folderId:String(folderId),clearedAt:rec.confirmedAt});}catch(_){ }
  return rec;
}
async function getLastConfirmed(folderId){const index=await getRecord('index:'+String(folderId)).catch(()=>null);if(!index||!index.activeGeneration)return null;const rec=await getRecord(index.activeGeneration).catch(()=>null);return rec&&rec.payload?rec:null;}
async function recoverInvalidRemote(folderId,invalidPayload,reason='remote_invalid'){
  const last=await getLastConfirmed(folderId);if(!last)return null;
  if(global.BorionDiagnostics700)BorionDiagnostics700.event('CURRENT_JSON_PARTIAL',{module:'account-integrity',operation:'recoverInvalidRemote',result:'local_generation_selected',recoveryAction:'use_last_confirmed_local_generation',context:{folderId,reason,lastChecksum:last.checksum,profileCount:last.profileCount}},'warning');
  return {payload:clone(last.payload),generation:last,invalidPayload:clone(invalidPayload)};
}
async function status(folderId){const last=await getLastConfirmed(folderId);const pending=await getRecord('pending:'+String(folderId)).catch(()=>null);return {release:RELEASE,lastConfirmed:last?{confirmedAt:last.confirmedAt,checksum:last.checksum,profileCount:last.profileCount,recordCount:last.recordCount}:null,pending:pending&&pending.type==='pending-generation'?{createdAt:pending.createdAt,checksum:pending.checksum,profileCount:pending.profileCount,recordCount:pending.recordCount}:null};}

global.BorionAccountIntegrity700={release:RELEASE,validateAccount,recordCount,touchProfileField,mergeProfileMetadata,profileDeletionCoverage,repairProfileMetadata,stageCandidate,commitConfirmed,getLastConfirmed,recoverInvalidRemote,status,_test:{chooseField,fieldState,revisionKey,profileMap,collectionEntries,checksum,canonical,deleteRecordById}};
})(window);
