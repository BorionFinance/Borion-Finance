/* Borion Finance — Utilitários gerais, formatação, datas, cores, toast e máscara de dinheiro. */

/* =========================================================
   MULTICAP-STYLE PERSONAL FINANCE APP
   Single-file, offline-first, localStorage-based.
========================================================= */

/* ---------------- Utilities ---------------- */
function $(sel,root){return (root||document).querySelector(sel);}
function el(html){const t=document.createElement('template');t.innerHTML=html.trim();return t.content.firstElementChild;}
/* V5.34.2 — uid() agora gera um UUID v4 de verdade. Isso é obrigatório porque
   este id pode virar profile_id (coluna uuid) no Supabase; o formato antigo
   ('id_'+timestamp+random) não é um UUID válido e o Postgres rejeitava com
   "invalid input syntax for type uuid". Todo lugar do app que chamava uid()
   passa a receber automaticamente um UUID válido, sem precisar editar cada
   call-site (transações, contas, cartões, metas, reservas, perfis locais, etc.).
   crypto.randomUUID() é usado quando disponível (HTTPS/localhost); no fallback
   (contexto não seguro / navegador muito antigo) geramos um UUID v4 manualmente
   com crypto.getRandomValues quando possível. */
function uid(){
  if(typeof crypto!=='undefined' && typeof crypto.randomUUID==='function'){
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
    const rnd = (typeof crypto!=='undefined' && crypto.getRandomValues) ? crypto.getRandomValues(new Uint8Array(1))[0] % 16 : Math.floor(Math.random()*16);
    const v = c==='x' ? rnd : (rnd & 0x3 | 0x8);
    return v.toString(16);
  });
}
/* Valida se uma string é um UUID (v1-v5) no formato que o Postgres aceita para
   colunas uuid. Usado antes de qualquer gravação no Supabase que dependa de
   profile_id/id, para nunca mais deixar um valor inválido chegar à API. */
function isValidUUID(str){
  return typeof str==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}
function esc(s){return (s==null?'':String(s)).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function brlPlain(n){
  n = Number(n)||0;
  const sign = n<0 ? '-' : '';
  return sign + 'R$ ' + Math.abs(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function brl(n){
  if(typeof S!=='undefined' && S.valuesHidden) return '<span class="value-mask">⎯⎯⎯⎯</span>';
  return brlPlain(n);
}
function pct(n){return (Number(n)||0).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';}
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function pad2(n){ return String(n).padStart(2,'0'); }
function monthLabel(y,m){return MONTHS[m]+' de '+y;}
function shortMonthLabel(ym){ const [y,m]=ym.split('-').map(Number); return MONTHS[m-1].slice(0,3)+'/'+y; }
function monthKey(y,m){return y+'-'+pad2(m+1);}
function todayYM(){const d=new Date();return {y:d.getFullYear(),m:d.getMonth()};}
function greeting(){
  const h = new Date().getHours();
  if(h>=5 && h<12) return 'Bom dia';
  if(h>=12 && h<18) return 'Boa tarde';
  return 'Boa noite';
}
function todayISO(){
  const d = new Date();
  return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
}
function dateDiffDays(isoA, isoB){
  const a = new Date(isoA+'T00:00:00'), b = new Date(isoB+'T00:00:00');
  return Math.round((a-b)/86400000);
}
function shiftYM(ym, n){
  let [y,m] = ym.split('-').map(Number);
  m += n;
  while(m>12){ m-=12; y++; }
  while(m<1){ m+=12; y--; }
  return y+'-'+pad2(m);
}
function monthBeforeKey(ym){ return shiftYM(ym,-1); }
function monthDiffYM(ymA, ymB){
  const [ya,ma]=ymA.split('-').map(Number), [yb,mb]=ymB.split('-').map(Number);
  return (ya-yb)*12+(ma-mb);
}

const PALETTE = ['#3b82f6','#22c55e','#a855f7','#ec4899','#ef4444','#14b8a6','#f59e0b','#6366f1','#84cc16','#06b6d4','#f43f5e','#eab308'];
function hashStr(s){let h=0;for(let i=0;i<s.length;i++){h=(h*31+s.charCodeAt(i))>>>0;}return h;}
function catColor(name){return PALETTE[hashStr(String(name))%PALETTE.length];}
function bankColor(name){
  const n=(name||'').toLowerCase();
  if(n.includes('nubank')) return '#8a05be';
  if(n.includes('mercado')) return '#2452c0';
  if(n.includes('inter')) return '#ff7a00';
  if(n.includes('itau')||n.includes('itaú')) return '#ec7000';
  if(n.includes('bradesco')) return '#cc092f';
  if(n.includes('santander')) return '#ec0000';
  if(n.includes('caixa')) return '#005ca9';
  if(n.includes('banco do brasil')||n.includes('bb ')) return '#f7ec13';
  return '#3b6bf0';
}
function initials(name){
  if(!name) return '?';
  const parts=name.trim().split(/\s+/);
  return (parts[0][0]+(parts[1]?parts[1][0]:'')).toUpperCase();
}
function avatarColor(name){return PALETTE[hashStr(String(name))%PALETTE.length];}

function toast(msg){
  const root = $('#toast-root');
  root.innerHTML = '<div class="toast">'+esc(msg)+'</div>';
  setTimeout(()=>{root.innerHTML='';},2600);
}
let _undoTimer=null;
function showUndoToast(label, undoFn){
  const root = $('#toast-root');
  if(_undoTimer) clearTimeout(_undoTimer);
  root.innerHTML = '<div class="toast toast-undo"><span>'+esc(label||'Item excluído.')+'</span><button id="toast_undo_btn">Desfazer</button></div>';
  const btn = document.getElementById('toast_undo_btn');
  if(btn) btn.onclick = ()=>{
    root.innerHTML='';
    if(_undoTimer){ clearTimeout(_undoTimer); _undoTimer=null; }
    undoFn();
  };
  _undoTimer = setTimeout(()=>{ root.innerHTML=''; _undoTimer=null; }, 5000);
}

/* ---------------- Money input mask (0,00 -> fills from cents) ---------------- */
function attachMoneyMask(input, initialValue){
  if(!input) return;
  let cents = Math.round((Number(initialValue)||0)*100);
  function render(){
    input.value = (cents/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    input.dataset.cents = String(cents);
  }
  render();
  input.addEventListener('input', ()=>{
    const digits = input.value.replace(/\D/g,'');
    cents = digits ? parseInt(digits,10) : 0;
    render();
    requestAnimationFrame(()=>{ try{ input.setSelectionRange(input.value.length, input.value.length); }catch(e){} });
  });
  input.addEventListener('focus', ()=>{
    requestAnimationFrame(()=>{ try{ input.setSelectionRange(input.value.length, input.value.length); }catch(e){} });
  });
}
