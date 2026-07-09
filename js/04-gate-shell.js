/* Borion Finance — Tela de login/perfis, estrutura principal do app, menu lateral e topo. */

/* Ícones minimalistas em SVG (herdam a cor do texto via currentColor) */
function eyeIconSVG(hidden){
  return hidden
    ? `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M9.88 5.14A10.9 10.9 0 0 1 12 5c6 0 10 7 10 7a15.6 15.6 0 0 1-3.22 3.9M6.6 6.6C3.9 8.3 2 12 2 12a15.9 15.9 0 0 0 5.06 5.94"/></svg>`
    : `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
}
function bellIconSVG(){
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 5 2 7 2 7H4s2-2 2-7"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>`;
}
function gearIconSVG(){
  return `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
}

function navIconSVG(key){
  const attrs = 'viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
  const icons = {
    overview: `<svg ${attrs}><rect x="5" y="5" width="5" height="14" rx="1.15"/><rect x="14" y="5" width="5" height="14" rx="1.15"/></svg>`,
    budget: `<svg ${attrs}><path d="M19 7H6"/><path d="M10 3 6 7l4 4"/><path d="M5 17h13"/><path d="M14 13l4 4-4 4"/></svg>`,
    investments: `<svg ${attrs}><path d="M6 18 18 6"/><path d="M10 6h8v8"/></svg>`,
    patrimony: `<svg ${attrs}><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5V12h8.5"/></svg>`,
    reservas: `<svg ${attrs}><path d="M12 3.5 20.5 12 12 20.5 3.5 12 12 3.5Z"/><path d="M12 8 16 12 12 16 8 12 12 8Z"/></svg>`,
    cards: `<svg ${attrs}><rect x="4.5" y="4.5" width="15" height="15" rx="1.8"/><path d="M8 9h8"/><path d="M8 12h8"/><path d="M8 15h8"/></svg>`,
    agenda: `<svg ${attrs}><circle cx="12" cy="12" r="8.4"/><path d="M12 7.5V12h4"/></svg>`,
    cheques: `<svg ${attrs}><rect x="4" y="7" width="16" height="10" rx="2"/><path d="M7 11h6"/><path d="M7 14h4"/><path d="M15.5 12l1.5 1.5 3-3"/></svg>`,
    imports: `<svg ${attrs}><path d="M12 4.8v11.4"/><path d="M7.5 11.8 12 16.3l4.5-4.5"/><path d="M5.5 19.2h13"/></svg>`,
    settings: `<svg ${attrs}><circle cx="12" cy="12" r="3.1"/><path d="M19.2 14.7a1.7 1.7 0 0 0 .34 1.87l.04.04a2.05 2.05 0 0 1-2.9 2.9l-.04-.04a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56v.12a2.05 2.05 0 0 1-4.1 0v-.12a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.87.34l-.04.04a2.05 2.05 0 0 1-2.9-2.9l.04-.04a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04h-.12a2.05 2.05 0 0 1 0-4.1h.12a1.7 1.7 0 0 0 1.56-1.04 1.7 1.7 0 0 0-.34-1.87l-.04-.04a2.05 2.05 0 0 1 2.9-2.9l.04.04a1.7 1.7 0 0 0 1.87.34 1.7 1.7 0 0 0 1.04-1.56v-.12a2.05 2.05 0 0 1 4.1 0v.12a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.04-.04a2.05 2.05 0 0 1 2.9 2.9l-.04.04a1.7 1.7 0 0 0-.34 1.87 1.7 1.7 0 0 0 1.56 1.04h.12a2.05 2.05 0 0 1 0 4.1h-.12a1.7 1.7 0 0 0-1.56 1.04Z"/></svg>`
  };
  return icons[key] || icons.overview;
}


/* ---------------- RENDER: GATE ---------------- */
function renderGate(){
  const root = $('#root');
  const profiles = S.profiles;

  let bodyHTML='';

  if(S.gate.mode==='createProfile'){
    bodyHTML = renderCreateProfileFormHTML();
  } else if(S.gate.mode==='password'){
    const p = profiles.find(p=>p.id===S.gate.selectedProfileId);
    bodyHTML = `
      <p class="gate-title">Olá, ${esc(p.name)}</p>
      <p class="gate-sub">Digite sua senha para continuar.</p>
      ${S.gate.error?`<p class="gate-error">${esc(S.gate.error)}</p>`:''}
      ${passwordInputWrapHTML({id:'gate_pw',label:'Senha',placeholder:'••••••••',autocomplete:'current-password'})}
      <div class="field-check"><input type="checkbox" id="gate_remember"/> <label style="margin:0" for="gate_remember">Manter conectado neste dispositivo</label></div>
      <button class="btn btn-primary btn-block" id="gate_enter">Entrar</button>
      <div style="text-align:center;margin-top:14px;"><button class="link-btn" id="gate_back">Voltar</button></div>
    `;
  } else if(profiles.length===0){
    bodyHTML = `
      <p class="gate-title">Bem-vindo!</p>
      <p class="gate-sub">Crie seu primeiro perfil para começar a usar o app.</p>
      <button class="btn btn-primary btn-block" id="gate_new">+ Criar meu perfil</button>
    `;
  } else if(profiles.length===1){
    const p = profiles[0];
    bodyHTML = `
      <p class="gate-title">Olá, ${esc(p.name)}</p>
      <p class="gate-sub">${p.passwordHash ? 'Digite sua senha para continuar.' : 'Toque em entrar para continuar.'}</p>
      ${S.gate.error?`<p class="gate-error">${esc(S.gate.error)}</p>`:''}
      ${p.passwordHash ? `${passwordInputWrapHTML({id:'gate_pw',label:'Senha',placeholder:'••••••••',autocomplete:'current-password'})}
      <div class="field-check"><input type="checkbox" id="gate_remember"/> <label style="margin:0" for="gate_remember">Manter conectado neste dispositivo</label></div>` : ''}
      <button class="btn btn-primary btn-block" id="gate_enter_single" data-id="${p.id}">Entrar</button>
      <div style="text-align:center;margin-top:14px;"><button class="link-btn" id="gate_new">+ Criar outro perfil</button></div>
      ${(window.CloudStorage && CloudStorage.user) ? `<div style="text-align:center;margin-top:6px;"><button class="link-btn" id="gate_signout">Sair da conta</button></div>` : ''}
    `;
  } else {
    const chips = profiles.map(p=>`
      <button class="profile-chip" data-id="${p.id}" onclick="Gate.selectProfile('${p.id}')">
        ${profileAvatarHTML(p)}
        <div class="profile-name">${esc(p.name)}</div>
      </button>
    `).join('');
    const addChip = profiles.length<5 ? `
      <button class="profile-chip add" onclick="Gate.newProfile()">
        <div class="profile-avatar">+</div>
        <div class="profile-name">Novo perfil</div>
      </button>` : '';
    bodyHTML = `
      <p class="gate-title">Quem é você?</p>
      <p class="gate-sub">Selecione seu perfil para continuar.</p>
      <div class="profile-grid">${chips}${addChip}</div>
      <p class="limit-note">${profiles.length}/5 perfis criados${profiles.length>=5?' — máximo atingido':''}</p>
      ${(window.CloudStorage && CloudStorage.user) ? `<div style="text-align:center;margin-top:6px;"><button class="link-btn" id="gate_signout">Sair da conta</button></div>` : ''}
    `;
  }

  root.innerHTML = `
    <div class="gate-wrap">
      <div class="gate-box">
        <div class="gate-logo"><img src="borion-emblem.png" alt="Borion Finance"/><div class="appname">Borion Finance</div></div>
        <div class="gate-card">${bodyHTML}</div>
      </div>
    </div>
  `;

  const newBtn = $('#gate_new'); if(newBtn) newBtn.onclick = ()=>{ S.gate={mode:'createProfile'}; renderGate(); };
  const backBtn = $('#gate_back'); if(backBtn) backBtn.onclick = ()=>{ S.gate={mode:'list',error:''}; renderGate(); };
  const enterSingle = $('#gate_enter_single');
  if(enterSingle) enterSingle.onclick = async ()=>{ await Gate.tryEnter(enterSingle.dataset.id); };
  const enterBtn = $('#gate_enter');
  if(enterBtn) enterBtn.onclick = async ()=>{ await Gate.tryEnter(S.gate.selectedProfileId); };
  const signOutBtn = $('#gate_signout');
  if(signOutBtn) signOutBtn.onclick = async ()=>{ if(window.cloudLogout) await cloudLogout(); };

  if(S.gate.mode==='createProfile') wireCreateProfileForm();
}

function renderCreateProfileFormHTML(){
  return `
    <p class="gate-title">Novo perfil</p>
    <p class="gate-sub">Preencha os dados. Senha e e-mail são opcionais.</p>
    ${S.gate.error?`<p class="gate-error">${esc(S.gate.error)}</p>`:''}
    <div class="field"><label>Nome</label><input type="text" id="np_name" placeholder="Seu nome"/></div>
    <div class="field"><label>E-mail (opcional)</label><input type="email" id="np_email" placeholder="voce@email.com"/></div>
    <div class="field-check"><input type="checkbox" id="np_haspw"/> <label style="margin:0" for="np_haspw">Proteger este perfil com senha</label></div>
    <div id="np_pwfields" class="hidden">
      ${passwordInputWrapHTML({id:'np_pw',label:'Senha',placeholder:'Crie uma senha',autocomplete:'new-password'})}
      ${passwordInputWrapHTML({id:'np_pw2',label:'Confirmar senha',placeholder:'Repita a senha',autocomplete:'new-password'})}
    </div>
    <button class="btn btn-primary btn-block" id="np_save">Criar perfil</button>
    <div style="text-align:center;margin-top:14px;"><button class="link-btn" id="np_cancel">Cancelar</button></div>
  `;
}
function wireCreateProfileForm(){
  const chk = $('#np_haspw');
  chk.onchange = ()=>{ $('#np_pwfields').classList.toggle('hidden', !chk.checked); };
  $('#np_cancel').onclick = ()=>{ S.gate={mode:'list', error:''}; renderGate(); };
  $('#np_save').onclick = async ()=>{
    const name = $('#np_name').value.trim();
    const email = $('#np_email').value.trim();
    if(!name){ S.gate.error='Digite um nome para o perfil.'; renderGate(); return; }
    if(S.profiles.length>=5){ S.gate.error='Máximo de 5 perfis atingido. Exclua um perfil existente primeiro.'; renderGate(); return; }
    if(window.CloudStorage && CloudStorage.user){
      try{
        const options={};
        if(chk.checked){
          const pw=$('#np_pw').value, pw2=$('#np_pw2').value;
          if(!pw || pw.length<4){ S.gate.error='A senha do perfil deve ter ao menos 4 caracteres.'; renderGate(); return; }
          if(pw!==pw2){ S.gate.error='As senhas não coincidem.'; renderGate(); return; }
          options.passwordSalt = randomSalt();
          options.passwordHash = await hashPassword(pw, options.passwordSalt);
        }
        await CloudStorage.createProfile(name, true, null, options);
        S.gate={mode:'list', error:''};
        if(S.currentProfile) renderApp();
        toast('Perfil criado e confirmado no Supabase.');
      }catch(e){
        S.gate.error=e.message||String(e);
        renderGate();
      }
      return;
    }
    let passwordHash=null, salt=null;
    if(chk.checked){
      const pw=$('#np_pw').value, pw2=$('#np_pw2').value;
      if(!pw || pw.length<4){ S.gate.error='A senha deve ter ao menos 4 caracteres.'; renderGate(); return; }
      if(pw!==pw2){ S.gate.error='As senhas não coincidem.'; renderGate(); return; }
      salt = randomSalt();
      passwordHash = await hashPassword(pw, salt);
    }
    const profile = {id:uid(), name, email, passwordHash, salt, createdAt:Date.now()};
    S.profiles.push(profile);
    setProfiles(S.profiles);
    // Todo perfil novo começa zerado. Não carregamos dados de demonstração nem no primeiro perfil.
    setProfileData(profile.id, emptyData());
    S.gate={mode:'list', error:''};
    toast('Perfil criado com sucesso!');
    await enterProfile(profile, false);
  };
}

const Gate = {
  newProfile(){ S.gate={mode:'createProfile'}; renderGate(); },
  async selectProfile(id){
    const p = S.profiles.find(p=>p.id===id);
    if(!p) return;
    if(window.CloudStorage && CloudStorage.user){
      if(p.passwordHash){ S.gate={mode:'password', selectedProfileId:id, error:''}; renderGate(); return; }
      try{ await CloudStorage.switchProfile(id); }catch(e){ S.gate.error=e.message||String(e); renderGate(); }
      return;
    }
    if(p.passwordHash){ S.gate={mode:'password', selectedProfileId:id, error:''}; renderGate(); }
    else { await enterProfile(p, false); }
  },
  async tryEnter(id){
    const p = S.profiles.find(p=>p.id===id);
    if(!p){ return; }
    if(window.CloudStorage && CloudStorage.user){
      try{
        if(p.passwordHash){
          const pwInput = $('#gate_pw');
          const pw = pwInput ? pwInput.value : '';
          const hash = await hashPassword(pw, p.salt||'');
          if(hash!==p.passwordHash){ S.gate.error='Senha incorreta.'; renderGate(); return; }
        }
        await CloudStorage.switchProfile(id);
      }catch(e){ S.gate.error=e.message||String(e); renderGate(); }
      return;
    }
    if(p.passwordHash){
      const pwInput = $('#gate_pw');
      const pw = pwInput ? pwInput.value : '';
      const hash = await hashPassword(pw, p.salt);
      if(hash!==p.passwordHash){ S.gate.error='Senha incorreta.'; renderGate(); return; }
      const remember = $('#gate_remember') ? $('#gate_remember').checked : false;
      await enterProfile(p, remember);
    } else {
      await enterProfile(p, false);
    }
  }
};

function postLoginSequence(){
  Notifs.refresh();
  const popupList = Notifs.unreadForPopup ? Notifs.unreadForPopup() : [];
  setTimeout(()=>{ Notifs.showFloating(popupList); }, 500);
  setTimeout(()=>{ checkOverdueModal(); }, popupList.length? 1400 : 650);
}

async function enterProfile(profile, remember){
  // V5.34.3 — mesmo padrão de isolamento do fluxo de nuvem: zera S.data ANTES
  // de trocar S.currentProfile, para nunca deixar uma janela em que o perfil
  // "ativo" já é o novo mas os dados em memória ainda são do perfil anterior.
  S.data = null;
  S.currentProfile = profile;
  // V5.34.1 — o IndexedDB é a fonte mais durável dos dados financeiros; tenta
  // hidratar a partir dele primeiro e só cai para o localStorage/dados vazios
  // se ainda não houver nada gravado lá (ex.: perfil recém-criado).
  const fromIdb = await hydrateProfileDataFromIDB(profile.id);
  S.data = fromIdb || getProfileData(profile.id) || emptyData();
  S.data = migrateData(S.data);
  recordPatrimonioSnapshot();
  setProfileData(profile.id, S.data);
  S.view='overview';
  S.gate={mode:'list',error:''};
  if(remember) setSession({profileId:profile.id});
  else setSession(null);
  renderApp();
  if(window.ExitSaveGuard) ExitSaveGuard.refresh();
  postLoginSequence();
}
function logout(){
  setSession(null);
  S.currentProfile=null; S.data=null;
  S.gate={mode:'list',error:''};
  if(window.ExitSaveGuard) ExitSaveGuard.refresh();
  renderGate();
}
/* V5.35 — troca de perfil "estilo Netflix": volta para a tela de escolha de
   perfil sem encerrar a sessão da conta (login) na nuvem. Diferente de
   logout()/cloudLogout(), que saem da conta inteira. */
function switchProfileScreen(){
  S.currentProfile=null; S.data=null;
  S.gate={mode:'list',error:''};
  if(window.ExitSaveGuard) ExitSaveGuard.refresh();
  renderGate();
}
window.switchProfileScreen = switchProfileScreen;

/* ---------------- RENDER: APP SHELL ---------------- */
const NAV = [
  {key:'overview', label:'Visão geral'},
  {key:'budget', label:'Lançamentos'},
  {key:'investments', label:'Investimentos'},
  {key:'patrimony', label:'Patrimônio'},
  {key:'reservas', label:'Reserva', optionalModule:'reserves'},
  {key:'cards', label:'Cartões e Contas'},
  {key:'agenda', label:'Agenda Financeira'},
  {key:'cheques', label:'Cheques', optionalModule:'cheques'},
  {key:'imports', label:'Importar Extrato', optionalModule:'imports'},
  {key:'settings', label:'Configurações'},
];

function getNavItems(){
  return NAV.filter(n=>{
    if(n.optionalModule==='cheques') return !!(S.data && S.data.cheques && S.data.cheques.enabled);
    if(n.optionalModule==='imports') return !!(S.data && S.data.modules && S.data.modules.imports !== false);
    if(n.optionalModule==='reserves') return !!(S.data && S.data.modules && S.data.modules.reserves !== false && S.data.reservas && S.data.reservas.enabled !== false);
    return true;
  });
}

function renderApp(){
  if(!S.currentProfile || !S.data){
    console.warn('[BORION_UI][RENDER_APP][NO_ACTIVE_PROFILE]', {hasProfile:!!S.currentProfile, hasData:!!S.data});
    renderGate();
    return;
  }
  const p=S.currentProfile;
  const nav = getNavItems().map(n=>`
    <button class="sb-item ${S.view===n.key?'active':''}" onclick="Nav.go('${n.key}')">
      <span class="ic">${navIconSVG(n.key)}</span><span class="sb-label">${n.label}</span>
    </button>`).join('');

  $('#root').innerHTML = `
    <div class="shell">
      <button class="mobile-menu-backdrop" aria-label="Fechar menu" onclick="MobileMenu.close()"></button>
      <div class="sidebar" id="borion_sidebar">
        <div class="sb-logo"><img src="borion-emblem.png" alt="Borion Finance"/><div class="name">${esc(APP_NAME)}</div><button class="mobile-menu-close" title="Fechar menu" aria-label="Fechar menu" onclick="MobileMenu.close()">×</button></div>
        <div class="sb-nav">${nav}</div>
        <div class="sb-footer">
          <div class="sb-profile">
            ${profileAvatarHTML(p)}
            <div class="pname">${esc(p.name)}</div>
            <button class="pswitch" title="Trocar de perfil" onclick="switchProfileScreen()">⇄</button>
            <button class="pswitch" title="Sair" onclick="cloudLogout()">⇦</button>
          </div>
        </div>
      </div>
      <div class="main" id="view-root"></div>
    </div>
  `;
  renderView();
  if(window.ExitSaveGuard) ExitSaveGuard.refresh();
}

const MobileMenu = {
  open(){
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.querySelector('.mobile-menu-backdrop');
    if(sidebar) sidebar.classList.add('open');
    if(backdrop) backdrop.classList.add('show');
    document.body.classList.add('mobile-menu-open');
  },
  close(){
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.querySelector('.mobile-menu-backdrop');
    if(sidebar) sidebar.classList.remove('open');
    if(backdrop) backdrop.classList.remove('show');
    document.body.classList.remove('mobile-menu-open');
  },
  toggle(){
    const sidebar = document.querySelector('.sidebar');
    if(sidebar && sidebar.classList.contains('open')) this.close();
    else this.open();
  }
};
window.MobileMenu = MobileMenu;

const Nav = { go(key){ S.view=key; MobileMenu.close(); renderApp(); } };

function renderView(){
  if(S.view==='cheques' && !(S.data && S.data.cheques && S.data.cheques.enabled)) S.view='overview';
  if(S.view==='imports' && !(S.data && S.data.modules && S.data.modules.imports !== false)) S.view='overview';
  if(S.view==='reservas' && !(S.data && S.data.modules && S.data.modules.reserves !== false && S.data.reservas && S.data.reservas.enabled !== false)) S.view='overview';
  const container = $('#view-root');
  const titles = {overview:'Visão geral',budget:'Lançamentos',investments:'Investimentos',patrimony:'Patrimônio',reservas:'Reserva',cards:'Cartões e Contas',agenda:'Agenda Financeira',cheques:'Cheques',imports:'Importar Extrato',settings:'Configurações'};
  const monthNav = `
    <div class="month-nav">
      <button onclick="Months.prev()">‹</button>
      <div class="mlabel">${monthLabel(S.month.y,S.month.m)}</div>
      <button onclick="Months.next()">›</button>
    </div>`;
  const unread = (S.data && Array.isArray(S.data.notificacoes) ? S.data.notificacoes : []).filter(n=>!n.lida).length;
  const bfLabel = (!S.bankFilter || S.bankFilter.size===0) ? 'Todos' : (S.bankFilter.size===1 ? Array.from(S.bankFilter)[0] : S.bankFilter.size+' selecionados');
  const bankBtn = `<button class="btn-outline bank-filter-btn ${S.bankFilter&&S.bankFilter.size?'filter-active':''}" onclick="BankFilter.togglePanel(event)">☷ ${esc(bfLabel)}</button>`;
  container.innerHTML = `
    <div class="topbar">
      <div class="topbar-title-row">
        <button class="mobile-menu-btn" title="Abrir menu" aria-label="Abrir menu" onclick="MobileMenu.open()"><span></span><span></span><span></span></button>
        <div class="topbar-title">
          <p class="hello">${greeting()}, ${esc(S.currentProfile.name)}</p>
          <h1>${titles[S.view]} <span class="eye" onclick="toggleValuesHidden()" title="${S.valuesHidden?'Mostrar valores':'Ocultar valores'}">${eyeIconSVG(S.valuesHidden)}</span></h1>
        </div>
      </div>
      <div class="global-search-wrap">
        <input type="text" id="global_search" placeholder="Pesquisar compras, contas, categorias..." oninput="GlobalSearch.onInput()" onfocus="GlobalSearch.onInput()"/>
        <div id="global_search_results" class="search-results hidden"></div>
      </div>
      <div style="display:flex;gap:12px;align-items:center;">
        <button id="cloud_status_badge" class="cloud-status syncing" onclick="CloudStorage.syncNow()">Sincronizando...</button>
        ${bankBtn}
        ${monthNav}
        <button class="bell-btn" onclick="Notifs.togglePanel(event)">${bellIconSVG()}${unread?`<span class="bell-badge">${unread>9?'9+':unread}</span>`:''}</button>
      </div>
    </div>
    <div id="view-body"></div>
  `;
  const body = $('#view-body');
  if(S.view==='overview') body.innerHTML = renderOverview();
  else if(S.view==='budget') body.innerHTML = renderBudget();
  else if(S.view==='investments') body.innerHTML = renderInvestments();
  else if(S.view==='patrimony') body.innerHTML = renderPatrimony();
  else if(S.view==='reservas') body.innerHTML = renderReservasPage();
  else if(S.view==='cards') body.innerHTML = renderCards();
  else if(S.view==='agenda') body.innerHTML = renderAgenda();
  else if(S.view==='cheques') body.innerHTML = renderCheques();
  else if(S.view==='imports') body.innerHTML = renderImportStatement();
  else if(S.view==='settings') body.innerHTML = renderSettings();
  wireViewEvents();
}

const Months = {
  prev(){ let {y,m}=S.month; m--; if(m<0){m=11;y--;} S.month={y,m}; renderView(); },
  next(){ let {y,m}=S.month; m++; if(m>11){m=0;y++;} S.month={y,m}; renderView(); }
};
