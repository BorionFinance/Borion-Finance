/* Borion Finance — Tela Contas, Cartões, Boletos e parcelas. */

/* ---------------- Ordenação da fatura (mais antigo ⇄ mais recente) ----------------
   Camada leve e independente, só de exibição: guarda por cartão (escopo conta+perfil, igual
   ao OrderPreferences) se a lista de compras ativas da fatura deve aparecer da mais antiga
   para a mais nova ou o contrário. Nunca altera parcelas, valores ou saldos — só a ordem em
   que as linhas da fatura do mês aparecem na tela. */
const FaturaSort = {
  storageKey(cartaoId){
    const userId = (window.CloudStorage && CloudStorage.user && CloudStorage.user.id) ? CloudStorage.user.id : 'anon';
    const profileId = (typeof S!=='undefined' && S.currentProfile && S.currentProfile.id) ? S.currentProfile.id : 'sem_perfil';
    return 'borion_faturasort_' + userId + '_' + profileId + '_' + cartaoId;
  },
  get(cartaoId){
    const v = readJSON(this.storageKey(cartaoId), 'old');
    return v==='recent' ? 'recent' : 'old';
  },
  toggle(cartaoId){
    writeJSON(this.storageKey(cartaoId), this.get(cartaoId)==='old' ? 'recent' : 'old');
    if(typeof renderView==='function') renderView();
  },
  /* Chave de data aproximada: mês/ano da 1ª parcela (dataCompra) + dia em que ela entra na
     fatura (diaEntrada), quando existir. É o dado mais preciso disponível por parcela. */
  sortKey(p){
    return String(p.dataCompra||'') + '-' + String(p.diaEntrada||0).padStart(2,'0');
  }
};
window.FaturaSort = FaturaSort;

/* ---------------- VIEW: CARDS & ACCOUNTS ---------------- */
function renderCards(){
  /* Organização visual (opcional): quando o modo Organizar está ligado (Configurações →
     Módulos), mostra alça de arrastar + setas nos cards de conta/cartão em vez do botão de
     editar (evita abrir o cadastro sem querer no meio da reorganização). Sem filtro de banco
     ativo, para nunca gravar uma ordem baseada só na lista filtrada. */
  const orgActive = !!(window.OrderPreferences && OrderPreferences.active);
  const canReorderNow = !!(window.OrderPreferences && OrderPreferences.canReorderNow());
  const showReorderContas = orgActive && canReorderNow;
  const contasBase = S.data.contas.filter(a=>bankMatches(a.nome));
  const contasOrdered = window.OrderPreferences ? OrderPreferences.applyOrder('contas', contasBase, {idKey:'id', labelKey:'nome'}) : contasBase;
  const contasNaturalIds = contasOrdered.map(a=>a.id);
  const accRows = contasOrdered.map(a=>`
    <div class="card-entity" data-order-id="${esc(a.id)}">
      <div class="card-entity-head">
        <div class="cehl">
          <div class="bank-badge" style="background:${a.cor||bankColor(a.nome)}">${esc(a.icone||(a.nome||'?')[0])}</div>
          <div class="info"><div>${esc(a.nome)} <span style="font-weight:400;color:var(--muted);font-size:11.5px;">· ${a.isCarteira?'(dinheiro físico)':esc(a.tipo||'Conta')}</span></div><div><b style="color:#22c55e;">Saldo atual: ${brl(contaSaldoAtual(a))}</b> · Saldo inicial: ${brl(a.saldoInicial||0)}${a.rende?` · Rende ${pct(a.percentualRendimento||0)} a.m.`:' · Não rende'}${a.isCarteira?' · Não pode ser excluída':''}</div></div>
        </div>
        ${showReorderContas ? OrderPreferences.reorderRowControlsHTML('contas', a.id, a.nome, contasNaturalIds) : `<button class="btn-outline btn-sm" onclick="Cards.editConta('${a.id}')">✎ Editar</button>`}
      </div>
    </div>`).join('');

  const cartoesBase = S.data.cartoes.filter(c=>bankMatches(c.banco));
  const cartoesOrdered = window.OrderPreferences ? OrderPreferences.applyOrder('cartoes', cartoesBase, {idKey:'id', labelKey:'banco'}) : cartoesBase;
  const cartoesNaturalIds = cartoesOrdered.map(c=>c.id);
  const showReorderCartoes = orgActive && canReorderNow;
  const cardBlocks = cartoesOrdered.map(c=>{
    const active=[], inactive=[];
    c.parcelas.forEach(p=>{
      const st = parcelaStatus(p, S.month.y, S.month.m);
      if(st.ativo) active.push({...p, atual:st.atual});
      else inactive.push(p);
    });
    const fatura = cartaoFaturaDoMes(c.id, S.month.y, S.month.m);
    const faturaSortDir = FaturaSort.get(c.id);
    active.sort((a,b)=>{
      const ka = FaturaSort.sortKey(a), kb = FaturaSort.sortKey(b);
      return faturaSortDir==='old' ? ka.localeCompare(kb) : kb.localeCompare(ka);
    });
    /* Botão de ícone único (mesmo padrão do ✎/↺ já usados nas linhas da fatura) para caber na
       coluna estreita do cabeçalho — o title explica o estado atual e o toque inverte. */
    const faturaSortBtn = active.length>1
      ? `<button type="button" onclick="FaturaSort.toggle('${c.id}')" title="${faturaSortDir==='old'?'Mostrando do mais antigo ao mais recente — toque para inverter':'Mostrando do mais recente ao mais antigo — toque para inverter'}" aria-label="Inverter ordem da fatura">${faturaSortDir==='old' ? '↑' : '↓'}</button>`
      : '';
    const activeRows = active.map(p=>`
      <div class="installment-row">
        <span>${esc(p.descricao)}${p.local?` <span style="color:var(--muted)">(${esc(p.local)})</span>`:''}${p.categoria?` <span class="cat-pill" style="margin-left:4px;"><span class="dot" style="background:${catColor(p.categoria)}"></span>${esc(p.categoria)}</span>`:''}${p.apareceDespesas?` <span class="cat-pill" style="opacity:.85;"><span class="dot" style="background:var(--gold-bright)"></span>Também em Despesas (${p.despesaTipo==='fixa'?'fixa':'variável'})</span>`:''}</span>
        <span>${brl(p.valorParcela)}/mês</span>
        <span>${p.atual} de ${p.parcelaTotal}</span>
        <span>Dia ${p.diaEntrada || '—'}</span>
        <button onclick="Cards.editParcela('${c.id}','${p.id}')">✎</button>
      </div>`).join('');
    const inactiveRows = inactive.map(p=>{
      const fim = shiftYM(p.dataCompra, p.parcelaTotal-1);
      return `<div class="installment-row muted">
        <span>${esc(p.descricao)}${p.local?` <span style="color:var(--muted)">(${esc(p.local)})</span>`:''}</span>
        <span>${brl(p.valorParcela)}/mês</span>
        <span>Compra ${shortMonthLabel(p.dataCompra)}</span>
        <span>Fim ${shortMonthLabel(fim)}</span>
        <button onclick="Cards.editParcela('${c.id}','${p.id}')">✎</button>
      </div>`;
    }).join('');
    const faturaHTML = fatura.paga
      ? `<div class="installment-row" style="color:#22c55e;"><span>Fatura de ${monthLabel(S.month.y,S.month.m)} — <b>PAGA</b></span><span>${brl(fatura.pagamento.valor)}</span><span>via ${esc(fatura.pagamento.banco)}</span><span>${fatura.pagamento.data?fatura.pagamento.data.slice(8,10)+'/'+fatura.pagamento.data.slice(5,7):''}</span><button onclick="Cards.undoFaturaPagamento('${c.id}','${fatura.pagamento.id}')" title="Desfazer pagamento">↺</button></div>`
      : (fatura.total>0 ? `<div class="installment-row"><span>Fatura de ${monthLabel(S.month.y,S.month.m)}: <b style="color:#ef4444">${brl(fatura.total)}</b></span><span></span><span></span><span></span><button class="btn-outline btn-sm" onclick="Cards.payFatura('${c.id}')" style="width:auto;">Marcar fatura como paga</button></div>` : '');
    return `
    <div class="card-entity" data-order-id="${esc(c.id)}">
      <div class="card-entity-head">
        <div class="cehl">
          <div class="bank-badge" style="background:${bankColor(c.banco)}">${esc((c.banco||'?')[0])}</div>
          <div class="info"><div>${esc(c.banco)}</div><div>Limite: ${c.limite?brl(c.limite):'não definido'} · Dívida total em cartão a partir de ${monthLabel(S.month.y,S.month.m)}: <b style="color:#ef4444">${brl(computeCardsDebtForCartao(c,S.month.y,S.month.m))}</b> · ${active.length} compra(s) ativa(s)</div></div>
        </div>
        <div style="display:flex;gap:8px;">
          ${showReorderCartoes ? OrderPreferences.reorderRowControlsHTML('cartoes', c.id, c.banco, cartoesNaturalIds) : `
          <button class="btn-outline btn-sm" onclick="Cards.editCartao('${c.id}')">✎ Editar cartão</button>
          <button class="btn-outline btn-sm" onclick="Cards.addParcela('${c.id}')">+ Compra parcelada</button>`}
        </div>
      </div>
      ${faturaHTML}
      <div class="installment-row ih"><span>Descrição</span><span>Valor</span><span>Parcela</span><span>Dia</span><span>${faturaSortBtn}</span></div>
      ${activeRows || '<div class="empty-note">Nenhuma parcela ativa neste mês.</div>'}
      ${inactive.length? `<details><summary>Ver compras fora deste período (${inactive.length})</summary>${inactiveRows}</details>` : ''}
    </div>`;
  }).join('');

  const boletoBlocks = (S.data.boletos||[]).filter(b=>bankMatches(b.banco)).map(b=>{
    const st = boletoRestanteValor(b, S.month.y, S.month.m);
    const fim = shiftYM(b.dataInicio || monthKey(S.month.y,S.month.m), Number(b.parcelaTotal||1)-1);
    const statusColor = (b.status||'Ativo')==='Quitado' ? '#22c55e' : ((b.status||'Ativo')==='Cancelado' ? '#ef4444' : 'var(--gold-bright)');
    const mesRef = boletoParcelaDoMes(b.id, S.month.y, S.month.m);
    const mesHTML = mesRef.paga
      ? `<div class="installment-row" style="color:#22c55e;"><span>Parcela de ${monthLabel(S.month.y,S.month.m)} — <b>PAGA</b></span><span>${brl(mesRef.pagamento.valor)}</span><span>via ${esc(mesRef.pagamento.banco)}</span><span>${mesRef.pagamento.data?mesRef.pagamento.data.slice(8,10)+'/'+mesRef.pagamento.data.slice(5,7):''}</span><button onclick="Cards.undoBoletoPagamento('${b.id}','${mesRef.pagamento.id}')" title="Desfazer pagamento">↺</button></div>`
      : (mesRef.total>0 ? `<div class="installment-row"><span>Parcela de ${monthLabel(S.month.y,S.month.m)}: <b style="color:#ef4444">${brl(mesRef.total)}</b></span><span></span><span></span><span></span><button class="btn-outline btn-sm" onclick="Cards.payBoletoParcela('${b.id}')" style="width:auto;">Marcar como paga</button></div>` : '');
    return `
    <div class="card-entity boleto-entity">
      <div class="card-entity-head">
        <div class="cehl">
          <div class="bank-badge boleto-badge" style="background:${bankColor(b.banco||b.credor||'Boleto')}">▧</div>
          <div class="info"><div>${esc(b.descricao||'Boleto')} <span style="font-weight:400;color:var(--muted);font-size:11.5px;">· ${esc(b.credor||'Sem credor')}</span>${b.categoria?` <span class="cat-pill" style="margin-left:4px;"><span class="dot" style="background:${catColor(b.categoria)}"></span>${esc(b.categoria)}</span>`:''}</div><div>${esc(b.banco||'Sem banco')} · ${Number(b.parcelaTotal||1)} boleto(s) · ${st.ativo?`${st.atual} de ${b.parcelaTotal}`:'fora do mês'} · <b style="color:${statusColor}">${esc(b.status||'Ativo')}</b></div></div>
        </div>
        <button class="btn-outline btn-sm" onclick="Cards.editBoleto('${b.id}')">✎ Editar boleto</button>
      </div>
      ${mesHTML}
      <div class="installment-row boleto-row"><span>Valor mensal</span><span>${brl(b.valorParcela||0)}</span><span>Restante</span><span>${st.ativo?brl(st.restante):'—'}</span><span></span></div>
      <div class="installment-row muted"><span>Primeiro boleto: ${shortMonthLabel(b.dataInicio||monthKey(S.month.y,S.month.m))}</span><span>Fim: ${shortMonthLabel(fim)}</span><span>Vencimento</span><span>Dia ${b.diaVencimento||'—'}</span><button onclick="Cards.editBoleto('${b.id}')">✎</button></div>
    </div>`;
  }).join('');

  /* V6.0 — Transferências agora podem ter Conta OU Reserva nos dois lados (não é mais só
     conta → conta). origemNome/destinoNome já vêm resolvidos e prontos para exibir; um
     ícone ◈ marca quando a ponta é uma reserva, para diferenciar de banco/conta. */
  const transfLegLabel = (tipo, nome)=> tipo==='reserva' ? `◈ ${esc(nome||'Reserva')}` : esc(nome||'');
  const transfRows = (S.data.transferencias||[]).filter(t=>bankMatches(t.origemBanco||t.origemId)||bankMatches(t.destinoBanco||t.destinoId)).sort((a,b)=>String(b.data||'').localeCompare(String(a.data||''))).slice(0,15).map(t=>`
    <div class="installment-row">
      <span>${transfLegLabel(t.origemTipo,t.origemNome)} → ${transfLegLabel(t.destinoTipo,t.destinoNome)}${t.descricao?` <span style="color:var(--muted)">(${esc(t.descricao)})</span>`:''}${t.historico?` <span class="cat-pill" style="opacity:.8;">migrado</span>`:''}</span>
      <span>${brl(t.valor)}</span>
      <span>${t.data?t.data.slice(8,10)+'/'+t.data.slice(5,7)+'/'+t.data.slice(0,4):''}</span>
      <span></span>
      <button onclick="Cards.editTransferencia('${t.id}')">✎</button>
    </div>`).join('');

  const orgFilterNoticeContas = orgActive && !canReorderNow ? OrderPreferences.filterBlockedNoticeHTML() : '';
  const orgFilterNoticeCartoes = orgActive && !canReorderNow ? OrderPreferences.filterBlockedNoticeHTML() : '';
  return `
    <div class="toolbar"><div class="toolbar-left">Bancos e contas</div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">${window.OrderPreferences?OrderPreferences.sortSelectHTML('contas'):''}<button class="btn-outline" onclick="Cards.addConta()">+ Adicionar conta</button></div></div>
    <p style="font-size:11.5px;color:var(--muted-2);margin:-6px 0 12px;">Cadastre aqui cada banco/conta. Eles ficam disponíveis para vincular em receitas, despesas, parcelas, investimentos, metas, agenda, reserva e filtro por banco.</p>
    ${orgFilterNoticeContas}
    <div data-order-list="contas" style="display:contents;">${accRows || '<div class="empty-note" style="margin-bottom:20px;">Nenhuma conta cadastrada ainda.</div>'}</div>
    <div class="toolbar" style="margin-top:10px;"><div class="toolbar-left">Cartões de crédito</div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">${window.OrderPreferences?OrderPreferences.sortSelectHTML('cartoes'):''}<button class="btn-outline" onclick="Cards.addCartao()">+ Adicionar cartão</button></div></div>
    <p style="font-size:11.5px;color:var(--muted-2);margin:-6px 0 12px;">Compras no cartão viram parcelas dentro da fatura e não mexem no saldo do banco. O saldo só muda quando você marcar a fatura como paga.</p>
    ${orgFilterNoticeCartoes}
    <div data-order-list="cartoes" style="display:contents;">${cardBlocks || '<div class="empty-note">Nenhum cartão cadastrado ainda.</div>'}</div>
    <div class="toolbar" style="margin-top:18px;"><div class="toolbar-left">Boletos</div><button class="btn-outline" onclick="Cards.addBoleto()">+ Adicionar boleto</button></div>
    <p style="font-size:11.5px;color:var(--muted-2);margin:-6px 0 12px;">Use para boletos parcelados, carnês, financiamentos curtos ou cobranças recorrentes. Entram como dívida no patrimônio separado do cartão de crédito.</p>
    ${boletoBlocks || '<div class="empty-note">Nenhum boleto cadastrado ainda.</div>'}
    <div class="toolbar" style="margin-top:18px;"><div class="toolbar-left">Transferências</div><button class="btn-outline" onclick="Cards.addTransferencia()">+ Nova transferência</button></div>
    <p style="font-size:11.5px;color:var(--muted-2);margin:-6px 0 12px;">Move dinheiro entre contas e reservas (Conta → Reserva, Reserva → Conta, Reserva → Reserva ou Conta → Conta). Nunca é receita nem despesa — só muda onde o dinheiro está guardado, e nunca deixa uma reserva negativa.</p>
    <div class="installment-row ih"><span>De → Para</span><span>Valor</span><span>Data</span><span></span><span></span></div>
    ${transfRows || '<div class="empty-note">Nenhuma transferência registrada ainda.</div>'}
  `;
}
function computeCardsDebtForCartao(c, y, m){
  let total=0;
  (c.parcelas||[]).forEach(p=>{ const st=parcelaRestanteValor(p,c.id,y,m); if(st.ativo) total+=st.restante; });
  return Math.round(total*100)/100;
}
const Cards = {
  addConta(){
    openModal({title:'Adicionar conta bancária', fields:[
      {key:'nome',label:'Nome do banco/conta',type:'text'},
      {key:'tipo',label:'Tipo',type:'select',options:['Conta corrente','Conta poupança','Carteira digital','Investimento','Outro'],default:'Conta corrente'},
      {key:'saldoInicial',label:'Saldo inicial (R$)',type:'money'},
      {key:'rende',label:'Rende / aplica automaticamente?',type:'checkbox'},
      {key:'percentualRendimento',label:'Rendimento (% ao mês, opcional)',type:'number',step:'0.01'},
      {key:'cor',label:'Cor',type:'color'},
      {key:'icone',label:'Símbolo/ícone',type:'text',default:'◈'},
    ], onSave(v){
      S.data.contas.push({id:uid(), nome:v.nome||'Conta', tipo:v.tipo, saldoInicial:Number(v.saldoInicial)||0, rende:!!v.rende, percentualRendimento:Number(v.percentualRendimento)||0, cor:v.cor, icone:v.icone||'◈'});
      saveCurrentData(); closeModal(); renderView();
    }});
  },
  editConta(id){
    const a = S.data.contas.find(x=>x.id===id);
    if(!a) return;
    /* V5.36.0 — a Carteira (dinheiro físico) é uma conta fixa: nome e existência não
       podem ser alterados pelo usuário, só saldo/aparência. Nunca tem botão de excluir. */
    if(a.isCarteira){
      openModal({title:'Editar Carteira', sub:'A Carteira representa seu dinheiro físico (cédulas). Ela é fixa e não pode ser excluída — assim você sempre consegue lançar receitas e despesas mesmo sem cadastrar nenhum banco.', fields:[
        {key:'saldoInicial',label:'Saldo inicial em dinheiro (R$)',type:'money'},
        {key:'cor',label:'Cor',type:'color'},
        {key:'icone',label:'Símbolo/ícone',type:'text'},
      ], values:a,
      onSave(v){ Object.assign(a,{saldoInicial:Number(v.saldoInicial)||0, cor:v.cor||a.cor, icone:v.icone||a.icone}); saveCurrentData(); closeModal(); renderView(); }});
      return;
    }
    openModal({title:'Editar conta bancária', fields:[
      {key:'nome',label:'Nome do banco/conta',type:'text'},
      {key:'tipo',label:'Tipo',type:'select',options:['Conta corrente','Conta poupança','Carteira digital','Investimento','Outro']},
      {key:'saldoInicial',label:'Saldo inicial (R$)',type:'money'},
      {key:'rende',label:'Rende / aplica automaticamente?',type:'checkbox'},
      {key:'percentualRendimento',label:'Rendimento (% ao mês, opcional)',type:'number',step:'0.01'},
      {key:'cor',label:'Cor',type:'color'},
      {key:'icone',label:'Símbolo/ícone',type:'text'},
    ], values:a,
    onDelete(){ S.data.contas = S.data.contas.filter(x=>x.id!==id); saveCurrentData(); closeModal(); renderView(); },
    onSave(v){ Object.assign(a,{nome:v.nome||a.nome, tipo:v.tipo, saldoInicial:Number(v.saldoInicial)||0, rende:!!v.rende, percentualRendimento:Number(v.percentualRendimento)||0, cor:v.cor, icone:v.icone||a.icone}); saveCurrentData(); closeModal(); renderView(); }});
  },
  addCartao(){
    openModal({title:'Adicionar cartão de crédito', fields:[
      {key:'banco',label:'Banco / nome do cartão',type:'text'},{key:'limite',label:'Limite de crédito (R$)',type:'money'},
    ], onSave(v){
      const banco = (v.banco||'').trim();
      if(!banco){ alert('Digite o banco/nome do cartão.'); return; }
      S.data.cartoes.push({id:uid(),banco,limite:Number(v.limite)||0,parcelas:[],faturasPagas:[]}); saveCurrentData(); closeModal(); renderView();
    }});
  },
  editCartao(id){
    const c = S.data.cartoes.find(x=>x.id===id);
    openModal({title:'Editar cartão', fields:[
      {key:'banco',label:'Banco / nome do cartão',type:'text'},{key:'limite',label:'Limite de crédito (R$)',type:'money'},
    ], values:c,
    onDelete(){ S.data.cartoes = S.data.cartoes.filter(x=>x.id!==id); saveCurrentData(); closeModal(); renderView(); },
    onSave(v){
      const banco = (v.banco||'').trim();
      if(!banco){ alert('Digite o banco/nome do cartão.'); return; }
      Object.assign(c,{banco,limite:Number(v.limite)||0});
      /* V5.39.1 — renomear o cartão precisa atualizar o banco gravado nas despesas
         espelhadas (Cartões e Contas → Despesas), senão elas ficam com o nome antigo. */
      (c.parcelas||[]).forEach(p=>{ if(p.apareceDespesas) linkParcelaToDespesa(c,p); });
      saveCurrentData(); closeModal(); renderView();
    }});
  },
  addParcela(cartaoId){
    openModal({title:'Adicionar compra parcelada', sub:'A parcela atual é calculada automaticamente de acordo com o mês da compra e o mês selecionado no calendário. Compras no cartão não mudam o saldo do banco — só a fatura paga muda.', fields:[
      {key:'descricao',label:'O que foi comprado',type:'text'},
      {key:'local',label:'Onde comprou (loja)',type:'text'},
      {key:'categoria',label:'Categoria',type:'select',options:S.data.categorias.variavel,default:S.data.categorias.variavel[0]},
      {key:'valorParcela',label:'Valor de cada parcela (R$)',type:'money'},
      {key:'parcelaTotal',label:'Total de parcelas (1x = compra à vista neste mês)',type:'number',step:'1',default:1},
      {key:'dataCompra',label:'Mês da compra (1ª parcela)',type:'month',default:monthKey(S.month.y,S.month.m)},
      {key:'diaEntrada',label:'Dia do mês que entra na fatura',type:'number',step:'1'},
      {key:'apareceDespesas',label:'Aparecer também em Despesas?',type:'checkbox'},
      {key:'despesaTipo',label:'Aparecer como',type:'segmented',default:'variavel',options:[{value:'variavel',label:'Despesa variável'},{value:'fixa',label:'Despesa fixa'}],visibleWhen:{key:'apareceDespesas',value:true}},
    ], onSave(v){
      const c = S.data.cartoes.find(x=>x.id===cartaoId);
      const p = {id:uid(), descricao:v.descricao, local:v.local, categoria:v.categoria||'Outro', valorParcela:Number(v.valorParcela)||0, parcelaTotal:Math.max(1,Math.round(v.parcelaTotal)||1), dataCompra:v.dataCompra||monthKey(S.month.y,S.month.m), diaEntrada:v.diaEntrada||null, apareceDespesas:!!v.apareceDespesas, despesaTipo:v.despesaTipo||'variavel', despesaTransacaoId:null, despesaTransacaoIds:[], despesaFixaId:null};
      c.parcelas.push(p);
      linkParcelaToDespesa(c, p);
      saveCurrentData(); closeModal(); renderView();
      toast(p.apareceDespesas ? 'Compra adicionada ao cartão e em Despesas.' : 'Compra adicionada ao cartão.');
    }});
  },
  editParcela(cartaoId, parcelaId){
    const c = S.data.cartoes.find(x=>x.id===cartaoId);
    const p = c.parcelas.find(x=>x.id===parcelaId);
    openModal({title:'Editar parcela', sub:'A parcela atual é calculada automaticamente de acordo com o mês da compra e o mês selecionado no calendário.', fields:[
      {key:'descricao',label:'O que foi comprado',type:'text'},
      {key:'local',label:'Onde comprou (loja)',type:'text'},
      {key:'categoria',label:'Categoria',type:'select',options:S.data.categorias.variavel},
      {key:'valorParcela',label:'Valor de cada parcela (R$)',type:'money'},
      {key:'parcelaTotal',label:'Total de parcelas',type:'number',step:'1'},
      {key:'dataCompra',label:'Mês da compra (1ª parcela)',type:'month'},
      {key:'diaEntrada',label:'Dia do mês que entra na fatura',type:'number',step:'1'},
      {key:'apareceDespesas',label:'Aparecer também em Despesas?',type:'checkbox'},
      {key:'despesaTipo',label:'Aparecer como',type:'segmented',options:[{value:'variavel',label:'Despesa variável'},{value:'fixa',label:'Despesa fixa'}],visibleWhen:{key:'apareceDespesas',value:true}},
    ], values:p,
    onDelete(){ unlinkParcelaFromDespesa(p); c.parcelas = c.parcelas.filter(x=>x.id!==parcelaId); saveCurrentData(); closeModal(); renderView(); },
    onSave(v){
      Object.assign(p,{descricao:v.descricao, local:v.local, categoria:v.categoria||p.categoria||'Outro', valorParcela:Number(v.valorParcela)||0, parcelaTotal:Math.max(1,Math.round(v.parcelaTotal)||1), dataCompra:v.dataCompra||p.dataCompra, diaEntrada:v.diaEntrada||null, apareceDespesas:!!v.apareceDespesas, despesaTipo:v.despesaTipo||'variavel'});
      linkParcelaToDespesa(c, p);
      saveCurrentData(); closeModal(); renderView();
    }});
  },
  /* Marca a fatura do mês selecionado como paga: debita o banco escolhido e some da dívida em aberto. */
  payFatura(cartaoId){
    const c = S.data.cartoes.find(x=>x.id===cartaoId);
    if(!c) return;
    const info = cartaoFaturaDoMes(cartaoId, S.month.y, S.month.m);
    if(info.paga){ toast('A fatura deste mês já está marcada como paga.'); return; }
    if(info.total<=0){ toast('Não há valor de fatura neste mês.'); return; }
    openModal({title:'Marcar fatura como paga', sub:'Escolha o banco usado para pagar a fatura de '+monthLabel(S.month.y,S.month.m)+'. O valor sai do saldo (liquidez) desse banco.', fields:[
      {key:'valor',label:'Valor pago (R$)',type:'money',default:info.total},
      accountSelectField('faturapg',''),
      {key:'data',label:'Data do pagamento',type:'date',default:todayISO()},
    ], onSave(v){
      const banco = requireBanco(v.banco,'Escolha o banco usado para pagar a fatura.');
      if(!banco) return;
      const valor = Number(v.valor)||info.total;
      if(!c.faturasPagas) c.faturasPagas=[];
      c.faturasPagas.push({id:uid(), competencia:info.competencia, valor, banco, data:v.data||todayISO(), createdAt:Date.now()});
      adjustLiquidez(banco, -valor);
      saveCurrentData(); closeModal(); renderView(); toast('Fatura marcada como paga. Saldo de '+banco+' atualizado.');
    }});
  },
  undoFaturaPagamento(cartaoId, pagamentoId){
    const c = S.data.cartoes.find(x=>x.id===cartaoId);
    if(!c || !Array.isArray(c.faturasPagas)) return;
    const idx = c.faturasPagas.findIndex(f=>f.id===pagamentoId);
    if(idx<0) return;
    openConfirmModal({title:'Desfazer pagamento de fatura', text:'Desfazer este pagamento de fatura? O valor volta a aparecer como dívida e o saldo do banco é devolvido.', confirmLabel:'Desfazer pagamento', variant:'danger', onConfirm(){
      const pg = c.faturasPagas[idx];
      adjustLiquidez(pg.banco, pg.valor);
      c.faturasPagas.splice(idx,1);
      saveCurrentData(); renderView(); toast('Pagamento da fatura desfeito.');
    }});
  },
  addBoleto(){ Cards.editBoleto(null); },
  editBoleto(id){
    const isEdit = !!id;
    const b = isEdit ? (S.data.boletos||[]).find(x=>x.id===id) : {descricao:'', credor:'', banco:'', categoria:'Outro', valorParcela:0, parcelaTotal:1, dataInicio:monthKey(S.month.y,S.month.m), diaVencimento:'', status:'Ativo', obs:'', apareceDespesas:false, despesaTipo:'variavel'};
    openModal({title:isEdit?'Editar boleto':'Adicionar boleto', sub:'Use para boleto parcelado/carnê. Ele entra em Dívidas no Patrimônio, separado do cartão de crédito.', fields:[
      {key:'descricao',label:'Descrição do boleto',type:'text',placeholder:'Ex: Notebook, seguro, carnê...'},
      {key:'credor',label:'Para quem / empresa',type:'text',placeholder:'Ex: Loja, financeira, pessoa...'},
      accountSelectField('boleto', b.banco),
      {key:'categoria',label:'Categoria',type:'select',options:S.data.categorias.variavel,default:b.categoria||S.data.categorias.variavel[0]},
      {key:'valorParcela',label:'Valor de cada boleto (R$)',type:'money'},
      {key:'parcelaTotal',label:'Quantidade de boletos',type:'number',step:'1',default:1},
      {key:'dataInicio',label:'Mês do primeiro boleto',type:'month',default:monthKey(S.month.y,S.month.m)},
      {key:'diaVencimento',label:'Dia de vencimento',type:'number',step:'1'},
      {key:'status',label:'Status',type:'select',options:['Ativo','Quitado','Cancelado']},
      {key:'obs',label:'Observação',type:'text'},
      {key:'apareceDespesas',label:'Aparecer também em Despesas?',type:'checkbox'},
      {key:'despesaTipo',label:'Aparecer como',type:'segmented',default:'variavel',options:[{value:'variavel',label:'Despesa variável'},{value:'fixa',label:'Despesa fixa'}],visibleWhen:{key:'apareceDespesas',value:true}},
    ], values:b,
    onDelete:isEdit?()=>{ unlinkBoletoFromDespesa(b); S.data.boletos = (S.data.boletos||[]).filter(x=>x.id!==id); saveCurrentData(); closeModal(); renderView(); }:null,
    onSave(v){
      const banco = requireBanco(v.banco,'Escolha o banco/conta vinculado a este boleto.');
      if(!banco) return;
      if(!S.data.boletos) S.data.boletos=[];
      const obj = {descricao:v.descricao||'Boleto', credor:v.credor||'', banco, categoria:v.categoria||'Outro', valorParcela:Number(v.valorParcela)||0, parcelaTotal:Math.max(1,Math.round(v.parcelaTotal)||1), dataInicio:v.dataInicio||monthKey(S.month.y,S.month.m), diaVencimento:v.diaVencimento||'', status:v.status||'Ativo', obs:v.obs||'', apareceDespesas:!!v.apareceDespesas, despesaTipo:v.despesaTipo||'variavel'};
      let alvo;
      if(isEdit){ Object.assign(b,obj); alvo=b; }
      else { alvo = Object.assign({id:uid(), createdAt:Date.now(), pagamentos:[], despesaTransacaoId:null, despesaTransacaoIds:[], despesaFixaId:null}, obj); S.data.boletos.push(alvo); }
      linkBoletoToDespesa(alvo);
      saveCurrentData(); closeModal(); renderView();
      toast(alvo.apareceDespesas ? (isEdit?'Boleto atualizado e em Despesas.':'Boleto cadastrado e em Despesas.') : (isEdit?'Boleto atualizado.':'Boleto cadastrado.'));
    }});
  },
  /* Marca a parcela do mês selecionado como paga: debita o banco escolhido e some da dívida em aberto. */
  payBoletoParcela(boletoId){
    const b = (S.data.boletos||[]).find(x=>x.id===boletoId);
    if(!b) return;
    const info = boletoParcelaDoMes(boletoId, S.month.y, S.month.m);
    if(info.paga){ toast('Esta parcela já está marcada como paga.'); return; }
    if(info.total<=0){ toast('Não há parcela ativa neste mês.'); return; }
    openModal({title:'Marcar boleto como pago', sub:'Escolha o banco usado para pagar a parcela de '+monthLabel(S.month.y,S.month.m)+'. O valor sai do saldo (liquidez) desse banco.', fields:[
      {key:'valor',label:'Valor pago (R$)',type:'money',default:info.total},
      accountSelectField('boletopg', b.banco),
      {key:'data',label:'Data do pagamento',type:'date',default:todayISO()},
    ], onSave(v){
      const banco = requireBanco(v.banco,'Escolha o banco usado para pagar o boleto.');
      if(!banco) return;
      const valor = Number(v.valor)||info.total;
      if(!Array.isArray(b.pagamentos)) b.pagamentos=[];
      b.pagamentos.push({id:uid(), competencia:info.competencia, valor, banco, data:v.data||todayISO(), createdAt:Date.now()});
      adjustLiquidez(banco, -valor);
      saveCurrentData(); closeModal(); renderView(); toast('Boleto marcado como pago. Saldo de '+banco+' atualizado.');
    }});
  },
  undoBoletoPagamento(boletoId, pagamentoId){
    const b = (S.data.boletos||[]).find(x=>x.id===boletoId);
    if(!b || !Array.isArray(b.pagamentos)) return;
    const idx = b.pagamentos.findIndex(p=>p.id===pagamentoId);
    if(idx<0) return;
    openConfirmModal({title:'Desfazer pagamento', text:'Desfazer este pagamento? O valor volta a aparecer como dívida e o saldo do banco é devolvido.', confirmLabel:'Desfazer pagamento', variant:'danger', onConfirm(){
      const pg = b.pagamentos[idx];
      adjustLiquidez(pg.banco, pg.valor);
      b.pagamentos.splice(idx,1);
      saveCurrentData(); renderView(); toast('Pagamento do boleto desfeito.');
    }});
  },
  /* ---------------- V6.0 — Transferências genéricas ----------------
     Move dinheiro entre Conta↔Reserva, Reserva↔Reserva ou Conta↔Conta. Nunca é receita
     nem despesa e nunca entra em receitaMes()/despesasMes(). Quando uma ponta é reserva,
     gera também uma movimentação no extrato dessa reserva ('Transferência enviada'/
     'Transferência recebida'), ligada de volta pela transferência (origemMoveId/
     destinoMoveId) — exatamente o mesmo padrão de vínculo já usado em Despesas/Reserva. */
  addTransferencia(){ Cards.editTransferencia(null); },
  editTransferencia(id){
    const isEdit = !!id;
    const t = isEdit ? (S.data.transferencias||[]).find(x=>x.id===id) : {origemTipo:'conta', origemId:'', destinoTipo:'conta', destinoId:'', valor:0, data:todayISO(), descricao:''};
    const banks = accountSelectNames();
    const reservaBoxesAll = reservasEnabled() ? ((S.data.reservas&&S.data.reservas.boxes)||[]).filter(r=>bankMatches(r.banco)) : [];
    const hasReservas = reservaBoxesAll.length>0;
    if(banks.length<2 && !hasReservas){ alert('Cadastre pelo menos mais uma conta/banco além da Carteira, ou crie uma reserva, antes de transferir.'); return; }
    const reservaLabelOf = r=>`${r.nome}${r.banco?' · '+r.banco:''}`;
    const findReservaByLabel = lbl => reservaBoxesAll.find(r=>reservaLabelOf(r)===lbl);
    const origemTipoIni = (isEdit && t.origemTipo==='reserva') ? 'reserva' : 'conta';
    const destinoTipoIni = (isEdit && t.destinoTipo==='reserva') ? 'reserva' : 'conta';
    const origemContaIni = (isEdit && t.origemTipo==='conta' && banks.includes(t.origemId)) ? t.origemId : (banks[0]||'');
    const destinoContaIni = (isEdit && t.destinoTipo==='conta' && banks.includes(t.destinoId)) ? t.destinoId : (banks[0]||'');
    const origemReservaObjIni = (isEdit && t.origemTipo==='reserva') ? reservaBoxesAll.find(r=>r.id===t.origemId) : null;
    const destinoReservaObjIni = (isEdit && t.destinoTipo==='reserva') ? reservaBoxesAll.find(r=>r.id===t.destinoId) : null;
    const fields = [];
    if(hasReservas){
      fields.push({key:'origemTipo',label:'De onde sai',type:'segmented',options:[{value:'conta',label:'Conta'},{value:'reserva',label:'Reserva'}],default:origemTipoIni});
      fields.push({key:'origemConta',label:'Conta de origem',type:'select',options:banks.length?banks:['Nenhuma conta cadastrada'],default:origemContaIni,visibleWhen:{key:'origemTipo',value:'conta'}});
      fields.push({key:'origemReservaSel',label:'Reserva de origem',type:'select',options:reservaBoxesAll.map(reservaLabelOf),default:origemReservaObjIni?reservaLabelOf(origemReservaObjIni):reservaLabelOf(reservaBoxesAll[0]),visibleWhen:{key:'origemTipo',value:'reserva'}});
      fields.push({key:'destinoTipo',label:'Para onde vai',type:'segmented',options:[{value:'conta',label:'Conta'},{value:'reserva',label:'Reserva'}],default:destinoTipoIni});
      fields.push({key:'destinoConta',label:'Conta de destino',type:'select',options:banks.length?banks:['Nenhuma conta cadastrada'],default:destinoContaIni,visibleWhen:{key:'destinoTipo',value:'conta'}});
      fields.push({key:'destinoReservaSel',label:'Reserva de destino',type:'select',options:reservaBoxesAll.map(reservaLabelOf),default:destinoReservaObjIni?reservaLabelOf(destinoReservaObjIni):reservaLabelOf(reservaBoxesAll[0]),visibleWhen:{key:'destinoTipo',value:'reserva'}});
    } else {
      fields.push({key:'origemConta',label:'Conta de origem',type:'select',options:banks,default:origemContaIni});
      fields.push({key:'destinoConta',label:'Conta de destino',type:'select',options:banks,default:destinoContaIni});
    }
    fields.push({key:'valor',label:'Valor (R$)',type:'money',default:t.valor||0});
    fields.push({key:'data',label:'Data',type:'date',default:t.data||todayISO()});
    fields.push({key:'descricao',label:'Descrição (opcional)',type:'text',default:t.descricao||''});
    openModal({title:isEdit?'Editar transferência':'Nova transferência', sub:'Move dinheiro entre contas e reservas. Nunca conta como receita nem despesa, e nunca deixa uma reserva negativa.', fields,
    onDelete:isEdit?()=>{
      Cards.reverseTransferenciaEffect(t);
      S.data.transferencias = (S.data.transferencias||[]).filter(x=>x.id!==id);
      saveCurrentData(); closeModal(); renderView();
    }:null,
    onSave(v){
      const origemTipo = hasReservas ? (v.origemTipo||'conta') : 'conta';
      const destinoTipo = hasReservas ? (v.destinoTipo||'conta') : 'conta';
      const origemReserva = origemTipo==='reserva' ? findReservaByLabel(v.origemReservaSel) : null;
      const destinoReserva = destinoTipo==='reserva' ? findReservaByLabel(v.destinoReservaSel) : null;
      const origemId = origemTipo==='reserva' ? (origemReserva&&origemReserva.id) : v.origemConta;
      const destinoId = destinoTipo==='reserva' ? (destinoReserva&&destinoReserva.id) : v.destinoConta;
      const origemNome = origemTipo==='reserva' ? (origemReserva&&origemReserva.nome) : v.origemConta;
      const destinoNome = destinoTipo==='reserva' ? (destinoReserva&&destinoReserva.nome) : v.destinoConta;
      if(!origemId || !destinoId){ alert('Escolha a origem e o destino da transferência.'); return; }
      if(origemTipo===destinoTipo && origemId===destinoId){ alert('A origem e o destino não podem ser os mesmos.'); return; }
      const valor = Number(v.valor)||0;
      if(valor<=0){ alert('Digite um valor maior que zero.'); return; }
      if(isEdit) Cards.reverseTransferenciaEffect(t);
      if(origemTipo==='reserva' && !reservaTemSaldo(origemReserva, valor)){
        if(isEdit) Cards.applyTransferenciaEffect(t); // desfaz o reverse acima antes de cancelar
        showReservaInsuficienteModal(origemReserva, valor);
        return;
      }
      const obj = {origemTipo, origemId, origemNome, destinoTipo, destinoId, destinoNome, valor, data:v.data||todayISO(), descricao:v.descricao||'',
        origemBanco: origemTipo==='reserva' ? (origemReserva&&origemReserva.banco||'') : origemId,
        destinoBanco: destinoTipo==='reserva' ? (destinoReserva&&destinoReserva.banco||'') : destinoId,
        contaOrigem: origemTipo==='conta'?origemId:'', contaDestino: destinoTipo==='conta'?destinoId:''};
      let alvo;
      if(isEdit){ Object.assign(t,obj); alvo=t; } else { alvo = Object.assign({id:uid(), createdAt:Date.now()}, obj); S.data.transferencias.push(alvo); }
      Cards.applyTransferenciaEffect(alvo);
      saveCurrentData(); closeModal(); renderView(); toast(isEdit?'Transferência atualizada.':'Transferência registrada.');
    }});
  },
  applyTransferenciaEffect(t){
    if(!t) return;
    if(t.origemTipo==='reserva'){
      const bx = (S.data.reservas.boxes||[]).find(r=>r.id===t.origemId);
      if(bx){
        const mv = {id:uid(), boxId:bx.id, tipo:'Transferência enviada', data:t.data||todayISO(), valor:t.valor, banco:bx.banco||'', descricao:t.descricao||('Transferência para '+(t.destinoNome||'')), transferenciaId:t.id, createdAt:Date.now()};
        S.data.reservas.moves.push(mv);
        Reservas.applyMoveEffect(mv);
        t.origemMoveId = mv.id;
      }
    } else {
      adjustLiquidez(t.origemId, -t.valor);
    }
    if(t.destinoTipo==='reserva'){
      const bx = (S.data.reservas.boxes||[]).find(r=>r.id===t.destinoId);
      if(bx){
        const mv = {id:uid(), boxId:bx.id, tipo:'Transferência recebida', data:t.data||todayISO(), valor:t.valor, banco:bx.banco||'', descricao:t.descricao||('Transferência de '+(t.origemNome||'')), transferenciaId:t.id, createdAt:Date.now()};
        S.data.reservas.moves.push(mv);
        Reservas.applyMoveEffect(mv);
        t.destinoMoveId = mv.id;
      }
    } else {
      adjustLiquidez(t.destinoId, t.valor);
    }
  },
  reverseTransferenciaEffect(t){
    if(!t) return;
    if(t.origemTipo==='reserva'){
      if(t.origemMoveId){
        const idx = (S.data.reservas.moves||[]).findIndex(m=>m.id===t.origemMoveId);
        if(idx>=0){ Reservas.reverseMoveEffect(S.data.reservas.moves[idx]); S.data.reservas.moves.splice(idx,1); }
        t.origemMoveId = null;
      }
    } else {
      adjustLiquidez(t.origemId, t.valor);
    }
    if(t.destinoTipo==='reserva'){
      if(t.destinoMoveId){
        const idx = (S.data.reservas.moves||[]).findIndex(m=>m.id===t.destinoMoveId);
        if(idx>=0){ Reservas.reverseMoveEffect(S.data.reservas.moves[idx]); S.data.reservas.moves.splice(idx,1); }
        t.destinoMoveId = null;
      }
    } else {
      adjustLiquidez(t.destinoId, -t.valor);
    }
  }
};

/* V5.36.0 — expõe Cards para modais internos que abrem cadastro de banco. */
window.Cards = Cards;
