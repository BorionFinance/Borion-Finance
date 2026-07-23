/* Borion Finance — editor reutilizável de módulos.
   Permite arrastar, redimensionar, ocultar/exibir e salvar layouts por perfil.
   V6.46.14: a Visão Geral no computador usa posicionamento livre persistente,
   preserva espaços vazios e só empurra para baixo os módulos que colidirem. */
(() => {
  'use strict';

  const SCOPES={
    overview_dashboard:{label:'Layout da Visão Geral',columns:4,minColumns:2,maxColumns:6,responsive:true,freePlacement:true},
    overview_modules:{label:'Módulos da Visão Geral',columns:4,minColumns:2,maxColumns:6},
    patrimony_modules:{label:'Módulos do Patrimônio',columns:4,minColumns:2,maxColumns:6}
  };

  const finiteNumber=value=>Number.isFinite(Number(value));
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

  const ModuleLayout={
    activeScope:null,
    catalogs:{},
    _refreshing:new Set(),

    config(scope){ return SCOPES[scope]||{label:'Organização dos módulos',columns:4,minColumns:2,maxColumns:6}; },
    deviceMode(scope){
      const cfg=this.config(scope);
      if(!cfg.responsive) return 'default';
      const forced=document.documentElement.getAttribute('data-interface-mode')==='smartphone';
      const narrow=window.matchMedia&&window.matchMedia('(max-width:760px)').matches;
      return forced||narrow?'mobile':'desktop';
    },
    isFreePlacement(scope){
      return Boolean(this.config(scope).freePlacement&&this.deviceMode(scope)==='desktop');
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
      const rawItems=src.items&&typeof src.items==='object'?src.items:{};
      const items={};
      Object.keys(rawItems).forEach(id=>{
        const raw=rawItems[id]&&typeof rawItems[id]==='object'?rawItems[id]:{};
        const item={};
        if(finiteNumber(raw.w)) item.w=Math.max(1,Math.min(columns,Math.round(Number(raw.w))));
        if(finiteNumber(raw.h)&&Number(raw.h)>0) item.h=Math.max(120,Math.round(Number(raw.h)/10)*10);
        if(finiteNumber(raw.x)) item.x=Math.max(0,Math.round(Number(raw.x)));
        if(finiteNumber(raw.y)) item.y=Math.max(0,Math.round(Number(raw.y)));
        items[String(id)]=item;
      });
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
      const layout=this.get(scope);
      layout.columns=Math.max(min,Math.min(max,Number(value)||cfg.columns||4));
      if(this.isFreePlacement(scope)){
        Object.keys(layout.items).forEach(id=>{
          const item=layout.items[id];
          item.w=Math.max(1,Math.min(layout.columns,Number(item.w)||1));
          if(finiteNumber(item.x)) item.x=Math.max(0,Math.min(layout.columns-item.w,Number(item.x)||0));
        });
      }
      this.save(scope,layout,{quiet:true,render:true});
    },
    defaultWidth(scope,id){
      const entry=this.catalog(scope).find(item=>item.id===String(id));
      return Math.max(1,Number(entry&&entry.defaultW)||1);
    },
    itemSize(scope,id,defaults={}){
      const layout=this.get(scope),saved=layout.items[String(id)]||{};
      const fallback=Number(defaults.w)||this.defaultWidth(scope,id);
      const w=Math.max(1,Math.min(layout.columns,Number(saved.w)||fallback||1));
      const h=Math.max(0,Number(saved.h)||0);
      return {w,h};
    },
    itemPosition(scope,id){
      if(!this.isFreePlacement(scope)) return null;
      const item=this.get(scope).items[String(id)]||{};
      if(!finiteNumber(item.x)||!finiteNumber(item.y)) return null;
      return {x:Math.max(0,Math.round(Number(item.x))),y:Math.max(0,Math.round(Number(item.y)))};
    },
    grid(scope){ return document.querySelector(`[data-module-layout="${scope}"]`); },
    gridMetrics(grid,scope){
      const style=getComputedStyle(grid);
      const layout=this.get(scope);
      const template=(style.gridTemplateColumns||'').split(/\s+/).filter(Boolean);
      const columns=Math.max(1,template.length||layout.columns||1);
      const columnGap=parseFloat(style.columnGap)||0;
      const row=parseFloat(style.gridAutoRows)||8;
      const rowGap=parseFloat(style.rowGap)||8;
      const width=grid.getBoundingClientRect().width;
      const colWidth=Math.max(1,(width-columnGap*(columns-1))/columns);
      return {columns,columnGap,row,rowGap,colWidth,rowStep:row+rowGap,colStep:colWidth+columnGap};
    },
    heightToRows(grid,scope,height){
      const metrics=this.gridMetrics(grid,scope);
      const toolbarAllowance=this.isFreePlacement(scope)?0:(this.isActive(scope)?48:0);
      return Math.max(1,Math.ceil((Math.max(40,Number(height)||40)+toolbarAllowance+metrics.rowGap)/(metrics.row+metrics.rowGap)));
    },
    setSize(scope,id,w,h,{render=true}={}){
      if(this.isFreePlacement(scope)){
        const grid=this.grid(scope),slot=grid&&Array.from(grid.querySelectorAll(':scope > [data-module-id]')).find(el=>String(el.dataset.moduleId)===String(id));
        if(grid&&slot){
          const pos=this.itemPosition(scope,id)||this.positionFromRect(grid,slot,scope);
          this.commitSpatialChange(scope,id,{x:pos.x,y:pos.y,w,h:Number(h)>0?Number(h):0},{grid,slot,render});
          return;
        }
      }
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
      layout.items[key]=Object.assign({},layout.items[key]||{});
      delete layout.items[key].h;
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
      const text=`A ordem, as posições, os tamanhos e os blocos ocultos no layout de ${this.modeLabel(scope).toLowerCase()} voltarão ao padrão.`;
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
      const activeHelp=this.isFreePlacement(scope)?`Modo de edição · ${mode}. Arraste para qualquer espaço vazio; nada será compactado automaticamente.`:`Modo de edição · ${mode}. Arraste pelo cabeçalho e redimensione pelo canto.`;
      return `<div class="module-layout-toolbar ${active?'active':''}"><div><strong>${esc(title||cfg.label)}</strong><span>${active?activeHelp:`Personalize posição e tamanho dos blocos · layout de ${mode}.`}</span></div><div class="module-layout-actions">${active?`${chooser}<div class="module-column-picker"><span>COLUNAS</span>${columnButtons.map(n=>`<button type="button" class="${layout.columns===n?'active':''}" onclick="ModuleLayout.setColumns('${scope}',${n})">${n}</button>`).join('')}</div><button class="btn-outline btn-sm" onclick="ModuleLayout.reset('${scope}')">Restaurar padrão</button>`:''}<button class="btn ${active?'btn-primary':'btn-outline'} btn-sm" onclick="ModuleLayout.toggle('${scope}')">${active?'Concluir edição':'Editar layout'}</button></div></div>`;
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
      const pos=this.itemPosition(scope,id);
      return `--module-span:${size.w};${size.h?`--module-fixed-height:${size.h}px;`:''}${pos?`grid-column-start:${pos.x+1};grid-row-start:${pos.y+1};`:''}`;
    },
    schedule(scope){ setTimeout(()=>this.refresh(scope),0); },
    positionFromRect(grid,slot,scope){
      const metrics=this.gridMetrics(grid,scope),gridRect=grid.getBoundingClientRect(),rect=slot.getBoundingClientRect();
      const size=this.itemSize(scope,slot.dataset.moduleId);
      return {
        x:clamp(Math.round((rect.left-gridRect.left)/Math.max(1,metrics.colStep)),0,Math.max(0,metrics.columns-Math.min(metrics.columns,size.w))),
        y:Math.max(0,Math.round((rect.top-gridRect.top)/Math.max(1,metrics.rowStep)))
      };
    },
    captureMissingPositions(scope,grid){
      if(!this.isFreePlacement(scope)) return false;
      const layout=this.get(scope),metrics=this.gridMetrics(grid,scope);
      let changed=false;
      grid.querySelectorAll(':scope > [data-module-id]').forEach(slot=>{
        const id=String(slot.dataset.moduleId),item=layout.items[id]||(layout.items[id]={});
        const size=this.itemSize(scope,id);
        item.w=Math.max(1,Math.min(metrics.columns,size.w));
        if(!finiteNumber(item.x)||!finiteNumber(item.y)){
          const pos=this.positionFromRect(grid,slot,scope);
          item.x=pos.x; item.y=pos.y; changed=true;
        }else{
          const x=clamp(item.x,0,Math.max(0,metrics.columns-item.w));
          if(x!==item.x){item.x=x;changed=true;}
          item.y=Math.max(0,Math.round(Number(item.y)||0));
        }
        slot.style.gridColumnStart=String(item.x+1);
        slot.style.gridRowStart=String(item.y+1);
      });
      if(changed) this.save(scope,layout,{quiet:true});
      return changed;
    },
    collectSpatialGeometry(scope,grid,overrideId=null,override={}){
      const layout=this.get(scope),metrics=this.gridMetrics(grid,scope);
      const orderMap=new Map(layout.order.map((id,index)=>[String(id),index]));
      return Array.from(grid.querySelectorAll(':scope > [data-module-id]')).map((slot,index)=>{
        const id=String(slot.dataset.moduleId),saved=layout.items[id]||{};
        const isOverride=id===String(overrideId||'');
        const baseSize=this.itemSize(scope,id);
        const w=Math.max(1,Math.min(metrics.columns,Math.round(isOverride&&finiteNumber(override.w)?Number(override.w):baseSize.w)));
        const fallback=this.positionFromRect(grid,slot,scope);
        const x=clamp(isOverride&&finiteNumber(override.x)?Number(override.x):(finiteNumber(saved.x)?saved.x:fallback.x),0,Math.max(0,metrics.columns-w));
        const y=Math.max(0,Math.round(isOverride&&finiteNumber(override.y)?Number(override.y):(finiteNumber(saved.y)?saved.y:fallback.y)));
        let rows=Math.max(1,Number(slot.dataset.moduleRows)||1);
        if(isOverride&&finiteNumber(override.h)&&Number(override.h)>0) rows=this.heightToRows(grid,scope,Number(override.h));
        return {id,slot,x,y,w,rows,order:orderMap.get(id)??index};
      });
    },
    overlaps(a,b){
      return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.rows&&a.y+a.rows>b.y;
    },
    resolveSpatialGeometry(items,pinnedId=null){
      const pinned=String(pinnedId||'');
      const first=pinned?items.find(item=>item.id===pinned):null;
      const rest=items.filter(item=>!first||item!==first).sort((a,b)=>a.y-b.y||a.x-b.x||a.order-b.order);
      const sequence=first?[first].concat(rest):rest;
      const placed=[];
      sequence.forEach(original=>{
        const item=Object.assign({},original);
        let guard=0;
        while(guard++<500){
          const collisions=placed.filter(other=>this.overlaps(item,other));
          if(!collisions.length) break;
          item.y=Math.max(item.y,...collisions.map(other=>other.y+other.rows));
        }
        placed.push(item);
      });
      return placed;
    },
    applySpatialGeometry(scope,grid,geometry,{save=true,render=false,targetId=null,targetH=undefined}={}){
      const layout=this.get(scope); let changed=false;
      geometry.forEach(item=>{
        const saved=layout.items[item.id]||(layout.items[item.id]={});
        if(saved.x!==item.x||saved.y!==item.y||saved.w!==item.w) changed=true;
        saved.x=item.x; saved.y=item.y; saved.w=item.w;
        if(targetId&&item.id===String(targetId)){
          if(Number(targetH)>0){
            const h=Math.max(120,Math.round(Number(targetH)/10)*10);
            if(saved.h!==h) changed=true;
            saved.h=h;
          }else if(targetH===0&&Object.prototype.hasOwnProperty.call(saved,'h')){
            delete saved.h; changed=true;
          }
        }
        if(item.slot){
          item.slot.style.gridColumnStart=String(item.x+1);
          item.slot.style.gridRowStart=String(item.y+1);
          item.slot.style.setProperty('--module-span',String(item.w));
        }
      });
      if(save&&changed) this.save(scope,layout,{quiet:true,render});
      else if(render&&typeof renderView==='function') renderView();
      return changed;
    },
    stabilizeSpatial(scope,grid,pinnedId=null){
      if(!this.isFreePlacement(scope)) return false;
      const geometry=this.collectSpatialGeometry(scope,grid);
      const resolved=this.resolveSpatialGeometry(geometry,pinnedId);
      return this.applySpatialGeometry(scope,grid,resolved,{save:true,render:false});
    },
    commitSpatialChange(scope,id,change,{grid=null,slot=null,render=true}={}){
      grid=grid||this.grid(scope); if(!grid) return;
      this.captureMissingPositions(scope,grid);
      const geometry=this.collectSpatialGeometry(scope,grid,id,change);
      const resolved=this.resolveSpatialGeometry(geometry,id);
      this.applySpatialGeometry(scope,grid,resolved,{save:true,render,targetId:id,targetH:Object.prototype.hasOwnProperty.call(change,'h')?change.h:undefined});
    },
    refresh(scope){
      if(this._refreshing.has(scope)) return;
      this._refreshing.add(scope);
      try{
        document.querySelectorAll(`[data-module-layout="${scope}"]`).forEach(grid=>{
          const gridStyle=getComputedStyle(grid);
          const row=parseFloat(gridStyle.gridAutoRows)||8;
          const gap=parseFloat(gridStyle.rowGap)||8;
          grid.querySelectorAll(':scope > [data-module-id]').forEach(slot=>{
            const content=slot.querySelector(':scope > .module-layout-content');
            if(!content) return;
            const fixed=getComputedStyle(slot).getPropertyValue('--module-fixed-height').trim();
            if(fixed){content.style.height=fixed;content.style.overflow='auto';}
            else{content.style.height='auto';content.style.overflow='visible';}
            slot.style.gridRowEnd='auto';
            const toolbarAllowance=this.isFreePlacement(scope)?0:(this.isActive(scope)?48:0);
            const height=Math.max(40,content.getBoundingClientRect().height+toolbarAllowance);
            const rows=Math.max(1,Math.ceil((height+gap)/(row+gap)));
            slot.dataset.moduleRows=String(rows);
            slot.style.gridRowEnd=`span ${rows}`;
          });
          if(this.isFreePlacement(scope)){
            this.captureMissingPositions(scope,grid);
            this.stabilizeSpatial(scope,grid);
          }
        });
      }finally{
        this._refreshing.delete(scope);
      }
    }
  };
  window.ModuleLayout=ModuleLayout;

  document.addEventListener('pointerdown',event=>{
    const handle=event.target.closest('[data-module-drag-handle]');
    if(!handle) return;
    const slot=handle.closest('[data-module-id]'),grid=slot&&slot.closest('[data-module-layout]');
    if(!slot||!grid) return;
    const scope=grid.dataset.moduleLayout;
    if(!ModuleLayout.isActive(scope)) return;
    event.preventDefault();

    if(ModuleLayout.isFreePlacement(scope)){
      ModuleLayout.captureMissingPositions(scope,grid);
      const pointerId=event.pointerId,id=String(slot.dataset.moduleId),size=ModuleLayout.itemSize(scope,id);
      const metrics=ModuleLayout.gridMetrics(grid,scope),gridRect=grid.getBoundingClientRect(),slotRect=slot.getBoundingClientRect();
      const startPos=ModuleLayout.itemPosition(scope,id)||ModuleLayout.positionFromRect(grid,slot,scope);
      const grabX=event.clientX-slotRect.left,grabY=event.clientY-slotRect.top;
      let nextX=startPos.x,nextY=startPos.y,active=true,raf=0;
      slot.classList.add('module-dragging','module-spatial-dragging'); grid.classList.add('module-grid-dragging');
      const paint=()=>{
        raf=0;
        slot.style.gridColumnStart=String(nextX+1);
        slot.style.gridRowStart=String(nextY+1);
      };
      const move=ev=>{
        if(!active||ev.pointerId!==pointerId) return;
        if(ev.cancelable) ev.preventDefault();
        nextX=clamp(Math.round((ev.clientX-gridRect.left-grabX)/Math.max(1,metrics.colStep)),0,Math.max(0,metrics.columns-size.w));
        nextY=Math.max(0,Math.round((ev.clientY-gridRect.top-grabY)/Math.max(1,metrics.rowStep)));
        if(!raf) raf=requestAnimationFrame(paint);
      };
      const cleanup=()=>{
        if(raf) cancelAnimationFrame(raf);
        slot.classList.remove('module-dragging','module-spatial-dragging'); grid.classList.remove('module-grid-dragging');
      };
      const unbind=()=>{
        if(!active) return; active=false;
        document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',done);document.removeEventListener('pointercancel',cancel);
        window.removeEventListener('blur',cancel);handle.removeEventListener('lostpointercapture',cancel);
      };
      const done=ev=>{
        if(!active||ev.pointerId!==pointerId) return;
        unbind();cleanup();
        ModuleLayout.commitSpatialChange(scope,id,{x:nextX,y:nextY,w:size.w,h:size.h},{grid,slot,render:true});
      };
      const cancel=ev=>{
        if(!active||(ev&&ev.pointerId!=null&&ev.pointerId!==pointerId)) return;
        unbind();cleanup();
        if(typeof renderView==='function') renderView();
      };
      document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',done);document.addEventListener('pointercancel',cancel);
      window.addEventListener('blur',cancel);handle.addEventListener('lostpointercapture',cancel);
      try{handle.setPointerCapture(pointerId);}catch(err){}
      return;
    }

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
    if(ModuleLayout.isFreePlacement(scope)) ModuleLayout.captureMissingPositions(scope,grid);
    const pointerId=event.pointerId,layout=ModuleLayout.get(scope),id=slot.dataset.moduleId;
    const content=slot.querySelector(':scope > .module-layout-content');
    const gridStyle=getComputedStyle(grid),gap=parseFloat(gridStyle.columnGap)||8;
    const renderedColumns=(gridStyle.gridTemplateColumns||'').split(/\s+/).filter(Boolean).length||layout.columns;
    const activeColumns=Math.max(1,Math.min(layout.columns,renderedColumns));
    const gridWidth=grid.getBoundingClientRect().width;
    const colWidth=Math.max(1,(gridWidth-gap*(activeColumns-1))/activeColumns);
    const startSize=ModuleLayout.itemSize(scope,id);
    const startPos=ModuleLayout.itemPosition(scope,id)||{x:0,y:0};
    const startX=event.clientX,startY=event.clientY,startH=startSize.h||Math.max(120,content?content.getBoundingClientRect().height:240);
    let nextW=startSize.w,nextH=startH,nextX=startPos.x,active=true,raf=0;
    slot.classList.add('module-resizing');
    const paint=()=>{
      raf=0;
      if(ModuleLayout.isFreePlacement(scope)){
        nextX=Math.min(startPos.x,Math.max(0,activeColumns-nextW));
        slot.style.gridColumnStart=String(nextX+1);
      }
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
    const done=ev=>{
      if(!active||ev.pointerId!==pointerId)return;
      unbind();cleanup();
      if(ModuleLayout.isFreePlacement(scope)) ModuleLayout.commitSpatialChange(scope,id,{x:nextX,y:startPos.y,w:nextW,h:nextH},{grid,slot,render:true});
      else ModuleLayout.setSize(scope,id,nextW,nextH,{render:true});
    };
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
