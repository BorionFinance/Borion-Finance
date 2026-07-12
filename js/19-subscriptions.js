/* Borion Finance — V6.22 — Assinaturas (seção 9 do pedido): despesas recorrentes mensais ou
   anuais (Netflix, Spotify, academia, licenças...), com pausar/retomar/editar/excluir, aba
   própria em Lançamentos, entre "Despesa variável" e "Central".

   Modelo:
   - S.data.assinaturas: o cadastro (a "regra" recorrente).
   - S.data.assinaturaCobrancas: um registro por período já efetivamente cobrado — existe só
     pra nunca cobrar o mesmo período duas vezes (mesma ideia de fixaPagamentos, mas aqui a
     cobrança é automática, sem precisar de um botão "marcar como paga").
   - "Despesas totais" (despesasMes) sempre inclui a assinatura no(s) mês(es) certo(s) — igual
     despesa fixa já faz — mas o saldo da conta só é mexido de verdade (via adjustLiquidez, ou
     via uma compra real no cartão) até o mês atual de hoje, nunca adiantado por só navegar
     pra um mês futuro no filtro do topo. */

/* ---------------- Período: cálculo de dia/data de vencimento, com dia inexistente no mês ---------------- */
function assinaturaDiaClamped(a, mesKey){
  const [y,m] = mesKey.split('-').map(Number); // m 1-indexado
  const ultimoDia = new Date(y, m, 0).getDate(); // dia 0 do mês seguinte = último dia deste mês
  return Math.min(Math.max(1, Number(a.diaVencimento)||1), ultimoDia);
}
function assinaturaDataVencimento(a, mesKey){ return mesKey+'-'+pad2(assinaturaDiaClamped(a, mesKey)); }

/* Uma assinatura "ocorre" num mês quando: já foi criada até esse mês, ainda não foi pausada
   antes dele, e (se anual) o mês bate com o mês de vencimento escolhido. Não olha se já foi
   cobrada de verdade — serve só pra projeção de "despesas totais", igual fixasAtivasNoMes(). */
function assinaturaOcorreNoMes(a, mesKey){
  if(!a || (a.createdKey && mesKey<a.createdKey)) return false;
  if(a.status==='pausada' && a.pausedFromKey && mesKey>=a.pausedFromKey) return false;
  if(a.tipo==='anual') return (Number(mesKey.slice(5,7))-1)===Number(a.mesVencimento);
  return true;
}
/* Só as assinaturas pagas direto de uma conta entram aqui — as pagas no cartão de crédito já
   contam em variavelMes() através da compra real lançada no cartão (ver Assinaturas.chargePeriod). */
function assinaturasAtivasNoMes(y=S.month.y, m=S.month.m){
  const key = monthKey(y,m);
  return (S.data.assinaturas||[]).filter(a=> a.formaPagamento!=='Crédito' && assinaturaOcorreNoMes(a,key) && bankMatches(a.banco));
}
function assinaturasMes(y=S.month.y, m=S.month.m){ return sumBy(assinaturasAtivasNoMes(y,m),'valor'); }

function assinaturaCobrancaFor(assinaturaId, period){ return (S.data.assinaturaCobrancas||[]).find(c=>c.assinaturaId===assinaturaId && c.period===period) || null; }
/* Períodos (chaves de mês) que já deveriam ter sido cobrados até hoje de verdade, mas ainda
   não têm registro em assinaturaCobrancas — é isso que o motor de sincronização processa. */
function assinaturaPeriodsPendentes(a){
  const hojeKey = monthKey(todayYM().y, todayYM().m);
  const startKey = a.createdKey || hojeKey;
  if(startKey>hojeKey) return [];
  const fimKey = (a.status==='pausada' && a.pausedFromKey && a.pausedFromKey<=hojeKey) ? shiftYM(a.pausedFromKey,-1) : hojeKey;
  if(fimKey<startKey) return [];
  return monthsBetweenISO(startKey+'-01', fimKey+'-01')
    .map(mm=>mm.key)
    .filter(key=> a.tipo==='anual' ? (Number(key.slice(5,7))-1)===Number(a.mesVencimento) : true)
    .filter(key=> !assinaturaCobrancaFor(a.id, key));
}
/* Próxima cobrança prevista (só pra exibição na lista) — não confundir com "já cobrado". */
function assinaturaProximaCobranca(a){
  const hojeKey = monthKey(todayYM().y, todayYM().m);
  if(a.status==='pausada') return null;
  if(a.tipo==='mensal'){
    const base = a.createdKey && a.createdKey>hojeKey ? a.createdKey : hojeKey;
    return assinaturaDataVencimento(a, base);
  }
  // anual: próxima ocorrência do mês de vencimento, este ano ou o ano que vem
  const anoAtual = Number(hojeKey.slice(0,4));
  const candidato = pad2(Number(a.mesVencimento)+1);
  let key = anoAtual+'-'+candidato;
  if(key<hojeKey || key<(a.createdKey||'')) key = (anoAtual+1)+'-'+candidato;
  return assinaturaDataVencimento(a, key);
}

const Assinaturas = {
  /* Roda no boot/login/troca de perfil/sync (ver renderApp em 04-gate-shell.js) e também
     logo após criar/editar/retomar uma assinatura. Idempotente e barato — sempre seguro
     rodar de novo (nunca cobra um período que já tem registro em assinaturaCobrancas). */
  sync(){
    if(!S.data || !Array.isArray(S.data.assinaturas) || !S.data.assinaturas.length) return;
    if(!Array.isArray(S.data.assinaturaCobrancas)) S.data.assinaturaCobrancas=[];
    let changed=false;
    S.data.assinaturas.forEach(a=>{
      assinaturaPeriodsPendentes(a).forEach(period=>{
        this.chargePeriod(a, period);
        changed=true;
      });
    });
    if(changed) saveCurrentData();
  },
  chargePeriod(a, period){
    const valor = Math.round((Number(a.valor)||0)*100)/100;
    const data = assinaturaDataVencimento(a, period);
    const rec = {id:uid(), assinaturaId:a.id, period, valor, data, banco:'', cartaoId:null, parcelaId:null, transacaoId:null, falhou:false, createdAt:Date.now()};
    if(a.formaPagamento==='Crédito'){
      const cartao = (S.data.cartoes||[]).find(c=>c.id===a.cartaoId);
      if(!cartao){ rec.falhou=true; S.data.assinaturaCobrancas.push(rec); return; } // cartão foi excluído — registra e segue (não trava o app)
      const p = {id:uid(), descricao:a.nome||'Assinatura', local:'', categoria:a.categoria||'Outro', valorParcela:valor, parcelaTotal:1, dataCompra:period, diaEntrada:assinaturaDiaClamped(a,period), apareceDespesas:true, despesaTipo:'variavel', despesaTransacaoId:null, despesaTransacaoIds:[], despesaFixaId:null, viaAssinaturaId:a.id};
      cartao.parcelas.push(p);
      linkParcelaToDespesa(cartao, p);
      rec.cartaoId = cartao.id; rec.parcelaId = p.id; rec.transacaoId = p.despesaTransacaoId;
    } else {
      rec.banco = a.banco||'';
      if(rec.banco) adjustLiquidez(rec.banco, -valor);
    }
    S.data.assinaturaCobrancas.push(rec);
  },

  tab(){ S.budgetTab='assinaturas'; renderView(); },
  add(){ this.openForm(null); },
  edit(id){ this.openForm((S.data.assinaturas||[]).find(x=>x.id===id)); },

  openForm(existing){
    const isEdit = !!existing;
    const cats = (S.data.categorias && S.data.categorias.variavel && S.data.categorias.variavel.length) ? S.data.categorias.variavel : ['Outro'];
    const accountNames = accountSelectNames();
    const cardNames = allCardNames();
    const origemDefault = isEdit ? (existing.formaPagamento==='Crédito' ? 'cartao' : 'conta') : 'conta';
    const formaDefault = isEdit && existing.formaPagamento!=='Crédito' ? existing.formaPagamento : 'Pix';
    const fields = [
      {key:'tipo', label:'Periodicidade', type:'segmented', options:[{value:'mensal',label:'Mensal'},{value:'anual',label:'Anual'}], default:isEdit?existing.tipo:'mensal'},
      {key:'nome', label:'Nome', type:'text', default:isEdit?existing.nome:''},
      {key:'categoria', label:'Categoria', type:'select', options:cats, default:isEdit&&cats.includes(existing.categoria)?existing.categoria:cats[0]},
      {key:'valorMensal', label:'Valor mensal (R$)', type:'money', default:isEdit&&existing.tipo==='mensal'?existing.valor:0, visibleWhen:{key:'tipo',value:'mensal'}},
      {key:'valorAnual', label:'Valor anual (R$)', type:'money', default:isEdit&&existing.tipo==='anual'?existing.valor:0, visibleWhen:{key:'tipo',value:'anual'}},
      {key:'dia', label:'Dia do vencimento', type:'select', options:Array.from({length:31},(_,i)=>String(i+1)), default:isEdit?String(existing.diaVencimento||1):'1'},
      {key:'mes', label:'Mês do vencimento', type:'select', options:MONTHS.slice(), default:isEdit&&existing.mesVencimento!=null?MONTHS[existing.mesVencimento]:MONTHS[0], visibleWhen:{key:'tipo',value:'anual'}},
      {key:'origem', label:'Origem do pagamento', type:'segmented', options:[{value:'conta',label:'Conta'},{value:'cartao',label:'Cartão de crédito'}], default:origemDefault},
      {key:'forma', label:'Forma de pagamento', type:'select', options:['Dinheiro','Pix','Débito'], default:formaDefault, visibleWhen:{key:'origem',value:'conta'}},
      {key:'banco', label:'Banco/Conta', type:'select', options:accountNames.length?accountNames:['Cadastre uma conta em Cartões e Contas'], default:isEdit&&accountNames.includes(existing.banco)?existing.banco:(accountNames[0]||''), visibleWhen:{key:'origem',value:'conta'}},
      {key:'cartao', label:'Cartão de crédito', type:'select', options:cardNames.length?cardNames:['Cadastre um cartão em Cartões e Contas'], default:isEdit&&existing.formaPagamento==='Crédito'?(((S.data.cartoes||[]).find(cc=>cc.id===existing.cartaoId)||{}).banco||cardNames[0]||''):(cardNames[0]||''), visibleWhen:{key:'origem',value:'cartao'}},
    ];
    openModal({
      title: isEdit?'Editar assinatura':'Nova assinatura',
      sub: 'Netflix, Spotify, academia, armazenamento em nuvem, licenças e outros pagamentos recorrentes.',
      fields, saveLabel:'Salvar assinatura',
      onDelete: isEdit ? ()=>{ Assinaturas.remove(existing.id); } : null,
      deleteLabel:'Excluir assinatura',
      onSave(v){
        if(!v.nome || !v.nome.trim()){ alert('Dê um nome pra assinatura.'); return; }
        const tipo = v.tipo==='anual' ? 'anual' : 'mensal';
        const valor = tipo==='anual' ? Number(v.valorAnual)||0 : Number(v.valorMensal)||0;
        if(valor<=0){ alert('Digite um valor maior que zero.'); return; }
        const isCartao = v.origem==='cartao';
        if(isCartao && (!cardNames.length || !(S.data.cartoes||[]).some(c=>c.banco===v.cartao))){ alert('Escolha um cartão de crédito válido. Cadastre um cartão em "Cartões e Contas" antes.'); return; }
        if(!isCartao && (!accountNames.length || !accountNames.includes(v.banco))){ alert('Escolha um banco/conta válido. Cadastre uma conta em "Cartões e Contas" antes.'); return; }
        const cartaoObj = isCartao ? (S.data.cartoes||[]).find(c=>c.banco===v.cartao) : null;
        const hojeKey = monthKey(todayYM().y, todayYM().m);
        const payload = {
          nome:v.nome.trim(), categoria:v.categoria||'Outro', tipo, valor,
          diaVencimento: Math.min(31, Math.max(1, parseInt(v.dia,10)||1)),
          mesVencimento: tipo==='anual' ? Math.max(0, MONTHS.indexOf(v.mes)) : null,
          formaPagamento: isCartao ? 'Crédito' : (v.forma||'Pix'),
          banco: isCartao ? '' : v.banco,
          cartaoId: isCartao ? (cartaoObj?cartaoObj.id:null) : null,
        };
        if(isEdit){
          Object.assign(existing, payload);
          toast('Assinatura atualizada. Meses já cobrados não mudam — só dai pra frente.');
        } else {
          S.data.assinaturas.push(Object.assign({id:uid(), status:'ativa', pausedFromKey:null, createdKey:hojeKey, createdAt:Date.now()}, payload));
          toast('Assinatura criada.');
        }
        saveCurrentData();
        Assinaturas.sync();
        closeModal(); renderView();
      }
    });
  },

  pause(id){
    const a = (S.data.assinaturas||[]).find(x=>x.id===id); if(!a) return;
    a.status='pausada'; a.pausedFromKey = monthKey(S.month.y, S.month.m);
    saveCurrentData(); renderView(); toast('Assinatura pausada — deixa de contar a partir de '+monthLabel(S.month.y,S.month.m)+'. O histórico anterior fica intacto.');
  },
  resume(id){
    const a = (S.data.assinaturas||[]).find(x=>x.id===id); if(!a) return;
    a.status='ativa'; a.pausedFromKey=null;
    saveCurrentData();
    Assinaturas.sync();
    renderView(); toast('Assinatura reativada.');
  },
  remove(id){
    const a = (S.data.assinaturas||[]).find(x=>x.id===id); if(!a) return;
    openConfirmModal({title:'Excluir assinatura?', text:'A assinatura deixará de gerar novas cobranças. Os lançamentos e cobranças já registrados são preservados.', confirmLabel:'Excluir assinatura', variant:'danger', onConfirm(){
      S.data.assinaturas = S.data.assinaturas.filter(x=>x.id!==id);
      saveCurrentData(); closeModal(); renderView(); toast('Assinatura excluída. Histórico preservado.');
    }});
  }
};
window.Assinaturas = Assinaturas;

/* ---------------- VIEW: aba Assinaturas em Lançamentos ---------------- */
function renderAssinaturas(){
  const list = (S.data.assinaturas||[]).filter(a=>bankMatches(a.formaPagamento==='Crédito' ? ((S.data.cartoes||[]).find(c=>c.id===a.cartaoId)||{}).banco : a.banco));
  const ativasTotal = sumBy(list.filter(a=>a.status==='ativa' && a.tipo==='mensal'),'valor');
  const rows = list.slice().sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','pt-BR')).map(a=>{
    const pausada = a.status==='pausada';
    const cartaoNome = a.formaPagamento==='Crédito' ? (((S.data.cartoes||[]).find(c=>c.id===a.cartaoId)||{}).banco || 'cartão removido') : '';
    const contaLabel = a.formaPagamento==='Crédito' ? ('Cartão: '+esc(cartaoNome)) : (esc(a.formaPagamento)+' · '+esc(a.banco||'—'));
    const vencLabel = a.tipo==='mensal' ? ('Todo dia '+a.diaVencimento) : ('Dia '+a.diaVencimento+' de '+MONTHS[a.mesVencimento||0]);
    const proxima = assinaturaProximaCobranca(a);
    return `
    <div class="card-entity" style="${pausada?'opacity:.6;':''}">
      <div class="card-entity-head">
        <div class="cehl">
          <div class="bank-badge" style="background:${catColor(a.nome)}">${esc((a.nome||'?')[0])}</div>
          <div class="info">
            <div>${esc(a.nome)} <span class="cat-pill" style="margin-left:4px;"><span class="dot" style="background:${catColor(a.categoria)}"></span>${esc(a.categoria)}</span> <span class="cat-pill" style="opacity:.85;">${a.tipo==='mensal'?'Mensal':'Anual'}</span> ${pausada?'<span class="cat-pill" style="background:rgba(239,68,68,.15);color:#ef4444;">Pausada</span>':'<span class="cat-pill" style="background:rgba(34,197,94,.15);color:#22c55e;">Ativa</span>'}</div>
            <div>${brl(a.valor)}${a.tipo==='mensal'?'/mês':'/ano'} · ${vencLabel} · ${contaLabel}${proxima?(' · Próxima cobrança: '+proxima.slice(8,10)+'/'+proxima.slice(5,7)+'/'+proxima.slice(0,4)):''}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn-outline btn-sm" onclick="${pausada?`Assinaturas.resume('${a.id}')`:`Assinaturas.pause('${a.id}')`}">${pausada?'Ativar':'Pausar'}</button>
          <button class="btn-outline btn-sm" onclick="Assinaturas.edit('${a.id}')">✎ Editar</button>
          <button class="btn-outline btn-sm" onclick="Assinaturas.remove('${a.id}')">Excluir</button>
        </div>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="cards-row">
      <div class="card"><div class="clabel">${tagBadgeHTML('despesas','ASSINATURAS ATIVAS (MENSAL)')}</div><div class="cval">${brl(ativasTotal)}</div></div>
    </div>
    <div class="tabs">
      <button class="tab-btn" onclick="Budget.tab('receita')">Receita</button>
      <button class="tab-btn" onclick="Budget.tab('fixa')">Despesa fixa</button>
      <button class="tab-btn" onclick="Budget.tab('variavel')">Despesa variável</button>
      <button class="tab-btn active" onclick="Assinaturas.tab()">Assinaturas</button>
      <button class="tab-btn" onclick="Budget.tab('central')">⌕ Central</button>
    </div>
    <div class="panel-box">
      <div class="toolbar"><div class="toolbar-left">Assinaturas</div><button class="btn-outline" onclick="Assinaturas.add()">+ Adicionar</button></div>
      ${rows || '<div class="empty-note">Nenhuma assinatura cadastrada ainda.</div>'}
      <p style="font-size:11px;color:var(--muted-2);margin-top:10px;">Assinaturas mensais entram nas despesas totais todo mês enquanto ativas. Assinaturas anuais entram só no mês do vencimento. Pausar não apaga o histórico — só para as próximas cobranças a partir do mês selecionado no topo.</p>
    </div>`;
}
