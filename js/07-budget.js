/* Borion Finance — Tela Orçamento/Receitas/Despesas, filtros e modais de lançamentos. */

/* ---------------- VIEW: BUDGET ---------------- */
function renderBudget(){
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
          <td>${esc(e.f.nome)}<div style="font-size:10.5px;color:var(--muted)">recorrente desde ${shortMonthLabel(e.f.startMonth)}</div></td>
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
      rows = list.map(f=>`
        <tr>
          <td>Dia ${f.dia||1}</td>
          <td>${esc(f.nome)}<div style="font-size:10.5px;color:var(--muted)">recorrente desde ${shortMonthLabel(f.startMonth)}</div></td>
          <td><span class="cat-pill"><span class="dot" style="background:${catColor(f.categoria)}"></span>${esc(f.categoria)}</span></td>
          <td class="val-neg">- ${brl(f.valor)}</td>
          <td class="tbl-actions"><button onclick="Budget.edit('${f.id}')">✎</button></td>
        </tr>`).join('');
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
      return `
      <tr>
        <td>${t.data.slice(8,10)}/${t.data.slice(5,7)}</td>
        <td>${esc(t.nome)}${origemPill}${formaPill}</td>
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
          <thead><tr><th>${tab==='fixa'?fixaColLabel:'Data'}</th><th>Nome</th><th>Categoria</th><th>Valor</th><th></th></tr></thead>
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

const Budget = {
  tab(t){ S.budgetTab=t; renderView(); },
  add(){
    if(S.budgetTab==='fixa') openFixaModal(null);
    else openTransactionModal({type:S.budgetTab});
  },
  edit(id){
    if(S.budgetTab==='fixa'){
      const f = S.data.fixas.find(x=>x.id===id);
      openFixaModal(f);
    } else {
      const t = S.data.transacoes.find(x=>x.id===id);
      openTransactionModal({type:t.tipo, existing:t});
    }
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
function openTransactionModal({type, existing}){
  const isEdit = !!existing;
  const isReceita = type==='receita';
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
  const box = el(`
    <div class="modal-overlay">
      <div class="modal-box">
        <div class="modal-head"><h2>${isEdit?'Editar':'Adicionar'} lançamento</h2><button id="tm_close">&times;</button></div>
        <div class="field"><label>Nome</label><input type="text" id="tm_nome" value="${isEdit?esc(existing.nome):''}"/></div>
        <div class="field"><label>Data</label><input type="date" id="tm_data" value="${isEdit?existing.data:monthKey(S.month.y,S.month.m)+'-01'}"/></div>
        ${categorySelectHTML('tm', type, isEdit?existing.categoria:null)}
        <div class="field"><label>Valor (R$)</label><input type="text" inputmode="numeric" id="tm_valor" class="money-input" placeholder="0,00"/></div>
        ${!isReceita?`<div class="field"><label>Forma de pagamento</label><select id="tm_forma">${FORMAS_PAGAMENTO.map(f=>`<option value="${esc(f)}" ${isEdit&&(existing.formaPagamento||'Dinheiro')===f?'selected':''}>${esc(f)}</option>`).join('')}</select></div>`:''}
        <div class="field" id="tm_banco_wrap"><label>${isReceita?'Onde a receita entra':'De onde o dinheiro sai'}</label><select id="tm_banco"><option>— Nenhum —</option>${accountSelectNames().map(b=>`<option ${isEdit&&existing.banco===b?'selected':''}>${esc(b)}</option>`).join('')}</select></div>
        ${!isReceita?`
        <div id="tm_credito_fields" class="hidden">
          <div class="field"><label>Cartão de crédito</label><select id="tm_cartao">${allCardNames().map(c=>`<option>${esc(c)}</option>`).join('') || '<option value="">Nenhum cartão cadastrado</option>'}</select></div>
          <div class="field"><label>Tipo de compra</label><select id="tm_credito_tipo">
            <option value="avista">Crédito à vista</option>
            <option value="parcelado">Crédito parcelado</option>
          </select></div>
          <div class="field hidden" id="tm_parcelas_wrap"><label>Quantidade de parcelas</label><input type="number" id="tm_parcelas" min="2" step="1" value="2"/></div>
          <p class="modal-sub" style="margin:4px 0 0;">Compra no crédito não desconta o banco agora — ela vira uma compra vinculada ao cartão e entra na fatura, igual em "Cartões e Contas".</p>
        </div>`:''}
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
  }
  if(!isReceita && $('#tm_forma')){
    $('#tm_forma').onchange = ()=>syncFormaPagamentoUI();
    const tipoSel = $('#tm_credito_tipo');
    if(tipoSel) tipoSel.onchange = ()=>syncFormaPagamentoUI();
    syncFormaPagamentoUI(isEdit?existing.banco:null);
  }

  $('#tm_save').onclick = ()=>{
    const nome = $('#tm_nome').value.trim() || 'Sem nome';
    const data = $('#tm_data').value || (monthKey(S.month.y,S.month.m)+'-01');
    const categoria = $('#tm_categoria').value;
    if(categoria==='__new__'){ alert('Confirme o nome da nova categoria antes de salvar.'); return; }
    const cents = parseInt($('#tm_valor').dataset.cents||'0',10);
    const valor = cents/100;

    const formaPagamento = (!isReceita && $('#tm_forma')) ? $('#tm_forma').value : null;
    const isCreditoDespesa = formaPagamento==='Crédito';

    /* Crédito: não é uma transação de banco/conta — vira uma compra vinculada ao cartão
       (à vista = 1 parcela, parcelado = N parcelas), do mesmo jeito que "+ Compra
       parcelada" em Cartões e Contas. Não desconta banco/carteira no momento da compra. */
    if(isCreditoDespesa){
      const cartaoNome = $('#tm_cartao') ? $('#tm_cartao').value : '';
      const cartao = (S.data.cartoes||[]).find(c=>c.banco===cartaoNome);
      if(!cartao){ alert('Escolha um cartão de crédito válido. Cadastre um cartão em "Cartões e Contas" antes de lançar uma compra no crédito.'); return; }
      const tipoCredito = $('#tm_credito_tipo') ? $('#tm_credito_tipo').value : 'avista';
      const parcelaTotal = tipoCredito==='parcelado' ? Math.max(2, Math.round(Number($('#tm_parcelas').value)||2)) : 1;
      const valorParcela = Math.round((valor/parcelaTotal)*100)/100;
      if(isEdit && existing.tipo==='variavel'){
        const idx = S.data.transacoes.findIndex(x=>x.id===existing.id);
        if(idx>=0) S.data.transacoes.splice(idx,1);
      }
      cartao.parcelas.push({id:uid(), descricao:nome, local:'', categoria:categoria||'Outro', valorParcela, parcelaTotal, dataCompra:(data||todayISO()).slice(0,7), diaEntrada:null});
      saveCurrentData(); closeModal(); renderView();
      toast('Compra no crédito lançada no cartão '+cartao.banco+'.');
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
      else existing.formaPagamento = formaPagamento || 'Dinheiro';
      tx = existing;
      toast('Lançamento atualizado.');
    } else {
      tx = {id:uid(), tipo:type, nome, data, categoria, valor, banco};
      if(isReceita) tx.origem = origem;
      else tx.formaPagamento = formaPagamento || 'Dinheiro';
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
  const box = el(`
    <div class="modal-overlay">
      <div class="modal-box">
        <div class="modal-head"><h2>${isEdit?'Editar':'Adicionar'} despesa fixa</h2><button id="fm_close">&times;</button></div>
        <p class="modal-sub">${isEdit? 'Alterações se aplicam a partir de '+monthLabel(S.month.y,S.month.m)+'; meses anteriores mantêm o valor antigo.' : 'Essa despesa se repete todos os meses a partir de '+monthLabel(S.month.y,S.month.m)+', até que você a remova.'}</p>
        <div class="field"><label>Nome</label><input type="text" id="fm_nome" value="${isEdit?esc(existing.nome):''}"/></div>
        ${categorySelectHTML('fm', 'fixa', isEdit?existing.categoria:null)}
        <div class="field"><label>Valor mensal (R$)</label><input type="text" inputmode="numeric" id="fm_valor" class="money-input" placeholder="0,00"/></div>
        <div class="field"><label>Dia do vencimento</label><input type="number" id="fm_dia" min="1" max="31" value="${isEdit?(existing.dia||1):1}"/></div>
        <div class="field"><label>Banco/Conta</label><select id="fm_banco"><option>— Nenhum —</option>${accountSelectNames().map(b=>`<option ${isEdit&&existing.banco===b?'selected':''}>${esc(b)}</option>`).join('')}</select></div>
        <p class="modal-sub" style="margin:4px 0 0;">Só aparecem aqui a Carteira e os bancos/contas cadastrados — cartão de crédito não é banco/conta de origem.</p>
        <div class="row-btns"><button class="btn btn-primary btn-block" id="fm_save">${isEdit?'Salvar':'Adicionar'}</button></div>
        ${isEdit?`<div class="row-btns" style="margin-top:8px;"><button class="btn btn-danger btn-block" id="fm_delete">Remover a partir deste mês</button></div>`:''}
      </div>
    </div>`);
  $('#modal-root').innerHTML=''; $('#modal-root').appendChild(box);
  attachModalGuard(box);
  $('#fm_close').onclick = closeModal;
  attachMoneyMask($('#fm_valor'), isEdit?existing.valor:0);
  wireQuickCategory($('#fm_categoria'), $('#fm_newcat_box'), $('#fm_newcat_input'), $('#fm_newcat_add'), 'fixa');

  $('#fm_save').onclick = ()=>{
    const nome = $('#fm_nome').value.trim() || 'Sem nome';
    const categoria = $('#fm_categoria').value;
    if(categoria==='__new__'){ alert('Confirme o nome da nova categoria antes de salvar.'); return; }
    const cents = parseInt($('#fm_valor').dataset.cents||'0',10);
    const valor = cents/100;
    const dia = Math.min(31, Math.max(1, parseInt($('#fm_dia').value,10)||1));
    const bancoVal = $('#fm_banco').value;
    const banco = requireBanco(bancoVal, 'Toda despesa fixa precisa de um banco/conta vinculado.');
    if(!banco) return;
    if(!isEdit){
      S.data.fixas.push({id:uid(), nome, categoria, valor, dia, startMonth:monthKeyNow, endMonth:null, banco});
      toast('Despesa fixa adicionada. Ela se repetirá todos os meses.');
    } else {
      if(existing.startMonth===monthKeyNow){
        Object.assign(existing,{nome,categoria,valor,dia,banco});
        toast('Despesa fixa atualizada.');
      } else {
        existing.endMonth = monthBeforeKey(monthKeyNow);
        S.data.fixas.push({id:uid(), nome, categoria, valor, dia, startMonth:monthKeyNow, endMonth:null, banco});
        toast('Alterada a partir de '+monthLabel(S.month.y,S.month.m)+'. Meses anteriores mantidos.');
      }
    }
    saveCurrentData(); closeModal(); renderView();
  };
  if(isEdit){
    $('#fm_delete').onclick = ()=>{
      const snapshot = JSON.parse(JSON.stringify(S.data));
      if(existing.startMonth===monthKeyNow){
        S.data.fixas = S.data.fixas.filter(x=>x.id!==existing.id);
      } else {
        existing.endMonth = monthBeforeKey(monthKeyNow);
      }
      saveCurrentData(); closeModal(); renderView();
      showUndoToast('Despesa fixa removida a partir deste mês.', ()=>{ S.data = snapshot; saveCurrentData(); renderView(); });
    };
  }
}
