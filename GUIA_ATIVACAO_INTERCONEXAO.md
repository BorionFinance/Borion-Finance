# Guia de ativação — Borion Interop v1.0.0

## Regra principal
A integração já está programada. Não altere os arquivos `borion-interop-source.js`, `24-interconnections.js` nem os trechos marcados como `protected interop seam`, salvo quando Pedro pedir explicitamente uma mudança na comunicação entre os sistemas.

## Antes de conectar ao Google Drive
1. Publique cada aplicativo no GitHub Pages.
2. No Google Cloud, use o mesmo projeto, OAuth Client ID, API Key e número do projeto nos três front-ends.
3. Cadastre os três endereços do GitHub Pages em **Origens JavaScript autorizadas**.
4. Mantenha o escopo seguro `drive.file`; não é necessário conceder acesso ao Drive inteiro.
5. Ative Google Drive API e Google Picker API.

O uso do mesmo cliente OAuth é importante porque, com `drive.file`, os aplicativos compartilham com segurança os arquivos que o mesmo cliente criou ou abriu pelo Picker.

## Amanda Estética → perfil Estética do Borion
1. Abra o aplicativo da Amanda, conecte a conta Google dela e escolha a pasta principal da clínica.
2. Faça um salvamento. O aplicativo cria automaticamente `Borion_Integracoes/amanda-estetica.bridge.json`.
3. Abra o Borion logado na conta Google da Amanda.
4. Vá em **Configurações → Integrações → Amanda Estética → Conectar Google Drive**.
5. Selecione a pasta `Borion_Integracoes` criada pelo aplicativo da Amanda.
6. Escolha explicitamente o perfil **Estética** e a conta padrão que receberá Pix, débito, boleto, transferência e receitas em cartão.
7. Clique em sincronizar. O Borion cria `amanda-estetica.ack.json`, fechando o retorno Borion → Amanda.

O perfil pessoal da Amanda permanece separado. O vínculo usa o ID permanente do perfil Estética, não apenas o nome exibido.

## Marco Iris → perfil do Marco no Borion
1. Abra o aplicativo do Marco, conecte a conta Google dele e escolha a pasta principal.
2. Faça um salvamento. O aplicativo cria `Borion_Integracoes/marco-iris.bridge.json`.
3. Abra o Borion do Marco.
4. Vá em **Configurações → Integrações → Marco Iris Tecnologia → Conectar Google Drive**.
5. Selecione `Borion_Integracoes`, escolha o único perfil do Marco e a conta padrão.
6. Sincronize. O Borion cria `marco-iris.ack.json`.

## Teste local antes do GitHub
O mesmo protocolo funciona com pasta local. No aplicativo de origem, conecte a pasta local normal e salve. Depois, no Borion, escolha **Conectar pasta local** e selecione exatamente a subpasta `Borion_Integracoes`.

## Regras financeiras
- Receita paga/recebida: cria ou atualiza uma receita no Borion.
- Receita pendente: fica aguardando e não altera o saldo.
- Despesa pendente/atrasada: aparece como **Em aberto** e não altera o saldo.
- Despesa paga: aplica a saída uma única vez.
- Dinheiro: usa a Carteira.
- Crédito: receita entra na conta padrão; despesa fica registrada como Crédito sem retirar saldo bancário imediatamente. Não é ligada automaticamente a uma fatura específica sem um identificador seguro de cartão.
- Parcial do Marco: o valor informado como parcial é tratado como valor efetivamente realizado.
- Editar, pagar, cancelar ou excluir na origem atualiza o mesmo lançamento; não cria duplicata.

## Propriedade dos dados
Amanda/Marco continuam donos do registro operacional. O Borion bloqueia a edição direta do lançamento importado e informa que a mudança deve ser feita no aplicativo de origem.
