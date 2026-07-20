'use strict';
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');const provider=fs.readFileSync(path.join(root,'js/01c-google-drive-provider.js'),'utf8'),cloud=fs.readFileSync(path.join(root,'js/17-borion-cloud.js'),'utf8');const assert=(c,m)=>{if(!c)throw new Error('FALHOU: '+m)};
assert(provider.includes('ensureIdentityLoaded()')&&provider.includes('ensurePickerLoaded()'),'Identity e Picker devem ter loaders separados');
assert(/async function openDriveFolderPicker\(\)[\s\S]*ensurePickerLoaded/.test(provider),'Picker só deve ser carregado ao abrir o seletor');
const loginBlock=provider.slice(provider.indexOf('async login(interactive)'),provider.indexOf('async ensureFreshToken'));
assert(loginBlock.includes('ensureIdentityLoaded')&&!loginBlock.includes('ensurePickerLoaded'),'login recorrente não pode carregar Picker');
assert(provider.includes('_identityPromise')&&provider.includes('_pickerPromise'),'promises reutilizáveis devem impedir scripts duplicados');
assert(cloud.includes('async function ensureSupabaseLoaded()')&&cloud.includes('_borionSupabaseLoadPromise'),'Supabase deve ter loader único sob demanda');
console.log('OK: Google Identity, Picker e Supabase são carregados separadamente e somente quando necessários.');
