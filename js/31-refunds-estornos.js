/* Borion Finance — V7.7.2 — Reembolsos e estornos completos.
   Modos suportados:
   - account: dinheiro devolvido em Carteira, conta ou reserva;
   - invoice: crédito lançado diretamente em uma fatura aberta;
   - purchase: abatimento proporcional, nas próximas parcelas ou manual;
   - store_credit: vale/crédito interno da loja, sem movimentar conta ou cartão.

   Reembolso nunca conta como renda própria. Todos os vínculos são auditáveis e
   preservam a compra original. Faturas pagas não são reescritas. */
(function(){
  'use strict';

  const MODE_ACCOUNT='account';
  const MODE_INVOICE='invoice';
  const MODE_PURCHASE='purchase';
  const MODE_STORE='store_credit';
  const MODES=new Set([MODE_ACCOUNT,MODE_INVOICE,MODE_PURCHASE,MODE_STORE]);
  const roundMoney=value=>Math.round((Number(value)||0)*100)/100;
  const toCents=value=>Math.max(0,Math.round((Number(value)||0)*100));
  const fromCents=value=>Math.round(Number(value)||0)/100;
  const safeId=()=>typeof uid==='function'?uid():('refund_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10));
  const selectedCompetence=()=>typeof monthKey==='function'?monthKey(S.month.y,S.month.m):new Date().toISOString().slice(0,7);
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  let originalLinkParcelaToDespesa=null;
  let purchaseSyncGuard=false;

  function ensure(){
    if(typeof S==='undefined'||!S||!S.data)return [];
    if(!Array.isArray(S.data.refunds))S.data.refunds=[];
    return S.data.refunds;
  }
  function cardById(id){return ((S.data&&S.data.cartoes)||[]).find(card=>card&&card.id===id)||null;}
  function purchaseById(card,id){return card&&((card.parcelas)||[]).find(purchase=>purchase&&purchase.id===id)||null;}
  function recordById(id){return ensure().find(record=>record&&record.id===id)||null;}
  function recordByTransactionId(id){return ensure().find(record=>record&&record.transactionId===id)||null;}
  function transactionByRecord(record){return record&&((S.data&&S.data.transacoes)||[]).find(tx=>tx&&tx.id===record.transactionId)||null;}
  function recordsForCard(cardId){return ensure().filter(record=>record&&record.cardId===cardId);}
  function recordsForPurchase(cardId,purchaseId){return ensure().filter(record=>record&&record.mode===MODE_PURCHASE&&record.cardId===cardId&&record.purchaseId===purchaseId);}
  function sum(list,selector){return roundMoney((list||[]).reduce((total,item)=>total+(Number(selector(item))||0),0));}
  function monthOfDate(date){return String(date||'').slice(0,7);}

  function purchaseGrossTotal(purchase){
    return roundMoney((Number(purchase&&purchase.valorParcela)||0)*Math.max(1,Math.round(Number(purchase&&purchase.parcelaTotal)||1)));
  }
  function allocationCents(record,competence){return Math.max(0,Math.round(Number(record&&record.allocations&&record.allocations[competence])||0));}
  function purchaseCreditCents(cardId,purchaseId,competence,excludeRecordId){
    return recordsForPurchase(cardId,purchaseId)
      .filter(record=>record.id!==excludeRecordId)
      .reduce((total,record)=>total+allocationCents(record,competence),0);
  }
  function installmentGrossCents(purchase){return toCents(purchase&&purchase.valorParcela);}
  function installmentCredit(cardId,purchase,index){
    if(!purchase||index<1)return 0;
    return fromCents(purchaseCreditCents(cardId,purchase.id,shiftYM(purchase.dataCompra,index-1)));
  }
  function installmentNetValue(cardId,purchase,index){
    const gross=installmentGrossCents(purchase);
    const credit=purchaseCreditCents(cardId,purchase&&purchase.id,shiftYM(purchase.dataCompra,index-1));
    return fromCents(Math.max(0,gross-credit));
  }
  function netInstallmentValues(cardId,purchase){
    const count=Math.max(1,Math.round(Number(purchase&&purchase.parcelaTotal)||1));
    return Array.from({length:count},(_,index)=>installmentNetValue(cardId,purchase,index+1));
  }
  function purchaseRefundTotal(cardId,purchaseId){return sum(recordsForPurchase(cardId,purchaseId),record=>record.amount);}
  function purchaseNetTotal(cardId,purchase){return roundMoney(Math.max(0,purchaseGrossTotal(purchase)-purchaseRefundTotal(cardId,purchase&&purchase.id)));}
  function purchaseRefundStatus(cardId,purchase){
    const refunded=purchaseRefundTotal(cardId,purchase&&purchase.id),gross=purchaseGrossTotal(purchase);
    if(refunded<=0)return 'none';
    return refunded+0.005>=gross?'total':'partial';
  }

  function purchaseInstallments(card,purchase,excludeRecordId){
    if(!card||!purchase)return [];
    const count=Math.max(1,Math.round(Number(purchase.parcelaTotal)||1));
    const gross=installmentGrossCents(purchase);
    return Array.from({length:count},(_,offset)=>{
      const index=offset+1;
      const competence=shiftYM(purchase.dataCompra,offset);
      const priorCredit=purchaseCreditCents(card.id,purchase.id,competence,excludeRecordId);
      return {
        index,competence,grossCents:gross,priorCreditCents:priorCredit,
        capacityCents:Math.max(0,gross-priorCredit),paid:typeof isFaturaPaga==='function'?isFaturaPaga(card.id,competence):false
      };
    });
  }
  function proportionalAllocation(amountCents,capacities){
    const total=capacities.reduce((value,current)=>value+Math.max(0,current),0);
    if(amountCents<=0||total<=0)return capacities.map(()=>0);
    const raw=capacities.map(capacity=>amountCents*(Math.max(0,capacity)/total));
    const result=raw.map(value=>Math.floor(value));
    let remainder=amountCents-result.reduce((value,current)=>value+current,0);
    raw.map((value,index)=>({index,fraction:value-Math.floor(value)}))
      .sort((a,b)=>b.fraction-a.fraction||a.index-b.index)
      .forEach(item=>{if(remainder>0&&result[item.index]<capacities[item.index]){result[item.index]++;remainder--;}});
    for(let index=0;remainder>0&&index<result.length;index=(index+1)%result.length){
      if(result[index]<capacities[index]){result[index]++;remainder--;}
    }
    return result;
  }
  function buildPurchaseAllocations(card,purchase,amount,strategy='proportional',manualAllocations=null,excludeRecordId=null){
    const amountCents=toCents(amount);
    const installments=purchaseInstallments(card,purchase,excludeRecordId);
    const eligible=installments.filter(item=>!item.paid&&item.capacityCents>0);
    const available=eligible.reduce((total,item)=>total+item.capacityCents,0);
    if(amountCents<=0)return {ok:false,error:'Digite um valor de reembolso maior que zero.'};
    if(amountCents>available)return {ok:false,error:available>0?'O valor supera o saldo das parcelas ainda em aberto ('+brlText(fromCents(available))+').':'Todas as parcelas desta compra já estão em faturas pagas. Use Crédito direto na fatura.'};
    const allocations={};
    if(strategy==='manual'){
      const input=manualAllocations&&typeof manualAllocations==='object'?manualAllocations:{};
      let manualTotal=0;
      for(const item of installments){
        const value=Math.max(0,Math.round(Number(input[item.competence])||0));
        if(item.paid&&value>0)return {ok:false,error:'A parcela de '+shortMonthLabel(item.competence)+' já está em uma fatura paga e não pode ser reescrita.'};
        if(value>item.capacityCents)return {ok:false,error:'O abatimento de '+shortMonthLabel(item.competence)+' supera o saldo disponível dessa parcela.'};
        if(value>0){allocations[item.competence]=value;manualTotal+=value;}
      }
      if(manualTotal!==amountCents)return {ok:false,error:'A distribuição manual precisa somar exatamente '+brlText(fromCents(amountCents))+'.'};
      return {ok:true,allocations,availableCents:available};
    }
    if(strategy==='next'){
      let remaining=amountCents;
      eligible.sort((a,b)=>a.competence.localeCompare(b.competence)).forEach(item=>{
        if(remaining<=0)return;
        const value=Math.min(remaining,item.capacityCents);
        if(value>0)allocations[item.competence]=value;
        remaining-=value;
      });
      return {ok:true,allocations,availableCents:available};
    }
    const distribution=proportionalAllocation(amountCents,installments.map(item=>item.paid?0:item.capacityCents));
    distribution.forEach((value,index)=>{if(value>0)allocations[installments[index].competence]=value;});
    return {ok:true,allocations,availableCents:available};
  }

  function directInvoiceCredit(cardId,competence,excludeRecordId=null){
    return sum(recordsForCard(cardId).filter(record=>record.mode===MODE_INVOICE&&record.competence===competence&&record.id!==excludeRecordId),record=>record.amount);
  }
  function purchaseCreditForCompetence(cardId,competence){
    return fromCents(recordsForCard(cardId).filter(record=>record.mode===MODE_PURCHASE)
      .reduce((total,record)=>total+allocationCents(record,competence),0));
  }
  function invoiceGrossTotal(cardId,competence,excludeRecordId=null){
    const card=cardById(cardId);
    if(!card)return 0;
    let total=0;
    (card.parcelas||[]).forEach(purchase=>{
      const offset=monthDiffYM(competence,purchase.dataCompra);
      const index=offset+1;
      if(index>=1&&index<=Math.max(1,Number(purchase.parcelaTotal)||1)){
        const gross=installmentGrossCents(purchase);
        const credit=purchaseCreditCents(card.id,purchase.id,competence,excludeRecordId);
        total+=fromCents(Math.max(0,gross-credit));
      }
    });
    return roundMoney(total);
  }
  function invoiceInfo(cardId,competence){
    const gross=invoiceGrossTotal(cardId,competence);
    const direct=directInvoiceCredit(cardId,competence);
    const purchaseCredit=purchaseCreditForCompetence(cardId,competence);
    return {gross,directCredit:direct,purchaseCredit,total:roundMoney(Math.max(0,gross-direct)),totalCredits:roundMoney(direct+purchaseCredit)};
  }
  function validateInvoiceCredit(cardId,competence,amount,excludeRecordId=null){
    const card=cardById(cardId);
    if(!card)return {ok:false,error:'Escolha um cartão de crédito válido.'};
    if(!competence)return {ok:false,error:'Escolha a fatura em que o crédito apareceu.'};
    if(typeof isFaturaPaga==='function'&&isFaturaPaga(cardId,competence))return {ok:false,error:'Esta fatura já está paga. Reabra a fatura antes de alterar créditos ou estornos.'};
    const available=roundMoney(Math.max(0,invoiceGrossTotal(cardId,competence,excludeRecordId)-directInvoiceCredit(cardId,competence,excludeRecordId)));
    if(roundMoney(amount)>available+0.005)return {ok:false,error:available>0?'O crédito supera o valor aberto desta fatura ('+brlText(available)+').':'Esta fatura não possui saldo aberto para receber o crédito.'};
    return {ok:true,available};
  }

  function recordTouchesPaidInvoice(record){
    if(!record)return false;
    if(record.mode===MODE_INVOICE)return typeof isFaturaPaga==='function'&&isFaturaPaga(record.cardId,record.competence);
    if(record.mode===MODE_PURCHASE)return Object.keys(record.allocations||{}).some(competence=>allocationCents(record,competence)>0&&typeof isFaturaPaga==='function'&&isFaturaPaga(record.cardId,competence));
    return false;
  }
  function mutationAllowed(record){
    if(!record||!recordTouchesPaidInvoice(record))return {ok:true};
    return {ok:false,error:'Este reembolso já participa de uma fatura paga. Reabra a fatura afetada antes de editar ou excluir o estorno.'};
  }

  function syncPurchaseExpenses(card,purchase){
    if(!card||!purchase||!purchase.apareceDespesas)return;
    const values=netInstallmentValues(card.id,purchase);
    purchaseSyncGuard=true;
    try{
      if(purchase.despesaTipo==='fixa'){
        const fixed=(S.data.fixas||[]).find(item=>item&&item.id===purchase.despesaFixaId)||(S.data.fixas||[]).find(item=>item&&item.viaCartaoId===card.id&&item.viaParcelaId===purchase.id);
        if(fixed){
          fixed.cardRefundValoresMensais=values.slice();
          fixed.cardRefundOriginalValue=Number(purchase.valorParcela)||0;
          fixed.cardRefundUpdatedAt=Date.now();
        }
        return;
      }
      let transactions=(S.data.transacoes||[]).filter(tx=>tx&&tx.tipo==='variavel'&&tx.viaParcelaId===purchase.id);
      if(!transactions.length&&typeof originalLinkParcelaToDespesa==='function'){
        originalLinkParcelaToDespesa(card,purchase);
        transactions=(S.data.transacoes||[]).filter(tx=>tx&&tx.tipo==='variavel'&&tx.viaParcelaId===purchase.id);
      }
      transactions.forEach(tx=>{
        const index=Math.max(1,Math.round(Number(tx.parcelaAtual)||monthDiffYM(String(tx.data||'').slice(0,7),purchase.dataCompra)+1));
        if(index>=1&&index<=values.length){
          tx.valor=values[index-1];
          tx.cardRefundAdjusted=values[index-1]!==Number(purchase.valorParcela||0);
          tx.cardRefundOriginalValue=Number(purchase.valorParcela)||0;
          tx.updatedAt=Date.now();
        }
      });
    }finally{purchaseSyncGuard=false;}
  }

  function expenseAdjustment(y=S.month.y,m=S.month.m){
    const competence=monthKey(y,m);
    return sum(ensure().filter(record=>{
      if(record.reducesExpenses===false||record.mode===MODE_PURCHASE)return false;
      if(record.mode===MODE_INVOICE)return record.competence===competence;
      return monthOfDate(record.date)===competence;
    }),record=>record.amount);
  }

  /* V7.7.2 — detalhamento mensal usado no miniaviso do card Despesas.
     A lista segue exatamente o mês selecionado. Abatimentos de compra aparecem em
     cada competência em que uma parcela foi reduzida; créditos diretos aparecem na
     fatura escolhida; conta/Pix e vale aparecem no mês da data do reembolso. */
  function purchaseAffectsExpenses(card,purchase,competence){
    if(!card||!purchase||!purchase.apareceDespesas)return false;
    if(purchase.despesaTipo==='fixa'){
      const fixed=(S.data.fixas||[]).find(item=>item&&(item.id===purchase.despesaFixaId||(item.viaCartaoId===card.id&&item.viaParcelaId===purchase.id)));
      return !!fixed;
    }
    return (S.data.transacoes||[]).some(tx=>tx&&tx.tipo==='variavel'&&tx.viaParcelaId===purchase.id&&monthOfDate(tx.data)===competence);
  }
  function refundReference(record){
    if(!record)return {label:'Reembolso',detail:''};
    if(record.mode===MODE_PURCHASE){
      const card=cardById(record.cardId),purchase=purchaseById(card,record.purchaseId);
      return {
        label:(purchase&&purchase.descricao)||record.establishment||record.description||'Compra removida',
        detail:'Abatimento da compra'+(card&&card.banco?' · '+card.banco:'')
      };
    }
    if(record.mode===MODE_INVOICE){
      const card=cardById(record.cardId);
      return {
        label:record.establishment||record.description||'Crédito na fatura',
        detail:'Crédito na fatura'+(card&&card.banco?' · '+card.banco:'')
      };
    }
    if(record.mode===MODE_STORE)return {
      label:record.storeName||record.establishment||record.description||'Crédito da loja',
      detail:'Crédito ou vale da loja'
    };
    return {
      label:record.establishment||record.description||'Reembolso recebido',
      detail:'Recebido em conta, Pix ou Carteira'
    };
  }
  function expenseRefundItems(y=S.month.y,m=S.month.m){
    const competence=monthKey(y,m),items=[];
    ensure().forEach(record=>{
      if(!record)return;
      let amount=0;
      if(record.mode===MODE_PURCHASE){
        amount=fromCents(allocationCents(record,competence));
        if(amount<=0)return;
        const card=cardById(record.cardId),purchase=purchaseById(card,record.purchaseId);
        if(!purchaseAffectsExpenses(card,purchase,competence))return;
      }else{
        if(record.reducesExpenses===false)return;
        if(record.mode===MODE_INVOICE){if(record.competence!==competence)return;}
        else if(monthOfDate(record.date)!==competence)return;
        amount=roundMoney(record.amount);
      }
      if(amount<=0)return;
      const ref=refundReference(record);
      items.push({id:record.id,mode:record.mode,amount:roundMoney(amount),label:ref.label,detail:ref.detail,date:record.date||'',record});
    });
    items.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.label||'').localeCompare(String(b.label||'')));
    return items;
  }
  function expenseRefundBreakdown(y=S.month.y,m=S.month.m,netExpenses=null){
    const items=expenseRefundItems(y,m);
    const total=sum(items,item=>item.amount);
    const net=roundMoney(netExpenses==null?(typeof despesasMes==='function'?despesasMes(y,m):0):netExpenses);
    return {competence:monthKey(y,m),items,total,net,gross:roundMoney(net+total)};
  }
  function expenseRefundMiniHTML(y=S.month.y,m=S.month.m,netExpenses=null){
    const breakdown=expenseRefundBreakdown(y,m,netExpenses);
    if(breakdown.total<=0||!breakdown.items.length)return '';
    const period=typeof monthLabel==='function'?monthLabel(y,m):shortMonthLabel(breakdown.competence);
    const lines=breakdown.items.map(item=>`<div class="refund-expense-tooltip-item"><span>− ${brl(item.amount)}</span><div><b>${esc(item.label)}</b>${item.detail?`<small>${esc(item.detail)}</small>`:''}</div></div>`).join('');
    return `<div class="refund-expense-mini-wrap"><span class="refund-expense-mini" aria-hidden="true">↺ Estornos − ${brl(breakdown.total)}</span><div class="refund-expense-tooltip" role="tooltip"><div class="refund-expense-tooltip-head"><span>Despesas de ${esc(period)}</span><small>Detalhamento dos estornos</small></div><div class="refund-expense-tooltip-total"><span>Antes dos estornos</span><b>${brl(breakdown.gross)}</b></div><div class="refund-expense-tooltip-list">${lines}</div><div class="refund-expense-tooltip-total is-net"><span>Total após os estornos</span><b>${brl(breakdown.net)}</b></div></div></div>`;
  }
  function storeCreditAvailable(record){return roundMoney(Math.max(0,(Number(record&&record.amount)||0)-(Number(record&&record.usedAmount)||0)));}
  function storeCreditsTotal(){return sum(ensure().filter(record=>record.mode===MODE_STORE),record=>storeCreditAvailable(record));}

  function modeLabel(mode){
    if(mode===MODE_INVOICE)return 'Crédito direto na fatura';
    if(mode===MODE_PURCHASE)return 'Abatimento de compra específica';
    if(mode===MODE_STORE)return 'Crédito ou vale da loja';
    return 'Recebido em conta ou Pix';
  }
  function destinationLabel(tx){
    if(!tx)return '';
    const record=tx.refundId?recordById(tx.refundId):recordByTransactionId(tx.id);
    if(!record){
      const account=typeof accountNameSnapshot==='function'?accountNameSnapshot(tx.accountId,tx.banco||'conta removida'):(tx.banco||'conta removida');
      return (typeof CARTEIRA_CONTA_ID!=='undefined'&&tx.accountId===CARTEIRA_CONTA_ID)?'Reembolso na Carteira':'Reembolso em '+account;
    }
    if(record.mode===MODE_INVOICE){
      const card=cardById(record.cardId);
      return 'Crédito na fatura: '+((card&&card.banco)||'cartão removido')+' · '+shortMonthLabel(record.competence);
    }
    if(record.mode===MODE_PURCHASE){
      const card=cardById(record.cardId),purchase=purchaseById(card,record.purchaseId);
      return 'Abatimento: '+((purchase&&purchase.descricao)||'compra removida')+' · '+((card&&card.banco)||'cartão removido');
    }
    if(record.mode===MODE_STORE)return 'Crédito da loja: '+(record.storeName||record.establishment||tx.nome||'loja');
    const box=record.reserveBoxId&&typeof findReservaBoxById==='function'?findReservaBoxById(record.reserveBoxId):null;
    if(box)return 'Reembolso na reserva: '+box.nome;
    const account=typeof accountNameSnapshot==='function'?accountNameSnapshot(tx.accountId,tx.banco||'conta removida'):(tx.banco||'conta removida');
    return (typeof CARTEIRA_CONTA_ID!=='undefined'&&tx.accountId===CARTEIRA_CONTA_ID)?'Reembolso na Carteira':'Reembolso em '+account;
  }

  function cleanRefundTransaction(tx){
    delete tx.cardRefundId;delete tx.cardRefundMode;delete tx.cardRefundCardId;delete tx.cardRefundPurchaseId;delete tx.cardRefundCompetence;
    delete tx.noAccountEffect;delete tx.storeCreditName;delete tx.storeCreditExpiry;
  }
  function setTransactionRecordFields(tx,record){
    tx.refundId=record.id;
    tx.refundMode=record.mode;
    tx.noIncome=true;
    tx.origem='reembolso';
    tx.destinoModo=modeLabel(record.mode);
    tx.updatedAt=Date.now();
    if(record.mode!==MODE_ACCOUNT){
      tx.accountId=null;tx.reservaValor=0;
      delete tx.reservaMoveId;delete tx.reservaBoxId;delete tx.destinoReserva;
      tx.noAccountEffect=true;
    }else delete tx.noAccountEffect;
  }
  function createTransaction(record,payload){
    const now=Date.now();
    const tx={
      id:safeId(),tipo:'receita',nome:payload.name||record.establishment||'Reembolso',data:record.date,
      categoria:payload.category||'Reembolsos',valor:record.amount,accountId:null,banco:'',origem:'reembolso',
      reservaValor:0,destinoModo:modeLabel(record.mode),createdAt:now,addedAt:now,updatedAt:now
    };
    setTransactionRecordFields(tx,record);
    S.data.transacoes.push(tx);
    record.transactionId=tx.id;
    return tx;
  }
  function updateTransaction(tx,record,payload){
    Object.assign(tx,{nome:payload.name||record.establishment||'Reembolso',data:record.date,categoria:payload.category||tx.categoria||'Reembolsos',valor:record.amount});
    setTransactionRecordFields(tx,record);
    return tx;
  }

  function replaceRecord(previous,next){
    const list=ensure();
    if(previous){
      const index=list.findIndex(record=>record.id===previous.id);
      if(index>=0)list.splice(index,1);
    }
    list.push(next);
  }
  function cleanNonAccountTransaction(tx,record){
    tx.accountId=null;
    tx.reservaValor=0;
    delete tx.reservaMoveId;delete tx.reservaBoxId;delete tx.destinoReserva;
    if(record.mode===MODE_INVOICE){
      const card=cardById(record.cardId);tx.banco=(card&&card.banco)||'';
    }else if(record.mode===MODE_PURCHASE){
      const card=cardById(record.cardId);tx.banco=(card&&card.banco)||'';
    }else tx.banco=record.storeName||record.establishment||'';
  }

  function buildBaseRecord(previous,payload,mode){
    const now=Date.now();
    return {
      id:previous?previous.id:safeId(),transactionId:previous?previous.transactionId:null,mode,
      amount:roundMoney(payload.amount),date:payload.date||todayISO(),establishment:(payload.establishment||payload.name||'Reembolso').trim(),
      description:(payload.description||'').trim(),category:payload.category||'Reembolsos',expenseCategory:payload.expenseCategory||'Outro',
      reducesExpenses:payload.reducesExpenses!==false,createdAt:previous?previous.createdAt||now:now,updatedAt:now
    };
  }

  function upsertStructured(existingTx,previous,payload){
    const allowed=mutationAllowed(previous);if(!allowed.ok)return allowed;
    const mode=MODES.has(payload.mode)?payload.mode:MODE_INVOICE;
    if(mode===MODE_ACCOUNT)return {ok:false,error:'Destino de conta deve usar o fluxo financeiro de conta.'};
    const amount=roundMoney(payload.amount);if(amount<=0)return {ok:false,error:'Digite um valor maior que zero.'};
    let next=buildBaseRecord(previous,payload,mode);
    const oldCard=previous&&cardById(previous.cardId),oldPurchase=previous&&purchaseById(oldCard,previous.purchaseId);

    if(mode===MODE_INVOICE){
      const validation=validateInvoiceCredit(payload.cardId,payload.competence,amount,previous?previous.id:null);
      if(!validation.ok)return validation;
      Object.assign(next,{cardId:payload.cardId,competence:payload.competence,purchaseId:null,allocations:{},strategy:null});
    }else if(mode===MODE_PURCHASE){
      const card=cardById(payload.cardId),purchase=purchaseById(card,payload.purchaseId);
      if(!card)return {ok:false,error:'Escolha um cartão de crédito válido.'};
      if(!purchase)return {ok:false,error:'Escolha a compra que receberá o abatimento.'};
      if(purchase.compartilhamento)return {ok:false,error:'Compras compartilhadas precisam ser ajustadas na própria divisão. Para esta devolução, use Crédito direto na fatura.'};
      const allocation=buildPurchaseAllocations(card,purchase,amount,payload.strategy,payload.manualAllocations,previous&&previous.mode===MODE_PURCHASE?previous.id:null);
      if(!allocation.ok)return allocation;
      Object.assign(next,{cardId:card.id,purchaseId:purchase.id,competence:null,allocations:allocation.allocations,strategy:payload.strategy||'proportional',expenseCategory:purchase.categoria||payload.expenseCategory||'Outro'});
    }else{
      Object.assign(next,{storeName:(payload.storeName||payload.establishment||payload.name||'Loja').trim(),expirationDate:payload.expirationDate||'',creditCode:(payload.creditCode||'').trim(),usedAmount:previous&&previous.mode===MODE_STORE?Number(previous.usedAmount)||0:0,cardId:null,purchaseId:null,competence:null,allocations:{},strategy:null});
    }

    const snapshot=clone(S.data);
    try{
      let tx=existingTx||transactionByRecord(previous);
      if(previous&&previous.mode===MODE_ACCOUNT&&tx){
        if(typeof reverseTxSaldoEffect==='function')reverseTxSaldoEffect(tx);
        if(typeof removeLinkedReservaMoveFromTransaction==='function')removeLinkedReservaMoveFromTransaction(tx);
      }
      replaceRecord(previous,next);
      tx=tx?updateTransaction(tx,next,payload):createTransaction(next,payload);
      next.transactionId=tx.id;
      cleanNonAccountTransaction(tx,next);
      setTransactionRecordFields(tx,next);
      if(oldCard&&oldPurchase)syncPurchaseExpenses(oldCard,oldPurchase);
      if(next.mode===MODE_PURCHASE){const card=cardById(next.cardId),purchase=purchaseById(card,next.purchaseId);syncPurchaseExpenses(card,purchase);}
      return {ok:true,record:next,transaction:tx};
    }catch(error){S.data=snapshot;console.error('[BORION][REFUND_SAVE]',error);return {ok:false,error:'Não foi possível salvar o reembolso. Os dados anteriores foram preservados.'};}
  }

  function upsertAccountRecord(tx,previous,payload){
    const allowed=mutationAllowed(previous);if(!allowed.ok)return allowed;
    if(!tx)return {ok:false,error:'O lançamento financeiro do reembolso não foi encontrado.'};
    const oldCard=previous&&cardById(previous.cardId),oldPurchase=previous&&purchaseById(oldCard,previous.purchaseId);
    const next=buildBaseRecord(previous,Object.assign({},payload,{amount:tx.valor,date:tx.data,category:tx.categoria,name:tx.nome}),MODE_ACCOUNT);
    Object.assign(next,{transactionId:tx.id,accountId:tx.accountId||null,bank:tx.banco||'',reserveBoxId:tx.reservaBoxId||null,reserveAmount:Number(tx.reservaValor)||0,destinationMode:tx.destinoModo||'Conta livre',cardId:null,purchaseId:null,competence:null,allocations:{},strategy:null});
    replaceRecord(previous,next);
    cleanRefundTransaction(tx);
    setTransactionRecordFields(tx,next);
    if(oldCard&&oldPurchase)syncPurchaseExpenses(oldCard,oldPurchase);
    return {ok:true,record:next,transaction:tx};
  }

  function removeRecord(record){
    if(!record)return {ok:false,error:'Reembolso não encontrado.'};
    const allowed=mutationAllowed(record);if(!allowed.ok)return allowed;
    const tx=transactionByRecord(record),card=cardById(record.cardId),purchase=purchaseById(card,record.purchaseId);
    const snapshot=clone(S.data);
    try{
      if(record.mode===MODE_ACCOUNT&&tx){
        if(typeof reverseTxSaldoEffect==='function')reverseTxSaldoEffect(tx);
        if(typeof removeLinkedReservaMoveFromTransaction==='function')removeLinkedReservaMoveFromTransaction(tx);
      }
      S.data.refunds=ensure().filter(item=>item.id!==record.id);
      S.data.transacoes=(S.data.transacoes||[]).filter(item=>item.id!==record.transactionId&&item.refundId!==record.id);
      if(card&&purchase)syncPurchaseExpenses(card,purchase);
      return {ok:true};
    }catch(error){S.data=snapshot;console.error('[BORION][REFUND_DELETE]',error);return {ok:false,error:'Não foi possível excluir o reembolso. Os dados anteriores foram preservados.'};}
  }

  function purchaseOptionsHTML(cardId,selectedPurchaseId){
    const card=cardById(cardId);
    if(!card)return '<option value="">Escolha um cartão primeiro</option>';
    const rows=(card.parcelas||[]).filter(purchase=>purchase&&!purchase.compartilhamento&&purchaseNetTotal(card.id,purchase)>0).map(purchase=>{
      const refunded=purchaseRefundTotal(card.id,purchase.id);
      const label=(purchase.descricao||'Compra')+' · '+brlText(purchaseGrossTotal(purchase))+(refunded>0?' · já reembolsado '+brlText(refunded):'');
      return `<option value="${esc(purchase.id)}" ${purchase.id===selectedPurchaseId?'selected':''}>${esc(label)}</option>`;
    });
    return rows.join('')||'<option value="">Nenhuma compra disponível neste cartão</option>';
  }
  function monthOptionsHTML(cardId,selected){
    const current=selectedCompetence();
    const options=[];
    for(let offset=-12;offset<=24;offset++){
      const competence=shiftYM(current,offset);
      const paid=typeof isFaturaPaga==='function'&&isFaturaPaga(cardId,competence);
      const gross=invoiceGrossTotal(cardId,competence),direct=directInvoiceCredit(cardId,competence);
      const label=shortMonthLabel(competence)+(gross>0?' · aberto '+brlText(Math.max(0,gross-direct)):'')+(paid?' · PAGA':'');
      options.push(`<option value="${competence}" ${competence===selected?'selected':''} ${paid?'disabled':''}>${esc(label)}</option>`);
    }
    return options.join('');
  }
  function manualAllocationHTML(cardId,purchaseId,amount,existingRecord){
    const card=cardById(cardId),purchase=purchaseById(card,purchaseId);
    if(!card||!purchase)return '<div class="empty-note">Escolha uma compra para distribuir o abatimento.</div>';
    const installments=purchaseInstallments(card,purchase,existingRecord&&existingRecord.mode===MODE_PURCHASE?existingRecord.id:null);
    const defaultAllocation=buildPurchaseAllocations(card,purchase,amount,'proportional',null,existingRecord&&existingRecord.mode===MODE_PURCHASE?existingRecord.id:null);
    const chosen=existingRecord&&existingRecord.mode===MODE_PURCHASE&&existingRecord.strategy==='manual'?existingRecord.allocations:(defaultAllocation.ok?defaultAllocation.allocations:{});
    return `<div class="refund-manual-grid">${installments.map(item=>{
      const initial=fromCents(Math.max(0,Math.round(Number(chosen&&chosen[item.competence])||0)));
      return `<label class="refund-manual-row ${item.paid?'is-paid':''}"><span><b>${item.index}/${purchase.parcelaTotal}</b><small>${esc(shortMonthLabel(item.competence))}${item.paid?' · fatura paga':' · disponível '+brl(fromCents(item.capacityCents))}</small></span><input type="text" inputmode="numeric" class="money-input refund-manual-input" data-competence="${esc(item.competence)}" data-max-cents="${item.capacityCents}" ${item.paid?'disabled':''}></label>`;
    }).join('')}</div>`;
  }
  function readManualAllocations(container){
    const allocations={};
    (container?container.querySelectorAll('.refund-manual-input'):[]).forEach(input=>{allocations[input.dataset.competence]=Math.max(0,parseInt(input.dataset.cents||'0',10)||0);});
    return allocations;
  }

  function invoiceRowsHTML(cardId,competence){
    const card=cardById(cardId);if(!card)return '';
    const rows=[];
    recordsForCard(cardId).forEach(record=>{
      let credit=0,title='',detail='';
      if(record.mode===MODE_INVOICE&&record.competence===competence){
        credit=Number(record.amount)||0;title=record.establishment||record.description||'Crédito na fatura';detail='Crédito direto na fatura';
      }else if(record.mode===MODE_PURCHASE){
        credit=fromCents(allocationCents(record,competence));
        if(credit>0){const purchase=purchaseById(card,record.purchaseId);title='Estorno — '+((purchase&&purchase.descricao)||record.establishment||'Compra');detail='Abatimento vinculado à compra';}
      }
      if(credit>0)rows.push(`<div class="installment-row installment-refund-row"><span class="installment-main"><span class="installment-title-line"><strong class="installment-description">${esc(title)}</strong></span><span class="installment-tags"><span class="cat-pill refund-card-pill">↺ ${esc(detail)}</span></span></span><span class="installment-value val-pos">− ${brl(credit)}</span><span></span><span>${record.date?record.date.slice(8,10)+'/'+record.date.slice(5,7):''}</span><span class="installment-actions"><button type="button" onclick="Refunds.openEdit('${record.id}')" title="Editar reembolso">✎</button></span></div>`);
    });
    return rows.join('');
  }
  function purchaseBadgeHTML(cardId,purchase){
    const total=purchaseRefundTotal(cardId,purchase&&purchase.id);if(total<=0)return '';
    const status=purchaseRefundStatus(cardId,purchase)==='total'?'Reembolso total':'Reembolso parcial';
    return `<span class="cat-pill refund-card-pill" title="Valor líquido da compra: ${esc(brlText(purchaseNetTotal(cardId,purchase)))}">↺ ${esc(status)} · ${brl(total)}</span>`;
  }
  function storeCreditsSummaryHTML(){
    const records=ensure().filter(record=>record.mode===MODE_STORE&&storeCreditAvailable(record)>0).sort((a,b)=>String(a.expirationDate||'9999').localeCompare(String(b.expirationDate||'9999')));
    if(!records.length)return '';
    return `<div class="refund-store-summary"><div class="refund-store-summary-head"><span><small>CRÉDITOS E VALES DISPONÍVEIS</small><b>${brl(storeCreditsTotal())}</b></span><span>${records.length} crédito(s)</span></div><div class="refund-store-credit-list">${records.map(record=>`<button type="button" onclick="Refunds.openEdit('${record.id}')"><span><b>${esc(record.storeName||record.establishment||'Loja')}</b><small>${record.expirationDate?'Validade '+record.expirationDate.slice(8,10)+'/'+record.expirationDate.slice(5,7)+'/'+record.expirationDate.slice(0,4):'Sem validade informada'}</small></span><strong>${brl(storeCreditAvailable(record))}</strong></button>`).join('')}</div></div>`;
  }

  function enhanceCardsView(){
    const root=document.getElementById('view-root')||document;
    root.querySelectorAll('.card-entity').forEach(entity=>{
      const editCard=entity.querySelector('button[onclick*="Cards.editCartao"]');
      if(!editCard)return;
      const match=String(editCard.getAttribute('onclick')||'').match(/Cards\.editCartao\('([^']+)'\)/);if(!match)return;
      const cardId=match[1],card=cardById(cardId);if(!card)return;
      entity.dataset.refundCardId=cardId;
      entity.querySelectorAll('.installment-purchase-row').forEach(row=>{
        const edit=row.querySelector('button[onclick*="Cards.editParcela"]');
        const purchaseMatch=edit&&String(edit.getAttribute('onclick')||'').match(/Cards\.editParcela\('[^']+','([^']+)'\)/);if(!purchaseMatch)return;
        const purchase=purchaseById(card,purchaseMatch[1]);if(!purchase)return;
        const badge=purchaseBadgeHTML(card.id,purchase),tags=row.querySelector('.installment-tags');
        if(badge&&tags)tags.insertAdjacentHTML('beforeend',badge);
        const status=parcelaStatus(purchase,S.month.y,S.month.m);
        if(status.ativo&&purchaseRefundTotal(card.id,purchase.id)>0){
          const net=installmentNetValue(card.id,purchase,status.atual),value=row.querySelector('.installment-value');
          if(value){value.innerHTML=`<span class="refund-gross-value">${brl(purchase.valorParcela)}</span><strong>${brl(net)}</strong><span class="installment-monthly-suffix">/mês</span>`;row.classList.add('has-refund');}
        }
      });
      const competence=selectedCompetence(),rows=invoiceRowsHTML(card.id,competence),invoiceRow=entity.querySelector('.installment-invoice-row');
      if(rows){
        if(invoiceRow)invoiceRow.insertAdjacentHTML('afterend',rows);
        else{const header=entity.querySelector('.installment-row.ih');if(header)header.insertAdjacentHTML('beforebegin',rows);}
      }
      const info=invoiceInfo(card.id,competence);
      if(invoiceRow&&info.totalCredits>0){
        const first=invoiceRow.querySelector('span');
        if(first)first.insertAdjacentHTML('beforeend',` <span class="refund-invoice-credit-note">Créditos − ${brl(info.totalCredits)}</span>`);
      }
    });
  }

  function installCalculationHooks(){
    if(window.__borionRefundCalculationHooks)return;window.__borionRefundCalculationHooks=true;
    const originalFixa=window.fixaValorNoMes;
    if(typeof originalFixa==='function')window.fixaValorNoMes=function(f,y=S.month.y,m=S.month.m){
      const values=f&&Array.isArray(f.cardRefundValoresMensais)?f.cardRefundValoresMensais:null;
      if(values&&f.startMonth){const index=monthDiffYM(monthKey(y,m),f.startMonth);if(index>=0&&index<values.length)return Number(values[index])||0;}
      return originalFixa(f,y,m);
    };
    const originalDespesas=window.despesasMes;
    if(typeof originalDespesas==='function')window.despesasMes=function(y=S.month.y,m=S.month.m){return roundMoney(Math.max(0,originalDespesas(y,m)-expenseAdjustment(y,m)));};
    window.parcelaRestanteValor=function(purchase,cardId,y=S.month.y,m=S.month.m){
      const status=parcelaStatus(purchase,y,m);if(!status.ativo)return {ativo:false,atual:status.atual,restante:0};
      let remaining=0;
      for(let index=status.atual;index<=purchase.parcelaTotal;index++){
        const competence=shiftYM(purchase.dataCompra,index-1);
        if(cardId&&isFaturaPaga(cardId,competence))continue;
        remaining+=installmentNetValue(cardId,purchase,index);
      }
      return {ativo:true,atual:status.atual,restante:roundMoney(remaining)};
    };
    window.cartaoFaturaDoMes=function(cardId,y=S.month.y,m=S.month.m){
      const card=cardById(cardId),competence=monthKey(y,m);
      if(!card)return {total:0,totalBruto:0,creditos:0,competencia:competence,paga:false,pagamento:null};
      const info=invoiceInfo(cardId,competence);
      return {total:info.total,totalBruto:info.gross,creditos:info.totalCredits,creditoFatura:info.directCredit,creditoCompras:info.purchaseCredit,competencia:competence,paga:isFaturaPaga(cardId,competence),pagamento:faturaPagamentoDe(cardId,competence)};
    };
    window.computeCardsDebtForCartao=function(card,y=S.month.y,m=S.month.m){
      if(!card)return 0;let total=0;
      (card.parcelas||[]).forEach(purchase=>{const status=parcelaRestanteValor(purchase,card.id,y,m);if(status.ativo)total+=status.restante;});
      const start=monthKey(y,m);
      const direct=sum(recordsForCard(card.id).filter(record=>record.mode===MODE_INVOICE&&record.competence>=start&&!isFaturaPaga(card.id,record.competence)),record=>record.amount);
      return roundMoney(Math.max(0,total-direct));
    };
    window.computeCardsDebt=function(y=S.month.y,m=S.month.m){
      let cardsTotal=0;const detail=[];
      (S.data.cartoes||[]).filter(card=>bankMatches(card.banco)).forEach(card=>{
        let cardDebt=0;
        (card.parcelas||[]).forEach(purchase=>{
          const status=parcelaRestanteValor(purchase,card.id,y,m);
          if(status.ativo&&status.restante>0){cardDebt+=status.restante;detail.push({tipoDivida:'cartao',cartao:card.banco,...purchase,atualCalc:status.atual,restante:status.restante});}
        });
        const start=monthKey(y,m);
        const direct=sum(recordsForCard(card.id).filter(record=>record.mode===MODE_INVOICE&&record.competence>=start&&!isFaturaPaga(card.id,record.competence)),record=>record.amount);
        cardsTotal+=Math.max(0,cardDebt-direct);
        if(direct>0)detail.push({tipoDivida:'credito_fatura',cartao:card.banco,descricao:'Créditos e estornos em faturas',restante:-Math.min(cardDebt,direct)});
      });
      cardsTotal=roundMoney(cardsTotal);
      const boletos=typeof computeBoletosDebt==='function'?computeBoletosDebt(y,m):{total:0,detail:[]};
      return {total:roundMoney(cardsTotal+boletos.total),detail:detail.concat(boletos.detail||[]),cartoesTotal:cardsTotal,boletosTotal:boletos.total||0,boletosDetail:boletos.detail||[]};
    };
    const originalDestination=window.budgetRevenueDestinationLabel;
    if(typeof originalDestination==='function')window.budgetRevenueDestinationLabel=function(tx){return tx&&(tx.refundId||recordByTransactionId(tx.id))?destinationLabel(tx):originalDestination(tx);};
    originalLinkParcelaToDespesa=window.linkParcelaToDespesa;
    if(typeof originalLinkParcelaToDespesa==='function')window.linkParcelaToDespesa=function(card,purchase){
      const result=originalLinkParcelaToDespesa(card,purchase);
      if(!purchaseSyncGuard&&purchaseRefundTotal(card&&card.id,purchase&&purchase.id)>0)syncPurchaseExpenses(card,purchase);
      return result;
    };
  }

  function installRenderHooks(){
    if(window.__borionRefundRenderHooks)return;window.__borionRefundRenderHooks=true;
    const originalCards=window.renderCards;
    if(typeof originalCards==='function')window.renderCards=function(){const result=originalCards.apply(this,arguments);enhanceCardsView();return result;};
    const originalBudget=window.renderBudget;
    if(typeof originalBudget==='function')window.renderBudget=function(){
      let html=originalBudget.apply(this,arguments);
      if(S.budgetTab==='receita'){
        const summary=storeCreditsSummaryHTML();if(summary)html=html.replace('<div class="grid2" id="budget-filtered-region">',summary+'<div class="grid2" id="budget-filtered-region">');
      }
      return html;
    };
  }

  function findCreatedRefundTransaction(beforeIds){
    return (S.data.transacoes||[]).slice().reverse().find(tx=>tx&&tx.tipo==='receita'&&tx.origem==='reembolso'&&!beforeIds.has(tx.id))||null;
  }
  function cardOptionsHTML(selected){
    return (S.data.cartoes||[]).map(card=>`<option value="${esc(card.id)}" ${card.id===selected?'selected':''}>${esc(card.banco||'Cartão')}</option>`).join('')||'<option value="">Nenhum cartão cadastrado</option>';
  }
  function enhanceRevenueModal(existing){
    const originInput=document.getElementById('tm_origem'),originGroup=document.getElementById('tm_origem_group');
    if(!originInput||!originGroup)return;
    const previous=existing?(recordByTransactionId(existing.id)||(existing.refundId?recordById(existing.refundId):null)):null;
    const initialMode=previous&&MODES.has(previous.mode)?previous.mode:MODE_ACCOUNT;
    const originField=originGroup.closest('.field'),destinationGroup=document.getElementById('tm_receita_destino_group'),destinationField=destinationGroup&&destinationGroup.closest('.field');
    const firstCard=(S.data.cartoes||[])[0],selectedCardId=(previous&&previous.cardId)||(firstCard&&firstCard.id)||'';
    const selectedPurchaseId=previous&&previous.purchaseId||'';
    const expenseCategories=((S.data.categorias&&S.data.categorias.variavel)||['Outro']);
    const section=document.createElement('div');section.id='tm_refund_section';section.className='refund-form-section';
    section.innerHTML=`
      <div class="field"><label>Tipo de devolução</label><div class="segmented-toggle refund-mode-toggle" id="tm_refund_mode_group">
        <button type="button" class="seg-btn ${initialMode===MODE_ACCOUNT?'active':''}" data-value="${MODE_ACCOUNT}">Conta / Pix</button>
        <button type="button" class="seg-btn ${initialMode===MODE_INVOICE?'active':''}" data-value="${MODE_INVOICE}">Crédito na fatura</button>
        <button type="button" class="seg-btn ${initialMode===MODE_PURCHASE?'active':''}" data-value="${MODE_PURCHASE}">Abater compra</button>
        <button type="button" class="seg-btn ${initialMode===MODE_STORE?'active':''}" data-value="${MODE_STORE}">Vale da loja</button>
      </div><input type="hidden" id="tm_refund_mode" value="${initialMode}"><p class="modal-sub" style="margin:4px 0 0;">O reembolso reduz gastos, mas nunca aumenta sua renda.</p></div>
      <div class="field"><label>Descrição do reembolso</label><input type="text" id="tm_refund_description" value="${esc(previous&&previous.description||'')}" placeholder="Ex: devolução de duas peças"></div>
      <div class="field"><label>Categoria da despesa devolvida</label><select id="tm_refund_expense_category">${expenseCategories.map(category=>`<option value="${esc(category)}" ${category===(previous&&previous.expenseCategory)?'selected':''}>${esc(category)}</option>`).join('')}</select></div>
      <div id="tm_refund_invoice_panel" class="refund-mode-panel hidden"><div class="field"><label>Cartão de crédito</label><select id="tm_refund_invoice_card">${cardOptionsHTML(selectedCardId)}</select></div><div class="field"><label>Fatura que recebeu o crédito</label><select id="tm_refund_invoice_competence"></select></div><div class="refund-preview-card" id="tm_refund_invoice_preview"></div></div>
      <div id="tm_refund_purchase_panel" class="refund-mode-panel hidden"><div class="field"><label>Cartão de crédito</label><select id="tm_refund_purchase_card">${cardOptionsHTML(selectedCardId)}</select></div><div class="field"><label>Compra original</label><select id="tm_refund_purchase_id">${purchaseOptionsHTML(selectedCardId,selectedPurchaseId)}</select></div><div class="field"><label>Como distribuir o abatimento</label><div class="segmented-toggle refund-strategy-toggle" id="tm_refund_strategy_group"><button type="button" class="seg-btn ${(!previous||!previous.strategy||previous.strategy==='proportional')?'active':''}" data-value="proportional">Proporcional</button><button type="button" class="seg-btn ${(previous&&previous.strategy)==='next'?'active':''}" data-value="next">Próximas parcelas</button><button type="button" class="seg-btn ${(previous&&previous.strategy)==='manual'?'active':''}" data-value="manual">Manual</button></div><input type="hidden" id="tm_refund_strategy" value="${esc(previous&&previous.strategy||'proportional')}"></div><div class="refund-preview-card" id="tm_refund_purchase_preview"></div><div id="tm_refund_manual_wrap" class="hidden"></div></div>
      <div id="tm_refund_store_panel" class="refund-mode-panel hidden"><div class="field"><label>Loja do crédito ou vale</label><input type="text" id="tm_refund_store_name" value="${esc(previous&&previous.storeName||'')}" placeholder="Ex: Shein"></div><div class="field"><label>Validade do crédito (opcional)</label><input type="date" id="tm_refund_store_expiry" value="${esc(previous&&previous.expirationDate||'')}"></div><div class="field"><label>Código ou referência (opcional)</label><input type="text" id="tm_refund_store_code" value="${esc(previous&&previous.creditCode||'')}"></div><div class="info-box">O valor ficará registrado como crédito disponível da loja. Não movimenta conta e não reduz a fatura imediatamente.</div></div>
      <label class="refund-check" id="tm_refund_reduce_wrap"><input type="checkbox" id="tm_refund_reduce" ${!previous||previous.reducesExpenses!==false?'checked':''}><span>Reduzir o total de despesas nos relatórios</span></label>`;
    originField.insertAdjacentElement('afterend',section);

    const nameLabel=document.querySelector('label[for="tm_nome"]')||document.getElementById('tm_nome')?.closest('.field')?.querySelector('label');
    if(nameLabel)nameLabel.textContent='Estabelecimento / origem do reembolso';
    const originalSave=document.getElementById('tm_save').onclick,saveButton=document.getElementById('tm_save'),deleteButton=document.getElementById('tm_delete');

    function wireSegment(group,input,onChange){
      if(!group||!input)return;
      group.querySelectorAll('.seg-btn:not([disabled])').forEach(button=>button.addEventListener('click',()=>{group.querySelectorAll('.seg-btn').forEach(item=>item.classList.remove('active'));button.classList.add('active');input.value=button.dataset.value;if(onChange)onChange(input.value);}));
    }
    function originalDestinationPanels(show){
      if(destinationField)destinationField.classList.toggle('hidden',!show);
      ['carteira','conta','reserva','dividir'].forEach(key=>{const panel=document.getElementById('tm_receita_'+key+'_fields');if(panel&&(!show||document.getElementById('tm_receita_destino').value!==key))panel.classList.add('hidden');});
      if(show){const value=document.getElementById('tm_receita_destino').value;const panel=document.getElementById('tm_receita_'+value+'_fields');if(panel)panel.classList.remove('hidden');}
    }
    function refreshInvoice(){
      const cardId=document.getElementById('tm_refund_invoice_card').value,select=document.getElementById('tm_refund_invoice_competence');
      const currentValue=select.value;
      const preferred=currentValue||(previous&&previous.mode===MODE_INVOICE?previous.competence:selectedCompetence());select.innerHTML=monthOptionsHTML(cardId,preferred);
      if([...select.options].some(option=>option.value===preferred&&!option.disabled))select.value=preferred;
      const competence=select.value||preferred,info=invoiceInfo(cardId,competence);
      document.getElementById('tm_refund_invoice_preview').innerHTML=`<span>Fatura aberta</span><b>${brl(info.total)}</b><small>Compras líquidas ${brl(info.gross)} · créditos diretos já lançados ${brl(info.directCredit)}</small>`;
    }
    function refreshPurchase(){
      const cardId=document.getElementById('tm_refund_purchase_card').value,purchaseSelect=document.getElementById('tm_refund_purchase_id');
      const keep=purchaseSelect.value||selectedPurchaseId;purchaseSelect.innerHTML=purchaseOptionsHTML(cardId,keep);if([...purchaseSelect.options].some(option=>option.value===keep))purchaseSelect.value=keep;
      const card=cardById(cardId),purchase=purchaseById(card,purchaseSelect.value),preview=document.getElementById('tm_refund_purchase_preview');
      if(!purchase){preview.innerHTML='<span>Nenhuma compra selecionada</span>';document.getElementById('tm_refund_manual_wrap').innerHTML='';return;}
      preview.innerHTML=`<span>${esc(purchase.descricao||'Compra')}</span><b>${brl(purchaseNetTotal(cardId,purchase))} disponível</b><small>Compra original ${brl(purchaseGrossTotal(purchase))} · já reembolsado ${brl(purchaseRefundTotal(cardId,purchase.id))}</small>`;
      refreshManual();
    }
    function refreshManual(){
      const wrap=document.getElementById('tm_refund_manual_wrap'),strategy=document.getElementById('tm_refund_strategy').value;
      wrap.classList.toggle('hidden',strategy!=='manual');if(strategy!=='manual')return;
      const amount=fromCents(parseInt(document.getElementById('tm_valor').dataset.cents||'0',10));
      wrap.innerHTML=manualAllocationHTML(document.getElementById('tm_refund_purchase_card').value,document.getElementById('tm_refund_purchase_id').value,amount,previous);
      wrap.querySelectorAll('.refund-manual-input').forEach(input=>{const initial=fromCents(Math.max(0,Math.round(Number(previous&&previous.allocations&&previous.allocations[input.dataset.competence])||0)));attachMoneyMask(input,initial);});
    }
    function syncMode(){
      const isRefund=originInput.value==='reembolso',mode=document.getElementById('tm_refund_mode').value;
      section.classList.toggle('hidden',!isRefund);
      if(!isRefund){originalDestinationPanels(true);return;}
      originalDestinationPanels(mode===MODE_ACCOUNT);
      document.getElementById('tm_refund_invoice_panel').classList.toggle('hidden',mode!==MODE_INVOICE);
      document.getElementById('tm_refund_purchase_panel').classList.toggle('hidden',mode!==MODE_PURCHASE);
      document.getElementById('tm_refund_store_panel').classList.toggle('hidden',mode!==MODE_STORE);
      document.getElementById('tm_refund_reduce_wrap').classList.toggle('hidden',mode===MODE_PURCHASE);
      if(mode===MODE_INVOICE)refreshInvoice();if(mode===MODE_PURCHASE)refreshPurchase();
    }

    wireSegment(document.getElementById('tm_refund_mode_group'),document.getElementById('tm_refund_mode'),syncMode);
    wireSegment(document.getElementById('tm_refund_strategy_group'),document.getElementById('tm_refund_strategy'),refreshManual);
    originGroup.querySelectorAll('.seg-btn').forEach(button=>button.addEventListener('click',()=>queueMicrotask(syncMode)));
    destinationGroup&&destinationGroup.querySelectorAll('.seg-btn').forEach(button=>button.addEventListener('click',()=>queueMicrotask(()=>originalDestinationPanels(document.getElementById('tm_refund_mode').value===MODE_ACCOUNT&&originInput.value==='reembolso'))));
    document.getElementById('tm_refund_invoice_card').addEventListener('change',refreshInvoice);
    document.getElementById('tm_refund_invoice_competence').addEventListener('change',refreshInvoice);
    document.getElementById('tm_refund_purchase_card').addEventListener('change',refreshPurchase);
    document.getElementById('tm_refund_purchase_id').addEventListener('change',refreshPurchase);
    document.getElementById('tm_valor').addEventListener('input',()=>{if(document.getElementById('tm_refund_strategy').value==='manual')refreshManual();});

    saveButton.onclick=()=>{
      if(originInput.value!=='reembolso'){
        if(previous){alert('Este lançamento possui um reembolso vinculado. Exclua o reembolso antes de transformá-lo em outra origem.');return;}
        originalSave();return;
      }
      const mode=document.getElementById('tm_refund_mode').value;
      const amount=fromCents(parseInt(document.getElementById('tm_valor').dataset.cents||'0',10));
      const common={
        mode,amount,date:document.getElementById('tm_data').value||todayISO(),name:document.getElementById('tm_nome').value.trim()||'Reembolso',
        establishment:document.getElementById('tm_nome').value.trim()||'Reembolso',description:document.getElementById('tm_refund_description').value.trim(),
        category:document.getElementById('tm_categoria').value,expenseCategory:document.getElementById('tm_refund_expense_category').value,
        reducesExpenses:document.getElementById('tm_refund_reduce').checked
      };
      if(amount<=0){alert('Digite um valor maior que zero.');return;}
      if(mode===MODE_ACCOUNT){
        const allowed=mutationAllowed(previous);if(!allowed.ok){alert(allowed.error);return;}
        const beforeIds=new Set((S.data.transacoes||[]).map(tx=>tx.id));
        originalSave();
        if(saveButton.isConnected)return;
        const tx=existing||findCreatedRefundTransaction(beforeIds);
        const result=upsertAccountRecord(tx,previous,common);
        if(!result.ok){alert(result.error);return;}
        saveCurrentData();renderView();toast(previous?'Reembolso atualizado.':'Reembolso recebido e vinculado ao destino.');return;
      }
      if(mode===MODE_INVOICE)Object.assign(common,{cardId:document.getElementById('tm_refund_invoice_card').value,competence:document.getElementById('tm_refund_invoice_competence').value});
      if(mode===MODE_PURCHASE)Object.assign(common,{cardId:document.getElementById('tm_refund_purchase_card').value,purchaseId:document.getElementById('tm_refund_purchase_id').value,strategy:document.getElementById('tm_refund_strategy').value,manualAllocations:readManualAllocations(document.getElementById('tm_refund_manual_wrap'))});
      if(mode===MODE_STORE)Object.assign(common,{storeName:document.getElementById('tm_refund_store_name').value.trim()||common.establishment,expirationDate:document.getElementById('tm_refund_store_expiry').value,creditCode:document.getElementById('tm_refund_store_code').value.trim()});
      const result=upsertStructured(existing,previous,common);
      if(!result.ok){alert(result.error);return;}
      saveCurrentData();closeModal();renderView();toast(previous?'Reembolso atualizado e valores recalculados.':'Reembolso registrado sem aumentar a renda.');
    };

    if(deleteButton&&previous){
      deleteButton.onclick=()=>openConfirmModal({title:'Excluir reembolso?',text:'O vínculo será removido e faturas, parcelas, despesas e saldos serão recalculados. A compra original continuará preservada.',confirmLabel:'Excluir reembolso',variant:'danger',onConfirm(){const result=removeRecord(previous);if(!result.ok){alert(result.error);return;}saveCurrentData();closeModal();renderView();toast('Reembolso excluído e valores recalculados.');}});
    }
    syncMode();
  }

  function installTransactionModalHook(){
    if(window.__borionRefundTransactionModalHook)return;window.__borionRefundTransactionModalHook=true;
    const original=window.openTransactionModal;if(typeof original!=='function')return;
    window.openTransactionModal=function(options){const result=original.apply(this,arguments);if(options&&options.type==='receita')enhanceRevenueModal(options.existing||null);return result;};
  }

  function installCardEditGuards(){
    if(window.__borionRefundCardGuards||!window.Cards)return;window.__borionRefundCardGuards=true;
    const originalEditPurchase=Cards.editParcela;
    if(typeof originalEditPurchase==='function')Cards.editParcela=function(cardId,purchaseId){
      const card=cardById(cardId),purchase=purchaseById(card,purchaseId),refunded=purchaseRefundTotal(cardId,purchaseId);
      const result=originalEditPurchase.apply(this,arguments);
      if(refunded<=0)return result;
      const save=document.getElementById('mf_save'),del=document.getElementById('mf_delete');
      if(save){const originalSave=save.onclick;save.onclick=()=>{
        const value=fromCents(parseInt(document.getElementById('mf_valorParcela').dataset.cents||'0',10));
        const count=Math.max(1,Math.round(Number(document.getElementById('mf_parcelaTotal').value)||1));
        const date=document.getElementById('mf_dataCompra').value||'';
        const originalDate=purchase.dataCompraCompleta||(purchase.dataCompra+'-'+pad2(purchase.diaEntrada||1));
        if(roundMoney(value)!==roundMoney(purchase.valorParcela)||count!==Number(purchase.parcelaTotal)||String(date).slice(0,7)!==String(originalDate).slice(0,7)){
          alert('Esta compra possui '+brlText(refunded)+' em reembolsos vinculados. Exclua os reembolsos antes de alterar valor, parcelas ou mês da compra.');return;
        }
        originalSave();
      };}
      if(del){del.onclick=()=>alert('Esta compra possui '+brlText(refunded)+' em reembolsos vinculados. Exclua os reembolsos antes de apagar a compra.');}
      return result;
    };
    const originalEditCard=Cards.editCartao;
    if(typeof originalEditCard==='function')Cards.editCartao=function(cardId){
      const result=originalEditCard.apply(this,arguments),count=recordsForCard(cardId).length,del=document.getElementById('mf_delete');
      if(count>0&&del)del.onclick=()=>alert('Este cartão possui '+count+' reembolso(s) ou estorno(s) vinculados. Exclua esses registros antes de apagar o cartão.');
      return result;
    };
  }

  function openEdit(recordId){
    const record=recordById(recordId);if(!record){toast('Reembolso não encontrado.');return;}
    const tx=transactionByRecord(record);if(!tx){toast('O lançamento vinculado a este reembolso não foi encontrado.');return;}
    if(typeof openTransactionModal==='function')openTransactionModal({type:'receita',existing:tx});
  }

  function normalizeExistingRecords(){
    ensure().forEach(record=>{
      if(!record.id)record.id=safeId();
      if(!MODES.has(record.mode))record.mode=MODE_ACCOUNT;
      record.amount=roundMoney(record.amount!=null?record.amount:record.value);
      if(!record.date)record.date=todayISO();
      if(record.reducesExpenses==null)record.reducesExpenses=true;
      if(!record.allocations||typeof record.allocations!=='object'||Array.isArray(record.allocations))record.allocations={};
      const tx=transactionByRecord(record);if(tx){tx.refundId=record.id;tx.refundMode=record.mode;tx.noIncome=true;}
    });
  }

  window.Refunds={
    MODE_ACCOUNT,MODE_INVOICE,MODE_PURCHASE,MODE_STORE,ensure,recordById,recordByTransactionId,cardById,purchaseById,
    purchaseGrossTotal,purchaseNetTotal,purchaseRefundTotal,purchaseRefundStatus,installmentCredit,installmentNetValue,netInstallmentValues,
    purchaseInstallments,buildPurchaseAllocations,directInvoiceCredit,purchaseCreditForCompetence,invoiceGrossTotal,invoiceInfo,
    expenseAdjustment,expenseRefundItems,expenseRefundBreakdown,expenseRefundMiniHTML,storeCreditsTotal,storeCreditAvailable,destinationLabel,invoiceRowsHTML,purchaseBadgeHTML,storeCreditsSummaryHTML,
    syncPurchaseExpenses,upsertStructured,upsertAccountRecord,removeRecord,openEdit,mutationAllowed,enhanceCardsView
  };

  normalizeExistingRecords();
  installCalculationHooks();
  installRenderHooks();
  installTransactionModalHook();
  installCardEditGuards();
})();
