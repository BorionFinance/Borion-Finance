/* Borion Finance — Tela Orçamento/Receitas/Despesas, filtros e modais de lançamentos. */

/* ---------------- VIEW: BUDGET ---------------- */
const BUDGET_SUMMARY_CARD_DEFS={
  receita:{label:'RECEITA',colorKey:'receita'}, investir:{label:'INVESTIR',colorKey:'investir'}, despesas:{label:'DESPESAS',colorKey:'despesas'}, saldo:{label:'SALDO',colorKey:'saldo'},
  patrimonio:{label:'PATRIMÔNIO',colorKey:'patrimonio'}, cofrinhos:{label:'COFRINHOS',colorKey:'reserva'}, variacaoCofrinhos:{label:'VARIAÇÃO DOS COFRINHOS',colorKey:'reserva'}, disponivel:{label:'VALOR DISPONÍVEL',colorKey:'saldo'}
};
const DEFAULT_BUDGET_SUMMARY_CARDS=['receita','investir','despesas','saldo'];

/* V6.32.2 — ordenação compacta e persistente por perfil.
   O padrão é sempre Mais recente → mais antigo (↓). Cada aba salva a preferência em
   S.data.uiPreferences, que pertence ao perfil atual e acompanha backup/sincronização. */
const BudgetDateSort={
  validTypes:['receita','fixa','variavel','transferencias'],
  preferenceRoot(create=false){
    if(!S.data) return null;
    if(create && (!S.data.uiPreferences || typeof S.data.uiPreferences!=='object')) S.data.uiPreferences={};
    if(!S.data.uiPreferences) return null;
    if(create && (!S.data.uiPreferences.budgetDateSort || typeof S.data.uiPreferences.budgetDateSort!=='object')) S.data.uiPreferences.budgetDateSort={};
    return S.data.uiPreferences.budgetDateSort||null;
  },
  get(type){
    const root=this.preferenceRoot(false);
    const saved=root&&root[type];
    return saved==='asc'?'asc':'desc';
  },
  toggle(type){
    if(!this.validTypes.includes(type)) return;
    const next=this.get(type)==='desc'?'asc':'desc';
    const root=this.preferenceRoot(true);
    if(root) root[type]=next;
    if(typeof saveCurrentData==='function') saveCurrentData();
    renderView();
  },
  usesAdditionOrder(type){ return ['receita','variavel','transferencias'].includes(type); },
  additionTimestamp(value){
    const numeric=Number(value);
    if(Number.isFinite(numeric)&&numeric>100000000000) return numeric;
    const text=String(value||'');
    if(/[T ]\d{2}:\d{2}/.test(text)){
      const parsed=Date.parse(text);
      if(Number.isFinite(parsed)) return parsed;
    }
    return 0;
  },
  compare(type,aDate,bDate,aCreated=0,bCreated=0,aIndex=null,bIndex=null){
    const dir=this.get(type)==='asc'?1:-1;
    // A data financeira é sempre a hierarquia principal. A ordem de criação só
    // desempata lançamentos da MESMA data. Ex.: 25/07 permanece acima de 24/07;
    // dentro de 24/07, o último item cadastrado aparece primeiro no modo ↓.
    const byDate=String(aDate||'').localeCompare(String(bDate||''));
    if(byDate) return byDate*dir;
    if(this.usesAdditionOrder(type)){
      const aAdded=this.additionTimestamp(aCreated),bAdded=this.additionTimestamp(bCreated);
      if(aAdded&&bAdded){
        const byAddition=aAdded-bAdded;
        if(byAddition)return byAddition*dir;
      }else if(aAdded||bAdded){
        // Um item novo, com horário real de inclusão, fica à frente dos itens
        // antigos sem horário. Entre dois legados, retorna 0 para preservar
        // exatamente a ordem que eles já tinham na tela.
        return (aAdded?1:-1)*dir;
      }
      return 0;
    }
    const byCreated=Number(aCreated||0)-Number(bCreated||0);
    if(byCreated) return byCreated*dir;
    if(Number.isFinite(aIndex)&&Number.isFinite(bIndex)) return (aIndex-bIndex)*dir;
    return 0;
  },
  buttonHTML(type){
    const asc=this.get(type)==='asc';
    const label=asc?'Mais antigo → mais recente':'Mais recente → mais antigo';
    return `<button type="button" class="date-sort-toggle" onclick="Budget.toggleDateSort('${type}')" title="${label}" aria-label="Ordenação atual: ${label}. Clique para inverter."><span aria-hidden="true">${asc?'↑':'↓'}</span></button>`;
  }
};
window.BudgetDateSort=BudgetDateSort;

function budgetLinkedCard(entity){
  if(!entity) return null;
  return (S.data.cartoes||[]).find(c=>c.id===entity.viaCartaoId)
    || (entity.viaParcelaId ? (S.data.cartoes||[]).find(c=>(c.parcelas||[]).some(p=>p.id===entity.viaParcelaId)) : null);
}
function budgetExpenseSourceLabel(entity, occurrence=null){
  if(!entity) return 'Origem não informada';
  const card=budgetLinkedCard(entity);
  if(card) return 'Cartão: '+(card.nome||card.banco||'cartão removido');
  if(entity.viaBoletoId){
    const boleto=(S.data.boletos||[]).find(b=>b.id===entity.viaBoletoId);
    return 'Boleto: '+(boleto?(boleto.credor||boleto.descricao||boleto.banco||'boleto'):'boleto removido');
  }
  const origem=(occurrence&&occurrence.origemPagamento)||entity.origemPagamento||((entity.accountId===CARTEIRA_CONTA_ID||entity.formaPagamento==='Dinheiro')?'carteira':'conta');
  if(origem==='reserva'){
    const reservaId=(occurrence&&occurrence.reservaId)||entity.reservaOrigemId;
    const box=findReservaBoxById(reservaId);
    return '◈ Reserva: '+(box?box.nome:'reserva removida');
  }
  const accountId=(occurrence&&occurrence.accountId)||entity.accountId||resolveAccountId((occurrence&&occurrence.banco)||entity.banco,{includeArchived:true});
  const accountName=accountNameSnapshot(accountId,(occurrence&&occurrence.banco)||entity.banco||'conta removida');
  if(accountId===CARTEIRA_CONTA_ID || entity.formaPagamento==='Dinheiro' || normalizeAccountName(accountName)==='carteira') return 'Carteira';
  const forma=entity.formaPagamento && !['Crédito','Boleto','Dinheiro'].includes(entity.formaPagamento) ? ' · '+entity.formaPagamento : '';
  return 'Conta: '+(accountName||'conta removida')+forma;
}
function budgetRevenueDestinationLabel(tx){
  if(!tx) return 'Destino não informado';
  const accountName=accountNameSnapshot(tx.accountId,tx.banco||'conta removida');
  const box=tx.reservaBoxId?findReservaBoxById(tx.reservaBoxId):null;
  const total=Number(tx.valor)||0, reserve=Number(tx.reservaValor)||0;
  if(box && reserve>0){
    if(reserve<total || tx.destinoModo==='Dividir entre conta e reserva') return 'Conta: '+accountName+' + Reserva: '+box.nome;
    return 'Reserva: '+box.nome;
  }
  if(tx.accountId===CARTEIRA_CONTA_ID || normalizeAccountName(accountName)==='carteira') return 'Carteira';
  return 'Conta: '+(accountName||'conta removida');
}

/* V7.9.1 — filtro múltiplo por origem/destino em receitas e por origem de pagamento nas despesas. */
function budgetEnsureTabFilter(tab){
  const fallback={busca:'',categorias:[],origens:[],dataDe:'',dataAte:'',dateSort:BudgetDateSort.get(tab)};
  if(!S.filters[tab]||typeof S.filters[tab]!=='object') S.filters[tab]=fallback;
  const current=S.filters[tab];
  if(!Array.isArray(current.categorias)) current.categorias=[];
  if(!Array.isArray(current.origens)) current.origens=[];
  if(typeof current.busca!=='string') current.busca='';
  if(typeof current.dataDe!=='string') current.dataDe='';
  if(typeof current.dataAte!=='string') current.dataAte='';
  return current;
}
function budgetExpenseSourceToken(entity, occurrence=null){
  if(!entity) return 'origem:nao-informada';
  const card=budgetLinkedCard(entity);
  if(card) return 'cartao:'+card.id;
  if(entity.formaPagamento==='Crédito' || entity.origemPagamento==='cartao') return entity.viaCartaoId?'cartao:'+entity.viaCartaoId:'cartao:nao-identificado';
  const origem=(occurrence&&occurrence.origemPagamento)||entity.origemPagamento||((entity.accountId===CARTEIRA_CONTA_ID||entity.formaPagamento==='Dinheiro')?'carteira':'conta');
  if(origem==='reserva'){
    const reservaId=(occurrence&&occurrence.reservaId)||entity.reservaOrigemId;
    return reservaId?'reserva:'+reservaId:'reserva:nao-identificada';
  }
  const accountId=(occurrence&&occurrence.accountId)||entity.accountId||resolveAccountId((occurrence&&occurrence.banco)||entity.banco,{includeArchived:true});
  const accountName=accountNameSnapshot(accountId,(occurrence&&occurrence.banco)||entity.banco||'');
  if(origem==='carteira'||accountId===CARTEIRA_CONTA_ID||entity.formaPagamento==='Dinheiro'||normalizeAccountName(accountName)==='carteira') return 'carteira';
  if(accountId) return 'conta:'+accountId;
  const normalized=normalizeAccountName((occurrence&&occurrence.banco)||entity.banco||'');
  return normalized?'conta-nome:'+encodeURIComponent(normalized):'conta:nao-identificada';
}
function budgetExpenseMatchesOrigins(entity, occurrence, selectedOrigins){
  if(!Array.isArray(selectedOrigins)||!selectedOrigins.length) return true;
  const token=budgetExpenseSourceToken(entity,occurrence);
  if(selectedOrigins.includes(token)) return true;
  if(token.startsWith('conta:')||token.startsWith('conta-nome:')) return selectedOrigins.includes('grupo:contas');
  if(token.startsWith('reserva:')) return selectedOrigins.includes('grupo:reservas');
  if(token.startsWith('cartao:')) return selectedOrigins.includes('grupo:cartoes');
  return false;
}
function budgetRevenueOriginKey(tx){
  const key=String(tx&&tx.origem||'propria');
  return ['propria','rendimento','reembolso','repasse'].includes(key)?key:'propria';
}
function budgetRevenueDestinationTokens(tx){
  if(!tx) return ['destino:nao-informado'];
  const tokens=[];
  const accountId=tx.accountId||resolveAccountId(tx.banco,{includeArchived:true});
  const accountName=accountNameSnapshot(accountId,tx.banco||'');
  if(accountId===CARTEIRA_CONTA_ID||normalizeAccountName(accountName)==='carteira') tokens.push('carteira');
  else if(accountId) tokens.push('conta:'+accountId);
  else {
    const normalized=normalizeAccountName(tx.banco||'');
    tokens.push(normalized?'conta-nome:'+encodeURIComponent(normalized):'destino:nao-informado');
  }
  if(tx.reservaBoxId){
    tokens.push('reserva:'+tx.reservaBoxId);
    /* Receita totalmente enviada à reserva não deve aparecer como se tivesse ficado
       também na conta vinculada. No modo dividido, os dois destinos permanecem. */
    const total=Math.max(0,Number(tx.valor)||0),reserve=Math.max(0,Number(tx.reservaValor)||0);
    if(reserve>=total&&tx.destinoModo!=='Dividir entre conta e reserva'){
      return tokens.filter(token=>token.startsWith('reserva:'));
    }
  }
  return Array.from(new Set(tokens));
}
function budgetRevenueMatchesOrigins(tx,selectedOrigins){
  if(!Array.isArray(selectedOrigins)||!selectedOrigins.length) return true;
  const typeSelections=selectedOrigins.filter(token=>String(token).startsWith('receita-tipo:'));
  const destinationSelections=selectedOrigins.filter(token=>!String(token).startsWith('receita-tipo:'));
  const typeToken='receita-tipo:'+budgetRevenueOriginKey(tx);
  if(typeSelections.length&&!typeSelections.includes(typeToken)) return false;
  if(!destinationSelections.length) return true;
  const destinations=budgetRevenueDestinationTokens(tx);
  return destinations.some(token=>{
    if(destinationSelections.includes(token)) return true;
    if(token.startsWith('conta:')||token.startsWith('conta-nome:')) return destinationSelections.includes('grupo:contas');
    if(token.startsWith('reserva:')) return destinationSelections.includes('grupo:reservas');
    return false;
  });
}
function budgetRevenueSourceOptionGroups(){
  const revenueRows=(S.data.transacoes||[]).filter(t=>t&&t.tipo==='receita');
  const presentTypes=new Set(revenueRows.map(budgetRevenueOriginKey));
  const typeLabels={propria:'Receita própria',rendimento:'Rendimento',reembolso:'Reembolso recebido',repasse:'Repasse de terceiros'};
  const typeOrder=['propria','rendimento','reembolso','repasse'];
  const accounts=(typeof activeAccounts==='function'?activeAccounts(S.data):(S.data.contas||[]).filter(c=>c&&c.active!==false&&!c.archivedAt&&!c.deletedAt)).filter(c=>c&&c.id!==CARTEIRA_CONTA_ID&&!c.isCarteira&&!c.deletedAt);
  const reserves=((S.data.reservas&&S.data.reservas.boxes)||[]).filter(Boolean);
  const hasWallet=revenueRows.some(tx=>budgetRevenueDestinationTokens(tx).includes('carteira'));
  const groups=[
    {key:'tipos',label:'Tipo da receita',options:typeOrder.filter(key=>presentTypes.has(key)).map(key=>({token:'receita-tipo:'+key,label:typeLabels[key]}))},
    {key:'carteira',label:'Carteira',options:hasWallet?[{token:'carteira',label:'Carteira'}]:[]},
    {key:'contas',label:'Contas',options:accounts.length?[{token:'grupo:contas',label:'Todas as contas'}].concat(accounts.map(c=>({token:'conta:'+c.id,label:c.nome||c.banco||'Conta sem nome'}))):[]},
    {key:'reservas',label:'Reservas',options:reserves.length?[{token:'grupo:reservas',label:'Todas as reservas'}].concat(reserves.map(r=>({token:'reserva:'+r.id,label:r.nome+(r.banco?' · '+r.banco:'')}))):[]}
  ];
  /* Em perfil novo, mantenha os tipos disponíveis para o primeiro filtro, mesmo
     antes de existir uma receita. Contas e reservas continuam vindo dos dados reais. */
  if(!groups[0].options.length) groups[0].options=typeOrder.map(key=>({token:'receita-tipo:'+key,label:typeLabels[key]}));
  return groups.filter(group=>group.options.length);
}
function budgetSourceOptionGroups(){
  const accounts=(typeof activeAccounts==='function'?activeAccounts(S.data):(S.data.contas||[]).filter(c=>c&&c.active!==false&&!c.archivedAt&&!c.deletedAt)).filter(c=>c&&c.id!==CARTEIRA_CONTA_ID&&!c.isCarteira&&!c.deletedAt);
  const reserves=((S.data.reservas&&S.data.reservas.boxes)||[]).filter(Boolean);
  const cards=(S.data.cartoes||[]).filter(Boolean);
  const groups=[
    {key:'carteira',label:'Carteira',options:[{token:'carteira',label:'Carteira'}]},
    {key:'contas',label:'Contas',options:accounts.length?[{token:'grupo:contas',label:'Todas as contas'}].concat(accounts.map(c=>({token:'conta:'+c.id,label:c.nome||c.banco||'Conta sem nome'}))):[]},
    {key:'reservas',label:'Reservas',options:reserves.length?[{token:'grupo:reservas',label:'Todas as reservas'}].concat(reserves.map(r=>({token:'reserva:'+r.id,label:r.nome+(r.banco?' · '+r.banco:'')}))):[]},
    {key:'cartoes',label:'Cartões de crédito',options:cards.length?[{token:'grupo:cartoes',label:'Todos os cartões'}].concat(cards.map(c=>({token:'cartao:'+c.id,label:c.nome||c.banco||'Cartão sem nome'}))):[]}
  ];
  return groups.filter(g=>g.options.length);
}
function budgetSourceTokenLabel(token){
  if(token==='carteira') return 'Carteira';
  if(token==='cartao:nao-identificado') return 'Cartão não identificado';
  if(token==='reserva:nao-identificada') return 'Reserva não identificada';
  if(token==='conta:nao-identificada') return 'Conta não identificada';
  for(const group of budgetSourceOptionGroups()){
    const option=group.options.find(o=>o.token===token);
    if(option) return (group.key==='cartoes'?'Cartão: ':group.key==='reservas'?'Reserva: ':group.key==='contas'?'Conta: ':'')+option.label;
  }
  return 'Origem não informada';
}
function budgetSourceFilterHTML(selectedOrigins,groups=budgetSourceOptionGroups()){
  const selected=new Set(selectedOrigins||[]);
  return groups.map(group=>{
    const activeCount=group.options.reduce((count,option)=>count+(selected.has(option.token)?1:0),0);
    return `<details class="budget-source-group" ${activeCount?'open':''}>
      <summary><span>${esc(group.label)}</span>${activeCount?`<b>${activeCount}</b>`:''}</summary>
      <div class="filter-chip-row budget-source-options">${group.options.map(option=>`<button type="button" class="filter-chip-btn budget-source-chip ${selected.has(option.token)?'active':''}" data-source="${esc(option.token)}">${esc(option.label)}</button>`).join('')}</div>
    </details>`;
  }).join('');
}
function budgetRefreshPanels(options={}){
  const chart=options.chart!==false;
  const body=document.getElementById('view-body');
  const currentList=document.getElementById('budget-list-panel');
  if(S.view!=='budget'||!body||!currentList){ renderView(); return; }
  const holder=document.createElement('div');
  holder.innerHTML=renderBudget();
  const nextList=holder.querySelector('#budget-list-panel');
  if(!nextList){ renderView(); return; }
  currentList.replaceWith(nextList);
  if(chart){
    const currentChart=document.getElementById('budget-category-panel');
    const nextChart=holder.querySelector('#budget-category-panel');
    if(currentChart&&nextChart){ nextChart.classList.add('budget-no-intro-animation'); currentChart.replaceWith(nextChart); }
  }else{
    const filt=budgetEnsureTabFilter(S.budgetTab);
    const active=filt.categorias.length===1?filt.categorias[0]:null;
    document.querySelectorAll('#budget-category-panel .legend-item-clickable').forEach(item=>item.classList.toggle('legend-item-active',!!active&&item.dataset.label===active));
  }
  if(typeof applyBorionValuePrivacyDOM==='function') requestAnimationFrame(applyBorionValuePrivacyDOM);
}
function budgetLaunchNameHTML(name, options={}){
  const local=options.local?`<span class="launch-location-inline">⌂ ${esc(options.local)}</span>`:'';
  const inline=options.inline?`<span class="launch-destination-inline">${esc(options.inline)}</span>`:'';
  const source=options.source?`<div class="launch-source-line">${esc(options.source)}</div>`:'';
  const meta=(options.meta||[]).filter(Boolean).map(x=>`<span class="launch-meta-chip">${esc(x)}</span>`).join('');
  const recurrence=options.recurrence?`<div class="launch-recurrence">${esc(options.recurrence)}</div>`:'';
  return `<div class="launch-name-cell"><div class="launch-name-main"><span class="launch-name-text">${esc(name)}</span>${local}${inline}</div>${source}${recurrence}${meta?`<div class="launch-meta-row">${meta}</div>`:''}</div>`;
}
function budgetSummaryPreferences(){
  if(!S.data.uiPreferences) S.data.uiPreferences={};
  let p=S.data.uiPreferences.budgetSummary;
  if(!p||!Array.isArray(p.order)) p={order:DEFAULT_BUDGET_SUMMARY_CARDS.slice(),visible:DEFAULT_BUDGET_SUMMARY_CARDS.slice()};
  p.order=p.order.filter(k=>BUDGET_SUMMARY_CARD_DEFS[k]); Object.keys(BUDGET_SUMMARY_CARD_DEFS).forEach(k=>{if(!p.order.includes(k))p.order.push(k);});
  if(!Array.isArray(p.visible)) p.visible=DEFAULT_BUDGET_SUMMARY_CARDS.slice();
  p.visible=p.visible.filter(k=>BUDGET_SUMMARY_CARD_DEFS[k]); S.data.uiPreferences.budgetSummary=p; return p;
}
function budgetSummaryValues(rec,inv,desp,saldo){
  const cofrinhos=((S.data.reservas&&S.data.reservas.boxes)||[]).reduce((a,r)=>a+(Number(r.valorAtual)||0),0);
  const contas=(typeof activeAccounts==='function'?activeAccounts():(S.data.contas||[])).reduce((a,c)=>a+(typeof contaSaldoAtual==='function'?contaSaldoAtual(c):(Number(c.saldoInicial)||0)),0);
  const patrimonio=typeof patrimonioLiquido==='function'?Number(patrimonioLiquido())||0:contas+cofrinhos;
  const current=monthKey(S.month.y,S.month.m), rep=(S.data.reservas&&S.data.reservas.monthlyReports||[]).find(r=>r.monthKey===current);
  const moves=((S.data.reservas&&S.data.reservas.moves)||[]).filter(m=>m.data&&m.data.slice(0,7)===current);
  const variacao=rep?Number(rep.variation)||0:moves.reduce((a,m)=>a+(typeof reservaMoveDelta==='function'?reservaMoveDelta(m):0),0);
  return {receita:rec,investir:inv,despesas:desp,saldo,patrimonio,cofrinhos,variacaoCofrinhos:variacao,disponivel:contas};
}
function renderBudgetSummaryCards(rec,inv,desp,saldo){
  const pref=budgetSummaryPreferences(), vals=budgetSummaryValues(rec,inv,desp,saldo);
  const cards=pref.order.filter(k=>pref.visible.includes(k)).map(k=>{
    const d=BUDGET_SUMMARY_CARD_DEFS[k],v=vals[k]||0;
    const refundMini=k==='despesas'&&window.Refunds&&typeof Refunds.expenseRefundMiniHTML==='function'?Refunds.expenseRefundMiniHTML(S.month.y,S.month.m,v):'';
    const refundClass=refundMini?' budget-expense-refund-card has-refunds':'';
    const refundFocus=refundMini?' tabindex="0" aria-label="Despesas com detalhamento de estornos. Passe o mouse ou pressione Tab para consultar."':'';
    return `<div class="card${refundClass}"${refundFocus}><div class="clabel">${tagBadgeHTML(d.colorKey,d.label)}</div><div class="cval" style="color:${iconColor(d.colorKey)}">${brl(v)}</div>${refundMini}${k==='investir'?'<div style="margin-top:8px;"><button class="adjust-link" onclick="Budget.adjustInvest()">Ajustar ✎</button></div>':''}</div>`;
  }).join('');
  return `<div class="cards-row budget-summary-cards">${cards||'<div class="empty-note">Todos os cards do resumo estão ocultos. Ative em Configurações → Personalização.</div>'}</div>`;
}

function renderBudget(){
  // V7.5.8 — proteção contra abas removidas ou preferências antigas inválidas.
  // Mantém a última aba clássica válida; qualquer resíduo da antiga Central cai em Receita.
  const validBudgetTabs=['receita','fixa','variavel','assinaturas','reserva_transferencias'];
  if(!validBudgetTabs.includes(S.budgetTab)) S.budgetTab='receita';
  if(S.budgetTab==='reserva_transferencias') return renderTransferenciasTab();
  // V6.22 — aba "Assinaturas": mesma ideia, view própria, não mexe nas abas já existentes.
  if(S.budgetTab==='assinaturas') return renderAssinaturas();
  const rec = receitaMes(), desp = despesasMes(), inv = investirPlanejado();
  const saldo = saldoMes();
  const tab = S.budgetTab;
  const filt = budgetEnsureTabFilter(tab);
  const hasDateRange = !!(filt.dataDe && filt.dataAte);
  const hasOriginFilter = ['receita','fixa','variavel'].includes(tab) && filt.origens.length>0;
  const hasFilter = !!(filt.busca || filt.categorias.length || hasOriginFilter || hasDateRange);
  let rows='', total=0, segments=[], listLength=0;

  function matchesFilter(nome, categoria){
    if(filt.categorias.length && !filt.categorias.includes(categoria)) return false;
    if(filt.busca && !nome.toLowerCase().includes(filt.busca.toLowerCase())) return false;
    return true;
  }

  let receitaPropriaTotal=0, receitaExtraTotal=0;
  let fixaColLabel = 'Venc.';
  if(tab==='fixa'){
    if(hasDateRange){
      /* V5.37.0 — período pode cobrir vários meses (inclusive anteriores ao mês
         selecionado no topo). Cada despesa fixa ativa em pelo menos um mês do período
         entra uma vez na lista, somando o valor de todas as ocorrências no período. */
      fixaColLabel = 'Ocorr.';
      const months = monthsBetweenISO(filt.dataDe, filt.dataAte);
      const agg = new Map();
      months.forEach(({y,m})=>{
        const key=monthKey(y,m);
        fixasAtivasNoMes(y,m).forEach(f=>{
          const occurrence=fixaOcorrenciaFor(f.id,key);
          if(!budgetExpenseMatchesOrigins(f,occurrence,filt.origens)) return;
          if(!agg.has(f.id)) agg.set(f.id,{f,total:0,ocorrencias:0,sourceTokens:new Set()});
          const e=agg.get(f.id); e.total+=fixaValorNoMes(f,y,m); e.ocorrencias+=1; e.sourceTokens.add(budgetExpenseSourceToken(f,occurrence));
        });
      });
      const allEntries = Array.from(agg.values());
      const catTotals={};
      allEntries.forEach(e=> catTotals[e.f.categoria]=(catTotals[e.f.categoria]||0)+e.total);
      segments = Object.keys(catTotals).map(k=>({label:k,value:catTotals[k],color:catColor(k)}));
      const list = allEntries.filter(e=>matchesFilter(e.f.nome,e.f.categoria)).sort((a,b)=>{ const ak=(a.f.startMonth||filt.dataDe.slice(0,7))+'-'+pad2(a.f.dia||1), bk=(b.f.startMonth||filt.dataDe.slice(0,7))+'-'+pad2(b.f.dia||1); return BudgetDateSort.compare('fixa',ak,bk,a.f.createdAt,b.f.createdAt); });
      total = list.reduce((a,e)=>a+e.total,0);
      rows = list.map(e=>{
        const sourceTokens=Array.from(e.sourceTokens||[]);
        const sourceLabel=sourceTokens.length===1?budgetSourceTokenLabel(sourceTokens[0]):(sourceTokens.length>1?'Origens variadas ('+sourceTokens.length+')':budgetExpenseSourceLabel(e.f));
        const nameHTML=budgetLaunchNameHTML(e.f.nome,{source:sourceLabel,recurrence:'Recorrente desde '+shortMonthLabel(e.f.startMonth)});
        return `<tr>
          <td class="launch-date-cell">${e.ocorrencias}x</td>
          <td class="launch-name-column">${nameHTML}</td>
          <td class="launch-category-cell"><span class="cat-pill"><span class="dot" style="background:${catColor(e.f.categoria)}"></span>${esc(e.f.categoria)}</span></td>
          <td class="launch-value-cell val-neg">- ${brl(e.total)}</td>
          <td class="tbl-actions launch-actions-cell"><div class="launch-actions"><button onclick="Budget.edit('${e.f.id}')" title="Editar despesa fixa">✎</button></div></td>
        </tr>`;
      }).join('');
      listLength = list.length;
    } else {
      const mesKeyAtual = monthKey(S.month.y,S.month.m);
      const allActive = fixasAtivasNoMes(S.month.y,S.month.m);
      const sourceVisible=allActive.filter(f=>budgetExpenseMatchesOrigins(f,fixaOcorrenciaFor(f.id,mesKeyAtual),filt.origens));
      const catTotals={};
      sourceVisible.forEach(f=> catTotals[f.categoria]=(catTotals[f.categoria]||0)+fixaValorNoMes(f,S.month.y,S.month.m));
      segments = Object.keys(catTotals).map(k=>({label:k,value:catTotals[k],color:catColor(k)}));
      let list = hasFilter ? sourceVisible.filter(f=>matchesFilter(f.nome,f.categoria)) : sourceVisible.slice();
      list.sort((a,b)=>BudgetDateSort.compare('fixa',monthKey(S.month.y,S.month.m)+'-'+pad2(a.dia||1),monthKey(S.month.y,S.month.m)+'-'+pad2(b.dia||1),a.createdAt,b.createdAt));
      total = list.reduce((sum,f)=>sum+fixaValorNoMes(f,S.month.y,S.month.m),0);
      rows = list.map(f=>{
        const status = fixaOcorrenciaStatus(f, mesKeyAtual);
        const statusCls = status==='Pago'?'ok':status==='Vencido'?'bad':'neutral';
        const occurrence=fixaOcorrenciaFor(f.id,mesKeyAtual);
        const statusLabel=status==='Pago'?'Pago':(status==='Vencido'?'Em aberto · vencida':'Em aberto');
        const fixedValue=fixaValorNoMes(f,S.month.y,S.month.m);
        const fixedMeta=f.compartilhamentoId?['Compra compartilhada','Fatura '+brlText(f.valorFaturaParcela||0),'Minha parte '+brlText(fixedValue)]:[];
        const nameHTML=budgetLaunchNameHTML(f.nome,{source:budgetExpenseSourceLabel(f,occurrence),recurrence:'Recorrente desde '+shortMonthLabel(f.startMonth),meta:fixedMeta});
        return `
        <tr>
          <td class="launch-date-cell">Dia ${f.dia||1}</td>
          <td class="launch-name-column">${nameHTML}</td>
          <td class="launch-category-cell"><span class="cat-pill"><span class="dot" style="background:${catColor(f.categoria)}"></span>${esc(f.categoria)}</span></td>
          <td class="launch-value-cell val-neg">- ${brl(fixedValue)}</td>
          <td class="launch-status-cell"><span class="cheque-status ${statusCls}">${statusLabel}</span></td>
          <td class="tbl-actions launch-actions-cell"><div class="launch-actions"><button onclick="Budget.toggleFixaPago('${f.id}')" title="${status==='Pago'?'Marcar em aberto':'Marcar como paga'}">${status==='Pago'?'↺':'✔'}</button><button onclick="Budget.edit('${f.id}')" title="Editar despesa fixa">✎</button></div></td>
        </tr>`;
      }).join('');
      listLength = list.length;
    }
  } else {
    const source = hasDateRange
      ? S.data.transacoes.filter(t=>t.tipo===tab && (t.integrationNeedsCompletion===true||bankMatches(t.banco,t.accountId)) && t.data>=filt.dataDe && t.data<=filt.dataAte)
      : txInMonth(S.data.transacoes.filter(t=>t.tipo===tab), S.month.y, S.month.m).filter(t=>t.integrationNeedsCompletion===true||bankMatches(t.banco,t.accountId));
    const sourceVisible=tab==='variavel'
      ? source.filter(t=>budgetExpenseMatchesOrigins(t,null,filt.origens))
      : tab==='receita'
      ? source.filter(t=>budgetRevenueMatchesOrigins(t,filt.origens))
      : source;
    const catTotals={};
    sourceVisible.forEach(t=>catTotals[t.categoria]=(catTotals[t.categoria]||0)+Number(t.valor||0));
    segments = Object.keys(catTotals).map(k=>({label:k,value:catTotals[k],color:catColor(k)}));
    let list = hasFilter ? sourceVisible.filter(t=>matchesFilter(t.nome,t.categoria)) : sourceVisible.slice();
    const transactionOrder=new Map((S.data.transacoes||[]).map((item,index)=>[String(item&&item.id||''),index]));
    list.sort((a,b)=>BudgetDateSort.compare(tab,a.data,b.data,a.addedAt||a.createdAt,b.addedAt||b.createdAt,transactionOrder.get(String(a.id)),transactionOrder.get(String(b.id))));
    total = sumBy(list,'valor');
    if(tab==='receita'){
      list.forEach(t=>{ if(t.origem==null||t.origem==='propria'||t.origem==='rendimento') receitaPropriaTotal+=Number(t.valor)||0; else receitaExtraTotal+=Number(t.valor)||0; });
    }
    rows = list.map(t=>{
      const origemKey = t.origem||'propria';
      const meta=[];
      if(tab==='receita' && origemKey!=='propria') meta.push(txOrigemToLabel(origemKey));
      if(tab==='variavel' && Number(t.parcelaTotal||0)>1 && Number(t.parcelaAtual||0)>0) meta.push('Parcela '+Number(t.parcelaAtual)+'/'+Number(t.parcelaTotal));
      if(tab==='variavel'&&window.SharedPurchases){const sharedMeta=SharedPurchases.transactionMeta(t);if(sharedMeta)meta.push(...sharedMeta);}
      const nameHTML=budgetLaunchNameHTML(t.nome,{
        local:tab==='variavel'?(t.localCompra||t.local||''):'',
        inline:tab==='receita'?budgetRevenueDestinationLabel(t):'',
        source:tab==='variavel'?budgetExpenseSourceLabel(t):'',
        meta
      });
      const status=tab==='variavel'?(t.integrationNeedsCompletion===true?'Completar':variavelStatus(t)):'';
      const statusCls=status==='Pago'?'ok':(status==='Completar'?'warn':'neutral');
      return `
      <tr>
        <td class="launch-date-cell">${t.data.slice(8,10)}/${t.data.slice(5,7)}</td>
        <td class="launch-name-column">${nameHTML}</td>
        <td class="launch-category-cell"><span class="cat-pill"><span class="dot" style="background:${catColor(t.categoria)}"></span>${esc(t.categoria)}</span></td>
        <td class="launch-value-cell ${tab==='receita'?'val-pos':'val-neg'}">${tab==='receita'?'':'- '}${brl(t.valor)}</td>
        ${tab==='variavel'?`<td class="launch-status-cell"><span class="cheque-status ${statusCls}">${status}</span></td>`:''}
        <td class="tbl-actions launch-actions-cell"><div class="launch-actions">${tab==='variavel'&&t.integrationNeedsCompletion!==true?`<button onclick="Budget.toggleVariavelPago('${t.id}')" title="${status==='Pago'?'Marcar em aberto':'Marcar como pago'}">${status==='Pago'?'↺':'✔'}</button>`:''}<button onclick="Budget.edit('${t.id}')" title="${t.integrationNeedsCompletion===true?'Completar despesa integrada':'Editar lançamento'}">✎</button></div></td>
      </tr>`;}).join('');
    listLength = list.length;
  }

  const filterCount = (filt.busca?1:0) + filt.categorias.length + filt.origens.length + (hasDateRange?1:0);
  const periodoLabel = hasDateRange ? `${filt.dataDe.slice(8,10)}/${filt.dataDe.slice(5,7)}/${filt.dataDe.slice(0,4)} até ${filt.dataAte.slice(8,10)}/${filt.dataAte.slice(5,7)}/${filt.dataAte.slice(0,4)}` : '';

  return `
    ${renderBudgetSummaryCards(rec,inv,desp,saldo)}
    <div class="tabs">
      <button class="tab-btn ${tab==='receita'?'active':''}" onclick="Budget.tab('receita')">Receita</button>
      <button class="tab-btn ${tab==='fixa'?'active':''}" onclick="Budget.tab('fixa')">Despesa fixa</button>
      <button class="tab-btn ${tab==='variavel'?'active':''}" onclick="Budget.tab('variavel')">Despesa variável</button>
      <button class="tab-btn" onclick="Assinaturas.tab()">Assinaturas</button>
      <button class="tab-btn" onclick="Budget.tab('reserva_transferencias')">Transferências</button>
    </div>
    <div class="grid2" id="budget-filtered-region">
      <div class="panel-box" id="budget-list-panel">
        <div class="toolbar">
          <div class="toolbar-left">${tab==='receita'?'Receita':tab==='fixa'?'Despesas fixas':'Despesas variáveis'}</div>
          <div class="toolbar-right budget-toolbar-actions">
            ${hasFilter?`<button class="btn-outline" onclick="Budget.clearAllFilters()" title="Limpar todos os filtros">Limpar</button>`:''}
            <button class="btn-outline ${filterCount?'filter-active':''}" onclick="Budget.openFilter()">⌕ Filtro${filterCount?' ('+filterCount+')':''}</button>
            ${BudgetDateSort.buttonHTML(tab)}
            <button class="btn-outline" onclick="Budget.add()">+ Adicionar</button>
          </div>
        </div>
        ${hasDateRange?`<div class="tbl-foot" style="opacity:.85;margin-bottom:6px;"><span>📅 Período: ${periodoLabel}</span><button class="link-btn" style="padding:0;" onclick="Budget.clearPeriodo()">Limpar período</button></div>`:''}
        ${listLength? `
        <table class="budget-launch-table">
          <thead><tr><th>${tab==='fixa'?fixaColLabel:'Data'}</th><th>Nome</th><th>Categoria</th><th>Valor</th>${((tab==='fixa'&&!hasDateRange)||tab==='variavel')?'<th>Status</th>':''}<th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="tbl-foot"><span>Total${hasFilter?' filtrado':''}</span><span class="v">${brl(total)}</span></div>
        ${tab==='receita' && receitaExtraTotal>0 ? `
        <div class="tbl-foot" style="opacity:.85;"><span>· Receita própria + rendimento (contam como renda)</span><span class="v">${brl(receitaPropriaTotal)}</span></div>
        <div class="tbl-foot" style="opacity:.85;"><span>· Reembolso/repasse (não conta como renda)</span><span class="v">${brl(receitaExtraTotal)}</span></div>` : ''}
        ` : `<div class="empty-note">Nenhum lançamento encontrado${hasFilter?' com esse filtro':' neste mês'}.</div>`}
      </div>
      <div class="panel-box" id="budget-category-panel">
        <div class="panel-title">Composição por categoria</div>
        ${renderDonut(segments, null, null, {onCategoryClick:'Budget.filterByCategoria', activeCategory:(filt.categorias.length===1?filt.categorias[0]:null)})}
      </div>
    </div>
  `;
}

function reservaTransferGroups(){
  const moves=((S.data.reservas&&S.data.reservas.moves)||[]).filter(m=>m&&m.reservaTransferId);
  const groups=new Map();
  moves.forEach(m=>{if(!groups.has(m.reservaTransferId))groups.set(m.reservaTransferId,[]);groups.get(m.reservaTransferId).push(m);});
  return Array.from(groups.entries()).map(([id,pair])=>{
    const saida=pair.find(m=>m.tipo==='Envio para outra reserva')||pair.find(m=>Reservas.NEGATIVE_TYPES.includes(m.tipo));
    const entrada=pair.find(m=>m.tipo==='Recebimento de outra reserva')||pair.find(m=>Reservas.POSITIVE_TYPES.includes(m.tipo));
    const origem=findReservaBoxById(saida&&saida.boxId),destino=findReservaBoxById(entrada&&entrada.boxId);
    return {id,pair,saida,entrada,origem,destino,data:(saida&&saida.data)||(entrada&&entrada.data)||'',valor:Number((saida&&saida.valor)||(entrada&&entrada.valor))||0,descricao:(saida&&saida.descricao)||(entrada&&entrada.descricao)||''};
  }).sort((a,b)=>String(b.data).localeCompare(String(a.data)));
}
function transferenciaFilterKey(t){
  if(!t) return 'outras';
  if(t.kind==='rendimento_reserva'||t.kind==='ajuste_reserva') return 'outras';
  const origem=t.origemTipo||'conta',destino=t.destinoTipo||'conta';
  const origemId=t.origemAccountId||t.origemId;
  const destinoId=t.destinoAccountId||t.destinoId;
  if(origem==='conta'&&origemId===CARTEIRA_CONTA_ID&&destino==='conta') return 'carteira_conta';
  if(origem==='conta'&&destino==='conta'&&destinoId===CARTEIRA_CONTA_ID) return 'conta_carteira';
  if(origem==='conta'&&destino==='conta') return 'conta_conta';
  if(origem==='conta'&&destino==='reserva') return 'conta_reserva';
  if(origem==='reserva'&&destino==='reserva') return 'reserva_reserva';
  if(origem==='reserva'&&destino==='conta'&&destinoId===CARTEIRA_CONTA_ID) return 'reserva_carteira';
  if(origem==='reserva'&&destino==='conta') return 'reserva_conta';
  return 'outras';
}
function transferenciaDisplayNames(t){
  if(t.kind==='rendimento_reserva') return {origem:t.origemNome||'Reserva',destino:'Rendimento'};
  if(t.kind==='ajuste_reserva') return {origem:t.origemNome||'Reserva',destino:'Ajuste da própria reserva'};
  return {origem:t.origemNome||accountNameSnapshot(t.origemAccountId||t.origemId)||'Origem',destino:t.destinoNome||accountNameSnapshot(t.destinoAccountId||t.destinoId)||'Destino'};
}
function renderTransferenciasTab(){
  const filter=S.transferFilter||'todos';
  const generic=(S.data.transferencias||[]).slice();
  const legacy=reservaTransferGroups().map(g=>({legacy:true,id:g.id,data:g.data,valor:g.valor,descricao:g.descricao,origemNome:g.origem?g.origem.nome:'Reserva removida',destinoNome:g.destino?g.destino.nome:'Reserva removida',filterKey:'reserva_reserva'}));
  const all=generic.concat(legacy).sort((a,b)=>BudgetDateSort.compare('transferencias',a.data,b.data,a.createdAt,b.createdAt));
  const visible=all.filter(t=>filter==='todos'||(t.filterKey||transferenciaFilterKey(t))===filter);
  const total=visible.reduce((sum,t)=>sum+(Number(t.valor)||0),0);
  const rows=visible.map(t=>{
    const names=t.legacy?{origem:t.origemNome,destino:t.destinoNome}:transferenciaDisplayNames(t);
    const type=t.filterKey||transferenciaFilterKey(t);
    const typeLabel=({carteira_conta:'Carteira → Conta',conta_carteira:'Conta → Carteira (saque)',conta_conta:'Conta → Conta',conta_reserva:'Conta → Reserva',reserva_conta:'Reserva → Conta',reserva_carteira:'Reserva → Carteira (saque)',reserva_reserva:'Reserva → Reserva',outras:t.kind==='rendimento_reserva'?'Rendimento':t.kind==='ajuste_reserva'?'Ajuste manual':'Movimentação'})[type]||'Movimentação';
    const actions=t.legacy
      ? `<button onclick="Reservas.editTransfer('${t.id}')" title="Editar transferência antiga">✎</button><button onclick="Reservas.deleteTransfer('${t.id}')" title="Excluir">×</button>`
      : `<button onclick="Cards.editTransferencia('${t.id}')" title="Editar transferência">✎</button>`;
    return `<tr><td>${t.data?reservaFmtDate(t.data):'—'}</td><td>${esc(names.origem)}</td><td>→</td><td>${esc(names.destino)}</td><td><span class="cat-pill">${esc(typeLabel)}</span></td><td>${brl(t.valor)}</td><td>${esc(t.descricao||'')}</td><td class="tbl-actions">${actions}</td></tr>`;
  }).join('');
  const filterOptions=[['todos','Todas'],['carteira_conta','Carteira → Conta'],['conta_carteira','Conta → Carteira (saque)'],['conta_conta','Conta → Conta'],['conta_reserva','Conta → Reserva'],['reserva_conta','Reserva → Conta'],['reserva_carteira','Reserva → Carteira (saque)'],['reserva_reserva','Reserva → Reserva']];
  return `<div class="cards-row"><div class="card hero-gold"><div class="clabel">VALOR MOVIMENTADO</div><div class="cval">${brl(total)}</div></div><div class="card"><div class="clabel">TRANSFERÊNCIAS</div><div class="cval">${visible.length}</div></div></div>
  <div class="tabs"><button class="tab-btn" onclick="Budget.tab('receita')">Receita</button><button class="tab-btn" onclick="Budget.tab('fixa')">Despesa fixa</button><button class="tab-btn" onclick="Budget.tab('variavel')">Despesa variável</button><button class="tab-btn" onclick="Assinaturas.tab()">Assinaturas</button><button class="tab-btn active">Transferências</button></div>
  <div class="panel-box"><div class="toolbar"><div class="toolbar-left">Transferências</div><div class="toolbar-right budget-toolbar-actions">${BudgetDateSort.buttonHTML('transferencias')}<select class="order-sort-select" onchange="Budget.setTransferFilter(this.value)">${filterOptions.map(([v,l])=>`<option value="${v}" ${filter===v?'selected':''}>${l}</option>`).join('')}</select><button class="btn-outline" onclick="Cards.addTransferencia()">+ Nova transferência</button></div></div><p class="modal-sub">Movimente dinheiro entre Carteira, Contas e Reservas sem registrar receita ou despesa. As regras de vínculo das Reservas são aplicadas automaticamente.</p>${rows?`<div class="table-scroll"><table><thead><tr><th>Data</th><th>Origem</th><th></th><th>Destino</th><th>Tipo</th><th>Valor</th><th>Descrição</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty-note">Nenhuma transferência encontrada neste filtro.</div>'}</div>`;
}
const Budget = {
  tab(t){ const valid=['receita','fixa','variavel','assinaturas','reserva_transferencias']; S.budgetTab=valid.includes(t)?t:'receita'; renderView(); },
  setTransferFilter(value){ S.transferFilter=value||'todos'; renderView(); },
  toggleDateSort(type){ BudgetDateSort.toggle(type); },
  add(){
    if(S.budgetTab==='fixa') openFixaModal(null);
    else openTransactionModal({type:S.budgetTab});
  },
  edit(id){
    if(S.budgetTab==='fixa'){
      const f = S.data.fixas.find(x=>x.id===id);
      /* V5.39.0 — despesa fixa espelhada de uma compra no cartão: edita/remove pela
         compra no cartão, pra nunca dessincronizar os dois lados do vínculo. */
      if(f && f.viaParcelaId){
        const cartao=(S.data.cartoes||[]).find(c=>c.id===f.viaCartaoId)||(S.data.cartoes||[]).find(c=>(c.parcelas||[]).some(p=>p.id===f.viaParcelaId));
        const parcela=cartao&&(cartao.parcelas||[]).find(p=>p.id===f.viaParcelaId);
        if(cartao&&parcela&&window.Cards&&typeof Cards.editParcela==='function'){
          Cards.editParcela(cartao.id,parcela.id);
          return;
        }
        const rec=(S.data.assinaturaCobrancas||[]).find(r=>r&&(r.id===f.assinaturaCobrancaId||r.parcelaId===f.viaParcelaId));
        if(rec){
          S.data.fixas=(S.data.fixas||[]).filter(x=>x.id!==f.id);
          rec.parcelaId=null;rec.transacaoId=null;rec.balanceApplied=false;rec.materializationSuppressed=false;
          rec.status='falhou';rec.lastError='O vínculo antigo da cobrança com o cartão foi reparado.';
          if(window.Assinaturas&&typeof Assinaturas.sync==='function') Assinaturas.sync();
          saveCurrentData();renderView();toast('Vínculo quebrado removido. A assinatura foi sincronizada novamente com o cartão.');
          return;
        }
        delete f.viaCartaoId;delete f.viaParcelaId;delete f.valorFaturaParcela;
        f.recoveredBrokenCardLinkAt=Date.now();
        saveCurrentData();toast('O vínculo quebrado com o cartão foi removido. Agora esta despesa pode ser editada ou excluída normalmente.');
        openFixaModal(f);
        return;
      }
      if(f && f.viaBoletoId){
        toast('Essa despesa fixa vem de um boleto — edite ou remova em Cartões e Contas.');
        return;
      }
      openFixaModal(f);
    } else {
      const t = S.data.transacoes.find(x=>x.id===id);
      if(t && t.viaParcelaId){
        const cartao=(S.data.cartoes||[]).find(c=>c.id===t.viaCartaoId)||(S.data.cartoes||[]).find(c=>(c.parcelas||[]).some(p=>p.id===t.viaParcelaId));
        const parcela=cartao&&(cartao.parcelas||[]).find(p=>p.id===t.viaParcelaId);
        if(cartao&&parcela&&window.Cards&&typeof Cards.editParcela==='function'){
          Cards.editParcela(cartao.id,parcela.id);
          return;
        }
        const rec=(S.data.assinaturaCobrancas||[]).find(r=>r&&(r.id===t.assinaturaCobrancaId||r.parcelaId===t.viaParcelaId));
        if(rec){
          S.data.transacoes=(S.data.transacoes||[]).filter(x=>x.id!==t.id);
          rec.parcelaId=null;rec.transacaoId=null;rec.balanceApplied=false;rec.materializationSuppressed=false;
          rec.status='falhou';rec.lastError='O vínculo antigo da cobrança com o cartão foi reparado.';
          if(window.Assinaturas&&typeof Assinaturas.sync==='function') Assinaturas.sync();
          saveCurrentData();renderView();toast('Lançamento órfão removido. A assinatura foi sincronizada novamente com o cartão.');
          return;
        }
        delete t.viaCartaoId;delete t.viaParcelaId;delete t.valorFaturaParcela;
        delete t.viaAssinaturaId;delete t.assinaturaCobrancaId;
        t.recoveredBrokenCardLinkAt=Date.now();
        saveCurrentData();toast('O vínculo quebrado com o cartão foi removido. Agora este lançamento pode ser editado ou excluído normalmente.');
        openTransactionModal({type:t.tipo, existing:t});
        return;
      }
      if(t && t.viaBoletoId){
        toast('Essa despesa vem de um boleto — edite ou remova em Cartões e Contas.');
        return;
      }
      openTransactionModal({type:t.tipo, existing:t});
    }
  },
  /* V6.27.3 — define explicitamente Pago ou Em aberto usando um único estado mensal.
     A mesma função é chamada tanto em Lançamentos quanto em Cartões e Contas. */
  setFixaStatus(fixaId, requestedStatus){
    const f=(S.data.fixas||[]).find(x=>x.id===fixaId);
    if(!f)return;
    const mesKey=monthKey(S.month.y,S.month.m);
    const atual=fixaOcorrenciaStatus(f,mesKey)==='Pago'?'Pago':'Em aberto';
    const alvo=requestedStatus==='Pago'?'Pago':'Em aberto';
    if(atual===alvo){toast(alvo==='Pago'?'Esta despesa já está paga.':'Esta despesa já está em aberto.');return;}

    if(f.viaParcelaId){
      const cartao=(S.data.cartoes||[]).find(c=>c.id===f.viaCartaoId);
      const parcela=cartao&&(cartao.parcelas||[]).find(p=>p.id===f.viaParcelaId);
      if(!cartao||!parcela){toast('A compra vinculada ao cartão não foi encontrada.');return;}
      if(alvo==='Em aberto'&&isFaturaPaga(cartao.id,mesKey)){
        toast('Esta despesa está paga porque a fatura inteira foi paga. Desfaça o pagamento da fatura em Cartões e Contas para reabrir.');
        return;
      }
      if(!setParcelaCompetenciaPagoManual(cartao.id,parcela.id,mesKey,alvo==='Pago')){toast('Não foi possível atualizar a parcela vinculada.');return;}
      saveCurrentData();renderView();toast(alvo==='Pago'?'Despesa fixa marcada como paga no cartão e em Lançamentos.':'Despesa fixa voltou para em aberto no cartão e em Lançamentos.');
      return;
    }

    if(f.viaBoletoId){
      const b=(S.data.boletos||[]).find(x=>x.id===f.viaBoletoId);
      if(!b){toast('O boleto vinculado não foi encontrado.');return;}
      const info=boletoParcelaDoMes(b.id,S.month.y,S.month.m);
      if(alvo==='Pago'){
        if(info.paga){saveCurrentData();renderView();return;}
        if(window.Cards&&typeof Cards.payBoletoParcela==='function') Cards.payBoletoParcela(b.id,mesKey);
      }else if(info.pagamento&&window.Cards&&typeof Cards.undoBoletoPagamento==='function'){
        Cards.undoBoletoPagamento(b.id,info.pagamento.id);
      }else{
        /* Compatibilidade com ocorrência antiga paga diretamente antes do vínculo completo. */
        undoFixaOcorrencia(f,mesKey);
      }
      return;
    }

    if(alvo==='Pago') payFixaOcorrencia(f,mesKey);
    else undoFixaOcorrencia(f,mesKey);
  },
  toggleFixaPago(fixaId){
    const f=(S.data.fixas||[]).find(x=>x.id===fixaId);
    if(!f)return;
    const atual=fixaOcorrenciaStatus(f,monthKey(S.month.y,S.month.m))==='Pago'?'Pago':'Em aberto';
    Budget.setFixaStatus(fixaId,atual==='Pago'?'Em aberto':'Pago');
  },

  setVariavelPago(id, requestedStatus){
    const tx=(S.data.transacoes||[]).find(t=>t.id===id&&t.tipo==='variavel');
    if(!tx)return;
    if(tx.integrationNeedsCompletion===true){toast('Complete a conta e a forma de pagamento antes de marcar esta despesa como paga.');Budget.edit(id);return;}
    const alvo=requestedStatus==='Pago'?'Pago':'Em aberto';
    const atual=variavelStatus(tx);
    if(atual===alvo){toast(alvo==='Pago'?'Esta despesa já está paga.':'Esta despesa já está em aberto.');return;}

    /* Boleto usa o pagamento real da parcela como fonte de verdade. A baixa/estorno do
       boleto também atualiza este lançamento, evitando dois saldos independentes. */
    if(tx.viaBoletoId){
      const b=(S.data.boletos||[]).find(x=>x.id===tx.viaBoletoId);
      if(!b){toast('O boleto vinculado não foi encontrado.');return;}
      const competencia=String(tx.data||'').slice(0,7)||monthKey(S.month.y,S.month.m);
      const parts=competencia.split('-').map(Number);
      const info=boletoParcelaDoMes(b.id,parts[0]||S.month.y,(parts[1]||S.month.m+1)-1);
      if(alvo==='Pago'){
        if(info.paga){tx.statusPagamento='Pago';saveCurrentData();renderView();return;}
        if(window.Cards&&typeof Cards.payBoletoParcela==='function') Cards.payBoletoParcela(b.id,competencia);
      }else if(info.pagamento&&window.Cards&&typeof Cards.undoBoletoPagamento==='function'){
        Cards.undoBoletoPagamento(b.id,info.pagamento.id);
      }else{
        tx.statusPagamento='Em aberto';saveCurrentData();renderView();toast('Despesa voltou para em aberto em Boletos e em Lançamentos.');
      }
      return;
    }

    /* Compra no cartão pode ter status individual, mas não pode ficar em aberto enquanto
       a fatura inteira da competência estiver paga. */
    if(tx.viaParcelaId){
      const card=(S.data.cartoes||[]).find(c=>c.id===tx.viaCartaoId);
      const competencia=String(tx.data||'').slice(0,7)||monthKey(S.month.y,S.month.m);
      if(alvo==='Em aberto'&&card&&isFaturaPaga(card.id,competencia)){
        toast('Esta despesa está paga porque a fatura inteira foi paga. Desfaça o pagamento da fatura em Cartões e Contas para reabrir.');
        return;
      }
    }

    const ok=runAtomicFinancialMutation(()=>{if(!setVariavelStatus(tx,alvo))throw new Error('status_nao_alterado');},()=>{});
    if(!ok)return;
    if(tx.viaParcelaId){
      tx.statusPagamentoManualAt=Date.now();
      tx.statusPagamentoOrigem='manual';
    }
    saveCurrentData();renderView();toast(alvo==='Pago'?'Despesa marcada como paga.':'Despesa voltou para em aberto.');
  },
  toggleVariavelPago(id){
    const tx=(S.data.transacoes||[]).find(t=>t.id===id&&t.tipo==='variavel');
    if(!tx)return;
    Budget.setVariavelPago(id,variavelStatus(tx)==='Pago'?'Em aberto':'Pago');
  },

  adjustInvest(){
    const key = monthKey(S.month.y,S.month.m);
    const rec = receitaMes();
    const current = S.data.investirPlanejado[key]||0;
    const currentPct = rec>0 ? Math.min(100, Math.round(current/rec*100)) : 0;
    const box = el(`
      <div class="modal-overlay">
        <div class="modal-box">
          <div class="modal-head"><h2>Ajustar valor a investir</h2><button id="ai_close">&times;</button></div>
          <p class="modal-sub">Quanto você planeja investir em ${monthLabel(S.month.y,S.month.m)}? Arraste a barra como porcentagem da receita do mês (${brl(rec)}), ou digite o valor direto.</p>
          <div class="field">
            <label>Porcentagem da receita: <span id="ai_pct_label" style="color:var(--gold);font-weight:700;">${currentPct}%</span></label>
            <input type="range" id="ai_slider" min="0" max="100" step="1" value="${currentPct}" style="width:100%;"/>
          </div>
          <div class="field"><label>Valor (R$)</label><input type="text" inputmode="numeric" class="money-input" id="ai_valor" placeholder="0,00"/></div>
          <div class="row-btns"><button class="btn btn-primary btn-block" id="ai_save">Salvar</button></div>
        </div>
      </div>`);
    $('#modal-root').innerHTML=''; $('#modal-root').appendChild(box);
    attachModalGuard(box);
    $('#ai_close').onclick = closeModal;
    attachMoneyMask($('#ai_valor'), current);
    const slider = $('#ai_slider'), pctLabel = $('#ai_pct_label'), valorInput = $('#ai_valor');
    slider.oninput = ()=>{
      const p = Number(slider.value);
      pctLabel.textContent = p+'%';
      const cents = Math.round(rec * p/100 * 100);
      valorInput.dataset.cents = String(cents);
      valorInput.value = (cents/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    };
    valorInput.addEventListener('input', ()=>{
      const cents = parseInt(valorInput.dataset.cents||'0',10);
      const valor = cents/100;
      const p = rec>0 ? Math.min(100, Math.round(valor/rec*100)) : 0;
      slider.value = String(p);
      pctLabel.textContent = p+'%';
    });
    $('#ai_save').onclick = ()=>{
      const cents = parseInt(valorInput.dataset.cents||'0',10);
      S.data.investirPlanejado[key]=cents/100;
      saveCurrentData(); closeModal(); renderView();
    };
  },
  openFilter(){ openFilterModal(S.budgetTab); },
  clearPeriodo(){
    const tab = S.budgetTab;
    S.filters[tab] = Object.assign({}, budgetEnsureTabFilter(tab), {dataDe:'', dataAte:''});
    budgetRefreshPanels({chart:true});
  },
  /* V7.1.3 — filtro rápido: clicar numa categoria da "Composição por categoria" filtra a lista
     na hora, só com aquela categoria. Clicar de novo na mesma categoria já ativa remove o filtro
     (mesmo efeito do botão "Limpar" que aparece ao lado de "Filtro"). */
  filterByCategoria(encodedCategoria){
    const tab = S.budgetTab;
    if(!S.filters[tab]) return;
    const categoria = decodeURIComponent(encodedCategoria);
    const current = budgetEnsureTabFilter(tab);
    const jaAtiva = current.categorias.length===1 && current.categorias[0]===categoria;
    S.filters[tab] = Object.assign({}, current, {categorias: jaAtiva ? [] : [categoria]});
    budgetRefreshPanels({chart:false});
  },
  /* Reseta busca, categorias e período da aba atual, voltando à visualização completa —
     mesmo efeito do "Limpar" dentro do modal de filtro. */
  clearAllFilters(){
    const tab = S.budgetTab;
    S.filters[tab] = {busca:'', categorias:[], origens:[], dataDe:'', dataAte:'', dateSort:BudgetDateSort.get(tab)};
    budgetRefreshPanels({chart:true});
  }
};

/* ---- modal de filtro: busca por nome + categorias (multi-seleção) + período (data de/até) ---- */
function budgetFilterQuickRange(key){
  const now=new Date();
  const iso=d=>{const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;};
  if(key==='month') return {from:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`,to:iso(new Date(now.getFullYear(),now.getMonth()+1,0))};
  if(key==='30d'){const from=new Date(now);from.setDate(from.getDate()-29);return {from:iso(from),to:iso(now)};}
  if(key==='90d'){const from=new Date(now);from.setDate(from.getDate()-89);return {from:iso(from),to:iso(now)};}
  if(key==='year') return {from:`${now.getFullYear()}-01-01`,to:`${now.getFullYear()}-12-31`};
  return {from:'',to:''};
}
function openFilterModal(tab){
  const cats=S.data.categorias[tab]||[];
  const current=budgetEnsureTabFilter(tab);
  const selected=new Set(current.categorias);
  const selectedSources=new Set(current.origens);
  const filterCount=(current.busca?1:0)+selected.size+selectedSources.size+(current.dataDe||current.dataAte?1:0);
  const chipsHTML=cats.map(c=>`<button type="button" class="filter-chip-btn ${selected.has(c)?'active':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  const sourceSection=tab==='receita'?`
        <section class="budget-filter-section budget-source-filter-field">
          <div class="budget-filter-section-head"><div><strong>Origem da receita</strong><small>Combine o tipo da receita com a carteira, a conta ou a reserva de destino.</small></div></div>
          <div class="budget-source-groups">${budgetSourceFilterHTML(Array.from(selectedSources),budgetRevenueSourceOptionGroups())}</div>
        </section>`:(tab==='fixa'||tab==='variavel')?`
        <section class="budget-filter-section budget-source-filter-field">
          <div class="budget-filter-section-head"><div><strong>Origem do pagamento</strong><small>Combine carteira, contas, reservas e cartões.</small></div></div>
          <div class="budget-source-groups">${budgetSourceFilterHTML(Array.from(selectedSources))}</div>
        </section>`:'';
  const box=el(`
    <div class="modal-overlay">
      <div class="modal-box budget-filter-modal">
        <div class="modal-head budget-filter-head"><div><h2>Filtrar ${tab==='receita'?'receitas':tab==='fixa'?'despesas fixas':'despesas variáveis'}</h2><p>${filterCount?filterCount+' seleção'+(filterCount===1?' ativa':'ões ativas'):'Nenhum filtro ativo'}</p></div><button id="flt_close">&times;</button></div>
        <div class="budget-filter-body">
          <section class="budget-filter-section budget-filter-search-section">
            <label for="flt_busca">Buscar por nome</label>
            <input type="search" id="flt_busca" autocomplete="off" placeholder="Digite o nome do lançamento..." value="${esc(current.busca||'')}"/>
          </section>
          <section class="budget-filter-section">
            <div class="budget-filter-section-head"><div><strong>Categorias</strong><small>Selecione uma ou várias.</small></div></div>
            <div class="filter-chip-row budget-category-filter-list" id="flt_chips">${chipsHTML||'<span class="budget-filter-empty">Nenhuma categoria cadastrada.</span>'}</div>
          </section>
          ${sourceSection}
          <section class="budget-filter-section">
            <div class="budget-filter-section-head"><div><strong>Período</strong><small>Use um atalho ou informe as datas.</small></div></div>
            <div class="budget-quick-periods">
              <button type="button" data-period="month">Este mês</button>
              <button type="button" data-period="30d">30 dias</button>
              <button type="button" data-period="90d">90 dias</button>
              <button type="button" data-period="year">Este ano</button>
              <button type="button" data-period="clear">Sem período</button>
            </div>
            <div class="budget-filter-date-grid">
              <div class="field"><label>De</label><input type="date" id="flt_data_de" value="${esc(current.dataDe||'')}"/></div>
              <div class="field"><label>Até</label><input type="date" id="flt_data_ate" value="${esc(current.dataAte||'')}"/></div>
            </div>
          </section>
        </div>
        <div class="budget-filter-actions">
          <button class="btn btn-secondary" id="flt_limpar">Limpar</button>
          <button class="btn btn-secondary" id="flt_cancelar">Cancelar</button>
          <button class="btn btn-primary" id="flt_aplicar">Aplicar filtros</button>
        </div>
      </div>
    </div>`);
  $('#modal-root').innerHTML=''; $('#modal-root').appendChild(box); attachModalGuard(box);
  $('#flt_close').onclick=closeModal; $('#flt_cancelar').onclick=closeModal;
  box.querySelectorAll('[data-cat]').forEach(btn=>{btn.onclick=()=>{const c=btn.dataset.cat;if(selected.has(c)){selected.delete(c);btn.classList.remove('active');}else{selected.add(c);btn.classList.add('active');}};});
  box.querySelectorAll('[data-source]').forEach(btn=>{btn.onclick=()=>{const source=btn.dataset.source;if(selectedSources.has(source)){selectedSources.delete(source);btn.classList.remove('active');}else{selectedSources.add(source);btn.classList.add('active');}const details=btn.closest('details');if(details){const count=details.querySelectorAll('[data-source].active').length;let badge=details.querySelector('summary b');if(count&&!badge){badge=document.createElement('b');details.querySelector('summary').appendChild(badge);}if(badge){badge.textContent=String(count);if(!count)badge.remove();}}};});
  box.querySelectorAll('[data-period]').forEach(btn=>{btn.onclick=()=>{const range=budgetFilterQuickRange(btn.dataset.period);$('#flt_data_de').value=range.from;$('#flt_data_ate').value=range.to;box.querySelectorAll('[data-period]').forEach(item=>item.classList.toggle('active',item===btn));};});
  const apply=()=>{
    const dataDe=$('#flt_data_de').value||'',dataAte=$('#flt_data_ate').value||'';
    if(dataDe&&dataAte&&dataDe>dataAte){alert('A data "de" não pode ser depois da data "até".');return;}
    S.filters[tab]={busca:$('#flt_busca').value.trim(),categorias:Array.from(selected),origens:Array.from(selectedSources),dataDe,dataAte,dateSort:BudgetDateSort.get(tab)};
    closeModal();budgetRefreshPanels({chart:true});
  };
  $('#flt_busca').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();apply();}});
  $('#flt_limpar').onclick=()=>{S.filters[tab]={busca:'',categorias:[],origens:[],dataDe:'',dataAte:'',dateSort:BudgetDateSort.get(tab)};closeModal();budgetRefreshPanels({chart:true});};
  $('#flt_aplicar').onclick=apply;
}
/* ---- dedicated modal: one-off transaction (receita / despesa variável) ---- */
function reservaBoxesForLancamento(){
  return reservasEnabled() ? ((S.data.reservas && S.data.reservas.boxes)||[]).filter(r=>bankMatches(r.banco)) : [];
}
function reservaBoxLabel(r){ return `${r.nome}${r.banco?' · '+r.banco:''}`; }
function removeLinkedReservaMoveFromTransaction(tx){
  if(!tx || !tx.reservaMoveId || !S.data.reservas) return;
  const idx = (S.data.reservas.moves||[]).findIndex(m=>m.id===tx.reservaMoveId);
  if(idx>=0){
    const mv = S.data.reservas.moves[idx];
    const bx = (S.data.reservas.boxes||[]).find(r=>r.id===mv.boxId);
    if(bx){ bx.valorAtual = Math.max(0, Number(bx.valorAtual||0) - Number(mv.valor||0)); if(typeof syncMetaFromReserva==='function') syncMetaFromReserva(bx); }
    S.data.reservas.moves.splice(idx,1);
  }
  delete tx.reservaMoveId;
  delete tx.reservaBoxId;
  delete tx.reservaValor;
  delete tx.destinoReserva;
}
function createLinkedReservaMoveFromTransaction(tx, reservaBox, reservaValor){
  if(!tx || !reservaBox || !S.data.reservas) return;
  const valor = Number(reservaValor)||0;
  if(valor<=0) return;
  const mv = {
    id:uid(), boxId:reservaBox.id, tipo:'Receita direta', data:tx.data||todayISO(), valor,
    banco:reservaBox.banco||tx.banco||'', descricao:'Receita enviada direto para reserva: '+(tx.nome||'Sem nome'),
    origem:'receita', transacaoId:tx.id, createdAt:Date.now()
  };
  reservaBox.valorAtual = Number(reservaBox.valorAtual||0) + valor;
  if(typeof syncMetaFromReserva==='function') syncMetaFromReserva(reservaBox);
  S.data.reservas.moves.push(mv);
  tx.reservaMoveId = mv.id;
  tx.reservaBoxId = reservaBox.id;
  tx.reservaValor = valor;
  tx.destinoReserva = true;
}

/* ---------------- V6.0 — despesa variável paga direto de uma reserva ----------------
   Núcleo da nova arquitetura financeira: retirar dinheiro de uma reserva para pagar uma
   despesa NUNCA mais precisa passar por uma Receita. O usuário só escolhe "Origem do
   pagamento: Reserva" e o Borion, num único clique, desconta o valor da reserva e cria a
   despesa — ligadas uma à outra por reservaOrigemMoveId/despesaTransacaoId, no mesmo
   padrão já usado para "Receita direta". Espelha removeLinkedReservaMoveFromTransaction /
   createLinkedReservaMoveFromTransaction (acima), só que na direção contrária (saída). */
function removeLinkedReservaWithdrawalFromDespesa(tx){
  if(!tx || !tx.reservaOrigemMoveId || !S.data.reservas) return;
  const idx = (S.data.reservas.moves||[]).findIndex(m=>m.id===tx.reservaOrigemMoveId);
  if(idx>=0){
    const mv = S.data.reservas.moves[idx];
    Reservas.reverseMoveEffect(mv);
    S.data.reservas.moves.splice(idx,1);
  }
  tx.reservaOrigemId = null;
  tx.reservaOrigemMoveId = null;
}
function createLinkedReservaWithdrawalFromDespesa(tx, reservaBox, valor){
  if(!tx || !reservaBox || !S.data.reservas) return;
  const v = Number(valor)||0;
  if(v<=0) return;
  const mv = {
    id:uid(), boxId:reservaBox.id, tipo:'Pagamento direto', data:tx.data||todayISO(), valor:v,
    banco:reservaBox.banco||'', descricao:'Pagamento direto: '+(tx.nome||'Despesa'),
    despesaTransacaoId:tx.id, createdAt:Date.now()
  };
  S.data.reservas.moves.push(mv);
  Reservas.applyMoveEffect(mv);
  tx.reservaOrigemId = reservaBox.id;
  tx.reservaOrigemMoveId = mv.id;
}
/* ---------------- V6.1 — despesa fixa integrada com conta/reserva ----------------
   Mesma lógica já usada pela despesa variável (createLinkedReservaWithdrawalFromDespesa /
   removeLinkedReservaWithdrawalFromDespesa), adaptada para respeitar a diferença entre
   "despesa fixa cadastrada" (S.data.fixas, nunca move saldo) e "ocorrência paga" (um
   registro em S.data.fixaPagamentos por mês, só criado quando o usuário marca como paga).
   Todas as funções abaixo reaproveitam Reservas.applyMoveEffect/reverseMoveEffect (mesmo
   mecanismo do extrato da reserva) para nunca duplicar a lógica de débito/crédito. */
function findReservaBoxById(id){ return id ? ((S.data.reservas&&S.data.reservas.boxes)||[]).find(r=>r.id===id) || null : null; }
function logEstorno(entry){
  if(!Array.isArray(S.data.estornos)) S.data.estornos=[];
  S.data.estornos.push(Object.assign({id:uid(), data:todayISO(), createdAt:Date.now()}, entry));
}
/* Idempotência: sempre busca a ocorrência existente antes de criar uma nova — nunca há
   duas ocorrências para o mesmo (fixaId, mesKey), então marcar como paga duas vezes (ex.:
   duplo clique) nunca desconta duas vezes. */
function payFixaOcorrencia(f, mesKey, options={}){
  if(!f) return;
  const persist=options.persist!==false, notify=options.notify!==false;
  const jaExiste = fixaOcorrenciaFor(f.id, mesKey);
  if(jaExiste && jaExiste.pago){ if(notify)toast('Essa ocorrência já está marcada como paga.'); return true; } // proteção contra duplicidade
  const parts=String(mesKey||monthKey(S.month.y,S.month.m)).split('-').map(Number);
  const valor = fixaValorNoMes(f,parts[0]||S.month.y,(parts[1]||S.month.m+1)-1);
  if((f.origemPagamento||'conta')==='reserva'){
    const box = findReservaBoxById(f.reservaOrigemId);
    if(!box){ if(notify)toast('A reserva vinculada a esta despesa fixa não existe mais. Edite a despesa e escolha outra reserva.'); return false; }
    if(!reservaTemSaldo(box, valor)){ if(notify)showReservaInsuficienteModal(box, valor); return false; }
    const mv = {id:uid(), boxId:box.id, tipo:'Pagamento de despesa fixa', data:todayISO(), valor, banco:box.banco||'', descricao:'Pagamento de despesa fixa — '+(f.nome||'Sem nome')+' — '+brlPlain(valor), despesaFixaId:f.id, fixaOcorrenciaId:null, createdAt:Date.now()};
    Reservas.applyMoveEffect(mv);
    S.data.reservas.moves.push(mv);
    const rec = jaExiste || {id:uid(), fixaId:f.id, mesKey};
    Object.assign(rec, {pago:true, origemPagamento:'reserva', reservaId:box.id, reservaMoveId:mv.id, valorPago:valor, banco:box.banco||'', pagoEm:Date.now()});
    mv.fixaOcorrenciaId = rec.id;
    if(!jaExiste) S.data.fixaPagamentos.push(rec);
    if(persist){saveCurrentData();renderView();}
    if(notify)toast('Despesa fixa paga com a reserva "'+box.nome+'".');
    return true;
  } else {
    const rec = jaExiste || {id:uid(), fixaId:f.id, mesKey};
    Object.assign(rec,{pago:true,origemPagamento:'conta',reservaId:null,reservaMoveId:null,valorPago:valor,accountId:f.accountId||resolveAccountId(f.banco),banco:accountNameSnapshot(f.accountId||resolveAccountId(f.banco),f.banco),pagoEm:Date.now()});
    if(!jaExiste) S.data.fixaPagamentos.push(rec);
    adjustLiquidez(rec.accountId||resolveAccountId(rec.banco,{includeArchived:true}),-valor); // V6.22 — desconta da conta usada para pagar
    if(persist){saveCurrentData();renderView();}
    if(notify)toast('Despesa fixa marcada como paga.');
    return true;
  }
}
function undoFixaOcorrencia(f, mesKey, options={}){
  if(!f) return;
  const persist=options.persist!==false, notify=options.notify!==false;
  const rec = fixaOcorrenciaFor(f.id, mesKey);
  if(!rec || !rec.pago) return true; // nada para desfazer — já pendente (idempotente)
  if(rec.origemPagamento==='reserva' && rec.reservaMoveId){
    const box = findReservaBoxById(rec.reservaId);
    const mv = (S.data.reservas.moves||[]).find(m=>m.id===rec.reservaMoveId);
    if(box && mv){
      Reservas.reverseMoveEffect(mv);
      logEstorno({tipo:'fixa', refId:f.id, nome:f.nome, valor:rec.valorPago, reservaId:box.id, reservaNome:box.nome, banco:box.banco, descricao:'Estorno — devolução de "'+f.nome+'" para a reserva '+box.nome});
    }
    S.data.reservas.moves = (S.data.reservas.moves||[]).filter(m=>m.id!==rec.reservaMoveId);
  } else if(rec.origemPagamento==='conta'){
    adjustLiquidez(rec.accountId||resolveAccountId(rec.banco,{includeArchived:true}),Number(rec.valorPago)||0); // V6.22 — devolve o valor à conta
  }
  S.data.fixaPagamentos = S.data.fixaPagamentos.filter(r=>r.id!==rec.id);
  if(persist){saveCurrentData();renderView();}
  if(notify)toast('Despesa fixa voltou a pendente'+(rec.origemPagamento==='reserva'?' — valor devolvido à reserva.':'.'));
  return true;
}
/* Ao excluir uma despesa fixa "a partir deste mês" (ou por completo), devolve à reserva
   qualquer ocorrência já paga por reserva a partir do mês afetado (fromMesKey==null =
   despesa inteira, todas as ocorrências) ANTES de remover o cadastro. */
function refundAndCleanFixaOcorrencias(fixaId, fromMesKey){
  const recs = (S.data.fixaPagamentos||[]).filter(r=>r.fixaId===fixaId && (fromMesKey==null || r.mesKey>=fromMesKey));
  recs.forEach(rec=>{
    if(rec.pago && rec.origemPagamento==='reserva' && rec.reservaMoveId){
      const box = findReservaBoxById(rec.reservaId);
      const mv = (S.data.reservas.moves||[]).find(m=>m.id===rec.reservaMoveId);
      if(box && mv) Reservas.reverseMoveEffect(mv);
      S.data.reservas.moves = (S.data.reservas.moves||[]).filter(m=>m.id!==rec.reservaMoveId);
    } else if(rec.pago && rec.origemPagamento==='conta'){
      adjustLiquidez(rec.accountId||resolveAccountId(rec.banco,{includeArchived:true}),Number(rec.valorPago)||0); // V6.22 — devolve o valor à conta
    }
  });
  const removeIds = new Set(recs.map(r=>r.id));
  S.data.fixaPagamentos = (S.data.fixaPagamentos||[]).filter(r=>!removeIds.has(r.id));
}
/* ---------------- V6.1 — editar despesa fixa já paga (valor e/ou origem) ----------------
   Padrão "validar antes de mutar qualquer coisa": se a nova reserva não tiver saldo
   suficiente, retorna {ok:false} SEM alterar nada — quem chamar deve abortar o salvamento
   inteiro (openFixaModal) antes de tocar em S.data.fixas. Se ok, retorna {ok:true, commit}
   e quem chamar decide quando aplicar (depois de já ter decidido o id da fixa do mês). */
function prepareFixaOcorrenciaEdit(oldFixaId, mesKeyAtual, novoValor, novoOrigem, novaReservaId, novoNomeParaDescricao){
  const rec = fixaOcorrenciaFor(oldFixaId, mesKeyAtual);
  if(!rec || !rec.pago) return {ok:true, noop:true, rec:null};
  const oldOrigem = rec.origemPagamento, oldReservaId = rec.reservaId, oldValor = Number(rec.valorPago)||0;
  const oldMv = rec.reservaMoveId ? (S.data.reservas.moves||[]).find(m=>m.id===rec.reservaMoveId) : null;
  if(novoOrigem==='conta'){
    return {ok:true, rec, commit(newFixaId, novoAccountRef){
      const accountIdFinal = resolveAccountId(novoAccountRef)||rec.accountId||resolveAccountId(rec.banco,{includeArchived:true});
      const bancoFinal = accountNameSnapshot(accountIdFinal, rec.banco);
      if(oldOrigem==='reserva' && oldMv){
        Reservas.reverseMoveEffect(oldMv);
        S.data.reservas.moves = (S.data.reservas.moves||[]).filter(m=>m.id!==oldMv.id);
      } else if(oldOrigem==='conta'){
        adjustLiquidez(rec.accountId||resolveAccountId(rec.banco,{includeArchived:true}), oldValor); // devolve à conta histórica pelo ID
      }
      adjustLiquidez(accountIdFinal, -novoValor); // desconta da conta selecionada pelo ID
      Object.assign(rec, {fixaId:newFixaId, origemPagamento:'conta', reservaId:null, reservaMoveId:null, valorPago:novoValor, accountId:accountIdFinal, banco:bancoFinal});
    }};
  }
  // novoOrigem === 'reserva'
  const targetBox = findReservaBoxById(novaReservaId);
  if(!targetBox) return {ok:false, reason:'reserva_invalida'};
  if(oldOrigem==='reserva' && oldReservaId===novaReservaId && oldMv){
    const diff = Math.round((novoValor-oldValor)*100)/100;
    if(diff===0) return {ok:true, rec, commit(newFixaId){ rec.fixaId=newFixaId; }};
    Reservas.reverseMoveEffect(oldMv);
    if(!reservaTemSaldo(targetBox, novoValor)){
      Reservas.applyMoveEffect(oldMv); // desfaz o reverse acima — preserva o estado anterior
      return {ok:false, reason:'saldo_insuficiente', box:targetBox, necessario:diff, disponivel:Number(targetBox.valorAtual)||0};
    }
    return {ok:true, rec, commit(newFixaId){
      oldMv.valor = novoValor;
      oldMv.descricao = 'Pagamento de despesa fixa — '+(novoNomeParaDescricao||'')+' — '+brlPlain(novoValor);
      Reservas.applyMoveEffect(oldMv);
      Object.assign(rec, {fixaId:newFixaId, valorPago:novoValor});
    }};
  }
  // trocou de reserva (ou estava na conta e passou a ser reserva)
  if(!reservaTemSaldo(targetBox, novoValor)) return {ok:false, reason:'saldo_insuficiente', box:targetBox, necessario:novoValor, disponivel:Number(targetBox.valorAtual)||0};
  return {ok:true, rec, commit(newFixaId){
    if(oldOrigem==='reserva' && oldMv){
      Reservas.reverseMoveEffect(oldMv);
      S.data.reservas.moves = (S.data.reservas.moves||[]).filter(m=>m.id!==oldMv.id);
    } else if(oldOrigem==='conta'){
      adjustLiquidez(rec.accountId||resolveAccountId(rec.banco,{includeArchived:true}), oldValor); // devolve à conta histórica pelo ID
    }
    const mv = {id:uid(), boxId:targetBox.id, tipo:'Pagamento de despesa fixa', data:todayISO(), valor:novoValor, banco:targetBox.banco||'', descricao:'Pagamento de despesa fixa — '+(novoNomeParaDescricao||'')+' — '+brlPlain(novoValor), despesaFixaId:newFixaId, fixaOcorrenciaId:rec.id, createdAt:Date.now()};
    Reservas.applyMoveEffect(mv);
    S.data.reservas.moves.push(mv);
    Object.assign(rec, {fixaId:newFixaId, origemPagamento:'reserva', reservaId:targetBox.id, reservaMoveId:mv.id, valorPago:novoValor});
  }};
}

/* V7.9.3 — vínculo bidirecional Cartões ↔ Despesas. */
function linkedCardPurchaseForExpense(expense){
  if(!expense||!expense.viaParcelaId)return null;
  for(const card of (S.data.cartoes||[])){
    const purchase=(card.parcelas||[]).find(p=>p&&p.id===expense.viaParcelaId);
    if(purchase)return {card,purchase};
  }
  return null;
}
function syncLinkedCardPurchaseFromExpense(expense,values,visible){
  const linked=linkedCardPurchaseForExpense(expense);if(!linked)return false;
  const {card,purchase}=linked;
  purchase.apareceDespesas=visible!==false;
  /* V7.9.5 — a caixa marcada aqui em Despesas é a mesma da aba Cartões. Se a compra veio
     de uma assinatura, a escolha precisa ficar gravada na assinatura também, senão a
     próxima reconciliação (que roda a cada troca de aba) desfazia tudo. */
  if(typeof assinaturaRegistrarPreferenciaDespesas==='function')assinaturaRegistrarPreferenciaDespesas(purchase,purchase.apareceDespesas);
  if(!purchase.apareceDespesas){unlinkParcelaFromDespesa(purchase);return true;}
  const installmentIndex=Math.max(0,(Number(expense.parcelaAtual)||1)-1);
  const selectedMonth=String(values.data||expense.data||'').slice(0,7);
  const startMonth=selectedMonth?shiftYM(selectedMonth,-installmentIndex):(purchase.dataCompra||monthKey(S.month.y,S.month.m));
  const day=Math.max(1,Math.min(31,parseInt(String(values.data||expense.data||'').slice(8,10),10)||purchase.diaEntrada||1));
  Object.assign(purchase,{
    descricao:values.nome||purchase.descricao||'Compra no cartão',
    local:values.localCompra!=null?values.localCompra:(purchase.local||''),
    categoria:values.categoria||purchase.categoria||'Outro',
    valorParcela:Number(values.valor)||Number(purchase.valorParcela)||0,
    dataCompra:startMonth,
    dataCompraCompleta:startMonth+'-'+pad2(day),
    diaEntrada:day,
    despesaTipo:values.despesaTipo==='fixa'?'fixa':'variavel'
  });
  linkParcelaToDespesa(card,purchase);
  return true;
}
function variavelStatus(tx){ return tx && tx.statusPagamento==='Em aberto' ? 'Em aberto' : 'Pago'; }
function setVariavelStatus(tx, novoStatus){
  if(!tx || tx.tipo!=='variavel') return false;
  const atual=variavelStatus(tx);
  const alvo=novoStatus==='Em aberto'?'Em aberto':'Pago';
  if(atual===alvo) return true;
  if(alvo==='Pago'){
    if(tx.origemPagamento==='reserva'){
      const box=findReservaBoxById(tx.reservaOrigemId);
      if(!box){ toast('A reserva vinculada não existe mais. Edite o lançamento e escolha outra reserva.'); return false; }
      if(!reservaTemSaldo(box,tx.valor)){ showReservaInsuficienteModal(box,tx.valor); return false; }
      tx.statusPagamento='Pago';
      createLinkedReservaWithdrawalFromDespesa(tx,box,tx.valor);
    }else{
      tx.statusPagamento='Pago';
      if(!applyTxSaldoEffect(tx)){ tx.statusPagamento=atual; toast('Não foi possível descontar o valor da conta vinculada.'); return false; }
    }
  }else{
    if(tx.origemPagamento==='reserva') removeLinkedReservaWithdrawalFromDespesa(tx);
    else reverseTxSaldoEffect(tx);
    tx.statusPagamento='Em aberto';
  }
  return true;
}

function openTransactionModal({type, existing}){
  const isEdit=!!existing;
  const isReceita=type==='receita';
  const isDespesaVariavel=type==='variavel';
  const linkedCardExpense=isDespesaVariavel&&isEdit?linkedCardPurchaseForExpense(existing):null;
  const integrationIncomplete=!!(isDespesaVariavel&&isEdit&&existing.integrationNeedsCompletion===true);
  const allowIntegratedFixed=!!(integrationIncomplete&&window.BorionInterop&&BorionInterop.canTransitionExpense(existing));
  const reservaBoxes=reservaBoxesForLancamento();
  const carteira=getCarteiraConta();
  const linkedBox=isReceita&&isEdit&&existing.reservaBoxId?reservaBoxes.find(r=>r.id===existing.reservaBoxId):null;
  const initialDestino=isReceita&&isEdit
    ? (existing.reservaMoveId?((Number(existing.reservaValor)||0)<(Number(existing.valor)||0)?'dividir':'reserva'):(existing.accountId===CARTEIRA_CONTA_ID?'carteira':'conta'))
    : 'conta';
  const reservaOptions=reservaBoxes.map(r=>`<option value="${esc(r.id)}" ${((isEdit&&existing.reservaOrigemId===r.id)||(linkedBox&&linkedBox.id===r.id))?'selected':''}>${esc(reservaBoxLabel(r))}</option>`).join('');
  const initialPaymentSource=isDespesaVariavel&&isEdit
    ? (existing.origemPagamento==='reserva'?'reserva':(existing.formaPagamento==='Crédito'?'credito':(existing.formaPagamento==='Dinheiro'?'carteira':'conta')))
    : 'conta';
  const initialStatus=isDespesaVariavel&&isEdit?variavelStatus(existing):'Pago';
  const initialContaForma=isDespesaVariavel&&isEdit&&existing.formaPagamento==='Débito'?'Débito':'Pix';
  const accounts=accountSelectOptions({excludeCarteira:true});
  const cards=cardSelectOptions();
  const selectedAccount=integrationIncomplete?'':(isEdit?(existing.accountId||resolveAccountId(existing.banco,{includeArchived:true})):((accounts[0]||{}).value||''));
  const receitaSelectedAccount=(selectedAccount&&selectedAccount!==CARTEIRA_CONTA_ID)?selectedAccount:((accounts[0]||{}).value||'');
  const receitaOrigemInicial=isReceita&&isEdit?(existing.origem||'propria'):'propria';
  const importedNotice=isEdit&&existing.integrationAggregateId?(integrationIncomplete
    ?`<div class="info-box interop-native-notice"><b>Despesa importada de ${esc(window.BorionInterop?BorionInterop.sourceName(existing.integrationSourceAppId):'aplicativo externo')}.</b> Ela entrou como variável genérica, em aberto e sem conta. Complete os dados abaixo; nenhum saldo foi movimentado ainda.</div>`
    :`<div class="info-box interop-native-notice"><b>Importado de ${esc(window.BorionInterop?BorionInterop.sourceName(existing.integrationSourceAppId):'aplicativo externo')}.</b> Este lançamento agora é nativo do Borion: você pode editar normalmente e as alterações não voltam para o aplicativo de origem.</div>`):'';
  const importedExpenseTypeHTML=allowIntegratedFixed?`<div class="field"><label>Tipo da despesa integrada</label><div class="segmented-toggle" id="tm_integrated_type_group"><button type="button" class="seg-btn active" data-value="variavel">Despesa variável</button><button type="button" class="seg-btn" data-value="fixa">Despesa fixa</button></div><input type="hidden" id="tm_integrated_type" value="variavel"/><p class="modal-sub" style="margin:4px 0 0;">Ao escolher fixa, o lançamento será movido para a aba Despesa fixa quando você salvar.</p></div>`:'';

  const linkedCardVisibilityHTML=linkedCardExpense?`<div class="field linked-card-expense-control"><label class="refund-check"><input type="checkbox" id="tm_linked_visible" ${linkedCardExpense.purchase.apareceDespesas!==false?'checked':''}><span>Aparecer também em Despesas</span></label><p class="modal-sub" style="margin:4px 0 0;">Este lançamento vem do cartão <b>${esc(linkedCardExpense.card.banco||'Cartão')}</b>. Alterações feitas aqui também atualizam a compra na aba Cartões.</p></div>`:'';
  const variablePaymentHTML=isDespesaVariavel?`
    <div class="field"><label>De onde será pago</label>
      <div class="segmented-toggle payment-source-toggle" id="tm_pagamento_origem_group">
        <button type="button" class="seg-btn ${initialPaymentSource==='carteira'?'active':''}" data-value="carteira">Carteira</button>
        <button type="button" class="seg-btn ${initialPaymentSource==='conta'?'active':''}" data-value="conta">Conta</button>
        ${reservasEnabled()?`<button type="button" class="seg-btn ${initialPaymentSource==='reserva'?'active':''}" data-value="reserva" ${reservaBoxes.length?'':'disabled title="Crie uma reserva primeiro"'}>Reserva</button>`:''}
        <button type="button" class="seg-btn ${initialPaymentSource==='credito'?'active':''}" data-value="credito">Crédito</button>
      </div>
      <input type="hidden" id="tm_pagamento_origem" value="${initialPaymentSource}"/>
    </div>
    <div id="tm_carteira_fields" class="payment-source-panel ${initialPaymentSource==='carteira'?'':'hidden'}">
      <div class="info-box">Pagamento em <b>Dinheiro</b>, saindo automaticamente da <b>Carteira</b>${carteira?' ('+esc(carteira.nome)+')':''}.</div>
    </div>
    <div id="tm_conta_fields" class="payment-source-panel ${initialPaymentSource==='conta'?'':'hidden'}">
      <div class="field"><label>Forma de pagamento</label><div class="segmented-toggle" id="tm_conta_forma_group">
        <button type="button" class="seg-btn ${initialContaForma==='Pix'?'active':''}" data-value="Pix">Pix</button>
        <button type="button" class="seg-btn ${initialContaForma==='Débito'?'active':''}" data-value="Débito">Débito</button>
      </div><input type="hidden" id="tm_conta_forma" value="${initialContaForma}"/></div>
      <div class="field"><label>De onde sai o dinheiro</label><select id="tm_banco">${integrationIncomplete?'<option value="" selected disabled>Escolha a conta</option>':''}${accounts.length?accounts.map(o=>`<option value="${esc(o.value)}" ${o.value===selectedAccount?'selected':''}>${esc(o.label)}</option>`).join(''):'<option value="">Cadastre uma conta bancária</option>'}</select></div>
    </div>
    ${reservasEnabled()?`<div id="tm_reserva_pg_wrap" class="payment-source-panel reserve-destination-box ${initialPaymentSource==='reserva'?'':'hidden'}">
      <div class="field"><label>Reserva que pagará</label><select id="tm_reserva_pg_box">${reservaOptions||'<option value="">Nenhuma reserva disponível</option>'}</select></div>
      <p class="modal-sub reserve-hint">Quando estiver como Pago, o valor sai diretamente desta reserva. Em aberto não altera o saldo.</p>
    </div>`:''}
    <div id="tm_credito_fields" class="payment-source-panel ${initialPaymentSource==='credito'?'':'hidden'}">
      <div class="field"><label>Cartão de crédito</label><select id="tm_cartao">${cards.length?cards.map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join(''):'<option value="">Nenhum cartão cadastrado</option>'}</select></div>
      <div class="field"><label>Tipo de compra</label><select id="tm_credito_tipo"><option value="avista">Crédito à vista</option><option value="parcelado">Crédito parcelado</option></select></div>
      <div class="field hidden" id="tm_parcelas_wrap"><label>Quantidade de parcelas <span id="tm_parcela_preview" style="color:var(--muted);font-weight:600;"></span></label><input type="number" id="tm_parcelas" min="2" step="1" value="2"/></div>
      <p class="modal-sub" style="margin:4px 0 0;">O dia da data da compra será usado como dia de entrada na fatura.</p>
      ${window.SharedPurchases?SharedPurchases.formHTML('tm',null):''}
    </div>
    <div class="field"><label>Status do lançamento</label><div class="segmented-toggle" id="tm_status_group">
      <button type="button" class="seg-btn ${initialStatus==='Pago'?'active':''}" data-value="Pago">Pago</button>
      <button type="button" class="seg-btn ${initialStatus==='Em aberto'?'active':''}" data-value="Em aberto">Em aberto</button>
    </div><input type="hidden" id="tm_status" value="${initialStatus}"/>
    <p class="modal-sub" style="margin:4px 0 0;">Em aberto registra a despesa sem retirar dinheiro da conta ou da reserva.</p></div>`:'';

  const receitaFieldsHTML=isReceita?`
    <div class="field"><label>Origem da receita</label>
      <div class="segmented-toggle payment-source-toggle revenue-origin-toggle" id="tm_origem_group">
        <button type="button" class="seg-btn ${receitaOrigemInicial==='propria'?'active':''}" data-value="propria">Receita própria</button>
        <button type="button" class="seg-btn ${receitaOrigemInicial==='rendimento'?'active':''}" data-value="rendimento">Rendimento</button>
        <button type="button" class="seg-btn ${receitaOrigemInicial==='reembolso'?'active':''}" data-value="reembolso">Reembolso recebido</button>
        <button type="button" class="seg-btn ${receitaOrigemInicial==='repasse'?'active':''}" data-value="repasse">Repasse de terceiros</button>
      </div><input type="hidden" id="tm_origem" value="${receitaOrigemInicial}"/>
      <p class="modal-sub" style="margin:4px 0 0;">Receita própria e rendimento contam como renda. Reembolso e repasse de terceiros não entram na Receita do mês.</p>
    </div>
    <div class="field"><label>Onde a receita entra</label>
      <div class="segmented-toggle payment-source-toggle revenue-destination-toggle" id="tm_receita_destino_group">
        <button type="button" class="seg-btn ${initialDestino==='carteira'?'active':''}" data-value="carteira">Carteira</button>
        <button type="button" class="seg-btn ${initialDestino==='conta'?'active':''}" data-value="conta">Conta</button>
        ${reservasEnabled()?`<button type="button" class="seg-btn ${initialDestino==='reserva'?'active':''}" data-value="reserva" ${reservaBoxes.length?'':'disabled title="Crie uma reserva primeiro"'}>Reserva</button>`:''}
        ${reservasEnabled()?`<button type="button" class="seg-btn ${initialDestino==='dividir'?'active':''}" data-value="dividir" ${reservaBoxes.length?'':'disabled title="Crie uma reserva primeiro"'}>Conta + Reserva</button>`:''}
      </div><input type="hidden" id="tm_receita_destino" value="${initialDestino}"/>
    </div>
    <div id="tm_receita_carteira_fields" class="payment-source-panel ${initialDestino==='carteira'?'':'hidden'}"><div class="info-box">A receita entra automaticamente na <b>Carteira</b>, como dinheiro em espécie.</div></div>
    <div id="tm_receita_conta_fields" class="payment-source-panel ${initialDestino==='conta'?'':'hidden'}"><div class="field"><label>Conta que receberá</label><select id="tm_receita_conta">${accounts.length?accounts.map(o=>`<option value="${esc(o.value)}" ${o.value===receitaSelectedAccount?'selected':''}>${esc(o.label)}</option>`).join(''):'<option value="">Cadastre uma conta bancária</option>'}</select></div></div>
    ${reservasEnabled()?`<div id="tm_receita_reserva_fields" class="payment-source-panel reserve-destination-box ${initialDestino==='reserva'?'':'hidden'}"><div class="field"><label>Reserva que receberá</label><select id="tm_receita_reserva_box">${reservaOptions||'<option value="">Nenhuma reserva disponível</option>'}</select></div><p class="modal-sub reserve-hint">O vínculo com a conta da reserva é aplicado automaticamente.</p></div>`:''}
    ${reservasEnabled()?`<div id="tm_receita_dividir_fields" class="payment-source-panel reserve-destination-box ${initialDestino==='dividir'?'':'hidden'}">
      <div class="field"><label>Conta que receberá</label><select id="tm_receita_dividir_conta">${accounts.length?accounts.map(o=>`<option value="${esc(o.value)}" ${o.value===receitaSelectedAccount?'selected':''}>${esc(o.label)}</option>`).join(''):'<option value="">Cadastre uma conta bancária</option>'}</select></div>
      <div class="field"><label>Reserva que receberá</label><select id="tm_receita_dividir_reserva">${reservaOptions||'<option value="">Nenhuma reserva disponível</option>'}</select></div>
      <div class="field"><label>Quanto vai para a conta (R$)</label><input type="text" inputmode="numeric" id="tm_conta_valor" class="money-input" placeholder="0,00"/></div>
      <div class="field"><label>Quanto vai para a reserva (R$)</label><input type="text" inputmode="numeric" id="tm_reserva_valor" class="money-input" placeholder="0,00"/></div>
      <p class="modal-sub reserve-hint">Os dois valores precisam somar exatamente o valor total da receita.</p>
    </div>`:''}`:'';

  const modalTitle=isEdit
    ? (isReceita?'Editar receita':(isDespesaVariavel?'Editar despesa variável':'Editar lançamento'))
    : (isReceita?'Adicionar receita':(isDespesaVariavel?'Adicionar despesa variável':'Adicionar lançamento'));
  const fieldsHTML=isReceita?`
    <div class="field"><label>Nome</label><input type="text" id="tm_nome" value="${isEdit?esc(existing.nome):''}"/></div>
    ${categorySelectHTML('tm',type,isEdit?existing.categoria:null)}
    <div class="field"><label id="tm_valor_label">Valor (R$)</label><input type="text" inputmode="numeric" id="tm_valor" class="money-input" placeholder="0,00"/></div>
    <div class="field"><label>Data</label><input type="date" id="tm_data" value="${isEdit?esc(existing.data||''):todayISO()}"/></div>
    ${receitaFieldsHTML}`:`
    <div class="field"><label>Nome</label><input type="text" id="tm_nome" value="${isEdit?esc(existing.nome):''}"/></div>
    ${isDespesaVariavel?`<div class="field"><label>Local da compra</label><input type="text" id="tm_local" value="${isEdit?esc(existing.localCompra||existing.local||''):''}" placeholder="Ex: Mercado, farmácia, loja..."/></div>`:''}
    <div class="field"><label>Data</label><input type="date" id="tm_data" value="${isEdit?esc(existing.data||''):todayISO()}"/></div>
    ${categorySelectHTML('tm',type,isEdit?existing.categoria:null)}
    <div class="field"><label id="tm_valor_label">Valor (R$)</label><input type="text" inputmode="numeric" id="tm_valor" class="money-input" placeholder="0,00"/></div>
    ${linkedCardVisibilityHTML}
    ${variablePaymentHTML}`;

  const box=el(`<div class="modal-overlay transaction-modal-overlay"><div class="modal-box transaction-modal">
    <div class="modal-head"><h2>${modalTitle}</h2><button id="tm_close">&times;</button></div>
    ${importedNotice}
    ${importedExpenseTypeHTML}
    ${fieldsHTML}
    <div class="row-btns"><button class="btn btn-primary btn-block" id="tm_save">${isEdit?'Salvar':'Adicionar'}</button></div>
    ${isEdit?'<div class="row-btns" style="margin-top:8px;"><button class="btn btn-danger btn-block" id="tm_delete">Excluir</button></div>':''}
  </div></div>`);
  $('#modal-root').innerHTML='';$('#modal-root').appendChild(box);attachModalGuard(box);$('#tm_close').onclick=closeModal;
  attachMoneyMask($('#tm_valor'),isEdit?existing.valor:0);
  if(isReceita&&$('#tm_conta_valor')) attachMoneyMask($('#tm_conta_valor'),isEdit?Math.max(0,(Number(existing.valor)||0)-(Number(existing.reservaValor)||0)):0);
  if(isReceita&&$('#tm_reserva_valor')) attachMoneyMask($('#tm_reserva_valor'),isEdit?(existing.reservaValor||0):0);
  wireQuickCategory($('#tm_categoria'),$('#tm_newcat_box'),$('#tm_newcat_input'),$('#tm_newcat_add'),type);

  function wireSegmented(groupId,inputId,onChange){
    const group=$(groupId), hidden=$(inputId); if(!group||!hidden)return;
    group.querySelectorAll('.seg-btn:not([disabled])').forEach(btn=>btn.onclick=()=>{group.querySelectorAll('.seg-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');hidden.value=btn.dataset.value;if(onChange)onChange(hidden.value);});
  }
  function syncPaymentSourceUI(source){
    ['carteira','conta','reserva','credito'].forEach(k=>{const node=$('#tm_'+(k==='reserva'?'reserva_pg_wrap':k+'_fields'));if(node)node.classList.toggle('hidden',source!==k);});
    const label=$('#tm_valor_label');if(label)label.textContent=source==='credito'?'Valor total da compra (R$)':'Valor (R$)';
    updateCreditoParcelPreview();
  }
  function syncRevenueDestinationUI(source){
    ['carteira','conta','reserva','dividir'].forEach(k=>{const node=$('#tm_receita_'+k+'_fields');if(node)node.classList.toggle('hidden',source!==k);});
    if(source==='dividir') syncRevenueSplitFromTotal();
  }
  function syncRevenueSplitFromTotal(){
    if(!isReceita||!$('#tm_conta_valor')||!$('#tm_reserva_valor'))return;
    const total=parseInt(($('#tm_valor')&&$('#tm_valor').dataset.cents)||'0',10);
    const conta=parseInt($('#tm_conta_valor').dataset.cents||'0',10),reserva=parseInt($('#tm_reserva_valor').dataset.cents||'0',10);
    if(conta+reserva===0&&total>0){$('#tm_conta_valor').dataset.cents=String(total);$('#tm_conta_valor').value=(total/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
  }
  wireSegmented('#tm_integrated_type_group','#tm_integrated_type');
  wireSegmented('#tm_pagamento_origem_group','#tm_pagamento_origem',syncPaymentSourceUI);
  wireSegmented('#tm_conta_forma_group','#tm_conta_forma');
  wireSegmented('#tm_status_group','#tm_status');
  wireSegmented('#tm_origem_group','#tm_origem');
  wireSegmented('#tm_receita_destino_group','#tm_receita_destino',syncRevenueDestinationUI);
  function updateCreditoParcelPreview(){
    const tipo=$('#tm_credito_tipo'),wrap=$('#tm_parcelas_wrap'),preview=$('#tm_parcela_preview');
    if(!tipo)return;if(wrap)wrap.classList.toggle('hidden',tipo.value!=='parcelado');
    if(!preview||tipo.value!=='parcelado'){if(preview)preview.textContent='';return;}
    const total=parseInt(($('#tm_valor')&&$('#tm_valor').dataset.cents)||'0',10)/100,qtd=Math.max(2,Math.round(Number(($('#tm_parcelas')&&$('#tm_parcelas').value)||2)));
    preview.textContent=`(${brlPlain(Math.round((total/qtd)*100)/100)} cada)`;
  }
  if($('#tm_credito_tipo'))$('#tm_credito_tipo').onchange=updateCreditoParcelPreview;
  if($('#tm_parcelas'))$('#tm_parcelas').oninput=updateCreditoParcelPreview;
  if($('#tm_valor'))$('#tm_valor').addEventListener('input',()=>{updateCreditoParcelPreview();syncRevenueSplitFromTotal();});
  if(isDespesaVariavel&&window.SharedPurchases)SharedPurchases.bindForm({prefix:'tm',existing:null,totalResolver:()=>parseInt(($('#tm_valor')&&$('#tm_valor').dataset.cents)||'0',10)/100,installmentsResolver:()=>($('#tm_credito_tipo')&&$('#tm_credito_tipo').value==='parcelado')?Math.max(2,Math.round(Number(($('#tm_parcelas')&&$('#tm_parcelas').value)||2))):1});
  if(isDespesaVariavel)syncPaymentSourceUI(initialPaymentSource);
  if(isReceita)syncRevenueDestinationUI(initialDestino);

  /* Em uma despesa vinculada ao cartão, desmarcar é efetivado imediatamente.
     O lançamento desaparece agora e a confirmação remota segue na fila; não é
     preciso apertar Salvar nem esperar o Google Drive para a outra aba refletir. */
  const instantLinkedVisibility=$('#tm_linked_visible');
  if(linkedCardExpense&&instantLinkedVisibility)instantLinkedVisibility.addEventListener('change',()=>{
    if(instantLinkedVisibility.checked)return;
    const ok=runAtomicFinancialMutation(
      ()=>syncLinkedCardPurchaseFromExpense(existing,{},false),
      ()=>alert('Não foi possível remover esta compra de Despesas. O estado anterior foi preservado.')
    );
    if(!ok){instantLinkedVisibility.checked=true;return;}
    saveCurrentData({source:'expense_card_visibility'});
    closeModal();renderView();
    toast('Removido de Despesas agora; a compra continua no cartão e está salvando no Drive.');
  });

  $('#tm_save').onclick=()=>{
    const nome=$('#tm_nome').value.trim()||'Sem nome',data=$('#tm_data').value||(isEdit?(existing.data||''):todayISO()),categoria=$('#tm_categoria').value;
    if(categoria==='__new__'){alert('Confirme o nome da nova categoria antes de salvar.');return;}
    const valor=parseInt($('#tm_valor').dataset.cents||'0',10)/100;if(valor<=0){alert('Digite um valor maior que zero.');return;}
    const commitAtomic=fn=>runAtomicFinancialMutation(fn,()=>alert('Não foi possível salvar. O lançamento e o saldo anteriores foram preservados.'));

    if(isDespesaVariavel){
      const source=$('#tm_pagamento_origem').value,status=$('#tm_status').value==='Em aberto'?'Em aberto':'Pago',localCompra=($('#tm_local').value||'').trim();
      if(linkedCardExpense){
        const visible=$('#tm_linked_visible')?$('#tm_linked_visible').checked:true;
        const ok=commitAtomic(()=>syncLinkedCardPurchaseFromExpense(existing,{nome,data,categoria,valor,localCompra,despesaTipo:'variavel'},visible));
        if(!ok)return;
        saveCurrentData();closeModal();renderView();toast(visible?'Compra e despesa atualizadas juntas.':'Compra mantida no cartão e removida de Despesas.');return;
      }
      const desiredType=allowIntegratedFixed&&$('#tm_integrated_type')?.value==='fixa'?'fixa':'variavel';
      if(source==='credito'){
        const importedSource=isEdit&&window.BorionInterop?BorionInterop.captureImportReference(existing):null;
        const cartao=(S.data.cartoes||[]).find(c=>c.id===$('#tm_cartao').value);if(!cartao){alert('Escolha um cartão de crédito válido.');return;}
        const parcelaTotal=$('#tm_credito_tipo').value==='parcelado'?Math.max(2,Math.round(Number($('#tm_parcelas').value)||2)):1;
        const sharedResult=window.SharedPurchases?SharedPurchases.readForm({prefix:'tm',totalValue:valor,installmentCount:parcelaTotal,existing:null}):{ok:true,model:null};
        if(!sharedResult.ok){alert(sharedResult.error);return;}
        const valorParcela=Math.round((valor/parcelaTotal)*100)/100,diaCompra=Math.max(1,Math.min(31,parseInt(data.slice(8,10),10)||1));
        if(!commitAtomic(()=>{
          if(isEdit){reverseTxSaldoEffect(existing);removeLinkedReservaMoveFromTransaction(existing);removeLinkedReservaWithdrawalFromDespesa(existing);S.data.transacoes=S.data.transacoes.filter(x=>x.id!==existing.id);}
          const p={id:uid(),descricao:nome,local:localCompra,categoria:categoria||'Outro',valorParcela,parcelaTotal,dataCompra:data.slice(0,7),dataCompraCompleta:data,diaEntrada:diaCompra,apareceDespesas:sharedResult.model?sharedResult.model.valorProprioTotal>0:true,despesaTipo:desiredType,statusPagamento:status,statusFaturaPorCompetencia:{},despesaTransacaoId:null,despesaTransacaoIds:[],despesaFixaId:null,compartilhamento:sharedResult.model};
          if(importedSource)Object.assign(p,importedSource,{integrationNeedsCompletion:false,integrationCompletionStatus:'completed',integrationCompletedAt:new Date().toISOString(),integrationCompletedAs:desiredType,integrationImportMode:'native-card-from-generic'});
          cartao.parcelas.push(p);linkParcelaToDespesa(cartao,p);
          if(importedSource&&window.BorionInterop){
            if(desiredType==='fixa'){
              const fixed=(S.data.fixas||[]).find(f=>f.id===p.despesaFixaId);if(!fixed)throw new Error('Falha ao criar a despesa fixa vinculada ao cartão.');
              BorionInterop.transferImportReferenceToFixed(existing,fixed,S.data);
            }else BorionInterop.transferImportReference(existing,p.despesaTransacaoIds||[],S.data);
          }
        }))return;
        saveCurrentData();closeModal();if(desiredType==='fixa')S.budgetTab='fixa';renderView();toast(desiredType==='fixa'?'Despesa integrada movida para Despesa fixa e vinculada ao cartão.':'Compra no crédito lançada com loja e dia de entrada na fatura.');return;
      }
      let accountId=null,banco='',formaPagamento=null,reservaBox=null;
      if(source==='carteira'){
        accountId=requireAccountId(CARTEIRA_CONTA_ID,'A Carteira precisa estar disponível.');if(!accountId)return;banco=accountNameSnapshot(accountId);formaPagamento='Dinheiro';
      }else if(source==='conta'){
        accountId=requireAccountId($('#tm_banco').value,'Escolha a conta de onde sai o dinheiro.');if(!accountId)return;banco=accountNameSnapshot(accountId);formaPagamento=$('#tm_conta_forma').value==='Débito'?'Débito':'Pix';
      }else if(source==='reserva'){
        reservaBox=reservaBoxes.find(r=>r.id===$('#tm_reserva_pg_box').value);if(!reservaBox){toast('Escolha uma reserva válida.');return;}banco=reservaBox.banco||'';
        if(status==='Pago'&&!reservaTemSaldo(reservaBox,valor)){showReservaInsuficienteModal(reservaBox,valor);return;}
      }
      if(desiredType==='fixa'){
        let fixed=null;
        const startMonth=data.slice(0,7)||monthKey(S.month.y,S.month.m),dia=Math.max(1,Math.min(31,parseInt(data.slice(8,10),10)||1));
        if(!commitAtomic(()=>{
          if(isEdit){reverseTxSaldoEffect(existing);removeLinkedReservaMoveFromTransaction(existing);removeLinkedReservaWithdrawalFromDespesa(existing);S.data.transacoes=S.data.transacoes.filter(x=>x.id!==existing.id);}
          S.data.fixas=Array.isArray(S.data.fixas)?S.data.fixas:[];
          S.data.categorias=S.data.categorias||defaultCategories();S.data.categorias.fixa=Array.isArray(S.data.categorias.fixa)?S.data.categorias.fixa:[];
          if(!S.data.categorias.fixa.includes(categoria||'Outro'))S.data.categorias.fixa.push(categoria||'Outro');
          S.data.categoryColors=S.data.categoryColors||{receita:{},fixa:{},variavel:{}};S.data.categoryColors.fixa=S.data.categoryColors.fixa||{};
          if(!S.data.categoryColors.fixa[categoria||'Outro'])S.data.categoryColors.fixa[categoria||'Outro']=baseCatColor(categoria||'Outro');
          const createdAt=Date.now();
          fixed={id:uid(),nome,localCompra,categoria:categoria||'Outro',valor,dia,dataCadastro:data,startMonth,endMonth:null,accountId:source==='reserva'?null:accountId,banco,formaPagamento:source==='reserva'?null:formaPagamento,origemPagamento:source==='reserva'?'reserva':'conta',reservaOrigemId:source==='reserva'?reservaBox.id:null,createdAt,updatedAt:createdAt};
          S.data.fixas.push(fixed);
          if(integrationIncomplete&&window.BorionInterop)BorionInterop.transferImportReferenceToFixed(existing,fixed,S.data);
          if(status==='Pago'&&!payFixaOcorrencia(fixed,startMonth,{persist:false,notify:false}))throw new Error('Falha ao aplicar o pagamento da despesa fixa.');
        }))return;
        saveCurrentData();closeModal();S.budgetTab='fixa';renderView();toast(status==='Pago'?'Despesa integrada movida para fixa e marcada como paga.':'Despesa integrada movida para Despesa fixa.');return;
      }
      let tx;
      if(!commitAtomic(()=>{
        if(isEdit){reverseTxSaldoEffect(existing);removeLinkedReservaMoveFromTransaction(existing);removeLinkedReservaWithdrawalFromDespesa(existing);}
        const payload={nome,data,categoria,valor,localCompra,statusPagamento:status,accountId:source==='reserva'?null:accountId,banco,origemPagamento:source==='reserva'?'reserva':'conta',formaPagamento:source==='reserva'?null:formaPagamento,reservaOrigemId:source==='reserva'?reservaBox.id:null,reservaOrigemMoveId:null};
        if(isEdit){Object.assign(existing,payload,{updatedAt:Date.now()});tx=existing;if(integrationIncomplete&&window.BorionInterop)BorionInterop.completeImportedExpense(tx,'variavel',S.data);}else{const addedAt=Date.now();tx=Object.assign({id:uid(),tipo:'variavel',createdAt:addedAt,addedAt,updatedAt:addedAt},payload);S.data.transacoes.push(tx);}
        if(status==='Pago'){
          if(source==='reserva')createLinkedReservaWithdrawalFromDespesa(tx,reservaBox,valor);
          else if(!applyTxSaldoEffect(tx))throw new Error('Conta inválida para aplicar saldo.');
        }
      }))return;
      saveCurrentData();closeModal();renderView();toast(isEdit?'Despesa atualizada.':(status==='Pago'?'Despesa lançada como paga.':'Despesa lançada em aberto.'));return;
    }

    const destino=$('#tm_receita_destino').value;
    let accountId=null,reservaBox=null,reservaValor=0,destinoModo='Conta livre';
    if(destino==='carteira'){
      accountId=requireAccountId(CARTEIRA_CONTA_ID,'A Carteira precisa estar disponível.');if(!accountId)return;
    }else if(destino==='conta'){
      accountId=requireAccountId($('#tm_receita_conta').value,'Escolha a conta que receberá a receita.');if(!accountId)return;
    }else if(destino==='reserva'){
      reservaBox=reservaBoxes.find(r=>r.id===$('#tm_receita_reserva_box').value);if(!reservaBox){alert('Escolha uma reserva válida.');return;}
      accountId=requireAccountId(reservaBox.accountId||resolveAccountId(reservaBox.banco,{includeArchived:false}),'A conta vinculada a esta reserva não está disponível.');if(!accountId)return;
      reservaValor=valor;destinoModo='Direto para reserva';
    }else if(destino==='dividir'){
      accountId=requireAccountId($('#tm_receita_dividir_conta').value,'Escolha a conta que receberá parte da receita.');if(!accountId)return;
      reservaBox=reservaBoxes.find(r=>r.id===$('#tm_receita_dividir_reserva').value);if(!reservaBox){alert('Escolha uma reserva válida.');return;}
      const contaValor=parseInt($('#tm_conta_valor').dataset.cents||'0',10)/100;
      reservaValor=parseInt($('#tm_reserva_valor').dataset.cents||'0',10)/100;
      if(contaValor<=0||reservaValor<=0){alert('Informe um valor maior que zero para a conta e para a reserva.');return;}
      if(Math.round((contaValor+reservaValor)*100)!==Math.round(valor*100)){alert('O valor da conta e o valor da reserva precisam somar exatamente o total da receita.');return;}
      destinoModo='Dividir entre conta e reserva';
    }
    const banco=accountNameSnapshot(accountId),origem=$('#tm_origem').value||'propria';
    if(isEdit&&existing.compartilhamentoId&&origem!=='reembolso'){alert('Este lançamento está vinculado a uma compra compartilhada e precisa continuar como Reembolso recebido. Para removê-lo, use o histórico da compra compartilhada.');return;}
    let tx;if(!commitAtomic(()=>{if(isEdit){reverseTxSaldoEffect(existing);removeLinkedReservaMoveFromTransaction(existing);}const payload={nome,data,categoria,valor,accountId,banco,origem,reservaValor:0,destinoModo:'Conta livre'};if(isEdit){Object.assign(existing,payload,{updatedAt:Date.now()});tx=existing;}else{const addedAt=Date.now();tx=Object.assign({id:uid(),tipo:'receita',createdAt:addedAt,addedAt,updatedAt:addedAt},payload);S.data.transacoes.push(tx);}if(reservaBox){tx.destinoModo=destinoModo;createLinkedReservaMoveFromTransaction(tx,reservaBox,reservaValor);}if(!applyTxSaldoEffect(tx))throw new Error('Conta inválida para aplicar saldo.');}))return;
    saveCurrentData();closeModal();renderView();toast(isEdit?'Receita atualizada.':(reservaBox?'Receita adicionada com destino aplicado.':'Receita adicionada.'));
  };
  if(isEdit)$('#tm_delete').onclick=()=>{
    const performDelete=(integrationMode=null)=>{
      if(linkedCardExpense&&!integrationMode){
        const snapshot=borionCloneForUndo(S.data);linkedCardExpense.purchase.apareceDespesas=false;if(typeof assinaturaRegistrarPreferenciaDespesas==='function')assinaturaRegistrarPreferenciaDespesas(linkedCardExpense.purchase,false);unlinkParcelaFromDespesa(linkedCardExpense.purchase);saveCurrentData();closeModal();renderView();showUndoToast('Removido de Despesas; a compra continua no cartão.',()=>{S.data=snapshot;saveCurrentData();renderView();});return;
      }
      const idx=S.data.transacoes.findIndex(x=>x.id===existing.id);if(idx<0)return;
      const snapshot=borionCloneForUndo(S.data);
      if(integrationMode&&window.BorionInterop){
        BorionInterop.markImportedDeletion(existing,integrationMode,S.data);
        if(!BorionInterop.removeImportedNativeGroup?.(existing,S.data,'user_deleted_in_borion')){
          reverseTxSaldoEffect(existing);removeLinkedReservaMoveFromTransaction(existing);removeLinkedReservaWithdrawalFromDespesa(existing);S.data.transacoes.splice(idx,1);
        }
      }else{
        reverseTxSaldoEffect(existing);removeLinkedReservaMoveFromTransaction(existing);removeLinkedReservaWithdrawalFromDespesa(existing);S.data.transacoes.splice(idx,1);
      }
      saveCurrentData();
      const criticalSync=integrationMode&&window.BorionInterop?BorionInterop.persistCriticalChange?.('interop_imported_delete'):null;
      closeModal();renderView();
      const message=integrationMode?'Lançamento excluído definitivamente e bloqueado contra retorno.':'Lançamento excluído.';
      if(integrationMode){
        toast(message);
        Promise.resolve(criticalSync).then(result=>{
          if(result?.synced)toast('Exclusão confirmada no Google Drive.');
          else if(result?.pending)setTimeout(()=>toast('Exclusão salva neste dispositivo e pendente de confirmação no Drive.'),150);
        }).catch(error=>console.warn('[BORION][IMPORTED_DELETE_SYNC]',error));
      }else showUndoToast(message,()=>{S.data=snapshot;saveCurrentData();renderView();});
    };
    if(existing.integrationAggregateId&&window.BorionInterop){BorionInterop.openImportedDeleteDialog(existing,performDelete);return;}
    performDelete();
  };
}

/* ---- dedicated modal: recurring fixed expense (despesa fixa) ---- */
function openFixaModal(existing){
  const isEdit=!!existing;
  const linkedCardExpense=isEdit?linkedCardPurchaseForExpense(existing):null;
  const monthKeyNow=monthKey(S.month.y,S.month.m);
  const fixedDateInitial=isEdit
    ? (existing.dataCadastro||((existing.startMonth||monthKeyNow)+'-'+pad2(existing.dia||1)))
    : todayISO();
  const carteira=getCarteiraConta();
  const reservaBoxesFixa=reservaBoxesForLancamento();
  const currentRec=isEdit?fixaOcorrenciaFor(existing.id,monthKeyNow):null;
  const initialStatus=currentRec&&currentRec.pago?'Pago':'Em aberto';
  const initialPaymentSource=isEdit
    ? (existing.origemPagamento==='reserva'&&reservasEnabled()?'reserva':(existing.formaPagamento==='Dinheiro'?'carteira':'conta'))
    : (accountSelectOptions({excludeCarteira:true}).length?'conta':'carteira');
  const initialContaForma=isEdit&&existing.formaPagamento==='Débito'?'Débito':'Pix';
  const accounts=accountSelectOptions({excludeCarteira:true});
  const cards=cardSelectOptions();
  const selectedAccount=isEdit?(existing.accountId||resolveAccountId(existing.banco,{includeArchived:true})):((accounts[0]||{}).value||'');
  const reservaOptions=reservaBoxesFixa.map(r=>`<option value="${esc(r.id)}" ${isEdit&&existing.reservaOrigemId===r.id?'selected':''}>${esc(reservaBoxLabel(r))}</option>`).join('');

  const paymentHTML=`
    <div class="field"><label>De onde será pago</label>
      <div class="segmented-toggle payment-source-toggle" id="fm_pagamento_origem_group">
        <button type="button" class="seg-btn ${initialPaymentSource==='carteira'?'active':''}" data-value="carteira">Carteira</button>
        <button type="button" class="seg-btn ${initialPaymentSource==='conta'?'active':''}" data-value="conta">Conta</button>
        ${reservasEnabled()?`<button type="button" class="seg-btn ${initialPaymentSource==='reserva'?'active':''}" data-value="reserva" ${reservaBoxesFixa.length?'':'disabled title="Crie uma reserva primeiro"'}>Reserva</button>`:''}
        <button type="button" class="seg-btn ${initialPaymentSource==='credito'?'active':''}" data-value="credito">Crédito</button>
      </div>
      <input type="hidden" id="fm_pagamento_origem" value="${initialPaymentSource}"/>
    </div>
    <div id="fm_carteira_fields" class="payment-source-panel ${initialPaymentSource==='carteira'?'':'hidden'}">
      <div class="info-box">Pagamento em <b>Dinheiro</b>, saindo automaticamente da <b>Carteira</b>${carteira?' ('+esc(carteira.nome)+')':''}.</div>
    </div>
    <div id="fm_conta_fields" class="payment-source-panel ${initialPaymentSource==='conta'?'':'hidden'}">
      <div class="field"><label>Forma de pagamento</label><div class="segmented-toggle" id="fm_conta_forma_group">
        <button type="button" class="seg-btn ${initialContaForma==='Pix'?'active':''}" data-value="Pix">Pix</button>
        <button type="button" class="seg-btn ${initialContaForma==='Débito'?'active':''}" data-value="Débito">Débito</button>
      </div><input type="hidden" id="fm_conta_forma" value="${initialContaForma}"/></div>
      <div class="field"><label>De onde sai o dinheiro</label><select id="fm_banco">${accounts.length?accounts.map(o=>`<option value="${esc(o.value)}" ${o.value===selectedAccount?'selected':''}>${esc(o.label)}</option>`).join(''):'<option value="">Cadastre uma conta bancária</option>'}</select></div>
    </div>
    ${reservasEnabled()?`<div id="fm_reserva_fields" class="payment-source-panel reserve-destination-box ${initialPaymentSource==='reserva'?'':'hidden'}">
      <div class="field"><label>Reserva que pagará</label><select id="fm_reserva_pg_box">${reservaOptions||'<option value="">Nenhuma reserva disponível</option>'}</select></div>
      <p class="modal-sub reserve-hint">Quando estiver como Pago, o valor sai diretamente desta reserva. Em aberto não altera o saldo.</p>
    </div>`:''}
    <div id="fm_credito_fields" class="payment-source-panel ${initialPaymentSource==='credito'?'':'hidden'}">
      <div class="field"><label>Cartão de crédito</label><select id="fm_cartao">${cards.length?cards.map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join(''):'<option value="">Nenhum cartão cadastrado</option>'}</select></div>
      <div class="field"><label>Tipo de compra</label><select id="fm_credito_tipo"><option value="avista">Crédito à vista</option><option value="parcelado">Crédito parcelado</option></select></div>
      <div class="field hidden" id="fm_parcelas_wrap"><label>Quantidade de parcelas <span id="fm_parcela_preview" style="color:var(--muted);font-weight:600;"></span></label><input type="number" id="fm_parcelas" min="2" step="1" value="2"/></div>
      <p class="modal-sub" style="margin:4px 0 0;">No crédito, o dia do vencimento será usado como dia de entrada na fatura.</p>
      ${window.SharedPurchases?SharedPurchases.formHTML('fm',null):''}
    </div>
    <div class="field"><label>Status deste mês</label><div class="segmented-toggle" id="fm_status_group">
      <button type="button" class="seg-btn ${initialStatus==='Pago'?'active':''}" data-value="Pago">Pago</button>
      <button type="button" class="seg-btn ${initialStatus==='Em aberto'?'active':''}" data-value="Em aberto">Em aberto</button>
    </div><input type="hidden" id="fm_status" value="${initialStatus}"/>
    <p class="modal-sub" style="margin:4px 0 0;">Em aberto cadastra a despesa sem retirar dinheiro. Pago aplica o pagamento somente no mês selecionado.</p></div>`;

  const box=el(`<div class="modal-overlay transaction-modal-overlay"><div class="modal-box transaction-modal fixed-expense-modal">
    <div class="modal-head"><h2>${isEdit?'Editar':'Adicionar'} despesa fixa</h2><button id="fm_close">&times;</button></div>
    <p class="modal-sub">${isEdit?'Alterações se aplicam a partir de '+monthLabel(S.month.y,S.month.m)+'; meses anteriores mantêm o histórico.':'Essa despesa se repete mensalmente a partir da data informada. O status Pago/Em aberto abaixo vale para o primeiro mês.'}</p>
    <div class="field"><label>Nome</label><input type="text" id="fm_nome" value="${isEdit?esc(existing.nome):''}"/></div>
    <div class="field"><label>Local da compra</label><input type="text" id="fm_local" value="${isEdit?esc(existing.localCompra||existing.local||''):''}" placeholder="Ex: Academia, aluguel, operadora..."/></div>
    ${categorySelectHTML('fm','fixa',isEdit?existing.categoria:null)}
    <div class="field"><label id="fm_valor_label">Valor mensal (R$)</label><input type="text" inputmode="numeric" id="fm_valor" class="money-input" placeholder="0,00"/></div>
    <div class="field"><label>Data do primeiro vencimento</label><input type="date" id="fm_data" value="${esc(fixedDateInitial)}"/></div>
    ${linkedCardExpense?`<div class="field linked-card-expense-control"><label class="refund-check"><input type="checkbox" id="fm_linked_visible" ${linkedCardExpense.purchase.apareceDespesas!==false?'checked':''}><span>Aparecer também em Despesas</span></label><p class="modal-sub" style="margin:4px 0 0;">Vinculada ao cartão <b>${esc(linkedCardExpense.card.banco||'Cartão')}</b>. As duas abas serão atualizadas juntas.</p></div>`:''}
    ${paymentHTML}
    <div class="row-btns"><button class="btn btn-primary btn-block" id="fm_save">${isEdit?'Salvar':'Adicionar'}</button></div>
    ${isEdit?`<div class="row-btns" style="margin-top:8px;"><button class="btn btn-danger btn-block" id="fm_delete">${existing.integrationAggregateId?'Excluir despesa integrada':'Remover a partir deste mês'}</button></div>`:''}
  </div></div>`);
  $('#modal-root').innerHTML='';$('#modal-root').appendChild(box);attachModalGuard(box);$('#fm_close').onclick=closeModal;
  attachMoneyMask($('#fm_valor'),isEdit?existing.valor:0);
  wireQuickCategory($('#fm_categoria'),$('#fm_newcat_box'),$('#fm_newcat_input'),$('#fm_newcat_add'),'fixa');

  function wireSegmented(groupId,inputId,onChange){
    const group=$(groupId),hidden=$(inputId);if(!group||!hidden)return;
    group.querySelectorAll('.seg-btn:not([disabled])').forEach(btn=>btn.onclick=()=>{group.querySelectorAll('.seg-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');hidden.value=btn.dataset.value;if(onChange)onChange(hidden.value);});
  }
  function syncPaymentSourceUI(source){
    ['carteira','conta','reserva','credito'].forEach(k=>{const node=$('#fm_'+k+'_fields');if(node)node.classList.toggle('hidden',source!==k);});
    const label=$('#fm_valor_label');if(label)label.textContent=source==='credito'?'Valor total da compra (R$)':'Valor mensal (R$)';
    updateCreditoParcelPreview();
  }
  function updateCreditoParcelPreview(){
    const tipo=$('#fm_credito_tipo'),wrap=$('#fm_parcelas_wrap'),preview=$('#fm_parcela_preview');
    if(!tipo)return;if(wrap)wrap.classList.toggle('hidden',tipo.value!=='parcelado');
    if(!preview||tipo.value!=='parcelado'){if(preview)preview.textContent='';return;}
    const total=parseInt(($('#fm_valor')&&$('#fm_valor').dataset.cents)||'0',10)/100;
    const qtd=Math.max(2,Math.round(Number(($('#fm_parcelas')&&$('#fm_parcelas').value)||2)));
    preview.textContent=`(${brlPlain(Math.round((total/qtd)*100)/100)} cada)`;
  }
  wireSegmented('#fm_pagamento_origem_group','#fm_pagamento_origem',syncPaymentSourceUI);
  wireSegmented('#fm_conta_forma_group','#fm_conta_forma');
  wireSegmented('#fm_status_group','#fm_status');
  if($('#fm_credito_tipo'))$('#fm_credito_tipo').onchange=updateCreditoParcelPreview;
  if($('#fm_parcelas'))$('#fm_parcelas').oninput=updateCreditoParcelPreview;
  if($('#fm_valor'))$('#fm_valor').addEventListener('input',updateCreditoParcelPreview);
  if(window.SharedPurchases)SharedPurchases.bindForm({prefix:'fm',existing:null,totalResolver:()=>parseInt(($('#fm_valor')&&$('#fm_valor').dataset.cents)||'0',10)/100,installmentsResolver:()=>($('#fm_credito_tipo')&&$('#fm_credito_tipo').value==='parcelado')?Math.max(2,Math.round(Number(($('#fm_parcelas')&&$('#fm_parcelas').value)||2))):1});
  syncPaymentSourceUI(initialPaymentSource);

  const instantFixedLinkedVisibility=$('#fm_linked_visible');
  if(linkedCardExpense&&instantFixedLinkedVisibility)instantFixedLinkedVisibility.addEventListener('change',()=>{
    if(instantFixedLinkedVisibility.checked)return;
    const ok=runAtomicFinancialMutation(
      ()=>syncLinkedCardPurchaseFromExpense(existing,{},false),
      ()=>alert('Não foi possível remover esta compra de Despesas. O estado anterior foi preservado.')
    );
    if(!ok){instantFixedLinkedVisibility.checked=true;return;}
    saveCurrentData({source:'fixed_expense_card_visibility'});
    closeModal();renderView();
    toast('Removido de Despesas agora; a compra continua no cartão e está salvando no Drive.');
  });

  $('#fm_save').onclick=()=>{
    const nome=$('#fm_nome').value.trim()||'Sem nome';
    const localCompra=($('#fm_local').value||'').trim();
    const categoria=$('#fm_categoria').value;
    if(categoria==='__new__'){alert('Confirme o nome da nova categoria antes de salvar.');return;}
    const valor=parseInt($('#fm_valor').dataset.cents||'0',10)/100;
    if(valor<=0){alert('Digite um valor maior que zero.');return;}
    const dataCadastro=$('#fm_data').value||fixedDateInitial||todayISO();
    const dia=Math.min(31,Math.max(1,parseInt(dataCadastro.slice(8,10),10)||1));
    const newStartMonth=dataCadastro.slice(0,7)||monthKey(todayYM().y,todayYM().m);
    const source=$('#fm_pagamento_origem').value;
    const requestedStatus=$('#fm_status').value==='Pago'?'Pago':'Em aberto';
    const inPlace=isEdit&&existing.startMonth===monthKeyNow;

    if(linkedCardExpense){
      const visible=$('#fm_linked_visible')?$('#fm_linked_visible').checked:true;
      const ok=runAtomicFinancialMutation(()=>syncLinkedCardPurchaseFromExpense(existing,{nome,data:dataCadastro,categoria,valor,localCompra,despesaTipo:'fixa'},visible),()=>alert('Não foi possível atualizar o vínculo com o cartão.'));
      if(!ok)return;
      saveCurrentData();closeModal();renderView();toast(visible?'Compra e despesa fixa atualizadas juntas.':'Compra mantida no cartão e removida de Despesas.');return;
    }

    if(source==='credito'){
      const cartao=(S.data.cartoes||[]).find(c=>c.id===$('#fm_cartao').value);
      if(!cartao){alert('Escolha um cartão de crédito válido.');return;}
      const parcelaTotal=$('#fm_credito_tipo').value==='parcelado'?Math.max(2,Math.round(Number($('#fm_parcelas').value)||2)):1;
      const sharedResult=window.SharedPurchases?SharedPurchases.readForm({prefix:'fm',totalValue:valor,installmentCount:parcelaTotal,existing:null}):{ok:true,model:null};
      if(!sharedResult.ok){alert(sharedResult.error);return;}
      const valorParcela=Math.round((valor/parcelaTotal)*100)/100;
      const ok=runAtomicFinancialMutation(()=>{
        if(isEdit){
          refundAndCleanFixaOcorrencias(existing.id,inPlace?null:monthKeyNow);
          if(inPlace)S.data.fixas=S.data.fixas.filter(x=>x.id!==existing.id);else existing.endMonth=monthBeforeKey(monthKeyNow);
        }
        const p={id:uid(),descricao:nome,local:localCompra,categoria:categoria||'Outro',valorParcela,parcelaTotal,dataCompra:newStartMonth,dataCompraCompleta:dataCadastro,diaEntrada:dia,apareceDespesas:sharedResult.model?sharedResult.model.valorProprioTotal>0:true,despesaTipo:'fixa',statusPagamento:requestedStatus,statusFaturaPorCompetencia:{},despesaTransacaoId:null,despesaTransacaoIds:[],despesaFixaId:null,compartilhamento:sharedResult.model};
        cartao.parcelas.push(p);linkParcelaToDespesa(cartao,p);
      },()=>alert('Não foi possível salvar a compra no cartão. Os dados anteriores foram preservados.'));
      if(!ok)return;
      saveCurrentData();closeModal();renderView();toast('Compra fixa adicionada ao cartão '+cartao.banco+' e à aba Despesa fixa.');return;
    }

    let origemPagamento='conta',formaPagamento=null,accountId=null,banco='',reservaBox=null;
    if(source==='carteira'){
      accountId=requireAccountId(CARTEIRA_CONTA_ID,'A Carteira precisa estar disponível.');if(!accountId)return;
      banco=accountNameSnapshot(accountId);formaPagamento='Dinheiro';
    }else if(source==='conta'){
      accountId=requireAccountId($('#fm_banco').value,'Escolha a conta de onde sai o dinheiro.');if(!accountId)return;
      banco=accountNameSnapshot(accountId);formaPagamento=$('#fm_conta_forma').value==='Débito'?'Débito':'Pix';
    }else if(source==='reserva'){
      reservaBox=reservaBoxesFixa.find(r=>r.id===$('#fm_reserva_pg_box').value);
      if(!reservaBox){toast('Escolha uma reserva válida.');return;}
      origemPagamento='reserva';banco=reservaBox.banco||'';
      if(requestedStatus==='Pago'&&!(currentRec&&currentRec.pago)&&!reservaTemSaldo(reservaBox,valor)){showReservaInsuficienteModal(reservaBox,valor);return;}
    }

    let prepare={ok:true,noop:true};
    if(isEdit&&requestedStatus==='Pago'){
      prepare=prepareFixaOcorrenciaEdit(existing.id,monthKeyNow,valor,origemPagamento,reservaBox&&reservaBox.id,nome);
      if(!prepare.ok){
        if(prepare.reason==='saldo_insuficiente')showReservaInsuficienteModal(prepare.box,prepare.necessario);
        else toast('Não foi possível manter o pagamento com a origem escolhida.');
        return;
      }
    }

    let target=null;
    const ok=runAtomicFinancialMutation(()=>{
      if(isEdit&&requestedStatus==='Em aberto'&&currentRec&&currentRec.pago)undoFixaOcorrencia(existing,monthKeyNow,{persist:false,notify:false});
      const payload={nome,localCompra,categoria,valor,dia,dataCadastro,accountId:origemPagamento==='conta'?accountId:null,banco,formaPagamento:origemPagamento==='conta'?formaPagamento:null,origemPagamento,reservaOrigemId:origemPagamento==='reserva'?reservaBox.id:null};
      if(isEdit){
        const targetId=inPlace?existing.id:uid();
        if(inPlace){Object.assign(existing,payload);target=existing;}
        else{existing.endMonth=monthBeforeKey(monthKeyNow);target=Object.assign({id:targetId,startMonth:monthKeyNow,endMonth:null},payload);S.data.fixas.push(target);if(existing.integrationAggregateId&&window.BorionInterop)BorionInterop.transferImportReferenceToFixed(existing,target,S.data);}
        if(requestedStatus==='Pago'){
          if(prepare.ok&&!prepare.noop)prepare.commit(targetId,accountId||banco);
          else if(!fixaOcorrenciaFor(targetId,monthKeyNow)&&!payFixaOcorrencia(target,monthKeyNow,{persist:false,notify:false}))throw new Error('Falha ao aplicar pagamento da despesa fixa.');
        }
      }else{
        target=Object.assign({id:uid(),startMonth:newStartMonth,endMonth:null},payload);S.data.fixas.push(target);
        if(requestedStatus==='Pago'&&!payFixaOcorrencia(target,newStartMonth,{persist:false,notify:false}))throw new Error('Falha ao aplicar pagamento da despesa fixa.');
      }
    },()=>alert('Não foi possível salvar. A despesa fixa e os saldos anteriores foram preservados.'));
    if(!ok)return;
    saveCurrentData();closeModal();renderView();toast(isEdit?'Despesa fixa atualizada.':(requestedStatus==='Pago'?'Despesa fixa adicionada como paga.':'Despesa fixa adicionada em aberto.'));
  };

  if(isEdit){
    $('#fm_delete').onclick=()=>{
      const performDelete=(integrationMode=null)=>{
        const snapshot=borionCloneForUndo(S.data);
        if(linkedCardExpense&&!integrationMode){linkedCardExpense.purchase.apareceDespesas=false;if(typeof assinaturaRegistrarPreferenciaDespesas==='function')assinaturaRegistrarPreferenciaDespesas(linkedCardExpense.purchase,false);unlinkParcelaFromDespesa(linkedCardExpense.purchase);saveCurrentData();closeModal();renderView();showUndoToast('Removido de Despesas; a compra continua no cartão.',()=>{S.data=snapshot;saveCurrentData();renderView();});return;}
        if(integrationMode&&window.BorionInterop){
          BorionInterop.markImportedDeletion(existing,integrationMode,S.data);
          BorionInterop.removeImportedNativeGroup?.(existing,S.data,'user_deleted_in_borion');
        }else{
          const deletingEntirely=existing.startMonth===monthKeyNow;
          refundAndCleanFixaOcorrencias(existing.id,deletingEntirely?null:monthKeyNow);
          if(deletingEntirely)S.data.fixas=S.data.fixas.filter(x=>x.id!==existing.id);else existing.endMonth=monthBeforeKey(monthKeyNow);
        }
        saveCurrentData();
        const criticalSync=integrationMode&&window.BorionInterop?BorionInterop.persistCriticalChange?.('interop_imported_fixed_delete'):null;
        closeModal();renderView();
        if(integrationMode){
          toast('Despesa integrada excluída definitivamente e bloqueada contra retorno.');
          Promise.resolve(criticalSync).then(result=>{
            if(result?.synced)toast('Exclusão confirmada no Google Drive.');
            else if(result?.pending)setTimeout(()=>toast('Exclusão salva neste dispositivo e pendente de confirmação no Drive.'),150);
          }).catch(error=>console.warn('[BORION][IMPORTED_FIXED_DELETE_SYNC]',error));
        }else showUndoToast('Despesa fixa removida a partir deste mês.',()=>{S.data=snapshot;saveCurrentData();renderView();});
      };
      if(existing.integrationAggregateId&&window.BorionInterop){BorionInterop.openImportedDeleteDialog(existing,performDelete);return;}
      performDelete();
    };
  }
}

