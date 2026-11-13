# Viveu — identidade verbal e microtextos

## Voz

Calma, curiosa e próxima. Falar com “você”, em português brasileiro, com frases curtas e concretas. Celebrar memória cultural sem competição, culpa pela fila ou pressão por produtividade. Não chamar o produto de cofre seguro e não prometer retrospectiva ainda indisponível.

Tagline: **Guarde o que ficou com você.**

Pitch: **Seu diário de filmes, séries, livros, jogos, podcasts e músicas, com uma fila para o que vem depois.**

## Navegação

Feed · Meu diário · Minha fila · Meu perfil · Registrar consumo · Sair

## Login

- Título: “Toda história deixa alguma coisa.”
- Apoio: “Registre o que você consome, guarde suas frases favoritas e acompanhe a jornada cultural dos amigos.”
- CTA: “Continuar com Google”
- Progresso: “Entrando…”
- Visibilidade: “Seu nome, sua bio e seus registros ficam no perfil público. Sua fila fica fora do perfil.”
- Cancelado: “A entrada foi cancelada. Você pode tentar novamente quando quiser.”
- Erro: “Não foi possível entrar agora. Tente novamente.”

## Feed

- Título: “Seu círculo cultural”
- Apoio: “Descubra o que ficou com quem você acompanha.”
- Adicionar: “Encontre um amigo”
- Label: “Identificador do perfil”
- Campo: “Nome do amigo”. Botão: “Buscar amigos”.
- Instrução: “Digite pelo menos 2 letras do início do nome público. Use os acentos do nome.”
- Resultados: “Escolha um perfil para conhecer e acompanhar.”
- CTA: “Ver perfil”
- Vazio sem amigos: “Boas histórias ficam melhores em companhia.” / “Abra o perfil de um amigo para começar a acompanhar seus registros.”
- Vazio com amigos: “Seu círculo ainda está começando.” / “Os novos registros de quem você acompanha vão aparecer aqui.”
- Paginação: “Carregar mais” / “Carregando…” / “Você chegou ao fim dos registros.”
- Erro: “Não foi possível carregar o feed.” / “Tentar novamente”

## Diário e registros

- Diário: “O que ficou com você”
- Vazio: “Sua história cultural começa aqui.” / “Registre um filme, livro ou qualquer outra experiência que você queira lembrar.”
- CTA vazio: “Fazer meu primeiro registro”
- Novo: “Um novo registro”
- Edição: “Editar registro”
- Campos: “Título”, “Categoria”, “Sua nota”, “Frase memorável (opcional)”
- Placeholder título: “O que você acabou de consumir?”
- Placeholder frase: “Uma frase da obra ou algo que essa experiência deixou em você.”
- Nota: “Escolha uma nota de 1 a 5.”
- Categorias: “Filme”, “Série”, “Livro”, “Jogo”, “Podcast”, “Música”
- Visibilidade: “Este registro ficará visível no seu perfil público.”
- Ações: “Salvar registro”, “Salvar alterações”, “Salvando…”, “Cancelar”, “Editar”, “Excluir”
- Sucesso: “Registro salvo.” / “Alterações salvas.”
- Erro: “Não foi possível salvar. Seu texto continua aqui; tente novamente.”
- Título inválido: “Informe um título com até 160 caracteres.”
- Categoria inválida: “Escolha uma categoria.”
- Nota inválida: “Escolha uma nota inteira de 1 a 5.”
- Frase inválida: “Use até 500 caracteres para a frase.”
- Excluir: “Excluir este registro?” / “O registro de ‘{título}’ será removido.” / “Manter registro” / “Excluir registro”
- Exclusão concluída: “Registro excluído.”
- Falha exclusão: “Não foi possível excluir o registro. Tente novamente.”

## Fila

- Título: “Seu próximo capítulo”
- Apoio: “Organize o que você quer consumir. O primeiro item é sua próxima prioridade.”
- CTA: “Adicionar à fila”
- Progresso: “Adicionando…”
- Vazio: “O próximo favorito pode começar aqui.” / “Adicione um título e escolha o que vem primeiro.”
- Ações: “Subir”, “Descer”, “Registrar consumo”, “Remover”
- Rótulos acessíveis: “Subir {título}”, “Descer {título}”
- Ordem salva: “Ordem da fila atualizada.”
- Falha ordem: “Não foi possível alterar a ordem. Tente novamente.”
- Remover: “Remover ‘{título}’ da fila?” / “Manter na fila” / “Remover da fila”
- Conversão parcial: “Seu registro foi salvo, mas o item continua na fila. Tente removê-lo novamente.”
- Falha leitura: “Não foi possível carregar sua fila.”

## Perfil e amigos

- Ações: “Compartilhar perfil”, “Editar perfil”, “Seguir”, “Deixar de seguir”, “Entrar para acompanhar”
- Labels: “Nome público”, “Bio (opcional)”
- Nome inválido: “Use entre 2 e 60 caracteres no nome.”
- Bio inválida: “Use até 240 caracteres na bio.”
- Sucesso edição: “Perfil atualizado.”
- Erro edição: “Não foi possível salvar seu perfil. Tente novamente.”
- Link copiado: “Link do perfil copiado.”
- Fallback clipboard: “Copie o link abaixo para compartilhar seu perfil.”
- Sem bio: não preencher com bio fictícia.
- Sem registros: “Esta história ainda está começando.” / “Os registros deste perfil vão aparecer aqui.”
- Inexistente: “Não encontramos este perfil.” / “Confira o link e tente novamente.”
- Falha leitura: “Não foi possível carregar este perfil.”
- Seguiu: “Você está acompanhando {nome}.”
- Deixou: “Você deixou de acompanhar {nome}.”
- Erro vínculo: “Não foi possível atualizar quem você acompanha. Tente novamente.”

## Estados globais

“Carregando…” · “Tentar novamente” · “Voltar ao feed” · “Confira os campos destacados.”

Erros nunca devem ser exibidos como sucesso. Manter mensagem técnica no diagnóstico de desenvolvimento, e texto acionável na interface. Não dizer “Tudo certo” antes de o Firestore confirmar uma gravação.
