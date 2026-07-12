/* Borion Finance V6.23.7 — Histórico do botão Voltar no Smartphone Mode
   Camadas controladas:
   1) fecha modal/painel/menu aberto;
   2) volta para a Visão geral;
   3) pede confirmação antes de sair do site.

   A implementação usa uma única entrada sentinela no History API. Isso evita criar
   dezenas de itens no histórico a cada renderização ou troca de aba. */

const SmartphoneHistory = {
  active:false,
  handling:false,
  exitPromptOpen:false,
  BASE:'borion-smartphone-base-v1',
  GUARD:'borion-smartphone-guard-v1',

  isAvailable(){
    return !!(window.history && history.pushState && history.replaceState);
  },

  currentKind(){
    return history.state && history.state.__borionSmartHistory;
  },

  activate(){
    if(!this.isAvailable() || !isSmartphoneMode()) return;
    if(!this.active){
      this.active=true;
      window.addEventListener('popstate', this.onPopState.bind(this));
    }
    this.ensureStack();
  },

  ensureStack(){
    if(!this.isAvailable() || !isSmartphoneMode()) return;
    const kind=this.currentKind();
    if(kind===this.GUARD) return;
    if(kind===this.BASE){
      history.pushState({__borionSmartHistory:this.GUARD},'',location.href);
      return;
    }
    history.replaceState(Object.assign({},history.state||{}, {__borionSmartHistory:this.BASE}),'',location.href);
    history.pushState({__borionSmartHistory:this.GUARD},'',location.href);
  },

  restoreGuard(){
    if(!this.isAvailable()) return;
    if(this.currentKind()!==this.GUARD){
      history.pushState({__borionSmartHistory:this.GUARD},'',location.href);
    }
  },

  hasOpenModal(){
    const root=document.getElementById('modal-root');
    return !!(root && root.children && root.children.length);
  },

  closeTopLayer(){
    const root=document.getElementById('modal-root');
    if(root && root.children.length){
      root.innerHTML='';
      this.exitPromptOpen=false;
      return true;
    }

    const sidebar=document.querySelector('.sidebar');
    if(sidebar && sidebar.classList.contains('open')){
      if(window.MobileMenu) MobileMenu.close();
      return true;
    }

    if(typeof Notifs!=='undefined' && Notifs.panelOpen){
      Notifs.panelOpen=false;
      Notifs.renderPanel();
      return true;
    }

    if(typeof BankFilter!=='undefined' && BankFilter.panelOpen){
      BankFilter.panelOpen=false;
      BankFilter.renderPanel();
      return true;
    }

    const search=document.getElementById('global_search_results');
    if(search && !search.classList.contains('hidden')){
      search.classList.add('hidden');
      search.innerHTML='';
      return true;
    }

    return false;
  },

  goHome(){
    if(!(typeof S!=='undefined' && S.currentProfile && S.data)) return false;
    if(S.view==='overview') return false;
    S.view='overview';
    if(window.MobileMenu) MobileMenu.close();
    this.restoreGuard();
    renderApp();
    return true;
  },

  showExitPrompt(){
    if(this.exitPromptOpen) return;
    this.exitPromptOpen=true;
    const root=document.getElementById('modal-root');
    if(!root){
      this.exitPromptOpen=false;
      if(window.confirm('Deseja sair da página?')) this.confirmExit();
      return;
    }

    const exitIcon=(typeof navIconSVG==='function') ? navIconSVG('overview') : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="5" height="14" rx="1.15"/><rect x="14" y="5" width="5" height="14" rx="1.15"/></svg>';
    const box=el(`<div class="modal-overlay smartphone-exit-overlay">
      <div class="modal-box smartphone-exit-modal" role="dialog" aria-modal="true" aria-labelledby="smart_exit_title">
        <div class="smartphone-exit-icon" aria-hidden="true">${exitIcon}</div>
        <h2 id="smart_exit_title">Deseja sair da página?</h2>
        <p class="modal-sub">Você está no Início do Borion. Ao sair, o navegador voltará para a página anterior.</p>
        <div class="row-btns smartphone-exit-actions">
          <button type="button" class="btn btn-secondary" id="smart_exit_stay">Continuar no Borion</button>
          <button type="button" class="btn btn-danger" id="smart_exit_confirm">Sim, sair</button>
        </div>
      </div>
    </div>`);
    root.innerHTML='';
    root.appendChild(box);
    attachModalGuard(box);

    const stay=document.getElementById('smart_exit_stay');
    const leave=document.getElementById('smart_exit_confirm');
    if(stay) stay.onclick=()=>{
      this.exitPromptOpen=false;
      root.innerHTML='';
    };
    if(leave) leave.onclick=()=>this.confirmExit();
  },

  confirmExit(){
    this.exitPromptOpen=false;
    const root=document.getElementById('modal-root');
    if(root) root.innerHTML='';
    window.__borionConfirmedExit=true;
    try{
      if(window.ExitSaveGuard) ExitSaveGuard.finalSaveSilently('confirmed_mobile_exit');
      if(window.CloudStorage && CloudStorage.user && CloudStorage.hasPendingSync && CloudStorage.hasPendingSync()) CloudStorage.syncNow();
    }catch(e){ console.warn('[BORION_SMART_HISTORY][EXIT_SAVE_WARN]',e); }

    /* Estamos na entrada GUARD. Voltar duas posições atravessa a BASE do Borion e
       chega à página que abriu o app (por exemplo, a busca do Google). Em PWA/aba
       sem página anterior, o navegador apenas fecha ou permanece na tela atual. */
    setTimeout(()=>history.go(-2),30);
  },

  onPopState(){
    if(this.handling || window.__borionConfirmedExit) return;
    if(!isSmartphoneMode()) return;
    this.handling=true;
    try{
      /* Um modal, menu ou painel sempre tem prioridade. O estado visual continua na
         mesma aba do Borion e a sentinela é recolocada no histórico. */
      if(this.closeTopLayer()){
        this.restoreGuard();
        return;
      }

      /* Sem camada aberta, o primeiro Voltar a partir de qualquer módulo retorna à
         Visão geral. Abas internas de Lançamentos também entram nessa regra porque
         pertencem à view "budget". */
      if(this.goHome()) return;

      /* Já estamos no Início. Recoloca a sentinela antes de abrir o aviso para que a
         página não seja abandonada enquanto a pessoa decide. */
      this.restoreGuard();
      this.showExitPrompt();
    }finally{
      this.handling=false;
    }
  }
};
window.SmartphoneHistory=SmartphoneHistory;
