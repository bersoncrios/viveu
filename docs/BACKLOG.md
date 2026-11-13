# Viveu — backlog do MVP

## Objetivo e recorte

Permitir que uma pessoa mantenha seu diário cultural, escolha o próximo consumo e acompanhe registros de amigos. Categorias: filmes, séries, livros, jogos, podcasts e músicas. Interface inicial em português, responsiva para web.

Replay anual, cobrança, planos, aplicativos móveis, catálogos externos, recomendações automáticas, comentários e curtidas ficam fora desta entrega. O produto preserva a proposta futura de replay sem apresentar uma função ainda indisponível como pronta.

## Prioridade e ordem

| Ordem | História | Dependências |
| --- | --- | --- |
| P0 · 1 | Cadastro Google e perfil | Ambientes e modelo Firestore |
| P0 · 2 | Registro de consumo | Autenticação e perfil |
| P0 · 3 | Fila pessoal com prioridade manual | Autenticação |
| P0 · 4 | Perfil público compartilhável | Perfil e registros |
| P0 · 5 | Feed de amigos | Perfil público e registros |

As cinco histórias compõem o MVP. A ordem organiza implementação e validação, sem tornar as últimas opcionais.

## VL-01 — Entrar e manter meu perfil

Como pessoa usuária, quero entrar com minha conta Google e definir meu nome público e bio para manter uma identidade no Viveu.

Critérios de aceite:

- O login Google cria um perfil apenas no primeiro acesso; novos acessos preservam os dados editados.
- A sessão persiste e o logout impede acesso às rotas privadas.
- Nome público obrigatório, com 2 a 60 caracteres; bio opcional, até 240 caracteres.
- E-mail não aparece no perfil público nem nos registros do feed.
- Cancelamento, carregamento e erro de autenticação têm mensagens claras, sem criar estado de login falso.
- Visitantes podem abrir um perfil público sem fazer login.

## VL-02 — Registrar minha experiência cultural

Como pessoa usuária, quero registrar título, categoria, nota e uma frase memorável para lembrar do que consumi.

Critérios de aceite:

- Título obrigatório, entre 1 e 160 caracteres após remover espaços externos.
- Categoria obrigatória e restrita às seis categorias do MVP.
- Nota obrigatória, inteira, de 1 a 5, com controle acessível pelo teclado.
- Frase memorável opcional, até 500 caracteres; formulário explica sua visibilidade pública.
- Registro recebe identificador, autor e data de criação; a interface só confirma gravação após sucesso do Firestore.
- Pessoa usuária vê seus registros mais recentes primeiro e pode editar ou excluir os próprios registros.
- Exclusão pede confirmação; erro mantém os dados preenchidos e permite tentar novamente.
- Nenhum registro de demonstração é apresentado como dado persistido real.

## VL-03 — Organizar minha fila

Como pessoa usuária, quero listar o que pretendo consumir e alterar a ordem para decidir meu próximo passo.

Critérios de aceite:

- Inclusão exige título e uma das seis categorias.
- Cada item pertence à pessoa autenticada e possui posição persistida.
- Controles de subir e descer permitem ordenar pelo teclado e em telas de toque; arrastar é opcional.
- Reabrir a página mantém a ordem salva; primeiro e último itens têm ações indisponíveis coerentes.
- É possível remover um item e iniciar um registro com título e categoria preenchidos.
- Ao concluir o registro originado da fila, o item é removido apenas após a gravação do consumo; falhas não perdem o item silenciosamente.
- Fila vazia e falhas de leitura ou gravação têm estados próprios. A fila não é exibida no perfil público.

## VL-04 — Compartilhar meu perfil

Como pessoa usuária, quero compartilhar uma URL estável do meu perfil para mostrar minha jornada cultural.

Critérios de aceite:

- Rota pública baseada no UID, por exemplo `/perfil/:uid`, funciona por acesso direto e atualização da página.
- Exibe nome público, bio e registros, com categoria, nota, frase e data.
- Nunca exibe e-mail, fila pessoal ou controles de edição de outro usuário.
- Compartilhar copia a URL e informa sucesso; se a API de clipboard falhar, apresenta a URL selecionável.
- Perfil inexistente, carregando, sem registros e erro de leitura têm apresentação distinta.
- Mudanças de perfil e registros são refletidas nas leituras seguintes.

## VL-05 — Acompanhar amigos

Como pessoa usuária, quero encontrar amigos pelo nome, seguir seus perfis e ver seus registros recentes em um feed.

Decisão de produto: no MVP, “amigos” significa seguir unilateralmente um perfil público; não há convite nem aprovação recíproca.

Critérios de aceite:

- Perfil público de outra pessoa autenticada oferece seguir e deixar de seguir.
- Não é possível seguir a si próprio ou criar vínculos duplicados.
- Buscar pelo início do nome público (2 a 60 caracteres) apresenta perfis para escolha, com nome e bio, paginação e estados de carregamento, vazio e erro. Homônimos aparecem separadamente. O usuário abre o perfil escolhido para seguir; não precisa conhecer o UID.
- Feed mostra apenas registros de perfis seguidos, com autor, título, categoria, nota, frase e data, mais recentes primeiro.
- Abrir um autor no feed navega ao seu perfil público.
- Não seguir ninguém apresenta orientação para adicionar o primeiro amigo; amigos sem registros apresentam estado vazio específico.
- Consultas têm limite e paginação; carregar mais não duplica registros. Limites técnicos de consultas Firestore devem ser tratados sem truncar silenciosamente a lista de amigos.
- Erros de seguir, deixar de seguir e carregar feed não são apresentados como sucesso.

## Definição de pronto

- Implementação em Angular 19+ com componentes standalone, Signals, rotas privadas protegidas e carregamento lazy das páginas.
- Authentication Google e Firestore integrados diretamente pelo frontend via AngularFire, sem Cloud Functions. A evolução de jornadas compartilhadas acrescenta Security Rules para acesso restrito, autoria e aceite de convites; publicação remota segue etapa própria de validação HML.
- HML é o padrão de desenvolvimento, teste e `ng build`; PROD só é selecionado explicitamente por `--configuration=production` com substituição de environment.
- Nenhum teste cria ou altera dados em PROD. Promoção para PROD depende de autorização explícita do dono do produto.
- Formulários possuem rótulos, foco visível, validação e estados de carregamento/erro; navegação principal funciona por teclado e a interface cabe em telas pequenas.
- Compilação HML aprovada e critérios principais verificados; evidências distinguem testes locais de integração efetivamente executada em HML.
- Modelo, índices necessários, preparação do Google Authentication, ambientes e deploy Vercel documentados.
- Segredos administrativos não ficam no frontend. Configurações públicas Firebase não equivalem a autorização de operações administrativas.
- Limitações ou dependências externas não verificadas constam no relatório de QA e impedem declarar integração HML ou produção aprovada sem evidência.

## Portões de validação do Product Owner

1. Pesquisa: incorporar diferenciação sem ampliar escopo; disponibilidade de marca só pode ser tratada como indício até verificação formal.
2. Backend e UX: conferir que o modelo suporta as cinco histórias e que os fluxos possuem estados vazios, erro e carregamento.
3. Frontend e QA: corrigir falhas que impeçam os critérios de aceite antes de aprovar o MVP.
4. Entrega: apresentar o resultado concreto e a validação HML; solicitar autorização para promoção a PROD somente após essas evidências.
