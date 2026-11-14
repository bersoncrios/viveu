# Viveu — especificações de UX e microcopy do ciclo 2

Base: design editorial acolhedor de `DESIGN.md`, tipografia Georgia + system-ui, controles de 44px, texto essencial ≥12px, foco visível e paleta por tokens. Todos os layouts suportam 320–1440px e estado de movimento reduzido. Não usar upload; F8 fica adiada. F17 fica adiada.

| Feature | Especificação e estados | Microcopy |
|---|---|---|
| 1 Onboarding | Dialog/página em passos, progresso nomeado, até 3 categorias, criação opcional e pular a partir do passo 3. Salvar rascunhos entre passos; encerrar só após conclusão explícita. | “Boas-vindas ao Viveu”; “O que você gosta de viver?”; “Registre algo que acabou de consumir”; “O que vem depois?”; “Seu diário cultural começa agora”; “Pular por agora”; “Continuar”; “Concluir”. |
| 2 Busca | Ação de busca no cabeçalho; painel com campo focável, grupos separados, lista por teclado, Escape e clique externo fecham e devolvem foco. Só mostrar dados locais carregados. | “Buscar no meu acervo”; “Digite ao menos 2 caracteres”; “Seus registros”; “Sua fila”; “Nenhuma história encontrada”; “Buscar”. |
| 3 Registro rápido | FAB acima da navegação mobile, bottom sheet com foco contido, teclado e fechar por Escape/toque fora; esconder conforme rotas especificadas. | “Registrar”; “Título”; “Categoria”; “Nota”; “Frase (opcional)”; “Salvar”; “Cancelar”; “Registrado com sucesso!”. |
| 4 Swipe fila | Setas/ações de toque continuam disponíveis; swipe é atalho, fundo sinaliza ação e threshold 30%. Desfazer via snackbar por 4s; sem depender do gesto. Hint uma vez, dispensável. | “Deslize para começar”; “Deslize para remover”; “Item removido da fila.”; “Desfazer”. |
| 5 Linha do tempo | Toggle Lista/Linha do tempo; agrupamento mês/ano, datas e entrada acessíveis; paginação real de 25 e carregamento anunciado. | “Lista”; “Linha do tempo”; “Carregar mais histórias”; “Novembro de 2026”. |
| 6 Animação registro | Brilho curto junto ao CTA e cartão entra com fade/slide até 600ms; criação somente. Com reduced motion, remover movimento e manter confirmação textual. | “Registro salvo. Mais uma história para guardar.” |
| 7 Tema escuro | Tokens CSS para canvas, superfície, texto, borda, ações, estados, sombras; creme em base quente escura. Tema sistema inicial; controle persistido no perfil; foco, erro e categorias contrastados AA. | “Tema”; “Seguir sistema”; “Claro”; “Escuro”. |
| 8 Capa externa — ADIADA | Não implementar nesta rodada. Sem upload ou armazenamento de imagem. | — |
| 9 Transições | Fade de 200ms entre rotas; direção leve em jornada; reduced motion elimina slide. Não atrasar foco nem interação. | Sem texto novo. |
| 10 Skeleton | Componente reutilizável espelha card/capa real, 3 itens (máximo 5), aria-busy e rótulo status; reduced motion usa bloco estático. | “Carregando registros…”; “Preparando sua fila…”; “Carregando seu mês…”. |
| 11 Listas | Perfil com listas públicas/privadas; criação, adicionar busca/manual, contagem 10 listas e 50 itens; URL pública só se isPublic. Vazio e erro distintos. | “Minhas listas”; “Criar lista”; “Título da lista”; “Descrição (opcional)”; “Pública”; “Privada”; “Copiar link”; “Lista criada.”; “Esta lista ainda não tem obras.” |
| 12 Reações | Barra abaixo do card; 4 botões com nome textual e contagem; estado selecionado anunciado; ocultar ação no próprio registro; toggle remove. | “Quero ver, ler ou jogar”; “Que surpresa!”; “Adorei essa escolha”; “Boa recomendação”; “Remover reação”. |
| 13 Compatibilidade | Cartão compacto no perfil alheio apenas com sessão; porcentagem sempre acompanhada de contagem e explicação; sem resultado enganoso com dados parciais. | “Seu gosto cultural”; “{x}% de afinidade”; “{y} obras em comum · {z} categorias compartilhadas”; “Uma descoberta curiosa”; “Afinidade cultural”; “Almas gêmeas culturais”. |
| 14 Consumindo agora | Um status ativo no perfil próprio e feed de seguidores; data e expiração clara; remover manualmente e concluir cria entry após confirmação. | “Estou consumindo agora”; “O que você está vivendo?”; “Compartilhar por 7 dias”; “Parar de compartilhar”; “Concluir e registrar”. |
| 15 Exportação | Ação em perfil/configuração; preview/aviso antes de baixar HTML auto-contido imprimível. Exportar notas com texto original e sinalização de spoilers, não depender de imagem/rede. Gate preparado sem bloquear. | “Exportar meu diário”; “Seu diário está pronto para baixar.”; “Gerado pelo Viveu em {data}”; “Preparando arquivo…”. |
| 16 Push | Opt-in só depois do onboarding. Negativa não dispara nova permissão; preferências editáveis. Explicar que eventos remotos não são enviados no MVP sem backend. | “Ativar notificações”; “Você escolhe quais avisos receber”; “Permissão negada. Você pode mudar isso nas configurações do navegador.” |
| 17 Desafio semanal — ADIADO | Não implementar nesta rodada. | — |
| 18 Retorno à fila | Card no topo, uma vez por sessão; item e tempo sem atividade em texto neutro. “Depois” dispensa. Sem culpa ou streak coercitivo. | “Bem-vindo de volta”; “Faz {x} dias que {título} espera por você.”; “Começar agora”; “Depois”; “Sua fila está livre. Que tal adicionar uma história?”. |
| 19 Ranking | Top 5 separado por métrica, mês em destaque, pessoa logada identificada por texto; empate explícito; sem competição negativa. | “Entre amigos”; “Mais histórias”; “Maior sequência”; “Mais categorias”; “Siga amigos para ver o ranking”; “Você está em 1º lugar”. |
| 20 Memória compartilhada | Convite contextual após coincidência; espaço privado só a dois; ordenação temporal, spoiler oculto individualmente e ações de aceitar/recusar acessíveis. | “{nome} também registrou {título}”; “Criar uma memória compartilhada?”; “Aceitar convite”; “Agora não”; “Mensagem (até 500 caracteres)”; “Mostrar spoiler”; “Ocultar spoiler”. |

## Regras comuns

- Categorias sempre exibem nome e ícone além da cor; validar contraste WCAG AA nos dois temas.
- Sheet/dialog mantém foco, Escape, restaura foco ao acionador e não se fecha por engano ao interagir no conteúdo.
- Texto de erro preserva entradas; feedback de sucesso só depois da gravação confirmada.
- Deslizar, cor, animação e shimmer nunca são os únicos meios de executar ou compreender uma ação.
- Skeleton e transição respeitam `prefers-reduced-motion`; toast com `aria-live` e tempo suficiente para leitura.
