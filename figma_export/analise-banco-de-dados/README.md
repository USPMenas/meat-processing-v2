# Analise pratica da API e do banco de dados

Atualizado em `2026-04-07T11:35:53-03:00`.

Esta pasta consolida o que foi validado na pratica na API `MQTT Measurements API` publicada em `http://143.107.102.8:8090`.
O objetivo aqui e complementar o `PLANEJAMENTO_SPRINTS.md` com comportamento real de producao, fixtures reaproveitaveis e decisoes de design para as proximas sprints.

## Resumo executivo

- Base real da API: `http://143.107.102.8:8090`
- Swagger vivo: `http://143.107.102.8:8090/openapi.json`
- Nao ha autenticacao declarada no OpenAPI
- O Swagger vivo tem um endpoint extra nao mapeado no planejamento atual: `GET /analytics/{channel}/voltage_anomalies`
- O endpoint `GET /backup/download` nao devolve JSON como o OpenAPI sugere; ele devolve um arquivo SQLite real (`application/octet-stream`)
- O backup baixado em `2026-04-07` tinha `376,684,544` bytes e uma unica tabela `measurements`, sem indices
- O banco inteiro tem `4,480,456` linhas
- Canais reais encontrados: `lab`, `mock01`, `mock02`
- Sensores reais encontrados: `fase1`, `fase2`, `fase3`
- O canal que faz sentido para o dashboard e `lab`
- O dado mais recente do canal `lab` e `2026-03-31T11:40:56`
- Portanto, na data da analise (`2026-04-07`), os dados de `lab` estavam aproximadamente `6 dias, 23 horas, 54 minutos e 57 segundos` atrasados
- Chamadas sem `from_time` e `to_time` usam uma janela implicita de 24 horas ate o "agora" da API; como o dado esta atrasado, essas chamadas estao vindo vazias
- O cold start de `3 meses` em `localStorage` nao e viavel: so `1 dia` de bruto do canal `lab` pesa `13.2 MB`; a estimativa para o bruto inteiro de `lab` e de aproximadamente `529.85 MB` em JSON

## Validacao ponta a ponta

### Endpoints que responderam

| Endpoint | Resultado real | Latencia observada | Observacoes |
| --- | --- | ---: | --- |
| `GET /backup/download` | `200` | `~49.7s` | Baixa um SQLite real de `376 MB` |
| `GET /{channel}` com 1 minuto de janela | `200` | `~0.88s` | `36` medicoes, ordenadas por `timestamp` descendente |
| `GET /{channel}/{sensor}` com 1 minuto de janela | `200` | `~0.88s` | `12` medicoes para `fase1` |
| `GET /analytics/{channel}/consumption` com 1 dia | `200` | `~1.07s` | Shape estavel, `3` sensores |
| `GET /analytics/{channel}/demand_peaks` com 1 dia | `200` | `~5.36s` | Mais lento que os demais analytics |
| `GET /analytics/{channel}/electrical_health` com 1 dia | `200` | `~0.92s` | `avg_voltage` e `avg_power_factor` por sensor |
| `GET /analytics/{channel}/hourly_profile` com 7 dias | `200` | `~1.37s` | `72` linhas (`24h x 3 sensores`) |
| `GET /analytics/{channel}/current_by_sensor` com 7 dias | `200` | `~1.10s` | `avg_current` por sensor |
| `GET /analytics/{channel}/voltage_anomalies` com janela historica e limiares customizados | `200` | `~3.35s` | Retorno limitado a `50` resultados |

### Comportamentos reais que divergem do Swagger

1. `GET /backup/download`
   - OpenAPI: `application/json`
   - Real: `application/octet-stream` com `content-disposition: attachment; filename="backup_2026-04-07.db"`

2. Erro de data invalida
   - OpenAPI: sugere `422 Validation Error`
   - Real: retorna `400` com shape simples:
   - `{"detail":"Invalid 'from_time' format. Use ISO format like 2025-11-17T21:17:15"}`

3. Intervalo invertido
   - `from_time > to_time` nao gera erro
   - Real: `200` com `results: []`

4. Canal inexistente
   - Nao retorna `404`
   - Real: `200` com envelope valido e arrays vazios

5. Janela omitida
   - Nao usa o historico inteiro
   - Real: os endpoints usam uma janela implicita de 24 horas ate o horario atual da API
   - Exemplo observado em `GET /lab`: `from = 2026-04-06T11:44:29`, `to = 2026-04-07T11:44:29`, `count = 0`

6. `hourly_profile.hour`
   - No client atual o tipo esta como `number`
   - Real: vem como string zero-padded, por exemplo `"00"`, `"01"`, ..., `"23"`

7. Assinatura de cliente automatizado
   - `curl` respondeu normalmente para os endpoints de dados
   - `Python urllib` com user-agent padrao recebeu `403 Error 1010` do Cloudflare
   - Para scripts de fixture e smoke test, vale usar headers de navegador ou `curl`

### Contratos estaveis recomendados

```ts
export interface ApiMeasurement {
  channel: string;
  sensor: string;
  apparent_power: number;
  active_power: number;
  reactive_power: number;
  power_factor: number;
  current: number;
  voltage: number;
  timestamp: string; // ISO sem timezone, ex.: "2026-03-31T11:40:56"
}

export interface ChannelMeasurementsResponse {
  channel: string;
  from: string;
  to: string;
  count: number;
  measurements: ApiMeasurement[]; // observado em ordem descendente por timestamp
}

export interface SensorMeasurementsResponse extends ChannelMeasurementsResponse {
  sensor: string;
}

export interface ConsumptionResult {
  sensor: string;
  total_kwh: number;
  min_demand_kw: number;
  max_demand_kw: number;
}

export interface DemandPeakResult {
  sensor: string;
  peak_kw: number;
  timestamp: string;
}

export interface ElectricalHealthResult {
  sensor: string;
  avg_voltage: number;
  avg_power_factor: number;
}

export interface HourlyProfileResult {
  hour: string; // "00" .. "23"
  sensor: string;
  avg_power_kw: number;
}

export interface CurrentBySensorResult {
  sensor: string;
  avg_current: number;
}

export interface VoltageAnomalyResult {
  timestamp: string;
  sensor: string;
  voltage: number;
  anomaly_type: "LOW" | "HIGH";
  deviation_pct: number;
}
```

## Mapeamento dos sensores reais

### Recomendacao inicial

- `freezerSensor = "fase3"`
- `equipmentSensors = ["fase1", "fase2"]`

### Justificativa

| Sensor | Media kW | Media 00-05h | Media 08-17h | Razao dia/noite | CV | Leitura pratica |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `fase1` | `8.20` | `5.64` | `11.63` | `2.06x` | `0.75` | Forte cara de carga operacional / equipamentos |
| `fase2` | `4.16` | `3.74` | `4.76` | `1.27x` | `0.66` | Carga auxiliar, com fator de potencia muito baixo |
| `fase3` | `7.95` | `7.62` | `8.42` | `1.10x` | `0.26` | Carga mais estavel 24x7; melhor candidata a "congelador" |

Conclusao:

- `fase3` e a melhor candidata a representar o congelador porque tem o comportamento mais estavel ao longo do dia
- `fase1` e `fase2` devem entrar como "equipamentos" por exibirem maior variacao operacional
- Isso ainda precisa ser configuravel manualmente no app; os nomes `fase1/2/3` nao carregam semantica de negocio

## Qualidade do dado

### Estrutura e cobertura

- Tabela unica: `measurements`
- Colunas: `timestamp`, `channel`, `sensor`, `apparent_power`, `active_power`, `reactive_power`, `power_factor`, `voltage`, `current`
- Linhas totais: `4,480,456`
- Linhas em `lab`: `2,094,616`
- Faixa temporal de `lab`: `2025-12-01T19:20:42` ate `2026-03-31T11:40:56`

### Frequencia e ordenacao

- Cadencia dominante em `lab`: `5s`
- Jitter observado: `4s`, `5s`, `6s`
- Respostas brutas chegam em ordem descendente por `timestamp`
- Dentro do mesmo `timestamp`, a ordem observada foi `fase1`, `fase2`, `fase3`

### Nulos, duplicados e alinhamento entre sensores

- Nulos relevantes observados: `0`
- Duplicados por `(channel, sensor, timestamp)`: `0`
- Timestamps com todos os 3 sensores em `lab`: `697,760`
- Timestamps com apenas 2 sensores: `663`
- Timestamps com apenas 1 sensor: `10`
- O buraco mais frequente e a ausencia de `fase1`

### Buracos de serie

- Dias com dados em `lab`: `43`
- Janela entre primeiro e ultimo dia de `lab`: `2025-12-01` a `2026-03-31`
- Dias ausentes nessa janela: `78`
- Ha dois blocos continuos de dados:
  - `2025-12-01` a `2025-12-27`
  - `2026-03-16` a `2026-03-31`
- Maior gap observado por sensor:
  - de `2025-12-27T16:18:41` ate `2026-03-16T17:09:53`
  - duracao: `6,828,672s`

### Voltage anomalies na pratica

- Com os defaults da API (`198/242`, nominal `220`), o dataset inteiro de `lab` vira anomalia:
  - `2,094,616` registros cairiam como `LOW`
- Com limiares mais compativeis com rede de `127V` (`120/132`, nominal `127`):
  - ainda existem `133,789` leituras anomalas no banco
  - o endpoint retorna apenas as `50` mais recentes

### Timezone e formato de timestamp

- O banco e os payloads usam timestamp ISO sem offset
- Exemplo: `"2026-03-31T11:40:56"`
- No frontend, parsear explicitamente como horario local esperado pela aplicacao; nao assumir `Z`

## Politica de sync e viabilidade de cache

### O plano de 3 meses em localStorage nao fecha

Medidas observadas:

- `GET /lab` com `1 minuto`: `9,664 bytes`
- `GET /lab` com `1 hora`: `572,653 bytes`
- `GET /lab` com `1 dia`: `13,225,830 bytes`

Estimativa:

- `1 dia` bruto de `lab` ja ultrapassa o teto pratico de `localStorage`
- Usando a densidade observada de bytes por medicao, o bruto historico inteiro de `lab` chega a aproximadamente `529.85 MB` em JSON
- Isso e cerca de `106x` um limite pratico de `5 MB`

### Recomendacao pratica

1. Nao usar `localStorage` para bruto historico de 3 meses
2. Se o frontend realmente precisar de historico bruto:
   - migrar para `IndexedDB`
   - ou manter apenas uma janela curta bruta e guardar agregacoes diarias/horarias
3. Para a Sprint 2:
   - usar bruto recente apenas para a tela operacional
   - usar analytics para perfis e consolidacoes
4. Para graficos de `60` pontos em cadence de `5s`, uma janela de `5 minutos` basta
5. Nunca confiar em janela default da API; sempre enviar `from_time` e `to_time`

## Nota tecnica curta de transformacao

### Regras sugeridas

#### Energia do congelador

```ts
freezerEnergyKw = measurementBySensor.fase3.active_power;
```

#### Energia dos equipamentos

```ts
equipmentEnergyKw =
  measurementBySensor.fase1.active_power +
  measurementBySensor.fase2.active_power;
```

#### Temperatura derivada

```ts
const freezerP05 = 5.36;
const freezerP95 = 10.00;
const freezerMean = 7.95;

temperatureC = clamp(
  -18 + ((freezerEnergyKw - freezerMean) / (freezerP95 - freezerP05)) * 2.5,
  -22,
  -14,
);
```

#### Ocupacao derivada

```ts
const equipmentCurrentP10 = 0.0822;
const equipmentCurrentP95 = 0.2673;

occupancyPct = clamp(
  10 + 90 * ((equipmentCurrentA - equipmentCurrentP10) / (equipmentCurrentP95 - equipmentCurrentP10)),
  0,
  100,
);
```

#### Custo energetico

- Se houver `consumption` no intervalo desejado, usar `total_kwh` por sensor
- Se o custo precisar respeitar tarifa horaria, distribuir o `total_kwh` por hora usando pesos do `hourly_profile`
- Nao usar bruto de 3 meses para custo no browser

#### Alertas

Prioridade sugerida:

1. staleness de dados
2. falha de sensores no timestamp atual
3. tensao fora da faixa observada
4. energia fora da faixa esperada
5. ocupacao derivada extrema

## Matriz inicial de thresholds

| Metrica | Fonte | Warning | Critical | Observacao |
| --- | --- | --- | --- | --- |
| Dados sem atualizacao | ultimo `timestamp` global | `> 15 min` | `> 60 min` | Hoje ja estourado; tela deve assumir estado stale/offline |
| Freezer energy (`fase3`) | `active_power` | `< 5.3` ou `> 10.0` kW | `< 5.0` ou `> 17.0` kW | Baseado em `p05/p95/p99` |
| Equipment energy (`fase1 + fase2`) | soma de `active_power` | `> 31.5` kW | `> 42.3` kW | Baixo consumo sozinho nao e bom alerta fora do horario comercial |
| Equipment current | soma de `current` | `> 0.267` A | `> 0.369` A | Melhor base para ocupacao do que corrente total |
| Total current | soma de `current` | `> 0.354` A | `> 0.509` A | Boa metrica secundaria |
| Voltage health | `voltage` | fora de `122 .. 131.5` V | fora de `120 .. 132` V | Os defaults `198/242` da API nao servem para este dataset |
| Power factor | `power_factor` | sensor-specific | sensor-specific | `fase2` tem baseline muito baixo; evitar threshold global |
| Sensor missing | contagem de sensores por timestamp | `< 3 sensores` | gap `> 60s` ou `< 2 sensores` | `fase1` falha mais que as demais |

## Fixtures reais

Os fixtures desta pasta sao gerados pelo script [`scripts/gerar_fixtures.py`](./scripts/gerar_fixtures.py).
Depois de rodar o script, a pasta [`fixtures/`](./fixtures) fica com exemplos reais de:

- envelopes brutos
- envelopes de sensor
- analytics
- respostas vazias por janela default
- erro `400`
- exemplo derivado para `useOperationalData`

## Riscos que afetam diretamente a Sprint 2

Ver checklist dedicado em [`checklist-riscos-sprint-2.md`](./checklist-riscos-sprint-2.md).
