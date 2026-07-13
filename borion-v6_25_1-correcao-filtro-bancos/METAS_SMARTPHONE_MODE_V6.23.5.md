# Borion V6.23.5 — Metas flexíveis e Smartphone Mode

Data: 12/07/2026

## 1. Metas de Patrimônio com Reserva desligada

Quando o módulo **Reserva** está desativado, o painel **Metas de patrimônio** passa a funcionar de forma independente:

- exibe o botão **+ Adicionar meta**;
- permite editar qualquer meta independente;
- permite excluir metas independentes;
- mantém nome, ícone, valor atual, valor-alvo, prazo e conta vinculada;
- não inclui a meta no saldo real nem no patrimônio enquanto ela continua apenas como meta.

As metas que já pertencem a Cofrinhos ficam ocultas nesse modo. Os Cofrinhos e seus históricos permanecem salvos e não são apagados.

## 2. Reativação do módulo Reserva

Ao ativar Reserva novamente, cada meta independente é convertida em um novo Cofrinho:

- recebe um novo ID de Cofrinho;
- preserva nome, valor atual, valor-alvo, prazo e conta vinculada;
- recebe ligação permanente entre `meta.reservaId` e `reserva.metaId`;
- é marcada internamente por `convertedFromMetaId`;
- entra junto dos Cofrinhos antigos, sem substituir ou apagar nenhum deles;
- não pode ser convertida duas vezes, mesmo após desligar e ligar o módulo novamente.

Metas que já estavam vinculadas a Cofrinhos antigos não são recriadas.

## 3. Smartphone Mode

Foi criada uma interface diária mais simples, usando exatamente a mesma base financeira do Modo Pro.

### Funcionamento automático

A opção padrão é **Automático**:

- telas de até 820 px: Smartphone Mode;
- telas maiores: Modo Pro.

Em **Configurações → Personalização → Modo de interface**, também é possível forçar:

- Smartphone Mode;
- Modo Pro.

### Tela inicial do celular

A tela inicial compacta mostra:

- saldo em contas;
- saldo do mês;
- receitas do mês;
- despesas do mês;
- total reservado;
- últimos lançamentos.

### Lançamento rápido

O botão central **Lançar** abre atalhos para:

- Receita;
- Despesa;
- Despesa fixa;
- Movimentar Reserva;
- Nova Meta, quando Reserva estiver desligada;
- Transferência;
- Contas e cartões.

Os atalhos abrem os formulários já existentes no Borion. Não existe uma segunda lógica financeira paralela.

### Navegação inferior

O celular recebe uma barra fixa com:

- Início;
- Lançamentos;
- Lançar;
- Reservas ou Metas;
- Mais.

O botão **Mais** abre o menu completo, preservando o acesso a todas as funções do Modo Pro.

## 4. Arquivos principais modificados

- `index.html`
- `sw.js`
- `css/styles.css`
- `js/01-storage-data-state.js`
- `js/04-gate-shell.js`
- `js/09-patrimony-goals.js`
- `js/13-settings.js`
- `js/14-events-boot-pwa.js`
- `js/20-smartphone-mode.js` — novo
- `tests/borion-regression-tests.js`
- `tests/README.md`

## 5. Compatibilidade e preservação

Não foram alterados:

- cálculos atuais dos Cofrinhos;
- movimentações de Reservar, Resgatar, Rendimento ou Ajuste;
- relatórios mensais já fechados;
- isolamento entre perfis;
- vínculos financeiros por `accountId`;
- backups locais ou do Google Drive;
- regras das assinaturas;
- histórico financeiro existente.

A preferência de interface é local ao dispositivo e fica em `mc_config`. Assim, o celular pode usar Smartphone Mode enquanto o computador permanece no Modo Pro.

## 6. Testes

Resultado: **38/38 testes aprovados**.

Os novos testes verificam:

1. Cofrinhos existentes ficam ocultos do painel de metas quando Reserva está desligada.
2. Metas independentes continuam visíveis e editáveis.
3. A conversão cria um Cofrinho com os mesmos valores e vínculo de conta.
4. Cofrinhos antigos são preservados.
5. A mesma meta não é convertida duas vezes.
6. Desligar e ligar novamente não duplica Cofrinhos.
7. O modo automático escolhe Smartphone no celular e Pro no computador.
8. As opções forçadas funcionam.
9. A tela inicial móvel possui ações rápidas e últimos lançamentos.
10. O novo arquivo entra no HTML e no cache offline do PWA.
11. Todos os JavaScript passam na validação sintática.
12. Toda a regressão financeira anterior continua aprovada.
