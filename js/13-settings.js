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
  const tabs = `
    <div class="settings-tabs">
      ${settingsTabButton('modules','Módulos')}
      ${settingsTabButton('dashboard','Dashboard')}
      ${settingsTabButton('profiles','Perfis')}
      ${settingsTabButton('categories','Categorias')}
      ${settingsTabButton('personalization','Personalização')}
      ${settingsTabButton('backup','Backups')}
      ${settingsTabButton('cloud','Nuvem')}
    </div>`;
  let content='';
  if(S.settingsTab==='modules') content = renderSettingsModules();
  else if(S.settingsTab==='dashboard') content = renderSettingsDashboard();
  else if(S.settingsTab==='profiles') content = renderSettingsProfiles();
  else if(S.settingsTab==='categories') content = renderSettingsCategories();
  else if(S.settingsTab==='personalization') content = renderSettingsPersonalization();
  else if(S.settingsTab==='backup') content = renderSettingsBackup();
  else if(S.settingsTab==='cloud') content = renderSettingsCloud();
  return `<div class="settings-layout">${tabs}<div class="settings-content">${content}</div><div class="version-tag">V. 5.35.1 • Backup Security Foundation</div><div style="margin-top:32px;padding-top:16px;border-top:1px solid rgba(255,255,255,.12);text-align:center;opacity:.85;font-size:.95rem;line-height:1.7">
<div><strong>Versão:</strong> 5.35.1</div>
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
function renderSettingsProfiles(){
  const p = S.currentProfile;
  const profilesRows = S.profiles.map(pr=>`
    <div class="profile-row">
      ${profileAvatarHTML(pr)}
      <div class="info"><div class="n">${esc(pr.name)} ${pr.id===p.id?'(você)':''}</div><div class="e">${esc(pr.email||'sem e-mail')} · ${pr.passwordHash?'com senha':'sem senha'}</div></div>
      <button class="btn-outline btn-sm" onclick="Settings.deleteProfile('${pr.id}')">Excluir</button>
    </div>`).join('');
  return `
    <div class="settings-section settings-hero-section"><h3>Perfil atual</h3><p class="desc">Gerencie nome, e-mail, senha e aparência do avatar.</p></div>
    <div class="profile-editor-card">
      <div class="profile-editor-avatar">${profileAvatarHTML(p,'profile-avatar-xl')}<button class="btn-outline btn-sm" onclick="document.getElementById('pf_avatar_file').click()">Trocar foto</button><button class="btn-outline btn-sm" onclick="Settings.removeAvatarImage()">Remover foto</button></div>
      <div class="profile-editor-fields">
        <div class="field"><label>Nome</label><input type="text" id="pf_name" value="${esc(p.name)}"/></div>
        <div class="field"><label>E-mail</label><input type="email" id="pf_email" value="${esc(p.email||'')}"/></div>
        <div class="field"><label>Cor do fundo do avatar</label><input type="color" id="pf_avatar_color" value="${esc(profileAvatarBg(p))}"/></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;"><button class="btn btn-primary btn-sm" onclick="Settings.savePersonal()">Salvar perfil</button>${p.passwordHash ? `<button class="btn-outline btn-sm" onclick="Settings.changePassword()">Alterar senha</button><button class="btn-outline btn-sm" onclick="Settings.removePassword()">Remover senha</button>` : `<button class="btn-outline btn-sm" onclick="Settings.setPasswordFlow()">Definir senha</button>`}</div>
        <input type="file" id="pf_avatar_file" accept="image/*" style="display:none" onchange="Settings.readAvatarFile(this)">
      </div>
    </div>
    <div class="settings-section"><h3>Gerenciar perfis (${S.profiles.length}/5)</h3><p class="desc">Crie, exclua ou importe perfis. Cada perfil mantém seus próprios dados.</p>${profilesRows}<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">${S.profiles.length<5 ? `<button class="btn-outline btn-sm" onclick="logout()">+ Criar novo perfil</button>` : ''}<button class="btn-outline btn-sm" onclick="document.getElementById('import_file').click()">Importar backup/perfil</button></div><input type="file" id="import_file" accept="application/json" style="display:none;"></div>`;
}
function renderSettingsCategories(){
  const catBlock = (typeKey, typeLabel) => {
    const tags = S.data.categorias[typeKey].map(c=>`<span class="cat-tag">${esc(c)}<button onclick="Settings.renameCategory('${typeKey}','${esc(c)}')">✎</button><button onclick="Settings.deleteCategory('${typeKey}','${esc(c)}')">&times;</button></span>`).join('');
    return `<div class="cat-manage-group cat-panel"><h4>${typeLabel}</h4><div class="cat-tag-list">${tags}</div><button class="btn-outline btn-sm" onclick="Settings.addCategory('${typeKey}')">+ Nova categoria</button></div>`;
  };
  return `
    <div class="settings-section settings-hero-section"><h3>Categorias</h3><p class="desc">Receitas, despesas fixas e despesas variáveis ficam separadas para não virar bagunça.</p></div>
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

function renderSettingsCloud(){
  const cloud = window.CloudStorage;
  const user = cloud && cloud.user;
  const pending = cloud && cloud.pendingInfo ? cloud.pendingInfo() : null;
  const last = cloud && cloud.lastSyncAt ? new Date(cloud.lastSyncAt).toLocaleString('pt-BR') : 'Ainda não sincronizou nesta sessão';
  const status = cloud ? (cloud.statusText || cloud.status || 'Indisponível') : 'Módulo de nuvem não carregado';
  const pendingTxt = pending ? `Existe sincronização pendente desde ${new Date(pending.savedAt).toLocaleString('pt-BR')}. Motivo: ${esc(pending.reason||'pendente')}` : 'Nenhum dado pendente no cache local.';
  return `
    <div class="settings-section settings-hero-section"><h3>Borion Cloud</h3><p class="desc">Login, senha, sincronização e segurança dos dados na nuvem.</p></div>
    <div class="settings-section"><h3>Status da nuvem</h3><p class="desc"><strong>Conta:</strong> ${user?esc(user.email||'logado'):'não logado'}<br><strong>Status:</strong> ${esc(status)}<br><strong>Última sincronização:</strong> ${esc(last)}<br><strong>Cache local:</strong> ${pendingTxt}</p><div style="display:flex;gap:10px;flex-wrap:wrap;"><button class="btn btn-primary btn-sm" onclick="cloudForceSync()">Sincronizar agora</button><button class="btn-outline btn-sm" onclick="cloudChangePasswordFromSettings()">Alterar senha da nuvem</button><button class="btn-outline btn-sm" onclick="cloudLogout()">Sair da conta</button></div></div>
    <div class="info-box">Se a internet cair, o Borion salva no cache local e tenta enviar para o Supabase automaticamente quando a conexão voltar. Se houver pendência, o app avisa ao tentar fechar a página.</div>
  `;
}

function renderSettingsBackup(){
  let backupFolderBlock;
  if(!FS_ACCESS_SUPPORTED){
    backupFolderBlock = `<p class="desc">Seu navegador não permite escolher uma pasta fixa para backups automáticos. Use backup manual abaixo.</p>`;
  } else if(BackupFS.needsReconnect){
    backupFolderBlock = `<div class="reconnect-banner"><span>A pasta de backups precisa ser reautorizada após reabrir o app.</span><button class="btn-outline btn-sm" onclick="BackupFS.reconnect()">Reconectar pasta</button></div>`;
  } else if(BackupFS.dirHandle){
    backupFolderBlock = `<div class="gold-box">Pasta de backups configurada. O app salva backups automáticos dentro da subpasta <b>Backups</b>.</div><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;"><button class="btn-outline btn-sm" onclick="BackupFS.choose()">Trocar pasta</button><button class="btn-outline btn-sm" onclick="BackupFS.disconnect()">Desconectar pasta</button></div>`;
  } else {
    backupFolderBlock = `<p class="desc">Escolha uma pasta para o app salvar backups automáticos. Dica: use uma pasta dentro do Google Drive sincronizado.</p><button class="btn btn-primary btn-sm" onclick="BackupFS.choose()">Escolher pasta de backups</button>`;
  }
  return `
    <div class="settings-section settings-hero-section"><h3>Backups e portabilidade</h3><p class="desc">Leve seus dados para outro computador ou mantenha cópias seguras.</p></div>
    <div class="settings-section"><h3>Pasta de backups automáticos</h3>${backupFolderBlock}</div>
    <div class="settings-section"><h3>Backup manual</h3><p class="desc">Gere um backup a qualquer momento, importe backup antigo ou envie por e-mail.</p><div style="display:flex;gap:10px;flex-wrap:wrap;"><button class="btn btn-primary btn-sm" onclick="BackupFS.manualBackupNow()">Gerar backup agora</button><button class="btn-outline" onclick="Settings.exportProfile()">Exportar só este perfil</button><button class="btn-outline" onclick="document.getElementById('import_file_backup').click()">Importar backup</button><button class="btn-outline" onclick="Settings.emailBackup()">Enviar por e-mail</button></div><input type="file" id="import_file_backup" accept="application/json" style="display:none;"><div class="info-box">Antes de importar, o app pergunta se você quer substituir ou importar como novo perfil.</div></div>`;
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
    <div class="settings-section"><h3>Perfis desta conta (${(S.profiles||[]).length}/5)</h3><p class="desc">Troque entre perfis tipo Netflix sem misturar dados. Cada perfil tem armazenamento local e registro separado no Supabase.</p>${profilesRows}<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">${(S.profiles||[]).length<5?`<button class="btn-outline btn-sm" onclick="Settings.createFinancialProfile()">+ Criar perfil</button>`:''}<button class="btn-outline btn-sm" onclick="document.getElementById('import_file').click()">Importar JSON</button></div><input type="file" id="import_file" accept="application/json" style="display:none;"></div>`;
}

function renderSettingsCloud(){
  const cloud = window.CloudStorage;
  const user = cloud && cloud.user;
  const pending = cloud && cloud.pendingInfo ? cloud.pendingInfo() : null;
  const last = cloud && cloud.lastSyncAt ? new Date(cloud.lastSyncAt).toLocaleString('pt-BR') : 'Ainda não sincronizou nesta sessão';
  const status = cloud ? (cloud.statusLabel ? cloud.statusLabel() : (cloud.statusText || cloud.status || 'Indisponível')) : 'Módulo de nuvem não carregado';
  const pendingTxt = pending ? `Existe sincronização pendente desde ${new Date(pending.savedAt).toLocaleString('pt-BR')}. Motivo: ${esc(pending.reason||'pendente')}` : 'Nenhum dado pendente no cache local.';
  const profileName = S.currentProfile ? S.currentProfile.name : 'Nenhum perfil ativo';
  const schema = cloud && cloud.schemaError ? `<div class="info-box danger-box"><b>Atenção:</b> ${esc(cloud.schemaError)}<br>Rode o arquivo <b>SUPABASE_V5.34_CLOUD_FOUNDATION.sql</b> no Supabase.</div>` : '';
  return `
    <div class="settings-section settings-hero-section"><h3>Borion Cloud Foundation</h3><p class="desc">Conta, perfis financeiros, sincronização real, cache local e proteção contra perda de dados.</p></div>
    ${schema}
    <div class="settings-section"><h3>Status da nuvem</h3><p class="desc"><strong>Usuário logado:</strong> ${user?esc(user.email||'logado'):'não logado'}<br><strong>Perfil financeiro ativo:</strong> ${esc(profileName)}<br><strong>Status:</strong> ${esc(status)}<br><strong>Última sincronização:</strong> ${esc(last)}<br><strong>Dados pendentes:</strong> ${pendingTxt}</p><div style="display:flex;gap:10px;flex-wrap:wrap;"><button class="btn btn-primary btn-sm" onclick="cloudForceSync()">Sincronizar agora</button><button class="btn-outline btn-sm" onclick="cloudRunSupabaseDiagnostic()">Diagnóstico Supabase</button><button class="btn-outline btn-sm" onclick="Settings.exportProfile()">Exportar perfil ativo</button><button class="btn-outline btn-sm" onclick="document.getElementById('import_file_cloud').click()">Importar JSON</button><button class="btn-outline btn-sm" onclick="cloudChangePasswordFromSettings()">Trocar senha da conta/login</button><button class="btn-outline btn-sm" onclick="cloudLogout()">Sair da conta</button></div><input type="file" id="import_file_cloud" accept="application/json" style="display:none;"></div>
    <div class="info-box">Fluxo: alteração → salva local/offline → marca pendente → envia ao Supabase → limpa pendência. Se a internet cair, o Borion continua salvando neste dispositivo e sincroniza quando voltar.</div>
    ${renderInstallAppCard()}`;
}

/* ---------- V5.34.1: card "Instalar o app" (Android/iPhone/computador) ---------- */
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

function renderSettingsBackup(){
  const cloudReady = !!(window.CloudStorage && CloudStorage.user);
  const consent = window.BackupFS ? BackupFS.hasConsent() : null;
  const consentText = consent ? `Aceito em ${new Date(consent.acceptedAt).toLocaleString('pt-BR')} · modo: ${esc(consent.mode||'backup')}` : 'Ainda não configurado neste dispositivo.';
  let backupFolderBlock;
  if(!FS_ACCESS_SUPPORTED) backupFolderBlock = `<p class="desc">Este navegador não permite escolher uma pasta fixa. Use o backup manual em JSON e o backup salvo no Supabase.</p>`;
  else if(BackupFS.needsReconnect) backupFolderBlock = `<div class="reconnect-banner"><span>A pasta de backups precisa ser reautorizada após reabrir o app.</span><button class="btn-outline btn-sm" onclick="BackupFS.reconnect()">Reconectar pasta</button></div>`;
  else if(BackupFS.dirHandle) backupFolderBlock = `<div class="gold-box">Pasta local configurada. O Borion salva arquivos dentro da subpasta <b>Backups_Borion</b>.</div><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;"><button class="btn-outline btn-sm" onclick="BackupFS.choose()">Trocar pasta</button><button class="btn-outline btn-sm" onclick="BackupFS.disconnect()">Desconectar pasta</button></div>`;
  else backupFolderBlock = `<p class="desc">Escolha uma pasta local para cópias automáticas. Dica: use uma pasta sincronizada no Google Drive, OneDrive ou outro backup do Windows.</p><button class="btn btn-primary btn-sm" onclick="BackupFS.choose()">Escolher pasta de backups</button>`;
  return `
    <div class="settings-section settings-hero-section">
      <h3>Backups e segurança dos dados</h3>
      <p class="desc">A camada de backup protege contra erro humano, bug, sincronização ruim e perda de dispositivo. Os dados vivos continuam em <b>profiles</b> e <b>borion_profile_data</b>; os snapshots ficam em <b>borion_backups</b>.</p>
    </div>

    <div class="settings-section">
      <h3>Aceite de proteção de dados</h3>
      <p class="desc"><strong>Status:</strong> ${consentText}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn-outline btn-sm" onclick="Settings.showBackupConsent()">Ver termo/configurar proteção</button>
        <button class="btn-outline btn-sm" onclick="Settings.createCloudBackupNow('first_setup','backup criado manualmente pela tela de segurança')">Criar backup inicial agora</button>
      </div>
    </div>

    <div class="settings-section">
      <h3>Backup completo da conta</h3>
      <p class="desc">Gera um JSON completo com todos os perfis da conta, não só o perfil aberto. No Supabase, lê direto de <b>profiles</b> e <b>borion_profile_data</b>.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" onclick="BackupFS.manualBackupNow()">Baixar JSON completo</button>
        <button class="btn-outline btn-sm" onclick="Settings.createCloudBackupNow('manual','backup manual completo')" ${cloudReady?'':'disabled'}>Salvar snapshot no Supabase</button>
        <button class="btn-outline btn-sm" onclick="Settings.viewCloudBackups()" ${cloudReady?'':'disabled'}>Ver backups do Supabase</button>
        <button class="btn-outline btn-sm" onclick="document.getElementById('import_file_backup').click()">Restaurar/importar JSON</button>
      </div>
      <input type="file" id="import_file_backup" accept="application/json" style="display:none;">
      <div class="info-box">Onde ver em caso de BO: <b>Supabase → Table Editor → borion_backups</b>. Os dados atuais ficam em <b>profiles</b> e <b>borion_profile_data</b>.</div>
    </div>

    <div class="settings-section">
      <h3>Pasta local no computador/tablet</h3>
      ${backupFolderBlock}
      <div class="info-box">Por segurança do navegador, o Borion não pode criar uma pasta sozinho sem você autorizar. Ao escolher uma pasta, o navegador guarda uma permissão local neste dispositivo.</div>
    </div>

    <div class="settings-section danger-box">
      <h3>Backup antes de ações perigosas</h3>
      <p class="desc">Antes de excluir perfil, substituir dados por JSON ou restaurar a conta, o Borion tenta criar um snapshot em <b>borion_backups</b>. Se o SQL V5.35.1 não foi rodado, a proteção não fica completa.</p>
    </div>

    <div class="settings-section">
      <h3>Backup do perfil ativo</h3>
      <p class="desc">Útil para mandar só um perfil para outra pessoa ou guardar uma cópia pequena. Perfil atual: <strong>${esc(S.currentProfile?S.currentProfile.name:'nenhum')}</strong>.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn-outline btn-sm" onclick="Settings.exportProfile()">Exportar só este perfil</button>
        <button class="btn-outline btn-sm" onclick="Settings.emailBackup()">Preparar e-mail manual</button>
      </div>
    </div>`;
}

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

Settings.deleteProfile = function(id){
  const pr=(S.profiles||[]).find(x=>x.id===id); if(!pr) return;
  openConfirmModal({title:'Excluir perfil financeiro', text:`Para excluir "${pr.name}", confirme. Esta ação apaga este perfil e seus dados financeiros na nuvem. Mantenha um backup se precisar.`, confirmLabel:'Excluir perfil', cancelLabel:'Cancelar', variant:'danger', onConfirm: async ()=>{
    try{ if(window.CloudStorage&&CloudStorage.user){ await CloudStorage.deleteProfile(id); } else { S.profiles=S.profiles.filter(x=>x.id!==id); setProfiles(S.profiles); localStorage.removeItem(LS_DATA_PREFIX+id); idbDeleteProfileData(id); if(S.currentProfile&&S.currentProfile.id===id) logout(); else renderView(); } toast('Perfil excluído.'); }
    catch(e){ alert(e.message||String(e)); }
  }});
};
Settings.exportProfile = function(){
  const p=S.currentProfile; if(!p){ alert('Entre em um perfil antes de exportar.'); return; }
  const payload={type:'borion-profile-backup',version:5348,exportedAt:new Date().toISOString(),accountEmail:(CloudStorage&&CloudStorage.user&&CloudStorage.user.email)||p.email||'',profile:{id:p.id,name:p.name,avatarColor:p.avatarColor,avatarImage:p.avatarImage},data:S.data};
  downloadJSON(payload, `borion-perfil-${slug(p.name)}-${dateSlug()}.json`); toast('Backup do perfil ativo exportado.');
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
    alert((e&&e.message?e.message:String(e))+'\n\nSe aparecer erro de tabela/coluna, rode o SQL SUPABASE_V5.35_BACKUP_SECURITY.sql ou o SQL Cloud Foundation atualizado.');
  }
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
