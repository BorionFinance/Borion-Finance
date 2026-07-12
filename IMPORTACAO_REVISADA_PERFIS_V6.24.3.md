# Borion V6.24.3 — Importação revisada de perfis

## Causa do aviso anterior
O backup tinha um perfil com o mesmo `id` do perfil já existente. O fluxo antigo de mesclagem interpretava esse ID como duplicado, ignorava o perfil e mostrava “1 ignorado”, mesmo havendo apenas um perfil visível.

## Novo fluxo
Todo backup completo abre uma tela de revisão. Para cada perfil do arquivo é possível:
- criar como novo;
- substituir um perfil atual específico;
- não importar.

Também é possível marcar perfis atuais para exclusão. A tela impede dois perfis de substituírem o mesmo destino, impede excluir um destino usado e respeita o limite de 5 perfis.

## Segurança
Antes de aplicar, o Borion cria um backup `before_import`. Em modo local, uma falha restaura o estado anterior.

## Informações fixas
- Versão: 6.24.3
- Lançamento: 07/07/2026
- Desenvolvido por Pedro Bardella
- © 2026 Pedro Bardella. Todos os direitos reservados.
