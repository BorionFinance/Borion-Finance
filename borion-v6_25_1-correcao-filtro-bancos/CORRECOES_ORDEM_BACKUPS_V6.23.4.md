# Borion V6.23.4 — Ordem de Cofrinhos e correção dos backups

Data: 12/07/2026

## Escopo

Esta atualização é incremental sobre a V6.23.3. Não altera cálculos financeiros, Reservas, Cofrinhos, snapshots mensais, login, perfis ou o formato dos backups.

## 1. Organização em Personalização

O painel **Organizar módulos e itens** foi retirado de Configurações → Módulos e renderizado em Configurações → Personalização. As chaves e preferências persistidas por perfil foram mantidas, portanto nenhuma ordem existente é perdida.

## 2. Fluxo de ordem dos Cofrinhos

O seletor da aba Reserva agora inicia no estado neutro **ORDEM** e contém, nesta sequência:

1. A a Z
2. Z a A
3. Mais recente primeiro
4. Mais antigo primeiro
5. Ordem personalizada

A seleção de **Ordem personalizada** apenas revela o botão lateral **Organizar ordem**. O modo de arrastar/setas só começa após esse botão ser acionado. Ao concluir em **OK** ou cancelar, o modo é encerrado, o botão desaparece e o seletor retorna para ORDEM. A ordem personalizada salva continua aplicada nos dados do perfil; o retorno a ORDEM é apenas o estado visual neutro do controle.

## 3. Causa exata do autosave do Google Drive

O método `runAutosaveTick()` utilizava as variáveis `options` e `reason`, que não existiam naquele escopo. Isso gerava uma exceção em cada tentativa automática antes de o snapshot ser enviado. Havia ainda dois agravantes:

- o autosave era bloqueado quando a página estava oculta;
- `Ctrl+S` retornava sem fazer nada se outra sincronização estivesse em andamento.

### Correção

- O autosave agora cria diretamente um snapshot com motivo `auto` e grava um arquivo `autosave-N.json`.
- Uma alteração agenda o primeiro envio após aproximadamente três segundos de inatividade.
- O intervalo de segurança permanece em um minuto, evitando escrita excessiva.
- Falhas agendam nova tentativa.
- Uma revisão incremental impede que uma edição ocorrida durante o upload seja marcada como sincronizada por engano.
- `Ctrl+S` aguarda a operação em andamento e cria exatamente um forcesave para a ação do usuário.

## 4. Causa exata do backup na pasta local

O botão **Criar backup agora** chamava apenas `storageProvider.createBackup()`, que grava no armazenamento interno/IndexedDB. Ele não chamava `BackupFS.writeToFolder()`. Por isso a pasta era criada, mas nenhum `.json` era escrito nela. A permissão da pasta também podia estar expirada e só era percebida tarde demais.

### Correção

- O clique prepara e valida o acesso à pasta dentro do gesto do usuário.
- O mesmo snapshot é registrado internamente e escrito fisicamente em `Backups_Borion`.
- O arquivo usa prefixo manual e nome com data, hora, segundos e milissegundos.
- O autosave local também foi ligado ao estado “sujo”, com controle de concorrência e nova tentativa segura.
- Ao perder permissão, o Borion marca a pasta para reconexão e informa o erro em vez de declarar sucesso.

## 5. Drive&Local

O botão amarelo gera um único snapshot e entrega o mesmo objeto aos dois destinos. O `snapshotId`, data-base, versão, conteúdo e checksum continuam idênticos. Os resultados são independentes: erro em um destino não impede a tentativa no outro.

## 6. Arquivos principais alterados

- `index.html`
- `sw.js`
- `js/01c-google-drive-provider.js`
- `js/02-backup-local.js`
- `js/13-settings.js`
- `js/18-order-preferences.js`
- `tests/borion-regression-tests.js`
- `tests/README.md`
- `CHANGELOG.md`

## 7. Validação

Foram executados 32 cenários automatizados. Resultado: **32 aprovados, 0 falhas**. Entre os cenários novos:

- painel somente em Personalização;
- seletor ORDEM e opções solicitadas;
- botão Organizar ordem oculto/revelado corretamente;
- conclusão em OK volta ao estado neutro;
- autosave do Drive cria snapshot válido;
- `Ctrl+S` aguarda sync concorrente e cria um forcesave;
- JSON é realmente escrito em uma pasta local simulada;
- backup local rápido e Drive&Local usam o snapshot esperado.

As chamadas de Google Drive e as permissões reais do navegador dependem da conta, token e ambiente do usuário. Nesta entrega, os fluxos foram testados diretamente com provedores e diretórios simulados, além de validação sintática de todo o JavaScript.
