/* Borion Finance — editor reutilizável de módulos.
   Permite arrastar, redimensionar, ocultar/exibir e salvar layouts por perfil.
   V6.46.20: a Visão Geral no computador funciona como uma área de trabalho livre:
   posições e tamanhos em pixels, sobreposição permitida e nenhuma reorganização automática. */
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
    pendingPlacement:null,
    _placementSession:null,

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
        if(finiteNumber(raw.pxX)) item.pxX=Math.max(0,Math.round(Number(raw.pxX)));
        if(finiteNumber(raw.pxY)) item.pxY=Math.max(0,Math.round(Number(raw.pxY)));
        if(finiteNumber(raw.pxW)) item.pxW=Math.max(180,Math.round(Number(raw.pxW)));
        if(finiteNumber(raw.pxH)&&Number(raw.pxH)>0) item.pxH=Math.max(120,Math.round(Number(raw.pxH)));
        if(finiteNumber(raw.z)) item.z=Math.max(0,Math.round(Number(raw.z)));
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
    isPendingPlacement(scope,id){
      const pending=this.pendingPlacement;
      return Boolean(pending&&pending.scope===scope&&String(pending.id)===String(id));
    },
    freeDefaultWidth(scope,id,grid=null){
      grid=grid||this.grid(scope);
      const layout=this.get(scope),span=Math.max(1,Math.min(layout.columns,this.defaultWidth(scope,id)));
      const width=grid?Math.max(180,grid.getBoundingClientRect().width):1120;
      const gap=grid?(parseFloat(getComputedStyle(grid).columnGap)||12):12;
      const col=Math.max(180,(width-gap*(layout.columns-1))/Math.max(1,layout.columns));
      return Math.max(180,Math.min(width,Math.round(col*span+gap*(span-1))));
    },
    storedBottom(scope,layout=null){
      layout=layout||this.get(scope);
      const hidden=new Set((layout.hidden||[]).map(String));
      let bottom=0;
      Object.entries(layout.items||{}).forEach(([id,item])=>{
        if(hidden.has(String(id))||!item||!finiteNumber(item.pxY)) return;
        const h=finiteNumber(item.pxH)&&Number(item.pxH)>0?Number(item.pxH):220;
        bottom=Math.max(bottom,Number(item.pxY)+h);
      });
      return Math.max(0,Math.round(bottom));
    },
    cancelPlacement({rehide=true,render=true}={}){
      const pending=this.pendingPlacement;
      const session=this._placementSession;
      if(session&&typeof session.cleanup==='function') session.cleanup();
      this._placementSession=null;
      this.pendingPlacement=null;
      if(!pending||!rehide) return;
      const layout=this.get(pending.scope),key=String(pending.id),hidden=new Set(layout.hidden.map(String));
      hidden.add(key); layout.hidden=Array.from(hidden);
      this.save(pending.scope,layout,{quiet:true,render});
      if(typeof toast==='function') toast('Posicionamento cancelado.');
    },
    preparePlacement(scope,id){
      const key=String(id);
      if(!this.isFreePlacement(scope)||!this.isActive(scope)){
        const layout=this.get(scope),hidden=new Set(layout.hidden.map(String));
        hidden.delete(key);layout.hidden=Array.from(hidden);
        this.save(scope,layout,{quiet:true,render:true});
        return;
      }
      if(this.pendingPlacement) this.cancelPlacement({rehide:true,render:false});
      const layout=this.get(scope),hidden=new Set(layout.hidden.map(String));
      const stagingY=this.storedBottom(scope,layout)+40;
      hidden.delete(key);layout.hidden=Array.from(hidden);
      const item=layout.items[key]||(layout.items[key]={});
      const grid=this.grid(scope),width=this.freeDefaultWidth(scope,key,grid);
      item.pxW=finiteNumber(item.pxW)&&Number(item.pxW)>=180?Number(item.pxW):width;
      item.pxX=0;
      item.pxY=stagingY;
      item.z=this.maxZ(scope)+1;
      this.pendingPlacement={scope,id:key};
      this.save(scope,layout,{quiet:true,render:true});
      setTimeout(()=>this.activatePlacement(scope,key),0);
    },
    activatePlacement(scope,id){
      if(!this.isPendingPlacement(scope,id)||this._placementSession) return;
      const grid=this.grid(scope),slot=grid&&Array.from(grid.querySelectorAll(':scope > [data-module-id]')).find(el=>String(el.dataset.moduleId)===String(id));
      if(!grid||!slot){setTimeout(()=>this.activatePlacement(scope,id),40);return;}
      const frame=this.freeFrame(scope,id,slot)||{x:0,y:0,w:this.freeDefaultWidth(scope,id,grid),h:0,z:this.maxZ(scope)+1};
      const ghost=document.createElement('div');
      ghost.className='module-placement-ghost';
      ghost.innerHTML=`<b>${esc((this.catalog(scope).find(item=>item.id===String(id))||{}).label||'Widget')}</b><span>Clique para posicionar · Esc cancela</span>`;
      ghost.style.width=`${Math.min(frame.w,Math.max(220,window.innerWidth-32))}px`;
      document.body.appendChild(ghost);
      grid.classList.add('module-placement-active');
      const originalHeight=parseFloat(grid.style.height)||grid.getBoundingClientRect().height||180;
      grid.style.height=`${Math.ceil(originalHeight+Math.max(560,window.innerHeight*.75))}px`;
      document.body.classList.add('module-widget-placement-mode');
      let lastX=Math.min(window.innerWidth-24,Math.max(24,window.innerWidth*.62));
      let lastY=Math.min(window.innerHeight-80,Math.max(80,window.innerHeight*.34));
      const paint=()=>{
        const w=ghost.getBoundingClientRect().width||260,h=ghost.getBoundingClientRect().height||54;
        ghost.style.left=`${clamp(lastX+14,8,Math.max(8,window.innerWidth-w-8))}px`;
        ghost.style.top=`${clamp(lastY+14,8,Math.max(8,window.innerHeight-h-8))}px`;
      };
      const move=event=>{lastX=event.clientX;lastY=event.clientY;paint();};
      const keydown=event=>{if(event.key==='Escape'){event.preventDefault();this.cancelPlacement({rehide:true,render:true});}};
      const click=event=>{
        if(!this.isPendingPlacement(scope,id)) return;
        if(event.target.closest('.module-layout-toolbar,.module-placement-ghost,.modal-overlay,.toast-container')) return;
        const rect=grid.getBoundingClientRect();
        const insideX=event.clientX>=rect.left&&event.clientX<=rect.right;
        const insideY=event.clientY>=rect.top&&event.clientY<=rect.bottom;
        if(!insideX||!insideY){
          if(typeof toast==='function') toast('Clique dentro da área da dashboard para posicionar o widget.');
          return;
        }
        event.preventDefault();event.stopPropagation();
        const x=clamp(Math.round(event.clientX-rect.left-frame.w/2),0,Math.max(0,rect.width-frame.w));
        const y=Math.max(0,Math.round(event.clientY-rect.top-20));
        const pending=this.pendingPlacement;
        this.pendingPlacement=null;
        if(this._placementSession&&typeof this._placementSession.cleanup==='function') this._placementSession.cleanup();
        this._placementSession=null;
        this.commitFreeFrame(scope,id,{x,y,w:frame.w,h:frame.h,z:this.maxZ(scope)+1},{grid,slot,render:true});
        if(typeof toast==='function') toast('Widget posicionado.');
      };
      const orphanTimer=setInterval(()=>{
        if(!grid.isConnected) this.cancelPlacement({rehide:true,render:false});
      },250);
      const cleanup=()=>{
        clearInterval(orphanTimer);
        document.removeEventListener('pointermove',move,true);
        document.removeEventListener('click',click,true);
        document.removeEventListener('keydown',keydown,true);
        window.removeEventListener('resize',paint);
        if(ghost.isConnected) ghost.remove();
        if(grid.isConnected){grid.classList.remove('module-placement-active');grid.style.height=`${Math.ceil(originalHeight)}px`;}
        document.body.classList.remove('module-widget-placement-mode');
      };
      this._placementSession={scope,id:String(id),cleanup};
      document.addEventListener('pointermove',move,true);
      document.addEventListener('click',click,true);
      document.addEventListener('keydown',keydown,true);
      window.addEventListener('resize',paint);
      paint();
    },
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
      if(set.has(key)){
        this.preparePlacement(scope,key);
        return;
      }
      if(this.isPendingPlacement(scope,key)) this.cancelPlacement({rehide:false,render:false});
      set.add(key);layout.hidden=Array.from(set);
      this.save(scope,layout,{quiet:true,render:true});
    },
    showAll(scope){
      const layout=this.get(scope),hidden=layout.hidden.map(String);
      if(!hidden.length) return;
      if(this.isFreePlacement(scope)&&this.isActive(scope)){
        let y=this.storedBottom(scope,layout)+40;
        let nextZ=Math.max(0,...Object.values(layout.items||{}).map(item=>finiteNumber(item&&item.z)?Number(item.z):0))+1;
        const grid=this.grid(scope),gridWidth=grid?Math.max(180,grid.getBoundingClientRect().width):1120;
        hidden.forEach(id=>{
          const item=layout.items[id]||(layout.items[id]={});
          item.pxW=Math.min(gridWidth,finiteNumber(item.pxW)&&Number(item.pxW)>=180?Number(item.pxW):this.freeDefaultWidth(scope,id,grid));
          item.pxX=0;item.pxY=y;item.z=nextZ++;
          y+=Math.max(160,finiteNumber(item.pxH)&&Number(item.pxH)>0?Number(item.pxH):220)+24;
        });
        layout.hidden=[];
        this.save(scope,layout,{quiet:true,render:true});
        if(typeof toast==='function') toast('Widgets reativados no final da dashboard.');
        return;
      }
      layout.hidden=[];
      this.save(scope,layout,{quiet:true,render:true});
    },
    isActive(scope){ return this.activeScope===scope; },
    toggle(scope){
      if(this.activeScope===scope&&this.pendingPlacement&&this.pendingPlacement.scope===scope){
        this.cancelPlacement({rehide:true,render:false});
      }
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
    hasFreeFrame(scope,id){
      if(!this.isFreePlacement(scope)) return false;
      const item=this.get(scope).items[String(id)]||{};
      return finiteNumber(item.pxX)&&finiteNumber(item.pxY)&&finiteNumber(item.pxW)&&Number(item.pxW)>=180;
    },
    hasCompleteFreeLayout(scope,ids=[]){
      if(!this.isFreePlacement(scope)) return true;
      const safe=Array.isArray(ids)?ids.map(item=>String(item&&item.id!=null?item.id:item)):[];
      return safe.every(id=>this.hasFreeFrame(scope,id));
    },
    freeFrame(scope,id,slot=null){
      const item=this.get(scope).items[String(id)]||{};
      if(this.hasFreeFrame(scope,id)){
        return {
          x:Math.max(0,Math.round(Number(item.pxX)||0)),
          y:Math.max(0,Math.round(Number(item.pxY)||0)),
          w:Math.max(180,Math.round(Number(item.pxW)||180)),
          h:finiteNumber(item.pxH)&&Number(item.pxH)>0?Math.max(120,Math.round(Number(item.pxH))):0,
          z:finiteNumber(item.z)?Math.max(0,Math.round(Number(item.z))):1
        };
      }
      if(slot){
        const grid=slot.closest('[data-module-layout]'),gridRect=grid&&grid.getBoundingClientRect(),rect=slot.getBoundingClientRect();
        if(gridRect) return {x:Math.max(0,Math.round(rect.left-gridRect.left)),y:Math.max(0,Math.round(rect.top-gridRect.top)),w:Math.max(180,Math.round(rect.width)),h:Number(item.h)>0?Math.max(120,Math.round(Number(item.h))):0,z:finiteNumber(item.z)?Math.max(0,Math.round(Number(item.z))):1};
      }
      return null;
    },
    maxZ(scope){
      const layout=this.get(scope);
      return Math.max(0,...Object.values(layout.items||{}).map(item=>finiteNumber(item&&item.z)?Number(item.z):0));
    },
    bringToFront(scope,id,{render=true}={}){
      if(!this.isFreePlacement(scope)) return;
      const layout=this.get(scope),key=String(id),item=layout.items[key]||(layout.items[key]={});
      item.z=this.maxZ(scope)+1;
      this.save(scope,layout,{quiet:true,render});
    },
    sendToBack(scope,id){
      if(!this.isFreePlacement(scope)) return;
      const layout=this.get(scope),key=String(id),item=layout.items[key]||(layout.items[key]={});
      Object.entries(layout.items).forEach(([otherId,entry])=>{
        if(otherId!==key&&entry) entry.z=(finiteNumber(entry.z)?Math.max(0,Math.round(Number(entry.z))):1)+1;
      });
      item.z=0;
      this.save(scope,layout,{quiet:true,render:true});
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
        const frame=this.freeFrame(scope,id,slot);
        if(grid&&slot&&frame){
          this.commitFreeFrame(scope,id,{x:frame.x,y:frame.y,w:Math.max(180,Number(w)||frame.w),h:Number(h)>0?Number(h):0,z:frame.z},{grid,slot,render});
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
      if(this.isFreePlacement(scope)){
        const grid=this.grid(scope),slot=grid&&Array.from(grid.querySelectorAll(':scope > [data-module-id]')).find(el=>String(el.dataset.moduleId)===String(id));
        const frame=this.freeFrame(scope,id,slot);
        if(frame){
          const step=Number(delta||0);
          if(axis==='w') this.commitFreeFrame(scope,id,{...frame,w:Math.max(180,frame.w+step*80)},{grid,slot,render:true});
          else this.commitFreeFrame(scope,id,{...frame,h:Math.max(120,(frame.h||240)+step*60)},{grid,slot,render:true});
          return;
        }
      }
      const current=this.itemSize(scope,id,{w:defaultWidth});
      if(axis==='w') this.setSize(scope,id,current.w+Number(delta||0),current.h,{render:true});
      else this.setSize(scope,id,current.w,Math.max(120,(current.h||240)+(Number(delta||0)*60)),{render:true});
    },
    autoHeight(scope,id){
      const layout=this.get(scope),key=String(id);
      layout.items[key]=Object.assign({},layout.items[key]||{});
      delete layout.items[key].h;
      delete layout.items[key].pxH;
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
      const free=this.isFreePlacement(scope);
      const columnButtons=this.deviceMode(scope)==='mobile'?[1]:Array.from({length:(cfg.maxColumns||6)-(cfg.minColumns||2)+1},(_,i)=>(cfg.minColumns||2)+i);
      const chooser=catalog.length?`<details class="module-widget-chooser"><summary>Widgets ${visibleCount}/${catalog.length}</summary><div class="module-widget-menu">${catalog.map(item=>`<label><input type="checkbox" ${hidden.has(item.id)?'':'checked'} onchange="ModuleLayout.toggleHidden('${scope}','${esc(item.id)}')"><span>${esc(item.label)}</span></label>`).join('')}<button type="button" class="btn-outline btn-sm" onclick="ModuleLayout.showAll('${scope}')">Mostrar todos</button></div></details>`:'';
      const activeHelp=free?`Modo livre · ${mode}. Mova e redimensione como janelas; módulos podem ficar sobrepostos e nenhum outro bloco será deslocado.`:`Modo de edição · ${mode}. Arraste pelo cabeçalho e redimensione pelo canto.`;
      const layoutMode=free?'<span class="module-free-badge">POSIÇÃO LIVRE</span>':`<div class="module-column-picker"><span>COLUNAS</span>${columnButtons.map(n=>`<button type="button" class="${layout.columns===n?'active':''}" onclick="ModuleLayout.setColumns('${scope}',${n})">${n}</button>`).join('')}</div>`;
      if(!active) return `<button type="button" class="module-layout-pencil" onclick="ModuleLayout.toggle('${scope}')" title="Editar layout" aria-label="Editar layout">✎</button>`;
      return `<div class="module-layout-toolbar active"><div><strong>${esc(title||cfg.label)}</strong><span>${activeHelp}</span></div><div class="module-layout-actions">${chooser}${layoutMode}<button class="btn-outline btn-sm" onclick="ModuleLayout.reset('${scope}')">Restaurar padrão</button><button class="btn btn-primary btn-sm" onclick="ModuleLayout.toggle('${scope}')">Concluir edição</button></div></div>`;
    },
    slotControlsHTML(scope,id,label,defaultWidth=1){
      if(!this.isActive(scope)) return '';
      const size=this.itemSize(scope,id,{w:defaultWidth});
      const free=this.isFreePlacement(scope),frame=free?this.freeFrame(scope,id):null;
      const canHide=this.catalog(scope).some(item=>item.id===String(id));
      const sizeLabel=free&&frame?`${Math.round(frame.w)}×${frame.h?Math.round(frame.h):'auto'}`:`L ${size.w}`;
      const layers=free?`<button type="button" onclick="ModuleLayout.sendToBack('${scope}','${esc(String(id))}')" title="Enviar este módulo para trás">↓</button><button type="button" onclick="ModuleLayout.bringToFront('${scope}','${esc(String(id))}')" title="Trazer este módulo para frente">↑</button>`:'';
      return `<div class="module-slot-toolbar" data-module-drag-handle title="Arraste por qualquer ponto desta barra"><div class="module-drag-handle"><span aria-hidden="true">⠿</span><b>${esc(label||'Módulo')}</b></div><div class="module-size-controls"><span title="Tamanho atual">${sizeLabel}</span><button type="button" onclick="ModuleLayout.adjust('${scope}','${esc(String(id))}','w',-1,${defaultWidth})" title="Diminuir largura">−</button><button type="button" onclick="ModuleLayout.adjust('${scope}','${esc(String(id))}','w',1,${defaultWidth})" title="Aumentar largura">+</button><button type="button" onclick="ModuleLayout.autoHeight('${scope}','${esc(String(id))}')" title="Usar altura automática">Auto</button>${layers}${canHide?`<button type="button" onclick="ModuleLayout.toggleHidden('${scope}','${esc(String(id))}')" title="Ocultar widget">Ocultar</button>`:''}</div></div>`;
    },
    resizeHandleHTML(scope,id,label){
      if(!this.isActive(scope)) return '';
      return `<button type="button" class="module-resize-handle" data-module-resize-handle aria-label="Redimensionar ${esc(label||'módulo')}" title="Arraste para redimensionar"></button>`;
    },
    slotStyle(scope,id,defaultWidth=1){
      const size=this.itemSize(scope,id,{w:defaultWidth});
      if(this.isFreePlacement(scope)&&this.hasFreeFrame(scope,id)){
        const frame=this.freeFrame(scope,id);
        return `--module-span:${size.w};left:${frame.x}px;top:${frame.y}px;width:${frame.w}px;z-index:${frame.z};${frame.h?`height:${frame.h}px;--module-fixed-height:${frame.h}px;`:''}${this.isPendingPlacement(scope,id)?'visibility:hidden;pointer-events:none;':''}`;
      }
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
    captureFreeFrames(scope,grid){
      if(!this.isFreePlacement(scope)) return false;
      const layout=this.get(scope),gridRect=grid.getBoundingClientRect();
      let changed=false,index=0;
      grid.querySelectorAll(':scope > [data-module-id]').forEach(slot=>{
        const id=String(slot.dataset.moduleId),item=layout.items[id]||(layout.items[id]={}),rect=slot.getBoundingClientRect();
        if(!finiteNumber(item.pxX)){item.pxX=Math.max(0,Math.round(rect.left-gridRect.left));changed=true;}
        if(!finiteNumber(item.pxY)){item.pxY=Math.max(0,Math.round(rect.top-gridRect.top));changed=true;}
        if(!finiteNumber(item.pxW)||Number(item.pxW)<180){item.pxW=Math.max(180,Math.round(rect.width));changed=true;}
        if(!finiteNumber(item.z)){item.z=index+1;changed=true;}
        if(!finiteNumber(item.pxH)&&Number(item.h)>0){item.pxH=Math.max(120,Math.round(Number(item.h)));changed=true;}
        index++;
      });
      if(changed) this.save(scope,layout,{quiet:true});
      grid.classList.remove('module-free-bootstrap');
      this.applyFreeFrames(scope,grid);
      return changed;
    },
    applyFreeFrames(scope,grid){
      if(!this.isFreePlacement(scope)) return;
      grid.querySelectorAll(':scope > [data-module-id]').forEach(slot=>{
        const id=String(slot.dataset.moduleId),frame=this.freeFrame(scope,id,slot);
        if(!frame) return;
        const content=slot.querySelector(':scope > .module-layout-content');
        slot.style.position='absolute';
        slot.style.left=`${frame.x}px`;
        slot.style.top=`${frame.y}px`;
        slot.style.width=`${frame.w}px`;
        slot.style.zIndex=String(frame.z);
        slot.style.gridColumnStart='auto';
        slot.style.gridRowStart='auto';
        slot.style.gridRowEnd='auto';
        if(frame.h){
          slot.style.height=`${frame.h}px`;
          slot.style.setProperty('--module-fixed-height',`${frame.h}px`);
          if(content){content.style.height='100%';content.style.overflow='auto';}
        }else{
          slot.style.height='auto';
          slot.style.removeProperty('--module-fixed-height');
          if(content){content.style.height='auto';content.style.overflow='visible';}
        }
      });
      this.updateFreeCanvas(scope,grid);
    },
    updateFreeCanvas(scope,grid){
      if(!this.isFreePlacement(scope)||grid.classList.contains('module-free-bootstrap')) return;
      let bottom=180;
      grid.querySelectorAll(':scope > [data-module-id]').forEach(slot=>{
        const top=parseFloat(slot.style.top)||0;
        bottom=Math.max(bottom,top+Math.max(80,slot.offsetHeight||0));
      });
      grid.style.height=`${Math.ceil(bottom+24)}px`;
    },
    commitFreeFrame(scope,id,frame,{grid=null,slot=null,render=true}={}){
      if(!this.isFreePlacement(scope)) return;
      grid=grid||this.grid(scope);
      const layout=this.get(scope),key=String(id),item=layout.items[key]||(layout.items[key]={});
      const gridWidth=grid?Math.max(180,grid.getBoundingClientRect().width):Infinity;
      const w=Math.max(180,Math.round(Number(frame.w)||item.pxW||180));
      item.pxW=Number.isFinite(gridWidth)?Math.min(w,gridWidth):w;
      item.pxX=Math.max(0,Math.round(Number(frame.x)||0));
      if(Number.isFinite(gridWidth)) item.pxX=Math.min(item.pxX,Math.max(0,gridWidth-item.pxW));
      item.pxY=Math.max(0,Math.round(Number(frame.y)||0));
      if(Number(frame.h)>0){
        item.pxH=Math.max(120,Math.round(Number(frame.h)));
        item.h=item.pxH;
      }else{
        delete item.pxH;
        delete item.h;
      }
      item.z=finiteNumber(frame.z)?Math.max(0,Math.round(Number(frame.z))):this.maxZ(scope)+1;
      if(slot){
        slot.style.left=`${item.pxX}px`;
        slot.style.top=`${item.pxY}px`;
        slot.style.width=`${item.pxW}px`;
        slot.style.zIndex=String(item.z);
        if(item.pxH) slot.style.height=`${item.pxH}px`; else slot.style.height='auto';
      }
      this.save(scope,layout,{quiet:true,render});
      if(grid&&!render) this.updateFreeCanvas(scope,grid);
    },
    refresh(scope){
      if(this._refreshing.has(scope)) return;
      this._refreshing.add(scope);
      try{
        document.querySelectorAll(`[data-module-layout="${scope}"]`).forEach(grid=>{
          const free=this.isFreePlacement(scope);
          const bootstrap=free&&grid.classList.contains('module-free-bootstrap');
          if(free&&!bootstrap){
            this.applyFreeFrames(scope,grid);
            return;
          }
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
            const toolbarAllowance=free?0:(this.isActive(scope)?48:0);
            const height=Math.max(40,content.getBoundingClientRect().height+toolbarAllowance);
            const rows=Math.max(1,Math.ceil((height+gap)/(row+gap)));
            slot.dataset.moduleRows=String(rows);
            slot.style.gridRowEnd=`span ${rows}`;
          });
          if(free&&bootstrap) this.captureFreeFrames(scope,grid);
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
    if(event.target.closest('.module-size-controls,button,a,input,select,textarea,summary,[contenteditable="true"]')) return;
    const slot=handle.closest('[data-module-id]'),grid=slot&&slot.closest('[data-module-layout]');
    if(!slot||!grid) return;
    const scope=grid.dataset.moduleLayout;
    if(!ModuleLayout.isActive(scope)) return;
    event.preventDefault(); event.stopPropagation();

    if(ModuleLayout.isFreePlacement(scope)){
      if(grid.classList.contains('module-free-bootstrap')) ModuleLayout.captureFreeFrames(scope,grid);
      const pointerId=event.pointerId,id=String(slot.dataset.moduleId),gridRect=grid.getBoundingClientRect();
      const startFrame=ModuleLayout.freeFrame(scope,id,slot);
      if(!startFrame) return;
      const topZ=ModuleLayout.maxZ(scope)+1;
      let nextX=startFrame.x,nextY=startFrame.y,active=true,raf=0;
      slot.style.zIndex=String(topZ);
      slot.classList.add('module-dragging','module-spatial-dragging'); grid.classList.add('module-grid-dragging');
      const startX=event.clientX,startY=event.clientY;
      const paint=()=>{
        raf=0;
        slot.style.left=`${nextX}px`;
        slot.style.top=`${nextY}px`;
        ModuleLayout.updateFreeCanvas(scope,grid);
      };
      const move=ev=>{
        if(!active||ev.pointerId!==pointerId) return;
        if(ev.cancelable) ev.preventDefault();
        const maxX=Math.max(0,gridRect.width-startFrame.w);
        nextX=clamp(Math.round(startFrame.x+ev.clientX-startX),0,maxX);
        nextY=Math.max(0,Math.round(startFrame.y+ev.clientY-startY));
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
        ModuleLayout.commitFreeFrame(scope,id,{x:nextX,y:nextY,w:startFrame.w,h:startFrame.h,z:topZ},{grid,slot,render:true});
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

    if(ModuleLayout.isFreePlacement(scope)){
      if(grid.classList.contains('module-free-bootstrap')) ModuleLayout.captureFreeFrames(scope,grid);
      const pointerId=event.pointerId,id=String(slot.dataset.moduleId),content=slot.querySelector(':scope > .module-layout-content');
      const startFrame=ModuleLayout.freeFrame(scope,id,slot);
      if(!startFrame) return;
      const gridWidth=Math.max(180,grid.getBoundingClientRect().width),topZ=ModuleLayout.maxZ(scope)+1;
      const startX=event.clientX,startY=event.clientY;
      const naturalH=Math.max(120,slot.getBoundingClientRect().height||content&&content.getBoundingClientRect().height||240);
      let nextW=startFrame.w,nextH=startFrame.h||naturalH,active=true,raf=0;
      slot.style.zIndex=String(topZ);
      slot.classList.add('module-resizing');
      const paint=()=>{
        raf=0;
        slot.style.width=`${nextW}px`;
        slot.style.height=`${nextH}px`;
        slot.style.setProperty('--module-fixed-height',`${nextH}px`);
        if(content){content.style.height='100%';content.style.overflow='auto';}
        ModuleLayout.updateFreeCanvas(scope,grid);
      };
      const move=ev=>{
        if(!active||ev.pointerId!==pointerId) return;
        if(ev.cancelable) ev.preventDefault();
        const maxW=Math.max(180,gridWidth-startFrame.x);
        nextW=clamp(Math.round(startFrame.w+ev.clientX-startX),180,maxW);
        nextH=Math.max(120,Math.round((startFrame.h||naturalH)+(ev.clientY-startY)));
        if(!raf) raf=requestAnimationFrame(paint);
      };
      const cleanup=()=>{slot.classList.remove('module-resizing');if(raf)cancelAnimationFrame(raf);};
      const unbind=()=>{if(!active)return;active=false;document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',done);document.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);handle.removeEventListener('lostpointercapture',cancel);};
      const done=ev=>{
        if(!active||ev.pointerId!==pointerId) return;
        unbind();cleanup();
        ModuleLayout.commitFreeFrame(scope,id,{x:startFrame.x,y:startFrame.y,w:nextW,h:nextH,z:topZ},{grid,slot,render:true});
      };
      const cancel=ev=>{if(!active||(ev&&ev.pointerId!=null&&ev.pointerId!==pointerId))return;unbind();cleanup();if(typeof renderView==='function')renderView();};
      document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',done);document.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);handle.addEventListener('lostpointercapture',cancel);
      try{handle.setPointerCapture(pointerId);}catch(err){}
      return;
    }

    const pointerId=event.pointerId,layout=ModuleLayout.get(scope),id=slot.dataset.moduleId;
    const content=slot.querySelector(':scope > .module-layout-content');
    const gridStyle=getComputedStyle(grid),gap=parseFloat(gridStyle.columnGap)||8;
    const renderedColumns=(gridStyle.gridTemplateColumns||'').split(/\s+/).filter(Boolean).length||layout.columns;
    const activeColumns=Math.max(1,Math.min(layout.columns,renderedColumns));
    const gridWidth=grid.getBoundingClientRect().width;
    const colWidth=Math.max(1,(gridWidth-gap*(activeColumns-1))/activeColumns);
    const startSize=ModuleLayout.itemSize(scope,id);
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
