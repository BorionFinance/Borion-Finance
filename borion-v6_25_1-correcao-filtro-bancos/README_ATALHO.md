# Atalho de Área de Trabalho — Borion Finance

Estes dois arquivos criam (e removem) um atalho na sua Área de Trabalho
que abre o Borion Finance como se fosse um aplicativo instalado —
em janela própria, **sem barra de endereço e sem abas** — usando o
modo `--app` do Microsoft Edge ou do Google Chrome.

Por trás das cenas o app continua rodando dentro do motor do navegador
(Edge/Chromium), mas visualmente ele não aparece como uma aba comum.

## Onde colocar os arquivos

Coloque os três arquivos abaixo **na mesma pasta** onde está o `index.html`
do app (a raiz da pasta do Borion Finance):

```
Borion_V5.15 vsaoCloudeia/
├── index.html
├── borion.ico
├── INSTALAR_BORION.bat
├── REMOVER_ATALHO_BORION.bat
└── README_ATALHO.md
```

Não precisa mover, renomear ou copiar nenhum outro arquivo do app.

## Como instalar o atalho

1. Extraia a pasta do app normalmente (ex: para a Área de Trabalho, para
   Documentos, ou qualquer lugar — não importa onde, mesmo que o nome
   da pasta tenha espaços).
2. Dê **dois cliques** em `INSTALAR_BORION.bat`.
3. Uma janela preta (o terminal do Windows) vai aparecer mostrando o
   progresso. Ela vai:
   - Confirmar que encontrou o `index.html`.
   - Detectar automaticamente se você tem o Microsoft Edge ou o
     Google Chrome instalado (dando preferência ao Edge).
   - Criar o atalho **"Borion Finance"** na sua Área de Trabalho,
     usando o ícone `borion.ico` (se ele existir na pasta).
4. Ao final, aparece a mensagem "Atalho criado com sucesso!". Pode
   fechar a janela.
5. Vá até a Área de Trabalho e dê dois cliques no ícone **Borion Finance**.
   O app vai abrir em uma janela própria, sem barra de endereço e sem abas.

Não é necessário ser administrador, não é instalado nenhum programa
extra, nenhum arquivo do app é movido ou apagado, e nenhum dado salvo
é afetado.

## Como remover o atalho

Se quiser remover o atalho da Área de Trabalho (por exemplo, para
recriá-lo depois de mover a pasta do app para outro lugar):

1. Dê dois cliques em `REMOVER_ATALHO_BORION.bat`.
2. Ele apaga **somente** o atalho `Borion Finance.lnk` da Área de
   Trabalho. O app, o `index.html`, o `borion.ico` e todos os seus
   dados salvos continuam intactos.

## E se eu mover a pasta do app para outro lugar?

O atalho aponta para o caminho exato onde o `index.html` estava no
momento em que você rodou o `INSTALAR_BORION.bat`. Se você mover a
pasta do app depois, o atalho antigo vai parar de funcionar. Nesse
caso, basta:

1. Rodar `REMOVER_ATALHO_BORION.bat` (opcional, só para limpar).
2. Rodar `INSTALAR_BORION.bat` novamente, de dentro da nova pasta.

## Por que às vezes abre o Edge em vez do Chrome (ou vice-versa)?

O script sempre dá preferência ao **Microsoft Edge**. Se o Edge não
estiver instalado, ele usa o **Google Chrome** automaticamente. Se
nenhum dos dois estiver instalado, o script avisa e não cria o atalho.

## Perguntas frequentes

**Precisa de internet para funcionar?**
Não. O app continua 100% local/offline, como já era antes. O atalho
só muda a forma como a janela do navegador é aberta.

**Isso reinstala ou altera o app?**
Não. Nenhum arquivo do Borion Finance é alterado, movido ou apagado.
O script só cria (ou remove) um atalho na Área de Trabalho.

**Funciona se o nome da pasta tiver espaços ou acentos?**
Sim, o script foi feito para lidar com isso automaticamente.
