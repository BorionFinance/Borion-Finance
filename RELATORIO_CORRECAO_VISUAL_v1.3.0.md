# Marco Iris Tecnologia — correção funcional e visual v1.3.0

## Falhas corrigidas
- A tela de login agora aparece em toda abertura, mesmo quando o perfil ainda não possui PIN.
- O cadeado do topo agora bloqueia realmente o sistema e remove o painel da tela.
- Foi adicionado um segundo botão “Bloquear tela” no menu lateral.
- Com PIN configurado, a tela só libera o painel após validar o código correto.
- O botão de privacidade ficou separado do cadeado e usa o ícone de olho.
- O service worker foi alterado para buscar HTML, CSS e JavaScript na rede primeiro.
- Foi criada a página `atualizar.html` para limpar caches e service workers antigos após publicar no GitHub.

## Interface
- Tema futurista azul-marinho e laranja aplicado ao sistema inteiro.
- Tela de bloqueio com canvas animado de pontos, linhas e onda luminosa.
- Cards internos foscos e translúcidos com alta legibilidade.
- Barra superior, menu, tabelas, formulários, modais, botões e alertas adaptados ao mesmo padrão.
- Responsividade preservada para computador e celular.

## Validações executadas
- Sintaxe do JavaScript validada com `node --check`.
- Tela de login renderizada em ambiente de teste.
- Entrada sem PIN validada.
- Dashboard renderizado após autenticação.
- Dois botões de bloqueio encontrados no painel.
- Bloqueio pelo cadeado do topo validado: o painel desaparece e a tela de login volta.
- Estilos computados confirmaram gradientes e superfícies foscas no login e nos cards internos.
