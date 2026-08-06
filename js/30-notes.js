/* Borion Finance 7.0 — Notas completas.
   Módulo separado de Anotações flutuantes: múltiplas abas, editor formatado,
   emojis e salvamento dentro do perfil/Google Drive. */
(function(global){
  'use strict';

  const FONT_CHOICES = [
    {value:'',label:'Fonte padrão'},
    {value:'Arial',label:'Arial'},
    {value:'Georgia',label:'Georgia'},
    {value:'Trebuchet MS',label:'Trebuchet'},
    {value:'Verdana',label:'Verdana'},
    {value:'Courier New',label:'Monoespaçada'}
  ];
  const FONT_SIZES = [
    {value:'2',label:'Pequena'},
    {value:'3',label:'Normal'},
    {value:'4',label:'Média'},
    {value:'5',label:'Grande'},
    {value:'6',label:'Título'}
  ];
  const EMOJIS = ['😀','😄','😂','😍','🥰','😎','🤔','😴','🥳','✅','⚠️','❌','⭐','🔥','💡','📌','📎','📝','📅','⏰','💰','💳','🏦','📈','📉','🎯','🏠','🚗','✈️','🎁','❤️','👍','🙏','🚀','✨','🔒','🔔','🧾','📦','🛒'];
  const ALLOWED_TAGS = new Set(['DIV','P','BR','B','STRONG','I','EM','U','S','STRIKE','UL','OL','LI','BLOCKQUOTE','SPAN','FONT','H1','H2','H3']);
  const ALLOWED_FONTS = new Set(FONT_CHOICES.map(x=>x.value).filter(Boolean));
  const NOTES_FAST_DRAFT_PREFIX = 'borion_notes_fast_draft_v700_';
  const NOTES_FULL_SAVE_INTERVAL_MS = 160;

  function now(){ return Date.now(); }
  function notesEnabled(){ return !!(typeof S!=='undefined'&&S.data&&S.data.modules&&S.data.modules.notes!==false); }
  function blankNote(title='Nova nota'){
    return {id:typeof uid==='function'?uid():'note_'+Date.now()+'_'+Math.random().toString(36).slice(2),title,content:'',createdAt:now(),updatedAt:now()};
  }
  function cleanTitle(value){
    const text=String(value||'').replace(/\s+/g,' ').trim().slice(0,120);
    return text||'Sem título';
  }
  function safeColor(value){ return /^#[0-9a-f]{6}$/i.test(String(value||''))?String(value):''; }
  function sanitizeStyle(styleText){
    const safe=[];
    String(styleText||'').split(';').forEach(part=>{
      const idx=part.indexOf(':'); if(idx<0)return;
      const prop=part.slice(0,idx).trim().toLowerCase();
      const value=part.slice(idx+1).trim();
      if(!value || /url\s*\(|expression\s*\(|javascript:/i.test(value))return;
      if((prop==='color'||prop==='background-color') && (/^#[0-9a-f]{3,8}$/i.test(value)||/^rgba?\([\d\s.,%]+\)$/i.test(value))) safe.push(prop+':'+value);
      else if(prop==='font-family'){
        const normalized=value.replace(/["']/g,'').split(',')[0].trim();
        if(ALLOWED_FONTS.has(normalized))safe.push('font-family:'+normalized);
      }else if(prop==='font-size' && /^(?:[8-9]|[1-3]\d|40)px$/.test(value)) safe.push('font-size:'+value);
      else if(prop==='text-align' && /^(left|center|right|justify)$/.test(value)) safe.push('text-align:'+value);
      else if(prop==='font-weight' && /^(bold|[5-9]00)$/.test(value)) safe.push('font-weight:'+value);
      else if(prop==='font-style' && value==='italic') safe.push('font-style:italic');
      else if(prop==='text-decoration' && /^(underline|line-through)$/.test(value)) safe.push('text-decoration:'+value);
    });
    return safe.join(';');
  }
  function sanitizeHTML(html){
    const template=document.createElement('template');
    template.innerHTML=String(html||'');
    Array.from(template.content.querySelectorAll('*')).forEach(node=>{
      if(!ALLOWED_TAGS.has(node.tagName)){
        node.replaceWith(...Array.from(node.childNodes));
        return;
      }
      Array.from(node.attributes).forEach(attr=>{
        const name=attr.name.toLowerCase();
        let keep=false;
        if(name==='style'){
          const cleaned=sanitizeStyle(attr.value);
          if(cleaned){node.setAttribute('style',cleaned);keep=true;}
        }else if(node.tagName==='FONT'&&name==='color'){
          const c=safeColor(attr.value);if(c){node.setAttribute('color',c);keep=true;}
        }else if(node.tagName==='FONT'&&name==='face'){
          const f=String(attr.value||'').replace(/["']/g,'').split(',')[0].trim();if(ALLOWED_FONTS.has(f)){node.setAttribute('face',f);keep=true;}
        }else if(node.tagName==='FONT'&&name==='size'){
          if(/^[1-7]$/.test(String(attr.value||''))){node.setAttribute('size',attr.value);keep=true;}
        }
        if(!keep)node.removeAttribute(attr.name);
      });
    });
    return template.innerHTML;
  }
  function plainText(html){
    const div=document.createElement('div');div.innerHTML=sanitizeHTML(html);return (div.textContent||'').replace(/\s+/g,' ').trim();
  }
  function formatDate(ts){
    if(!ts)return 'Agora';
    try{return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(ts));}
    catch(_){return 'Agora';}
  }

  const Notes={
    _saveTimer:null,
    _savedRange:null,
    _createdScheduled:false,
    _lastFullSaveAt:0,
    _lastFullSaveProfileId:null,
    _dirty:false,
    _draftAppliedProfileId:null,
    profileId(){
      try{return S&&S.currentProfile&&S.currentProfile.id!=null?String(S.currentProfile.id):'';}catch(_){return '';}
    },
    draftKey(profileId=this.profileId()){return NOTES_FAST_DRAFT_PREFIX+encodeURIComponent(String(profileId||''));},
    writeFastDraft(note,reason='notes_input'){
      this.clearFastDraft();
      return false;
    },
    readFastDraft(profileId=this.profileId()){
      this.clearFastDraft(profileId);
      return null;
    },
    clearFastDraft(profileId=this.profileId()){
      if(!profileId)return;
      try{localStorage.removeItem(this.draftKey(profileId));}catch(_){ }
    },
    applyFastDraft(store){
      return false;
    },
    ensureStore(){
      if(!S.data.notes||typeof S.data.notes!=='object'||Array.isArray(S.data.notes))S.data.notes={items:[],activeId:null};
      if(!Array.isArray(S.data.notes.items))S.data.notes.items=[];
      let changed=false;
      S.data.notes.items=S.data.notes.items.filter(Boolean).map((note,index)=>{
        const normalized={
          id:String(note.id||(typeof uid==='function'?uid():'note_'+now()+'_'+index)),
          title:cleanTitle(note.title||'Nota'),
          content:sanitizeHTML(note.content||''),
          createdAt:Number(note.createdAt)||now(),
          updatedAt:Number(note.updatedAt)||Number(note.createdAt)||now()
        };
        if(!note.id||note.title!==normalized.title||note.content!==normalized.content)changed=true;
        return normalized;
      });
      if(!S.data.notes.items.length){
        S.data.notes.items.push(blankNote('Primeira nota'));
        changed=true;
      }
      if(this.applyFastDraft(S.data.notes))changed=true;
      if(!S.data.notes.items.some(n=>String(n.id)===String(S.data.notes.activeId))){S.data.notes.activeId=S.data.notes.items[0].id;changed=true;}
      if(changed&&!this._createdScheduled){
        this._createdScheduled=true;
        setTimeout(()=>{
          this._createdScheduled=false;
          try{
            const accepted=saveCurrentData({skipPatrimonioSnapshot:true});
            if(accepted!==false){this._lastFullSaveAt=now();this._lastFullSaveProfileId=this.profileId();this._dirty=false;this.clearFastDraft();}
          }catch(_){ }
        },0);
      }
      return S.data.notes;
    },
    active(){
      const store=this.ensureStore();
      return store.items.find(n=>String(n.id)===String(store.activeId))||store.items[0];
    },
    render(){
      if(!notesEnabled())return `<div class="panel-box"><h3 class="panel-title">Notas</h3><p class="empty-note">O módulo de Notas está desativado. Ative em Configurações para usar esta área.</p><button class="btn btn-primary btn-sm" onclick="Nav.go('settings')">Abrir Configurações</button></div>`;
      const store=this.ensureStore();
      const active=this.active();
      const tabs=store.items.slice().sort((a,b)=>(Number(b.updatedAt)||0)-(Number(a.updatedAt)||0)).map(note=>{
        const preview=plainText(note.content).slice(0,62)||'Nota vazia';
        return `<button type="button" class="notes-tab ${String(note.id)===String(active.id)?'active':''}" onclick="BorionNotes.select('${esc(note.id)}')">
          <span class="notes-tab-title">${esc(note.title)}</span>
          <span class="notes-tab-preview">${esc(preview)}</span>
        </button>`;
      }).join('');
      const fontOptions=FONT_CHOICES.map(x=>`<option value="${esc(x.value)}">${esc(x.label)}</option>`).join('');
      const sizeOptions=FONT_SIZES.map(x=>`<option value="${esc(x.value)}" ${x.value==='3'?'selected':''}>${esc(x.label)}</option>`).join('');
      const emojiButtons=EMOJIS.map(e=>`<button type="button" onmousedown="event.preventDefault()" onclick="BorionNotes.insertEmoji('${e}')" aria-label="Inserir ${e}">${e}</button>`).join('');
      return `<div class="notes-shell">
        <aside class="notes-sidebar">
          <div class="notes-sidebar-head"><div><strong>Minhas notas</strong><span>${store.items.length} aba${store.items.length===1?'':'s'}</span></div><button type="button" class="notes-add-btn" onclick="BorionNotes.create()" title="Criar nova nota">+</button></div>
          <div class="notes-tabs">${tabs}</div>
        </aside>
        <section class="notes-editor-card" data-borion-form-id="notes_editor">
          <div class="notes-document-head">
            <input class="notes-title-input" maxlength="120" value="${esc(active.title)}" oninput="BorionNotes.renameInput(this.value)" onblur="BorionNotes.flush()" aria-label="Título da nota"/>
            <div class="notes-document-actions"><span id="borion_notes_save_state">Salvo em ${esc(formatDate(active.updatedAt))}</span><button type="button" class="btn-outline btn-sm" onclick="BorionNotes.duplicate()">Duplicar</button><button type="button" class="btn-outline btn-sm danger-text" onclick="BorionNotes.remove()">Excluir</button></div>
          </div>
          <div class="notes-toolbar" role="toolbar" aria-label="Formatação da nota">
            <div class="notes-tool-group">
              <button type="button" onmousedown="event.preventDefault()" onclick="BorionNotes.command('undo')" title="Desfazer">↶</button>
              <button type="button" onmousedown="event.preventDefault()" onclick="BorionNotes.command('redo')" title="Refazer">↷</button>
            </div>
            <div class="notes-tool-group">
              <button type="button" class="notes-tool-bold" onmousedown="event.preventDefault()" onclick="BorionNotes.command('bold')" title="Negrito"><b>B</b></button>
              <button type="button" onmousedown="event.preventDefault()" onclick="BorionNotes.command('italic')" title="Itálico"><i>I</i></button>
              <button type="button" onmousedown="event.preventDefault()" onclick="BorionNotes.command('underline')" title="Sublinhado"><u>U</u></button>
              <button type="button" onmousedown="event.preventDefault()" onclick="BorionNotes.command('strikeThrough')" title="Tachado"><s>S</s></button>
            </div>
            <div class="notes-tool-group notes-tool-selects">
              <select aria-label="Fonte" onchange="BorionNotes.font(this.value);this.selectedIndex=0">${fontOptions}</select>
              <select aria-label="Tamanho" onchange="BorionNotes.command('fontSize',this.value)">${sizeOptions}</select>
            </div>
            <div class="notes-tool-group notes-color-tools">
              <label title="Cor da letra"><span>A</span><input type="color" value="#e7ebef" oninput="BorionNotes.color('foreColor',this.value)"/></label>
              <label title="Marca-texto"><span class="notes-highlight-icon">A</span><input type="color" value="#d9b46b" oninput="BorionNotes.color('hiliteColor',this.value)"/></label>
            </div>
            <div class="notes-tool-group">
              <button type="button" onmousedown="event.preventDefault()" onclick="BorionNotes.command('justifyLeft')" title="Alinhar à esquerda">≡</button>
              <button type="button" onmousedown="event.preventDefault()" onclick="BorionNotes.command('justifyCenter')" title="Centralizar">≣</button>
              <button type="button" onmousedown="event.preventDefault()" onclick="BorionNotes.command('justifyRight')" title="Alinhar à direita">≡</button>
              <button type="button" onmousedown="event.preventDefault()" onclick="BorionNotes.command('insertUnorderedList')" title="Lista com marcadores">•☰</button>
              <button type="button" onmousedown="event.preventDefault()" onclick="BorionNotes.command('insertOrderedList')" title="Lista numerada">1☰</button>
            </div>
            <div class="notes-tool-group notes-emoji-wrap">
              <button type="button" onmousedown="event.preventDefault()" onclick="BorionNotes.toggleEmoji(event)" title="Inserir emoji">😊</button>
              <div class="notes-emoji-menu" id="borion_notes_emoji_menu">${emojiButtons}</div>
            </div>
            <div class="notes-tool-group">
              <button type="button" onmousedown="event.preventDefault()" onclick="BorionNotes.command('removeFormat')" title="Limpar formatação">Tx</button>
            </div>
          </div>
          <div id="borion_notes_editor" class="notes-editor" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="Escreva sua nota..." oninput="BorionNotes.editorInput(this)" onkeyup="BorionNotes.captureSelection()" onmouseup="BorionNotes.captureSelection()" onfocus="BorionNotes.captureSelection()" onpaste="BorionNotes.paste(event)" onblur="BorionNotes.flush()">${sanitizeHTML(active.content)}</div>
          <div class="notes-footer"><span>Salvamento automático no perfil atual</span><span>${esc(formatDate(active.updatedAt))}</span></div>
        </section>
      </div>`;
    },
    editor(){return document.getElementById('borion_notes_editor');},
    isEditorFocused(){
      const active=document.activeElement;
      if(!active)return false;
      return active.id==='borion_notes_editor'||!!(active.classList&&active.classList.contains('notes-title-input'));
    },
    // v7.0 NOTAS ESTÁVEL — enquanto a pessoa está digitando, o card fica marcado
    // como "sujo" pro BorionEditGuard (mesma proteção que já existia para modais
    // de lançamento e para a aba Configurações > Integrações). Isso impede que uma
    // atualização remota (outro dispositivo, ou o poll de sincronização ao vivo)
    // repinte a tela por cima da nota e apague o que ainda não foi confirmado.
    // Só libera a trava quando o foco sai do título/editor, deixando a atualização
    // pendente ser aplicada com segurança logo em seguida.
    releaseGuardIfIdle(){
      try{if(!this.isEditorFocused()&&window.BorionEditGuard)BorionEditGuard.markClean('notes_editor');}catch(_){ }
    },
    current(){return this.active();},
    markSaving(){const el=document.getElementById('borion_notes_save_state');if(el){el.textContent='Salvando…';el.classList.add('is-saving');}},
    markSaved(){const note=this.current();const el=document.getElementById('borion_notes_save_state');if(el){el.textContent='Salvo em '+formatDate(note.updatedAt);el.classList.remove('is-saving');}},
    scheduleSave(reason='notes_input'){
      const note=this.current();
      if(!note)return;
      this._dirty=true;
      this.markSaving();
      this.writeFastDraft(note,reason);
      clearTimeout(this._saveTimer);
      const profileId=this.profileId();
      if(this._lastFullSaveProfileId!==profileId)this._lastFullSaveAt=0;
      const elapsed=now()-Number(this._lastFullSaveAt||0);
      if(elapsed>=NOTES_FULL_SAVE_INTERVAL_MS){
        this.flush({reason,keepFocus:true});
        return;
      }
      this._saveTimer=setTimeout(()=>this.flush({reason:'notes_trailing',keepFocus:true}),Math.max(0,NOTES_FULL_SAVE_INTERVAL_MS-elapsed));
    },
    editorInput(el){
      const note=this.current(); if(!note)return;
      note.content=sanitizeHTML(el.innerHTML); note.updatedAt=now(); this.captureSelection(); this.scheduleSave('notes_editor_input');
    },
    paste(event){
      if(!event||!event.clipboardData)return;
      event.preventDefault();
      const html=event.clipboardData.getData('text/html');
      const text=event.clipboardData.getData('text/plain');
      const payload=html?sanitizeHTML(html):String(text||'').replace(/[&<>]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch])).replace(/\r?\n/g,'<br>');
      this.restoreSelection();
      try{document.execCommand('insertHTML',false,payload);}catch(_){document.execCommand('insertText',false,text||'');}
      const editor=this.editor();if(editor)this.editorInput(editor);
    },
    renameInput(value){
      const note=this.current();if(!note)return;
      note.title=cleanTitle(value);note.updatedAt=now();this.scheduleSave('notes_title_input');
    },
    flush(options={}){
      clearTimeout(this._saveTimer);this._saveTimer=null;
      const editor=this.editor(),note=this.current();
      // V7.1.3 — options.skipCapture evita reler o innerHTML do editor. Usado pela 2ª chamada de
      // flush() dentro de create()/duplicate()/remove(): nesse ponto o DOM do editor ainda mostra
      // a nota QUE ESTAVA ativa antes da troca (a tela só re-renderiza depois), então capturar
      // aqui sobrescreveria o conteúdo da nota recém-criada/ativada com o conteúdo antigo.
      if(note&&editor&&!options.skipCapture)note.content=sanitizeHTML(editor.innerHTML);
      if(note)note.updatedAt=Number(note.updatedAt)||now();
      if(!note)return false;
      if(this._dirty)this.writeFastDraft(note,options.reason||'notes_flush');
      try{
        const accepted=saveCurrentData({skipPatrimonioSnapshot:true});
        if(accepted===false)throw new Error('O salvamento oficial não foi aceito.');
        this._lastFullSaveAt=now();
        this._lastFullSaveProfileId=this.profileId();
        this._dirty=false;
        this.clearFastDraft();
        this.markSaved();
        this.releaseGuardIfIdle();
        return true;
      }catch(error){
        console.error('[BORION_NOTES][SAVE]',error);
        const el=document.getElementById('borion_notes_save_state');
        if(el){el.textContent='Protegido neste dispositivo — Drive pendente';el.classList.add('is-saving');}
        return false;
      }
    },
    select(id){
      this.flush();
      const store=this.ensureStore();if(!store.items.some(n=>String(n.id)===String(id)))return;
      store.activeId=id;
      try{const accepted=saveCurrentData({skipPatrimonioSnapshot:true});if(accepted!==false)this.clearFastDraft();}catch(_){ }
      renderView();
    },
    create(){
      this.flush();
      const store=this.ensureStore(),note=blankNote('Nova nota');store.items.push(note);store.activeId=note.id;this._dirty=true;this.writeFastDraft(note,'notes_create');this.flush({reason:'notes_create',skipCapture:true});renderView();
      setTimeout(()=>document.querySelector('.notes-title-input')?.select(),0);
    },
    duplicate(){
      this.flush();
      const store=this.ensureStore(),source=this.current();if(!source)return;
      const note=blankNote(cleanTitle(source.title+' — cópia'));note.content=sanitizeHTML(source.content);store.items.push(note);store.activeId=note.id;this._dirty=true;this.writeFastDraft(note,'notes_duplicate');this.flush({reason:'notes_duplicate',skipCapture:true});renderView();
    },
    remove(){
      const store=this.ensureStore(),note=this.current();if(!note)return;
      const perform=()=>{
        this.clearFastDraft();
        store.items=store.items.filter(n=>String(n.id)!==String(note.id));
        if(!store.items.length)store.items.push(blankNote('Nova nota'));
        store.activeId=store.items[0].id;
        this._dirty=true;
        this.writeFastDraft(store.items[0],'notes_delete');
        this.flush({reason:'notes_delete',skipCapture:true});
        renderView();toast('Nota excluída.');
      };
      if(typeof openConfirmModal==='function')openConfirmModal({title:'Excluir nota?',text:'A nota “'+note.title+'” será removida deste perfil.',confirmLabel:'Excluir nota',variant:'danger',onConfirm:perform});
      else perform();
    },
    captureSelection(){
      const editor=this.editor(),selection=global.getSelection&&global.getSelection();
      if(!editor||!selection||!selection.rangeCount)return;
      const range=selection.getRangeAt(0);if(editor.contains(range.commonAncestorContainer))this._savedRange=range.cloneRange();
    },
    restoreSelection(){
      const editor=this.editor();if(!editor)return false;
      editor.focus({preventScroll:true});
      const selection=global.getSelection&&global.getSelection();
      if(!selection)return false;
      selection.removeAllRanges();
      if(this._savedRange&&editor.contains(this._savedRange.commonAncestorContainer))selection.addRange(this._savedRange);
      else{const range=document.createRange();range.selectNodeContents(editor);range.collapse(false);selection.addRange(range);}
      return true;
    },
    command(command,value=null){
      if(!this.restoreSelection())return;
      try{document.execCommand(command,false,value);}catch(error){console.warn('[BORION_NOTES][FORMAT]',command,error);}
      const editor=this.editor();if(editor)this.editorInput(editor);
    },
    font(value){if(value)this.command('fontName',value);},
    color(command,value){if(safeColor(value))this.command(command,value);},
    toggleEmoji(event){
      if(event){event.preventDefault();event.stopPropagation();}
      const menu=document.getElementById('borion_notes_emoji_menu');if(menu)menu.classList.toggle('open');
    },
    insertEmoji(emoji){
      this.command('insertText',emoji);
      const menu=document.getElementById('borion_notes_emoji_menu');if(menu)menu.classList.remove('open');
    }
  };

  const flushPendingNotes=(reason)=>{
    try{
      if(Notes._dirty||Notes._saveTimer||Notes.readFastDraft())Notes.flush({reason:'notes_'+reason});
      if(window.BorionEditGuard)BorionEditGuard.markClean('notes_editor');
    }catch(error){console.warn('[BORION_NOTES][LIFECYCLE_FLUSH_WARN]',error);}
  };
  window.addEventListener('beforeunload',()=>flushPendingNotes('beforeunload'));
  window.addEventListener('pagehide',()=>flushPendingNotes('pagehide'));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushPendingNotes('visibilitychange');});
  document.addEventListener('selectionchange',()=>{try{if(S&&S.view==='notes')Notes.captureSelection();}catch(_){ }});
  document.addEventListener('click',event=>{
    const menu=document.getElementById('borion_notes_emoji_menu');
    if(menu&&!event.target.closest('.notes-emoji-wrap'))menu.classList.remove('open');
  });
  global.BorionNotes=Notes;
  global.renderNotes=()=>Notes.render();
})(window);
