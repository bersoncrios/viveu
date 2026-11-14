# Viveu — ciclo de engajamento, descoberta e identidade

## Ordem e critérios comuns

Ordem de entrega: **10 → 1 e 4 → 3 → 5 e 9 → 6 e 7 → 2 → 8**. Cada lote exige testes locais, build HML e revisão dos critérios abaixo antes do próximo. PROD permanece fora deste ciclo. Nenhuma publicação remota é comprovada por build ou emulador.

Usar componentes standalone, Signals, TypeScript estrito e os serviços AngularFire existentes. Reaproveitar paginação, autenticação, spoiler e estados de erro. Nenhum dado fictício, polling, push, Cloud Function ou cobrança. Todos os controles operam por teclado e têm alvo de 44 px, foco visível e nome acessível. Validar 320, 375, 768, 1024 e 1440 px; somente a faixa dos filtros pode rolar horizontalmente.

## Backlog com histórias e aceite

| Feature | História | Critérios de aceite |
| --- | --- | --- |
| 10 — Categorias | Como pessoa usuária, quero reconhecer cada categoria em qualquer tela. | Configuração central com id, label, icon, color e bgColor; preservar IDs existentes; incluir Outros; usar no seletor, cards, jornadas, filtros e componentes novos; texto AA e identificação além da cor. |
| 1 — Streak | Quero perceber os dias em que cuido do meu diário. | Uma atividade válida por dia local: conclusão, nota salva ou inclusão na fila; várias ações no dia não incrementam; ontem mantém sequência, intervalo maior quebra; contador visível no feed; persistir streakCount e lastActivityDate no perfil; retomada e celebrações 7/30/100 sem repetição a cada render; erro de persistência não vira sucesso. |
| 4 — História | Quero reencontrar experiências de outras épocas. | Consultar entries do autor em janelas ±3 dias de 1 mês, 6 meses e 1 ano atrás; deduplicar sobreposições; mostrar título, categoria, nota, frase e data; respeitar spoilers; abrir jornada; ocultar seção sem resultados; falha oferece nova tentativa sem fingir vazio. |
| 3 — Conquistas | Quero celebrar marcos do meu acervo. | IDs estáveis e desbloqueio irreversível, sem duplicação; primeira obra = 1 conclusão; leitor ávido = 10 conclusões (todas as categorias, conforme pedido); cinéfilo = 5 filmes/séries; primeira companhia = jornada compartilhada concluída; vitrine aberta = visita autenticada de outra pessoa; fila cheia = 5 itens simultâneos; explorador = 3 categorias registradas; persistir badges e exibir no perfil; celebrar somente novos desbloqueios. |
| 5 — Gosto | Quero conhecer o gosto cultural de alguém pelo perfil. | Antes dos registros: top 3 categorias com ícone/cor/contagem; média somente de concluídas com nota; obra de maior nota e desempate mais recente; total e concluídas; cálculos sobre entries públicas já carregadas, sem novas leituras; informar quando resumo cobre apenas registros carregados. |
| 9 — Frase | Quero destacar a frase que mais recentemente guardei. | Logo abaixo do nome: citação mais recente por data de salvamento, obra e categoria; sem frase: “Nenhuma frase registrada ainda”; respeitar spoiler; atualizar ao recarregar/carregar entries e após gravações observadas; não prometer listener em tempo real quando serviço usa leitura pontual. |
| 6 — Filtro | Quero ler o feed por categoria. | Todos, Filmes, Séries, Livros, Jogos, Podcasts e Músicas; filtro local sobre itens carregados; seleção persiste durante sessão; aria-pressed e estado visual; faixa sem quebra em mobile; vazio filtrado distinto do feed sem amigos; paginação continua disponível. |
| 7 — Também quero | Quero guardar uma obra de um amigo sem sair do feed. | Ação imediata por card; comparar título normalizado e categoria com minha fila e registros; bloquear cliques concorrentes; duplicata informa motivo; copiar título/categoria, motivo vazio; sucesso somente depois da escrita; falha permite tentar novamente; autoria guardada pelo serviço existente. |
| 2 — Agora | Quero uma sugestão simples para começar. | Feed mostra fila disponível e estado motivacional quando vazia; categoria mais consumida nos últimos 30 dias orienta próximo item na ordem da fila; sem correspondência usa primeiro; dados locais já carregados; CTA abre nova jornada com título/categoria e queueId; informar falha de carga, sem consultas adicionais para calcular recomendação. |
| 8 — Wrapped | Quero guardar e compartilhar meu mês cultural. | Último lote; rota privada /wrapped/:ano/:mes; menu do próprio perfil abre mês anterior; rejeitar datas inválidas e meses ainda não encerrados; consultar entries do período sem truncamento silencioso; concluídas, categorias, média, melhor obra, última frase e maior streak do mês; PNG via canvas/download e compartilhamento quando suportado; texto alternativo na tela; sem PDF; erros de exportação acionáveis. |

## Especificação visual

Aplicar tokens de [DESIGN.md](DESIGN.md): fundo creme #F6F4ED, superfície #FFFEFA, tinta #213C33, títulos Georgia, corpo system-ui, raio 16 px e escala de espaçamento existente. Sem modo escuro fictício.

| Categoria | Acento decorativo | Fundo | Texto |
| --- | --- | --- | --- |
| Filmes | #E05C5C | #F4DFCF | #213C33 |
| Séries | #7B61FF | #E5DDF0 | #213C33 |
| Livros | #4CAF82 | #E9E7CE | #213C33 |
| Jogos | #FF9F43 | #D9E8DE | #213C33 |
| Podcasts | #54A0FF | #F0DFD8 | #213C33 |
| Músicas | #FF6B9D | #DCE7EC | #213C33 |
| Outros | #A0AEC0 | #ECEFF3 | #213C33 |

Os acentos vivos não são cor de texto essencial em branco/creme; manter texto escuro nos fundos suaves e validar contraste por teste. Ícones decorativos recebem aria-hidden; rótulos sempre visíveis. Preservar ícones existentes quando possível.

Streak: painel compacto no início do feed com número serif e explicação de atividade válida. Sugestão: título de seção, categoria, obra e um CTA, em coluna no mobile. Memórias: cards compactos em grade que vira coluna, com data explícita. Perfil: citação abaixo do nome, resumo em cards com quebra natural e conquistas em lista legível. Filtros: pills com borda e aria-pressed, sem depender só da cor. +fila: botão secundário pequeno com nome acessível incluindo obra, fora do link do card. Wrapped: composição creme/floresta, título serif, mês explícito, contagens com rótulos e citação; exportação com texto quebrado e altura suficiente para títulos longos.

Celebração/retomada: dialog nativo acessível ou equivalente com foco inicial, Escape, contenção do foco e retorno ao acionador; botão explícito de fechar. Sem confetes contínuos; respeitar prefers-reduced-motion.

## Microtextos aprovados para implementação

- Streak: “Seu diário ganhou ritmo” / “{n} dias seguidos” / “Uma experiência, uma nota ou uma nova obra na fila já conta.”
- Retomada: “Sua estante sentiu sua falta” / “Cada volta pode começar uma boa história.” / “Vamos continuar”.
- Marcos: “7 dias de boas histórias”, “Um mês guardando o que ficou”, “100 dias de encontros culturais” / “Continuar”.
- Conquistas: “Uma nova conquista na sua história” / “Primeira obra — Seu primeiro final guardado.” / “Leitor ávido — Dez experiências para lembrar.” / “Cinéfilo — Cinco histórias vividas na tela.” / “Primeira companhia — Uma história concluída juntos.” / “Vitrine aberta — Alguém conheceu seu acervo.” / “Fila cheia — Cinco possibilidades para o próximo capítulo.” / “Explorador — Seu diário já passou por três categorias.”
- Memórias: “Neste dia…” / “Um mês atrás você viveu…” / “Seis meses atrás você viveu…” / “Um ano atrás você viveu…”.
- Perfil: “Seu gosto em histórias” / “Categorias favoritas” / “Nota média” / “Obra mais marcante” / “Obras registradas” / “Concluídas” / “Conquistas” / “Nenhuma frase registrada ainda” / “Resumo dos registros carregados”.
- Feed: “Filtrar registros por categoria” / “Nenhum registro desta categoria por aqui. Você pode carregar mais ou escolher outra.”
- +fila: “Adicionar {título} à minha fila” / “Adicionando…” / “Adicionado à sua fila!” / “Essa obra já está na sua fila” / “Você já registrou essa obra” / “Não foi possível adicionar à fila. Tente novamente.”
- Agora: “O que fazer agora?” / “Talvez sua próxima história esteja aqui” / “Começar agora” / “Sua fila está livre — o que vai entrar primeiro?” / “Adicionar à fila”.
- Wrapped: “Seu mês no Viveu” / “{mês} de {ano}” / “Histórias concluídas” / “Maior sequência do mês” / “A frase que ficou” / “Compartilhar” / “Baixar PNG” / “Seu mês ainda está começando a ganhar histórias.” / “Não foi possível gerar a imagem. Tente novamente.”

## Riscos e decisões técnicas a registrar

1. A fila existente usa `users/{uid}/queue/{id}`. O caminho `queue/{uid}/items` do pedido diverge do contrato implementado. Não migrar nem duplicar silenciosamente; backend deve confirmar preservação da base existente.
2. `createdAt` e `updatedAt` não guardam todas as atividades anteriores, e itens removidos da fila apagam sua evidência. Streak máximo mensal e notas históricas exigem histórico de dias de atividade para precisão futura; não inventar dias passados. Backend deve documentar a precisão de reconstrução e eventual campo adicional antes de implementar.
3. Visita não autoriza visitante a editar o perfil de outra pessoa. Vitrine aberta requer evento com autoria autenticada e Rules restritas, processado pelo dono no frontend, ou outra solução autorizada. Não abrir escrita arbitrária em users.
4. Serviços atuais usam leituras paginadas pontuais. Resumos locais do perfil são relativos aos registros carregados; deduplicação de fila/diário e Wrapped completo precisam leituras completas ou consultas específicas, sem confundir amostra com total.
5. Novas categorias, campos de usuário e eventos de visita precisam compatibilidade com Rules locais e dados legados. Publicação de Rules/índices e teste remoto HML são entregas distintas da validação em emulador.

## Revisão final do Product Owner — implementação local

As dez features têm implementação entregue na branch `develop`. A suíte local completa passou **206/206 testes**. Esse resultado aprova o comportamento coberto por testes locais, mas **o aceite final de produto permanece pendente** da validação visual e da integração autenticada em HML. Evidências e roteiro em [ENGAGEMENT_QA.md](ENGAGEMENT_QA.md).

| Feature | Entrega implementada | Situação de aceite |
| --- | --- | --- |
| 10 | CategoryConfig central com sete categorias, cores, fundos, texto e ícones; contraste AA verificado numericamente. | Validação visual nos componentes pendente. |
| 1 | Contador, dias de atividade persistidos, retomada e celebrações de sequência. | Precisão do legado limitada aos eventos inferíveis; persistência real HML pendente. |
| 4 | Consulta de memórias por janelas de datas, cards e navegação para jornada. | Consulta remota e apresentação visual pendentes. |
| 3 | Critérios de sete conquistas, persistência, celebração e seção pública. | Duas contas e permissões reais HML pendentes. |
| 5 | Resumo de gosto com top 3, média, melhor obra, totais e indicação da amostra carregada. | Comportamento local testado; apresentação visual pendente. |
| 9 | Citação mais recentemente salva, origem e placeholder; spoilers excluídos do destaque. | Comportamento local testado; apresentação visual pendente. |
| 6 | Filtro local por categoria, seleção acessível e estado de sessão. | Comportamento local testado; faixa mobile pendente. |
| 7 | Inclusão direta na fila, verificação de duplicatas, confirmação, falha e bloqueio de cliques simultâneos. | Comportamento local testado; gravação real HML pendente. |
| 2 | Sugestão por preferência recente e prioridade da fila, início de jornada e estado vazio. | Cálculo local testado; apresentação visual pendente. |
| 8 | Rota mensal privada, resumo do mês encerrado e compartilhamento/download PNG por canvas. | Cálculos locais testados; exportação e apresentação no navegador pendentes. |

### Limites conhecidos da entrega

- Preservado o caminho existente da fila `users/{uid}/queue/{id}`, sem migração nem duplicação.
- Dias históricos de atividade não podem ser reconstruídos integralmente de timestamps sobrescritos ou itens da fila já removidos. O histórico de dias permite precisão futura; streak legado e máximo mensal antigo são inferências dos dados sobreviventes.
- Visitas autenticadas geram recibo com autoria restrita; a conquista do dono aparece na próxima sincronização do próprio dono. Não há execução em servidor nem atualização imediata do perfil por outro usuário.
- Regras de segurança e contratos foram alterados localmente; **as regras não foram publicadas** neste ciclo. Acesso real depende das permissões atualmente ativas em HML.
- Não houve validação de sessão Google nem leitura/escrita autenticada no Firebase HML real. Testes com mocks e emulador não substituem essa evidência.
- Responsividade e exportação visual aguardam servidor/browser funcionais. Não reutilizar screenshots antigos como aprovação das novas features.
- PROD não foi promovido nem autorizado; qualquer promoção exige aprovação explícita do dono.
