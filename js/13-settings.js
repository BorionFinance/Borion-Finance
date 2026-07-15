/* Borion Finance — Configurações reorganizadas: módulos, dashboard, perfis, categorias, personalização e backups. */

/* ---------------- VIEW: SETTINGS ---------------- */
function settingsTabButton(key,label){ return `<button class="settings-tab ${S.settingsTab===key?'active':''}" onclick="Settings.setTab('${key}')">${label}</button>`; }
function moduleToggleHTML({key,title,desc,enabled,onClick}){
  return `<div class="module-toggle-card ${enabled?'enabled':''}">
    <div class="module-toggle-head">
      <div><h3>${esc(title)}</h3><p class="desc">${esc(desc)}</p></div>
      <button class="toggle-switch ${enabled?'on':''}" onclick="${onClick}" aria-label="${enabled?'Desativar':'Ativar'} ${esc(title)}"><span></span></button>
    </div>
    <div class="module-toggle-status">${enabled?'Ativo':'Desativado'} — ${enabled?'aparece no app e mantém os dados disponíveis.':'fica oculto, mas os dados não são apagados.'}</div>
  </div>`;
}
function dashboardEnabled(key){ return !!(S.data.dashboard && Array.isArray(S.data.dashboard.widgets) && S.data.dashboard.widgets.includes(key)); }
function renderSettings(){
  if(!S.settingsTab) S.settingsTab='modules';
  if(S.settingsTab==='cloud') S.settingsTab='backup'; // V6.14.0 — aba "Nuvem" foi unificada em "Backups"
  const tabs = `
    <div class="settings-tabs">
      ${settingsTabButton('modules','Módulos')}
      ${settingsTabButton('dashboard','Dashboard')}
      ${settingsTabButton('profiles','Perfis')}
      ${settingsTabButton('categories','Categorias')}
      ${settingsTabButton('personalization','Personalização')}
      ${settingsTabButton('backup','Backup e dados')}
      ${settingsTabButton('integrations','Integrações')}
    </div>`;
  let content='';
  if(S.settingsTab==='modules') content = renderSettingsModules();
  else if(S.settingsTab==='dashboard') content = renderSettingsDashboard();
  else if(S.settingsTab==='profiles') content = renderSettingsProfiles();
  else if(S.settingsTab==='categories') content = renderSettingsCategories();
  else if(S.settingsTab==='personalization') content = renderSettingsPersonalization();
  else if(S.settingsTab==='backup') content = renderSettingsBackup();
  else if(S.settingsTab==='integrations') content = window.BorionInterop ? BorionInterop.renderSettings() : '<div class="settings-section">Integração indisponível.</div>'; // protected interop seam
  return `<div class="settings-layout">${tabs}<div class="settings-content">${content}</div><div class="version-tag">V. 6.33.0 • Configurações reorganizadas</div><footer class="app-release-footer" aria-label="Informações do Borion">
<div><strong>Versão:</strong> 6.33.0</div>
<div><strong>Lançamento:</strong> 15/07/2026</div>
<div>Desenvolvido por <strong>Pedro Bardella</strong></div>
<div>© 2026 Pedro Bardella. Todos os direitos reservados.</div>
</footer></div>`;
}
function renderSettingsModules(){
  const chequesEnabled = !!(S.data.cheques && S.data.cheques.enabled);
  const reservasEnabledNow = !!(S.data.modules && S.data.modules.reserves !== false && S.data.reservas && S.data.reservas.enabled !== false);
  const importsEnabled = !!(S.data.modules && S.data.modules.imports !== false);
  const investmentsEnabledNow = investmentsEnabled();
  const agendaEnabledNow = agendaEnabled();
  const popupCfg = S.config.popupNotifs || {enabled:true,durationMs:40000};
  const popupEnabled = popupCfg.enabled !== false;
  const dur = Number(popupCfg.durationMs)||40000;
  return `
    <div class="settings-section settings-hero-section"><h3>Módulos do Borion</h3><p class="desc">Ative só o que você usa. Desativar uma função apenas oculta a tela; não apaga seus dados.</p></div>
    <div class="settings-module-grid">
      ${moduleToggleHTML({key:'investments',title:'Investimentos',desc:'Ativos, dinheiro em caixa e evolução de investimentos — aparece em Investimentos e no card de Patrimônio.',enabled:investmentsEnabledNow,onClick:'Settings.toggleInvestments()'})}
      ${moduleToggleHTML({key:'agenda',title:'Agenda Financeira',desc:'Compromissos e lembretes financeiros com data.',enabled:agendaEnabledNow,onClick:'Settings.toggleAgenda()'})}
      ${moduleToggleHTML({key:'cheques',title:'Cheques',desc:'Controle cheques recebidos e emitidos, lotes, baixas, vencimentos, devoluções e reapresentações.',enabled:chequesEnabled,onClick:'Settings.toggleCheques()'})}
      ${moduleToggleHTML({key:'reserves',title:'Reserva',desc:'Separe dinheiro por objetivo dentro do patrimônio, com extrato de reservar, resgatar, rendimento e ajuste.',enabled:reservasEnabledNow,onClick:'Settings.toggleReservas()'})}
      ${moduleToggleHTML({key:'imports',title:'Importar extratos',desc:'Importe CSV, OFX, TXT e PDF textual para revisar e lançar automaticamente depois de conferir.',enabled:importsEnabled,onClick:'Settings.toggleImports()'})}
      <div class="module-toggle-card ${popupEnabled?'enabled':''}">
        <div class="module-toggle-head">
          <div><h3>Popups de notificação</h3><p class="desc">Avisos verdes translúcidos no canto direito para vencimentos e lembretes importantes.</p></div>
          <button class="toggle-switch ${popupEnabled?'on':''}" onclick="Settings.togglePopupNotifs()" aria-label="${popupEnabled?'Desativar':'Ativar'} popups"><span></span></button>
        </div>
        <div class="module-toggle-status">${popupEnabled?'Ativo':'Desativado'} — os lembretes continuam no sino; isto controla só o popup flutuante.</div>
        <div class="field" style="margin:12px 0 0;"><label>Tempo do popup</label><select id="cfg_popup_duration"><option value="30000" ${dur===30000?'selected':''}>30 segundos</option><option value="40000" ${dur===40000?'selected':''}>40 segundos</option><option value="50000" ${dur===50000?'selected':''}>50 segundos</option></select></div>
      </div>
    </div>`;
}
function renderSettingsDashboard(){
  const cards = DEFAULT_DASHBOARD_WIDGETS.map(k=>{
    const enabled = dashboardEnabled(k);
    return `<div class="dashboard-toggle-card ${enabled?'enabled':''}">
      <div><h4>${esc(DASHBOARD_WIDGET_LABELS[k])}</h4><p>${enabled?'Visível na visão geral. Ao ativar novamente, este bloco sobe para o topo.':'Oculto da visão geral para deixar a tela mais limpa.'}</p></div>
      <button class="toggle-switch ${enabled?'on':''}" onclick="Settings.toggleDashboardWidget('${k}')"><span></span></button>
    </div>`;
  }).join('');
  return `
    <div class="settings-section settings-hero-section"><h3>Organização da Visão Geral</h3><p class="desc">Ligue e desligue os gráficos/tabelas do dashboard. Quando você ativa um bloco, ele entra em primeiro para facilitar a montagem da sua tela.</p></div>
    <div class="dashboard-toggle-grid">${cards}</div>
    <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;"><button class="btn-outline btn-sm" onclick="Settings.resetDashboardWidgets()">Restaurar dashboard padrão</button><button class="btn-outline btn-sm" onclick="S.view='overview';renderApp();">Ver visão geral</button></div>`;
}
function renderSettingsCategories(){
  ensureCategoryColors();
  const catBlock=(typeKey,typeLabel)=>{
    const orderType='cat_'+typeKey;
    const raw=(S.data.categorias&&S.data.categorias[typeKey])?S.data.categorias[typeKey]:[];
    const wrapped=raw.map((nome,createdIndex)=>({id:nome,nome,createdIndex}));
    const ordered=window.OrderPreferences?OrderPreferences.applyOrder(orderType,wrapped):wrapped;
    const naturalIds=ordered.map(x=>x.id);
    const organizing=!!(window.OrderPreferences&&OrderPreferences.active&&OrderPreferences.activeType===orderType);
    const tags=ordered.map(item=>{const c=item.nome;return `<span class="cat-tag cat-tag-manage ${organizing?'category-order-row':''}" data-order-id="${esc(c)}" style="--cat-color:${esc(categoryColor(typeKey,c))}">
      <span class="cat-dot"></span><span class="cat-tag-name">${esc(c)}</span>
      ${organizing?OrderPreferences.reorderRowControlsHTML(orderType,c,c,naturalIds):`<input type="color" class="cat-color-inline" value="${esc(categoryColor(typeKey,c))}" title="Cor da categoria" onchange="Settings.setCategoryColor(${jsArg(typeKey)},${jsArg(c)},this.value)"><button class="cat-mini-btn" onclick="Settings.renameCategory(${jsArg(typeKey)},${jsArg(c)})" title="Renomear">✎</button><button class="cat-mini-btn danger" onclick="Settings.deleteCategory(${jsArg(typeKey)},${jsArg(c)})" title="Excluir">&times;</button>`}
    </span>`;}).join('');
    return `<div class="cat-manage-group cat-panel"><div class="category-panel-head"><div><h4>${esc(typeLabel)}</h4><p class="desc">Escolha A–Z, Z–A, recentes, antigas ou uma ordem personalizada.</p></div>${window.OrderPreferences?OrderPreferences.sortSelectHTML(orderType):''}</div><div class="cat-tag-list" data-order-list="${orderType}">${tags||'<span class="desc">Nenhuma categoria ainda.</span>'}</div>${organizing?'':`<button class="btn-outline btn-sm" onclick="Settings.addCategory(${jsArg(typeKey)})">+ Nova categoria</button>`}</div>`;
  };
  return `<div class="settings-section settings-hero-section"><h3>Categorias</h3><p class="desc">As categorias mantêm suas cores e agora também podem ser ordenadas por perfil. A mesma ordem aparece nos seletores de lançamentos e assinaturas.</p></div><div class="settings-categories-grid">${catBlock('receita','Receitas')}${catBlock('fixa','Despesas fixas')}${catBlock('variavel','Despesas variáveis')}</div>`;
}

function renderBudgetSummaryPersonalization(){
  if(typeof budgetSummaryPreferences!=='function') return '';
  const pref=budgetSummaryPreferences();
  const organizing=!!Settings._summaryOrganizing;
  const order=(organizing&&Array.isArray(Settings._summaryDraftOrder)?Settings._summaryDraftOrder:pref.order).slice();
  const visible=(organizing&&Array.isArray(Settings._summaryDraftVisible)?Settings._summaryDraftVisible:pref.visible).slice();
  const rows=order.map((k)=>{
    const d=BUDGET_SUMMARY_CARD_DEFS[k];
    const checked=visible.includes(k);
    return `<div class="order-row summary-order-row ${checked?'is-visible':'is-hidden'} ${organizing?'organizing':''}" data-summary-key="${esc(k)}" draggable="${organizing?'true':'false'}" ondragstart="Settings.summaryDragStart(event,'${k}')" ondragend="Settings.summaryDragEnd(event)" ondragover="Settings.summaryDragOver(event)" ondrop="Settings.summaryDrop(event,'${k}')">
      <div class="order-row-main summary-order-main">
        <button type="button" class="toggle-switch summary-visibility-toggle ${checked?'on':''}" onclick="Settings.toggleBudgetSummaryCard('${k}',${checked?'false':'true'})" aria-label="${checked?'Ocultar':'Mostrar'} ${esc(d.label)}"><span></span></button>
        <div class="summary-order-copy"><span class="order-row-label">${esc(d.label)}</span><span>${checked?'Visível no topo de Lançamentos':'Oculto do topo de Lançamentos'}</span></div>
      </div>
      ${organizing?`<div class="order-controls summary-order-controls">
        <button type="button" class="order-handle" title="Arrastar para reordenar" aria-label="Arrastar ${esc(d.label)} para reordenar">${window.OrderPreferences?OrderPreferences.handleSVG():'⋮⋮'}</button>
        <span class="order-arrow-group">
          <button type="button" class="order-arrow-btn" onclick="Settings.moveBudgetSummaryCard('${k}','top')" title="Mover para o início" aria-label="Mover ${esc(d.label)} para o início">⤒</button>
          <button type="button" class="order-arrow-btn" onclick="Settings.moveBudgetSummaryCard('${k}',-1)" title="Mover para cima" aria-label="Mover ${esc(d.label)} para cima">▲</button>
          <button type="button" class="order-arrow-btn" onclick="Settings.moveBudgetSummaryCard('${k}',1)" title="Mover para baixo" aria-label="Mover ${esc(d.label)} para baixo">▼</button>
          <button type="button" class="order-arrow-btn" onclick="Settings.moveBudgetSummaryCard('${k}','bottom')" title="Mover para o final" aria-label="Mover ${esc(d.label)} para o final">⤓</button>
        </span>
      </div>`:`<span class="order-row-status ${checked?'on':'off'}">${checked?'Visível':'Oculto'}</span>`}
    </div>`;
  }).join('');
  return `<div class="settings-section settings-hero-section order-organize-section summary-organize-section">
    <div class="order-organize-head">
      <div><h3>Resumo de Lançamentos</h3><p class="desc">Escolha os indicadores do topo de Lançamentos e organize a ordem com o mesmo padrão usado nos módulos e itens.</p></div>
      <button class="toggle-switch ${organizing?'on':''}" onclick="Settings.setSummaryOrganizer(!${organizing?'true':'false'})" aria-label="${organizing?'Desativar':'Ativar'} organização do resumo"><span></span></button>
    </div>
    ${organizing?'<div class="order-active-hint">Modo de organização ativo. Arraste os indicadores ou use as setas para mover ao início, para cima, para baixo ou para o final. As alterações só entram em vigor ao salvar.</div>':''}
    <div class="order-list summary-pref-list">${rows}</div>
    <div class="summary-organizer-actions">
      <button class="btn-outline btn-sm" onclick="Settings.resetBudgetSummaryCards()">Restaurar padrão</button>
      ${organizing?'<button class="btn-outline btn-sm" onclick="Settings.cancelBudgetSummaryOrganizer()">Cancelar</button><button class="btn btn-primary btn-sm" onclick="Settings.saveBudgetSummaryOrganizer()">Salvar organização</button>':''}
    </div>
  </div>`;
}
function renderSettingsPersonalization(){
  const fontOptions = Object.keys(FONT_LABELS).map(k=>`<option value="${k}" ${S.config.font===k?'selected':''}>${esc(FONT_LABELS[k])}</option>`).join('');
  const theme = S.config.theme || 'dark';
  const uiMode = S.config.uiMode || 'auto';
  return `
    <div class="settings-section settings-hero-section"><h3>Personalização</h3><p class="desc">Ajustes visuais seguros, sem mexer na identidade do Borion nem transformar o app em carnaval.</p></div>
    <div class="settings-section interface-mode-card"><h3>Modo de interface</h3><p class="desc">No Automático, celulares usam o Smartphone Mode para lançamentos rápidos e computadores continuam no Modo Pro completo. Nenhuma função ou dado é removido.</p><div class="field" style="max-width:360px;"><select id="cfg_ui_mode"><option value="auto" ${uiMode==='auto'?'selected':''}>Automático — Smartphone no celular / Pro no PC</option><option value="smartphone" ${uiMode==='smartphone'?'selected':''}>Forçar Smartphone Mode</option><option value="pro" ${uiMode==='pro'?'selected':''}>Forçar Modo Pro</option></select></div><div class="interface-mode-preview"><span class="${resolvedInterfaceMode()==='smartphone'?'active':''}">Smartphone</span><span class="${resolvedInterfaceMode()==='pro'?'active':''}">Pro</span></div></div>
    <div class="settings-section"><h3>Tema</h3><p class="desc">Use o tema private banking escuro, o tema claro ou siga o tema do sistema.</p><div class="field" style="max-width:320px;"><select id="cfg_theme"><option value="dark" ${theme==='dark'?'selected':''}>Escuro / Private banking</option><option value="light" ${theme==='light'?'selected':''}>Claro / Branco</option><option value="system" ${theme==='system'?'selected':''}>Tema do sistema</option></select></div></div>
    <div class="settings-section"><h3>Fonte do app</h3><p class="desc">Escolha a fonte usada em todo o app.</p><div class="field" style="max-width:320px;"><select id="cfg_font">${fontOptions}</select></div></div>
    ${renderBudgetSummaryPersonalization()}
    ${window.OrderPreferences ? OrderPreferences.renderModulesOrganizePanel() : ''}
    <div class="info-box">A personalização de cores dos ícones continua fora da tela para manter o visual premium e consistente.</div>`;
}


const Settings = {
  _summaryOrganizing:false,
  _summaryDraftOrder:null,
  _summaryDraftVisible:null,
  _summaryDragKey:null,
  setSummaryOrganizer(active){
    const pref=budgetSummaryPreferences();
    Settings._summaryOrganizing=!!active;
    Settings._summaryDraftOrder=active?pref.order.slice():null;
    Settings._summaryDraftVisible=active?pref.visible.slice():null;
    Settings._summaryDragKey=null;
    renderView();
  },
  toggleBudgetSummaryCard(key,checked){
    const pref=budgetSummaryPreferences();
    const target=Settings._summaryOrganizing?Settings._summaryDraftVisible:pref.visible;
    const next=target.filter(k=>k!==key);
    if(checked) next.push(key);
    if(Settings._summaryOrganizing) Settings._summaryDraftVisible=next;
    else { pref.visible=next; saveCurrentData(); }
    renderView();
  },
  moveBudgetSummaryCard(key,dir){
    const pref=budgetSummaryPreferences();
    const order=(Settings._summaryOrganizing&&Array.isArray(Settings._summaryDraftOrder)?Settings._summaryDraftOrder:pref.order).slice();
    const i=order.indexOf(key); if(i<0) return;
    let j=i;
    if(dir==='top') j=0;
    else if(dir==='bottom') j=order.length-1;
    else j=Math.max(0,Math.min(order.length-1,i+Number(dir||0)));
    if(i===j) return;
    const moved=order.splice(i,1)[0]; order.splice(j,0,moved);
    if(Settings._summaryOrganizing) Settings._summaryDraftOrder=order;
    else { pref.order=order; saveCurrentData(); }
    renderView();
  },
  summaryDragStart(ev,key){
    if(!Settings._summaryOrganizing){ ev.preventDefault(); return; }
    Settings._summaryDragKey=key;
    const row=ev.currentTarget; if(row) row.classList.add('summary-dragging');
    if(ev.dataTransfer){ ev.dataTransfer.effectAllowed='move'; ev.dataTransfer.setData('text/plain',key); }
  },
  summaryDragOver(ev){ if(Settings._summaryOrganizing){ ev.preventDefault(); if(ev.dataTransfer) ev.dataTransfer.dropEffect='move'; } },
  summaryDragEnd(ev){ if(ev&&ev.currentTarget) ev.currentTarget.classList.remove('summary-dragging'); document.querySelectorAll('.summary-drop-target').forEach(el=>el.classList.remove('summary-drop-target')); Settings._summaryDragKey=null; },
  summaryDrop(ev,target){
    if(!Settings._summaryOrganizing) return;
    ev.preventDefault();
    const source=Settings._summaryDragKey||(ev.dataTransfer&&ev.dataTransfer.getData('text/plain'));
    if(!source||source===target) return;
    const order=Settings._summaryDraftOrder.slice(),from=order.indexOf(source),to=order.indexOf(target);
    if(from<0||to<0) return;
    const moved=order.splice(from,1)[0]; order.splice(to,0,moved);
    Settings._summaryDraftOrder=order; Settings._summaryDragKey=null; renderView();
  },
  saveBudgetSummaryOrganizer(){
    const pref=budgetSummaryPreferences();
    pref.order=(Settings._summaryDraftOrder||pref.order).slice();
    pref.visible=(Settings._summaryDraftVisible||pref.visible).slice();
    Settings._summaryOrganizing=false; Settings._summaryDraftOrder=null; Settings._summaryDraftVisible=null; Settings._summaryDragKey=null;
    saveCurrentData(); renderView(); toast('Resumo de Lançamentos organizado e salvo.');
  },
  cancelBudgetSummaryOrganizer(){
    Settings._summaryOrganizing=false; Settings._summaryDraftOrder=null; Settings._summaryDraftVisible=null; Settings._summaryDragKey=null;
    renderView(); toast('Alterações do resumo descartadas.');
  },
  resetBudgetSummaryCards(){
    const order=Object.keys(BUDGET_SUMMARY_CARD_DEFS), visible=DEFAULT_BUDGET_SUMMARY_CARDS.slice();
    if(Settings._summaryOrganizing){ Settings._summaryDraftOrder=order; Settings._summaryDraftVisible=visible; renderView(); toast('Padrão carregado. Clique em Salvar organização para confirmar.'); return; }
    const pref=budgetSummaryPreferences(); pref.order=order; pref.visible=visible; saveCurrentData(); renderView(); toast('Resumo de Lançamentos restaurado.');
  },
  setTab(tab){ S.settingsTab=tab; renderView(); },
  addCategory(typeKey){
    openModal({title:'Nova categoria', fields:[{key:'nome',label:'Nome da categoria',type:'text'}], onSave(v){ if(v.nome && !S.data.categorias[typeKey].includes(v.nome)){ S.data.categorias[typeKey].push(v.nome); saveCurrentData(); } closeModal(); renderView(); }});
  },
  renameCategory(typeKey, oldName){
    openModal({title:'Renomear categoria', fields:[{key:'nome',label:'Novo nome',type:'text',default:oldName}], onSave(v){ const list=S.data.categorias[typeKey]; const idx=list.indexOf(oldName); if(idx>-1 && v.nome){ list[idx]=v.nome; S.data.transacoes.forEach(t=>{ if(t.categoria===oldName) t.categoria=v.nome; }); S.data.fixas.forEach(f=>{ if(f.categoria===oldName) f.categoria=v.nome; }); saveCurrentData(); } closeModal(); renderView(); }});
  },
  deleteCategory(typeKey, name){
    const snapshot=JSON.parse(JSON.stringify(S.data)); S.data.categorias[typeKey]=S.data.categorias[typeKey].filter(c=>c!==name); if(!S.data.categorias[typeKey].includes('Outro')) S.data.categorias[typeKey].push('Outro'); S.data.transacoes.forEach(t=>{ if(t.categoria===name) t.categoria='Outro'; }); S.data.fixas.forEach(f=>{ if(f.categoria===name) f.categoria='Outro'; }); if(typeKey==='variavel') (S.data.assinaturas||[]).forEach(a=>{ if(a.categoria===name) a.categoria='Outro'; }); saveCurrentData(); renderView(); showUndoToast('Categoria "'+name+'" excluída.', ()=>{ S.data=snapshot; saveCurrentData(); renderView(); });
  },
  savePersonal(){
    const p=S.currentProfile; p.name=$('#pf_name').value.trim()||p.name; p.email=$('#pf_email').value.trim(); const color=$('#pf_avatar_color'); if(color) p.avatarColor=color.value; setProfiles(S.profiles); renderApp(); toast('Perfil atualizado.');
  },
  readAvatarFile(input){
    const file=input.files && input.files[0]; if(!file) return;
    if(file.size>900000){ alert('Escolha uma imagem menor que 900 KB para não pesar o backup.'); input.value=''; return; }
    const reader=new FileReader(); reader.onload=()=>{ S.currentProfile.avatarImage=reader.result; setProfiles(S.profiles); renderApp(); toast('Foto do perfil atualizada.'); }; reader.readAsDataURL(file); input.value='';
  },
  removeAvatarImage(){ delete S.currentProfile.avatarImage; setProfiles(S.profiles); renderApp(); toast('Foto removida.'); },
  setPasswordFlow(){
    openModal({title:'Definir senha', fields:[{key:'pw',label:'Nova senha',type:'password'},{key:'pw2',label:'Confirmar senha',type:'password'}], onSave: async (v)=>{ if(!v.pw || v.pw.length<4){ alert('A senha deve ter ao menos 4 caracteres.'); return; } if(v.pw!==v.pw2){ alert('As senhas não coincidem.'); return; } const p=S.currentProfile; p.salt=randomSalt(); p.passwordHash=await hashPassword(v.pw,p.salt); setProfiles(S.profiles); closeModal(); renderView(); toast('Senha definida.'); }});
  },
  changePassword(){ Settings.setPasswordFlow(); },
  removePassword(){ const p=S.currentProfile; p.passwordHash=null; p.salt=null; setProfiles(S.profiles); renderView(); toast('Senha removida.'); },
  deleteProfile(id){
    const pr=S.profiles.find(x=>x.id===id); if(!pr) return; const prSnapshot=JSON.parse(JSON.stringify(pr)); const dataSnapshot=getProfileData(id); const wasCurrent=id===S.currentProfile.id; S.profiles=S.profiles.filter(x=>x.id!==id); setProfiles(S.profiles); localStorage.removeItem(LS_DATA_PREFIX+id); if(wasCurrent){ logout(); } else { renderView(); } showUndoToast('Perfil "'+pr.name+'" excluído.', ()=>{ S.profiles.push(prSnapshot); setProfiles(S.profiles); if(dataSnapshot!=null) setProfileData(id,dataSnapshot); if(S.currentProfile) renderView(); else renderGate(); });
  },
  exportProfile(){ const p=S.currentProfile; const payload={type:'multicap-profile-backup',version:2,exportedAt:new Date().toISOString(),profile:{id:p.id,name:p.name,email:p.email,passwordHash:p.passwordHash,salt:p.salt,avatarColor:p.avatarColor,avatarImage:p.avatarImage},data:S.data}; downloadJSON(payload, `backup-${slug(p.name)}-${dateSlug()}.json`); toast('Backup exportado.'); },
  emailBackup(){ BackupFS.manualBackupNow(); const p=S.currentProfile; const subject=encodeURIComponent('Backup - '+APP_NAME); const body=encodeURIComponent('Olá,\n\nSegue em anexo o backup do '+APP_NAME+' (perfil atual: "'+p.name+'").\nO arquivo foi baixado/salvo agora — anexe-o a este e-mail antes de enviar.\n\n'); setTimeout(()=>{ window.location.href=`mailto:${p.email||''}?subject=${subject}&body=${body}`; },400); },
  resetColors(){ S.config.iconColors=Object.assign({},DEFAULT_ICON_COLORS); setConfig(S.config); renderView(); toast('Cores restauradas.'); },
  /* ---------------- V6.24.6 — force save manual unificado ----------------
     Ctrl+S, os botões de Configurações e o atalho fixo do Modo Pro passam todos por
     manualBackup(). O backup rápido não tem uma lógica própria: ele é somente um atalho
     visual para o mesmo backup manual, usando um único snapshot nos destinos escolhidos. */
  async _runQuickBackup(btnId, defaultLabel, busyLabel, task){
    const btn = document.getElementById(btnId);
    if(btn){ if(btn.disabled) return null; btn.disabled = true; btn.textContent = busyLabel; }
    try{ return await task(); }
    finally{ if(btn && btn.isConnected){ btn.disabled = false; btn.textContent = defaultLabel; } }
  },
  async _prepareLocalFolderAccess(interactive=true){
    if(!window.BackupFS) return false;
    try{ return await BackupFS.verifyFolderConnection(interactive); }
    catch(e){ console.warn('[BORION_BACKUP][VERIFY_FOLDER]',e); return false; }
  },
  async _saveSnapshotLocally(snapshot, reason='manual', options={}){
    if(!window.storageProvider) throw new Error('Armazenamento local do Borion não está disponível.');
    const entry = await storageProvider.createBackup(reason,{payload:snapshot});
    let folderFile = null;
    let downloaded = false;
    let folderError = '';
    const connected = await Settings._prepareLocalFolderAccess(options.interactive!==false);
    if(connected && window.BackupFS && BackupFS.dirHandle){
      folderFile = await BackupFS.writeToFolder(snapshot,'borion-backup-local',{interactive:false});
      if(folderFile){
        BackupFS.lastAutoBackupAt=Date.now();
        BackupFS.dirty=false;
      }else{
        folderError='A pasta estava conectada, mas a gravação do JSON falhou.';
      }
    }
    /* Backup manual nunca termina sem um arquivo JSON visível. Se a pasta não estiver
       autorizada (ou a escrita falhar), faz download pelo navegador como fallback. */
    if(!folderFile){
      const filename=backupFilename('borion-backup-manual');
      downloadJSON(snapshot,filename);
      downloaded=true;
    }
    return {entry,folderFile,downloaded,folderError};
  },
  async manualBackup(options={}){
    if(!(S&&S.currentProfile&&S.data)) throw new Error('Abra um perfil financeiro antes de salvar.');
    const targets=options.targets||'both';
    const wantDrive=targets==='both'||targets==='drive';
    const wantLocal=targets==='both'||targets==='local';
    const reason=options.reason||'manual_drive_local';
    saveCurrentData({finalConfirmation:true});
    if(typeof clearExitSavePending==='function') clearExitSavePending(S.currentProfile.id);

    const sharedSnapshot=await buildSharedBackupSnapshot(reason,'backup manual do usuário');
    const result={driveOk:false,localOk:false,driveError:'',localError:'',folderFile:null,downloaded:false,snapshotId:sharedSnapshot.snapshotId};

    const jobs=[];
    if(wantDrive){
      jobs.push((async()=>{
        if(!(window.GoogleDriveProvider&&GoogleDriveProvider.isConnected())) throw new Error('nenhuma conta do Google Drive conectada');
        /* Atualiza current.json, cria forcesave e também registra o backup manual.
           Todos recebem exatamente o mesmo snapshot. */
        const forced=await GoogleDriveProvider.forceSyncNow({payload:sharedSnapshot});
        if(!forced) throw new Error('o Google Drive não confirmou o salvamento');
        await GoogleDriveProvider.createBackup(reason,{payload:sharedSnapshot});
        result.driveOk=true;
      })().catch(e=>{ result.driveError=(e&&e.message)||String(e); }));
    }
    if(wantLocal){
      jobs.push((async()=>{
        const local=await Settings._saveSnapshotLocally(sharedSnapshot,reason,{interactive:options.interactive!==false});
        result.localOk=true;
        result.folderFile=local.folderFile;
        result.downloaded=local.downloaded;
        if(local.folderError) result.localError=local.folderError;
      })().catch(e=>{ result.localError=(e&&e.message)||String(e); }));
    }
    await Promise.all(jobs);

    const parts=[];
    if(wantDrive) parts.push(result.driveOk?'Drive salvo':'Drive falhou: '+result.driveError);
    if(wantLocal){
      if(result.folderFile) parts.push('JSON salvo em '+result.folderFile.filename);
      else if(result.downloaded) parts.push('JSON baixado pelo navegador');
      else parts.push('Local falhou: '+result.localError);
    }
    toast(parts.join(' · '));
    return result;
  },
  quickBackupDrive(){
    return Settings._runQuickBackup('qb_drive','Criar backup agora','Criando...',()=>Settings.manualBackup({targets:'drive',reason:'manual'}));
  },
  quickBackupLocal(){
    return Settings._runQuickBackup('qb_local','Criar backup agora','Criando...',()=>Settings.manualBackup({targets:'local',reason:'manual'}));
  },
  quickBackupBoth(){
    return Settings._runQuickBackup('qb_both','SALVAR DRIVE&LOCAL','Salvando...',()=>Settings.manualBackup({targets:'both',reason:'manual_drive_local'}));
  },
  quickBackupPrimary(mode='drive'){
    const task = async ()=>{
      if(mode==='drive') return Settings.manualBackup({targets:'both',reason:'manual_drive_local'});
      if(mode==='local') return Settings.manualBackup({targets:'local',reason:'manual_local'});
      const results=await Promise.allSettled([
        Settings.createCloudBackupNow('manual','backup manual completo'),
        Settings.manualBackup({targets:'local',reason:'manual_cloud_local'})
      ]);
      const failed=results.filter(r=>r.status==='rejected');
      if(failed.length===results.length) throw failed[0].reason;
      return results;
    };
    return Settings._runQuickBackup('qb_backup_primary','Criar backup completo','Criando backup...',task);
  },
  toggleCheques(){ if(!S.data.cheques) S.data.cheques={enabled:false,items:[]}; S.data.cheques.enabled=!S.data.cheques.enabled; if(!Array.isArray(S.data.cheques.items)) S.data.cheques.items=[]; saveCurrentData(); if(!S.data.cheques.enabled && S.view==='cheques') S.view='settings'; renderApp(); toast(S.data.cheques.enabled?'Módulo de cheques ativado.':'Módulo de cheques desativado.'); },
  toggleReservas(){
    if(!S.data.modules) S.data.modules=Object.assign({},DEFAULT_MODULES);
    if(!S.data.reservas) S.data.reservas={enabled:true,boxes:[],moves:[],monthlyReports:[]};
    const wasEnabled=(S.data.modules.reserves !== false && S.data.reservas.enabled !== false);
    const next=!wasEnabled;
    let converted=[];
    if(next && typeof convertStandaloneMetasToReservas==='function') converted=convertStandaloneMetasToReservas();
    S.data.modules.reserves=next;
    S.data.reservas.enabled=next;
    saveCurrentData();
    if(!next && S.view==='reservas') S.view='settings';
    renderApp();
    if(next && converted.length) toast('Reserva ativada. '+converted.length+' meta'+(converted.length===1?' foi convertida':'s foram convertidas')+' em Cofrinho'+(converted.length===1?'':'s')+'.');
    else toast(next?'Reserva ativada.':'Reserva desativada. As metas ligadas aos Cofrinhos ficaram ocultas, sem apagar os dados.');
  },
  toggleImports(){ if(!S.data.modules) S.data.modules=Object.assign({},DEFAULT_MODULES); S.data.modules.imports = !(S.data.modules.imports !== false); saveCurrentData(); if(S.data.modules.imports===false && S.view==='imports') S.view='settings'; renderApp(); toast(S.data.modules.imports!==false?'Importador de extratos ativado.':'Importador de extratos desativado.'); },
  toggleInvestments(){ if(!S.data.modules) S.data.modules=Object.assign({},DEFAULT_MODULES); S.data.modules.investments = !(S.data.modules.investments !== false); saveCurrentData(); if(S.data.modules.investments===false && S.view==='investments') S.view='settings'; renderApp(); toast(S.data.modules.investments!==false?'Investimentos ativado.':'Investimentos desativado — os dados continuam salvos.'); },
  toggleAgenda(){ if(!S.data.modules) S.data.modules=Object.assign({},DEFAULT_MODULES); S.data.modules.agenda = !(S.data.modules.agenda !== false); saveCurrentData(); if(S.data.modules.agenda===false && S.view==='agenda') S.view='settings'; renderApp(); toast(S.data.modules.agenda!==false?'Agenda Financeira ativada.':'Agenda Financeira desativada — os dados continuam salvos.'); },
  togglePopupNotifs(){ if(!S.config.popupNotifs) S.config.popupNotifs={enabled:true,durationMs:40000}; S.config.popupNotifs.enabled = !(S.config.popupNotifs.enabled !== false); setConfig(S.config); renderView(); toast(S.config.popupNotifs.enabled!==false?'Popups de notificação ativados.':'Popups de notificação desativados.'); },
  toggleDashboardWidget(key){ if(!S.data.dashboard) S.data.dashboard={widgets:DEFAULT_DASHBOARD_WIDGETS.slice()}; let arr=S.data.dashboard.widgets||[]; if(arr.includes(key)){ arr=arr.filter(k=>k!==key); } else { arr=[key].concat(arr.filter(k=>k!==key)); } S.data.dashboard.widgets=arr; saveCurrentData(); renderView(); },
  resetDashboardWidgets(){ S.data.dashboard={widgets:DEFAULT_DASHBOARD_WIDGETS.slice()}; saveCurrentData(); renderView(); toast('Dashboard restaurado.'); }
};
function slug(s){ return (s||'perfil').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
function dateSlug(){ const d=new Date(); return d.toISOString().slice(0,10); }
function downloadJSON(obj, filename){ const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); },200); }

/* ---------- V5.34 Cloud Foundation overrides: conta separada de perfis financeiros ---------- */
function renderSettingsProfiles(){
  const p = S.currentProfile || {};
  const isCloud = !!(window.CloudStorage && CloudStorage.user);
  const profilesRows = (S.profiles||[]).map(pr=>`
    <div class="profile-row ${pr.id===p.id?'active':''}">
      ${profileAvatarHTML(pr)}
      <div class="info"><div class="n">${esc(pr.name)} ${pr.id===p.id?'(ativo)':''}</div><div class="e">Perfil financeiro ${isCloud?'na nuvem':'local'} · ${pr.passwordHash?'com senha':'sem senha'} · ID ${esc(String(pr.id).slice(0,8))}</div></div>
      ${pr.id!==p.id?`<button class="btn-outline btn-sm" onclick="Settings.switchFinancialProfile('${pr.id}')">Abrir</button>`:''}
      <button class="btn-outline btn-sm" onclick="Settings.backupSingleProfile('${pr.id}')">Backup deste perfil</button>
      <button class="btn-outline btn-sm" onclick="Settings.deleteProfile('${pr.id}')">Excluir</button>
    </div>`).join('');
  return `
    <div class="settings-section settings-hero-section"><h3>Perfil financeiro atual</h3><p class="desc">A conta faz login. O perfil guarda os dados financeiros. Exportar/importar usa sempre o perfil ativo por padrão.</p></div>
    <div class="profile-editor-card">
      <div class="profile-editor-avatar">${profileAvatarHTML(p,'profile-avatar-xl')}<button class="btn-outline btn-sm" onclick="document.getElementById('pf_avatar_file').click()">Trocar foto</button><button class="btn-outline btn-sm" onclick="Settings.removeAvatarImage()">Remover foto</button></div>
      <div class="profile-editor-fields">
        <div class="field"><label>Nome do perfil financeiro</label><input type="text" id="pf_name" value="${esc(p.name||'Perfil')}"/></div>
        <div class="field"><label>Conta logada</label><input type="email" id="pf_email" value="${esc((CloudStorage&&CloudStorage.user&&CloudStorage.user.email)||p.email||'')}" disabled/></div>
        <div class="field"><label>Cor do fundo do avatar</label><input type="color" id="pf_avatar_color" value="${esc(profileAvatarBg(p))}"/></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;"><button class="btn btn-primary btn-sm" onclick="Settings.savePersonal()">Salvar perfil financeiro</button><button class="btn-outline btn-sm" onclick="Settings.createFinancialProfile()">+ Novo perfil</button>${p.passwordHash?`<button class="btn-outline btn-sm" onclick="Settings.changePassword()">Trocar senha do perfil</button><button class="btn-outline btn-sm" onclick="Settings.removePassword()">Remover senha do perfil</button>`:`<button class="btn-outline btn-sm" onclick="Settings.setPasswordFlow()">Colocar senha no perfil</button>`}${isCloud?`<button class="btn-outline btn-sm" onclick="cloudChangePasswordFromSettings()">Trocar senha da conta</button>`:''}</div>
        <input type="file" id="pf_avatar_file" accept="image/*" style="display:none" onchange="Settings.readAvatarFile(this)">
      </div>
    </div>
    <div class="settings-section"><h3>Perfis desta conta (${(S.profiles||[]).length}/5)</h3><p class="desc">Troque entre perfis sem misturar dados. Cada perfil tem armazenamento local e registro separado no Supabase.</p>${profilesRows}<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">${(S.profiles||[]).length<5?`<button class="btn-outline btn-sm" onclick="Settings.createFinancialProfile()">+ Criar perfil</button>`:''}<button class="btn-outline btn-sm" onclick="Settings.setTab('backup')">Importar ou exportar dados</button></div></div>`;
}

/* V6.14.0 — "Nuvem" e "Backups" eram duas abas separadas, e a de Backups sempre
   mostrava textos do Supabase (nomes de tabela, "Salvar snapshot no Supabase" etc.)
   mesmo pra quem usa Google Drive ou modo local — informação irrelevante e confusa.
   Unificado numa aba só, que mostra só o que é relevante pro modo atual. */
function backupSyncIconHTML(){
  return `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7h-5V2"/><path d="M20 7a8 8 0 0 0-13.4-2.4L4 7"/><path d="M4 17h5v5"/><path d="M4 17a8 8 0 0 0 13.4 2.4L20 17"/></svg>`;
}
function backupActionCardHTML(icon,title,desc,action,label,variant=''){
  const buttonId=variant==='primary'?' id="qb_backup_primary"':'';
  return `<div class="backup-action-card ${variant}"><div class="backup-action-icon">${icon}</div><div class="backup-action-copy"><h4>${esc(title)}</h4><p>${esc(desc)}</p></div><button${buttonId} class="${variant==='primary'?'btn btn-primary':'btn-outline'} btn-sm" onclick="${action}">${esc(label)}</button></div>`;
}
function renderBackupImportCard(){
  return `<div class="settings-section backup-import-section"><div class="backup-section-head"><div><span class="backup-kicker">IMPORTAÇÃO</span><h3>Importar arquivo JSON</h3><p class="desc">Traga um backup completo ou um perfil. Antes de substituir ou mesclar dados, o Borion mostra uma revisão e pede confirmação.</p></div></div><button class="btn-outline btn-sm" onclick="document.getElementById('import_file_cloud').click()">Selecionar arquivo JSON</button><input type="file" id="import_file_cloud" accept="application/json,.json" style="display:none;"></div>`;
}
function renderBackupFolderSection(){
  let block;
  if(!FS_ACCESS_SUPPORTED) block=`<p class="desc">Este navegador não permite manter uma pasta fixa para cópias automáticas. O download manual em JSON continua disponível.</p>`;
  else if(BackupFS.needsReconnect) block=`<div class="reconnect-banner"><span>A pasta de backups precisa ser reautorizada após reabrir o app.</span><button class="btn-outline btn-sm" onclick="BackupFS.reconnect()">Reconectar pasta</button></div>`;
  else if(BackupFS.dirHandle) block=`<div class="backup-folder-status"><div><strong>Pasta local conectada</strong><span>Os arquivos são gravados dentro de Backups_Borion.</span></div><div class="backup-inline-actions"><button class="btn-outline btn-sm" onclick="BackupFS.choose()">Trocar pasta</button><button class="btn-outline btn-sm" onclick="BackupFS.disconnect()">Desconectar</button></div></div>`;
  else block=`<p class="desc">Opcional: escolha uma pasta deste computador, do Google Drive para computador ou do OneDrive para manter uma cópia adicional fora do navegador.</p><button class="btn-outline btn-sm" onclick="BackupFS.choose()">Escolher pasta</button>`;
  return `<details class="settings-section backup-advanced"><summary><span>Armazenamento local avançado</span><small>Pasta extra e permissões</small></summary><div class="backup-advanced-body">${block}<div class="info-box">O navegador exige sua autorização para acessar uma pasta. O Borion nunca escolhe uma pasta sozinho.</div></div></details>`;
}
function renderSettingsBackup(){
  const cloud=window.CloudStorage;
  const user=cloud&&cloud.user;
  const isDrive=!user&&window.GoogleDriveProvider&&GoogleDriveProvider.isConnected();
  const isLocal=!user&&!isDrive;

  if(isDrive){
    const gs=GoogleDriveProvider.getStatus();
    const syncState=gs.conflict?'Atenção necessária':(gs.pending?'Salvando alterações':'Tudo sincronizado');
    const conflictBanner=gs.conflict?`<div class="info-box danger-box backup-conflict"><b>Existe uma versão mais recente no Google Drive.</b><span>Isso geralmente acontece quando a conta foi alterada em outro dispositivo.</span><div class="backup-inline-actions"><button class="btn-outline btn-sm" onclick="GoogleDriveProvider.reload()">Usar versão do Drive</button><button class="btn-outline btn-sm" onclick="forceManualSave()">Manter esta versão</button></div></div>`:'';
    return `<div class="settings-section settings-hero-section backup-hero"><span class="backup-kicker">SEGURANÇA DOS DADOS</span><h3>Backup e sincronização</h3><p class="desc">Uma página única para sincronizar, criar cópias, exportar, importar e restaurar dados.</p></div>
      ${conflictBanner}
      <div class="settings-section backup-status-card"><div class="backup-status-main"><div class="backup-status-dot ${gs.conflict?'warning':(gs.pending?'working':'ok')}"></div><div><span class="backup-kicker">GOOGLE DRIVE</span><h3>${esc(syncState)}</h3><p class="desc"><strong>${esc(gs.email||'Conta conectada')}</strong> · ${esc(gs.folderName||'Pasta do Borion')} · Perfil ${esc(S.currentProfile?S.currentProfile.name:'não selecionado')}</p>${gs.folderLink?`<a class="backup-text-link" href="${esc(gs.folderLink)}" target="_blank" rel="noopener">Abrir pasta no Drive ↗</a>`:''}</div></div><button class="backup-sync-icon-btn" onclick="GoogleDriveProvider.syncNow()" title="Sincronizar agora" aria-label="Sincronizar agora">${backupSyncIconHTML()}</button></div>
      <div class="backup-action-grid">
        ${backupActionCardHTML('◆','Criar backup completo','Salva a mesma cópia no Google Drive e neste dispositivo.','Settings.quickBackupPrimary(\'drive\')','Criar backup completo','primary')}
        ${backupActionCardHTML('⇩','Exportar conta completa','Baixa um JSON com todos os perfis e dados desta conta.','Settings.exportProfile()','Exportar JSON')}
      </div>
      ${renderBackupImportCard()}
      <div class="settings-section backup-history-section"><div class="backup-section-head"><div><span class="backup-kicker">HISTÓRICO</span><h3>Ver e restaurar backups</h3><p class="desc">Os históricos ficam separados por destino, sem duplicar o botão de criação.</p></div></div><div class="backup-history-grid"><button class="backup-history-card" onclick="Settings.viewDriveBackups()"><span>Google Drive</span><small>Cópias da pasta backups</small><b>Ver histórico →</b></button><button class="backup-history-card" onclick="Settings.viewLocalBackups()"><span>Este dispositivo</span><small>Cópias guardadas no navegador</small><b>Ver histórico →</b></button></div></div>
      ${renderBackupFolderSection()}
      <details class="settings-section backup-advanced account-actions"><summary><span>Conta e acesso</span><small>Ações que não fazem parte do backup diário</small></summary><div class="backup-advanced-body"><button class="btn-outline btn-sm" onclick="GoogleDriveProvider.disconnect();S.currentProfile=null;S.data=null;CloudAuth.mode='login';CloudAuth.error='';CloudAuth.info='';CloudAuth.emailExpanded=false;CloudAuth.render();">Sair da conta Google</button></div></details>`;
  }

  if(isLocal){
    const st=window.storageProvider?storageProvider.getStorageStatus():{profileCount:(S.profiles||[]).length,online:navigator.onLine};
    return `<div class="settings-section settings-hero-section backup-hero"><span class="backup-kicker">SEGURANÇA DOS DADOS</span><h3>Backup e dados</h3><p class="desc">Você está usando o Borion sem conta. As cópias ficam neste dispositivo e podem ser exportadas em JSON.</p></div>
      <div class="settings-section backup-status-card"><div class="backup-status-main"><div class="backup-status-dot ok"></div><div><span class="backup-kicker">MODO LOCAL</span><h3>Dados disponíveis neste dispositivo</h3><p class="desc">${st.profileCount||0} perfil(is) · Perfil ${esc(S.currentProfile?S.currentProfile.name:'não selecionado')} · ${st.online?'Online':'Offline'}</p></div></div></div>
      <div class="backup-action-grid">
        ${backupActionCardHTML('◆','Criar backup completo','Guarda uma cópia no navegador e baixa o JSON ou grava na pasta configurada.','Settings.quickBackupPrimary(\'local\')','Criar backup completo','primary')}
        ${backupActionCardHTML('⇩','Exportar conta completa','Baixa um JSON com todos os perfis e dados deste dispositivo.','Settings.exportProfile()','Exportar JSON')}
      </div>
      ${renderBackupImportCard()}
      <div class="settings-section backup-history-section"><div class="backup-section-head"><div><span class="backup-kicker">HISTÓRICO</span><h3>Backups deste dispositivo</h3><p class="desc">Abra o histórico para baixar ou restaurar uma cópia anterior.</p></div></div><button class="backup-history-card single" onclick="Settings.viewLocalBackups()"><span>Este dispositivo</span><small>Backups manuais e automáticos guardados no navegador</small><b>Ver histórico →</b></button></div>
      ${renderBackupFolderSection()}
      <details class="settings-section backup-advanced account-actions"><summary><span>Conta e sincronização</span><small>Usar a mesma conta em celular e computador</small></summary><div class="backup-advanced-body"><p class="desc">Entrar com uma conta permite sincronizar entre dispositivos. Seus perfis locais continuam preservados neste navegador.</p><button class="btn-outline btn-sm" onclick="Settings.switchToCloudFromSettings()">Entrar com uma conta</button></div></details>
      ${renderInstallAppCard()}`;
  }

  const pending=cloud&&cloud.pendingInfo?cloud.pendingInfo():null;
  const last=cloud&&cloud.lastSyncAt?new Date(cloud.lastSyncAt).toLocaleString('pt-BR'):'Ainda não sincronizou nesta sessão';
  const status=cloud?(cloud.statusLabel?cloud.statusLabel():(cloud.statusText||cloud.status||'Indisponível')):'Módulo de nuvem não carregado';
  const profileName=S.currentProfile?S.currentProfile.name:'Nenhum perfil ativo';
  const schema=cloud&&cloud.schemaError?`<div class="info-box danger-box"><b>Atenção:</b> ${esc(cloud.schemaError)}</div>`:'';
  const consent=window.BackupFS?BackupFS.hasConsent():null;
  const consentText=consent?`Aceito em ${new Date(consent.acceptedAt).toLocaleString('pt-BR')}`:'Ainda não configurado neste dispositivo.';
  return `<div class="settings-section settings-hero-section backup-hero"><span class="backup-kicker">SEGURANÇA DOS DADOS</span><h3>Backup e sincronização</h3><p class="desc">Conta legada Borion Cloud com ações principais organizadas em um único lugar.</p></div>
    ${schema}
    <div class="settings-section backup-status-card"><div class="backup-status-main"><div class="backup-status-dot ${pending?'working':'ok'}"></div><div><span class="backup-kicker">BORION CLOUD</span><h3>${esc(status)}</h3><p class="desc">${esc((user&&user.email)||'Conta conectada')} · Perfil ${esc(profileName)} · Última sincronização ${esc(last)}</p></div></div><button class="backup-sync-icon-btn" onclick="cloudForceSync()" title="Sincronizar agora" aria-label="Sincronizar agora">${backupSyncIconHTML()}</button></div>
    <div class="backup-action-grid">${backupActionCardHTML('◆','Criar backup completo','Cria uma cópia na nuvem legada e também neste dispositivo.','Settings.quickBackupPrimary(\'cloud\')','Criar backup completo','primary')}${backupActionCardHTML('⇩','Exportar conta completa','Baixa um JSON com todos os perfis da conta.','Settings.exportProfile()','Exportar JSON')}</div>
    ${renderBackupImportCard()}
    <div class="settings-section backup-history-section"><div class="backup-section-head"><div><span class="backup-kicker">HISTÓRICO</span><h3>Ver e restaurar backups</h3></div></div><div class="backup-history-grid"><button class="backup-history-card" onclick="Settings.viewCloudBackups()"><span>Borion Cloud</span><small>Snapshots salvos na nuvem legada</small><b>Ver histórico →</b></button><button class="backup-history-card" onclick="Settings.viewLocalBackups()"><span>Este dispositivo</span><small>Cópias guardadas no navegador</small><b>Ver histórico →</b></button></div></div>
    ${renderBackupFolderSection()}
    <details class="settings-section backup-advanced account-actions"><summary><span>Conta, proteção e diagnóstico</span><small>Ações avançadas</small></summary><div class="backup-advanced-body"><p class="desc"><strong>Proteção de dados:</strong> ${consentText}</p><div class="backup-inline-actions"><button class="btn-outline btn-sm" onclick="Settings.showBackupConsent()">Ver proteção de dados</button><button class="btn-outline btn-sm" onclick="cloudRunSupabaseDiagnostic()">Diagnóstico</button><button class="btn-outline btn-sm" onclick="cloudChangePasswordFromSettings()">Trocar senha</button><button class="btn-outline btn-sm" onclick="cloudLogout()">Sair da conta</button>${user?'<button class="btn-danger btn-sm" onclick="Settings.deleteCloudAccountFlow()">Excluir conta</button>':''}</div></div></details>
    ${renderInstallAppCard()}`;
}
function renderInstallAppCard(){
  if(typeof isStandalonePWA==='function' && isStandalonePWA()){
    return `<div class="settings-section"><h3>Instalar o app</h3><div class="gold-box">Você já está usando o Borion Finance instalado como app (tela cheia, fora do navegador).</div></div>`;
  }
  const ios = typeof isIOSDevice==='function' && isIOSDevice();
  const canPromptNow = !ios && typeof deferredInstallPrompt!=='undefined' && deferredInstallPrompt;
  const instructions = ios
    ? `<div class="info-box"><b>iPhone/iPad (Safari):</b> toque no ícone de compartilhar (retângulo com seta para cima) na barra do Safari e depois em <b>“Adicionar à Tela de Início”</b>.</div>`
    : `<div class="info-box"><b>Android/Chrome ou computador:</b> toque no menu (⋮) do navegador e escolha <b>“Instalar app”</b> ou <b>“Adicionar à tela inicial”</b>. Se aparecer o botão abaixo, você pode instalar direto por ele.</div>`;
  return `<div class="settings-section"><h3>Instalar o app</h3><p class="desc">Instalar o Borion na tela inicial abre em tela cheia, mais rápido, como um app de verdade.</p>${instructions}${canPromptNow?`<button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="Settings.promptInstall()">Instalar agora</button>`:''}</div>`;
}
Settings.promptInstall = async function(){
  if(!deferredInstallPrompt){ toast('A instalação automática não está disponível agora. Use o menu do navegador.'); return; }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  renderView();
};


Settings.createFinancialProfile = async function(){
  openModal({title:'Novo perfil financeiro', sub:'Crie um perfil separado dentro da sua conta.', fields:[{key:'nome',label:'Nome do perfil',type:'text',placeholder:'Ex: Pedro Pessoal'}], saveLabel:'Criar perfil', onSave: async (v)=>{
    try{ if(!v.nome || !v.nome.trim()) throw new Error('Digite um nome.'); if(window.CloudStorage&&CloudStorage.user){ await CloudStorage.createProfile(v.nome.trim(), true); closeModal(); renderApp(); toast('Perfil criado e confirmado no Supabase.'); } else { const p={id:uid(),name:v.nome.trim(),email:'',avatarColor:avatarColor(v.nome.trim()),createdAt:Date.now()}; S.profiles.push(p); setProfiles(S.profiles); enterProfile(p,true); closeModal(); toast('Perfil criado.'); } }
    catch(e){ alert(e.message||String(e)); }
  }});
};
Settings.switchFinancialProfile = async function(id){
  const doSwitch = async ()=>{
    try{ if(window.CloudStorage&&CloudStorage.user) await CloudStorage.switchProfile(id); else { const p=S.profiles.find(x=>x.id===id); if(p) await enterProfile(p,true); } toast('Perfil alterado.'); }
    catch(e){ alert(e.message||String(e)); }
  };
  if(window.CloudStorage && CloudStorage.user) await CloudStorage.guardExit(doSwitch);
  else await doSwitch();
};
Settings.savePersonal = async function(){
  const p=S.currentProfile; if(!p) return;
  const name=$('#pf_name').value.trim()||p.name; const color=$('#pf_avatar_color'); const c=color?color.value:profileAvatarBg(p);
  try{
    if(window.CloudStorage&&CloudStorage.user){
      await CloudStorage.renameProfile(p.id,name,c,p.avatarImage||'');
      const fresh = S.profiles.find(x=>x.id===p.id);
      if(fresh) S.currentProfile = fresh;
      renderApp();
      toast('Perfil financeiro atualizado e confirmado no Supabase.');
    } else {
      p.name=name; p.avatarColor=c;
      setProfiles(S.profiles); renderApp(); toast('Perfil financeiro atualizado.');
    }
  }
  catch(e){ alert(e.message||String(e)); }
};
Settings.readAvatarFile = function(input){
  const file=input.files&&input.files[0]; if(!file) return;
  if(file.size>900000){ alert('Escolha uma imagem menor que 900 KB para não pesar o backup.'); input.value=''; return; }
  const reader=new FileReader(); reader.onload=async ()=>{
    const img=reader.result;
    try{
      if(window.CloudStorage&&CloudStorage.user){
        await CloudStorage.renameProfile(S.currentProfile.id,S.currentProfile.name,profileAvatarBg(S.currentProfile),img);
        const fresh = S.profiles.find(x=>x.id===S.currentProfile.id); if(fresh) S.currentProfile=fresh;
      } else {
        S.currentProfile.avatarImage=img; setProfiles(S.profiles);
      }
      renderApp(); toast('Foto do perfil atualizada e confirmada.');
    }catch(e){ alert(e.message||String(e)); }
  }; reader.readAsDataURL(file); input.value='';
};
Settings.removeAvatarImage = async function(){
  try{
    if(window.CloudStorage&&CloudStorage.user){
      await CloudStorage.renameProfile(S.currentProfile.id,S.currentProfile.name,profileAvatarBg(S.currentProfile),'');
      const fresh = S.profiles.find(x=>x.id===S.currentProfile.id); if(fresh) S.currentProfile=fresh;
    } else {
      delete S.currentProfile.avatarImage; setProfiles(S.profiles);
    }
    renderApp(); toast('Foto removida e confirmada.');
  }catch(e){ alert(e.message||String(e)); }
};
Settings.setPasswordFlow = function(){
  const p=S.currentProfile; if(!p) return;
  openModal({title:'Colocar senha no perfil', sub:'Essa senha protege somente este perfil financeiro dentro da conta. A senha da conta continua sendo a do login.', fields:[{key:'pw',label:'Senha do perfil',type:'password',placeholder:'Mínimo 4 caracteres'},{key:'pw2',label:'Confirmar senha do perfil',type:'password'}], saveLabel:'Salvar senha do perfil', onSave: async (v)=>{
    try{
      if(!v.pw || v.pw.length<4) throw new Error('A senha do perfil precisa ter pelo menos 4 caracteres.');
      if(v.pw!==v.pw2) throw new Error('As senhas não coincidem.');
      if(window.CloudStorage&&CloudStorage.user){
        await CloudStorage.updateProfilePassword(p.id,'',v.pw,'set');
      } else {
        p.salt=randomSalt(); p.passwordHash=await hashPassword(v.pw,p.salt); setProfiles(S.profiles);
      }
      closeModal(); renderApp(); toast('Senha do perfil definida.');
    }catch(e){ alert(e.message||String(e)); }
  }});
};
Settings.changePassword = function(){
  const p=S.currentProfile; if(!p) return;
  const hasCurrent=!!p.passwordHash;
  openModal({title:'Trocar senha do perfil', sub:'Essa senha é separada da senha da conta/login.', fields:[...(hasCurrent?[{key:'atual',label:'Senha atual do perfil',type:'password'}]:[]),{key:'pw',label:'Nova senha do perfil',type:'password',placeholder:'Mínimo 4 caracteres'},{key:'pw2',label:'Confirmar nova senha',type:'password'}], saveLabel:'Trocar senha', onSave: async (v)=>{
    try{
      if(!v.pw || v.pw.length<4) throw new Error('A nova senha do perfil precisa ter pelo menos 4 caracteres.');
      if(v.pw!==v.pw2) throw new Error('As senhas não coincidem.');
      if(window.CloudStorage&&CloudStorage.user){
        await CloudStorage.updateProfilePassword(p.id,v.atual||'',v.pw,'change');
      } else {
        if(hasCurrent){ const oldHash=await hashPassword(v.atual||'',p.salt||''); if(oldHash!==p.passwordHash) throw new Error('Senha atual do perfil incorreta.'); }
        p.salt=randomSalt(); p.passwordHash=await hashPassword(v.pw,p.salt); setProfiles(S.profiles);
      }
      closeModal(); renderApp(); toast('Senha do perfil alterada.');
    }catch(e){ alert(e.message||String(e)); }
  }});
};
Settings.removePassword = function(){
  const p=S.currentProfile; if(!p) return;
  openModal({title:'Remover senha do perfil', sub:'Para remover a senha, confirme a senha atual do perfil.', fields:[{key:'atual',label:'Senha atual do perfil',type:'password'}], saveLabel:'Remover senha', onSave: async (v)=>{
    try{
      if(window.CloudStorage&&CloudStorage.user){
        await CloudStorage.updateProfilePassword(p.id,v.atual||'',null,'remove');
      } else {
        if(p.passwordHash){ const oldHash=await hashPassword(v.atual||'',p.salt||''); if(oldHash!==p.passwordHash) throw new Error('Senha atual do perfil incorreta.'); }
        p.passwordHash=null; p.salt=null; setProfiles(S.profiles);
      }
      closeModal(); renderApp(); toast('Senha do perfil removida.');
    }catch(e){ alert(e.message||String(e)); }
  }});
};


function categoryUsageDetails(typeKey, name){
  const parts=[];
  let total=0;
  const add=(label,n)=>{ n=Number(n)||0; if(n>0){ total+=n; parts.push(`${n} em ${label}`); } };
  if(typeKey==='receita'){
    add('receitas', (S.data.transacoes||[]).filter(t=>t.tipo==='receita' && t.categoria===name).length);
    add('cheques recebidos', (S.data.cheques&&S.data.cheques.items||[]).filter(c=>c.tipo==='recebido' && c.categoria===name).length);
  } else if(typeKey==='fixa'){
    add('despesas fixas', (S.data.fixas||[]).filter(f=>f.categoria===name).length);
  } else if(typeKey==='variavel'){
    add('despesas variáveis', (S.data.transacoes||[]).filter(t=>t.tipo==='variavel' && t.categoria===name).length);
    add('parcelas de cartão', (S.data.cartoes||[]).reduce((n,card)=>n+((card.parcelas||[]).filter(p=>p.categoria===name).length),0));
    add('boletos', (S.data.boletos||[]).filter(b=>b.categoria===name).length);
    add('assinaturas', (S.data.assinaturas||[]).filter(a=>a.categoria===name).length);
    add('cheques emitidos', (S.data.cheques&&S.data.cheques.items||[]).filter(c=>c.tipo==='emitido' && c.categoria===name).length);
  }
  return {total, parts};
}
function updateCategoryReferences(typeKey, oldName, newName){
  if(typeKey==='receita'){
    (S.data.transacoes||[]).forEach(t=>{ if(t.tipo==='receita' && t.categoria===oldName) t.categoria=newName; });
    if(S.data.cheques&&Array.isArray(S.data.cheques.items)) S.data.cheques.items.forEach(c=>{ if(c.tipo==='recebido' && c.categoria===oldName) c.categoria=newName; });
  } else if(typeKey==='fixa'){
    (S.data.fixas||[]).forEach(f=>{ if(f.categoria===oldName) f.categoria=newName; });
  } else if(typeKey==='variavel'){
    (S.data.transacoes||[]).forEach(t=>{ if(t.tipo==='variavel' && t.categoria===oldName) t.categoria=newName; });
    (S.data.cartoes||[]).forEach(card=>(card.parcelas||[]).forEach(p=>{ if(p.categoria===oldName) p.categoria=newName; }));
    (S.data.boletos||[]).forEach(b=>{ if(b.categoria===oldName) b.categoria=newName; });
    (S.data.assinaturas||[]).forEach(a=>{ if(a.categoria===oldName) a.categoria=newName; });
    if(S.data.cheques&&Array.isArray(S.data.cheques.items)) S.data.cheques.items.forEach(c=>{ if(c.tipo==='emitido' && c.categoria===oldName) c.categoria=newName; });
  }
}
Settings.setCategoryColor = function(typeKey, name, color){
  setCategoryColor(typeKey, name, color);
  saveCurrentData();
  renderView();
};
Settings.addCategory = function(typeKey){
  openModal({
    title:'Nova categoria',
    sub:'Você pode usar a mesma categoria em vários lançamentos, despesas ou recebimentos.',
    fields:[{key:'nome',label:'Nome da categoria',type:'text'},{key:'cor',label:'Cor da categoria',type:'color',default:baseCatColor('Nova categoria')}],
    saveLabel:'Criar categoria',
    onSave(v){
      const name=(v.nome||'').trim();
      if(!name){ alert('Digite o nome da categoria.'); return; }
      if(!S.data.categorias[typeKey]) S.data.categorias[typeKey]=[];
      if(S.data.categorias[typeKey].some(c=>c.toLowerCase()===name.toLowerCase())){ alert('Essa categoria já existe.'); return; }
      S.data.categorias[typeKey].push(name);
      setCategoryColor(typeKey, name, v.cor||baseCatColor(name));
      saveCurrentData(); closeModal(); renderView(); toast('Categoria criada.');
    }
  });
};
Settings.renameCategory = function(typeKey, oldName){
  openModal({
    title:'Editar categoria',
    sub:'Renomear mantém o vínculo com os lançamentos já existentes.',
    fields:[{key:'nome',label:'Nome da categoria',type:'text',default:oldName},{key:'cor',label:'Cor da categoria',type:'color',default:categoryColor(typeKey,oldName)}],
    saveLabel:'Salvar categoria',
    onSave(v){
      const name=(v.nome||'').trim();
      if(!name){ alert('Digite o nome da categoria.'); return; }
      const list=S.data.categorias[typeKey]||[];
      const idx=list.indexOf(oldName);
      if(idx<0){ closeModal(); return; }
      if(name!==oldName && list.some(c=>c.toLowerCase()===name.toLowerCase())){ alert('Já existe uma categoria com esse nome.'); return; }
      list[idx]=name;
      updateCategoryReferences(typeKey, oldName, name);
      moveCategoryColor(typeKey, oldName, name, v.cor||categoryColor(typeKey,oldName));
      saveCurrentData(); closeModal(); renderView(); toast('Categoria atualizada.');
    }
  });
};
Settings.showCategoryLinkedWarning = function(typeKey, name, usage){
  const detail = usage && usage.parts && usage.parts.length ? ` Encontrado: ${usage.parts.join(', ')}.` : '';
  const box = el(`
    <div class="modal-overlay">
      <div class="modal-box confirm-box confirm-gold">
        <div class="modal-head"><h2>Categoria em uso</h2><button id="cw_close">&times;</button></div>
        <p class="confirm-text"><b>Categoria vinculada a lançamentos/despesas.</b><br>Desvincule para excluir.${esc(detail)}</p>
        <div class="info-box">Para manter seu histórico certo, o Borion não troca automaticamente essa categoria para “Outro”. Primeiro edite ou remova os lançamentos vinculados.</div>
        <div class="confirm-actions">
          <button class="btn btn-secondary btn-block" id="cw_ok">Entendi</button>
          <button class="btn btn-primary btn-block" id="cw_go">Ver lançamentos</button>
        </div>
      </div>
    </div>`);
  $('#modal-root').innerHTML=''; $('#modal-root').appendChild(box); attachModalGuard(box);
  $('#cw_close').onclick=closeModal; $('#cw_ok').onclick=closeModal;
  $('#cw_go').onclick=()=>{ closeModal(); S.view='budget'; S.budgetTab=(typeKey==='receita'?'receita':typeKey); renderApp(); };
};
Settings.deleteCategory = function(typeKey, name){
  const usage = categoryUsageDetails(typeKey, name);
  if(usage.total>0){ Settings.showCategoryLinkedWarning(typeKey, name, usage); return; }
  openConfirmModal({
    title:'Excluir categoria',
    text:`Excluir a categoria "${name}"? Ela não possui lançamentos vinculados.`,
    confirmLabel:'Excluir categoria', cancelLabel:'Cancelar', variant:'danger',
    onConfirm(){
      S.data.categorias[typeKey]=(S.data.categorias[typeKey]||[]).filter(c=>c!==name);
      if(!S.data.categorias[typeKey].includes('Outro')) S.data.categorias[typeKey].push('Outro');
      if(S.data.categoryColors&&S.data.categoryColors[typeKey]) delete S.data.categoryColors[typeKey][name];
      saveCurrentData(); renderView(); toast('Categoria excluída.');
    }
  });
};
Settings.deleteCloudAccountFlow = function(){
  const cloud = window.CloudStorage;
  if(!cloud || !cloud.user){ alert('Entre na conta Borion Cloud antes de excluir.'); return; }
  Settings._deleteAccountState = {
    email: String(cloud.user.email||'').trim(),
    step: 'warning',
    busy: false,
    message: '',
    error: ''
  };
  Settings.renderDeleteAccountModal();
};

Settings.renderDeleteAccountModal = function(){
  const st = Settings._deleteAccountState || {};
  const cloud = window.CloudStorage;
  if(!cloud || !cloud.user){ alert('Entre na conta Borion Cloud antes de excluir.'); return; }
  const email = st.email || String(cloud.user.email||'').trim();
  const step = st.step || 'warning';
  const steps = [
    {key:'warning', label:'Aviso'},
    {key:'password1', label:'Senha'},
    {key:'emailLink', label:'E-mail'},
    {key:'password2', label:'Final'}
  ];
  const currentIndex = Math.max(0, steps.findIndex(x=>x.key===step));
  const stepHTML = steps.map((x,i)=>`<span class="delete-step ${i<currentIndex?'done':i===currentIndex?'active':''}">${i+1}. ${esc(x.label)}</span>`).join('');
  const msgHTML = st.error ? `<div class="delete-account-msg error">${esc(st.error)}</div>` : (st.message ? `<div class="delete-account-msg ok">${esc(st.message)}</div>` : '');
  let body='';

  if(step==='warning'){
    body = `
      <div class="delete-account-hero">
        <div class="delete-danger-mark">!</div>
        <div>
          <h3>Excluir conta Borion Cloud</h3>
          <p>Esta ação cancela a conta ligada ao e-mail <b>${esc(email)}</b>.</p>
        </div>
      </div>
      <div class="delete-warning-list">
        <p><b>Ao prosseguir, serão apagados:</b></p>
        <ul>
          <li>a conta de login e o e-mail cadastrado;</li>
          <li>todos os perfis financeiros dentro dessa conta;</li>
          <li>despesas, receitas, cartões, bancos, investimentos, patrimônio, agenda, cheques e reservas;</li>
          <li>dados salvos no Supabase vinculados a esta conta.</li>
        </ul>
        <p><b>Depois de excluir, esses dados não poderão ser recuperados pelo app.</b></p>
      </div>
      <div class="field"><label>Para continuar, digite EXCLUIR</label><input type="text" id="del_confirm_word" autocomplete="off" placeholder="EXCLUIR"></div>
      <div class="confirm-actions">
        <button class="btn btn-secondary btn-block" id="del_cancel">Cancelar</button>
        <button class="btn btn-danger-solid btn-block" id="del_next">Desejo prosseguir</button>
      </div>`;
  } else if(step==='password1'){
    body = `
      <p class="modal-sub">Primeira trava de segurança: confirme a senha atual da conta. Depois disso, o Borion enviará um e-mail padrão do Supabase para confirmar sua identidade.</p>
      ${passwordInputWrapHTML({id:'del_password1',label:'Senha da conta',autocomplete:'current-password',placeholder:'Digite sua senha'})}
      <div class="confirm-actions">
        <button class="btn btn-secondary btn-block" id="del_back">Voltar</button>
        <button class="btn btn-danger-solid btn-block" id="del_next">Confirmar senha e enviar e-mail</button>
      </div>`;
  } else if(step==='emailLink'){
    body = `
      <div class="delete-email-instructions">
        <h3>Confirme pelo e-mail</h3>
        <p>Enviamos um e-mail para <b>${esc(email)}</b>.</p>
        <ol>
          <li>Abra a caixa de entrada desse e-mail.</li>
          <li>Procure o e-mail enviado por <b>Supabase Auth</b>.</li>
          <li>O assunto pode aparecer como <b>Your sign-in link</b>.</li>
          <li>Clique no botão/link <b>Sign in</b>.</li>
          <li>Você será redirecionado de volta para o Borion e a última confirmação será aberta automaticamente.</li>
        </ol>
        <p class="delete-email-note">Esse texto aparece em inglês porque o e-mail padrão é do Supabase. O Borion está usando esse link apenas como confirmação de identidade antes da exclusão da conta.</p>
      </div>
      <div class="confirm-actions">
        <button class="btn btn-secondary btn-block" id="del_back">Voltar</button>
        <button class="btn-outline btn-block" id="del_check_email">Já cliquei em Sign in</button>
        <button class="btn btn-danger-solid btn-block" id="del_next">Reenviar e-mail</button>
      </div>`;
  } else if(step==='password2'){
    body = `
      <p class="modal-sub">E-mail confirmado pelo link mágico. Última confirmação: digite o e-mail da conta e a senha novamente. Ao clicar no botão vermelho, a conta será apagada.</p>
      <div class="field"><label>E-mail da conta</label><input type="email" id="del_email_final" autocomplete="email" placeholder="${esc(email)}"></div>
      ${passwordInputWrapHTML({id:'del_password2',label:'Senha novamente',autocomplete:'current-password',placeholder:'Digite sua senha novamente'})}
      <div class="delete-final-warning">Esta é a última etapa. Não existe “desfazer” depois da exclusão.</div>
      <div class="confirm-actions">
        <button class="btn btn-secondary btn-block" id="del_back">Voltar</button>
        <button class="btn btn-danger-solid btn-block" id="del_next">Excluir definitivamente</button>
      </div>`;
  } else if(step==='done'){
    body = `
      <div class="delete-account-success">
        <div class="success-mark">✓</div>
        <h3>Sua conta foi cancelada</h3>
        <p>Todos os dados foram apagados.</p>
        <p>Esperamos vê-lo em breve novamente.</p>
      </div>
      <button class="btn btn-primary btn-block" id="del_finish">Voltar para o login</button>`;
  }

  const box = el(`
    <div class="modal-overlay">
      <div class="modal-box delete-account-modal confirm-box confirm-danger">
        <div class="modal-head"><h2>Excluir conta</h2><button id="del_close">&times;</button></div>
        ${step!=='done'?`<div class="delete-steps">${stepHTML}</div>`:''}
        ${msgHTML}
        <div class="delete-account-body">${body}</div>
      </div>
    </div>`);
  $('#modal-root').innerHTML='';
  $('#modal-root').appendChild(box);
  attachModalGuard(box);
  const closeBtn = $('#del_close'); if(closeBtn) closeBtn.onclick = closeModal;
  const cancelBtn = $('#del_cancel'); if(cancelBtn) cancelBtn.onclick = closeModal;
  const finishBtn = $('#del_finish'); if(finishBtn) finishBtn.onclick = ()=>{ closeModal(); CloudAuth.mode='login'; CloudAuth.info='Sua conta foi cancelada. Todos os dados foram apagados. Esperamos vê-lo em breve novamente.'; CloudAuth.error=''; CloudAuth.emailExpanded=false; CloudAuth.render(); };
  const backBtn = $('#del_back');
  if(backBtn) backBtn.onclick = ()=>{
    st.error=''; st.message='';
    if(step==='password1') st.step='warning';
    else if(step==='emailLink') st.step='password1';
    else if(step==='password2') st.step='emailLink';
    Settings.renderDeleteAccountModal();
  };
  const nextBtn = $('#del_next');
  if(nextBtn) nextBtn.onclick = async ()=>{
    try{
      st.error=''; st.message='';
      if(step==='warning'){
        const word = ($('#del_confirm_word')||{}).value || '';
        if(word.trim().toUpperCase()!=='EXCLUIR') throw new Error('Digite EXCLUIR para liberar a próxima etapa.');
        st.step='password1'; Settings.renderDeleteAccountModal(); return;
      }
      if(step==='password1'){
        const pw = ($('#del_password1')||{}).value || '';
        nextBtn.disabled=true; nextBtn.textContent='Validando...';
        await CloudStorage.verifyAccountPasswordForDeletion(pw);
        if(CloudStorage.isDeleteEmailVerified && CloudStorage.isDeleteEmailVerified()){
          st.step='password2'; st.message='Senha e e-mail confirmados. Faça a última confirmação para excluir a conta.'; Settings.renderDeleteAccountModal(); return;
        }
        await CloudStorage.sendDeleteAccountMagicLink();
        st.step='emailLink'; st.message='Senha confirmada. Enviamos o e-mail de confirmação para '+email+'. Clique em Sign in no e-mail para continuar.'; Settings.renderDeleteAccountModal(); return;
      }
      if(step==='emailLink'){
        nextBtn.disabled=true; nextBtn.textContent='Reenviando...';
        await CloudStorage.sendDeleteAccountMagicLink();
        st.message='E-mail reenviado para '+email+'. Abra o e-mail do Supabase Auth e clique em Sign in.';
        Settings.renderDeleteAccountModal(); return;
      }
      if(step==='password2'){
        const typedEmail = (($('#del_email_final')||{}).value || '').trim();
        const pw2 = ($('#del_password2')||{}).value || '';
        if(!typedEmail) throw new Error('Digite o e-mail da conta.');
        if(!pw2) throw new Error('Digite a senha novamente.');
        nextBtn.disabled=true; nextBtn.textContent='Excluindo...';
        await CloudStorage.deleteAccountWithCredentials(typedEmail, pw2);
        st.step='done'; st.error=''; st.message='';
        Settings.renderDeleteAccountModal();
        return;
      }
    }catch(e){ st.error=translateSupabaseError(e&&e.message?e.message:String(e)); st.message=''; Settings.renderDeleteAccountModal(); }
  };
  const checkEmailBtn = $('#del_check_email');
  if(checkEmailBtn) checkEmailBtn.onclick = ()=>{
    try{
      if(CloudStorage.isDeleteEmailVerified()){
        st.step='password2'; st.error=''; st.message='E-mail confirmado. Faça a última confirmação para excluir a conta.';
      } else {
        throw new Error('Ainda não detectei a confirmação por e-mail. Abra o e-mail do Supabase Auth, clique em Sign in e aguarde voltar para o Borion.');
      }
    }catch(e){ st.error=e&&e.message?e.message:String(e); st.message=''; }
    Settings.renderDeleteAccountModal();
  };
  ['del_confirm_word','del_password1','del_email_final','del_password2'].forEach(id=>{
    const input=document.getElementById(id);
    if(input) input.addEventListener('keydown', e=>{ if(e.key==='Enter'){ const btn=document.getElementById('del_next'); if(btn) btn.click(); } });
  });
};

Settings.resumeDeleteAccountFromMagicLink = function(){
  const cloud = window.CloudStorage;
  if(!cloud || !cloud.user || !cloud.isDeleteEmailVerified || !cloud.isDeleteEmailVerified()) return false;
  const firstPasswordOk = !!(cloud.deleteFirstPasswordVerifiedAt && (Date.now()-cloud.deleteFirstPasswordVerifiedAt) < 30*60*1000);
  Settings._deleteAccountState = {
    email: String(cloud.user.email||'').trim(),
    step: firstPasswordOk ? 'password2' : 'password1',
    busy: false,
    message: firstPasswordOk ? 'E-mail confirmado pelo link mágico. Faça a última confirmação para excluir a conta.' : 'E-mail confirmado pelo link mágico. Por segurança, confirme a senha da conta para continuar.',
    error: ''
  };
  Settings.renderDeleteAccountModal();
  return true;
};

Settings.deleteProfile = function(id){
  const pr=(S.profiles||[]).find(x=>x.id===id); if(!pr) return;
  openConfirmModal({title:'Excluir perfil financeiro', text:`Para excluir "${pr.name}", confirme. Esta ação apaga este perfil e seus dados financeiros na nuvem. Mantenha um backup se precisar.`, confirmLabel:'Excluir perfil', cancelLabel:'Cancelar', variant:'danger', onConfirm: async ()=>{
    try{ if(window.CloudStorage&&CloudStorage.user){ await CloudStorage.deleteProfile(id); } else { S.profiles=S.profiles.filter(x=>x.id!==id); setProfiles(S.profiles); localStorage.removeItem(LS_DATA_PREFIX+id); idbDeleteProfileData(id); if(S.currentProfile&&S.currentProfile.id===id) logout(); else renderView(); } toast('Perfil excluído.'); }
    catch(e){ alert(e.message||String(e)); }
  }});
};
Settings.exportProfile = async function(){
  if(!S.currentProfile && !(S.profiles||[]).length){ alert('Entre em um perfil antes de exportar.'); return; }
  try{
    const payload = (typeof buildCloudAccountBackupPayload==='function') ? await buildCloudAccountBackupPayload('manual','exportação manual JSON completa') : await buildLocalAccountBackupPayload('manual','exportação manual JSON completa');
    downloadJSON(payload, `borion-conta-completa-${dateSlug()}.json`);
    toast('Backup completo exportado com todos os perfis da conta.');
  }catch(e){ alert(e.message||String(e)); }
};
/* V6.3.0 — mesmo caminho do botão "Entrar com uma conta na nuvem" do Gate, só que
   acessível de dentro do app (tela Configurações), pra quem está no modo local e
   decide, depois de já estar usando o Borion, que quer conta na nuvem. */
Settings.switchToCloudFromSettings = function(){
  setStorageMode('cloud');
  if(window.CloudAuth){ CloudAuth.mode='login'; CloudAuth.error=''; CloudAuth.info=''; CloudAuth.emailExpanded=false; CloudAuth.render(); }
};
Settings.emailBackup = function(){
  Settings.exportProfile();
  const p=S.currentProfile||{};
  const subject=encodeURIComponent('Backup completo - '+APP_NAME);
  const body=encodeURIComponent('Olá,\n\nSegue em anexo o backup completo do '+APP_NAME+'.\nO arquivo JSON foi baixado/salvo agora e contém todos os perfis da conta; anexe-o a este e-mail antes de enviar.\n\n');
  setTimeout(()=>{ window.location.href=`mailto:${p.email||''}?subject=${subject}&body=${body}`; },500);
};

/* ---------- V5.35.1: ações da tela Backups/Supabase ---------- */
Settings.showBackupConsent = function(){
  if(!window.BackupFS){ alert('Módulo de backup não carregou.'); return; }
  BackupFS.showConsentModal();
};
Settings.createCloudBackupNow = async function(type='manual', reason='backup manual'){
  try{
    if(!window.BackupFS) throw new Error('Módulo de backup não carregou.');
    const row = await BackupFS.createCloudBackup(type, reason);
    toast('Backup salvo no Supabase: borion_backups.');
    console.log('[BORION_BACKUP][MANUAL_UI][SUCCESS]', row);
  }catch(e){
    alert((e&&e.message?e.message:String(e))+'\n\nSe aparecer erro de tabela ou coluna, revise a configuração do Supabase usada pelo login antigo por e-mail.');
  }
};
/* V6.3.0 — mesma ideia do viewCloudBackups logo abaixo, só que lendo do histórico
   100% local (storageProvider/IndexedDB) — funciona sem Supabase e sem internet. */
Settings.viewLocalBackups = async function(){
  try{
    if(!window.storageProvider) throw new Error('Módulo de armazenamento não carregou.');
    const rows = await storageProvider.listBackups();
    const reasonLabels = {manual:'Manual', before_import:'Antes de importar', before_restore:'Antes de restaurar', before_schema_migration:'Antes de atualização', auto:'Automático'};
    const html = rows.length ? rows.map(r=>{
      const when = r.createdAt ? new Date(r.createdAt).toLocaleString('pt-BR') : '-';
      const reason = esc(reasonLabels[r.reasonType] || r.reasonType || 'backup');
      return `<div class="backup-vault-row">
        <div class="backup-vault-main"><b>${reason}</b><span>${esc(when)} · ${Number(r.profileCount||0)} perfil(is) · ${esc(r.appVersion||'')}</span></div>
        <div class="backup-vault-actions"><button class="btn-outline btn-sm" onclick="Settings.downloadLocalBackup('${r.id}')">Baixar</button><button class="btn-outline btn-sm" onclick="Settings.restoreLocalBackup('${r.id}')">Restaurar</button></div>
      </div>`;
    }).join('') : `<div class="info-box">Nenhum backup local ainda. Clique em "Criar backup agora".</div>`;
    const box = el(`
      <div class="modal-overlay">
        <div class="modal-box backup-vault-modal">
          <div class="modal-head"><h2>Backups neste dispositivo</h2><button id="lbv_close">&times;</button></div>
          <p class="modal-sub">Guardados só no navegador (IndexedDB), sem depender do Supabase. Backups manuais e "antes de importar/restaurar" nunca são apagados sozinhos; automáticos ficam limitados aos últimos 50.</p>
          <div class="backup-vault-list">${html}</div>
          <div class="row-btns" style="margin-top:12px;"><button class="btn btn-primary btn-block" id="lbv_new">Criar backup agora</button></div>
        </div>
      </div>`);
    $('#modal-root').innerHTML=''; $('#modal-root').appendChild(box); attachModalGuard(box);
    $('#lbv_close').onclick=closeModal;
    $('#lbv_new').onclick=async()=>{ try{ await storageProvider.createBackup('manual'); closeModal(); Settings.viewLocalBackups(); }catch(e){ alert(e.message||String(e)); } };
  }catch(e){ alert(e.message||String(e)); }
};
Settings.downloadLocalBackup = async function(id){
  try{
    const entry = await localBackupsGet(id);
    if(!entry) throw new Error('Backup não encontrado.');
    downloadJSON(entry.payload, `borion-backup-local-${dateSlug()}.json`);
  }catch(e){ alert(e.message||String(e)); }
};
Settings.restoreLocalBackup = function(id){
  openConfirmModal({
    title:'Restaurar backup local',
    text:'Você vai substituir os dados atuais pelo backup selecionado. O Borion cria um backup de segurança do estado atual antes de restaurar.',
    confirmLabel:'Restaurar',
    cancelLabel:'Cancelar',
    variant:'danger',
    onConfirm: async ()=>{
      try{ await storageProvider.restoreBackup(id); closeModal(); toast('Backup local restaurado.'); }
      catch(e){ alert(e.message||String(e)); }
    }
  });
};

/* V6.5.0 — mesma ideia do viewLocalBackups, lendo da pasta "backups" dentro da pasta
   do Google Drive em vez do IndexedDB local. */
Settings.viewDriveBackups = async function(){
  try{
    if(!window.GoogleDriveProvider || !GoogleDriveProvider.isConnected()) throw new Error('Google Drive não está conectado.');
    const rows = await GoogleDriveProvider.listBackups();
    const html = rows.length ? rows.map(r=>{
      const when = r.modifiedTime ? new Date(r.modifiedTime).toLocaleString('pt-BR') : '-';
      return `<div class="backup-vault-row">
        <div class="backup-vault-main"><b>${esc(r.name)}</b><span>${esc(when)}</span></div>
        <div class="backup-vault-actions"><button class="btn-outline btn-sm" onclick="Settings.restoreDriveBackup('${r.id}')">Restaurar</button></div>
      </div>`;
    }).join('') : `<div class="info-box">Nenhum backup no Drive ainda. Clique em "Criar backup agora".</div>`;
    const box = el(`
      <div class="modal-overlay">
        <div class="modal-box backup-vault-modal">
          <div class="modal-head"><h2>Backups no Google Drive</h2><button id="dbv_close">&times;</button></div>
          <p class="modal-sub">Guardados na pasta "backups", dentro da sua pasta do Drive.</p>
          <div class="backup-vault-list">${html}</div>
          <div class="row-btns" style="margin-top:12px;"><button class="btn btn-primary btn-block" id="dbv_new">Criar backup agora</button></div>
        </div>
      </div>`);
    $('#modal-root').innerHTML=''; $('#modal-root').appendChild(box); attachModalGuard(box);
    $('#dbv_close').onclick=closeModal;
    $('#dbv_new').onclick=async()=>{ try{ await GoogleDriveProvider.createBackup('manual'); closeModal(); toast('Backup criado no Drive.'); Settings.viewDriveBackups(); }catch(e){ alert(e.message||String(e)); } };
  }catch(e){ alert(e.message||String(e)); }
};
Settings.restoreDriveBackup = function(fileId){
  openConfirmModal({
    title:'Restaurar backup do Google Drive',
    text:'Você vai substituir os dados atuais pelo backup selecionado. O Borion cria um backup de segurança do estado atual antes de restaurar.',
    confirmLabel:'Restaurar',
    cancelLabel:'Cancelar',
    variant:'danger',
    onConfirm: async ()=>{
      try{ await GoogleDriveProvider.restoreBackup(fileId); closeModal(); toast('Backup restaurado.'); renderGate(); }
      catch(e){ alert(e.message||String(e)); }
    }
  });
};

Settings.backupSingleProfile = async function(profileId){
  const pr = (S.profiles||[]).find(x=>x.id===profileId);
  if(!pr){ alert('Perfil não encontrado.'); return; }
  try{
    if(window.GoogleDriveProvider && GoogleDriveProvider.isConnected()){
      const r = await GoogleDriveProvider.exportSingleProfileToDrive(profileId);
      toast('Backup de "'+pr.name+'" salvo no Drive ('+r.name+').');
    } else {
      let data = (S.currentProfile && S.currentProfile.id===profileId && S.data) ? S.data : getProfileData(profileId);
      data = migrateData(data || emptyData());
      const payload = {type:'multicap-profile-backup', version:2, exportedAt:new Date().toISOString(), profile:{id:pr.id,name:pr.name,email:pr.email,passwordHash:pr.passwordHash,salt:pr.salt,avatarColor:pr.avatarColor,avatarImage:pr.avatarImage}, data};
      downloadJSON(payload, `perfil-${slug(pr.name)}-${dateSlug()}.json`);
      toast('Backup de "'+pr.name+'" baixado.');
    }
  }catch(e){ alert(e.message||String(e)); }
};

Settings.viewCloudBackups = async function(){
  try{
    if(!window.BackupFS) throw new Error('Módulo de backup não carregou.');
    const rows = await BackupFS.listCloudBackups();
    const html = rows.length ? rows.map(r=>{
      const when = r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '-';
      const reason = r.reason ? esc(r.reason) : 'sem observação';
      return `<div class="backup-vault-row">
        <div class="backup-vault-main"><b>${esc(r.backup_type||'backup')}</b><span>${esc(when)} · ${Number(r.profile_count||0)} perfil(is) · ${esc(r.app_version||'')}</span><em>${reason}</em></div>
        <div class="backup-vault-actions"><button class="btn-outline btn-sm" onclick="BackupFS.downloadCloudBackup('${r.id}')">Baixar</button><button class="btn-outline btn-sm" onclick="BackupFS.restoreCloudBackup('${r.id}')">Restaurar</button></div>
      </div>`;
    }).join('') : `<div class="info-box">Nenhum backup salvo ainda. Clique em “Salvar snapshot no Supabase”.</div>`;
    const box = el(`
      <div class="modal-overlay">
        <div class="modal-box backup-vault-modal">
          <div class="modal-head"><h2>Backups salvos no Supabase</h2><button id="bv_close">&times;</button></div>
          <p class="modal-sub">Local técnico: Supabase → Table Editor → <b>borion_backups</b>. São exibidos os últimos 30 snapshots desta conta.</p>
          <div class="backup-vault-list">${html}</div>
          <div class="row-btns" style="margin-top:12px;"><button class="btn btn-primary btn-block" id="bv_new">Criar backup agora</button></div>
        </div>
      </div>`);
    $('#modal-root').innerHTML=''; $('#modal-root').appendChild(box); attachModalGuard(box);
    $('#bv_close').onclick=closeModal;
    $('#bv_new').onclick=async()=>{ try{ await BackupFS.createCloudBackup('manual','backup criado pela lista de backups'); closeModal(); Settings.viewCloudBackups(); }catch(e){ alert(e.message||String(e)); } };
  }catch(e){ alert(e.message||String(e)); }
};


/* V6.24.6 — expõe a rotina central de backup para Ctrl+S e o atalho fixo do Modo Pro.
   O objeto era declarado com const e, por isso, não existia em window.Settings. */
window.Settings = Settings;
