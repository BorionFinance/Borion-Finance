/* Borion Finance — Estúdio de Gráficos (V7.9.1)
   Aba própria onde o usuário monta os próprios gráficos por composição:
   FONTE × RECORTE × MÉTRICA × VISUAL × PERÍODO.

   Nada aqui usa biblioteca externa: todo desenho é SVG gerado na mão, no mesmo
   padrão do donut da Visão Geral (05-calculations-charts.js). Isso mantém o app
   sem build, sem dependência e sem peso extra no service worker.

   Persistência: os gráficos moram em S.data.chartsStudio (viaja no current.json,
   sincroniza pelo Drive junto com o resto). O layout do painel usa o escopo
   'charts_studio' do ModuleLayout — o mesmo motor livre da Visão Geral. */
(() => {
  'use strict';

  const CS_SCOPE = 'charts_studio';
  const CS_MODEL_VERSION = 1;

  /* ---------------- catálogos ---------------- */

  const SOURCES = [
    {id:'receita',          label:'Receitas',              kind:'rows',     color:'#22c55e', sign:1},
    {id:'receita_propria',  label:'Receita própria',       kind:'rows',     color:'#16a34a', sign:1},
    {id:'receita_extra',    label:'Reembolsos e repasses', kind:'rows',     color:'#4ade80', sign:1},
    {id:'despesa_variavel', label:'Despesas variáveis',    kind:'rows',     color:'#ff5a5f', sign:-1},
    {id:'despesa_fixa',     label:'Despesas fixas',        kind:'rows',     color:'#f97316', sign:-1},
    {id:'assinaturas',      label:'Assinaturas',           kind:'rows',     color:'#a855f7', sign:-1},
    {id:'despesa_total',    label:'Despesas (total)',      kind:'rows',     color:'#ef4444', sign:-1},
    {id:'resultado',        label:'Resultado do mês',      kind:'calc',     color:'#c9a45c', sign:1},
    {id:'fluxo',            label:'Receita × Despesa',     kind:'calc',     color:'#c9a45c', sign:1, multi:true},
    {id:'reservas',         label:'Reservas',              kind:'snapshot', color:'#38bdf8', sign:1},
    {id:'saldo_contas',     label:'Saldo em contas',       kind:'snapshot', color:'#22c55e', sign:1},
    {id:'patrimonio',       label:'Patrimônio',            kind:'snapshot', color:'#c9a45c', sign:1},
    {id:'dividas',          label:'Dívidas de cartão',     kind:'snapshot', color:'#ff5a5f', sign:-1},
    {id:'investimentos',    label:'Investimentos',         kind:'snapshot', color:'#4d82ff', sign:1},
    {id:'bens',             label:'Bens',                  kind:'snapshot', color:'#3b6bf0', sign:1}
  ];

  const DIMS = [
    {id:'mes',       label:'Mês a mês',           temporal:true},
    {id:'ano',       label:'Ano a ano',           temporal:true},
    {id:'categoria', label:'Por categoria'},
    {id:'banco',     label:'Por banco / conta'},
    {id:'forma',     label:'Por forma de pagamento'},
    {id:'cartao',    label:'Por cartão'},
    {id:'reserva',   label:'Por reserva'},
    {id:'origem',    label:'Por origem'},
    {id:'descricao', label:'Por descrição'},
    {id:'dia_semana',label:'Por dia da semana'},
    {id:'dia_mes',   label:'Por dia do mês'}
  ];

  const METRICS = [
    {id:'soma',        label:'Soma',                 format:'money'},
    {id:'media',       label:'Média por lançamento', format:'money'},
    {id:'contagem',    label:'Quantidade de itens',  format:'number'},
    {id:'acumulado',   label:'Acumulado',            format:'money'},
    {id:'participacao',label:'% do total',           format:'percent'},
    {id:'variacao',    label:'Variação % x anterior',format:'percent'}
  ];

  const VISUALS = [
    {id:'coluna',           label:'Colunas',                group:'Barras'},
    {id:'coluna_empilhada', label:'Colunas empilhadas',     group:'Barras', needsMulti:true},
    {id:'coluna_agrupada',  label:'Colunas agrupadas',      group:'Barras', needsMulti:true},
    {id:'barra',            label:'Barras horizontais',     group:'Barras'},
    {id:'barra_ranking',    label:'Ranking (barra + valor)',group:'Barras'},
    {id:'linha',            label:'Linha',                  group:'Linhas'},
    {id:'linha_suave',      label:'Linha suave',            group:'Linhas'},
    {id:'area',             label:'Área',                   group:'Linhas'},
    {id:'area_empilhada',   label:'Área empilhada',         group:'Linhas', needsMulti:true},
    {id:'sparkline',        label:'Sparkline compacto',     group:'Linhas'},
    {id:'donut',            label:'Rosca',                  group:'Proporção'},
    {id:'pizza',            label:'Pizza',                  group:'Proporção'},
    {id:'meia_lua',         label:'Meia-lua',               group:'Proporção'},
    {id:'treemap',          label:'Treemap',                group:'Proporção'},
    {id:'funil',            label:'Funil',                  group:'Proporção'},
    {id:'gauge',            label:'Velocímetro',            group:'Indicadores'},
    {id:'kpi',              label:'Número grande (KPI)',    group:'Indicadores'},
    {id:'radar',            label:'Radar',                  group:'Comparação'},
    {id:'waterfall',        label:'Cascata (waterfall)',    group:'Comparação'},
    {id:'dispersao',        label:'Dispersão',              group:'Comparação'},
    {id:'bolhas',           label:'Bolhas',                 group:'Comparação'},
    {id:'heatmap',          label:'Mapa de calor',          group:'Comparação'},
    {id:'tabela',           label:'Tabela comparativa',     group:'Tabelas'},
    {id:'tabela_ranking',   label:'Tabela de ranking',      group:'Tabelas'}
  ];

  const PALETTES = {
    borion: ['#c9a45c','#22c55e','#4d82ff','#ff5a5f','#38bdf8','#a855f7','#f97316','#e8c98a','#14b8a6','#ec4899','#84cc16','#f59e0b'],
    ouro:   ['#e8c98a','#d3b173','#c9a45c','#b08d45','#96762f','#7d5c2a','#63481f','#4a3517'],
    verde:  ['#4ade80','#22c55e','#16a34a','#15803d','#166534','#14532d'],
    vermelho:['#ff8a8d','#ff5a5f','#ef4444','#dc2626','#b91c1c','#7f1d1d'],
    azul:   ['#7aa5ff','#4d82ff','#3b6bf0','#2563eb','#1d4ed8','#1e3a8a'],
    frio:   ['#38bdf8','#0ea5e9','#14b8a6','#4d82ff','#a855f7','#6366f1']
  };

  const PERIOD_PRESETS = [
    {id:'ultimos3',  label:'Últimos 3 meses',  months:3},
    {id:'ultimos6',  label:'Últimos 6 meses',  months:6},
    {id:'ultimos12', label:'Últimos 12 meses', months:12},
    {id:'ultimos24', label:'Últimos 24 meses', months:24},
    {id:'mes_atual', label:'Mês atual',        months:1},
    {id:'ano_atual', label:'Ano atual',        months:0},
    {id:'tudo',      label:'Todo o histórico', months:0}
  ];

  /* Recortes que fazem sentido para cada fonte. Snapshots (saldo, patrimônio…)
     só existem no tempo — não dá para quebrar patrimônio por forma de pagamento. */
  function dimsForSource(sourceId){
    const src = sourceById(sourceId);
    if(!src) return ['mes'];
    if(src.kind==='snapshot'){
      if(sourceId==='reservas') return ['mes','ano','reserva'];
      if(sourceId==='saldo_contas') return ['mes','ano','banco'];
      if(sourceId==='bens') return ['mes','ano','banco','descricao'];
      return ['mes','ano'];
    }
    if(src.kind==='calc') return ['mes','ano'];
    const base = ['mes','ano','categoria','banco','descricao'];
    if(sourceId!=='despesa_fixa' && sourceId!=='assinaturas') base.push('forma','dia_semana','dia_mes');
    if(sourceId==='despesa_variavel' || sourceId==='despesa_total') base.push('cartao','reserva');
    if(sourceId.indexOf('receita')===0) base.push('origem','reserva');
    return base;
  }

  function sourceById(id){ return SOURCES.find(s=>s.id===id) || SOURCES[0]; }
  function visualById(id){ return VISUALS.find(v=>v.id===id) || VISUALS[0]; }
  function metricById(id){ return METRICS.find(m=>m.id===id) || METRICS[0]; }
  function dimById(id){ return DIMS.find(d=>d.id===id) || DIMS[0]; }

  /* ---------------- estado persistido ---------------- */

  function store(create){
    if(typeof S==='undefined' || !S.data) return null;
    if(create && !S.data.chartsStudio) S.data.chartsStudio = {version:CS_MODEL_VERSION, charts:[]};
    const st = S.data.chartsStudio;
    if(st && !Array.isArray(st.charts)) st.charts = [];
    return st || null;
  }
  function charts(){ const st = store(false); return (st && Array.isArray(st.charts)) ? st.charts : []; }
  function chartById(id){ return charts().find(c=>String(c.id)===String(id)) || null; }

  function defaultChart(patch){
    return Object.assign({
      id: (typeof uid==='function' ? uid() : 'cs_'+Date.now()+'_'+Math.random().toString(36).slice(2,8)),
      titulo: '',
      fonte: 'despesa_variavel',
      dim: 'mes',
      metrica: 'soma',
      visual: 'coluna',
      periodo: 'ultimos12',
      periodoAno: null,
      paleta: 'borion',
      top: 8,
      comparar: false,
      mostrarValores: true,
      mostrarLegenda: true,
      criadoEm: Date.now()
    }, patch||{});
  }

  function persist(){
    if(typeof saveCurrentData==='function') saveCurrentData();
  }

  /* ---------------- período ---------------- */

  function monthKeysForPeriod(cfg){
    const preset = String(cfg.periodo||'ultimos12');
    const now = todayYM();
    if(preset==='ano_atual' || (preset==='ano_especifico' && cfg.periodoAno)){
      const y = preset==='ano_atual' ? now.y : Number(cfg.periodoAno)||now.y;
      const out = [];
      for(let m=0;m<12;m++){
        const key = monthKey(y,m);
        if(y<now.y || m<=now.m) out.push(key);
      }
      return out.length?out:[monthKey(y,0)];
    }
    if(preset==='tudo'){
      const keys = allDataMonthKeys();
      return keys.length?keys:[monthKey(now.y,now.m)];
    }
    const def = PERIOD_PRESETS.find(p=>p.id===preset);
    const n = def && def.months ? def.months : 12;
    const out = [];
    for(let i=n-1;i>=0;i--) out.push(shiftYM(monthKey(now.y,now.m), -i));
    return out;
  }

  function allDataMonthKeys(){
    const set = new Set();
    const push = iso => { const k = String(iso||'').slice(0,7); if(/^\d{4}-\d{2}$/.test(k)) set.add(k); };
    (S.data.transacoes||[]).forEach(t=>push(t && t.data));
    (S.data.reservas && S.data.reservas.moves || []).forEach(m=>push(m && m.data));
    Object.keys(S.data.patrimonioHistorico||{}).forEach(k=>push(k+'-01'));
    if(!set.size) return [];
    const sorted = Array.from(set).sort();
    const out = [];
    let cursor = sorted[0];
    const last = sorted[sorted.length-1];
    let guard = 0;
    while(cursor<=last && guard++<600){ out.push(cursor); cursor = shiftYM(cursor, 1); }
    return out;
  }

  function periodBounds(cfg){
    const keys = monthKeysForPeriod(cfg);
    return {keys, from: keys[0]+'-01', to: keys[keys.length-1]+'-31'};
  }

  function previousPeriodKeys(keys){
    const n = keys.length;
    return keys.map((_,i)=>shiftYM(keys[0], i-n));
  }

  /* ---------------- linhas de dados por fonte ---------------- */

  /* Todas as fontes de "linha" viram o mesmo formato normalizado, para que o
     agrupamento por recorte não precise saber de onde o dado veio. */
  function normalizeRow(raw, extra){
    return Object.assign({
      id: raw && raw.id || '',
      data: raw && raw.data || '',
      nome: raw && raw.nome || 'Sem nome',
      categoria: raw && raw.categoria || 'Outro',
      valor: Math.abs(Number(raw && raw.valor)||0),
      banco: raw && raw.banco || '',
      accountId: raw && raw.accountId || '',
      forma: raw && raw.formaPagamento || '',
      origem: raw && raw.origem || '',
      cartaoId: raw && raw.viaCartaoId || '',
      reservaId: raw && (raw.reservaBoxId || raw.origemReservaId) || '',
      tipoLabel: ''
    }, extra||{});
  }

  function txRows(filterFn, monthKeys){
    const allowed = new Set(monthKeys);
    return (S.data.transacoes||[])
      .filter(t=>t && filterFn(t) && allowed.has(String(t.data||'').slice(0,7)))
      .filter(t=>typeof bankMatches!=='function' || bankMatches(t.banco, t.accountId))
      .map(t=>normalizeRow(t));
  }

  function fixaRows(monthKeys){
    const out = [];
    if(typeof fixasAtivasNoMes!=='function' || typeof fixaValorNoMes!=='function') return out;
    monthKeys.forEach(key=>{
      const [y,mm] = key.split('-').map(Number);
      fixasAtivasNoMes(y, mm-1).forEach(f=>{
        const valor = fixaValorNoMes(f, y, mm-1);
        if(!valor) return;
        out.push(normalizeRow({
          id:f.id, data:key+'-'+pad2(Math.min(28, Number(f.diaVencimento)||1)),
          nome:f.nome, categoria:f.categoria, valor, banco:f.banco, accountId:f.accountId,
          formaPagamento:f.formaPagamento
        }, {tipoLabel:'Despesa fixa'}));
      });
    });
    return out;
  }

  function assinaturaRows(monthKeys){
    const out = [];
    if(typeof assinaturasAtivasNoMes!=='function') return out;
    monthKeys.forEach(key=>{
      const [y,mm] = key.split('-').map(Number);
      let list = [];
      try{ list = assinaturasAtivasNoMes(y, mm-1) || []; }catch(e){ list = []; }
      list.forEach(a=>{
        const valor = Number(a && a.valor)||0;
        if(!valor) return;
        out.push(normalizeRow({
          id:a.assinaturaId||a.id, data:key+'-01', nome:a.nome, categoria:a.categoria,
          valor, banco:a.banco, accountId:a.accountId, formaPagamento:a.formaPagamento
        }, {tipoLabel:'Assinatura'}));
      });
    });
    return out;
  }

  function rowsFor(sourceId, monthKeys){
    switch(sourceId){
      case 'receita':
        return txRows(t=>t.tipo==='receita', monthKeys).map(r=>(r.tipoLabel='Receita', r));
      case 'receita_propria':
        return txRows(t=>t.tipo==='receita' && (t.origem==null||t.origem==='propria'||t.origem==='rendimento'), monthKeys)
          .map(r=>(r.tipoLabel='Receita própria', r));
      case 'receita_extra':
        return txRows(t=>t.tipo==='receita' && (t.origem==='reembolso'||t.origem==='repasse'), monthKeys)
          .map(r=>(r.tipoLabel='Reembolso/repasse', r));
      case 'despesa_variavel':
        return txRows(t=>t.tipo==='variavel', monthKeys).map(r=>(r.tipoLabel='Despesa variável', r));
      case 'despesa_fixa':
        return fixaRows(monthKeys);
      case 'assinaturas':
        return assinaturaRows(monthKeys);
      case 'despesa_total':
        return txRows(t=>t.tipo==='variavel', monthKeys).map(r=>(r.tipoLabel='Despesa variável', r))
          .concat(fixaRows(monthKeys))
          .concat(assinaturaRows(monthKeys));
      default:
        return [];
    }
  }

  /* ---------------- séries de snapshot (saldo ao fim de cada mês) ---------------- */

  function reservaSaldoNoMes(box, key){
    const limite = key+'-31';
    const moves = (S.data.reservas && S.data.reservas.moves || [])
      .filter(m=>m && String(m.boxId)===String(box.id) && String(m.data||''))
      .sort((a,b)=>String(a.data).localeCompare(String(b.data)));
    if(!moves.length) return Number(box.valorAtual)||0;
    const anteriores = moves.filter(m=>String(m.data)<=limite);
    if(!anteriores.length){
      const primeiro = moves[0];
      return Number(primeiro.saldoAntes!=null ? primeiro.saldoAntes : 0)||0;
    }
    const ultimo = anteriores[anteriores.length-1];
    if(ultimo.saldoDepois!=null) return Number(ultimo.saldoDepois)||0;
    return Number(box.valorAtual)||0;
  }

  function reservasTotalNoMes(key){
    const boxes = (S.data.reservas && S.data.reservas.boxes || [])
      .filter(b=>typeof bankMatches!=='function' || bankMatches(b.banco));
    return boxes.reduce((sum,b)=>sum+reservaSaldoNoMes(b,key), 0);
  }

  function snapshotValue(sourceId, key){
    const [y,mm] = key.split('-').map(Number);
    const m = mm-1;
    switch(sourceId){
      case 'reservas': return reservasTotalNoMes(key);
      case 'saldo_contas': return typeof saldoEmContasTotal==='function' ? saldoEmContasTotal() : 0;
      case 'patrimonio': {
        const hist = S.data.patrimonioHistorico || {};
        if(hist[key]!=null) return Number(hist[key])||0;
        const anteriores = Object.keys(hist).filter(k=>k<=key).sort();
        if(anteriores.length) return Number(hist[anteriores[anteriores.length-1]])||0;
        return typeof patrimonioTotal==='function' ? patrimonioTotal() : 0;
      }
      case 'dividas': return typeof computeCardsDebt==='function' ? (computeCardsDebt(y,m).total||0) : 0;
      case 'investimentos': return typeof investAtualTotal==='function' ? investAtualTotal() : 0;
      case 'bens': return typeof bensTotal==='function' ? bensTotal() : 0;
      default: return 0;
    }
  }

  function calcValue(sourceId, key){
    const [y,mm] = key.split('-').map(Number);
    const m = mm-1;
    if(sourceId==='resultado') return typeof resultadoPeriodo==='function' ? resultadoPeriodo(y,m) : 0;
    return 0;
  }

  /* ---------------- rótulos de recorte ---------------- */

  const WEEKDAYS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

  function accountLabelFor(row){
    if(row.accountId && typeof accountById==='function'){
      const acc = accountById(row.accountId, {includeArchived:true});
      if(acc && acc.nome) return acc.nome;
    }
    return row.banco || 'Sem banco';
  }

  function cardLabelFor(row){
    if(!row.cartaoId) return 'Sem cartão';
    const card = (S.data.cartoes||[]).find(c=>c && String(c.id)===String(row.cartaoId));
    return card && (card.nome||card.banco) || 'Cartão removido';
  }

  function reserveLabelFor(row){
    if(!row.reservaId) return 'Sem reserva';
    const box = (S.data.reservas && S.data.reservas.boxes || []).find(b=>b && String(b.id)===String(row.reservaId));
    return box && box.nome || 'Reserva removida';
  }

  function bucketKeyFor(row, dim){
    switch(dim){
      case 'categoria': return row.categoria || 'Outro';
      case 'banco': return accountLabelFor(row);
      case 'forma': return row.forma || 'Não informado';
      case 'cartao': return cardLabelFor(row);
      case 'reserva': return reserveLabelFor(row);
      case 'origem': return typeof txOrigemToLabel==='function' ? txOrigemToLabel(row.origem||'propria') : (row.origem||'Própria');
      case 'descricao': return row.nome || 'Sem nome';
      case 'dia_semana': {
        const d = new Date(String(row.data||'')+'T12:00:00');
        return isNaN(d.getTime()) ? 'Sem data' : WEEKDAYS[d.getDay()];
      }
      case 'dia_mes': {
        const dia = String(row.data||'').slice(8,10);
        return dia ? 'Dia '+dia : 'Sem data';
      }
      case 'ano': return String(row.data||'').slice(0,4) || 'Sem ano';
      case 'mes':
      default: return String(row.data||'').slice(0,7);
    }
  }

  window.BorionChartsStudioCore = {SOURCES, DIMS, METRICS, VISUALS, PALETTES, PERIOD_PRESETS,
    dimsForSource, sourceById, visualById, metricById, dimById, store, charts, chartById,
    defaultChart, persist, monthKeysForPeriod, previousPeriodKeys, periodBounds, rowsFor,
    snapshotValue, calcValue, bucketKeyFor, accountLabelFor, cardLabelFor, reserveLabelFor,
    CS_SCOPE, CS_MODEL_VERSION};
})();

/* ============================================================================
   Estúdio de Gráficos — motor de agregação e desenho SVG.
   Nenhum valor formatado entra no SVG via brl() (que devolve HTML): dentro de
   <text> só entra texto puro, via brlText/compact. Isso evita o mesmo problema
   do "<span class=borion-money>" cru que já apareceu na tela de rendimento.
   ========================================================================== */
(() => {
  'use strict';
  const C = window.BorionChartsStudioCore;
  if(!C) return;

  /* ---------------- formatação ---------------- */

  function hiddenValues(){ return !!(typeof S!=='undefined' && S.valuesHidden); }

  function fmtValue(v, format){
    if(format==='percent') return (Math.round((Number(v)||0)*10)/10).toLocaleString('pt-BR')+'%';
    if(format==='number') return String(Math.round(Number(v)||0).toLocaleString('pt-BR'));
    return typeof brlText==='function' ? brlText(v) : String(v);
  }

  function fmtCompact(v, format){
    if(hiddenValues()) return '$';
    const n = Number(v)||0;
    if(format==='percent') return (Math.round(n*10)/10).toLocaleString('pt-BR')+'%';
    if(format==='number') return String(Math.round(n).toLocaleString('pt-BR'));
    const abs = Math.abs(n);
    const sign = n<0 ? '-' : '';
    if(abs>=1000000) return sign+'R$ '+(abs/1000000).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mi';
    if(abs>=1000) return sign+'R$ '+(abs/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mil';
    return sign+'R$ '+abs.toLocaleString('pt-BR',{maximumFractionDigits:0});
  }

  function shortLabel(label, max){
    const s = String(label==null?'':label);
    return s.length>max ? s.slice(0, max-1)+'…' : s;
  }

  function monthLabelOf(key){
    return typeof shortMonthLabel==='function' ? shortMonthLabel(key) : key;
  }

  /* ---------------- agregação ---------------- */

  function paletteFor(cfg){
    return C.PALETTES[cfg.paleta] || C.PALETTES.borion;
  }

  function aggregateRows(rows, dim){
    const map = new Map();
    rows.forEach(row=>{
      const key = C.bucketKeyFor(row, dim);
      const bucket = map.get(key) || {key, soma:0, contagem:0, rows:[]};
      bucket.soma += row.valor;
      bucket.contagem += 1;
      bucket.rows.push(row);
      map.set(key, bucket);
    });
    return map;
  }

  function applyMetric(values, metric, allValues){
    const total = (allValues||values).reduce((a,b)=>a+(Number(b)||0),0);
    if(metric==='acumulado'){
      let run = 0;
      return values.map(v=>{ run += Number(v)||0; return run; });
    }
    if(metric==='participacao'){
      return values.map(v=>total ? (Number(v)||0)/total*100 : 0);
    }
    if(metric==='variacao'){
      return values.map((v,i)=>{
        if(i===0) return 0;
        const prev = Number(values[i-1])||0;
        if(!prev) return 0;
        return ((Number(v)||0)-prev)/Math.abs(prev)*100;
      });
    }
    return values.slice();
  }

  function metricFormat(cfg){
    const m = C.metricById(cfg.metrica);
    return m.format;
  }

  /* Constrói o conjunto de dados completo de um gráfico.
     Devolve labels, séries e, para cada ponto, a consulta que o originou —
     é isso que permite clicar em qualquer barra/fatia e abrir os lançamentos. */
  function buildDataset(cfg){
    const src = C.sourceById(cfg.fonte);
    const dim = cfg.dim || 'mes';
    const keys = C.monthKeysForPeriod(cfg);
    const palette = paletteFor(cfg);
    const format = metricFormat(cfg);
    const temporal = (dim==='mes' || dim==='ano');

    let labels = [];
    let series = [];
    let points = [];

    if(temporal){
      const groupKeys = dim==='ano'
        ? Array.from(new Set(keys.map(k=>k.slice(0,4))))
        : keys.slice();
      labels = dim==='ano' ? groupKeys.slice() : groupKeys.map(monthLabelOf);

      const monthsOfGroup = g => dim==='ano' ? keys.filter(k=>k.slice(0,4)===g) : [g];

      const seriesDefs = src.multi
        ? [{id:'receita', name:'Receitas', color:'#22c55e'}, {id:'despesa_total', name:'Despesas', color:'#ff5a5f'}]
        : [{id:src.id, name:src.label, color:palette[0]||src.color}];

      series = seriesDefs.map(def=>{
        const raw = groupKeys.map(g=>{
          const months = monthsOfGroup(g);
          const inner = C.sourceById(def.id);
          if(inner.kind==='snapshot'){
            const last = months[months.length-1];
            return C.snapshotValue(def.id, last);
          }
          if(inner.kind==='calc'){
            return months.reduce((sum,k)=>sum+C.calcValue(def.id,k), 0);
          }
          const rows = C.rowsFor(def.id, months);
          if(cfg.metrica==='contagem') return rows.length;
          if(cfg.metrica==='media') return rows.length ? rows.reduce((a,r)=>a+r.valor,0)/rows.length : 0;
          return rows.reduce((a,r)=>a+r.valor, 0);
        });
        const values = applyMetric(raw, cfg.metrica);
        return {id:def.id, name:def.name, color:def.color, values, raw};
      });

      series.forEach((serie,si)=>{
        serie.values.forEach((v,i)=>{
          points.push({si, i, label:labels[i], value:v, rawValue:serie.raw[i], serie:serie.name,
            query:{fonte:serie.id, months:monthsOfGroup(groupKeys[i]), dim:null, bucket:null}});
        });
      });
    } else {
      /* Recortes não temporais: snapshots têm caminho próprio (por reserva, por
         conta, por bem); o resto agrega as linhas do período inteiro. */
      let buckets = [];
      if(src.kind==='snapshot' && dim==='reserva'){
        const last = keys[keys.length-1];
        buckets = (S.data.reservas && S.data.reservas.boxes || [])
          .filter(b=>typeof bankMatches!=='function' || bankMatches(b.banco))
          .map(b=>({key:b.nome||'Reserva', soma:0, contagem:1, rows:[], direct:reserveSaldo(b,last)}));
      } else if(src.kind==='snapshot' && dim==='banco'){
        const detalhe = typeof saldoContasDetalhe==='function' ? saldoContasDetalhe() : [];
        buckets = detalhe.map(r=>({key:r.nome||r.banco||'Conta', soma:0, contagem:1, rows:[], direct:Number(r.valor)||0}));
      } else if(src.kind==='snapshot' && dim==='descricao'){
        buckets = (S.data.bens||[])
          .filter(b=>typeof bankMatches!=='function' || bankMatches(b.banco, b.accountId))
          .map(b=>({key:b.nome||'Bem', soma:0, contagem:1, rows:[], direct:Number(b.valor)||0}));
      } else {
        const rows = C.rowsFor(src.id, keys);
        buckets = Array.from(aggregateRows(rows, dim).values());
      }

      buckets.forEach(b=>{
        if(b.direct!=null){ b.valor = b.direct; return; }
        if(cfg.metrica==='contagem') b.valor = b.contagem;
        else if(cfg.metrica==='media') b.valor = b.contagem ? b.soma/b.contagem : 0;
        else b.valor = b.soma;
      });

      buckets.sort((a,b)=>Math.abs(b.valor)-Math.abs(a.valor));
      const limit = Math.max(1, Number(cfg.top)||8);
      let visible = buckets;
      if(buckets.length>limit){
        const head = buckets.slice(0, limit);
        const tail = buckets.slice(limit);
        const resto = tail.reduce((a,b)=>a+b.valor, 0);
        const restoRows = tail.reduce((acc,b)=>acc.concat(b.rows||[]), []);
        head.push({key:'Outros ('+tail.length+')', valor:resto, contagem:tail.length, rows:restoRows});
        visible = head;
      }

      labels = visible.map(b=>b.key);
      const rawValues = visible.map(b=>b.valor);
      /* Num recorte que não é linha do tempo, "variação" comparando um balde com
         o balde do lado não significa nada (Mercado x Lazer). O certo é comparar
         cada balde com ele mesmo no período anterior. */
      let values;
      if(cfg.metrica==='variacao'){
        const prevMapV = aggregateRows(C.rowsFor(src.id, C.previousPeriodKeys(keys)), dim);
        values = labels.map((l,i)=>{
          const b = prevMapV.get(l);
          const prev = b ? (cfg.metrica==='contagem' ? b.contagem : b.soma) : 0;
          if(!prev) return 0;
          return ((Number(rawValues[i])||0)-prev)/Math.abs(prev)*100;
        });
      } else {
        values = applyMetric(rawValues, cfg.metrica);
      }
      const mainSerie = {id:src.id, name:src.label, color:palette[0]||src.color, values, raw:rawValues,
        colors: visible.map((_,i)=>palette[i%palette.length])};
      series = [mainSerie];

      if(cfg.comparar){
        const prevKeys = C.previousPeriodKeys(keys);
        const prevRows = C.rowsFor(src.id, prevKeys);
        const prevMap = aggregateRows(prevRows, dim);
        const prevRaw = labels.map(l=>{
          const b = prevMap.get(l);
          if(!b) return 0;
          if(cfg.metrica==='contagem') return b.contagem;
          if(cfg.metrica==='media') return b.contagem ? b.soma/b.contagem : 0;
          return b.soma;
        });
        series.push({id:src.id+'_prev', name:'Período anterior', color:'#667383',
          values:applyMetric(prevRaw, cfg.metrica), raw:prevRaw});
      }

      series.forEach((serie,si)=>{
        serie.values.forEach((v,i)=>{
          points.push({si, i, label:labels[i], value:v, rawValue:serie.raw[i], serie:serie.name,
            query:{fonte:src.id, months:si===0?keys:C.previousPeriodKeys(keys), dim, bucket:labels[i]}});
        });
      });
    }

    const total = series.length ? series[0].raw.reduce((a,b)=>a+(Number(b)||0),0) : 0;
    return {labels, series, points, format, total, cfg, temporal, palette};
  }

  function reserveSaldo(box, key){
    /* espelha a leitura do núcleo, usada só no recorte "por reserva" */
    const moves = (S.data.reservas && S.data.reservas.moves || [])
      .filter(m=>m && String(m.boxId)===String(box.id) && String(m.data||''))
      .sort((a,b)=>String(a.data).localeCompare(String(b.data)));
    if(!moves.length) return Number(box.valorAtual)||0;
    const anteriores = moves.filter(m=>String(m.data)<=key+'-31');
    if(!anteriores.length) return Number(moves[0].saldoAntes||0)||0;
    const ultimo = anteriores[anteriores.length-1];
    return ultimo.saldoDepois!=null ? (Number(ultimo.saldoDepois)||0) : (Number(box.valorAtual)||0);
  }

  /* Cache de datasets por passada de render. O caminho quente não é desenhar o
     gráfico: é o tooltip, que precisa do dataset a cada movimento do mouse, e o
     detalhamento. Sem cache, mexer o mouse sobre um gráfico de 24 meses refazia
     a agregação inteira dezenas de vezes por segundo.
     Invalidação: o painel limpa o cache a cada renderView, que é exatamente
     quando os dados podem ter mudado (lançamento, sync do Drive, troca de mês,
     filtro de banco, olhinho). O carimbo abaixo é a segunda rede de segurança. */
  const cache = new Map();

  function cacheStamp(){
    const d = (typeof S!=='undefined' && S.data) ? S.data : {};
    return [
      (d.transacoes||[]).length,
      (d.fixas||[]).length,
      (d.assinaturas||[]).length,
      ((d.reservas&&d.reservas.moves)||[]).length,
      ((d.reservas&&d.reservas.boxes)||[]).length,
      (d.contas||[]).length,
      (d.bens||[]).length,
      typeof S!=='undefined' && S.month ? S.month.y+'-'+S.month.m : '',
      typeof S!=='undefined' && S.bankFilter ? S.bankFilter.size : 0,
      typeof S!=='undefined' && S.valuesHidden ? 1 : 0,
      typeof S!=='undefined' && S.currentProfile ? S.currentProfile.id : ''
    ].join('|');
  }

  function buildDatasetCached(cfg){
    let key;
    try{ key = cacheStamp()+'#'+JSON.stringify(cfg); }
    catch(e){ return buildDataset(cfg); }
    const hit = cache.get(key);
    if(hit) return hit;
    const view = buildDataset(cfg);
    if(cache.size>120) cache.clear();
    cache.set(key, view);
    return view;
  }

  function clearCache(){ cache.clear(); }

  window.BorionChartsStudioData = {buildDataset, buildDatasetCached, clearCache, fmtValue, fmtCompact, shortLabel, paletteFor};
})();

/* ============================================================================
   Estúdio de Gráficos — biblioteca de desenho (SVG puro, sem dependência).
   Cada elemento clicável recebe data-cs-point="serie:indice", que o painel usa
   para abrir o detalhamento dos lançamentos por trás daquele ponto.
   ========================================================================== */
(() => {
  'use strict';
  const C = window.BorionChartsStudioCore;
  const D = window.BorionChartsStudioData;
  if(!C || !D) return;

  const W = 720, H = 380;
  const AXIS = '#2a3949', GRID = 'rgba(150,163,177,.16)', TEXT = '#96a3b1';

  const num = v => Math.round((Number(v)||0)*100)/100;
  const esc2 = s => (typeof esc==='function' ? esc(s) : String(s==null?'':s));

  function svgWrap(inner, viewH){
    return `<svg class="cs-svg" viewBox="0 0 ${W} ${viewH||H}" preserveAspectRatio="xMidYMid meet" role="img">${inner}</svg>`;
  }

  function niceMax(v){
    const n = Math.abs(Number(v)||0);
    if(!n) return 1;
    const exp = Math.floor(Math.log10(n));
    const base = Math.pow(10, exp);
    const step = n/base;
    const mult = step<=1?1:step<=2?2:step<=2.5?2.5:step<=5?5:10;
    return mult*base;
  }

  function scaleFor(view){
    let min = 0, max = 0;
    view.series.forEach(s=>s.values.forEach(v=>{ const n = Number(v)||0; if(n>max) max=n; if(n<min) min=n; }));
    if(max===0 && min===0) max = 1;
    return {min: min<0 ? -niceMax(min) : 0, max: niceMax(max||1)};
  }

  function stackedScale(view){
    let max = 0, min = 0;
    view.labels.forEach((_,i)=>{
      let pos = 0, neg = 0;
      view.series.forEach(s=>{ const v = Number(s.values[i])||0; if(v>=0) pos+=v; else neg+=v; });
      if(pos>max) max = pos;
      if(neg<min) min = neg;
    });
    return {min: min<0 ? -niceMax(min) : 0, max: niceMax(max||1)};
  }

  function gridAndAxis(view, box, scale, opts){
    const {x0, y0, x1, y1} = box;
    const steps = 4;
    let out = '';
    for(let i=0;i<=steps;i++){
      const t = i/steps;
      const value = scale.min + (scale.max-scale.min)*t;
      const y = y1 - (y1-y0)*t;
      out += `<line x1="${x0}" y1="${num(y)}" x2="${x1}" y2="${num(y)}" stroke="${GRID}" stroke-width="1"/>`;
      out += `<text x="${x0-8}" y="${num(y)+4}" text-anchor="end" class="cs-axis-text">${esc2(D.fmtCompact(value, view.format))}</text>`;
    }
    out += `<line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}" stroke="${AXIS}" stroke-width="1.4"/>`;
    if(scale.min<0){
      const zeroY = y1 - (y1-y0)*((0-scale.min)/(scale.max-scale.min));
      out += `<line x1="${x0}" y1="${num(zeroY)}" x2="${x1}" y2="${num(zeroY)}" stroke="${AXIS}" stroke-width="1.4"/>`;
    }
    if(!opts || opts.xLabels!==false){
      const n = view.labels.length || 1;
      const stepX = (x1-x0)/n;
      const every = Math.ceil(n/12);
      view.labels.forEach((label,i)=>{
        if(i%every!==0) return;
        const x = x0 + stepX*(i+0.5);
        out += `<text x="${num(x)}" y="${y1+20}" text-anchor="middle" class="cs-axis-text">${esc2(D.shortLabel(label, 10))}</text>`;
      });
    }
    return out;
  }

  function yOf(value, box, scale){
    const t = ((Number(value)||0)-scale.min)/((scale.max-scale.min)||1);
    return box.y1 - (box.y1-box.y0)*t;
  }

  function plotBox(){ return {x0:78, y0:24, x1:W-18, y1:H-46}; }

  function pointAttr(si, i){ return `data-cs-point="${si}:${i}"`; }

  function legendHTML(view){
    if(view.cfg && view.cfg.mostrarLegenda===false) return '';
    if(view.series.length<2 && !view.series[0].colors) return '';
    if(view.series.length>1){
      return `<div class="cs-legend">${view.series.map(s=>`<span class="cs-legend-item"><i style="background:${esc2(s.color)}"></i>${esc2(s.name)}</span>`).join('')}</div>`;
    }
    const serie = view.series[0];
    if(!serie.colors) return '';
    return `<div class="cs-legend">${view.labels.map((l,i)=>`<span class="cs-legend-item" data-cs-point="0:${i}"><i style="background:${esc2(serie.colors[i])}"></i>${esc2(D.shortLabel(l,22))}</span>`).join('')}</div>`;
  }

  /* ---------------- barras e colunas ---------------- */

  function renderColunas(view){
    const box = plotBox(), scale = scaleFor(view);
    const serie = view.series[0];
    const n = view.labels.length || 1;
    const stepX = (box.x1-box.x0)/n;
    const barW = Math.max(4, Math.min(46, stepX*0.6));
    const zeroY = yOf(0, box, scale);
    let bars = '';
    serie.values.forEach((v,i)=>{
      const cx = box.x0 + stepX*(i+0.5);
      const y = yOf(v, box, scale);
      const top = Math.min(y, zeroY), h = Math.max(1, Math.abs(zeroY-y));
      const color = serie.colors ? serie.colors[i] : serie.color;
      bars += `<g class="cs-hit" ${pointAttr(0,i)}><rect x="${num(cx-barW/2)}" y="${num(top)}" width="${num(barW)}" height="${num(h)}" rx="5" fill="${esc2(color)}" opacity=".92"/>`;
      if(view.cfg.mostrarValores && n<=14){
        bars += `<text x="${num(cx)}" y="${num(top-7)}" text-anchor="middle" class="cs-value-text">${esc2(D.fmtCompact(v, view.format))}</text>`;
      }
      bars += `</g>`;
    });
    return svgWrap(gridAndAxis(view, box, scale) + bars);
  }

  function renderBarras(view, ranking){
    const rows = view.labels.length || 1;
    const viewH = Math.max(180, 40 + rows*34);
    const box = {x0:150, y0:16, x1:W-90, y1:viewH-16};
    const serie = view.series[0];
    const max = Math.max(1, ...serie.values.map(v=>Math.abs(Number(v)||0)));
    const stepY = (box.y1-box.y0)/rows;
    const barH = Math.max(8, Math.min(24, stepY*0.62));
    let out = '';
    view.labels.forEach((label,i)=>{
      const v = Number(serie.values[i])||0;
      const cy = box.y0 + stepY*(i+0.5);
      const w = Math.max(2, Math.abs(v)/max*(box.x1-box.x0));
      const color = serie.colors ? serie.colors[i] : serie.color;
      out += `<g class="cs-hit" ${pointAttr(0,i)}>`;
      if(ranking) out += `<rect x="${box.x0}" y="${num(cy-barH/2)}" width="${box.x1-box.x0}" height="${num(barH)}" rx="6" fill="rgba(150,163,177,.08)"/>`;
      out += `<rect x="${box.x0}" y="${num(cy-barH/2)}" width="${num(w)}" height="${num(barH)}" rx="6" fill="${esc2(color)}" opacity=".92"/>`;
      out += `<text x="${box.x0-10}" y="${num(cy+4)}" text-anchor="end" class="cs-axis-text">${esc2(D.shortLabel(label, 20))}</text>`;
      if(view.cfg.mostrarValores) out += `<text x="${num(Math.min(box.x1+6, box.x0+w+8))}" y="${num(cy+4)}" class="cs-value-text">${esc2(D.fmtCompact(v, view.format))}</text>`;
      out += `</g>`;
    });
    return svgWrap(out, viewH);
  }

  function renderColunasEmpilhadas(view, agrupada){
    const box = plotBox();
    const scale = agrupada ? scaleFor(view) : stackedScale(view);
    const n = view.labels.length || 1;
    const stepX = (box.x1-box.x0)/n;
    const groupW = Math.max(6, Math.min(60, stepX*0.66));
    const zeroY = yOf(0, box, scale);
    let out = '';
    view.labels.forEach((_,i)=>{
      if(agrupada){
        const each = groupW/Math.max(1, view.series.length);
        view.series.forEach((s,si)=>{
          const v = Number(s.values[i])||0;
          const x = box.x0 + stepX*(i+0.5) - groupW/2 + each*si;
          const y = yOf(v, box, scale);
          out += `<g class="cs-hit" ${pointAttr(si,i)}><rect x="${num(x)}" y="${num(Math.min(y,zeroY))}" width="${num(Math.max(2,each-3))}" height="${num(Math.max(1,Math.abs(zeroY-y)))}" rx="4" fill="${esc2(s.color)}" opacity=".92"/></g>`;
        });
      } else {
        let acc = 0;
        view.series.forEach((s,si)=>{
          const v = Number(s.values[i])||0;
          const yFrom = yOf(acc, box, scale);
          acc += v;
          const yTo = yOf(acc, box, scale);
          out += `<g class="cs-hit" ${pointAttr(si,i)}><rect x="${num(box.x0+stepX*(i+0.5)-groupW/2)}" y="${num(Math.min(yFrom,yTo))}" width="${num(groupW)}" height="${num(Math.max(1,Math.abs(yTo-yFrom)))}" rx="3" fill="${esc2(s.color)}" opacity=".92"/></g>`;
        });
      }
    });
    return svgWrap(gridAndAxis(view, box, scale) + out);
  }

  /* ---------------- linhas e áreas ---------------- */

  function pathFor(values, box, scale, smooth){
    const n = values.length || 1;
    const stepX = n>1 ? (box.x1-box.x0)/(n-1) : 0;
    const pts = values.map((v,i)=>({x: box.x0 + stepX*i, y: yOf(v, box, scale)}));
    if(!pts.length) return {d:'', pts:[]};
    if(!smooth || pts.length<3){
      return {d:'M'+pts.map(p=>`${num(p.x)},${num(p.y)}`).join(' L'), pts};
    }
    let d = `M${num(pts[0].x)},${num(pts[0].y)}`;
    for(let i=0;i<pts.length-1;i++){
      const p0 = pts[i], p1 = pts[i+1];
      const cx = (p0.x+p1.x)/2;
      d += ` C${num(cx)},${num(p0.y)} ${num(cx)},${num(p1.y)} ${num(p1.x)},${num(p1.y)}`;
    }
    return {d, pts};
  }

  function renderLinha(view, opts){
    const smooth = !!(opts && opts.smooth);
    const area = !!(opts && opts.area);
    const box = plotBox(), scale = scaleFor(view);
    let out = gridAndAxis(view, box, scale);
    view.series.forEach((s,si)=>{
      const {d, pts} = pathFor(s.values, box, scale, smooth);
      if(!d) return;
      if(area){
        const zeroY = yOf(0, box, scale);
        out += `<path d="${d} L${num(box.x1)},${num(zeroY)} L${num(box.x0)},${num(zeroY)} Z" fill="${esc2(s.color)}" opacity=".14"/>`;
      }
      out += `<path d="${d}" fill="none" stroke="${esc2(s.color)}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
      pts.forEach((p,i)=>{
        out += `<g class="cs-hit" ${pointAttr(si,i)}><circle cx="${num(p.x)}" cy="${num(p.y)}" r="9" fill="transparent"/><circle cx="${num(p.x)}" cy="${num(p.y)}" r="3.6" fill="${esc2(s.color)}" stroke="#0c131a" stroke-width="1.5"/></g>`;
      });
    });
    return svgWrap(out);
  }

  function renderAreaEmpilhada(view){
    const box = plotBox(), scale = stackedScale(view);
    let out = gridAndAxis(view, box, scale);
    const acc = view.labels.map(()=>0);
    view.series.forEach((s,si)=>{
      const lower = acc.slice();
      s.values.forEach((v,i)=>{ acc[i] += Number(v)||0; });
      const upper = pathFor(acc, box, scale, false);
      const lowerPts = pathFor(lower, box, scale, false).pts.slice().reverse();
      const d = upper.d + ' L' + lowerPts.map(p=>`${num(p.x)},${num(p.y)}`).join(' L') + ' Z';
      out += `<path d="${d}" fill="${esc2(s.color)}" opacity=".34" stroke="${esc2(s.color)}" stroke-width="1.4"/>`;
      upper.pts.forEach((p,i)=>{
        out += `<g class="cs-hit" ${pointAttr(si,i)}><circle cx="${num(p.x)}" cy="${num(p.y)}" r="8" fill="transparent"/></g>`;
      });
    });
    return svgWrap(out);
  }

  function renderSparkline(view){
    const viewH = 150;
    const box = {x0:16, y0:22, x1:W-16, y1:viewH-26};
    const scale = scaleFor(view);
    const s = view.series[0];
    const {d, pts} = pathFor(s.values, box, scale, true);
    const last = s.values[s.values.length-1];
    let out = `<path d="${d} L${num(box.x1)},${num(box.y1)} L${num(box.x0)},${num(box.y1)} Z" fill="${esc2(s.color)}" opacity=".16"/>`;
    out += `<path d="${d}" fill="none" stroke="${esc2(s.color)}" stroke-width="2.6" stroke-linecap="round"/>`;
    pts.forEach((p,i)=>{ out += `<g class="cs-hit" ${pointAttr(0,i)}><circle cx="${num(p.x)}" cy="${num(p.y)}" r="8" fill="transparent"/></g>`; });
    if(pts.length) out += `<circle cx="${num(pts[pts.length-1].x)}" cy="${num(pts[pts.length-1].y)}" r="4" fill="${esc2(s.color)}"/>`;
    out += `<text x="${box.x0}" y="16" class="cs-value-text">${esc2(D.fmtValue(last, view.format))}</text>`;
    return svgWrap(out, viewH);
  }

  /* ---------------- proporção ---------------- */

  function polar(cx, cy, r, deg){
    const rad = (deg-90)*Math.PI/180;
    return {x: cx + r*Math.cos(rad), y: cy + r*Math.sin(rad)};
  }

  function slicePath(cx, cy, rOut, rIn, a0, a1){
    const large = (a1-a0)>180 ? 1 : 0;
    const p0 = polar(cx, cy, rOut, a0), p1 = polar(cx, cy, rOut, a1);
    if(rIn<=0){
      return `M${num(cx)},${num(cy)} L${num(p0.x)},${num(p0.y)} A${rOut},${rOut} 0 ${large} 1 ${num(p1.x)},${num(p1.y)} Z`;
    }
    const q0 = polar(cx, cy, rIn, a1), q1 = polar(cx, cy, rIn, a0);
    return `M${num(p0.x)},${num(p0.y)} A${rOut},${rOut} 0 ${large} 1 ${num(p1.x)},${num(p1.y)} L${num(q0.x)},${num(q0.y)} A${rIn},${rIn} 0 ${large} 0 ${num(q1.x)},${num(q1.y)} Z`;
  }

  function renderPizza(view, mode){
    const viewH = 340;
    const cx = W/2, cy = mode==='meia_lua' ? viewH-52 : viewH/2;
    const rOut = mode==='meia_lua' ? 150 : 128;
    const rIn = mode==='donut' ? 76 : (mode==='meia_lua' ? 92 : 0);
    const serie = view.series[0];
    const values = serie.values.map(v=>Math.abs(Number(v)||0));
    const total = values.reduce((a,b)=>a+b, 0);
    const sweep = mode==='meia_lua' ? 180 : 360;
    const startAt = mode==='meia_lua' ? -90 : 0;
    let angle = startAt, out = '';
    if(!total){
      out += `<circle cx="${cx}" cy="${num(cy)}" r="${rOut}" fill="none" stroke="${AXIS}" stroke-width="${rOut-rIn||30}"/>`;
    } else {
      values.forEach((v,i)=>{
        const span = v/total*sweep;
        if(span<=0) return;
        const color = serie.colors ? serie.colors[i] : view.palette[i%view.palette.length];
        out += `<g class="cs-hit" ${pointAttr(0,i)}><path d="${slicePath(cx, cy, rOut, rIn, angle, angle+span)}" fill="${esc2(color)}" opacity=".93" stroke="#0c131a" stroke-width="1.5"/></g>`;
        angle += span;
      });
    }
    if(rIn>0){
      out += `<text x="${cx}" y="${num(cy-4)}" text-anchor="middle" class="cs-center-top">${esc2(D.fmtCompact(total, view.format))}</text>`;
      out += `<text x="${cx}" y="${num(cy+16)}" text-anchor="middle" class="cs-axis-text">${esc2(view.series[0].name)}</text>`;
    }
    return svgWrap(out, viewH);
  }

  function renderTreemap(view){
    const viewH = 340;
    const serie = view.series[0];
    const items = view.labels.map((l,i)=>({label:l, value:Math.abs(Number(serie.values[i])||0), i}))
      .filter(it=>it.value>0).sort((a,b)=>b.value-a.value);
    const total = items.reduce((a,b)=>a+b.value, 0);
    if(!total) return svgWrap(`<text x="${W/2}" y="${viewH/2}" text-anchor="middle" class="cs-axis-text">Sem dados no período</text>`, viewH);
    let x = 8, y = 8, w = W-16, h = viewH-16, out = '';
    let horizontal = true, restante = total;
    items.forEach((it,idx)=>{
      const frac = it.value/restante;
      const color = serie.colors ? serie.colors[it.i] : view.palette[idx%view.palette.length];
      let bw, bh;
      if(idx===items.length-1){ bw = w; bh = h; }
      else if(horizontal){ bw = Math.max(24, w*frac); bh = h; }
      else { bw = w; bh = Math.max(24, h*frac); }
      out += `<g class="cs-hit" ${pointAttr(0,it.i)}><rect x="${num(x)}" y="${num(y)}" width="${num(bw-3)}" height="${num(bh-3)}" rx="8" fill="${esc2(color)}" opacity=".9"/>`;
      if(bw>78 && bh>34){
        out += `<text x="${num(x+10)}" y="${num(y+22)}" class="cs-tile-label">${esc2(D.shortLabel(it.label, Math.floor(bw/9)))}</text>`;
        out += `<text x="${num(x+10)}" y="${num(y+40)}" class="cs-tile-value">${esc2(D.fmtCompact(it.value, view.format))}</text>`;
      }
      out += `</g>`;
      if(horizontal){ x += bw; w -= bw; } else { y += bh; h -= bh; }
      restante -= it.value;
      horizontal = !horizontal;
    });
    return svgWrap(out, viewH);
  }

  function renderFunil(view){
    const rows = view.labels.length || 1;
    const viewH = Math.max(200, 30 + rows*46);
    const serie = view.series[0];
    const values = serie.values.map(v=>Math.abs(Number(v)||0));
    const max = Math.max(1, ...values);
    let out = '';
    values.forEach((v,i)=>{
      const wTop = (v/max)*(W-160);
      const y = 20 + i*44;
      const color = serie.colors ? serie.colors[i] : view.palette[i%view.palette.length];
      out += `<g class="cs-hit" ${pointAttr(0,i)}><rect x="${num(W/2-wTop/2)}" y="${num(y)}" width="${num(Math.max(4,wTop))}" height="34" rx="8" fill="${esc2(color)}" opacity=".9"/>`;
      out += `<text x="18" y="${num(y+22)}" class="cs-axis-text">${esc2(D.shortLabel(view.labels[i], 18))}</text>`;
      out += `<text x="${W-16}" y="${num(y+22)}" text-anchor="end" class="cs-value-text">${esc2(D.fmtCompact(v, view.format))}</text></g>`;
    });
    return svgWrap(out, viewH);
  }

  /* ---------------- indicadores ---------------- */

  function renderGauge(view){
    const viewH = 300;
    const serie = view.series[0];
    const value = Number(serie.values[serie.values.length-1])||0;
    const max = Math.max(1, ...serie.values.map(v=>Math.abs(Number(v)||0)));
    const frac = Math.max(0, Math.min(1, Math.abs(value)/max));
    const cx = W/2, cy = viewH-70, r = 130;
    const start = -120, sweep = 240;
    let out = `<path d="${slicePath(cx, cy, r, r-26, start, start+sweep)}" fill="rgba(150,163,177,.14)"/>`;
    out += `<g class="cs-hit" ${pointAttr(0, serie.values.length-1)}><path d="${slicePath(cx, cy, r, r-26, start, start+sweep*frac)}" fill="${esc2(serie.color)}" opacity=".92"/></g>`;
    out += `<text x="${cx}" y="${num(cy-14)}" text-anchor="middle" class="cs-center-big">${esc2(D.fmtValue(value, view.format))}</text>`;
    out += `<text x="${cx}" y="${num(cy+14)}" text-anchor="middle" class="cs-axis-text">${esc2(view.labels[view.labels.length-1]||'')}</text>`;
    return svgWrap(out, viewH);
  }

  function renderKPI(view){
    const serie = view.series[0];
    const values = serie.values;
    const value = Number(values[values.length-1])||0;
    const prev = values.length>1 ? Number(values[values.length-2])||0 : 0;
    const delta = prev ? (value-prev)/Math.abs(prev)*100 : 0;
    const up = delta>=0;
    const viewH = 200;
    let out = `<text x="${W/2}" y="96" text-anchor="middle" class="cs-center-big">${esc2(D.fmtValue(value, view.format))}</text>`;
    out += `<text x="${W/2}" y="132" text-anchor="middle" class="cs-axis-text">${esc2(view.labels[view.labels.length-1]||serie.name)}</text>`;
    if(values.length>1){
      out += `<text x="${W/2}" y="164" text-anchor="middle" class="cs-kpi-delta" fill="${up?'#22c55e':'#ff5a5f'}">${up?'▲':'▼'} ${esc2((Math.round(Math.abs(delta)*10)/10).toLocaleString('pt-BR'))}% x anterior</text>`;
    }
    out += `<g class="cs-hit" ${pointAttr(0, values.length-1)}><rect x="0" y="0" width="${W}" height="${viewH}" fill="transparent"/></g>`;
    return svgWrap(out, viewH);
  }

  /* ---------------- comparação ---------------- */

  function renderRadar(view){
    const viewH = 360;
    const cx = W/2, cy = viewH/2, r = 130;
    const n = view.labels.length || 1;
    const max = Math.max(1, ...view.series.reduce((acc,s)=>acc.concat(s.values.map(v=>Math.abs(Number(v)||0))), []));
    let out = '';
    for(let ring=1; ring<=4; ring++){
      const rr = r*ring/4;
      const pts = [];
      for(let i=0;i<n;i++){ const p = polar(cx, cy, rr, i*360/n); pts.push(`${num(p.x)},${num(p.y)}`); }
      out += `<polygon points="${pts.join(' ')}" fill="none" stroke="${GRID}" stroke-width="1"/>`;
    }
    view.labels.forEach((label,i)=>{
      const p = polar(cx, cy, r+18, i*360/n);
      out += `<line x1="${cx}" y1="${cy}" x2="${num(polar(cx,cy,r,i*360/n).x)}" y2="${num(polar(cx,cy,r,i*360/n).y)}" stroke="${GRID}" stroke-width="1"/>`;
      out += `<text x="${num(p.x)}" y="${num(p.y)}" text-anchor="middle" class="cs-axis-text">${esc2(D.shortLabel(label, 10))}</text>`;
    });
    view.series.forEach((s,si)=>{
      const pts = s.values.map((v,i)=>{
        const rr = r*Math.min(1, Math.abs(Number(v)||0)/max);
        return polar(cx, cy, rr, i*360/n);
      });
      out += `<polygon points="${pts.map(p=>`${num(p.x)},${num(p.y)}`).join(' ')}" fill="${esc2(s.color)}" opacity=".22" stroke="${esc2(s.color)}" stroke-width="2"/>`;
      pts.forEach((p,i)=>{ out += `<g class="cs-hit" ${pointAttr(si,i)}><circle cx="${num(p.x)}" cy="${num(p.y)}" r="8" fill="transparent"/><circle cx="${num(p.x)}" cy="${num(p.y)}" r="3" fill="${esc2(s.color)}"/></g>`; });
    });
    return svgWrap(out, viewH);
  }

  function renderWaterfall(view){
    const box = plotBox();
    const serie = view.series[0];
    const values = serie.values.map(v=>Number(v)||0);
    let run = 0, min = 0, max = 0;
    const steps = values.map(v=>{ const from = run; run += v; if(run>max) max=run; if(run<min) min=run; return {from, to:run, v}; });
    const scale = {min: min<0 ? -niceMax(min) : 0, max: niceMax(max||1)};
    const n = values.length || 1;
    const stepX = (box.x1-box.x0)/n;
    const barW = Math.max(6, Math.min(44, stepX*0.6));
    let out = gridAndAxis(view, box, scale);
    steps.forEach((st,i)=>{
      const cx = box.x0 + stepX*(i+0.5);
      const y0 = yOf(st.from, box, scale), y1 = yOf(st.to, box, scale);
      const color = st.v>=0 ? '#22c55e' : '#ff5a5f';
      out += `<g class="cs-hit" ${pointAttr(0,i)}><rect x="${num(cx-barW/2)}" y="${num(Math.min(y0,y1))}" width="${num(barW)}" height="${num(Math.max(2,Math.abs(y1-y0)))}" rx="4" fill="${color}" opacity=".9"/></g>`;
      if(i<steps.length-1) out += `<line x1="${num(cx+barW/2)}" y1="${num(y1)}" x2="${num(cx+stepX-barW/2)}" y2="${num(y1)}" stroke="${GRID}" stroke-width="1" stroke-dasharray="3 3"/>`;
    });
    return svgWrap(out);
  }

  function renderDispersao(view, bolhas){
    const box = plotBox();
    const serie = view.series[0];
    const values = serie.values.map(v=>Number(v)||0);
    const scale = scaleFor(view);
    const n = values.length || 1;
    const stepX = (box.x1-box.x0)/Math.max(1,n-1);
    const maxAbs = Math.max(1, ...values.map(v=>Math.abs(v)));
    let out = gridAndAxis(view, box, scale);
    values.forEach((v,i)=>{
      const x = box.x0 + stepX*i;
      const y = yOf(v, box, scale);
      const r = bolhas ? Math.max(5, Math.min(30, 5+Math.abs(v)/maxAbs*26)) : 6;
      const color = serie.colors ? serie.colors[i] : serie.color;
      out += `<g class="cs-hit" ${pointAttr(0,i)}><circle cx="${num(x)}" cy="${num(y)}" r="${num(r)}" fill="${esc2(color)}" opacity="${bolhas?'.6':'.9'}" stroke="${esc2(color)}" stroke-width="1.4"/></g>`;
    });
    return svgWrap(out);
  }

  function renderHeatmap(view){
    /* Mapa de calor mês × recorte. Sem recorte cruzado disponível, cai para
       uma faixa única de meses — continua legível e clicável. */
    const serie = view.series[0];
    const values = serie.values.map(v=>Math.abs(Number(v)||0));
    const cols = Math.min(12, Math.max(1, values.length));
    const rows = Math.ceil(values.length/cols);
    const cellW = (W-40)/cols, cellH = 54;
    const viewH = Math.max(140, 50 + rows*cellH);
    const max = Math.max(1, ...values);
    let out = '';
    values.forEach((v,i)=>{
      const r = Math.floor(i/cols), c = i%cols;
      const x = 20 + c*cellW, y = 30 + r*cellH;
      const t = v/max;
      out += `<g class="cs-hit" ${pointAttr(0,i)}><rect x="${num(x+2)}" y="${num(y+2)}" width="${num(cellW-4)}" height="${num(cellH-8)}" rx="7" fill="${esc2(serie.color)}" opacity="${num(0.12+t*0.8)}"/>`;
      out += `<text x="${num(x+cellW/2)}" y="${num(y+cellH/2-2)}" text-anchor="middle" class="cs-tile-value">${esc2(D.fmtCompact(v, view.format))}</text>`;
      out += `<text x="${num(x+cellW/2)}" y="${num(y+cellH/2+16)}" text-anchor="middle" class="cs-axis-text">${esc2(D.shortLabel(view.labels[i], 8))}</text></g>`;
    });
    return svgWrap(out, viewH);
  }

  /* ---------------- tabelas ---------------- */

  function renderTabela(view, ranking){
    const serie = view.series[0];
    const compare = view.series[1] || null;
    const totalAbs = serie.values.reduce((a,b)=>a+Math.abs(Number(b)||0), 0) || 1;
    const head = `<tr><th>${ranking?'#':''} ${esc2(C.dimById(view.cfg.dim).label)}</th><th>${esc2(C.metricById(view.cfg.metrica).label)}</th><th>% do total</th>${compare?'<th>Anterior</th><th>Variação</th>':''}</tr>`;
    const body = view.labels.map((label,i)=>{
      const v = Number(serie.values[i])||0;
      const part = Math.abs(v)/totalAbs*100;
      let cols = `<td class="cs-cell-label">${ranking?`<b>${i+1}º</b> `:''}${esc2(label)}</td><td class="cs-cell-value">${esc2(D.fmtValue(v, view.format))}</td><td class="cs-cell-pct"><span class="cs-cell-bar" style="width:${num(Math.min(100,part))}%"></span><em>${num(part).toLocaleString('pt-BR')}%</em></td>`;
      if(compare){
        const p = Number(compare.values[i])||0;
        const delta = p ? (v-p)/Math.abs(p)*100 : 0;
        cols += `<td class="cs-cell-value">${esc2(D.fmtValue(p, view.format))}</td><td class="cs-cell-delta ${delta>=0?'up':'down'}">${delta>=0?'▲':'▼'} ${num(Math.abs(delta)).toLocaleString('pt-BR')}%</td>`;
      }
      return `<tr class="cs-hit" data-cs-point="0:${i}">${cols}</tr>`;
    }).join('');
    const totalRow = `<tr class="cs-total-row"><td>Total</td><td>${esc2(D.fmtValue(serie.values.reduce((a,b)=>a+(Number(b)||0),0), view.format))}</td><td>100%</td>${compare?'<td></td><td></td>':''}</tr>`;
    return `<div class="cs-table-wrap"><table class="cs-table"><thead>${head}</thead><tbody>${body}${totalRow}</tbody></table></div>`;
  }

  /* ---------------- despacho ---------------- */

  const RENDERERS = {
    coluna: v=>renderColunas(v),
    coluna_empilhada: v=>renderColunasEmpilhadas(v, false),
    coluna_agrupada: v=>renderColunasEmpilhadas(v, true),
    barra: v=>renderBarras(v, false),
    barra_ranking: v=>renderBarras(v, true),
    linha: v=>renderLinha(v, {}),
    linha_suave: v=>renderLinha(v, {smooth:true}),
    area: v=>renderLinha(v, {area:true, smooth:true}),
    area_empilhada: v=>renderAreaEmpilhada(v),
    sparkline: v=>renderSparkline(v),
    donut: v=>renderPizza(v, 'donut'),
    pizza: v=>renderPizza(v, 'pizza'),
    meia_lua: v=>renderPizza(v, 'meia_lua'),
    treemap: v=>renderTreemap(v),
    funil: v=>renderFunil(v),
    gauge: v=>renderGauge(v),
    kpi: v=>renderKPI(v),
    radar: v=>renderRadar(v),
    waterfall: v=>renderWaterfall(v),
    dispersao: v=>renderDispersao(v, false),
    bolhas: v=>renderDispersao(v, true),
    heatmap: v=>renderHeatmap(v),
    tabela: v=>renderTabela(v, false),
    tabela_ranking: v=>renderTabela(v, true)
  };

  function renderVisual(view){
    const fn = RENDERERS[view.cfg.visual] || RENDERERS.coluna;
    const hasData = view.series.some(s=>s.values.some(v=>Number(v)));
    if(!hasData){
      return `<div class="cs-empty-chart">Nenhum dado para essa combinação no período escolhido.</div>`;
    }
    let out = '';
    try{ out = fn(view); }
    catch(err){
      console.warn('[BORION][CHARTS_STUDIO][RENDER_FAIL]', view.cfg && view.cfg.visual, err);
      return `<div class="cs-empty-chart">Não foi possível desenhar este gráfico.</div>`;
    }
    const isTable = view.cfg.visual==='tabela' || view.cfg.visual==='tabela_ranking';
    return out + (isTable ? '' : legendHTML(view));
  }

  window.BorionChartsStudioRender = {renderVisual, RENDERERS};
})();

/* ============================================================================
   Estúdio de Gráficos — painel, montador e detalhamento.
   O painel usa o mesmo motor de layout livre da Visão Geral (escopo
   'charts_studio'), então arrastar, redimensionar, ocultar e o layout separado
   por dispositivo já vêm de graça e viajam no perfil pelo Drive.
   ========================================================================== */
(() => {
  'use strict';
  const C = window.BorionChartsStudioCore;
  const D = window.BorionChartsStudioData;
  const R = window.BorionChartsStudioRender;
  if(!C || !D || !R) return;

  const SCOPE = C.CS_SCOPE;

  const PRESETS = [
    {titulo:'Receita × Despesa por mês', fonte:'fluxo', dim:'mes', metrica:'soma', visual:'coluna_agrupada', periodo:'ultimos12'},
    {titulo:'Quanto eu recebi (12 meses)', fonte:'receita', dim:'mes', metrica:'soma', visual:'area', periodo:'ultimos12'},
    {titulo:'Evolução das reservas', fonte:'reservas', dim:'mes', metrica:'soma', visual:'linha_suave', periodo:'ultimos12'},
    {titulo:'Quanto tenho em cada reserva', fonte:'reservas', dim:'reserva', metrica:'soma', visual:'donut', periodo:'mes_atual'},
    {titulo:'Onde eu mais gasto', fonte:'despesa_total', dim:'categoria', metrica:'soma', visual:'barra_ranking', periodo:'ultimos6'},
    {titulo:'Gastos por forma de pagamento', fonte:'despesa_variavel', dim:'forma', metrica:'soma', visual:'pizza', periodo:'ultimos3'},
    {titulo:'Resultado acumulado do ano', fonte:'resultado', dim:'mes', metrica:'acumulado', visual:'waterfall', periodo:'ano_atual'},
    {titulo:'Saldo em cada conta', fonte:'saldo_contas', dim:'banco', metrica:'soma', visual:'treemap', periodo:'mes_atual'},
    {titulo:'Categorias: agora x período anterior', fonte:'despesa_variavel', dim:'categoria', metrica:'soma', visual:'tabela', periodo:'ultimos3', comparar:true},
    {titulo:'Patrimônio mês a mês', fonte:'patrimonio', dim:'mes', metrica:'soma', visual:'linha', periodo:'ultimos12'},
    {titulo:'Dívida de cartão', fonte:'dividas', dim:'mes', metrica:'soma', visual:'coluna', periodo:'ultimos6'},
    {titulo:'Em que dia da semana eu gasto', fonte:'despesa_variavel', dim:'dia_semana', metrica:'soma', visual:'radar', periodo:'ultimos6'}
  ];

  /* ---------------- descrição legível de um gráfico ---------------- */

  function subtitleOf(cfg){
    const periodo = (C.PERIOD_PRESETS.find(p=>p.id===cfg.periodo) || {label:'Período'}).label;
    const partes = [C.sourceById(cfg.fonte).label, C.dimById(cfg.dim).label.toLowerCase(), periodo];
    if(cfg.metrica!=='soma') partes.splice(2, 0, C.metricById(cfg.metrica).label.toLowerCase());
    return partes.join(' · ');
  }

  function autoTitle(cfg){
    return cfg.titulo && cfg.titulo.trim()
      ? cfg.titulo.trim()
      : C.sourceById(cfg.fonte).label+' — '+C.dimById(cfg.dim).label.toLowerCase();
  }

  /* ---------------- cartão de um gráfico ---------------- */

  function chartCardHTML(cfg){
    let inner = '';
    try{
      const view = D.buildDatasetCached(cfg);
      inner = R.renderVisual(view);
    }catch(err){
      console.warn('[BORION][CHARTS_STUDIO][DATASET_FAIL]', cfg && cfg.id, err);
      inner = `<div class="cs-empty-chart">Não foi possível montar este gráfico. Edite as opções para corrigir.</div>`;
    }
    return `<div class="panel-box cs-card" data-cs-chart="${esc(cfg.id)}">
      <div class="cs-card-head">
        <div class="cs-card-title">
          <b>${esc(autoTitle(cfg))}</b>
          <small>${esc(subtitleOf(cfg))}</small>
        </div>
        <div class="cs-card-actions">
          <button type="button" class="cs-icon-btn" title="Editar gráfico" aria-label="Editar gráfico" onclick="ChartsStudio.edit('${esc(cfg.id)}')">✎</button>
          <button type="button" class="cs-icon-btn" title="Duplicar gráfico" aria-label="Duplicar gráfico" onclick="ChartsStudio.duplicate('${esc(cfg.id)}')">⧉</button>
          <button type="button" class="cs-icon-btn danger" title="Excluir gráfico" aria-label="Excluir gráfico" onclick="ChartsStudio.remove('${esc(cfg.id)}')">×</button>
        </div>
      </div>
      <div class="cs-card-body">${inner}</div>
    </div>`;
  }

  /* ---------------- painel completo ---------------- */

  function renderStudio(){
    const list = C.charts();
    const catalog = list.map(c=>({id:c.id, label:autoTitle(c), defaultW:defaultWidthFor(c)}));

    let visible = catalog, columns = 3, editing = false, freePlacement = false, freeReady = true;
    if(window.ModuleLayout && catalog.length){
      ModuleLayout.register(SCOPE, catalog);
      visible = ModuleLayout.visibleItems(SCOPE, catalog);
      columns = ModuleLayout.get(SCOPE).columns;
      editing = ModuleLayout.isActive(SCOPE);
      freePlacement = ModuleLayout.isFreePlacement(SCOPE);
      freeReady = !freePlacement || ModuleLayout.hasCompleteFreeLayout(SCOPE, visible);
    }

    const slots = visible.map(item=>{
      const cfg = C.chartById(item.id);
      if(!cfg) return '';
      const style = window.ModuleLayout ? ModuleLayout.slotStyle(SCOPE, item.id, item.defaultW) : `--module-span:${item.defaultW};`;
      const controls = window.ModuleLayout ? ModuleLayout.slotControlsHTML(SCOPE, item.id, item.label, item.defaultW) : '';
      const resize = window.ModuleLayout ? ModuleLayout.resizeHandleHTML(SCOPE, item.id, item.label) : '';
      return `<section class="module-layout-slot cs-slot ${editing?'organizing':''}" data-module-id="${esc(item.id)}" style="${style}">${controls}<div class="module-layout-content">${chartCardHTML(cfg)}</div>${resize}</section>`;
    }).join('');

    if(window.ModuleLayout && catalog.length) ModuleLayout.schedule(SCOPE);

    const layoutToolbar = (window.ModuleLayout && catalog.length) ? ModuleLayout.toolbarHTML(SCOPE, 'Personalização do painel de gráficos') : '';
    const header = `<div class="cs-topbar">
      <div class="cs-topbar-copy">
        <h3>Estúdio de gráficos</h3>
        <p class="desc">Monte o gráfico que você quiser cruzando fonte, recorte, métrica e visual. Clique em qualquer ponto para ver os lançamentos por trás do número.</p>
      </div>
      <div class="cs-topbar-actions">
        <button class="btn-outline btn-sm" onclick="ChartsStudio.openPresets()">Modelos prontos</button>
        <button class="btn btn-primary btn-sm" onclick="ChartsStudio.create()">+ Novo gráfico</button>
      </div>
    </div>`;

    if(!list.length){
      return header + `<div class="panel-box cs-onboarding">
        <div class="cs-onboarding-art">${emptyArtSVG()}</div>
        <h4>Seu painel está em branco — do jeito certo</h4>
        <p class="desc">Nada aqui vem pronto: cada gráfico é montado por você. Comece por um modelo e depois ajuste o que quiser, ou monte do zero.</p>
        <div class="cs-onboarding-actions">
          <button class="btn btn-primary" onclick="ChartsStudio.openPresets()">Começar por um modelo</button>
          <button class="btn-outline" onclick="ChartsStudio.create()">Montar do zero</button>
        </div>
      </div>`;
    }

    const grid = `<div class="module-layout-grid cs-grid ${editing?'module-grid-organizer':''} ${freePlacement?'module-free-placement':''} ${freePlacement&&!freeReady?'module-free-bootstrap':''}" data-module-layout="${SCOPE}" data-free-placement="${freePlacement?'true':'false'}" style="--module-columns:${columns};">${slots}</div>`;
    return header + layoutToolbar + grid;
  }

  function defaultWidthFor(cfg){
    const v = cfg.visual;
    if(v==='kpi' || v==='sparkline' || v==='gauge') return 1;
    if(v==='tabela' || v==='tabela_ranking' || v==='heatmap' || v==='area_empilhada') return 3;
    return 2;
  }

  function emptyArtSVG(){
    return `<svg viewBox="0 0 220 110" width="200" height="100" fill="none" aria-hidden="true">
      <rect x="12" y="62" width="26" height="38" rx="6" fill="#c9a45c" opacity=".5"/>
      <rect x="50" y="42" width="26" height="58" rx="6" fill="#c9a45c" opacity=".72"/>
      <rect x="88" y="24" width="26" height="76" rx="6" fill="#c9a45c"/>
      <rect x="126" y="52" width="26" height="48" rx="6" fill="#22c55e" opacity=".62"/>
      <rect x="164" y="34" width="26" height="66" rx="6" fill="#4d82ff" opacity=".62"/>
      <path d="M12 30 L60 18 L104 26 L152 8 L200 16" stroke="#e8c98a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>
    </svg>`;
  }

  /* ---------------- montador ---------------- */

  let draft = null;

  function fieldOptions(list, current, labelKey){
    return list.map(item=>`<option value="${esc(item.id)}" ${String(item.id)===String(current)?'selected':''}>${esc(item[labelKey||'label'])}</option>`).join('');
  }

  function visualOptions(current){
    const groups = {};
    C.VISUALS.forEach(v=>{ (groups[v.group] = groups[v.group] || []).push(v); });
    return Object.keys(groups).map(g=>`<optgroup label="${esc(g)}">${groups[g].map(v=>`<option value="${esc(v.id)}" ${v.id===current?'selected':''}>${esc(v.label)}</option>`).join('')}</optgroup>`).join('');
  }

  function builderHTML(){
    const cfg = draft;
    const dims = C.dimsForSource(cfg.fonte).map(id=>C.dimById(id));
    const paletas = Object.keys(C.PALETTES).map(k=>({id:k, label:k.charAt(0).toUpperCase()+k.slice(1)}));
    return `<div class="modal-overlay cs-builder-overlay">
      <div class="modal-box cs-builder-box">
        <div class="modal-head"><h2>${cfg.__editing?'Editar gráfico':'Novo gráfico'}</h2><button id="cs_builder_close">&times;</button></div>
        <div class="cs-builder-grid">
          <div class="cs-builder-form">
            <div class="field"><label>Título (opcional)</label><input type="text" id="cs_f_titulo" value="${esc(cfg.titulo||'')}" placeholder="${esc(autoTitle(cfg))}"></div>
            <div class="field"><label>1 · O que mostrar (fonte)</label><select id="cs_f_fonte">${fieldOptions(C.SOURCES, cfg.fonte)}</select></div>
            <div class="field"><label>2 · Como separar (recorte)</label><select id="cs_f_dim">${fieldOptions(dims, cfg.dim)}</select></div>
            <div class="field"><label>3 · Qual conta (métrica)</label><select id="cs_f_metrica">${fieldOptions(C.METRICS, cfg.metrica)}</select></div>
            <div class="field"><label>4 · Como desenhar (visual)</label><select id="cs_f_visual">${visualOptions(cfg.visual)}</select></div>
            <div class="field"><label>5 · Período</label><select id="cs_f_periodo">${fieldOptions(C.PERIOD_PRESETS, cfg.periodo)}</select></div>
            <div class="cs-builder-row">
              <div class="field"><label>Máximo de fatias</label><select id="cs_f_top">${[5,8,10,12,20,50].map(n=>`<option value="${n}" ${Number(cfg.top)===n?'selected':''}>${n}</option>`).join('')}</select></div>
              <div class="field"><label>Cores</label><select id="cs_f_paleta">${fieldOptions(paletas, cfg.paleta)}</select></div>
            </div>
            <div class="cs-builder-checks">
              <label class="cs-check"><input type="checkbox" id="cs_f_comparar" ${cfg.comparar?'checked':''}> Comparar com o período anterior</label>
              <label class="cs-check"><input type="checkbox" id="cs_f_valores" ${cfg.mostrarValores!==false?'checked':''}> Mostrar os valores no gráfico</label>
              <label class="cs-check"><input type="checkbox" id="cs_f_legenda" ${cfg.mostrarLegenda!==false?'checked':''}> Mostrar legenda</label>
            </div>
          </div>
          <div class="cs-builder-preview">
            <div class="cs-preview-label">Pré-visualização ao vivo</div>
            <div class="panel-box cs-preview-card" id="cs_preview"></div>
          </div>
        </div>
        <div class="row-btns cs-builder-footer">
          <button class="btn btn-primary btn-block" id="cs_builder_save">${cfg.__editing?'Salvar alterações':'Adicionar ao painel'}</button>
        </div>
      </div>
    </div>`;
  }

  function readDraftFromForm(){
    const get = id => document.getElementById(id);
    if(get('cs_f_titulo')) draft.titulo = get('cs_f_titulo').value;
    if(get('cs_f_fonte')) draft.fonte = get('cs_f_fonte').value;
    if(get('cs_f_dim')) draft.dim = get('cs_f_dim').value;
    if(get('cs_f_metrica')) draft.metrica = get('cs_f_metrica').value;
    if(get('cs_f_visual')) draft.visual = get('cs_f_visual').value;
    if(get('cs_f_periodo')) draft.periodo = get('cs_f_periodo').value;
    if(get('cs_f_top')) draft.top = Number(get('cs_f_top').value)||8;
    if(get('cs_f_paleta')) draft.paleta = get('cs_f_paleta').value;
    if(get('cs_f_comparar')) draft.comparar = get('cs_f_comparar').checked;
    if(get('cs_f_valores')) draft.mostrarValores = get('cs_f_valores').checked;
    if(get('cs_f_legenda')) draft.mostrarLegenda = get('cs_f_legenda').checked;
    /* Se o recorte atual não existe para a fonte escolhida, volta para o primeiro
       válido — nunca deixa o rascunho num estado impossível de desenhar. */
    const allowed = C.dimsForSource(draft.fonte);
    if(allowed.indexOf(draft.dim)<0) draft.dim = allowed[0];
  }

  function refreshPreview(){
    const host = document.getElementById('cs_preview');
    if(!host) return;
    try{
      const view = D.buildDataset(draft);
      host.innerHTML = `<div class="cs-card-title preview"><b>${esc(autoTitle(draft))}</b><small>${esc(subtitleOf(draft))}</small></div>` + R.renderVisual(view);
    }catch(err){
      host.innerHTML = `<div class="cs-empty-chart">Combinação inválida. Ajuste o recorte ou a métrica.</div>`;
    }
  }

  function refreshDimOptions(){
    const select = document.getElementById('cs_f_dim');
    if(!select) return;
    const dims = C.dimsForSource(draft.fonte).map(id=>C.dimById(id));
    select.innerHTML = fieldOptions(dims, draft.dim);
  }

  function openBuilder(cfg, editing){
    draft = Object.assign(C.defaultChart(), cfg||{});
    draft.__editing = !!editing;
    const root = document.getElementById('modal-root');
    if(!root) return;
    root.innerHTML = '';
    const box = el(builderHTML());
    root.appendChild(box);
    if(typeof attachModalGuard==='function') attachModalGuard(box);

    const close = document.getElementById('cs_builder_close');
    if(close) close.onclick = ()=>{ draft = null; closeModal(); };

    ['cs_f_titulo','cs_f_fonte','cs_f_dim','cs_f_metrica','cs_f_visual','cs_f_periodo','cs_f_top','cs_f_paleta','cs_f_comparar','cs_f_valores','cs_f_legenda'].forEach(id=>{
      const node = document.getElementById(id);
      if(!node) return;
      const evt = node.tagName==='SELECT' || node.type==='checkbox' ? 'change' : 'input';
      node.addEventListener(evt, ()=>{
        const wasSource = id==='cs_f_fonte';
        readDraftFromForm();
        if(wasSource) refreshDimOptions();
        refreshPreview();
      });
    });

    const save = document.getElementById('cs_builder_save');
    if(save) save.onclick = ()=>{
      readDraftFromForm();
      const st = C.store(true);
      if(!st) return;
      const clean = Object.assign({}, draft);
      delete clean.__editing;
      const idx = st.charts.findIndex(c=>String(c.id)===String(clean.id));
      if(idx>=0) st.charts[idx] = clean;
      else st.charts.push(clean);
      draft = null;
      C.persist();
      closeModal();
      if(typeof renderView==='function') renderView();
      if(typeof toast==='function') toast(idx>=0 ? 'Gráfico atualizado.' : 'Gráfico adicionado ao painel.');
    };

    refreshPreview();
  }

  /* ---------------- modelos prontos ---------------- */

  function openPresets(){
    const root = document.getElementById('modal-root');
    if(!root) return;
    const cards = PRESETS.map((p,i)=>`<button type="button" class="cs-preset-card" data-cs-preset="${i}">
      <b>${esc(p.titulo)}</b>
      <small>${esc(subtitleOf(C.defaultChart(p)))}</small>
    </button>`).join('');
    root.innerHTML = '';
    const box = el(`<div class="modal-overlay">
      <div class="modal-box cs-presets-box">
        <div class="modal-head"><h2>Modelos prontos</h2><button id="cs_presets_close">&times;</button></div>
        <p class="desc">Escolha um modelo para começar. Ele entra no painel na hora e continua totalmente editável.</p>
        <div class="cs-preset-grid">${cards}</div>
        <div class="row-btns" style="margin-top:12px;"><button class="btn-outline btn-block" id="cs_presets_all">Adicionar todos os modelos</button></div>
      </div>
    </div>`);
    root.appendChild(box);
    if(typeof attachModalGuard==='function') attachModalGuard(box);
    const close = document.getElementById('cs_presets_close');
    if(close) close.onclick = closeModal;
    box.querySelectorAll('[data-cs-preset]').forEach(btn=>{
      btn.onclick = ()=>{
        const preset = PRESETS[Number(btn.getAttribute('data-cs-preset'))];
        closeModal();
        openBuilder(C.defaultChart(preset), false);
      };
    });
    const all = document.getElementById('cs_presets_all');
    if(all) all.onclick = ()=>{
      const st = C.store(true);
      if(!st) return;
      PRESETS.forEach(p=>st.charts.push(C.defaultChart(p)));
      C.persist();
      closeModal();
      if(typeof renderView==='function') renderView();
      if(typeof toast==='function') toast(PRESETS.length+' gráficos adicionados.');
    };
  }

  /* ---------------- detalhamento (clique no gráfico) ---------------- */

  function drilldownRows(query){
    if(!query || !query.fonte) return [];
    const src = C.sourceById(query.fonte);
    if(src.kind!=='rows') return [];
    let rows = C.rowsFor(query.fonte, query.months||[]);
    if(query.dim && query.bucket!=null){
      if(String(query.bucket).indexOf('Outros (')===0) return rows;
      rows = rows.filter(r=>C.bucketKeyFor(r, query.dim)===query.bucket);
    }
    return rows.sort((a,b)=>String(b.data).localeCompare(String(a.data)));
  }

  function openDrilldown(chartId, si, i){
    const cfg = C.chartById(chartId);
    if(!cfg) return;
    let view;
    try{ view = D.buildDatasetCached(cfg); }catch(e){ return; }
    const point = view.points.find(p=>p.si===si && p.i===i);
    if(!point) return;
    const rows = drilldownRows(point.query);
    const total = rows.reduce((a,r)=>a+r.valor, 0);
    const listHTML = rows.length
      ? `<div class="cs-drill-list">${rows.slice(0,200).map(r=>`<div class="cs-drill-row">
          <div class="cs-drill-main"><b>${esc(r.nome)}</b><small>${esc(r.categoria)} · ${esc(formatDateBR(r.data))}${r.forma?' · '+esc(r.forma):''}</small></div>
          <div class="cs-drill-value">${esc(D.fmtValue(r.valor,'money'))}</div>
        </div>`).join('')}${rows.length>200?`<div class="desc" style="padding:8px 2px;">Mostrando os 200 mais recentes de ${rows.length}.</div>`:''}</div>`
      : `<div class="cs-empty-chart">Este ponto vem de um saldo consolidado, não de lançamentos individuais.</div>`;
    const root = document.getElementById('modal-root');
    if(!root) return;
    root.innerHTML = '';
    const box = el(`<div class="modal-overlay">
      <div class="modal-box cs-drill-box">
        <div class="modal-head"><h2>${esc(point.label)}</h2><button id="cs_drill_close">&times;</button></div>
        <div class="cs-drill-summary">
          <div><span>${esc(point.serie)}</span><b>${esc(D.fmtValue(point.value, view.format))}</b></div>
          ${rows.length?`<div><span>Lançamentos</span><b>${rows.length}</b></div><div><span>Soma</span><b>${esc(D.fmtValue(total,'money'))}</b></div>`:''}
        </div>
        ${listHTML}
      </div>
    </div>`);
    root.appendChild(box);
    if(typeof attachModalGuard==='function') attachModalGuard(box);
    const close = document.getElementById('cs_drill_close');
    if(close) close.onclick = closeModal;
  }

  function formatDateBR(iso){
    const s = String(iso||'');
    if(!/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
    return s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4);
  }

  /* ---------------- tooltip e cliques ---------------- */

  function tooltipNode(){
    let node = document.getElementById('cs-tooltip');
    if(!node){
      node = document.createElement('div');
      node.id = 'cs-tooltip';
      node.className = 'cs-tooltip';
      node.hidden = true;
      document.body.appendChild(node);
    }
    return node;
  }

  function hideTooltip(){
    if(window.BorionChartTooltips){ window.BorionChartTooltips.hideAll(); return; }
    const n=document.getElementById('cs-tooltip');
    if(n){n.hidden=true;n.style.left='';n.style.top='';}
  }

  function pointInfo(host, hit){
    const chartId = host.getAttribute('data-cs-chart');
    const cfg = C.chartById(chartId);
    if(!cfg) return null;
    const parts = String(hit.getAttribute('data-cs-point')||'').split(':');
    const si = Number(parts[0])||0, i = Number(parts[1])||0;
    let view;
    try{ view = D.buildDatasetCached(cfg); }catch(e){ return null; }
    const point = view.points.find(p=>p.si===si && p.i===i);
    return point ? {chartId, si, i, point, view} : null;
  }

  function wireEvents(){
    if(window.__borionChartsStudioWired) return;
    window.__borionChartsStudioWired = true;

    document.addEventListener('pointermove', ev=>{
      const hit = ev.target && ev.target.closest ? ev.target.closest('.cs-hit') : null;
      if(!hit){ hideTooltip(); return; }
      const host = hit.closest('[data-cs-chart]');
      if(!host){ hideTooltip(); return; }
      const info = pointInfo(host, hit);
      if(!info){ hideTooltip(); return; }
      const node = tooltipNode();
      node.innerHTML = `<b>${esc(info.point.label)}</b><span>${esc(info.point.serie)}</span><em>${esc(D.fmtValue(info.point.value, info.view.format))}</em>`;
      node.hidden = false;
      const pad = 14;
      const w = node.offsetWidth || 160, h = node.offsetHeight || 54;
      let x = ev.clientX + pad, y = ev.clientY - h - pad;
      if(x + w > window.innerWidth - 8) x = ev.clientX - w - pad;
      if(y < 8) y = ev.clientY + pad;
      node.style.left = x+'px';
      node.style.top = y+'px';
    }, {passive:true});

    document.addEventListener('pointerleave', hideTooltip, true);
    document.addEventListener('pointerdown', hideTooltip, true);
    document.addEventListener('keydown', ev=>{if(ev.key==='Escape'||ev.key==='Tab')hideTooltip();}, true);
    document.addEventListener('visibilitychange', ()=>{if(document.hidden)hideTooltip();});
    window.addEventListener('blur', hideTooltip);
    window.addEventListener('resize', hideTooltip, {passive:true});
    window.addEventListener('scroll', hideTooltip, {passive:true,capture:true});

    document.addEventListener('click', ev=>{
      const hit = ev.target && ev.target.closest ? ev.target.closest('.cs-hit') : null;
      if(!hit) return;
      const host = hit.closest('[data-cs-chart]');
      if(!host) return;
      /* No modo de edição do layout o clique é para arrastar, não para abrir. */
      if(window.ModuleLayout && ModuleLayout.isActive(SCOPE)) return;
      const parts = String(hit.getAttribute('data-cs-point')||'').split(':');
      hideTooltip();
      openDrilldown(host.getAttribute('data-cs-chart'), Number(parts[0])||0, Number(parts[1])||0);
    });
  }

  /* ---------------- API pública ---------------- */

  const ChartsStudio = {
    render(){ hideTooltip(); wireEvents(); D.clearCache(); return renderStudio(); },
    create(){ openBuilder(C.defaultChart(), false); },
    edit(id){ const cfg = C.chartById(id); if(cfg) openBuilder(Object.assign({}, cfg), true); },
    duplicate(id){
      const cfg = C.chartById(id);
      const st = C.store(true);
      if(!cfg || !st) return;
      const copy = Object.assign({}, cfg, {id:(typeof uid==='function'?uid():'cs_'+Date.now()), titulo:autoTitle(cfg)+' (cópia)', criadoEm:Date.now()});
      st.charts.push(copy);
      C.persist();
      if(typeof renderView==='function') renderView();
      if(typeof toast==='function') toast('Gráfico duplicado.');
    },
    remove(id){
      const cfg = C.chartById(id);
      if(!cfg) return;
      const run = ()=>{
        const st = C.store(true);
        if(!st) return;
        st.charts = st.charts.filter(c=>String(c.id)!==String(id));
        C.persist();
        if(typeof renderView==='function') renderView();
        if(typeof toast==='function') toast('Gráfico excluído.');
      };
      const texto = 'O gráfico "'+autoTitle(cfg)+'" será removido do painel. Nenhum lançamento é apagado.';
      if(typeof openConfirmModal==='function') openConfirmModal({title:'Excluir gráfico', text:texto, confirmLabel:'Excluir', cancelLabel:'Cancelar', variant:'danger', onConfirm:run});
      else run();
    },
    openPresets,
    openBuilder,
    PRESETS
  };

  window.ChartsStudio = ChartsStudio;
  window.renderChartsStudio = function(){ return ChartsStudio.render(); };
})();
