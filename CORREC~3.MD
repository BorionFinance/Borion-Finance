# Marco Íris Tecnologia v1.6.5 — conexão Google simplificada

## Alteração

- As credenciais públicas do projeto Google Cloud foram incorporadas ao aplicativo.
- A tela e os botões de configuração de OAuth Client ID, API Key e número do projeto foram removidos.
- O fluxo agora é direto: **Conectar com Google → escolher a conta → escolher a pasta principal**.
- Cliques repetidos durante a conexão reutilizam a mesma operação; o botão fica temporariamente desativado.
- A trava do JSON principal, as pastas persistentes e a interconexão protegida com o Borion foram preservadas.

## Segurança

Nenhum Client Secret foi incluído. OAuth Client ID e API Key de aplicativo web são identificadores públicos e permanecem protegidos pelas restrições de origem e de API configuradas no Google Cloud.
