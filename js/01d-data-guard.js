/* Borion Finance — Guarda de integridade de dados (V6.37.0)
   Mesma proteção que foi construída para o Amanda Estética, adaptada aqui: antes
   de qualquer gravação no Google Drive (current.json da conta inteira, com todos
   os perfis), a contagem de registros financeiros é comparada com a última base
   confiável conhecida NESTE navegador. Uma queda brusca (zerar ou cair mais de
   40%) bloqueia a gravação em vez de sobrescrever uma base boa por uma vazia.

   Isso cobre uma falha que existia antes: syncNow() só recusava gravar quando
   TODOS os perfis da conta sumiam (profiles.length===0). Se os dados de UM
   perfil específico (transações, cartões, investimentos...) fossem resetados
   por qualquer motivo — cache corrompido, IndexedDB parcialmente limpo — sem o
   perfil em si desaparecer da lista, nada detectava isso.

   Módulo sem dependências de rede — só olha o payload que já está em memória,
   então não deixa nenhum salvamento mais lento. */

/* Coleções financeiras que, se caírem para zero (ou caírem muito) de uma hora
   para outra sem uma exclusão explícita, quase sempre indicam um perfil vazio
   ou corrompido sendo salvo por engano — nunca uma limpeza intencional (excluir
   uma transação de cada vez é uma ação explícita em outra tela, não por aqui). */
const BORION_CRITICAL_PATHS = [
  'transacoes', 'fixas', 'fixaPagamentos', 'liquidez', 'bens',
  'contas', 'cartoes', 'boletos', 'transferencias', 'agenda', 'metas',
  'assinaturas', ['investimentos', 'emCaixa'], ['investimentos', 'ativos'],
  ['cheques', 'items']
];

function borionPathKey(path){ return Array.isArray(path) ? path.join('.') : path; }
function borionReadPath(data, path){
  if(!data) return [];
  const parts = Array.isArray(path) ? path : [path];
  let cur = data;
  for(const part of parts){ cur = cur && cur[part]; }
  return Array.isArray(cur) ? cur : [];
}

/* Conta os registros de UM perfil (um dataByProfile[id]). */
function countProfileRecords(data){
  const counts = {};
  BORION_CRITICAL_PATHS.forEach(path=>{ counts[borionPathKey(path)] = borionReadPath(data, path).length; });
  return counts;
}

/* Soma as contagens de TODOS os perfis de um payload de conta (mesmo formato de
   buildFullBackupPayload/current.json: {profiles:[], dataByProfile:{}}). */
function countAccountRecords(payload){
  const counts = {};
  BORION_CRITICAL_PATHS.forEach(path=>{ counts[borionPathKey(path)] = 0; });
  const dataByProfile = payload && payload.dataByProfile;
  if(dataByProfile && typeof dataByProfile === 'object'){
    Object.keys(dataByProfile).forEach(profileId=>{
      const profileCounts = countProfileRecords(dataByProfile[profileId]);
      Object.keys(profileCounts).forEach(key=>{ counts[key] = (counts[key]||0) + profileCounts[key]; });
    });
  }
  counts.__total = Object.values(counts).reduce((sum, n)=> sum + (Number(n)||0), 0);
  counts.__profileCount = dataByProfile ? Object.keys(dataByProfile).length : 0;
  return counts;
}

const BORION_COLLECTION_LABELS = {
  transacoes: 'transações', fixas: 'despesas fixas', fixaPagamentos: 'pagamentos de fixas',
  liquidez: 'lançamentos de liquidez', bens: 'bens', contas: 'contas', cartoes: 'cartões',
  boletos: 'boletos', transferencias: 'transferências', agenda: 'agenda', metas: 'metas',
  assinaturas: 'assinaturas', 'investimentos.emCaixa': 'investimentos em caixa',
  'investimentos.ativos': 'ativos de investimento', 'cheques.items': 'cheques'
};
function borionLabel(key){ return BORION_COLLECTION_LABELS[key] || key; }

/* Mesma regra do Amanda Estética: zerou (tinha registros, foi pra 0) ou caiu mais
   de `dropRatio` (40% por padrão) numa coleção que tinha pelo menos `minForRatio`
   registros. Coleções pequenas (poucos itens) não disparam a checagem por
   proporção — só a de zerar. */
function detectSuspiciousAccountDrop(nextCounts, baselineCounts, options={}){
  const dropRatio = typeof options.dropRatio === 'number' ? options.dropRatio : 0.4;
  const minForRatio = typeof options.minForRatio === 'number' ? options.minForRatio : 5;
  const reasons = [];
  if(!nextCounts || !baselineCounts) return { suspicious:false, reasons };
  BORION_CRITICAL_PATHS.forEach(path=>{
    const key = borionPathKey(path);
    const before = Number(baselineCounts[key])||0;
    const after = Number(nextCounts[key])||0;
    if(before>0 && after===0) reasons.push({ key, before, after, kind:'zeroed' });
    else if(before>=minForRatio && after < before*(1-dropRatio)) reasons.push({ key, before, after, kind:'large-drop' });
  });
  // Também protege contra perfis inteiros desaparecendo (o que a checagem antiga
  // já cobria) — mantido aqui para ficar tudo num único lugar.
  if((baselineCounts.__profileCount||0) > 0 && (nextCounts.__profileCount||0) === 0){
    reasons.push({ key:'__profiles', before: baselineCounts.__profileCount, after: 0, kind:'zeroed' });
  }
  return { suspicious: reasons.length>0, reasons };
}
function describeSuspiciousAccountReasons(reasons){
  return (reasons||[]).map(r=>{
    const label = r.key==='__profiles' ? 'perfis da conta' : borionLabel(r.key);
    return r.kind==='zeroed' ? `${label}: ${r.before} → 0` : `${label}: ${r.before} → ${r.after}`;
  }).join(' · ');
}

/* Última contagem confiável conhecida, persistida por pasta do Drive (cada pasta
   é uma conta/família diferente). Só é atualizada depois de uma gravação ou
   leitura bem-sucedida e NÃO suspeita — nunca depois de um bloqueio. */
const LS_BORION_LAST_GOOD_COUNTS_PREFIX = 'borion_gdrive_last_good_counts_';
function borionReadLastGoodCounts(folderId){
  if(!folderId) return null;
  try{ return JSON.parse(localStorage.getItem(LS_BORION_LAST_GOOD_COUNTS_PREFIX+folderId) || 'null'); }
  catch(e){ return null; }
}
function borionWriteLastGoodCounts(folderId, counts){
  if(!folderId || !counts) return;
  try{ localStorage.setItem(LS_BORION_LAST_GOOD_COUNTS_PREFIX+folderId, JSON.stringify(counts)); }catch(e){}
}

window.BorionDataGuard = {
  BORION_CRITICAL_PATHS,
  countProfileRecords,
  countAccountRecords,
  detectSuspiciousAccountDrop,
  describeSuspiciousAccountReasons,
  readLastGoodCounts: borionReadLastGoodCounts,
  writeLastGoodCounts: borionWriteLastGoodCounts
};
