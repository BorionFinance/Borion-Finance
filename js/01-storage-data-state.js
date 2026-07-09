/* Borion Finance — Storage/localStorage, perfis, categorias padrão, dados iniciais, migração e estado global. */

/* ---------------- Storage layer ---------------- */
const LS_CONFIG = 'mc_config';
const LS_PROFILES = 'mc_profiles';
const LS_SESSION = 'mc_session';
const LS_DATA_PREFIX = 'mc_data_';

const APP_NAME = 'Borion Finance';
/* V5.36.0 — id fixo da conta "Carteira" (dinheiro físico). Nunca muda entre migrações,
   nunca é excluída pelo usuário e serve para diferenciar dinheiro físico de banco/cartão. */
const CARTEIRA_CONTA_ID = 'carteira-fixa';
const FORMAS_PAGAMENTO = ['Dinheiro','Pix','Débito','Crédito'];
const DEFAULT_ICON_COLORS = { liquidez:'#22c55e', bens:'#3b6bf0', investimentos:'#cca160', dividas:'#ef4444', receita:'#22c55e', despesas:'#ef4444', investir:'#3b6bf0', saldo:'#eef1f4' };
const ICON_COLOR_LABELS = { liquidez:'Liquidez', bens:'Bens', investimentos:'Investimentos', dividas:'Dívidas', receita:'Receita', despesas:'Despesas', investir:'Investir', saldo:'Saldo' };
const FONT_STACKS = {
  default: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
  elegante: 'Georgia,"Times New Roman",serif',
  moderna: '"Trebuchet MS",Verdana,sans-serif',
  arredondada: 'Verdana,Geneva,sans-serif',
  mono: 'Consolas,"Courier New",monospace'
};
const FONT_LABELS = { default:'Padrão', elegante:'Elegante (serifada)', moderna:'Moderna', arredondada:'Arredondada', mono:'Monoespaçada' };

/* Tipos de origem de receita: separa dinheiro próprio de reembolso/repasse de terceiros. */
const TX_ORIGEM_LABELS = { propria:'Receita própria', reembolso:'Reembolso recebido', repasse:'Repasse de terceiros' };
const TX_ORIGEM_OPTIONS = ['Receita própria','Reembolso recebido','Repasse de terceiros'];
function txOrigemToKey(label){
  if(label==='Reembolso recebido') return 'reembolso';
  if(label==='Repasse de terceiros') return 'repasse';
  return 'propria';
}
function txOrigemToLabel(key){ return TX_ORIGEM_LABELS[key] || TX_ORIGEM_LABELS.propria; }

const DEFAULT_PROFILE_COLORS = ['#1f8a5b','#7c5cff','#c9a45c','#2563eb','#be123c','#0f766e','#9333ea','#ea580c'];
const DEFAULT_MODULES = { reserves:true, imports:true };
const DEFAULT_DASHBOARD_WIDGETS = ['fluxoMensal','evolucaoPatrimonio','evolucaoDividasCartao','distribuicaoPatrimonio','gastosCategoria','gastosCartao','distribuicaoBanco','resumoBanco'];
const DASHBOARD_WIDGET_LABELS = {
  fluxoMensal:'Fluxo mensal',
  evolucaoPatrimonio:'Evolução do patrimônio',
  evolucaoDividasCartao:'Evolução das dívidas (cartões + boletos)',
  distribuicaoPatrimonio:'Distribuição de patrimônio',
  gastosCategoria:'Gastos por categoria',
  gastosCartao:'Gastos por cartão',
  distribuicaoBanco:'Distribuição por banco',
  resumoBanco:'Resumo por banco'
};

function readJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(raw==null) return fallback;
    return JSON.parse(raw);
  }catch(e){ return fallback; }
}
function writeJSON(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch(e){ console.error('Storage error', e); return false; }
}

function getConfig(){
  const stored = readJSON(LS_CONFIG, {});
  return {
    iconColors: Object.assign({}, DEFAULT_ICON_COLORS, stored.iconColors||{}),
    font: stored.font || 'default',
    theme: stored.theme || 'dark',
    popupNotifs: Object.assign({enabled:true, durationMs:40000}, stored.popupNotifs||{})
  };
}
function setConfig(cfg){ writeJSON(LS_CONFIG, cfg); }
function applyFont(){ document.body.style.fontFamily = FONT_STACKS[S.config.font] || FONT_STACKS.default; }
function applyTheme(){
  const choice = (S && S.config && S.config.theme) || 'dark';
  const resolved = choice==='system'
    ? ((window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark')
    : choice;
  document.documentElement.setAttribute('data-theme', resolved==='light'?'light':'dark');
  document.documentElement.setAttribute('data-theme-choice', choice);
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', resolved==='light' ? '#f7f2e7' : '#060a10');
}
function iconColor(key){ return (S.config.iconColors && S.config.iconColors[key]) || '#8b969f'; }
function hexToRgba(hex, alpha){
  hex = String(hex).replace('#','');
  if(hex.length===3) hex = hex.split('').map(c=>c+c).join('');
  const r=parseInt(hex.substr(0,2),16)||0, g=parseInt(hex.substr(2,2),16)||0, b=parseInt(hex.substr(4,2),16)||0;
  return `rgba(${r},${g},${b},${alpha})`;
}
function badgeHTML(key, emoji){
  const c = iconColor(key);
  return `<span class="badge" style="background:${hexToRgba(c,.15)};color:${c}">${emoji}</span>`;
}
/* Etiqueta translúcida colorida usada nos cards de destaque (Patrimônio, Lançamentos) no lugar
   de um ícone pequeno isolado. Usa a cor configurável de iconColor(key) para manter o mesmo
   padrão visual em todas as telas que exibem cards de indicadores. */
function tagBadgeHTML(key, label){
  const c = iconColor(key);
  return `<span class="tag-badge" style="color:${c};background:${hexToRgba(c,.14)};border-color:${hexToRgba(c,.36)};box-shadow:0 0 0 1px ${hexToRgba(c,.08)} inset,0 6px 16px ${hexToRgba(c,.16)};">${esc(label)}</span>`;
}

function profileAvatarBg(profile){ return (profile && profile.avatarColor) || avatarColor((profile && profile.name) || 'Perfil'); }
function profileAvatarHTML(profile, extraClass=''){
  const p = profile || {};
  const cls = ('profile-avatar '+extraClass).trim();
  if(p.avatarImage){
    const img = String(p.avatarImage).replace(/"/g,'&quot;');
    return `<div class="${cls} has-photo" style="background-image:url(&quot;${img}&quot;)"></div>`;
  }
  return `<div class="${cls}" style="background:${profileAvatarBg(p)}">${esc(initials(p.name||'Perfil'))}</div>`;
}

function getProfiles(){ return readJSON(LS_PROFILES, []); }
function setProfiles(list){ writeJSON(LS_PROFILES, list); }

function getSession(){ return readJSON(LS_SESSION, null); }
function setSession(s){ if(s) writeJSON(LS_SESSION, s); else localStorage.removeItem(LS_SESSION); }

function getProfileData(id){ return readJSON(LS_DATA_PREFIX+id, null); }
function setProfileData(id, data){
  writeJSON(LS_DATA_PREFIX+id, data);
  // V5.34.1 — os dados financeiros do perfil agora também são gravados "de
  // verdade" no IndexedDB (armazenamento durável e com mais espaço). O
  // localStorage continua recebendo a mesma escrita para servir de cache
  // rápido/síncrono para a UI, mas deixa de ser o único lugar onde os dados existem.
  idbSetProfileData(id, data);
}

/* ---------------- IndexedDB: armazenamento principal dos dados financeiros por perfil ----------------
   Config simples (mc_config, mc_session, mc_profiles) permanecem só no localStorage.
   Os dados financeiros de cada perfil (antes só em mc_data_<id> no localStorage) agora
   são persistidos no IndexedDB via write-through: toda chamada de setProfileData grava
   nos dois lugares. A leitura da UI continua síncrona via localStorage (getProfileData)
   para não travar a renderização, mas nos pontos de entrada de um perfil (login local,
   troca de perfil, carregamento offline da nuvem) o app tenta primeiro hidratar a partir
   do IndexedDB com hydrateProfileDataFromIDB(id), que é a fonte mais durável. */
const BORION_IDB_DATA_NAME = 'borion_findata_v1';
const BORION_IDB_DATA_STORE = 'profile_data';
function borionDataIdbOpen(){
  return new Promise((resolve, reject)=>{
    if(!('indexedDB' in window)){ reject(new Error('IndexedDB indisponível neste navegador.')); return; }
    const req = indexedDB.open(BORION_IDB_DATA_NAME, 1);
    req.onupgradeneeded = ()=>{ if(!req.result.objectStoreNames.contains(BORION_IDB_DATA_STORE)) req.result.createObjectStore(BORION_IDB_DATA_STORE); };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}
async function idbGetProfileData(id){
  if(!id) return null;
  try{
    const db = await borionDataIdbOpen();
    return await new Promise((resolve, reject)=>{
      const tx = db.transaction(BORION_IDB_DATA_STORE, 'readonly');
      const rq = tx.objectStore(BORION_IDB_DATA_STORE).get(id);
      rq.onsuccess = ()=> resolve(rq.result!=null ? rq.result : null);
      rq.onerror = ()=> reject(rq.error);
    });
  }catch(e){ console.warn('IndexedDB (leitura) indisponível, usando localStorage:', e); return null; }
}
async function idbSetProfileData(id, data){
  if(!id) return false;
  try{
    const db = await borionDataIdbOpen();
    let safe; try{ safe = JSON.parse(JSON.stringify(data)); }catch(e){ safe = data; }
    return await new Promise((resolve, reject)=>{
      const tx = db.transaction(BORION_IDB_DATA_STORE, 'readwrite');
      tx.objectStore(BORION_IDB_DATA_STORE).put(safe, id);
      tx.oncomplete = ()=> resolve(true);
      tx.onerror = ()=> reject(tx.error);
    });
  }catch(e){ console.warn('IndexedDB (escrita) indisponível — os dados continuam salvos no localStorage:', e); return false; }
}
async function idbDeleteProfileData(id){
  if(!id) return false;
  try{
    const db = await borionDataIdbOpen();
    return await new Promise((resolve, reject)=>{
      const tx = db.transaction(BORION_IDB_DATA_STORE, 'readwrite');
      tx.objectStore(BORION_IDB_DATA_STORE).delete(id);
      tx.oncomplete = ()=> resolve(true);
      tx.onerror = ()=> reject(tx.error);
    });
  }catch(e){ return false; }
}
/* Tenta trazer os dados mais atuais do IndexedDB para um perfil. Se existir,
   também atualiza o cache síncrono do localStorage. Retorna os dados já
   migrados (migrateData) ou null se não houver nada gravado ainda no IndexedDB. */
async function hydrateProfileDataFromIDB(id){
  const idbData = await idbGetProfileData(id);
  if(idbData){
    writeJSON(LS_DATA_PREFIX+id, idbData);
    return migrateData(idbData);
  }
  return null;
}

/* ---------------- Password hashing (client-side, basic) ---------------- */
async function sha256Hex(str){
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function randomSalt(){return Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b=>b.toString(16).padStart(2,'0')).join('');}
async function hashPassword(pw, salt){ return sha256Hex(salt+'::'+pw); }

/* ---------------- Default categories & empty initial data ---------------- */
function defaultCategories(){
  return {
    receita: ['Salário','Renda Extra','Investimentos','Reembolsos','Outro'],
    fixa: ['Moradia','Contas Fixas','Assinaturas','Educação','Saúde','Transporte','Seguros','Impostos','Outro'],
    variavel: ['Alimentação','Mercado','Lazer','Transporte','Saúde','Compras','Roupas','Educação','Casa','Veículo','Presentes','Viagens','Outro']
  };
}

/* Dados de demonstração removidos: todo perfil novo começa em branco. */

function emptyData(){
  return {
    categorias: defaultCategories(),
    categoryColors: {receita:{}, fixa:{}, variavel:{}},
    investirPlanejado: {},
    transacoes: [],
    fixas: [],
    liquidez: [],
    bens: [],
    investimentos:{emCaixa:[],ativos:[]},
    contas: [],
    cartoes: [],
    boletos: [],
    transferencias: [],
    agenda: [],
    metas: [],
    notificacoes: [],
    patrimonioHistorico: {},
    cheques: { enabled:false, items:[] },
    modules: Object.assign({}, DEFAULT_MODULES),
    dashboard: { widgets: DEFAULT_DASHBOARD_WIDGETS.slice() },
    reservas: { enabled:true, boxes:[], moves:[] }
  };
}
function migrateData(d){
  if(!d) return emptyData();
  if(!d.categorias) d.categorias=defaultCategories();
  const _defaultCats = defaultCategories();
  ['receita','fixa','variavel'].forEach(k=>{
    if(!Array.isArray(d.categorias[k])) d.categorias[k]=(_defaultCats[k]||['Outro']).slice();
    if(!d.categorias[k].includes('Outro')) d.categorias[k].push('Outro');
  });
  if(!d.categoryColors) d.categoryColors={};
  ['receita','fixa','variavel'].forEach(k=>{
    if(!d.categoryColors[k]) d.categoryColors[k]={};
    d.categorias[k].forEach(c=>{
      d.categoryColors[k][c]=normalizeHexColor(d.categoryColors[k][c], baseCatColor(c));
    });
    Object.keys(d.categoryColors[k]).forEach(c=>{ if(!d.categorias[k].includes(c)) delete d.categoryColors[k][c]; });
  });
  if(!d.fixas) d.fixas=[];
  if(!d.agenda) d.agenda=[];
  if(!d.metas) d.metas=[];
  if(!d.notificacoes) d.notificacoes=[];
  if(!d.patrimonioHistorico) d.patrimonioHistorico={};
  if(!d.cheques) d.cheques={enabled:false,items:[]};
  if(Array.isArray(d.cheques)) d.cheques={enabled:false,items:d.cheques};
  if(d.cheques.enabled==null) d.cheques.enabled=false;
  if(!Array.isArray(d.cheques.items)) d.cheques.items=[];
  if(!d.modules) d.modules=Object.assign({}, DEFAULT_MODULES);
  d.modules = Object.assign({}, DEFAULT_MODULES, d.modules||{});
  if(!d.dashboard) d.dashboard={widgets:DEFAULT_DASHBOARD_WIDGETS.slice()};
  if(!Array.isArray(d.dashboard.widgets)) d.dashboard.widgets=DEFAULT_DASHBOARD_WIDGETS.slice();
  d.dashboard.widgets = d.dashboard.widgets.filter(k=>DEFAULT_DASHBOARD_WIDGETS.includes(k));
  if(!d.reservas) d.reservas={enabled:d.modules.reserves!==false, boxes:[], moves:[]};
  if(Array.isArray(d.reservas)) d.reservas={enabled:d.modules.reserves!==false, boxes:d.reservas, moves:[]};
  if(d.reservas.enabled==null) d.reservas.enabled = d.modules.reserves!==false;
  if(!Array.isArray(d.reservas.boxes)) d.reservas.boxes=[];
  if(!Array.isArray(d.reservas.moves)) d.reservas.moves=[];
  d.modules.reserves = d.reservas.enabled!==false;
  if(!d.contas) d.contas=[];
  if(!Array.isArray(d.contas)) d.contas=[];
  if(!d.boletos) d.boletos=[];
  if(!Array.isArray(d.boletos)) d.boletos=[];
  if(!d.transferencias) d.transferencias=[];
  if(!Array.isArray(d.transferencias)) d.transferencias=[];
  // V5.36.0 — "Carteira" (dinheiro físico) é uma conta fixa que sempre precisa existir,
  // não pode ser excluída e nunca pode ser confundida com cartão de crédito. Migração
  // defensiva: cria a Carteira se ainda não existir (dado antigo) e garante a flag
  // isCarteira mesmo se o registro já existia com outro formato.
  (function ensureCarteira(){
    let carteira = d.contas.find(c=>c && (c.isCarteira || c.id===CARTEIRA_CONTA_ID));
    if(!carteira){
      carteira = { id:CARTEIRA_CONTA_ID, nome:'Carteira', tipo:'Carteira (dinheiro físico)', saldoInicial:0, rende:false, percentualRendimento:0, cor:'#cca160', icone:'💵', isCarteira:true };
      d.contas.unshift(carteira);
    } else {
      carteira.isCarteira = true;
      if(!carteira.nome) carteira.nome = 'Carteira';
      if(carteira.tipo==null) carteira.tipo = 'Carteira (dinheiro físico)';
    }
  })();
  // upgrade contas registry with the new bank/account fields
  d.contas.forEach(c=>{
    if(c.nome==null) c.nome = c.banco || 'Conta';
    if(c.tipo==null) c.tipo = 'Conta corrente';
    if(c.saldoInicial==null) c.saldoInicial = 0;
    if(c.rende==null) c.rende = false;
    if(c.percentualRendimento==null) c.percentualRendimento = 0;
    if(c.cor==null) c.cor = bankColor(c.nome);
    if(c.icone==null) c.icone = c.isCarteira ? '💵' : '◈';
  });
  // ensure banco tag field exists on every entity that can be filtered by bank
  (d.transacoes||[]).forEach(t=>{
    if(t.banco==null) t.banco='';
    // V5.29 — separa receita própria de reembolso/repasse de terceiros (não conta como renda).
    if(t.tipo==='receita' && t.origem==null) t.origem='propria';
    // V5.36.0 — forma de pagamento das despesas (dinheiro/pix/débito). Compras no crédito
    // não viram transação aqui — elas passam a existir como parcela vinculada ao cartão.
    if(t.tipo==='variavel' && t.formaPagamento==null) t.formaPagamento='Dinheiro';
  });
  (d.fixas||[]).forEach(f=>{ if(f.banco==null) f.banco=''; });
  (d.liquidez||[]).forEach(l=>{ if(l.banco==null) l.banco=''; });
  (d.bens||[]).forEach(b=>{ if(b.banco==null) b.banco=''; });
  (d.metas||[]).forEach(mt=>{ if(mt.banco==null) mt.banco=''; if(mt.reservaId===undefined) mt.reservaId=null; });
  (d.agenda||[]).forEach(a=>{ if(a.banco==null) a.banco=''; });
  (d.cheques.items||[]).forEach(ch=>{ if(ch.banco==null) ch.banco=''; });
  (d.boletos||[]).forEach(b=>{
    if(b.banco==null) b.banco='';
    if(b.status==null) b.status='Ativo';
    if(b.parcelaTotal==null) b.parcelaTotal=1;
    if(b.valorParcela==null) b.valorParcela=0;
    if(b.dataInicio==null){ const _ym=todayYM(); b.dataInicio=monthKey(_ym.y,_ym.m); }
    if(b.categoria==null) b.categoria='Outro';
    // V5.29 — histórico de pagamentos por competência (mês), para não negativar/duplicar dívida já paga.
    if(!Array.isArray(b.pagamentos)) b.pagamentos=[];
  });
  (d.reservas.boxes||[]).forEach(r=>{ if(r.banco==null) r.banco=''; if(r.valorAtual==null) r.valorAtual=0; if(r.valorMeta==null) r.valorMeta=0; if(r.status==null) r.status='Ativa'; if(r.metaId===undefined) r.metaId=null; if(r.corValor==null) r.corValor='#e8c98a'; });
  (d.reservas.moves||[]).forEach(m=>{ if(m.banco==null) m.banco=''; if(m.data==null) m.data=todayISO(); if(m.tipo==null) m.tipo='Reservar'; if(m.valor==null) m.valor=0; });
  if(d.investimentos){
    (d.investimentos.ativos||[]).forEach(a=>{ if(a.banco==null) a.banco=''; });
    (d.investimentos.emCaixa||[]).forEach(c=>{ if(c.banco==null) c.banco=''; });
  }
  // V5.29 — cartões: categoria por compra parcelada e histórico de faturas marcadas como pagas.
  (d.cartoes||[]).forEach(c=>{
    if(!Array.isArray(c.faturasPagas)) c.faturasPagas=[];
    (c.parcelas||[]).forEach(p=>{
      if(p.categoria==null) p.categoria='Outro';
      // V5.39.0 — vínculo opcional da compra no cartão com Orçamento > Despesas.
      if(p.apareceDespesas==null) p.apareceDespesas=false;
      if(p.despesaTipo==null) p.despesaTipo='variavel';
      if(p.despesaTransacaoId===undefined) p.despesaTransacaoId=null;
      if(p.despesaFixaId===undefined) p.despesaFixaId=null;
    });
  });
  // V5.39.1 — boletos: vínculo opcional com Orçamento > Despesas (mesmo mecanismo do cartão).
  (d.boletos||[]).forEach(b=>{
    if(b.apareceDespesas==null) b.apareceDespesas=false;
    if(b.despesaTipo==null) b.despesaTipo='variavel';
    if(b.despesaTransacaoId===undefined) b.despesaTransacaoId=null;
    if(b.despesaFixaId===undefined) b.despesaFixaId=null;
  });
  // V5.39.1 — correção defensiva: despesas espelhadas de compra parcelada gravadas com
  // banco:'' (bug da V5.39.0) somem da lista/total sempre que o filtro de banco/cartão
  // está ativo. Preenche o banco correto usando o cartão de origem (viaCartaoId).
  (d.transacoes||[]).forEach(t=>{
    if(t.viaParcelaId && t.viaCartaoId && !t.banco){
      const cartao = (d.cartoes||[]).find(c=>c.id===t.viaCartaoId);
      if(cartao && cartao.banco) t.banco = cartao.banco;
    }
  });
  (d.fixas||[]).forEach(f=>{
    if(f.viaParcelaId && f.viaCartaoId && !f.banco){
      const cartao = (d.cartoes||[]).find(c=>c.id===f.viaCartaoId);
      if(cartao && cartao.banco) f.banco = cartao.banco;
    }
  });
  return d;
}
function allBankNames(){
  const names = new Set();
  (S.data.contas||[]).forEach(c=>{ if(c.nome) names.add(c.nome); });
  (S.data.cartoes||[]).forEach(c=>{ if(c.banco) names.add(c.banco); });
  (S.data.boletos||[]).forEach(b=>{ if(b.banco) names.add(b.banco); });
  if(S.data.reservas){
    (S.data.reservas.boxes||[]).forEach(r=>{ if(r.banco) names.add(r.banco); });
    (S.data.reservas.moves||[]).forEach(m=>{ if(m.banco) names.add(m.banco); });
  }
  return Array.from(names).sort((a,b)=>a.localeCompare(b,'pt-BR'));
}
function bankMatches(itemBanco){
  if(!S.bankFilter || S.bankFilter.size===0) return true; // "Todos"
  return !!itemBanco && S.bankFilter.has(itemBanco);
}
function bankSelectField(idPrefix, selected){
  return {key:'banco', label:'Banco/Conta', type:'select', options:['— Nenhum —',...allBankNames()], default: selected||'— Nenhum —'};
}

/* ---------------- V5.36.0 — separação Banco/Conta vs Carteira vs Cartão de crédito ----------------
   Regra de negócio: cartão de crédito NUNCA aparece como banco/conta de origem, e banco/conta/
   carteira NUNCA aparecem como cartão. A Carteira é uma conta fixa (não pode ser excluída) que
   representa dinheiro físico e sempre existe (ver ensureCarteira em migrateData). */
function getCarteiraConta(){
  return (S.data && Array.isArray(S.data.contas)) ? (S.data.contas.find(c=>c && c.isCarteira) || null) : null;
}
/* Nomes de bancos/contas + Carteira, para lançamentos de despesa/receita, despesas fixas,
   pagamento de fatura/boleto e transferências. NUNCA inclui cartões de crédito. */
function accountSelectNames(){
  const carteira = getCarteiraConta();
  const rest = (S.data.contas||[]).filter(c=>c && !c.isCarteira && c.nome).map(c=>c.nome);
  return carteira ? [carteira.nome, ...rest] : rest;
}
function accountSelectField(idPrefix, selected){
  const names = accountSelectNames();
  return {key:'banco', label:'Banco/Conta', type:'select', options:names, default: selected && names.includes(selected) ? selected : (names[0]||'')};
}
/* Nomes dos bancos/contas reais, sem a Carteira — usado quando a forma de pagamento
   exige banco (Pix/Débito), já que a Carteira só serve para dinheiro físico. */
function nonCarteiraAccountNames(){
  return (S.data.contas||[]).filter(c=>c && !c.isCarteira && c.nome).map(c=>c.nome);
}
function allCardNames(){
  return (S.data.cartoes||[]).filter(c=>c && c.banco).map(c=>c.banco);
}
function cardSelectField(idPrefix, selected){
  const names = allCardNames();
  return {key:'cartao', label:'Cartão de crédito', type:'select', options:names, default: selected && names.includes(selected) ? selected : (names[0]||'')};
}
function showBankRequiredModal(msg){
  const text = msg || 'Todo lançamento precisa de um banco/conta vinculado.';
  if(!document.getElementById('modal-root') || typeof el!=='function'){ alert(text); return; }
  const box = el(`
    <div class="modal-overlay">
      <div class="modal-box bank-required-modal">
        <div class="modal-head"><h2>Banco/conta obrigatório</h2><button id="br_close">&times;</button></div>
        <p class="confirm-text">${esc(text)}</p>
        <div class="info-box">Essa conta não se conecta ao banco real. Ela serve só como referência dentro do Borion para você lançar receitas, despesas, pagamentos e rastrear suas movimentações com facilidade.</div>
        <div class="row-btns" style="margin-top:12px;"><button class="btn btn-primary btn-block" id="br_add">Adicionar conta do banco</button></div>
        <button class="link-btn" id="br_cancel" style="width:100%;margin-top:10px;">Cancelar</button>
      </div>
    </div>`);
  $('#modal-root').innerHTML=''; $('#modal-root').appendChild(box); attachModalGuard(box);
  $('#br_close').onclick=closeModal;
  $('#br_cancel').onclick=closeModal;
  $('#br_add').onclick=()=>{
    closeModal();
    S.view='cards';
    renderApp();
    setTimeout(()=>{ if(typeof Cards!=='undefined' && Cards.addConta) Cards.addConta(); }, 80);
  };
}
function requireBanco(bancoVal, msg){
  const banco = bancoVal==='— Nenhum —' ? '' : (bancoVal||'');
  if(!banco){ showBankRequiredModal(msg||'Escolha um banco/conta/cartão para este lançamento.'); return null; }
  return banco;
}

/* ---------------- Liquidez: ajuste de saldo por banco (usado por fatura paga, boleto pago e transferências) ---------------- */
function findLiquidezEntry(banco, createIfMissing){
  if(!banco) return null;
  if(!Array.isArray(S.data.liquidez)) S.data.liquidez=[];
  let l = S.data.liquidez.find(x=>x.banco===banco);
  if(!l && createIfMissing){
    l = {id:uid(), nome:banco, valor:0, banco};
    S.data.liquidez.push(l);
  }
  return l;
}
function adjustLiquidez(banco, delta){
  if(!banco || !delta) return;
  const l = findLiquidezEntry(banco, true);
  if(l) l.valor = Math.round(((Number(l.valor)||0) + delta) * 100) / 100;
}

/* ---------------- Global App State ---------------- */
const S = {
  config: getConfig(),
  profiles: getProfiles(),
  currentProfile: null,
  data: null,
  view: 'overview',
  budgetTab: 'receita',
  invMercado: 'BR',
  month: todayYM(),
  filters: {receita:{busca:'',categorias:[],dataDe:'',dataAte:''}, fixa:{busca:'',categorias:[],dataDe:'',dataAte:''}, variavel:{busca:'',categorias:[],dataDe:'',dataAte:''}},
  gate: { mode:'list', selectedProfileId:null, error:'' },
  valuesHidden: readJSON('mc_values_hidden', false),
  bankFilter: null,
  patrView: { dividasCollapsed:false, reservasCollapsed:true, reservaRendimentosCollapsed:true },
  chequeTab: 'resumo',
  importState: null,
  settingsTab: 'modules'
};
function toggleValuesHidden(){
  S.valuesHidden = !S.valuesHidden;
  writeJSON('mc_values_hidden', S.valuesHidden);
  renderView();
}

function saveCurrentData(){
  if(S.currentProfile && S.data){
    recordPatrimonioSnapshot();
    setProfileData(S.currentProfile.id, S.data);
    // V5.34.3 — isolamento entre perfis: o profileId é passado explicitamente
    // (o mesmo que acabou de receber os dados em setProfileData acima), em vez
    // de depender só da variável interna CloudStorage.activeProfileId. Isso
    // fecha qualquer janela em que os dois pudessem divergir e um perfil
    // acabasse sobrescrevendo a linha de outro no Supabase.
    if(window.CloudStorage && CloudStorage.user){ CloudStorage.queueSave(S.currentProfile.id, S.data); }
  }
  BackupFS.markDirty();
}
