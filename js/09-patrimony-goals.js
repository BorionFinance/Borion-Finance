/* Borion Finance — Tela Patrimônio, liquidez, bens, dívidas e metas. */

/* ---------------- VIEW: PATRIMONY ---------------- */
function patrimonioComposicaoSegments(){
  const invest = investAtualTotal();
  const reservas = reservasTotal();
  const segs = [];
  if(invest>0){
    if(investmentsEnabled()) segs.push({label: S.data.investimentos.ativos.length===1? S.data.investimentos.ativos[0].nome : 'Investimentos', value:invest, color:catColor('CDI')});
    else segs.push({label:'Outros', value:invest, color:'var(--muted)'});
  }
  if(reservas>0) segs.push({label:'Reserva', value:reservas, color:'var(--gold)'});
  saldoContasDetalhe().forEach(l=> segs.push({label:l.nome, value:l.valor, color:catColor(l.nome)}));
  S.data.bens.filter(b=>bankMatches(b.banco,b.accountId)).forEach(b=> segs.push({label:b.nome, value:b.valor, color:catColor(b.nome)}));
  return segs;
}
/* V6.23.5 — Metas e Reservas usam a mesma ideia de objetivo, mas com comportamentos
   diferentes conforme o módulo. Com Reserva desligada, somente metas independentes ficam
   visíveis e editáveis. Ao religar, elas são convertidas uma única vez em Cofrinhos. */
function metaReservaId(mt){
  if(!mt) return null;
  if(mt.reservaId && ((S.data.reservas&&S.data.reservas.boxes)||[]).some(r=>r.id===mt.reservaId)) return mt.reservaId;
  const box=((S.data.reservas&&S.data.reservas.boxes)||[]).find(r=>r.metaId===mt.id);
  return box ? box.id : null;
}
function isMetaLinkedToReserva(mt){ return !!metaReservaId(mt); }
function metasPatrimonioVisible(){
  const all=(S.data.metas||[]).filter(mt=>bankMatches(mt.banco,mt.accountId));
  return reservasEnabled() ? all : all.filter(mt=>!isMetaLinkedToReserva(mt));
}
function convertStandaloneMetasToReservas(){
  if(!S.data.reservas) S.data.reservas={enabled:true,boxes:[],moves:[],monthlyReports:[]};
  if(!Array.isArray(S.data.reservas.boxes)) S.data.reservas.boxes=[];
  const converted=[];
  (S.data.metas||[]).forEach(mt=>{
    if(isMetaLinkedToReserva(mt)) return;
    const existing=S.data.reservas.boxes.find(r=>r.convertedFromMetaId===mt.id);
    if(existing){ mt.reservaId=existing.id; existing.metaId=mt.id; return; }
    const now=Date.now();
    const box={
      id:uid(),
      nome:mt.nome||'Meta de patrimônio',
      accountId:mt.accountId||null,
      banco:accountNameSnapshot(mt.accountId,mt.banco||''),
      valorAtual:Number(mt.valorAtual)||0,
      valorMeta:Number(mt.valorMeta)||0,
      prazo:mt.prazo||'',
      categoria:'Meta de patrimônio',
      status:Number(mt.valorMeta)>0 && Number(mt.valorAtual)>=Number(mt.valorMeta) ? 'Concluída' : 'Ativa',
      cor:mt.cor||'#c9a45c',
      corValor:'#e8c98a',
      obs:'Criada automaticamente a partir de uma Meta de Patrimônio quando o módulo Reserva foi ativado.',
      metaId:mt.id,
      convertedFromMetaId:mt.id,
      createdAt:Number(mt.createdAt)||now
    };
    mt.reservaId=box.id;
    mt.valorAtual=box.valorAtual;
    mt.banco=box.banco;
    S.data.reservas.boxes.push(box);
    converted.push(box);
  });
  return converted;
}

function renderPatrimony(){
  const liq = liquidezTotal(), bens = bensTotal(), invest = investAtualTotal(), reservas = reservasTotal(), divDebt = computeCardsDebt(), div = divDebt.total;
  const total = liq+reservas+bens+invest-div;
  const composicaoTotal = liq+reservas+bens+invest;
  const segs = patrimonioComposicaoSegments();

  const saldoContasRows = saldoContasDetalhe();
  const liqRows = saldoContasRows.map(l=>`
    <div class="list-row"><span class="lname">${esc(l.nome)}${l.isCarteira?' <span style="color:var(--muted);font-weight:400;">(dinheiro físico)</span>':''}</span><span class="lval">${brl(l.valor)}</span>${l.tipo==='conta' ? `<button class="ledit" onclick="Cards.editConta('${l.contaId}')" title="Editar conta">✎</button>` : `<button class="ledit" onclick="Patr.editLiquidez('${l.id}')" title="Editar ativo">✎</button>`}</div>`).join('');
  const liqEmpty = !saldoContasRows.length
    ? `<div class="empty-note">Nenhuma conta bancária cadastrada ainda.</div><button class="btn-outline btn-sm" style="margin-top:8px;" onclick="Patr.goAddConta()">+ Adicionar conta</button>`
    : '';
  const bensRows = S.data.bens.filter(b=>bankMatches(b.banco,b.accountId)).map(b=>`
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
      <div class="card"><div class="clabel">${tagBadgeHTML('liquidez','SALDO EM CONTAS')}</div><div class="cval">${brl(liq)}</div></div>
      ${reservasEnabled()?`<div class="card hero-gold"><div class="clabel">${tagBadgeHTML('investimentos','RESERVA')}</div><div class="cval">${brl(reservas)}</div></div>`:''}
      <div class="card"><div class="clabel">${tagBadgeHTML('bens','BENS')}</div><div class="cval">${brl(bens)}</div></div>
      ${investmentsEnabled()?`<div class="card"><div class="clabel">${tagBadgeHTML('investimentos','INVESTIMENTOS')}</div><div class="cval">${brl(invest)}</div></div>`:''}
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
          <div class="toolbar"><div class="toolbar-left" style="color:#22c55e">SALDO EM CONTAS</div><button class="btn-outline" onclick="Patr.goAddConta()">+ Adicionar conta</button></div>
          ${liqRows}${liqEmpty}
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
        <div class="toolbar"><div class="toolbar-left">◇ Metas de patrimônio</div>${reservasEnabled()?`<button class="btn-outline btn-sm" onclick="Nav.go('reservas')">Criar em uma reserva</button>`:`<button class="btn-outline btn-sm" onclick="Metas.add()">+ Adicionar meta</button>`}</div>
        <p style="font-size:11px;color:var(--muted-2);margin:-6px 0 10px;">${reservasEnabled()
          ? 'Com Reserva ativa, as metas ficam vinculadas aos Cofrinhos e são editadas dentro de cada reserva.'
          : 'Com Reserva desativada, estas metas são independentes: você pode adicionar, editar e excluir. Ao ativar Reserva novamente, cada meta será convertida em um Cofrinho sem apagar os Cofrinhos antigos.'}</p>
        ${renderMetasList()}
      </div>
    </div>
  `;
}

function renderMetasList(){
  const metas = metasPatrimonioVisible();
  if(!metas.length) return '<div class="empty-note">'+(reservasEnabled()?'Nenhuma meta vinculada a uma reserva ainda.':'Nenhuma meta cadastrada ainda')+(S.bankFilter?' para o filtro de banco atual':'')+'.</div>';
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
  /* V6.22 — "Saldo em contas" não aceita mais valor digitado à mão: o botão leva direto para
     o cadastro de conta já existente em Cartões e Contas (mesmo padrão do showBankRequiredModal). */
  goAddConta(){
    S.view='cards'; renderApp();
    setTimeout(()=>{ if(typeof Cards!=='undefined' && Cards.addConta) Cards.addConta(); }, 80);
  },
  addLiquidez(){
    openModal({title:'Adicionar ativo de liquidez', sub:'Valor neste mês.', fields:[{key:'nome',label:'Nome',type:'text'},{key:'valor',label:'Valor',type:'money'},bankSelectField(null,'',{key:'accountId'})],
      onSave(v){ S.data.liquidez.push({id:uid(),nome:v.nome,valor:Number(v.valor)||0,accountId:v.accountId||null,banco:accountNameSnapshot(v.accountId)}); saveCurrentData(); closeModal(); renderView(); }});
  },
  editLiquidez(id){
    const l = S.data.liquidez.find(x=>x.id===id);
    openModal({title:'Editar ativo extra (não vinculado a uma conta)', sub:'Item criado antes da conta bancária virar automática. Se preferir, exclua e cadastre uma conta de verdade em Cartões e Contas.', fields:[{key:'nome',label:'Nome',type:'text'},{key:'valor',label:'Valor',type:'money'},bankSelectField(null,l.accountId||l.banco,{key:'accountId'})], values:l,
      onDelete(){ S.data.liquidez = S.data.liquidez.filter(x=>x.id!==id); saveCurrentData(); closeModal(); renderView(); },
      onSave(v){ Object.assign(l,{nome:v.nome,valor:Number(v.valor)||0,accountId:v.accountId||null,banco:accountNameSnapshot(v.accountId)}); saveCurrentData(); closeModal(); renderView(); }});
  },
  addBem(){
    openModal({title:'Adicionar bem', fields:[{key:'nome',label:'Nome',type:'text'},{key:'valor',label:'Valor estimado',type:'money'},bankSelectField(null,'',{key:'accountId'})],
      onSave(v){ S.data.bens.push({id:uid(),nome:v.nome,valor:Number(v.valor)||0,accountId:v.accountId||null,banco:accountNameSnapshot(v.accountId)}); saveCurrentData(); closeModal(); renderView(); }});
  },
  editBem(id){
    const b = S.data.bens.find(x=>x.id===id);
    openModal({title:'Editar bem', fields:[{key:'nome',label:'Nome',type:'text'},{key:'valor',label:'Valor estimado',type:'money'},bankSelectField(null,b.accountId||b.banco,{key:'accountId'})], values:b,
      onDelete(){ S.data.bens = S.data.bens.filter(x=>x.id!==id); saveCurrentData(); closeModal(); renderView(); },
      onSave(v){ Object.assign(b,{nome:v.nome,valor:Number(v.valor)||0,accountId:v.accountId||null,banco:accountNameSnapshot(v.accountId)}); saveCurrentData(); closeModal(); renderView(); }});
  },
  toggleDividas(){ S.patrView.dividasCollapsed = !S.patrView.dividasCollapsed; renderView(); },
  toggleReservas(){ S.patrView.reservasCollapsed = !(S.patrView.reservasCollapsed !== false); renderView(); },
  toggleReservaRendimentos(){ S.patrView.reservaRendimentosCollapsed = !(S.patrView.reservaRendimentosCollapsed !== false); renderView(); }
};


/* ---------------- Reserva (dentro de Patrimônio) ---------------- */
function reservaFmtDate(iso){ if(!iso) return ''; const parts=String(iso).slice(0,10).split('-'); return parts.length===3 ? parts[2]+'/'+parts[1]+'/'+parts[0] : esc(iso); }
function reservaBoxesFiltered(){
  const base = ((S.data.reservas&&S.data.reservas.boxes)||[]).filter(r=>bankMatches(r.banco));
  /* Organização visual (opcional): aplica a ordem personalizada/A-Z/Z-A/recentes salva pelo
     usuário. Só muda a ordem de exibição — nunca altera os dados da reserva nem seu saldo. */
  return window.OrderPreferences ? OrderPreferences.applyOrder('reservas', base, {idKey:'id', labelKey:'nome'}) : base;
}
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

/* ---------------- V6.23.3 — Refinamento dos relatórios mensais dos Cofrinhos ----------------
   Um fechamento é uma fotografia imutável do mês. Ele guarda valores, metas, status e
   movimentações daquele momento dentro do próprio perfil. Nada daqui participa dos
   cálculos atuais das Reservas/Cofrinhos; a camada é exclusivamente de leitura. */
function reservaMonthlyReports(){
  if(!S.data.reservas) S.data.reservas={enabled:true,boxes:[],moves:[],monthlyReports:[]};
  if(!Array.isArray(S.data.reservas.monthlyReports)) S.data.reservas.monthlyReports=[];
  return S.data.reservas.monthlyReports;
}
function reservaReportMonthLabel(key){
  const parts=String(key||'').split('-').map(Number);
  return parts.length===2 && parts[0] && parts[1]>=1 && parts[1]<=12 ? monthLabel(parts[0],parts[1]-1) : String(key||'');
}
function reservaReportSigned(value){
  const n=Number(value)||0;
  const cls=n>0?'val-pos':(n<0?'val-neg':'');
  const sign=n>0?'+ ':'';
  return `<span class="${cls}">${sign}${brl(n)}</span>`;
}
function buildReservaMonthlyReport(key){
  const month = key || monthKey(todayYM().y,todayYM().m);
  const boxes=(S.data.reservas.boxes||[]).map(r=>({
    id:r.id,
    nome:r.nome||'Cofrinho',
    accountId:r.accountId||null,
    banco:r.banco||'',
    categoria:r.categoria||'',
    status:r.status||'Ativa',
    valorAtual:Number(r.valorAtual)||0,
    valorMeta:Number(r.valorMeta)||0,
    prazo:r.prazo||'',
    cor:r.cor||'#c9a45c',
    corValor:r.corValor||'#e8c98a',
    createdAt:r.createdAt||null
  }));
  const moves=(S.data.reservas.moves||[]).filter(m=>m.data && m.data.slice(0,7)===month).map(m=>({
    id:m.id,
    boxId:m.boxId,
    tipo:m.tipo||'',
    data:m.data||'',
    valor:Number(m.valor)||0,
    banco:m.banco||'',
    descricao:m.descricao||'',
    saldoAntes:m.saldoAntes==null?null:Number(m.saldoAntes)||0,
    saldoDepois:m.saldoDepois==null?null:Number(m.saldoDepois)||0,
    createdAt:m.createdAt||null
  }));
  const pos=['Reservar','Rendimento','Receita direta','Transferência recebida'];
  const neg=['Resgatar','Pagamento direto','Pagamento de despesa fixa','Transferência enviada'];
  const entradas=moves.filter(m=>pos.includes(m.tipo)).reduce((a,m)=>a+(Number(m.valor)||0),0);
  const saidas=moves.filter(m=>neg.includes(m.tipo)).reduce((a,m)=>a+(Number(m.valor)||0),0);
  const rendimentos=moves.filter(m=>m.tipo==='Rendimento').reduce((a,m)=>a+(Number(m.valor)||0),0);
  return {
    id:uid(),
    monthKey:month,
    monthLabel:reservaReportMonthLabel(month),
    closedAt:new Date().toISOString(),
    total:boxes.reduce((a,r)=>a+(Number(r.valorAtual)||0),0),
    metaTotal:boxes.reduce((a,r)=>a+(Number(r.valorMeta)||0),0),
    activeCount:boxes.filter(r=>(r.status||'Ativa')==='Ativa').length,
    boxCount:boxes.length,
    summary:{entradas,saidas,rendimentos,movimentacoes:moves.length},
    boxes,
    moves
  };
}
function reservaReportComparison(report){
  const current=(S.data.reservas.boxes||[]);
  const byId=new Map(current.map(r=>[r.id,r]));
  const seen=new Set();
  const rows=[];
  (report.boxes||[]).forEach(old=>{
    seen.add(old.id);
    const now=byId.get(old.id)||null;
    rows.push({old,now,createdAfter:false,removed:!now});
  });
  current.forEach(now=>{
    if(seen.has(now.id)) return;
    rows.push({old:{id:now.id,nome:now.nome||'Cofrinho',banco:now.banco||'',categoria:now.categoria||'',status:'Ainda não existia',valorAtual:0,valorMeta:0,cor:now.cor||'#c9a45c',corValor:now.corValor||'#e8c98a'},now,createdAfter:true,removed:false});
  });
  return rows;
}
function renderReservaMonthlyReport(report){
  if(!report) return '<div class="empty-note">Relatório não encontrado.</div>';
  const currentTotal=(S.data.reservas.boxes||[]).reduce((a,r)=>a+(Number(r.valorAtual)||0),0);
  const delta=currentTotal-(Number(report.total)||0);
  const rows=reservaReportComparison(report).map(item=>{
    const old=item.old, now=item.now;
    const oldVal=Number(old.valorAtual)||0;
    const nowVal=now?(Number(now.valorAtual)||0):0;
    const diff=nowVal-oldVal;
    const pct=Number(old.valorMeta)>0?Math.min(100,Math.round(oldVal/Number(old.valorMeta)*100)):0;
    const state=item.createdAfter?'<span class="report-state new">Criado depois</span>':(item.removed?'<span class="report-state removed">Não existe mais</span>':'<span class="report-state kept">Atual</span>');
    return `<div class="reserve-report-row">
      <div class="reserve-report-name">
        <span class="dot" style="background:${esc(old.cor||'#c9a45c')}"></span>
        <div><strong>${esc(old.nome||'Cofrinho')}</strong><span>${esc(old.banco||'Sem banco')}${old.categoria?' · '+esc(old.categoria):''}</span></div>
      </div>
      <div class="reserve-report-cell"><small>No fechamento</small><b>${brl(oldVal)}</b>${Number(old.valorMeta)>0?`<em>Meta ${brl(old.valorMeta)} · ${pct}%</em>`:''}</div>
      <div class="reserve-report-cell"><small>Hoje</small><b>${now?brl(nowVal):'—'}</b>${state}</div>
      <div class="reserve-report-cell reserve-report-delta"><small>Evolução</small><b>${item.removed?'—':reservaReportSigned(diff)}</b></div>
    </div>`;
  }).join('');
  const closedAt=report.closedAt?new Date(report.closedAt).toLocaleString('pt-BR'):'—';
  const moves=(report.moves||[]).slice().sort((a,b)=>String(b.data||'').localeCompare(String(a.data||''))).map(m=>{
    const box=(report.boxes||[]).find(r=>r.id===m.boxId);
    const positive=['Reservar','Rendimento','Receita direta','Transferência recebida'].includes(m.tipo);
    const negative=['Resgatar','Pagamento direto','Pagamento de despesa fixa','Transferência enviada'].includes(m.tipo);
    return `<tr><td>${reservaFmtDate(m.data)}</td><td>${esc(box?box.nome:'Cofrinho removido')}</td><td>${esc(m.tipo)}</td><td class="${positive?'val-pos':negative?'val-neg':''}">${positive?'+ ':negative?'- ':''}${brl(m.valor)}</td><td>${esc(m.descricao||'')}</td></tr>`;
  }).join('');
  return `<div class="reserve-report-readonly">
    <div class="reserve-report-lock">🔒 Relatório fechado e somente para visualização</div>
    <div class="reserve-report-summary">
      <div><small>Total em ${esc(report.monthLabel||reservaReportMonthLabel(report.monthKey))}</small><strong>${brl(report.total)}</strong></div>
      <div><small>Total hoje</small><strong>${brl(currentTotal)}</strong></div>
      <div><small>Evolução desde o fechamento</small><strong>${reservaReportSigned(delta)}</strong></div>
      <div><small>Cofrinhos no fechamento</small><strong>${Number(report.boxCount)||0}</strong></div>
    </div>
    <div class="reserve-report-meta">Fechado em ${esc(closedAt)} · ${Number(report.activeCount)||0} ativo(s) · Meta total ${brl(report.metaTotal||0)}</div>
    <div class="reserve-report-flow">
      <div><small>Entradas no mês</small><b class="val-pos">${brl(report.summary&&report.summary.entradas||0)}</b></div>
      <div><small>Saídas no mês</small><b class="val-neg">${brl(report.summary&&report.summary.saidas||0)}</b></div>
      <div><small>Rendimentos</small><b class="val-pos">${brl(report.summary&&report.summary.rendimentos||0)}</b></div>
      <div><small>Movimentações</small><b>${Number(report.summary&&report.summary.movimentacoes)||0}</b></div>
    </div>
    <h3 class="reserve-report-section-title">Comparação dos Cofrinhos</h3>
    <div class="reserve-report-list">${rows||'<div class="empty-note">Nenhum Cofrinho existia neste fechamento.</div>'}</div>
    <h3 class="reserve-report-section-title">Movimentações congeladas do mês</h3>
    ${moves?`<div class="table-scroll"><table><thead><tr><th>Data</th><th>Cofrinho</th><th>Tipo</th><th>Valor</th><th>Descrição</th></tr></thead><tbody>${moves}</tbody></table></div>`:'<div class="empty-note">Nenhuma movimentação registrada neste mês.</div>'}
  </div>`;
}
function openReservaReportsModal(preferredKey){
  const reports=reservaMonthlyReports().slice().sort((a,b)=>String(b.monthKey).localeCompare(String(a.monthKey)));
  if(!reports.length){
    const box=el(`<div class="modal-overlay reserve-report-overlay"><div class="modal-box reserve-report-modal is-empty">
      <div class="reserve-report-modal-header">
        <div class="modal-head"><div><h2>Histórico dos Cofrinhos</h2><p class="modal-sub">Os meses fechados aparecerão aqui como fotografias permanentes.</p></div><button id="rr_close" aria-label="Fechar">&times;</button></div>
      </div>
      <div class="reserve-report-empty-body"><div class="empty-note">Ainda não há nenhum mês fechado.</div></div>
      <div class="reserve-report-modal-footer"><button class="btn btn-secondary" id="rr_close2">Fechar</button></div>
    </div></div>`);
    $('#modal-root').innerHTML=''; $('#modal-root').appendChild(box); attachModalGuard(box);
    $('#rr_close').onclick=closeModal; $('#rr_close2').onclick=closeModal;
    return;
  }
  const selected=reports.some(r=>r.monthKey===preferredKey)?preferredKey:reports[0].monthKey;
  const options=reports.map(r=>`<option value="${esc(r.monthKey)}" ${r.monthKey===selected?'selected':''}>${esc(r.monthLabel||reservaReportMonthLabel(r.monthKey))}</option>`).join('');
  const box=el(`<div class="modal-overlay reserve-report-overlay"><div class="modal-box reserve-report-modal">
    <div class="reserve-report-modal-header">
      <div class="modal-head"><div><h2>Histórico dos Cofrinhos</h2><p class="modal-sub">Compare um mês fechado com os valores de hoje.</p></div><button id="rr_close" aria-label="Fechar">&times;</button></div>
      <div class="reserve-report-picker"><label for="rr_month">Mês fechado</label><select id="rr_month">${options}</select></div>
    </div>
    <div id="rr_content" class="reserve-report-scroll"></div>
    <div class="reserve-report-modal-footer"><span>Somente visualização · o fechamento original não pode ser alterado</span><button class="btn btn-secondary" id="rr_close2">Fechar</button></div>
  </div></div>`);
  $('#modal-root').innerHTML=''; $('#modal-root').appendChild(box); attachModalGuard(box);
  const render=()=>{ const r=reports.find(x=>x.monthKey===$('#rr_month').value)||reports[0]; $('#rr_content').innerHTML=renderReservaMonthlyReport(r); };
  $('#rr_month').onchange=render; $('#rr_close').onclick=closeModal; $('#rr_close2').onclick=closeModal; render();
}
function saveReservaMonthlyReport(key){
  const month=key||monthKey(todayYM().y,todayYM().m);
  const reports=reservaMonthlyReports();
  const existing=reports.find(r=>r.monthKey===month);
  if(existing) return {created:false,report:existing};
  /* Guarda uma cópia desconectada dos objetos vivos. Assim, editar um Cofrinho ou uma
     movimentação depois do fechamento nunca altera a fotografia histórica. */
  const report=JSON.parse(JSON.stringify(buildReservaMonthlyReport(month)));
  reports.push(report);
  saveCurrentData();
  return {created:true,report};
}
function closeCurrentReservaMonth(){
  const key=monthKey(todayYM().y,todayYM().m);
  const existing=reservaMonthlyReports().find(r=>r.monthKey===key);
  if(existing){ toast(reservaReportMonthLabel(key)+' já está fechado. O relatório original foi preservado.'); openReservaReportsModal(key); return; }
  openConfirmModal({
    title:'Fechar '+reservaReportMonthLabel(key)+'?',
    text:'O Borion salvará uma fotografia permanente dos Cofrinhos deste perfil: valores, metas, status e movimentações do mês. O relatório será somente para visualização e não alterará nenhum saldo.',
    confirmLabel:'Fechar mês', cancelLabel:'Cancelar', variant:'gold',
    onConfirm(){
      const result=saveReservaMonthlyReport(key);
      closeModal(); renderView();
      if(!result.created){ toast(reservaReportMonthLabel(key)+' já estava fechado. O relatório original foi preservado.'); openReservaReportsModal(key); return; }
      toast(reservaReportMonthLabel(key)+' fechado. Relatório salvo.');
      setTimeout(()=>openReservaReportsModal(key),80);
    }
  });
}
function renderReservaReportsControls(){
  const reports=reservaMonthlyReports().slice().sort((a,b)=>String(b.monthKey).localeCompare(String(a.monthKey)));
  const currentKey=monthKey(todayYM().y,todayYM().m);
  const currentClosed=reports.some(r=>r.monthKey===currentKey);
  const latest=reports[0];
  const historyTitle=latest
    ? `Último fechamento: ${latest.monthLabel||reservaReportMonthLabel(latest.monthKey)}, com ${brl(latest.total)}.`
    : 'Ainda não há meses fechados.';
  return `<div class="reserve-history-compact">
    <button type="button" class="reserve-history-link" onclick="openReservaReportsModal()" title="${esc(historyTitle)}" aria-label="Abrir histórico mensal dos Cofrinhos"><span aria-hidden="true">◷</span> Histórico</button>
    <span class="reserve-history-divider" aria-hidden="true"></span>
    ${currentClosed
      ? `<span class="reserve-month-closed" title="O fechamento original deste mês está preservado."><span aria-hidden="true">✓</span> ${esc(reservaReportMonthLabel(currentKey))} fechado</span>`
      : `<button type="button" class="reserve-close-month-link" onclick="closeCurrentReservaMonth()" title="Salvar uma fotografia permanente dos Cofrinhos deste mês">Fechar ${esc(reservaReportMonthLabel(currentKey))}</button>`}
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
  /* Organização visual (opcional): mesma regra das outras listas — alça/setas só aparecem
     com o modo Organizar ligado e sem filtro de banco ativo (a ordem salva é sempre da
     lista completa de reservas do perfil, nunca de uma lista já filtrada). */
  const orgActive = !!(window.OrderPreferences && OrderPreferences.active);
  const canReorderNow = !!(window.OrderPreferences && OrderPreferences.canReorderNow());
  const showReorder = orgActive && canReorderNow;
  const boxNaturalIds = boxes.map(r=>r.id);
  const boxCards = boxes.map(r=>{
    const temMeta = Number(r.valorMeta)>0;
    const pct = temMeta ? Math.min(100, Math.round(Number(r.valorAtual||0)/Number(r.valorMeta||0)*100)) : 0;
    const mt = r.metaId ? (S.data.metas||[]).find(x=>x.id===r.metaId) : null;
    const metaPct = mt && Number(mt.valorMeta)>0 ? Math.min(100, Math.round(Number(mt.valorAtual||0)/Number(mt.valorMeta||0)*100)) : 0;
    const metaHTML = mt ? `<div class="reserva-foot" style="margin-top:4px;"><span>${esc(mt.emoji||'◇')} Meta de patrimônio: ${brl(mt.valorAtual||0)} de ${brl(mt.valorMeta||0)}</span><span style="font-weight:800;color:${metaPct>=100?'#22c55e':'var(--gold-bright)'}">${metaPct}%</span></div>` : '';
    return `<div class="reserva-card" data-order-id="${esc(r.id)}">
      <div class="reserva-head"><div><div class="reserva-title"><span class="dot" style="background:${esc(r.cor||'var(--gold)')}"></span>${esc(r.nome)}</div><div class="reserva-meta">${esc(r.banco||'Sem banco')} ${r.categoria?'· '+esc(r.categoria):''}</div></div>${reservaStatusPill(r.status)}</div>
      <div class="reserva-value" style="color:${esc(r.corValor||'var(--gold-bright)')};">${brl(Number(r.valorAtual)||0)}</div>
      ${temMeta?`
      <div class="meta-progress-outer"><div class="meta-progress-inner" style="width:${pct}%;background:${esc(r.cor||'var(--gold)')};"></div></div>
      <div class="reserva-foot"><span>Meta: ${brl(r.valorMeta)}</span><span>${pct}%</span></div>` : `
      <div class="reserva-foot"><span>Sem meta definida</span><span></span></div>`}
      ${metaHTML}
      ${showReorder ? OrderPreferences.reorderRowControlsHTML('reservas', r.id, r.nome, boxNaturalIds) : `<div class="reserva-actions"><button onclick="Reservas.move('${r.id}')">Movimentar</button><button onclick="Reservas.viewExtrato('${r.id}')">Ver extrato</button><button onclick="Reservas.edit('${r.id}')">Editar</button></div>`}
    </div>`;
  }).join('');
  const orgFilterNotice = orgActive && !canReorderNow ? OrderPreferences.filterBlockedNoticeHTML() : '';
  const moveRows = moves.map(m=>{
    const box = (S.data.reservas.boxes||[]).find(r=>r.id===m.boxId);
    const positive = Reservas.POSITIVE_TYPES.includes(m.tipo);
    const negative = Reservas.NEGATIVE_TYPES.includes(m.tipo);
    const isAdjust = m.tipo==='Ajuste manual';
    const linked = m.despesaTransacaoId ? ' <span class="cat-pill" style="opacity:.8;"><span class="dot" style="background:var(--gold-bright)"></span>🔗 Despesa</span>' : (m.transferenciaId ? ' <span class="cat-pill" style="opacity:.8;"><span class="dot" style="background:var(--gold-bright)"></span>🔗 Transferência</span>' : '');
    return `<tr><td>${reservaFmtDate(m.data)}</td><td>${esc(box?box.nome:'Reserva removida')}</td><td>${esc(m.tipo)}</td><td>${esc(m.banco||'')}</td><td class="${positive||isAdjust?'val-pos':negative?'val-neg':''}">${positive?'+ ':negative?'- ':''}${brl(m.valor)}</td><td>${esc(m.descricao||'')}${linked}</td><td style="text-align:right;white-space:nowrap;"><button class="ledit" onclick="Reservas.editMove('${m.id}')">✎</button><button class="ledit danger-mini" onclick="Reservas.deleteMove('${m.id}')">×</button></td></tr>`;
  }).join('');
  return `<div class="panel-box reservas-panel">
    <div class="toolbar"><div class="toolbar-left">◈ <span class="lmeta">Reservado: ${brl(total)}</span></div><div class="reserva-toolbar-actions">${renderReservaReportsControls()}${window.OrderPreferences?OrderPreferences.sortSelectHTML('reservas'):''}<button class="btn-outline" onclick="Reservas.add()">+ Nova reserva</button><button class="btn-outline" onclick="Reservas.move()">+ Movimentação</button></div></div>
    ${orgFilterNotice}
    ${boxes.length?`<div class="reserva-grid" data-order-list="reservas">${boxCards}</div>`:'<div class="empty-note">Nenhuma reserva cadastrada ainda. Use para separar reserva de emergência, viagem, manutenção, impostos e objetivos.</div>'}
    <div class="reserva-extrato-title">Extrato recente das reservas</div>
    ${moveRows?`<div class="table-scroll"><table><thead><tr><th>Data</th><th>Reserva</th><th>Tipo</th><th>Banco</th><th>Valor</th><th>Descrição</th><th></th></tr></thead><tbody>${moveRows}</tbody></table></div>`:'<div class="empty-note">Nenhuma movimentação registrada ainda.</div>'}
  </div>`;
}
const Reservas = {
  add(){ Reservas.edit(null); },
  edit(id){
    const isEdit = !!id;
    const r = isEdit ? S.data.reservas.boxes.find(x=>x.id===id) : {nome:'', banco:'', valorAtual:0, valorMeta:0, prazo:'', categoria:'Reserva', status:'Ativa', cor:'#c9a45c', corValor:'#e8c98a', obs:'', metaId:null};
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
      accountSelectField('reserva', r.accountId||r.banco,{key:'accountId'}),
      {key:'valorAtual',label:'Valor atual',type:'money'},
      {key:'valorMeta',label:'Meta da Reserva (valor alvo)',type:'money'},
      {key:'prazo',label:'Data alvo da reserva',type:'date'},
      {key:'categoria',label:'Categoria',type:'text',placeholder:'Reserva, Viagem, Impostos...'},
      {key:'status',label:'Status',type:'select',options:['Ativa','Pausada','Concluída','Arquivada']},
      {key:'cor',label:'Cor da barra de progresso',type:'color'},
      {key:'corValor',label:'Cor do valor',type:'color'},
      {key:'obs',label:'Observação',type:'text'}
    ], values:r, extraHTML:metaExtraHTML,
    onDelete:isEdit?()=>{
      S.data.reservas.boxes = S.data.reservas.boxes.filter(x=>x.id!==id);
      S.data.reservas.moves = S.data.reservas.moves.filter(m=>m.boxId!==id);
      if(r.metaId) S.data.metas = S.data.metas.filter(mt=>mt.id!==r.metaId);
      saveCurrentData(); closeModal(); renderView();
    }:null,
    onSave(v){
      const accountId = requireAccountId(v.accountId, 'Escolha o banco/conta desta reserva.');
      if(!accountId) return;
      const banco = accountNameSnapshot(accountId);
      let boxRef;
      if(isEdit){ Object.assign(r,{nome:v.nome||'Reserva', accountId, banco, valorAtual:Number(v.valorAtual)||0, valorMeta:Number(v.valorMeta)||0, prazo:v.prazo||'', categoria:v.categoria||'', status:v.status||'Ativa', cor:v.cor||'#c9a45c', corValor:v.corValor||'#e8c98a', obs:v.obs||''}); boxRef=r; }
      else { boxRef = {id:uid(), nome:v.nome||'Reserva', accountId, banco, valorAtual:Number(v.valorAtual)||0, valorMeta:Number(v.valorMeta)||0, prazo:v.prazo||'', categoria:v.categoria||'', status:v.status||'Ativa', cor:v.cor||'#c9a45c', corValor:v.corValor||'#e8c98a', obs:v.obs||'', metaId:null, createdAt:Date.now()}; S.data.reservas.boxes.push(boxRef); }
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
      if(v.tipo==='Resgatar' && !reservaTemSaldo(bx, valor)){ showReservaInsuficienteModal(bx, valor); return; }
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
  /* V6.0 — tipos que aumentam o saldo da reserva vs. tipos que diminuem. 'Pagamento direto'
     é uma despesa paga direto da reserva (nunca vira Receita); 'Transferência enviada'/
     'Transferência recebida' vêm da tela genérica de Transferências (Cartões e Contas). */
  POSITIVE_TYPES: ['Reservar','Rendimento','Receita direta','Transferência recebida'],
  /* V6.1 — 'Pagamento de despesa fixa' segue exatamente o mesmo mecanismo já usado por
     'Pagamento direto' (despesa variável paga direto da reserva): aparece no extrato,
     some do saldo, e é revertido via Reservas.reverseMoveEffect quando a despesa fixa
     volta a pendente ou é excluída. */
  NEGATIVE_TYPES: ['Resgatar','Pagamento direto','Pagamento de despesa fixa','Transferência enviada'],
  reverseMoveEffect(mv){
    if(!mv) return;
    const bx = (S.data.reservas.boxes||[]).find(r=>r.id===mv.boxId);
    if(!bx) return;
    const valor = Number(mv.valor)||0;
    if(Reservas.POSITIVE_TYPES.includes(mv.tipo)) bx.valorAtual = Math.max(0, Number(bx.valorAtual||0) - valor);
    else if(Reservas.NEGATIVE_TYPES.includes(mv.tipo)) bx.valorAtual = Number(bx.valorAtual||0) + valor;
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
    if(Reservas.POSITIVE_TYPES.includes(mv.tipo)) bx.valorAtual = saldoAntes + valor;
    else if(Reservas.NEGATIVE_TYPES.includes(mv.tipo)) bx.valorAtual = Math.max(0, saldoAntes - valor);
    else if(mv.tipo==='Ajuste manual') bx.valorAtual = valor;
    mv.saldoDepois = Number(bx.valorAtual||0);
    mv.banco = bx.banco||mv.banco||'';
    syncMetaFromReserva(bx);
  },
  editMove(id){
    const mv = Reservas.findMove(id);
    if(!mv){ toast('Movimentação não encontrada.'); return; }
    /* V6.0 — movimentações geradas automaticamente por uma despesa (Pagamento direto) ou por
       uma transferência só podem ser editadas pela origem, para nunca dessincronizar os dois
       lados do vínculo (mesmo padrão já usado por compras de cartão/boleto em Despesas). */
    if(mv.despesaTransacaoId){ toast('Esta movimentação vem de uma despesa paga direto da reserva — edite ou exclua pela despesa em Lançamentos.'); S.view='budget'; S.budgetTab='variavel'; renderApp(); return; }
    if(mv.despesaFixaId){ toast('Esta movimentação vem de uma despesa fixa paga com a reserva — edite ou exclua pela despesa fixa em Lançamentos.'); S.view='budget'; S.budgetTab='fixa'; renderApp(); return; }
    if(mv.transferenciaId){ toast('Esta movimentação vem de uma transferência — edite ou exclua em Cartões e Contas → Transferências.'); S.view='cards'; renderApp(); return; }
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
      if(Reservas.NEGATIVE_TYPES.includes(v.tipo) && !reservaTemSaldo(bx, valor)){
        Reservas.applyMoveEffect(mv); // desfaz o reverse acima antes de cancelar
        showReservaInsuficienteModal(bx, valor);
        return;
      }
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
    if(mv.despesaTransacaoId){ toast('Esta movimentação vem de uma despesa paga direto da reserva — edite ou exclua pela despesa em Lançamentos.'); S.view='budget'; S.budgetTab='variavel'; renderApp(); return; }
    if(mv.despesaFixaId){ toast('Esta movimentação vem de uma despesa fixa paga com a reserva — edite ou exclua pela despesa fixa em Lançamentos.'); S.view='budget'; S.budgetTab='fixa'; renderApp(); return; }
    if(mv.transferenciaId){ toast('Esta movimentação vem de uma transferência — edite ou exclua em Cartões e Contas → Transferências.'); S.view='cards'; renderApp(); return; }
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
  },
  /* V6.1 — extrato individual de uma reserva: mostra só as movimentações daquele
     cofrinho (nunca de outro), com filtros próprios de período/tipo/busca e totais de
     entradas/saídas do período. Abre em modal para não precisar de uma aba nova. */
  viewExtrato(boxId){
    const box = (S.data.reservas.boxes||[]).find(r=>r.id===boxId);
    if(!box){ toast('Reserva não encontrada.'); return; }
    const state = {periodo:'todos', dataDe:'', dataAte:'', tipo:'todos', busca:''};
    const tiposPresentes = Array.from(new Set(((S.data.reservas.moves||[]).filter(m=>m.boxId===boxId)).map(m=>m.tipo))).sort();
    const box_ = el(`
      <div class="modal-overlay">
        <div class="modal-box" style="max-width:640px;">
          <div class="modal-head"><h2>Extrato — ${esc(box.nome)}</h2><button id="rzx_close">&times;</button></div>
          <p class="modal-sub">Só movimentações desta reserva. Nunca mistura com outras reservas ou outro perfil.</p>
          <div class="cards-row" style="margin-bottom:10px;">
            <div class="card"><div class="clabel">Saldo atual</div><div class="cval">${brl(Number(box.valorAtual)||0)}</div></div>
            <div class="card"><div class="clabel">Entradas no período</div><div class="cval val-pos" id="rzx_in">—</div></div>
            <div class="card"><div class="clabel">Saídas no período</div><div class="cval" id="rzx_out">—</div></div>
          </div>
          <div class="field"><label>Buscar</label><input type="text" id="rzx_busca" placeholder="Buscar por tipo, descrição ou despesa vinculada..."/></div>
          <div class="field"><label>Tipo de movimentação</label><select id="rzx_tipo"><option value="todos">Todos</option>${tiposPresentes.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select></div>
          <div class="field"><label>Período</label><select id="rzx_periodo">${PERIODO_QUICK_OPTIONS.map(o=>`<option value="${o.v}">${o.l}</option>`).join('')}</select></div>
          <div id="rzx_custom_wrap" class="hidden" style="display:flex;gap:8px;">
            <div class="field" style="flex:1;"><label>De</label><input type="date" id="rzx_de"/></div>
            <div class="field" style="flex:1;"><label>Até</label><input type="date" id="rzx_ate"/></div>
          </div>
          <div id="rzx_list_wrap"></div>
        </div>
      </div>`);
    $('#modal-root').innerHTML=''; $('#modal-root').appendChild(box_);
    attachModalGuard(box_);
    $('#rzx_close').onclick = closeModal;

    function renderList(){
      const range = computePeriodoRange(state.periodo, state.dataDe, state.dataAte);
      const q = state.busca.trim().toLowerCase();
      let moves = (S.data.reservas.moves||[]).filter(m=>m.boxId===boxId);
      if(range.de) moves = moves.filter(m=>(m.data||'')>=range.de);
      if(range.ate) moves = moves.filter(m=>(m.data||'')<=range.ate);
      if(state.tipo!=='todos') moves = moves.filter(m=>m.tipo===state.tipo);
      if(q){
        moves = moves.filter(m=>{
          const fixaRef = m.despesaFixaId ? (S.data.fixas||[]).find(f=>f.id===m.despesaFixaId) : null;
          const txRef = m.despesaTransacaoId ? (S.data.transacoes||[]).find(t=>t.id===m.despesaTransacaoId) : null;
          const haystack = [m.tipo, m.descricao, m.banco, fixaRef&&fixaRef.nome, txRef&&txRef.nome].filter(Boolean).join(' ').toLowerCase();
          return haystack.includes(q);
        });
      }
      moves = moves.slice().sort((a,b)=>String(b.data||'').localeCompare(String(a.data||'')));
      let entradas=0, saidas=0;
      moves.forEach(m=>{
        if(Reservas.POSITIVE_TYPES.includes(m.tipo)) entradas += Number(m.valor)||0;
        else if(Reservas.NEGATIVE_TYPES.includes(m.tipo)) saidas += Number(m.valor)||0;
      });
      $('#rzx_in').textContent = brl(entradas);
      $('#rzx_out').textContent = '- '+brl(saidas).replace('R$ -','R$ ');
      const rows = moves.map(m=>{
        const positive = Reservas.POSITIVE_TYPES.includes(m.tipo);
        const negative = Reservas.NEGATIVE_TYPES.includes(m.tipo);
        const fixaRef = m.despesaFixaId ? (S.data.fixas||[]).find(f=>f.id===m.despesaFixaId) : null;
        const txRef = m.despesaTransacaoId ? (S.data.transacoes||[]).find(t=>t.id===m.despesaTransacaoId) : null;
        const vinculo = fixaRef ? `<button class="link-btn" style="padding:0;" onclick="Reservas.gotoVinculo('fixa','${fixaRef.id}')">🔗 ${esc(fixaRef.nome)}</button>` : (txRef ? `<button class="link-btn" style="padding:0;" onclick="Reservas.gotoVinculo('variavel','${txRef.id}')">🔗 ${esc(txRef.nome)}</button>` : '');
        return `<tr>
          <td>${reservaFmtDate(m.data)}</td>
          <td>${esc(m.tipo)}</td>
          <td class="${positive?'val-pos':negative?'val-neg':''}">${positive?'+ ':negative?'- ':''}${brl(m.valor)}</td>
          <td>${esc(m.descricao||'')}</td>
          <td>${vinculo}</td>
        </tr>`;
      }).join('');
      $('#rzx_list_wrap').innerHTML = rows ? `<div class="table-scroll"><table><thead><tr><th>Data</th><th>Tipo</th><th>Valor</th><th>Descrição</th><th>Vínculo</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty-note">Nenhuma movimentação encontrada para esse filtro.</div>';
    }
    $('#rzx_busca').oninput = ()=>{ state.busca = $('#rzx_busca').value; renderList(); };
    $('#rzx_tipo').onchange = ()=>{ state.tipo = $('#rzx_tipo').value; renderList(); };
    $('#rzx_periodo').onchange = ()=>{
      state.periodo = $('#rzx_periodo').value;
      $('#rzx_custom_wrap').classList.toggle('hidden', state.periodo!=='personalizado');
      renderList();
    };
    $('#rzx_de').onchange = ()=>{ state.dataDe = $('#rzx_de').value; renderList(); };
    $('#rzx_ate').onchange = ()=>{ state.dataAte = $('#rzx_ate').value; renderList(); };
    renderList();
  },
  /* Abre o lançamento vinculado (despesa fixa ou variável) a partir de uma movimentação
     da reserva, sem duplicar o mesmo evento — só navega até o registro correspondente. */
  gotoVinculo(tipo, id){
    closeModal();
    S.view='budget'; S.budgetTab = tipo==='fixa' ? 'fixa' : 'variavel'; renderApp();
    setTimeout(()=>{ if(typeof Budget!=='undefined' && Budget.edit) Budget.edit(id); }, 80);
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
        <div class="field"><label>Banco/Conta vinculada</label><select id="mt_account">${accountSelectOptions({includeNone:true}).map(o=>`<option value="${esc(o.value)}" ${isEdit&&(existing.accountId||resolveAccountId(existing.banco))===o.value?'selected':''}>${esc(o.label)}</option>`).join('')}</select></div>
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
    const accountId = $('#mt_account').value || null;
    const banco = accountNameSnapshot(accountId);
    if(isEdit){
      Object.assign(existing, {nome, emoji:selectedEmoji, valorMeta, valorAtual, prazo, accountId, banco});
      toast('Meta atualizada.');
    } else {
      S.data.metas.push({id:uid(), nome, emoji:selectedEmoji, valorMeta, valorAtual, prazo, accountId, banco, createdAt:Date.now()});
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
  add(){
    if(reservasEnabled()){
      S.view='reservas'; renderApp();
      setTimeout(()=>Reservas.add(),60);
      return;
    }
    openMetaModal(null);
  },
  edit(id){
    const mt = S.data.metas.find(x=>x.id===id);
    if(!mt) return;
    const reservaId=metaReservaId(mt);
    // Quando Reserva está ativa, uma meta vinculada é editada no Cofrinho. Com o módulo
    // desligado ela nem aparece na lista, portanto metas independentes usam o modal normal.
    if(reservasEnabled() && reservaId){ Reservas.edit(reservaId); return; }
    openMetaModal(mt);
  }
};
