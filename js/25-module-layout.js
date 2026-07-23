/* Borion Finance — editor reutilizável de módulos.
   Permite arrastar, redimensionar, ocultar/exibir e salvar layouts por perfil.
   A Visão Geral mantém layouts independentes para desktop e smartphone. */
(() => {
  'use strict';

  const SCOPES={
    overview_dashboard:{label:'Layout da Visão Geral',columns:4,minColumns:2,maxColumns:6,responsive:true},
    overview_modules:{label:'Módulos da Visão Geral',columns:4,minColumns:2,maxColumns:6},
    patrimony_modules:{label:'Módulos do Patrimônio',columns:4,minColumns:2,maxColumns:6}
  };

  const ModuleLayout={
    activeScope:null,
    catalogs:{},

    config(scope){ return SCOPES[scope]||{label:'Organização dos módulos',columns:4,minColumns:2,maxColumns:6}; },
    deviceMode(scope){
      const cfg=this.config(scope);
      if(!cfg.responsive) return 'default';
      const forced=document.documentElement.getAttribute('data-interface-mode')==='smartphone';
      const narrow=window.matchMedia&&window.matchMedia('(max-width:760px)').matches;
      return forced||narrow?'mobile':'desktop';
    },
    storageKey(scope){
      const mode=this.deviceMode(scope);
      return mode==='default'?scope:`${scope}_${mode}`;
    },
    modeLabel(scope){ return this.deviceMode(scope)==='mobile'?'Celular':'Computador'; },
    root(create=false){
      if(typeof S==='undefined'||!S.data) return null;
      if(create&&!S.data.uiPreferences) S.data.uiPreferences={};
      if(create&&!S.data.uiPreferences.moduleLayouts) S.data.uiPreferences.moduleLayouts={};
      return S.data.uiPreferences&&S.data.uiPreferences.moduleLayouts||null;
    },
    normalize(scope,value){
      const cfg=this.config(scope),mode=this.deviceMode(scope);
      const src=value&&typeof value==='object'?value:{};
      const defaultColumns=mode==='mobile'?1:(cfg.columns||4);
      const minColumns=mode==='mobile'?1:(cfg.minColumns||2);
      const maxColumns=mode==='mobile'?1:(cfg.maxColumns||6);
      const columns=Math.max(minColumns,Math.min(maxColumns,Number(src.columns)||defaultColumns));
      const order=Array.isArray(src.order)?src.order.map(String):[];
      const items=src.items&&typeof src.items==='object'?src.items:{};
      const hidden=Array.isArray(src.hidden)?src.hidden.map(String):[];
      return {columns,order,items,hidden};
    },
    get(scope){
      const root=this.root(false),key=this.storageKey(scope);
      return this.normalize(scope,root&&root[key]);
    },
    save(scope,layout,{quiet=false,render=false}={}){
      const root=this.root(true); if(!root) return;
      root[this.storageKey(scope)]=this.normalize(scope,layout);
      if(typeof saveCurrentData==='function') saveCurrentData();
      if(render&&typeof renderView==='function') renderView();
      if(!quiet&&typeof toast==='function') toast('Layout salvo.');
    },
    register(scope,items){
      const safe=Array.isArray(items)?items:[];
      this.catalogs[scope]=safe.map((item,index)=>({
        id:String(item.id),
        label:String(item.label||item.id),
        defaultW:Math.max(1,Number(item.defaultW)||1),
        group:String(item.group||''),
        index
      }));
      return this.catalogs[scope];
    },
    catalog(scope){ return this.catalogs[scope]||[]; },
    reconcile(scope,ids){
      const layout=this.get(scope),valid=new Set(ids.map(String));
      const order=layout.order.filter(id=>valid.has(String(id)));
      const seen=new Set(order.map(String));
      ids.map(String).forEach(id=>{if(!seen.has(id)){order.push(id);seen.add(id);}});
      layout.order=order;
      layout.hidden=layout.hidden.filter(id=>valid.has(String(id)));
      return layout;
    },
    applyOrder(scope,items,{idKey='id'}={}){
      const layout=this.reconcile(scope,items.map(item=>item[idKey]));
      const pos=new Map(layout.order.map((id,index)=>[String(id),index]));
      return items.slice().sort((a,b)=>(pos.get(String(a[idKey]))??999999)-(pos.get(String(b[idKey]))??999999));
    },
    isHidden(scope,id){ return this.get(scope).hidden.includes(String(id)); },
    visibleItems(scope,items,{idKey='id'}={}){
      const hidden=new Set(this.get(scope).hidden.map(String));
      return this.applyOrder(scope,items,{idKey}).filter(item=>!hidden.has(String(item[idKey])));
    },
    toggleHidden(scope,id){
      const layout=this.get(scope),key=String(id),set=new Set(layout.hidden.map(String));
      if(set.has(key)) set.delete(key); else set.add(key);
      layout.hidden=Array.from(set);
      this.save(scope,layout,{quiet:true,render:true});
    },
    showAll(scope){
      const layout=this.get(scope); layout.hidden=[];
      this.save(scope,layout,{quiet:true,render:true});
    },
    isActive(scope){ return this.activeScope===scope; },
    toggle(scope){
      this.activeScope=this.activeScope===scope?null:scope;
      if(typeof renderView==='function') renderView();
    },
    setColumns(scope,value){
      const cfg=this.config(scope),mode=this.deviceMode(scope);
      const min=mode==='mobile'?1:(cfg.minColumns||2),max=mode==='mobile'?1:(cfg.maxColumns||6);
      const layout=this.get(scope); layout.columns=Math.max(min,Math.min(max,Number(value)||cfg.columns||4));
      this.save(scope,layout,{quiet:true,render:true});
    },
    itemSize(scope,id,defaults={}){
      const layout=this.get(scope),saved=layout.items[String(id)]||{};
      const w=Math.max(1,Math.min(layout.columns,Number(saved.w)||Number(defaults.w)||1));
      const h=Math.max(0,Number(saved.h)||0);
      return {w,h};
    },
    setSize(scope,id,w,h,{render=true}={}){
      const layout=this.get(scope),key=String(id);
      layout.items[key]=Object.assign({},layout.items[key]||{});
      layout.items[key].w=Math.max(1,Math.min(layout.columns,Number(w)||1));
      if(Number(h)>0) layout.items[key].h=Math.max(120,Math.round(Number(h)/10)*10);
      else delete layout.items[key].h;
      this.save(scope,layout,{quiet:true,render});
    },
    adjust(scope,id,axis,delta,defaultWidth=1){
      const current=this.itemSize(scope,id,{w:defaultWidth});
      if(axis==='w') this.setSize(scope,id,current.w+Number(delta||0),current.h,{render:true});
      else this.setSize(scope,id,current.w,Math.max(120,(current.h||240)+(Number(delta||0)*60)),{render:true});
    },
    autoHeight(scope,id){
      const layout=this.get(scope),key=String(id);
      layout.items[key]=Object.assign({},layout.items[key]||{}); delete layout.items[key].h;
      this.save(scope,layout,{quiet:true,render:true});
    },
    saveOrderFromDom(scope,container){
      const layout=this.get(scope);
      layout.order=Array.from(container.querySelectorAll(':scope > [data-module-id]')).map(el=>String(el.dataset.moduleId));
      this.save(scope,layout,{quiet:true});
    },
    reset(scope){
      const run=()=>{
        const root=this.root(true); delete root[this.storageKey(scope)];
        if(typeof saveCurrentData==='function') saveCurrentData();
        this.activeScope=null;
        if(typeof renderView==='function') renderView();
        if(typeof toast==='function') toast(`Layout padrão de ${this.modeLabel(scope).toLowerCase()} restaurado.`);
      };
      const text=`A ordem, os tamanhos e os blocos ocultos no layout de ${this.modeLabel(scope).toLowerCase()} voltarão ao padrão.`;
      if(typeof openConfirmModal==='function') openConfirmModal({title:'Restaurar layout padrão',text,confirmLabel:'Restaurar',cancelLabel:'Cancelar',variant:'danger',onConfirm:run});
      else if(confirm(text)) run();
    },
    toolbarHTML(scope,title){
      const active=this.isActive(scope),layout=this.get(scope),catalog=this.catalog(scope);
      const hidden=new Set(layout.hidden.map(String));
      const visibleCount=catalog.filter(item=>!hidden.has(item.id)).length;
      const mode=this.modeLabel(scope);
      const cfg=this.config(scope);
      const columnButtons=this.deviceMode(scope)==='mobile'?[1]:Array.from({length:(cfg.maxColumns||6)-(cfg.minColumns||2)+1},(_,i)=>(cfg.minColumns||2)+i);
      const chooser=catalog.length?`<details class="module-widget-chooser"><summary>Widgets ${visibleCount}/${catalog.length}</summary><div class="module-widget-menu">${catalog.map(item=>`<label><input type="checkbox" ${hidden.has(item.id)?'':'checked'} onchange="ModuleLayout.toggleHidden('${scope}','${esc(item.id)}')"><span>${esc(item.label)}</span></label>`).join('')}<button type="button" class="btn-outline btn-sm" onclick="ModuleLayout.showAll('${scope}')">Mostrar todos</button></div></details>`:'';
      return `<div class="module-layout-toolbar ${active?'active':''}"><div><strong>${esc(title||cfg.label)}</strong><span>${active?`Modo de edição · ${mode}. Arraste pelo cabeçalho e redimensione pelo canto.`:`Personalize posição e tamanho dos blocos · layout de ${mode}.`}</span></div><div class="module-layout-actions">${active?`${chooser}<div class="module-column-picker"><span>COLUNAS</span>${columnButtons.map(n=>`<button type="button" class="${layout.columns===n?'active':''}" onclick="ModuleLayout.setColumns('${scope}',${n})">${n}</button>`).join('')}</div><button class="btn-outline btn-sm" onclick="ModuleLayout.reset('${scope}')">Restaurar padrão</button>`:''}<button class="btn ${active?'btn-primary':'btn-outline'} btn-sm" onclick="ModuleLayout.toggle('${scope}')">${active?'Concluir edição':'Editar layout'}</button></div></div>`;
    },
    slotControlsHTML(scope,id,label,defaultWidth=1){
      if(!this.isActive(scope)) return '';
      const size=this.itemSize(scope,id,{w:defaultWidth});
      const canHide=this.catalog(scope).some(item=>item.id===String(id));
      return `<div class="module-slot-toolbar"><button type="button" class="module-drag-handle" data-module-drag-handle title="Arrastar ${esc(label||'módulo')}"><span aria-hidden="true">⠿</span><b>${esc(label||'Módulo')}</b></button><div class="module-size-controls"><span title="Largura atual">L ${size.w}</span><button type="button" onclick="ModuleLayout.adjust('${scope}','${esc(String(id))}','w',-1,${defaultWidth})" title="Diminuir largura">−</button><button type="button" onclick="ModuleLayout.adjust('${scope}','${esc(String(id))}','w',1,${defaultWidth})" title="Aumentar largura">+</button><button type="button" onclick="ModuleLayout.autoHeight('${scope}','${esc(String(id))}')" title="Usar altura automática">Auto</button>${canHide?`<button type="button" onclick="ModuleLayout.toggleHidden('${scope}','${esc(String(id))}')" title="Ocultar widget">Ocultar</button>`:''}</div></div>`;
    },
    resizeHandleHTML(scope,id,label){
      if(!this.isActive(scope)) return '';
      return `<button type="button" class="module-resize-handle" data-module-resize-handle aria-label="Redimensionar ${esc(label||'módulo')}" title="Arraste para redimensionar"></button>`;
    },
    slotStyle(scope,id,defaultWidth=1){
      const size=this.itemSize(scope,id,{w:defaultWidth});
      return `--module-span:${size.w};${size.h?`--module-fixed-height:${size.h}px;`:''}`;
    },
    schedule(scope){ setTimeout(()=>this.refresh(scope),0); },
    refresh(scope){
      document.querySelectorAll(`[data-module-layout="${scope}"]`).forEach(grid=>{
        const gridStyle=getComputedStyle(grid);
        const row=parseFloat(gridStyle.gridAutoRows)||8;
        const gap=parseFloat(gridStyle.rowGap)||8;
        grid.querySelectorAll(':scope > [data-module-id]').forEach(slot=>{
          const content=slot.querySelector(':scope > .module-layout-content');
          if(!content) return;
          const fixed=getComputedStyle(slot).getPropertyValue('--module-fixed-height').trim();
          if(fixed){content.style.height=fixed;content.style.overflow='auto';}else{content.style.height='auto';content.style.overflow='visible';}
          slot.style.gridRowEnd='auto';
          const height=Math.max(40,content.getBoundingClientRect().height+(this.isActive(scope)?48:0));
          slot.style.gridRowEnd=`span ${Math.max(1,Math.ceil((height+gap)/(row+gap)))}`;
        });
      });
    }
  };
  window.ModuleLayout=ModuleLayout;

  document.addEventListener('pointerdown',event=>{
    const handle=event.target.closest('[data-module-drag-handle]');
    if(!handle) return;
    const slot=handle.closest('[data-module-id]'),grid=slot&&slot.closest('[data-module-layout]');
    if(!slot||!grid||!ModuleLayout.isActive(grid.dataset.moduleLayout)) return;
    event.preventDefault();
    const pointerId=event.pointerId; let target=null,active=true;
    slot.classList.add('module-dragging'); grid.classList.add('module-grid-dragging');
    const clear=()=>{if(target)target.classList.remove('module-drop-target');target=null;};
    const cleanup=()=>{clear();slot.classList.remove('module-dragging');grid.classList.remove('module-grid-dragging');};
    const unbind=()=>{
      if(!active)return; active=false;
      document.removeEventListener('pointermove',move); document.removeEventListener('pointerup',done); document.removeEventListener('pointercancel',cancel);
      document.removeEventListener('visibilitychange',visibilityCancel); window.removeEventListener('blur',blurCancel); handle.removeEventListener('lostpointercapture',lostCapture);
    };
    const move=ev=>{
      if(!active||ev.pointerId!==pointerId)return;
      if(!slot.isConnected||!grid.isConnected){cancel();return;}
      if(ev.cancelable)ev.preventDefault();
      const hit=document.elementFromPoint(ev.clientX,ev.clientY),next=hit&&hit.closest('[data-module-id]');
      if(next&&next!==slot&&next.closest('[data-module-layout]')===grid){if(target!==next){clear();target=next;target.classList.add('module-drop-target');}}else clear();
    };
    const done=ev=>{
      if(!active||ev.pointerId!==pointerId)return; unbind();
      if(target&&target.isConnected&&slot.isConnected){
        const rect=target.getBoundingClientRect();
        const before=ev.clientY<rect.top+rect.height/2||ev.clientX<rect.left+rect.width/2;
        grid.insertBefore(slot,before?target:target.nextSibling);
        ModuleLayout.saveOrderFromDom(grid.dataset.moduleLayout,grid);
      }
      cleanup(); if(typeof renderView==='function') renderView();
    };
    const cancel=ev=>{if(!active||(ev&&ev.pointerId!=null&&ev.pointerId!==pointerId))return;unbind();cleanup();};
    const blurCancel=()=>cancel(),visibilityCancel=()=>{if(document.hidden)cancel();},lostCapture=ev=>cancel(ev);
    document.addEventListener('pointermove',move,{passive:false}); document.addEventListener('pointerup',done); document.addEventListener('pointercancel',cancel);
    document.addEventListener('visibilitychange',visibilityCancel); window.addEventListener('blur',blurCancel); handle.addEventListener('lostpointercapture',lostCapture);
    try{handle.setPointerCapture(pointerId);}catch(err){}
  });

  document.addEventListener('pointerdown',event=>{
    const handle=event.target.closest('[data-module-resize-handle]');
    if(!handle) return;
    const slot=handle.closest('[data-module-id]'),grid=slot&&slot.closest('[data-module-layout]');
    if(!slot||!grid) return;
    const scope=grid.dataset.moduleLayout;
    if(!ModuleLayout.isActive(scope)) return;
    event.preventDefault(); event.stopPropagation();
    const pointerId=event.pointerId,layout=ModuleLayout.get(scope),id=slot.dataset.moduleId;
    const content=slot.querySelector(':scope > .module-layout-content');
    const gridStyle=getComputedStyle(grid),gap=parseFloat(gridStyle.columnGap)||8;
    const renderedColumns=(gridStyle.gridTemplateColumns||'').split(/\s+/).filter(Boolean).length||layout.columns;
    const activeColumns=Math.max(1,Math.min(layout.columns,renderedColumns));
    const gridWidth=grid.getBoundingClientRect().width;
    const colWidth=Math.max(1,(gridWidth-gap*(activeColumns-1))/activeColumns);
    const startSize=ModuleLayout.itemSize(scope,id,{w:1});
    const startX=event.clientX,startY=event.clientY,startH=startSize.h||Math.max(120,content?content.getBoundingClientRect().height:240);
    let nextW=startSize.w,nextH=startH,active=true,raf=0;
    slot.classList.add('module-resizing');
    const paint=()=>{
      raf=0;
      slot.style.setProperty('--module-span',String(nextW));
      slot.style.setProperty('--module-fixed-height',`${nextH}px`);
      if(content){content.style.height=`${nextH}px`;content.style.overflow='auto';}
      ModuleLayout.refresh(scope);
    };
    const move=ev=>{
      if(!active||ev.pointerId!==pointerId)return;
      if(ev.cancelable)ev.preventDefault();
      nextW=Math.max(1,Math.min(activeColumns,Math.round(Math.min(startSize.w,activeColumns)+(ev.clientX-startX)/(colWidth+gap))));
      nextH=Math.max(120,Math.round((startH+ev.clientY-startY)/10)*10);
      if(!raf) raf=requestAnimationFrame(paint);
    };
    const cleanup=()=>{slot.classList.remove('module-resizing');if(raf)cancelAnimationFrame(raf);};
    const unbind=()=>{if(!active)return;active=false;document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',done);document.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);handle.removeEventListener('lostpointercapture',cancel);};
    const done=ev=>{if(!active||ev.pointerId!==pointerId)return;unbind();cleanup();ModuleLayout.setSize(scope,id,nextW,nextH,{render:true});};
    const cancel=ev=>{if(!active||(ev&&ev.pointerId!=null&&ev.pointerId!==pointerId))return;unbind();cleanup();if(typeof renderView==='function')renderView();};
    document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',done);document.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);handle.addEventListener('lostpointercapture',cancel);
    try{handle.setPointerCapture(pointerId);}catch(err){}
  });

  let resizeTimer=0,lastMode='';
  window.addEventListener('resize',()=>{
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(()=>{
      const mode=ModuleLayout.deviceMode('overview_dashboard');
      if(lastMode&&lastMode!==mode&&ModuleLayout.activeScope==='overview_dashboard'&&typeof renderView==='function') renderView();
      lastMode=mode;
      Object.keys(SCOPES).forEach(scope=>ModuleLayout.refresh(scope));
    },120);
  });
})();
