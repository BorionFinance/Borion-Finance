/* Borion Finance — Tela Visão Geral, cards, resumos, gráficos e cálculos auxiliares da visão geral. */

/* ---------------- VIEW: OVERVIEW ---------------- */

/* ---------------- Visão Geral: cálculos auxiliares ---------------- */
function caixaDisponivel(){ return liquidezTotal() + sumBy(S.data.investimentos.emCaixa.filter(c=>bankMatches(c.banco)),'valor'); }
function patrimonioLiquido(){ return liquidezTotal() + reservasTotal() + investAtualTotal(); }

function fluxoMensalData(){
  const keys = last12MonthsKeys();
  const labels = keys.map(k=>shortMonthLabel(k));
  const receitas = keys.map(k=>{ const [y,mm]=k.split('-').map(Number); return receitaMes(y,mm-1); });
  const despesas = keys.map(k=>{ const [y,mm]=k.split('-').map(Number); return despesasMes(y,mm-1); });
  return {labels, receitas, despesas};
}
function evolucaoPatrimonioData(){
  const keys = last12MonthsKeys();
  const labels = keys.map(k=>shortMonthLabel(k));
  const raw = keys.map(k=> S.data.patrimonioHistorico[k]);
  const firstKnown = raw.find(v=>v!=null);
  if(firstKnown==null) return {labels, values:null};
  let last = firstKnown;
  const values = raw.map(v=>{ if(v!=null){ last=v; return v; } return last; });
  return {labels, values};
}
function evolucaoDividasData(){
  const keys = last12MonthsKeys();
  const labels = keys.map(k=>shortMonthLabel(k));
  const values = keys.map(k=>{ const [y,mm]=k.split('-').map(Number); return computeCardsDebt(y,mm-1).total; });
  return {labels, values};
}
function gastosPorCategoriaSegments(y=S.month.y, m=S.month.m){
  const totals = {};
  fixasAtivasNoMes(y,m).forEach(f=> totals[f.categoria]=(totals[f.categoria]||0)+Number(f.valor||0));
  txInMonth(S.data.transacoes.filter(t=>t.tipo==='variavel'&&bankMatches(t.banco)), y, m).forEach(t=> totals[t.categoria]=(totals[t.categoria]||0)+Number(t.valor||0));
  assinaturasAtivasNoMes(y,m).forEach(a=> totals[a.categoria]=(totals[a.categoria]||0)+Number(a.valor||0));
  return Object.keys(totals).map(k=>({label:k, value:totals[k], color:catColor(k)}));
}
function gastosPorCartaoSegments(y=S.month.y, m=S.month.m){
  return S.data.cartoes.filter(c=>bankMatches(c.banco)).map(c=>{
    let total=0;
    c.parcelas.forEach(p=>{ const st=parcelaStatus(p,y,m); if(st.ativo) total+=p.valorParcela; });
    return {label:c.banco, value:total, color:bankColor(c.banco)};
  }).filter(s=>s.value>0);
}
function bankDistribuicaoSegments(){
  return allBankNames().map(bn=>{
    const saldo = saldoBancoNome(bn)
      + (reservasEnabled() ? sumBy((S.data.reservas.boxes||[]).filter(r=>r.banco===bn),'valorAtual') : 0)
      + sumBy(S.data.investimentos.emCaixa.filter(c=>c.banco===bn),'valor')
      + sumBy(S.data.investimentos.ativos.filter(a=>a.banco===bn),'atual');
    return {label:bn, value:saldo, color:bankColor(bn)};
  }).filter(s=>s.value>0);
}
function bankSummaryList(y=S.month.y, m=S.month.m){
  return allBankNames().map(bn=>{
    const saldoAtual = saldoBancoNome(bn)
      + (reservasEnabled() ? sumBy((S.data.reservas.boxes||[]).filter(r=>r.banco===bn),'valorAtual') : 0)
      + sumBy(S.data.investimentos.emCaixa.filter(c=>c.banco===bn),'valor')
      - S.data.cartoes.filter(c=>c.banco===bn).reduce((acc,c)=>{
          let d=0; c.parcelas.forEach(p=>{ const st=parcelaStatus(p,y,m); if(st.ativo) d+=Math.round((p.valorParcela*(p.parcelaTotal-st.atual+1))*100)/100; });
          return acc+d;
        },0);
    const receitas = sumBy(txInMonth(S.data.transacoes.filter(t=>t.tipo==='receita'&&t.banco===bn), y, m),'valor');
    const despesasFixas = sumBy(fixasAtivasNoMes(y,m).filter(f=>f.banco===bn),'valor');
    const despesasVar = sumBy(txInMonth(S.data.transacoes.filter(t=>t.tipo==='variavel'&&t.banco===bn), y, m),'valor');
    const despesas = despesasFixas+despesasVar;
    const investVinc = sumBy(S.data.investimentos.ativos.filter(a=>a.banco===bn),'atual');
    const reservas = reservasEnabled() ? sumBy((S.data.reservas.boxes||[]).filter(r=>r.banco===bn),'valorAtual') : 0;
    return {nome:bn, cor:bankColor(bn), saldoAtual, receitas, despesas, saldoLiquido:receitas-despesas, investVinc, reservas};
  });
}
function calcularSaudeFinanceira(){
  const rec = receitaMes(), desp = despesasMes();
  const liq = liquidezTotal();
  const divida = computeCardsDebt().total;
  const saldo = saldoMes();
  let score = 100;
  const pts = [];

  const mesesReserva = desp>0 ? liq/desp : (liq>0?99:0);
  if(mesesReserva>=3){ pts.push({ok:true, text:'Reserva de emergência boa (cobre '+mesesReserva.toFixed(1)+' meses de despesas).'}); }
  else if(mesesReserva>=1){ score-=15; pts.push({ok:false, text:'Reserva de emergência baixa (cobre '+mesesReserva.toFixed(1)+' meses).'}); }
  else { score-=30; pts.push({ok:false, text:'Sem reserva de emergência relevante em liquidez.'}); }

  if(saldo>=0){ pts.push({ok:true, text:'Saldo do mês positivo.'}); }
  else { score-=20; pts.push({ok:false, text:'Despesas do mês superaram a receita.'}); }

  const dividaPctRenda = rec>0 ? divida/rec : (divida>0?9:0);
  if(dividaPctRenda<=0.3){ pts.push({ok:true, text:'Dívida em cartão sob controle frente à renda.'}); }
  else if(dividaPctRenda<=0.7){ score-=15; pts.push({ok:false, text:'Dívida do cartão está elevada frente à renda do mês.'}); }
  else if(divida>0){ score-=30; pts.push({ok:false, text:'Dívida em cartão muito alta comparada à renda.'}); }

  const hist = evolucaoPatrimonioData();
  if(hist.values && hist.values.length>=2){
    const idxStart = Math.max(0, hist.values.length-4);
    const first = hist.values[idxStart], lastV = hist.values[hist.values.length-1];
    if(lastV>first){ pts.push({ok:true, text:'Patrimônio em tendência de crescimento recente.'}); }
    else if(lastV<first){ score-=10; pts.push({ok:false, text:'Patrimônio em leve queda nos últimos meses.'}); }
  }

  const assinaturas = fixasAtivasNoMes().filter(f=>f.categoria==='Assinaturas').reduce((a,b)=>a+Number(b.valor||0),0);
  const pctAssin = rec>0 ? assinaturas/rec*100 : 0;
  if(assinaturas>0){
    if(pctAssin>10){ score-=10; pts.push({ok:false, text:'Assinaturas representam '+pctAssin.toFixed(0)+'% da renda do mês.'}); }
    else { pts.push({ok:true, text:'Assinaturas representam só '+pctAssin.toFixed(0)+'% da renda.'}); }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return {score, pts};
}

/* ---------------- VIEW: OVERVIEW ---------------- */
function dashboardWidgetKeys(){
  const saved = (S.data.dashboard && Array.isArray(S.data.dashboard.widgets)) ? S.data.dashboard.widgets : DEFAULT_DASHBOARD_WIDGETS.slice();
  return saved.filter(k=>DEFAULT_DASHBOARD_WIDGETS.includes(k));
}
function dashboardWidgetHTML(key, ctx){
  if(key==='fluxoMensal') return `<div class="panel-box dash-widget-wide"><div class="panel-title">Fluxo mensal — receitas x despesas (12 meses)</div>${renderBarChart({labels:ctx.fluxo.labels, series:[{name:'Receita', color:iconColor('receita'), values:ctx.fluxo.receitas},{name:'Despesa', color:iconColor('despesas'), values:ctx.fluxo.despesas}]})}</div>`;
  if(key==='evolucaoPatrimonio') return `<div class="panel-box"><div class="panel-title">Evolução do patrimônio</div>${ctx.evolPat.values ? renderLineChart({labels:ctx.evolPat.labels, series:[{name:'Patrimônio', color:iconColor('investimentos'), values:ctx.evolPat.values}]}) : '<div class="empty-note">O histórico começa a partir de agora — volte em alguns meses para ver a evolução.</div>'}</div>`;
  if(key==='evolucaoDividasCartao') return `<div class="panel-box"><div class="panel-title">Evolução das dívidas (cartões + boletos)</div>${renderLineChart({labels:ctx.evolDiv.labels, series:[{name:'Dívida', color:iconColor('dividas'), values:ctx.evolDiv.values}]})}</div>`;
  if(key==='distribuicaoPatrimonio') return `<div class="panel-box"><div class="panel-title">Distribuição do patrimônio</div>${renderDonut(ctx.composicaoSegs)}</div>`;
  if(key==='gastosCategoria') return `<div class="panel-box"><div class="panel-title">Gastos por categoria (${monthLabel(S.month.y,S.month.m)})</div>${renderDonut(ctx.gastosCat)}</div>`;
  if(key==='gastosCartao') return `<div class="panel-box dash-widget-wide"><div class="panel-title">Gastos por cartão (${monthLabel(S.month.y,S.month.m)})</div>${ctx.gastosCartao.length ? renderBarChart({labels:ctx.gastosCartao.map(g=>g.label), series:[{name:'Fatura do mês', color:iconColor('dividas'), values:ctx.gastosCartao.map(g=>g.value)}]}) : '<div class="empty-note">Nenhuma parcela ativa em cartão neste mês.</div>'}</div>`;
  if(key==='distribuicaoBanco') return `<div class="panel-box"><div class="panel-title">Distribuição por banco</div>${ctx.bankSegs.length ? renderDonut(ctx.bankSegs) : '<div class="empty-note">Cadastre bancos/contas e vincule lançamentos a eles para ver esta distribuição.</div>'}</div>`;
  if(key==='resumoBanco') return `<div class="panel-box dash-widget-wide"><div class="panel-title">Resumo por banco</div>${ctx.bankSummary.length ? `
        <table>
          <thead><tr><th>Banco</th><th>Saldo atual</th><th>Receitas (mês)</th><th>Despesas (mês)</th><th>Saldo líq. (mês)</th><th>Investido</th><th>Reservas</th></tr></thead>
          <tbody>
            ${ctx.bankSummary.map(b=>`<tr>
              <td><span class="cat-pill"><span class="dot" style="background:${b.cor}"></span>${esc(b.nome)}</span></td>
              <td style="font-weight:700">${brl(b.saldoAtual)}</td>
              <td class="val-pos">${brl(b.receitas)}</td>
              <td>${brl(b.despesas)}</td>
              <td class="${b.saldoLiquido>=0?'val-pos':''}">${brl(b.saldoLiquido)}</td>
              <td>${brl(b.investVinc)}</td>
              <td>${brl(b.reservas)}</td>
            </tr>`).join('')}
          </tbody>
        </table>` : '<div class="empty-note">Cadastre bancos/contas em "Cartões e Contas" e vincule seus lançamentos a eles para ver o resumo por banco.</div>'}</div>`;
  return '';
}
function renderOverview(){
  const pt = patrimonioTotal();
  const inv = investAtualTotal();
  const desp = despesasMes();
  const rec = receitaMes();
  const saldo = saldoMes();
  const resultado = resultadoPeriodo();
  const disponivel = disponivelEmConta();
  const dividasDebt = computeCardsDebt();
  const divCartao = dividasDebt.cartoesTotal;
  const divBoletos = dividasDebt.boletosTotal;
  const patLiq = patrimonioLiquido();
  const caixa = caixaDisponivel();
  const reservas = reservasTotal();
  const entradasExtra = receitaExtraMes();

  const ctx = {
    fluxo: fluxoMensalData(),
    evolPat: evolucaoPatrimonioData(),
    evolDiv: evolucaoDividasData(),
    composicaoSegs: patrimonioComposicaoSegments(),
    gastosCat: gastosPorCategoriaSegments(),
    gastosCartao: gastosPorCartaoSegments(),
    bankSegs: bankDistribuicaoSegments(),
    bankSummary: bankSummaryList()
  };
  const saude = calcularSaudeFinanceira();
  const saudeCor = saude.score>=75?'#22c55e':saude.score>=50?'#f0c26e':'#ef4444';
  const widgets = dashboardWidgetKeys();
  const widgetsHTML = widgets.map(k=>dashboardWidgetHTML(k, ctx)).join('');

  return `
    <div class="indicators-grid">
      <div class="card card-sm hero-gold"><div class="clabel">Patrimônio Total</div><div class="cval">${brl(pt)}</div></div>
      <div class="card card-sm hero-green"><div class="clabel">Disponível em Conta</div><div class="cval">${brl(disponivel)}</div></div>
      <div class="card card-sm"><div class="clabel">Receitas do período</div><div class="cval" style="color:${iconColor('receita')}">${brl(rec)}</div></div>
      <div class="card card-sm"><div class="clabel">Despesas do período</div><div class="cval" style="color:${iconColor('despesas')}">${brl(desp)}</div></div>
    </div>
    <div class="indicators-grid">
      <div class="card card-sm hero-blue"><div class="clabel">Resultado do período</div><div class="cval" style="color:${resultado>=0?iconColor('receita'):iconColor('despesas')}">${brl(resultado)}</div></div>
      <div class="card card-sm"><div class="clabel">Total investido</div><div class="cval">${brl(inv)}</div></div>
      <div class="card card-sm"><div class="clabel">Total em reserva</div><div class="cval" style="color:var(--gold-bright)">${brl(reservas)}</div></div>
      <div class="card card-sm"><div class="clabel">Patrimônio líquido</div><div class="cval">${brl(patLiq)}</div></div>
    </div>

    <div class="overview-top-grid">
      <div class="panel-box">
        <div class="panel-title">Resumo rápido de ${monthLabel(S.month.y,S.month.m)}</div>
        <div class="list-row"><span class="lname">Receitas do período</span><span class="lval val-pos">${brl(rec)}</span></div>
        <div class="list-row"><span class="lname">Despesas do período</span><span class="lval" style="color:${iconColor('despesas')}">- ${brl(desp)}</span></div>
        <div class="list-row"><span class="lname">Resultado do período</span><span class="lval ${resultado>=0?'val-pos':''}" style="${resultado<0?'color:'+iconColor('despesas'):''}">${brl(resultado)}</span></div>
        <div class="list-row"><span class="lname">Crédito usado em cartões</span><span class="lval" style="color:${iconColor('dividas')}">- ${brl(divCartao)}</span></div>
        <div class="list-row"><span class="lname">Boletos a pagar</span><span class="lval" style="color:${iconColor('dividas')}">- ${brl(divBoletos)}</span></div>
        <div class="list-row"><span class="lname">Reserva (patrimônio guardado)</span><span class="lval" style="color:var(--gold-bright)">${brl(reservas)}</span></div>
        <div class="list-row"><span class="lname">Disponível em conta (fora das reservas)</span><span class="lval">${brl(disponivel)}</span></div>
        ${entradasExtra>0?`<div class="list-row"><span class="lname">Reembolsos/repasses recebidos (não é renda)</span><span class="lval" style="color:var(--gold-bright)">${brl(entradasExtra)}</span></div>`:''}
      </div>

      <div class="panel-box">
        <div class="panel-title">◆ Saúde financeira <span style="margin-left:auto;font-weight:800;color:${saudeCor}">${saude.score}/100</span></div>
        <div class="progress-outer" style="background:rgba(255,255,255,.08);margin:10px 0 12px;"><div class="progress-inner" style="width:${saude.score}%;background:${saudeCor};"></div></div>
        ${saude.pts.map(p=>`<div style="font-size:12.5px;color:${p.ok?'#8fd6a8':'#f0a8a8'};margin-bottom:5px;">${p.ok?'✔':'⚠'} ${esc(p.text)}</div>`).join('')}
        <p style="font-size:11px;color:var(--muted-2);margin:10px 0 0;">Indicador simples e automático, calculado a partir dos seus próprios lançamentos.</p>
      </div>
    </div>

    ${widgets.length ? `<div class="dash-grid dashboard-flexible">${widgetsHTML}</div>` : `<div class="panel-box"><div class="empty-note">Todos os blocos da visão geral estão desativados. Ative os gráficos em Configurações → Dashboard.</div></div>`}
  `;
}
