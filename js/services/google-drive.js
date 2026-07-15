(() => {
  'use strict';
  const DEFAULT_CLIENT_ID='946105310952-gp143h81mm3704lrq3877hsie49njgak.apps.googleusercontent.com';
  const DEFAULT_API_KEY='AIzaSyAMm_8CtFg_YP2ssG4XaiBbOc7wuJFq7xs';
  const DEFAULT_PROJECT_NUMBER='946105310952';
  const SCOPES='openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/drive.file';
  const ALLOWED_ACCOUNT_HASHES=new Set(['134e106b0600045a12cf9722057a06fad862df6d45b5fece1eb7180729569ea2','db9c91e0d2956a89a70d9683b4a2a4d048b9cde255f861425342fe877b48339c']);
  const DATA_FILE='Marco_Iris_Dados.json';
  const DATA_FILE_ID_PREFIX='marco_iris_gdrive_data_file_';
  const USER_KEY='marco_iris_gdrive_user';
  const ROOT_PREFIX='marco_iris_gdrive_root_';
  const STRUCT_PREFIX='marco_iris_gdrive_structure_';
  const LAST_SAVE='marco_iris_last_google_save';
  const FOLDERS={data:'Dados',backups:'Backups',photos:'Fotos_OS',pdfs:'Ordens_de_Servico',attachments:'Anexos',integration:'Borion_Integracoes'};
  let structurePromise=null;
  let connectionPromise=null;
  const integrationFileIds=new Map();
  const integrationFilePromises=new Map();
  const dataFilePromises=new Map();

  function config(){
    return {clientId:DEFAULT_CLIENT_ID,apiKey:DEFAULT_API_KEY,projectNumber:DEFAULT_PROJECT_NUMBER};
  }
  function validateConfig(){const c=config();if(!c.clientId||!c.apiKey||!c.projectNumber)throw new Error('A conexão com o Google Drive não está disponível nesta versão do aplicativo.');return c;}
  const Auth={token:'',expiresAt:0,user:null,gisLoaded:false,pickerLoaded:false,tokenClient:null,
    loadScript(src){return new Promise((resolve,reject)=>{if(document.querySelector(`script[src="${src}"]`)){resolve();return;}const s=document.createElement('script');s.src=src;s.async=true;s.defer=true;s.onload=resolve;s.onerror=()=>reject(new Error('Não foi possível carregar os serviços do Google.'));document.head.appendChild(s);});},
    async libraries(){if(!this.gisLoaded){await this.loadScript('https://accounts.google.com/gsi/client');this.gisLoaded=true;}if(!this.pickerLoaded){await this.loadScript('https://apis.google.com/js/api.js');await new Promise(r=>gapi.load('picker',r));this.pickerLoaded=true;}},
    async request(interactive=false){const cfg=validateConfig();await this.libraries();return await new Promise((resolve,reject)=>{this.tokenClient=google.accounts.oauth2.initTokenClient({client_id:cfg.clientId,scope:SCOPES,callback:r=>{if(r.error){reject(new Error(`O Google recusou o acesso: ${r.error}`));return;}this.token=r.access_token;this.expiresAt=Date.now()+((r.expires_in||3300)*1000);resolve(this.token);},error_callback:e=>reject(new Error(e?.message||'Login com Google cancelado.'))});this.tokenClient.requestAccessToken({prompt:interactive?'select_account':''});});},
    async ensure(interactive=false){if(this.token&&Date.now()<this.expiresAt-60000)return this.token;return await this.request(interactive);},
    async fetchUser(){const r=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:`Bearer ${this.token}`}});if(!r.ok)throw new Error('Não foi possível confirmar a conta Google.');const i=await r.json();this.user={sub:i.sub,email:i.email,name:i.name||i.email,picture:i.picture||''};localStorage.setItem(USER_KEY,JSON.stringify(this.user));return this.user;},
    cached(){if(this.user)return this.user;try{this.user=JSON.parse(localStorage.getItem(USER_KEY)||'null');}catch(_){this.user=null;}return this.user;},
    signOut(){if(this.token){try{google.accounts.oauth2.revoke(this.token,()=>{});}catch(_){}}this.token='';this.expiresAt=0;this.user=null;localStorage.removeItem(USER_KEY);}
  };
  async function accountHash(email){const normalized=String(email||'').trim().toLowerCase();if(!normalized||!globalThis.crypto?.subtle)return '';const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalized));return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
  async function assertAuthorizedUser(user){const hash=await accountHash(user?.email);if(!hash||!ALLOWED_ACCOUNT_HASHES.has(hash)){Auth.signOut();throw new Error('Esta conta Google não está autorizada a acessar o Marco Iris Tecnologia.');}return user;}
  async function authenticateGoogle(interactive=true){await Auth.ensure(interactive);return await assertAuthorizedUser(await Auth.fetchUser());}
  async function headers(json=false){const token=await Auth.ensure(false);return json?{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}:{Authorization:`Bearer ${token}`};}
  function safeQuery(v){return String(v).replace(/'/g,"\\'");}
  async function findChildren(parentId,name,mimeType=''){
    let q=`'${parentId}' in parents and name='${safeQuery(name)}' and trashed=false`;if(mimeType)q+=` and mimeType='${mimeType}'`;
    const params=new URLSearchParams({q,orderBy:'createdTime asc',pageSize:'100',fields:'files(id,name,mimeType,createdTime,modifiedTime,size,parents,trashed,webViewLink,webContentLink,thumbnailLink)'});
    const r=await fetch(`https://www.googleapis.com/drive/v3/files?${params}`,{headers:await headers()});
    if(!r.ok)throw new Error('Falha ao consultar o Google Drive.');const result=await r.json();return Array.isArray(result.files)?result.files:[];
  }
  async function findChild(parentId,name,mimeType=''){
    const files=await findChildren(parentId,name,mimeType);if(files.length>1)console.warn(`[GOOGLE_DRIVE] Existem ${files.length} itens chamados “${name}”. O mais antigo será reutilizado.`);return files[0]||null;
  }
  async function createMetadata(meta){const r=await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,createdTime,modifiedTime,size,parents,trashed,webViewLink,webContentLink',{method:'POST',headers:await headers(true),body:JSON.stringify(meta)});if(!r.ok)throw new Error(`Falha ao criar “${meta.name}” no Google Drive.`);return await r.json();}
  async function createFolder(parentId,name){return await createMetadata({name,mimeType:'application/vnd.google-apps.folder',parents:[parentId]});}
  async function uploadMediaContent(fileId,blob){const r=await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,name,mimeType,modifiedTime,size,webViewLink,webContentLink,thumbnailLink`,{method:'PATCH',headers:{...(await headers()),'Content-Type':blob.type||'application/octet-stream'},body:blob});if(!r.ok)throw new Error('Falha ao enviar o arquivo para o Google Drive.');return await r.json();}
  async function updateJson(fileId,obj){return await uploadMediaContent(fileId,new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));}
  async function readJson(fileId){const r=await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,{headers:await headers()});if(!r.ok)throw new Error('Falha ao carregar os dados do Google Drive.');return await r.json();}
  async function meta(fileId){const r=await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,createdTime,modifiedTime,size,parents,trashed,webViewLink,webContentLink,thumbnailLink`,{headers:await headers()});if(!r.ok){const e=new Error('Falha ao consultar o arquivo no Google Drive.');e.status=r.status;throw e;}return await r.json();}
  async function downloadBlob(fileId){const r=await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,{headers:await headers()});if(!r.ok)throw new Error('Falha ao baixar o arquivo do Google Drive.');return await r.blob();}
  async function trash(fileId){const r=await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`,{method:'PATCH',headers:await headers(true),body:JSON.stringify({trashed:true})});if(!r.ok)throw new Error('Falha ao mover o arquivo para a lixeira do Drive.');return true;}
  function rootKey(sub){return `${ROOT_PREFIX}${sub}`;}function structKey(root){return `${STRUCT_PREFIX}${root}`;}
  function rootId(){const u=Auth.cached();return u?localStorage.getItem(rootKey(u.sub))||'':'';}
  function setRoot(id){const u=Auth.cached();if(u)localStorage.setItem(rootKey(u.sub),id);}
  function cachedStructure(){const root=rootId();if(!root)return null;try{return JSON.parse(localStorage.getItem(structKey(root))||'null');}catch(_){return null;}}
  function setStructure(v){if(v?.rootId)localStorage.setItem(structKey(v.rootId),JSON.stringify(v));}
  function picker(){return new Promise((resolve,reject)=>{const cfg=validateConfig(),view=new google.picker.DocsView(google.picker.ViewId.FOLDERS).setSelectFolderEnabled(true).setIncludeFolders(true).setMimeTypes('application/vnd.google-apps.folder');const p=new google.picker.PickerBuilder().setTitle('Escolha a pasta principal da Marco Iris').addView(view).setOAuthToken(Auth.token).setDeveloperKey(cfg.apiKey).setAppId(cfg.projectNumber).setCallback(d=>{if(d.action===google.picker.Action.PICKED)resolve(d.docs[0]);else if(d.action===google.picker.Action.CANCEL)reject(new Error('Nenhuma pasta foi selecionada.'));}).build();p.setVisible(true);});}
  function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
  async function withCrossTabLock(name,task){
    if(navigator?.locks?.request)return await navigator.locks.request(name,task);
    const key=`marco_iris_mutex_${encodeURIComponent(name)}`,token=`${Date.now()}_${Math.random().toString(36).slice(2)}`,deadline=Date.now()+30000;
    while(Date.now()<deadline){let current=null;try{current=JSON.parse(localStorage.getItem(key)||'null');}catch(_){}
      if(!current||Number(current.expiresAt)<Date.now()){localStorage.setItem(key,JSON.stringify({token,expiresAt:Date.now()+30000}));let confirmed=null;try{confirmed=JSON.parse(localStorage.getItem(key)||'null');}catch(_){}
        if(confirmed?.token===token){try{return await task();}finally{try{const latest=JSON.parse(localStorage.getItem(key)||'null');if(latest?.token===token)localStorage.removeItem(key);}catch(_){localStorage.removeItem(key);}}}}
      await sleep(120+Math.floor(Math.random()*120));
    }
    throw new Error('Outra aba ainda está preparando as pastas do Google Drive. Feche as abas duplicadas e tente novamente.');
  }
  function validFolder(info,root,name){return !!info&&!info.trashed&&info.mimeType==='application/vnd.google-apps.folder'&&info.name===name&&(info.parents||[]).includes(root);}
  async function validateStructure(root,c){
    if(!c||c.rootId!==root)return null;const normalized={rootId:root};
    for(const [key,name] of Object.entries(FOLDERS)){const id=c[key];if(!id)return null;try{const info=await meta(id);if(!validFolder(info,root,name))return null;normalized[key]=id;}catch(_){return null;}}
    return normalized;
  }
  async function ensureStructure(force=false){
    const root=rootId();if(!root)throw new Error('Escolha primeiro uma pasta do Google Drive.');
    if(!force){const c=await validateStructure(root,cachedStructure());if(c)return c;}
    if(structurePromise)return await structurePromise;
    structurePromise=withCrossTabLock(`marco-drive-structure:${root}`,async()=>{
      const stored=await validateStructure(root,cachedStructure());if(stored)return stored;
      const s={rootId:root};
      for(const [key,name] of Object.entries(FOLDERS)){
        let f=await findChild(root,name,'application/vnd.google-apps.folder');
        if(!f){for(const delay of [600,1400,2600]){await sleep(delay);f=await findChild(root,name,'application/vnd.google-apps.folder');if(f)break;}}
        if(!f)f=await createFolder(root,name);s[key]=f.id;setStructure(s);
      }
      setStructure(s);return s;
    }).finally(()=>{structurePromise=null;});
    return await structurePromise;
  }
  function stamp(){const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;}
  function integrationFileKey(folderId,name){const sub=Auth.cached()?.sub||'unknown';return `marco_iris_gdrive_integration_file_${sub}_${folderId}_${encodeURIComponent(name)}`;}
  async function resolveIntegrationFileUncached(folderId,name,create=false,obj=null){
    const memoryKey=`${folderId}:${name}`,storageKey=integrationFileKey(folderId,name);
    const cached=integrationFileIds.get(memoryKey)||localStorage.getItem(storageKey);
    if(cached){
      try{const info=await meta(cached);if(info.name===name&&info.mimeType==='application/json'){integrationFileIds.set(memoryKey,cached);return {id:cached,name};}}
      catch(_){integrationFileIds.delete(memoryKey);localStorage.removeItem(storageKey);}
    }
    let f=await findChild(folderId,name,'application/json');
    if(!f&&create){await sleep(450);f=await findChild(folderId,name,'application/json');if(!f)f=await createMetadata({name,mimeType:'application/json',parents:[folderId]});}
    if(f){integrationFileIds.set(memoryKey,f.id);localStorage.setItem(storageKey,f.id);}
    return f||null;
  }
  async function resolveIntegrationFile(folderId,name,create=false,obj=null){
    const memoryKey=`${folderId}:${name}`;if(integrationFilePromises.has(memoryKey))return await integrationFilePromises.get(memoryKey);
    const task=()=>resolveIntegrationFileUncached(folderId,name,create,obj);
    const promise=withCrossTabLock(`marco-drive-file:${folderId}:${name}`,task).finally(()=>integrationFilePromises.delete(memoryKey));
    integrationFilePromises.set(memoryKey,promise);return await promise;
  }

  function dataFileKey(folderId){return `${DATA_FILE_ID_PREFIX}${folderId}`;}
  function rememberDataFile(folderId,file){if(file?.id)localStorage.setItem(dataFileKey(folderId),file.id);return file||null;}
  function forgetDataFile(folderId){localStorage.removeItem(dataFileKey(folderId));}
  function validDataFile(info,folderId){return !!info&&!info.trashed&&info.name===DATA_FILE&&info.mimeType==='application/json'&&(info.parents||[]).includes(folderId);}
  async function resolveDataFileUncached(folderId){
    const cachedId=localStorage.getItem(dataFileKey(folderId));
    if(cachedId){
      try{const info=await meta(cachedId);if(validDataFile(info,folderId))return rememberDataFile(folderId,info);}catch(error){if(![403,404].includes(error?.status))console.warn('[GOOGLE_DRIVE] Arquivo principal em cache inválido:',error);}
      forgetDataFile(folderId);
    }
    const files=await findChildren(folderId,DATA_FILE,'application/json');
    if(!files.length)return null;
    const ordered=[...files].sort((a,b)=>{const modified=new Date(b.modifiedTime||0)-new Date(a.modifiedTime||0);if(modified)return modified;return new Date(a.createdTime||0)-new Date(b.createdTime||0);});
    if(ordered.length>1)console.warn(`[GOOGLE_DRIVE] Existem ${ordered.length} arquivos principais chamados “${DATA_FILE}”. O mais recentemente modificado será reutilizado.`);
    return rememberDataFile(folderId,ordered[0]);
  }
  async function resolveDataFile(folderId){
    if(dataFilePromises.has(folderId))return await dataFilePromises.get(folderId);
    const promise=withCrossTabLock(`marco-drive-main-file-resolve:${folderId}`,()=>resolveDataFileUncached(folderId)).finally(()=>dataFilePromises.delete(folderId));
    dataFilePromises.set(folderId,promise);return await promise;
  }
  async function saveDataFile(folderId,state){
    return await withCrossTabLock(`marco-drive-main-file-save:${folderId}`,async()=>{
      let file=await resolveDataFileUncached(folderId);
      if(!file){for(const delay of [500,1200,2400]){await sleep(delay);file=await resolveDataFileUncached(folderId);if(file)break;}}
      if(!file)file=await createMetadata({name:DATA_FILE,mimeType:'application/json',parents:[folderId]});
      file=await updateJson(file.id,state);
      return rememberDataFile(folderId,file);
    });
  }

  const Drive={currentFile:null,
    cachedUser:()=>Auth.cached(),rootId,isConfigured:()=>!!(Auth.cached()&&rootId()),hasCredentials:()=>{const c=config();return !!(c.clientId&&c.apiKey&&c.projectNumber);},cachedStructure,
    async authenticate(interactive=true){return await authenticateGoogle(interactive);},
    async connect(interactive=true){if(connectionPromise)return await connectionPromise;connectionPromise=(async()=>{const user=await authenticateGoogle(interactive);let root=rootId();if(!root){const chosen=await picker();root=chosen.id;setRoot(root);}const structure=await ensureStructure(false);return {user,rootId:root,structure};})().finally(()=>{connectionPromise=null;});return await connectionPromise;},
    async ensureConnection(interactive=false){if(!this.isConfigured())return await this.connect(interactive);await Auth.ensure(interactive);const user=await assertAuthorizedUser(await Auth.fetchUser());return {user,rootId:rootId(),structure:await ensureStructure(false)};},
    async findDataFile(){const {structure}=await this.ensureConnection(false);this.currentFile=await resolveDataFile(structure.data);return this.currentFile;},
    async save(state,{backup=false,reason='manual',interactive=false}={}){const {structure}=await this.ensureConnection(interactive);const f=await saveDataFile(structure.data,state);this.currentFile=f;localStorage.setItem(LAST_SAVE,new Date().toISOString());if(backup){const name=`Marco_Iris_${String(reason).replace(/[^a-zA-Z0-9_-]/g,'-')}_${stamp()}.json`;const bf=await createMetadata({name,mimeType:'application/json',parents:[structure.backups]});await updateJson(bf.id,state);}return f;},
    async load({interactive=false}={}){await this.ensureConnection(interactive);const f=this.currentFile||await this.findDataFile();if(!f)throw new Error('Ainda não existe um arquivo de dados nesta pasta.');const [state,info]=await Promise.all([readJson(f.id),meta(f.id)]);this.currentFile=info;return {state,meta:info};},
    async sync(state,{interactive=false,backup=false,reason='sincronizacao'}={}){await this.ensureConnection(interactive);const f=this.currentFile||await this.findDataFile();if(!f){await this.save(state,{backup:true,reason:'primeira-sincronizacao'});return {direction:'local',created:true};}const remote=await this.load();if(remote.state?.updatedAt&&new Date(remote.state.updatedAt)>new Date(state.updatedAt||0))return {direction:'remote',state:remote.state,meta:remote.meta};await this.save(state,{backup,reason});return {direction:'local',meta:this.currentFile};},
    async uploadBlob(blob,folderKey,fileName,existingId=''){const {structure}=await this.ensureConnection(false);const parent=structure[folderKey];if(!parent)throw new Error('Pasta de nuvem inválida.');let f=existingId?await meta(existingId).catch(()=>null):await findChild(parent,fileName);if(!f)f=await createMetadata({name:fileName,mimeType:blob.type||'application/octet-stream',parents:[parent]});return await uploadMediaContent(f.id,blob);},
    downloadBlob,meta,trash,
    async folderStatus(){const {structure}=await this.ensureConnection(false);return Object.entries(FOLDERS).map(([key,name])=>({key,name,id:structure[key],url:`https://drive.google.com/drive/folders/${structure[key]}`}));},
    /* BORION INTEROP v1.0.0 — protected transport seam. */
    async integrationFolderId(){const {structure}=await this.ensureConnection(false);return structure.integration;},
    async writeIntegrationJson(name,obj){const folderId=await this.integrationFolderId();const f=await resolveIntegrationFile(folderId,name,true,obj);return await updateJson(f.id,obj);},
    async readIntegrationJson(name){const folderId=await this.integrationFolderId();const f=await resolveIntegrationFile(folderId,name,false,null);return f?await readJson(f.id):null;},
    disconnect(){const u=Auth.cached();if(u){localStorage.removeItem(rootKey(u.sub));localStorage.removeItem(structKey(u.sub));}this.currentFile=null;structurePromise=null;connectionPromise=null;integrationFileIds.clear();integrationFilePromises.clear();dataFilePromises.clear();Auth.signOut();}
  };
  window.GoogleDriveMarco=Drive;
})();
