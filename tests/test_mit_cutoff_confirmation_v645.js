'use strict';
const fs=require('fs'),path=require('path');
const source=fs.readFileSync(path.resolve(__dirname,'../js/24-interconnections.js'),'utf8');
const assert=(c,m)=>{if(!c)throw new Error('FALHOU: '+m)};
assert(source.includes('function confirmCutoffChange'),'alteração do corte deve possuir confirmação centralizada');
assert((source.match(/confirmCutoffChange\(/g)||[]).length>=4,'definir data, definir agora e remover corte devem pedir confirmação');
assert(source.includes('Somente registros a partir de'),'tela deve informar claramente a data considerada');
assert(source.includes("config.importCutoffAt = config.importCutoffAt || ''"),'corte deve permanecer persistido na configuração da integração');
console.log('OK: data de corte é persistida, exibida com clareza e alterações exigem confirmação explícita.');
