/* Borion Finance — Tela Patrimônio, liquidez, bens, dívidas e metas. */

/* ---------------- VIEW: PATRIMONY ---------------- */
function patrimonioComposicaoSegments(){
  const invest = investAtualTotal();
  const reservas = reservasTotal();
  const segs = [];
  if(invest>0) segs.push({label: S.data.investimentos.ativos.length===1? S.data.investimentos.ativos[0].nome : 'Investimentos', value:invest, color:catColor('CDI')});
  if(reservas>0) segs.push({label:'Reserva', value:reservas, color:'var(--gold)'});
  S.data.liquidez.filter(l=>bankMatches(l.banco)).forEach(l=> segs.push({label:l.nome, value:l.valor, color:catColor(l.nome)}));
  S.data.bens.filter(b=>bankMatches(b.banco)).forEach(b=> segs.push({label:b.nome, value:b.valor, color:catColor(b.nome)}));
  return segs;
}
function renderPatrimony(){
  const liq = liquidezTotal(), bens = bensTotal(), invest = investAtualTotal(), reservas = reservasTotal(), divDebt = computeCardsDebt(), div = divDebt.total;
  const total = liq+reservas+bens+invest-div;
  const composicaoTotal = liq+reservas+bens+invest;
  const segs = patrimonioComposicaoSegments();

  const liqRows = S.data.liquidez.filter(l=>bankMatches(l.banco)).map(l=>`
    <div class="list-row"><span class="lname">${esc(l.nome)}</span><span class="lval">${brl(l.valor)}</span><button class="ledit" onclick="Patr.editLiquidez('${l.id}')">✎</button></div>`).join('');
  const bensRows = S.data.bens.filter(b=>bankMatches(b.banco)).map(b=>`
    <div class="list-row"><span class="lname">${esc(b.nome)}</span><span class="lval">${brl(b.valor)}</span><button class="ledit" onclick="Patr.editBem('${b.id}')">✎</button></div>`).join('');
  const dividasDetail = divDebt.detail;
  const divRows = dividasDetail.map(d=>{
    const tipo = d.tipoDivida==='boleto' ? 'Boleto' : 'Cartão';
    const origem = d.tipoDivida==='boleto' ? (d.banco || d.local || 'Boleto') : d.cartao;
    return `<div class="list-row">
      <span class="lname">${esc(d.descricao)} <span class="lmeta">*${esc(tipo)}* ${esc(origem||'')} · ${d.atualCalc} de ${d.parcelaTotal}</span></span>
      <span class="lval">${brl(d.restante)}</span>
    </div>`;
  }).join('');
  const dividasCollapsed = S.patrView.dividasCollapsed;
  const reservasCollapsed = S.patrView.reservasCollapsed !== false;

  return `
    <div class="cards-row">
      <div class="card hero-green"><div class="clabel">Patrimônio total</div><div class="cval">${brl(total)}</div></div>
      <div class="card"><div class="clabel">${tagBadgeHTML('liquidez','LIQUIDEZ')}</div><div class="cval">${brl(liq)}</div></div>
      ${reservasEnabled()?`<div class="card hero-gold"><div class="clabel">${tagBadgeHTML('investimentos','RESERVA')}</div><div class="cval">${brl(reservas)}</div></div>`:''}
      <div class="card"><div class="clabel">${tagBadgeHTML('bens','BENS')}</div><div class="cval">${brl(bens)}</div></div>
      <div class="card"><div class="clabel">${tagBadgeHTML('investimentos','INVESTIMENTOS')}</div><div class="cval">${brl(invest)}</div></div>
      <div class="card"><div class="clabel">${tagBadgeHTML('dividas','DÍVIDAS')}</div><div class="cval" style="color:${iconColor('dividas')}">${brl(div)}</div></div>
    </div>
    <div class="grid2b">
      <div style="display:flex;flex-direction:column;gap:18px;">
        <div class="panel-box">
          <div class="panel-title">Composição do patrimônio</div>
          ${renderDonut(segs, composicaoTotal? '100%':'0%', 'do total')}
          <div class="list-row" style="margin-top:6px;font-weight:800;"><span>Total bruto</span><span>${brl(composicaoTotal)}</span></div>
          <div class="list-row" style="font-weight:800;"><span>Patrimônio total líquido</span><span>${brl(total)}</span></div>
        </div>
        <div class="panel-box">
          <div class="toolbar"><div class="toolbar-left" style="color:#3b6bf0">BENS</div><button class="btn-outline" onclick="Patr.addBem()">+ Adicionar</button></div>
          ${bensRows || '<div class="empty-note">Nenhum item ainda.</div>'}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:18px;">
        <div class="panel-box">
          <div class="toolbar"><div class="toolbar-left" style="color:#22c55e">LIQUIDEZ</div><button class="btn-outline" onclick="Patr.addLiquidez()">+ Adicionar</button></div>
          ${liqRows || '<div class="empty-note">Nenhum item ainda.</div>'}
        </div>
        ${reservasEnabled()?renderReservasResumoPanel(reservas, reservasCollapsed):''}
        ${reservasEnabled()?renderReservaRendimentosPanel(S.patrView.reservaRendimentosCollapsed!==false):''}
        <div class="panel-box">
          <div class="toolbar">
            <div class="toolbar-left" style="display:flex;align-items:center;gap:8px;color:#ef4444;">
              <button class="collapse-toggle-btn" onclick="Patr.toggleDividas()" title="${dividasCollapsed?'Maximizar':'Minimizar'}" style="color:#ef4444;">${dividasCollapsed?'▸':'▾'}</button>
              <span>DÍVIDAS (cartões e boletos, ${monthLabel(S.month.y,S.month.m)})</span>
            </div>
            ${dividasCollapsed?`<span style="font-weight:800;color:#ef4444;">TOTAL: ${brl(div)}</span>`:''}
          </div>
          ${dividasCollapsed ? '' : (divRows || '<div class="empty-note">Nenhuma dívida de cartão ou boleto ativa neste mês.</div>')}
          ${dividasCollapsed ? '' : '<p style="font-size:11px;color:var(--muted-2);margin-top:8px;">Gerencie compras, parcelas e boletos na aba "Cartões e Contas".</p>'}
        </div>
      </div>
      <div class="panel-box">
        <div class="toolbar"><div class="toolbar-left">◇ Metas de patrimônio</div>${reservasEnabled()?`<button class="btn-outline btn-sm" onclick="Nav.go('reservas')">Criar em uma reserva</button>`:''}</div>
        <p style="font-size:11px;color:var(--muted-2);margin:-6px 0 10px;">A Meta de Patrimônio agora é criada e editada dentro de "Editar reserva" (Reserva), logo abaixo da Meta da Reserva.</p>
        ${renderMetasList()}
      </div>
    </div>
  `;
}

function renderMetasList(){
  const metas = (S.data.metas||[]).filter(mt=>bankMatches(mt.banco));
  if(!metas.length) return '<div class="empty-note">Nenhuma meta cadastrada ainda'+(S.bankFilter?' para o filtro de banco atual':'')+'.</div>';
  return metas.map(mt=>{
    const pct = mt.valorMeta>0 ? Math.min(100, Math.round(mt.valorAtual/mt.valorMeta*100)) : 0;
    const done = pct>=100;
    const color = done ? '#22c55e' : (mt.cor || iconColor('investimentos'));
    return `
    <div class="meta-card">
      <div class="meta-head">
        <div class="mh-left"><span class="meta-emoji">${esc(mt.emoji||'◇')}</span> ${esc(mt.nome)}</div>
        <button class="ledit" onclick="Metas.edit('${mt.id}')">✎</button>
      </div>
      <div class="meta-progress-outer"><div class="meta-progress-inner" style="width:${pct}%;background:${color};"></div></div>
      <div class="meta-foot">
        <span>${brl(mt.valorAtual)} de ${brl(mt.valorMeta)}${mt.prazo?(' · até '+shortMonthLabel(mt.prazo.slice(0,7))):''}</span>
        <span style="font-weight:800;color:${color};">${done?'Concluído':pct+'%'}</span>
      </div>
    </div>`;
  }).join('');
}
const Patr = {
  addLiquidez(){
    openModal({title:'Adicionar ativo de liquidez', sub:'Valor neste mês.', fields:[{key:'nome',label:'Nome',type:'text'},{key:'valor',label:'Valor',type:'money'},bankSelectField()],
      onSave(v){ S.data.liquidez.push({id:uid(),nome:v.nome,valor:Number(v.valor)||0,banco:v.banco==='— Nenhum —'?'':v.banco}); saveCurrentData(); closeModal(); renderView(); }});
  },
  editLiquidez(id){
    const l = S.data.liquidez.find(x=>x.id===id);
    openModal({title:'Editar ativo de liquidez', sub:'Valor neste mês.', fields:[{key:'nome',label:'Nome',type:'text'},{key:'valor',label:'Valor',type:'money'},bankSelectField(l.banco)], values:l,
      onDelete(){ S.data.liquidez = S.data.liquidez.filter(x=>x.id!==id); saveCurrentData(); closeModal(); renderView(); },
      onSave(v){ Object.assign(l,{nome:v.nome,valor:Number(v.valor)||0,banco:v.banco==='— Nenhum —'?'':v.banco}); saveCurrentData(); closeModal(); renderView(); }});
  },
  addBem(){
    openModal({title:'Adicionar bem', fields:[{key:'nome',label:'Nome',type:'text'},{key:'valor',label:'Valor estimado',type:'money'},bankSelectField()],
      onSave(v){ S.data.bens.push({id:uid(),nome:v.nome,valor:Number(v.valor)||0,banco:v.banco==='— Nenhum —'?'':v.banco}); saveCurrentData(); closeModal(); renderView(); }});
  },
  editBem(id){
    const b = S.data.bens.find(x=>x.id===id);
    openModal({title:'Editar bem', fields:[{key:'nome',label:'Nome',type:'text'},{key:'valor',label:'Valor estimado',type:'money'},bankSelectField(b.banco)], values:b,
      onDelete(){ S.data.bens = S.data.bens.filter(x=>x.id!==id); saveCurrentData(); closeModal(); renderView(); },
      onSave(v){ Object.assign(b,{nome:v.nome,valor:Number(v.valor)||0,banco:v.banco==='— Nenhum —'?'':v.banco}); saveCurrentData(); closeModal(); renderView(); }});
  },
  toggleDividas(){ S.patrView.dividasCollapsed = !S.patrView.dividasCollapsed; renderView(); },
  toggleReservas(){ S.patrView.reservasCollapsed = !(S.patrView.reservasCollapsed !== false); renderView(); },
  toggleReservaRendimentos(){ S.patrView.reservaRendimentosCollapsed = !(S.patrView.reservaRendimentosCollapsed !== false); renderView(); }
};


/* ---------------- Reserva (dentro de Patrimônio) ---------------- */
function reservaFmtDate(iso){ if(!iso) return ''; const parts=String(iso).slice(0,10).split('-'); return parts.length===3 ? parts[2]+'/'+parts[1]+'/'+parts[0] : esc(iso); }
function reservaBoxesFiltered(){ return ((S.data.reservas&&S.data.reservas.boxes)||[]).filter(r=>bankMatches(r.banco)); }
function reservaMovesFiltered(){
  const ids = new Set(reservaBoxesFiltered().map(r=>r.id));
  return ((S.data.reservas&&S.data.reservas.moves)||[]).filter(m=>ids.has(m.boxId) || bankMatches(m.banco)).sort((a,b)=>String(b.data||'').localeCompare(String(a.data||''))).slice(0,12);
}

function reservaRendimentosMes(y=S.month.y, m=S.month.m){
  const key = monthKey(y,m);
  const boxMap = new Map(((S.data.reservas&&S.data.reservas.boxes)||[]).map(r=>[r.id,r]));
  const totals = new Map();
  ((S.data.reservas&&S.data.reservas.moves)||[]).forEach(mv=>{
    if(mv.tipo!=='Rendimento' || !String(mv.data||'').startsWith(key)) return;
    const box = boxMap.get(mv.boxId);
    const banco = (box&&box.banco) || mv.banco || '';
    if(!bankMatches(banco)) return;
    const id = mv.boxId || 'sem-reserva';
    if(!totals.has(id)) totals.set(id,{id, nome:box?box.nome:'Reserva removida', banco, cor:(box&&box.cor)||'var(--gold)', valor:0});
    totals.get(id).valor += Number(mv.valor)||0;
  });
  const rows = Array.from(totals.values()).sort((a,b)=>b.valor-a.valor);
  return {total:rows.reduce((a,b)=>a+b.valor,0), rows};
}
function renderReservaRendimentosPanel(collapsed){
  const rend = reservaRendimentosMes();
  const rows = rend.rows.map(r=>`
    <div class="list-row reserva-summary-row">
      <span class="lname"><span class="dot" style="background:${esc(r.cor||'var(--gold)')}"></span>${esc(r.nome)} <span class="lmeta">${esc(r.banco||'Sem banco')} · ${monthLabel(S.month.y,S.month.m)}</span></span>
      <span class="lval val-pos">+ ${brl(r.valor)}</span>
    </div>`).join('');
  return `<div class="panel-box reservas-panel reserva-rendimentos-panel">
    <div class="toolbar">
      <div class="toolbar-left" style="display:flex;align-items:center;gap:8px;color:var(--gold-bright);">
        <button class="collapse-toggle-btn" onclick="Patr.toggleReservaRendimentos()" title="${collapsed?'Maximizar':'Minimizar'}" style="color:var(--gold-bright);">${collapsed?'▸':'▾'}</button>
        <span>RENDIMENTOS DAS RESERVAS (${monthLabel(S.month.y,S.month.m)})</span>
      </div>
      <span style="font-weight:900;color:#22c55e;">TOTAL: + ${brl(rend.total)}</span>
    </div>
    ${collapsed ? '<p style="font-size:11.5px;color:var(--muted);margin:8px 0 0;">Abra a seta para ver quanto cada reserva rendeu neste mês.</p>' : (rows || '<div class="empty-note">Nenhum rendimento de reserva registrado neste mês.</div>')}
  </div>`;
}
/* Mantém a Meta de Patrimônio vinculada em dia sempre que o valor atual da reserva mudar. */
function syncMetaFromReserva(box){
  if(!box || !box.metaId) return;
  const mt = (S.data.metas||[]).find(x=>x.id===box.metaId);
  if(mt){ mt.valorAtual = Number(box.valorAtual)||0; mt.nome = box.nome; mt.banco = box.banco; }
}
function reservaStatusPill(status){
  const s = status || 'Ativa';
  const cls = s==='Concluída'?'ok':(s==='Pausada'?'warn':'neutral');
  return `<span class="cheque-status ${cls}">${esc(s)}</span>`;
}

function renderReservasResumoPanel(total, collapsed){
  const boxes = reservaBoxesFiltered();
  const rows = boxes.map(r=>{
    const pct = Number(r.valorMeta)>0 ? Math.min(100, Math.round(Number(r.valorAtual||0)/Number(r.valorMeta||0)*100)) : 0;
    return `<div class="list-row reserva-summary-row">
      <span class="lname"><span class="dot" style="background:${esc(r.cor||'var(--gold)')}"></span>${esc(r.nome)} <span class="lmeta">${esc(r.banco||'Sem banco')} ${pct?('· '+pct+'%'):''}</span></span>
      <span class="lval">${brl(Number(r.valorAtual)||0)}</span>
      <button class="ledit" onclick="Reservas.move('${r.id}')">⇆</button>
    </div>`;
  }).join('');
  return `<div class="panel-box reservas-panel reservas-summary-panel">
    <div class="toolbar">
      <div class="toolbar-left" style="display:flex;align-items:center;gap:8px;color:var(--gold-bright);">
        <button class="collapse-toggle-btn" onclick="Patr.toggleReservas()" title="${collapsed?'Maximizar':'Minimizar'}" style="color:var(--gold-bright);">${collapsed?'▸':'▾'}</button>
        <span>RESERVA</span>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <span style="font-weight:900;color:var(--gold-bright);">Reservado: ${brl(total)}</span>
        <button class="btn-outline btn-sm" onclick="Nav.go('reservas')">Abrir detalhes</button>
      </div>
    </div>
    ${collapsed ? '<p style="font-size:11.5px;color:var(--muted);margin:8px 0 0;">Total incluído no patrimônio. Abra a seta para ver as reservas cadastradas.</p>' : (rows || '<div class="empty-note">Nenhuma reserva cadastrada ainda.</div>')}
  </div>`;
}
function renderReservasPage(){
  if(!reservasEnabled()){
    return `<div class="panel-box"><h3 class="panel-title">Reserva</h3><p class="empty-note">O módulo de Reserva está desativado. Ative em Configurações para usar esta guia.</p><button class="btn btn-primary btn-sm" onclick="Nav.go('settings')">Abrir Configurações</button></div>`;
  }
  const boxes = reservaBoxesFiltered();
  const moves = reservaMovesFiltered();
  const total = sumBy(boxes,'valorAtual');
  const metaTotal = sumBy(boxes,'valorMeta');
  const ativas = boxes.filter(r=>(r.status||'Ativa')==='Ativa').length;
  const ultimo = moves[0];
  return `
    <div class="cards-row">
      <div class="card hero-gold"><div class="clabel">Reservado</div><div class="cval">${brl(total)}</div></div>
      <div class="card"><div class="clabel">Reservas ativas</div><div class="cval">${ativas}</div></div>
      <div class="card"><div class="clabel">Meta total</div><div class="cval">${brl(metaTotal)}</div></div>
      <div class="card"><div class="clabel">Última movimentação</div><div class="cval" style="font-size:18px">${ultimo?reservaFmtDate(ultimo.data):'—'}</div></div>
    </div>
    ${renderReservaRendimentosPanel(S.patrView.reservaRendimentosCollapsed!==false)}
    ${renderReservasPanel()}
  `;
}

function renderReservasPanel(){
  const boxes = reservaBoxesFiltered();
  const total = sumBy(boxes,'valorAtual');
  const moves = reservaMovesFiltered();
  const boxCards = boxes.map(r=>{
    const pct = Number(r.valorMeta)>0 ? Math.min(100, Math.round(Number(r.valorAtual||0)/Number(r.valorMeta||0)*100)) : 0;
    const mt = r.metaId ? (S.data.metas||[]).find(x=>x.id===r.metaId) : null;
    const metaPct = mt && Number(mt.valorMeta)>0 ? Math.min(100, Math.round(Number(mt.valorAtual||0)/Number(mt.valorMeta||0)*100)) : 0;
    const metaHTML = mt ? `<div class="reserva-foot" style="margin-top:4px;"><span>${esc(mt.emoji||'◇')} Meta de patrimônio: ${brl(mt.valorAtual||0)} de ${brl(mt.valorMeta||0)}</span><span style="font-weight:800;color:${metaPct>=100?'#22c55e':'var(--gold-bright)'}">${metaPct}%</span></div>` : '';
    return `<div class="reserva-card">
      <div class="reserva-head"><div><div class="reserva-title"><span class="dot" style="background:${esc(r.cor||'var(--gold)')}"></span>${esc(r.nome)}</div><div class="reserva-meta">${esc(r.banco||'Sem banco')} ${r.categoria?'· '+esc(r.categoria):''}</div></div>${reservaStatusPill(r.status)}</div>
      <div class="reserva-value">${brl(Number(r.valorAtual)||0)}</div>
      <div class="meta-progress-outer"><div class="meta-progress-inner" style="width:${pct}%;background:${esc(r.cor||'var(--gold)')};"></div></div>
      <div class="reserva-foot"><span>${r.valorMeta?('Meta: '+brl(r.valorMeta)): 'Sem meta definida'}</span><span>${pct}%</span></div>
      ${metaHTML}
      <div class="reserva-actions"><button onclick="Reservas.move('${r.id}')">Movimentar</button><button onclick="Reservas.edit('${r.id}')">Editar</button></div>
    </div>`;
  }).join('');
  const moveRows = moves.map(m=>{
    const box = (S.data.reservas.boxes||[]).find(r=>r.id===m.boxId);
    const positive = ['Reservar','Rendimento','Receita direta'].includes(m.tipo);
    const isAdjust = m.tipo==='Ajuste manual';
    return `<tr><td>${reservaFmtDate(m.data)}</td><td>${esc(box?box.nome:'Reserva removida')}</td><td>${esc(m.tipo)}</td><td>${esc(m.banco||'')}</td><td class="${positive||isAdjust?'val-pos':''}">${positive?'+ ':m.tipo==='Resgatar'?'- ':''}${brl(m.valor)}</td><td>${esc(m.descricao||'')}</td><td style="text-align:right;white-space:nowrap;"><button class="ledit" onclick="Reservas.editMove('${m.id}')">✎</button><button class="ledit danger-mini" onclick="Reservas.deleteMove('${m.id}')">×</button></td></tr>`;
  }).join('');
  return `<div class="panel-box reservas-panel">
    <div class="toolbar"><div class="toolbar-left">◈ Reserva <span class="lmeta">Reservado: ${brl(total)}</span></div><div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn-outline" onclick="Reservas.add()">+ Nova reserva</button><button class="btn-outline" onclick="Reservas.move()">+ Movimentação</button></div></div>
    ${boxes.length?`<div class="reserva-grid">${boxCards}</div>`:'<div class="empty-note">Nenhuma reserva cadastrada ainda. Use para separar reserva de emergência, viagem, manutenção, impostos e objetivos.</div>'}
    <div class="reserva-extrato-title">Extrato recente das reservas</div>
    ${moveRows?`<div class="table-scroll"><table><thead><tr><th>Data</th><th>Reserva</th><th>Tipo</th><th>Banco</th><th>Valor</th><th>Descrição</th><th></th></tr></thead><tbody>${moveRows}</tbody></table></div>`:'<div class="empty-note">Nenhuma movimentação registrada ainda.</div>'}
  </div>`;
}
const Reservas = {
  add(){ Reservas.edit(null); },
  edit(id){
    const isEdit = !!id;
    const r = isEdit ? S.data.reservas.boxes.find(x=>x.id===id) : {nome:'', banco:'', valorAtual:0, valorMeta:0, prazo:'', categoria:'Reserva', status:'Ativa', cor:'#c9a45c', obs:'', metaId:null};
    const metaExistente = (isEdit && r.metaId) ? S.data.metas.find(mt=>mt.id===r.metaId) : null;
    let metaAtiva = !!metaExistente;
    let metaEmoji = (metaExistente && metaExistente.emoji) || '◇';
    const metaEmojiBtns = ()=>EMOJI_PALETTE.map(e=>`<button type="button" class="emoji-opt ${metaEmoji===e?'active':''}" data-e="${e}">${e}</button>`).join('');
    const metaExtraHTML = `
      <div class="field-check" style="margin-top:16px;border-top:1px solid var(--border,rgba(255,255,255,.08));padding-top:14px;">
        <input type="checkbox" id="rz_meta_ativa" ${metaAtiva?'checked':''}/> <label style="margin:0;" for="rz_meta_ativa">Meta de Patrimônio</label>
      </div>
      <p class="modal-sub" style="margin:4px 0 8px;">Defina um objetivo de patrimônio para esta reserva (ex: juntar R$ 50.000). Aparece aqui e também em Patrimônio → Metas.</p>
      <div id="rz_meta_fields" class="${metaAtiva?'':'hidden'}">
        <div class="field"><label>Valor da Meta de Patrimônio (R$)</label><input type="text" inputmode="numeric" class="money-input" id="rz_meta_valor" placeholder="0,00"/></div>
        <div class="field"><label>Ícone</label><div class="emoji-picker" id="rz_meta_emoji_picker">${metaEmojiBtns()}</div></div>
        <div class="field"><label>Prazo (opcional)</label><input type="month" id="rz_meta_prazo" value="${metaExistente&&metaExistente.prazo?esc(metaExistente.prazo.slice(0,7)):''}"/></div>
        <div class="field"><label>Cor da meta</label><input type="color" id="rz_meta_cor" value="${metaExistente&&metaExistente.cor?esc(metaExistente.cor):'#c9a45c'}"/></div>
      </div>`;
    openModal({title:isEdit?'Editar reserva':'Nova reserva', sub:'Reservas são dinheiro separado por objetivo: não são despesa nem receita, apenas organização interna do patrimônio.', fields:[
      {key:'nome',label:'Nome da reserva',type:'text',placeholder:'Ex: Reserva de emergência'},
      bankSelectField('reserva', r.banco),
      {key:'valorAtual',label:'Valor atual',type:'money'},
      {key:'valorMeta',label:'Meta da Reserva (valor alvo)',type:'money'},
      {key:'prazo',label:'Data alvo da reserva',type:'date'},
      {key:'categoria',label:'Categoria',type:'text',placeholder:'Reserva, Viagem, Impostos...'},
      {key:'status',label:'Status',type:'select',options:['Ativa','Pausada','Concluída','Arquivada']},
      {key:'cor',label:'Cor',type:'color'},
      {key:'obs',label:'Observação',type:'text'}
    ], values:r, extraHTML:metaExtraHTML,
    onDelete:isEdit?()=>{
      S.data.reservas.boxes = S.data.reservas.boxes.filter(x=>x.id!==id);
      S.data.reservas.moves = S.data.reservas.moves.filter(m=>m.boxId!==id);
      if(r.metaId) S.data.metas = S.data.metas.filter(mt=>mt.id!==r.metaId);
      saveCurrentData(); closeModal(); renderView();
    }:null,
    onSave(v){
      const banco = requireBanco(v.banco, 'Escolha o banco/conta desta reserva.');
      if(!banco) return;
      let boxRef;
      if(isEdit){ Object.assign(r,{nome:v.nome||'Reserva', banco, valorAtual:Number(v.valorAtual)||0, valorMeta:Number(v.valorMeta)||0, prazo:v.prazo||'', categoria:v.categoria||'', status:v.status||'Ativa', cor:v.cor||'#c9a45c', obs:v.obs||''}); boxRef=r; }
      else { boxRef = {id:uid(), nome:v.nome||'Reserva', banco, valorAtual:Number(v.valorAtual)||0, valorMeta:Number(v.valorMeta)||0, prazo:v.prazo||'', categoria:v.categoria||'', status:v.status||'Ativa', cor:v.cor||'#c9a45c', obs:v.obs||'', metaId:null, createdAt:Date.now()}; S.data.reservas.boxes.push(boxRef); }
      // Meta de Patrimônio embutida na reserva
      const metaAtivaEl = document.getElementById('rz_meta_ativa');
      const metaHabilitada = metaAtivaEl ? metaAtivaEl.checked : false;
      if(metaHabilitada){
        const metaValorEl = document.getElementById('rz_meta_valor');
        const metaValor = metaValorEl ? (parseInt(metaValorEl.dataset.cents||'0',10)/100) : 0;
        const metaPrazoVal = document.getElementById('rz_meta_prazo') ? document.getElementById('rz_meta_prazo').value : '';
        const metaPrazo = metaPrazoVal ? metaPrazoVal+'-01' : null;
        const metaCor = document.getElementById('rz_meta_cor') ? document.getElementById('rz_meta_cor').value : '#c9a45c';
        let mt = boxRef.metaId ? S.data.metas.find(x=>x.id===boxRef.metaId) : null;
        if(!mt){ mt = {id:uid(), reservaId:boxRef.id}; S.data.metas.push(mt); boxRef.metaId = mt.id; }
        Object.assign(mt, {nome:boxRef.nome, emoji:metaEmoji, valorMeta:metaValor, valorAtual:boxRef.valorAtual, prazo:metaPrazo, banco:boxRef.banco, cor:metaCor, reservaId:boxRef.id});
      } else if(boxRef.metaId){
        S.data.metas = S.data.metas.filter(mt=>mt.id!==boxRef.metaId);
        boxRef.metaId = null;
      }
      saveCurrentData(); closeModal(); renderView(); toast(isEdit?'Reserva atualizada.':'Reserva criada.');
    }});
    attachMoneyMask(document.getElementById('rz_meta_valor'), metaExistente?metaExistente.valorMeta:0);
    const metaFieldsWrap = document.getElementById('rz_meta_fields');
    const metaToggle = document.getElementById('rz_meta_ativa');
    if(metaToggle) metaToggle.onchange = ()=>{ if(metaFieldsWrap) metaFieldsWrap.classList.toggle('hidden', !metaToggle.checked); };
    const metaPicker = document.getElementById('rz_meta_emoji_picker');
    if(metaPicker){
      metaPicker.querySelectorAll('.emoji-opt').forEach(btn=>{
        btn.onclick = ()=>{
          metaPicker.querySelectorAll('.emoji-opt').forEach(b=>b.classList.remove('active'));
          btn.classList.add('active');
          metaEmoji = btn.dataset.e;
        };
      });
    }
  },
  move(boxId){
    const boxes = (S.data.reservas.boxes||[]).filter(r=>bankMatches(r.banco));
    if(!boxes.length){ toast('Crie uma reserva primeiro.'); return; }
    const labels = boxes.map(r=>`${r.nome}${r.banco?' · '+r.banco:''}`);
    const selectedBox = (boxId && boxes.find(r=>r.id===boxId)) || boxes[0];
    const selectedLabel = `${selectedBox.nome}${selectedBox.banco?' · '+selectedBox.banco:''}`;
    openModal({title:'Movimentar reserva', sub:'Reserve, resgate ou registre rendimento manual de cada reserva. Reserva não é despesa; resgate não é receita.', fields:[
      {key:'boxLabel',label:'Reserva',type:'select',options:labels,default:selectedLabel},
      {key:'tipo',label:'Tipo de movimentação',type:'select',options:['Reservar','Resgatar','Rendimento','Ajuste manual'],default:'Reservar'},
      {key:'data',label:'Data',type:'date',default:todayISO()},
      {key:'valor',label:'Valor',type:'money'},
      {key:'descricao',label:'Descrição',type:'text',placeholder:'Ex: Separei parte da receita do mês ou rendimento Mercado Pago'},
    ], onSave(v){
      const idx = labels.indexOf(v.boxLabel);
      const bx = boxes[idx>=0?idx:0];
      if(!bx){ toast('Reserva não encontrada.'); return; }
      const valor = Number(v.valor)||0;
      if(valor<=0){ toast('Digite um valor maior que zero.'); return; }
      const saldoAntes = Number(bx.valorAtual||0);
      if(v.tipo==='Reservar' || v.tipo==='Rendimento') bx.valorAtual = saldoAntes + valor;
      else if(v.tipo==='Resgatar') bx.valorAtual = Math.max(0, saldoAntes - valor);
      else if(v.tipo==='Ajuste manual') bx.valorAtual = valor;
      syncMetaFromReserva(bx);
      S.data.reservas.moves.push({id:uid(), boxId:bx.id, tipo:v.tipo, data:v.data||todayISO(), valor, banco:bx.banco||'', descricao:v.descricao||'', saldoAntes, saldoDepois:Number(bx.valorAtual||0), createdAt:Date.now()});
      saveCurrentData(); closeModal(); renderView(); toast('Movimentação registrada.');
    }});
  },
  findMove(id){ return (S.data.reservas&&S.data.reservas.moves||[]).find(m=>m.id===id); },
  reverseMoveEffect(mv){
    if(!mv) return;
    const bx = (S.data.reservas.boxes||[]).find(r=>r.id===mv.boxId);
    if(!bx) return;
    const valor = Number(mv.valor)||0;
    if(mv.tipo==='Reservar' || mv.tipo==='Rendimento' || mv.tipo==='Receita direta') bx.valorAtual = Math.max(0, Number(bx.valorAtual||0) - valor);
    else if(mv.tipo==='Resgatar') bx.valorAtual = Number(bx.valorAtual||0) + valor;
    else if(mv.tipo==='Ajuste manual' && mv.saldoAntes!=null) bx.valorAtual = Number(mv.saldoAntes)||0;
    syncMetaFromReserva(bx);
  },
  applyMoveEffect(mv){
    if(!mv) return;
    const bx = (S.data.reservas.boxes||[]).find(r=>r.id===mv.boxId);
    if(!bx) return;
    const valor = Number(mv.valor)||0;
    const saldoAntes = Number(bx.valorAtual||0);
    mv.saldoAntes = saldoAntes;
    if(mv.tipo==='Reservar' || mv.tipo==='Rendimento' || mv.tipo==='Receita direta') bx.valorAtual = saldoAntes + valor;
    else if(mv.tipo==='Resgatar') bx.valorAtual = Math.max(0, saldoAntes - valor);
    else if(mv.tipo==='Ajuste manual') bx.valorAtual = valor;
    mv.saldoDepois = Number(bx.valorAtual||0);
    mv.banco = bx.banco||mv.banco||'';
    syncMetaFromReserva(bx);
  },
  editMove(id){
    const mv = Reservas.findMove(id);
    if(!mv){ toast('Movimentação não encontrada.'); return; }
    const boxes = (S.data.reservas.boxes||[]).filter(r=>bankMatches(r.banco));
    const labels = boxes.map(r=>`${r.nome}${r.banco?' · '+r.banco:''}`);
    const curBox = boxes.find(r=>r.id===mv.boxId) || boxes[0];
    if(!curBox){ toast('Crie uma reserva primeiro.'); return; }
    const curLabel = `${curBox.nome}${curBox.banco?' · '+curBox.banco:''}`;
    /* Botão de excluir próprio (em vez do onDelete genérico), para poder abrir o modal de
       confirmação customizado sem disparar o aviso de "excluído" do sistema antes da confirmação. */
    openModal({title:'Editar movimentação', sub:'Edite ou apague lançamentos do extrato recente da reserva. O saldo da reserva será recalculado conforme a alteração.', fields:[
      {key:'boxLabel',label:'Reserva',type:'select',options:labels,default:curLabel},
      {key:'tipo',label:'Tipo de movimentação',type:'select',options:['Reservar','Resgatar','Rendimento','Ajuste manual','Receita direta'],default:mv.tipo||'Reservar'},
      {key:'data',label:'Data',type:'date'},
      {key:'valor',label:'Valor',type:'money'},
      {key:'descricao',label:'Descrição',type:'text'},
    ], values:Object.assign({}, mv, {boxLabel:curLabel}),
    extraHTML:`<div class="row-btns" style="margin-top:8px;"><button class="btn btn-danger-solid btn-block" id="mv_del_btn" type="button">Excluir movimentação</button></div>`,
    onSave(v){
      const valor = Number(v.valor)||0;
      if(valor<=0){ toast('Digite um valor maior que zero.'); return; }
      Reservas.reverseMoveEffect(mv);
      const idx = labels.indexOf(v.boxLabel);
      const bx = boxes[idx>=0?idx:0];
      Object.assign(mv,{boxId:bx.id, tipo:v.tipo, data:v.data||todayISO(), valor, banco:bx.banco||'', descricao:v.descricao||'', editedAt:Date.now()});
      Reservas.applyMoveEffect(mv);
      saveCurrentData(); closeModal(); renderView(); toast('Movimentação atualizada.');
    }});
    setTimeout(()=>{
      const delBtn = document.getElementById('mv_del_btn');
      if(delBtn) delBtn.onclick = ()=> Reservas.deleteMove(id);
    },0);
  },
  deleteMove(id){
    const mv = Reservas.findMove(id);
    if(!mv) return;
    openConfirmModal({
      title:'Excluir movimentação',
      text:'Excluir esta movimentação da reserva? O saldo da reserva será recalculado. Você poderá desfazer logo em seguida.',
      confirmLabel:'Excluir',
      cancelLabel:'Cancelar',
      variant:'danger',
      onConfirm(){
        const snapshot = JSON.parse(JSON.stringify(S.data));
        Reservas.reverseMoveEffect(mv);
        S.data.reservas.moves = (S.data.reservas.moves||[]).filter(x=>x.id!==id);
        saveCurrentData(); renderView();
        showUndoToast('Movimentação excluída.', ()=>{ S.data = snapshot; saveCurrentData(); renderView(); });
      }
    });
  }
};

/* ---------------- Metas (dentro de Patrimônio) ---------------- */
const EMOJI_PALETTE = ['🏠','🏡','🚗','🚙','🏍️','🚲','📱','💻','🎸','🎷','🎹','🎻','✈️','🧳','🏖️','⛺','⚽','🎮','📷','⌚','💍','🎓','👶','🐶','🐱','💰','💳','👗','👟','💄','🎬','🎧'];
function openMetaModal(existing){
  const isEdit = !!existing;
  const emojiBtns = EMOJI_PALETTE.map(e=>`<button type="button" class="emoji-opt ${isEdit&&existing.emoji===e?'active':''}" data-e="${e}">${e}</button>`).join('');
  const box = el(`
    <div class="modal-overlay">
      <div class="modal-box">
        <div class="modal-head"><h2>${isEdit?'Editar':'Nova'} meta</h2><button id="mt_close">&times;</button></div>
        <div class="field"><label>Nome</label><input type="text" id="mt_nome" value="${isEdit?esc(existing.nome):''}" placeholder="Ex: Casa, Carro novo..."/></div>
        <div class="field"><label>Ícone</label>
          <div class="emoji-picker" id="mt_emoji_picker">${emojiBtns}</div>
        </div>
        <div class="field"><label>Valor da meta (R$)</label><input type="text" inputmode="numeric" id="mt_valorMeta" class="money-input" placeholder="0,00"/></div>
        <div class="field"><label>Valor já guardado (R$)</label><input type="text" inputmode="numeric" id="mt_valorAtual" class="money-input" placeholder="0,00"/></div>
        <div class="field"><label>Prazo (opcional)</label><input type="month" id="mt_prazo" value="${isEdit&&existing.prazo?existing.prazo.slice(0,7):''}"/></div>
        <div class="field"><label>Banco/Conta vinculada</label><select id="mt_banco"><option>— Nenhum —</option>${allBankNames().map(b=>`<option ${isEdit&&existing.banco===b?'selected':''}>${esc(b)}</option>`).join('')}</select></div>
        <div class="row-btns"><button class="btn btn-primary btn-block" id="mt_save">${isEdit?'Salvar':'Adicionar'}</button></div>
        ${isEdit?`<div class="row-btns" style="margin-top:8px;"><button class="btn btn-danger btn-block" id="mt_delete">Excluir</button></div>`:''}
      </div>
    </div>`);
  $('#modal-root').innerHTML=''; $('#modal-root').appendChild(box);
  attachModalGuard(box);
  $('#mt_close').onclick = closeModal;
  attachMoneyMask($('#mt_valorMeta'), isEdit?existing.valorMeta:0);
  attachMoneyMask($('#mt_valorAtual'), isEdit?existing.valorAtual:0);
  let selectedEmoji = isEdit ? (existing.emoji||'◇') : '◇';
  box.querySelectorAll('.emoji-opt').forEach(btn=>{
    btn.onclick = ()=>{
      box.querySelectorAll('.emoji-opt').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      selectedEmoji = btn.dataset.e;
    };
  });
  $('#mt_save').onclick = ()=>{
    const nome = $('#mt_nome').value.trim() || 'Meta';
    const valorMeta = parseInt($('#mt_valorMeta').dataset.cents||'0',10)/100;
    const valorAtual = parseInt($('#mt_valorAtual').dataset.cents||'0',10)/100;
    const prazoVal = $('#mt_prazo').value;
    const prazo = prazoVal ? prazoVal+'-01' : null;
    const bancoVal = $('#mt_banco').value;
    const banco = bancoVal==='— Nenhum —' ? '' : bancoVal;
    if(isEdit){
      Object.assign(existing, {nome, emoji:selectedEmoji, valorMeta, valorAtual, prazo, banco});
      toast('Meta atualizada.');
    } else {
      S.data.metas.push({id:uid(), nome, emoji:selectedEmoji, valorMeta, valorAtual, prazo, banco});
      toast('Meta criada.');
    }
    saveCurrentData(); closeModal(); renderView();
  };
  if(isEdit){
    $('#mt_delete').onclick = ()=>{
      const idx = S.data.metas.findIndex(x=>x.id===existing.id);
      if(idx<0) return;
      const [removed] = S.data.metas.splice(idx,1);
      saveCurrentData(); closeModal(); renderView();
      showUndoToast('Meta excluída.', ()=>{ S.data.metas.splice(idx,0,removed); saveCurrentData(); renderView(); });
    };
  }
}
const Metas = {
  add(){ openMetaModal(null); },
  edit(id){
    const mt = S.data.metas.find(x=>x.id===id);
    if(!mt) return;
    // Metas vinculadas a uma reserva agora são editadas dentro da própria reserva (Meta de Patrimônio).
    if(mt.reservaId && (S.data.reservas.boxes||[]).some(r=>r.id===mt.reservaId)){ Reservas.edit(mt.reservaId); return; }
    openMetaModal(mt);
  }
};
