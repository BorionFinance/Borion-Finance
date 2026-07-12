/* Borion Finance — Eventos dinâmicos, splash, inicialização e PWA/service worker. */

/* ---------------- Wire dynamic view-level events ---------------- */
function wireViewEvents(){
  const fontSel = $('#cfg_font');
  if(fontSel) fontSel.onchange = ()=>{
    S.config.font = fontSel.value;
    setConfig(S.config);
    applyFont();
    toast('Fonte atualizada.');
  };
  const themeSel = $('#cfg_theme');
  if(themeSel) themeSel.onchange = ()=>{
    S.config.theme = themeSel.value;
    setConfig(S.config);
    applyTheme();
    toast('Tema atualizado.');
  };
  const uiModeSel = $('#cfg_ui_mode');
  if(uiModeSel) uiModeSel.onchange = ()=>{
    S.config.uiMode = uiModeSel.value;
    setConfig(S.config);
    applyInterfaceMode();
    renderApp();
    toast(resolvedInterfaceMode()==='smartphone'?'Smartphone Mode ativado.':'Modo Pro ativado.');
  };
  const popupDur = $('#cfg_popup_duration');
  if(popupDur) popupDur.onchange = ()=>{
    if(!S.config.popupNotifs) S.config.popupNotifs={enabled:true,durationMs:40000};
    S.config.popupNotifs.durationMs = Number(popupDur.value)||40000;
    setConfig(S.config);
    toast('Tempo dos popups atualizado.');
  };
  Object.keys(ICON_COLOR_LABELS).forEach(key=>{
    const inp = $('#ic_'+key);
    if(inp) inp.onchange = ()=>{
      if(!S.config.iconColors) S.config.iconColors = Object.assign({}, DEFAULT_ICON_COLORS);
      S.config.iconColors[key] = inp.value;
      setConfig(S.config);
      renderView();
    };
  });
  ['import_file','import_file_backup','import_file_cloud'].forEach(fid=>{
    const input = $('#'+fid);
    if(!input) return;
    input.onchange = (e)=>{
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = ()=>{
        try{
          const obj = JSON.parse(reader.result);
          handleImport(obj);
        }catch(err){ alert('Arquivo inválido ou corrompido.'); }
      };
      reader.readAsText(file);
      input.value='';
    };
  });
}

/* A implementação de handleImport() fica mais abaixo, perto do boot/PWA
   (função única, com o fluxo "logado na nuvem" ciente do perfil ativo). */

/* ---------------- SPLASH ---------------- */
function showSplash(next){
  applyFont();
  applyTheme();
  applyInterfaceMode();
  const root = $('#root');
  root.innerHTML = `
    <div id="splash">
      <img src="borion-full.png" alt="Borion Finance"/>
      <div class="splash-num">R$ 0,00</div>
      <div class="splash-tag">Carregando</div>
    </div>`;
  const numEl = root.querySelector('.splash-num');
  const duration = 1100;
  const start = performance.now();
  function tick(now){
    const t = Math.min(1, (now-start)/duration);
    const eased = 1 - Math.pow(1-t, 4);
    numEl.textContent = brlPlain(eased*1000000);
    if(t<1) requestAnimationFrame(tick);
    else {
      setTimeout(()=>{
        const splash = document.getElementById('splash');
        if(splash){
          splash.style.transition = 'opacity .35s ease';
          splash.style.opacity = '0';
          setTimeout(next, 350);
        } else next();
      }, 220);
    }
  }
  requestAnimationFrame(tick);
}

/* ---------------- Aviso de salvamento final ao sair ---------------- */
/* V6.19.0 — Ctrl+S: força um salvamento imediato, adaptado ao modo de armazenamento
   atual. No Google Drive, ignora de propósito a checagem de conflito (a pessoa está
   dizendo explicitamente "quero que a minha versão valha"). */
let forceManualSaveInFlight=null;
async function forceManualSave(){
  if(forceManualSaveInFlight) return forceManualSaveInFlight;
  forceManualSaveInFlight=(async()=>{
    try{
      const backupModule = window.Settings || (typeof Settings!=='undefined' ? Settings : null);
      if(backupModule && typeof backupModule.manualBackup==='function'){
        const result=await backupModule.manualBackup({targets:'both',reason:'manual_drive_local',interactive:true});
        if(!result || (!result.driveOk && !result.localOk)) throw new Error('nenhum destino confirmou o backup');
        return result;
      }
      throw new Error('o módulo de backup manual não foi carregado');
    }catch(e){
      toast('Falha ao salvar: '+(e&&e.message?e.message:String(e)));
      return null;
    }finally{
      forceManualSaveInFlight=null;
    }
  })();
  return forceManualSaveInFlight;
}

const ExitSaveGuard = {
  dismissed:false,
  saving:false,
  getEl(){ return document.getElementById('exit-save-banner'); },
  /* V6.16.0 — o banner "Confirme o salvamento" foi removido a pedido: o salvamento já
     é automático e silencioso (ver finalSaveSilently, chamado em beforeunload/
     visibilitychange/pagehide) — não faz sentido também pedir confirmação manual. O
     indicador visual agora é só o selo pequeno no topo do app ("salvando..."). */
  shouldShow(){ return false; },
  refresh(){
    const old = this.getEl();
    if(old) old.remove();
  },
  finalSaveSilently(reason='exit'){
    try{
      // V6.17.0 — bug real corrigido: isso rodava em TODO Alt-Tab (tab ficando
      // oculta), mesmo sem nada pra salvar — forçando uma checagem de token do
      // Google a cada vez, o que podia acabar abrindo/piscando a janela de login do
      // Google. Agora só faz alguma coisa se existir mesmo uma alteração pendente.
      if(!(S && S.currentProfile && S.data && hasExitSavePending(S.currentProfile.id))) return;
      confirmFinalSave(reason);
      if(window.GoogleDriveProvider && GoogleDriveProvider.isConnected()) GoogleDriveProvider.syncNow();
    }catch(e){ console.warn('[BORION_EXIT_SAVE][SILENT_WARN]', e); }
  }
};
window.ExitSaveGuard = ExitSaveGuard;

window.addEventListener('beforeunload', e=>{
  if(!(S && S.currentProfile && S.data && hasExitSavePending(S.currentProfile.id))) return;
  ExitSaveGuard.finalSaveSilently('beforeunload');
  // V6.16.0 — removido o e.preventDefault()/returnValue que mostrava o diálogo nativo
  // "tem certeza que quer sair?" do navegador. O salvamento acima já é automático e
  // silencioso; a confirmação manual não faz mais sentido.
});
window.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState==='visible') ExitSaveGuard.refresh();
  if(document.visibilityState==='hidden') ExitSaveGuard.finalSaveSilently('visibilitychange');
});
window.addEventListener('pagehide', ()=> ExitSaveGuard.finalSaveSilently('pagehide'));

/* V6.20.0 — bug real corrigido: "atualizar a página e voltar (botão Voltar do
   navegador) mostra uma versão antiga, atualizar de novo mostra a certa". Causa: o
   navegador pode restaurar a página inteira a partir do bfcache (back-forward cache)
   ao usar o botão Voltar depois de um F5 — isso NÃO reexecuta o boot() abaixo nem
   `loadFromDrive()`, só devolve o DOM/estado congelado de um instante anterior (que
   podia ser de antes do current.json terminar de sincronizar). Um F5 de verdade
   corrige na hora porque aí sim o boot roda de novo do zero e busca o current.json
   mais recente — daí a impressão de "só corrige na segunda vez". O evento `pageshow`
   com `event.persisted===true` é como o navegador avisa "essa página veio do
   bfcache" — usamos isso pra forçar um reload de verdade e garantir que o app sempre
   mostra o estado mais recente, nunca um congelado. */
window.addEventListener('pageshow', (e)=>{
  if(e.persisted) location.reload();
});

/* ---------------- BOOT ---------------- */
(function boot(){
  const backupFolderInit=BackupFS.init();
  Notifs.closePanelOnOutsideClick();
  BankFilter.closePanelOnOutsideClick();
  document.addEventListener('click', GlobalSearch.outsideClickHandler);
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && window.MobileMenu) MobileMenu.close(); });
  document.addEventListener('keydown', (e)=>{
    if((e.ctrlKey||e.metaKey) && (e.key==='s'||e.key==='S')){
      e.preventDefault();
      forceManualSave();
    }
  });
  window.addEventListener('resize', ()=>{ if(window.innerWidth>980 && window.MobileMenu) MobileMenu.close(); });
  if(window.matchMedia){
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = ()=>{ if(S.config && S.config.theme==='system') applyTheme(); };
    if(mq.addEventListener) mq.addEventListener('change', handler);
    else if(mq.addListener) mq.addListener(handler);
  }
  showSplash(async ()=>{
    await backupFolderInit;
    await CloudStorage.init();
    if(CloudStorage.user && CloudStorage.recoveryMode){
      CloudAuth.mode='changePassword';
      CloudAuth.info='Digite uma nova senha para finalizar a recuperação.';
      CloudAuth.error='';
      CloudAuth.render();
      return;
    }
    if(CloudStorage.user){
      await enterCloudUser();
      ExitSaveGuard.refresh();
      if(CloudStorage.deleteEmailReturnPending && window.Settings && Settings.resumeDeleteAccountFromMagicLink){
        setTimeout(()=>Settings.resumeDeleteAccountFromMagicLink(),120);
      }
      return;
    }
    // V6.4.0 — se a pessoa já conectou o Google Drive antes, tenta renovar o acesso
    // em silêncio (sem popup) e recarregar o current.json da pasta. Se a sessão do
    // Google expirou ou algo falhar, mostra uma tela simples pra reconectar — nunca
    // trava o app numa tela em branco nem mistura com o fluxo Supabase/local.
    if(getStorageMode()==='google_drive'){
      try{
        await GoogleDriveProvider.connect(false);
      }catch(e){
        renderGoogleDriveReconnect(e.message||String(e));
      }
      return;
    }
    // V6.3.0 — se a pessoa já escolheu "usar sem conta" antes, pula a tela de login
    // Supabase e vai direto pro seletor de perfil local. Só ativa depois de uma escolha
    // explícita (ver botão "Usar sem conta" em CloudAuth.render); sem isso, comportamento
    // de sempre (mostrar CloudAuth) continua idêntico.
    if(getStorageMode()==='offline'){
      enterLocalMode();
      return;
    }
    CloudAuth.render();
  });
})();

/* ---- PWA: service worker registration + "add to home screen" helper ---- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try{
      const registration=await navigator.serviceWorker.register('sw.js');
      /* V6.23.8 — app instalado verifica atualização sempre que abre. O botão
         “Salvar e atualizar” também chama registration.update() antes do reload. */
      registration.update().catch(()=>{});
      let lastCheck=Date.now();
      document.addEventListener('visibilitychange',()=>{
        if(document.visibilityState==='visible' && Date.now()-lastCheck>30*60*1000){
          lastCheck=Date.now(); registration.update().catch(()=>{});
        }
      });
    }catch(err){ console.warn('SW falhou:', err); }
  });
}

/* V6.9.0 — "Limpar dados deste navegador": zera qualquer perfil/estado salvo só
   neste dispositivo (perfis locais, conta Google/Supabase lembrada, cache do PWA) sem
   precisar de DevTools. NÃO apaga nada que já esteja salvo na nuvem, no Supabase ou no
   Google Drive — só o que está guardado neste navegador específico. Pensado pra
   resolver telas presas (ex: pasta do Drive excluída, sessão antiga confusa) em
   dispositivos de pessoas menos técnicas. */
async function resetDeviceState(){
  try{
    Object.keys(localStorage).forEach(k=>{
      if(k.startsWith('mc_') || k.startsWith('borion_')) localStorage.removeItem(k);
    });
  }catch(e){ console.warn('[resetDeviceState] falha ao limpar localStorage:', e); }
  try{
    if(window.indexedDB && indexedDB.databases){
      const dbs = await indexedDB.databases();
      await Promise.all(dbs.map(db=> db.name ? new Promise(res=>{ const req=indexedDB.deleteDatabase(db.name); req.onsuccess=res; req.onerror=res; req.onblocked=res; }) : Promise.resolve()));
    } else {
      ['borion_findata_v1','borion_local_backups_v1','borion_handles'].forEach(name=>{
        try{ indexedDB.deleteDatabase(name); }catch(e){}
      });
    }
  }catch(e){ console.warn('[resetDeviceState] falha ao limpar IndexedDB:', e); }
  try{
    if('serviceWorker' in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      for(const r of regs){ await r.unregister(); }
    }
    if(window.caches){
      const keys = await caches.keys();
      for(const k of keys){ await caches.delete(k); }
    }
  }catch(e){ console.warn('[resetDeviceState] falha ao limpar cache do PWA:', e); }
  location.reload();
}

function confirmResetDeviceState(){
  openConfirmModal({
    title: 'Limpar dados deste navegador',
    text: 'Isso apaga perfis e configurações salvos SÓ NESTE NAVEGADOR, e desconecta qualquer conta Google/Supabase lembrada aqui. Não afeta nada que já esteja salvo na nuvem, no Supabase ou no Google Drive — só o que está neste dispositivo.',
    confirmLabel: 'Limpar e recarregar',
    cancelLabel: 'Cancelar',
    variant: 'danger',
    onConfirm: resetDeviceState
  });
}

/* ---------- V5.34.1: banner de instalação por plataforma (Android/desktop/iPhone) ---------- */
const PWA_INSTALL_DISMISS_KEY = 'borion_install_banner_dismissed_v1';
function isStandalonePWA(){
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
}
function isIOSDevice(){ return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream; }
function isAndroidDevice(){ return /android/i.test(navigator.userAgent); }
function installBannerDismissed(){ return localStorage.getItem(PWA_INSTALL_DISMISS_KEY)==='1'; }
function dismissInstallBanner(){ localStorage.setItem(PWA_INSTALL_DISMISS_KEY,'1'); }

let deferredInstallPrompt = null;

function showAndroidInstallBanner(){
  if(isStandalonePWA() || installBannerDismissed()) return;
  if (document.getElementById('install-banner')) return;
  const label = isAndroidDevice() ? 'no seu celular Android' : 'neste computador';
  const b = document.createElement('div');
  b.id = 'install-banner';
  b.innerHTML = `Instalar o Borion Finance ${label}? <button class="ib-yes">Instalar</button> <button class="ib-no">&times;</button>`;
  document.body.appendChild(b);
  b.querySelector('.ib-yes').onclick = async () => {
    b.remove();
    if (deferredInstallPrompt) { deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; }
  };
  b.querySelector('.ib-no').onclick = () => { b.remove(); dismissInstallBanner(); };
}
function showIOSInstallBanner(){
  if(isStandalonePWA() || installBannerDismissed()) return;
  if (document.getElementById('install-banner')) return;
  const b = document.createElement('div');
  b.id = 'install-banner';
  b.className = 'install-banner-ios';
  b.innerHTML = 'Adicione o Borion à Tela de Início: toque em <b>Compartilhar</b> <span class="ios-share-ic">⬆</span> e depois em <b>“Adicionar à Tela de Início”</b>. <button class="ib-no">&times;</button>';
  document.body.appendChild(b);
  b.querySelector('.ib-no').onclick = () => { b.remove(); dismissInstallBanner(); };
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showAndroidInstallBanner();
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  const b = document.getElementById('install-banner'); if (b) b.remove();
  dismissInstallBanner();
});
(function initIOSInstallBanner(){
  // iOS Safari nunca dispara beforeinstallprompt; a instrução manual aparece sozinha.
  if(isIOSDevice()) setTimeout(showIOSInstallBanner, 1800);
})();

/* ---------- V5.34.8: importação JSON ciente de nuvem/perfil ativo ---------- */
/* V6.6.0 — os fluxos de importação abaixo (novo perfil, substituir tudo, mesclar
   tudo) escrevem direto em setProfiles()/setProfileData(), sem passar por
   saveCurrentData() — que é onde normalmente o Google Drive é avisado pra sincronizar.
   Sem isso, um perfil importado só chegaria ao Drive na próxima vez que algo mais
   disparasse um save. Chamado no fim de cada fluxo de importação/mesclagem local. */
function notifyGoogleDriveAfterImport(){
  if(window.GoogleDriveProvider && GoogleDriveProvider.isConnected()){ GoogleDriveProvider.queueSave(); }
}

function handleImport(obj){
  const isCloud = !!(window.CloudStorage && CloudStorage.user);
  if(isCloud){
    if(!S.currentProfile){ alert('Entre em um perfil antes de importar.'); return; }
    if((obj.type==='borion-account-backup' || obj.type==='multicap-full-backup') && obj.profiles && obj.dataByProfile){
      openAccountImportReview(obj,{cloud:true});
      return;
    }
    let incomingData = null;
    let incomingProfile = obj.profile || {};
    if(obj.type==='borion-profile-backup' || obj.type==='multicap-profile-backup'){
      incomingData = obj.data || emptyData();
    } else if(obj.type==='multicap-full-backup' || obj.type==='borion-account-backup'){
      const keys = Object.keys(obj.dataByProfile||{});
      if(keys.length){
        const firstId = keys[0];
        incomingData = obj.dataByProfile[firstId] || emptyData();
        incomingProfile = (obj.profiles||[]).find(p=>p.id===firstId) || incomingProfile || {};
      }
    }
    if(!incomingData){ alert('Formato de backup não reconhecido.'); return; }
    incomingData = migrateData(incomingData);
    const activeName = S.currentProfile.name;
    const importedName = (incomingProfile && incomingProfile.name) ? incomingProfile.name : 'Perfil importado';
    const importAsNew = async ()=>{
      try{
        if((S.profiles||[]).length>=5) throw new Error('Máximo de 5 perfis atingido. Exclua um perfil antes de importar como novo.');
        const options={
          avatarColor: incomingProfile.avatarColor || incomingProfile.avatar_color || avatarColor(importedName),
          avatarImage: incomingProfile.avatarImage || incomingProfile.avatar_image || ''
        };
        await CloudStorage.createProfile(importedName, true, incomingData, options);
        closeModal();
        renderApp();
        toast('Perfil JSON importado como novo perfil e confirmado no Supabase.');
      }catch(e){ alert(e.message||String(e)); }
    };
    const replaceActive = async ()=>{
      try{
        if(window.BackupFS) await BackupFS.createCloudBackup('before_import_replace','backup automático antes de substituir perfil por JSON',{silent:true});
        S.data=migrateData(incomingData);
        setProfileData(S.currentProfile.id,S.data);
        saveCurrentData();
        const ok=await CloudStorage.syncNow();
        if(!ok) throw new Error(CloudStorage.pendingReason||'Supabase não confirmou a importação agora.');
        closeModal(); renderView(); toast('Perfil atual substituído pelo JSON e sincronizado.');
      }catch(e){ alert(e.message||String(e)); }
    };
    const mergeActive = async ()=>{
      try{
        if(window.BackupFS) await BackupFS.createCloudBackup('before_import_merge','backup automático antes de mesclar JSON no perfil',{silent:true});
        S.data=cloudMergeData(S.data,incomingData);
        setProfileData(S.currentProfile.id,S.data);
        saveCurrentData();
        const ok=await CloudStorage.syncNow();
        if(!ok) throw new Error(CloudStorage.pendingReason||'Supabase não confirmou a importação agora.');
        closeModal(); renderView(); toast('JSON mesclado ao perfil atual e sincronizado.');
      }catch(e){ alert(e.message||String(e)); }
    };
    openChoiceModal({
      title:'Importar arquivo JSON',
      sub:'Arquivo: '+importedName+'. Perfil ativo: '+activeName+'. Escolha se cria um perfil novo ou usa o perfil atual.',
      choices:[
        {label:'Importar como novo perfil', desc:'Cria um perfil separado na sua conta e carrega os dados do JSON nele.', onClick:importAsNew},
        {label:'Substituir perfil atual', desc:'Apaga os dados atuais deste perfil e coloca os dados do arquivo.', variant:'danger', onClick:replaceActive},
        {label:'Mesclar com perfil atual', desc:'Mantém os dados atuais e adiciona o que veio do backup quando possível.', onClick:mergeActive},
        {label:'Cancelar', onClick:closeModal}
      ]
    });
    return;
  }
  if(obj.type==='multicap-profile-backup' || obj.type==='borion-profile-backup'){
    const incoming = obj.profile || {id:uid(),name:'Perfil importado'};
    const incomingData = migrateData(obj.data || emptyData());
    const existingIdx = S.profiles.findIndex(p=>p.id===incoming.id);
    const doImportAsNew = ()=>{
      if(S.profiles.length>=5){ alert('Máximo de 5 perfis atingido.'); closeModal(); return; }
      const newId=uid(); S.profiles.push({...incoming,id:newId,name:(incoming.name||'Perfil')+' (importado)'}); setProfiles(S.profiles); setProfileData(newId,incomingData); notifyGoogleDriveAfterImport(); closeModal(); toast('Perfil importado.'); if(S.currentProfile) renderView(); else renderGate();
    };
    if(existingIdx>-1){
      openChoiceModal({title:'Este perfil já existe', sub:'Já existe um perfil "'+S.profiles[existingIdx].name+'" neste app.', choices:[
        {label:'Substituir dados deste perfil', variant:'danger', onClick:()=>{ S.profiles[existingIdx]={...S.profiles[existingIdx],...incoming}; setProfiles(S.profiles); setProfileData(incoming.id,incomingData); if(S.currentProfile&&S.currentProfile.id===incoming.id) S.data=incomingData; notifyGoogleDriveAfterImport(); closeModal(); renderView(); toast('Perfil substituído.'); }},
        {label:'Importar como novo perfil', onClick:doImportAsNew},
        {label:'Cancelar', onClick:closeModal}
      ]});
    }else doImportAsNew();
  } else if(obj.type==='multicap-full-backup' || obj.type==='borion-account-backup'){
    openAccountImportReview(obj,{cloud:false});
  } else alert('Formato de backup não reconhecido.');
}
