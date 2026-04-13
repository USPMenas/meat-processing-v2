# Diagnostico do Sync Hibrido

## O que mudou
- O frontend deixou de depender diretamente da API externa.
- A aplicacao agora fala com um servico same-origin:
  - `GET /internal/bootstrap/lab`
  - `GET /internal/recent/lab`
  - `GET /internal/history/lab?days=7|30`
- O boot usa um snapshot de backup como baseline e depois tenta sobrepor apenas o topo recente da serie.

## Causa raiz do problema anterior
- O client HTTP antigo guardava `window.fetch` e depois chamava isso como metodo, o que podia disparar `Failed to execute 'fetch' on 'Window': Illegal invocation`.
- O runtime same-origin estava montando `from_time` e `to_time` a partir de `toISOString()` sem timezone, o que empurrava as consultas para frente em relacao ao horario local e fazia a janela "agora" parecer vazia.
- A estrategia antiga falhava quando a janela "agora" vinha vazia, mesmo havendo dado recente em outro horario do mesmo dia.
- O deploy browser-direto para a API externa tambem ficava exposto a CORS, HTTP puro e variacoes do host externo.

## Comportamento novo
- O boot carrega o snapshot empacotado imediatamente.
- Em seguida, o servidor tenta renovar o snapshot via `backup/download`.
- Se a renovacao falhar:
  - usa o ultimo snapshot bom salvo em `.runtime-cache`
  - se ele nao existir, usa o snapshot empacotado
- Depois de 60s, o polling comeca a consultar apenas dado recente.
- Se `[now-30m, now]` vier vazio, o servico faz busca retroativa nas ultimas 72h.
- Quando encontra um bloco util, hidrata `[anchor-30m, anchor]` e faz overlay local.
- `7d` e `30d` agora usam um endpoint diario dedicado com `1` ponto por dia.
- Se faltar dado em um dia:
  - usa o dado real da API
  - se nao houver e existirem dois dias anteriores resolvidos, usa a media deles
  - se isso ainda nao for possivel, cai para o valor do snapshot
- O bootstrap agora devolve metadados de diagnostico:
  - `refreshAttemptedAt`
  - `refreshFinishedAt`
  - `refreshDurationMs`
  - `refreshError`
  - `snapshotAgeHours`
  - `isSnapshotFreshEnough`

## Contrato interno novo
- `MeasurementDataSource = 'backup' | 'api' | 'hybrid'`
- `BootstrapResponse`
  - `snapshot`
  - `snapshotStatus`
  - `snapshotGeneratedAt`
  - `snapshotSource`
  - `latestMeasurementAt`
  - `refreshAttemptedAt`
  - `refreshFinishedAt`
  - `refreshDurationMs`
  - `refreshError`
  - `snapshotAgeHours`
  - `isSnapshotFreshEnough`
- `RecentResponse`
  - `measurements`
  - `anchorAt`
  - `checkedAt`
  - `probeWindow`
  - `source`
  - `message`
- `HistoryResponse`
  - `days`
  - `resolution`
  - `checkedAt`
  - `samples`
  - `message`

## Regras da UI
- `backup`
  - tela utilizavel
  - API nao deve ser tratada como erro fatal se existir snapshot
- `hybrid`
  - tela utilizavel
  - baseline historico veio do backup
  - topo recente veio da API
- `api`
  - dados recentes vieram integralmente da camada de sync

## Buracos observados na serie real
- `2026-04-07`: vazio
- `2026-04-08`: vazio
- `2026-04-09`: dados a partir de `18:57:07`
- `2026-04-10`: dados recentes reais encontrados durante a validacao

## Validacoes feitas na implementacao
- `npm run build`: OK em `2026-04-10`
- `npm test`: OK em `2026-04-10`
- smoke test same-origin:
  - `GET /`: `200`
  - `GET /internal/recent/lab?probe=0`: `200`
- `GET /internal/recent/lab?probe=1`: `200`
- smoke test atualizado em porta isolada:
  - `GET /internal/recent/lab?probe=1`: `source = recent_window`
  - `anchorAt = 2026-04-10T16:13:55`
  - `measurements = 1074`
  - `GET /internal/history/lab?days=7`: `7` samples, `2` dias com dado real
  - `GET /internal/bootstrap/lab`: ainda voltou `snapshotStatus = bundled`
  - `refreshError = This operation was aborted`
  - `snapshotAgeHours = 245.89`
  - isso confirma que o runtime de historico e recente esta funcionando, mas a renovacao do backup ainda depende de resolver o gargalo do download/geracao

## Arquivos-chave
- `server/index.mjs`
- `server/runtime-service.mjs`
- `scripts/generate_backup_snapshot.py`
- `src/services/api/client.ts`
- `src/services/cache/syncStrategy.ts`
- `src/hooks/useCacheSync.ts`
- `src/app/components/dashboard/DataSourceBanner.tsx`

## Risco remanescente
- `GET /internal/bootstrap/lab` baixa o backup completo no startup do servidor. Isso resolve confiabilidade, mas continua sendo a parte mais pesada do fluxo.
- Se o backup remoto ficar muito grande ou lento, o proximo passo natural e adicionar renovacao assicrona, cache por idade e telemetria simples do tempo de refresh.
