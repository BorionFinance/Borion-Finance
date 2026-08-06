/* Borion Finance 7.7.6 — Moedas estrangeiras dentro de Patrimônio.
   Cada posição mantém a quantidade na moeda original e a cotação em reais.
   Compra e venda podem movimentar uma Conta/Carteira em BRL, mas nunca criam
   Receita ou Despesa: são apenas conversões entre ativos do patrimônio. */

const BORION_FOREIGN_CURRENCIES = [
  {code:'USD',name:'Dólar americano',symbol:'US$',flag:'🇺🇸'},
  {code:'EUR',name:'Euro',symbol:'€',flag:'🇪🇺'},
  {code:'GBP',name:'Libra esterlina',symbol:'£',flag:'🇬🇧'},
  {code:'CHF',name:'Franco suíço',symbol:'CHF',flag:'🇨🇭'},
  {code:'CAD',name:'Dólar canadense',symbol:'C$',flag:'🇨🇦'},
  {code:'AUD',name:'Dólar australiano',symbol:'A$',flag:'🇦🇺'},
  {code:'JPY',name:'Iene japonês',symbol:'¥',flag:'🇯🇵'},
  {code:'CNY',name:'Yuan chinês',symbol:'¥',flag:'🇨🇳'},
  {code:'ARS',name:'Peso argentino',symbol:'AR$',flag:'🇦🇷'},
  {code:'CLP',name:'Peso chileno',symbol:'CLP$',flag:'🇨🇱'},
  {code:'UYU',name:'Peso uruguaio',symbol:'$U',flag:'🇺🇾'},
  {code:'PYG',name:'Guarani paraguaio',symbol:'₲',flag:'🇵🇾'}
];
const BORION_FX_FETCH_TIMEOUT_MS = 10000;
const BORION_FX_OVERVIEW_DAYS = 7;
const BORION_FX_AUTO_REFRESH_INTERVAL_MS = 6*60*60*1000;
const BORION_FX_AUTO_RETRY_INTERVAL_MS = 30*60*1000;

function foreignCurrencyInfo(code){
  const key=String(code||'USD').toUpperCase();
  return BORION_FOREIGN_CURRENCIES.find(c=>c.code===key)||{code:key,name:key,symbol:key,flag:'¤'};
}
function foreignCurrencyStore(){
  if(!S.data.moedasEstrangeiras||typeof S.data.moedasEstrangeiras!=='object'||Array.isArray(S.data.moedasEstrangeiras))S.data.moedasEstrangeiras={positions:[],moves:[],rateHistory:[]};
  if(!Array.isArray(S.data.moedasEstrangeiras.positions))S.data.moedasEstrangeiras.positions=[];
  if(!Array.isArray(S.data.moedasEstrangeiras.moves))S.data.moedasEstrangeiras.moves=[];
  if(!Array.isArray(S.data.moedasEstrangeiras.rateHistory))S.data.moedasEstrangeiras.rateHistory=[];
  return S.data.moedasEstrangeiras;
}
function foreignRound(value,decimals=4){
  const scale=Math.pow(10,decimals);return Math.round((Number(value)||0)*scale)/scale;
}
function foreignParseNumber(value){
  if(typeof value==='number')return Number.isFinite(value)?value:0;
  const raw=String(value==null?'':value).trim();
  if(!raw)return 0;
  const cleaned=raw.replace(/\s+/g,'').replace(/\./g,'').replace(',', '.').replace(/[^0-9.-]/g,'');
  const n=Number(cleaned);
  return Number.isFinite(n)?n:0;
}
function foreignBrlValue(position){return Math.round((Number(position&&position.amount)||0)*(Number(position&&position.currentRate)||0)*100)/100;}
function foreignCostValue(position){return Math.round((Number(position&&position.amount)||0)*(Number(position&&position.averageRate)||0)*100)/100;}
function moedasEstrangeirasTotal(){
  if(!S.data||!S.data.moedasEstrangeiras||!Array.isArray(S.data.moedasEstrangeiras.positions))return 0;
  return Math.round(S.data.moedasEstrangeiras.positions.reduce((sum,p)=>sum+foreignBrlValue(p),0)*100)/100;
}
function setForeignCurrencyCurrentRate(code,rate,updatedAt=Date.now()){
  const value=foreignRound(rate);if(value<=0)return false;
  foreignCurrencyStore().positions.filter(p=>String(p.currency)===String(code)).forEach(p=>{p.currentRate=value;p.updatedAt=updatedAt;});
  return true;
}
function foreignQuantity(value,code){
  const n=Number(value)||0;
  try{return new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:4}).format(n)+' '+String(code||'');}
  catch(_){return n.toFixed(2).replace('.',',')+' '+String(code||'');}
}
function foreignRate(value){return 'R$ '+(Number(value)||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:4});}
function foreignInputValue(value,decimals=4){
  const n=Number(value);
  if(!Number.isFinite(n)||n<=0)return '';
  return n.toLocaleString('pt-BR',{minimumFractionDigits:Math.min(2,decimals),maximumFractionDigits:decimals});
}
function foreignPositionLabel(position){
  const info=foreignCurrencyInfo(position&&position.currency);
  const place=String(position&&position.location||'').trim();
  return `${info.flag} ${info.code}${place?' · '+place:''}`;
}
function foreignCurrencySegments(){
  const grouped=new Map();
  const positions=(S.data&&S.data.moedasEstrangeiras&&S.data.moedasEstrangeiras.positions)||[];
  positions.forEach(p=>{
    const value=foreignBrlValue(p);if(value<=0)return;
    const info=foreignCurrencyInfo(p.currency),prev=grouped.get(info.code)||{label:`${info.flag} ${info.name}`,value:0,color:catColor(info.code)};
    prev.value+=value;grouped.set(info.code,prev);
  });
  return Array.from(grouped.values());
}
function foreignISODateDaysAgo(daysAgo){
  const d=new Date();
  d.setHours(0,0,0,0);
  d.setDate(d.getDate()-Number(daysAgo||0));
  return d.toISOString().slice(0,10);
}
function foreignLastDates(days=BORION_FX_OVERVIEW_DAYS){
  const out=[];
  for(let i=Math.max(0,days-1);i>=0;i--)out.push(foreignISODateDaysAgo(i));
  return out;
}
function foreignChartLabel(dateStr){
  try{
    const [y,m,d]=String(dateStr).split('-').map(Number);
    return new Date(y,m-1,d).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
  }catch(_){return String(dateStr||'');}
}
function recordForeignCurrencyRate(code,rate,{date=todayISO(),source='manual',providerDate='',fetchedAt=Date.now()}={}){
  const value=foreignRound(rate);
  if(value<=0)return false;
  const store=foreignCurrencyStore();
  const keyDate=String(date||todayISO()).slice(0,10);
  const keyCode=String(code||'USD').toUpperCase();
  const id=`${keyCode}_${keyDate}`;
  const normalizedSource=String(source||'manual');
  const normalizedProviderDate=String(providerDate||'');
  const normalizedFetchedAt=Number(fetchedAt)||Date.now();
  let changed=false;
  const existing=(store.rateHistory||[]).find(item=>String(item.id)===id);
  if(existing){
    if(Number(existing.rate)!==value){existing.rate=value;changed=true;}
    if(String(existing.source||'')!==normalizedSource){existing.source=normalizedSource;changed=true;}
    if(String(existing.providerDate||'')!==normalizedProviderDate){existing.providerDate=normalizedProviderDate;changed=true;}
    if(Number(existing.fetchedAt||0)!==normalizedFetchedAt)existing.fetchedAt=normalizedFetchedAt;
  }else{
    store.rateHistory.push({id,currency:keyCode,date:keyDate,rate:value,source:normalizedSource,providerDate:normalizedProviderDate,fetchedAt:normalizedFetchedAt});
    changed=true;
  }
  store.rateHistory=store.rateHistory.filter(item=>item&&item.currency&&item.date).sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.fetchedAt||0)-Number(b.fetchedAt||0));
  if(store.rateHistory.length>240){
    const grouped=new Map();
    store.rateHistory.forEach(item=>{
      const arr=grouped.get(item.currency)||[];arr.push(item);grouped.set(item.currency,arr);
    });
    store.rateHistory=[];
    grouped.forEach(arr=>store.rateHistory.push(...arr.slice(-60)));
  }
  return changed;
}
function foreignCurrencyHistoryEntries(code){
  const key=String(code||'USD').toUpperCase();
  return foreignCurrencyStore().rateHistory.filter(item=>String(item.currency)===key).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.fetchedAt||0)-Number(b.fetchedAt||0));
}
function foreignCurrencyLatestRate(code){
  const items=foreignCurrencyHistoryEntries(code);
  return items.length?items[items.length-1]:null;
}
function foreignTrackedCurrencyCodes(limit=4){
  const seen=new Set();
  const ordered=foreignCurrencyStore().positions.slice().sort((a,b)=>foreignBrlValue(b)-foreignBrlValue(a));
  const out=[];
  ordered.forEach(p=>{const code=String(p.currency||'').toUpperCase();if(code&&!seen.has(code)){seen.add(code);out.push(code);}});
  return out.slice(0,limit);
}
function foreignRatesOverviewData(days=BORION_FX_OVERVIEW_DAYS){
  const codes=foreignTrackedCurrencyCodes(4);
  const dates=foreignLastDates(days);
  if(!codes.length)return {labels:dates.map(foreignChartLabel),series:[],summary:[],hasAny:false};
  const labels=dates.map(foreignChartLabel);
  const series=[];
  const summary=[];
  codes.forEach(code=>{
    const info=foreignCurrencyInfo(code);
    const byDate=new Map();
    foreignCurrencyHistoryEntries(code).forEach(entry=>{byDate.set(String(entry.date),Number(entry.rate)||0);});
    const fallbackPosition=foreignCurrencyStore().positions.find(p=>String(p.currency)===code);
    let carry=0;
    const values=dates.map(date=>{
      const exact=Number(byDate.get(date))||0;
      if(exact>0){carry=exact;return exact;}
      if(carry>0)return carry;
      const older=foreignCurrencyHistoryEntries(code).filter(entry=>String(entry.date)<date&&Number(entry.rate)>0).slice(-1)[0];
      if(older){carry=Number(older.rate)||0;return carry;}
      const current=fallbackPosition&&Number(fallbackPosition.currentRate)||0;
      if(current>0){carry=current;return current;}
      return 0;
    });
    const nonZero=values.some(v=>v>0);
    if(!nonZero)return;
    const latest=values[values.length-1]||0;
    const prev=values[values.length-2]||latest;
    const delta=Math.round((latest-prev)*10000)/10000;
    series.push({name:`${info.flag} ${info.code}`,color:catColor(info.code),values});
    summary.push({code:info.code,flag:info.flag,rate:latest,delta,up:delta>=0});
  });
  return {labels,series,summary,hasAny:series.length>0};
}
function renderForeignOverviewWidget(data){
  if(!data||!data.hasAny)return '<div class="panel-box"><div class="panel-title">Evolução das moedas estrangeiras</div><div class="empty-note">Adicione uma moeda e atualize a cotação para acompanhar a variação diária aqui.</div></div>';
  const chips=data.summary.map(item=>`<span class="foreign-trend-chip ${item.up?'up':'down'}"><b>${esc(item.flag+' '+item.code)}</b><span>${esc(foreignRate(item.rate))}</span><small>${item.delta===0?'Sem variação':`${item.up?'+':''}${esc(foreignRate(item.delta).replace('R$ ',''))} vs. ontem`}</small></span>`).join('');
  return `<div class="panel-box foreign-overview-panel"><div class="panel-title">Evolução das moedas estrangeiras (últimos ${data.labels.length} dias)</div><div class="foreign-trend-head">${chips}</div>${renderLineChart({labels:data.labels,series:data.series,height:210,valueFormatter:(v)=>foreignRate(v)})}<p class="foreign-panel-note">Mostra a cotação em reais por unidade da moeda. Ex.: 1 USD = x BRL.</p></div>`;
}

function renderForeignCurrenciesPanel(){
  const store=foreignCurrencyStore();
  const positions=store.positions.slice().sort((a,b)=>foreignBrlValue(b)-foreignBrlValue(a)||String(a.location||'').localeCompare(String(b.location||''),'pt-BR'));
  const total=moedasEstrangeirasTotal();
  const grouped=new Map();
  positions.forEach(p=>{
    const info=foreignCurrencyInfo(p.currency),cur=grouped.get(info.code)||{info,amount:0,value:0};
    cur.amount+=(Number(p.amount)||0);cur.value+=foreignBrlValue(p);grouped.set(info.code,cur);
  });
  const summary=Array.from(grouped.values()).map(g=>`<span class="foreign-summary-chip"><b>${esc(g.info.flag+' '+g.info.code)}</b>${esc(foreignQuantity(g.amount,g.info.code))}</span>`).join('');
  const rows=positions.map(p=>{
    const info=foreignCurrencyInfo(p.currency),value=foreignBrlValue(p),variation=Math.round((value-foreignCostValue(p))*100)/100;
    const type=p.holdingType==='account'?'Conta internacional':'Espécie';
    const lastRate=foreignCurrencyLatestRate(p.currency);
    return `<article class="foreign-position-row">
      <div class="foreign-position-main">
        <span class="foreign-flag" aria-hidden="true">${esc(info.flag)}</span>
        <div><strong>${esc(info.name)}</strong><small>${esc(type)} · ${esc(p.location||'Local não informado')}</small></div>
      </div>
      <div class="foreign-position-amount"><strong>${esc(foreignQuantity(p.amount,info.code))}</strong><small>${esc(foreignRate(p.currentRate))} por ${esc(info.code)}${lastRate?` · ${esc(lastRate.date)}`:''}</small></div>
      <div class="foreign-position-value"><strong>${brl(value)}</strong>${Number(p.averageRate)>0?`<small class="${variation>=0?'foreign-positive':'foreign-negative'}">${variation>=0?'+':''}${brl(variation)} desde a aquisição</small>`:'<small>Sem custo médio informado</small>'}</div>
      <button class="ledit" onclick="ForeignCurrencies.editPosition('${esc(p.id)}')" title="Editar moeda">✎</button>
    </article>`;
  }).join('');
  return `<div class="panel-box foreign-currencies-panel">
    <div class="toolbar foreign-toolbar"><div class="toolbar-left foreign-title"><span>¤</span> MOEDAS ESTRANGEIRAS</div><div class="toolbar-right"><button class="btn-outline btn-sm" onclick="ForeignCurrencies.openHistory()">Histórico</button><button class="btn-outline btn-sm" onclick="ForeignCurrencies.refreshTrackedRates(true)" ${positions.length?'':'disabled'}>Atualizar cotações</button><button class="btn-outline btn-sm" onclick="ForeignCurrencies.openMovement()" ${positions.length?'':'disabled'}>Movimentar</button><button class="btn-outline" onclick="ForeignCurrencies.addPosition()">+ Adicionar moeda</button></div></div>
    <div class="foreign-total-line"><div><small>Valor convertido em reais</small><strong>${brl(total)}</strong></div><div class="foreign-summary-chips">${summary||'<span class="empty-note">Nenhuma moeda cadastrada.</span>'}</div></div>
    ${rows||'<div class="empty-note foreign-empty">Cadastre dólares, euros ou outras moedas em espécie ou mantidas em uma conta internacional. O valor entra no patrimônio, mas não conta como receita.</div>'}
    <p class="foreign-panel-note">As cotações podem ser preenchidas manualmente ou puxadas do dia, igual ao conversor da calculadora. Compra e venda continuam sendo apenas movimentações patrimoniais.</p>
  </div>`;
}

const ForeignCurrencies={
  _liveRequests:Object.create(null),
  _historyRequests:Object.create(null),
  _ensureOverviewPromise:null,
  _lastEnsureAttemptAt:0,
  currencyOptions(){return BORION_FOREIGN_CURRENCIES.map(c=>({value:c.code,label:`${c.flag} ${c.name} (${c.code})`}));},
  position(id){return foreignCurrencyStore().positions.find(p=>String(p.id)===String(id))||null;},
  async fetchLiveRate(code){
    const currency=String(code||'USD').toUpperCase();
    if(currency==='BRL')return {rate:1,date:todayISO(),source:'BORION'};
    if(this._liveRequests[currency])return this._liveRequests[currency];
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),BORION_FX_FETCH_TIMEOUT_MS);
    this._liveRequests[currency]=(async()=>{
      try{
        try{
          const response=await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(currency)}&to=BRL`,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
          if(!response.ok)throw new Error('HTTP '+response.status);
          const data=await response.json();
          const rate=Number(data&&data.rates&&data.rates.BRL);
          if(!Number.isFinite(rate)||rate<=0)throw new Error('Sem cotação BRL');
          return {rate,date:String(data.date||todayISO()),source:'Frankfurter'};
        }catch(primaryError){
          if(controller.signal.aborted)throw primaryError;
          const response=await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(currency)}`,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
          if(!response.ok)throw new Error('HTTP '+response.status);
          const data=await response.json();
          const rate=Number(data&&data.rates&&data.rates.BRL);
          if(!Number.isFinite(rate)||rate<=0)throw primaryError;
          return {rate,date:String(data.time_last_update_utc||data.time_last_update_unix||todayISO()),source:'ExchangeRate-API'};
        }
      }finally{
        clearTimeout(timer);
        delete this._liveRequests[currency];
      }
    })();
    return this._liveRequests[currency];
  },
  async fetchHistorySeries(code,days=BORION_FX_OVERVIEW_DAYS){
    const currency=String(code||'USD').toUpperCase();
    const requestKey=`${currency}_${days}`;
    if(this._historyRequests[requestKey])return this._historyRequests[requestKey];
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),BORION_FX_FETCH_TIMEOUT_MS);
    const end=foreignISODateDaysAgo(0),start=foreignISODateDaysAgo(Math.max(0,days-1));
    this._historyRequests[requestKey]=(async()=>{
      try{
        const response=await fetch(`https://api.frankfurter.app/${start}..${end}?from=${encodeURIComponent(currency)}&to=BRL`,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
        if(!response.ok)throw new Error('HTTP '+response.status);
        const data=await response.json();
        const rates=data&&data.rates&&typeof data.rates==='object'?data.rates:{};
        let count=0;
        Object.keys(rates).sort().forEach(date=>{
          const rate=Number(rates[date]&&rates[date].BRL);
          if(Number.isFinite(rate)&&rate>0&&recordForeignCurrencyRate(currency,rate,{date,source:'live',providerDate:String(data.date||date)}))count++;
        });
        return count;
      }finally{
        clearTimeout(timer);
        delete this._historyRequests[requestKey];
      }
    })();
    return this._historyRequests[requestKey];
  },
  async ensureOverviewData(force=false){
    const codes=foreignTrackedCurrencyCodes(4);
    if(!codes.length)return false;
    const now=Date.now();
    if(!force){
      if(this._ensureOverviewPromise)return this._ensureOverviewPromise;
      if(this._lastEnsureAttemptAt&&(now-this._lastEnsureAttemptAt)<BORION_FX_AUTO_RETRY_INTERVAL_MS)return false;
    }
    this._lastEnsureAttemptAt=now;
    const work=(async()=>{
      let changed=false;
      for(const code of codes){
        const history=foreignCurrencyHistoryEntries(code);
        const latest=history.length?history[history.length-1]:null;
        const latestFetchedAt=Number(latest&&latest.fetchedAt)||0;
        const stale=!latestFetchedAt||((now-latestFetchedAt)>BORION_FX_AUTO_REFRESH_INTERVAL_MS);
        const needHistory=history.length<2;
        const shouldRefresh=force||stale||needHistory;
        if(!shouldRefresh)continue;
        try{
          const changedCount=await this.fetchHistorySeries(code,BORION_FX_OVERVIEW_DAYS);
          if(changedCount>0)changed=true;
        }catch(error){console.warn('[BORION_FX_HISTORY]',code,error);}
        try{
          const live=await this.fetchLiveRate(code);
          if(live&&live.rate>0){
            const rateChanged=recordForeignCurrencyRate(code,live.rate,{date:todayISO(),source:'live',providerDate:live.date});
            const position=foreignCurrencyStore().positions.find(p=>String(p.currency)===String(code));
            const currentBefore=Number(position&&position.currentRate)||0;
            if(currentBefore!==live.rate){setForeignCurrencyCurrentRate(code,live.rate);changed=true;}
            if(rateChanged)changed=true;
          }
        }catch(error){console.warn('[BORION_FX_LIVE]',code,error);}
      }
      if(changed){saveCurrentData();renderView();}
      return changed;
    })();
    this._ensureOverviewPromise=work;
    try{return await work;}finally{this._ensureOverviewPromise=null;}
  },
  async refreshTrackedRates(force=true){
    const codes=foreignTrackedCurrencyCodes(8);
    if(!codes.length){toast('Cadastre uma moeda primeiro.');return;}
    let updated=0; let changed=false;
    for(const code of codes){
      try{
        const live=await this.fetchLiveRate(code);
        if(live&&live.rate>0){
          const position=foreignCurrencyStore().positions.find(p=>String(p.currency)===String(code));
          const currentBefore=Number(position&&position.currentRate)||0;
          const rateChanged=recordForeignCurrencyRate(code,live.rate,{date:todayISO(),source:'live',providerDate:live.date});
          if(currentBefore!==live.rate){setForeignCurrencyCurrentRate(code,live.rate);changed=true;}
          if(rateChanged)changed=true;
          updated++;
        }
        try{ if((await this.fetchHistorySeries(code,BORION_FX_OVERVIEW_DAYS))>0)changed=true; }catch(_){/* histórico é complementar */}
      }catch(error){console.warn('[BORION_FX_REFRESH]',code,error);}
    }
    if(changed){saveCurrentData();renderView();}
    if(updated){toast(updated===1?'Cotação atualizada.':`Cotações atualizadas (${updated}).`);}else toast(navigator.onLine===false?'Sem internet para atualizar a cotação.':'Não foi possível atualizar as cotações agora.');
  },
  async fillLiveRateForCurrency(currency,rateInput,statusNode,averageInput){
    if(statusNode){statusNode.className='foreign-rate-status loading';statusNode.textContent='Buscando cotação do dia…';}
    try{
      const payload=await this.fetchLiveRate(currency);
      if(!payload||!(payload.rate>0))throw new Error('Cotação inválida');
      if(rateInput)rateInput.value=foreignInputValue(payload.rate,4);
      if(averageInput&&!String(averageInput.value||'').trim())averageInput.value=foreignInputValue(payload.rate,4);
      recordForeignCurrencyRate(currency,payload.rate,{date:todayISO(),source:'live',providerDate:payload.date});
      if(statusNode){statusNode.className='foreign-rate-status ok';statusNode.textContent=`Cotação do dia aplicada · ${payload.source}`;}
      saveCurrentData();
      return payload.rate;
    }catch(error){
      console.warn('[BORION_FX_MODAL_RATE]',currency,error);
      if(statusNode){statusNode.className='foreign-rate-status error';statusNode.textContent=navigator.onLine===false?'Sem internet para buscar a cotação.' :'Não foi possível buscar a cotação agora.';}
      return 0;
    }
  },
  bindHoldingSegment(root,initial='cash'){
    const buttons=[...root.querySelectorAll('[data-holding-value]')];
    const state={value:initial==='account'?'account':'cash'};
    const sync=()=>buttons.forEach(btn=>btn.classList.toggle('active',btn.dataset.holdingValue===state.value));
    buttons.forEach(btn=>btn.onclick=()=>{state.value=btn.dataset.holdingValue==='account'?'account':'cash';sync();});
    sync();
    return {get:()=>state.value,set:(value)=>{state.value=value==='account'?'account':'cash';sync();}};
  },
  openPositionForm(mode='add',position=null){
    const isEdit=mode==='edit'&&position;
    const info=foreignCurrencyInfo(isEdit?position.currency:'USD');
    const selectOptions=this.currencyOptions().map(o=>`<option value="${esc(o.value)}" ${o.value===info.code?'selected':''}>${esc(o.label)}</option>`).join('');
    const box=el(`<div class="modal-overlay"><div class="modal-box foreign-position-modal">
      <div class="modal-head"><div><h2>${isEdit?`Editar ${esc(info.name)}`:'Adicionar moeda estrangeira'}</h2><p class="modal-sub">${isEdit?`Saldo atual: ${esc(foreignQuantity(position.amount,info.code))}. Para alterar a quantidade, use “Movimentar” e preserve o histórico.`:'Use este cadastro para informar um saldo que você já possui. Isso entra no patrimônio, sem criar receita ou despesa.'}</p></div><button id="fxp_close">&times;</button></div>
      <div class="field ${isEdit?'hidden':''}"><label>Moeda</label><select id="fxp_currency">${selectOptions}</select></div>
      ${isEdit?`<div class="foreign-static-info"><span class="foreign-flag">${esc(info.flag)}</span><div><strong>${esc(info.name)}</strong><small>${esc(info.code)}</small></div></div>`:''}
      <div class="field"><label>Onde está</label><div id="fxp_holding" class="foreign-segmented"><button type="button" data-holding-value="cash">Espécie</button><button type="button" data-holding-value="account">Conta internacional</button></div></div>
      <div class="field"><label>Local ou instituição</label><input id="fxp_location" type="text" value="${esc(isEdit?position.location:'')}" placeholder="Ex.: Cofre de casa, Nomad, Wise"></div>
      ${isEdit?'':`<div class="field"><label id="fxp_amount_label">Quantidade na moeda</label><input id="fxp_amount" class="foreign-decimal-input" type="text" inputmode="decimal" value="" placeholder="800,00"></div>`}
      <div class="field"><label>Cotação média de aquisição (R$)</label><input id="fxp_average_rate" class="foreign-decimal-input" type="text" inputmode="decimal" value="${esc(foreignInputValue(isEdit?position.averageRate:0,4))}" placeholder="5,10"></div>
      <div class="field"><label>Cotação atual usada no patrimônio (R$)</label><div class="foreign-inline-input"><input id="fxp_current_rate" class="foreign-decimal-input" type="text" inputmode="decimal" value="${esc(foreignInputValue(isEdit?position.currentRate:0,4))}" placeholder="5,30"><button type="button" class="btn-outline btn-sm" id="fxp_fetch_rate">Cotação do dia</button></div><small id="fxp_rate_status" class="foreign-rate-status">Preencha manualmente ou use a cotação automática do dia.</small></div>
      ${isEdit?'':`<div class="field"><label>Data de aquisição ou conferência</label><input id="fxp_acquired_at" type="date" value="${todayISO()}"></div>`}
      <div class="field"><label>Observação</label><input id="fxp_notes" type="text" value="${esc(isEdit?(position.notes||''):'')}" placeholder="Opcional"></div>
      <div class="row-btns" style="margin-top:10px;">${isEdit?'<button class="btn btn-primary btn-block" id="fxp_save">Salvar</button><button class="btn btn-danger btn-block" id="fxp_delete">Excluir posição</button>':'<button class="btn btn-primary btn-block" id="fxp_save">Salvar</button>'}</div>
    </div></div>`);
    $('#modal-root').innerHTML='';$('#modal-root').appendChild(box);attachModalGuard(box);
    $('#fxp_close').onclick=closeModal;
    const currencyNode=$('#fxp_currency');
    const holding=this.bindHoldingSegment($('#fxp_holding'),isEdit?(position.holdingType||'cash'):'cash');
    const locationNode=$('#fxp_location');
    const amountNode=$('#fxp_amount');
    const averageRateNode=$('#fxp_average_rate');
    const currentRateNode=$('#fxp_current_rate');
    const statusNode=$('#fxp_rate_status');
    const notesNode=$('#fxp_notes');
    const acquiredAtNode=$('#fxp_acquired_at');
    const currentCurrency=()=>String((isEdit?position.currency:currencyNode&&currencyNode.value)||'USD').toUpperCase();
    if(currencyNode){
      const updateAmountLabel=()=>{const curr=foreignCurrencyInfo(currentCurrency());const label=$('#fxp_amount_label');if(label)label.textContent=`Quantidade (${curr.code})`;};
      currencyNode.onchange=updateAmountLabel;updateAmountLabel();
    }
    $('#fxp_fetch_rate').onclick=()=>this.fillLiveRateForCurrency(currentCurrency(),currentRateNode,statusNode,averageRateNode);
    $('#fxp_save').onclick=()=>{
      const currency=currentCurrency();
      const averageRate=foreignRound(foreignParseNumber(averageRateNode&&averageRateNode.value),4);
      const currentRate=foreignRound(foreignParseNumber(currentRateNode&&currentRateNode.value),4);
      if(currentRate<=0){toast('Informe uma cotação atual maior que zero.');return;}
      if(isEdit){
        const updatedAt=Date.now();
        Object.assign(position,{holdingType:holding.get(),location:String(locationNode.value||'').trim()||'Não informado',averageRate:averageRate>0?averageRate:position.averageRate,notes:String(notesNode.value||'').trim(),updatedAt});
        setForeignCurrencyCurrentRate(position.currency,currentRate,updatedAt);
        recordForeignCurrencyRate(position.currency,currentRate,{date:todayISO(),source:'manual'});
        saveCurrentData();closeModal();renderView();toast('Moeda atualizada.');
      }else{
        const amount=foreignRound(foreignParseNumber(amountNode&&amountNode.value),4);
        if(amount<0){toast('A quantidade não pode ser negativa.');return;}
        const acquiredAt=acquiredAtNode&&acquiredAtNode.value||todayISO();
        const finalAvg=averageRate>0?averageRate:currentRate;
        const newPosition={id:uid(),currency,holdingType:holding.get(),location:String(locationNode.value||'').trim()||'Não informado',amount,averageRate:finalAvg,currentRate,acquiredAt,notes:String(notesNode.value||'').trim(),createdAt:Date.now(),updatedAt:Date.now()};
        const move={id:uid(),positionId:newPosition.id,currency:newPosition.currency,positionLabel:foreignPositionLabel(newPosition),type:'opening',date:newPosition.acquiredAt,foreignAmount:amount,rate:newPosition.averageRate,brlAmount:Math.round(amount*newPosition.averageRate*100)/100,description:'Saldo inicial cadastrado no patrimônio',createdAt:Date.now()};
        const store=foreignCurrencyStore();store.positions.push(newPosition);setForeignCurrencyCurrentRate(newPosition.currency,currentRate,newPosition.updatedAt);store.moves.push(move);recordForeignCurrencyRate(newPosition.currency,currentRate,{date:todayISO(),source:'manual'});saveCurrentData();closeModal();renderView();toast('Moeda adicionada ao patrimônio.');
      }
    };
    if(isEdit){
      $('#fxp_delete').onclick=()=>{
        const hasLater=(foreignCurrencyStore().moves||[]).some(m=>m.positionId===position.id&&m.type!=='opening');
        if(hasLater){toast('Esta posição possui movimentações. Zere o saldo por ajuste antes de excluir.');return;}
        const store=foreignCurrencyStore();store.positions=store.positions.filter(x=>x.id!==position.id);store.moves=store.moves.filter(m=>m.positionId!==position.id&&m.destinationPositionId!==position.id);saveCurrentData();closeModal();renderView();toast('Posição excluída.');
      };
    }
  },
  addPosition(){this.openPositionForm('add',null);},
  editPosition(id){const p=this.position(id);if(!p){toast('Moeda não encontrada.');return;}this.openPositionForm('edit',p);},
  accountOptions(){
    const options=typeof accountSelectOptions==='function'?accountSelectOptions({excludeCarteira:false}):[];
    return [{value:'',label:'Não alterar saldo em reais'}].concat(options);
  },
  openMovement(positionId){
    const store=foreignCurrencyStore(),positions=store.positions.slice();if(!positions.length){this.addPosition();return;}
    const initial=positions.find(p=>p.id===positionId)||positions[0];
    const posOptions=positions.map(p=>`<option value="${esc(p.id)}" ${p.id===initial.id?'selected':''}>${esc(foreignPositionLabel(p))}</option>`).join('');
    const accountOptions=this.accountOptions().map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
    const box=el(`<div class="modal-overlay"><div class="modal-box foreign-movement-modal">
      <div class="modal-head"><h2>Movimentar moeda estrangeira</h2><button id="fx_close">&times;</button></div>
      <p class="modal-sub">Compra e venda são conversões patrimoniais. Mesmo quando uma Conta em reais é ajustada, nada entra como receita ou despesa.</p>
      <div class="field"><label>Posição</label><select id="fx_position">${posOptions}</select></div>
      <div class="field"><label>Tipo de movimentação</label><select id="fx_type"><option value="purchase">Comprar moeda</option><option value="sale">Vender moeda</option><option value="income">Entrada manual</option><option value="withdrawal">Retirada manual</option><option value="transfer">Transferir entre locais</option><option value="adjust">Ajustar saldo conferido</option></select></div>
      <div id="fx_quantity_wrap" class="field"><label id="fx_quantity_label">Quantidade</label><input id="fx_quantity" class="foreign-decimal-input" type="text" inputmode="decimal" placeholder="0,00"></div>
      <div id="fx_rate_wrap" class="field"><label>Cotação da operação (R$ por unidade)</label><div class="foreign-inline-input"><input id="fx_rate" class="foreign-decimal-input" type="text" inputmode="decimal" placeholder="0,0000"><button type="button" class="btn-outline btn-sm" id="fx_fetch_rate">Cotação do dia</button></div><small id="fx_rate_status" class="foreign-rate-status">Use a cotação da operação. Você também pode puxar o valor do dia.</small><small id="fx_brl_preview" class="foreign-operation-preview">Equivalente: R$ 0,00</small></div>
      <div id="fx_account_wrap" class="field"><label id="fx_account_label">Conta de origem em reais</label><select id="fx_account">${accountOptions}</select><small class="modal-sub">Escolha “Não alterar” para apenas registrar uma operação já ocorrida.</small></div>
      <div id="fx_destination_wrap" class="field hidden"><label>Posição de destino</label><select id="fx_destination"></select></div>
      <div class="field"><label>Data</label><input id="fx_date" type="date" value="${todayISO()}"></div>
      <div class="field"><label>Descrição</label><input id="fx_description" type="text" placeholder="Opcional"></div>
      <div class="info-box" id="fx_info"></div>
      <div class="row-btns" style="margin-top:10px;"><button class="btn btn-primary btn-block" id="fx_save">Registrar movimentação</button></div>
    </div></div>`);
    $('#modal-root').innerHTML='';$('#modal-root').appendChild(box);attachModalGuard(box);$('#fx_close').onclick=closeModal;
    const positionNode=$('#fx_position'),typeNode=$('#fx_type'),qtyNode=$('#fx_quantity'),rateNode=$('#fx_rate'),accountNode=$('#fx_account'),destNode=$('#fx_destination'),rateStatusNode=$('#fx_rate_status');
    const current=()=>this.position(positionNode.value)||positions[0];
    const fillDestinations=()=>{
      const p=current(),available=positions.filter(x=>x.id!==p.id&&x.currency===p.currency);
      destNode.innerHTML=available.map(x=>`<option value="${esc(x.id)}">${esc(foreignPositionLabel(x))}</option>`).join('')||'<option value="">Crie outra posição da mesma moeda</option>';
    };
    const update=()=>{
      const p=current(),info=foreignCurrencyInfo(p.currency),type=typeNode.value,isTrade=type==='purchase'||type==='sale',isTransfer=type==='transfer',isAdjust=type==='adjust';
      $('#fx_quantity_label').textContent=isAdjust?`Novo saldo conferido (${info.code})`:`Quantidade (${info.code})`;
      $('#fx_rate_wrap').classList.toggle('hidden',!isTrade);
      $('#fx_account_wrap').classList.toggle('hidden',!isTrade);
      $('#fx_destination_wrap').classList.toggle('hidden',!isTransfer);
      $('#fx_account_label').textContent=type==='sale'?'Conta de destino em reais':'Conta de origem em reais';
      if(isTrade)rateNode.value=foreignInputValue(Number(p.currentRate)||0,4);
      fillDestinations();
      const messages={purchase:'A quantidade será adicionada. Se escolher uma Conta/Carteira, o equivalente em reais será retirado dela.',sale:'A quantidade será reduzida. Se escolher uma Conta/Carteira, o equivalente em reais será depositado nela.',income:'Adiciona moeda sem alterar saldos em reais. Use para correções positivas, presentes ou valores antigos.',withdrawal:'Retira moeda sem gerar despesa e sem alterar saldos em reais.',transfer:'Move a mesma moeda entre dois locais sem alterar o patrimônio total.',adjust:'Define o saldo físico conferido. A diferença fica registrada no histórico.'};
      $('#fx_info').textContent=messages[type]||'';this.updateMovementPreview(qtyNode.value,rateNode.value);
    };
    positionNode.onchange=update;typeNode.onchange=update;qtyNode.oninput=()=>this.updateMovementPreview(qtyNode.value,rateNode.value);rateNode.oninput=()=>this.updateMovementPreview(qtyNode.value,rateNode.value);
    $('#fx_fetch_rate').onclick=()=>this.fillLiveRateForCurrency(current().currency,rateNode,rateStatusNode,null).then(()=>this.updateMovementPreview(qtyNode.value,rateNode.value));
    $('#fx_save').onclick=()=>{
      const p=current(),type=typeNode.value,quantity=foreignRound(foreignParseNumber(qtyNode.value),4),rate=foreignRound(foreignParseNumber(rateNode.value),4),accountId=accountNode.value||null,destinationId=destNode.value||null,date=$('#fx_date').value||todayISO(),description=String($('#fx_description').value||'').trim();
      if(quantity<0||(type!=='adjust'&&quantity<=0)){toast('Informe uma quantidade maior que zero.');return;}
      if((type==='purchase'||type==='sale')&&rate<=0){toast('Informe a cotação da operação.');return;}
      if((type==='sale'||type==='withdrawal'||type==='transfer')&&quantity>(Number(p.amount)||0)+1e-9){toast('Quantidade maior que o saldo disponível.');return;}
      if(type==='transfer'&&!destinationId){toast('Escolha outra posição da mesma moeda.');return;}
      const ok=runAtomicFinancialMutation(()=>this.applyMovement({position:p,type,quantity,rate,accountId,destinationId,date,description}),()=>toast('Não foi possível registrar a movimentação.'));
      if(!ok)return;saveCurrentData();closeModal();renderView();toast('Movimentação registrada sem alterar receitas ou despesas.');
    };
    update();
  },
  updateMovementPreview(quantity,rate){const node=document.getElementById('fx_brl_preview');if(node)node.textContent='Equivalente: '+brl(Math.round(foreignParseNumber(quantity)*foreignParseNumber(rate)*100)/100);},
  applyMovement({position,type,quantity,rate,accountId,destinationId,date,description}){
    const store=foreignCurrencyStore(),before=Number(position.amount)||0,beforeAverage=Number(position.averageRate)||0;
    const move={id:uid(),positionId:position.id,currency:position.currency,positionLabel:foreignPositionLabel(position),type,date,foreignAmount:quantity,rate:rate||Number(position.currentRate)||0,brlAmount:Math.round(quantity*(rate||0)*100)/100,accountId:accountId||null,destinationPositionId:destinationId||null,description,amountBefore:before,averageRateBefore:beforeAverage,createdAt:Date.now()};
    if(type==='purchase'){
      const newAmount=foreignRound(before+quantity);position.averageRate=newAmount>0?foreignRound(((before*beforeAverage)+(quantity*rate))/newAmount):rate;position.amount=newAmount;setForeignCurrencyCurrentRate(position.currency,rate);recordForeignCurrencyRate(position.currency,rate,{date:todayISO(),source:'operation'});if(accountId&&!adjustLiquidez(accountId,-move.brlAmount))throw new Error('conta_origem_invalida');
    }else if(type==='sale'){
      position.amount=foreignRound(before-quantity);setForeignCurrencyCurrentRate(position.currency,rate);recordForeignCurrencyRate(position.currency,rate,{date:todayISO(),source:'operation'});if(accountId&&!adjustLiquidez(accountId,move.brlAmount))throw new Error('conta_destino_invalida');
    }else if(type==='income'){
      position.amount=foreignRound(before+quantity);
    }else if(type==='withdrawal'){
      position.amount=foreignRound(before-quantity);
    }else if(type==='adjust'){
      position.amount=foreignRound(quantity);move.foreignAmount=foreignRound(position.amount-before);move.amountAfter=position.amount;
    }else if(type==='transfer'){
      const destination=this.position(destinationId);if(!destination||destination.currency!==position.currency)throw new Error('destino_invalido');
      const destBefore=Number(destination.amount)||0,destAvg=Number(destination.averageRate)||0,newDest=foreignRound(destBefore+quantity);
      position.amount=foreignRound(before-quantity);destination.amount=newDest;destination.averageRate=newDest>0?foreignRound(((destBefore*destAvg)+(quantity*beforeAverage))/newDest):beforeAverage;destination.currentRate=Number(position.currentRate)||destination.currentRate;destination.updatedAt=Date.now();
      move.destinationAmountBefore=destBefore;move.destinationAverageRateBefore=destAvg;move.destinationLabel=foreignPositionLabel(destination);
    }
    position.updatedAt=Date.now();move.amountAfter=Number(position.amount)||0;move.averageRateAfter=Number(position.averageRate)||0;store.moves.push(move);
  },
  openHistory(){
    const store=foreignCurrencyStore(),moves=store.moves.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||Number(b.createdAt||0)-Number(a.createdAt||0));
    const labels={opening:'Saldo inicial',purchase:'Compra',sale:'Venda',income:'Entrada manual',withdrawal:'Retirada manual',transfer:'Transferência',adjust:'Ajuste de saldo'};
    const rows=moves.map(m=>{
      const p=this.position(m.positionId),info=foreignCurrencyInfo(p?p.currency:(m.currency||'USD')),dest=this.position(m.destinationPositionId);
      const delta=Number(m.foreignAmount)||0;
      const negative=m.type==='sale'||m.type==='withdrawal'||m.type==='transfer'||(m.type==='adjust'&&delta<0);
      const signed=negative?'-':'+';
      const quantity=m.type==='adjust'?Math.abs(delta):Math.abs(Number(m.foreignAmount)||0);
      const account=m.accountId&&typeof accountById==='function'?accountById(m.accountId,{includeArchived:true}):null;
      const sourceLabel=p?foreignPositionLabel(p):(m.positionLabel||'Posição removida');
      const destinationLabel=dest?foreignPositionLabel(dest):(m.destinationLabel||'');
      const detail=destinationLabel?'Para '+destinationLabel:(account?'Conta: '+account.nome:(m.description||'—'));
      return `<tr><td>${esc(reservaFmtDate(m.date))}</td><td><span class="foreign-history-type">${esc(labels[m.type]||m.type)}</span></td><td>${esc(sourceLabel)}</td><td class="${negative?'foreign-negative':'foreign-positive'}">${esc(signed)} ${esc(foreignQuantity(quantity,info.code))}</td><td>${m.rate?esc(foreignRate(m.rate)):'—'}</td><td>${m.brlAmount?brl(m.brlAmount):'—'}</td><td>${esc(detail)}</td></tr>`;
    }).join('');
    const box=el(`<div class="modal-overlay"><div class="modal-box foreign-history-modal"><div class="modal-head"><div><h2>Histórico de moedas estrangeiras</h2><p class="modal-sub">Somente movimentações patrimoniais; nenhuma delas entra como receita ou despesa.</p></div><button id="fxh_close">&times;</button></div>${rows?`<div class="table-scroll"><table><thead><tr><th>Data</th><th>Tipo</th><th>Posição</th><th>Quantidade</th><th>Cotação</th><th>Equivalente</th><th>Detalhe</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty-note">Nenhuma movimentação registrada.</div>'}<div class="row-btns" style="margin-top:10px;"><button class="btn btn-secondary btn-block" id="fxh_ok">Fechar</button></div></div></div>`);
    $('#modal-root').innerHTML='';$('#modal-root').appendChild(box);attachModalGuard(box);$('#fxh_close').onclick=closeModal;$('#fxh_ok').onclick=closeModal;
  }
};
window.ForeignCurrencies=ForeignCurrencies;
window.renderForeignCurrenciesPanel=renderForeignCurrenciesPanel;
window.foreignRatesOverviewData=foreignRatesOverviewData;
window.renderForeignOverviewWidget=renderForeignOverviewWidget;
