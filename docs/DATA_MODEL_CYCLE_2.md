# Contratos de dados — ciclo 2

Este documento cobre as features em escopo desta rodada. Features 8 (capa) e 17 (desafio semanal) estão adiadas integralmente: nenhum campo, upload, coleção, tela ou teste delas faz parte desta entrega. Nenhuma regra será publicada; mudanças nas regras locais exigem testes no emulador antes de considerar HML apto.

## Alterações entregues para a base visual

`users/{uid}.theme?: 'light' | 'dark' | 'system'`. Campo opcional mantém perfis antigos compatíveis. `AuthService.updateTheme(theme)` valida o enum, escreve apenas no perfil autenticado e atualiza o signal local depois de confirmar a gravação. Preferência ausente significa `system`. As regras locais existentes permitem update do próprio perfil, mas a allowlist validada deve incluir esse enum antes de publicar regras.

## Contratos previstos por feature

| Feature | Persistência / leitura | Segurança e observações |
|---|---|---|
| 1 Onboarding | `users/{uid}`: `onboardingCompleted:boolean`, `favoriteCategories:Category[]` | Escrita pelo dono; atualização idempotente. Não marque concluído se o usuário pulou antes da conclusão explícita. Entry e fila usam serviços existentes. |
| 2 Busca global | Sem nova coleção; cache em memória de entries próprias e fila | Fazer carga uma vez por sessão e invalidar após escritas; não anunciar resultados completos enquanto carregamento/paginação estiver incompleto. Sem consultas a amigos. |
| 3 Registro rápido | Reutiliza `entries` e `saveEntry` | Não duplicar validações nem gravação. Respeitar categoria, nota e autoria. |
| 4 Swipe fila | `users/{uid}/queue/{item}` existente | Desfazer remoção exige preservar snapshot local e restaurar apenas se a operação não criar duplicata. Evitar excluir outro item por posição desatualizada. |
| 5 Linha do tempo | `entries` paginadas por `authorId`, `createdAt`, `__name__` | Reusar índice authorId+createdAt existente; não carregar todo histórico para uma tela paginada. |
| 6 Animação | Sem persistência | `prefers-reduced-motion` desativa partículas e movimento. Feedback não deve depender de animação para anunciar sucesso. |
| 7 Tema escuro | `users/{uid}.theme` acima | Respeitar `system` via `matchMedia`; persistência só após login. Fallback local antes de autenticação não pode sobrescrever preferência do usuário. |
| 9 Transição rota | Sem persistência | Selecionar direção sem bloquear navegação; desativar slide com `prefers-reduced-motion`. |
| 10 Skeleton | Sem persistência | Skeleton substitui o conteúdo visual durante carga; manter `aria-busy` e estado textual acessível. |
| 11 Listas | `lists/{listId}`: `ownerUid,title,description,category,items,isPublic,createdAt,updatedAt` | Dono escreve; acesso público somente quando `isPublic=true`; item máximo 50, descrição até 280, listas gratuitas até 10. Consultas públicas por ID não precisam índice composto. Rules devem validar owner e limites. Sem capa enquanto F8 estiver adiada. |
| 12 Reações | `entries/{entryId}/reactions/{uid}`: `emoji,reactedAt` | UID do documento deve ser o autenticado; autor não pode reagir à própria entry; emoji em allowlist; leitura pública herda política pública de entries. Contagem via consulta da subcoleção, sem agregação privilegiada. |
| 13 Compatibilidade | Dados de entries próprias e públicas já carregadas | Nenhuma gravação. Calcular com dados disponíveis; explicitar quando perfil está paginado para não apresentar score como completo. Normalizar título sem confundir categoria. |
| 14 Consumindo agora | `users/{uid}.nowWatching?: {title,category,since,expiresAt} | null` | Somente dono altera; leitor calcula expiração no cliente. Concluir limpa o status e cria entry atomicamente somente se os caminhos puderem caber em transação; caso contrário, tratar falha sem perder dados. Não usar Cloud Functions. |
| 15 Exportar diário | HTML gerado em memória a partir de paginação completa de entries | Sem Storage/PDF e sem conteúdo externo embutido. Escapar HTML contra XSS e tratar notas com spoiler explicitamente. `isPremium` é apenas flag de apresentação; não implementar cobrança. |
| 16 Push | `users/{uid}.notificationPreferences` e token FCM opcional | Contradiz limites sem Functions para disparo/agenda confiável. Esta rodada deve implementar apenas consentimento/token/preferências; nunca prometer notificações de eventos nem agendamento local persistente garantido. Rules devem restringir escrita ao dono. |
| 18 Reengajamento | Usa `lastActivityDate` e fila existentes | Card calculado localmente e suprimido por sessão. Não mexer no streak retroativo. |
| 19 Ranking | Entries próprias e do feed já carregadas | Não há query adicional; top 5 é relativo aos dados carregados. Streak mensal histórico exato depende do ledger `activityDays` já existente. Evitar expor métricas privadas ou comparar períodos parciais como totais. |
| 20 Memória compartilhada | `sharedMemories/{memoryId}` com `participants`, obra e metadata; mensagens em subcoleção para permitir limite/paginação | Recomenda-se subcoleção `messages/{messageId}`, não array ilimitado no documento. Participantes imutáveis; dois UIDs distintos; leitura/escrita apenas aos participantes; mensagem 500 chars, máximo 100; spoiler oculto no cliente. Índice `participants array-contains + updatedAt` se houver listagem por usuário. Rules locais devem validar cada transição. |

## Índices

Feature 5 e 15 reutilizam consultas por autor e data já indexadas. Busca e compatibilidade usam memória local. Listas públicas por documento não requerem índice composto. Se listar as próprias listas, `ownerUid ASC + updatedAt DESC + __name__ DESC` é necessário. Reações e mensagens só exigem índices compostos se houver listagem ordenada; declarar no `firestore.indexes.json` junto com as queries efetivas, sem criar índices especulativos.

## Riscos de autorização

As Rules atuais são abertas em algumas superfícies públicas e não validam novos documentos. Antes de integração autenticada HML, adicionar e testar regras para `lists`, `reactions`, `sharedMemories`, mensagens e campos de perfil. Validar que o cliente não consegue alterar dono, participantes, preferências de terceiros ou publicar lista em nome alheio. Nunca publicar rules como parte deste ciclo sem aprovação explícita.
