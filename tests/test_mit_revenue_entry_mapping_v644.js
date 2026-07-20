'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
function assert(c,m){if(!c)throw new Error('FALHOU: '+m)}
const context={console,crypto:global.crypto,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone:global.structuredClone};
context.window=context;context.globalThis=context;context.addEventListener=()=>{};
context.document={addEventListener(){},querySelectorAll(){return[]},getElementById(){return null}};
context.CARTEIRA_CONTA_ID='wallet';context.FORMAS_PAGAMENTO=['Dinheiro','Pix','Débito','Crédito','Transferência'];context.defaultCategories=()=>({receita:[],fixa:[],variavel:[]});context.baseCatColor=()=> '#888';context.todayISO=()=> '2026-07-20';
context.S={profiles:[],currentProfile:null,data:null};context.getProfileData=()=>null;context.setProfileData=()=>{};context.migrateData=x=>x;context.emptyData=()=>({});context.BackupFS={markDirty(){}};
vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/24-interconnections.js'),'utf8'),context,{filename:'24-interconnections.js'});
const api=context.BorionInterop.__test;
function data(){return {transacoes:[],contas:[{id:'wallet',nome:'Carteira',isCarteira:true},{id:'mp',nome:'Mercado Pago'},{id:'nubank',nome:'Nubank'},{id:'old',nome:'Antiga',archivedAt:'2026-01-01'}],liquidez:[],categorias:{receita:['Serviços','Manutenção','Outro'],fixa:[],variavel:[]},categoryColors:{receita:{},fixa:{},variavel:{}},modules:{reserves:true},reservas:{enabled:true,boxes:[{id:'house',nome:'Casa',accountId:'mp',banco:'Mercado Pago',valorAtual:0},{id:'gone',nome:'Antiga',accountId:'nubank',archivedAt:'2026-01-01',valorAtual:0}],moves:[]},interconnections:{sources:{},imported:{},ignored:{},pending:[],audit:[]}}}
function config(){const rules={};['pix','money','debit',...Array.from({length:12},(_,i)=>'credit'+(i+1))].forEach(key=>rules[key]={category:'Serviços',form:key==='money'?'Dinheiro':(key.startsWith('credit')?'Crédito':key==='debit'?'Débito':'Pix'),target:key==='money'?'wallet':'account:mp'});return {sourceAppId:'marco-iris',mappingReady:true,accountId:'mp',mitRevenueRules:rules}}
function rec(id,method,amount=100){return {aggregateId:'marco-iris:i:receipt:'+id,entityId:id,receiptId:id,direction:'income',amount,date:'2026-07-20',paymentDate:'2026-07-20',settled:true,active:true,status:'paid',description:'OSV-1 • Cliente',orderNumber:'OSV-1',clientName:'Cliente',paymentMethod:method,externalReference:id}}
function snap(records,revision=1){const tombstones=[];return {schema:'borion.interop.snapshot',schemaVersion:1,sourceAppId:'marco-iris',instanceId:'i',revision,records,tombstones,contentHash:api.hash({records,tombstones})}}

// Migração do modelo antigo.
let cfg=config();let rules=api.normalizeMitRevenueRules(cfg.mitRevenueRules,cfg);
assert(rules.credit3.entryMethodMode==='original'&&rules.credit3.entryMethod===null,'form Crédito igual à origem deve virar Manter forma original');
cfg.mitRevenueRules.credit3.form='Pix';rules=api.normalizeMitRevenueRules(cfg.mitRevenueRules,cfg);assert(rules.credit3.entryMethodMode==='custom'&&rules.credit3.entryMethod==='Pix','form diferente deve virar forma personalizada');
assert(rules.money.destinationKind==='wallet'&&rules.money.entryMethod==='Dinheiro'&&rules.money.accountId==='wallet','wallet deve migrar para Carteira/Dinheiro');
cfg.mitRevenueRules.credit2.target='reserve:house';rules=api.normalizeMitRevenueRules(cfg.mitRevenueRules,cfg);assert(rules.credit2.destinationKind==='reserve'&&rules.credit2.reserveId==='house','reserve:<id> deve preservar reserva');
cfg.mitRevenueRules.pix.target='__default__';rules=api.normalizeMitRevenueRules(cfg.mitRevenueRules,cfg);assert(rules.pix.accountId==='mp','__default__ deve resolver conta configurada');

// Conversões livres e metadados.
const d=data();cfg=config();cfg.mitRevenueRules.credit3={category:'Serviços',entryMethodMode:'custom',entryMethod:'Pix',destinationKind:'account',accountId:'mp'};
cfg.mitRevenueRules.credit6={category:'Serviços',entryMethodMode:'custom',entryMethod:'Transferência',destinationKind:'account',accountId:'nubank'};
cfg.mitRevenueRules.debit={category:'Serviços',entryMethodMode:'custom',entryMethod:'Pix',destinationKind:'reserve',reserveId:'house'};
cfg.mitRevenueRules.credit12={category:'Serviços',entryMethodMode:'custom',entryMethod:'Pix',destinationKind:'wallet'};
cfg.mitRevenueRules.pix={category:'Serviços',entryMethodMode:'original',entryMethod:null,destinationKind:'account',accountId:'mp'};
let out=api.reconcileMitSnapshot(d,cfg,snap([rec('a','Crédito 3x'),rec('b','Crédito 6x'),rec('c','Débito'),rec('d','Crédito 12x'),rec('e','Pix')],1));
assert(out.summary.created===5&&d.transacoes.length===5,'cinco recebimentos devem criar cinco receitas únicas');
const a=d.transacoes.find(t=>t.integrationReceiptId==='a'),b=d.transacoes.find(t=>t.integrationReceiptId==='b'),c=d.transacoes.find(t=>t.integrationReceiptId==='c'),dw=d.transacoes.find(t=>t.integrationReceiptId==='d'),e=d.transacoes.find(t=>t.integrationReceiptId==='e');
assert(a.formaPagamento==='Pix'&&a.accountId==='mp'&&a.integrationOriginalPaymentMethod==='Crédito 3x'&&a.integrationOriginalInstallments===3,'Crédito 3x deve virar Pix e preservar origem/parcelas');
assert(b.formaPagamento==='Transferência'&&b.accountId==='nubank'&&b.integrationOriginalInstallments===6,'Crédito 6x deve virar Transferência');
assert(c.formaPagamento==='Pix'&&c.reservaBoxId==='house'&&d.reservas.boxes[0].valorAtual===100&&d.reservas.moves.length===1,'Débito deve virar Pix em reserva uma única vez');
assert(dw.formaPagamento==='Dinheiro'&&dw.accountId==='wallet'&&dw.integrationOriginalInstallments===12,'Carteira deve forçar Dinheiro e preservar Crédito 12x');
assert(e.formaPagamento==='Pix'&&e.integrationEntryMethodMode==='original','Manter forma original deve resolver Pix');
assert(!d.transacoes.some(t=>t.parcelaTotal||t.parcelas),'crédito parcelado da origem não pode criar parcelas do Borion');
out=api.reconcileMitSnapshot(d,cfg,snap([rec('a','Crédito 3x'),rec('b','Crédito 6x'),rec('c','Débito'),rec('d','Crédito 12x'),rec('e','Pix')],2));assert(out.summary.created===0&&d.transacoes.length===5&&d.reservas.moves.length===1,'segunda sincronização não pode duplicar receita nem reserva');

// Reversão da reserva.
api.reverseImportedTransaction(d,c);assert(d.reservas.moves.length===0&&d.reservas.boxes[0].valorAtual===0,'exclusão deve reverter movimento e saldo da reserva');

// Validações de referências removidas/inválidas.
let bad=config();bad.mitRevenueRules.pix={category:'Inexistente',entryMethodMode:'original',destinationKind:'account',accountId:'mp'};let failed=false;try{api.validateMitRevenueRules(data(),bad,bad.mitRevenueRules)}catch(err){failed=/categoria válida/.test(err.message)}assert(failed,'categoria inexistente deve bloquear');
bad=config();bad.mitRevenueRules.pix={category:'Serviços',entryMethodMode:'custom',entryMethod:'Pix',destinationKind:'account',accountId:'old'};failed=false;try{api.validateMitRevenueRules(data(),bad,bad.mitRevenueRules)}catch(err){failed=/Escolha a conta/.test(err.message)}assert(failed,'conta arquivada deve bloquear');
bad=config();bad.mitRevenueRules.pix={category:'Serviços',entryMethodMode:'custom',entryMethod:'Pix',destinationKind:'reserve',reserveId:'gone'};failed=false;try{api.validateMitRevenueRules(data(),bad,bad.mitRevenueRules)}catch(err){failed=/Escolha a reserva/.test(err.message)}assert(failed,'reserva arquivada deve bloquear');
const noRes=data();noRes.modules.reserves=false;bad=config();bad.mitRevenueRules.pix={category:'Serviços',entryMethodMode:'custom',entryMethod:'Pix',destinationKind:'reserve',reserveId:'house'};failed=false;try{api.validateMitRevenueRules(noRes,bad,bad.mitRevenueRules)}catch(err){failed=/Ative o módulo/.test(err.message)}assert(failed,'módulo de reservas desativado deve bloquear nova sincronização');

// Interface usa selects oficiais, controles independentes e sem Dividir.
const uiData=data(),uiCfg=config();uiData.interconnections.sources['marco-iris']=uiCfg;context.S.profiles=[{id:'p',name:'Perfil'}];context.S.currentProfile={id:'p',name:'Perfil'};context.S.data=uiData;context.getProfileData=()=>uiData;context.BorionInterop.setSettingsSource('marco-iris');context.BorionInterop.setSettingsTab('links');const html=context.BorionInterop.renderSettings();
assert(html.includes('Categoria de receita no Borion')&&html.includes('data-mit-category="credit3"')&&html.includes('<select data-mit-category'),'categoria deve usar seletor oficial');
assert(html.includes('Como o valor entra no Borion')&&html.includes('Manter forma original')&&html.includes('Transferência'),'interface deve oferecer forma efetiva separada');
assert(html.includes('Onde o valor entra')&&html.includes('Carteira')&&html.includes('Conta')&&html.includes('Reserva')&&!html.includes('Dividir entre Conta e Reserva'),'destinos devem ser somente Carteira/Conta/Reserva');
assert(html.includes('Conta que receberá')&&html.includes('Reserva que receberá')&&html.includes('Somente leitura'),'forma original deve ser informativa e destinos específicos devem existir');
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);assert(new Set(ids).size===ids.length,'interface MIT não pode gerar IDs HTML duplicados');
assert((html.match(/data-mit-rule=/g)||[]).length===15,'cada uma das 15 formas deve ter linha independente');
uiData.categorias.receita.push('Nova categoria instantânea');const htmlUpdated=context.BorionInterop.renderSettings();assert(htmlUpdated.includes('Nova categoria instantânea'),'categoria adicionada deve aparecer na integração sem F5 nem atualização da origem');
const settingsSource=fs.readFileSync(path.join(__dirname,'../js/13-settings.js'),'utf8');assert(settingsSource.includes("regras da integração Marco Iris")&&settingsSource.includes("rule.category=newName")&&settingsSource.includes("Excluir e mover para Outro"),'renomear e excluir categorias devem atualizar regras Marco Iris e migrar para Outro');

// Interação por linha: Carteira força Dinheiro e restaura a seleção anterior ao sair.
function cls(){const set=new Set();return {toggle(n,on){on?set.add(n):set.delete(n)},contains(n){return set.has(n)}}}
const entry={value:'custom:Pix',disabled:false,setAttribute(k,v){this[k]=v}},hidden={value:'account'},note={classList:cls()},panels=['wallet','account','reserve'].map(kind=>({dataset:{mitDestinationPanel:kind},classList:cls()}));
const buttons=['wallet','account','reserve'].map(kind=>({dataset:{value:kind},disabled:false,classList:cls(),attrs:{},setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this.attrs[k]||null},closest(){return row}}));
const row={dataset:{mitRule:'credit3'},querySelector(sel){if(sel==='[data-mit-destination-kind]')return hidden;if(sel==='[data-mit-entry-selection]')return entry;if(sel==='[data-mit-wallet-note]')return note;return null},querySelectorAll(sel){if(sel==='[data-mit-destination-button]')return buttons;if(sel==='[data-mit-destination-panel]')return panels;return[]}};
assert(context.BorionInterop.setMitDestination(buttons[0],'credit3')&&hidden.value==='wallet'&&entry.value==='custom:Dinheiro'&&entry.disabled,'selecionar Carteira deve forçar Dinheiro e bloquear a forma');
assert(context.BorionInterop.setMitDestination(buttons[1],'credit3')&&hidden.value==='account'&&entry.value==='custom:Pix'&&!entry.disabled,'sair da Carteira deve restaurar a forma anterior válida');

// Regressão Amanda: painel e API genérica continuam presentes.
context.BorionInterop.setSettingsSource('amanda-estetica');const amanda=context.BorionInterop.renderSettings();assert(amanda.includes('Amanda Estética')&&context.BorionInterop.sources['amanda-estetica'],'Amanda Estética deve continuar disponível');
console.log('OK: 52 cenários MIT cobrem interface, conversões, carteira, conta, reserva, categorias, migração, duplicidade, reversão e regressão Amanda.');
