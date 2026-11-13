# Viveu — relatório de QA

## Jornada compartilhada — validação local final — 13/11/2026

- `npm test`: **170 passaram, 0 falharam**. Inclui fluxos e estados de rascunho, convites, mural, privacidade, spoilers, arquivamento e limites.
- Firestore Emulator isolado (`demo-vaultlog-shared`): **31 testes passaram, 0 falharam**. Inclui o SDK Firebase real e três fluxos de serviço; projetos remotos não são usados.
- `npm run build:hml`: compilação Angular completa passou. Ambiente usou Node v23.4.0, fora da faixa LTS declarada, e mostrou apenas o aviso correspondente.
- Chrome responsivo: 60 capturas/medições cobrindo criação, grupo ativo e convite, nas larguras 320, 360, 390, 768, 1024 e 1440px, sem overflow horizontal. Fluxos internos usaram fixtures em memória e gravações bloqueadas.
- Aceite real HML ainda pendente. As regras e índices não foram implantados, e a flag administrativa não foi habilitada; seguir `docs/SHARED_JOURNEYS.md` antes de testar com contas reais.

## Home, login e mobile — evidência de navegador

- `npm test`: **90 testes passaram**; inclui rotas públicas, atualização do shell, destino após login, prevenção de envio duplo e recuperação de falha.
- `npm run build:hml`: passou ao executar fora do sandbox. `ngc`, análise de templates e CSS passaram.
- `scripts/qa-responsive.mjs` conectou um Chrome de teste via CDP, verificou home/login e cinco telas internas (formulário, feed, diário, fila e perfil) em 320/360/390/768/1024/1440px. **42 medições/capturas sem overflow horizontal** após carregar a configuração de estilos atualizada.
- CTA da home navegou ao login e voltou, sem menu do app nessas páginas; o link de pular conteúdo moveu o foco ao `main` via teclado. O teste não clicou em Google nem gravou dados.
- Fixtures das páginas internas foram aplicadas no navegador, com todos os métodos de escrita do serviço bloqueados. As medições são de layout, não evidência de autenticação, permissões ou persistência real.
- Artefatos locais ignorados: `test-results/responsive/report.json` e PNGs. Para reproduzir: servidor Angular em `http://127.0.0.1:4211` com a configuração atual, Chrome descartável com depuração em `localhost:9337`, depois `node scripts/qa-responsive.mjs`. O script depende das ferramentas de debug Angular do modo de desenvolvimento.
- Continuam pendentes os testes em aparelhos reais com teclado virtual, safe area iOS e integração Google/Firestore HML. Servidores de desenvolvimento antigos precisam de reinício para reconhecer a nova entrada `src/responsive.css` do `angular.json`.

## Jornadas — evidência local e roteiro HML

Última execução: **83 testes locais passaram**, além de `ngc` e análise de sintaxe/templates. Cobrem lógica real transpilada com fronteiras simuladas; navegador e Firebase real continuam pendentes. Antes do teste HML, publicar o índice de jornadas e aguardar o estado pronto.

1. Adicionar obra à fila com motivo, iniciar e salvar sem nota. Recarregar: fila removida, experiência em andamento e motivo preservado. Falha de escrita deve preservar o item.
2. Alterar para pausado, preencher onde parou e salvar. Conferir o painel no feed/diário, retomar e acrescentar notas. Concluir exige nota, mostra o motivo e permite reflexão. Verificar datas após reabrir e concluir novamente.
3. Criar notas com e sem spoiler, salvar com um texto ainda no campo de nova nota, recarregar e conferir. Cartões ocultam cada spoiler de forma independente e mantêm a reflexão com seu próprio controle.
4. Usar “Viver novamente” em experiência concluída. Guardar nova jornada: nota/reflexão/notas anteriores não são copiadas; o registro antigo continua intacto. Origem inexistente/alheia deve ser rejeitada.
5. Abrir a mesma experiência em duas sessões, salvar na primeira e tentar na segunda. A segunda mantém o texto e informa conflito, sem sobrescrever. Reabrir depois de preservar o rascunho e reconciliar manualmente.
6. Editar legado sem campos de jornada: status concluído, avaliação/citação preservadas. Verificar 100 notas, limites 500/160/1.000 e teste de teclado/360px. Motivo/retomada/notas são públicos; não devem ser apresentados como privados.
7. Simular índice pendente e permissão negada no painel: mostrar erro com nova tentativa. Confirmar que falha do painel não impede usar diário, feed ou formulário.

## Busca de amigos por nome — roteiro adicional

- Buscar pelo início de um nome já cadastrado, inclusive perfil antigo, usando minúsculas, iniciais maiúsculas e maiúsculas; preservar acentos. Confirmar resultados com nome/bio e abrir o perfil correto entre homônimos.
- Nome com menos de 2 ou mais de 60 caracteres não dispara consulta. A própria pessoa não aparece nos resultados. Confirmar paginação com mais de 20 perfis, sem duplicações, e lista de acompanhados com nomes.
- Mudar o texto enquanto uma busca está pendente: resultados da busca anterior não reaparecem. Simular erro e tentar novamente. Validar teclado, anúncio dos resultados e layout em 360px.
- Esses cenários de integração/navegador ainda aguardam execução real; os 36 testes locais não substituem o aceite HML.

## Evolução de experiências — roteiro adicional

- Criar uma experiência com reflexão de múltiplas linhas, até três sentimentos, citação e aviso de spoiler. Recarregar e editar: todos os campos devem persistir; a data de criação permanece igual.
- Conferir o diário, feed e perfil público: reflexão/citação marcadas não aparecem antes de “Ler mesmo assim”; título/nota/sentimentos continuam visíveis. “Ocultar spoilers” esconde novamente. Outro cartão começa oculto.
- Editar um registro antigo: sua frase continua no campo de citação, a reflexão começa vazia e os sentimentos desmarcados. Salvar sem novos campos mantém a citação.
- Selecionar três sentimentos: os demais ficam indisponíveis; desmarcar um libera outra seleção. Validar teclado, foco, contagem e bloqueio durante salvamento.
- Em erro de gravação, manter os campos preenchidos e o item da fila. Em sucesso a partir da fila, remover o item na mesma transação.
- Validar perguntas por categoria, campos opcionais e reflexão até 3.000 caracteres. Em 360px, verificar que as escolhas quebram linha sem rolagem horizontal.
- Conferir logo existente no lugar do antigo asterisco lateral, no cabeçalho móvel e no login.

Esses cenários de navegador/HML precisam de execução real; os testes locais não representam aceite remoto.

## Resultado atual

**MVP não aprovado para promoção a PROD.** A verificação disponível é estática e de contratos executados em Node; não comprova compilação Angular, funcionamento visual nem integração Firebase HML.

`node --test tests/contracts.test.mjs`: **6 testes passaram, 0 falharam**. Os testes exercitam a seleção real de branches e o guard com sessão pendente, além de inspecionar invariantes dos arquivos de ambientes, rotas e índice. A avaliação isolada do guard/rotas remove apenas imports e anotações TypeScript; não substitui teste Angular do router.

Cobertura verificada:

- Build padrão e desenvolvimento permanecem HML; PROD exige configuração explícita.
- IDs, domínios, buckets, sender IDs e app IDs pertencem ao projeto correto em cada arquivo.
- Somente nomes exatos `main`/`master` selecionam build PROD; branches desconhecidas e ausência de branch usam HML.
- Perfil público não usa guard; diário, feed, fila e formulários privados usam guard e lazy loading.
- Guard espera restauração da sessão, libera usuário autenticado e preserva URL de retorno para visitante.
- Índice composto suporta ordem determinística por data e ID; Vercel aponta ao diretório Angular browser e possui fallback SPA.

## Limites de execução

Instalação de dependências sem rede e ausência de AngularFire no cache impedem build e integração real neste ambiente, conforme diagnóstico do orquestrador. Não foi realizado login Google, leitura/gravação em Firestore, aplicação remota de índices, deploy ou teste em navegador. Nenhum dado PROD foi alterado.

Atualização da revisão final: o orquestrador executou análise de sintaxe de **18 arquivos TypeScript e 9 templates Angular**, sem erro de sintaxe. A tentativa de compilação `ngc` falhou por módulos AngularFire ausentes e tipos implícitos derivados dessas importações indisponíveis. Isso não equivale a compilação Angular aprovada; ainda falta validar resolução de dependências, tipos e templates com a toolchain completa.

O contrato de dados informa que provedor Google, domínios autorizados e índice HML ainda não foram confirmados. Configuração pública Firebase não concede acesso administrativo para concluir essa preparação.

## Revisão estática e correções a acompanhar

| Item | Resultado / ação |
| --- | --- |
| Persistência de perfil | Criação transacional preserva perfil existente; é necessário testar login concorrente em HML. |
| Registro a partir da fila | Transação grava registro e remove fila atomicamente, evitando perda entre duas escritas separadas. |
| Paginação | Cursor usa snapshot e desempate por ID; validar conjunto com datas iguais em HML. |
| Limite de amigos | Serviço limita a 30 e retorna erro explícito para legado maior, sem truncar silenciosamente. Concorrência pode exceder o limite por ser verificação no cliente. |
| Atualização da fila após inclusão | Corrigido no código: escrita e releitura têm tratamento separado; falha após confirmação mostra inclusão concluída e oferece atualizar a lista. A mesma distinção foi aplicada à reordenação. Aguarda teste HML. |
| Falha de criação/leitura de perfil | Correção inspecionada: shell apresenta `auth.error()` e botão `retryProfile()`. Recuperação real ainda deve ser testada em HML. |
| Perfil/feed finais | Páginas inspecionadas: perfil público sem leitura da fila; clipboard com fallback; paginação deduplica por ID; feed usa somente vínculos da conta. São evidências estáticas, sem execução do fluxo. |
| Navegação durante mutação do perfil | Corrigido no código: `saveProfile()` e `toggleFollow()` capturam revisão e UID, e descartam resultados locais quando a rota muda. A operação mantém seu alvo original. Aguarda teste HML de navegação durante escrita. |
| Escrita confirmada e navegação | Formulário de registro distingue salvar de navegar e impede reenvio após confirmação. Edição de perfil atualiza o signal após escrita sem uma releitura que possa transformar sucesso em erro. |
| Confirmações e sessão mobile | Confirmações inline recebem foco e devolvem ao cancelar; shell oferece logout também no celular. Parser validou sintaxe, mas interação por teclado e layout precisam de navegador. |
| Controle de acesso | Guards e verificações de autoria protegem navegação/fluxo cliente. Sem Rules novas, não comprovam privacidade de fila ou impossibilidade de escrita direta; permissões existentes precisam ser conhecidas. |

## Roteiro de aceite HML obrigatório

Executar exclusivamente com projeto `vaultlog-hml`, usando duas contas de teste. Registrar resultado observado e evidência para cada caso; até execução, todos abaixo estão **pendentes**.

| Caso | Procedimento e resultado esperado |
| --- | --- |
| HML-01 Sessão | Login Google, recarregar, abrir rota privada, sair e voltar pelo histórico. Sessão persiste até logout; visitante é redirecionado e nunca vê dados privados remanescentes. |
| HML-02 Perfil | Primeiro acesso cria documento, editar nome/bio, sair/entrar. Edições permanecem; nome vazio/1/61 caracteres e bio 241 são rejeitados. |
| HML-03 Registro | Criar cada categoria com notas 1 e 5 e frase opcional; editar/recarregar/excluir. Dados persistem, criação não muda na edição e exclusão pede confirmação. |
| HML-04 Validação | Título só espaços e 161 caracteres, categoria inválida, nota 0/6/fracionária e frase 501 são rejeitados. Erro de escrita mantém conteúdo. |
| HML-05 Fila | Adicionar 3 itens, subir/descer, recarregar e remover. Ordem permanece; extremos têm controles desabilitados. Testar duas sessões alterando posições. |
| HML-06 Conclusão | Iniciar registro pela fila, cancelar, depois salvar. Cancelar preserva fila; salvar remove item e cria registro em uma única transação. Falha não perde item. |
| HML-07 Público | Abrir URL direta em janela sem sessão e recarregar. Perfil e registros aparecem; e-mail e fila não aparecem. UID inexistente tem estado próprio; testar copiar link com clipboard negado. |
| HML-08 Social | Conta A segue B por UID/perfil, tenta seguir a si mesma e duplicar vínculo. Feed contém apenas B; deixar de seguir esvazia feed quando não há outros amigos. |
| HML-09 Paginação | Criar mais de 20 registros, alguns com mesma data. Carregar todas as páginas sem duplicações/omissões em conjunto estável. Testar 30 vínculos e bloqueio claro do 31º. |
| HML-10 Falhas | Simular offline, popup cancelado/bloqueado, índice indisponível e permissão negada. Mensagem é clara; nenhuma confirmação falsa nem fallback de dados fictícios. |
| HML-11 Acessibilidade | Percorrer por teclado, conferir foco, labels, radios de nota, ordenação da fila, confirmação de exclusão e erros anunciados. |
| HML-12 Responsividade | Conferir 360px e desktop: sem rolagem horizontal, texto legível e ações acessíveis. |

Após corrigir os achados, compilar HML, executar o roteiro real e registrar evidências, o Product Owner poderá avaliar aprovação. Promoção e deploy PROD continuam sujeitos à autorização explícita do usuário.
