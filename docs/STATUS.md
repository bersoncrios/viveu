# Viveu — validação do Product Owner

## Jornada compartilhada — 13/11/2026

- Implementado `/together` e `/together/:id`: criar jornada por obra, convidar amigos pelo nome, aceitar/recusar, acompanhar progresso individual, combinar marcos, conversar no mural e concluir individualmente. Dono pode arquivar; participantes podem sair sem apagar contribuições.
- Jornadas, progresso e mural são privados por padrão. Cada publicação em perfil e cada reflexão final exigem escolha explícita; reflexões publicadas recebem proteção de spoiler. Convites arquivados podem ser recusados, não aceitos.
- Criado serviço Firestore com paginação estável, limites e validação, Rules completas e índice para consulta por audiência. Regras locais cobrem também perfis, registros públicos e dados pessoais. Flag `appConfig/sharedJourneys` mantém a função fechada por padrão; nenhuma regra, índice ou flag foi enviada para HML/PROD.
- A entrada opcional a partir da fila pré-preenche somente obra/categoria; o motivo pessoal não é copiado para o grupo. Documentação de esquema, autorização e ativação está em [SHARED_JOURNEYS.md](SHARED_JOURNEYS.md).
- Validação final: **170 testes locais**, **31 testes com Firestore Emulator e SDK real** e build HML completo passaram. QA responsivo anterior a este fechamento cobriu 60 medições em 10 telas/estados × 6 larguras (320–1440px), sem overflow horizontal. O build reporta Node v23.4.0 fora da faixa LTS declarada, apesar de passar.
- Para habilitar em HML ainda é necessário comparar e publicar regras/índices e ativar a flag administrativa, seguindo o roteiro da documentação; depois, testar com contas reais. Nenhum deploy foi feito.

## Página pública, login e responsividade — 13/11/2026

- `/` agora é uma apresentação pública com proposta do Viveu, categorias, jornada em três etapas, acompanhamento de amigos e chamadas para entrar. Não redireciona mais automaticamente ao feed. As ilustrações de experiências são identificadas como exemplos e não consultam dados de usuários.
- `/login` recebeu composição editorial moderna, marca existente, ilustração compartilhada com a home, botão Google e estados de conta conectada/entrada pendente/erro. Mantido retorno a destinos internos após autenticação; home/login usam layout próprio sem menu lateral ou navegação móvel do app.
- Responsividade estendida às páginas internas com `src/responsive.css`, carregado após os estilos existentes: grids flexíveis, quebra de títulos, campos, ações de toque, safe area, fila, perfil, avaliações e notas. Ativação dos novos estilos exige reiniciar servidores de desenvolvimento que estavam abertos antes da alteração do `angular.json`.
- Validação: **90 testes locais passaram**, `ngc`, análise de 22 TypeScript/12 templates e análise CSS passaram. **Build HML completo passou fora do sandbox**; dentro dele continua encerrando com código 134. Node observado: v23.4.0, ainda fora da faixa declarada, apesar do build aprovado; recomenda-se manter Node suportado nas instalações normais.
- Chrome local: 42 capturas em 7 telas × 6 larguras (320, 360, 390, 768, 1024 e 1440px), sem transbordamento horizontal detectado. Verificados também o CTA home→login→home e o link de pular para conteúdo via teclado. Relatório e imagens em `test-results/responsive/` (ignorados no Git).
- Páginas internas no teste visual utilizaram fixtures apenas em memória no navegador, com métodos de gravação bloqueados; não houve login Google real nem gravações Firebase. Isso não substitui aceite de persistência HML. Também não comprova comportamento do teclado virtual/safe areas em aparelhos iOS reais. Nenhum deploy realizado.

## Jornada da obra — 13/11/2026

- Implementados motivo para começar na fila, início de jornada com transferência do motivo e remoção atômica da fila, estados em andamento/pausado/concluído/deixado para depois, ponto de retomada e notas durante a experiência. A nota pode ficar vazia até concluir.
- Painel “Continuar minha jornada” no feed e diário mostra até 20 jornadas em andamento/pausadas atualizadas recentemente, com ponto de retomada e acesso à edição. Ao concluir, o formulário recupera o motivo como convite à reflexão.
- “Viver novamente” inicia outra experiência, preservando o registro anterior. Notas têm spoilers independentes; todas as informações da experiência continuam públicas, explicitadas no formulário. Anotações privadas, listas e experiências compartilhadas não estão neste recorte.
- Formulários enviam versão para rejeitar sobrescrita por outra sessão; erros mantêm o rascunho. As datas de notas e de início já salvas são preservadas. Dados legados são tratados como experiências concluídas.
- Validação local: **83 testes passaram**; compilação Angular com `ngc` e análise de 20 TypeScript/10 templates passaram. Testes cobrem transações/limites/conflitos/revisita, notas/spoilers e estados de carregamento/retry. As fronteiras Firestore e Angular são simuladas nos testes; não constituem teste de persistência remota nem teste visual em navegador.
- **Preparação HML pendente:** publicar e aguardar o segundo índice de `firestore.indexes.json`, com `authorId ASC, status ASC, updatedAt DESC, __name__ DESC`, antes de usar o painel de jornadas. Não houve deploy nem alteração remota. O build completo em Node suportado e o aceite funcional em HML continuam pendentes.

## Busca de amigos por nome — 13/11/2026

- Substituída a entrada de UID/link por busca pelo início do nome público (2–60 caracteres), resultados com nome/bio, paginação e abertura do perfil escolhido. “Acompanhando” agora resolve e exibe nomes.
- A consulta limitada usa `displayName` existente, preservando a descoberta de perfis antigos, com variantes usuais de capitalização e respeito aos acentos. Não carrega toda a coleção nem acrescenta dependência de migração. O próprio perfil fica fora dos resultados.
- Resultados atrasados são descartados se a pessoa mudar o nome pesquisado. Erros permitem nova tentativa; páginas adicionais deduplicam perfis.
- Validação: 36 testes locais passaram, incluindo consulta/cursor, limite, autorização, erros e concorrência de buscas; `ngc` e análise de sintaxe/templates passaram. Fronteiras Firebase são simuladas nos testes. Verificação real da consulta, regras e interface em HML segue pendente; nenhuma alteração remota ou deploy realizado.

## Evolução autorizada — guardar experiências — 13/11/2026

- Implementado o recorte proposto: reflexão “O que ficou com você?” (opcional, 3.000 caracteres), perguntas por categoria, até três sentimentos e proteção de spoilers. A citação opcional permanece separada e os registros antigos continuam compatíveis.
- Criação e edição persistem os novos campos na transação existente, incluindo conclusão de item da fila. O cartão comum do diário/feed/perfil protege reflexão e citação; o aviso não torna os dados privados.
- Botões de “Registrar consumo” passaram a “Guardar experiência”; o formulário usa “Guardar uma experiência”. O asterisco lateral foi substituído pelo SVG de marca já existente, também usado no login/cabeçalho.
- Estados de acompanhamento, memórias automáticas, retrospectivas e conexões por obra continuam como propostas futuras; não fazem parte deste recorte.
- Validação: 31 testes locais passaram; compilação Angular (`ngc`) e análise dos templates passaram. Os testes cobrem limites, legado, edição, transação com fila, estado de spoilers e manutenção do formulário em falhas, com fronteiras de SDK/Angular simuladas. QA de navegador e persistência real HML continuam pendentes; nenhuma publicação ou alteração remota foi realizada. O build completo segue sem validação no Node suportado, conforme limitação registrada na retomada de persistência abaixo.

## Retomada — falhas de persistência — 13/11/2026

- Diagnóstico confirmado posteriormente pelo erro real enviado pelo usuário: `The query requires an index` em `vaultlog-hml`. O link Firebase solicita exatamente `entries`, escopo coleção, `authorId ASC`, `createdAt DESC`, `__name__ DESC`, igual ao arquivo local. É necessário criar esse índice remotamente e aguardar sua construção. Nova consulta pela CLI continuou bloqueada por credenciais expiradas; nenhuma publicação foi realizada.
- Revisão com agentes de Backend e QA: a mensagem “Não foi possível carregar os registros” ocorre na consulta paginada do perfil. O índice composto necessário já está em `firestore.indexes.json`; sua disponibilidade remota ainda não foi confirmada. Não há evidência suficiente para atribuir a falha a índice ou permissões.
- Corrigido `saveEntry`: perfis legados sem foto ou nome agora geram campos de autor válidos, evitando valores `undefined` rejeitados pelo Firestore.
- Diário, perfil, feed, fila e formulário preservam o erro original no console e exibem orientações específicas para acesso negado, sessão expirada, conexão, serviço indisponível e sobrecarga. Falha de releitura da fila continua confirmando que a alteração já foi salva.
- Adicionado `firebase.json` apontando para os índices existentes, permitindo uma aplicação explícita e restrita via `firebase deploy --only firestore:indexes --project vaultlog-hml` após verificar o ambiente. Nenhum índice ou regra remota foi alterado nesta etapa.
- Validação local: `npm test` passou com 12 testes; `tsc --noEmit`, `ngc -p tsconfig.app.json` e `npm run check:source` passaram. Os novos testes executam a lógica de salvamento com fronteira Firestore simulada e verificam tratamento dos erros; não substituem integração real.
- `npm run build:hml` novamente encerrou com código 134 usando Node v23.4.0, fora da faixa suportada. A causa do encerramento não foi diagnosticada; não equivale a um erro comprovado do código Angular.
- A tentativa de leitura dos índices HML pela CLI retornou credenciais expiradas. Reautenticação iniciada; confirmação dos índices e teste de persistência real aguardam conclusão do login. Nenhum acesso a PROD ou deploy realizado.

## Retomada da sessão — 13/11/2026

- Usuário relatou `cls is not a constructor` ao entrar com Google.
- Causa identificada nas dependências instaladas: o wrapper `setPersistence` do AngularFire transforma argumentos que são funções em callbacks. Isso transforma o construtor `browserLocalPersistence` em uma função que o Firebase não consegue instanciar com `new cls()`.
- Correção aplicada em `src/app/core/auth.service.ts`: importar `setPersistence` diretamente de `firebase/auth` e chamar `await setPersistence(this.auth, browserLocalPersistence)` sem o wrapper AngularFire. As demais operações mantêm o contexto de injeção existente.
- Validação desta sessão: `npm test` passou (6 testes) e `./node_modules/.bin/tsc --noEmit -p tsconfig.app.json` passou.
- `npm run build` encerrou com código 134, sem diagnóstico da causa. A tentativa com `NG_BUILD_MAX_WORKERS=1 npm run build` também encerrou com código 134. Ambiente observado: Node v23.4.0, fora da faixa declarada em `package.json`.
- Próxima sessão: executar build em Node suportado (conforme `package.json`) e validar o login Google real, restauração da sessão e criação/leitura do perfil no Firebase HML. Os testes existentes não cobrem o login real.
- Nenhum deploy foi feito nesta sessão. O diretório atual não foi reconhecido como repositório Git; nenhuma alteração foi commitada.
- As evidências antigas abaixo são históricas; dependências estão presentes nesta sessão e a checagem TypeScript passou, mas o build completo e o aceite HML continuam pendentes.

## Decisão atual

**Entregas locais estruturadas; aceite funcional HML pendente. Não promover para PROD.** O trabalho disponível corresponde ao recorte das cinco funções do MVP, mas faltam evidências de compilação completa, uso real e persistência no projeto HML.

## Entregas por agente

| Agente | Entrega concreta | Validação do PO |
| --- | --- | --- |
| Product Owner | `docs/BACKLOG.md`: cinco histórias, aceite e definição de pronto | Recorte do MVP aprovado para implementação; replay e cobrança fora desta versão. |
| Pesquisador | `docs/RESEARCH.md`: benchmark e análise do nome | Pesquisa documentada; disponibilidade formal de marca/domínio não deve ser anunciada como garantida. |
| Backend Engineer | Tipos, serviços AngularFire, modelo e índice Firestore | Contrato local entregue. Provedor Google, permissões e índice remoto ainda não confirmados em HML. |
| UX/UI Designer | `docs/DESIGN.md`, componentes e estilos | Direção visual e fluxos entregues; aparência, responsividade e acessibilidade aguardam teste de navegador. |
| Copywriter | `docs/COPY.md` e microtextos das telas | Tom e textos definidos, com estados vazios/erro e visibilidade pública explícita. |
| Frontend Developer | Angular standalone/Signals, rotas, login, diário, registro, fila, feed e perfil público | Código implementado; compilação e critérios funcionais ainda não aprovados. |
| QA Engineer | `tests/contracts.test.mjs` e `docs/QA.md` | 6 contratos aprovados; roteiro HML pendente; achados estáticos enviados para correção. |

## Evidências e pendências

- Testes Node de contratos: 6 passaram. Cobrem seleção de ambientes/branches, configuração Firebase, guard, rotas e índice.
- Analisador de sintaxe: 18 TypeScript e 9 templates sem erro de sintaxe, conforme execução do orquestrador.
- Compilação `ngc`: não concluída devido a AngularFire indisponível e diagnósticos de tipos derivados. Instalação de dependências está bloqueada pela ausência de rede/cache suficiente.
- Correção de recuperação de perfil foi inspecionada no shell; é necessário testar a falha e a tentativa novamente.
- Corrigida a separação entre falha de escrita da fila e falha de releitura; atualização pendente oferece nova leitura, sem afirmar que a inclusão falhou.
- Corrigida a aplicação de resultados de mutações ao navegar entre perfis, com revisão e UID capturados antes da operação.
- Confirmações inline de exclusão/remover receberam foco e retorno ao acionador; registro salvo impede reenvio caso a navegação posterior falhe. Logout também está disponível no celular.
- Nenhum login Google ou teste Firestore HML foi executado; nenhum deploy foi realizado.

## Próximos passos concretos

1. Revisar em navegador as correções estáticas concluídas, especialmente foco das confirmações e navegação durante ações pendentes.
2. Em ambiente com acesso ao registry e Node suportado, executar `npm install`, gerar lockfile e `npm run build:hml`. Corrigir quaisquer erros reais de compilação antes de seguir.
3. Preparar exclusivamente `vaultlog-hml`: habilitar Google Authentication, autorizar domínio local/preview, confirmar banco e permissões existentes e disponibilizar o índice de `firestore.indexes.json`.
4. Conectar repositório à Vercel e publicar preview de branch `develop`/`hml`, usando `npm run build:vercel` e saída `dist/viveu/browser`. Não criar deploy de branch `main`/`master` antes da aprovação para PROD.
5. Executar e registrar os 12 cenários HML de `docs/QA.md`, incluindo duas contas, dados após reload, falhas e acessibilidade/responsividade.
6. Product Owner revisa as evidências e os critérios das cinco histórias. Somente após aceite HML, apresentar a versão validada ao usuário e solicitar autorização explícita para promoção a PROD.

Os parâmetros PROD foram isolados no arquivo específico; sua presença no código não significa autorização de deploy ou integração testada nesse projeto.
