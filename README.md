## v1.6.6 — Login Google obrigatório

- O botão principal de entrada exige a conta Google autorizada.
- Marco e Pedro (administrador técnico) estão autorizados.
- Conta diferente é recusada pelo aplicativo.
- “Entrar sem login” fica discreto no canto e exige PIN local previamente configurado.
- A interconexão com o Borion e as travas do Google Drive foram preservadas.

# Marco Iris Soluções em Tecnologia — v1.1.0

Sistema web/PWA para a operação técnica da Marco Iris, preparado para GitHub Pages, uso no computador e no celular, armazenamento local e sincronização com Google Drive.

## Módulos integrados

- **Visão geral:** ordens abertas, agenda, receitas, pendências e alertas de estoque.
- **Ordens de serviço:** cliente, equipamento, defeito, laudo, itens, desconto, pagamentos, fotos, PDFs, anexos, termos e WhatsApp.
- **Clientes:** cadastro, contato, endereço, histórico de OS, valores, termos e abertura de nova OS.
- **Agenda:** visitas e atendimentos com conversão em OS e vínculo de retorno entre os dois registros.
- **Financeiro:** receitas e despesas isoladas ou vinculadas à OS, edição, exclusão, situação e CSV.
- **Estoque:** produtos e insumos, entradas, saídas, edição de movimentos manuais, baixa automática e reversão pela OS.
- **Catálogos:** produtos, serviços e insumos com arquivamento, restauração e exclusão protegida por vínculos.
- **Documentos:** termos de autorização/ciência e central de PDFs e anexos das OS.
- **Configurações:** diagnóstico de integridade, backups, Google Drive, pasta local, PIN e preferências.

## Regras de segurança dos vínculos

- Um cliente com OS, agenda ou termo não pode ser apagado; primeiro é necessário tratar os vínculos ou apenas arquivá-lo.
- Produto, serviço ou insumo usado em OS/estoque não pode ser apagado; pode ser arquivado sem quebrar o histórico.
- Movimentação automática de estoque só é alterada pela OS de origem.
- A exclusão definitiva de uma OS cria backup, remove itens, pagamentos, termos e arquivos vinculados, desfaz as baixas automáticas e solta o agendamento relacionado.
- Saídas manuais e baixas feitas por OS são bloqueadas quando deixariam o estoque negativo, se a proteção estiver ligada.
- Ações destrutivas importantes criam backup local antes da alteração.

## Documentos e WhatsApp

Dentro da OS, o Marco pode:

1. Gerar o PDF atualizado em A4.
2. Baixar o documento.
3. Abrir diretamente o WhatsApp do cliente cadastrado.
4. Enviar a mensagem automática:

> Segue o pedido do serviço realizado OSV-000000

O navegador não pode anexar sozinho um arquivo local a uma conversa específica. O PDF é baixado e a conversa correta é aberta para o Marco selecionar o arquivo e enviar.

## Estrutura no Google Drive

Ao escolher a pasta principal, o sistema prepara:

- `Dados`
- `Backups`
- `Fotos_OS`
- `Ordens_de_Servico`
- `Anexos`

O arquivo principal é `Dados/Marco_Iris_Dados.json`. Fotos, PDFs e anexos permanecem separados; o JSON guarda os vínculos.

## Publicação no GitHub Pages

1. Crie o repositório.
2. Envie **o conteúdo desta pasta pública** para a raiz.
3. Ative o GitHub Pages na branch principal e na pasta raiz.
4. Abra o endereço publicado.
5. Em `Configurações → Google Drive`, clique em `Conectar com Google`.
6. Escolha a conta Google do Marco e selecione a pasta principal da Marco Iris.

**Não publique o pacote de migração privada.** Ele contém clientes, valores, diagnósticos, fotos, PDFs e senhas históricas de equipamentos.

## Google Cloud

Configure:

- Google Drive API.
- Google Picker API.
- Tela de consentimento OAuth.
- Credencial OAuth do tipo aplicativo web.
- Origem JavaScript autorizada do GitHub Pages.
- API Key pública incorporada ao aplicativo e restrita ao domínio publicado.

O sistema usa o escopo `drive.file`, voltado aos arquivos criados ou escolhidos pelo usuário. Não coloque Client Secret no código.

## Importação corrigida

O pacote privado v1.1.0 contém:

- 139 clientes.
- 286 ordens de serviço.
- 111 itens válidos de OS.
- 292 lançamentos financeiros.
- 33 produtos.
- 43 serviços.
- 9 insumos.
- 13 movimentações válidas de estoque.
- 17 fotos.
- 56 PDFs históricos.

Consulte `MIGRACAO_APPSHEET.md` e `RELATORIO_AUDITORIA_SUPERVISOR_v1.1.0.md`.

## Compatibilidade

Chrome ou Edge atualizados são recomendados para todos os recursos. A conexão direta com pasta local depende da File System Access API. O restante funciona como site/PWA moderno e responsivo.


## Atualização visual v1.2.0
- Tela de bloqueio/login redesenhada no estilo do projeto da Amanda, respeitando a paleta azul-marinho e laranja da Marco Iris.
- Fundo animado com pontos e conexões na tela de bloqueio.
- Cards, campos e caixas internas ajustados para acabamento mais fosco/leitoso, com menos transparência.


## Correção funcional e visual v1.3.1
- O sistema agora sempre abre na tela de bloqueio/login.
- O botão de cadeado no topo e o botão “Bloquear tela” no menu escondem completamente o painel.
- O PIN, quando configurado, é validado antes de liberar o sistema.
- O service worker passou a buscar HTML, CSS e JavaScript na rede primeiro, evitando que o GitHub Pages mantenha a versão antiga em cache.
- Toda a interface interna recebeu o acabamento futurista azul-marinho e laranja, com caixas foscas e translúcidas de alta legibilidade.
- A tela de bloqueio possui pontos, linhas e onda luminosa animados por canvas.

### Atualização de instalações anteriores
Depois de substituir os arquivos no GitHub, abra uma vez `atualizar.html`. Essa página remove o service worker e os caches antigos e redireciona para a versão 1.3.1.


## Interface, movimento e calendário v1.4.0
- Navegação entre módulos com saída e entrada lateral, seguindo o comportamento visual do projeto da Amanda.
- Bloqueio e desbloqueio em direções opostas, sem expor o conteúdo durante a transição.
- Seletor de visualização expansível no hover/toque com Linha, Colunas e Quadrados.
- Preferência de visualização salva separadamente em Ordens, Agenda, Clientes, Financeiro, Estoque, Catálogos e Documentos.
- Agenda mensal completa no estilo Google Calendar/AppSheet, com 42 células, seleção de dia, navegação entre meses e criação de agendamento na data escolhida.
- Modais revisados com cabeçalho, corpo e rodapé na mesma superfície, corrigindo a faixa de cor divergente da Nova OS.
- Cache e service worker atualizados para a versão 1.4.0.

### Atualização de instalações anteriores
Depois de publicar os arquivos no GitHub Pages, abra uma vez `atualizar.html` para remover os caches antigos e carregar a v1.4.0.


## Atualização visual v1.4.1
- Correção de cor na janela flutuante de Nova ordem de serviço, especialmente da seção de itens e serviços até o rodapé.
- Fundo da tela de bloqueio mais tecnológico, com grade, scanline, HUD e conexões dinâmicas entre pontos de luz.
