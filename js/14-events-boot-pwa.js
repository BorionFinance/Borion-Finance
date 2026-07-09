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

/* ---------------- BOOT ---------------- */
(function boot(){
  BackupFS.init();
  Notifs.closePanelOnOutsideClick();
  BankFilter.closePanelOnOutsideClick();
  document.addEventListener('click', GlobalSearch.outsideClickHandler);
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && window.MobileMenu) MobileMenu.close(); });
  window.addEventListener('resize', ()=>{ if(window.innerWidth>980 && window.MobileMenu) MobileMenu.close(); });
  if(window.matchMedia){
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = ()=>{ if(S.config && S.config.theme==='system') applyTheme(); };
    if(mq.addEventListener) mq.addEventListener('change', handler);
    else if(mq.addListener) mq.addListener(handler);
  }
  showSplash(async ()=>{
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
      return;
    }
    CloudAuth.render();
  });
})();

/* ---- PWA: service worker registration + "add to home screen" helper ---- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW falhou:', err));
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
function handleImport(obj){
  const isCloud = !!(window.CloudStorage && CloudStorage.user);
  if(isCloud){
    if(!S.currentProfile){ alert('Entre em um perfil antes de importar.'); return; }
    if((obj.type==='borion-account-backup' || obj.type==='multicap-full-backup') && obj.profiles && obj.dataByProfile){
      const count=(obj.profiles||[]).length;
      const firstId=Object.keys(obj.dataByProfile||{})[0];
      const firstProfile=(obj.profiles||[]).find(p=>p.id===firstId) || (obj.profiles||[])[0] || {name:'Perfil importado'};
      const firstData=migrateData((obj.dataByProfile||{})[firstProfile.id||firstId] || emptyData());
      const importFirstAsNew = async ()=>{
        try{
          if((S.profiles||[]).length>=5) throw new Error('Máximo de 5 perfis atingido. Exclua um perfil antes de importar como novo.');
          await CloudStorage.createProfile((firstProfile.name||'Perfil importado')+' (backup)', true, firstData, {avatarColor:firstProfile.avatarColor||firstProfile.avatar_color||avatarColor(firstProfile.name||'Perfil'), avatarImage:firstProfile.avatarImage||firstProfile.avatar_image||''});
          closeModal(); renderApp(); toast('Primeiro perfil do backup importado como novo perfil.');
        }catch(e){ alert(e.message||String(e)); }
      };
      openChoiceModal({
        title:'Backup completo detectado',
        sub:'Este JSON contém '+count+' perfil(is). Você pode restaurar a conta inteira ou importar só o primeiro perfil como novo.',
        choices:[
          {label:'Restaurar conta inteira', desc:'Substitui todos os perfis desta conta pelo backup. Antes disso, o Borion cria um backup de segurança.', variant:'danger', onClick:()=>BackupFS.restoreAccountPayloadFromFile(obj)},
          {label:'Importar primeiro perfil como novo', desc:'Não mexe nos outros perfis. Cria um perfil separado com os dados do primeiro perfil do JSON.', onClick:importFirstAsNew},
          {label:'Cancelar', onClick:closeModal}
        ]
      });
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
      const newId=uid(); S.profiles.push({...incoming,id:newId,name:(incoming.name||'Perfil')+' (importado)'}); setProfiles(S.profiles); setProfileData(newId,incomingData); closeModal(); toast('Perfil importado.'); if(S.currentProfile) renderView(); else renderGate();
    };
    if(existingIdx>-1){
      openChoiceModal({title:'Este perfil já existe', sub:'Já existe um perfil "'+S.profiles[existingIdx].name+'" neste app.', choices:[
        {label:'Substituir dados deste perfil', variant:'danger', onClick:()=>{ S.profiles[existingIdx]={...S.profiles[existingIdx],...incoming}; setProfiles(S.profiles); setProfileData(incoming.id,incomingData); if(S.currentProfile&&S.currentProfile.id===incoming.id) S.data=incomingData; closeModal(); renderView(); toast('Perfil substituído.'); }},
        {label:'Importar como novo perfil', onClick:doImportAsNew},
        {label:'Cancelar', onClick:closeModal}
      ]});
    }else doImportAsNew();
  } else if(obj.type==='multicap-full-backup' || obj.type==='borion-account-backup'){
    // Backup completo (vários perfis) sem estar logado na nuvem: exige confirmação
    // explícita, nunca substitui nada sozinho. "Substituir tudo" só troca os perfis
    // locais deste navegador — a conta/login da nuvem, quando existir, não é afetada.
    const doReplaceAll = ()=>{
      S.config = obj.config || S.config;
      S.profiles = (obj.profiles||[]).slice(0,5);
      setConfig(S.config); setProfiles(S.profiles);
      Object.keys(obj.dataByProfile||{}).forEach(pid=>{
        const d = migrateData(obj.dataByProfile[pid] || emptyData());
        setProfileData(pid, d);
      });
      S.currentProfile=null; S.data=null;
      closeModal();
      toast('Backup completo restaurado (perfis locais substituídos).');
      renderGate();
    };
    const doMergeAll = ()=>{
      const incomingProfiles = obj.profiles || [];
      let added = 0, skipped = 0;
      incomingProfiles.forEach(ip=>{
        if(S.profiles.length>=5){ skipped++; return; }
        if(S.profiles.some(p=>p.id===ip.id)){ skipped++; return; }
        S.profiles.push(ip);
        const d = migrateData((obj.dataByProfile||{})[ip.id] || emptyData());
        setProfileData(ip.id, d);
        added++;
      });
      setProfiles(S.profiles);
      closeModal();
      toast(`Mesclado: ${added} perfil(is) adicionado(s)${skipped?', '+skipped+' ignorado(s) (já existiam ou limite de 5 atingido)':''}.`);
      if(S.currentProfile) renderView(); else renderGate();
    };
    openChoiceModal({
      title:'Restaurar backup completo',
      sub:'Este arquivo contém '+((obj.profiles||[]).length)+' perfil(is). O que você quer fazer?',
      choices:[
        {label:'Substituir tudo', desc:'Apaga os perfis e dados locais atuais deste navegador e coloca no lugar o conteúdo do backup.', variant:'danger', onClick:doReplaceAll},
        {label:'Mesclar perfis', desc:'Mantém os perfis atuais e adiciona os do backup que ainda não existem aqui (até o limite de 5).', onClick:doMergeAll},
        {label:'Cancelar', onClick:closeModal},
      ]
    });
  } else alert('Formato de backup não reconhecido.');
}
