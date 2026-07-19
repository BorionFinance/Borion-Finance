# Borion Finance v6.36.0 — Central do Borion

## Objetivo

Adicionar uma área interna de documentação completa, acessível por um botão `?` dentro de **Configurações**, sem criar um novo item no menu principal e sem aumentar o caminho crítico de carregamento do aplicativo.

## Onde acessar

1. Abrir o Borion.
2. Entrar em um perfil.
3. Abrir **Configurações**.
4. Clicar em **? Central do Borion**.

## Entregas

### 1. Guias passo a passo

- 49 guias operacionais.
- 12 áreas temáticas.
- Instruções sobre primeiro acesso, navegação, receitas, despesas, cartões, faturas, reservas, transferências, investimentos, patrimônio, metas, agenda, notificações, cheques, importação, OCR, integrações, personalização, ordem, backups, segurança, Smartphone Mode, PWA e diagnóstico.
- Alertas para erros comuns, como duplicar o pagamento de fatura, confundir transferência com receita/despesa ou sobrescrever uma versão correta do Drive.

### 2. Pesquisa de dúvidas

- Busca por palavras completas ou parciais.
- Normalização de acentos e caixa.
- Pesquisa por título, explicação, passos, alertas, sinônimos e palavras relacionadas.
- Filtros por área.
- Contador de resultados.
- Estado da pesquisa preservado ao alternar entre Guias e Checklist durante a sessão.

### 3. Checklist funcional completo

- 671 verificações organizadas por módulo.
- Checkboxes interativos.
- Progresso percentual.
- Contagem por grupo.
- Botões **Marcar tudo**, **Limpar** e **Copiar pendências**.
- Estado separado por perfil neste dispositivo.
- Cobertura de funções visíveis e regras operacionais, incluindo ordenação, redimensionamento, vínculos, status, backup, sincronização, prevenção de duplicidade e comportamento mobile.

### 4. História do Borion

- Origem do nome: `B`, de Bardella, + `Órion`, a constelação.
- Motivo inicial do projeto.
- Lançamento oficial em 07/07/2026.
- Evolução de programa financeiro para ecossistema.
- Borion System / Constelação.
- Integração com Amanda Estética, Marco Iris Tecnologia e Hub.
- Registro do marco v6.36.0, quando o sistema passou a documentar a si próprio.

### 5. Desempenho

- `js/26-help-center.js` não é carregado na inicialização normal.
- `css/help-center.css` também é carregado somente ao abrir a Central.
- O service worker mantém os dois arquivos disponíveis offline.
- Nenhuma das 671 linhas do checklist é renderizada fora da aba Checklist.
- A Central não foi adicionada ao menu lateral, evitando poluição visual.

## Arquivos adicionados

- `js/26-help-center.js`
- `css/help-center.css`
- `tests/test_help_center.js`
- `RELATORIO_CENTRAL_DO_BORION_v6.36.0.md`

## Arquivos atualizados

- `js/13-settings.js`
  - botão `?`;
  - carregador sob demanda;
  - integração da aba;
  - versão e data;
  - correção na segunda renderização interna de Configurações.
- `css/styles.css`
  - estilo mínimo do botão `?` antes do carregamento do módulo.
- `index.html`
  - cache busting v6.36.0.
- `sw.js`
  - novo cache v6.36.0;
  - inclusão do módulo e do CSS da Central.
- `manifest.json`
  - versão v6.36.0.
- `js/14-events-boot-pwa.js`
  - registro do service worker v6.36.0.
- `js/02-backup-local.js`
  - versão gravada nos backups atualizada para v6.36.0.
- `tests/README.md`
  - instrução do novo teste.

## Validações executadas

- Sintaxe de todos os arquivos JavaScript com `node --check`.
- Validação do `manifest.json`.
- Testes existentes de CSV, OFX, TXT e OCR por prints.
- Teste novo da Central do Borion.
- Verificação dos arquivos declarados no service worker.
- Verificação de versão no HTML, service worker, manifest, backups e rodapé.

## Resultado

A Central do Borion fica escondida dentro de Configurações, acessível pelo ícone `?`, com documentação pesquisável, checklist funcional e história do sistema, sem interferir no funcionamento financeiro nem no carregamento inicial.
