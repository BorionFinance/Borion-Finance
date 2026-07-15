(() => {
  'use strict';
  const DB='marco_iris_tecnologia_db';
  const VERSION=3;
  const STATE='state';
  const BACKUPS='backups';
  const MEDIA='media';
  const HANDLES='handles';
  const KEY='main';
  const DATA_FILE='Marco_Iris_Dados.json';

  function clone(v){return JSON.parse(JSON.stringify(v));}
  function openDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB,VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(STATE))db.createObjectStore(STATE);
        if(!db.objectStoreNames.contains(BACKUPS))db.createObjectStore(BACKUPS,{keyPath:'id'});
        if(!db.objectStoreNames.contains(MEDIA))db.createObjectStore(MEDIA,{keyPath:'id'});
        if(!db.objectStoreNames.contains(HANDLES))db.createObjectStore(HANDLES);
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }
  async function tx(store,mode,action){
    const db=await openDb();
    return await new Promise((resolve,reject)=>{
      const t=db.transaction(store,mode),s=t.objectStore(store),req=action(s);let result;
      req.onsuccess=()=>{result=req.result;};
      req.onerror=()=>reject(req.error||new Error('Falha ao acessar o armazenamento local.'));
      t.oncomplete=()=>{db.close();resolve(result);};
      t.onerror=()=>{db.close();reject(t.error||new Error('Falha na transação do armazenamento local.'));};
      t.onabort=()=>{db.close();reject(t.error||new Error('A transação do armazenamento local foi cancelada.'));};
    });
  }
  const get=(s,k)=>tx(s,'readonly',x=>x.get(k));
  const put=(s,v,k)=>tx(s,'readwrite',x=>k===undefined?x.put(v):x.put(v,k));
  const del=(s,k)=>tx(s,'readwrite',x=>x.delete(k));
  const all=s=>tx(s,'readonly',x=>x.getAll());

  async function load(){return clone((await get(STATE,KEY))||window.MARCO_INITIAL_DATA);}
  async function save(state){state.updatedAt=new Date().toISOString();await put(STATE,clone(state),KEY);return state;}
  async function createBackup(state,reason='manual'){
    const item={id:`bkp_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,createdAt:new Date().toISOString(),reason,state:clone(state)};
    await put(BACKUPS,item);const list=(await all(BACKUPS)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    for(const old of list.slice(30))await del(BACKUPS,old.id);return item;
  }
  async function listBackups(){return (await all(BACKUPS)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));}
  async function restoreBackup(id){const b=await get(BACKUPS,id);return b?clone(b.state):null;}

  async function putMedia(blob,meta={}){
    if(!(blob instanceof Blob))throw new Error('O arquivo selecionado não pôde ser processado.');
    if(blob.size<=0)throw new Error(`O arquivo ${meta.name||'selecionado'} está vazio ou não pôde ser lido.`);
    const id=meta.id||`media_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const record={id,blob,name:meta.name||'arquivo',type:meta.type||blob.type||'application/octet-stream',size:blob.size,createdAt:meta.createdAt||new Date().toISOString()};
    await put(MEDIA,record);return record;
  }
  async function getMedia(id){return id?await get(MEDIA,id):null;}
  async function deleteMedia(id){if(id)await del(MEDIA,id);}

  async function connectFolder(){
    if(!window.showDirectoryPicker)throw new Error('Este navegador não permite conexão direta com pastas. Use Chrome ou Edge no computador.');
    const handle=await window.showDirectoryPicker({mode:'readwrite'});await put(HANDLES,handle,'folder');return handle;
  }
  async function getFolderHandle(){return await get(HANDLES,'folder');}
  async function forgetFolder(){await del(HANDLES,'folder');}
  async function ensurePermission(handle,request=false){
    if(!handle)return false;const opts={mode:'readwrite'};
    if(await handle.queryPermission(opts)==='granted')return true;
    return request&&(await handle.requestPermission(opts)==='granted');
  }
  async function getOrCreateDir(parent,name){return await parent.getDirectoryHandle(name,{create:true});}
  async function writeFile(dir,name,blob){const h=await dir.getFileHandle(name,{create:true}),w=await h.createWritable();await w.write(blob);await w.close();return h;}
  function stamp(){const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;}
  async function saveToFolder(state,{handle,requestPermission=false,backup=false,reason='manual'}={}){
    handle=handle||await getFolderHandle();if(!handle)throw new Error('Nenhuma pasta local foi conectada.');
    if(!(await ensurePermission(handle,requestPermission)))throw new Error('Acesso à pasta não autorizado.');
    const dataDir=await getOrCreateDir(handle,'Dados');
    await writeFile(dataDir,DATA_FILE,new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));
    if(backup){const b=await getOrCreateDir(handle,'Backups');await writeFile(b,`Marco_Iris_${reason}_${stamp()}.json`,new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));}
    return true;
  }
  async function readFromFolder({handle,requestPermission=false}={}){
    handle=handle||await getFolderHandle();if(!handle)throw new Error('Nenhuma pasta local foi conectada.');
    if(!(await ensurePermission(handle,requestPermission)))throw new Error('Acesso à pasta não autorizado.');
    const dataDir=await handle.getDirectoryHandle('Dados'),fh=await dataDir.getFileHandle(DATA_FILE),file=await fh.getFile();return {state:JSON.parse(await file.text()),file};
  }
  function downloadJson(state,filename=`Marco_Iris_Backup_${stamp()}.json`){const b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});downloadBlob(b,filename);}
  function downloadBlob(blob,filename){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  async function readUploadedJson(file){const obj=JSON.parse(await file.text());if(obj?.appId!=='marco-iris-tecnologia'||!obj.dataByProfile)throw new Error('Arquivo incompatível com o sistema Marco Iris.');return obj;}

  window.MarcoStorage={load,save,createBackup,listBackups,restoreBackup,putMedia,getMedia,deleteMedia,connectFolder,getFolderHandle,forgetFolder,ensurePermission,saveToFolder,readFromFolder,downloadJson,downloadBlob,readUploadedJson,DATA_FILE};
})();
