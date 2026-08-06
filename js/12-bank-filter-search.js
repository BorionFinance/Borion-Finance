/* Borion Finance — Filtro multibancos do topo e busca global. */

/* ---------------- Filtro Multi-Bancos (topo do app) ---------------- */
const BankFilter = {
  panelOpen:false,
  openMode:null,
  draftSelection:null,
  hoverCloseTimer:null,
  hoverDelayMs:180,
  supportsHover(evt){
    if(evt && evt.pointerType && evt.pointerType!=='mouse') return false;
    return !!(window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches);
  },
  cancelHoverClose(){
    if(this.hoverCloseTimer){ clearTimeout(this.hoverCloseTimer); this.hoverCloseTimer=null; }
  },
  beginDraft(){
    const values=S.bankFilter && S.bankFilter.size ? Array.from(S.bankFilter) : [];
    this.draftSelection=new Set(values);
  },
  selectionKey(value){
    return Array.from(value||[]).map(normalizeAccountName).filter(Boolean).sort().join('\u001f');
  },
  captureDraftFromPanel(){
    const panel=document.getElementById('bank-filter-panel');
    if(!panel) return;
    const checked=Array.from(panel.querySelectorAll('.bf-bank')).filter(cb=>cb.checked).map(cb=>cb.value);
    this.draftSelection=new Set(checked);
  },
  openHover(evt){
    if(!this.supportsHover(evt)) return;
    this.cancelHoverClose();
    if(this.panelOpen && this.openMode==='click') return;
    if(this.panelOpen && this.openMode==='hover') return;
    if(!this.panelOpen){ this.beginDraft(); }
    this.panelOpen=true;
    this.openMode='hover';
    this.renderPanel();
  },
  scheduleHoverClose(){
    if(!this.panelOpen || this.openMode!=='hover') return;
    this.cancelHoverClose();
    this.hoverCloseTimer=setTimeout(()=>{
      this.hoverCloseTimer=null;
      if(this.panelOpen && this.openMode==='hover') this.applyDraftAndClose();
    },this.hoverDelayMs);
  },
  togglePanel(evt){
    if(evt) evt.stopPropagation();
    this.cancelHoverClose();
    if(this.panelOpen){
      if(this.openMode==='hover'){
        this.captureDraftFromPanel();
        this.openMode='click';
        this.renderPanel();
      }else{
        this.closePanel({discard:true});
      }
      return;
    }
    this.beginDraft();
    this.panelOpen=true;
    this.openMode='click';
    this.renderPanel();
  },
  closePanel({discard=false}={}){
    this.cancelHoverClose();
    this.panelOpen=false;
    this.openMode=null;
    if(discard) this.draftSelection=null;
    const panel=document.getElementById('bank-filter-panel');
    if(panel) panel.remove();
  },
  applyDraftAndClose(){
    this.captureDraftFromPanel();
    const banks=bankFilterNames();
    const valid=new Map(banks.map(name=>[normalizeAccountName(name),name]));
    const selected=[];
    Array.from(this.draftSelection||[]).forEach(name=>{
      const canonical=valid.get(normalizeAccountName(name));
      if(canonical && !selected.some(x=>normalizeAccountName(x)===normalizeAccountName(canonical))) selected.push(canonical);
    });
    const next=selected.length?new Set(selected):null;
    const changed=this.selectionKey(S.bankFilter)!==this.selectionKey(next);
    S.bankFilter=next;
    this.closePanel();
    this.draftSelection=null;
    if(changed) renderApp();
  },
  clearAndClose(){
    const changed=this.selectionKey(S.bankFilter)!=='';
    this.draftSelection=new Set();
    S.bankFilter=null;
    this.closePanel();
    this.draftSelection=null;
    if(changed) renderApp();
  },
  renderPanel(){
    let panel = document.getElementById('bank-filter-panel');
    if(!this.panelOpen){ if(panel) panel.remove(); return; }
    if(!this.draftSelection) this.beginDraft();
    if(!panel){ panel = document.createElement('div'); panel.id='bank-filter-panel'; panel.className='bank-filter-panel'; document.body.appendChild(panel); }
    panel.classList.toggle('is-hover-preview',this.openMode==='hover');
    panel.classList.toggle('is-click-panel',this.openMode==='click');
    const banks = bankFilterNames();
    const validKeys = new Set(banks.map(normalizeAccountName));
    const selectedKeys = new Set(Array.from(this.draftSelection||[]).map(normalizeAccountName).filter(k=>validKeys.has(k)));
    const allSelected = selectedKeys.size===0;
    const actions=this.openMode==='click'?`
      <div class="bf-actions">
        <button class="btn-secondary btn-sm" id="bf_clear" style="flex:1;">Limpar</button>
        <button class="btn btn-primary btn-sm" id="bf_apply" style="flex:1;">Aplicar</button>
      </div>`:'';
    panel.innerHTML = `
      <div class="bf-head">Filtrar por banco</div>
      <label class="bf-row"><input type="checkbox" id="bf_all" ${allSelected?'checked':''}/> <b>Todos</b></label>
      ${banks.length? banks.map(b=>`<label class="bf-row"><input type="checkbox" class="bf-bank" value="${esc(b)}" ${(!allSelected && selectedKeys.has(normalizeAccountName(b)))?'checked':''}/> <span class="bf-dot" style="background:${bankColor(b)}"></span>${esc(b)}</label>`).join('') : '<div class="bf-empty">Cadastre bancos/contas em "Cartões e Contas".</div>'}
      ${actions}`;
    panel.onclick = e=>e.stopPropagation();
    panel.onmouseenter=()=>this.cancelHoverClose();
    panel.onmouseleave=()=>this.scheduleHoverClose();
    const allCb = panel.querySelector('#bf_all');
    const bankCbs = panel.querySelectorAll('.bf-bank');
    const syncDraft=()=>{
      const checked=Array.from(bankCbs).filter(cb=>cb.checked);
      if(!checked.length){ allCb.checked=true; this.draftSelection=new Set(); }
      else{ allCb.checked=false; this.draftSelection=new Set(checked.map(cb=>cb.value)); }
    };
    allCb.onchange = ()=>{
      if(allCb.checked){ bankCbs.forEach(cb=>cb.checked=false); this.draftSelection=new Set(); }
      else syncDraft();
    };
    bankCbs.forEach(cb=>{ cb.onchange = syncDraft; });
    const clearBtn=panel.querySelector('#bf_clear');
    if(clearBtn) clearBtn.onclick=()=>this.clearAndClose();
    const applyBtn = panel.querySelector('#bf_apply');
    if(applyBtn) applyBtn.onclick = ()=>this.applyDraftAndClose();
  },
  closePanelOnOutsideClick(){
    if(window.__borionBankFilterOutsideWired) return;
    window.__borionBankFilterOutsideWired=true;
    document.addEventListener('click', ()=>{
      if(!BankFilter.panelOpen) return;
      if(BankFilter.openMode==='hover') BankFilter.applyDraftAndClose();
      else BankFilter.closePanel({discard:true});
    });
  }
};

function checkOverdueModal(){
  const overdue = S.data.agenda.filter(a=>!a.pago && dateDiffDays(a.data, todayISO())<=-1);
  if(!overdue.length) return;
  const box = el(`
    <div class="modal-overlay">
      <div class="modal-box" style="max-width:400px;text-align:center;">
        <div style="font-size:38px;">⚠️</div>
        <h2 style="margin:10px 0 6px;">Atenção: contas em aberto</h2>
        <p class="modal-sub">Você tem ${overdue.length} lembrete(s) vencido(s) e ainda não marcados como pagos.</p>
        <div class="row-btns">
          <button class="btn btn-secondary" id="ov_close" style="flex:1;">Fechar</button>
          <button class="btn btn-primary" id="ov_goto" style="flex:1;">Ir para a agenda</button>
        </div>
      </div>
    </div>`);
  $('#modal-root').innerHTML=''; $('#modal-root').appendChild(box);
  attachModalGuard(box);
  $('#ov_close').onclick = closeModal;
  $('#ov_goto').onclick = ()=>{ closeModal(); Nav.go('agenda'); };
}

/* ---------------- Busca global ---------------- */
const GlobalSearch = {
  onInput(){
    const input = $('#global_search');
    const box = $('#global_search_results');
    if(!input || !box) return;
    const q = input.value.trim().toLowerCase();
    if(!q){ box.classList.add('hidden'); box.innerHTML=''; return; }
    const results = this.search(q);
    box.innerHTML = results.length
      ? results.map(r=>`<button type="button" class="search-result-item" data-view="${r.view}" data-tab="${r.tab||''}"><span class="sri-type">${esc(r.type)}</span>${esc(r.text)}</button>`).join('')
      : '<div class="search-result-item">Nada encontrado.</div>';
    box.querySelectorAll('.search-result-item[data-view]').forEach(btn=>{
      btn.onclick = ()=> GlobalSearch.goTo(btn.dataset.view, btn.dataset.tab);
    });
    box.classList.remove('hidden');
  },
  search(q){
    const out = [];
    S.data.transacoes.forEach(t=>{
      if(t.nome.toLowerCase().includes(q) || t.categoria.toLowerCase().includes(q)){
        out.push({type:t.tipo==='receita'?'Receita':'Despesa variável', text:t.nome+' — '+brlText(t.valor), view:'budget', tab:t.tipo});
      }
    });
    S.data.fixas.forEach(f=>{
      if(f.nome.toLowerCase().includes(q) || f.categoria.toLowerCase().includes(q)){
        out.push({type:'Despesa fixa', text:f.nome+' — '+brlText(f.valor), view:'budget', tab:'fixa'});
      }
    });
    S.data.cartoes.forEach(c=>{
      if(c.banco.toLowerCase().includes(q)) out.push({type:'Cartão', text:c.banco, view:'cards'});
      c.parcelas.forEach(p=>{
        if(p.descricao.toLowerCase().includes(q) || (p.local||'').toLowerCase().includes(q)){
          out.push({type:'Compra parcelada · '+c.banco, text:p.descricao+' — '+brlText(p.valorParcela)+'/mês', view:'cards'});
        }
      });
    });
    S.data.contas.forEach(a=>{ if((a.nome||'').toLowerCase().includes(q)) out.push({type:'Conta bancária', text:a.nome+' — '+brlText(contaSaldoAtual(a)), view:'cards'}); });
    Object.keys(S.data.categorias).forEach(tipo=>{
      S.data.categorias[tipo].forEach(c=>{ if(c.toLowerCase().includes(q)) out.push({type:'Categoria', text:c, view:'budget', tab:tipo}); });
    });
    S.data.agenda.forEach(a=>{ if(a.titulo.toLowerCase().includes(q)) out.push({type:'Agenda', text:a.titulo+' — '+a.data.slice(8,10)+'/'+a.data.slice(5,7), view:'agenda'}); });
    saldoContasDetalhe().filter(l=>l.tipo==='manual').forEach(l=>{ if(l.nome.toLowerCase().includes(q)) out.push({type:'Saldo em contas', text:l.nome+' — '+brlText(l.valor), view:'patrimony'}); });
    S.data.bens.forEach(b=>{ if(b.nome.toLowerCase().includes(q)) out.push({type:'Bem', text:b.nome+' — '+brlText(b.valor), view:'patrimony'}); });
    (S.data.metas||[]).forEach(mt=>{ if(mt.nome.toLowerCase().includes(q)) out.push({type:'Meta', text:mt.nome+' — '+brlText(mt.valorAtual)+' / '+brlText(mt.valorMeta), view:'patrimony'}); });
    S.data.investimentos.ativos.forEach(a=>{ if(a.nome.toLowerCase().includes(q)) out.push({type:'Investimento', text:a.nome+' — '+brlText(a.atual), view:'investments'}); });
    return out.slice(0,20);
  },
  goTo(view, tab){
    const box = $('#global_search_results'); if(box){ box.classList.add('hidden'); }
    const input = $('#global_search'); if(input) input.value='';
    S.view = view;
    if(tab && view==='budget') S.budgetTab = tab;
    renderApp();
  },
  outsideClickHandler(e){
    const box = $('#global_search_results');
    const input = $('#global_search');
    if(!box || !input) return;
    if(e.target!==input && !box.contains(e.target)) box.classList.add('hidden');
  }
};
