# Viveu — UX/UI do MVP

## Direção visual

Um diário cultural editorial, acolhedor e contemporâneo. Fundo creme, páginas claras e verde floresta dão sensação de acervo pessoal; coral marca ações secundárias e pequenos destaques. Sem promessas de replay ou assinatura na interface. Marca provisória durante HML.

## Tokens

| Token | Valor | Uso |
| --- | --- | --- |
| canvas | `#F6F4ED` | Fundo geral |
| surface | `#FFFEFA` | Cards e formulários |
| ink | `#213C33` | Texto principal e títulos |
| muted | `#626B62` | Texto auxiliar |
| primary | `#234C3B` | CTA principal e navegação ativa |
| primary-soft | `#E6ECE3` | Seleção e áreas de apoio |
| coral | `#A94732` | Destaques e ações de atenção |
| border | `#D9DED3` | Separadores e campos |
| error | `#A02E32` | Erros com texto e ícone |

Títulos: Georgia, serif (sem download obrigatório), peso normal, 36–48 px no desktop e 30–36 px no mobile. Texto e controles: system-ui, sans-serif; base 16 px, line-height 1.5, labels 14 px. Microlegendas em maiúsculas, 12 px com tracking discreto. Não usar texto essencial abaixo de 12 px.

Espaçamento: escala 4, 8, 12, 16, 24, 32, 48 e 64 px. Cards com raio 16 px e borda de 1 px; campos 10 px; botão principal 10 px. Sombras mínimas. Botões de altura mínima 44 px. Conteúdo de leitura até 760 px; área total até 1440 px.

## Componentes

- Logo Viveu em SVG: símbolo de livro aberto com brilho, acompanhado de wordmark para cabeçalho e versão compacta como favicon.
- Sidebar desktop de 232 px: marca, Feed, Meu diário, Minha fila, Meu perfil; ação “Registrar consumo”; sessão e sair no rodapé.
- Navegação ativa com fundo verde claro, texto floresta e indicador além da cor. Mobile: cabeçalho compacto e navegação inferior com rótulos; reservar espaço no conteúdo para não cobri-lo.
- Botão principal verde com texto creme; secundário contornado; destrutivo coral com rótulo explícito. Foco visível de 3 px, offset 3 px.
- Card de registro: avatar/inicial e nome do autor linkável, data, categoria, título serif 24 px, estrelas com texto “4 de 5”, frase em bloco com aspas; editar/excluir apenas no diário do autor.
- Campo com label persistente, instrução e erro associado. Contador em bio/frase. Categoria como select ou grupo de radios; nota com radios de 1 a 5, não somente estrelas clicáveis.
- Ícones de traço 20 px, decorativos com aria-hidden; ações de ícone isolado recebem nome acessível. Não usar emoji como único identificador.

Categorias usam texto e cor de apoio suave: Filmes `#F4DFCF`; Séries `#E5DDF0`; Livros `#E9E7CE`; Jogos `#D9E8DE`; Podcasts `#F0DFD8`; Músicas `#DCE7EC`. Texto permanece `#213C33`.

## Arquitetura e rotas

`/entrar` pública; `/feed`, `/diario`, `/fila`, `/registrar` e edição exigem sessão; `/perfil/:uid` pública. Visitante em rota privada retorna ao login com destino preservado. Meu perfil abre a URL pública do usuário autenticado. Não criar páginas de pricing, replay, catálogo ou descoberta fora do escopo.

## Telas e fluxos

### Login

Desktop em duas colunas: bloco editorial verde com tagline e composição tipográfica das seis categorias; painel claro com marca, título, explicação e botão Google. Mobile em coluna única. Abaixo do CTA, explicar que nome, bio e registros são públicos. Estado de autenticação mostra progresso no botão; cancelamento mantém a página e exibe orientação discreta; erro apresenta tentar novamente.

### Home / Feed

Cabeçalho “Seu círculo cultural”, texto curto e CTA registrar. Abaixo, opção de adicionar amigo por UID ou URL de perfil; apresentar campo de UID explícito, com validação. Coluna principal com registros recentes de pessoas seguidas; lateral opcional com convite para organizar fila, sem métricas fictícias. Paginação por “Carregar mais”. Sem amigos: instrução e CTA focando campo de UID. Amigos sem registros: mensagem distinta. Erro com “Tentar novamente”. Nunca preencher estado vazio com consumo fictício.

### Meu diário

Cabeçalho “O que ficou com você”, CTA “Registrar consumo”. Lista cronológica com categoria, nota, frase e data. Filtros de categorias somente se realmente implementados; não apresentar controle decorativo. Cards próprios oferecem “Editar” e “Excluir”. Exclusão exige confirmação com título do registro e botões cancelar/excluir. Diário vazio oferece primeiro registro.

### Registro / edição

Página central de até 680 px. Título obrigatório (160), categoria obrigatória, nota 1–5 obrigatória e frase opcional (500). Instrução de visibilidade antes do envio. Botões “Salvar registro” e “Cancelar”. Erros inline e resumo no início após tentativa; mover foco ao primeiro erro. Durante envio, botão desabilitado com “Salvando…”. Não limpar campos se houver falha. Origem fila pré-preenche título/categoria e só remove item após gravação bem-sucedida. Edição usa “Salvar alterações”.

### Minha fila

Título “Seu próximo capítulo”, texto explicando prioridade. Formulário compacto de título/categoria e botão “Adicionar à fila”. Lista numerada com posição evidente, categoria, título e ações subir, descer, registrar e remover. Cada ação de ordem inclui nome do item no rótulo acessível. Primeiro/último controles desabilitados; estado de atualização evita cliques concorrentes. Feedback em aria-live após reordenação. Remoção pede confirmação. Fila vazia oferece o formulário. Fila não aparece no perfil público.

### Perfil público

Cabeçalho com avatar Google quando disponível (fallback inicial), nome serif e bio. Não exibir e-mail. Ação “Compartilhar perfil”; outro usuário autenticado vê seguir/deixar de seguir; visitante vê entrar para acompanhar. Lista pública de registros cronológicos e botão carregar mais. Dono vê “Editar perfil” com nome 2–60 e bio até 240, sem mudar URL UID. Compartilhamento copia URL; falha mostra input readonly selecionável com URL completa. Perfil inexistente, carregando e erro são estados diferentes. Sem registros apresenta texto neutro, sem CTA privado para visitantes.

## Responsividade e acessibilidade

Desktop a partir de 1024 px com sidebar e conteúdo; entre 768–1023 px sidebar compacta ou nav superior; abaixo de 768 px navegação inferior, cards em coluna e ações quebradas em linhas. Margens laterais 20 px no mobile, 40 px no desktop. Não permitir overflow horizontal a 320 px. Inputs com 16 px para evitar zoom indesejado. Respeitar prefers-reduced-motion; transições opcionais de até 150 ms.

Usar landmarks, um h1 por tela, link pular para conteúdo, links para navegação e buttons para ações. Labels visíveis, estados com texto, mensagens aria-live e contraste WCAG AA. A ordem do foco segue leitura. Dialogs devem manter foco, fechar por Escape e devolver foco ao acionador; alternativa simples: confirmação inline acessível. Skeleton sem shimmer obrigatório; texto “Carregando…” acessível. Não depender apenas de hover, cor ou drag-and-drop.

## Validação de entrega ao frontend

Implementar todos os estados vazios/erro/loading, sem placeholders que pareçam dados reais. Referenciar textos de COPY.md. Não incluir configurações de ambiente no fluxo do usuário final. Design aprovado para as cinco histórias do backlog, sem acréscimo de escopo.
