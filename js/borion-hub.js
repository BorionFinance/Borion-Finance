(function(){
  'use strict';
  const APP = "borion";
  const HUB_URL = "https://hub.borionfinance.com.br/";
  const LOGIN_SELECTOR = ".gate-wrap";
  const LOGO_SELECTOR = ".sb-logo";
  const HOUSE = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M5 12l-2 0l9 -9l9 9l-2 0\"/><path d=\"M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7\"/><path d=\"M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6\"/></svg>";

  document.documentElement.dataset.borionApp = APP;

  function makeLoginLink(){
    const a=document.createElement('a');
    a.className='borion-hub-entry borion-hub-entry--login';
    a.href=HUB_URL;
    a.target='_self';
    a.setAttribute('aria-label','Abrir Hub Borion');
    a.title='Abrir Hub Borion';
    a.innerHTML=HOUSE+'<span>Hub Borion</span>';
    return a;
  }

  /* v7.7.11 — só o ícone da casinha, sem rótulo, pra ficar junto do logo no topo
     da barra lateral em vez do rodapé (onde ficava antes, junto do perfil). */
  function makeLogoLink(){
    const a=document.createElement('a');
    a.className='borion-hub-entry borion-hub-logo-link';
    a.href=HUB_URL;
    a.target='_self';
    a.setAttribute('aria-label','Abrir Hub Borion');
    a.title='Abrir Hub Borion';
    a.innerHTML=HOUSE;
    return a;
  }

  function inject(){
    const login=document.querySelector(LOGIN_SELECTOR);
    if(login && !document.querySelector('.borion-hub-entry--login')) login.appendChild(makeLoginLink());

    const logo=document.querySelector(LOGO_SELECTOR);
    if(logo && !logo.querySelector('.borion-hub-logo-link')){
      const link=makeLogoLink();
      const closeBtn=logo.querySelector('.mobile-menu-close');
      if(closeBtn) logo.insertBefore(link,closeBtn);
      else logo.appendChild(link);
    }
  }

  let queued=false;
  const schedule=()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;inject();});
  };
  const root=document.getElementById('root');
  if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
  else schedule();
})();
