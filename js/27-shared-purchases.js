/* Borion Finance — V6.46.37 — Compras compartilhadas, valores a receber e reembolsos. */
(function(){
  'use strict';

  const CENT=100;
  const roundMoney=value=>Math.round((Number(value)||0)*CENT)/CENT;
  const cents=value=>Math.round((Number(value)||0)*CENT);
  const fromCents=value=>Math.round(Number(value)||0)/CENT;
  const clone=value=>{try{return JSON.parse(JSON.stringify(value));}catch(e){return value;}};
  const safeId=()=>typeof uid==='function'?uid():('sp_'+Date.now().toString(36)+Math.random().toString(36).slice(2));
  const money=value=>typeof brl==='function'?brl(Number(value)||0):Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const setMaskedMoney=(input,value)=>{if(!input)return;const c=cents(value);input.dataset.cents=String(c);input.value=(c/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});input.dispatchEvent(new Event('input',{bubbles:true}));};
  const escape=value=>typeof esc==='function'?esc(value):String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function findPurchase(cartaoId,parcelaId){
    const card=(S.data.cartoes||[]).find(c=>c&&c.id===cartaoId)||(S.data.cartoes||[]).find(c=>(c.parcelas||[]).some(p=>p&&p.id===parcelaId));
    const parcel=card&&(card.parcelas||[]).find(p=>p&&p.id===parcelaId);
    return {card,parcel};
  }

  function paymentTransaction(receipt){
    if(!receipt||!receipt.transacaoId)return null;
    return (S.data.transacoes||[]).find(t=>t&&t.id===receipt.transacaoId&&t.tipo==='receita')||null;
  }

  function normalizeReceipt(raw){
    if(!raw||typeof raw!=='object')return null;
    return {
      id:raw.id||safeId(),
      transacaoId:raw.transacaoId||null,
      valor:roundMoney(raw.valor),
      data:raw.data||'',
      accountId:raw.accountId||null,
      banco:raw.banco||'',
      createdAt:Number(raw.createdAt)||Date.now()
    };
  }

  function normalizePerson(raw,index){
    if(!raw||typeof raw!=='object')return null;
    const recebimentos=(Array.isArray(raw.recebimentos)?raw.recebimentos:[]).map(normalizeReceipt).filter(Boolean);
    return {
      id:raw.id||safeId(),
      pessoa:String(raw.pessoa||raw.nome||('Pessoa '+(index+1))).trim(),
      valorTotal:roundMoney(raw.valorTotal!=null?raw.valorTotal:raw.valor),
      recebimentos
    };
  }

  function normalizeModel(parcelOrModel){
    const raw=parcelOrModel&&parcelOrModel.compartilhamento?parcelOrModel.compartilhamento:parcelOrModel;
    if(!raw||raw.ativo===false)return null;
    const pessoas=(Array.isArray(raw.pessoas)?raw.pessoas:[]).map(normalizePerson).filter(Boolean);
    const model={
      id:raw.id||safeId(),
      versao:1,
      ativo:true,
      valorTotalCompra:roundMoney(raw.valorTotalCompra),
      valorProprioTotal:roundMoney(raw.valorProprioTotal),
      formaRecebimento:raw.formaRecebimento==='total'?'total':'parcelas',
      pessoas,
      createdAt:Number(raw.createdAt)||Date.now(),
      updatedAt:Number(raw.updatedAt)||Date.now()
    };
    if(model.valorTotalCompra<=0){
      model.valorTotalCompra=roundMoney(model.valorProprioTotal+pessoas.reduce((sum,p)=>sum+p.valorTotal,0));
    }
    return model;
  }

  function syncReceipts(model){
    const normalized=normalizeModel(model);
    if(!normalized)return null;
    normalized.pessoas.forEach(person=>{
      person.recebimentos=(person.recebimentos||[]).map(receipt=>{
        const tx=paymentTransaction(receipt);
        if(!tx)return null;
        return Object.assign({},receipt,{
          valor:roundMoney(tx.valor),
          data:tx.data||receipt.data||'',
          accountId:tx.accountId||receipt.accountId||null,
          banco:tx.banco||receipt.banco||''
        });
      }).filter(Boolean);
    });
    return normalized;
  }

  function isShared(parcel){return !!normalizeModel(parcel);}
  function personReceived(person){
    return roundMoney((person&&person.recebimentos||[]).reduce((sum,r)=>{
      const tx=paymentTransaction(r);
      return sum+(tx?Number(tx.valor)||0:0);
    },0));
  }
  function personPending(person){return Math.max(0,roundMoney((Number(person&&person.valorTotal)||0)-personReceived(person)));}
  function totalReceived(model){
    const m=normalizeModel(model);return m?roundMoney(m.pessoas.reduce((sum,p)=>sum+personReceived(p),0)):0;
  }
  function totalPending(model){
    const m=normalizeModel(model);return m?roundMoney(m.pessoas.reduce((sum,p)=>sum+personPending(p),0)):0;
  }
  function totalThirdParty(model){
    const m=normalizeModel(model);return m?roundMoney(m.pessoas.reduce((sum,p)=>sum+(Number(p.valorTotal)||0),0)):0;
  }

  function splitExact(total,count){
    const quantity=Math.max(1,Math.round(Number(count)||1));
    const allCents=Math.max(0,cents(total));
    const base=Math.floor(allCents/quantity),remainder=allCents-(base*quantity);
    return Array.from({length:quantity},(_,index)=>fromCents(base+(index<remainder?1:0)));
  }
  function ownInstallments(parcel){
    const model=normalizeModel(parcel),count=Math.max(1,Math.round(Number(parcel&&parcel.parcelaTotal)||1));
    if(!model)return Array.from({length:count},()=>roundMoney(parcel&&parcel.valorParcela));
    return splitExact(model.valorProprioTotal,count);
  }
  function thirdPartyInstallments(parcel,person){
    const count=Math.max(1,Math.round(Number(parcel&&parcel.parcelaTotal)||1));
    return splitExact(person&&person.valorTotal,count);
  }
  function currentOwnValue(parcel,index){return ownInstallments(parcel)[Math.max(0,Number(index)||0)]||0;}

  function formHTML(prefix,existing){
    const model=normalizeModel(existing);
    return `<section class="shared-purchase-builder" id="${prefix}_shared_builder">
      <div class="shared-purchase-toggle-row">
        <div>
          <strong>Compra compartilhada</strong>
          <span>Divida a compra sem alterar o valor integral da fatura.</span>
        </div>
        <label class="shared-switch" title="Ativar compra compartilhada">
          <input type="checkbox" id="${prefix}_shared_enabled" ${model?'checked':''}>
          <span></span>
        </label>
      </div>
      <div class="shared-purchase-details ${model?'':'hidden'}" id="${prefix}_shared_details">
        <div class="shared-info-box"><b>A fatura continua com o valor total.</b> Em Despesas entra somente a sua parte. O restante vira valor a receber e cada recebimento é registrado como reembolso, sem contar como renda.</div>
        <div class="field"><label>Como as outras pessoas pagarão?</label>
          <div class="segmented-toggle shared-mode-toggle" id="${prefix}_shared_mode_group">
            <button type="button" class="seg-btn ${(model?model.formaRecebimento:'parcelas')==='parcelas'?'active':''}" data-value="parcelas">Conforme as parcelas</button>
            <button type="button" class="seg-btn ${(model?model.formaRecebimento:'parcelas')==='total'?'active':''}" data-value="total">Valor total de uma vez</button>
          </div>
          <input type="hidden" id="${prefix}_shared_mode" value="${model?model.formaRecebimento:'parcelas'}">
        </div>
        <div class="field"><label>Minha parte na compra (R$)</label><input type="text" inputmode="numeric" class="money-input" id="${prefix}_shared_own" placeholder="0,00"></div>
        <div class="shared-people-head"><strong>Partes das outras pessoas</strong><button type="button" class="btn-outline btn-sm" id="${prefix}_shared_add">+ Pessoa</button></div>
        <div class="shared-people-list" id="${prefix}_shared_people"></div>
        <div class="shared-builder-actions"><button type="button" class="link-btn" id="${prefix}_shared_equal">Dividir igualmente</button></div>
        <div class="shared-sum-card" id="${prefix}_shared_summary"></div>
      </div>
    </section>`;
  }

  function bindForm({prefix,existing,totalResolver,installmentsResolver}){
    const enabled=document.getElementById(prefix+'_shared_enabled');
    if(!enabled)return;
    const details=document.getElementById(prefix+'_shared_details');
    const people=document.getElementById(prefix+'_shared_people');
    const own=document.getElementById(prefix+'_shared_own');
    const add=document.getElementById(prefix+'_shared_add');
    const equal=document.getElementById(prefix+'_shared_equal');
    const group=document.getElementById(prefix+'_shared_mode_group');
    const mode=document.getElementById(prefix+'_shared_mode');
    const summary=document.getElementById(prefix+'_shared_summary');
    const model=normalizeModel(existing);
    const initialOwn=model?model.valorProprioTotal:roundMoney(typeof totalResolver==='function'?totalResolver():0);
    if(typeof attachMoneyMask==='function')attachMoneyMask(own,initialOwn);

    const rowData=new Map();
    function total(){return roundMoney(typeof totalResolver==='function'?totalResolver():0);}
    function installments(){return Math.max(1,Math.round(typeof installmentsResolver==='function'?installmentsResolver():1)||1);}
    function rowReceived(person){return person?personReceived(person):0;}
    function addRow(person){
      const seed=person?normalizePerson(person,people.children.length):{id:safeId(),pessoa:'',valorTotal:0,recebimentos:[]};
      rowData.set(seed.id,seed);
      const row=document.createElement('div');
      row.className='shared-person-row';row.dataset.personId=seed.id;
      const received=rowReceived(seed);
      row.innerHTML=`<div class="field shared-person-name"><label>Pessoa</label><input type="text" class="shared-person-name-input" value="${escape(seed.pessoa)}" placeholder="Ex: Mãe, Pai, Luiz..."></div>
        <div class="field shared-person-value"><label>Parte dela (R$)</label><input type="text" inputmode="numeric" class="money-input shared-person-value-input" placeholder="0,00"></div>
        <button type="button" class="shared-person-remove" title="Remover pessoa" ${received>0?'disabled':''}>×</button>
        ${received>0?`<small class="shared-person-received-lock">Já recebido: ${money(received)}. Esta pessoa não pode ser removida.</small>`:''}`;
      people.appendChild(row);
      const valueInput=row.querySelector('.shared-person-value-input');
      if(typeof attachMoneyMask==='function')attachMoneyMask(valueInput,seed.valorTotal);
      row.querySelector('.shared-person-name-input').addEventListener('input',updateSummary);
      valueInput.addEventListener('input',updateSummary);
      row.querySelector('.shared-person-remove').onclick=()=>{if(received>0)return;rowData.delete(seed.id);row.remove();updateSummary();};
      updateSummary();
    }
    function values(){
      return Array.from(people.querySelectorAll('.shared-person-row')).map(row=>({
        id:row.dataset.personId,
        pessoa:(row.querySelector('.shared-person-name-input').value||'').trim(),
        valorTotal:fromCents(parseInt(row.querySelector('.shared-person-value-input').dataset.cents||'0',10)),
        previous:rowData.get(row.dataset.personId)||null
      }));
    }
    function updateSummary(){
      if(!summary)return;
      const totalValue=total(),ownValue=fromCents(parseInt(own.dataset.cents||'0',10));
      const others=values().reduce((sum,p)=>sum+p.valorTotal,0);
      const allocated=roundMoney(ownValue+others),difference=roundMoney(totalValue-allocated);
      const cls=Math.abs(cents(difference))<=1?'ok':'bad';
      const perMonth=splitExact(ownValue,installments())[0]||0;
      summary.className='shared-sum-card '+cls;
      summary.innerHTML=`<div><span>Total da compra</span><b>${money(totalValue)}</b></div><div><span>Minha despesa</span><b>${money(ownValue)}</b></div><div><span>A receber</span><b>${money(others)}</b></div><div><span>Diferença</span><b>${money(difference)}</b></div><p>${cls==='ok'?'Divisão fechada.':difference>0?'Ainda falta distribuir uma parte do valor.':'A soma ultrapassou o valor da compra.'} Minha parte aproximada por parcela: <b>${money(perMonth)}</b>.</p>`;
    }
    enabled.onchange=()=>{
      details.classList.toggle('hidden',!enabled.checked);
      if(enabled.checked&&!people.children.length)addRow(null);
      if(enabled.checked&&fromCents(parseInt(own.dataset.cents||'0',10))===0){
        setMaskedMoney(own,total());
      }
      updateSummary();
    };
    group.querySelectorAll('.seg-btn').forEach(button=>button.onclick=()=>{
      group.querySelectorAll('.seg-btn').forEach(b=>b.classList.remove('active'));
      button.classList.add('active');mode.value=button.dataset.value;
    });
    add.onclick=()=>addRow(null);
    equal.onclick=()=>{
      const rows=Array.from(people.querySelectorAll('.shared-person-row'));
      if(!rows.length){addRow(null);return;}
      const parts=splitExact(total(),rows.length+1);
      setMaskedMoney(own,parts[0]||0);
      rows.forEach((row,index)=>setMaskedMoney(row.querySelector('.shared-person-value-input'),parts[index+1]||0));
      updateSummary();
    };
    own.addEventListener('input',updateSummary);
    if(model&&model.pessoas.length)model.pessoas.forEach(addRow);
    else if(model)addRow(null);
    const externalInputs=[
      document.getElementById(prefix==='mf'?'mf_valorParcela':prefix+'_valor'),
      document.getElementById(prefix==='mf'?'mf_parcelaTotal':prefix+'_parcelas'),
      document.getElementById(prefix+'_credito_tipo')
    ].filter(Boolean);
    externalInputs.forEach(node=>{
      node.addEventListener('input',updateSummary);
      node.addEventListener('change',updateSummary);
    });
    updateSummary();
    enabled.dispatchEvent(new Event('shared-ready'));
  }

  function readForm({prefix,totalValue,installmentCount,existing}){
    const enabled=document.getElementById(prefix+'_shared_enabled');
    const modelBefore=normalizeModel(existing);
    if(!enabled||!enabled.checked){
      if(modelBefore&&totalReceived(modelBefore)>0)return {ok:false,error:'Não é possível desativar a divisão porque já existem reembolsos registrados. Mantenha a compra compartilhada ou desfaça os recebimentos primeiro.'};
      return {ok:true,model:null};
    }
    const total=roundMoney(totalValue),ownInput=document.getElementById(prefix+'_shared_own');
    const own=fromCents(parseInt(ownInput&&ownInput.dataset.cents||'0',10));
    const rows=Array.from(document.querySelectorAll('#'+prefix+'_shared_people .shared-person-row'));
    if(total<=0)return {ok:false,error:'Informe o valor da compra antes de dividir.'};
    if(own<0)return {ok:false,error:'A sua parte não pode ser negativa.'};
    if(!rows.length)return {ok:false,error:'Adicione pelo menos uma pessoa à compra compartilhada.'};
    const previousById=new Map((modelBefore&&modelBefore.pessoas||[]).map(p=>[p.id,p]));
    const pessoas=[];const names=new Set();
    for(const row of rows){
      const id=row.dataset.personId||safeId(),name=(row.querySelector('.shared-person-name-input').value||'').trim();
      const value=fromCents(parseInt(row.querySelector('.shared-person-value-input').dataset.cents||'0',10));
      if(!name)return {ok:false,error:'Informe o nome de todas as pessoas da divisão.'};
      const key=name.toLocaleLowerCase('pt-BR');if(names.has(key))return {ok:false,error:'Há nomes repetidos na divisão. Use uma pessoa por linha.'};names.add(key);
      if(value<=0)return {ok:false,error:'A parte de '+name+' precisa ser maior que zero.'};
      const previous=previousById.get(id)||null,received=previous?personReceived(previous):0;
      if(cents(value)<cents(received))return {ok:false,error:'A parte de '+name+' não pode ficar menor que o valor já recebido ('+money(received)+').'};
      pessoas.push({id,pessoa:name,valorTotal:roundMoney(value),recebimentos:previous?clone(previous.recebimentos||[]):[]});
      previousById.delete(id);
    }
    for(const previous of previousById.values()){
      if(personReceived(previous)>0)return {ok:false,error:'Não é possível remover '+previous.pessoa+' porque já existem reembolsos registrados para essa pessoa.'};
    }
    const allocated=roundMoney(own+pessoas.reduce((sum,p)=>sum+p.valorTotal,0));
    if(Math.abs(cents(allocated)-cents(total))>1)return {ok:false,error:'A sua parte e as partes das outras pessoas precisam somar exatamente '+money(total)+'.'};
    const mode=document.getElementById(prefix+'_shared_mode');
    return {ok:true,model:{
      id:modelBefore&&modelBefore.id||safeId(),versao:1,ativo:true,valorTotalCompra:total,valorProprioTotal:roundMoney(own),
      formaRecebimento:mode&&mode.value==='total'?'total':'parcelas',pessoas,
      createdAt:modelBefore&&modelBefore.createdAt||Date.now(),updatedAt:Date.now(),parcelaTotal:Math.max(1,Math.round(Number(installmentCount)||1))
    }};
  }

  function badgeHTML(parcel){
    const model=syncReceipts(parcel);if(!model)return '';
    const pending=totalPending(model),received=totalReceived(model);
    return `<span class="cat-pill shared-purchase-pill"><span class="dot"></span>Compartilhada · minha parte ${money(model.valorProprioTotal)} · ${pending>0?'a receber '+money(pending):'reembolsada'}</span>${received>0?`<span class="cat-pill shared-received-pill">Recebido ${money(received)}</span>`:''}`;
  }

  function transactionMeta(tx){
    if(!tx||!tx.compartilhamentoId)return null;
    return ['Compra compartilhada','Fatura '+money(tx.valorFaturaParcela||0),'Minha parte '+money(tx.valor||0)];
  }

  function summaryHTML(){
    let total=0,received=0,count=0;
    (S.data.cartoes||[]).filter(card=>typeof bankMatches!=='function'||bankMatches(card.banco)).forEach(card=>(card.parcelas||[]).forEach(parcel=>{
      const model=syncReceipts(parcel);if(!model)return;count++;total+=totalPending(model);received+=totalReceived(model);
    }));
    total=roundMoney(total);received=roundMoney(received);
    if(!count)return '';
    return `<div class="shared-receivable-summary"><div><span>Compras compartilhadas</span><b>${count}</b></div><div><span>A receber</span><b>${money(total)}</b></div><div><span>Já reembolsado</span><b>${money(received)}</b></div><p>Esses valores não alteram o total das faturas. Reembolsos recebidos entram na conta escolhida sem contar como renda.</p></div>`;
  }

  function suggestedReceipt(parcel,person){
    const pending=personPending(person),model=normalizeModel(parcel);
    if(!model||model.formaRecebimento==='total')return pending;
    const installments=thirdPartyInstallments(parcel,person);
    const received=personReceived(person);
    let accumulated=0;
    for(const value of installments){
      accumulated=roundMoney(accumulated+value);
      if(cents(received)<cents(accumulated))return Math.min(pending,roundMoney(accumulated-received));
    }
    return pending;
  }

  function registerReceipt(cartaoId,parcelaId,personId){
    const {card,parcel}=findPurchase(cartaoId,parcelaId),model=syncReceipts(parcel);
    if(!card||!parcel||!model){toast('A compra compartilhada não foi encontrada.');return;}
    const person=model.pessoas.find(p=>p.id===personId);if(!person)return;
    const pending=personPending(person);if(pending<=0){toast('A parte de '+person.pessoa+' já foi recebida por completo.');return;}
    const options=typeof accountSelectOptions==='function'?accountSelectOptions({}):[];
    if(!options.length){toast('Cadastre uma conta ou mantenha a Carteira ativa para registrar o reembolso.');return;}
    openModal({title:'Registrar reembolso',sub:person.pessoa+' deve '+money(pending)+' desta compra. O valor recebido entrará na conta escolhida e não contará como renda.',fields:[
      {key:'valor',label:'Valor recebido (R$)',type:'money',default:suggestedReceipt(parcel,person)},
      {key:'data',label:'Data do recebimento',type:'date',default:todayISO()},
      {key:'accountId',label:'Onde o dinheiro entrou',type:'select',options}
    ],saveLabel:'Registrar recebimento',onSave(values){
      const value=roundMoney(values.valor),currentPending=personPending(person);
      if(value<=0){alert('Informe um valor recebido maior que zero.');return;}
      if(cents(value)>cents(currentPending)){alert('O valor recebido não pode ultrapassar o pendente de '+money(currentPending)+'.');return;}
      const accountId=typeof requireAccountId==='function'?requireAccountId(values.accountId,'Escolha uma conta válida para receber o reembolso.'):values.accountId;
      if(!accountId)return;
      const bank=typeof accountNameSnapshot==='function'?accountNameSnapshot(accountId):'';
      let tx;
      const ok=typeof runAtomicFinancialMutation==='function'?runAtomicFinancialMutation(()=>{
        tx={id:safeId(),tipo:'receita',nome:'Reembolso — '+person.pessoa+' — '+(parcel.descricao||'Compra compartilhada'),data:values.data||todayISO(),categoria:parcel.categoria||'Outro',valor:value,accountId,banco:bank,origem:'reembolso',compartilhamentoId:model.id,compartilhamentoParcelaId:parcel.id,compartilhamentoPessoaId:person.id,createdAt:Date.now()};
        S.data.transacoes.push(tx);
        if(typeof applyTxSaldoEffect==='function'&&!applyTxSaldoEffect(tx))throw new Error('conta_invalida');
        person.recebimentos.push({id:safeId(),transacaoId:tx.id,valor:value,data:tx.data,accountId,banco:bank,createdAt:Date.now()});
        parcel.compartilhamento=model;
      },()=>alert('Não foi possível registrar o reembolso. Nenhum saldo foi alterado.')):(()=>{return false;})();
      if(!ok)return;
      saveCurrentData();closeModal();renderView();toast(value===currentPending?'Reembolso de '+person.pessoa+' recebido por completo.':'Reembolso parcial de '+person.pessoa+' registrado.');
    }});
  }

  function undoReceipt(cartaoId,parcelaId,personId,receiptId){
    const {parcel}=findPurchase(cartaoId,parcelaId),model=syncReceipts(parcel);if(!parcel||!model)return;
    const person=model.pessoas.find(p=>p.id===personId),receipt=person&&(person.recebimentos||[]).find(r=>r.id===receiptId);if(!person||!receipt)return;
    const tx=paymentTransaction(receipt);
    openConfirmModal({title:'Desfazer reembolso?',text:'O recebimento de '+money(tx?tx.valor:receipt.valor)+' de '+person.pessoa+' será removido e o valor voltará a sair da conta onde entrou.',confirmLabel:'Desfazer recebimento',variant:'danger',onConfirm(){
      const ok=runAtomicFinancialMutation(()=>{
        if(tx&&typeof reverseTxSaldoEffect==='function')reverseTxSaldoEffect(tx);
        if(tx)S.data.transacoes=S.data.transacoes.filter(t=>t.id!==tx.id);
        person.recebimentos=(person.recebimentos||[]).filter(r=>r.id!==receiptId);
        parcel.compartilhamento=model;
      },()=>alert('Não foi possível desfazer o recebimento.'));
      if(!ok)return;saveCurrentData();renderView();toast('Recebimento desfeito.');
    }});
  }

  function manageHTML(card,parcel,model){
    const received=totalReceived(model),pending=totalPending(model),third=totalThirdParty(model);
    const rows=model.pessoas.map(person=>{
      const got=personReceived(person),left=personPending(person),status=left<=0?'Recebido':got>0?'Parcial':'Pendente';
      const history=(person.recebimentos||[]).slice().sort((a,b)=>String(b.data||'').localeCompare(String(a.data||''))).map(receipt=>{
        const tx=paymentTransaction(receipt);if(!tx)return '';
        return `<div class="shared-receipt-history-row"><span>${escape(tx.data?tx.data.slice(8,10)+'/'+tx.data.slice(5,7)+'/'+tx.data.slice(0,4):'—')} · ${escape(tx.banco||'Conta')}</span><b>${money(tx.valor)}</b><button type="button" onclick="SharedPurchases.undoReceipt('${card.id}','${parcel.id}','${person.id}','${receipt.id}')" title="Desfazer este recebimento">↺</button></div>`;
      }).join('');
      return `<article class="shared-person-manage-card">
        <div class="shared-person-manage-head"><div><strong>${escape(person.pessoa)}</strong><span>Parte: ${money(person.valorTotal)}</span></div><span class="cheque-status ${left<=0?'ok':got>0?'warn':'neutral'}">${status}</span></div>
        <div class="shared-person-progress"><span style="width:${person.valorTotal>0?Math.min(100,Math.round(got/person.valorTotal*100)):0}%"></span></div>
        <div class="shared-person-money-grid"><div><small>Recebido</small><b>${money(got)}</b></div><div><small>Pendente</small><b>${money(left)}</b></div></div>
        ${left>0?`<button type="button" class="btn btn-primary btn-block" onclick="SharedPurchases.registerReceipt('${card.id}','${parcel.id}','${person.id}')">Registrar reembolso</button>`:'<div class="shared-complete-note">Parte totalmente reembolsada.</div>'}
        ${history?`<details class="shared-history"><summary>Histórico de recebimentos (${person.recebimentos.length})</summary>${history}</details>`:''}
      </article>`;
    }).join('');
    return `<div class="shared-manage-summary"><div><span>Compra total</span><b>${money(model.valorTotalCompra)}</b></div><div><span>Minha despesa</span><b>${money(model.valorProprioTotal)}</b></div><div><span>Parte de terceiros</span><b>${money(third)}</b></div><div><span>A receber</span><b>${money(pending)}</b></div><div><span>Recebido</span><b>${money(received)}</b></div></div>
      <div class="shared-manage-explanation">A fatura continua mostrando o valor integral. Nos relatórios de Despesas entra somente ${money(model.valorProprioTotal)}. Cada recebimento abaixo vira “Reembolso recebido” e não aumenta a Receita do mês.</div>
      <div class="shared-manage-people">${rows}</div>`;
  }

  function openManage(cartaoId,parcelaId){
    const {card,parcel}=findPurchase(cartaoId,parcelaId),model=syncReceipts(parcel);
    if(!card||!parcel||!model){toast('A compra compartilhada não foi encontrada.');return;}
    parcel.compartilhamento=model;
    const box=el(`<div class="modal-overlay shared-manage-overlay"><div class="modal-box shared-manage-modal">
      <div class="modal-head"><div><h2>Compra compartilhada</h2><p>${escape(parcel.descricao||'Compra no cartão')} · ${escape(card.banco||'Cartão')}</p></div><button id="spm_close">&times;</button></div>
      ${manageHTML(card,parcel,model)}
      <div class="row-btns shared-manage-footer"><button type="button" class="btn btn-secondary btn-block" id="spm_edit">Editar divisão</button><button type="button" class="btn btn-primary btn-block" id="spm_done">Concluir</button></div>
    </div></div>`);
    $('#modal-root').innerHTML='';$('#modal-root').appendChild(box);attachModalGuard(box);
    $('#spm_close').onclick=closeModal;$('#spm_done').onclick=closeModal;$('#spm_edit').onclick=()=>{closeModal();Cards.editParcela(card.id,parcel.id);};
  }

  function canDelete(parcel){
    const model=syncReceipts(parcel);if(!model)return {ok:true,pending:0,received:0};
    const pending=totalPending(model),received=totalReceived(model);
    /* Uma compra com divisão ativa nunca pode desaparecer deixando cobranças ou
       reembolsos órfãos. Para excluir, o usuário precisa desfazer os recebimentos,
       desativar a divisão na edição e somente depois apagar a compra. */
    return {ok:pending<=0&&received<=0,pending,received};
  }

  window.SharedPurchases={
    normalizeModel,syncReceipts,isShared,splitExact,ownInstallments,currentOwnValue,totalReceived,totalPending,totalThirdParty,
    formHTML,bindForm,readForm,badgeHTML,transactionMeta,summaryHTML,openManage,registerReceipt,undoReceipt,canDelete,findPurchase
  };
})();
