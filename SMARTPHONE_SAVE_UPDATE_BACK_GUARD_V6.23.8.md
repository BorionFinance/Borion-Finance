# Borion V6.23.8 — Salvar e atualizar + proteção insistente de saída

## Salvar e atualizar

O menu **Mais** do Smartphone Mode agora possui o comando **Salvar e atualizar**.

Fluxo:

1. grava o estado atual no armazenamento do perfil;
2. cria um backup manual protegido no IndexedDB;
3. se o Google Drive estiver conectado, atualiza o `current.json` e cria um novo `forcesave-N.json`;
4. se a conta estiver no Supabase, aguarda a confirmação da sincronização;
5. consulta o Service Worker por uma versão mais recente;
6. somente depois recarrega o app.

Se a nuvem não confirmar o salvamento, a página não é recarregada e o erro aparece na própria janela.

## Botão Voltar insistente

O Smartphone Mode mantém oito entradas sentinela internas no histórico do navegador. Elas absorvem múltiplos gestos rápidos de Voltar e tratam o burst como uma única ação lógica.

Ordem:

1. fecha modal, painel, pesquisa ou menu;
2. volta ao Início;
3. mostra “Deseja sair da página?”;
4. sai somente após “Sim, sair”.

Como última proteção, `beforeunload` solicita a confirmação nativa do navegador caso o Android tente atravessar toda a reserva de histórico de uma vez.

## Atualização do app instalado

O PWA instalado não precisa ser excluído e instalado novamente. Ao abrir, o Borion registra/verifica o Service Worker e busca uma nova versão. O comando **Salvar e atualizar** força uma nova verificação antes de recarregar.

A atualização efetiva depende de os arquivos novos terem sido publicados no GitHub Pages e do aparelho estar conectado à internet.
