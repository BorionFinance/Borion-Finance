# Checklist de aceite — Borion Finance 7.9.7

## Cartões, despesas e assinaturas

- [x] **Aparecer também em Despesas** funciona em Cartões.
- [x] Desmarcar em Cartões remove de Despesas no próprio clique.
- [x] Desmarcar em Despesas atualiza Cartões no próprio clique.
- [x] A preferência da assinatura é gravada na cobrança e na regra.
- [x] Trocar de aba não desfaz a escolha; o Drive continua salvando em segundo plano.

## Ordem dos perfis

- [x] Perfis usam a mesma alça de arrastar dos módulos.
- [x] Não há setas para cima/baixo.
- [x] A ordem atualiza memória, armazenamento e fila do Drive antes de redesenhar.

## Google Drive e celular

- [x] `current.json` maior que 3 MB é baixado em partes de 768 KB.
- [x] Cada parte tem repetição independente e timeout até o corpo terminar.
- [x] **Tentar novamente** recarrega a página inteira.
- [x] A alteração fica instantânea na tela e o envio ao Drive continua em segundo plano.
- [x] A última alteração pendente possui recuperação temporária criptografada no dispositivo.
- [x] A recuperação usa AES-GCM e chave não exportável; não grava dados financeiros em texto puro.
- [x] A pendência local só é apagada depois de confirmação real do `current.json` no Drive.
- [x] Ao reabrir no mesmo dispositivo, uma gravação interrompida é recuperada e reenviada.
- [x] Várias mudanças rápidas mantêm somente a cópia pendente mais recente.
- [x] Fechar/recarregar enquanto há gravação pendente continua acionando o aviso nativo do navegador quando suportado.
- [ ] Validação final recomendada em celular real com uma base real de 3 MB ou mais.

## Segurança do repositório

- [x] `CODEOWNERS`, CodeQL, testes, Dependabot, política de segurança e bloqueio de segredos adicionados.
- [x] No GitHub: proteger `main`, impedir force-push/exclusão e exigir pull request antes de merge.
- [x] No GitHub: ativar secret scanning, push protection e relato privado de vulnerabilidades.
- [ ] No GitHub: exigir os testes automáticos na regra da `main` e confirmar o deploy final do Pages.
