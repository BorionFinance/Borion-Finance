'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
function assert(c,m){if(!c)throw new Error('FALHOU: '+m)}
const context={console,crypto:global.crypto,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone:global.structuredClone};
context.window=context;context.globalThis=context;context.addEventListener=()=>{};
context.document={addEventListener(){},querySelectorAll(){return[]},querySelector(){return null},getElementById(){return null}};
context.CARTEIRA_CONTA_ID='wallet';context.FORMAS_PAGAMENTO=['Dinheiro','Pix','Débito','Crédito','Transferência'];context.defaultCategories=()=>({receita:[],fixa:[],variavel:[]});context.baseCatColor=()=> '#888';context.todayISO=()=> '2026-07-20';
context.S={profiles:[],currentProfile:null,data:null};context.getProfileData=()=>null;context.setProfileData=()=>{};context.migrateData=x=>x;context.emptyData=()=>({});context.BackupFS={markDirty(){}};
vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/24-interconnections.js'),'utf8'),context,{filename:'24-interconnections.js'});
const api=context.BorionInterop.__test;
function data(){return {transacoes:[],contas:[{id:'wallet',nome:'Carteira',isCarteira:true},{id:'mp',nome:'Mercado Pago'},{id:'nubank',nome:'Nubank'},{id:'old',nome:'Antiga',archivedAt:'2026-01-01'}],liquidez:[],categorias:{receita:['Serviços','Manutenção','Outro'],fixa:[],variavel:[]},categoryColors:{receita:{},fixa:{},variavel:{}},modules:{reserves:true},reservas:{enabled:true,boxes:[{id:'house',nome:'Casa',accountId:'mp',banco:'Mercado Pago',valorAtual:0},{id:'gone',nome:'Antiga',accountId:'nubank',archivedAt:'2026-01-01',valorAtual:0}],moves:[]},interconnections:{sources:{},imported:{},ignored:{},pending:[],audit:[]}}}
function config(){const rules={};['pix','money','debit',...Array.from({length:12},(_,i)=>'credit'+(i+1))].forEach(key=>rules[key]={category:'Serviços',entryMethodMode:'custom',entryMethod:'Transferência',form:'Pix',target:key==='money'?'wallet':'account:mp'});return {sourceAppId:'marco-iris',mappingReady:true,accountId:'mp',mitRevenueRules:rules}}
function rec(id,method,amount=100,installments){return {aggregateId:'marco-iris:i:receipt:'+id,entityId:id,receiptId:id,direction:'income',amount,date:'2026-07-20',paymentDate:'2026-07-20',settled:true,active:true,status:'paid',description:'OSV-1 • Cliente',orderNumber:'OSV-1',clientName:'Cliente',paymentMethod:method,installments,externalReference:id}}
function snap(records,revision=1){const tombstones=[];return {schema:'borion.interop.snapshot',schemaVersion:1,sourceAppId:'marco-iris',instanceId:'i',revision,records,tombstones,contentHash:api.hash({records,tombstones})}}

// Migração: campos antigos são aceitos, mas deixam de controlar a forma efetiva.
let cfg=config();let rules=api.normalizeMitRevenueRules(cfg.mitRevenueRules,cfg);
assert(!('entryMethodMode' in rules.credit3)&&!('entryMethod' in rules.credit3)&&!('form' in rules.credit3),'normalizador deve remover controles antigos de conversão');
assert(rules.money.destinationKind==='wallet'&&rules.money.accountId==='wallet','Dinheiro deve migrar obrigatoriamente para Carteira');
cfg.mitRevenueRules.credit2.target='reserve:house';rules=api.normalizeMitRevenueRules(cfg.mitRevenueRules,cfg);assert(rules.credit2.destinationKind==='reserve'&&rules.credit2.reserveId==='house','reserve:<id> deve preservar reserva');
cfg.mitRevenueRules.pix.target='__default__';rules=api.normalizeMitRevenueRules(cfg.mitRevenueRules,cfg);assert(rules.pix.accountId==='mp','__default__ deve resolver a conta configurada');

// A forma efetiva agora é automática e preserva a natureza recebida.
const d=data();cfg=config();
cfg.mitRevenueRules.credit3={category:'Serviços',entryMethodMode:'custom',entryMethod:'Pix',destinationKind:'account',accountId:'mp'};
cfg.mitRevenueRules.credit6={category:'Serviços',entryMethodMode:'custom',entryMethod:'Transferência',destinationKind:'account',accountId:'nubank'};
cfg.mitRevenueRules.debit={category:'Serviços',entryMethodMode:'custom',entryMethod:'Pix',destinationKind:'reserve',reserveId:'house'};
cfg.mitRevenueRules.credit12={category:'Serviços',entryMethodMode:'custom',entryMethod:'Pix',destinationKind:'wallet'};
cfg.mitRevenueRules.pix={category:'Serviços',entryMethodMode:'custom',entryMethod:'Transferência',destinationKind:'account',accountId:'mp'};
let out=api.reconcileMitSnapshot(d,cfg,snap([rec('a','Crédito 3x',100,3),rec('b','Crédito 6x',100,6),rec('c','Débito'),rec('d','Crédito 12x',100,12),rec('e','Pix')],1));
assert(out.summary.created===5&&d.transacoes.length===5,'cinco recebimentos devem criar cinco receitas únicas');
const a=d.transacoes.find(t=>t.integrationReceiptId==='a'),b=d.transacoes.find(t=>t.integrationReceiptId==='b'),c=d.transacoes.find(t=>t.integrationReceiptId==='c'),dw=d.transacoes.find(t=>t.integrationReceiptId==='d'),e=d.transacoes.find(t=>t.integrationReceiptId==='e');
assert(a.formaPagamento==='Crédito'&&a.accountId==='mp'&&a.integrationOriginalPaymentMethod==='Crédito 3x'&&a.integrationOriginalInstallments===3,'Crédito 3x deve permanecer Crédito e preservar parcelas');
assert(b.formaPagamento==='Crédito'&&b.accountId==='nubank'&&b.integrationOriginalInstallments===6,'Crédito 6x não pode virar Transferência');
assert(c.formaPagamento==='Débito'&&c.reservaBoxId==='house'&&d.reservas.boxes[0].valorAtual===100&&d.reservas.moves.length===1,'Débito em reserva deve preservar a forma e creditar uma vez');
assert(dw.formaPagamento==='Dinheiro'&&dw.accountId==='wallet'&&dw.integrationOriginalInstallments===12,'Carteira deve forçar Dinheiro e preservar Crédito 12x');
assert(e.formaPagamento==='Pix'&&e.integrationEntryMethodDerived===true,'Pix deve permanecer Pix por derivação automática');
assert(!d.transacoes.some(t=>t.parcelaTotal||t.parcelas),'crédito recebido não pode criar parcelamento de cartão no Borion');
out=api.reconcileMitSnapshot(d,cfg,snap([rec('a','Crédito 3x',100,3),rec('b','Crédito 6x',100,6),rec('c','Débito'),rec('d','Crédito 12x',100,12),rec('e','Pix')],2));
assert(out.summary.created===0&&d.transacoes.length===5&&d.reservas.moves.length===1,'segunda sincronização não pode duplicar receita nem reserva');

// Parser aceita os nomes antigos e novos de crédito à vista.
assert(api.mitMethodKey(rec('v1','Crédito (À Vista)',100,1))==='credit1','Crédito (À Vista) deve ser credit1');
assert(api.mitMethodKey(rec('v2','Crédito à vista',100,1))==='credit1','Crédito à vista deve ser credit1');
assert(api.mitMethodKey(rec('v3','Credito 1x',100,1))==='credit1','Credito 1x legado deve ser credit1');
let failed=false;try{api.mitMethodKey(rec('bad','Crédito 13x',100,13))}catch(err){failed=/entre 1 e 12/.test(err.message)}assert(failed,'parcelamento acima de 12x deve ser rejeitado');

// Reversão da reserva.
api.reverseImportedTransaction(d,c);assert(d.reservas.moves.length===0&&d.reservas.boxes[0].valorAtual===0,'exclusão deve reverter movimento e saldo da reserva');

// Referências inválidas bloqueiam antes de aplicar qualquer saldo.
let bad=config();bad.mitRevenueRules.pix={category:'Inexistente',destinationKind:'account',accountId:'mp'};failed=false;try{api.validateMitRevenueRules(data(),bad,bad.mitRevenueRules)}catch(err){failed=/categoria válida/.test(err.message)}assert(failed,'categoria inexistente deve bloquear');
bad=config();bad.mitRevenueRules.pix={category:'Serviços',destinationKind:'account',accountId:'old'};failed=false;try{api.validateMitRevenueRules(data(),bad,bad.mitRevenueRules)}catch(err){failed=/Escolha a conta/.test(err.message)}assert(failed,'conta arquivada deve bloquear');
bad=config();bad.mitRevenueRules.pix={category:'Serviços',destinationKind:'reserve',reserveId:'gone'};failed=false;try{api.validateMitRevenueRules(data(),bad,bad.mitRevenueRules)}catch(err){failed=/Escolha a reserva/.test(err.message)}assert(failed,'reserva arquivada deve bloquear');
const noRes=data();noRes.modules.reserves=false;bad=config();bad.mitRevenueRules.pix={category:'Serviços',destinationKind:'reserve',reserveId:'house'};failed=false;try{api.validateMitRevenueRules(noRes,bad,bad.mitRevenueRules)}catch(err){failed=/Ative o módulo/.test(err.message)}assert(failed,'módulo de reservas desativado deve bloquear');

// Interface: tabela oficial, três colunas, sem conversão personalizada e sem Dividir.
const uiData=data(),uiCfg=config();uiData.interconnections.sources['marco-iris']=uiCfg;context.S.profiles=[{id:'p',name:'Perfil'}];context.S.currentProfile={id:'p',name:'Perfil'};context.S.data=uiData;context.getProfileData=()=>uiData;context.BorionInterop.setSettingsSource('marco-iris');context.BorionInterop.setSettingsTab('links');const html=context.BorionInterop.renderSettings();
assert(html.includes('<table class="mit-rules-table">')&&html.includes('Forma recebida do Marco Iris Tec')&&html.includes('Categoria de receita no Borion')&&html.includes('Destino do valor'),'interface deve usar tabela semântica com três colunas');
assert(!html.includes('Como o valor entra no Borion')&&!html.includes('Manter forma original')&&!html.includes('Transferência'),'interface não pode oferecer conversão personalizada');
assert(html.includes('Crédito (À Vista)')&&!html.includes('Crédito 1x'),'label principal deve usar Crédito (À Vista)');
assert(html.includes('Carteira')&&html.includes('Conta')&&html.includes('Reserva')&&!html.includes('Dividir entre Conta e Reserva'),'destinos devem ser somente Carteira/Conta/Reserva');
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);assert(new Set(ids).size===ids.length,'interface MIT não pode gerar IDs HTML duplicados');
assert((html.match(/class="mit-rule-table-row"/g)||[]).length===15,'tabela deve ter exatamente 15 linhas');
uiData.categorias.receita.push('Nova categoria instantânea');const htmlUpdated=context.BorionInterop.renderSettings();assert(htmlUpdated.includes('Nova categoria instantânea'),'categoria adicionada deve aparecer imediatamente');

// Alternância de destino preserva seletores em memória e só muda o destino ativo.
function cls(){const set=new Set();return {toggle(n,on){on?set.add(n):set.delete(n)},contains(n){return set.has(n)}}}
const hidden={value:'account'},panels=['wallet','account','reserve'].map(kind=>({dataset:{mitDestinationPanel:kind},classList:cls()}));
const row={dataset:{mitRule:'credit3'},querySelector(sel){if(sel==='[data-mit-destination-kind]')return hidden;return null},querySelectorAll(sel){if(sel==='[data-mit-destination-button]')return buttons;if(sel==='[data-mit-destination-panel]')return panels;return[]}};
const buttons=['wallet','account','reserve'].map(kind=>({dataset:{value:kind},disabled:false,classList:cls(),attrs:{},setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this.attrs[k]||null},closest(){return row}}));
assert(context.BorionInterop.setMitDestination(buttons[0],'credit3')&&hidden.value==='wallet','selecionar Carteira deve mudar apenas o destino ativo');
assert(context.BorionInterop.setMitDestination(buttons[1],'credit3')&&hidden.value==='account','voltar para Conta deve funcionar sem apagar seletores ocultos');

// Regressão Amanda.
context.BorionInterop.setSettingsSource('amanda-estetica');const amanda=context.BorionInterop.renderSettings();assert(amanda.includes('Amanda Estética')&&context.BorionInterop.sources['amanda-estetica'],'Amanda Estética deve continuar disponível');
console.log('OK: MIT usa forma automática, migra regras antigas, valida destinos, mantém 15 linhas e preserva Amanda.');
