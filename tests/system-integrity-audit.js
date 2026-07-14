#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const index=read('index.html'); const sw=read('sw.js');
const jsFiles=[...index.matchAll(/<script\s+src="(js\/[^"?]+\.js)(?:\?[^\"]*)?"/g)].map(m=>m[1]);
let source=index+'\n'+jsFiles.map(read).join('\n');
const failures=[]; const checks=[];
function check(name,ok,detail=''){ checks.push({name,ok,detail}); if(!ok) failures.push(name+(detail?': '+detail:'')); }
for(const f of jsFiles) check('Arquivo carregado existe: '+f,fs.existsSync(path.join(root,f)));
for(const f of jsFiles) check('Service worker inclui: '+f,sw.includes('./'+f));
const onclick=[...source.matchAll(/onclick=["']([^"']+)["']/g)].map(m=>m[1]);
const refs=[...new Set(onclick.map(h=>(h.match(/^\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)\s*\(/)||[])[1]).filter(Boolean))];
for(const ref of refs){
 const [obj,method]=ref.split('.');
 let ok;
 if(method) ok=['document','event'].includes(obj) || (new RegExp('(?:const|let|var|window\\.)\\s*'+obj+'\\b|\\b'+obj+'\\s*=\\s*\\{').test(source) && new RegExp('\\b'+method+'\\s*[:=(]').test(source));
 else ok=new RegExp('function\\s+'+ref+'\\s*\\(|window\\.'+ref+'\\s*=|(?:const|let|var)\\s+'+ref+'\\s*=').test(source) || ['document','event'].includes(obj);
 check('Handler resolvido: '+ref,ok);
}
const requiredModules=['Budget','Cards','Patr','Reservas','Assinaturas','Cheques','Agenda','Settings','BackupFS','GoogleDriveProvider','ImportStatement'];
for(const m of requiredModules) check('Módulo principal presente: '+m,new RegExp('(?:const|let|var|window\\.)\\s*'+m+'\\b|\\b'+m+'\\s*=\\s*\\{').test(source));
check('Versões do HTML consistentes',new Set([...index.matchAll(/\?v=([0-9.]+)/g)].map(m=>m[1])).size===1);
console.log(checks.filter(x=>!x.ok).map(x=>'✗ '+x.name+(x.detail?' — '+x.detail:'')).join('\n'));
console.log(`Auditoria de integridade: ${checks.length-failures.length}/${checks.length} verificações aprovadas.`);
if(failures.length) process.exit(1);
