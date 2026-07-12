/* Borion Finance — Sistema de modais, formulário genérico e criação rápida de categorias. */

/* ---------------- Modal system (generic CRUD forms) ---------------- */
function closeModal(){ $('#modal-root').innerHTML=''; }

function attachModalGuard(overlay){
  if(!overlay) return;
  overlay.addEventListener('click', e=>{
    if(e.target===overlay){
      e.preventDefault();
      e.stopPropagation();
      const modal = overlay.querySelector('.modal-box');
      if(modal){
        modal.classList.remove('modal-nudge');
        void modal.offsetWidth;
        modal.classList.add('modal-nudge');
      }
    }
  });
}

(function wireModalEscClose(){
  if(window.__borionModalEscCloseWired) return;
  window.__borionModalEscCloseWired = true;
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape'){
      const root = document.getElementById('modal-root');
      if(root && root.children.length){
        e.preventDefault();
        closeModal();
      }
    }
  });
})();

function openModal({title, sub, fields, values={}, saveLabel, onSave, onDelete, deleteLabel, extraHTML}){
  const moneyFields=[];
  function fieldInitialVal(f){ return values[f.key]!=null ? values[f.key] : (f.default!=null?f.default:''); }
  const body = fields.map(f=>{
    const val = fieldInitialVal(f);
    let fieldHtml;
    if(f.type==='select'){
      const opts = (f.options||[]).map(o=>{ const value=(o&&typeof o==='object')?o.value:o; const label=(o&&typeof o==='object')?o.label:o; return `<option value="${esc(value)}" ${String(value)===String(val)?'selected':''}>${esc(label)}</option>`; }).join('');
      fieldHtml = `<div class="field"><label>${esc(f.label)}</label><select id="mf_${f.key}">${opts}</select></div>`;
    } else if(f.type==='checkbox'){
      fieldHtml = `<div class="field-check"><input type="checkbox" id="mf_${f.key}" ${val?'checked':''}/> <label style="margin:0;" for="mf_${f.key}">${esc(f.label)}</label></div>`;
    } else if(f.type==='money'){
      moneyFields.push({key:f.key, initial: val===''?0:val});
      fieldHtml = `<div class="field"><label>${esc(f.label)}</label><input type="text" inputmode="numeric" class="money-input" id="mf_${f.key}" placeholder="0,00"/></div>`;
    } else if(f.type==='color'){
      fieldHtml = `<div class="field"><label>${esc(f.label)}</label><input type="color" id="mf_${f.key}" value="${val?esc(val):'#3b6bf0'}"/></div>`;
    } else if(f.type==='password'){
      fieldHtml = passwordInputWrapHTML({id:'mf_'+f.key,label:f.label,value:val||'',autocomplete:f.autocomplete||'',placeholder:f.placeholder||''});
    } else if(f.type==='segmented'){
      /* V5.39.0 — alternador estilo "on/off" com 2+ opções nomeadas (ex: Despesa fixa
         vs Despesa variável), em vez de um <select> tradicional. */
      const opts = f.options.map(o=>`<button type="button" class="seg-btn ${String(val)===String(o.value)?'active':''}" data-value="${esc(o.value)}">${esc(o.label)}</button>`).join('');
      fieldHtml = `<div class="field"><label>${esc(f.label)}</label><div class="segmented-toggle" id="mf_${f.key}_group">${opts}</div><input type="hidden" id="mf_${f.key}" value="${esc(val)}"/></div>`;
    } else {
      fieldHtml = `<div class="field"><label>${esc(f.label)}</label><input type="${f.type||'text'}" id="mf_${f.key}" value="${val!=null?esc(val):''}" ${f.step?`step="${f.step}"`:''} placeholder="${esc(f.placeholder||'')}"/></div>`;
    }
    if(f.visibleWhen){
      const depField = fields.find(ff=>ff.key===f.visibleWhen.key);
      const depVal = depField ? fieldInitialVal(depField) : undefined;
      const matches = String(depVal)===String(f.visibleWhen.value);
      return `<div class="mf-conditional ${matches?'':'hidden'}" data-mf-cond-key="${esc(f.visibleWhen.key)}" data-mf-cond-value="${esc(String(f.visibleWhen.value))}">${fieldHtml}</div>`;
    }
    return fieldHtml;
  }).join('');

  const box = el(`
  <div class="modal-overlay">
    <div class="modal-box">
      <div class="modal-head"><h2>${esc(title)}</h2><button id="mf_close">&times;</button></div>
      ${sub?`<p class="modal-sub">${esc(sub)}</p>`:''}
      <div id="mf_body">${body}</div>
      ${extraHTML||''}
      <div class="row-btns" style="margin-top:10px;">
        <button class="btn btn-primary btn-block" id="mf_save">${esc(saveLabel||'Salvar')}</button>
      </div>
      ${onDelete?`<div class="row-btns" style="margin-top:8px;"><button class="btn btn-danger btn-block" id="mf_delete">${esc(deleteLabel||'Excluir')}</button></div>`:''}
    </div>
  </div>`);
  $('#modal-root').innerHTML='';
  $('#modal-root').appendChild(box);
  attachModalGuard(box);
  $('#mf_close').onclick = closeModal;
  moneyFields.forEach(mf=> attachMoneyMask(document.getElementById('mf_'+mf.key), mf.initial));

  /* Segmented toggle: clique num botão troca o valor do input escondido e a classe ativa. */
  fields.filter(f=>f.type==='segmented').forEach(f=>{
    const group = document.getElementById('mf_'+f.key+'_group');
    const hidden = document.getElementById('mf_'+f.key);
    if(!group || !hidden) return;
    group.querySelectorAll('.seg-btn').forEach(btn=>{
      btn.onclick = ()=>{
        group.querySelectorAll('.seg-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        hidden.value = btn.dataset.value;
        hidden.dispatchEvent(new Event('change', {bubbles:true}));
      };
    });
  });

  /* Campos condicionais: qualquer campo com visibleWhen aparece/some conforme o valor
     atual do campo do qual ele depende (checkbox, select ou segmented). */
  fields.forEach(f=>{
    const node = document.getElementById('mf_'+f.key);
    if(!node) return;
    const evtName = (f.type==='checkbox' || f.type==='select') ? 'change' : (f.type==='segmented' ? 'change' : 'input');
    node.addEventListener(evtName, ()=>{
      const curVal = f.type==='checkbox' ? node.checked : node.value;
      document.querySelectorAll(`[data-mf-cond-key="${f.key}"]`).forEach(wrap=>{
        const want = wrap.getAttribute('data-mf-cond-value');
        const matches = String(curVal)===want;
        wrap.classList.toggle('hidden', !matches);
      });
    });
  });

  $('#mf_save').onclick = ()=>{
    const out = {};
    fields.forEach(f=>{
      const node = document.getElementById('mf_'+f.key);
      if(!node) return;
      if(f.type==='checkbox') out[f.key]=node.checked;
      else if(f.type==='money') out[f.key]=parseInt(node.dataset.cents||'0',10)/100;
      else if(f.type==='number') out[f.key]=parseFloat((node.value||'0').replace(',','.'))||0;
      else out[f.key]=node.value;
    });
    onSave(out);
  };
  if(onDelete){
    $('#mf_delete').onclick = ()=>{
      const snapshot = JSON.parse(JSON.stringify(S.data));
      const result=onDelete();
      if(result===false) return;
      showUndoToast('Item excluído.', ()=>{ S.data = snapshot; saveCurrentData(); renderView(); });
    };
  }
}

/* ------- shared: confirmation modal (substitui window.confirm() nativo) -------
   Uso:
   openConfirmModal({
     title: 'Excluir item',
     text: 'Tem certeza que deseja excluir isso?',
     confirmLabel: 'Excluir',      // opcional, padrão 'Confirmar'
     cancelLabel: 'Cancelar',      // opcional
     variant: 'danger' | 'gold',   // opcional, padrão 'danger'
     onConfirm(){ ... }            // executado só se o usuário confirmar
   });
   Cancelar, X, ESC e clique fora nunca chamam onConfirm. */
function openConfirmModal({title, text, confirmLabel, cancelLabel, variant='danger', onConfirm}){
  const isDanger = variant!=='gold';
  const box = el(`
  <div class="modal-overlay">
    <div class="modal-box confirm-box ${isDanger?'confirm-danger':'confirm-gold'}">
      <div class="modal-head"><h2>${esc(title||'Confirmar ação')}</h2><button id="cf_close">&times;</button></div>
      <p class="confirm-text">${esc(text||'Tem certeza que deseja continuar?')}</p>
      <div class="confirm-actions">
        <button class="btn btn-secondary btn-block" id="cf_cancel">${esc(cancelLabel||'Cancelar')}</button>
        <button class="btn ${isDanger?'btn-danger-solid':'btn-primary'} btn-block" id="cf_confirm">${esc(confirmLabel||'Confirmar')}</button>
      </div>
    </div>
  </div>`);
  $('#modal-root').innerHTML='';
  $('#modal-root').appendChild(box);
  attachModalGuard(box);
  $('#cf_close').onclick = closeModal;
  $('#cf_cancel').onclick = closeModal;
  $('#cf_confirm').onclick = ()=>{ closeModal(); if(onConfirm) onConfirm(); };
}

/* ------- shared: choice modal (e.g. substituir vs mesclar ao importar) ------- */
function openChoiceModal({title, sub, choices}){
  const btns = choices.map((c,i)=>`<button class="choice-btn ${c.variant==='danger'?'danger':''}" data-i="${i}">${esc(c.label)}${c.desc?`<span class="cb-desc">${esc(c.desc)}</span>`:''}</button>`).join('');
  const box = el(`
    <div class="modal-overlay">
      <div class="modal-box">
        <div class="modal-head"><h2>${esc(title)}</h2><button id="cm_close">&times;</button></div>
        ${sub?`<p class="modal-sub">${esc(sub)}</p>`:''}
        <div>${btns}</div>
      </div>
    </div>`);
  $('#modal-root').innerHTML='';
  $('#modal-root').appendChild(box);
  attachModalGuard(box);
  $('#cm_close').onclick = closeModal;
  box.querySelectorAll('.choice-btn').forEach((btn,i)=>{
    btn.onclick = ()=> choices[i].onClick();
  });
}

/* ------- shared: inline "quick create category" wiring for select elements ------- */
function wireQuickCategory(selectEl, boxEl, inputEl, addBtnEl, typeKey){
  selectEl.onchange = ()=>{
    if(selectEl.value==='__new__'){ boxEl.classList.remove('hidden'); inputEl.focus(); }
    else boxEl.classList.add('hidden');
  };
  addBtnEl.onclick = ()=>{
    const name = inputEl.value.trim();
    if(!name) return;
    if(!S.data.categorias[typeKey].includes(name)){
      S.data.categorias[typeKey].push(name);
      setCategoryColor(typeKey, name, baseCatColor(name));
      saveCurrentData();
    }
    selectEl.innerHTML = S.data.categorias[typeKey].map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('') + `<option value="__new__">➕ Criar nova categoria...</option>`;
    selectEl.value = name;
    boxEl.classList.add('hidden');
    inputEl.value='';
    toast('Categoria criada.');
  };
}
function categorySelectHTML(idPrefix, typeKey, selected){
  const cats = S.data.categorias[typeKey];
  const opts = cats.map(c=>`<option value="${esc(c)}" ${selected===c?'selected':''}>${esc(c)}</option>`).join('');
  return `
    <div class="field">
      <label>Categoria</label>
      <select id="${idPrefix}_categoria">${opts}<option value="__new__">➕ Criar nova categoria...</option></select>
      <div id="${idPrefix}_newcat_box" class="quickcat-box hidden">
        <input type="text" id="${idPrefix}_newcat_input" placeholder="Nome da nova categoria">
        <button class="btn btn-primary btn-sm" id="${idPrefix}_newcat_add" type="button">Adicionar</button>
      </div>
    </div>`;
}
