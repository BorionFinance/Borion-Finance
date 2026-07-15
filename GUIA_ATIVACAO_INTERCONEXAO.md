# Guia de ativação — Borion Smart Import v2.0.0

## Amanda Estética

1. Abra o aplicativo da Amanda e faça um salvamento para gerar `Borion_Integracoes/amanda-estetica.bridge.json`.
2. No Borion, acesse **Configurações → Integrações → Amanda Estética → Conexão**.
3. Conecte a pasta local ou a pasta `Borion_Integracoes` no Google Drive.
4. Escolha o perfil de destino e a conta padrão.
5. Abra a aba **Vínculos**.
6. Confira a conversão de tipos, categorias, origem da receita, formas de pagamento, contas e status.
7. Clique em **Salvar vínculos e sincronizar**.

## Marco Iris Tecnologia

O fluxo é idêntico, usando `marco-iris.bridge.json` e a seção **Configurações → Integrações → Marco Iris Tecnologia**.

## Regra importante

A primeira sincronização só acontece depois que os Vínculos forem salvos. Isso impede que categorias ou contas do aplicativo externo entrem no Borion sem conversão.

## Depois da importação

- O lançamento pode ser editado normalmente no Borion.
- A edição local não volta para o aplicativo de origem.
- Alterações posteriores feitas na origem não sobrescrevem a versão do Borion.
- O identificador externo continua salvo internamente para impedir duplicidade.
- Uma receita pendente aguarda o recebimento antes da primeira importação.
- Uma despesa pendente entra como **Em aberto**.

## Exclusão

Ao excluir um lançamento importado, escolha:

- **Excluir e permitir importar novamente**: libera o identificador para uma nova importação.
- **Excluir e ignorar permanentemente**: mantém o identificador bloqueado para sempre.

## Google Drive

Com `drive.file`, mantenha os aplicativos no mesmo projeto OAuth do Google e cadastre os domínios usados no GitHub Pages em **Origens JavaScript autorizadas**. Ative Google Drive API e Google Picker API.
