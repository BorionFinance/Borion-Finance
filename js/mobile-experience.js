'use strict';

/* Marco Iris Tecnologia v1.7.1 — experiência mobile alinhada ao Borion Finance. */
(() => {
  const MobileMarco = {
    initialized:false,
    navPatched:false,
    originalNavigate:null,
    viewStack:[],
    scrollByView:new Map(),
    modalObserver:null,
    rootObserver:null,
    guardArmed:false,
    allowExit:false,
    networkTimer:0,
    lastHaptic:0,
    swipe:null,

    isMobile(){return window.matchMedia('(max-width:900px), (pointer:coarse)').matches;},
    currentView(){try{return CURRENT_VIEW||'dashboard';}catch(_){return 'dashboard';}},
    scroller(){return document.querySelector('.main')||document.scrollingElement;},
    scrollTop(){const el=this.scroller();return el===document.scrollingElement?(window.scrollY||0):(el?.scrollTop||0);},
    setScroll(top){const el=this.scroller();requestAnimationFrame(()=>requestAnimationFrame(()=>{if(el===document.scrollingElement)window.scrollTo({top,behavior:'instant'});else el?.scrollTo({top,behavior:'instant'});}));},
    haptic(pattern=7){if(!this.isMobile()||!navigator.vibrate)return;const now=Date.now();if(now-this.lastHaptic<35)return;this.lastHaptic=now;try{navigator.vibrate(pattern);}catch(_){ }},

    setViewport(){
      const vv=window.visualViewport;
      const height=vv?.height||window.innerHeight;
      const offset=vv?.offsetTop||0;
      const keyboard=Math.max(0,window.innerHeight-height-offset);
      document.documentElement.style.setProperty('--marco-app-vh',`${height}px`);
      document.documentElement.style.setProperty('--marco-keyboard',`${keyboard}px`);
      document.documentElement.classList.toggle('marco-mobile-ui',this.isMobile());
      document.body.classList.toggle('keyboard-open',keyboard>120);
    },

    showNetwork(online=navigator.onLine){
      if(!this.isMobile())return;
      let banner=document.getElementById('marco-network-banner');
      if(!banner){banner=document.createElement('div');banner.id='marco-network-banner';banner.className='marco-network-banner';banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');document.body.appendChild(banner);}
      clearTimeout(this.networkTimer);
      banner.className=`marco-network-banner ${online?'is-online':'is-offline'} is-visible`;
      banner.innerHTML=online
        ? '<span class="network-dot"></span><strong>Conexão restaurada</strong><small>A sincronização continuará normalmente.</small>'
        : '<span class="network-dot"></span><strong>Você está offline</strong><small>O sistema continua disponível neste aparelho.</small>';
      if(online)this.networkTimer=setTimeout(()=>banner.classList.remove('is-visible'),2600);
    },

    ensureBottomNav(){
      if(!this.isMobile()||document.body.classList.contains('login-page')||!document.querySelector('.app-bg'))return;
      let nav=document.querySelector('.mobile-bottom-nav');
      if(!nav){
        nav=document.createElement('nav');
        nav.className='mobile-bottom-nav';
        nav.setAttribute('aria-label','Navegação principal mobile');
        const items=[['dashboard','dashboard','Início'],['orders','orders','OS'],['agenda','agenda','Agenda'],['clients','clients','Clientes']];
        nav.innerHTML=items.map(([view,ico,label])=>`<button type="button" data-action="navigate" data-view="${view}" aria-label="${label}">${icon(ico,22)}<span>${label}</span></button>`).join('')+
          `<button type="button" data-action="toggle-menu" aria-label="Mais opções">${icon('menu',22)}<span>Mais</span></button>`;
        document.querySelector('.app-bg')?.appendChild(nav);
      }
      nav.querySelectorAll('[data-view]').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===this.currentView()));
    },

    patchNavigation(){
      if(this.navPatched||typeof window.navigateTo!=='function')return;
      this.navPatched=true;this.originalNavigate=window.navigateTo;
      const self=this;
      window.navigateTo=function(view){
        const from=self.currentView();
        if(self.isMobile()&&view&&view!==from&&!self._backNavigation){
          self.scrollByView.set(from,self.scrollTop());
          self.viewStack.push(from);if(self.viewStack.length>30)self.viewStack.shift();
          self.haptic(6);
        }
        const result=self.originalNavigate.call(this,view);
        setTimeout(()=>self.ensureBottomNav(),40);
        return result;
      };
    },

    armBackGuard(url=location.href){
      if(!this.isMobile()||this.allowExit)return;
      history.pushState({...(history.state||{}),__marcoMobileGuard:true},'',url);
      this.guardArmed=true;
    },
    setupBackGuard(){
      if(!this.isMobile()||this.guardArmed)return;
      history.replaceState({...(history.state||{}),__marcoMobileBase:true},'',location.href);
      this.armBackGuard();
      window.addEventListener('popstate',()=>{
        if(this.allowExit||!this.isMobile())return;
        if(this.closeTopLayer()){this.armBackGuard();return;}
        const previous=this.viewStack.pop();
        if(previous&&this.originalNavigate){
          this.armBackGuard();
          this._backNavigation=true;
          this.originalNavigate(previous);
          this._backNavigation=false;
          const top=this.scrollByView.get(previous)||0;
          setTimeout(()=>this.setScroll(top),250);
          this.ensureBottomNav();this.haptic(7);return;
        }
        const leave=window.confirm('Deseja sair do Marco Iris Tecnologia?');
        if(leave){this.allowExit=true;history.back();return;}
        this.armBackGuard();
      });
    },

    closeTopLayer(){
      if(document.querySelector('#modal-root .modal-backdrop')){try{closeModal();}catch(_){document.getElementById('modal-root').replaceChildren();}return true;}
      if(document.body.classList.contains('menu-open')){document.body.classList.remove('menu-open');return true;}
      return false;
    },

    decorateModal(backdrop){
      if(!this.isMobile()||!backdrop||backdrop.dataset.marcoMobileSheet==='1')return;
      const modal=backdrop.querySelector('.modal');if(!modal)return;
      backdrop.dataset.marcoMobileSheet='1';backdrop.classList.add('mobile-sheet-backdrop');modal.classList.add('mobile-bottom-sheet');
      const handle=document.createElement('button');handle.type='button';handle.className='mobile-sheet-handle';handle.setAttribute('aria-label','Arraste para baixo para fechar');handle.innerHTML='<span></span>';modal.insertBefore(handle,modal.firstChild);
      const appRoot=document.getElementById('root');if(appRoot)appRoot.inert=true;
      const markDirty=e=>{if(e.target.matches('input,select,textarea'))modal.dataset.sheetDirty='1';};
      modal.addEventListener('input',markDirty,{passive:true});modal.addEventListener('change',markDirty,{passive:true});
      backdrop.addEventListener('click',e=>{if(e.target===backdrop&&modal.dataset.sheetDirty!=='1'){try{closeModal();}catch(_){ }}});

      let pointerId=null,startY=0,lastY=0,lastAt=0;
      const reset=()=>{modal.classList.remove('is-sheet-dragging');modal.style.removeProperty('--sheet-y');backdrop.style.removeProperty('--sheet-overlay-opacity');pointerId=null;};
      handle.addEventListener('pointerdown',e=>{if(e.button!=null&&e.button!==0)return;pointerId=e.pointerId;startY=lastY=e.clientY;lastAt=performance.now();modal.classList.add('is-sheet-dragging');try{handle.setPointerCapture(pointerId);}catch(_){ }},{passive:true});
      handle.addEventListener('pointermove',e=>{if(e.pointerId!==pointerId)return;const dy=Math.max(0,e.clientY-startY);if(!dy)return;e.preventDefault();const resisted=dy/(1+dy/680);modal.style.setProperty('--sheet-y',`${resisted}px`);backdrop.style.setProperty('--sheet-overlay-opacity',String(Math.max(.25,.78-resisted/650)));lastY=e.clientY;lastAt=performance.now();},{passive:false});
      const finish=e=>{
        if(e.pointerId!==pointerId)return;
        const dy=Math.max(0,e.clientY-startY),velocity=(e.clientY-lastY)/Math.max(1,performance.now()-lastAt),dirty=modal.dataset.sheetDirty==='1';
        const close=dy>(dirty?170:92)||(velocity>.78&&dy>(dirty?100:44));
        try{handle.releasePointerCapture(pointerId);}catch(_){ }
        if(close){this.haptic(9);modal.classList.add('is-sheet-closing');modal.style.setProperty('--sheet-y','110%');backdrop.style.setProperty('--sheet-overlay-opacity','0');setTimeout(()=>{try{closeModal();}catch(_){ }},170);}
        else{if(dirty&&dy>90){this.haptic([7,25,7]);try{toast('Há alterações não salvas. Puxe mais para fechar.','warn');}catch(_){ }}reset();}
      };
      handle.addEventListener('pointerup',finish,{passive:true});handle.addEventListener('pointercancel',reset,{passive:true});
    },

    observeModals(){
      const root=document.getElementById('modal-root');if(!root||this.modalObserver)return;
      this.modalObserver=new MutationObserver(()=>{const backdrop=root.querySelector('.modal-backdrop');if(backdrop)this.decorateModal(backdrop);else{const appRoot=document.getElementById('root');if(appRoot)appRoot.inert=false;}});
      this.modalObserver.observe(root,{childList:true,subtree:true});
      const existing=root.querySelector('.modal-backdrop');if(existing)this.decorateModal(existing);
    },

    observeRoot(){
      const root=document.getElementById('root');if(!root||this.rootObserver)return;
      this.rootObserver=new MutationObserver(()=>{
        if(document.body.classList.contains('login-page'))this.viewStack.length=0;
        this.setViewport();this.patchNavigation();this.ensureBottomNav();
      });
      this.rootObserver.observe(root,{childList:true,subtree:true});
    },

    installTouchFeedback(){
      document.addEventListener('pointerdown',e=>{if(!this.isMobile())return;const el=e.target.closest('button,.btn,.nav-btn,.list-row,.calendar-day,.card');if(el)el.classList.add('is-touching');},{passive:true});
      const clear=e=>{const el=e.target?.closest?.('.is-touching');if(el)setTimeout(()=>el.classList.remove('is-touching'),75);};
      document.addEventListener('pointerup',clear,{passive:true});document.addEventListener('pointercancel',clear,{passive:true});
      document.addEventListener('click',e=>{if(this.isMobile()&&e.target.closest('button,.btn,[data-action]')){this.haptic(5);setTimeout(()=>this.ensureBottomNav(),30);}},{passive:true});
    },

    installSwipeNavigation(){
      const views=['dashboard','orders','agenda','clients'];
      document.addEventListener('pointerdown',e=>{
        if(!this.isMobile()||!e.isPrimary||e.button!==0)return;
        if(!e.target.closest('#view-root')||e.target.closest('input,select,textarea,button,a,[contenteditable],.table-wrap,.modal'))return;
        this.swipe={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now()};
      },{passive:true});
      document.addEventListener('pointerup',e=>{
        const s=this.swipe;this.swipe=null;if(!s||s.id!==e.pointerId)return;
        const dx=e.clientX-s.x,dy=e.clientY-s.y,elapsed=performance.now()-s.time;
        if(elapsed>620||Math.abs(dx)<78||Math.abs(dx)<Math.abs(dy)*1.35)return;
        const index=views.indexOf(this.currentView());if(index<0)return;
        const next=dx<0?views[index+1]:views[index-1];if(next&&typeof window.navigateTo==='function'){window.navigateTo(next);this.haptic(8);}
      },{passive:true});
    },

    installFocusTrap(){
      document.addEventListener('keydown',e=>{
        if(e.key!=='Tab')return;const modal=document.querySelector('#modal-root .modal');if(!modal)return;
        const focusable=[...modal.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(el=>el.offsetParent!==null);
        if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      });
    },

    init(){
      if(this.initialized)return;this.initialized=true;
      this.setViewport();this.patchNavigation();this.setupBackGuard();this.observeModals();this.observeRoot();this.ensureBottomNav();this.installTouchFeedback();this.installSwipeNavigation();this.installFocusTrap();
      window.addEventListener('resize',()=>this.setViewport(),{passive:true});
      window.visualViewport?.addEventListener('resize',()=>this.setViewport(),{passive:true});
      window.visualViewport?.addEventListener('scroll',()=>this.setViewport(),{passive:true});
      window.addEventListener('online',()=>this.showNetwork(true));window.addEventListener('offline',()=>this.showNetwork(false));
      document.addEventListener('visibilitychange',()=>{if(!document.hidden){this.setViewport();this.ensureBottomNav();}});
    }
  };

  window.MobileMarco=MobileMarco;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>MobileMarco.init(),{once:true});else MobileMarco.init();
})();
