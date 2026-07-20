'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const assert=(c,m)=>{if(!c)throw new Error('FALHOU: '+m)};
const provider=read('js/01c-google-drive-provider.js');
const cloud=read('js/17-borion-cloud.js');
const progress=read('js/01i-boot-progress-v642.js');
const boot=read('js/14-events-boot-pwa.js');

const loginBlock=provider.slice(provider.indexOf('async login(interactive)'),provider.indexOf('async ensureFreshToken'));
assert(loginBlock.indexOf('tokenPromise=this.requestToken(true)')<loginBlock.indexOf('await this.ensureIdentityLoaded()'),'login interativo preparado deve abrir o popup antes do primeiro await');
assert(provider.includes('prepareInteractiveLogin(){')&&provider.includes('AUTH_POPUP_BLOCKED'),'provider deve pré-carregar o Google e traduzir popup bloqueado');
assert(provider.includes('resetLoginAttempt(){')&&provider.includes('IDs de pasta, dados locais e alterações pendentes persistidas são mantidos'),'voltar ao login deve limpar só estado transitório, preservando dados e pasta');

const cleanLogin=cloud.slice(cloud.indexOf('renderCleanLogin(root){'),cloud.indexOf('showMoreInfoModal(){'));
assert(cleanLogin.includes('disabled>Preparando Google...')&&cleanLogin.includes('prepareInteractiveLogin()'),'tela simples deve preparar o Google antes de liberar o clique');
assert(cleanLogin.includes('returnToSimpleLogin(this.googleLoginError(error))'),'qualquer falha deve retornar à própria tela simples');
assert(!cleanLogin.includes('alert('),'falha de login não pode abrir modal de aviso que exige recarregar a página');
assert(cloud.includes('window.returnToSimpleGoogleLogin'),'deve existir um retorno único e reutilizável para a tela de login');

const failBlock=progress.slice(progress.indexOf('fail(error,options={})'),progress.indexOf('_friendlyError(error)'));
assert(failBlock.includes('Voltar ao login'),'tela de falha deve oferecer voltar ao login');
assert(!failBlock.includes('borion-boot-retry')&&!failBlock.includes('borion-boot-reconnect')&&!failBlock.includes('borion-boot-details'),'tela de falha não pode exibir vários botões técnicos');
assert(boot.includes('returnToSimpleGoogleLogin'),'boot deve usar o retorno limpo sem recarregar a página');
console.log('OK: login Google é pré-carregado, popup abre no clique, erros voltam à tela simples e a falha do boot mostra um único botão.');
