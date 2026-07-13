# Borion V6.23.6 — Refinos do Smartphone Mode

## Ajustes implementados

### 1) Central de lançamentos no celular
- A tabela da aba **Central** agora vira uma lista de cards no **Smartphone Mode**.
- Cada movimentação mostra de forma legível:
  - tipo;
  - nome;
  - categoria;
  - origem;
  - data;
  - valor;
  - conta/banco;
  - status;
  - botão de ação/edição.
- O campo **Conta/Banco** também passou a exibir o nome da conta sempre que antes aparecia um `accountId` cru.

### 2) Barra inferior com ícones no estilo do desktop
- Os ícones da navegação inferior foram refeitos com SVG no mesmo estilo visual do menu do computador.
- Itens atualizados:
  - Início;
  - Lançamentos;
  - Lançar;
  - Reservas/Metas;
  - Mais.

### 3) Menu lateral no celular até o final da tela
- A gaveta lateral passou a usar estrutura flex vertical completa.
- A navegação ocupa a altura disponível.
- O rodapé do perfil fica ancorado ao final do menu.
- O menu agora alcança corretamente a parte inferior da tela em celulares.

### 4) Responsividade refinada
- A barra de ações da Central ganhou layout responsivo próprio no Smartphone Mode.
- Em telas menores, os controles passam a se reorganizar em uma coluna.
- As tabs horizontais do orçamento continuam compactas, mas com melhor preenchimento e sem scroll visível.
- Os cards da Central se adaptam melhor a diferentes larguras de celular.

## Escopo preservado
- Nenhum cálculo financeiro foi alterado.
- Nenhum dado de contas, reservas, metas ou lançamentos foi modificado.
- O ajuste foi feito somente na camada de interface e exibição.
