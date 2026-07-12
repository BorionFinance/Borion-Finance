/* Borion Finance — Agenda financeira e notificações. */

function agendaAddMonthsSameDay(iso, add){
  const parts = String(iso||todayISO()).slice(0,10).split('-').map(Number);
  let y=parts[0], m=(parts[1]||1)-1, d=parts[2]||1;
  const target = new Date(y, m + Number(add||0), 1);
  const last = new Date(target.getFullYear(), target.getMonth()+1, 0).getDate();
  return target.getFullYear()+'-'+pad2(target.getMonth()+1)+'-'+pad2(Math.min(d,last));
}
/* Quantos meses futuros já existem numa série, a partir do item informado (0 se o item
   não pertence a nenhuma série). Usado para pré-preencher o campo "Quantidade de meses
   para replicar" ao editar, e para saber quanto ainda falta gerar. */
function agendaFutureCount(item){
  if(!item || !item.serieId) return 0;
  let mx = item.serieIndex||0;
  S.data.agenda.forEach(x=>{ if(x.serieId===item.serieId) mx = Math.max(mx, x.serieIndex||0); });
  return Math.max(0, mx - (item.serieIndex||0));
}
/* Garante que `item` tenha pelo menos `novoQtd` meses replicados à frente. Só adiciona —
   nunca remove lembretes já existentes (reduzir o número não apaga nada; use "Excluir este
   e os próximos" para isso). Funciona tanto para criar uma série nova quanto para completar
   uma série existente (ex: esqueceu de marcar quantos meses replicar e voltou pra editar). */
function agendaApplyReplication(item, novoQtd){
  novoQtd = Math.max(0, Math.min(60, Math.round(Number(novoQtd)||0)));
  if(novoQtd<=0) return;
  if(!item.serieId){ item.serieId = uid(); item.serieIndex = 0; }
  const already = agendaFutureCount(item);
  if(novoQtd<=already) return;
  for(let i=already+1;i<=novoQtd;i++){
    S.data.agenda.push({id:uid(), serieId:item.serieId, serieIndex:(item.serieIndex||0)+i, data:agendaAddMonthsSameDay(item.data, i), titulo:item.titulo, pago:false});
  }
}
function agendaDeleteItems(mode, item){
  const snapshot = JSON.parse(JSON.stringify(S.data));
  if(mode==='future' && item.serieId){
    S.data.agenda = S.data.agenda.filter(x=> !(x.serieId===item.serieId && String(x.data||'')>=String(item.data||'')) );
    S.data.notificacoes = (S.data.notificacoes||[]).filter(n=>S.data.agenda.some(a=>a.id===n.lembreteId));
    saveCurrentData(); closeModal(); renderView(); Notifs.refresh();
    showUndoToast('Esse e os próximos lembretes foram excluídos.', ()=>{ S.data=snapshot; saveCurrentData(); renderView(); });
    return;
  }
  S.data.agenda = S.data.agenda.filter(x=>x.id!==item.id);
  S.data.notificacoes = (S.data.notificacoes||[]).filter(n=>n.lembreteId!==item.id);
  saveCurrentData(); closeModal(); renderView(); Notifs.refresh();
  showUndoToast('Lembrete excluído.', ()=>{ S.data=snapshot; saveCurrentData(); renderView(); });
}
/* ---------------- VIEW: AGENDA FINANCEIRA ---------------- */
/* Estado de visualização da Agenda: mês próprio do calendário (independente do filtro de mês
   global do topo) e estado de minimizar/expandir dos blocos. Vive só em memória (S), não é
   persistido no localStorage — reinicia a cada carregamento, como já ocorre com S.patrView. */
function ensureAgendaViewState(){
  if(!S.agendaView) S.agendaView = {y:S.month.y, m:S.month.m, calCollapsed:false, upcomingCollapsed:false};
}
function renderAgenda(){
  ensureAgendaViewState();
  const y = S.agendaView.y, m = S.agendaView.m;
  const firstWeekday = new Date(y,m,1).getDay();
  const daysInMonth = new Date(y,m+1,0).getDate();
  const mKey = monthKey(y,m);
  const itemsByDay = {};
  S.data.agenda.filter(a=>bankMatches(a.banco,a.accountId)).forEach(a=>{
    if(a.data && a.data.startsWith(mKey)){
      const day = Number(a.data.slice(8,10));
      (itemsByDay[day] = itemsByDay[day]||[]).push(a);
    }
  });

  let cells = '';
  for(let i=0;i<firstWeekday;i++) cells += `<div class="cal-cell empty"></div>`;
  for(let d=1; d<=daysInMonth; d++){
    const items = itemsByDay[d]||[];
    const dateStr = mKey+'-'+pad2(d);
    const isToday = dateStr===todayISO();
    cells += `<div class="cal-cell ${isToday?'today':''} ${items.length?'has-items':''}" onclick="Agenda.add('${dateStr}')">
      <div class="cal-daynum">${d}</div>
      ${items.slice(0,3).map(it=>`<div class="cal-item ${it.pago?'paid':''}" onclick="event.stopPropagation();Agenda.edit('${it.id}')">${esc(it.titulo)}</div>`).join('')}
      ${items.length>3?`<div class="cal-more">+${items.length-3}</div>`:''}
    </div>`;
  }
  const weekdays = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  const upcoming = S.data.agenda.filter(a=>!a.pago && bankMatches(a.banco,a.accountId)).sort((a,b)=>a.data<b.data?-1:1).slice(0,10);
  const upcomingRows = upcoming.map(a=>{
    const diff = dateDiffDays(a.data, todayISO());
    const urgent = diff<=0;
    let tag;
    if(diff<0) tag = `<span style="color:${iconColor('despesas')};font-weight:700;">atrasado ${Math.abs(diff)}d</span>`;
    else if(diff===0) tag = `<span style="color:${iconColor('despesas')};font-weight:700;">vence hoje</span>`;
    else tag = `em ${diff} dia${diff>1?'s':''}`;
    return `<div class="list-row agenda-upcoming-row ${urgent?'urgent':''}"><span class="lname"><input type="checkbox" class="agenda-check" onclick="event.stopPropagation();Agenda.togglePago('${a.id}')" title="Marcar como paga (isso também marca a notificação como lida)" style="margin-right:8px;"/> ◷ ${a.data.slice(8,10)}/${a.data.slice(5,7)} — ${esc(a.titulo)}</span><span class="lval" style="font-weight:500;font-size:11.5px;color:var(--muted);">${tag}</span><button class="ledit" onclick="Agenda.edit('${a.id}')">✎</button></div>`;
  }).join('');

  const calCollapsed = S.agendaView.calCollapsed;
  const upcomingCollapsed = S.agendaView.upcomingCollapsed;

  return `
    <div class="agenda-layout">
      <div class="panel-box">
        <div class="agenda-panel-head">
          <div class="aph-left">
            <button class="collapse-toggle-btn" onclick="Agenda.toggleCalCollapse()" title="${calCollapsed?'Expandir':'Minimizar'}" style="color:var(--gold-bright);">${calCollapsed?'▸':'▾'}</button>
            <div class="toolbar-left">Calendário</div>
          </div>
          <button class="btn-outline" onclick="Agenda.add()">+ Lembrete</button>
        </div>
        ${calCollapsed ? '' : `
        <div class="agenda-month-nav">
          <button onclick="Agenda.prevMonth()" title="Mês anterior">‹</button>
          <div class="agenda-month-label">${monthLabel(y,m)}</div>
          <button onclick="Agenda.nextMonth()" title="Próximo mês">›</button>
        </div>
        <div class="cal-weekdays">${weekdays.map(w=>`<div>${w}</div>`).join('')}</div>
        <div class="cal-grid">${cells}</div>`}
      </div>
      <div class="panel-box">
        <div class="agenda-panel-head">
          <div class="aph-left">
            <button class="collapse-toggle-btn" onclick="Agenda.toggleUpcomingCollapse()" title="${upcomingCollapsed?'Expandir':'Minimizar'}" style="color:var(--gold-bright);">${upcomingCollapsed?'▸':'▾'}</button>
            <div class="panel-title" style="margin:0;">Próximos vencimentos</div>
          </div>
        </div>
        ${upcomingCollapsed ? '' : (upcomingRows || '<div class="empty-note">Nenhum lembrete pendente.</div>')}
      </div>
    </div>
  `;
}
const Agenda = {
  prevMonth(){ ensureAgendaViewState(); let {y,m}=S.agendaView; m--; if(m<0){m=11;y--;} S.agendaView.y=y; S.agendaView.m=m; renderView(); },
  nextMonth(){ ensureAgendaViewState(); let {y,m}=S.agendaView; m++; if(m>11){m=0;y++;} S.agendaView.y=y; S.agendaView.m=m; renderView(); },
  toggleCalCollapse(){ ensureAgendaViewState(); S.agendaView.calCollapsed = !S.agendaView.calCollapsed; renderView(); },
  toggleUpcomingCollapse(){ ensureAgendaViewState(); S.agendaView.upcomingCollapsed = !S.agendaView.upcomingCollapsed; renderView(); },
  add(dateStr){
    ensureAgendaViewState();
    openModal({title:'Novo lembrete', sub:'Ex: contas, assinaturas, parcelas com vencimento. Para replicar o mesmo lembrete nos próximos meses, informe quantos meses abaixo (0 = não replicar).', fields:[
      {key:'titulo', label:'Título', type:'text'},
      {key:'data', label:'Data', type:'date', default: dateStr || (monthKey(S.agendaView.y,S.agendaView.m)+'-01')},
      {key:'mesesReplicar', label:'Quantidade de meses para replicar', type:'number', step:'1', default:0},
    ], onSave(v){
      const qtd = Math.max(0, Math.min(60, Math.round(Number(v.mesesReplicar)||0)));
      const first = {id:uid(), serieId:'', serieIndex:0, data:v.data, titulo:v.titulo||'Sem título', pago:false};
      S.data.agenda.push(first);
      if(qtd>0) agendaApplyReplication(first, qtd);
      saveCurrentData(); closeModal(); renderView(); Notifs.refresh();
      toast(qtd>0 ? `Lembrete criado e replicado por ${qtd} mês(es).` : 'Lembrete criado.');
    }});
  },
  edit(id){
    const a = S.data.agenda.find(x=>x.id===id);
    if(!a) return;
    const futureInfo = a.serieId ? '<button class="btn btn-danger btn-block" id="ag_del_future" type="button">Excluir este e os próximos</button>' : '';
    openModal({title:'Editar lembrete', sub: a.serieId ? 'Este lembrete faz parte de uma série. Alterar o título atualiza o título em todos os lembretes da série.' : undefined, fields:[
      {key:'titulo', label:'Título', type:'text'},
      {key:'data', label:'Data', type:'date'},
      {key:'mesesReplicar', label:'Quantidade de meses para replicar', type:'number', step:'1', default: agendaFutureCount(a)},
      {key:'pago', label:'Já paga / concluída', type:'checkbox'},
    ], values:a,
    extraHTML:`<div class="agenda-delete-options"><div class="modal-sub" style="margin:4px 0 8px;">Excluir lembrete</div><div class="row-btns"><button class="btn btn-danger btn-block" id="ag_del_one" type="button">Excluir apenas este</button></div>${futureInfo}</div>`,
    onSave(v){
      const wasPago = a.pago;
      const tituloMudou = v.titulo!==a.titulo;
      Object.assign(a,{titulo:v.titulo, data:v.data, pago:!!v.pago});
      if(tituloMudou && a.serieId){
        S.data.agenda.forEach(x=>{ if(x.serieId===a.serieId) x.titulo = a.titulo; });
      }
      agendaApplyReplication(a, v.mesesReplicar);
      if(a.pago && !wasPago){
        S.data.notificacoes.forEach(n=>{ if(n.lembreteId===a.id) n.lida=true; });
      }
      saveCurrentData(); closeModal(); renderView();
      Notifs.refresh();
    }});
    setTimeout(()=>{
      const one = document.getElementById('ag_del_one');
      const fut = document.getElementById('ag_del_future');
      if(one) one.onclick = ()=> agendaDeleteItems('one', a);
      if(fut) fut.onclick = ()=> agendaDeleteItems('future', a);
    },0);
  },
  togglePago(id){
    const a = S.data.agenda.find(x=>x.id===id);
    if(!a) return;
    a.pago = !a.pago;
    if(a.pago){ S.data.notificacoes.forEach(n=>{ if(n.lembreteId===a.id) n.lida=true; }); }
    saveCurrentData(); renderView();
  }
};

/* ---------------- Notificações ---------------- */
function notifMessage(n){
  const item = S.data.agenda.find(a=>a.id===n.lembreteId);
  if(!item) return {icon:'◌', text:'Lembrete removido.'};
  const dataFmt = item.data.slice(8,10)+'/'+item.data.slice(5,7);
  if(n.tipo==='2dias') return {icon:'◷', text:`"${item.titulo}" vence em 2 dias (${dataFmt}).`};
  if(n.tipo==='1dia') return {icon:'⏰', text:`"${item.titulo}" vence amanhã (${dataFmt}).`};
  if(n.tipo==='vencimento') return {icon:'🔴', text:`"${item.titulo}" vence hoje (${dataFmt}).`};
  if(n.tipo==='atraso') return {icon:'⚠️', text:`"${item.titulo}" está em atraso desde ${dataFmt}.`};
  return {icon:'◌', text:item.titulo};
}
const Notifs = {
  panelOpen:false,
  refresh(){
    const today = todayISO();
    const newOnes = [];
    S.data.agenda.forEach(item=>{
      if(item.pago) return;
      const diff = dateDiffDays(item.data, today);
      let tipo=null;
      if(diff===2) tipo='2dias';
      else if(diff===1) tipo='1dia';
      else if(diff===0) tipo='vencimento';
      else if(diff<=-1) tipo='atraso';
      if(!tipo) return;
      const exists = S.data.notificacoes.find(n=>n.lembreteId===item.id && n.tipo===tipo);
      if(!exists){
        const n = {id:uid(), lembreteId:item.id, tipo, lida:false, criadaEm:Date.now()};
        S.data.notificacoes.push(n);
        newOnes.push(n);
      }
    });
    if(newOnes.length) saveCurrentData();
    return newOnes;
  },
  unreadForPopup(){
    const list = (S.data.notificacoes||[]).filter(n=>!n.lida && S.data.agenda.some(a=>a.id===n.lembreteId && !a.pago));
    const priority = {atraso:0, vencimento:1, '1dia':2, '2dias':3};
    return list.sort((a,b)=>{
      const pa = priority[a.tipo] ?? 9;
      const pb = priority[b.tipo] ?? 9;
      if(pa!==pb) return pa-pb;
      return (b.criadaEm||0)-(a.criadaEm||0);
    });
  },
  showFloating(list){
    list = (list||[]).filter(Boolean);
    if(!list.length) return;
    if(S.config && S.config.popupNotifs && S.config.popupNotifs.enabled===false) return;
    let wrap = document.getElementById('floating-notifs');
    if(!wrap){ wrap = document.createElement('div'); wrap.id='floating-notifs'; wrap.className='floating-notifs'; document.body.appendChild(wrap); }
    wrap.innerHTML = '';
    list.forEach(n=>{
      const msg = notifMessage(n);
      const el2 = document.createElement('div');
      el2.className = 'floating-notif';
      el2.innerHTML = `<button class="fn-close" title="Fechar">&times;</button><div>${msg.icon} ${esc(msg.text)}</div>`;
      wrap.appendChild(el2);
      const remove = ()=>{ el2.style.transition='opacity .25s ease, transform .25s ease'; el2.style.opacity='0'; el2.style.transform='translateY(8px)'; setTimeout(()=>el2.remove(),250); };
      el2.querySelector('.fn-close').onclick = remove;
      const dur = Math.max(30000, Math.min(50000, Number((S.config.popupNotifs||{}).durationMs)||40000));
      setTimeout(remove, dur);
    });
  },
  togglePanel(evt){
    if(evt) evt.stopPropagation();
    this.panelOpen = !this.panelOpen;
    this.renderPanel();
  },
  renderPanel(){
    let panel = document.getElementById('notif-panel');
    if(!this.panelOpen){ if(panel) panel.remove(); return; }
    if(!panel){ panel = document.createElement('div'); panel.id='notif-panel'; panel.className='notif-panel'; document.body.appendChild(panel); }
    const list = S.data.notificacoes.slice().sort((a,b)=>b.criadaEm-a.criadaEm);
    panel.innerHTML = list.length ? list.map(n=>{
      const msg = notifMessage(n);
      return `<div class="notif-item ${n.lida?'':'unread'}">
        <span class="ni-icon">${msg.icon}</span>
        <span class="ni-text">${esc(msg.text)}</span>
        <span class="ni-actions">
          <button onclick="Notifs.toggleRead('${n.id}')">${n.lida?'Marcar não lida':'Marcar lida'}</button>
          <button onclick="Notifs.remove('${n.id}')">Excluir</button>
        </span>
      </div>`;
    }).join('') : '<div class="notif-empty">Nenhuma notificação por aqui.</div>';
    panel.onclick = (e)=> e.stopPropagation();
  },
  toggleRead(id){
    const n = S.data.notificacoes.find(x=>x.id===id);
    if(n){ n.lida = !n.lida; saveCurrentData(); this.renderPanel(); renderView(); }
  },
  remove(id){
    S.data.notificacoes = S.data.notificacoes.filter(x=>x.id!==id);
    saveCurrentData(); this.renderPanel(); renderView();
  },
  closePanelOnOutsideClick(){
    document.addEventListener('click', ()=>{ if(Notifs.panelOpen){ Notifs.panelOpen=false; Notifs.renderPanel(); } });
  }
};
