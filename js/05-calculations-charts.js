/* Borion Finance — Cálculos financeiros, parcelas, gráficos SVG e histórico de patrimônio. */

/* ---------------- computations ---------------- */
function txInMonth(list, y, m){
  const key = monthKey(y,m);
  return list.filter(t=>t.data && t.data.startsWith(key));
}
function sumBy(list, key){ return list.reduce((a,b)=>a+(Number(b[key])||0),0); }

function fixasAtivasNoMes(y=S.month.y, m=S.month.m){
  const key = monthKey(y,m);
  return S.data.fixas.filter(f=> f.startMonth<=key && (!f.endMonth || key<=f.endMonth) && bankMatches(f.banco));
}
/* V5.37.0 — lista de {y,m,key} (y/m 0-indexados, no formato usado por S.month) entre
   duas datas ISO (yyyy-mm-dd), inclusive, cobrindo cada mês tocado pelo intervalo.
   Usado pelo filtro de período de Orçamento, que pode olhar vários meses (inclusive
   anteriores) de uma vez, sem depender do mês selecionado no calendário do topo. */
function monthsBetweenISO(fromISO, toISO){
  if(!fromISO || !toISO) return [];
  let a = fromISO.slice(0,7), b = toISO.slice(0,7);
  if(b<a){ const t=a; a=b; b=t; }
  const out=[];
  let cur=a, guard=0;
  while(cur<=b && guard<600){
    const [y,m] = cur.split('-').map(Number); // m aqui é 1-indexado (formato "YYYY-MM")
    out.push({y, m:m-1, key:cur});
    cur = shiftYM(cur, 1);
    guard++;
  }
  return out;
}
function fixaMes(y=S.month.y, m=S.month.m){ return sumBy(fixasAtivasNoMes(y,m),'valor'); }
function variavelMes(y=S.month.y, m=S.month.m){ return sumBy(txInMonth(S.data.transacoes.filter(t=>t.tipo==='variavel'&&bankMatches(t.banco)), y, m),'valor'); }
/* Receita do mês = só dinheiro próprio (origem 'propria'). Reembolso/repasse de terceiros não contam como renda. */
function receitaMes(y=S.month.y, m=S.month.m){ return sumBy(txInMonth(S.data.transacoes.filter(t=>t.tipo==='receita'&&(t.origem==null||t.origem==='propria')&&bankMatches(t.banco)), y, m),'valor'); }
/* Entradas que não são renda própria: reembolsos recebidos + repasses de terceiros (ex: alguém te manda dinheiro para pagar uma conta). */
function receitaExtraMes(y=S.month.y, m=S.month.m){ return sumBy(txInMonth(S.data.transacoes.filter(t=>t.tipo==='receita'&&(t.origem==='reembolso'||t.origem==='repasse')&&bankMatches(t.banco)), y, m),'valor'); }
function reembolsosMes(y=S.month.y, m=S.month.m){ return sumBy(txInMonth(S.data.transacoes.filter(t=>t.tipo==='receita'&&t.origem==='reembolso'&&bankMatches(t.banco)), y, m),'valor'); }
function repassesMes(y=S.month.y, m=S.month.m){ return sumBy(txInMonth(S.data.transacoes.filter(t=>t.tipo==='receita'&&t.origem==='repasse'&&bankMatches(t.banco)), y, m),'valor'); }
function despesasMes(y=S.month.y, m=S.month.m){ return fixaMes(y,m)+variavelMes(y,m); }
function investirPlanejado(){ return S.data.investirPlanejado[monthKey(S.month.y,S.month.m)] || 0; }
function saldoMes(){ return receitaMes() - despesasMes() - investirPlanejado(); }

/* -- credit-card installments: status is computed relative to the selected calendar month -- */
function parcelaStatus(p, y=S.month.y, m=S.month.m){
  const selYM = monthKey(y,m);
  const atual = monthDiffYM(selYM, p.dataCompra) + 1;
  return { ativo: atual>=1 && atual<=p.parcelaTotal, atual };
}
function boletoParcelaStatus(b, y=S.month.y, m=S.month.m){
  const selYM = monthKey(y,m);
  const inicio = b.dataInicio || b.dataCompra || monthKey(y,m);
  const atual = monthDiffYM(selYM, inicio) + 1;
  const ativoStatus = !['Quitado','Cancelado'].includes(b.status||'Ativo');
  return { ativo: ativoStatus && atual>=1 && atual<=Number(b.parcelaTotal||1), atual };
}

/* ---- histórico de pagamentos: evita recontar/negativar dívida já paga ---- */
function isFaturaPaga(cartaoId, competencia){
  const c = (S.data.cartoes||[]).find(x=>x.id===cartaoId);
  if(!c || !Array.isArray(c.faturasPagas)) return false;
  return c.faturasPagas.some(f=>f.competencia===competencia);
}
function faturaPagamentoDe(cartaoId, competencia){
  const c = (S.data.cartoes||[]).find(x=>x.id===cartaoId);
  if(!c || !Array.isArray(c.faturasPagas)) return null;
  return c.faturasPagas.find(f=>f.competencia===competencia) || null;
}
function isBoletoCompetenciaPaga(boletoId, competencia){
  const b = (S.data.boletos||[]).find(x=>x.id===boletoId);
  if(!b || !Array.isArray(b.pagamentos)) return false;
  return b.pagamentos.some(p=>p.competencia===competencia);
}
function boletoPagamentoDe(boletoId, competencia){
  const b = (S.data.boletos||[]).find(x=>x.id===boletoId);
  if(!b || !Array.isArray(b.pagamentos)) return null;
  return b.pagamentos.find(p=>p.competencia===competencia) || null;
}

/* Valor restante de uma parcela de cartão a partir do mês selecionado, pulando meses cuja fatura já foi marcada como paga. */
function parcelaRestanteValor(p, cartaoId, y=S.month.y, m=S.month.m){
  const st = parcelaStatus(p,y,m);
  if(!st.ativo) return {ativo:false, atual:st.atual, restante:0};
  let restante = 0;
  for(let i=st.atual;i<=p.parcelaTotal;i++){
    const comp = shiftYM(p.dataCompra, i-1);
    if(cartaoId && isFaturaPaga(cartaoId, comp)) continue;
    restante += Number(p.valorParcela)||0;
  }
  return {ativo:true, atual:st.atual, restante:Math.round(restante*100)/100};
}
/* Valor restante de um boleto a partir do mês selecionado, pulando meses/parcelas já pagos. */
function boletoRestanteValor(b, y=S.month.y, m=S.month.m){
  const st = boletoParcelaStatus(b,y,m);
  if(!st.ativo) return {ativo:false, atual:st.atual, restante:0};
  const inicio = b.dataInicio || b.dataCompra || monthKey(y,m);
  let restante = 0;
  for(let i=st.atual;i<=Number(b.parcelaTotal||1);i++){
    const comp = shiftYM(inicio, i-1);
    if(isBoletoCompetenciaPaga(b.id, comp)) continue;
    restante += Number(b.valorParcela)||0;
  }
  return {ativo:true, atual:st.atual, restante:Math.round(restante*100)/100};
}
/* ---------------- V5.39.0 — vínculo opcional entre compra no cartão e Despesas ----------------
   Uma compra no cartão (parcela) pode, opcionalmente, também aparecer em Orçamento >
   Despesas (fixa ou variável). O vínculo fica guardado na própria parcela
   (despesaTransacaoId/despesaFixaId), então editar ou remover a parcela sempre
   atualiza/remove o espelho em Despesas também — nunca duplica, nunca fica órfão.
   A despesa espelhada nunca desconta banco/carteira (ela só existe pra aparecer na
   lista/gráfico de Despesas); quem controla o dinheiro de verdade continua sendo a
   fatura do cartão, como sempre. */
function linkParcelaToDespesa(cartao, parcela){
  unlinkParcelaFromDespesa(parcela);
  if(!parcela || !parcela.apareceDespesas) return;
  const nome = parcela.descricao || 'Compra no cartão';
  const categoria = parcela.categoria || 'Outro';
  const totalParcelas = Math.max(1, Math.round(parcela.parcelaTotal||1));
  const startMonth = parcela.dataCompra || monthKey(S.month.y,S.month.m);
  if(parcela.despesaTipo==='fixa'){
    const endMonth = shiftYM(startMonth, totalParcelas-1);
    const f = {id:uid(), nome, categoria, valor:Number(parcela.valorParcela)||0, dia:parcela.diaEntrada||1, startMonth, endMonth:totalParcelas>1?endMonth:startMonth, banco:'', viaCartaoId:cartao.id, viaParcelaId:parcela.id};
    S.data.fixas.push(f);
    parcela.despesaFixaId = f.id;
  } else {
    const valorTotal = Math.round((Number(parcela.valorParcela)||0) * totalParcelas * 100) / 100;
    const t = {id:uid(), tipo:'variavel', nome, data:startMonth+'-01', categoria, valor:valorTotal, banco:'', formaPagamento:'Crédito', viaCartaoId:cartao.id, viaParcelaId:parcela.id};
    S.data.transacoes.push(t);
    parcela.despesaTransacaoId = t.id;
  }
}
function unlinkParcelaFromDespesa(parcela){
  if(!parcela) return;
  if(parcela.despesaTransacaoId){
    S.data.transacoes = S.data.transacoes.filter(t=>t.id!==parcela.despesaTransacaoId);
    parcela.despesaTransacaoId = null;
  }
  if(parcela.despesaFixaId){
    S.data.fixas = S.data.fixas.filter(f=>f.id!==parcela.despesaFixaId);
    parcela.despesaFixaId = null;
  }
}

/* Fatura do cartão no mês selecionado: total das parcelas ativas + se já foi marcada como paga. */
function cartaoFaturaDoMes(cartaoId, y=S.month.y, m=S.month.m){
  const c = (S.data.cartoes||[]).find(x=>x.id===cartaoId);
  const competencia = monthKey(y,m);
  if(!c) return {total:0, competencia, paga:false, pagamento:null};
  let total=0;
  (c.parcelas||[]).forEach(p=>{ const st=parcelaStatus(p,y,m); if(st.ativo) total += Number(p.valorParcela)||0; });
  total = Math.round(total*100)/100;
  return {total, competencia, paga:isFaturaPaga(cartaoId, competencia), pagamento:faturaPagamentoDe(cartaoId, competencia)};
}
/* Boleto do mês selecionado: valor da parcela ativa + se já foi marcado como pago. */
function boletoParcelaDoMes(boletoId, y=S.month.y, m=S.month.m){
  const b = (S.data.boletos||[]).find(x=>x.id===boletoId);
  const competencia = monthKey(y,m);
  if(!b) return {total:0, competencia, paga:false, pagamento:null};
  const st = boletoParcelaStatus(b,y,m);
  const total = st.ativo ? Math.round((Number(b.valorParcela)||0)*100)/100 : 0;
  return {total, competencia, paga:isBoletoCompetenciaPaga(boletoId, competencia), pagamento:boletoPagamentoDe(boletoId, competencia)};
}

function computeBoletosDebt(y=S.month.y, m=S.month.m){
  let total=0;
  const detail=[];
  (S.data.boletos||[]).filter(b=>bankMatches(b.banco)).forEach(b=>{
    const st = boletoRestanteValor(b,y,m);
    if(st.ativo && st.restante>0){
      total += st.restante;
      detail.push({tipoDivida:'boleto', cartao:'Boleto', descricao:b.descricao||b.credor||'Boleto', local:b.credor||'', banco:b.banco||'', valorParcela:Number(b.valorParcela)||0, parcelaTotal:Number(b.parcelaTotal)||1, atualCalc:st.atual, restante:st.restante, id:b.id});
    }
  });
  return {total: Math.round(total*100)/100, detail};
}
function computeCardsDebt(y=S.month.y, m=S.month.m){
  let total=0;
  const detail=[];
  S.data.cartoes.filter(c=>bankMatches(c.banco)).forEach(c=>{
    c.parcelas.forEach(p=>{
      const st = parcelaRestanteValor(p, c.id, y, m);
      if(st.ativo && st.restante>0){
        total += st.restante;
        detail.push({tipoDivida:'cartao', cartao:c.banco, ...p, atualCalc:st.atual, restante:st.restante});
      }
    });
  });
  total = Math.round(total*100)/100;
  const bol = computeBoletosDebt(y,m);
  return {total: Math.round((total + bol.total)*100)/100, detail: detail.concat(bol.detail), cartoesTotal: total, boletosTotal: bol.total, boletosDetail: bol.detail};
}
function investAtualTotal(){
  const ativos = sumBy(S.data.investimentos.ativos.filter(a=>bankMatches(a.banco)),'atual');
  const caixa = sumBy(S.data.investimentos.emCaixa.filter(c=>bankMatches(c.banco)),'valor');
  return ativos+caixa;
}
function investInvestidoTotal(){
  const ativos = sumBy(S.data.investimentos.ativos.filter(a=>bankMatches(a.banco)),'investido');
  const caixa = sumBy(S.data.investimentos.emCaixa.filter(c=>bankMatches(c.banco)),'valor');
  return ativos+caixa;
}
function liquidezTotal(){ return sumBy(S.data.liquidez.filter(l=>bankMatches(l.banco)),'valor'); }
function reservasEnabled(){ return !!(S.data && S.data.modules && S.data.modules.reserves !== false && S.data.reservas && S.data.reservas.enabled !== false); }
function reservasTotal(){ return reservasEnabled() ? sumBy((S.data.reservas.boxes||[]).filter(r=>bankMatches(r.banco)),'valorAtual') : 0; }
function bensTotal(){ return sumBy(S.data.bens.filter(b=>bankMatches(b.banco)),'valor'); }
function patrimonioTotal(){
  return liquidezTotal() + reservasTotal() + bensTotal() + investAtualTotal() - computeCardsDebt().total;
}

/* ---------------- donut chart builder (SVG, com tooltip no hover) ---------------- */
function polarPoint(cx, cy, r, angleDeg){
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r*Math.cos(rad), y: cy + r*Math.sin(rad) };
}
function donutSlicePath(cx, cy, rOuter, rInner, f0, f1){
  if(f1 - f0 >= 0.9999) f1 = f0 + 0.9999; // evita arco degenerado quando é 100%
  const a0 = -90 + f0*360, a1 = -90 + f1*360;
  const largeArc = (a1-a0) > 180 ? 1 : 0;
  const o0 = polarPoint(cx,cy,rOuter,a0), o1 = polarPoint(cx,cy,rOuter,a1);
  const i0 = polarPoint(cx,cy,rInner,a0), i1 = polarPoint(cx,cy,rInner,a1);
  return `M ${o0.x.toFixed(2)},${o0.y.toFixed(2)} A ${rOuter},${rOuter} 0 ${largeArc} 1 ${o1.x.toFixed(2)},${o1.y.toFixed(2)} L ${i1.x.toFixed(2)},${i1.y.toFixed(2)} A ${rInner},${rInner} 0 ${largeArc} 0 ${i0.x.toFixed(2)},${i0.y.toFixed(2)} Z`;
}
function renderDonut(segments, centerTop, centerBottom){
  const filtered = segments.filter(s=>s.value>0);
  const total = filtered.reduce((a,b)=>a+b.value,0);
  let acc = 0;
  const paths = filtered.map((s,idx)=>{
    const f0 = total? acc/total : 0; acc += s.value; const f1 = total? acc/total : 0;
    const pctTxt = total? Math.round(s.value/total*100)+'%' : '0%';
    const d = donutSlicePath(100,100,90,54,f0,f1);
    return `<path d="${d}" fill="${s.color}" style="animation-delay:${(idx*0.05).toFixed(2)}s" data-label="${esc(s.label)}" data-pct="${pctTxt}" data-value="${esc(brl(s.value))}" onmousemove="ChartTooltip.showEl(event,this)" onmouseleave="ChartTooltip.hide()"></path>`;
  }).join('');
  const svg = filtered.length
    ? `<svg class="donut-svg" viewBox="0 0 200 200">${paths}</svg>`
    : `<svg class="donut-svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="72" fill="none" stroke="#232b33" stroke-width="36"/></svg>`;
  const legend = filtered.map((s,idx)=>{
    const pctTxt = total? Math.round(s.value/total*100)+'%' : '0%';
    return `
    <div class="legend-item" style="animation-delay:${(idx*0.06).toFixed(2)}s" data-label="${esc(s.label)}" data-pct="${pctTxt}" data-value="${esc(brl(s.value))}" onmousemove="ChartTooltip.showEl(event,this)" onmouseleave="ChartTooltip.hide()">
      <span class="dot" style="background:${s.color}"></span>
      <span class="lp">${pctTxt}</span>
      <span class="ln">${esc(s.label)}</span>
      <span class="lv">${brl(s.value)}</span>
    </div>`;
  }).join('');
  return `
    <div class="donut-wrap">
      <div class="donut-hole-wrap">
        ${svg}
        <div class="donut-hole">
          <div class="dtop">${centerTop!=null?centerTop:''}</div>
          <div class="dbot">${centerBottom!=null?centerBottom:''}</div>
        </div>
      </div>
      <div class="legend">${legend || '<div class="empty-note">Sem dados neste período</div>'}</div>
    </div>`;
}

/* ---------------- floating chart tooltip (usado por todos os gráficos) ---------------- */
const ChartTooltip = {
  showEl(evt, el){
    const label = el.dataset.label||'', pct = el.dataset.pct||'', value = el.dataset.value||'';
    let html = `<b>${esc(label)}</b>`;
    if(pct) html += ` : ${esc(pct)}`;
    if(value) html += ` - ${esc(value)}`;
    this.show(evt, html);
  },
  show(evt, html){
    let tt = document.getElementById('chart-tooltip');
    if(!tt){
      tt = document.createElement('div');
      tt.id = 'chart-tooltip';
      document.body.appendChild(tt);
    }
    tt.innerHTML = html;
    tt.style.display = 'block';
    const pad = 16;
    let x = evt.clientX + pad, y = evt.clientY + pad;
    const rect = tt.getBoundingClientRect();
    if(x + rect.width > window.innerWidth - 8) x = evt.clientX - rect.width - pad;
    if(y + rect.height > window.innerHeight - 8) y = evt.clientY - rect.height - pad;
    tt.style.left = x+'px';
    tt.style.top = y+'px';
  },
  hide(){
    const tt = document.getElementById('chart-tooltip');
    if(tt) tt.style.display = 'none';
  }
};

/* ---------------- bar / line chart builders (SVG, com tooltip) ---------------- */
function renderBarChart({series, labels, height=180, valueFormatter}){
  valueFormatter = valueFormatter || brl;
  const maxVal = Math.max(1, ...series.flatMap(s=>s.values));
  const W=640, H=height, padL=10, padR=10, padT=10, padB=26;
  const plotW=W-padL-padR, plotH=H-padT-padB;
  const n = Math.max(1, labels.length);
  const groupW = plotW/n;
  const barGap = 5;
  const barW = Math.max(3, (groupW - barGap*(series.length+1)) / series.length);
  let bars='';
  labels.forEach((lab,i)=>{
    const groupX = padL + i*groupW;
    series.forEach((s,si)=>{
      const val = s.values[i]||0;
      const bh = maxVal>0 ? (val/maxVal)*plotH : 0;
      const x = groupX + barGap + si*(barW+barGap);
      const y = padT + (plotH-Math.max(1,bh));
      bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1,bh).toFixed(1)}" rx="2.5" fill="${s.color}" style="animation-delay:${(i*0.02+si*0.015).toFixed(2)}s" data-label="${esc(lab)}${series.length>1?' · '+esc(s.name):''}" data-value="${esc(valueFormatter(val))}" onmousemove="ChartTooltip.showEl(event,this)" onmouseleave="ChartTooltip.hide()"></rect>`;
    });
  });
  const step = Math.max(1, Math.ceil(n/7));
  const labelsHTML = labels.map((lab,i)=>{
    if(i%step!==0 && i!==n-1) return '';
    const x = padL + i*groupW + groupW/2;
    return `<text x="${x.toFixed(1)}" y="${H-8}" text-anchor="middle" class="chart-axis-label">${esc(lab)}</text>`;
  }).join('');
  const legendHTML = series.length>1 ? `<div class="chart-legend">${series.map(s=>`<span class="chart-legend-item"><span class="dot" style="background:${s.color}"></span>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `<div class="chart-block"><svg class="bar-chart-svg" viewBox="0 0 ${W} ${H}">${bars}${labelsHTML}</svg>${legendHTML}</div>`;
}

function renderLineChart({series, labels, height=180, valueFormatter}){
  valueFormatter = valueFormatter || brl;
  const allVals = series.flatMap(s=>s.values);
  const maxVal = Math.max(1, ...allVals);
  const minVal = Math.min(0, ...allVals);
  const W=640, H=height, padL=10, padR=10, padT=14, padB=26;
  const plotW=W-padL-padR, plotH=H-padT-padB;
  const n = labels.length;
  const xStep = n>1 ? plotW/(n-1) : 0;
  const range = (maxVal-minVal)||1;
  function yFor(v){ return padT + plotH - ((v-minVal)/range)*plotH; }
  function xFor(i){ return padL + i*xStep; }
  let linesHTML='', pointsHTML='';
  series.forEach(s=>{
    const pts = s.values.map((v,i)=>`${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(' ');
    linesHTML += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" style="animation:lineDraw .6s ease;"></polyline>`;
    s.values.forEach((v,i)=>{
      pointsHTML += `<circle cx="${xFor(i).toFixed(1)}" cy="${yFor(v).toFixed(1)}" r="4" fill="${s.color}" data-label="${esc(labels[i])}${series.length>1?' · '+esc(s.name):''}" data-value="${esc(valueFormatter(v))}" onmousemove="ChartTooltip.showEl(event,this)" onmouseleave="ChartTooltip.hide()"></circle>`;
    });
  });
  const step = Math.max(1, Math.ceil(n/7));
  const labelsHTML = labels.map((lab,i)=>{
    if(i%step!==0 && i!==n-1) return '';
    return `<text x="${xFor(i).toFixed(1)}" y="${H-8}" text-anchor="middle" class="chart-axis-label">${esc(lab)}</text>`;
  }).join('');
  const legendHTML = series.length>1 ? `<div class="chart-legend">${series.map(s=>`<span class="chart-legend-item"><span class="dot" style="background:${s.color}"></span>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `<div class="chart-block"><svg class="line-chart-svg" viewBox="0 0 ${W} ${H}">${linesHTML}${pointsHTML}${labelsHTML}</svg>${legendHTML}</div>`;
}

/* ---------------- histórico de patrimônio (para o gráfico de evolução) ---------------- */
function recordPatrimonioSnapshot(){
  if(!S.data || !S.data.patrimonioHistorico) return;
  const key = monthKey(todayYM().y, todayYM().m);
  S.data.patrimonioHistorico[key] = patrimonioTotal();
}
function last12MonthsKeys(){
  const {y,m} = todayYM();
  const out = [];
  for(let i=11;i>=0;i--) out.push(shiftYM(monthKey(y,m), -i));
  return out;
}
