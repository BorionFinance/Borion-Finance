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
  const body = fields.map(f=>{
    const val = values[f.key]!=null ? values[f.key] : (f.default!=null?f.default:'');
    if(f.type==='select'){
      const opts = f.options.map(o=>`<option value="${esc(o)}" ${String(o)===String(val)?'selected':''}>${esc(o)}</option>`).join('');
      return `<div class="field"><label>${esc(f.label)}</label><select id="mf_${f.key}">${opts}</select></div>`;
    }
    if(f.type==='checkbox'){
      return `<div class="field-check"><input type="checkbox" id="mf_${f.key}" ${val?'checked':''}/> <label style="margin:0;" for="mf_${f.key}">${esc(f.label)}</label></div>`;
    }
    if(f.type==='money'){
      moneyFields.push({key:f.key, initial: val===''?0:val});
      return `<div class="field"><label>${esc(f.label)}</label><input type="text" inputmode="numeric" class="money-input" id="mf_${f.key}" placeholder="0,00"/></div>`;
    }
    if(f.type==='color'){
      return `<div class="field"><label>${esc(f.label)}</label><input type="color" id="mf_${f.key}" value="${val?esc(val):'#3b6bf0'}"/></div>`;
    }
    return `<div class="field"><label>${esc(f.label)}</label><input type="${f.type||'text'}" id="mf_${f.key}" value="${val!=null?esc(val):''}" ${f.step?`step="${f.step}"`:''} placeholder="${esc(f.placeholder||'')}"/></div>`;
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
      onDelete();
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
