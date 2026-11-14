# Viveu — evidências de QA do ciclo de engajamento

## Estado atual

Implementação local das dez features na branch `develop`. **206/206 testes locais passaram**, conforme execução da suíte completa pelo Orquestrador. O Product Owner mantém **aceite final pendente**: faltam validação visual dos novos componentes e integração autenticada no Firebase HML real. Nenhuma promoção para PROD.

| Verificação | Resultado |
| --- | --- |
| Suíte local `tests/*.test.mjs` | 206 aprovados, nenhuma falha. |
| Firestore Emulator `tests/emulator/*.test.mjs` | 34/34 aprovados, incluindo recibos de visita, atividade privada e validação de campos. Projeto demo isolado. |
| `tests/discovery.test.mjs` | 11/11: resumo vazio/legado, média de concluídas, top 3, desempate, frase sem spoiler, recomendação, normalização e contraste AA. |
| `tests/feed-discovery.test.mjs` | 8/8: duplicatas por título/categoria, categoria distinta, sucesso confirmado, falha/retry, falha de leitura, cliques concorrentes e filtro de sessão. |
| Build otimizado HML | Aprovado fora do sandbox, Node 22; repetição da correção final do PNG em execução. |
| Compilação Angular HML (serve) | Bundle gerado sem erros; rotas novas incluídas. |
| TypeScript e templates (`ngc --noEmit`) | Aprovado com Node 22.12.0. |
| Sintaxe (`check:source`) | 33 arquivos TS e 16 templates analisados, zero erros. |
| Contraste das categorias | Texto/fundo das sete categorias atende razão mínima 4,5:1, calculada em teste. |
| Navegador responsivo | 66 capturas atuais em seis larguras (320–1440px), sem overflow das páginas. Chips mantêm rolagem própria esperada. |
| PNG do Wrapped | Validação de imagem final no navegador pendente. |
| Firebase HML real | Sessão Google, permissões e leitura/escrita autenticada pendentes. |
| Regras/índices remotos | Não publicados neste ciclo; não inferir disponibilidade remota dos arquivos locais. |

Resultados de build e emulador devem ser registrados separadamente pelo responsável após sua execução; não estão comprovados por esta contagem de testes locais.

## Comandos reproduzíveis com Node 22

O `node` padrão desta máquina pode apontar para Node 20, que não fornece o WebSocket global usado pelo harness. Usar Node 22.12.0 explicitamente:

```sh
PATH=/Users/bersons/.nvm/versions/node/v22.12.0/bin:$PATH npm test
PATH=/Users/bersons/.nvm/versions/node/v22.12.0/bin:$PATH npm run build:hml
/Users/bersons/.nvm/versions/node/v22.12.0/bin/node --test tests/discovery.test.mjs tests/feed-discovery.test.mjs
PATH=/Users/bersons/.nvm/versions/node/v22.12.0/bin:$PATH npm start -- --port 4211 --host 127.0.0.1
```

Com servidor HML disponível e Chrome descartável com CDP na porta 9337:

```sh
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --headless --remote-debugging-port=9337 --user-data-dir=/tmp/viveu-engagement-browser --no-first-run --no-default-browser-check about:blank
/Users/bersons/.nvm/versions/node/v22.12.0/bin/node scripts/qa-responsive.mjs
```

O harness não precisa de Playwright. Substitui os serviços por fixtures em memória, bloqueia mutações de dados e não realiza login nem gravações no Firebase. Cobre 320, 360, 390, 768, 1024 e 1440 px, incluindo feed com streak/sugestão/memórias/filtro, perfil enriquecido e Wrapped. Produz screenshots e `test-results/responsive/report.json`. Arquivos de execução anterior não comprovam o estado atual: conferir timestamp, conteúdo novo e execução concluída sem falhas.

## Aceite visual e funcional pendente

1. Rodar harness completo e verificar ausência de overflow na página; rolagem horizontal é permitida somente na faixa de categorias. Inspecionar screenshots 320/768/1440.
2. Conferir legibilidade, categorias, estado selecionado, foco e ações nas novas seções; testar dialog por teclado, Escape e retorno do foco.
3. Gerar PNG do Wrapped com título e frase longos, inclusive palavras sem espaços; conferir fundo, quebras, conteúdo completo, download e compartilhamento suportado.
4. Em `vaultlog-hml`, com duas contas de teste, criar/concluir registro, salvar nota e adicionar à fila; confirmar atualização de streak/badges após recarregar, sem perda do conteúdo em falhas.
5. Visitar perfil da outra conta; confirmar recibo permitido, impossibilidade de editar o perfil alheio e desbloqueio de Vitrine aberta na próxima sincronização do dono.
6. Conferir memórias em três janelas e Wrapped de mês encerrado, incluindo paginação, timezone local e dias de atividade históricos disponíveis.
7. Validar regressão dos fluxos existentes e registrar resultados observados antes de solicitar aceite final do Product Owner.

## Limitações que permanecem explícitas

Streak de dados legados e máximo mensal antigo são inferidos de timestamps disponíveis; eventos apagados ou sobrescritos não podem ser recuperados. Visitas não atualizam imediatamente o perfil do dono. Resumo de gosto usa as entries públicas carregadas. Rules locais não garantem permissões remotas. Nenhum desses limites deve ser apresentado como validação remota concluída.
