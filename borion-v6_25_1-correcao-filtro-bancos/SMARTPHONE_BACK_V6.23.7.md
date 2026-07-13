# Borion V6.23.7 — Botão Voltar inteligente

## Comportamento no Smartphone Mode

### Quando existe uma tela flutuante aberta
Ao pressionar **Voltar**:
- fecha a tela de adicionar/editar lançamento;
- mantém o usuário exatamente no módulo em que estava;
- não sai do Borion.

### Quando não existe tela flutuante aberta
Ao pressionar **Voltar** em qualquer módulo:
- retorna para **Visão geral / Início**.

### Quando já está no Início
Ao pressionar **Voltar**:
- mostra o aviso **“Deseja sair da página?”**;
- **Continuar no Borion** mantém o aplicativo aberto;
- **Sim, sair** volta para a página anterior do navegador, como a busca do Google.

## Outras camadas cobertas
O botão Voltar também fecha antes de navegar:
- menu lateral;
- notificações;
- filtro de bancos;
- resultados da busca global.

## Implementação
- Foi usada uma entrada sentinela única no `History API`.
- Não são criadas dezenas de entradas no histórico a cada renderização.
- A lógica atua somente no Smartphone Mode.
- Após a confirmação explícita de saída, o Borion evita mostrar um segundo aviso nativo de sincronização.
- O salvamento final silencioso continua sendo solicitado antes de abandonar a página.
