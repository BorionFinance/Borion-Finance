/* Borion Finance — Tela Orçamento/Receitas/Despesas, filtros e modais de lançamentos. */

/* ---------------- VIEW: BUDGET ---------------- */
function renderBudget(){
  // V6.1 — aba "Central": consulta unificada de todas as movimentações do perfil (recursos
  // à parte, não toca nas abas Receita/Despesa fixa/Despesa variável já existentes abaixo).
  if(S.budgetTab==='central') return renderCentralLancamentos();
  const rec = receitaMes(), desp = despesasMes(), inv = investirPlanejado();
  const saldo = saldoMes();
  const tab = S.budgetTab;
  const filt = S.filters[tab];
  const hasDateRange = !!(filt.dataDe && filt.dataAte);
  const hasFilter = !!(filt.busca || filt.categorias.length || hasDateRange);
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
        fixasAtivasNoMes(y,m).forEach(f=>{
          if(!agg.has(f.id)) agg.set(f.id, {f, total:0, ocorrencias:0});
          const e = agg.get(f.id); e.total += Number(f.valor||0); e.ocorrencias += 1;
        });
      });
      const allEntries = Array.from(agg.values());
      const catTotals={};
      allEntries.forEach(e=> catTotals[e.f.categoria]=(catTotals[e.f.categoria]||0)+e.total);
      segments = Object.keys(catTotals).map(k=>({label:k,value:catTotals[k],color:catColor(k)}));
      const list = allEntries.filter(e=>matchesFilter(e.f.nome,e.f.categoria)).sort((a,b)=>a.f.nome.localeCompare(b.f.nome,'pt-BR'));
      total = list.reduce((a,e)=>a+e.total,0);
      rows = list.map(e=>`
        <tr>
          <td>${e.ocorrencias}x</td>
          <td>${esc(e.f.nome)}<div style="font-size:10.5px;color:var(--muted)">recorrente desde ${shortMonthLabel(e.f.startMonth)}</div>${e.f.viaParcelaId?`<span class="cat-pill" style="opacity:.8;margin-top:3px;"><span class="dot" style="background:var(--gold-bright)"></span>🔗 Via cartão</span>`:e.f.viaBoletoId?`<span class="cat-pill" style="opacity:.8;margin-top:3px;"><span class="dot" style="background:var(--gold-bright)"></span>🔗 Via boleto</span>`:''}</td>
          <td><span class="cat-pill"><span class="dot" style="background:${catColor(e.f.categoria)}"></span>${esc(e.f.categoria)}</span></td>
          <td class="val-neg">- ${brl(e.total)}</td>
          <td class="tbl-actions"><button onclick="Budget.edit('${e.f.id}')">✎</button></td>
        </tr>`).join('');
      listLength = list.length;
    } else {
      const allActive = fixasAtivasNoMes(S.month.y,S.month.m);
      const catTotals={};
      allActive.forEach(f=> catTotals[f.categoria]=(catTotals[f.categoria]||0)+Number(f.valor||0));
      segments = Object.keys(catTotals).map(k=>({label:k,value:catTotals[k],color:catColor(k)}));
      let list = hasFilter ? allActive.filter(f=>matchesFilter(f.nome,f.categoria)) : allActive.slice();
      list.sort((a,b)=>(a.dia||1)-(b.dia||1));
      total = sumBy(list,'valor');
      const mesKeyAtual = monthKey(S.month.y,S.month.m);
      rows = list.map(f=>{
        const status = fixaOcorrenciaStatus(f, mesKeyAtual);
        const statusCls = status==='Pago'?'ok':status==='Vencido'?'bad':'neutral';
        const origemBox = f.origemPagamento==='reserva' ? findReservaBoxById(f.reservaOrigemId) : null;
        const origemPill = f.origemPagamento==='reserva' ? ` <span class="cat-pill" style="background:rgba(240,194,110,.15);color:var(--gold-bright);"><span class="dot" style="background:var(--gold-bright)"></span>◈ Reserva${origemBox?': '+esc(origemBox.nome):' (removida)'}</span>` : '';
        const isLinked = !!(f.viaParcelaId || f.viaBoletoId);
        return `
        <tr>
          <td>Dia ${f.dia||1}</td>
          <td>${esc(f.nome)}<div style="font-size:10.5px;color:var(--muted)">recorrente desde ${shortMonthLabel(f.startMonth)}</div>${f.viaParcelaId?`<span class="cat-pill" style="opacity:.8;margin-top:3px;"><span class="dot" style="background:var(--gold-bright)"></span>🔗 Via cartão</span>`:f.viaBoletoId?`<span class="cat-pill" style="opacity:.8;margin-top:3px;"><span class="dot" style="background:var(--gold-bright)"></span>🔗 Via boleto</span>`:''}${origemPill}</td>
          <td><span class="cat-pill"><span class="dot" style="background:${catColor(f.categoria)}"></span>${esc(f.categoria)}</span></td>
          <td class="val-neg">- ${brl(f.valor)}</td>
          <td><span class="cheque-status ${statusCls}">${status}</span></td>
          <td class="tbl-actions">${isLinked?'':`<button onclick="Budget.toggleFixaPago('${f.id}')" title="${status==='Pago'?'Desfazer pagamento':'Marcar como paga'}">${status==='Pago'?'↺':'✔'}</button>`}<button onclick="Budget.edit('${f.id}')">✎</button></td>
        </tr>`;
      }).join('');
      listLength = list.length;
    }
  } else {
    const source = hasDateRange
      ? S.data.transacoes.filter(t=>t.tipo===tab && bankMatches(t.banco) && t.data>=filt.dataDe && t.data<=filt.dataAte)
      : txInMonth(S.data.transacoes.filter(t=>t.tipo===tab), S.month.y, S.month.m).filter(t=>bankMatches(t.banco));
    const catTotals={};
    source.forEach(t=>catTotals[t.categoria]=(catTotals[t.categoria]||0)+Number(t.valor||0));
    segments = Object.keys(catTotals).map(k=>({label:k,value:catTotals[k],color:catColor(k)}));
    let list = hasFilter ? source.filter(t=>matchesFilter(t.nome,t.categoria)) : source.slice();
    list.sort((a,b)=> a.data<b.data?-1:1);
    total = sumBy(list,'valor');
    if(tab==='receita'){
      list.forEach(t=>{ if(t.origem==null||t.origem==='propria') receitaPropriaTotal+=Number(t.valor)||0; else receitaExtraTotal+=Number(t.valor)||0; });
    }
    rows = list.map(t=>{
      const origemKey = t.origem||'propria';
      const origemPill = (tab==='receita' && origemKey!=='propria') ? ` <span class="cat-pill" style="background:rgba(240,194,110,.15);color:var(--gold-bright);"><span class="dot" style="background:var(--gold-bright)"></span>${esc(txOrigemToLabel(origemKey))}</span>` : '';
      const formaPill = (tab==='variavel' && t.formaPagamento) ? ` <span class="cat-pill" style="opacity:.8;"><span class="dot" style="background:var(--muted)"></span>${esc(t.formaPagamento)}</span>` : '';
      const parcelaPill = (tab==='variavel' && Number(t.parcelaTotal||0)>1 && Number(t.parcelaAtual||0)>0) ? ` <span class="cat-pill" style="opacity:.8;"><span class="dot" style="background:var(--gold-bright)"></span>Parcela ${Number(t.parcelaAtual)}/${Number(t.parcelaTotal)}</span>` : '';
      const viaCartaoPill = t.viaParcelaId ? ` <span class="cat-pill" style="opacity:.8;"><span class="dot" style="background:var(--gold-bright)"></span>🔗 Via cartão</span>` : (t.viaBoletoId ? ` <span class="cat-pill" style="opacity:.8;"><span class="dot" style="background:var(--gold-bright)"></span>🔗 Via boleto</span>` : '');
      const reservaOrigemBox = (tab==='variavel' && t.origemPagamento==='reserva' && t.reservaOrigemId) ? ((S.data.reservas&&S.data.reservas.boxes)||[]).find(r=>r.id===t.reservaOrigemId) : null;
      const origemReservaPill = (tab==='variavel' && t.origemPagamento==='reserva') ? ` <span class="cat-pill" style="background:rgba(240,194,110,.15);color:var(--gold-bright);"><span class="dot" style="background:var(--gold-bright)"></span>◈ Pago com Reserva${reservaOrigemBox?': '+esc(reservaOrigemBox.nome):''}</span>` : '';
      return `
      <tr>
        <td>${t.data.slice(8,10)}/${t.data.slice(5,7)}</td>
        <td>${esc(t.nome)}${origemPill}${origemReservaPill}${formaPill}${parcelaPill}${viaCartaoPill}</td>
        <td><span class="cat-pill"><span class="dot" style="background:${catColor(t.categoria)}"></span>${esc(t.categoria)}</span></td>
        <td class="${tab==='receita'?'val-pos':'val-neg'}">${tab==='receita'?'':'- '}${brl(t.valor)}</td>
        <td class="tbl-actions"><button onclick="Budget.edit('${t.id}')">✎</button></td>
      </tr>`;}).join('');
    listLength = list.length;
  }

  const filterCount = (filt.busca?1:0) + filt.categorias.length + (hasDateRange?1:0);
  const periodoLabel = hasDateRange ? `${filt.dataDe.slice(8,10)}/${filt.dataDe.slice(5,7)}/${filt.dataDe.slice(0,4)} até ${filt.dataAte.slice(8,10)}/${filt.dataAte.slice(5,7)}/${filt.dataAte.slice(0,4)}` : '';

  return `
    <div class="cards-row">
      <div class="card"><div class="clabel">${tagBadgeHTML('receita','RECEITA')}</div><div class="cval" style="color:${iconColor('receita')}">${brl(rec)}</div></div>
      <div class="card"><div class="clabel">${tagBadgeHTML('investir','INVESTIR')}</div><div class="cval">${brl(inv)}</div><div style="margin-top:8px;"><button class="adjust-link" onclick="Budget.adjustInvest()">Ajustar ✎</button></div></div>
      <div class="card"><div class="clabel">${tagBadgeHTML('despesas','DESPESAS')}</div><div class="cval">${brl(desp)}</div></div>
      <div class="card"><div class="clabel">${tagBadgeHTML('saldo','SALDO')}</div><div class="cval">${brl(saldo)}</div></div>
    </div>
    <div class="tabs">
      <button class="tab-btn ${tab==='receita'?'active':''}" onclick="Budget.tab('receita')">Receita</button>
      <button class="tab-btn ${tab==='fixa'?'active':''}" onclick="Budget.tab('fixa')">Despesa fixa</button>
      <button class="tab-btn ${tab==='variavel'?'active':''}" onclick="Budget.tab('variavel')">Despesa variável</button>
      <button class="tab-btn" onclick="Budget.tab('central')">⌕ Central</button>
    </div>
    <div class="grid2">
      <div class="panel-box">
        <div class="toolbar">
          <div class="toolbar-left">${tab==='receita'?'Receita':tab==='fixa'?'Despesas fixas':'Despesas variáveis'}</div>
          <div class="toolbar-right">
            <button class="btn-outline ${filterCount?'filter-active':''}" onclick="Budget.openFilter()">⌕ Filtro${filterCount?' ('+filterCount+')':''}</button>
            <button class="btn-outline" onclick="Budget.add()">+ Adicionar</button>
          </div>
        </div>
        ${hasDateRange?`<div class="tbl-foot" style="opacity:.85;margin-bottom:6px;"><span>📅 Período: ${periodoLabel}</span><button class="link-btn" style="padding:0;" onclick="Budget.clearPeriodo()">Limpar período</button></div>`:''}
        ${listLength? `
        <table>
          <thead><tr><th>${tab==='fixa'?fixaColLabel:'Data'}</th><th>Nome</th><th>Categoria</th><th>Valor</th>${(tab==='fixa'&&!hasDateRange)?'<th>Status</th>':''}<th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="tbl-foot"><span>Total${hasFilter?' filtrado':''}</span><span class="v">${brl(total)}</span></div>
        ${tab==='receita' && receitaExtraTotal>0 ? `
        <div class="tbl-foot" style="opacity:.85;"><span>· Receita própria (conta como renda)</span><span class="v">${brl(receitaPropriaTotal)}</span></div>
        <div class="tbl-foot" style="opacity:.85;"><span>· Reembolso/repasse (não conta como renda)</span><span class="v">${brl(receitaExtraTotal)}</span></div>` : ''}
        ` : `<div class="empty-note">Nenhum lançamento encontrado${hasFilter?' com esse filtro':' neste mês'}.</div>`}
      </div>
      <div class="panel-box">
        <div class="panel-title">Composição por categoria</div>
        ${renderDonut(segments)}
      </div>
    </div>
  `;
}

/* =========================================================================================
   V6.1 — "Central" de Lançamentos: consulta unificada de receitas, despesas fixas,
   despesas variáveis, transferências, movimentações de reserva e estornos, com filtros
   completos. Não substitui nem altera as abas Receita/Despesa fixa/Despesa variável já
   existentes acima — é uma visão adicional, só de consulta (os botões de editar continuam
   levando ao formulário de origem de cada tipo, sem duplicar a lógica de edição).
========================================================================================= */
function centralAllCategorias(){
  const set = new Set();
  ['receita','fixa','variavel'].forEach(k=> (S.data.categorias[k]||[]).forEach(c=>set.add(c)));
  return Array.from(set).sort((a,b)=>a.localeCompare(b,'pt-BR'));
}
function centralBuildEntries(){
  const boxesById = {}; ((S.data.reservas&&S.data.reservas.boxes)||[]).forEach(b=>boxesById[b.id]=b);
  const entries = [];
  (S.data.transacoes||[]).filter(t=>t.tipo==='receita').forEach(t=>{
    entries.push({id:'rc_'+t.id, tipo:'receita', data:t.data||'', nome:t.nome||'Receita', categoria:t.categoria||'', valor:Number(t.valor)||0, sinal:1, origem:'', reservaId:null, reservaNome:'', conta:t.banco||'', status:'Pago', descricao:t.nome||'', refType:'transacao', refId:t.id});
  });
  (S.data.transacoes||[]).filter(t=>t.tipo==='variavel').forEach(t=>{
    const isReserva = t.origemPagamento==='reserva';
    const box = isReserva && t.reservaOrigemId ? boxesById[t.reservaOrigemId] : null;
    entries.push({id:'vr_'+t.id, tipo:'variavel', data:t.data||'', nome:t.nome||'Despesa variável', categoria:t.categoria||'', valor:Number(t.valor)||0, sinal:-1, origem:isReserva?'reserva':'conta', reservaId:box?box.id:null, reservaNome:box?box.nome:'', conta:t.banco||'', status:'Pago', descricao:t.nome||'', refType:'transacao', refId:t.id});
  });
  // Ocorrências de despesa fixa: janela de 24 meses passados + 2 futuros a partir de hoje,
  // mais qualquer ocorrência já registrada em fixaPagamentos fora dessa janela (histórico).
  const janela = new Set(monthsAroundToday(24,2).map(mm=>mm.key));
  (S.data.fixaPagamentos||[]).forEach(r=>janela.add(r.mesKey));
  (S.data.fixas||[]).forEach(f=>{
    janela.forEach(key=>{
      if(!(f.startMonth<=key && (!f.endMonth || key<=f.endMonth))) return;
      const dueDate = key+'-'+pad2(f.dia||1);
      const rec = fixaOcorrenciaFor(f.id, key);
      const status = fixaOcorrenciaStatus(f, key);
      const valor = (rec&&rec.pago) ? (Number(rec.valorPago)||Number(f.valor)||0) : (Number(f.valor)||0);
      const origemUsada = rec ? rec.origemPagamento : (f.origemPagamento||'conta');
      const reservaIdUsada = origemUsada==='reserva' ? (rec?rec.reservaId:f.reservaOrigemId) : null;
      const box = reservaIdUsada ? boxesById[reservaIdUsada] : null;
      entries.push({id:'fx_'+f.id+'_'+key, tipo:'fixa', data:dueDate, nome:f.nome||'Despesa fixa', categoria:f.categoria||'', valor, sinal:-1, origem:origemUsada==='reserva'?'reserva':'conta', reservaId:box?box.id:null, reservaNome:box?box.nome:'', conta:f.banco||'', status, descricao:f.nome||'', refType:'fixa', refId:f.id, mesKey:key});
    });
  });
  (S.data.transferencias||[]).forEach(t=>{
    const envolveReserva = t.origemTipo==='reserva' || t.destinoTipo==='reserva';
    const reservaId = t.origemTipo==='reserva' ? t.origemId : (t.destinoTipo==='reserva' ? t.destinoId : null);
    entries.push({id:'tr_'+t.id, tipo:'transferencia', data:t.data||'', nome:(t.origemNome||t.origemId||'?')+' → '+(t.destinoNome||t.destinoId||'?'), categoria:'', valor:Number(t.valor)||0, sinal:0, origem:envolveReserva?'reserva':'conta', reservaId, reservaNome:reservaId&&boxesById[reservaId]?boxesById[reservaId].nome:'', conta:t.origemTipo==='conta'?t.origemId:(t.destinoTipo==='conta'?t.destinoId:''), status:'Transferido', descricao:t.descricao||'', refType:'transferencia', refId:t.id});
  });
  ((S.data.reservas&&S.data.reservas.moves)||[]).forEach(m=>{
    const box = boxesById[m.boxId];
    const positive = Reservas.POSITIVE_TYPES.includes(m.tipo);
    const negative = Reservas.NEGATIVE_TYPES.includes(m.tipo);
    entries.push({id:'mv_'+m.id, tipo:'reserva_mov', data:m.data||'', nome:m.tipo, categoria:'', valor:Number(m.valor)||0, sinal:positive?1:(negative?-1:0), origem:'reserva', reservaId:m.boxId, reservaNome:box?box.nome:'Reserva removida', conta:m.banco||'', status:'Transferido', descricao:m.descricao||'', refType:'reserva_move', refId:m.id});
  });
  (S.data.estornos||[]).forEach(e=>{
    entries.push({id:'es_'+e.id, tipo:'estorno', data:e.data||'', nome:e.nome||'Estorno', categoria:'', valor:Number(e.valor)||0, sinal:1, origem:'reserva', reservaId:e.reservaId||null, reservaNome:e.reservaNome||'', conta:e.banco||'', status:'Estornado', descricao:e.descricao||'', refType:'estorno', refId:e.refId||e.id});
  });
  return entries;
}
const CENTRAL_TIPO_LABELS = {receita:'Receita', fixa:'Despesa fixa', variavel:'Despesa variável', transferencia:'Transferência', reserva_mov:'Movimentação de reserva', estorno:'Estorno'};
function centralFilterAndSort(){
  const f = S.filters.central;
  let list = centralBuildEntries();
  if(f.tipo==='todos') list = list.filter(e=>e.tipo!=='reserva_mov');
  else if(f.tipo==='reserva') list = list.filter(e=>e.tipo==='reserva_mov');
  else list = list.filter(e=>e.tipo===f.tipo);
  if(f.origem!=='todas') list = list.filter(e=>e.origem===f.origem);
  if(f.reservaId) list = list.filter(e=>e.reservaId===f.reservaId);
  if(f.contaId) list = list.filter(e=>e.conta===f.contaId);
  if(f.status!=='todos') list = list.filter(e=>e.status===f.status);
  if(f.categoria) list = list.filter(e=>e.categoria && e.categoria===f.categoria); // sem categoria nunca é excluído por erro — só fica de fora quando o filtro pede uma categoria específica
  const range = computePeriodoRange(f.periodo, f.dataDe, f.dataAte);
  if(range.de) list = list.filter(e=>e.data && e.data>=range.de);
  if(range.ate) list = list.filter(e=>e.data && e.data<=range.ate);
  const q = (f.busca||'').trim().toLowerCase();
  if(q){
    list = list.filter(e=>{
      const haystack = [e.nome, e.descricao, e.categoria, e.reservaNome, e.conta].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }
  const sortFns = {
    data_desc:(a,b)=>String(b.data).localeCompare(String(a.data)),
    data_asc:(a,b)=>String(a.data).localeCompare(String(b.data)),
    valor_desc:(a,b)=>b.valor-a.valor,
    valor_asc:(a,b)=>a.valor-b.valor,
    alfa:(a,b)=>a.nome.localeCompare(b.nome,'pt-BR')
  };
  list.sort(sortFns[f.sort] || sortFns.data_desc);
  return list;
}
function centralActiveFilterChips(){
  const f = S.filters.central;
  const chips = [];
  if(f.tipo!=='todos') chips.push({key:'tipo', label:'Tipo: '+(CENTRAL_TIPO_LABELS[f.tipo]||f.tipo)});
  if(f.origem!=='todas') chips.push({key:'origem', label:'Origem: '+(f.origem==='reserva'?'Reserva':'Conta')});
  if(f.reservaId){ const bx=findReservaBoxById(f.reservaId); chips.push({key:'reservaId', label:'Reserva: '+(bx?bx.nome:'—')}); }
  if(f.contaId) chips.push({key:'contaId', label:'Conta: '+f.contaId});
  if(f.status!=='todos') chips.push({key:'status', label:'Status: '+f.status});
  if(f.categoria) chips.push({key:'categoria', label:'Categoria: '+f.categoria});
  if(f.periodo!=='todos'){ const opt=PERIODO_QUICK_OPTIONS.find(o=>o.v===f.periodo); chips.push({key:'periodo', label:'Período: '+(opt?opt.l:f.periodo)}); }
  if(f.busca) chips.push({key:'busca', label:'Busca: "'+f.busca+'"'});
  return chips;
}
function renderCentralLancamentos(){
  const all = centralFilterAndSort();
  const pageSize = S.centralPageSize||30;
  const list = all.slice(0, pageSize);
  const chips = centralActiveFilterChips();
  // V6.1 — totais do filtro: transferências internas nunca somam como receita nem despesa
  // no resultado líquido (só aparecem no total "transferido" separado).
  let entradas=0, saidas=0, transferido=0;
  all.forEach(e=>{
    if(e.tipo==='transferencia') transferido += e.valor;
    else if(e.tipo==='receita') entradas += e.valor;
    else if((e.tipo==='fixa'||e.tipo==='variavel') && e.status==='Pago') saidas += e.valor;
  });
  const liquido = entradas - saidas;
  const categoriaOptions = centralAllCategorias();
  const reservaOptions = ((S.data.reservas&&S.data.reservas.boxes)||[]).filter(r=>bankMatches(r.banco));
  const contaOptions = allBankNames();
  const rows = list.map(e=>{
    const positive = e.sinal>0, negative = e.sinal<0;
    const statusCls = e.status==='Pago'?'ok':e.status==='Vencido'?'bad':e.status==='Estornado'?'warn':'neutral';
    const origemPill = e.origem ? ` <span class="cat-pill" style="opacity:.85;"><span class="dot" style="background:var(--gold-bright)"></span>${e.origem==='reserva'?'◈ Reserva'+(e.reservaNome?': '+esc(e.reservaNome):''):'Conta'}</span>` : '';
    return `<tr>
      <td>${e.data?reservaFmtDate(e.data):'—'}</td>
      <td>${CENTRAL_TIPO_LABELS[e.tipo]||e.tipo}</td>
      <td>${esc(e.nome)}${origemPill}</td>
      <td>${e.categoria?esc(e.categoria):''}</td>
      <td class="${positive?'val-pos':negative?'val-neg':''}">${positive?'+ ':negative?'- ':''}${brl(e.valor)}</td>
      <td>${esc(e.conta||'')}</td>
      <td><span class="cheque-status ${statusCls}">${e.status}</span></td>
      <td class="tbl-actions">${centralOpenButtonHTML(e)}</td>
    </tr>`;
  }).join('');
  return `
    <div class="cards-row">
      <div class="card"><div class="clabel">Entradas (filtro)</div><div class="cval val-pos">${brl(entradas)}</div></div>
      <div class="card"><div class="clabel">Saídas (filtro)</div><div class="cval">${brl(saidas)}</div></div>
      <div class="card"><div class="clabel">Transferências internas</div><div class="cval">${brl(transferido)}</div></div>
      <div class="card"><div class="clabel">Resultado líquido</div><div class="cval" style="color:${liquido>=0?'var(--green)':'#ef4444'}">${brl(liquido)}</div></div>
    </div>
    <div class="tabs">
      <button class="tab-btn" onclick="Budget.tab('receita')">Receita</button>
      <button class="tab-btn" onclick="Budget.tab('fixa')">Despesa fixa</button>
      <button class="tab-btn" onclick="Budget.tab('variavel')">Despesa variável</button>
      <button class="tab-btn active">⌕ Central</button>
    </div>
    <div class="panel-box">
      <div class="toolbar">
        <div class="toolbar-left">Central de lançamentos${chips.length?' — '+chips.length+' filtro'+(chips.length>1?'s':'')+' ativo'+(chips.length>1?'s':''):''}</div>
        <div class="toolbar-right">
          <button class="btn-outline ${chips.length?'filter-active':''}" onclick="Budget.centralOpenFilters()">⌕ Filtros${chips.length?' ('+chips.length+')':''}</button>
          <select id="cnt_sort" class="btn-outline" style="padding:9px 10px;" onchange="Budget.centralSetSort(this.value)">
            ${[['data_desc','Data mais recente'],['data_asc','Data mais antiga'],['valor_desc','Maior valor'],['valor_asc','Menor valor'],['alfa','Ordem alfabética']].map(([v,l])=>`<option value="${v}" ${S.filters.central.sort===v?'selected':''}>${l}</option>`).join('')}
          </select>
          <button class="btn-outline" onclick="Budget.centralClear()">Limpar filtros</button>
        </div>
      </div>
      ${chips.length?`<div class="active-filter-chips">${chips.map(c=>`<span class="active-filter-chip">${esc(c.label)}<button onclick="Budget.centralRemoveChip('${c.key}')">&times;</button></span>`).join('')}</div>`:''}
      ${list.length?`
      <div class="table-scroll"><table>
        <thead><tr><th>Data</th><th>Tipo</th><th>Nome</th><th>Categoria</th><th>Valor</th><th>Conta/Banco</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <div class="tbl-foot"><span>Mostrando ${list.length} de ${all.length}</span>${all.length>list.length?`<button class="link-btn" onclick="Budget.centralLoadMore()">Carregar mais</button>`:''}</div>
      ` : `<div class="empty-note">Nenhuma movimentação encontrada com esse filtro.</div>`}
    </div>
  `;
}
function centralOpenButtonHTML(e){
  if(e.refType==='fixa') return `<button onclick="Budget.tab('fixa');setTimeout(()=>Budget.edit('${e.refId}'),0)">✎</button>`;
  if(e.refType==='transacao') return `<button onclick="Budget.tab('${e.tipo}');setTimeout(()=>Budget.edit('${e.refId}'),0)">✎</button>`;
  if(e.refType==='reserva_move') return `<button onclick="Reservas.editMove('${e.refId}')">✎</button>`;
  if(e.refType==='transferencia') return `<button onclick="S.view='cards';renderApp();">✎</button>`;
  return '';
}
function openCentralFilterModal(){
  const f = S.filters.central;
  const categoriaOptions = centralAllCategorias();
  const reservaOptions = ((S.data.reservas&&S.data.reservas.boxes)||[]).filter(r=>bankMatches(r.banco));
  const contaOptions = allBankNames();
  const box = el(`
    <div class="modal-overlay">
      <div class="modal-box">
        <div class="modal-head"><h2>Filtros — Central de lançamentos</h2><button id="cf_close">&times;</button></div>
        <div class="field"><label>Tipo de movimentação</label><select id="cf_tipo">
          <option value="todos" ${f.tipo==='todos'?'selected':''}>Todos</option>
          <option value="receita" ${f.tipo==='receita'?'selected':''}>Receitas</option>
          <option value="fixa" ${f.tipo==='fixa'?'selected':''}>Despesas fixas</option>
          <option value="variavel" ${f.tipo==='variavel'?'selected':''}>Despesas variáveis</option>
          <option value="transferencia" ${f.tipo==='transferencia'?'selected':''}>Transferências</option>
          <option value="reserva" ${f.tipo==='reserva'?'selected':''}>Movimentações de reservas</option>
          <option value="estorno" ${f.tipo==='estorno'?'selected':''}>Estornos</option>
        </select></div>
        <div class="field"><label>Origem do pagamento</label><select id="cf_origem">
          <option value="todas" ${f.origem==='todas'?'selected':''}>Todas</option>
          <option value="conta" ${f.origem==='conta'?'selected':''}>Conta bancária / carteira</option>
          <option value="reserva" ${f.origem==='reserva'?'selected':''}>Reserva / cofrinho</option>
        </select></div>
        <div class="field"><label>Reserva</label><select id="cf_reserva">
          <option value="">Todas as reservas</option>
          ${reservaOptions.map(r=>`<option value="${r.id}" ${f.reservaId===r.id?'selected':''}>${esc(r.nome)}</option>`).join('')}
        </select></div>
        <div class="field"><label>Conta</label><select id="cf_conta">
          <option value="">Todas as contas</option>
          ${contaOptions.map(c=>`<option value="${esc(c)}" ${f.contaId===c?'selected':''}>${esc(c)}</option>`).join('')}
        </select></div>
        <div class="field"><label>Status</label><select id="cf_status">
          <option value="todos" ${f.status==='todos'?'selected':''}>Todos</option>
          <option value="Pago" ${f.status==='Pago'?'selected':''}>Pago</option>
          <option value="Pendente" ${f.status==='Pendente'?'selected':''}>Pendente</option>
          <option value="Vencido" ${f.status==='Vencido'?'selected':''}>Vencido</option>
          <option value="Estornado" ${f.status==='Estornado'?'selected':''}>Estornado</option>
          <option value="Transferido" ${f.status==='Transferido'?'selected':''}>Transferido</option>
        </select></div>
        <div class="field"><label>Categoria</label><select id="cf_categoria">
          <option value="">Todas as categorias</option>
          ${categoriaOptions.map(c=>`<option value="${esc(c)}" ${f.categoria===c?'selected':''}>${esc(c)}</option>`).join('')}
        </select></div>
        <div class="field"><label>Período</label><select id="cf_periodo">${PERIODO_QUICK_OPTIONS.map(o=>`<option value="${o.v}" ${f.periodo===o.v?'selected':''}>${o.l}</option>`).join('')}</select></div>
        <div id="cf_custom_wrap" class="${f.periodo==='personalizado'?'':'hidden'}" style="display:flex;gap:8px;">
          <div class="field" style="flex:1;"><label>De</label><input type="date" id="cf_de" value="${esc(f.dataDe||'')}"/></div>
          <div class="field" style="flex:1;"><label>Até</label><input type="date" id="cf_ate" value="${esc(f.dataAte||'')}"/></div>
        </div>
        <div class="field"><label>Buscar</label><input type="text" id="cf_busca" value="${esc(f.busca||'')}" placeholder="Nome, descrição, categoria, reserva, conta..."/></div>
        <div class="row-btns">
          <button class="btn btn-secondary" id="cf_limpar" style="flex:1;">Limpar</button>
          <button class="btn btn-primary" id="cf_aplicar" style="flex:1;">Aplicar</button>
        </div>
      </div>
    </div>`);
  $('#modal-root').innerHTML=''; $('#modal-root').appendChild(box);
  attachModalGuard(box);
  $('#cf_close').onclick = closeModal;
  $('#cf_periodo').onchange = ()=> $('#cf_custom_wrap').classList.toggle('hidden', $('#cf_periodo').value!=='personalizado');
  $('#cf_limpar').onclick = ()=>{
    S.filters.central = {tipo:'todos', origem:'todas', reservaId:'', contaId:'', periodo:'todos', dataDe:'', dataAte:'', status:'todos', categoria:'', busca:'', sort:S.filters.central.sort};
    S.centralPageSize = 30;
    closeModal(); renderView();
  };
  $('#cf_aplicar').onclick = ()=>{
    const dataDe = $('#cf_de').value||'', dataAte = $('#cf_ate').value||'';
    if($('#cf_periodo').value==='personalizado' && dataDe && dataAte && dataDe>dataAte){ alert('A data "de" não pode ser depois da data "até".'); return; }
    S.filters.central = Object.assign({}, S.filters.central, {
      tipo:$('#cf_tipo').value, origem:$('#cf_origem').value, reservaId:$('#cf_reserva').value,
      contaId:$('#cf_conta').value, status:$('#cf_status').value, categoria:$('#cf_categoria').value,
      periodo:$('#cf_periodo').value, dataDe, dataAte, busca:$('#cf_busca').value.trim()
    });
    S.centralPageSize = 30;
    closeModal(); renderView();
  };
}

const Budget = {
  tab(t){ S.budgetTab=t; renderView(); },
  add(){
    if(S.budgetTab==='fixa') openFixaModal(null);
    else openTransactionModal({type:S.budgetTab});
  },
  edit(id){
    if(S.budgetTab==='fixa'){
      const f = S.data.fixas.find(x=>x.id===id);
      /* V5.39.0 — despesa fixa espelhada de uma compra no cartão: edita/remove pela
         compra no cartão, pra nunca dessincronizar os dois lados do vínculo. */
      if(f && (f.viaParcelaId || f.viaBoletoId)){
        toast(f.viaParcelaId ? 'Essa despesa fixa vem de uma compra no cartão — edite ou remova em Cartões e Contas.' : 'Essa despesa fixa vem de um boleto — edite ou remova em Cartões e Contas.');
        S.view='cards'; renderApp();
        return;
      }
      openFixaModal(f);
    } else {
      const t = S.data.transacoes.find(x=>x.id===id);
      if(t && (t.viaParcelaId || t.viaBoletoId)){
        toast(t.viaParcelaId ? 'Essa despesa vem de uma compra no cartão — edite ou remova em Cartões e Contas.' : 'Essa despesa vem de um boleto — edite ou remova em Cartões e Contas.');
        S.view='cards'; renderApp();
        return;
      }
      openTransactionModal({type:t.tipo, existing:t});
    }
  },
  /* V6.1 — marca/desmarca a ocorrência do MÊS SELECIONADO como paga. Nunca afeta outras
     ocorrências (outros meses) da mesma despesa fixa — cada mês tem seu próprio estado. */
  toggleFixaPago(fixaId){
    const f = S.data.fixas.find(x=>x.id===fixaId);
    if(!f) return;
    if(f.viaParcelaId || f.viaBoletoId){ toast('Essa despesa fixa vem de uma compra no cartão/boleto — o pagamento é controlado em Cartões e Contas.'); return; }
    const mesKey = monthKey(S.month.y,S.month.m);
    const status = fixaOcorrenciaStatus(f, mesKey);
    if(status==='Pago') undoFixaOcorrencia(f, mesKey);
    else payFixaOcorrencia(f, mesKey);
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
  /* ---- V6.1 — Central de lançamentos: filtros, ordenação, paginação ---- */
  centralOpenFilters(){ openCentralFilterModal(); },
  centralSetSort(v){ S.filters.central.sort = v; renderView(); },
  centralClear(){
    S.filters.central = {tipo:'todos', origem:'todas', reservaId:'', contaId:'', periodo:'todos', dataDe:'', dataAte:'', status:'todos', categoria:'', busca:'', sort:S.filters.central.sort};
    S.centralPageSize = 30;
    renderView();
  },
  centralRemoveChip(key){
    const reset = {tipo:'todos', origem:'todas', reservaId:'', contaId:'', status:'todos', categoria:'', busca:''};
    if(key==='periodo'){ S.filters.central.periodo='todos'; S.filters.central.dataDe=''; S.filters.central.dataAte=''; }
    else if(key in reset) S.filters.central[key] = reset[key];
    renderView();
  },
  centralLoadMore(){ S.centralPageSize = (S.centralPageSize||30) + 30; renderView(); },
  clearPeriodo(){
    const tab = S.budgetTab;
    S.filters[tab] = Object.assign({}, S.filters[tab], {dataDe:'', dataAte:''});
    renderView();
  }
};

/* ---- modal de filtro: busca por nome + categorias (multi-seleção) + período (data de/até) ---- */
function openFilterModal(tab){
  const cats = S.data.categorias[tab];
  const current = S.filters[tab];
  const selected = new Set(current.categorias);
  const chipsHTML = cats.map(c=>`<button type="button" class="filter-chip-btn ${selected.has(c)?'active':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  const box = el(`
    <div class="modal-overlay">
      <div class="modal-box">
        <div class="modal-head"><h2>Filtrar</h2><button id="flt_close">&times;</button></div>
        <p class="modal-sub">Escolha as categorias, busque pelo nome e/ou filtre por período — o período pode incluir meses anteriores, sem depender do mês selecionado no topo.</p>
        <div class="field"><label>Buscar</label><input type="text" id="flt_busca" placeholder="Buscar por nome..." value="${esc(current.busca||'')}"/></div>
        <div class="field"><label>Categorias</label><div class="filter-chip-row" id="flt_chips">${chipsHTML}</div></div>
        <div class="field"><label>Período — de</label><input type="date" id="flt_data_de" value="${esc(current.dataDe||'')}"/></div>
        <div class="field"><label>Período — até</label><input type="date" id="flt_data_ate" value="${esc(current.dataAte||'')}"/></div>
        <div class="row-btns">
          <button class="btn btn-secondary" id="flt_limpar" style="flex:1;">Limpar</button>
          <button class="btn btn-secondary" id="flt_cancelar" style="flex:1;">Cancelar</button>
          <button class="btn btn-primary" id="flt_aplicar" style="flex:1;">Aplicar</button>
        </div>
      </div>
    </div>`);
  $('#modal-root').innerHTML=''; $('#modal-root').appendChild(box);
  attachModalGuard(box);
  $('#flt_close').onclick = closeModal;
  $('#flt_cancelar').onclick = closeModal;
  box.querySelectorAll('.filter-chip-btn').forEach(btn=>{
    btn.onclick = ()=>{
      const c = btn.dataset.cat;
      if(selected.has(c)){ selected.delete(c); btn.classList.remove('active'); }
      else { selected.add(c); btn.classList.add('active'); }
    };
  });
  $('#flt_limpar').onclick = ()=>{
    S.filters[tab] = {busca:'', categorias:[], dataDe:'', dataAte:''};
    closeModal(); renderView();
  };
  $('#flt_aplicar').onclick = ()=>{
    const dataDe = $('#flt_data_de').value || '';
    const dataAte = $('#flt_data_ate').value || '';
    if(dataDe && dataAte && dataDe>dataAte){ alert('A data "de" não pode ser depois da data "até".'); return; }
    S.filters[tab] = { busca: $('#flt_busca').value.trim(), categorias: Array.from(selected), dataDe, dataAte };
    closeModal(); renderView();
  };
}

/* ---- dedicated modal: one-off transaction (receita / despesa variável) ---- */
function reservaBoxesForLancamento(){
  return reservasEnabled() ? ((S.data.reservas && S.data.reservas.boxes)||[]).filter(r=>bankMatches(r.banco)) : [];
}
function reservaBoxLabel(r){ return `${r.nome}${r.banco?' · '+r.banco:''}`; }
function findReservaBoxByLabel(label){
  const boxes = reservaBoxesForLancamento();
  return boxes.find(r=>reservaBoxLabel(r)===label) || boxes[0] || null;
}
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
function getOrPeekFixaOcorrencia(fixaId, mesKey){ return fixaOcorrenciaFor(fixaId, mesKey); }

function payFixaOcorrencia(f, mesKey){
  if(!f) return;
  const jaExiste = fixaOcorrenciaFor(f.id, mesKey);
  if(jaExiste && jaExiste.pago){ toast('Essa ocorrência já está marcada como paga.'); return; } // proteção contra duplicidade
  const valor = Number(f.valor)||0;
  if((f.origemPagamento||'conta')==='reserva'){
    const box = findReservaBoxById(f.reservaOrigemId);
    if(!box){ toast('A reserva vinculada a esta despesa fixa não existe mais. Edite a despesa e escolha outra reserva.'); return; }
    if(!reservaTemSaldo(box, valor)){ showReservaInsuficienteModal(box, valor); return; }
    const mv = {id:uid(), boxId:box.id, tipo:'Pagamento de despesa fixa', data:todayISO(), valor, banco:box.banco||'', descricao:'Pagamento de despesa fixa — '+(f.nome||'Sem nome')+' — '+brlPlain(valor), despesaFixaId:f.id, fixaOcorrenciaId:null, createdAt:Date.now()};
    Reservas.applyMoveEffect(mv);
    S.data.reservas.moves.push(mv);
    const rec = jaExiste || {id:uid(), fixaId:f.id, mesKey};
    Object.assign(rec, {pago:true, origemPagamento:'reserva', reservaId:box.id, reservaMoveId:mv.id, valorPago:valor, banco:box.banco||'', pagoEm:Date.now()});
    mv.fixaOcorrenciaId = rec.id;
    if(!jaExiste) S.data.fixaPagamentos.push(rec);
    saveCurrentData(); renderView(); toast('Despesa fixa paga com a reserva "'+box.nome+'".');
  } else {
    const rec = jaExiste || {id:uid(), fixaId:f.id, mesKey};
    Object.assign(rec, {pago:true, origemPagamento:'conta', reservaId:null, reservaMoveId:null, valorPago:valor, banco:f.banco||'', pagoEm:Date.now()});
    if(!jaExiste) S.data.fixaPagamentos.push(rec);
    saveCurrentData(); renderView(); toast('Despesa fixa marcada como paga.');
  }
}
function undoFixaOcorrencia(f, mesKey){
  if(!f) return;
  const rec = fixaOcorrenciaFor(f.id, mesKey);
  if(!rec || !rec.pago) return; // nada para desfazer — já pendente (idempotente)
  if(rec.origemPagamento==='reserva' && rec.reservaMoveId){
    const box = findReservaBoxById(rec.reservaId);
    const mv = (S.data.reservas.moves||[]).find(m=>m.id===rec.reservaMoveId);
    if(box && mv){
      Reservas.reverseMoveEffect(mv);
      logEstorno({tipo:'fixa', refId:f.id, nome:f.nome, valor:rec.valorPago, reservaId:box.id, reservaNome:box.nome, banco:box.banco, descricao:'Estorno — devolução de "'+f.nome+'" para a reserva '+box.nome});
    }
    S.data.reservas.moves = (S.data.reservas.moves||[]).filter(m=>m.id!==rec.reservaMoveId);
  }
  S.data.fixaPagamentos = S.data.fixaPagamentos.filter(r=>r.id!==rec.id);
  saveCurrentData(); renderView(); toast('Despesa fixa voltou a pendente'+(rec.origemPagamento==='reserva'?' — valor devolvido à reserva.':'.'));
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
    return {ok:true, rec, commit(newFixaId){
      if(oldOrigem==='reserva' && oldMv){
        Reservas.reverseMoveEffect(oldMv);
        S.data.reservas.moves = (S.data.reservas.moves||[]).filter(m=>m.id!==oldMv.id);
      }
      Object.assign(rec, {fixaId:newFixaId, origemPagamento:'conta', reservaId:null, reservaMoveId:null, valorPago:novoValor});
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
    }
    const mv = {id:uid(), boxId:targetBox.id, tipo:'Pagamento de despesa fixa', data:todayISO(), valor:novoValor, banco:targetBox.banco||'', descricao:'Pagamento de despesa fixa — '+(novoNomeParaDescricao||'')+' — '+brlPlain(novoValor), despesaFixaId:newFixaId, fixaOcorrenciaId:rec.id, createdAt:Date.now()};
    Reservas.applyMoveEffect(mv);
    S.data.reservas.moves.push(mv);
    Object.assign(rec, {fixaId:newFixaId, origemPagamento:'reserva', reservaId:targetBox.id, reservaMoveId:mv.id, valorPago:novoValor});
  }};
}

function openTransactionModal({type, existing}){
  const isEdit = !!existing;
  const isReceita = type==='receita';
  const isDespesaVariavel = type==='variavel';
  const reservaBoxes = reservaBoxesForLancamento();
  const linkedBox = isReceita && isEdit && existing.reservaBoxId ? reservaBoxes.find(r=>r.id===existing.reservaBoxId) : null;
  const initialDestino = isReceita && isEdit && existing.reservaMoveId ? 'Reserva' : 'Conta livre';
  const reservaOptions = reservaBoxes.map(r=>`<option value="${esc(reservaBoxLabel(r))}" ${linkedBox&&linkedBox.id===r.id?'selected':''}>${esc(reservaBoxLabel(r))}</option>`).join('');
  const reservaHTML = isReceita && reservasEnabled() ? `
        <div class="reserve-destination-box" id="tm_reserva_wrap">
          <div class="field"><label>Destino da receita</label><select id="tm_destino">
            <option ${initialDestino==='Conta livre'?'selected':''}>Conta livre</option>
            <option ${initialDestino==='Reserva'?'selected':''}>Direto para reserva</option>
            <option>Dividir entre conta e reserva</option>
          </select></div>
          <div id="tm_reserva_fields" class="reserve-destination-fields hidden">
            ${reservaBoxes.length ? `
              <div class="field"><label>Reserva vinculada</label><select id="tm_reserva_box">${reservaOptions}</select></div>
              <div class="field"><label>Valor que vai para reserva</label><input type="text" inputmode="numeric" id="tm_reserva_valor" class="money-input" placeholder="0,00"/></div>
              <p class="modal-sub reserve-hint">Esse valor entra no orçamento como receita, mas também gera uma movimentação positiva na Reserva. Não vira despesa.</p>
            ` : `<p class="modal-sub reserve-hint">Crie uma reserva primeiro para enviar receita direto para ela.</p>`}
          </div>
        </div>` : '';
  /* V6.0 — despesa variável: "Origem do pagamento" (Conta ou Reserva). Escolhendo Reserva,
     o Borion desconta o valor direto da reserva escolhida e cria só a despesa — sem Receita,
     num único clique. Só aparece quando o módulo de Reserva está ativo e existe ao menos uma. */
  const podeOrigemPagamentoReserva = isDespesaVariavel && reservasEnabled() && reservaBoxes.length>0;
  const origemPagamentoInicial = (isDespesaVariavel && isEdit && existing.origemPagamento==='reserva') ? 'reserva' : 'conta';
  const origemPagamentoBoxSel = (isDespesaVariavel && isEdit && existing.reservaOrigemId) ? reservaBoxes.find(r=>r.id===existing.reservaOrigemId) : null;
  const origemPagamentoOptions = reservaBoxes.map(r=>`<option value="${esc(reservaBoxLabel(r))}" ${origemPagamentoBoxSel&&origemPagamentoBoxSel.id===r.id?'selected':''}>${esc(reservaBoxLabel(r))}</option>`).join('');
  const origemPagamentoHTML = podeOrigemPagamentoReserva ? `
        <div class="field">
          <label>Origem do pagamento</label>
          <div class="segmented-toggle" id="tm_origempg_group">
            <button type="button" class="seg-btn ${origemPagamentoInicial==='conta'?'active':''}" data-value="conta">Conta</button>
            <button type="button" class="seg-btn ${origemPagamentoInicial==='reserva'?'active':''}" data-value="reserva">Reserva</button>
          </div>
          <input type="hidden" id="tm_origempg" value="${origemPagamentoInicial}"/>
        </div>
        <div class="reserve-destination-box ${origemPagamentoInicial==='reserva'?'':'hidden'}" id="tm_reserva_pg_wrap">
          <div class="field"><label>Selecionar reserva</label><select id="tm_reserva_pg_box">${origemPagamentoOptions}</select></div>
          <p class="modal-sub reserve-hint">O valor sai direto do saldo dessa reserva. Não passa pela conta, não vira receita — é só o seu próprio dinheiro mudando de lugar.</p>
        </div>` : '';
  const box = el(`
    <div class="modal-overlay">
      <div class="modal-box">
        <div class="modal-head"><h2>${isEdit?'Editar':'Adicionar'} lançamento</h2><button id="tm_close">&times;</button></div>
        <div class="field"><label>Nome</label><input type="text" id="tm_nome" value="${isEdit?esc(existing.nome):''}"/></div>
        <div class="field"><label>Data</label><input type="date" id="tm_data" value="${isEdit?existing.data:monthKey(S.month.y,S.month.m)+'-01'}"/></div>
        ${categorySelectHTML('tm', type, isEdit?existing.categoria:null)}
        <div class="field"><label id="tm_valor_label">Valor (R$)</label><input type="text" inputmode="numeric" id="tm_valor" class="money-input" placeholder="0,00"/></div>
        ${origemPagamentoHTML}
        <div id="tm_conta_fields_wrap" class="${podeOrigemPagamentoReserva&&origemPagamentoInicial==='reserva'?'hidden':''}">
        ${!isReceita?`<div class="field" id="tm_forma_wrap"><label>Forma de pagamento</label><select id="tm_forma">${FORMAS_PAGAMENTO.map(f=>`<option value="${esc(f)}" ${isEdit&&(existing.formaPagamento||'Dinheiro')===f?'selected':''}>${esc(f)}</option>`).join('')}</select></div>`:''}
        <div class="field" id="tm_banco_wrap"><label>${isReceita?'Onde a receita entra':'De onde o dinheiro sai'}</label><select id="tm_banco"><option>— Nenhum —</option>${accountSelectNames().map(b=>`<option ${isEdit&&existing.banco===b?'selected':''}>${esc(b)}</option>`).join('')}</select></div>
        ${!isReceita?`
        <div id="tm_credito_fields" class="hidden">
          <div class="field"><label>Cartão de crédito</label><select id="tm_cartao">${allCardNames().map(c=>`<option>${esc(c)}</option>`).join('') || '<option value="">Nenhum cartão cadastrado</option>'}</select></div>
          <div class="field"><label>Tipo de compra</label><select id="tm_credito_tipo">
            <option value="avista">Crédito à vista</option>
            <option value="parcelado">Crédito parcelado</option>
          </select></div>
          <div class="field hidden" id="tm_parcelas_wrap"><label>Quantidade de parcelas <span id="tm_parcela_preview" style="color:var(--muted);font-weight:600;"></span></label><input type="number" id="tm_parcelas" min="2" step="1" value="2"/></div>
          <p class="modal-sub" style="margin:4px 0 0;">Compra no crédito não desconta o banco agora — ela vira uma compra vinculada ao cartão e entra na fatura, igual em "Cartões e Contas".</p>
        </div>`:''}
        </div>
        ${isReceita?`<div class="field"><label>Origem da receita</label><select id="tm_origem">${TX_ORIGEM_OPTIONS.map(o=>`<option ${txOrigemToKey(o)===(isEdit?(existing.origem||'propria'):'propria')?'selected':''}>${esc(o)}</option>`).join('')}</select><p class="modal-sub" style="margin:4px 0 0;">Reembolso e repasse de terceiros não entram na sua Receita do mês — é dinheiro que passa pela conta, não renda sua.</p></div>`:''}
        ${reservaHTML}
        <div class="row-btns"><button class="btn btn-primary btn-block" id="tm_save">${isEdit?'Salvar':'Adicionar'}</button></div>
        ${isEdit?`<div class="row-btns" style="margin-top:8px;"><button class="btn btn-danger btn-block" id="tm_delete">Excluir</button></div>`:''}
      </div>
    </div>`);
  $('#modal-root').innerHTML=''; $('#modal-root').appendChild(box);
  attachModalGuard(box);
  $('#tm_close').onclick = closeModal;
  attachMoneyMask($('#tm_valor'), isEdit?existing.valor:0);
  if(isReceita && $('#tm_reserva_valor')) attachMoneyMask($('#tm_reserva_valor'), isEdit?(existing.reservaValor||existing.valor||0):0);
  wireQuickCategory($('#tm_categoria'), $('#tm_newcat_box'), $('#tm_newcat_input'), $('#tm_newcat_add'), type);

  function syncReserveDestinationUI(){
    if(!isReceita || !$('#tm_destino')) return;
    const dest = $('#tm_destino').value;
    const fields = $('#tm_reserva_fields');
    if(!fields) return;
    const show = dest!=='Conta livre';
    fields.classList.toggle('hidden', !show);
    const valorReserva = $('#tm_reserva_valor');
    if(valorReserva){
      if(dest==='Direto para reserva'){
        valorReserva.disabled = true;
        const cents = parseInt($('#tm_valor').dataset.cents||'0',10);
        valorReserva.dataset.cents = String(cents);
        valorReserva.value = (cents/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
      } else {
        valorReserva.disabled = false;
      }
    }
  }
  if(isReceita && $('#tm_destino')){
    $('#tm_destino').onchange = syncReserveDestinationUI;
    $('#tm_valor').addEventListener('input', syncReserveDestinationUI);
    syncReserveDestinationUI();
  }

  /* V6.0 — alterna entre "pagar da Conta" (fluxo normal, com forma de pagamento/banco/
     crédito) e "pagar da Reserva" (esconde tudo isso e mostra só o seletor de reserva). */
  function syncOrigemPagamentoUI(){
    const hidden = $('#tm_origempg');
    if(!hidden) return;
    const isReserva = hidden.value==='reserva';
    const contaWrap = $('#tm_conta_fields_wrap');
    const reservaWrap = $('#tm_reserva_pg_wrap');
    if(contaWrap) contaWrap.classList.toggle('hidden', isReserva);
    if(reservaWrap) reservaWrap.classList.toggle('hidden', !isReserva);
    if(!isReserva && typeof syncFormaPagamentoUI==='function') syncFormaPagamentoUI();
  }
  if($('#tm_origempg_group')){
    $('#tm_origempg_group').querySelectorAll('.seg-btn').forEach(btn=>{
      btn.onclick = ()=>{
        $('#tm_origempg_group').querySelectorAll('.seg-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        $('#tm_origempg').value = btn.dataset.value;
        syncOrigemPagamentoUI();
      };
    });
  }

  function updateCreditoParcelPreview(){
    if(isReceita) return;
    const formaSel = $('#tm_forma');
    const tipoSel = $('#tm_credito_tipo');
    const label = $('#tm_valor_label');
    const preview = $('#tm_parcela_preview');
    const isCredito = formaSel && formaSel.value==='Crédito';
    if(label) label.textContent = isCredito ? 'Valor total da compra (R$)' : 'Valor (R$)';
    if(!preview || !isCredito || !tipoSel || tipoSel.value!=='parcelado'){
      if(preview) preview.textContent = '';
      return;
    }
    const cents = parseInt(($('#tm_valor') && $('#tm_valor').dataset.cents) || '0', 10);
    const total = cents/100;
    const qtd = Math.max(2, Math.round(Number(($('#tm_parcelas') && $('#tm_parcelas').value) || 2)));
    const valorParcela = qtd>0 ? Math.round((total/qtd)*100)/100 : 0;
    preview.textContent = `(${brlPlain(valorParcela)} cada)`;
  }

  /* V5.37.0 — despesa: a forma de pagamento manda no campo de banco/conta (e não o
     contrário). "Dinheiro" trava a Carteira, sem opção de trocar — Carteira é sempre
     dinheiro físico. "Pix"/"Débito" mostram só bancos reais (a Carteira não serve pra
     Pix/Débito). "Crédito" esconde o banco/carteira e mostra o cartão. */
  function syncFormaPagamentoUI(preferBanco){
    const formaSel = $('#tm_forma');
    if(!formaSel) return;
    const forma = formaSel.value;
    const bancoWrap = $('#tm_banco_wrap');
    const bancoSel = $('#tm_banco');
    const creditoFields = $('#tm_credito_fields');
    const isCredito = forma==='Crédito';
    if(bancoWrap) bancoWrap.classList.toggle('hidden', isCredito);
    if(creditoFields) creditoFields.classList.toggle('hidden', !isCredito);
    if(!isCredito && bancoSel){
      if(forma==='Dinheiro'){
        const carteira = getCarteiraConta();
        bancoSel.innerHTML = carteira ? `<option>${esc(carteira.nome)}</option>` : '<option value="">Carteira não encontrada</option>';
        bancoSel.value = carteira ? carteira.nome : '';
        bancoSel.disabled = true;
      } else {
        const names = nonCarteiraAccountNames();
        const wanted = (preferBanco && names.includes(preferBanco)) ? preferBanco : (names.includes(bancoSel.value) ? bancoSel.value : (names[0]||''));
        bancoSel.innerHTML = names.length ? names.map(n=>`<option ${n===wanted?'selected':''}>${esc(n)}</option>`).join('') : '<option value="">Cadastre um banco em Cartões e Contas</option>';
        bancoSel.value = wanted;
        bancoSel.disabled = false;
      }
    }
    const tipoSel = $('#tm_credito_tipo');
    const parcelasWrap = $('#tm_parcelas_wrap');
    if(parcelasWrap && tipoSel) parcelasWrap.classList.toggle('hidden', tipoSel.value!=='parcelado');
    updateCreditoParcelPreview();
  }
  if(!isReceita && $('#tm_forma')){
    $('#tm_forma').onchange = ()=>syncFormaPagamentoUI();
    const tipoSel = $('#tm_credito_tipo');
    if(tipoSel) tipoSel.onchange = ()=>syncFormaPagamentoUI();
    if($('#tm_parcelas')) $('#tm_parcelas').addEventListener('input', updateCreditoParcelPreview);
    if($('#tm_valor')) $('#tm_valor').addEventListener('input', updateCreditoParcelPreview);
    syncFormaPagamentoUI(isEdit?existing.banco:null);
  }

  $('#tm_save').onclick = ()=>{
    const nome = $('#tm_nome').value.trim() || 'Sem nome';
    const data = $('#tm_data').value || (monthKey(S.month.y,S.month.m)+'-01');
    const categoria = $('#tm_categoria').value;
    if(categoria==='__new__'){ alert('Confirme o nome da nova categoria antes de salvar.'); return; }
    const cents = parseInt($('#tm_valor').dataset.cents||'0',10);
    const valor = cents/100;

    /* V6.0 — se estava editando uma despesa paga direto de uma reserva, devolve o saldo
       ANTES de qualquer outra decisão (troca de origem, novo valor, etc.). Espelha o que já
       acontece com removeLinkedReservaMoveFromTransaction para receita → reserva. */
    if(isEdit && !isReceita && existing.origemPagamento==='reserva'){
      removeLinkedReservaWithdrawalFromDespesa(existing);
    }

    const origemPagamento = (isDespesaVariavel && $('#tm_origempg')) ? $('#tm_origempg').value : 'conta';
    if(isDespesaVariavel && origemPagamento==='reserva'){
      const reservaSel = $('#tm_reserva_pg_box') ? $('#tm_reserva_pg_box').value : '';
      const rbox = reservaBoxes.find(r=>reservaBoxLabel(r)===reservaSel) || reservaBoxes[0];
      if(!rbox){ toast('Escolha uma reserva válida.'); return; }
      if(valor<=0){ alert('Digite um valor maior que zero.'); return; }
      if(!reservaTemSaldo(rbox, valor)){ showReservaInsuficienteModal(rbox, valor); return; }
      let tx;
      if(isEdit){
        Object.assign(existing, {nome, data, categoria, valor, banco:rbox.banco||'', origemPagamento:'reserva', formaPagamento:null});
        tx = existing;
        toast('Despesa atualizada — paga direto da reserva.');
      } else {
        tx = {id:uid(), tipo:'variavel', nome, data, categoria, valor, banco:rbox.banco||'', origemPagamento:'reserva', formaPagamento:null};
        S.data.transacoes.push(tx);
        toast('Despesa paga direto da reserva "'+rbox.nome+'".');
      }
      createLinkedReservaWithdrawalFromDespesa(tx, rbox, valor);
      saveCurrentData(); closeModal(); renderView();
      return;
    }

    const formaPagamento = (!isReceita && $('#tm_forma')) ? $('#tm_forma').value : null;
    const isCreditoDespesa = formaPagamento==='Crédito';

    /* Crédito: não é uma transação de banco/conta — vira uma compra vinculada ao cartão
       (à vista = 1 parcela, parcelado = N parcelas), do mesmo jeito que "+ Compra
       parcelada" em Cartões e Contas. Não desconta banco/carteira no momento da compra.
       V5.39.0 — como essa tela é "Adicionar despesa", a compra sempre também aparece
       em Orçamento > Despesas (despesa variável), além de em Cartões e Contas. */
    if(isCreditoDespesa){
      const cartaoNome = $('#tm_cartao') ? $('#tm_cartao').value : '';
      const cartao = (S.data.cartoes||[]).find(c=>c.banco===cartaoNome);
      if(!cartao){ alert('Escolha um cartão de crédito válido. Cadastre um cartão em "Cartões e Contas" antes de lançar uma compra no crédito.'); return; }
      const tipoCredito = $('#tm_credito_tipo') ? $('#tm_credito_tipo').value : 'avista';
      const parcelaTotal = tipoCredito==='parcelado' ? Math.max(2, Math.round(Number($('#tm_parcelas').value)||2)) : 1;
      const valorParcela = Math.round((valor/parcelaTotal)*100)/100;
      if(isEdit){
        if(existing.tipo==='variavel'){
          const idx = S.data.transacoes.findIndex(x=>x.id===existing.id);
          if(idx>=0) S.data.transacoes.splice(idx,1);
        }
        if(existing.viaParcelaId && existing.viaCartaoId){
          // estava editando uma despesa espelhada de uma parcela — remove a parcela antiga
          // pra não duplicar a compra no cartão.
          const cartaoAntigo = S.data.cartoes.find(c=>c.id===existing.viaCartaoId);
          if(cartaoAntigo) cartaoAntigo.parcelas = cartaoAntigo.parcelas.filter(x=>x.id!==existing.viaParcelaId);
        }
      }
      const p = {id:uid(), descricao:nome, local:'', categoria:categoria||'Outro', valorParcela, parcelaTotal, dataCompra:(data||todayISO()).slice(0,7), diaEntrada:null, apareceDespesas:true, despesaTipo:'variavel', despesaTransacaoId:null, despesaTransacaoIds:[], despesaFixaId:null};
      cartao.parcelas.push(p);
      linkParcelaToDespesa(cartao, p);
      saveCurrentData(); closeModal(); renderView();
      toast('Compra no crédito lançada no cartão '+cartao.banco+' e em Despesas.');
      return;
    }

    const bancoVal = $('#tm_banco').value;
    const banco = requireBanco(bancoVal, isReceita ? 'Toda receita precisa de um banco/conta/carteira vinculado.' : 'Toda despesa precisa de um banco/conta/carteira vinculado.');
    if(!banco) return;
    const origem = (isReceita && $('#tm_origem')) ? txOrigemToKey($('#tm_origem').value) : undefined;
    let reservaBox = null, reservaValor = 0, destino = 'Conta livre';
    if(isReceita && $('#tm_destino')){
      destino = $('#tm_destino').value;
      if(destino!=='Conta livre'){
        reservaBox = findReservaBoxByLabel($('#tm_reserva_box') ? $('#tm_reserva_box').value : '');
        if(!reservaBox){ alert('Escolha uma reserva válida.'); return; }
        reservaValor = destino==='Direto para reserva' ? valor : (parseInt(($('#tm_reserva_valor')&&$('#tm_reserva_valor').dataset.cents)||'0',10)/100);
        if(reservaValor<=0 || reservaValor>valor){ alert('O valor destinado à reserva precisa ser maior que zero e não pode passar do valor da receita.'); return; }
      }
    }
    let tx;
    if(isEdit){
      removeLinkedReservaMoveFromTransaction(existing);
      Object.assign(existing, {nome, data, categoria, valor, banco});
      if(isReceita) existing.origem = origem;
      else { existing.formaPagamento = formaPagamento || 'Dinheiro'; existing.origemPagamento = 'conta'; }
      tx = existing;
      toast('Lançamento atualizado.');
    } else {
      tx = {id:uid(), tipo:type, nome, data, categoria, valor, banco};
      if(isReceita) tx.origem = origem;
      else { tx.formaPagamento = formaPagamento || 'Dinheiro'; tx.origemPagamento = 'conta'; }
      S.data.transacoes.push(tx);
      toast(isReceita && reservaBox ? 'Receita adicionada e enviada para reserva.' : 'Lançamento adicionado.');
    }
    if(isReceita && reservaBox){
      tx.destinoModo = destino;
      createLinkedReservaMoveFromTransaction(tx, reservaBox, reservaValor);
    }
    saveCurrentData(); closeModal(); renderView();
  };
  if(isEdit){
    $('#tm_delete').onclick = ()=>{
      const idx = S.data.transacoes.findIndex(x=>x.id===existing.id);
      if(idx<0) return;
      const snapshot = JSON.parse(JSON.stringify(S.data));
      removeLinkedReservaMoveFromTransaction(existing);
      removeLinkedReservaWithdrawalFromDespesa(existing); // V6.0 — devolve o saldo à reserva, se era pagamento direto
      S.data.transacoes.splice(idx,1);
      saveCurrentData(); closeModal(); renderView();
      showUndoToast('Lançamento excluído.', ()=>{ S.data = snapshot; saveCurrentData(); renderView(); });
    };
  }
}

/* ---- dedicated modal: recurring fixed expense (despesa fixa) ---- */
function openFixaModal(existing){
  const isEdit = !!existing;
  const monthKeyNow = monthKey(S.month.y,S.month.m);
  const carteira = getCarteiraConta();
  const initialForma = isEdit ? (existing.formaPagamento || (carteira && existing.banco===carteira.nome ? 'Dinheiro' : 'Pix')) : (nonCarteiraAccountNames().length ? 'Pix' : 'Dinheiro');
  /* V6.1 — "Origem do pagamento": de onde sai o dinheiro quando a ocorrência do mês for
     marcada como paga (Conta bancária/carteira ou Reserva/cofrinho). Cadastrar ou editar a
     despesa fixa aqui NUNCA move saldo — só define o padrão herdado pelas próximas
     ocorrências; o desconto de verdade só acontece em Budget.toggleFixaPago. */
  const reservaBoxesFixa = reservaBoxesForLancamento();
  const podeOrigemPagamentoReserva = reservasEnabled() && reservaBoxesFixa.length>0;
  const origemPagamentoInicial = (podeOrigemPagamentoReserva && isEdit && existing.origemPagamento==='reserva') ? 'reserva' : 'conta';
  const origemPagamentoBoxSel = (isEdit && existing.reservaOrigemId) ? reservaBoxesFixa.find(r=>r.id===existing.reservaOrigemId) : null;
  const origemPagamentoOptions = reservaBoxesFixa.map(r=>`<option value="${esc(reservaBoxLabel(r))}" ${origemPagamentoBoxSel&&origemPagamentoBoxSel.id===r.id?'selected':''}>${esc(reservaBoxLabel(r))}</option>`).join('');
  const box = el(`
    <div class="modal-overlay">
      <div class="modal-box">
        <div class="modal-head"><h2>${isEdit?'Editar':'Adicionar'} despesa fixa</h2><button id="fm_close">&times;</button></div>
        <p class="modal-sub">${isEdit? 'Alterações se aplicam a partir de '+monthLabel(S.month.y,S.month.m)+'; meses anteriores mantêm o valor antigo.' : 'Essa despesa se repete todos os meses a partir de '+monthLabel(S.month.y,S.month.m)+', até que você a remova. Ela fica só cadastrada até você marcar cada mês como pago — não retira dinheiro sozinha.'}</p>
        <div class="field"><label>Nome</label><input type="text" id="fm_nome" value="${isEdit?esc(existing.nome):''}"/></div>
        ${categorySelectHTML('fm', 'fixa', isEdit?existing.categoria:null)}
        <div class="field"><label id="fm_valor_label">Valor mensal (R$)</label><input type="text" inputmode="numeric" id="fm_valor" class="money-input" placeholder="0,00"/></div>
        <div class="field"><label>Dia do vencimento</label><input type="number" id="fm_dia" min="1" max="31" value="${isEdit?(existing.dia||1):1}"/></div>
        ${podeOrigemPagamentoReserva ? `
        <div class="field">
          <label>Origem do pagamento</label>
          <div class="segmented-toggle" id="fm_origempg_group">
            <button type="button" class="seg-btn ${origemPagamentoInicial==='conta'?'active':''}" data-value="conta">Conta bancária / carteira</button>
            <button type="button" class="seg-btn ${origemPagamentoInicial==='reserva'?'active':''}" data-value="reserva">Reserva / cofrinho</button>
          </div>
          <input type="hidden" id="fm_origempg" value="${origemPagamentoInicial}"/>
        </div>
        <div class="reserve-destination-box ${origemPagamentoInicial==='reserva'?'':'hidden'}" id="fm_reserva_pg_wrap">
          <div class="field"><label>Reserva</label><select id="fm_reserva_pg_box">${origemPagamentoOptions}</select></div>
          <p class="modal-sub reserve-hint">Cadastrar não desconta nada agora. O valor só sai dessa reserva quando você marcar cada mês como pago — e volta pra reserva se você desfazer o pagamento.</p>
        </div>` : ''}
        <div id="fm_conta_fields_wrap" class="${podeOrigemPagamentoReserva&&origemPagamentoInicial==='reserva'?'hidden':''}">
        <div class="field"><label>Forma de pagamento</label><select id="fm_forma">${FORMAS_PAGAMENTO.map(f=>`<option value="${esc(f)}" ${initialForma===f?'selected':''}>${esc(f)}</option>`).join('')}</select></div>
        <div class="field" id="fm_banco_wrap"><label>Banco/Conta</label><select id="fm_banco"><option>— Nenhum —</option>${accountSelectNames().map(b=>`<option ${isEdit&&existing.banco===b?'selected':''}>${esc(b)}</option>`).join('')}</select></div>
        <div id="fm_credito_fields" class="hidden">
          <div class="field"><label>Cartão de crédito</label><select id="fm_cartao">${allCardNames().map(c=>`<option>${esc(c)}</option>`).join('') || '<option value="">Nenhum cartão cadastrado</option>'}</select></div>
          <div class="field"><label>Tipo de compra</label><select id="fm_credito_tipo">
            <option value="avista">Crédito à vista</option>
            <option value="parcelado">Crédito parcelado</option>
          </select></div>
          <div class="field hidden" id="fm_parcelas_wrap"><label>Quantidade de parcelas <span id="fm_parcela_preview" style="color:var(--muted);font-weight:600;"></span></label><input type="number" id="fm_parcelas" min="2" step="1" value="2"/></div>
          <p class="modal-sub" style="margin:4px 0 0;">No crédito, informe o valor total da compra. O Borion calcula o valor de cada parcela e cria a despesa fixa mensal somente até a última parcela.</p>
        </div>
        <p class="modal-sub" id="fm_banco_hint" style="margin:4px 0 0;">Só aparecem aqui a Carteira e os bancos/contas cadastrados — cartão de crédito não é banco/conta de origem.</p>
        </div>
        <div class="row-btns"><button class="btn btn-primary btn-block" id="fm_save">${isEdit?'Salvar':'Adicionar'}</button></div>
        ${isEdit?`<div class="row-btns" style="margin-top:8px;"><button class="btn btn-danger btn-block" id="fm_delete">Remover a partir deste mês</button></div>`:''}
      </div>
    </div>`);
  $('#modal-root').innerHTML=''; $('#modal-root').appendChild(box);
  attachModalGuard(box);
  $('#fm_close').onclick = closeModal;
  attachMoneyMask($('#fm_valor'), isEdit?existing.valor:0);
  wireQuickCategory($('#fm_categoria'), $('#fm_newcat_box'), $('#fm_newcat_input'), $('#fm_newcat_add'), 'fixa');

  function syncFixaOrigemPagamentoUI(){
    const hidden = $('#fm_origempg');
    if(!hidden) return;
    const isReserva = hidden.value==='reserva';
    const contaWrap = $('#fm_conta_fields_wrap');
    const reservaWrap = $('#fm_reserva_pg_wrap');
    if(contaWrap) contaWrap.classList.toggle('hidden', isReserva);
    if(reservaWrap) reservaWrap.classList.toggle('hidden', !isReserva);
  }
  if($('#fm_origempg_group')){
    $('#fm_origempg_group').querySelectorAll('.seg-btn').forEach(btn=>{
      btn.onclick = ()=>{
        $('#fm_origempg_group').querySelectorAll('.seg-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        $('#fm_origempg').value = btn.dataset.value;
        syncFixaOrigemPagamentoUI();
      };
    });
  }

  function updateFixaCreditoParcelPreview(){
    const formaSel = $('#fm_forma');
    const tipoSel = $('#fm_credito_tipo');
    const label = $('#fm_valor_label');
    const preview = $('#fm_parcela_preview');
    const isCredito = formaSel && formaSel.value==='Crédito';
    if(label) label.textContent = isCredito ? 'Valor total da compra (R$)' : 'Valor mensal (R$)';
    if(!preview || !isCredito || !tipoSel || tipoSel.value!=='parcelado'){
      if(preview) preview.textContent = '';
      return;
    }
    const cents = parseInt(($('#fm_valor') && $('#fm_valor').dataset.cents) || '0', 10);
    const total = cents/100;
    const qtd = Math.max(2, Math.round(Number(($('#fm_parcelas') && $('#fm_parcelas').value) || 2)));
    const valorParcela = qtd>0 ? Math.round((total/qtd)*100)/100 : 0;
    preview.textContent = `(${brlPlain(valorParcela)} cada)`;
  }
  function syncFixaFormaPagamentoUI(preferBanco){
    const formaSel = $('#fm_forma');
    if(!formaSel) return;
    const forma = formaSel.value;
    const bancoWrap = $('#fm_banco_wrap');
    const bancoSel = $('#fm_banco');
    const creditoFields = $('#fm_credito_fields');
    const bancoHint = $('#fm_banco_hint');
    const isCredito = forma==='Crédito';
    if(bancoWrap) bancoWrap.classList.toggle('hidden', isCredito);
    if(creditoFields) creditoFields.classList.toggle('hidden', !isCredito);
    if(bancoHint) bancoHint.classList.toggle('hidden', isCredito);
    if(!isCredito && bancoSel){
      if(forma==='Dinheiro'){
        const cart = getCarteiraConta();
        bancoSel.innerHTML = cart ? `<option>${esc(cart.nome)}</option>` : '<option value="">Carteira não encontrada</option>';
        bancoSel.value = cart ? cart.nome : '';
        bancoSel.disabled = true;
      } else {
        const names = nonCarteiraAccountNames();
        const wanted = (preferBanco && names.includes(preferBanco)) ? preferBanco : (names.includes(bancoSel.value) ? bancoSel.value : (names[0]||''));
        bancoSel.innerHTML = names.length ? names.map(n=>`<option ${n===wanted?'selected':''}>${esc(n)}</option>`).join('') : '<option value="">Cadastre um banco em Cartões e Contas</option>';
        bancoSel.value = wanted;
        bancoSel.disabled = false;
      }
    }
    const tipoSel = $('#fm_credito_tipo');
    const parcelasWrap = $('#fm_parcelas_wrap');
    if(parcelasWrap && tipoSel) parcelasWrap.classList.toggle('hidden', tipoSel.value!=='parcelado');
    updateFixaCreditoParcelPreview();
  }
  $('#fm_forma').onchange = ()=>syncFixaFormaPagamentoUI();
  if($('#fm_credito_tipo')) $('#fm_credito_tipo').onchange = ()=>syncFixaFormaPagamentoUI();
  if($('#fm_parcelas')) $('#fm_parcelas').addEventListener('input', updateFixaCreditoParcelPreview);
  if($('#fm_valor')) $('#fm_valor').addEventListener('input', updateFixaCreditoParcelPreview);
  syncFixaFormaPagamentoUI(isEdit?existing.banco:null);

  $('#fm_save').onclick = ()=>{
    const nome = $('#fm_nome').value.trim() || 'Sem nome';
    const categoria = $('#fm_categoria').value;
    if(categoria==='__new__'){ alert('Confirme o nome da nova categoria antes de salvar.'); return; }
    const cents = parseInt($('#fm_valor').dataset.cents||'0',10);
    const valor = cents/100;
    const dia = Math.min(31, Math.max(1, parseInt($('#fm_dia').value,10)||1));
    const origemPagamentoNovo = (podeOrigemPagamentoReserva && $('#fm_origempg')) ? $('#fm_origempg').value : 'conta';
    const inPlace = isEdit && existing.startMonth===monthKeyNow;

    /* ---- Origem = Reserva: nunca passa por forma de pagamento/banco/crédito. ---- */
    if(origemPagamentoNovo==='reserva'){
      const reservaSel = $('#fm_reserva_pg_box') ? $('#fm_reserva_pg_box').value : '';
      const rbox = reservaBoxesFixa.find(r=>reservaBoxLabel(r)===reservaSel) || reservaBoxesFixa[0];
      if(!rbox){ toast('Escolha uma reserva válida.'); return; }
      if(!isEdit){
        S.data.fixas.push({id:uid(), nome, categoria, valor, dia, startMonth:monthKeyNow, endMonth:null, banco:rbox.banco||'', formaPagamento:null, origemPagamento:'reserva', reservaOrigemId:rbox.id});
        saveCurrentData(); closeModal(); renderView();
        toast('Despesa fixa adicionada. Pague cada mês pela reserva "'+rbox.nome+'" quando quiser.');
        return;
      }
      const targetId = inPlace ? existing.id : uid();
      // V6.1 — valida ANTES de mudar qualquer coisa em S.data.fixas: se não há saldo, a
      // alteração inteira é cancelada e nada é tocado (nem o valor, nem a origem antiga).
      const check = prepareFixaOcorrenciaEdit(existing.id, monthKeyNow, valor, 'reserva', rbox.id, nome);
      if(!check.ok){
        if(check.reason==='saldo_insuficiente') showReservaInsuficienteModal(check.box, check.necessario);
        else toast('Escolha uma reserva válida.');
        return;
      }
      if(inPlace){
        Object.assign(existing,{nome,categoria,valor,dia,banco:rbox.banco||'',formaPagamento:null,origemPagamento:'reserva',reservaOrigemId:rbox.id});
      } else {
        existing.endMonth = monthBeforeKey(monthKeyNow);
        S.data.fixas.push({id:targetId, nome, categoria, valor, dia, startMonth:monthKeyNow, endMonth:null, banco:rbox.banco||'', formaPagamento:null, origemPagamento:'reserva', reservaOrigemId:rbox.id});
      }
      check.commit(targetId);
      saveCurrentData(); closeModal(); renderView();
      toast(inPlace ? 'Despesa fixa atualizada.' : 'Alterada a partir de '+monthLabel(S.month.y,S.month.m)+'. Meses anteriores mantidos.');
      return;
    }

    /* ---- Origem = Conta: comportamento igual ao já existente (nunca move saldo real). ---- */
    const formaPagamento = $('#fm_forma') ? $('#fm_forma').value : 'Pix';

    if(formaPagamento==='Crédito'){
      const cartaoNome = $('#fm_cartao') ? $('#fm_cartao').value : '';
      const cartao = (S.data.cartoes||[]).find(c=>c.banco===cartaoNome);
      if(!cartao){ alert('Escolha um cartão de crédito válido. Cadastre um cartão em "Cartões e Contas" antes de lançar uma compra no crédito.'); return; }
      const tipoCredito = $('#fm_credito_tipo') ? $('#fm_credito_tipo').value : 'avista';
      const parcelaTotal = tipoCredito==='parcelado' ? Math.max(2, Math.round(Number($('#fm_parcelas').value)||2)) : 1;
      const valorParcela = Math.round((valor/parcelaTotal)*100)/100;
      if(isEdit){
        // Convertendo para compra no cartão: se havia ocorrência já paga por reserva,
        // devolve o valor antes de a despesa fixa deixar de existir nesse formato.
        refundAndCleanFixaOcorrencias(existing.id, inPlace ? null : monthKeyNow);
        if(inPlace) S.data.fixas = S.data.fixas.filter(x=>x.id!==existing.id);
        else existing.endMonth = monthBeforeKey(monthKeyNow);
      }
      const p = {id:uid(), descricao:nome, local:'', categoria:categoria||'Outro', valorParcela, parcelaTotal, dataCompra:monthKeyNow, diaEntrada:dia, apareceDespesas:true, despesaTipo:'fixa', despesaTransacaoId:null, despesaTransacaoIds:[], despesaFixaId:null};
      cartao.parcelas.push(p);
      linkParcelaToDespesa(cartao, p);
      saveCurrentData(); closeModal(); renderView();
      toast('Compra no crédito lançada no cartão '+cartao.banco+' como despesa fixa parcelada.');
      return;
    }

    const bancoVal = $('#fm_banco').value;
    const banco = requireBanco(bancoVal, 'Toda despesa fixa precisa de um banco/conta vinculado.');
    if(!banco) return;
    if(!isEdit){
      S.data.fixas.push({id:uid(), nome, categoria, valor, dia, startMonth:monthKeyNow, endMonth:null, banco, formaPagamento, origemPagamento:'conta', reservaOrigemId:null});
      toast('Despesa fixa adicionada. Ela se repetirá todos os meses.');
      saveCurrentData(); closeModal(); renderView();
      return;
    }
    const targetId = inPlace ? existing.id : uid();
    // Origem = conta nunca falha por saldo — só pode existir devolução (se a ocorrência
    // deste mês estava paga por reserva antes da edição).
    const check = prepareFixaOcorrenciaEdit(existing.id, monthKeyNow, valor, 'conta', null, nome);
    if(inPlace){
      Object.assign(existing,{nome,categoria,valor,dia,banco,formaPagamento,origemPagamento:'conta',reservaOrigemId:null});
      toast('Despesa fixa atualizada.');
    } else {
      existing.endMonth = monthBeforeKey(monthKeyNow);
      S.data.fixas.push({id:targetId, nome, categoria, valor, dia, startMonth:monthKeyNow, endMonth:null, banco, formaPagamento, origemPagamento:'conta', reservaOrigemId:null});
      toast('Alterada a partir de '+monthLabel(S.month.y,S.month.m)+'. Meses anteriores mantidos.');
    }
    if(check.ok && !check.noop) check.commit(targetId);
    saveCurrentData(); closeModal(); renderView();
  };
  if(isEdit){
    $('#fm_delete').onclick = ()=>{
      const snapshot = JSON.parse(JSON.stringify(S.data));
      const deletingEntirely = existing.startMonth===monthKeyNow;
      // V6.1 — devolve à reserva qualquer ocorrência paga (deste mês em diante, ou todas se
      // a despesa some por completo) ANTES de excluir o cadastro da despesa fixa.
      refundAndCleanFixaOcorrencias(existing.id, deletingEntirely ? null : monthKeyNow);
      if(deletingEntirely){
        S.data.fixas = S.data.fixas.filter(x=>x.id!==existing.id);
      } else {
        existing.endMonth = monthBeforeKey(monthKeyNow);
      }
      saveCurrentData(); closeModal(); renderView();
      showUndoToast('Despesa fixa removida a partir deste mês.', ()=>{ S.data = snapshot; saveCurrentData(); renderView(); });
    };
  }
}
