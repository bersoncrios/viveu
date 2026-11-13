# Pesquisa de produto — Viveu

Pesquisa em 13/11/2026. Fontes oficiais dos produtos; avaliações e recomendações abaixo são inferências de produto, não resultados de entrevistas ou testes com usuários.

## Benchmark

| Referência | Capacidades verificadas | Força observada | Limite em relação à proposta Viveu |
| --- | --- | --- | --- |
| [Letterboxd](https://letterboxd.com/faq/) | Diário de filmes, notas, reviews, perfis, seguir pessoas, watchlist e estatísticas anuais para assinantes. | Une memória pessoal, descoberta social e identidade cultural. | O fluxo descrito é centrado em filmes; não resolve um diário unificado das seis categorias. |
| [Goodreads](https://www.goodreads.com/about/us) | Estantes de livros lidos, em leitura e desejados; atividade dos amigos e avaliações. | Organização por intenção e descoberta por pessoas conhecidas. | Foco em livros; Viveu precisa de um registro comum para diferentes mídias. |
| [Trakt](https://developer.trakt.tv/) e [tutorial oficial de watchlist](https://forums.trakt.tv/t/what-is-the-watchlist-what-kind-of-items-should-i-add-to-it/104850) | Histórico audiovisual e watchlist; o item sai da watchlist quando o filme ou primeiro episódio é assistido. | Conecta intenção de assistir e consumo efetivo. | Acompanhamento audiovisual detalhado aumenta a complexidade; episódios e integrações não são necessários ao MVP. |
| [Backloggd](https://backloggd.com/about/) e [apresentação](https://backloggd.com/?lang=en) | Coleção pessoal de jogos, notas, reviews, backlog e listas compartilháveis ou privadas. | Trata a fila e o diário como ferramentas pessoais com dimensão social. | Especializado em jogos, sem histórico cultural entre categorias. |
| [Spotify Wrapped](https://support.spotify.com/al/article/spotify-wrapped/) e [página oficial](https://www.spotify.com/us/wrapped/?app=1) | Retrospectiva anual personalizada e destaques compartilháveis. | Transforma histórico em narrativa pessoal fácil de compartilhar. | Depende do consumo registrado no ecossistema Spotify; não reúne filmes, livros e jogos. |

## Oportunidade e decisões para o PO

1. **Um só diário cultural:** mesma estrutura simples para filmes, séries, livros, jogos, podcasts e músicas. Diferenciação proposta, a validar com uso real; não alegar exclusividade de mercado.
2. **Guardar o que ficou:** frase memorável opcional, junto de nota e título. Evitar exigir review longa.
3. **Fila intencional:** prioridade manual visível, com controles acessíveis de subir e descer; não depender só de arrastar.
4. **Social leve:** seguir pessoas por perfil/identificador e ver seus registros em ordem temporal. Sem likes, comentários, chat ou recomendação algorítmica no MVP.
5. **Base para replay:** registrar data do consumo e categoria desde o início. Replay e cobrança ficam fora das cinco funções iniciais; não exibir como recursos disponíveis.

Critério de sucesso sugerido para validar após HML: usuários conseguem registrar um consumo sem ajuda, reorganizar a fila e abrir o perfil de outra pessoa. Retenção e monetização exigem medição posterior; não há evidência aqui para estimar mercado ou conversão.

## Nome anterior: Vaultlog

**Vaultlog já é utilizado por outro aplicativo.** A listagem [Vaultlog – Trade Journal na Google Play](https://play.google.com/store/apps/details?id=com.gyngergod.vaultlog) descreve um diário de operações financeiras. A [App Store brasileira](https://apps.apple.com/br/app/vaultlog-app/id6801966476) também apresenta esse produto. Isso motivou a troca, apesar de o segmento ser diferente.

A composição “vault” + “log” comunicava arquivo e registro, mas podia sugerir segurança/finanças e exigia explicação para público que não conhece inglês. A decisão atual substitui esse codinome.

## Nome atual: Viveu

O PO escolheu Viveu. Uma busca geral por usos exatos e lojas não revelou um aplicativo cultural conhecido com esse nome. A busca pública do INPI não foi legível nesta triagem, e domínios não foram confirmados; portanto, esta adoção é uma decisão de produto, não uma declaração de disponibilidade jurídica ou de domínio. Consultar [busca oficial do INPI](https://servicos.busca.inpi.gov.br/marcas/) antes de registro ou expansão comercial.

**Recomendação atual:** usar Viveu na interface e identidade do produto; fazer busca formal de marca e domínio antes de investimento de lançamento.

## Encaminhamento

PO: preservar as cinco funções e critérios de simplicidade; nome público escolhido: Viveu. Designer/copywriter: usar linguagem de memória e jornada, com categorias claras e sem prometer replay já funcional. Backend: guardar data do consumo sem criar agregações ou Cloud Functions. A verificação formal de marca e domínio segue pendente antes de investimento de lançamento.
