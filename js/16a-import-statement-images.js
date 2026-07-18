/* Borion Finance v6.35.2 — Importação inteligente de extratos por imagem.
   OCR local completo: Tesseract.js 5.1.1 (vendor/tesseract) instalado a partir da distribuição oficial npm.
   Privacidade: File/Blob/canvas/OCR permanecem apenas na memória da sessão. */

let statementOcrLoaderPromise=null;
let statementOcrWorker=null;
let statementOcrEngineType='';
let statementOcrRenderAt=0;
const STATEMENT_OCR_VERSION='tesseract.js-5.1.1-local';
const STATEMENT_OCR_PATHS={
  script:'vendor/tesseract/tesseract.min.js',
  worker:'vendor/tesseract/worker.min.js',
  core:'vendor/tesseract/tesseract-core.wasm.js',
  lang:'vendor/tesseract/lang-data'
};

function statementLocalISO(date){
  if(!(date instanceof Date)||Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}`;
}
function statementDateFromFile(file){
  const n=Number(file&&file.lastModified)||0;
  if(!n) return '';
  const d=new Date(n);
  return d.getFullYear()>=2000&&d.getFullYear()<=2100?statementLocalISO(d):'';
}
function normalizeStatementText(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[\u2013\u2014]/g,'-').replace(/\s+/g,' ').trim();
}
function stableStatementString(value){
  return normalizeStatementText(value).replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
}
function statementCents(value){ return Math.round((Number(value)||0)*100); }
function statementEscapeAttr(value){ return esc(String(value==null?'':value)); }
function statementRenderSoon(force){
  const now=Date.now();
  if(force||now-statementOcrRenderAt>160){ statementOcrRenderAt=now; if(typeof renderView==='function') renderView(); }
}
function updateStatementOcrProgress(status,progress,stage){
  const st=ensureImportState();
  st.ocrStatus=status||st.ocrStatus; st.ocrProgress=Math.max(0,Math.min(1,Number(progress)||0)); st.ocrStage=stage||'';
  statementRenderSoon(false);
}
function loadLocalScriptOnce(src){
  return new Promise((resolve,reject)=>{
    const found=Array.from(document.scripts||[]).find(s=>s.src&&s.src.includes(src));
    if(found){ if(window.Tesseract) resolve(); else found.addEventListener('load',resolve,{once:true}); return; }
    const script=document.createElement('script'); script.src=src; script.async=true; script.dataset.borionOcr='1';
    script.onload=resolve; script.onerror=()=>reject(new Error('Os arquivos locais do leitor OCR não foram encontrados no pacote.'));
    document.head.appendChild(script);
  });
}
async function createTesseractStatementWorker(){
  if(!window.Tesseract||typeof window.Tesseract.createWorker!=='function') throw new Error('Tesseract.js local não está disponível.');
  const logger=m=>{
    const p=Number(m&&m.progress)||0; const status=normalizeStatementText(m&&m.status||'');
    let stage='Preparando leitor';
    if(/recogniz/.test(status)) stage=`Lendo imagem ${ensureImportState().ocrCurrentImage||1} de ${ensureImportState().ocrTotalImages||1}`;
    else if(/load|initializ/.test(status)) stage='Preparando leitor local';
    updateStatementOcrProgress('processing',p,stage);
  };
  let worker;
  try{
    worker=await window.Tesseract.createWorker('por',1,{logger,workerPath:STATEMENT_OCR_PATHS.worker,corePath:STATEMENT_OCR_PATHS.core,langPath:STATEMENT_OCR_PATHS.lang,gzip:true});
  }catch(firstError){
    worker=await window.Tesseract.createWorker({logger,workerPath:STATEMENT_OCR_PATHS.worker,corePath:STATEMENT_OCR_PATHS.core,langPath:STATEMENT_OCR_PATHS.lang});
    if(worker.load) await worker.load();
    if(worker.loadLanguage) await worker.loadLanguage('por');
    if(worker.initialize) await worker.initialize('por');
  }
  if(worker.setParameters) await worker.setParameters({preserve_interword_spaces:'1',user_defined_dpi:'180'});
  return worker;
}
async function loadStatementOcrEngine(options){
  const opts=options||{};
  if(statementOcrWorker) return statementOcrWorker;
  if(statementOcrLoaderPromise) return statementOcrLoaderPromise;
  statementOcrLoaderPromise=(async()=>{
    updateStatementOcrProgress('loading',0,'Preparando leitor local');
    if(window.BorionStatementOcrAdapter&&typeof window.BorionStatementOcrAdapter.recognize==='function'){
      statementOcrEngineType='adapter'; statementOcrWorker=window.BorionStatementOcrAdapter; return statementOcrWorker;
    }
    if(typeof window.TextDetector==='function'){
      const detector=new window.TextDetector();
      statementOcrEngineType='native';
      statementOcrWorker={
        async recognize(source){
          const detections=await detector.detect(source);
          const words=(detections||[]).map((d,i)=>{
            const b=d.boundingBox||{}; return {text:d.rawValue||d.text||'',confidence:Number(d.confidence==null?90:d.confidence),bbox:{x0:Number(b.x)||0,y0:Number(b.y)||i*24,x1:(Number(b.x)||0)+(Number(b.width)||0),y1:(Number(b.y)||i*24)+(Number(b.height)||20)}};
          });
          return {data:{text:words.map(w=>w.text).join('\n'),words}};
        },
        async terminate(){}
      };
      updateStatementOcrProgress('ready',1,'Leitor local pronto'); return statementOcrWorker;
    }
    if(!window.Tesseract) await loadLocalScriptOnce(STATEMENT_OCR_PATHS.script);
    statementOcrEngineType='tesseract'; statementOcrWorker=await createTesseractStatementWorker();
    updateStatementOcrProgress('ready',1,'Leitor local pronto'); return statementOcrWorker;
  })().catch(err=>{
    statementOcrLoaderPromise=null; statementOcrWorker=null; statementOcrEngineType='';
    const st=ensureImportState(); st.ocrStatus='error'; st.ocrCancelable=false; st.lastError=err.message||String(err); statementRenderSoon(true); throw err;
  });
  if(opts.warmup===false) statementOcrLoaderPromise.catch(()=>{});
  return statementOcrLoaderPromise;
}
async function terminateStatementOcrEngine(){
  const worker=statementOcrWorker; statementOcrWorker=null; statementOcrLoaderPromise=null; statementOcrEngineType='';
  if(worker&&typeof worker.terminate==='function'){ try{ await worker.terminate(); }catch(_e){} }
}

async function prepareStatementImage(file,options){
  const opts=options||{}; const maxSide=Math.max(1200,Math.min(2800,Number(opts.maxSide)||2600));
  let bitmap=null;
  try{
    if(typeof createImageBitmap==='function') bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
    else bitmap=await new Promise((resolve,reject)=>{ const img=new Image(); const u=URL.createObjectURL(file); img.onload=()=>{URL.revokeObjectURL(u);resolve(img);}; img.onerror=()=>{URL.revokeObjectURL(u);reject(new Error('Não foi possível abrir a imagem.'));}; img.src=u; });
    const sw=Number(bitmap.width)||0, sh=Number(bitmap.height)||0;
    if(sw<220||sh<220) throw new Error('A imagem é pequena demais para leitura. Use um print com pelo menos 220 px de largura e altura.');
    const scale=Math.min(1,maxSide/Math.max(sw,sh)); const w=Math.max(1,Math.round(sw*scale)),h=Math.max(1,Math.round(sh*scale));
    const canvas=document.createElement('canvas'); canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{alpha:false,willReadFrequently:!!opts.enhance});
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,0,0,w,h);
    if(opts.enhance){
      const image=ctx.getImageData(0,0,w,h),d=image.data,contrast=1.28,intercept=128*(1-contrast);
      for(let i=0;i<d.length;i+=4){const gray=.299*d[i]+.587*d[i+1]+.114*d[i+2];const v=Math.max(0,Math.min(255,gray*contrast+intercept));d[i]=d[i+1]=d[i+2]=v;}
      ctx.putImageData(image,0,0);
    }
    return {canvas,width:w,height:h,enhanced:!!opts.enhance,release(){try{canvas.width=1;canvas.height=1;}catch(_e){}}};
  }finally{ if(bitmap&&typeof bitmap.close==='function') bitmap.close(); }
}
async function ocrStatementImage(prepared,imageItem){
  const worker=await loadStatementOcrEngine();
  const st=ensureImportState(); if(st.ocrCancelRequested) throw new Error('leitura_cancelada');
  const result=await worker.recognize(prepared.canvas);
  if(st.ocrCancelRequested) throw new Error('leitura_cancelada');
  return normalizeOcrResult(result&&result.data?result.data:result,prepared.width,prepared.height,imageItem);
}
function normalizeOcrResult(data,width,height,imageItem){
  const rawWords=Array.isArray(data&&data.words)?data.words:[];
  let words=rawWords.map((w,i)=>{
    const b=w.bbox||w.boundingBox||{}; const x0=Number(b.x0!=null?b.x0:b.x)||0,y0=Number(b.y0!=null?b.y0:b.y)||i*22;
    const x1=Number(b.x1!=null?b.x1:x0+(Number(b.width)||Math.max(10,String(w.text||'').length*8)));
    const y1=Number(b.y1!=null?b.y1:y0+(Number(b.height)||18));
    return {text:String(w.text||w.rawValue||'').trim(),normalized:normalizeStatementText(w.text||w.rawValue||''),confidence:Math.max(0,Math.min(100,Number(w.confidence==null?w.conf: w.confidence)||0)),x0,y0,x1,y1,centerX:(x0+x1)/2,centerY:(y0+y1)/2,width:Math.max(0,x1-x0),height:Math.max(0,y1-y0)};
  }).filter(w=>w.text);
  if(!words.length&&data&&data.text){
    words=String(data.text).split(/\r?\n/).filter(Boolean).flatMap((line,li)=>String(line).trim().split(/\s+/).map((text,wi)=>({text,normalized:normalizeStatementText(text),confidence:65,x0:wi*90,y0:li*24,x1:wi*90+Math.max(20,text.length*8),y1:li*24+19,centerX:wi*90+40,centerY:li*24+9.5,width:Math.max(20,text.length*8),height:19})));
  }
  const lines=groupOcrWordsIntoLines(words,width,height);
  const conf=words.length?words.reduce((a,w)=>a+w.confidence,0)/words.length:0;
  return {text:String(data&&data.text||lines.map(l=>l.text).join('\n')),words,lines,width,height,confidence:conf,imageId:imageItem&&imageItem.id||'',fileName:imageItem&&imageItem.name||''};
}
function groupOcrWordsIntoLines(words,width,height){
  if(!words.length) return [];
  const heights=words.map(w=>w.height||16).sort((a,b)=>a-b); const median=heights[Math.floor(heights.length/2)]||16; const tolerance=Math.max(5,median*.65);
  const sorted=words.slice().sort((a,b)=>a.centerY-b.centerY||a.x0-b.x0),groups=[];
  sorted.forEach(word=>{
    let target=groups.find(g=>Math.abs(g.centerY-word.centerY)<=tolerance);
    if(!target){target={words:[],centerY:word.centerY};groups.push(target);}
    target.words.push(word);target.centerY=target.words.reduce((a,w)=>a+w.centerY,0)/target.words.length;
  });
  return groups.sort((a,b)=>a.centerY-b.centerY).map(g=>{
    g.words.sort((a,b)=>a.x0-b.x0); const x0=Math.min(...g.words.map(w=>w.x0)),y0=Math.min(...g.words.map(w=>w.y0)),x1=Math.max(...g.words.map(w=>w.x1)),y1=Math.max(...g.words.map(w=>w.y1));
    return {text:g.words.map(w=>w.text).join(' ').replace(/\s+/g,' ').trim(),normalized:normalizeStatementText(g.words.map(w=>w.text).join(' ')),words:g.words,x0,y0,x1,y1,centerY:(y0+y1)/2,confidence:g.words.reduce((a,w)=>a+w.confidence,0)/g.words.length,nx0:width?x0/width:0,nx1:width?x1/width:1,ny:height?((y0+y1)/2)/height:0};
  });
}

function detectImageStatementBank(ocr){
  const text=normalizeStatementText((ocr&&ocr.text)||''); let mp=0;
  if(/mercado pago/.test(text)) mp+=5;
  if(/dinheiro reservado/.test(text)) mp+=4;
  if(/dinheiro retirado/.test(text)) mp+=4;
  if(/movimento\s*\.?\.?\.?\s*[a-z0-9]{4,}/.test(text)) mp+=3;
  if(/disponivel\s*r?\$/.test(text)) mp+=2;
  if(/pix recebido/.test(text)) mp+=1;
  if(/gerar extrato|relatorios? de movimentacao/.test(text)) mp+=1;
  if(mp>=5) return {sourceBank:'mercado_pago',detectedBank:'Mercado Pago',score:mp};
  const generic=detectBankFromText((ocr&&ocr.text)||'',(ocr&&ocr.fileName)||'');
  return {sourceBank:generic?stableStatementString(generic):'generic',detectedBank:generic,score:generic?3:0};
}
const STATEMENT_MONTHS={janeiro:1,fevereiro:2,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12};
function resolveStatementDate(raw,referenceDate,referenceMonth){
  const original=String(raw||'').trim(); const s=normalizeStatementText(original); const ref=/^\d{4}-\d{2}-\d{2}$/.test(referenceDate||'')?referenceDate:todayISO();
  const refDate=new Date(Number(ref.slice(0,4)),Number(ref.slice(5,7))-1,Number(ref.slice(8,10)),12,0,0,0);
  if(/\bhoje\b/.test(s)) return {date:statementLocalISO(refDate),relative:true,confidence:1};
  if(/\bontem\b/.test(s)){ const d=new Date(refDate);d.setDate(d.getDate()-1);return {date:statementLocalISO(d),relative:true,confidence:1}; }
  let m=s.match(/\b(\d{1,2})\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+(\d{4}))?/);
  if(m){const y=Number(m[3]||(referenceMonth||ref).slice(0,4));return {date:`${y}-${pad2(STATEMENT_MONTHS[m[2]])}-${pad2(m[1])}`,relative:false,confidence:.95};}
  m=s.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/); if(m)return {date:`${m[1]}-${pad2(m[2])}-${pad2(m[3])}`,relative:false,confidence:1};
  m=s.match(/\b(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?\b/);
  if(m){let y=m[3]||String((referenceMonth||ref).slice(0,4));if(y.length===2)y='20'+y;return {date:`${y}-${pad2(m[2])}-${pad2(m[1])}`,relative:false,confidence:m[3]?.length===4?1:.9};}
  return {date:'',relative:false,confidence:0};
}
function extractStatementMoney(text){
  const source=String(text||''); const rx=/([+\-−]?\s*(?:R\s*\$\s*)?\d{1,3}(?:\.\d{3})*(?:,\d{2})|[+\-−]?\s*(?:R\s*\$\s*)?\d+[.,]\d{2})/g;
  const matches=Array.from(source.matchAll(rx)); if(!matches.length) return null;
  const raw=matches[matches.length-1][0].replace(/−/g,'-'); let value=parseMoneyAny(raw);
  if(/^\s*\+/.test(raw)) value=Math.abs(value); if(/^\s*-/.test(raw)) value=-Math.abs(value);
  return {raw,value,index:matches[matches.length-1].index||0};
}
function classifyMercadoPagoOperation(name,operationLabel,signedValue){
  const op=normalizeStatementText(operationLabel),n=normalizeStatementText(name); let result={kind:'unknown',tipo:'variavel',direction:signedValue<0?'out':'in',statusPagamento:'Pago',formaPagamento:'Débito/Pix',origem:null,classificationConfidence:.35};
  if(/dinheiro reservado/.test(op)){result={...result,kind:'account_to_reserve',tipo:'transferencia',direction:'out',classificationConfidence:1};}
  else if(/dinheiro retirado/.test(op)){result={...result,kind:'reserve_to_account',tipo:'transferencia',direction:'in',classificationConfidence:1};}
  else if(/rendimento/.test(op)||(/rendimento/.test(n)&&signedValue>0)){result={...result,kind:'reserve_yield',tipo:'transferencia',direction:'in',origem:'rendimento',classificationConfidence:.85};}
  else if(/estorno|compra cancelada|pagamento devolvido|devolucao/.test(op+' '+n)){result={...result,kind:'income',tipo:'receita',direction:'in',origem:'reembolso',classificationConfidence:.95};}
  else if(/pix recebido/.test(op)){result={...result,kind:'income',tipo:'receita',direction:'in',origem:'propria',formaPagamento:'Conta',classificationConfidence:.82,reviewIncomeOrigin:true};}
  else if(/pix enviado/.test(op)){result={...result,kind:'expense',tipo:'variavel',direction:'out',formaPagamento:'Pix',classificationConfidence:.92};}
  else if(/transferencia recebida/.test(op)){result={...result,kind:'income',tipo:'receita',direction:'in',origem:'propria',formaPagamento:'Conta',classificationConfidence:.72,mayBeTransfer:true};}
  else if(/transferencia enviada/.test(op)){result={...result,kind:'expense',tipo:'variavel',direction:'out',formaPagamento:'Pix',classificationConfidence:.72,mayBeTransfer:true};}
  else if(/pagamento|compra|debito/.test(op)){result={...result,kind:'expense',tipo:'variavel',direction:'out',classificationConfidence:.96};}
  return result;
}
function statementKnownOperation(text){
  const s=normalizeStatementText(text); const patterns=['dinheiro reservado','dinheiro retirado','pix recebido','pix enviado','transferencia recebida','transferencia enviada','rendimento','pagamento devolvido','compra cancelada','estorno','pagamento','compra','debito'];
  return patterns.find(p=>s.includes(p))||'';
}
function isStatementUiLine(line){
  const s=normalizeStatementText(line); return !s||/^(buscar|filtros?|gerar extrato|ir para relatorios|extrato|movimentacoes?|disponivel|saldo|mercado pago|inicio|conta)$/.test(s)||/relatorios? de movimentacao/.test(s);
}
function parseMercadoPagoImage(ocr,context){
  const lines=(ocr.lines||[]).slice().sort((a,b)=>a.centerY-b.centerY),rows=[];
  const anchors=[];
  lines.forEach((line,index)=>{const money=extractStatementMoney(line.text);if(money&&!/disponivel|saldo/.test(line.normalized||normalizeStatementText(line.text)))anchors.push({index,line,money});else if(money&&/disponivel/.test(line.normalized||''))context.detectedBalance=Math.abs(money.value);});
  for(let a=0;a<anchors.length;a++){
    const current=anchors[a],prev=anchors[a-1];
    const lower=prev?prev.line.centerY+1:-Infinity;
    const upper=current.line.centerY+Math.max(10,Number(current.line.y1||0)-Number(current.line.y0||0));
    let neighborhood=lines.filter(l=>l.centerY>=lower&&l.centerY<=upper);
    if(neighborhood.length<2) neighborhood=lines.slice(Math.max(0,current.index-4),Math.min(lines.length,current.index+3));
    let header='';for(let h=current.index;h>=0;h--){const d=resolveStatementDate(lines[h].text,context.referenceDate,context.referenceMonth);if(d.date){header=lines[h].text;break;}}
    const dateInfo=resolveStatementDate(header,context.referenceDate,context.referenceMonth);if(dateInfo.relative)context.relativeDatesFound=true;
    const joined=neighborhood.map(l=>l.text).join(' | '),op=statementKnownOperation(joined);
    const timeMatch=joined.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/),hour=timeMatch?`${pad2(timeMatch[1])}:${timeMatch[2]}`:'';
    const codeMatch=joined.match(/movimento\s*\.{0,3}\s*([a-z0-9]{5,12})/i),externalIdSuffix=codeMatch?codeMatch[1].toUpperCase():'';
    const opLineIndex=neighborhood.findIndex(l=>statementKnownOperation(l.text));
    const candidates=(opLineIndex>=0?neighborhood.slice(0,opLineIndex):neighborhood).map(l=>({line:l,clean:l.text.replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g,'').replace(/^[|•·\-–—\s]+|[|•·\-–—\s]+$/g,'').trim()})).filter(x=>{
      const t=x.clean;return t&&!isStatementUiLine(t)&&!extractStatementMoney(t)&&!resolveStatementDate(t,context.referenceDate,context.referenceMonth).date&&!/movimento/i.test(t)&&!statementKnownOperation(t);
    });
    let name=candidates.length?candidates[candidates.length-1].clean:'';
    if(!name){name=current.line.text.replace(current.money.raw,'').replace(/\b\d{1,2}:\d{2}\b/g,'').replace(/movimento\s*\.{0,3}\s*[a-z0-9]+/ig,'');if(op)name=name.replace(new RegExp(op.replace(/\s+/g,'\\s+'),'i'),'');name=name.replace(/[|•·]/g,' ').replace(/\s+/g,' ').trim();}
    name=cleanDesc(name||'Movimentação Mercado Pago');
    let signed=current.money.value;const cls=classifyMercadoPagoOperation(name,op,signed);if(!/^[\s]*[+\-−]/.test(current.money.raw)){if(cls.direction==='out')signed=-Math.abs(signed);else if(cls.direction==='in')signed=Math.abs(signed);}
    rows.push(buildImageImportRow({ocr,imageIndex:context.imageIndex,sourceOrder:a,imageFingerprint:context.imageFingerprint,fileName:context.fileName,data:dateInfo.date,hora:hour,nome:name,operationLabel:op||'Operação não identificada',externalIdSuffix,signedValue:signed,classification:cls,raw:joined,lineConfidence:current.line.confidence,dateConfidence:dateInfo.confidence,accountId:context.accountId,sourceBank:'mercado_pago'}));
  }
  return rows;
}
function parseGenericImageStatement(ocr,context){
  const lines=ocr.lines||[],rows=[]; let currentDate='';
  lines.forEach(line=>{
    const d=resolveStatementDate(line.text,context.referenceDate,context.referenceMonth);if(d.date){currentDate=d.date;if(d.relative)context.relativeDatesFound=true;return;}
    const money=extractStatementMoney(line.text);if(!money||/saldo|disponivel/.test(line.normalized))return;
    const time=(line.text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)||[]).slice(1); const signed=money.value;
    const name=cleanDesc(line.text.replace(money.raw,'').replace(/\b\d{1,2}:\d{2}\b/g,'').trim());
    const cls=signed>=0?{kind:'income',tipo:'receita',direction:'in',origem:'propria',formaPagamento:'Conta',classificationConfidence:.55,reviewIncomeOrigin:true}:{kind:'expense',tipo:'variavel',direction:'out',formaPagamento:'Débito/Pix',classificationConfidence:.55};
    rows.push(buildImageImportRow({ocr,imageIndex:context.imageIndex,imageFingerprint:context.imageFingerprint,fileName:context.fileName,data:currentDate,hora:time.length?`${pad2(time[0])}:${time[1]}`:'',nome,operationLabel:'Operação genérica',externalIdSuffix:'',signedValue:signed,classification:cls,raw:line.text,lineConfidence:line.confidence,dateConfidence:currentDate?.9:0,accountId:context.accountId,sourceBank:context.sourceBank||'generic'}));
  });
  return rows;
}
function parseImageStatement(ocr,context){
  const bank=detectImageStatementBank(ocr); context.sourceBank=bank.sourceBank; context.detectedBank=bank.detectedBank;
  return bank.sourceBank==='mercado_pago'?parseMercadoPagoImage(ocr,context):parseGenericImageStatement(ocr,context);
}

function calculateRowConfidence(parts){
  const p=parts||{}; const values=[p.ocr,p.date,p.amount,p.classification,p.mapping,p.code].map(v=>Math.max(0,Math.min(1,Number(v)||0)));
  return Math.round((values[0]*.22+values[1]*.17+values[2]*.23+values[3]*.2+values[4]*.12+values[5]*.06)*1000)/1000;
}
function statementConfidenceLevel(value){return value>=.85?'high':value>=.65?'medium':'low';}
function matchReserveByName(sourceName,accountId){
  const key=stableStatementString(sourceName); const boxes=((S.data.reservas&&S.data.reservas.boxes)||[]).filter(b=>b&&b.status!=='Arquivada'&&(!accountId||!boxAccountId(b)||boxAccountId(b)===accountId));
  const mappings=(((S.data.importPreferences||{}).reserveMappings||{}).mercado_pago)||{}; const mappedId=mappings[key];
  if(mappedId){const box=boxes.find(b=>b.id===mappedId);if(box)return {id:box.id,confidence:1,kind:'saved'};}
  const exact=boxes.find(b=>stableStatementString(b.nome)===key);if(exact)return {id:exact.id,confidence:1,kind:'exact'};
  let best=null,bestScore=0; boxes.forEach(b=>{const bk=stableStatementString(b.nome);const a=new Set(key.split('_').filter(Boolean)),c=new Set(bk.split('_').filter(Boolean));const common=[...a].filter(x=>c.has(x)).length;const score=common/Math.max(1,Math.max(a.size,c.size));if(score>bestScore){best=b;bestScore=score;}});
  return best&&bestScore>=.6?{id:best.id,confidence:.7,kind:'similar'}:{id:'',confidence:0,kind:'none'};
}
function merchantRuleFor(name){return ((((S.data||{}).importPreferences||{}).merchantRules||{})[stableStatementString(name)])||null;}
function buildImageImportRow(input){
  const cls=input.classification||{}; const amount=Math.abs(Number(input.signedValue)||0); const accountId=resolveAccountId(input.accountId)||'';
  const row={tempId:uid(),incluir:cls.kind!=='unknown',sourceMode:'image',sourceBank:input.sourceBank||'generic',sourceFileName:input.fileName||'',sourceImageFingerprint:input.imageFingerprint||'',sourceImageIndex:Number(input.imageIndex)||0,sourceOrder:Number(input.sourceOrder)||0,data:input.data||'',hora:input.hora||'',nome:input.nome||'Movimentação importada',originalName:input.nome||'',operationLabel:input.operationLabel||'',original:input.raw||'',externalIdSuffix:input.externalIdSuffix||'',signedValue:Number(input.signedValue)||0,valor:amount,direction:cls.direction||(Number(input.signedValue)<0?'out':'in'),kind:cls.kind||'unknown',tipo:cls.tipo||'variavel',categoria:inferCategory(cls.tipo==='receita'?'receita':'variavel',input.nome||''),origem:cls.origem||null,formaPagamento:cls.formaPagamento||'Débito/Pix',statusPagamento:cls.statusPagamento||'Pago',accountId,banco:accountNameSnapshot(accountId),sourceAccountId:accountId,destinationAccountId:accountId,reserveSourceName:'',reserveDestinationName:'',reserveSourceId:'',reserveDestinationId:'',confidence:{ocr:Math.max(0,Math.min(1,(Number(input.lineConfidence)||Number(input.ocr&&input.ocr.confidence)||0)/100)),date:Number(input.dateConfidence)||0,amount:amount>0?1:0,classification:Number(cls.classificationConfidence)||0,mapping:1,code:input.externalIdSuffix?1:.35,overall:0},confidenceLevel:'low',issues:[],importKey:'',duplicate:false,duplicado:false,duplicateType:'',duplicateReason:'',reviewIncomeOrigin:!!cls.reviewIncomeOrigin,mayBeTransfer:!!cls.mayBeTransfer,rememberRule:true,forceDuplicate:false};
  if(row.kind==='account_to_reserve'){row.reserveDestinationName=row.nome;const m=matchReserveByName(row.nome,accountId);row.reserveDestinationId=m.id;row.confidence.mapping=m.confidence;}
  if(row.kind==='reserve_to_account'){row.reserveSourceName=row.nome;const m=matchReserveByName(row.nome,accountId);row.reserveSourceId=m.id;row.confidence.mapping=m.confidence;}
  if(row.kind==='reserve_yield'){const m=matchReserveByName(row.nome,accountId);if(m.id){row.reserveSourceName=row.nome;row.reserveSourceId=m.id;row.confidence.mapping=m.confidence;}else{row.kind='income';row.tipo='receita';row.origem='rendimento';row.confidence.mapping=.65;}}
  const rule=merchantRuleFor(row.nome); if(rule&&!['account_to_reserve','reserve_to_account','reserve_to_reserve','reserve_yield'].includes(row.kind)){row.kind=rule.kind||row.kind;row.tipo=rule.tipo||row.tipo;row.categoria=rule.categoria||row.categoria;row.origem=rule.origem==null?row.origem:rule.origem;row.confidence.classification=Math.max(row.confidence.classification,.95);}
  row.confidence.overall=calculateRowConfidence(row.confidence);row.confidenceLevel=statementConfidenceLevel(row.confidence.overall);
  row.importKey=createImageImportKey(row); validateImageImportRow(row,false); return row;
}
function createImageImportKey(row){
  const account=row.sourceAccountId||row.accountId||row.destinationAccountId||''; const base=[row.sourceBank||'generic',account,row.data||'',row.externalIdSuffix||'',statementCents(row.valor),row.direction||''];
  if(!row.externalIdSuffix) base.push(row.hora||'',stableStatementString(row.nome),stableStatementString(row.operationLabel));
  return base.join('|');
}
function existingImageImportRecords(){
  const all=[];['transacoes','fixas','transferencias'].forEach(k=>(S.data[k]||[]).forEach(x=>all.push(x)));
  (((S.data||{}).reservas||{}).moves||[]).forEach(m=>{if(!m.transferenciaId)all.push(m);}); return all;
}
function findExistingImageDuplicate(row){
  const key=row.importKey||createImageImportKey(row); let possible=null;
  for(const item of existingImageImportRecords()){
    const meta=item&&item.origemImportacao||{}; if(meta.importKey&&meta.importKey===key)return {type:'existing',reason:'Já importado pelo mesmo código/chave externa.',item};
    if(!meta.importKey&&row.data&&item.data===row.data&&statementCents(item.valor)===statementCents(row.valor)&&stableStatementString(item.nome||item.descricao)===stableStatementString(row.nome)){possible={type:'possible',reason:'Possível duplicado por data, valor e descrição.',item};}
  }
  return possible;
}
function mergeImageRows(rows){
  const groups=new Map(); rows.forEach(r=>{const key=r.importKey||createImageImportKey(r);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);});
  groups.forEach(list=>{if(list.length<2)return;list.sort((a,b)=>(b.confidence.overall||0)-(a.confidence.overall||0));list.slice(1).forEach(r=>{r.duplicate=true;r.duplicado=true;r.duplicateType='batch';r.duplicateReason='Duplicado no lote; foi mantida a leitura com maior confiança.';r.incluir=false;});});
  rows.forEach(r=>{if(r.duplicateType==='batch')return;const dup=findExistingImageDuplicate(r);if(dup){r.duplicate=true;r.duplicado=true;r.duplicateType=dup.type;r.duplicateReason=dup.reason;if(dup.type==='existing')r.incluir=false;}}); return rows;
}
function validateImageImportRow(row,mutateIssues){
  const issues=[]; const blocking=[]; if(!row||row.kind==='ignore')return {issues,blocking};
  if(!row.data){blocking.push('Data não resolvida.');}
  if(!(Number(row.valor)>0)){blocking.push('Valor não reconhecido.');}
  if(row.kind==='unknown'){blocking.push('Operação desconhecida: escolha o tratamento no Borion.');}
  const needSourceAccount=['expense','account_to_reserve','account_to_account'].includes(row.kind),needDestAccount=['income','reserve_to_account','account_to_account'].includes(row.kind);
  if(needSourceAccount&&!resolveAccountId(row.sourceAccountId||row.accountId))blocking.push('Conta de origem não selecionada.');
  if(needDestAccount&&!resolveAccountId(row.destinationAccountId||row.accountId))blocking.push('Conta de destino não selecionada.');
  const reservesOn=S.data.modules?.reserves!==false&&S.data.reservas?.enabled!==false;
  if(['account_to_reserve','reserve_to_account','reserve_to_reserve','reserve_yield'].includes(row.kind)&&!reservesOn)blocking.push('O módulo Reserva precisa estar ativado para esta movimentação.');
  if(['reserve_to_account','reserve_to_reserve','reserve_yield'].includes(row.kind)&&!row.reserveSourceId)blocking.push(`A Reserva ${row.reserveSourceName||row.nome||'de origem'} ainda não está associada.`);
  if(['account_to_reserve','reserve_to_reserve'].includes(row.kind)&&!row.reserveDestinationId)blocking.push(`A Reserva ${row.reserveDestinationName||row.nome||'de destino'} ainda não está associada.`);
  if(row.kind==='reserve_to_reserve'&&row.reserveSourceId===row.reserveDestinationId)blocking.push('A Reserva de origem e destino precisam ser diferentes.');
  if(row.kind==='account_to_account'&&resolveAccountId(row.sourceAccountId)===resolveAccountId(row.destinationAccountId))blocking.push('A Conta de origem e destino precisam ser diferentes.');
  if(row.reviewIncomeOrigin)issues.push('Confirme se o Pix recebido é receita própria, reembolso ou repasse.');
  if(row.mayBeTransfer)issues.push('Esta movimentação pode ser uma transferência entre Contas.');
  if(row.confidenceLevel==='low')issues.push('Leitura com confiança baixa; confira todos os campos.');
  if(row.duplicate)issues.push(row.duplicateReason||'Possível duplicidade.');
  if(mutateIssues!==false){row.issues=blocking.concat(issues);row.blockingIssues=blocking.length;}
  return {issues:blocking.concat(issues),blocking};
}
function recalculateImageImportStats(render){
  const st=ensureImportState(),rows=st.parsed||[];rows.forEach(r=>validateImageImportRow(r,true));
  const selected=rows.filter(r=>r.incluir&&r.kind!=='ignore'); const stats={total:rows.length,selected:selected.length,selecionados:selected.length,receitas:0,despesas:0,transferencias:0,rendimentos:0,duplicados:rows.filter(r=>r.duplicate||r.duplicado).length,pendencias:selected.filter(r=>r.blockingIssues>0).length};
  selected.forEach(r=>{if(r.kind==='income')stats.receitas+=Number(r.valor)||0;else if(r.kind==='expense'||r.kind==='fixed')stats.despesas+=Number(r.valor)||0;else if(r.kind==='reserve_yield')stats.rendimentos+=Number(r.valor)||0;else if(['account_to_reserve','reserve_to_account','reserve_to_reserve','account_to_account'].includes(r.kind))stats.transferencias++;});
  st.stats=stats;st.blockingIssues=stats.pendencias;st.batchDuplicates=rows.filter(r=>r.duplicateType==='batch').length;st.existingDuplicates=rows.filter(r=>r.duplicateType==='existing').length;if(render)renderView();return stats;
}

function imageStatusLabel(image){
  const map={pending:'Aguardando',processing:'Lendo',done:'Concluído',error:'Falhou',cancelled:'Cancelado'};return map[image.status]||'Aguardando';
}
function renderImageImportPanel(st,bankOptions){
  const list=(st.images||[]).map((img,i)=>`<div class="import-image-card"><img class="import-image-thumb" src="${statementEscapeAttr(img.objectUrl)}" alt="Miniatura ${i+1}"><div class="import-image-meta"><strong>${statementEscapeAttr(img.name)}</strong><span>${(Number(img.size||0)/1048576).toFixed(2)} MB · ${imageStatusLabel(img)}${img.rowsFound!=null?` · ${img.rowsFound} linha(s)`:''}</span>${img.error?`<small class="val-neg">${esc(img.error)}</small>`:''}</div><div class="import-image-actions"><button class="btn-outline btn-sm" onclick="ImportStatement.moveImage('${img.id}',-1)" ${i===0?'disabled':''}>↑</button><button class="btn-outline btn-sm" onclick="ImportStatement.moveImage('${img.id}',1)" ${i===st.images.length-1?'disabled':''}>↓</button><button class="mini-danger" onclick="ImportStatement.removeImage('${img.id}')">Excluir</button></div></div>`).join('');
  const progress=st.ocrStatus==='processing'||st.ocrStatus==='loading'?`<div class="import-ocr-progress"><div class="import-ocr-stage">${esc(st.ocrStage||'Preparando leitor')}</div><div class="import-ocr-progress-track"><div class="import-ocr-progress-bar" style="width:${Math.round((st.ocrProgress||0)*100)}%"></div></div><div class="import-ocr-progress-meta"><span>${Math.round((st.ocrProgress||0)*100)}%</span><span>${st.ocrCurrentImage?`Imagem ${st.ocrCurrentImage} de ${st.ocrTotalImages}`:''}</span></div>${st.ocrCancelable?'<button class="btn-outline btn-sm" onclick="ImportStatement.cancelImageProcessing()">Cancelar leitura</button>':''}</div>`:'';
  return `<div class="panel-box import-panel-main"><div class="toolbar"><div class="toolbar-left">Prints do extrato</div><div class="toolbar-right"><button class="btn-outline" onclick="ImportStatement.clearImages()">Limpar prints</button></div></div>
    <label class="import-drop import-image-drop" for="statement_images" tabindex="0" ondragover="ImportStatement.drag(event)" ondrop="ImportStatement.dropImages(event)" onpaste="ImportStatement.pasteImage(event)"><input id="statement_images" type="file" multiple accept="image/png,image/jpeg,image/webp" onchange="ImportStatement.pickImages(event)" hidden><div class="drop-icon">▧</div><div><strong>Clique para escolher ou arraste os prints aqui</strong><span>Selecione um ou vários prints do extrato. As imagens serão processadas somente neste dispositivo e revisadas antes da importação.</span></div></label>
    <input id="statement_camera" type="file" accept="image/png,image/jpeg,image/webp" capture="environment" onchange="ImportStatement.pickImages(event)" hidden><div class="import-image-buttons"><button class="btn-outline" onclick="document.getElementById('statement_camera').click()">Tirar foto</button><button class="btn btn-primary" onclick="ImportStatement.processImages()" ${(st.images||[]).length&&st.ocrStatus!=='processing'?'':'disabled'}>${st.parsed.length?'Processar novamente':'Ler prints'}</button></div>
    ${list?`<div class="import-image-list">${list}</div>`:''}${progress}
    <div class="import-controls"><div class="field"><label>Conta de destino</label><select id="import_bank" onchange="ImportStatement.setBank(this.value,true)">${bankOptions}</select></div><div class="field"><label>Mês de referência</label><input type="month" value="${esc(st.referenceMonth)}" onchange="ImportStatement.setReferenceMonth(this.value)"></div><div class="field"><label>Data-base do print</label><input type="date" value="${esc(st.referenceDate)}" onchange="ImportStatement.setReferenceDate(this.value)"></div></div>
    ${st.relativeDatesFound?'<div class="import-relative-date-warning">Este print possui datas como Hoje ou Ontem. Confirme a data-base antes de importar.</div>':''}${st.detectedBank?`<div class="import-detect-ok">Banco detectado: <b>${esc(st.detectedBank)}</b></div>`:''}${st.lastError?`<div class="import-warning">${esc(st.lastError)}</div>`:''}
    <div class="import-privacy-note"><b>Privacidade:</b> as imagens são lidas localmente neste dispositivo. O Borion não salva nem envia os prints para a nuvem.</div></div>`;
}
function renderImageReconciliation(st,stats){
  const selected=(st.parsed||[]).filter(r=>r.incluir&&r.kind!=='ignore'); const accountDelta=selected.reduce((sum,r)=>{if(r.kind==='income'||r.kind==='reserve_to_account')return sum+r.valor;if(r.kind==='expense'||r.kind==='account_to_reserve')return sum-r.valor;return sum;},0);
  return `<div class="import-reconciliation"><div><span>Imagens</span><b>${(st.images||[]).length}</b></div><div><span>Banco</span><b>${esc(st.detectedBank||'Não detectado')}</b></div><div><span>Saldo lido</span><b>${st.detectedBalance==null?'—':brl(st.detectedBalance)}</b></div><div><span>Variação líquida da Conta</span><b class="${accountDelta>=0?'val-pos':'val-neg'}">${brl(accountDelta)}</b></div></div>`;
}
function imageKindOptions(selected){
  const opts=[['income','Receita'],['expense','Despesa variável'],['fixed','Despesa fixa'],['account_to_reserve','Conta → Reserva'],['reserve_to_account','Reserva → Conta'],['reserve_to_reserve','Reserva → Reserva'],['reserve_yield','Rendimento de Reserva'],['account_to_account','Transferência entre Contas'],['ignore','Ignorar'],['unknown','Pendente']];return opts.map(([v,l])=>`<option value="${v}" ${v===selected?'selected':''}>${l}</option>`).join('');
}
function imageAccountOptions(selected){return `<option value="">— Escolha —</option>`+accountSelectOptions().map(o=>`<option value="${esc(o.value)}" ${o.value===selected?'selected':''}>${esc(o.label)}</option>`).join('');}
function imageReserveOptions(selected,suggestedName){
  const boxes=((S.data.reservas&&S.data.reservas.boxes)||[]).filter(b=>b.status!=='Arquivada');let html='<option value="">— Escolha a Reserva —</option>'+boxes.map(b=>`<option value="${esc(b.id)}" ${b.id===selected?'selected':''}>${esc(b.nome)}</option>`).join('');
  if(suggestedName)html+=`<option value="__create__:${esc(suggestedName)}" ${String(selected).startsWith('__create__:')?'selected':''}>Criar nova Reserva “${esc(suggestedName)}”</option>`;return html;
}
function imageCategoryOptions(row){const key=row.kind==='income'?'receita':row.kind==='fixed'?'fixa':'variavel';return (S.data.categorias[key]||['Outro']).map(c=>`<option value="${esc(c)}" ${c===row.categoria?'selected':''}>${esc(c)}</option>`).join('');}
function imageDynamicFields(row,index){
  const fields=[];
  if(row.kind==='income'){fields.push(`<label>Categoria<select onchange="ImportStatement.updateImageRow(${index},'categoria',this.value)">${imageCategoryOptions(row)}</select></label><label>Origem<select onchange="ImportStatement.updateImageRow(${index},'origem',this.value)"><option value="propria" ${row.origem==='propria'?'selected':''}>Receita própria</option><option value="rendimento" ${row.origem==='rendimento'?'selected':''}>Rendimento</option><option value="reembolso" ${row.origem==='reembolso'?'selected':''}>Reembolso</option><option value="repasse" ${row.origem==='repasse'?'selected':''}>Repasse</option></select></label><label>Conta de destino<select onchange="ImportStatement.updateImageRow(${index},'destinationAccountId',this.value)">${imageAccountOptions(row.destinationAccountId||row.accountId)}</select></label>`);}
  else if(row.kind==='expense'||row.kind==='fixed'){fields.push(`<label>Categoria<select onchange="ImportStatement.updateImageRow(${index},'categoria',this.value)">${imageCategoryOptions(row)}</select></label><label>Status<select onchange="ImportStatement.updateImageRow(${index},'statusPagamento',this.value)"><option ${row.statusPagamento==='Pago'?'selected':''}>Pago</option><option ${row.statusPagamento==='Em aberto'?'selected':''}>Em aberto</option></select></label><label>Forma<select onchange="ImportStatement.updateImageRow(${index},'formaPagamento',this.value)"><option ${row.formaPagamento==='Débito/Pix'?'selected':''}>Débito/Pix</option><option ${row.formaPagamento==='Pix'?'selected':''}>Pix</option><option ${row.formaPagamento==='Débito'?'selected':''}>Débito</option></select></label><label>Conta de origem<select onchange="ImportStatement.updateImageRow(${index},'sourceAccountId',this.value)">${imageAccountOptions(row.sourceAccountId||row.accountId)}</select></label>`);}
  else if(row.kind==='account_to_reserve'){fields.push(`<label>Conta de origem<select onchange="ImportStatement.updateImageRow(${index},'sourceAccountId',this.value)">${imageAccountOptions(row.sourceAccountId||row.accountId)}</select></label><label>Reserva de destino<select onchange="ImportStatement.updateReserveMapping('${row.reserveDestinationName||row.nome}',this.value,${index},'destination')">${imageReserveOptions(row.reserveDestinationId,row.reserveDestinationName||row.nome)}</select></label>`);}
  else if(row.kind==='reserve_to_account'){fields.push(`<label>Reserva de origem<select onchange="ImportStatement.updateReserveMapping('${row.reserveSourceName||row.nome}',this.value,${index},'source')">${imageReserveOptions(row.reserveSourceId,row.reserveSourceName||row.nome)}</select></label><label>Conta de destino<select onchange="ImportStatement.updateImageRow(${index},'destinationAccountId',this.value)">${imageAccountOptions(row.destinationAccountId||row.accountId)}</select></label>`);}
  else if(row.kind==='reserve_to_reserve'){fields.push(`<label>Reserva de origem<select onchange="ImportStatement.updateImageRow(${index},'reserveSourceId',this.value)">${imageReserveOptions(row.reserveSourceId,row.reserveSourceName||row.nome)}</select></label><label>Reserva de destino<select onchange="ImportStatement.updateImageRow(${index},'reserveDestinationId',this.value)">${imageReserveOptions(row.reserveDestinationId,row.reserveDestinationName||row.nome)}</select></label>`);}
  else if(row.kind==='reserve_yield'){fields.push(`<label>Reserva<select onchange="ImportStatement.updateReserveMapping('${row.reserveSourceName||row.nome}',this.value,${index},'source')">${imageReserveOptions(row.reserveSourceId,row.reserveSourceName||row.nome)}</select></label>`);}
  else if(row.kind==='account_to_account'){fields.push(`<label>Conta de origem<select onchange="ImportStatement.updateImageRow(${index},'sourceAccountId',this.value)">${imageAccountOptions(row.sourceAccountId||row.accountId)}</select></label><label>Conta de destino<select onchange="ImportStatement.updateImageRow(${index},'destinationAccountId',this.value)">${imageAccountOptions(row.destinationAccountId)}</select></label>`);}
  return fields.join('');
}
function imageStatusPill(row){if(row.duplicateType==='existing')return '<span class="dup-pill">Já importado</span>';if(row.duplicateType==='batch')return '<span class="dup-pill">Duplicado no lote</span>';if(row.blockingIssues)return '<span class="pending-pill">Pendente</span>';return '<span class="ok-pill">Revisado</span>';}
function renderImageImportReview(rows){
  const cards=rows.map((r,i)=>`<article class="import-row-card ${!r.incluir?'is-muted':''}"><div class="import-row-card-head"><label><input type="checkbox" ${r.incluir?'checked':''} onchange="ImportStatement.updateImageRow(${i},'incluir',this.checked)"> Usar</label><div><strong>${esc(r.nome)}</strong><small>${esc(r.operationLabel)}</small></div><b class="${r.direction==='in'?'val-pos':'val-neg'}">${r.direction==='in'?'+':'-'} ${brl(r.valor)}</b></div><div class="import-row-meta"><span>${esc(r.data||'Sem data')} ${esc(r.hora||'')}</span><span class="import-confidence import-confidence-${r.confidenceLevel}">${Math.round((r.confidence.overall||0)*100)}%</span>${imageStatusPill(r)}</div><div class="import-row-fields"><label>Data<input type="date" value="${esc(r.data)}" onchange="ImportStatement.updateImageRow(${i},'data',this.value)"></label><label>Hora<input type="time" value="${esc(r.hora)}" onchange="ImportStatement.updateImageRow(${i},'hora',this.value)"></label><label>Descrição<input value="${esc(r.nome)}" onchange="ImportStatement.updateImageRow(${i},'nome',this.value)"></label><label>Valor<input value="${formatMoneyInput(r.valor)}" onchange="ImportStatement.updateImageRow(${i},'valor',Math.abs(parseMoneyAny(this.value)))"></label><label>Tratamento<select onchange="ImportStatement.updateImageRowKind(${i},this.value)">${imageKindOptions(r.kind)}</select></label>${imageDynamicFields(r,i)}</div>${r.issues&&r.issues.length?`<div class="import-issue-list">${r.issues.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}<div class="import-row-actions"><label><input type="checkbox" ${r.rememberRule?'checked':''} onchange="ImportStatement.updateImageRow(${i},'rememberRule',this.checked)"> Lembrar classificação</label><div>${r.duplicate&&r.duplicateType!=='batch'?`<button class="btn-outline btn-sm" onclick="ImportStatement.forceDuplicate(${i})">Forçar esta linha</button>`:''}<button class="mini-danger" onclick="ImportStatement.removeRow(${i})">Excluir</button></div></div></article>`).join('');
  const tableRows=rows.map((r,i)=>`<tr class="${!r.incluir?'is-muted':''} ${r.duplicate?'is-dup':''}"><td><input type="checkbox" ${r.incluir?'checked':''} onchange="ImportStatement.updateImageRow(${i},'incluir',this.checked)"></td><td>${esc(r.data)}<br><small>${esc(r.hora)}</small></td><td><input class="mini-input desc" value="${esc(r.nome)}" onchange="ImportStatement.updateImageRow(${i},'nome',this.value)"><div class="import-original">${esc(r.operationLabel)} · ${esc(r.externalIdSuffix||'sem código')}</div></td><td class="${r.direction==='in'?'val-pos':'val-neg'}">${r.direction==='in'?'+':'-'} ${brl(r.valor)}</td><td>${esc(r.operationLabel)}</td><td><select class="mini-select" onchange="ImportStatement.updateImageRowKind(${i},this.value)">${imageKindOptions(r.kind)}</select></td><td><div class="import-table-dynamic">${imageDynamicFields(r,i)}</div></td><td><span class="import-confidence import-confidence-${r.confidenceLevel}">${Math.round((r.confidence.overall||0)*100)}%</span></td><td>${imageStatusPill(r)}</td><td>${r.duplicate&&r.duplicateType!=='batch'?`<button class="btn-outline btn-sm" onclick="ImportStatement.forceDuplicate(${i})">Forçar</button>`:''}<button class="mini-danger" onclick="ImportStatement.removeRow(${i})">Excluir</button></td></tr>`).join('');
  return `<div class="panel-box import-review"><div class="toolbar"><div class="toolbar-left">Revisão dos prints</div><div class="toolbar-right"><button class="btn-outline" onclick="ImportStatement.applyBankToAll()">Aplicar Conta a todos</button><button class="btn-outline" onclick="ImportStatement.addManualImageRow()">Adicionar linha manual</button></div></div><div class="import-review-table-desktop table-scroll"><table class="import-table import-image-table"><thead><tr><th>Usar</th><th>Data</th><th>Descrição</th><th>Valor</th><th>Operação detectada</th><th>Tratamento no Borion</th><th>Categoria/Reserva/Conta</th><th>Confiança</th><th>Status</th><th></th></tr></thead><tbody>${tableRows}</tbody></table></div><div class="import-review-cards-mobile">${cards}</div><div class="import-footnote">Transferências entre Conta e Reserva não entram em Receita ou Despesa. Linhas pendentes precisam ser corrigidas ou desmarcadas.</div></div>`;
}

async function statementFingerprint(file){
  const buffer=await file.arrayBuffer(); if(window.crypto&&crypto.subtle){const hash=await crypto.subtle.digest('SHA-256',buffer);return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');}
  let h=2166136261;new Uint8Array(buffer).forEach(b=>{h^=b;h=Math.imul(h,16777619);});return `fnv-${(h>>>0).toString(16)}-${file.size}`;
}
function cleanupStatementImportImages(state){
  const st=state||ensureImportState();(st.images||[]).forEach(img=>{if(img.objectUrl)try{URL.revokeObjectURL(img.objectUrl);}catch(_e){} img.file=null;img.ocrText='';});st.images=[];st.ocrCancelRequested=true;
}
function resolvePendingReserveId(value,pending){if(!String(value||'').startsWith('__create__:'))return value;return pending.get(value)||'';}
function statementMetaForRow(row,batchId){return {mode:'print',sourceBank:row.sourceBank||'generic',arquivo:row.sourceFileName||'',imageFingerprint:row.sourceImageFingerprint||'',externalIdSuffix:row.externalIdSuffix||'',importKey:row.importKey||createImageImportKey(row),original:row.original||'',operationLabel:row.operationLabel||'',batchId,ocrConfidence:row.confidence&&row.confidence.ocr||0,importedAt:Date.now()};}
function validateReserveBalancesForRows(rows,pendingNames){
  const balances=new Map((((S.data||{}).reservas||{}).boxes||[]).map(b=>[b.id,Number(b.valorAtual)||0]));pendingNames.forEach(id=>balances.set(id,0));
  for(const r of rows){const v=Number(r.valor)||0,src=r._resolvedReserveSourceId,dst=r._resolvedReserveDestinationId;
    if(r.kind==='account_to_reserve')balances.set(dst,(balances.get(dst)||0)+v);
    else if(r.kind==='reserve_to_account'){const before=balances.get(src)||0;if(before+1e-9<v)throw new Error(`saldo_reserva_insuficiente|${src}|${v}|${before}`);balances.set(src,before-v);}
    else if(r.kind==='reserve_to_reserve'){const before=balances.get(src)||0;if(before+1e-9<v)throw new Error(`saldo_reserva_insuficiente|${src}|${v}|${before}`);balances.set(src,before-v);balances.set(dst,(balances.get(dst)||0)+v);}
    else if(r.kind==='reserve_yield')balances.set(src,(balances.get(src)||0)+v);
  }
}
function commitImageStatementImport(){
  const st=ensureImportState();recalculateImageImportStats(false);let selected=(st.parsed||[]).filter(r=>r.incluir&&r.kind!=='ignore');
  if(!selected.length){toast('Nada selecionado para importar.');return;}
  for(const r of selected){r.importKey=createImageImportKey(r);const dup=findExistingImageDuplicate(r);if(dup&&dup.type==='existing'&&!r.forceDuplicate){r.duplicate=true;r.duplicado=true;r.duplicateType='existing';r.duplicateReason=dup.reason;r.incluir=false;}}
  selected=(st.parsed||[]).filter(r=>r.incluir&&r.kind!=='ignore');const invalid=selected.find(r=>validateImageImportRow(r,true).blocking.length);
  if(invalid){renderView();toast('Corrija as pendências destacadas antes de importar.');return;}
  selected.sort((a,b)=>{const t=`${a.data} ${a.hora||'00:00'}`.localeCompare(`${b.data} ${b.hora||'00:00'}`);if(t)return t;if(a.sourceBank==='mercado_pago'&&b.sourceBank==='mercado_pago'&&a.sourceImageIndex===b.sourceImageIndex)return (Number(b.sourceOrder)||0)-(Number(a.sourceOrder)||0);return (Number(a.sourceImageIndex)||0)-(Number(b.sourceImageIndex)||0);});
  const batchId=uid(),pending=new Map(),pendingIds=new Set();
  selected.forEach(r=>{['reserveSourceId','reserveDestinationId'].forEach(k=>{const v=r[k];if(String(v||'').startsWith('__create__:')&&!pending.has(v)){const id=uid();pending.set(v,id);pendingIds.add(id);}});r._resolvedReserveSourceId=resolvePendingReserveId(r.reserveSourceId,pending);r._resolvedReserveDestinationId=resolvePendingReserveId(r.reserveDestinationId,pending);});
  try{validateReserveBalancesForRows(selected,pendingIds);}catch(err){const parts=String(err.message||err).split('|');const box=(((S.data||{}).reservas||{}).boxes||[]).find(b=>b.id===parts[1]);toast(`A retirada exige ${brl(Number(parts[2])||0)} na Reserva ${box?box.nome:'selecionada'}, mas o saldo disponível é ${brl(Number(parts[3])||0)}.`);return;}
  const counts={totalRead:(st.parsed||[]).length,imported:0,income:0,expenses:0,transfers:0,yields:0,duplicatesIgnored:(st.parsed||[]).filter(r=>r.duplicate&&!r.incluir).length,ignored:(st.parsed||[]).filter(r=>r.kind==='ignore'||!r.incluir).length};const totals={income:0,expenses:0,internalTransfersGross:0};
  let failedRow=null;
  const ok=runAtomicFinancialMutation(()=>{
    pending.forEach((id,key)=>{const name=String(key).replace(/^__create__:/,'').trim()||'Reserva importada';const accountId=resolveAccountId(st.selectedBank)||resolveAccountId(selected.find(r=>r.reserveSourceId===key||r.reserveDestinationId===key)?.accountId);const box={id,nome:name,accountId,banco:accountNameSnapshot(accountId),valorAtual:0,valorMeta:0,status:'Ativa',metaId:null,createdAt:Date.now()};S.data.reservas.boxes.push(box);});
    for(const r of selected){failedRow=r;const meta=statementMetaForRow(r,batchId),valor=Number(r.valor)||0;
      if(findExistingImageDuplicate(r)?.type==='existing'&&!r.forceDuplicate)continue;
      if(r.kind==='income'){
        const accountId=resolveAccountId(r.destinationAccountId||r.accountId||st.selectedBank);const tx={id:uid(),tipo:'receita',nome:r.nome,data:r.data,categoria:r.categoria||pickCat('receita','Outro'),valor,accountId,banco:accountNameSnapshot(accountId),origem:r.origem||'propria',reservaValor:0,destinoModo:'Conta livre',formaPagamento:'Conta',origemImportacao:meta};S.data.transacoes.push(tx);if(!applyTxSaldoEffect(tx))throw new Error('efeito_conta_invalido');counts.income++;totals.income+=valor;
      }else if(r.kind==='expense'){
        const accountId=resolveAccountId(r.sourceAccountId||r.accountId||st.selectedBank);const tx={id:uid(),tipo:'variavel',nome:r.nome,data:r.data,categoria:r.categoria||pickCat('variavel','Outro'),valor,localCompra:'',statusPagamento:r.statusPagamento||'Pago',accountId,banco:accountNameSnapshot(accountId),origemPagamento:'conta',formaPagamento:r.formaPagamento||'Débito/Pix',reservaOrigemId:null,reservaOrigemMoveId:null,origemImportacao:meta};S.data.transacoes.push(tx);if(!applyTxSaldoEffect(tx))throw new Error('efeito_conta_invalido');counts.expenses++;totals.expenses+=valor;
      }else if(r.kind==='fixed'){
        const accountId=resolveAccountId(r.sourceAccountId||r.accountId||st.selectedBank),day=Math.min(31,Math.max(1,Number(r.data.slice(8,10))||1));S.data.fixas.push({id:uid(),nome:r.nome,categoria:r.categoria||pickCat('fixa','Outro'),valor,dia:day,startMonth:r.data.slice(0,7),endMonth:null,accountId,banco:accountNameSnapshot(accountId),origemImportacao:meta});counts.expenses++;totals.expenses+=valor;
      }else{
        const sourceAccountId=resolveAccountId(r.sourceAccountId||r.accountId||st.selectedBank),destAccountId=resolveAccountId(r.destinationAccountId||r.accountId||st.selectedBank);let t;
        if(r.kind==='account_to_reserve')t={kind:'transferencia',origemTipo:'conta',origemId:sourceAccountId,origemAccountId:sourceAccountId,origemNome:accountNameSnapshot(sourceAccountId),origemBanco:accountNameSnapshot(sourceAccountId),destinoTipo:'reserva',destinoId:r._resolvedReserveDestinationId,destinoAccountId:null,destinoNome:(S.data.reservas.boxes.find(b=>b.id===r._resolvedReserveDestinationId)||{}).nome||r.nome,destinoBanco:(S.data.reservas.boxes.find(b=>b.id===r._resolvedReserveDestinationId)||{}).banco||'',reservaAction:null};
        else if(r.kind==='reserve_to_account')t={kind:'transferencia',origemTipo:'reserva',origemId:r._resolvedReserveSourceId,origemAccountId:null,origemNome:(S.data.reservas.boxes.find(b=>b.id===r._resolvedReserveSourceId)||{}).nome||r.nome,origemBanco:(S.data.reservas.boxes.find(b=>b.id===r._resolvedReserveSourceId)||{}).banco||'',destinoTipo:'conta',destinoId:destAccountId,destinoAccountId:destAccountId,destinoNome:accountNameSnapshot(destAccountId),destinoBanco:accountNameSnapshot(destAccountId),reservaAction:'resgatar'};
        else if(r.kind==='reserve_to_reserve')t={kind:'transferencia',origemTipo:'reserva',origemId:r._resolvedReserveSourceId,origemAccountId:null,origemNome:(S.data.reservas.boxes.find(b=>b.id===r._resolvedReserveSourceId)||{}).nome||'',origemBanco:(S.data.reservas.boxes.find(b=>b.id===r._resolvedReserveSourceId)||{}).banco||'',destinoTipo:'reserva',destinoId:r._resolvedReserveDestinationId,destinoAccountId:null,destinoNome:(S.data.reservas.boxes.find(b=>b.id===r._resolvedReserveDestinationId)||{}).nome||'',destinoBanco:(S.data.reservas.boxes.find(b=>b.id===r._resolvedReserveDestinationId)||{}).banco||'',reservaAction:'enviar'};
        else if(r.kind==='reserve_yield')t={kind:'rendimento_reserva',origemTipo:'reserva',origemId:r._resolvedReserveSourceId,origemAccountId:null,origemNome:(S.data.reservas.boxes.find(b=>b.id===r._resolvedReserveSourceId)||{}).nome||r.nome,origemBanco:(S.data.reservas.boxes.find(b=>b.id===r._resolvedReserveSourceId)||{}).banco||'',destinoTipo:null,destinoId:null,destinoAccountId:null,destinoNome:'Rendimento',destinoBanco:'',reservaAction:'rendimento'};
        else if(r.kind==='account_to_account')t={kind:'transferencia',origemTipo:'conta',origemId:sourceAccountId,origemAccountId:sourceAccountId,origemNome:accountNameSnapshot(sourceAccountId),origemBanco:accountNameSnapshot(sourceAccountId),destinoTipo:'conta',destinoId:destAccountId,destinoAccountId:destAccountId,destinoNome:accountNameSnapshot(destAccountId),destinoBanco:accountNameSnapshot(destAccountId),reservaAction:null};
        else throw new Error('tipo_importacao_desconhecido');
        Object.assign(t,{id:uid(),createdAt:Date.now(),valor,data:r.data,descricao:r.nome,origemImportacao:meta});S.data.transferencias.push(t);if(!Cards.applyTransferenciaEffect(t))throw new Error('efeito_transferencia_invalido');
        [t.origemMoveId,t.destinoMoveId].filter(Boolean).forEach(id=>{const mv=S.data.reservas.moves.find(x=>x.id===id);if(mv)mv.origemImportacao=Object.assign({},meta,{parentTransferId:t.id});});
        if(r.kind==='reserve_yield'){counts.yields++;}else{counts.transfers++;totals.internalTransfersGross+=valor;}
      }
      counts.imported++;
      if(r.rememberRule&&!['account_to_reserve','reserve_to_account','reserve_to_reserve','reserve_yield'].includes(r.kind)){S.data.importPreferences.merchantRules[stableStatementString(r.nome)]={kind:r.kind,tipo:r.kind==='fixed'?'fixa':r.kind==='income'?'receita':'variavel',categoria:r.categoria,origem:r.origem||null,updatedAt:Date.now()};}
      const mappingRoot=S.data.importPreferences.reserveMappings.mercado_pago||(S.data.importPreferences.reserveMappings.mercado_pago={});if(r.reserveSourceName&&r._resolvedReserveSourceId)mappingRoot[stableStatementString(r.reserveSourceName)]=r._resolvedReserveSourceId;if(r.reserveDestinationName&&r._resolvedReserveDestinationId)mappingRoot[stableStatementString(r.reserveDestinationName)]=r._resolvedReserveDestinationId;
    }
    const files=(st.images||[]).map(img=>({name:img.name,fingerprint:img.fingerprint,rowsRead:Number(img.rowsFound)||0}));S.data.importBatches.push({id:batchId,mode:'print',sourceBank:selected[0]?.sourceBank||'generic',accountId:resolveAccountId(st.selectedBank)||'',bankName:accountNameSnapshot(st.selectedBank,st.detectedBank),createdAt:Date.now(),referenceDate:st.referenceDate,referenceMonth:st.referenceMonth,files,counts,totals,importKeys:selected.map(r=>r.importKey)});if(S.data.importBatches.length>100)S.data.importBatches.splice(0,S.data.importBatches.length-100);
  },err=>{console.error('[IMPORT_PRINT][ROLLBACK]',{err,row:failedRow});});
  selected.forEach(r=>{delete r._resolvedReserveSourceId;delete r._resolvedReserveDestinationId;});
  if(!ok){toast(`A importação falhou na linha “${failedRow&&failedRow.nome||'desconhecida'}” e nenhuma alteração foi mantida.`);renderView();return;}
  saveCurrentData();cleanupStatementImportImages(st);S.importState=createEmptyImportState({mode:'image'});renderView();toast(`Importação concluída: ${counts.imported} movimentação(ões), ${counts.duplicatesIgnored} duplicidade(s) ignorada(s).`);
}

const legacyStatementReviewDuplicates=ImportStatement.reviewDuplicates.bind(ImportStatement);

Object.assign(ImportStatement,{
  reviewDuplicates(){
    const st=ensureImportState();
    if(st.mode!=='image') return legacyStatementReviewDuplicates();
    const dups=st.parsed.filter(r=>r.duplicate||r.duplicado);
    if(!dups.length){toast('Nenhuma duplicidade encontrada nesta revisão.');return;}
    openChoiceModal({title:'Revisar duplicidades dos prints',sub:`${dups.length} linha(s) foram desmarcadas por segurança. Para importar uma delas mesmo assim, use “Forçar esta linha” no respectivo card e confirme individualmente.`,choices:[{label:'Manter duplicidades fora',onClick:()=>{dups.forEach(r=>{r.incluir=false;r.forceDuplicate=false;});closeModal();renderView();}},{label:'Fechar',onClick:closeModal}]});
  },
  forceDuplicate(index){
    const st=ensureImportState(),r=st.parsed[index];if(!r||!r.duplicate||r.duplicateType==='batch')return;
    openChoiceModal({title:'Forçar possível duplicado',sub:`A movimentação “${r.nome}” de ${r.data} no valor de ${brl(r.valor)} parece já existir. Importe somente se tiver certeza de que é outra movimentação real.`,choices:[{label:'Forçar somente esta linha',variant:'danger',onClick:()=>{r.forceDuplicate=true;r.incluir=true;closeModal();recalculateImageImportStats(false);renderView();toast('Linha autorizada individualmente.');}},{label:'Cancelar',onClick:closeModal}]});
  },
  pickImages(event){const files=event&&event.target&&event.target.files;this.handleImageFiles(files);if(event&&event.target)event.target.value='';},
  async handleImageFiles(files){
    const st=ensureImportState();st.mode='image';st.lastError='';const incoming=Array.from(files||[]);const allowed=new Set(['image/png','image/jpeg','image/webp']);let accepted=0;
    for(const file of incoming){if(st.images.length>=10){st.lastError='O limite é de 10 imagens por processamento.';break;}if(!allowed.has(file.type)){st.lastError=`${file.name}: formato não suportado. Use PNG, JPG, JPEG ou WEBP.`;continue;}if(file.size>12*1024*1024){st.lastError=`${file.name}: arquivo maior que 12 MB.`;continue;}
      try{const fingerprint=await statementFingerprint(file);if(st.images.some(x=>x.fingerprint===fingerprint)){st.lastError=`${file.name}: este print já está selecionado.`;continue;}const item={id:uid(),name:file.name,type:file.type,size:file.size,file,objectUrl:URL.createObjectURL(file),fingerprint,status:'pending',progress:0,ocrText:'',confidence:0,error:'',rowsFound:0};st.images.push(item);accepted++;if(st.images.length===1){const fd=statementDateFromFile(file);if(fd){st.referenceDate=fd;st.referenceMonth=fd.slice(0,7);}}}catch(err){st.lastError=`${file.name}: não foi possível preparar a imagem (${err.message||err}).`;}}
    if(accepted)toast(`${accepted} print(s) adicionado(s).`);renderView();
  },
  dropImages(event){event.preventDefault();this.handleImageFiles(event.dataTransfer&&event.dataTransfer.files);},
  pasteImage(event){const items=Array.from(event.clipboardData&&event.clipboardData.items||[]);const files=items.filter(i=>i.kind==='file'&&/^image\//.test(i.type)).map(i=>i.getAsFile()).filter(Boolean);if(files.length){event.preventDefault();this.handleImageFiles(files);}else toast('A área de transferência não contém uma imagem compatível.');},
  removeImage(id){const st=ensureImportState();const idx=st.images.findIndex(x=>x.id===id);if(idx<0)return;const [img]=st.images.splice(idx,1);if(img.objectUrl)URL.revokeObjectURL(img.objectUrl);img.file=null;st.parsed=st.parsed.filter(r=>r.sourceImageFingerprint!==img.fingerprint);recalculateImageImportStats(false);renderView();},
  clearImages(){const st=ensureImportState();cleanupStatementImportImages(st);st.parsed=[];st.detectedBank='';st.detectedBalance=null;st.relativeDatesFound=false;st.lastError='';st.ocrStatus='idle';st.ocrProgress=0;st.ocrStage='';renderView();},
  moveImage(id,delta){const st=ensureImportState(),i=st.images.findIndex(x=>x.id===id),j=i+Number(delta);if(i<0||j<0||j>=st.images.length)return;const [img]=st.images.splice(i,1);st.images.splice(j,0,img);st.images.forEach((x,k)=>{st.parsed.filter(r=>r.sourceImageFingerprint===x.fingerprint).forEach(r=>r.sourceImageIndex=k);});renderView();},
  async processImages(){
    const st=ensureImportState();if(!st.images.length){toast('Selecione pelo menos um print.');return;}st.mode='image';st.ocrStatus='processing';st.ocrCancelable=true;st.ocrCancelRequested=false;st.ocrTotalImages=st.images.length;st.parsed=[];st.lastError='';st.detectedBalance=null;st.relativeDatesFound=false;renderView();
    try{await loadStatementOcrEngine();for(let i=0;i<st.images.length;i++){if(st.ocrCancelRequested)throw new Error('leitura_cancelada');const img=st.images[i];st.ocrCurrentImage=i+1;img.status='processing';img.error='';updateStatementOcrProgress('processing',0,`Preparando imagem ${i+1} de ${st.images.length}`);let prepared=null,ocr=null,rows=[];
        try{prepared=await prepareStatementImage(img.file,{enhance:false});updateStatementOcrProgress('processing',.05,`Lendo imagem ${i+1} de ${st.images.length}`);ocr=await ocrStatementImage(prepared,img);const context={referenceDate:st.referenceDate,referenceMonth:st.referenceMonth,imageIndex:i,imageFingerprint:img.fingerprint,fileName:img.name,accountId:resolveAccountId(st.selectedBank),relativeDatesFound:false,detectedBalance:null};rows=parseImageStatement(ocr,context);if((!rows.length||ocr.confidence<45)&&!st.ocrCancelRequested){prepared.release();prepared=await prepareStatementImage(img.file,{enhance:true});ocr=await ocrStatementImage(prepared,img);rows=parseImageStatement(ocr,context);}img.ocrText=ocr.text||'';img.confidence=ocr.confidence||0;img.rowsFound=rows.length;img.status='done';st.detectedBank=context.detectedBank||st.detectedBank;st.detectedBalance=context.detectedBalance==null?st.detectedBalance:context.detectedBalance;st.relativeDatesFound=st.relativeDatesFound||context.relativeDatesFound;st.parsed.push(...rows);}catch(err){if(String(err.message||err)==='leitura_cancelada')throw err;img.status='error';img.error=err.message||String(err);}finally{if(prepared)prepared.release();}
        updateStatementOcrProgress('processing',(i+1)/st.images.length,`Interpretando movimentações da imagem ${i+1} de ${st.images.length}`);}
      updateStatementOcrProgress('processing',.98,'Verificando duplicidades');mergeImageRows(st.parsed);if(st.detectedBank&&!st.selectedBank)st.selectedBank=resolveAccountId(st.detectedBank)||'';st.parsed.forEach(r=>{if(!r.accountId&&st.selectedBank){r.accountId=st.selectedBank;r.sourceAccountId=st.selectedBank;r.destinationAccountId=st.selectedBank;r.banco=accountNameSnapshot(st.selectedBank);r.importKey=createImageImportKey(r);}});recalculateImageImportStats(false);st.ocrStatus='done';st.ocrProgress=1;st.ocrStage='Revisão pronta';st.ocrCancelable=false;if(!st.parsed.length)st.lastError='Não encontrei valores monetários nas imagens. Verifique se o print está nítido e contém as movimentações.';
    }catch(err){if(String(err.message||err)==='leitura_cancelada'){st.ocrStatus='cancelled';st.ocrStage='Leitura cancelada';st.images.forEach(img=>{if(img.status==='processing')img.status='cancelled';});}else{st.ocrStatus='error';st.lastError=err.message||String(err);}st.ocrCancelable=false;}renderView();
  },
  cancelImageProcessing(){const st=ensureImportState();st.ocrCancelRequested=true;st.ocrCancelable=false;st.ocrStage='Cancelando com segurança…';renderView();},
  reprocessImage(id){const st=ensureImportState();const img=st.images.find(x=>x.id===id);if(!img)return;st.images=[img].concat(st.images.filter(x=>x.id!==id));this.processImages();},
  setReferenceDate(value){const st=ensureImportState();st.referenceDate=value||todayISO();if(st.parsed.length){st.parsed.forEach(r=>{if(/\b(hoje|ontem)\b/i.test(r.original)){const d=resolveStatementDate(r.original,st.referenceDate,st.referenceMonth);if(d.date)r.data=d.date;r.importKey=createImageImportKey(r);}});mergeImageRows(st.parsed);recalculateImageImportStats(false);}renderView();},
  setReferenceMonth(value){const st=ensureImportState();st.referenceMonth=value||st.referenceMonth;if(st.parsed.length){st.parsed.forEach(r=>{const d=resolveStatementDate(r.original,st.referenceDate,st.referenceMonth);if(d.date)r.data=d.date;r.importKey=createImageImportKey(r);});mergeImageRows(st.parsed);recalculateImageImportStats(false);}renderView();},
  updateImageRow(index,key,value){const st=ensureImportState(),r=st.parsed[index];if(!r)return;if(key==='valor')value=Math.abs(Number(value)||0);r[key]=value;if(key==='accountId'){r.sourceAccountId=value;r.destinationAccountId=value;r.banco=accountNameSnapshot(value);}if(['data','hora','nome','valor','sourceAccountId','destinationAccountId','accountId'].includes(key)){r.importKey=createImageImportKey(r);const dup=findExistingImageDuplicate(r);r.duplicate=!!dup;r.duplicado=!!dup;r.duplicateType=dup?dup.type:'';r.duplicateReason=dup?dup.reason:'';}validateImageImportRow(r,true);recalculateImageImportStats(false);renderView();},
  updateImageRowKind(index,kind){const st=ensureImportState(),r=st.parsed[index];if(!r)return;r.kind=kind;r.incluir=kind!=='ignore';r.tipo=kind==='income'?'receita':kind==='fixed'?'fixa':kind==='expense'?'variavel':'transferencia';if(kind==='income'){r.direction='in';r.origem=r.origem||'propria';r.categoria=inferCategory('receita',r.nome);}else if(kind==='expense'||kind==='fixed'){r.direction='out';r.categoria=inferCategory(kind==='fixed'?'fixa':'variavel',r.nome);}if(kind==='account_to_reserve'&&!r.reserveDestinationName)r.reserveDestinationName=r.nome;if(kind==='reserve_to_account'&&!r.reserveSourceName)r.reserveSourceName=r.nome;validateImageImportRow(r,true);recalculateImageImportStats(false);renderView();},
  updateReserveMapping(sourceName,value,index,side){const st=ensureImportState(),r=st.parsed[index];if(!r)return;if(side==='source')r.reserveSourceId=value;else r.reserveDestinationId=value;const root=S.data.importPreferences.reserveMappings.mercado_pago||(S.data.importPreferences.reserveMappings.mercado_pago={});if(value&&!String(value).startsWith('__create__:'))root[stableStatementString(sourceName)]=value;r.confidence.mapping=value?1:0;r.confidence.overall=calculateRowConfidence(r.confidence);r.confidenceLevel=statementConfidenceLevel(r.confidence.overall);validateImageImportRow(r,true);recalculateImageImportStats(false);renderView();},
  addManualImageRow(){const st=ensureImportState(),accountId=resolveAccountId(st.selectedBank)||'';const r=buildImageImportRow({ocr:{confidence:100},imageIndex:-1,imageFingerprint:'manual',fileName:'Linha manual',data:st.referenceDate,hora:'',nome:'Movimentação manual',operationLabel:'Manual',externalIdSuffix:'',signedValue:-0.01,classification:{kind:'expense',tipo:'variavel',direction:'out',formaPagamento:'Débito/Pix',classificationConfidence:1},raw:'Linha adicionada manualmente',lineConfidence:100,dateConfidence:1,accountId,sourceBank:stableStatementString(st.detectedBank)||'manual'});r.valor=0;r.signedValue=0;r.confidence.amount=0;r.incluir=false;validateImageImportRow(r,true);st.parsed.push(r);recalculateImageImportStats(false);renderView();},
  setBank(accountId,applyMissing){const st=ensureImportState();st.selectedBank=resolveAccountId(accountId)||'';if(st.mode!=='image'){if(applyMissing)st.parsed.forEach(r=>{if(!r.accountId||r.banco===st.detectedBank){r.accountId=st.selectedBank;r.banco=accountNameSnapshot(st.selectedBank,r.banco);}r.duplicado=isDuplicate(r);if(r.duplicado)r.incluir=false;});renderView();return;}if(applyMissing)st.parsed.forEach(r=>{r.accountId=st.selectedBank;r.banco=accountNameSnapshot(st.selectedBank);if(['expense','account_to_reserve','account_to_account'].includes(r.kind))r.sourceAccountId=st.selectedBank;if(['income','reserve_to_account'].includes(r.kind))r.destinationAccountId=st.selectedBank;r.importKey=createImageImportKey(r);});mergeImageRows(st.parsed);recalculateImageImportStats(false);renderView();},
  applyBankToAll(){const st=ensureImportState(),accountId=resolveAccountId(document.getElementById('import_bank')?.value||st.selectedBank);st.selectedBank=accountId||'';if(st.mode==='image'){st.parsed.forEach(r=>{r.accountId=accountId||'';r.banco=accountNameSnapshot(accountId);if(['expense','account_to_reserve','account_to_account'].includes(r.kind))r.sourceAccountId=accountId||'';if(['income','reserve_to_account'].includes(r.kind))r.destinationAccountId=accountId||'';r.importKey=createImageImportKey(r);});mergeImageRows(st.parsed);recalculateImageImportStats(false);renderView();return;}st.parsed.forEach(r=>{r.accountId=accountId||'';r.banco=accountNameSnapshot(accountId);r.duplicado=isDuplicate(r);if(r.duplicado)r.incluir=false;});renderView();},
  update(i,k,v){const st=ensureImportState();if(st.mode==='image'){this.updateImageRow(i,k,v);return;}if(!st.parsed[i])return;st.parsed[i][k]=v;if(k==='accountId')st.parsed[i].banco=accountNameSnapshot(v);if(['data','nome','valor','accountId'].includes(k)){st.parsed[i].duplicado=isDuplicate(st.parsed[i]);if(st.parsed[i].duplicado)st.parsed[i].incluir=false;}renderView();},
  updateType(i,tipo){const st=ensureImportState();if(st.mode==='image'){const map={receita:'income',variavel:'expense',fixa:'fixed'};this.updateImageRowKind(i,map[tipo]||tipo);return;}const r=st.parsed[i];if(!r)return;r.tipo=tipo;r.categoria=inferCategory(tipo,r.nome);renderView();},
  removeRow(i){const st=ensureImportState();st.parsed.splice(i,1);if(st.mode==='image')recalculateImageImportStats(false);renderView();},
  removeUnselected(){const st=ensureImportState();st.parsed=st.parsed.filter(r=>r.incluir);if(st.mode==='image')recalculateImageImportStats(false);renderView();},
  selectAll(flag){const st=ensureImportState();st.parsed.forEach(r=>{r.incluir=!!flag&&!r.duplicado&&r.kind!=='unknown'&&r.kind!=='ignore';});if(st.mode==='image')recalculateImageImportStats(false);renderView();}
});

window.loadStatementOcrEngine=loadStatementOcrEngine;
window.terminateStatementOcrEngine=terminateStatementOcrEngine;
window.cleanupStatementImportImages=cleanupStatementImportImages;
window.BorionImageImportInternals={normalizeOcrResult,groupOcrWordsIntoLines,detectImageStatementBank,parseImageStatement,parseMercadoPagoImage,resolveStatementDate,classifyMercadoPagoOperation,buildImageImportRow,createImageImportKey,findExistingImageDuplicate,mergeImageRows,recalculateImageImportStats,commitImageStatementImport,STATEMENT_OCR_VERSION};
