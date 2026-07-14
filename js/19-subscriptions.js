/* Borion Finance — V6.24.6 — Assinaturas versionadas e ocorrências independentes.
   Cadastro recorrente, previsão e movimento financeiro são camadas diferentes:
   - assinaturas: regra + versões + períodos ativos/pausados;
   - assinaturaCobrancas: uma ocorrência imutável por assinatura/período;
   - somente status paga/cobrada altera conta ou cartão. */

function assinaturaDiaClamped(rule, mesKey){
  const [y,m]=String(mesKey).split('-').map(Number);
  const ultimoDia=new Date(y,m,0).getDate();
  return Math.min(Math.max(1,Number(rule.diaVencimento)||1),ultimoDia);
}
function assinaturaDataVencimento(rule, mesKey){ return mesKey+'-'+pad2(assinaturaDiaClamped(rule,mesKey)); }
function assinaturaTodayISO(){ return todayISO(); }
function assinaturaRuleSnapshot(source){
  return {
    nome:source.nome||'Assinatura', categoria:source.categoria||'Outro', tipo:source.tipo==='anual'?'anual':'mensal',
    valor:Math.round((Number(source.valor)||0)*100)/100, diaVencimento:Math.min(31,Math.max(1,Number(source.diaVencimento)||1)),
    mesVencimento:source.tipo==='anual'?Math.max(0,Number(source.mesVencimento)||0):null,
    formaPagamento:source.formaPagamento==='Crédito'?'Crédito':(source.formaPagamento||'Pix'),
    accountId:source.accountId||null, banco:source.banco||accountNameSnapshot(source.accountId)||'', cartaoId:source.cartaoId||null
  };
}
function assinaturaEnsureModel(a){
  if(!a) return a;
  const createdKey=a.createdKey||monthKey(todayYM().y,todayYM().m); a.createdKey=createdKey;
  if(!Array.isArray(a.versions)||!a.versions.length){
    a.versions=[Object.assign({id:uid(),effectiveFrom:createdKey,createdAt:a.createdAt||Date.now()},assinaturaRuleSnapshot(a))];
  }
  a.versions.sort((x,y)=>String(x.effectiveFrom).localeCompare(String(y.effectiveFrom)));
  if(!Array.isArray(a.activityPeriods)||!a.activityPeriods.length){
    const first={from:createdKey,to:null};
    if(a.status==='pausada'&&a.pausedFromKey){ first.to=shiftYM(a.pausedFromKey,-1); }
    a.activityPeriods=[first];
  }
  if(!Array.isArray(a.pauseHistory)) a.pauseHistory=[];
  if(a.status==='pausada'&&a.pausedFromKey&&!a.pauseHistory.some(p=>p.from===a.pausedFromKey&&!p.to)) a.pauseHistory.push({from:a.pausedFromKey,to:null,createdAt:Date.now()});
  if(a.deletedFromKey) a.status='excluida';
  const latest=assinaturaVersionFor(a,monthKey(todayYM().y,todayYM().m))||a.versions[a.versions.length-1];
  Object.assign(a,assinaturaRuleSnapshot(latest));
  return a;
}
function assinaturaVersionFor(a,period){
  assinaturaEnsureModelShallow(a);
  let found=null;
  (a.versions||[]).forEach(v=>{if(v.effectiveFrom<=period&&(!found||v.effectiveFrom>=found.effectiveFrom))found=v;});
  return found;
}
function assinaturaEnsureModelShallow(a){
  if(!a.versions||!a.versions.length){
    const key=a.createdKey||monthKey(todayYM().y,todayYM().m);
    a.versions=[Object.assign({id:uid(),effectiveFrom:key,createdAt:a.createdAt||Date.now()},assinaturaRuleSnapshot(a))];
  }
}
function assinaturaActiveInPeriod(a,period){
  assinaturaEnsureModel(a);
  if(a.deletedFromKey&&period>=a.deletedFromKey) return false;
  return (a.activityPeriods||[]).some(p=>p.from<=period&&(!p.to||period<=p.to));
}
function assinaturaOcorreNoMes(a,period){
  if(!a||!assinaturaActiveInPeriod(a,period)) return false;
  const rule=assinaturaVersionFor(a,period); if(!rule) return false;
  return rule.tipo!=='anual'||(Number(period.slice(5,7))-1)===Number(rule.mesVencimento);
}
function assinaturaProjection(a,period){
  const rule=assinaturaVersionFor(a,period); return rule?Object.assign({id:a.id,assinaturaId:a.id,period,status:a.status},assinaturaRuleSnapshot(rule)):null;
}
function assinaturasAtivasNoMes(y=S.month.y,m=S.month.m){
  const key=monthKey(y,m);
  return (S.data.assinaturas||[]).filter(a=>assinaturaOcorreNoMes(a,key)).map(a=>assinaturaProjection(a,key)).filter(r=>r&&r.formaPagamento!=='Crédito'&&bankMatches(r.banco,r.accountId));
}
function assinaturasMes(y=S.month.y,m=S.month.m){ return assinaturasAtivasNoMes(y,m).reduce((s,a)=>s+(Number(a.valor)||0),0); }
function assinaturaCobrancaFor(assinaturaId,period){ return (S.data.assinaturaCobrancas||[]).find(c=>c&&c.assinaturaId===assinaturaId&&c.period===period)||null; }
function assinaturaPeriodsUntilCurrent(a){
  assinaturaEnsureModel(a);
  const hojeKey=monthKey(todayYM().y,todayYM().m), start=a.createdKey||hojeKey;
  if(start>hojeKey) return [];
  return monthsBetweenISO(start+'-01',hojeKey+'-01').map(x=>x.key).filter(k=>assinaturaOcorreNoMes(a,k));
}
function assinaturaProximaCobranca(a){
  assinaturaEnsureModel(a); if(a.status==='pausada'||a.status==='excluida')return null;
  const hojeKey=monthKey(todayYM().y,todayYM().m);
  for(let i=0;i<36;i++){
    const key=shiftYM(hojeKey,i);
    if(assinaturaOcorreNoMes(a,key)){
      const rule=assinaturaVersionFor(a,key), due=assinaturaDataVencimento(rule,key);
      if(due>=assinaturaTodayISO()) return due;
    }
  }
  return null;
}
function assinaturaOccurrenceStatusLabel(status){ return ({prevista:'Prevista',vencida:'Vencida',paga:'Paga',cobrada:'Cobrada',pausada:'Pausada',falhou:'Falhou'})[status]||status||'Prevista'; }

const Assinaturas={
  cleanupDeletedGhosts(){
    if(!S.data||!Array.isArray(S.data.assinaturas)) return false;
    const deletedIds=new Set(S.data.assinaturas.filter(a=>a&&(a.status==='excluida'||a.deletedFromKey)).map(a=>a.id));
    if(!deletedIds.size) return false;

    S.data.assinaturas=S.data.assinaturas.filter(a=>!deletedIds.has(a.id));
    if(!Array.isArray(S.data.assinaturaCobrancas)) S.data.assinaturaCobrancas=[];
    S.data.assinaturaCobrancas=S.data.assinaturaCobrancas.filter(rec=>{
      if(!rec||!deletedIds.has(rec.assinaturaId)) return true;
      if(['paga','cobrada'].includes(rec.status)){
        rec.formerAssinaturaId=rec.assinaturaId;
        rec.assinaturaId=null;
        rec.subscriptionDeleted=true;
        rec.subscriptionNameSnapshot=rec.nome||((rec.snapshot&&rec.snapshot.nome)||'Assinatura');
        return true;
      }
      return false;
    });
    (S.data.cartoes||[]).forEach(card=>(card.parcelas||[]).forEach(parcela=>{
      if(parcela&&deletedIds.has(parcela.viaAssinaturaId)){
        parcela.formerAssinaturaId=parcela.viaAssinaturaId;
        delete parcela.viaAssinaturaId;
      }
    }));
    return true;
  },
  sync(){
    if(!S.data||!Array.isArray(S.data.assinaturas))return;
    if(!Array.isArray(S.data.assinaturaCobrancas))S.data.assinaturaCobrancas=[];
    let changed=this.cleanupDeletedGhosts();
    S.data.assinaturas.forEach(a=>{
      assinaturaEnsureModel(a);
      assinaturaPeriodsUntilCurrent(a).forEach(period=>{
        let rec=assinaturaCobrancaFor(a.id,period);
        if(!rec){ rec=this.createOccurrence(a,period);S.data.assinaturaCobrancas.push(rec);changed=true; }
        if(this.processOccurrence(a,rec))changed=true;
      });
    });
    if(changed)saveCurrentData();
  },
  createOccurrence(a,period){
    const rule=assinaturaVersionFor(a,period), snap=assinaturaRuleSnapshot(rule), due=assinaturaDataVencimento(rule,period);
    return Object.assign({id:uid(),assinaturaId:a.id,period,dueDate:due,data:due,status:'prevista',attemptCount:0,lastError:'',createdAt:Date.now(),processedAt:null,cartaoId:null,parcelaId:null,transacaoId:null},snap,{snapshot:snap});
  },
  processOccurrence(a,rec){
    if(!rec||['paga','cobrada'].includes(rec.status))return false;
    if(!assinaturaActiveInPeriod(a,rec.period)){ if(rec.status!=='pausada'){rec.status='pausada';return true;} return false; }
    const today=assinaturaTodayISO();
    if(rec.dueDate>today){ if(rec.status!=='prevista'){rec.status='prevista';rec.lastError='';return true;} return false; }
    return this.chargeOccurrence(rec);
  },
  chargeOccurrence(rec){
    rec.attemptCount=(Number(rec.attemptCount)||0)+1; rec.lastAttemptAt=Date.now();
    const valor=Math.round((Number(rec.valor)||0)*100)/100;
    if(rec.formaPagamento==='Crédito'){
      const cartao=(S.data.cartoes||[]).find(c=>c&&c.id===rec.cartaoId);
      if(!cartao){rec.status='falhou';rec.lastError='Cartão inexistente, removido ou inválido.';return true;}
      if(rec.parcelaId&&(cartao.parcelas||[]).some(p=>p.id===rec.parcelaId)){rec.status='cobrada';rec.lastError='';return true;}
      const p={id:uid(),descricao:rec.nome||'Assinatura',local:'',categoria:rec.categoria||'Outro',valorParcela:valor,parcelaTotal:1,dataCompra:rec.period,diaEntrada:Number(rec.dueDate.slice(8,10))||1,apareceDespesas:true,despesaTipo:'variavel',despesaTransacaoId:null,despesaTransacaoIds:[],despesaFixaId:null,viaAssinaturaId:rec.assinaturaId,assinaturaCobrancaId:rec.id};
      if(!Array.isArray(cartao.parcelas))cartao.parcelas=[];
      cartao.parcelas.push(p); linkParcelaToDespesa(cartao,p);
      rec.cartaoId=cartao.id;rec.parcelaId=p.id;rec.transacaoId=p.despesaTransacaoId;rec.status='cobrada';rec.processedAt=Date.now();rec.lastError='';
      return true;
    }
    const accountId=resolveAccountId(rec.accountId,{includeArchived:false});
    if(!accountId){rec.status='falhou';rec.lastError='Conta bancária inexistente, arquivada ou inválida.';return true;}
    if(!rec.balanceApplied){ adjustLiquidez(accountId,-valor);rec.balanceApplied=true; }
    rec.accountId=accountId;rec.banco=accountNameSnapshot(accountId,rec.banco);rec.status='cobrada';rec.processedAt=Date.now();rec.lastError='';
    return true;
  },
  retry(occurrenceId){
    const rec=(S.data.assinaturaCobrancas||[]).find(x=>x.id===occurrenceId);if(!rec||rec.status!=='falhou')return;
    this.chargeOccurrence(rec);saveCurrentData();renderView();toast(rec.status==='falhou'?'A cobrança continua com falha: '+rec.lastError:'Cobrança processada sem duplicidade.');
  },
  tab(){S.budgetTab='assinaturas';renderView();}, add(){this.openForm(null);}, edit(id){this.openForm((S.data.assinaturas||[]).find(x=>x.id===id));},
  openForm(existing){
    const isEdit=!!existing;if(existing)assinaturaEnsureModel(existing);
    const currentKey=monthKey(S.month.y,S.month.m), currentRule=isEdit?(assinaturaVersionFor(existing,currentKey)||existing):{};
    const cats=typeof orderedCategories==='function'?orderedCategories('variavel'):((S.data.categorias&&S.data.categorias.variavel)||['Outro']);
    const accountOpts=accountSelectOptions(), cardOpts=cardSelectOptions();
    const fields=[
      {key:'tipo',label:'Periodicidade',type:'segmented',options:[{value:'mensal',label:'Mensal'},{value:'anual',label:'Anual'}],default:currentRule.tipo||'mensal'},
      {key:'nome',label:'Nome',type:'text',default:currentRule.nome||''},
      {key:'categoria',label:'Categoria',type:'select',options:cats,default:currentRule.categoria||cats[0]},
      {key:'valorMensal',label:'Valor mensal (R$)',type:'money',default:currentRule.tipo==='mensal'?currentRule.valor:0,visibleWhen:{key:'tipo',value:'mensal'}},
      {key:'valorAnual',label:'Valor anual (R$)',type:'money',default:currentRule.tipo==='anual'?currentRule.valor:0,visibleWhen:{key:'tipo',value:'anual'}},
      {key:'dia',label:'Dia do vencimento',type:'select',options:Array.from({length:31},(_,i)=>String(i+1)),default:String(currentRule.diaVencimento||1)},
      {key:'mes',label:'Mês do vencimento',type:'select',options:MONTHS.slice(),default:MONTHS[currentRule.mesVencimento||0],visibleWhen:{key:'tipo',value:'anual'}},
      {key:'origem',label:'Origem do pagamento',type:'segmented',options:[{value:'conta',label:'Conta'},{value:'cartao',label:'Cartão de crédito'}],default:currentRule.formaPagamento==='Crédito'?'cartao':'conta'},
      {key:'forma',label:'Forma de pagamento',type:'select',options:['Dinheiro','Pix','Débito'],default:currentRule.formaPagamento&&currentRule.formaPagamento!=='Crédito'?currentRule.formaPagamento:'Pix',visibleWhen:{key:'origem',value:'conta'}},
      {key:'accountId',label:'Banco/Conta',type:'select',options:accountOpts.length?accountOpts:[{value:'',label:'Cadastre uma conta em Cartões e Contas'}],default:currentRule.accountId||'',visibleWhen:{key:'origem',value:'conta'}},
      {key:'cartaoId',label:'Cartão de crédito',type:'select',options:cardOpts.length?cardOpts:[{value:'',label:'Cadastre um cartão em Cartões e Contas'}],default:currentRule.cartaoId||'',visibleWhen:{key:'origem',value:'cartao'}}
    ];
    openModal({title:isEdit?'Editar assinatura':'Nova assinatura',sub:isEdit?'A alteração vale do mês selecionado em diante. Ocorrências consolidadas mantêm a fotografia original.':'Cadastre a regra recorrente; o saldo só muda quando a cobrança vencer e for processada.',fields,saveLabel:'Salvar assinatura',onDelete:isEdit?()=>{this.remove(existing.id);return false;}:null,deleteLabel:'Excluir assinatura',onSave:v=>{
      const nome=(v.nome||'').trim();if(!nome){alert('Dê um nome para a assinatura.');return;}
      const tipo=v.tipo==='anual'?'anual':'mensal',valor=Number(tipo==='anual'?v.valorAnual:v.valorMensal)||0;if(valor<=0){alert('Digite um valor maior que zero.');return;}
      const isCard=v.origem==='cartao';
      const accountId=isCard?null:requireAccountId(v.accountId,'Escolha uma conta bancária ativa.');if(!isCard&&!accountId)return;
      const card=isCard?(S.data.cartoes||[]).find(c=>c.id===v.cartaoId):null;if(isCard&&!card){alert('Escolha um cartão de crédito válido.');return;}
      const payload={nome,categoria:v.categoria||'Outro',tipo,valor,diaVencimento:Math.min(31,Math.max(1,parseInt(v.dia,10)||1)),mesVencimento:tipo==='anual'?Math.max(0,MONTHS.indexOf(v.mes)):null,formaPagamento:isCard?'Crédito':(v.forma||'Pix'),accountId,banco:isCard?'':accountNameSnapshot(accountId),cartaoId:isCard?card.id:null};
      if(isEdit){
        const version=Object.assign({id:uid(),effectiveFrom:currentKey,createdAt:Date.now()},payload);
        existing.versions=(existing.versions||[]).filter(x=>x.effectiveFrom!==currentKey);existing.versions.push(version);existing.versions.sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom));Object.assign(existing,payload);
        const pending=assinaturaCobrancaFor(existing.id,currentKey);if(pending&&['prevista','vencida','falhou'].includes(pending.status)){Object.assign(pending,assinaturaRuleSnapshot(version),{snapshot:assinaturaRuleSnapshot(version),dueDate:assinaturaDataVencimento(version,currentKey),data:assinaturaDataVencimento(version,currentKey),status:'prevista',lastError:''});}
        toast('Nova versão criada. O passado consolidado foi preservado.');
      }else{
        const a=Object.assign({id:uid(),status:'ativa',createdKey:currentKey,createdAt:Date.now(),versions:[],activityPeriods:[{from:currentKey,to:null}],pauseHistory:[]},payload);a.versions=[Object.assign({id:uid(),effectiveFrom:currentKey,createdAt:Date.now()},payload)];S.data.assinaturas.push(a);toast('Assinatura criada.');
      }
      saveCurrentData();this.sync();closeModal();renderView();
    }});
  },
  pause(id){
    const a=(S.data.assinaturas||[]).find(x=>x.id===id);if(!a)return;assinaturaEnsureModel(a);const key=monthKey(S.month.y,S.month.m);
    const open=(a.activityPeriods||[]).find(p=>!p.to);if(open&&open.from<=key)open.to=shiftYM(key,-1);
    a.pauseHistory.push({from:key,to:null,createdAt:Date.now()});a.status='pausada';a.pausedFromKey=key;
    (S.data.assinaturaCobrancas||[]).forEach(r=>{if(r.assinaturaId===id&&r.period>=key&&!['paga','cobrada'].includes(r.status)){r.status='pausada';r.lastError='';}});
    saveCurrentData();renderView();toast('Assinatura pausada. Nenhum mês pausado será cobrado retroativamente.');
  },
  resume(id){
    const a=(S.data.assinaturas||[]).find(x=>x.id===id);if(!a)return;assinaturaEnsureModel(a);const key=monthKey(S.month.y,S.month.m);
    const pause=[...(a.pauseHistory||[])].reverse().find(p=>!p.to);if(pause)pause.to=shiftYM(key,-1);
    a.activityPeriods.push({from:key,to:null});a.status='ativa';a.pausedFromKey=null;a.resumedAt=Date.now();
    saveCurrentData();this.sync();renderView();toast('Assinatura retomada a partir deste mês, sem cobrança retroativa.');
  },
  remove(id){
    const a=(S.data.assinaturas||[]).find(x=>x.id===id);if(!a)return;
    const occurrences=(S.data.assinaturaCobrancas||[]).filter(r=>r&&r.assinaturaId===id);
    const consolidated=occurrences.filter(r=>['paga','cobrada'].includes(r.status));
    const text=consolidated.length
      ? 'O cadastro da assinatura será removido completamente e não aparecerá mais como “Excluída”. As cobranças que já aconteceram continuarão somente como registros financeiros normais.'
      : 'A assinatura e todas as previsões ligadas a ela serão removidas completamente. Ela não aparecerá no histórico como assinatura excluída.';
    openConfirmModal({title:'Excluir assinatura definitivamente?',text,confirmLabel:'Excluir definitivamente',variant:'danger',onConfirm:()=>{
      S.data.assinaturas=(S.data.assinaturas||[]).filter(x=>x&&x.id!==id);
      S.data.assinaturaCobrancas=(S.data.assinaturaCobrancas||[]).filter(rec=>{
        if(!rec||rec.assinaturaId!==id) return true;
        if(['paga','cobrada'].includes(rec.status)){
          rec.formerAssinaturaId=id;
          rec.assinaturaId=null;
          rec.subscriptionDeleted=true;
          rec.subscriptionNameSnapshot=rec.nome||((rec.snapshot&&rec.snapshot.nome)||a.nome||'Assinatura');
          return true;
        }
        return false;
      });
      (S.data.cartoes||[]).forEach(card=>(card.parcelas||[]).forEach(parcela=>{
        if(parcela&&parcela.viaAssinaturaId===id){
          parcela.formerAssinaturaId=id;
          delete parcela.viaAssinaturaId;
        }
      }));
      saveCurrentData();renderView();toast(consolidated.length?'Assinatura removida. Pagamentos anteriores permanecem apenas como lançamentos financeiros.':'Assinatura removida definitivamente.');
    }});
  }
};
window.Assinaturas=Assinaturas;

function renderAssinaturas(){
  const list=(S.data.assinaturas||[]).filter(a=>a&&a.status!=='excluida'&&!a.deletedFromKey).filter(a=>{assinaturaEnsureModel(a);const rule=assinaturaVersionFor(a,monthKey(S.month.y,S.month.m))||a;return bankMatches(rule.formaPagamento==='Crédito'?(((S.data.cartoes||[]).find(c=>c.id===rule.cartaoId)||{}).banco):rule.banco,rule.accountId);});
  const active=list.filter(a=>a.status==='ativa'&&!a.deletedFromKey), total=active.filter(a=>(assinaturaVersionFor(a,monthKey(S.month.y,S.month.m))||a).tipo==='mensal').reduce((s,a)=>s+Number((assinaturaVersionFor(a,monthKey(S.month.y,S.month.m))||a).valor||0),0);
  const rows=list.slice().sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','pt-BR')).map(a=>{
    const key=monthKey(S.month.y,S.month.m),r=assinaturaVersionFor(a,key)||a,paused=a.status==='pausada';
    const card=r.formaPagamento==='Crédito'?(S.data.cartoes||[]).find(c=>c.id===r.cartaoId):null,account=r.accountId?accountById(r.accountId,{includeArchived:true}):null;
    const source=r.formaPagamento==='Crédito'?('Cartão: '+(card?card.banco:'cartão removido')):(r.formaPagamento+' · '+(account?account.nome:(r.banco||'conta removida')));
    const next=assinaturaProximaCobranca(a), occ=assinaturaCobrancaFor(a.id,key), status=paused?'Pausada':occ?assinaturaOccurrenceStatusLabel(occ.status):'Ativa';
    const retry=occ&&occ.status==='falhou'?`<button class="btn-outline btn-sm" onclick="Assinaturas.retry('${occ.id}')">Tentar novamente</button>`:'';
    return `<div class="card-entity" style="${paused?'opacity:.65;':''}"><div class="card-entity-head"><div class="cehl"><div class="bank-badge" style="background:${catColor(r.nome)}">${esc((r.nome||'?')[0])}</div><div class="info"><div>${esc(r.nome)} <span class="cat-pill"><span class="dot" style="background:${catColor(r.categoria)}"></span>${esc(r.categoria)}</span> <span class="cat-pill">${status}</span></div><div>${brl(r.valor)}${r.tipo==='mensal'?'/mês':'/ano'} · ${r.tipo==='mensal'?'dia '+r.diaVencimento:'dia '+r.diaVencimento+' de '+MONTHS[r.mesVencimento||0]} · ${esc(source)}${next?' · Próxima: '+next.slice(8,10)+'/'+next.slice(5,7)+'/'+next.slice(0,4):''}${occ&&occ.lastError?' · '+esc(occ.lastError):''}</div></div></div><div style="display:flex;gap:8px;flex-wrap:wrap;">${retry}<button class="btn-outline btn-sm" onclick="${paused?`Assinaturas.resume('${a.id}')`:`Assinaturas.pause('${a.id}')`}">${paused?'Ativar':'Pausar'}</button><button class="btn-outline btn-sm" onclick="Assinaturas.edit('${a.id}')">✎ Editar</button><button class="btn-outline btn-sm" onclick="Assinaturas.remove('${a.id}')">Excluir</button></div></div></div>`;
  }).join('');
  return `<div class="cards-row"><div class="card"><div class="clabel">${tagBadgeHTML('despesas','ASSINATURAS ATIVAS (MENSAL)')}</div><div class="cval">${brl(total)}</div></div></div><div class="tabs"><button class="tab-btn" onclick="Budget.tab('receita')">Receita</button><button class="tab-btn" onclick="Budget.tab('fixa')">Despesa fixa</button><button class="tab-btn" onclick="Budget.tab('variavel')">Despesa variável</button><button class="tab-btn active" onclick="Assinaturas.tab()">Assinaturas</button>${reservasEnabled()?`<button class="tab-btn" onclick="Budget.tab('reserva_transferencias')">Entre reservas</button>`:''}<button class="tab-btn" onclick="Budget.tab('central')">⌕ Central</button></div><div class="panel-box"><div class="toolbar"><div class="toolbar-left">Assinaturas</div><button class="btn-outline" onclick="Assinaturas.add()">+ Adicionar</button></div>${rows||'<div class="empty-note">Nenhuma assinatura cadastrada ainda.</div>'}<p style="font-size:11px;color:var(--muted-2);margin-top:10px;">Previsões futuras aparecem no mês, mas somente ocorrências cobradas/pagas alteram saldo. Excluir remove o cadastro completamente; pagamentos já realizados permanecem apenas como registros financeiros.</p></div>`;
}
