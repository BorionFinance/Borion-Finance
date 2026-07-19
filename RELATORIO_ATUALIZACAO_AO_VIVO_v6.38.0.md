# Borion Finance v6.38.0 — Atualização ao vivo entre dispositivos

## O que você pediu

Lançar algo no computador e o celular (já aberto, sem sair e entrar de novo) se atualizar sozinho em uns 5-10 segundos.

## Dava pra fazer, e o app já tinha a peça principal pronta

O `syncNow()` já fazia uma consulta de metadados (`modifiedTime` do `current.json`) pra detectar conflito. A novidade é rodar essa MESMA consulta barata em segundo plano, de tempos em tempos, mesmo sem nenhuma edição sua — e se ela mudou, buscar o conteúdo novo e atualizar a tela sozinho.

## Como funciona

- A cada **6 segundos**, se este dispositivo não tem nenhuma alteração local pendente, ele confere só os metadados do arquivo no Drive (chamada leve, sem baixar nada). Nenhum conteúdo é buscado à toa.
- Se o `modifiedTime` mudou — sinal de que outro dispositivo salvou algo —, aí sim busca o `current.json` novo e atualiza a tela.
- Some verifica também **na hora** que você volta pro app (troca de aba, tira do celular do segundo plano), sem esperar os 6 segundos.
- Se você está no meio de um perfil, os números atualizam na tela em que você já está — não te tira do lugar nem reseta o que você estava vendo.
- Aparece um aviso pequeno: "Atualizado com uma alteração feita em outro dispositivo."

## Travas de segurança (pra nunca atrapalhar você)

- **Nunca roda se você tem uma alteração sua ainda não salva** (`dirty`) — nesse caso quem decide é o fluxo de conflito que já existia (selo "Conflito — recarregar" ou Ctrl+S), não a atualização automática. Isso evita a atualização "ao vivo" apagar por engano algo que você acabou de digitar antes de ele sincronizar.
- **Nunca aplica em cima de um modal aberto ou de um campo em edição** (cadastrando um lançamento, digitando uma senha, criando um perfil). Se pintar uma atualização nesse momento, ela é **adiada**, não descartada — a checagem seguinte (poucos segundos depois) tenta de novo, e assim que você fechar o modal ou parar de digitar, ela entra sozinha.
- **Nunca roda com a aba em segundo plano** (economiza bateria/dados no celular quando o app não está na tela).
- Se, no caso raro de o perfil que você estava usando ter sido apagado em outro dispositivo enquanto você estava com o app aberto, você volta pra tela de seleção de perfil com um aviso — em vez de continuar numa tela de dados que não existem mais.

## Isso não é o mesmo que sincronização em tempo real "de verdade"

Não é um WebSocket nem um "push" instantâneo — é uma consulta leve repetida (polling). Na prática, para uma família de poucas pessoas com o Google Drive, isso significa **6 segundos, no máximo**, de atraso entre o lançamento em um aparelho e ele aparecer no outro (mais rápido ainda se você trocar de aba/tirar do segundo plano na hora). Não tem custo perceptível de bateria ou de cota da API do Google — é uma chamada de metadados por dispositivo conectado a cada 6 segundos, bem abaixo de qualquer limite do Google Drive para uso pessoal.

## Testado

`tests/test_live_update.js` — 7 casos rodando o código real (`checkForRemoteUpdate`) num sandbox Node: nada muda quando não há novidade; atualiza quando é seguro; nunca aplica com alteração local pendente; adia com modal aberto; adia com campo em edição; lida com o perfil sendo removido em outro lugar; não faz nada em segundo plano. Todos passando, junto com os testes que já existiam.

## Versão

- `index.html`, `sw.js`: **v6.38.0**.
