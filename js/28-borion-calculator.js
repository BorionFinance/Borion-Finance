/* Borion Finance v6.46.62 — Calculadora Borion
   Calculadora flutuante inspirada na ergonomia da Calculadora do Windows.
   Modos iniciais: Padrão, Científica e Conversor financeiro/unidades, com histórico.
*/
(function(){
  'use strict';

  const VERSION='6.46.62';
  const MAX_HISTORY=60;
  const CURRENCY_CACHE_MS=6*60*60*1000;
  const CURRENCY_FETCH_TIMEOUT_MS=12000;
  const CURRENCY_NAMES={
    BRL:'Real brasileiro',USD:'Dólar americano',EUR:'Euro',GBP:'Libra esterlina',JPY:'Iene japonês',
    CAD:'Dólar canadense',AUD:'Dólar australiano',CHF:'Franco suíço',CNY:'Yuan chinês',
    ARS:'Peso argentino',CLP:'Peso chileno',MXN:'Peso mexicano'
  };
  const UNIT_GROUPS={
    length:{label:'Comprimento',units:{m:['Metro',1],km:['Quilômetro',1000],cm:['Centímetro',.01],mm:['Milímetro',.001],in:['Polegada',.0254],ft:['Pé',.3048],yd:['Jarda',.9144],mi:['Milha',1609.344]}},
    mass:{label:'Massa',units:{kg:['Quilograma',1],g:['Grama',.001],mg:['Miligrama',.000001],t:['Tonelada',1000],lb:['Libra',.45359237],oz:['Onça',.028349523125]}},
    temperature:{label:'Temperatura',units:{C:['Celsius'],F:['Fahrenheit'],K:['Kelvin']}}
  };

  function escCalc(value){
    if(typeof window.esc==='function')return window.esc(String(value??''));
    return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(_){return value;}}
  function nowIso(){return new Date().toISOString();}
  function finiteNumber(value){const n=Number(value);return Number.isFinite(n)?n:null;}
  function parseLocaleNumber(value){
    let s=String(value??'').trim().replace(/\s/g,'');
    if(!s)return 0;
    if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');
    else if(s.includes(','))s=s.replace(',','.');
    s=s.replace(/[^0-9+\-eE.]/g,'');
    const n=Number(s);return Number.isFinite(n)?n:0;
  }
  function cleanNumber(n){
    if(!Number.isFinite(n))throw new Error('Resultado indefinido');
    if(Object.is(n,-0))n=0;
    const abs=Math.abs(n);
    if(abs!==0&&(abs>=1e15||abs<1e-12))return Number(n.toPrecision(14));
    return Number(n.toPrecision(14));
  }
  function rawNumber(n){
    n=cleanNumber(n);
    if(Math.abs(n)>=1e15||(Math.abs(n)>0&&Math.abs(n)<1e-10))return n.toExponential(10).replace(/\.?(0+)(e)/,'$2');
    return String(n);
  }
  function formatDisplay(value){
    const n=Number(value);
    if(!Number.isFinite(n))return 'Erro';
    const abs=Math.abs(n);
    if(abs>=1e15||(abs>0&&abs<1e-10))return n.toLocaleString('pt-BR',{maximumSignificantDigits:13,notation:'scientific'});
    return n.toLocaleString('pt-BR',{maximumSignificantDigits:14,maximumFractionDigits:12});
  }
  function formatEntry(raw){
    if(raw===''||raw==='-'||raw==='-.')return raw||'0';
    if(/[eE]/.test(raw))return formatDisplay(Number(raw));
    const negative=raw.startsWith('-');
    const body=negative?raw.slice(1):raw;
    const [wholeRaw,frac]=body.split('.');
    const whole=Number(wholeRaw||0).toLocaleString('pt-BR',{maximumFractionDigits:0});
    return (negative?'-':'')+whole+(body.includes('.')?','+(frac||''):'');
  }
  function prettyExpression(expr){
    return String(expr||'').replace(/\*/g,'×').replace(/\//g,'÷').replace(/\^/g,'^').replace(/\./g,',');
  }
  function operatorLabel(op){return ({'+':'+','-':'−','*':'×','/':'÷','^':'xʸ'})[op]||op;}

  function prefs(create=false){
    const fallback={enabled:false,minimized:true,side:'right',y:null,panelW:390,panelH:650,mode:'standard',history:[],memory:0,angle:'DEG',converter:{category:'currency',amount:'1',from:'BRL',to:'USD',rates:{},liveRates:{},lastRateError:'',units:{length:['m','km'],mass:['kg','g'],temperature:['C','F']}}};
    if(typeof S==='undefined'||!S.data)return clone(fallback);
    if(create){
      if(!S.data.uiPreferences)S.data.uiPreferences={};
      if(!S.data.uiPreferences.borionCalculator||typeof S.data.uiPreferences.borionCalculator!=='object')S.data.uiPreferences.borionCalculator=clone(fallback);
      const p=S.data.uiPreferences.borionCalculator;
      if(typeof p.enabled!=='boolean')p.enabled=false;
      if(typeof p.minimized!=='boolean')p.minimized=true;
      if(!['left','right'].includes(p.side))p.side='right';
      if(typeof p.y!=='number')p.y=null;
      if(!Number.isFinite(Number(p.panelW)))p.panelW=390;
      if(!Number.isFinite(Number(p.panelH)))p.panelH=650;
      p.panelW=Math.max(330,Math.min(680,Number(p.panelW)||390));
      p.panelH=Math.max(500,Math.min(860,Number(p.panelH)||650));
      if(!['standard','scientific','converter'].includes(p.mode))p.mode='standard';
      if(!Array.isArray(p.history))p.history=[];
      p.history=p.history.slice(0,MAX_HISTORY);
      if(!Number.isFinite(Number(p.memory)))p.memory=0;
      if(!['DEG','RAD'].includes(p.angle))p.angle='DEG';
      if(!p.converter||typeof p.converter!=='object')p.converter=clone(fallback.converter);
      const c=p.converter;
      if(!['currency','length','mass','temperature'].includes(c.category))c.category='currency';
      if(typeof c.amount!=='string')c.amount='1';
      if(!CURRENCY_NAMES[c.from])c.from='BRL';
      if(!CURRENCY_NAMES[c.to])c.to='USD';
      if(!c.rates||typeof c.rates!=='object')c.rates={};
      if(!c.liveRates||typeof c.liveRates!=='object')c.liveRates={};
      if(typeof c.lastRateError!=='string')c.lastRateError='';
      if(!c.units||typeof c.units!=='object')c.units=clone(fallback.converter.units);
      for(const key of Object.keys(UNIT_GROUPS)){
        const keys=Object.keys(UNIT_GROUPS[key].units);
        if(!Array.isArray(c.units[key])||c.units[key].length<2)c.units[key]=[keys[0],keys[1]||keys[0]];
        if(!keys.includes(c.units[key][0]))c.units[key][0]=keys[0];
        if(!keys.includes(c.units[key][1]))c.units[key][1]=keys[1]||keys[0];
      }
    }
    return (S.data.uiPreferences&&S.data.uiPreferences.borionCalculator)||clone(fallback);
  }

  function savePrefs(){
    try{if(typeof window.saveCurrentData==='function')saveCurrentData();}catch(e){console.warn('[BORION_CALCULATOR][SAVE]',e);}
  }

  function calculatorIconSVG(){
    return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2.8" width="16" height="18.4" rx="2.5"/><rect x="7" y="5.8" width="10" height="3.4" rx="1"/><path d="M8 13h2M14 13h2M8 17h2M14 17h2"/></svg>`;
  }
  function backspaceSVG(){return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 7-5 5 5 5h10a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1Z"/><path d="m13 10 4 4M17 10l-4 4"/></svg>`;}
  function historySVG(){return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/></svg>`;}
  function resizeSVG(){return `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="18" cy="6" r="1.5"/><circle cx="18" cy="12" r="1.5"/><circle cx="18" cy="18" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="18" r="1.5"/><circle cx="6" cy="18" r="1.5"/></svg>`;}

  // Parser matemático seguro para +, -, ×, ÷, potência e parênteses.
  function tokenize(expr){
    const tokens=[];let i=0;
    while(i<expr.length){
      const ch=expr[i];
      if(/\s/.test(ch)){i++;continue;}
      if(/[0-9.]/.test(ch)){
        let s='';let dots=0;
        while(i<expr.length&&/[0-9.eE+\-]/.test(expr[i])){
          const c=expr[i];
          if(c==='.'&&++dots>1)break;
          if((c==='+'||c==='-')&&s&&!/[eE]$/.test(s))break;
          s+=c;i++;
        }
        const n=Number(s);if(!Number.isFinite(n))throw new Error('Número inválido');tokens.push({type:'number',value:n});continue;
      }
      if('+-*/^()'.includes(ch)){tokens.push({type:'op',value:ch});i++;continue;}
      throw new Error('Expressão inválida');
    }
    return tokens;
  }
  function evaluateExpression(expr){
    const input=tokenize(expr);const output=[];const ops=[];
    const prec={'+':1,'-':1,'*':2,'/':2,'^':3,'u-':4};
    const right={'^':true,'u-':true};let prev='start';
    for(const token of input){
      if(token.type==='number'){output.push(token);prev='number';continue;}
      let op=token.value;
      if(op==='('){ops.push(op);prev='open';continue;}
      if(op===')'){
        while(ops.length&&ops[ops.length-1]!=='(')output.push({type:'op',value:ops.pop()});
        if(!ops.length)throw new Error('Parênteses incompletos');ops.pop();prev='close';continue;
      }
      if(op==='-'&&(prev==='start'||prev==='op'||prev==='open'))op='u-';
      while(ops.length&&ops[ops.length-1]!=='('&&((right[op]?prec[op]<prec[ops[ops.length-1]]:prec[op]<=prec[ops[ops.length-1]])))output.push({type:'op',value:ops.pop()});
      ops.push(op);prev='op';
    }
    while(ops.length){const op=ops.pop();if(op==='(')throw new Error('Parênteses incompletos');output.push({type:'op',value:op});}
    const stack=[];
    for(const token of output){
      if(token.type==='number'){stack.push(token.value);continue;}
      if(token.value==='u-'){if(!stack.length)throw new Error('Expressão incompleta');stack.push(-stack.pop());continue;}
      if(stack.length<2)throw new Error('Expressão incompleta');
      const b=stack.pop(),a=stack.pop();let r;
      if(token.value==='+')r=a+b;else if(token.value==='-')r=a-b;else if(token.value==='*')r=a*b;else if(token.value==='/'){if(b===0)throw new Error('Não é possível dividir por zero');r=a/b;}else if(token.value==='^')r=Math.pow(a,b);
      stack.push(cleanNumber(r));
    }
    if(stack.length!==1)throw new Error('Expressão incompleta');return cleanNumber(stack[0]);
  }

  const Calc={
    hostId:'borion_floating_calculator_host',bubbleSize:60,edgeGap:14,gap:12,active:false,resizeActive:null,dragActive:null,saveTimer:null,rateRequest:null,suppressBubbleClickUntil:0,
    state:{entry:'0',hasEntry:true,expression:'',justEvaluated:false,error:false,lastOp:null,lastOperand:null,lastExpression:'',historyOpen:false},
    prefs,
    resetState(){this.state={entry:'0',hasEntry:true,expression:'',justEvaluated:false,error:false,lastOp:null,lastOperand:null,lastExpression:'',historyOpen:false};},
    scheduleSave(){clearTimeout(this.saveTimer);this.saveTimer=setTimeout(savePrefs,180);},
    topSafeMargin(){return 16;},
    bottomSafeMargin(){
      try{const nav=document.querySelector('.smart-bottom-nav');if(nav&&getComputedStyle(nav).display!=='none')return nav.getBoundingClientRect().height+18;}catch(_){}
      return 18;
    },
    clampY(y){const max=Math.max(this.topSafeMargin(),window.innerHeight-this.bottomSafeMargin()-this.bubbleSize);return Math.min(Math.max(Number(y)||0,this.topSafeMargin()),max);},
    avoidNotesCollision(p){
      try{
        const note=S&&S.data&&S.data.uiPreferences&&S.data.uiPreferences.floatingNotes;
        if(!note||note.enabled!==true||note.side!==p.side)return p;
        const noteY=this.clampY(typeof note.y==='number'?note.y:120);
        const minDistance=this.bubbleSize+10;
        if(Math.abs(Number(p.y)-noteY)>=minDistance)return p;
        const maxY=this.clampY(Number.MAX_SAFE_INTEGER);
        const below=noteY+minDistance;
        const above=noteY-minDistance;
        p.y=below<=maxY?this.clampY(below):this.clampY(above);
      }catch(_e){}
      return p;
    },
    ensurePrefs(){
      const p=prefs(true);p.y=typeof p.y==='number'?this.clampY(p.y):this.clampY(120);
      return this.avoidNotesCollision(p);
    },
    syncToggleUI(enabled){
      const isOn=enabled===true;
      document.querySelectorAll('[data-borion-calculator-toggle]').forEach(button=>{
        button.classList.toggle('on',isOn);
        button.setAttribute('aria-pressed',isOn?'true':'false');
        button.setAttribute('aria-label',(isOn?'Desativar':'Ativar')+' Calculadora Borion');
        const row=button.closest('.settings-calculator-toggle-row');
        const status=row&&row.querySelector('.settings-mini-status');
        if(status){status.classList.toggle('on',isOn);status.classList.toggle('off',!isOn);status.textContent=isOn?'Ativado':'Desativado';}
      });
    },
    setEnabled(enabled){
      const p=prefs(true);
      p.enabled=enabled===true;
      if(p.enabled){p.minimized=true;this.ensurePrefs();}
      savePrefs();
      this.syncToggleUI(p.enabled);
      this.render();
      try{window.BorionQuickTools&&BorionQuickTools.sync&&BorionQuickTools.sync();}catch(_e){}
      return p.enabled;
    },
    toggleEnabled(){return this.setEnabled(!(prefs(true).enabled===true));},
    currentValue(){const n=Number(this.state.entry);if(!Number.isFinite(n))throw new Error('Número inválido');return n;},
    setEntryNumber(n){this.state.entry=rawNumber(n);this.state.hasEntry=true;this.state.error=false;},
    displayText(){return this.state.error?'Erro':formatEntry(this.state.entry);},
    expressionText(){
      if(this.state.error)return 'Verifique a operação';
      if(this.state.expression)return prettyExpression(this.state.expression)+(this.state.hasEntry?' '+formatEntry(this.state.entry):'');
      return this.state.justEvaluated&&this.state.lastExpression?(prettyExpression(this.state.lastExpression)+' ='):'';
    },
    fullExpression(){return (this.state.expression+(this.state.hasEntry?this.state.entry:'')).trim();},
    updateDisplay(){
      const host=document.getElementById(this.hostId);if(!host)return;
      const e=host.querySelector('[data-calc-expression]'),d=host.querySelector('[data-calc-display]');
      if(e)e.textContent=this.expressionText();if(d)d.textContent=this.displayText();
      const mem=host.querySelector('[data-calc-memory-status]');if(mem)mem.textContent=Number(prefs(true).memory)!==0?'M':'';
    },
    recoverFromError(){if(this.state.error)this.resetState();},
    inputDigit(digit){
      this.recoverFromError();
      if(this.state.justEvaluated&&!this.state.expression){this.resetState();}
      if(!this.state.hasEntry||this.state.entry==='0'){this.state.entry=String(digit);this.state.hasEntry=true;}else if(this.state.entry==='-0')this.state.entry='-'+digit;else if(this.state.entry.replace(/[-.]/g,'').length<16)this.state.entry+=String(digit);
      this.state.justEvaluated=false;this.updateDisplay();
    },
    inputDecimal(){
      this.recoverFromError();if(this.state.justEvaluated&&!this.state.expression)this.resetState();
      if(!this.state.hasEntry){this.state.entry='0.';this.state.hasEntry=true;}else if(!this.state.entry.includes('.')&&!/[eE]/.test(this.state.entry))this.state.entry+='.';
      this.state.justEvaluated=false;this.updateDisplay();
    },
    commitEntry(){if(this.state.hasEntry){this.state.expression+=this.state.entry;this.state.hasEntry=false;this.state.entry='0';}},
    operator(op){
      this.recoverFromError();
      if(this.state.justEvaluated){this.state.expression=this.state.entry;this.state.hasEntry=false;this.state.justEvaluated=false;}
      else this.commitEntry();
      if(!this.state.expression&&op==='-'){this.state.entry='-0';this.state.hasEntry=true;this.updateDisplay();return;}
      if(/[+\-*/^]$/.test(this.state.expression))this.state.expression=this.state.expression.slice(0,-1)+op;else this.state.expression+=op;
      this.updateDisplay();
    },
    openParen(){
      this.recoverFromError();if(this.state.justEvaluated)this.resetState();
      if(this.state.hasEntry&&!(this.state.entry==='0'&&this.state.expression==='')){this.commitEntry();this.state.expression+='*';}
      else if(this.state.hasEntry&&this.state.entry==='0')this.state.hasEntry=false;
      if(/[0-9)]$/.test(this.state.expression))this.state.expression+='*';this.state.expression+='(';this.updateDisplay();
    },
    closeParen(){
      this.recoverFromError();this.commitEntry();
      const opens=(this.state.expression.match(/\(/g)||[]).length,closes=(this.state.expression.match(/\)/g)||[]).length;
      if(opens>closes&&!/[+\-*/^(]$/.test(this.state.expression))this.state.expression+=')';
      this.updateDisplay();
    },
    equals(){
      this.recoverFromError();let full=this.fullExpression();
      if(this.state.justEvaluated&&this.state.lastOp&&this.state.lastOperand!=null)full=this.state.entry+this.state.lastOp+this.state.lastOperand;
      else if(!full&&this.state.lastOp&&this.state.lastOperand!=null)full=this.state.entry+this.state.lastOp+this.state.lastOperand;
      if(!full)return;
      try{
        while((full.match(/\(/g)||[]).length>(full.match(/\)/g)||[]).length)full+=')';
        const result=evaluateExpression(full);
        const binary=full.match(/([+\-*/^])(-?\d+(?:\.\d+)?(?:e[+\-]?\d+)?)$/i);
        if(binary){this.state.lastOp=binary[1];this.state.lastOperand=Number(binary[2]);}
        this.state.lastExpression=full;
        this.addHistory(full,result);this.state.expression='';this.setEntryNumber(result);this.state.justEvaluated=true;this.updateDisplay();
      }catch(e){this.showError(e.message||'Operação inválida');}
    },
    showError(message){this.state.error=true;this.state.expression=String(message||'Operação inválida');this.state.entry='0';this.state.hasEntry=true;this.updateDisplay();},
    clearEntry(){this.state.entry='0';this.state.hasEntry=true;this.state.error=false;this.state.justEvaluated=false;this.updateDisplay();},
    clearAll(){this.resetState();this.updateDisplay();},
    backspace(){
      this.recoverFromError();if(!this.state.hasEntry||this.state.justEvaluated)return;
      let s=this.state.entry;if(s.length<=1||(s.length===2&&s.startsWith('-')))s='0';else s=s.slice(0,-1);this.state.entry=s;this.updateDisplay();
    },
    toggleSign(){this.recoverFromError();if(!this.state.hasEntry)this.state.hasEntry=true;this.state.entry=this.state.entry.startsWith('-')?this.state.entry.slice(1):'-'+this.state.entry;this.updateDisplay();},
    percent(){
      this.recoverFromError();try{
        const value=this.currentValue();const m=this.state.expression.match(/^(.*)([+\-*/^])$/);let result=value/100;
        if(m&&(m[2]==='+'||m[2]==='-')){const left=evaluateExpression(m[1]);result=left*value/100;}
        this.setEntryNumber(result);this.updateDisplay();
      }catch(e){this.showError(e.message);}
    },
    unary(kind){
      this.recoverFromError();try{
        let x=this.currentValue(),r,label;
        const p=prefs(true),angle=p.angle==='RAD'?x:x*Math.PI/180;
        if(kind==='reciprocal'){if(x===0)throw new Error('Não é possível dividir por zero');r=1/x;label=`1/(${x})`;}
        else if(kind==='square'){r=x*x;label=`sqr(${x})`;}
        else if(kind==='cube'){r=x*x*x;label=`cube(${x})`;}
        else if(kind==='sqrt'){if(x<0)throw new Error('Raiz inválida');r=Math.sqrt(x);label=`√(${x})`;}
        else if(kind==='abs'){r=Math.abs(x);label=`abs(${x})`;}
        else if(kind==='floor'){r=Math.floor(x);label=`floor(${x})`;}
        else if(kind==='ceil'){r=Math.ceil(x);label=`ceil(${x})`;}
        else if(kind==='ln'){if(x<=0)throw new Error('Logaritmo inválido');r=Math.log(x);label=`ln(${x})`;}
        else if(kind==='log'){if(x<=0)throw new Error('Logaritmo inválido');r=Math.log10(x);label=`log(${x})`;}
        else if(kind==='sin'){r=Math.sin(angle);label=`sin(${x}${p.angle==='DEG'?'°':''})`;}
        else if(kind==='cos'){r=Math.cos(angle);label=`cos(${x}${p.angle==='DEG'?'°':''})`;}
        else if(kind==='tan'){r=Math.tan(angle);label=`tan(${x}${p.angle==='DEG'?'°':''})`;}
        else if(kind==='asin'){if(x<-1||x>1)throw new Error('Valor fora do domínio');r=Math.asin(x);if(p.angle==='DEG')r=r*180/Math.PI;label=`asin(${x})`;}
        else if(kind==='acos'){if(x<-1||x>1)throw new Error('Valor fora do domínio');r=Math.acos(x);if(p.angle==='DEG')r=r*180/Math.PI;label=`acos(${x})`;}
        else if(kind==='atan'){r=Math.atan(x);if(p.angle==='DEG')r=r*180/Math.PI;label=`atan(${x})`;}
        else if(kind==='factorial'){
          if(x<0||x!==Math.floor(x)||x>170)throw new Error('Fatorial aceita inteiros de 0 a 170');r=1;for(let i=2;i<=x;i++)r*=i;label=`fact(${x})`;
        }else return;
        r=cleanNumber(r);const chained=!!this.state.expression;this.setEntryNumber(r);this.state.justEvaluated=false;if(!chained)this.addHistory(label,r);this.updateDisplay();
      }catch(e){this.showError(e.message);}
    },
    constant(name){this.recoverFromError();this.setEntryNumber(name==='pi'?Math.PI:Math.E);this.state.justEvaluated=false;this.updateDisplay();},
    exponent(){
      this.recoverFromError();const x=this.currentValue();this.setEntryNumber(x===0?1:x*10);this.updateDisplay();
    },
    memory(action){
      const p=prefs(true);let m=Number(p.memory)||0;
      try{
        if(action==='MC')m=0;else if(action==='MR')this.setEntryNumber(m);else if(action==='MS')m=this.currentValue();else if(action==='M+')m=cleanNumber(m+this.currentValue());else if(action==='M-')m=cleanNumber(m-this.currentValue());
        p.memory=m;this.scheduleSave();this.updateDisplay();
      }catch(e){this.showError(e.message);}
    },
    toggleAngle(){const p=prefs(true);p.angle=p.angle==='DEG'?'RAD':'DEG';this.scheduleSave();this.render();},
    addHistory(expression,result){
      const p=prefs(true);p.history.unshift({id:'calc-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),expression:prettyExpression(expression),result:rawNumber(result),at:nowIso()});p.history=p.history.slice(0,MAX_HISTORY);this.scheduleSave();
    },
    useHistory(id){const item=prefs(true).history.find(x=>x.id===id);if(!item)return;this.state.expression='';this.setEntryNumber(Number(item.result));this.state.justEvaluated=true;this.state.historyOpen=false;this.render();},
    clearHistory(){const p=prefs(true);p.history=[];this.scheduleSave();this.render();},
    toggleHistory(){this.state.historyOpen=!this.state.historyOpen;this.render();},
    setMode(mode){if(!['standard','scientific','converter'].includes(mode))return;const p=prefs(true);p.mode=mode;this.state.historyOpen=false;this.scheduleSave();this.render();},
    toggleMinimize(){const p=prefs(true);p.minimized=!p.minimized;this.active=!p.minimized;savePrefs();this.render();},
    openFromBubble(){
      if(Date.now()<Number(this.suppressBubbleClickUntil||0))return;
      const p=prefs(true);p.minimized=!p.minimized;this.active=!p.minimized;savePrefs();this.render();
      if(!p.minimized)setTimeout(()=>document.querySelector('#'+this.hostId+' .borion-calculator-panel')?.focus(),0);
    },
    openQuick(){
      const p=prefs(true);p.enabled=true;p.minimized=false;this.active=true;this.ensurePrefs();savePrefs();this.syncToggleUI(true);this.render();
      try{window.BorionQuickTools&&BorionQuickTools.sync&&BorionQuickTools.sync();}catch(_e){}
      setTimeout(()=>document.querySelector('#'+this.hostId+' .borion-calculator-panel')?.focus(),0);
      return true;
    },
    disable(){const p=prefs(true);p.enabled=false;savePrefs();this.render();},
    key(key){
      if(/^\d$/.test(key))return this.inputDigit(key);
      if(key==='decimal')return this.inputDecimal();if(key==='backspace')return this.backspace();if(key==='CE')return this.clearEntry();if(key==='C')return this.clearAll();
      if(key==='sign')return this.toggleSign();if(key==='percent')return this.percent();if(key==='equals')return this.equals();if(key==='paren-open')return this.openParen();if(key==='paren-close')return this.closeParen();
      if(['+','-','*','/','^'].includes(key))return this.operator(key);
    },
    handleKeyboard(ev){
      const p=prefs(false);if(!p.enabled||p.minimized||p.mode==='converter'||!this.active)return;
      const target=ev.target;const editable=target&&(target.matches?.('input,textarea,select')||target.isContentEditable);if(editable&&!target.closest?.('.borion-calculator-panel'))return;
      let handled=true;const k=ev.key;
      if(/^\d$/.test(k))this.inputDigit(k);else if(k==='.'||k===',')this.inputDecimal();else if(k==='+'||k==='-'||k==='*'||k==='/')this.operator(k);else if(k==='^')this.operator('^');
      else if(k==='Enter'||k==='=')this.equals();else if(k==='Backspace')this.backspace();else if(k==='Escape')this.clearAll();else if(k==='Delete')this.clearEntry();else if(k==='(')this.openParen();else if(k===')')this.closeParen();else handled=false;
      if(handled){ev.preventDefault();ev.stopPropagation();}
    },
    historyHTML(){
      const list=prefs(true).history;
      return `<div class="borion-calc-history ${this.state.historyOpen?'open':''}"><div class="borion-calc-history-head"><strong>Histórico</strong><button type="button" onclick="BorionCalculator.toggleHistory()" aria-label="Fechar histórico">×</button></div><div class="borion-calc-history-list">${list.length?list.map(item=>`<button type="button" onclick="BorionCalculator.useHistory('${escCalc(item.id)}')"><small>${escCalc(item.expression)}</small><strong>${escCalc(formatDisplay(Number(item.result)))}</strong></button>`).join(''):'<div class="borion-calc-empty">Nenhum cálculo ainda.</div>'}</div>${list.length?'<button type="button" class="borion-calc-clear-history" onclick="BorionCalculator.clearHistory()">Limpar histórico</button>':''}</div>`;
    },
    memoryHTML(){return `<div class="borion-calc-memory"><span data-calc-memory-status>${Number(prefs(true).memory)!==0?'M':''}</span>${['MC','MR','M+','M-','MS'].map(x=>`<button type="button" onclick="BorionCalculator.memory('${x}')">${x}</button>`).join('')}</div>`;},
    standardKeysHTML(){
      const keys=[
        ['percent','%','utility'],['CE','CE','utility'],['C','C','utility'],['backspace',backspaceSVG(),'utility'],
        ['unary:reciprocal','1/x','function'],['unary:square','x²','function'],['unary:sqrt','√x','function'],['/','÷','operator'],
        ['7','7','number'],['8','8','number'],['9','9','number'],['*','×','operator'],
        ['4','4','number'],['5','5','number'],['6','6','number'],['-','−','operator'],
        ['1','1','number'],['2','2','number'],['3','3','number'],['+','+','operator'],
        ['sign','±','number'],['0','0','number'],['decimal',',','number'],['equals','=','equals']
      ];return `<div class="borion-calc-keypad standard">${keys.map(([key,label,cls])=>key.startsWith('unary:')?`<button type="button" class="${cls}" onclick="BorionCalculator.unary('${key.split(':')[1]}')">${label}</button>`:`<button type="button" class="${cls}" onclick="BorionCalculator.key('${key}')">${label}</button>`).join('')}</div>`;
    },
    scientificKeysHTML(){
      const p=prefs(true);const keys=[
        ['angle',p.angle,'utility'],['constant:pi','π','function'],['constant:e','e','function'],['paren-open','(','function'],['paren-close',')','function'],
        ['unary:sin','sin','function'],['unary:cos','cos','function'],['unary:tan','tan','function'],['unary:square','x²','function'],['unary:sqrt','√x','function'],
        ['unary:asin','sin⁻¹','function'],['unary:acos','cos⁻¹','function'],['unary:atan','tan⁻¹','function'],['^','xʸ','operator'],['unary:factorial','n!','function'],
        ['unary:ln','ln','function'],['unary:log','log','function'],['unary:abs','|x|','function'],['unary:floor','floor','function'],['unary:ceil','ceil','function'],
        ['7','7','number'],['8','8','number'],['9','9','number'],['/','÷','operator'],['percent','%','utility'],
        ['4','4','number'],['5','5','number'],['6','6','number'],['*','×','operator'],['CE','CE','utility'],
        ['1','1','number'],['2','2','number'],['3','3','number'],['-','−','operator'],['C','C','utility'],
        ['sign','±','number'],['0','0','number'],['decimal',',','number'],['+','+','operator'],['equals','=','equals']
      ];
      return `<div class="borion-calc-keypad scientific">${keys.map(([key,label,cls])=>{
        if(key==='angle')return `<button type="button" class="${cls}" onclick="BorionCalculator.toggleAngle()">${label}</button>`;
        if(key.startsWith('constant:'))return `<button type="button" class="${cls}" onclick="BorionCalculator.constant('${key.split(':')[1]}')">${label}</button>`;
        if(key.startsWith('unary:'))return `<button type="button" class="${cls}" onclick="BorionCalculator.unary('${key.split(':')[1]}')">${label}</button>`;
        return `<button type="button" class="${cls}" onclick="BorionCalculator.key('${key}')">${label}</button>`;
      }).join('')}</div>`;
    },
    unitOptions(category,selected){const group=UNIT_GROUPS[category];return Object.entries(group.units).map(([key,val])=>`<option value="${key}" ${key===selected?'selected':''}>${escCalc(val[0])}</option>`).join('');},
    currencyOptions(selected){return Object.entries(CURRENCY_NAMES).map(([code,name])=>`<option value="${code}" ${code===selected?'selected':''}>${code} — ${escCalc(name)}</option>`).join('');},
    liveRateRecord(c,base){
      const row=c&&c.liveRates&&c.liveRates[base];
      return row&&row.rates&&typeof row.rates==='object'?row:null;
    },
    currencyRate(c,from=c.from,to=c.to){
      if(from===to)return 1;
      const live=this.liveRateRecord(c,from),liveValue=live&&Number(live.rates[to]);
      if(Number.isFinite(liveValue)&&liveValue>0)return liveValue;
      const reverseLive=this.liveRateRecord(c,to),reverseValue=reverseLive&&Number(reverseLive.rates[from]);
      if(Number.isFinite(reverseValue)&&reverseValue>0)return 1/reverseValue;
      const direct=Number(c.rates[from+'_'+to]);if(Number.isFinite(direct)&&direct>0)return direct;
      const reverse=Number(c.rates[to+'_'+from]);if(Number.isFinite(reverse)&&reverse>0)return 1/reverse;
      return null;
    },
    rateRecordFresh(record){
      if(!record||!record.fetchedAt)return false;
      const age=Date.now()-Number(record.fetchedAt||0);
      const today=new Date().toISOString().slice(0,10);
      return age>=0&&age<CURRENCY_CACHE_MS&&String(record.localDate||'')===today;
    },
    formatRateStamp(record){
      if(!record||!record.fetchedAt)return '';
      try{return new Date(record.fetchedAt).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}catch(_){return '';}
    },
    async fetchCurrencyBase(base){
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),CURRENCY_FETCH_TIMEOUT_MS);
      const normalize=(rates)=>{
        const out={};Object.entries(rates||{}).forEach(([code,value])=>{const n=Number(value);if(CURRENCY_NAMES[code]&&Number.isFinite(n)&&n>0)out[code]=n;});out[base]=1;return out;
      };
      try{
        try{
          const response=await fetch('https://open.er-api.com/v6/latest/'+encodeURIComponent(base),{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
          if(!response.ok)throw new Error('HTTP '+response.status);
          const data=await response.json();
          const rates=normalize(data&&data.rates);
          if(Object.keys(rates).length<2)throw new Error('Resposta sem cotações');
          return {rates,date:String(data.time_last_update_utc||data.time_last_update_unix||''),source:'ExchangeRate-API'};
        }catch(primaryError){
          if(controller.signal.aborted)throw primaryError;
          const response=await fetch('https://api.frankfurter.app/latest?from='+encodeURIComponent(base),{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
          if(!response.ok)throw new Error('HTTP '+response.status);
          const data=await response.json();
          const rates=normalize(data&&data.rates);
          if(Object.keys(rates).length<2)throw primaryError;
          return {rates,date:String(data.date||''),source:'Frankfurter'};
        }
      }finally{clearTimeout(timer);}
    },
    async refreshCurrencyRates(force=false){
      const p=prefs(true),c=p.converter,base=c.from||'BRL';
      const cached=this.liveRateRecord(c,base);
      if(!force&&this.rateRecordFresh(cached)){c.lastRateError='';return cached;}
      if(this.rateRequest&&this.rateRequest.base===base)return this.rateRequest.promise;
      const request={base,promise:null};this.rateRequest=request;c.lastRateError='';this.renderRateStatus('loading');
      request.promise=(async()=>{
        try{
          const payload=await this.fetchCurrencyBase(base);
          c.liveRates[base]={rates:payload.rates,fetchedAt:Date.now(),localDate:new Date().toISOString().slice(0,10),providerDate:payload.date,source:payload.source};
          c.lastRateError='';savePrefs();
          if(this.rateRequest===request)this.rateRequest=null;
          if(p.mode==='converter'&&c.category==='currency')this.render();
          return c.liveRates[base];
        }catch(error){
          c.lastRateError=navigator.onLine===false?'Sem internet para atualizar as moedas.':'Não foi possível buscar a cotação agora.';
          console.warn('[BORION_CALCULATOR][CURRENCY_RATE]',error);savePrefs();this.renderRateStatus('error');return null;
        }finally{if(this.rateRequest===request)this.rateRequest=null;}
      })();
      return request.promise;
    },
    ensureCurrencyRates(){
      const p=prefs(false),c=p.converter;if(!p.enabled||p.minimized||p.mode!=='converter'||c.category!=='currency')return;
      this.refreshCurrencyRates(false);
    },
    renderRateStatus(state){
      const host=document.getElementById(this.hostId),p=prefs(false),c=p.converter,el=host&&host.querySelector('[data-currency-rate-status]');if(!el)return;
      if(state==='loading'){el.className='borion-currency-rate-status loading';el.innerHTML='<span class="borion-rate-pulse"></span><strong>Atualizando cotação do dia…</strong>';return;}
      if(state==='error'){el.className='borion-currency-rate-status error';el.innerHTML='<strong>'+escCalc(c.lastRateError||'Cotação indisponível.')+'</strong><button type="button" onclick="BorionCalculator.refreshCurrencyRates(true)">Tentar novamente</button>';}
    },
    convertValue(category,amount,from,to,c){
      if(from===to)return amount;
      if(category==='currency'){const rate=this.currencyRate(c,from,to);return rate==null?null:amount*rate;}
      if(category==='temperature'){
        let celsius=from==='C'?amount:(from==='F'?(amount-32)*5/9:amount-273.15);
        return to==='C'?celsius:(to==='F'?celsius*9/5+32:celsius+273.15);
      }
      const group=UNIT_GROUPS[category];return amount*group.units[from][1]/group.units[to][1];
    },
    converterHTML(){
      const p=prefs(true),c=p.converter,cat=c.category,amount=parseLocaleNumber(c.amount);let from,to;
      if(cat==='currency'){from=c.from;to=c.to;}else{[from,to]=c.units[cat];}
      const result=this.convertValue(cat,amount,from,to,c);const rate=cat==='currency'?this.currencyRate(c,from,to):null;
      const optionsFrom=cat==='currency'?this.currencyOptions(from):this.unitOptions(cat,from),optionsTo=cat==='currency'?this.currencyOptions(to):this.unitOptions(cat,to);
      const record=cat==='currency'?this.liveRateRecord(c,from):null;
      let rateStatus='';
      if(cat==='currency'){
        if(this.rateRequest&&this.rateRequest.base===from)rateStatus='<div class="borion-currency-rate-status loading" data-currency-rate-status><span class="borion-rate-pulse"></span><strong>Atualizando cotação do dia…</strong></div>';
        else if(record)rateStatus=`<div class="borion-currency-rate-status ok" data-currency-rate-status><div><strong>Cotação automática</strong><small>${escCalc(this.formatRateStamp(record))}${record.source?' · '+escCalc(record.source):''}</small></div><button type="button" onclick="BorionCalculator.refreshCurrencyRates(true)" title="Atualizar cotação">↻</button></div>`;
        else if(c.lastRateError)rateStatus=`<div class="borion-currency-rate-status error" data-currency-rate-status><strong>${escCalc(c.lastRateError)}</strong><button type="button" onclick="BorionCalculator.refreshCurrencyRates(true)">Tentar novamente</button></div>`;
        else rateStatus='<div class="borion-currency-rate-status loading" data-currency-rate-status><span class="borion-rate-pulse"></span><strong>Buscando cotação do dia…</strong></div>';
      }
      return `<div class="borion-converter">
        <div class="borion-converter-tabs">${[['currency','Moedas'],['length','Comprimento'],['mass','Massa'],['temperature','Temperatura']].map(([k,l])=>`<button type="button" class="${cat===k?'active':''}" onclick="BorionCalculator.setConverterCategory('${k}')">${l}</button>`).join('')}</div>
        <label class="borion-converter-field"><span>Valor</span><input type="text" inputmode="decimal" value="${escCalc(c.amount)}" oninput="BorionCalculator.converterChanged('amount')" data-converter-amount></label>
        <div class="borion-converter-pair"><label><span>De</span><select data-converter-from onchange="BorionCalculator.converterChanged('selection')">${optionsFrom}</select></label><button type="button" class="borion-converter-swap" onclick="BorionCalculator.swapConverter()" title="Inverter">⇄</button><label><span>Para</span><select data-converter-to onchange="BorionCalculator.converterChanged('selection')">${optionsTo}</select></label></div>
        ${rateStatus}
        ${cat==='currency'&&rate!=null?`<div class="borion-converter-rate-line">1 ${escCalc(from)} = <strong>${escCalc(formatDisplay(cleanNumber(rate)))}</strong> ${escCalc(to)}</div>`:''}
        <div class="borion-converter-result"><small>Resultado</small><strong data-converter-result>${result==null?'Cotação indisponível':escCalc(formatDisplay(cleanNumber(result)))}</strong><span>${escCalc(to)}</span></div>
        <div class="borion-converter-note">As cotações são atualizadas automaticamente e podem variar em relação ao valor final do banco, cartão ou corretora.</div>
      </div>`;
    },
    setConverterCategory(category){const p=prefs(true);p.converter.category=category;this.scheduleSave();this.render();if(category==='currency')setTimeout(()=>this.ensureCurrencyRates(),0);},
    converterChanged(changeType='amount'){
      const host=document.getElementById(this.hostId),p=prefs(true),c=p.converter;if(!host)return;
      const amountEl=host.querySelector('[data-converter-amount]'),fromEl=host.querySelector('[data-converter-from]'),toEl=host.querySelector('[data-converter-to]');
      if(amountEl)c.amount=amountEl.value;
      const cat=c.category;
      if(cat==='currency'){
        const previousBase=c.from;
        c.from=fromEl?.value||c.from;
        c.to=toEl?.value||c.to;
        if(previousBase!==c.from)c.lastRateError='';
      }else c.units[cat]=[fromEl?.value||c.units[cat][0],toEl?.value||c.units[cat][1]];
      this.scheduleSave();

      /* Ao trocar origem/destino, reconstrói o bloco inteiro. Assim a linha
         "1 BRL = ... USD", a sigla do resultado e a cotação exibida mudam junto
         com os selects, sem manter informação visual da moeda anterior. */
      if(changeType==='selection'){
        this.render();
        if(cat==='currency')setTimeout(()=>this.ensureCurrencyRates(),0);
        return;
      }

      const amount=parseLocaleNumber(c.amount),from=cat==='currency'?c.from:c.units[cat][0],to=cat==='currency'?c.to:c.units[cat][1],result=this.convertValue(cat,amount,from,to,c),resultEl=host.querySelector('[data-converter-result]');
      if(resultEl)resultEl.textContent=result==null?'Cotação indisponível':formatDisplay(cleanNumber(result));
      if(cat==='currency'&&!this.rateRecordFresh(this.liveRateRecord(c,c.from)))this.refreshCurrencyRates(false);
    },
    swapConverter(){
      const p=prefs(true),c=p.converter;if(c.category==='currency'){[c.from,c.to]=[c.to,c.from];c.lastRateError='';}else{[c.units[c.category][0],c.units[c.category][1]]=[c.units[c.category][1],c.units[c.category][0]];}this.scheduleSave();this.render();if(c.category==='currency')setTimeout(()=>this.ensureCurrencyRates(),0);
    },
    panelBodyHTML(mode){if(mode==='converter')return this.converterHTML();return `${this.memoryHTML()}${mode==='scientific'?this.scientificKeysHTML():this.standardKeysHTML()}`;},
    computeLayout(p){
      const vw=window.innerWidth,vh=window.innerHeight,top=this.topSafeMargin(),bottom=this.bottomSafeMargin();
      const maxW=Math.max(286,Math.min(vw-this.edgeGap*2-4,680)),maxH=Math.max(430,Math.min(vh-top-bottom-this.gap-this.bubbleSize,860));
      let panelW=Math.min(Math.max(p.panelW||390,330),maxW),panelH=Math.min(Math.max(p.panelH||650,500),maxH);
      const below=vh-bottom-(p.y+this.bubbleSize)-this.gap,above=p.y-top-this.gap;let openDown;
      if(panelH<=below)openDown=true;else if(panelH<=above)openDown=false;else{openDown=below>=above;panelH=Math.max(460,openDown?below:above);}
      return {panelW,panelH,openDown};
    },
    render(){
      let host=document.getElementById(this.hostId);
      if(typeof S==='undefined'||!S.currentProfile||!S.data){if(host)host.remove();return;}
      const p=this.ensurePrefs();if(!p.enabled){if(host)host.remove();return;}
      if(!host){host=document.createElement('div');host.id=this.hostId;host.className='floating-calculator-host';document.body.appendChild(host);}
      host.className='floating-calculator-host side-'+p.side+(p.minimized?' is-minimized':' is-open');
      const bubbleStyle=(p.side==='left'?`left:${this.edgeGap}px;right:auto;`:`right:${this.edgeGap}px;left:auto;`)+`top:${p.y}px;`;
      let panel='';
      if(!p.minimized){
        const L=this.computeLayout(p),anchorX=p.side==='left'?'left':'right',anchorY=L.openDown?'top':'bottom',horiz=anchorX==='left'?`left:${this.edgeGap}px;right:auto;`:`right:${this.edgeGap}px;left:auto;`,vert=anchorY==='top'?`top:${p.y+this.bubbleSize+this.gap}px;bottom:auto;`:`bottom:${window.innerHeight-p.y+this.gap}px;top:auto;`;
        const corner={x:anchorX==='left'?'right':'left',y:anchorY==='top'?'bottom':'top'},cursor=(corner.x==='left')===(corner.y==='top')?'nwse-resize':'nesw-resize';
        panel=`<section class="borion-calculator-panel" tabindex="0" data-anchor-x="${anchorX}" data-anchor-y="${anchorY}" style="${horiz}${vert}width:${L.panelW}px;height:${L.panelH}px;" onpointerdown="BorionCalculator.activate()">
          <header class="borion-calc-header borion-calculator-drag-handle"><div class="borion-calc-brand">${calculatorIconSVG()}<span><strong>Calculadora Borion</strong><small>v${VERSION}</small></span></div><div class="borion-calc-header-actions"><button type="button" onclick="BorionCalculator.toggleHistory()" title="Histórico">${historySVG()}</button><button type="button" onclick="BorionCalculator.toggleMinimize()" title="Minimizar">—</button></div></header>
          <nav class="borion-calc-modes" aria-label="Modos da calculadora"><button class="${p.mode==='standard'?'active':''}" onclick="BorionCalculator.setMode('standard')">Padrão</button><button class="${p.mode==='scientific'?'active':''}" onclick="BorionCalculator.setMode('scientific')">Científica</button><button class="${p.mode==='converter'?'active':''}" onclick="BorionCalculator.setMode('converter')">Conversor</button></nav>
          ${p.mode!=='converter'?`<div class="borion-calc-screen"><div class="borion-calc-expression" data-calc-expression>${escCalc(this.expressionText())}</div><div class="borion-calc-display" data-calc-display>${escCalc(this.displayText())}</div></div>`:''}
          <div class="borion-calc-body">${this.panelBodyHTML(p.mode)}</div>${this.historyHTML()}
          <div class="borion-calc-resize" style="${corner.y}:6px;${corner.x}:6px;cursor:${cursor};" title="Redimensionar">${resizeSVG()}</div>
        </section>`;
      }
      host.innerHTML=panel+`<button type="button" class="borion-calculator-bubble borion-calculator-drag-handle" style="${bubbleStyle}" onclick="BorionCalculator.openFromBubble()" title="${p.minimized?'Abrir':'Minimizar'} Calculadora Borion" aria-label="${p.minimized?'Abrir':'Minimizar'} Calculadora Borion">${calculatorIconSVG()}</button>`;
      this.bindDrag(host);this.bindResize(host);
      if(!p.minimized&&p.mode==='converter'&&p.converter.category==='currency')setTimeout(()=>this.ensureCurrencyRates(),0);
    },
    activate(){this.active=true;},
    bindDrag(host){
      if(!host||host.dataset.dragBound==='1')return;host.dataset.dragBound='1';
      host.addEventListener('pointerdown',ev=>{
        const handle=ev.target.closest('.borion-calculator-drag-handle');if(!handle||ev.target.closest('.borion-calc-resize'))return;if(ev.target.closest('button')&&!ev.target.closest('.borion-calculator-bubble'))return;
        const p=prefs(true);this.dragActive={id:ev.pointerId,startY:ev.clientY,baseY:Number(p.y)||0,lastY:Number(p.y)||0,lastX:ev.clientX,moved:false};host.classList.add('dragging');try{handle.setPointerCapture?.(ev.pointerId);}catch(_){}
      });
    },
    onPointerMove(ev){
      const host=document.getElementById(this.hostId);
      if(this.dragActive&&ev.pointerId===this.dragActive.id){const a=this.dragActive,dy=ev.clientY-a.startY;if(Math.abs(dy)>4||Math.abs(ev.clientX-a.lastX)>4)a.moved=true;a.lastY=this.clampY(a.baseY+dy);a.lastX=ev.clientX;const b=host?.querySelector('.borion-calculator-bubble');if(b)b.style.top=a.lastY+'px';}
      if(this.resizeActive&&ev.pointerId===this.resizeActive.id){const a=this.resizeActive,panel=host?.querySelector('.borion-calculator-panel');if(!panel)return;const dx=ev.clientX-a.startX,dy=ev.clientY-a.startY,maxW=Math.max(286,Math.min(window.innerWidth-this.edgeGap*2-4,680)),maxH=Math.max(430,Math.min(window.innerHeight-this.topSafeMargin()-this.bottomSafeMargin()-this.gap-this.bubbleSize,860));let w=a.anchorX==='right'?a.startW-dx:a.startW+dx,h=a.anchorY==='top'?a.startH+dy:a.startH-dy;w=Math.min(Math.max(w,286),maxW);h=Math.min(Math.max(h,430),maxH);panel.style.width=w+'px';panel.style.height=h+'px';a.lastW=w;a.lastH=h;}
    },
    onPointerEnd(ev){
      const host=document.getElementById(this.hostId);
      if(this.dragActive&&(!ev||ev.pointerId==null||ev.pointerId===this.dragActive.id)){const a=this.dragActive,p=prefs(true);if(a.moved){p.y=a.lastY;p.side=a.lastX<window.innerWidth/2?'left':'right';this.suppressBubbleClickUntil=Date.now()+320;savePrefs();}this.dragActive=null;host?.classList.remove('dragging');if(a.moved)this.render();}
      if(this.resizeActive&&(!ev||ev.pointerId==null||ev.pointerId===this.resizeActive.id)){const a=this.resizeActive,p=prefs(true);p.panelW=a.lastW;p.panelH=a.lastH;savePrefs();this.resizeActive=null;host?.querySelector('.borion-calculator-panel')?.classList.remove('resizing');this.render();}
    },
    bindResize(host){
      if(!host||host.dataset.resizeBound==='1')return;host.dataset.resizeBound='1';host.addEventListener('pointerdown',ev=>{const grip=ev.target.closest('.borion-calc-resize');if(!grip)return;ev.stopPropagation();const panel=host.querySelector('.borion-calculator-panel');if(!panel)return;this.resizeActive={id:ev.pointerId,startX:ev.clientX,startY:ev.clientY,startW:panel.offsetWidth,startH:panel.offsetHeight,anchorX:panel.dataset.anchorX,anchorY:panel.dataset.anchorY,lastW:panel.offsetWidth,lastH:panel.offsetHeight};panel.classList.add('resizing');try{grip.setPointerCapture?.(ev.pointerId);}catch(_){}});
    }
  };

  window.BorionCalculator=Calc;
  if(!window.Settings)window.Settings={};
  Settings.toggleBorionCalculator=function(){return Calc.toggleEnabled();};

  if(typeof window.renderView==='function'&&!window.__borionCalculatorViewWrapped){window.__borionCalculatorViewWrapped=true;const base=renderView;window.renderView=function(){const r=base.apply(this,arguments);setTimeout(()=>Calc.render(),0);return r;};}
  if(typeof window.renderApp==='function'&&!window.__borionCalculatorAppWrapped){window.__borionCalculatorAppWrapped=true;const base=renderApp;window.renderApp=function(){const r=base.apply(this,arguments);setTimeout(()=>Calc.render(),0);return r;};}
  window.addEventListener('resize',()=>{try{Calc.render();}catch(_){}});
  window.addEventListener('pointermove',ev=>Calc.onPointerMove(ev),{passive:true});
  window.addEventListener('pointerup',ev=>Calc.onPointerEnd(ev));window.addEventListener('pointercancel',ev=>Calc.onPointerEnd(ev));
  document.addEventListener('keydown',ev=>Calc.handleKeyboard(ev),true);
  document.addEventListener('pointerdown',ev=>{if(!ev.target.closest?.('.borion-calculator-panel'))Calc.active=false;},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>Calc.render(),0),{once:true});else setTimeout(()=>Calc.render(),0);
})();
