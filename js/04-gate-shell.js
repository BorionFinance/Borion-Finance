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
function navIconSVG(key){
  const attrs = 'viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
  const cardsAttrs = 'viewBox="0 0 28 28" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
  const cardPath = '<path d="M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -8" /><path d="M3 10l18 0" /><path d="M7 15l.01 0" /><path d="M11 15l2 0" />';
  const icons = {
    /* V6.38.2 — ícones do menu lateral trocados para o set consistente aprovado (contorno, sem badge circular) */
    overview: `<svg ${attrs}><path d="M5 4h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1" /><path d="M5 16h4a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1" /><path d="M15 12h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1" /><path d="M15 4h4a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1" /></svg>`,
    budget: `<svg ${attrs}><path d="M7 3l0 18" /><path d="M10 6l-3 -3l-3 3" /><path d="M20 18l-3 3l-3 -3" /><path d="M17 21l0 -18" /></svg>`,
    investments: `<svg ${attrs}><path d="M6 18 18 6"/><path d="M10 6h8v8"/></svg>`,
    patrimony: `<svg ${attrs}><path d="M3 17l6 -6l4 4l8 -8" /><path d="M14 7l7 0l0 7" /></svg>`,
    reservas: `<svg ${attrs}><path d="M6 5h12l3 5l-8.5 9.5a.7 .7 0 0 1 -1 0l-8.5 -9.5l3 -5" /><path d="M10 12l-2 -2.2l.6 -1" /></svg>`,
    cards: `<svg ${cardsAttrs}><g transform="translate(4,1) scale(0.72)" opacity="0.5">${cardPath}</g><g transform="translate(1,7) scale(0.72)">${cardPath}</g></svg>`,
    agenda: `<svg ${attrs}><path d="M11.795 21h-6.795a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v4" /><path d="M14 18a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M15 3v4" /><path d="M7 3v4" /><path d="M3 11h16" /><path d="M18 16.496v1.504l1 1" /></svg>`,
    cheques: `<svg ${attrs}><rect x="4" y="7" width="16" height="10" rx="2"/><path d="M7 11h6"/><path d="M7 14h4"/><path d="M15.5 12l1.5 1.5 3-3"/></svg>`,
    imports: `<svg ${attrs}><path d="M12 4.8v11.4"/><path d="M7.5 11.8 12 16.3l4.5-4.5"/><path d="M5.5 19.2h13"/></svg>`,
    notes: `<svg ${attrs}><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4"/><path d="M9 11h6"/><path d="M9 15h6"/><path d="M9 19h4"/></svg>`,
    /* V7.9.0 — Estúdio de Gráficos: colunas com uma linha de tendência por cima,
       no mesmo traço aberto (sem badge) do restante do menu. */
    charts: `<svg ${attrs}><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M21 20H3"/><path d="M4.5 8.5 10 3.5l5.5 5 4-3.5"/></svg>`,
    settings: `<svg ${attrs}><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></svg>`
  };
  return icons[key] || icons.overview;
}


/* V6.3.0 — link de conta mostrado no rodapé do Gate local. Se já tem login Supabase,
   mostra "Sair da conta" (comportamento de sempre). Se está no modo local (sem conta),
   mostra "Entrar com uma conta na nuvem" — único jeito de sair do modo local sem mexer
   em nada além da tela de login já existente (CloudAuth). Nunca aparece as duas juntas. */
function gateCloudLinkHTML(){
  if(window.CloudStorage && CloudStorage.user){
    return `<div style="text-align:center;margin-top:6px;"><button class="link-btn" id="gate_signout">Sair da conta</button></div>`;
  }
  if(window.GoogleDriveProvider && GoogleDriveProvider.isConnected()){
    return `<div style="text-align:center;margin-top:6px;"><button class="link-btn" id="gate_signout_gdrive">Sair da conta Google (Drive)</button></div>`;
  }
  return `<div style="text-align:center;margin-top:6px;"><button class="link-btn" id="gate_use_cloud">Entrar com uma conta na nuvem</button></div>`;
}

/* V6.46.22 — o seletor local só pode aparecer quando o modo escolhido realmente
   terminou de abrir. Se o Google/Supabase falhar ou perder a sessão, voltar para
   "Bem-vindo / Criar meu perfil" confundia o usuário e podia iniciar um perfil
   local por engano. Agora o Gate devolve para a tela correta de reconexão. */
function redirectUnresolvedRemoteGate64618(){
  const mode=typeof getStorageMode==='function'?getStorageMode():null;
  if(mode==='google_drive'&&(!window.GoogleDriveProvider||!GoogleDriveProvider.isConnected())){
    if(typeof renderGoogleDriveReconnect==='function')renderGoogleDriveReconnect('A conta Google ainda não concluiu a conexão com a pasta do Borion.');
    else if(window.CloudAuth&&typeof CloudAuth.render==='function'){CloudAuth.mode='login';CloudAuth.error='Conecte novamente com sua conta Google para continuar.';CloudAuth.render();}
    return true;
  }
  if((mode==='cloud'||mode==='supabase')&&(!window.CloudStorage||!CloudStorage.user)){
    if(window.CloudAuth&&typeof CloudAuth.render==='function'){CloudAuth.mode='login';CloudAuth.error=CloudAuth.error||'Sua sessão não foi concluída. Entre novamente para continuar.';CloudAuth.render();}
    return true;
  }
  return false;
}

/* V6.46.58 — teclado seguro por pares com entrada automática ao completar a senha correta.
   Cada tecla exibe dois algarismos e os pares mudam a cada abertura. O Borion não
   precisa saber qual dos dois números foi escolhido: no Enter, testa somente as
   combinações possíveis contra o hash já salvo. Ao completar a senha correta, o perfil abre
   automaticamente, sem exigir o botão Entrar. Senhas com letras continuam
   disponíveis pelo botão "Usar teclado comum". */
function securePairPasswordHTML({enterId='gate_enter',profileId='' }={}){
  const dataId=profileId?` data-id="${esc(profileId)}"`:'';
  return `<div class="borion-pair-password" id="gate_pair_password" tabindex="0" aria-label="Teclado seguro de senha por pares">
    <div class="borion-pair-topline borion-pair-topline-actions">
      <button type="button" class="borion-pair-refresh" id="gate_pair_refresh" title="Trocar os pares" aria-label="Trocar os pares">↻</button>
    </div>
    <div class="borion-pair-display" id="gate_pair_display" role="status" aria-live="polite">
      <div class="borion-pair-dots" id="gate_pair_dots"><span class="empty-dot"></span><span class="empty-dot"></span><span class="empty-dot"></span><span class="empty-dot"></span></div>
      <button type="button" class="borion-pair-erase" id="gate_pair_erase" aria-label="Apagar último número" title="Apagar último número">⌫</button>
    </div>
    <div class="borion-pair-grid" id="gate_pair_grid">
      <button class="btn btn-primary borion-pair-enter" id="${esc(enterId)}"${dataId}>Entrar</button>
    </div>
    <div class="borion-pair-standard hidden" id="gate_pair_standard">
      ${passwordInputWrapHTML({id:'gate_pw',label:'Senha',placeholder:'••••••••',autocomplete:'current-password'})}
    </div>
    <button type="button" class="link-btn borion-pair-toggle" id="gate_pair_toggle">Usar teclado comum</button>
  </div>`;
}

function securePairShuffleDigits(){
  const digits=['0','1','2','3','4','5','6','7','8','9'];
  for(let i=digits.length-1;i>0;i--){
    let r=0;
    try{const buf=new Uint32Array(1);crypto.getRandomValues(buf);r=buf[0]%(i+1);}catch(_){r=Math.floor(Math.random()*(i+1));}
    [digits[i],digits[r]]=[digits[r],digits[i]];
  }
  return digits;
}
function securePairCandidates(selections,limit=2048){
  let out=[''];
  for(const options of selections){
    const next=[];
    for(const prefix of out){
      for(const digit of options){
        next.push(prefix+digit);
        if(next.length>=limit)break;
      }
      if(next.length>=limit)break;
    }
    out=next;
    if(!out.length||out.length>=limit)break;
  }
  return out;
}
async function securePairResolvePassword(profile,selections){
  if(!profile||!profile.passwordHash||!selections.length)return null;
  const candidates=securePairCandidates(selections);
  for(const candidate of candidates){
    const hash=await hashPassword(candidate,profile.salt||'');
    if(hash===profile.passwordHash)return candidate;
  }
  return null;
}
function wireSecurePairPasswordEntry(profileId){
  const wrap=$('#gate_pair_password'),input=$('#gate_pw');
  if(!wrap||!input||!profileId)return;
  const grid=$('#gate_pair_grid'),dots=$('#gate_pair_dots'),erase=$('#gate_pair_erase'),refresh=$('#gate_pair_refresh'),toggle=$('#gate_pair_toggle');
  const enter=$('#gate_enter_single')||$('#gate_enter');
  const standard=$('#gate_pair_standard');
  let selections=[];
  let keyboardMode=false;
  let busy=false;
  let autoTimer=null;
  let autoCheckSequence=0;
  const maxDigits=10;
  const updateDisplay=()=>{
    if(!dots)return;
    if(!selections.length){
      dots.innerHTML='<span class="empty-dot"></span><span class="empty-dot"></span><span class="empty-dot"></span><span class="empty-dot"></span>';
      dots.setAttribute('aria-label','Nenhum dígito informado');
    }else{
      dots.innerHTML=selections.map(()=>'<span class="filled-dot"></span>').join('');
      dots.setAttribute('aria-label',`${selections.length} dígito${selections.length===1?'':'s'} informado${selections.length===1?'':'s'}`);
    }
    if(erase)erase.disabled=!selections.length||busy;
  };
  const resetPairs=()=>{
    autoCheckSequence++;
    if(autoTimer){clearTimeout(autoTimer);autoTimer=null;}
    selections=[];
    input.value='';
    const digits=securePairShuffleDigits();
    if(grid){
      grid.querySelectorAll('.borion-pair-key').forEach(node=>node.remove());
      for(let i=0;i<digits.length;i+=2){
        const pair=[digits[i],digits[i+1]];
        const button=document.createElement('button');
        button.type='button';
        button.className='borion-pair-key';
        button.dataset.pair=pair.join('');
        button.innerHTML=`<span>${pair[0]}</span><i></i><span>${pair[1]}</span>`;
        button.setAttribute('aria-label',`Números ${pair[0]} ou ${pair[1]}`);
        button.onclick=()=>{
          if(busy||keyboardMode||selections.length>=maxDigits)return;
          selections.push(pair);
          button.classList.remove('pressed');
          void button.offsetWidth;
          button.classList.add('pressed');
          setTimeout(()=>button.classList.remove('pressed'),180);
          updateDisplay();
          scheduleAutomaticPairEntry();
        };
        grid.insertBefore(button,enter||null);
      }
    }
    updateDisplay();
  };
  const setBusy=(on)=>{
    busy=!!on;
    wrap.classList.toggle('is-busy',busy);
    wrap.querySelectorAll('button').forEach(btn=>{if(btn!==toggle)btn.disabled=busy;});
    if(enter)enter.textContent=busy?'Verificando…':'Entrar';
    updateDisplay();
  };
  const enterResolvedPassword=async(resolved)=>{
    if(!resolved||busy||keyboardMode)return false;
    input.value=resolved;
    setBusy(true);
    try{
      await Gate.tryEnter(profileId);
      return true;
    }catch(error){
      S.gate.error=error&&error.message?error.message:String(error||'Não foi possível entrar.');
      renderGate();
      return false;
    }finally{
      if(document.body.contains(wrap))setBusy(false);
    }
  };
  const scheduleAutomaticPairEntry=()=>{
    autoCheckSequence++;
    const checkId=autoCheckSequence;
    if(autoTimer)clearTimeout(autoTimer);
    if(busy||keyboardMode||selections.length<4)return;
    const snapshot=selections.map(pair=>pair.slice());
    autoTimer=setTimeout(async()=>{
      autoTimer=null;
      if(checkId!==autoCheckSequence||busy||keyboardMode)return;
      const profile=S.profiles.find(item=>item.id===profileId);
      if(!profile||!profile.passwordHash)return;
      try{
        const resolved=await securePairResolvePassword(profile,snapshot);
        if(checkId!==autoCheckSequence||busy||keyboardMode)return;
        if(selections.length!==snapshot.length)return;
        if(!resolved)return;
        await enterResolvedPassword(resolved);
      }catch(_error){
        // Verificação automática é silenciosa. O botão Entrar continua disponível.
      }
    },110);
  };
  const submit=async()=>{
    if(busy)return;
    autoCheckSequence++;
    if(autoTimer){clearTimeout(autoTimer);autoTimer=null;}
    if(keyboardMode){ await Gate.tryEnter(profileId); return; }
    if(selections.length<4){
      wrap.classList.remove('shake');void wrap.offsetWidth;wrap.classList.add('shake');
      setTimeout(()=>wrap.classList.remove('shake'),360);
      return;
    }
    const profile=S.profiles.find(item=>item.id===profileId);
    setBusy(true);
    try{
      const resolved=await securePairResolvePassword(profile,selections);
      if(!resolved){
        S.gate.error='Senha incorreta.';
        renderGate();
        return;
      }
      input.value=resolved;
      await Gate.tryEnter(profileId);
    }catch(error){
      S.gate.error=error&&error.message?error.message:String(error||'Não foi possível entrar.');
      renderGate();
    }finally{
      if(document.body.contains(wrap))setBusy(false);
    }
  };
  if(erase)erase.onclick=()=>{if(!busy&&!keyboardMode){autoCheckSequence++;if(autoTimer){clearTimeout(autoTimer);autoTimer=null;}selections.pop();updateDisplay();}};
  if(refresh)refresh.onclick=()=>{if(!busy&&!keyboardMode)resetPairs();};
  if(toggle)toggle.onclick=()=>{
    if(busy)return;
    autoCheckSequence++;
    if(autoTimer){clearTimeout(autoTimer);autoTimer=null;}
    keyboardMode=!keyboardMode;
    wrap.classList.toggle('keyboard-mode',keyboardMode);
    if(standard)standard.classList.toggle('hidden',!keyboardMode);
    if(erase)erase.classList.toggle('hidden',keyboardMode);
    if(refresh)refresh.classList.toggle('hidden',keyboardMode);
    toggle.textContent=keyboardMode?'Usar teclado por pares':'Usar teclado comum';
    input.value='';
    selections=[];
    updateDisplay();
    if(keyboardMode){setTimeout(()=>{try{input.focus({preventScroll:true});}catch(_){input.focus();}},20);}
    else {resetPairs();try{wrap.focus({preventScroll:true});}catch(_){wrap.focus();}}
  };
  if(enter)enter.onclick=submit;
  wrap.addEventListener('keydown',event=>{
    if(keyboardMode)return;
    if(/^\d$/.test(event.key)){
      event.preventDefault();
      if(selections.length<maxDigits){selections.push([event.key]);updateDisplay();scheduleAutomaticPairEntry();}
      return;
    }
    if(event.key==='Backspace'||event.key==='Delete'){
      event.preventDefault();autoCheckSequence++;if(autoTimer){clearTimeout(autoTimer);autoTimer=null;}selections.pop();updateDisplay();return;
    }
    if(event.key==='Enter'){
      event.preventDefault();submit();
    }
  });
  resetPairs();
  setTimeout(()=>{try{wrap.focus({preventScroll:true});}catch(_){try{wrap.focus();}catch(__){}}},40);
}

/* V6.46.35 — perfis com senha entram automaticamente assim que a senha completa
   estiver correta. A comparação é silenciosa enquanto a pessoa digita: senha parcial
   ou incorreta não mostra erro; o botão Entrar e a tecla Enter continuam disponíveis. */
function wireAutomaticProfilePasswordEntry(profileId){
  const input=$('#gate_pw');
  if(!input||!profileId)return;
  let timer=null;
  let checking=false;
  let sequence=0;
  const button=$('#gate_enter_single')||$('#gate_enter');
  const attempt=async()=>{
    const p=S.profiles.find(item=>item.id===profileId);
    const typed=String(input.value||'');
    if(!p||!p.passwordHash||typed.length<4||checking)return;
    const current=++sequence;
    const hash=await hashPassword(typed,p.salt||'');
    if(current!==sequence||String(input.value||'')!==typed||hash!==p.passwordHash)return;
    checking=true;
    input.disabled=true;
    if(button){button.disabled=true;button.textContent='Entrando…';}
    try{ await Gate.tryEnter(profileId); }
    catch(error){
      checking=false;
      input.disabled=false;
      if(button){button.disabled=false;button.textContent='Entrar';}
      S.gate.error=error&&error.message?error.message:String(error||'Não foi possível entrar.');
      renderGate();
    }
  };
  const schedule=()=>{
    sequence++;
    if(timer)clearTimeout(timer);
    if(String(input.value||'').length<4)return;
    timer=setTimeout(()=>{attempt();},140);
  };
  input.addEventListener('input',schedule);
  input.addEventListener('change',schedule);
  input.addEventListener('keydown',event=>{
    if(event.key!=='Enter')return;
    event.preventDefault();
    if(timer)clearTimeout(timer);
    Gate.tryEnter(profileId);
  });
  // Cobre senhas preenchidas automaticamente pelo navegador/gerenciador de senhas.
  setTimeout(schedule,80);
  if(!$('#gate_pair_password')){try{input.focus({preventScroll:true});}catch(_){try{input.focus();}catch(__){}}}
}

/* ---------------- RENDER: GATE ---------------- */
/* V7.8.2 — TRAVA CONTRA O "BEM-VINDO / CRIAR MEU PERFIL" FANTASMA.
   Última linha de defesa: no modo Google Drive, uma lista de perfis vazia só é
   verdade se o current.json realmente tiver sido lido nesta sessão. Se ainda não
   foi (boot interrompido, janela fechada sem querer, reconexão no meio do
   caminho), o Gate NÃO desenha a tela de primeiro perfil — ele mesmo termina a
   leitura e volta a desenhar sozinho. É isso que elimina a necessidade de
   recarregar a página na mão. */
let borionGateSelfHealRunning=false,borionGateSelfHealAttempts=0;
function borionGateNeedsDriveLoad(){
  if(typeof getStorageMode!=='function'||getStorageMode()!=='google_drive')return false;
  if(!window.GoogleDriveProvider||!GoogleDriveProvider.isConnected())return false;
  if(GoogleDriveProvider.driveSnapshotLoaded)return false;
  if(borionGateSelfHealAttempts>=2)return false;
  if(S.gate&&(S.gate.mode==='createProfile'||S.gate.mode==='password'))return false;
  return !(Array.isArray(S.profiles)&&S.profiles.length);
}
function renderGateDriveLoadingScreen(){
  const root=$('#root');if(!root)return;
  root.innerHTML=`
    <div class="gate-wrap">
      <div class="gate-box">
        <div class="gate-logo"><img src="borion-emblem.png" alt="Borion Finance"/><div class="appname">Borion Finance</div></div>
        <div class="gate-card">
          <p class="gate-title">Abrindo sua conta...</p>
          <p class="gate-sub">Carregando seus perfis do Google Drive.</p>
        </div>
      </div>
    </div>`;
}
function borionGateSelfHeal(){
  if(borionGateSelfHealRunning)return;
  borionGateSelfHealRunning=true;
  renderGateDriveLoadingScreen();
  (async()=>{
    try{
      borionGateSelfHealAttempts+=1;
      const result=await GoogleDriveProvider.connect(false,{suppressRender:true});
      if(result&&result.empty){if(typeof renderGoogleDriveOnboarding==='function')renderGoogleDriveOnboarding();return;}
    }catch(error){
      console.warn('[Gate] a leitura automática da base não concluiu; mostrando a reconexão:',error);
      if(typeof renderGoogleDriveReconnect==='function'){renderGoogleDriveReconnect(error&&error.message||String(error),{code:error&&error.code||''});return;}
    }finally{borionGateSelfHealRunning=false;}
    S.gate={mode:'list',error:''};
    renderGate();
  })();
}

function renderGate(){
  if(window.BorionChartTooltips) BorionChartTooltips.hideAll();
  ensureBorionVersionBadge();
  if(redirectUnresolvedRemoteGate64618())return;
  if(borionGateNeedsDriveLoad()){borionGateSelfHeal();return;}
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
      ${securePairPasswordHTML({enterId:'gate_enter',profileId:p.id})}
      <div class="field-check gate-remember-check"><input type="checkbox" id="gate_remember"/> <label style="margin:0" for="gate_remember">Manter conectado neste dispositivo</label></div>
      <div style="text-align:center;margin-top:14px;"><button class="link-btn" id="gate_back">Voltar</button></div>
    `;
  } else if(profiles.length===0){
    bodyHTML = `
      <p class="gate-title">Bem-vindo!</p>
      <p class="gate-sub">Crie seu primeiro perfil para começar a usar o app.</p>
      <button class="btn btn-primary btn-block" id="gate_new">+ Criar meu perfil</button>
      ${gateCloudLinkHTML()}
    `;
  } else if(profiles.length===1){
    const p = profiles[0];
    bodyHTML = `
      <p class="gate-title">Olá, ${esc(p.name)}</p>
      <p class="gate-sub">${p.passwordHash ? 'Digite sua senha para continuar.' : 'Toque em entrar para continuar.'}</p>
      ${S.gate.error?`<p class="gate-error">${esc(S.gate.error)}</p>`:''}
      ${p.passwordHash ? `${securePairPasswordHTML({enterId:'gate_enter_single',profileId:p.id})}
      <div class="field-check gate-remember-check"><input type="checkbox" id="gate_remember"/> <label style="margin:0" for="gate_remember">Manter conectado neste dispositivo</label></div>` : `<button class="btn btn-primary btn-block" id="gate_enter_single" data-id="${p.id}">Entrar</button>`}
      <div style="text-align:center;margin-top:14px;"><button class="link-btn" id="gate_new">+ Criar outro perfil</button></div>
      ${gateCloudLinkHTML()}
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
      <p class="limit-note">${profiles.length} perfil(is) criado(s)</p>
      ${gateCloudLinkHTML()}
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
  const passwordProfileId=enterSingle?enterSingle.dataset.id:(S.gate.mode==='password'?S.gate.selectedProfileId:null);
  if(passwordProfileId){
    wireAutomaticProfilePasswordEntry(passwordProfileId);
    wireSecurePairPasswordEntry(passwordProfileId);
  }
  const signOutBtn = $('#gate_signout');
  if(signOutBtn) signOutBtn.onclick = async ()=>{ if(window.cloudLogout) await cloudLogout(); };
  const signOutGdriveBtn = $('#gate_signout_gdrive');
  if(signOutGdriveBtn) signOutGdriveBtn.onclick = ()=>{
    GoogleDriveProvider.disconnect();
    S.currentProfile=null; S.data=null;
    CloudAuth.mode='login'; CloudAuth.error=''; CloudAuth.info=''; CloudAuth.emailExpanded=false;
    CloudAuth.render();
  };
  const useCloudBtn = $('#gate_use_cloud');
  if(useCloudBtn) useCloudBtn.onclick = ()=>{
    setStorageMode('cloud');
    if(window.CloudAuth){ CloudAuth.mode='login'; CloudAuth.error=''; CloudAuth.info=''; CloudAuth.emailExpanded=false; CloudAuth.render(); }
  };

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
  setTimeout(()=>{ if(window.BorionInterop && typeof BorionInterop.maybePromptImportMode==='function') BorionInterop.maybePromptImportMode(); }, popupList.length? 2200 : 1200);
}

function resetImportTransientState(){
  S.importState=null;
}

async function enterProfile(profile, remember){
  resetImportTransientState();
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
  S.data = migrateData(S.data, {profileId:profile.id});
  recordPatrimonioSnapshot();
  setProfileData(profile.id, S.data);
  S.view=resolveStartupView();
  S.gate={mode:'list',error:''};
  if(remember) setSession({profileId:profile.id});
  else setSession(null);
  renderApp();
  if(window.ExitSaveGuard) ExitSaveGuard.refresh();
  if(window.BorionSecurity700&&typeof BorionSecurity700.captureCurrent==='function'){
    try{BorionSecurity700.captureCurrent('profile_open',{immediate:true});}
    catch(e){console.warn('[BORION][SECURITY_CAPTURE][PROFILE_OPEN_WARN]',e);if(window.BorionDiagnostics700)BorionDiagnostics700.event('SECURITY_CAPTURE_FAILED',{module:'gate-shell',operation:'profile_open',error:e},'warning');}
  }
  postLoginSequence();
}
function logout(){
  resetImportTransientState();
  setSession(null);
  S.currentProfile=null; S.data=null;
  S.gate={mode:'list',error:''};
  if(window.ExitSaveGuard) ExitSaveGuard.refresh();
  renderGate();
}
/* V5.35 — troca de perfil "estilo Netflix": volta para a tela de escolha de
   perfil sem encerrar a sessão da conta (login) na nuvem. Diferente de
   logout()/cloudLogout(), que saem da conta inteira. */
async function switchProfileScreen(){
  resetImportTransientState();
  // v7.0 SECURITY — aguarda somente a gravação local rápida antes de descartar
  // o perfil em memória. O envio ao Drive continua fora do caminho da interface.
  try{
    if(window.BorionSecurity700&&typeof BorionSecurity700.captureCurrent==='function')BorionSecurity700.captureCurrent('switch_profile',{immediate:true});
    if(window.BorionFastWal700&&typeof BorionFastWal700.waitForCurrent==='function')await BorionFastWal700.waitForCurrent('switch_profile',900);
    if(window.GoogleDriveProvider&&GoogleDriveProvider.isConnected&&GoogleDriveProvider.isConnected())GoogleDriveProvider.queueSave({source:'switch_profile'});
  }catch(e){console.warn('[BORION][PROFILE_SWITCH][FAST_SAVE_WARN]',e);}
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
  {key:'investments', label:'Investimentos', optionalModule:'investments'},
  {key:'patrimony', label:'Patrimônio', optionalModule:'patrimony'},
  {key:'reservas', label:'Reserva', optionalModule:'reserves'},
  {key:'cards', label:'Cartões e Contas'},
  {key:'agenda', label:'Agenda Financeira', optionalModule:'agenda'},
  {key:'cheques', label:'Cheques', optionalModule:'cheques'},
  {key:'imports', label:'Importar Extrato', optionalModule:'imports'},
  {key:'notes', label:'Notas', optionalModule:'notes'},
  {key:'charts', label:'Gráficos', optionalModule:'charts'},
];

function getNavItems(){
  return NAV.filter(n=>{
    if(n.optionalModule==='cheques') return !!(S.data && S.data.cheques && S.data.cheques.enabled);
    if(n.optionalModule==='imports') return !!(S.data && S.data.modules && S.data.modules.imports !== false);
    if(n.optionalModule==='reserves') return !!(S.data && S.data.modules && S.data.modules.reserves !== false && S.data.reservas && S.data.reservas.enabled !== false);
    if(n.optionalModule==='investments') return investmentsEnabled();
    if(n.optionalModule==='agenda') return agendaEnabled();
    if(n.optionalModule==='notes') return !!(S.data && S.data.modules && S.data.modules.notes !== false);
    if(n.optionalModule==='patrimony') return !!(S.data && S.data.modules && S.data.modules.patrimony !== false);
    if(n.optionalModule==='charts') return !!(S.data && S.data.modules && S.data.modules.charts !== false);
    return true;
  });
}

/* V7.1.4 — aba favorita: em Configurações → Personalização → "Organizar módulos e itens",
   uma estrela em cada linha marca qual aba abre no lugar da Visão Geral ao entrar no perfil.
   Só existe ali (nada aparece na barra lateral). Sem favorita definida, ou se a aba favoritada
   não existir mais / estiver desativada, cai no padrão de sempre (Visão Geral). */
function resolveStartupView(){
  const key = S.data && S.data.uiPreferences && S.data.uiPreferences.startupView;
  if(!key) return 'overview';
  const valid = getNavItems().some(n=>n.key===key);
  return valid ? key : 'overview';
}

function renderApp(){
  if(window.BorionChartTooltips) BorionChartTooltips.hideAll();
  /* Painéis globais vivem fora de #root. Feche/remova antes de reconstruir a aplicação
     para que nenhuma classe de bloqueio sobreviva sem o painel correspondente. */
  try{
    if(window.Notifs && Notifs.panelOpen) Notifs.closePanel();
    else {
      const staleNotif=document.getElementById('notif-panel');
      if(staleNotif) staleNotif.remove();
      document.body.classList.remove('notif-panel-open');
    }
  }catch(_){ document.body.classList.remove('notif-panel-open'); }
  /* Qualquer render estrutural invalida sidebar/backdrop antigos. Feche primeiro para
     impedir que mobile-menu-open sobreviva à substituição de #root. */
  if(window.MobileMenu && typeof MobileMenu.close==='function') MobileMenu.close();
  else if(document.body) document.body.classList.remove('mobile-menu-open');
  applyInterfaceMode();
  if(window.SmartphoneHistory) SmartphoneHistory.activate();
  if(!S.currentProfile || !S.data){
    console.warn('[BORION_UI][RENDER_APP][NO_ACTIVE_PROFILE]', {hasProfile:!!S.currentProfile, hasData:!!S.data});
    renderGate();
    return;
  }
  // A versão serve para confirmar o deploy nas telas de acesso. Dentro do app ela
  // sai completamente para não cobrir a navegação inferior nem outros controles.
  if(typeof hideBorionVersionBadge==='function')hideBorionVersionBadge();
  // V6.46.33 — marca que o shell real do aplicativo já foi aberto. Uma falha de
  // rede/salvamento depois deste ponto nunca pode substituir toda a tela por um
  // gate que parece desconexão; o provider mantém a página e trabalha a pendência.
  if(window.GoogleDriveProvider) GoogleDriveProvider._appHasOpened=true;
  if(window.Assinaturas && Assinaturas.sync) Assinaturas.sync(); // V6.22 — cobra períodos pendentes até hoje, nunca duplicando
  const p=S.currentProfile;
  /* Organização visual (opcional): quando o usuário personaliza a ordem dos módulos em
     Configurações → Módulos, a barra lateral segue essa ordem. Sem personalização salva,
     a ordem é exatamente a mesma de sempre (NAV original). Não afeta quais módulos aparecem
     (isso continua sendo decidido por getNavItems()), só a posição de cada um. */
  const navItemsForDisplay = (window.OrderPreferences ? OrderPreferences.applyOrder('modules', getNavItems(), {idKey:'key', labelKey:'label'}) : getNavItems());
  const nav = navItemsForDisplay.map(n=>`
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
          ${window.BorionQuickTools ? BorionQuickTools.renderSidebarShortcuts() : ''}
          ${window.SmartphoneMode ? SmartphoneMode.renderSidebarActions() : ''}
          <button class="sb-item sb-footer-settings ${S.view==='settings'?'active':''}" onclick="Nav.go('settings')">
            <span class="ic">${navIconSVG('settings')}</span><span class="sb-label">Configurações</span>
          </button>
          <div class="sb-profile">
            ${profileAvatarHTML(p)}
            <div class="pname">${esc(p.name)}</div>
            <button class="pswitch" title="Trocar de perfil" onclick="switchProfileScreen()">⇄</button>
            <button class="pswitch" title="Sair" onclick="cloudLogout()">⇦</button>
          </div>
        </div>
      </div>
      <div class="main" id="view-root"></div>
      ${window.SmartphoneMode ? SmartphoneMode.renderBottomNav() : ''}
    </div>
  `;
  renderView();
  if(typeof window.syncGlobalScrollLockState==='function')
    window.syncGlobalScrollLockState({source:'renderApp'});
  if(window.ExitSaveGuard) ExitSaveGuard.refresh();
  if(window.BackupFS) setTimeout(()=>BackupFS.notifyStartupFolderStatus(),180);
}

const MobileMenu = {
  open(){
    const sidebar=document.querySelector('.sidebar');
    const backdrop=document.querySelector('.mobile-menu-backdrop');
    if(!sidebar || !backdrop){
      document.body.classList.remove('mobile-menu-open');
      if(typeof window.syncGlobalScrollLockState==='function') window.syncGlobalScrollLockState({source:'MobileMenu.open.missingDom'});
      return;
    }
    sidebar.classList.add('open');
    backdrop.classList.add('show');
    if(typeof window.syncGlobalScrollLockState==='function') window.syncGlobalScrollLockState({source:'MobileMenu.open'});
    else document.body.classList.add('mobile-menu-open');
  },
  close(){
    const sidebar=document.querySelector('.sidebar');
    const backdrop=document.querySelector('.mobile-menu-backdrop');
    if(sidebar) sidebar.classList.remove('open');
    if(backdrop) backdrop.classList.remove('show');
    document.body.classList.remove('mobile-menu-open');
    if(typeof window.syncGlobalScrollLockState==='function') window.syncGlobalScrollLockState({source:'MobileMenu.close'});
  },
  toggle(){
    const sidebar = document.querySelector('.sidebar');
    if(sidebar && sidebar.classList.contains('open')) this.close();
    else this.open();
  }
};
window.MobileMenu = MobileMenu;

const Nav = { go(key){ if(key!=='settings'&&window.BorionIntegrationsAccess){ BorionIntegrationsAccess.clearTemporary(); if(S.settingsTab==='integrations'&&!BorionIntegrationsAccess.remembered()) S.settingsTab='organization'; } if(key==='budget'&&!['receita','fixa','variavel','assinaturas','reserva_transferencias'].includes(S.budgetTab)) S.budgetTab='receita'; S.view=key; MobileMenu.close(); renderApp(); } };

function wireMobileMonthSwipe(){
  if(!(typeof isSmartphoneMode==='function' && isSmartphoneMode())) return;
  const nav=document.querySelector('.topbar .month-nav');
  if(!nav || nav.classList.contains('mobile-month-picker') || nav.dataset.monthSwipeWired==='1') return;
  nav.dataset.monthSwipeWired='1';
  nav.setAttribute('aria-label','Mês selecionado. Deslize para os lados para trocar de mês.');

  let pointerId=null,startX=0,startY=0,dx=0,dy=0;
  const reset=()=>{
    nav.classList.remove('is-month-swiping');
    nav.style.setProperty('--month-swipe-x','0px');
    pointerId=null;dx=0;dy=0;
  };
  nav.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse' && event.button!==0) return;
    if(event.target.closest('button')) return;
    pointerId=event.pointerId;startX=event.clientX;startY=event.clientY;dx=0;dy=0;
    nav.classList.add('is-month-swiping');
    try{nav.setPointerCapture(pointerId);}catch(_){ }
  },{passive:true});
  nav.addEventListener('pointermove',event=>{
    if(pointerId!==event.pointerId) return;
    dx=event.clientX-startX;dy=event.clientY-startY;
    if(Math.abs(dx)>Math.abs(dy) && Math.abs(dx)>4){
      if(event.cancelable) event.preventDefault();
      const resisted=Math.max(-34,Math.min(34,dx*.42));
      nav.style.setProperty('--month-swipe-x',`${resisted}px`);
    }
  },{passive:false});
  const finish=event=>{
    if(pointerId!==event.pointerId) return;
    const committed=Math.abs(dx)>=42 && Math.abs(dx)>Math.abs(dy)*1.15;
    try{nav.releasePointerCapture(pointerId);}catch(_){ }
    nav.classList.remove('is-month-swiping');
    nav.style.setProperty('--month-swipe-x','0px');
    const goPrevious=dx>0;
    pointerId=null;
    if(!committed) return;
    if(window.MobileExperience && typeof MobileExperience.haptic==='function') MobileExperience.haptic(5);
    if(goPrevious) Months.prev(); else Months.next();
  };
  nav.addEventListener('pointerup',finish,{passive:true});
  nav.addEventListener('pointercancel',reset,{passive:true});
}

// V6.46.33 — seletor compacto de mês/ano no smartphone. Usa o seletor
// nativo do navegador (rápido e leve) e mantém a Agenda no mesmo mês do topo.
const MobileMonthPicker = {
  open(event){
    if(event){event.preventDefault();event.stopPropagation();}
    const input=document.getElementById('borion_mobile_month_input');
    if(!input)return;
    input.value=String(S.month.y)+'-'+pad2(S.month.m+1);
    try{
      if(typeof input.showPicker==='function') input.showPicker();
      else input.click();
    }catch(_){ input.click(); }
  },
  change(value){
    const match=/^(\d{4})-(\d{2})$/.exec(String(value||''));
    if(!match)return;
    const y=Number(match[1]),m=Number(match[2])-1;
    if(!Number.isInteger(y)||m<0||m>11)return;
    S.month={y,m};
    if(S.view==='agenda'){
      if(typeof ensureAgendaViewState==='function')ensureAgendaViewState();
      if(S.agendaView){S.agendaView.y=y;S.agendaView.m=m;}
    }
    renderView();
  }
};
window.MobileMonthPicker=MobileMonthPicker;

function renderView(){
  if(window.BorionChartTooltips) BorionChartTooltips.hideAll();
  if(S.view==='cheques' && !(S.data && S.data.cheques && S.data.cheques.enabled)) S.view='overview';
  if(S.view==='imports' && !(S.data && S.data.modules && S.data.modules.imports !== false)) S.view='overview';
  if(S.view==='reservas' && !(S.data && S.data.modules && S.data.modules.reserves !== false && S.data.reservas && S.data.reservas.enabled !== false)) S.view='overview';
  if(S.view==='investments' && !investmentsEnabled()) S.view='overview';
  if(S.view==='agenda' && !agendaEnabled()) S.view='overview';
  if(S.view==='notes' && !(S.data && S.data.modules && S.data.modules.notes !== false)) S.view='overview';
  if(S.view==='patrimony' && !(S.data && S.data.modules && S.data.modules.patrimony !== false)) S.view='overview';
  if(S.view==='charts' && !(S.data && S.data.modules && S.data.modules.charts !== false)) S.view='overview';
  if(S.view==='analise') S.view='overview'; // compatibilidade com preferência antiga após remoção do módulo
  const container = $('#view-root');
  const titles = {overview:'Visão geral',budget:'Lançamentos',investments:'Investimentos',patrimony:'Patrimônio',reservas:'Reserva',cards:'Cartões e Contas',agenda:'Agenda Financeira',notes:'Notas',cheques:'Cheques',imports:'Importar Extrato',charts:'Gráficos',settings:'Configurações'};
  const smartphoneMode=typeof isSmartphoneMode==='function'&&isSmartphoneMode();
  // No smartphone a Agenda usa o título curto "Agenda". Isso preserva o olhinho,
  // o seletor de mês/ano e o sino na mesma linha sem qualquer sobreposição.
  const topbarTitle=(smartphoneMode&&S.view==='agenda')?'Agenda':titles[S.view];
  // No smartphone existe somente um rótulo curto (ex.: "Julho") e um
  // ícone de calendário. O toque abre mês + ano; setas continuam no modo Pro.
  const monthNav = smartphoneMode ? `
    <div class="month-nav-wrap mobile-month-picker-wrap">
      <input id="borion_mobile_month_input" class="mobile-month-native-input" type="month" value="${S.month.y}-${pad2(S.month.m+1)}" onchange="MobileMonthPicker.change(this.value)" aria-label="Selecionar mês e ano"/>
      <button type="button" class="month-nav mobile-month-picker" onclick="MobileMonthPicker.open(event)" aria-label="Selecionar mês e ano" title="Selecionar mês e ano">
        <span class="mlabel">${MONTHS[S.month.m]}</span>
        <span class="mobile-month-calendar-icon" aria-hidden="true">${navIconSVG('agenda')}</span>
      </button>
      <div class="clock-label" id="borion_clock"></div>
    </div>` : `
    <div class="month-nav-wrap">
      <div class="month-nav">
        <button onclick="Months.prev()">‹</button>
        <div class="mlabel">${monthLabel(S.month.y,S.month.m)}</div>
        <button onclick="Months.next()">›</button>
      </div>
      <div class="clock-label" id="borion_clock"></div>
    </div>`;
  const unread = (S.data && Array.isArray(S.data.notificacoes) ? S.data.notificacoes : []).filter(n=>!n.lida).length;
  const bfLabel = (!S.bankFilter || S.bankFilter.size===0) ? 'Todos' : (S.bankFilter.size===1 ? Array.from(S.bankFilter)[0] : S.bankFilter.size+' selecionados');
  const bankBtn = `<button class="btn-outline bank-filter-btn ${S.bankFilter&&S.bankFilter.size?'filter-active':''}" onmouseenter="BankFilter.openHover(event)" onmouseleave="BankFilter.scheduleHoverClose()" onclick="BankFilter.togglePanel(event)">☷ ${esc(bfLabel)}</button>`;
  const reserveLastMovement = S.view==='reservas'&&typeof renderReservaLastMovementTopbar64616==='function'
    ? renderReservaLastMovementTopbar64616()
    : '';
  container.innerHTML = `
    <div class="topbar">
      <div class="topbar-title-row">
        <button class="mobile-menu-btn" title="Abrir menu" aria-label="Abrir menu" onclick="MobileMenu.open()"><span></span><span></span><span></span></button>
        <div class="topbar-title">
          <p class="hello">${greeting()}, ${esc(S.currentProfile.name)}</p>
          <h1>${smartphoneMode?`<span class="topbar-title-text">${topbarTitle}</span>`:titles[S.view]}<span class="eye" onclick="toggleValuesHidden()" title="${S.valuesHidden?'Mostrar valores':'Ocultar valores'}">${eyeIconSVG(S.valuesHidden)}</span></h1>
          ${reserveLastMovement?`<div class="mobile-reserve-last">${reserveLastMovement}</div>`:''}
        </div>
      </div>
      <div class="global-search-wrap">
        <input type="text" id="global_search" placeholder="Pesquisar compras, contas, categorias..." oninput="GlobalSearch.onInput()" onfocus="GlobalSearch.onInput()"/>
        <div id="global_search_results" class="search-results hidden"></div>
      </div>
      <div class="topbar-controls">
        ${(window.CloudStorage && CloudStorage.user)
          ? `<button id="cloud_status_badge" class="cloud-status syncing" onclick="CloudStorage.syncNow()">Sincronizando...</button>`
          : (window.GoogleDriveProvider && GoogleDriveProvider.isConnected() && GoogleDriveProvider.blockedSuspicious)
          ? `<button id="cloud_status_badge" class="cloud-status offline" onclick="GoogleDriveProvider.handleStatusClick()" title="${esc(GoogleDriveProvider.blockedSuspicious)}">Salvamento bloqueado — ver</button>`
          : (window.GoogleDriveProvider && GoogleDriveProvider.isConnected() && GoogleDriveProvider.conflict)
          ? `<button id="cloud_status_badge" class="cloud-status offline" onclick="GoogleDriveProvider.handleStatusClick()" title="Existe uma versão mais recente no Drive — clique pra recarregar, ou Ctrl+S pra salvar sua versão">Conflito — recarregar</button>`
          : (window.GoogleDriveProvider && GoogleDriveProvider.isConnected() && (GoogleDriveProvider.dirty || GoogleDriveProvider._syncInFlight))
          ? `<button id="cloud_status_badge" class="cloud-status syncing" onclick="GoogleDriveProvider.handleStatusClick()" title="Salvando no Google Drive...">Google Drive — salvando...</button>`
          : (window.GoogleDriveProvider && GoogleDriveProvider.isConnected() && (GoogleDriveProvider.lastSyncError || !navigator.onLine))
          ? `<button id="cloud_status_badge" class="cloud-status offline" onclick="GoogleDriveProvider.handleStatusClick()" title="${esc(GoogleDriveProvider.lastSyncError||'Sem internet. O Borion está bloqueado até o Google Drive voltar.')}">${GoogleDriveProvider.authRequired?'Google Drive — reconectar':'Google Drive — não salvo'}</button>`
          : (window.GoogleDriveProvider && GoogleDriveProvider.isConnected())
          ? `<button id="cloud_status_badge" class="cloud-status local" onclick="GoogleDriveProvider.handleStatusClick()" title="Conectado ao Google Drive — ${esc(GoogleDriveAuth.user?GoogleDriveAuth.user.email:'')} — pasta: ${esc(GoogleDriveProvider.folderName||'?')}">Google Drive — salvo</button>`
          : `<button id="cloud_status_badge" class="cloud-status local" onclick="Nav.go('settings')" title="Sem conexão confirmada com o Google Drive">Sem conexão</button>`}
        ${bankBtn}
        ${reserveLastMovement?`<div class="desktop-reserve-last">${reserveLastMovement}</div>`:''}
        ${monthNav}
        <button class="bell-btn" onmouseenter="Notifs.openHover(event)" onmouseleave="Notifs.scheduleHoverClose()" onclick="Notifs.togglePanel(event)">${bellIconSVG()}${unread?`<span class="bell-badge">${unread>9?'9+':unread}</span>`:''}</button>
      </div>
    </div>
    <div id="view-body"></div>
  `;
  const body = $('#view-body');
  if(S.view==='overview') body.innerHTML = (isSmartphoneMode() && window.SmartphoneMode ? renderSmartphoneOverview() : renderOverview());
  else if(S.view==='budget') body.innerHTML = renderBudget();
  else if(S.view==='investments') body.innerHTML = renderInvestments();
  else if(S.view==='patrimony') body.innerHTML = renderPatrimony();
  else if(S.view==='reservas') body.innerHTML = renderReservasPage();
  else if(S.view==='cards') body.innerHTML = renderCards();
  else if(S.view==='agenda') body.innerHTML = renderAgenda();
  else if(S.view==='notes') body.innerHTML = window.BorionNotes ? BorionNotes.render() : '<div class="panel-box"><p class="empty-note">O módulo de Notas não foi carregado.</p></div>';
  else if(S.view==='cheques') body.innerHTML = renderCheques();
  else if(S.view==='imports') body.innerHTML = renderImportStatement();
  else if(S.view==='charts') body.innerHTML = window.ChartsStudio ? ChartsStudio.render() : '<div class="panel-box"><p class="empty-note">O Estúdio de Gráficos não foi carregado.</p></div>';
  else if(S.view==='settings') body.innerHTML = renderSettings();
  wireViewEvents();
  wireMobileMonthSwipe();
  if(window.OrderPreferences) OrderPreferences.ensureBanner();
  Clock.start(); // V6.22 — relógio "Atualizado em dd/mm/aaaa hh:mm" abaixo do filtro de mês, em toda página
  if(typeof applyBorionValuePrivacyDOM==='function') requestAnimationFrame(applyBorionValuePrivacyDOM);
}

/* ---------------- V6.22 — data/hora abaixo do filtro global (seção 8 do pedido) ----------------
   Um único setInterval pra vida toda do app (nunca duplica, mesmo com renderView() chamado
   várias vezes por minuto) — cada tick só busca o elemento pelo id na hora, então funciona
   mesmo depois do innerHTML da topbar ser recriado a cada renderView(). */
const Clock = {
  intervalId: null,
  start(){
    this.tick();
    if(this.intervalId) return;
    this.intervalId = setInterval(()=>this.tick(), 60000);
  },
  stop(){ if(this.intervalId){ clearInterval(this.intervalId); this.intervalId=null; } },
  tick(){
    const el = document.getElementById('borion_clock');
    if(!el) return;
    const d = new Date();
    const p2 = n=>String(n).padStart(2,'0');
    el.textContent = `Atualizado em ${p2(d.getDate())}/${p2(d.getMonth()+1)}/${d.getFullYear()} às ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  }
};
window.Clock = Clock;

const Months = {
  _apply(y,m){
    S.month={y,m};
    if(S.view==='agenda'){
      if(typeof ensureAgendaViewState==='function')ensureAgendaViewState();
      if(S.agendaView){S.agendaView.y=y;S.agendaView.m=m;}
    }
    renderView();
  },
  prev(){ let {y,m}=S.month; m--; if(m<0){m=11;y--;} this._apply(y,m); },
  next(){ let {y,m}=S.month; m++; if(m>11){m=0;y++;} this._apply(y,m); }
};
