# Registro de entrega — Viveu

**Data:** 13/11/2026  
**Branch de desenvolvimento:** `develop`  
**Entrega integrada em produção:** `main` em `2638bec`

## Funcionalidades concluídas

Foram implementadas e integradas as Features **1–7, 9–15 e 18–20** do ciclo de produto:

- Onboarding, busca global, registro rápido e ações por gesto na fila.
- Linha do tempo do perfil, animações de registro, tema escuro, transições e skeleton loading.
- Perfil com capa por URL externa, listas temáticas, reações, compatibilidade cultural e status de consumo atual.
- Exportação do diário cultural em HTML, desafios de retenção, ranking entre amigos e memórias compartilhadas.
- Identidade visual de categorias, streak, conquistas, Wrapped e os demais recursos já existentes descritos no backlog.
- Busca global reposicionada no menu e foto do Google exibida no avatar da navegação lateral, com fallback para inicial.

## Itens adiados

- **Feature 8 — Capa por URL externa:** não implementada neste ciclo, conforme orientação anterior.
- **Feature 16 — Notificações web/push:** adiada para um ciclo futuro, conforme orientação mais recente.
- **Feature 17 — Desafio semanal:** não implementada neste ciclo, conforme orientação anterior.

## Validação

- Suíte local: **231 testes passaram**, sem falhas.
- Build HML: concluído com sucesso, inclusive após a alteração do avatar lateral.
- Regras do Firestore foram mantidas no repositório e validadas no Emulator; **não foram publicadas no Firebase**.
- Não foi executado build de PROD manualmente. O commit de aplicação foi enviado à `main`, branch conectada ao deploy automático da Vercel.

## Histórico Git da entrega

- `905a260` — `feat: complete Viveu engagement and discovery features`
- `2638bec` — `feat: show Google photo in sidebar profile`
- `2638bec` foi fast-forward de `develop` para `main`; as duas branches apontam para esse commit.
