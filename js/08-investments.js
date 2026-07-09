/* Borion Finance — Tela Investimentos, ativos, caixa, rendimento e mercado BR/EUA. */

/* ---------------- VIEW: INVESTMENTS ---------------- */
function renderInvestments(){
  const atual = investAtualTotal(), investido = investInvestidoTotal();
  const rend = atual - investido;
  const rendPct = investido>0 ? (rend/investido*100) : 0;
  const ativos = S.data.investimentos.ativos.filter(a => (a.mercado||'BR')===S.invMercado);
  const rowsAtivos = ativos.map(a=>{
    const r = a.atual - a.investido, rp = a.investido>0? (r/a.investido*100):0;
    return `<tr>
      <td><div style="font-weight:700">${esc(a.nome)}</div><div style="font-size:11px;color:var(--muted)">${esc(a.local||'')}</div></td>
      <td>${brl(a.investido)}</td>
      <td style="font-weight:700">${brl(a.atual)}</td>
      <td class="${r>=0?'val-pos':''}">${r>=0?'+':''}${brl(r)}<br><span style="font-size:10.5px;color:var(--muted)">${r>=0?'+':''}${pct(rp)}</span></td>
      <td class="tbl-actions"><button onclick="Invest.editAtivo('${a.id}')">✎</button></td>
    </tr>`;
  }).join('');
  const rowsCaixa = S.data.investimentos.emCaixa.map(c=>`
    <div class="list-row">
      <span class="lname">${esc(c.nome)}</span>
      <span class="lval">${brl(c.valor)}</span>
      <button class="ledit" onclick="Invest.editCaixa('${c.id}')">✎</button>
    </div>`).join('');

  return `
    <div class="cards-row">
      <div class="card hero-green"><div class="clabel">Valor atual</div><div class="cval">${brl(atual)}</div></div>
      <div class="card"><div class="clabel">Total investido</div><div class="cval">${brl(investido)}</div></div>
      <div class="card"><div class="clabel">Rendimento</div><div class="cval ${rend>=0?'val-pos':''}" style="font-size:22px;">${rend>=0?'+':''}${brl(rend)}</div><div style="color:${rend>=0?'#22c55e':'#ef4444'};font-size:12px;font-weight:700;margin-top:2px;">${rend>=0?'+':''}${pct(rendPct)}</div></div>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:10px;">
      <div class="tabs">
        <button class="tab-btn ${S.invMercado==='BR'?'active':''}" onclick="Invest.setMercado('BR')">BR</button>
        <button class="tab-btn ${S.invMercado==='US'?'active':''}" onclick="Invest.setMercado('US')">US</button>
      </div>
    </div>
    <div class="grid2">
      <div class="panel-box">
        <div class="toolbar"><div class="toolbar-left">Em caixa</div><button class="btn-outline" onclick="Invest.addCaixa()">+ Adicionar</button></div>
        ${rowsCaixa || '<div class="empty-note">Nenhum item ainda.</div>'}
      </div>
      <div class="panel-box">
        <div class="toolbar"><div class="toolbar-left">Ativos</div><button class="btn-outline" onclick="Invest.addAtivo()">+ Adicionar</button></div>
        ${ativos.length ? `<table><thead><tr><th>Ativo</th><th>Investido</th><th>Atual</th><th>Rend.</th><th></th></tr></thead><tbody>${rowsAtivos}</tbody></table>` : '<div class="empty-note">Nenhum ativo neste mercado.</div>'}
      </div>
    </div>
  `;
}
const Invest = {
  setMercado(m){ S.invMercado=m; renderView(); },
  addCaixa(){
    openModal({title:'Adicionar em caixa', fields:[{key:'nome',label:'Nome',type:'text'},{key:'valor',label:'Valor (R$)',type:'money'},bankSelectField()],
      onSave(v){ S.data.investimentos.emCaixa.push({id:uid(),nome:v.nome,valor:Number(v.valor)||0,banco:v.banco==='— Nenhum —'?'':v.banco}); saveCurrentData(); closeModal(); renderView(); }});
  },
  editCaixa(id){
    const c = S.data.investimentos.emCaixa.find(x=>x.id===id);
    openModal({title:'Editar item', fields:[{key:'nome',label:'Nome',type:'text'},{key:'valor',label:'Valor (R$)',type:'money'},bankSelectField(c.banco)], values:c,
      onDelete(){ S.data.investimentos.emCaixa = S.data.investimentos.emCaixa.filter(x=>x.id!==id); saveCurrentData(); closeModal(); renderView(); },
      onSave(v){ Object.assign(c,{nome:v.nome,valor:Number(v.valor)||0,banco:v.banco==='— Nenhum —'?'':v.banco}); saveCurrentData(); closeModal(); renderView(); }});
  },
  addAtivo(){
    openModal({title:'Adicionar ativo', fields:[
      {key:'nome',label:'Nome do ativo',type:'text'},
      {key:'local',label:'Onde está investido (ex: corretora)',type:'text'},
      {key:'mercado',label:'Mercado',type:'select',options:['BR','US'],default:S.invMercado},
      {key:'investido',label:'Valor investido (R$)',type:'money'},
      {key:'atual',label:'Valor atual (R$)',type:'money'},
      bankSelectField(),
    ], onSave(v){
      S.data.investimentos.ativos.push({id:uid(),nome:v.nome,local:v.local,mercado:v.mercado,investido:Number(v.investido)||0,atual:Number(v.atual)||0,banco:v.banco==='— Nenhum —'?'':v.banco});
      saveCurrentData(); closeModal(); renderView();
    }});
  },
  editAtivo(id){
    const a = S.data.investimentos.ativos.find(x=>x.id===id);
    openModal({title:'Editar ativo', fields:[
      {key:'nome',label:'Nome do ativo',type:'text'},
      {key:'local',label:'Onde está investido',type:'text'},
      {key:'mercado',label:'Mercado',type:'select',options:['BR','US']},
      {key:'investido',label:'Valor investido (R$)',type:'money'},
      {key:'atual',label:'Valor atual (R$)',type:'money'},
      bankSelectField(a.banco),
    ], values:a,
    onDelete(){ S.data.investimentos.ativos = S.data.investimentos.ativos.filter(x=>x.id!==id); saveCurrentData(); closeModal(); renderView(); },
    onSave(v){ Object.assign(a,{nome:v.nome,local:v.local,mercado:v.mercado,investido:Number(v.investido)||0,atual:Number(v.atual)||0,banco:v.banco==='— Nenhum —'?'':v.banco}); saveCurrentData(); closeModal(); renderView(); }});
  }
};
