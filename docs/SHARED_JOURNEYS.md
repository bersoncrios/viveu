# Jornadas em companhia

## Experiência entregue

`/together` reúne jornadas e convites. A entrada fica no menu “Em companhia” (“Juntos” no celular), no feed e na ação “Convidar amigos” da fila. Criar pela fila aproveita apenas título/categoria: o motivo pessoal não é compartilhado e o item não é removido.

Quem cria define obra, categoria, descrição, unidade de progresso e ritmo: livre ou por marcos. Na criação pode selecionar até 29 pessoas que já acompanha para enviar os convites iniciais; a lista usa nomes e fotos públicas. Depois também pode buscar outras pessoas pelo início do nome na página da jornada. O grupo aceita até 30 pessoas contando participantes e convites pendentes. Aceite nunca é automático; a identidade interna continua sendo o UID, sem pedir que a pessoa o digite.

Participantes atualizam seu próprio progresso e ritmo. Quem criou pode combinar até 20 marcos, com posição, data opcional e pergunta para o encontro. O mural recebe impressões, perguntas e registros de sessões. Não há chat em tempo real nem notificação externa: o botão “Atualizar” busca as novidades.

Textos com spoiler ou além do progresso de quem lê começam ocultos, com revelação explícita por mensagem. A proteção de spoiler é uma escolha de leitura; membros aceitos têm acesso ao conteúdo do grupo. Cada pessoa conclui individualmente com nota/reflexão, formando a memória coletiva. Reflexões finais começam ocultas para quem ainda não terminou.

Contribuições e conclusões ficam **somente no grupo por padrão**. Caixas desmarcadas permitem publicar o próprio texto no diário público, usando uma experiência pessoal reservada para cada participante. A transação copia apenas o texto/avaliação/reflexão escolhidos pelo autor, preservando dados anteriores do diário e sem copiar mensagens alheias, nome, descrição ou identificador do grupo. Reflexões finais publicadas recebem aviso de spoiler automaticamente; a pessoa pode ajustá-lo no diário. Não há sincronização automática das mudanças feitas depois no diário de volta ao grupo.

Participantes podem sair, inclusive de grupo arquivado. Deixam de acessar o mural; contribuições anteriores permanecem no histórico do grupo. Quem criou pode arquivar, sem excluir o grupo nem apagar os diários. Arquivamento encerra novas contribuições, convites, marcos e atualizações de progresso; conclusão individual continua permitida. Convites pendentes não podem mais ser aceitos, mas podem ser recusados.

## Persistência e limites

| Caminho | Contrato |
| --- | --- |
| `appConfig/sharedJourneys` | Flag administrativa `enabled: true`, `rulesVersion: 1`; cliente não pode alterá-la. |
| `sharedJourneys/{id}` | Obra, criador, ritmo, unidade, agenda e listas `memberIds`, `invitedIds`, `audienceIds`. A última é a união das duas primeiras. |
| `sharedJourneys/{id}/members/{uid}` | Convite/aceite, identidade pública, progresso, avaliação/reflexão e ID reservado da experiência pessoal. |
| `sharedJourneys/{id}/posts/{postId}` | Autor, texto de até 1.000 caracteres, tipo, posição opcional, aviso de spoiler e indicador de publicação escolhida pelo autor. |
| `entries/{entryId}` | Criado/atualizado somente quando o participante escolhe publicar no próprio diário. |

Título: 160; descrição: 1.000 (formulário inicial limita a 500); pergunta: 500; título do marco: 120; reflexão: 3.000 caracteres. Progresso é inteiro entre 0 e 1.000.000. Cada marco possui posição única. O serviço preserva datas/IDs e lê os documentos antes de escrever em cada transação.

Lista de jornadas e mural usam 20 itens por página, documento adicional de antecipação, cursor por snapshot e desempate por ID. Participantes são consultados por `state in [active, invited]`, limitados a 30; o histórico de saídas/recusas não ocupa esse limite. O composto `sharedJourneys: audienceIds CONTAINS, updatedAt DESC, __name__ DESC` está em `firestore.indexes.json`.

## Permissões

`firestore.rules` mantém perfis/experiências pessoais públicos, autoria das escritas e fila/following restritos ao dono. Jornadas exigem autenticação, configuração habilitada e participação:

- Convidados recebem o resumo/agenda do grupo e consultam o próprio convite. Não leem mural nem dados de outros participantes antes de aceitar.
- Participantes aceitos leem mural e participantes; só modificam o próprio progresso/avaliação/reflexão. Criador não pode aceitar convite ou escrever reflexão por outra pessoa.
- Regras exigem alteração conjunta das listas de acesso e do estado do convite/participação. UID, função e vínculo pessoal não podem ser transferidos por uma atualização.
- Sinalizadores de publicação exigem uma experiência realmente existente e pertencente ao autor; não é possível afirmar uma publicação sem a gravação correspondente. O indicador de uma experiência já publicada não pode voltar a falso.
- Grupo/post não têm exclusão física no cliente. Não há regra global permissiva ou leitura pública do mural.

As invariantes entre documentos usam `getAfter()` para validar o resultado de uma transação antes da confirmação. Referência: [condições e operações atômicas nas regras Firebase](https://firebase.google.com/docs/firestore/security/rules-conditions).

## Ativação em HML

A aplicação falha fechada: sem a flag administrativa válida, não cria grupos nem publica conteúdo compartilhado. Habilitar a flag depende de as permissões abaixo estarem disponíveis.

1. Inspecionar as regras remotas de `vaultlog-hml` e comparar com `firestore.rules`. A publicação substitui o conjunto de regras; preservar eventuais caminhos adicionais usados fora deste repositório. Não alterar PROD.
2. Com acesso administrativo, publicar exclusivamente regras e índices em HML:

```sh
firebase deploy --only firestore:rules,firestore:indexes --project vaultlog-hml
```

3. Aguardar o índice de jornadas compartilhadas ficar pronto. Confirmar que as regras publicadas são as revisadas e validadas no emulador.
4. Pelo console administrativo Firestore HML, criar `appConfig/sharedJourneys` com `enabled` booleano `true` e `rulesVersion` numérico `1`. Clientes não podem criar/alterar esse documento pelas regras propostas. Usar `enabled: false` para suspender o recurso.
5. Executar o aceite com duas contas HML e um visitante: convite, aceite, recusa, progresso, mural restrito, publicação opcional e conclusão. Conferir dados após recarga, perda de acesso após saída e texto ausente de perfis públicos quando não houve escolha de publicar.

Nesta entrega nenhuma regra, índice ou flag foi publicada remotamente. A preparação é local e o recurso permanece indisponível nos ambientes que ainda não foram ativados.

## Verificação local

Testes de serviço/UI executam código real transpilado com fronteiras simuladas. Os testes em `tests/emulator/shared-rules.test.mjs` exercitam o Firestore real no emulador, incluindo fluxos completos do serviço com SDK real, sem mocks do SDK nesses fluxos.

```sh
npm test
firebase emulators:exec --config firebase.shared-test.json --project demo-vaultlog-shared --only firestore 'npm run test:rules'
npm run build:hml
```

O teste do emulador exige exatamente `demo-vaultlog-shared` e `127.0.0.1:8089`; nenhuma credencial ou projeto real é usado. Capturas de navegador ficam em `test-results/responsive/`, usando fixtures em memória, publicação inicialmente desmarcada e escritas bloqueadas. O roteiro real HML é uma etapa distinta.
