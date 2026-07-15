# Borion Finance v6.31.0 — Revisão Geral

## Implementações

### Ordenação de lançamentos
O mesmo componente de seta foi aplicado em Receita, Despesa fixa, Despesa variável e Transferências. Cada clique alterna entre mais antigo → mais recente e mais recente → mais antigo. Assinaturas continua sem ordenação, conforme especificado.

### Saúde Financeira
A análise anterior foi substituída por duas leituras independentes:
- Mensal: considera exclusivamente a competência selecionada.
- Anual: considera o ano selecionado; no ano corrente, usa os meses já transcorridos.

As leituras usam receita, despesa, resultado, patrimônio, saldo disponível, reservas, rendimentos, dívida total, parcelas/boletos do período, comprometimento da renda, percentual economizado, cobertura financeira e evolução patrimonial.

### Grade dinâmica de módulos
Foi criado um componente reutilizável em `js/25-module-layout.js`, aplicado na Visão Geral e no Patrimônio. Ele permite:
- arrastar e reordenar módulos;
- alterar largura e altura;
- usar de 2 a 6 colunas;
- voltar à altura automática;
- preencher espaços livres com grade densa;
- salvar a preferência dentro do perfil.

### Integrações e Vínculos
A configuração de Amanda Estética e Marco Iris Tecnologia agora:
- separa visualmente Origem e Destino;
- mostra nomes, rótulos e exemplos recebidos do aplicativo externo;
- mantém o valor técnico recebido visível quando a origem fornece um rótulo amigável;
- permite regras independentes para entrada e saída;
- converte tipo, categoria, origem da receita, forma de pagamento, status e destino financeiro;
- aceita Conta, Carteira ou Reserva como destino/origem financeira;
- cria rendimentos e pagamentos vinculados às reservas.

## Regras de consistência verificadas
- Lançamentos importados continuam nativos e editáveis.
- O identificador externo impede duplicidade sem sobrescrever edições locais.
- Rendimento direto em reserva não aumenta a conta livre e a reserva ao mesmo tempo.
- Despesa paga por reserva baixa somente a reserva e cria movimento rastreável.
- Filtros não apagam a preferência de ordenação da aba.
- Ordem e dimensões dos módulos permanecem no perfil.
