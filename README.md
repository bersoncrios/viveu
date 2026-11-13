# Viveu

MVP web de um diário cultural com Google Sign-In, registros, fila pessoal ordenável, feed de amigos e perfil público. Angular 20 standalone, Signals, AngularFire e Firestore direto do navegador. Identidade e decisões do produto em `docs/`.

## Estado

As funcionalidades do MVP, evolução de jornadas, página pública, login renovado e Jornada compartilhada têm código local implementado. A validação mais recente passou com 170 testes locais, 31 testes de regras no Firestore Emulator com SDK real e build HML completo. A conferência de layout em Chrome cobriu 60 medições em dez telas/estados entre 320 e 1440px; páginas internas usaram fixtures em memória, sem gravar dados. Para usar Jornada compartilhada em HML ainda é necessário publicar regras/índice e ativar a flag administrativa; nenhum deploy foi executado e PROD não foi acessado. Histórico em `docs/STATUS.md`.

## Executar

Use Node 22.12+ da linha 22 ou Node 24+ e npm 11.

```sh
npm install
npm start
```

Abra `http://localhost:4200`. O projeto usa HML por padrão, inclusive em `ng build` sem configuração. Após instalar, versionar o `package-lock.json` produzido para instalações reproduzíveis.

`/` é a apresentação pública; `/login` faz a entrada com Google; `/feed` abre o aplicativo. Após atualizar esta versão, reinicie servidores de desenvolvimento antigos para carregar o novo arquivo global de responsividade configurado no `angular.json`.

```sh
npm test
node scripts/check-source.mjs
npm run build:hml
```

A análise de sintaxe é complementar ao build, não valida integração. Casos manuais e status em `docs/QA.md`.

## Firebase

`src/environments/environment.ts` aponta exclusivamente para `vaultlog-hml`. `environment.prod.ts` aponta exclusivamente para `vaultlog-65c3d`. As configurações públicas fornecidas estão preservadas. Não há Analytics inicializado nem Cloud Functions.

Antes de testar HML, um administrador deve verificar no console HML: Google habilitado em Authentication, domínios localhost/preview autorizados, Firestore criado e índice de `firestore.indexes.json` disponível. A aplicação não tem credenciais administrativas para realizar essas ações. Os testes de dois usuários e persistência precisam de sessões Google reais.

Com uma conta administrativa autenticada na Firebase CLI, consulte os índices HML e publique apenas o índice declarado se estiver ausente. Aguarde o estado pronto antes de repetir a leitura:

```sh
firebase firestore:indexes --project vaultlog-hml
firebase deploy --only firestore:indexes --project vaultlog-hml
```

Em falhas de leitura/gravação, as telas mostram orientações por tipo de erro. O console do navegador preserva o erro Firebase original, incluindo o diagnóstico de índice ausente, para investigar a causa antes de alterar configurações.

O painel “Continuar minha jornada” usa um segundo índice composto de `entries`, já declarado no arquivo: `authorId ASC`, `status ASC`, `updatedAt DESC`, `__name__ DESC`. Publique-o em HML e aguarde ficar pronto antes de validar o painel. Os registros antigos sem `status` continuam sendo tratados como concluídos, sem migração obrigatória.

## Jornadas de uma obra

Na fila, guarde o motivo para começar. “Começar jornada” leva a obra e o motivo ao formulário; salvar grava a experiência e remove a fila na mesma transação. Também é possível começar uma obra diretamente no painel inicial.

Uma jornada pode estar em andamento, pausada, concluída ou deixada para depois. A nota é opcional até concluir. Você pode registrar um ponto de retomada e até 100 notas de 1.000 caracteres; notas em rascunho são incluídas ao salvar. Motivo, ponto de retomada e notas são públicos após salvar a experiência. Cada nota pode ter aviso de spoiler independente.

“Viver novamente” cria uma nova experiência vinculada à anterior, sem reaproveitar avaliação, reflexão ou notas. Editar um registro antigo preserva o histórico; uma versão desatualizada é recusada se outra sessão já alterou o registro.

## Jornadas em companhia

`/together` permite criar grupos por obra, convidar pessoas pelo nome, aceitar/recusar convites e compartilhar impressões, perguntas ou sessões. Cada participante mantém seu progresso e conclusão; grupos podem combinar marcos e perguntas de encontros. Mensagens com spoilers ou além do progresso começam ocultas.

O mural fica no grupo por padrão. Publicar o próprio texto ou conclusão no diário exige escolha explícita. Esta versão necessita das novas regras, índice e flag administrativa para ser usada remotamente; sem ativação ela não grava dados compartilhados. Consulte [o roteiro de ativação HML e contrato](docs/SHARED_JOURNEYS.md).

As regras propostas estão em `firestore.rules`, com autoria das experiências, fila/following do próprio usuário e acesso restrito às jornadas compartilhadas. Foram preparadas para teste local; não foram publicadas remotamente. Compare com as regras remotas antes de publicar, preservando eventuais caminhos de outros sistemas. O cliente respeita as permissões já disponíveis no ambiente.

Modelagem, índices, paginação e contrato de serviços em `docs/DATA_MODEL.md`.

## Vercel e ambientes

Importar o repositório na Vercel com `vercel.json`: comando `npm run build:vercel`, saída `dist/viveu/browser`. O script escolhe PROD apenas para branches `main` e `master`; `develop`, `hml` e qualquer preview usam HML. Build local sem metadados Vercel também usa HML. Rotas SPA têm rewrite para `index.html`.

**Durante esta fase, trabalhar em `develop` ou `hml`.** Não publicar/mesclar em `main/master` antes da aprovação explícita do dono do produto, pois essas branches selecionam PROD. A separação de branches e os domínios autorizados precisam ser configurados no projeto Vercel quando houver acesso. Nenhuma conexão com Vercel foi configurada nesta sessão.

Após QA HML aprovado e autorização explícita, o comando de produção é:

```sh
npm run build:prod
```

Não foi executado nesta entrega.

## Produto

- `docs/BACKLOG.md`: histórias priorizadas e critérios de aceite.
- `docs/RESEARCH.md`: benchmark e colisão de nome encontrada; Viveu é o nome público escolhido pelo PO.
- `docs/DESIGN.md` e `docs/COPY.md`: identidade visual, navegação e microtextos.

Replay anual e cobrança ficam fora do MVP atual. Amigos são perfis acompanhados unilateralmente, com até 30 vínculos no MVP. Perfil público usa `/u/:uid`; e-mail não é persistido no perfil. Nota de 1 a 5 e frase opcional.
