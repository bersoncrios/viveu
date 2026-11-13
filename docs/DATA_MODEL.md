# Viveu — contrato de dados e integração Firebase

## Estado da entrega

Modelagem e índice entregues para o frontend. Nenhum projeto remoto foi alterado. Login Google, domínios autorizados, disponibilidade do Firestore e criação do índice em HML ainda exigem validação autenticada. Os parâmetros públicos fornecidos não concedem acesso administrativo.

A evolução de jornadas compartilhadas adiciona `firestore.rules`, testado no emulador para acesso restrito/autoria e com ativação remota pendente. Não há Cloud Functions. Enquanto as regras não forem publicadas, o aplicativo continua sujeito às permissões existentes no projeto real; testes locais não comprovam permissões remotas. Erros de permissão não são apresentados como sucesso.

O contrato de `sharedJourneys`, participantes, mural, configuração administrativa, publicação opcional e preparação HML está em [SHARED_JOURNEYS.md](SHARED_JOURNEYS.md).

## Coleções

| Caminho | Campos persistidos | Uso |
| --- | --- | --- |
| `users/{uid}` | `uid`, `displayName`, `bio`, `photoURL`, `createdAt`, `updatedAt` | Perfil público; não gravar e-mail/token |
| `entries/{id}` | `authorId`, `author: {displayName, photoURL}`, `title`, `category`, `rating`, `quote`, `reflection`, `feelings`, `containsSpoilers`, `status`, `reason`, `resumePoint`, `notes`, `startedAt`, `completedAt`, `previousEntryId`, `createdAt`, `updatedAt` | Diário, perfil e feed |
| `users/{uid}/queue/{id}` | `title`, `category`, `reason`, `position`, `createdAt` | Fila do usuário |
| `users/{uid}/following/{targetUid}` | `uid: targetUid`, `createdAt` | Seguir unilateralmente |

Tipos em `src/app/core/models.ts`. O `id` de registros e itens da fila é derivado do ID do documento, não precisa ser persistido. Datas são números inteiros de milissegundos UTC gerados pelo cliente (`Date.now()`); relógios de dispositivos divergentes podem afetar a ordem. Essa limitação fica explícita e pode ser removida futuramente com `serverTimestamp` e migração do contrato. `createdAt` é imutável em edições; `updatedAt` muda na gravação.

Categorias: `filme`, `serie`, `livro`, `jogo`, `podcast`, `musica`. Nota: inteiro de 1 a 5; pode ser `null` em jornadas não concluídas. Título: 1–160 caracteres após trim; frase: até 500; nome: 2–60; bio: até 240. O frontend valida antes de escrever e exibe texto via interpolação Angular, sem HTML livre. Perfil não contém informação privada do provedor.

### Jornadas, retomada e revisita

`status`: `in_progress`, `paused`, `completed` ou `abandoned`. Registros legados sem status são concluídos. A fila representa o momento “quero começar”, sem duplicar a experiência antes do início. Concluir exige nota; nos demais estados ela pode ser nula.

`reason` (até 500 caracteres) guarda o motivo; `resumePoint` (até 160) guarda onde parou. A fila também aceita `reason`; seu valor é transferido ao iniciar uma experiência. Ao concluir, o formulário recupera esse motivo para comparar expectativa e experiência.

`notes`: até 100 objetos `{id,text,createdAt,containsSpoilers}`; texto de até 1.000 caracteres, ID único e data finita. São salvos junto com a experiência, incluindo notas digitadas ainda não adicionadas à lista. Datas dos IDs já persistidos são preservadas em edições. Notas podem ser removidas pelo formulário e a remoção só se efetiva ao salvar. São públicas; o aviso de spoiler de cada nota independe do aviso de reflexão/citação. Os cartões apresentam a timeline em uma seção expansível. Não existe modo privado por anotação neste recorte.

`startedAt` é inicializado na primeira gravação em andamento/pausada e preservado depois. `completedAt` recebe a data de conclusão e é limpo ao reabrir; uma nova conclusão recebe nova data. Ao editar um legado concluído sem data de conclusão, utiliza-se sua `createdAt` como referência. `previousEntryId` liga uma revisita ao registro anterior; a criação lê o registro de origem na mesma transação, exige autoria e não altera nem copia sua avaliação/reflexão/notas. Edições não mudam o vínculo.

O formulário envia `expectedUpdatedAt`; se a versão divergir da salva, a transação falha com `vaultlog/stale-entry` e mantém o rascunho na tela. `updatedAt` avança no mínimo uma unidade mesmo com relógio parado/retrocedendo. Isso não substitui Rules no servidor, mas evita perda acidental entre os formulários desta aplicação. Omitir campos opcionais numa edição preserva os valores existentes.

### Evolução das experiências

`reflection`: reflexão livre opcional de até 3.000 caracteres após trim, com pergunta orientadora por categoria no formulário. `quote` continua sendo a citação opcional de até 500 caracteres; os textos antigos são preservados nesse campo, sem conversão automática.

`feelings`: até três valores únicos de `inspirado`, `emocionado`, `curioso`, `surpreso`, `decepcionado`, `divertido`. `containsSpoilers`: booleano. Novas gravações persistem os campos com padrões `''`, `[]`, `false` quando omitidos. Registros antigos podem não ter esses campos e continuam legíveis/editáveis. Nota e categoria mantêm seus contratos anteriores.

O cartão compartilhado pelo diário, feed e perfil oculta reflexão e citação marcadas com spoiler até a pessoa escolher ler. Título, nota e sentimentos permanecem visíveis. O texto oculto só é inserido no DOM após revelar; a escolha é local ao cartão e é reiniciada se o ID ou conteúdo mudar. Isso é proteção de leitura, não privacidade: os documentos continuam públicos segundo as permissões existentes. Não há novos filtros ou índices necessários para esses campos.

## Autenticação e perfil

AngularFire fornece `provideFirebaseApp`, `provideAuth` e `provideFirestore`, sempre com o mesmo `environment.firebase`. Login pelo `GoogleAuthProvider` e `signInWithPopup`; usar persistência de sessão Firebase. Esperar a primeira emissão de autenticação antes de decidir guards.

No primeiro login, consultar `users/{uid}` e criar o documento apenas se ausente, preferencialmente em transação para evitar sobrescrever edições durante acessos concorrentes. Nos demais logins manter nome e bio existentes. Nome/foto Google são somente os valores iniciais. Logout deve limpar os signals e dados privados. Falha de gravação de perfil deve permitir nova tentativa sem simular cadastro concluído.

No console **HML**, conferir Authentication → Sign-in method → Google habilitado, e-mail de suporte definido e domínios de desenvolvimento/preview autorizados. Conferir Firestore criado e índice abaixo pronto. Repetir a preparação em PROD apenas na promoção aprovada. Não se pode afirmar que o provedor esteja habilitado sem acesso e teste real. Referência: [Google Sign-in no Firebase](https://firebase.google.com/docs/auth/web/google-signin).

## Consultas e paginação

`activeJourneys()` consulta somente `authorId` atual, `status in [in_progress,paused]`, `updatedAt DESC`, `documentId DESC`, limite 20. O painel no feed/diário informa o limite e oferece acesso ao diário completo. Depende do índice composto novo declarado abaixo; erros não viram estado vazio.

Busca de amigos: `searchProfiles(name,cursor?)` consulta o campo público existente `users.displayName` por prefixo, com variantes digitada, minúscula, maiúscula e iniciais maiúsculas. Preserva acentos; não é busca por sobrenome isolado, trecho no meio do nome ou combinação arbitrária de maiúsculas. Não exige campo normalizado nem migração dos perfis antigos. A consulta usa OR de intervalos no mesmo campo, `orderBy(displayName ASC, documentId ASC)` e limite de 21 para devolver até 20 por página com indicação da próxima. Exclui a própria pessoa dos resultados e usa o ID real do documento como UID. Usa índice de campo único; nenhuma nova combinação de índices compostos foi adicionada. Nome e bio diferenciam homônimos; seguir continua usando UID internamente após a escolha do perfil. A lista de acompanhados resolve os nomes atuais dos perfis e não exibe UIDs.

Página de registros: `where('authorId', '==', uid)`, `orderBy('createdAt', 'desc')`, `orderBy(documentId(), 'desc')`, `limit(20)`. Próxima página usa `startAfter(lastDocumentSnapshot)` com a mesma consulta. Nunca usar apenas data como cursor, pois duas gravações podem compartilhar milissegundo. Limpar cursor ao mudar perfil; deduplicar por ID ao acumular páginas.

Fila: `orderBy('position', 'asc')`, `orderBy(documentId(), 'asc')`. As posições são números. Novos itens usam um valor posterior ao último; subir/descer troca posições adjacentes numa transação, lendo ambos os itens antes de gravar. Em empate, usar ID para desempatar; ao mover um item empatado o serviço atribui posição fracionária antes/depois da posição empatada. Empates de várias inclusões simultâneas são uma limitação do MVP e podem exigir reposicionamentos adicionais. Só atualizar a interface após confirmação ou reverter ao falhar. Evitar regravar todos os itens a cada movimento. Fila pode ser carregada em páginas; movimentos no limite precisam carregar o vizinho antes.

Following: listar em páginas de 100 ordenadas por `documentId()`; continuar até esgotar para construir os grupos do feed. Verificar existência do perfil antes de seguir e impedir autoacompanhamento. IDs determinísticos evitam duplicidade; excluir o documento desfaz o vínculo. Não substituir leitura de perfil existente por uma busca de usuário no Firebase Auth, que não é pública.

Feed: apenas `authorId` dos perfis seguidos; nunca substituir por feed global se não houver amigos. Decisão do PO para o MVP: **até 30 perfis acompanhados**, limite exposto com mensagem antes de um novo vínculo. Consultas `in` aceitam até 30 valores neste formato, de acordo com os [limites de consultas Firestore](https://firebase.google.com/docs/firestore/query-data/queries). Assim o feed usa uma única consulta `where('authorId', 'in', ids)`, ordem/cursor iguais aos registros e limite 20. A lista de vínculos é lida completamente; se dados legados ou gravações concorrentes excederem 30, o serviço retorna erro explícito, sem truncar silenciosamente. Alterações na lista de amigos invalidam o cursor. O limite é verificado no cliente, sem garantia contra sessões concorrentes neste escopo sem Rules/Functions.

## Escritas e consistência

- Registro novo recebe ID automático e snapshot do nome/foto públicos atuais. Edições mantêm autor e criação. Excluir só após confirmação; controles de edição usam `authorId === currentUser.uid`.
- Ao registrar a partir da fila, usar uma transação para gravar o consumo e apagar o item em uma única confirmação. Não apagar o item antes de salvar.
- O snapshot do autor documenta a identidade exibida no momento do registro. Página de perfil usa os dados atuais de `users/{uid}`; no feed, resolver o perfil atual dos autores únicos da página se for necessário refletir renomeações imediatamente. Não regravar um histórico inteiro para editar uma bio.
- Erros de permissão, conexão e índice ausente devem chegar ao estado de erro da tela. Nenhum fallback local deve parecer persistência Firestore real.
- Leitura pública busca exclusivamente perfil e registros públicos; não acessar fila/following de visitantes para compor a página.

## Índices e ambientes

`firestore.indexes.json` define dois compostos em `entries`: `authorId ASC, createdAt DESC, __name__ DESC` para diário/perfil/feed, e `authorId ASC, status ASC, updatedAt DESC, __name__ DESC` para jornadas ativas. Ambos têm escopo de coleção. Demais consultas descritas usam índices de campo único habilitados por padrão. Qualquer nova combinação de filtros exige nova avaliação; não filtrar categoria na consulta do servidor sem acrescentar o índice correspondente.

Os índices são os mesmos em HML e PROD. Aplicação administrativa do arquivo é independente do build Angular e não foi executada. HML deve usar exclusivamente `vaultlog-hml`; PROD exclusivamente `vaultlog-65c3d`. A evolução de grupos passa a incluir `firestore.rules`; sua publicação requer comparar as regras existentes e seguir a ativação HML documentada, sem deploy geral ou acesso a PROD. O `ng build` padrão permanece HML e `--configuration=production` substitui o environment. O frontend não inicializa um segundo Firebase app em outro ambiente.

## Evidências mínimas para QA HML

1. Login Google real, persistência de sessão e logout.
2. Perfil criado só uma vez; editar nome/bio, relogar e conferir preservação.
3. CRUD de registros com leitura após recarregar a página.
4. Criar fila, ordenar, recarregar e concluir item sem duplicação ou perda.
5. Abrir perfil público sem sessão e conferir ausência de e-mail/fila.
6. Dois usuários: seguir, ver apenas autor seguido no feed, deixar de seguir e confirmar vazio.
7. Mais de uma página e datas iguais: nenhuma duplicação ou omissão em navegação estável; testar limite explícito de 30 perfis seguidos e erro com vínculos legados acima do limite.
8. Falha de escrita/leitura não produz mensagem de sucesso nem apaga entrada do formulário.

Sem essas evidências, o status é “contrato pronto; integração remota não validada”.

## API de serviços entregue

`AuthService`: signals `user`, `profile`, `error`; `ready: Promise<void>`; `login()`, `logout()`, `updateProfile({displayName,bio})`, `requireUser()`. Inicialização sempre resolve `ready` após sucesso ou falha de carga do perfil, e a falha fica em `error`.

`DataService`: `getProfile(uid)`, `getEntry(id)`, `entriesPage(uid,cursor?)`, `feedPage(uids,cursor?)`, `saveEntry(input,id?,queueId?)`, `deleteEntry(id)`, `queue()`, `addQueue(title,category)`, `removeQueue(id)`, `moveQueue(items,index,delta)`, `following()`, `follow(uid)`, `unfollow(uid)`. `EntryPage` contém `items`, `cursor`, `hasMore`; o cursor deve permanecer em memória e não ser serializado em URL. `errorMessage(error)` exportado pelo serviço de autenticação converte erros conhecidos em microtexto. Serviços usam AngularFire modular real, não adaptadores fictícios. Compilação e integração dependem da disponibilidade do pacote AngularFire.
