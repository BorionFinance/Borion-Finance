/* Borion Finance V6.23.5 — Smartphone Mode
   Interface compacta para o uso diário. Reaproveita exatamente os mesmos dados,
   formulários e cálculos do Modo Pro; muda apenas a navegação e a apresentação. */

function smartphoneQuickActionHTML(action, icon, label, sub){
  return `<button type="button" class="smart-quick-action" onclick="SmartphoneMode.launch('${action}')">
    <span class="smart-quick-icon" aria-hidden="true">${icon}</span>
    <span><strong>${esc(label)}</strong><small>${esc(sub||'')}</small></span>
  </button>`;
}

function smartNavIconHTML(kind){
  if(kind==='launch'){
    return `<span class="smart-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg></span>`;
  }
  if(kind==='more'){
    return `<span class="smart-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14"/><path d="M5 12h14"/><path d="M5 17h14"/></svg></span>`;
  }
  return `<span class="smart-nav-icon" aria-hidden="true">${navIconSVG(kind)}</span>`;
}

function renderSmartphoneOverview(){
  const receitas=receitaMes();
  const despesas=despesasMes();
  const saldo=saldoMes();
  const contas=saldoEmContasTotal();
  const reservas=reservasTotal();
  const monthPrefix=monthKey(S.month.y,S.month.m);
  const recent=(S.data.transacoes||[])
    .filter(t=>String(t.data||'').startsWith(monthPrefix) && bankMatches(t.banco,t.accountId))
    .slice()
    .sort((a,b)=>String(b.data||'').localeCompare(String(a.data||'')) || Number(b.createdAt||0)-Number(a.createdAt||0))
    .slice(0,6);
  const recentRows=recent.map(t=>{
    const isIncome=t.tipo==='receita';
    const date=String(t.data||'').slice(8,10)+'/'+String(t.data||'').slice(5,7);
    return `<button type="button" class="smart-recent-row" onclick="SmartphoneMode.editTransaction('${esc(t.id)}','${esc(t.tipo)}')">
      <span class="smart-recent-type ${isIncome?'income':'expense'}">${isIncome?'↑':'↓'}</span>
      <span class="smart-recent-info"><strong>${esc(t.nome||'Lançamento')}</strong><small>${esc(date)} · ${esc(t.categoria||'Sem categoria')}</small></span>
      <span class="smart-recent-value ${isIncome?'val-pos':'val-neg'}">${isIncome?'+ ':'- '}${brl(Number(t.valor)||0)}</span>
    </button>`;
  }).join('');
  const reserveAction=reservasEnabled()
    ? smartphoneQuickActionHTML('reserva','◇','Reserva','Movimentar cofrinho')
    : smartphoneQuickActionHTML('meta','◇','Meta','Criar objetivo');
  return `<div class="smartphone-home">
    <section class="smart-balance-hero">
      <div><small>Saldo em contas</small><strong>${brl(contas)}</strong></div>
      <span class="smart-mode-pill">SMARTPHONE</span>
      <div class="smart-month-balance ${saldo>=0?'positive':'negative'}"><small>Saldo de ${esc(monthLabel(S.month.y,S.month.m))}</small><b>${brl(saldo)}</b></div>
    </section>

    <section class="smart-quick-grid" aria-label="Ações rápidas">
      ${smartphoneQuickActionHTML('receita','＋','Receita','Entrada rápida')}
      ${smartphoneQuickActionHTML('despesa','−','Despesa','Saída rápida')}
      ${reserveAction}
      ${smartphoneQuickActionHTML('transferencia','⇄','Transferir','Entre contas')}
    </section>

    <section class="smart-summary-strip">
      <button onclick="SmartphoneMode.goBudget('receita')"><small>Receitas</small><strong class="val-pos">${brl(receitas)}</strong></button>
      <button onclick="SmartphoneMode.goBudget('variavel')"><small>Despesas</small><strong class="val-neg">${brl(despesas)}</strong></button>
      <button onclick="${reservasEnabled()?"Nav.go('reservas')":"Nav.go('patrimony')"}"><small>Reservado</small><strong>${brl(reservas)}</strong></button>
    </section>

    <section class="panel-box smart-recent-panel">
      <div class="toolbar"><div class="toolbar-left">Últimos lançamentos</div><button class="link-btn" onclick="SmartphoneMode.goBudget('central')">Ver todos</button></div>
      <div class="smart-recent-list">${recentRows||'<div class="empty-note">Nenhum lançamento neste mês.</div>'}</div>
    </section>

    <button type="button" class="smart-open-pro" onclick="SmartphoneMode.useProMode()">Abrir Modo Pro neste dispositivo</button>
  </div>`;
}

const SmartphoneMode={
  renderBottomNav(){
    const reserves=reservasEnabled();
    const reserveKey=reserves?'reservas':'patrimony';
    return `<nav class="smart-bottom-nav" aria-label="Navegação do Smartphone Mode">
      <button class="${S.view==='overview'?'active':''}" onclick="Nav.go('overview')">${smartNavIconHTML('overview')}<small>Início</small></button>
      <button class="${S.view==='budget'?'active':''}" onclick="SmartphoneMode.goBudget('central')">${smartNavIconHTML('budget')}<small>Lançamentos</small></button>
      <button class="smart-bottom-launch" onclick="SmartphoneMode.openQuickLaunch()" aria-label="Novo lançamento">${smartNavIconHTML('launch')}<small>Lançar</small></button>
      <button class="${S.view===reserveKey?'active':''}" onclick="Nav.go('${reserveKey}')">${smartNavIconHTML(reserves?'reservas':'patrimony')}<small>${reserves?'Reservas':'Metas'}</small></button>
      <button onclick="MobileMenu.open()">${smartNavIconHTML('more')}<small>Mais</small></button>
    </nav>`;
  },
  openQuickLaunch(){
    const reserveButton=reservasEnabled()
      ? smartphoneQuickActionHTML('reserva','◇','Movimentar reserva','Reservar, resgatar ou ajustar')
      : smartphoneQuickActionHTML('meta','◇','Nova meta','Criar objetivo de patrimônio');
    const box=el(`<div class="modal-overlay smart-launch-overlay">
      <div class="modal-box smart-launch-modal">
        <div class="modal-head"><div><h2>Lançamento rápido</h2><p class="modal-sub">Escolha o que deseja registrar.</p></div><button id="smart_launch_close">&times;</button></div>
        <div class="smart-launch-grid">
          ${smartphoneQuickActionHTML('receita','＋','Receita','Dinheiro que entrou')}
          ${smartphoneQuickActionHTML('despesa','−','Despesa','Compra ou pagamento')}
          ${smartphoneQuickActionHTML('fixa','□','Despesa fixa','Compromisso mensal')}
          ${reserveButton}
          ${smartphoneQuickActionHTML('transferencia','⇄','Transferência','Entre contas e reservas')}
          ${smartphoneQuickActionHTML('contas','▦','Contas e cartões','Abrir gerenciamento')}
        </div>
      </div>
    </div>`);
    $('#modal-root').innerHTML=''; $('#modal-root').appendChild(box); attachModalGuard(box);
    $('#smart_launch_close').onclick=closeModal;
  },
  launch(action){
    closeModal();
    if(action==='receita' || action==='despesa'){
      S.view='budget'; S.budgetTab=action==='receita'?'receita':'variavel'; renderApp();
      setTimeout(()=>openTransactionModal({type:S.budgetTab}),60); return;
    }
    if(action==='fixa'){
      S.view='budget'; S.budgetTab='fixa'; renderApp(); setTimeout(()=>openFixaModal(null),60); return;
    }
    if(action==='reserva'){
      if(!reservasEnabled()){ this.launch('meta'); return; }
      S.view='reservas'; renderApp(); setTimeout(()=>Reservas.move(),60); return;
    }
    if(action==='meta'){
      S.view='patrimony'; renderApp(); setTimeout(()=>Metas.add(),60); return;
    }
    if(action==='transferencia'){
      S.view='cards'; renderApp(); setTimeout(()=>Cards.addTransferencia(),60); return;
    }
    if(action==='contas'){ Nav.go('cards'); }
  },
  goBudget(tab){ S.view='budget'; S.budgetTab=tab||'central'; renderApp(); },
  editTransaction(id,type){
    S.view='budget'; S.budgetTab=type==='receita'?'receita':'variavel'; renderApp();
    setTimeout(()=>Budget.edit(id),60);
  },
  useProMode(){
    S.config.uiMode='pro'; setConfig(S.config); applyInterfaceMode(); renderApp();
    toast('Modo Pro ativado neste dispositivo.');
  }
};
window.SmartphoneMode=SmartphoneMode;

/* Em modo automático, alterna entre Smartphone e Pro quando a largura cruza o limite.
   O debounce evita renderizações repetidas durante o redimensionamento. */
(function(){
  let timer=null,last=null;
  function check(){
    const current=resolvedInterfaceMode();
    if(last==null){ last=current; applyInterfaceMode(); return; }
    if(current===last){ applyInterfaceMode(); return; }
    last=current; applyInterfaceMode();
    if(S&&S.currentProfile&&S.data) renderApp();
  }
  if(window.addEventListener){
    window.addEventListener('resize',()=>{ clearTimeout(timer); timer=setTimeout(check,140); });
    window.addEventListener('orientationchange',()=>{ clearTimeout(timer); timer=setTimeout(check,160); });
  }
  check();
})();
