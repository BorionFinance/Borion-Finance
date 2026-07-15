# Marco Íris Tecnologia v1.6.4 — trava do arquivo principal no Google Drive

Correção isolada da persistência do arquivo `Marco_Iris_Dados.json`.

- O ID do arquivo principal é armazenado e validado.
- Salvamentos automáticos, manuais e sincronizações são serializados.
- Cliques repetidos reutilizam a operação em andamento.
- Antes de criar um novo JSON, o sistema repete a consulta ao Drive.
- A estrutura, estética e camada protegida de interconexão não foram alteradas.
