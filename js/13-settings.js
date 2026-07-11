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
      ${settingsTabButton('backup','Backups')}
    </div>`;
  let content='';
  if(S.settingsTab==='modules') content = renderSettingsModules();
  else if(S.settingsTab==='dashboard') content = renderSettingsDashboard();
  else if(S.settingsTab==='profiles') content = renderSettingsProfiles();
  else if(S.settingsTab==='categories') content = renderSettingsCategories();
  else if(S.settingsTab==='personalization') content = renderSettingsPersonalization();
  else if(S.settingsTab==='backup') content = renderSettingsBackup();
  return `<div class="settings-layout">${tabs}<div class="settings-content">${content}</div><div class="version-tag">V. 6.20.0 • Saves 1x/min, Ctrl+S com histórico e corrigido bug do "voltar"</div><div style="margin-top:32px;padding-top:16px;border-top:1px solid rgba(255,255,255,.12);text-align:center;opacity:.85;font-size:.95rem;line-height:1.7">
<div><strong>Versão:</strong> 6.20.0</div>
<div><strong>Lançamento:</strong> 09/07/2026</div>
<div>Desenvolvido por <strong>Pedro Bardella</strong></div>
<div>© 2026 Pedro Bardella. Todos os direitos reservados.</div>
</div></div>`;
}
function renderSettingsModules(){
  const chequesEnabled = !!(S.data.cheques && S.data.cheques.enabled);
  const reservasEnabledNow = !!(S.data.modules && S.data.modules.reserves !== false && S.data.reservas && S.data.reservas.enabled !== false);
  const importsEnabled = !!(S.data.modules && S.data.modules.imports !== false);
  const popupCfg = S.config.popupNotifs || {enabled:true,durationMs:40000};
  const popupEnabled = popupCfg.enabled !== false;
  const dur = Number(popupCfg.durationMs)||40000;
  return `
    <div class="settings-section settings-hero-section"><h3>Módulos do Borion</h3><p class="desc">Ative só o que você usa. Desativar uma função apenas oculta a tela; não apaga seus dados.</p></div>
    <div class="settings-module-grid">
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
    </div>
    ${window.OrderPreferences ? OrderPreferences.renderModulesOrganizePanel() : ''}`;
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
  const catBlock = (typeKey, typeLabel) => {
    const list = (S.data.categorias && S.data.categorias[typeKey]) ? S.data.categorias[typeKey] : [];
    const tags = list.map(c=>`
      <span class="cat-tag cat-tag-manage" style="--cat-color:${esc(categoryColor(typeKey,c))}">
        <span class="cat-dot"></span>
        <span class="cat-tag-name">${esc(c)}</span>
        <input type="color" class="cat-color-inline" value="${esc(categoryColor(typeKey,c))}" title="Cor da categoria" onchange="Settings.setCategoryColor(${jsArg(typeKey)},${jsArg(c)},this.value)">
        <button class="cat-mini-btn" onclick="Settings.renameCategory(${jsArg(typeKey)},${jsArg(c)})" title="Renomear">✎</button>
        <button class="cat-mini-btn danger" onclick="Settings.deleteCategory(${jsArg(typeKey)},${jsArg(c)})" title="Excluir">&times;</button>
      </span>`).join('');
    return `<div class="cat-manage-group cat-panel"><h4>${esc(typeLabel)}</h4><p class="desc">Uma categoria pode ser usada em vários lançamentos. A cor aparece nas etiquetas e facilita bater o olho.</p><div class="cat-tag-list">${tags||'<span class="desc">Nenhuma categoria ainda.</span>'}</div><button class="btn-outline btn-sm" onclick="Settings.addCategory(${jsArg(typeKey)})">+ Nova categoria</button></div>`;
  };
  return `
    <div class="settings-section settings-hero-section"><h3>Categorias</h3><p class="desc">Receitas, despesas fixas e despesas variáveis agora têm cor própria. Se uma categoria já estiver vinculada a lançamentos, o Borion bloqueia a exclusão para não bagunçar seu histórico.</p></div>
    <div class="settings-categories-grid">${catBlock('receita','Receitas')}${catBlock('fixa','Despesas fixas')}${catBlock('variavel','Despesas variáveis')}</div>`;
}
function renderSettingsPersonalization(){
  const fontOptions = Object.keys(FONT_LABELS).map(k=>`<option value="${k}" ${S.config.font===k?'selected':''}>${esc(FONT_LABELS[k])}</option>`).join('');
  const theme = S.config.theme || 'dark';
  return `
    <div class="settings-section settings-hero-section"><h3>Personalização</h3><p class="desc">Ajustes visuais seguros, sem mexer na identidade do Borion nem transformar o app em carnaval.</p></div>
    <div class="settings-section"><h3>Tema</h3><p class="desc">Use o tema private banking escuro, o tema claro ou siga o tema do sistema.</p><div class="field" style="max-width:320px;"><select id="cfg_theme"><option value="dark" ${theme==='dark'?'selected':''}>Escuro / Private banking</option><option value="light" ${theme==='light'?'selected':''}>Claro / Branco</option><option value="system" ${theme==='system'?'selected':''}>Tema do sistema</option></select></div></div>
    <div class="settings-section"><h3>Fonte do app</h3><p class="desc">Escolha a fonte usada em todo o app.</p><div class="field" style="max-width:320px;"><select id="cfg_font">${fontOptions}</select></div></div>
    <div class="info-box">A personalização de cores dos ícones continua fora da tela para manter o visual premium e consistente.</div>`;
}


const Settings = {
  setTab(tab){ S.settingsTab=tab; renderView(); },
  addCategory(typeKey){
    openModal({title:'Nova categoria', fields:[{key:'nome',label:'Nome da categoria',type:'text'}], onSave(v){ if(v.nome && !S.data.categorias[typeKey].includes(v.nome)){ S.data.categorias[typeKey].push(v.nome); saveCurrentData(); } closeModal(); renderView(); }});
  },
  renameCategory(typeKey, oldName){
    openModal({title:'Renomear categoria', fields:[{key:'nome',label:'Novo nome',type:'text',default:oldName}], onSave(v){ const list=S.data.categorias[typeKey]; const idx=list.indexOf(oldName); if(idx>-1 && v.nome){ list[idx]=v.nome; S.data.transacoes.forEach(t=>{ if(t.categoria===oldName) t.categoria=v.nome; }); S.data.fixas.forEach(f=>{ if(f.categoria===oldName) f.categoria=v.nome; }); saveCurrentData(); } closeModal(); renderView(); }});
  },
  deleteCategory(typeKey, name){
    const snapshot=JSON.parse(JSON.stringify(S.data)); S.data.categorias[typeKey]=S.data.categorias[typeKey].filter(c=>c!==name); if(!S.data.categorias[typeKey].includes('Outro')) S.data.categorias[typeKey].push('Outro'); S.data.transacoes.forEach(t=>{ if(t.categoria===name) t.categoria='Outro'; }); S.data.fixas.forEach(f=>{ if(f.categoria===name) f.categoria='Outro'; }); saveCurrentData(); renderView(); showUndoToast('Categoria "'+name+'" excluída.', ()=>{ S.data=snapshot; saveCurrentData(); renderView(); });
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
  toggleCheques(){ if(!S.data.cheques) S.data.cheques={enabled:false,items:[]}; S.data.cheques.enabled=!S.data.cheques.enabled; if(!Array.isArray(S.data.cheques.items)) S.data.cheques.items=[]; saveCurrentData(); if(!S.data.cheques.enabled && S.view==='cheques') S.view='settings'; renderApp(); toast(S.data.cheques.enabled?'Módulo de cheques ativado.':'Módulo de cheques desativado.'); },
  toggleReservas(){ if(!S.data.modules) S.data.modules=Object.assign({},DEFAULT_MODULES); if(!S.data.reservas) S.data.reservas={enabled:true,boxes:[],moves:[]}; const next = !(S.data.modules.reserves !== false && S.data.reservas.enabled !== false); S.data.modules.reserves=next; S.data.reservas.enabled=next; saveCurrentData(); if(!next && S.view==='reservas') S.view='settings'; renderApp(); toast(next?'Reserva ativada.':'Reserva desativada.'); },
  toggleImports(){ if(!S.data.modules) S.data.modules=Object.assign({},DEFAULT_MODULES); S.data.modules.imports = !(S.data.modules.imports !== false); saveCurrentData(); if(S.data.modules.imports===false && S.view==='imports') S.view='settings'; renderApp(); toast(S.data.modules.imports!==false?'Importador de extratos ativado.':'Importador de extratos desativado.'); },
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
    <div class="settings-section"><h3>Perfis desta conta (${(S.profiles||[]).length}/5)</h3><p class="desc">Troque entre perfis sem misturar dados. Cada perfil tem armazenamento local e registro separado no Supabase.</p>${profilesRows}<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">${(S.profiles||[]).length<5?`<button class="btn-outline btn-sm" onclick="Settings.createFinancialProfile()">+ Criar perfil</button>`:''}<button class="btn-outline btn-sm" onclick="document.getElementById('import_file').click()">Importar JSON</button></div><input type="file" id="import_file" accept="application/json" style="display:none;"></div>`;
}

/* V6.14.0 — "Nuvem" e "Backups" eram duas abas separadas, e a de Backups sempre
   mostrava textos do Supabase (nomes de tabela, "Salvar snapshot no Supabase" etc.)
   mesmo pra quem usa Google Drive ou modo local — informação irrelevante e confusa.
   Unificado numa aba só, que mostra só o que é relevante pro modo atual. */
function renderSettingsBackup(){
  const cloud = window.CloudStorage;
  const user = cloud && cloud.user;
  const isDrive = !user && window.GoogleDriveProvider && GoogleDriveProvider.isConnected();
  const isLocal = !user && !isDrive;

  const localBackupsBlock = `
    <div class="settings-section"><h3>Backups neste dispositivo</h3><p class="desc">Histórico guardado só no navegador (IndexedDB) — funciona mesmo sem conta na nuvem, e mesmo sem internet.</p><div style="display:flex;gap:10px;flex-wrap:wrap;"><button class="btn-outline btn-sm" onclick="Settings.viewLocalBackups()">Ver backups deste dispositivo</button></div></div>`;

  let backupFolderBlock;
  if(!FS_ACCESS_SUPPORTED) backupFolderBlock = `<p class="desc">Este navegador não permite escolher uma pasta fixa pra backup automático.</p>`;
  else if(BackupFS.needsReconnect) backupFolderBlock = `<div class="reconnect-banner"><span>A pasta de backups precisa ser reautorizada após reabrir o app.</span><button class="btn-outline btn-sm" onclick="BackupFS.reconnect()">Reconectar pasta</button></div>`;
  else if(BackupFS.dirHandle) backupFolderBlock = `<div class="gold-box">Pasta local configurada. O Borion salva arquivos dentro da subpasta <b>Backups_Borion</b>.</div><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;"><button class="btn-outline btn-sm" onclick="BackupFS.choose()">Trocar pasta</button><button class="btn-outline btn-sm" onclick="BackupFS.disconnect()">Desconectar pasta</button></div>`;
  else backupFolderBlock = `<p class="desc">Escolha uma pasta local (ex: uma pasta sincronizada com Google Drive/OneDrive) pra cópias automáticas extras neste dispositivo.</p><button class="btn btn-primary btn-sm" onclick="BackupFS.choose()">Escolher pasta de backups</button>`;
  const folderSection = `
    <div class="settings-section"><h3>Pasta local extra (opcional)</h3>
      ${backupFolderBlock}
      <div class="info-box">Por segurança do navegador, o Borion não pode criar uma pasta sozinho sem você autorizar.</div>
    </div>`;

  if(isDrive){
    const gs = GoogleDriveProvider.getStatus();
    const conflictBanner = gs.conflict ? `<div class="info-box danger-box"><b>Atenção:</b> existe uma versão mais recente desta conta salva no Google Drive (provavelmente de outro dispositivo). Escolha uma: <button class="btn-outline btn-sm" onclick="GoogleDriveProvider.reload()">Recarregar (usar a versão do Drive)</button> <button class="btn-outline btn-sm" onclick="forceManualSave()">Salvar minha versão agora (Ctrl+S)</button></div>` : '';
    return `
    <div class="settings-section settings-hero-section"><h3>Backups e Google Drive</h3><p class="desc">Seus dados sincronizam automaticamente com a pasta compartilhada do Google Drive.</p></div>
    ${conflictBanner}
    <div class="settings-section"><h3>Status</h3><p class="desc"><strong>Conta:</strong> ${esc(gs.email||'')}<br><strong>Pasta conectada:</strong> ${esc(gs.folderName||'(não identificada)')} ${gs.folderLink?`<a href="${esc(gs.folderLink)}" target="_blank" rel="noopener">Abrir no Google Drive ↗</a>`:''}<br><strong>Status:</strong> ${gs.conflict?'Conflito — veja acima':gs.pending?'Salvando alterações...':'Tudo sincronizado'}<br><strong>Perfil ativo:</strong> ${esc(S.currentProfile?S.currentProfile.name:'Nenhum')}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;"><button class="btn btn-primary btn-sm" onclick="GoogleDriveProvider.syncNow()">Sincronizar agora</button><button class="btn-outline btn-sm" onclick="Settings.exportProfile()">Exportar conta completa</button><button class="btn-outline btn-sm" onclick="GoogleDriveProvider.disconnect();S.currentProfile=null;S.data=null;CloudAuth.mode='login';CloudAuth.error='';CloudAuth.info='';CloudAuth.render();">Sair da conta Google</button></div>
    </div>
    <div class="settings-section"><h3>Backups no Google Drive</h3><p class="desc">Histórico guardado na pasta <b>backups</b>, dentro da pasta acima. Limpeza automática mantém no máximo ~10GB (mais antigos são apagados — o histórico completo continua no disco local).</p><div style="display:flex;gap:10px;flex-wrap:wrap;"><button class="btn-outline btn-sm" onclick="Settings.viewDriveBackups()">Ver backups no Drive</button></div></div>
    ${localBackupsBlock}
    ${folderSection}
    <div class="info-box">Se a internet cair, o Borion continua salvando neste dispositivo e envia pro Drive automaticamente quando a conexão voltar.</div>`;
  }

  if(isLocal){
    const st = (window.storageProvider ? storageProvider.getStorageStatus() : {profileCount:(S.profiles||[]).length, online:navigator.onLine});
    return `
    <div class="settings-section settings-hero-section"><h3>Backups</h3><p class="desc">Você está usando o Borion sem conta — os dados ficam só neste dispositivo.</p></div>
    <div class="settings-section"><h3>Status</h3><p class="desc"><strong>Modo:</strong> Local (sem conta)<br><strong>Perfis neste dispositivo:</strong> ${st.profileCount||0}<br><strong>Perfil ativo:</strong> ${esc(S.currentProfile?S.currentProfile.name:'Nenhum')}<br><strong>Conexão:</strong> ${st.online?'Online':'Offline'}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;"><button class="btn btn-primary btn-sm" onclick="Settings.exportProfile()">Exportar conta completa</button><button class="btn-outline btn-sm" onclick="document.getElementById('import_file_cloud').click()">Importar JSON</button><button class="btn-outline btn-sm" onclick="Settings.switchToCloudFromSettings()">Entrar com uma conta na nuvem</button></div>
      <input type="file" id="import_file_cloud" accept="application/json" style="display:none;">
    </div>
    ${localBackupsBlock}
    ${folderSection}
    <div class="info-box">Entrar com uma conta permite sincronizar entre celular e computador — seus perfis locais continuam aqui e voltam a aparecer se você sair da conta depois.</div>
    ${renderInstallAppCard()}`;
  }

  // ---- Só chega aqui se realmente estiver logado no Supabase (legado) ----
  const pending = cloud && cloud.pendingInfo ? cloud.pendingInfo() : null;
  const last = cloud && cloud.lastSyncAt ? new Date(cloud.lastSyncAt).toLocaleString('pt-BR') : 'Ainda não sincronizou nesta sessão';
  const status = cloud ? (cloud.statusLabel ? cloud.statusLabel() : (cloud.statusText || cloud.status || 'Indisponível')) : 'Módulo de nuvem não carregado';
  const pendingTxt = pending ? `Existe sincronização pendente desde ${new Date(pending.savedAt).toLocaleString('pt-BR')}. Motivo: ${esc(pending.reason||'pendente')}` : 'Nenhum dado pendente no cache local.';
  const profileName = S.currentProfile ? S.currentProfile.name : 'Nenhum perfil ativo';
  const schema = cloud && cloud.schemaError ? `<div class="info-box danger-box"><b>Atenção:</b> ${esc(cloud.schemaError)}<br>Rode o arquivo <b>docs-tecnicos/SUPABASE_V5.34_CLOUD_FOUNDATION.sql</b> no Supabase.</div>` : '';
  const consent = window.BackupFS ? BackupFS.hasConsent() : null;
  const consentText = consent ? `Aceito em ${new Date(consent.acceptedAt).toLocaleString('pt-BR')} · modo: ${esc(consent.mode||'backup')}` : 'Ainda não configurado neste dispositivo.';
  return `
    <div class="settings-section settings-hero-section"><h3>Borion Cloud Foundation</h3><p class="desc">Conta, perfis financeiros, sincronização real, cache local e proteção contra perda de dados.</p></div>
    ${schema}
    <div class="settings-section"><h3>Status da nuvem</h3><p class="desc"><strong>Usuário logado:</strong> ${user?esc(user.email||'logado'):'não logado'}<br><strong>Perfil financeiro ativo:</strong> ${esc(profileName)}<br><strong>Status:</strong> ${esc(status)}<br><strong>Última sincronização:</strong> ${esc(last)}<br><strong>Dados pendentes:</strong> ${pendingTxt}</p><div style="display:flex;gap:10px;flex-wrap:wrap;"><button class="btn btn-primary btn-sm" onclick="cloudForceSync()">Sincronizar agora</button><button class="btn-outline btn-sm" onclick="cloudRunSupabaseDiagnostic()">Diagnóstico Supabase</button><button class="btn-outline btn-sm" onclick="Settings.exportProfile()">Exportar conta completa</button><button class="btn-outline btn-sm" onclick="document.getElementById('import_file_cloud').click()">Importar JSON</button><button class="btn-outline btn-sm" onclick="cloudChangePasswordFromSettings()">Trocar senha da conta/login</button>${user?`<button class="btn-danger btn-sm" onclick="Settings.deleteCloudAccountFlow()">Excluir conta</button>`:''}<button class="btn-outline btn-sm" onclick="cloudLogout()">Sair da conta</button></div><input type="file" id="import_file_cloud" accept="application/json" style="display:none;"></div>
    <div class="settings-section"><h3>Aceite de proteção de dados</h3><p class="desc"><strong>Status:</strong> ${consentText}</p><div style="display:flex;gap:10px;flex-wrap:wrap;"><button class="btn-outline btn-sm" onclick="Settings.showBackupConsent()">Ver termo/configurar proteção</button><button class="btn-outline btn-sm" onclick="Settings.createCloudBackupNow('first_setup','backup criado manualmente pela tela de segurança')">Criar backup inicial agora</button></div></div>
    <div class="settings-section"><h3>Backups no Supabase</h3><p class="desc">Gera um JSON completo com todos os perfis da conta.</p><div style="display:flex;gap:10px;flex-wrap:wrap;"><button class="btn-outline btn-sm" onclick="Settings.createCloudBackupNow('manual','backup manual completo')">Salvar snapshot no Supabase</button><button class="btn-outline btn-sm" onclick="Settings.viewCloudBackups()">Ver backups do Supabase</button></div></div>
    ${localBackupsBlock}
    ${folderSection}
    <div class="info-box">Fluxo: alteração → salva local/offline → marca pendente → envia ao Supabase → limpa pendência.</div>
    ${user?`<div class="settings-section danger-box"><h3>Excluir conta Borion Cloud</h3><p class="desc">Apaga a conta de login, e-mail, todos os perfis financeiros e todos os dados monetários salvos no Supabase.</p><button class="btn btn-danger btn-sm" onclick="Settings.deleteCloudAccountFlow()">Excluir conta</button></div>`:''}
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
  const finishBtn = $('#del_finish'); if(finishBtn) finishBtn.onclick = ()=>{ closeModal(); CloudAuth.mode='login'; CloudAuth.info='Sua conta foi cancelada. Todos os dados foram apagados. Esperamos vê-lo em breve novamente.'; CloudAuth.error=''; CloudAuth.render(); };
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
  if(window.CloudAuth){ CloudAuth.mode='login'; CloudAuth.error=''; CloudAuth.info=''; CloudAuth.render(); }
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
    alert((e&&e.message?e.message:String(e))+'\n\nSe aparecer erro de tabela/coluna, rode o SQL docs-tecnicos/SUPABASE_V5.35_BACKUP_SECURITY.sql ou o SQL Cloud Foundation atualizado.');
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
