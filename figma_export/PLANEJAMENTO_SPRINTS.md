# Planejamento de Sprints — Frigorífico PWA Dashboard

## Visão Geral do Projeto

**Objetivo:** Transformar um frontend mockado de dashboard de frigorífico em uma aplicação PWA funcional conectada a uma API real de medições elétricas (MQTT Measurements API), com dados cacheados em localStorage e atualização incremental.

**Stack:** React 18 + Vite + TypeScript + Tailwind CSS 4 + Recharts + shadcn/ui + React Router 7

**Telas existentes (3):**
1. **Operacional** (`/`) — Monitoramento em tempo real: energia congelador, energia equipamentos, temperatura, ocupação, alertas
2. **Logística** (`/logistics`) — Planejamento: consumo médio 24h, pico ocupação, tarifas, horário ideal
3. **Negócios** (`/business`) — Indicadores financeiros: faturamento, projeções, custos energéticos, margens

---

## Mapeamento da API (MQTT Measurements API v0.1.0)

### Endpoints Disponíveis

| Endpoint | Método | Descrição | Params |
|----------|--------|-----------|--------|
| `/backup/download` | GET | Download do SQLite completo | — |
| `/measurements` | POST | Criar medição | body: channel, sensor, apparent_power, active_power, reactive_power, power_factor, current, voltage, timestamp |
| `/{channel}` | GET | Medições de um canal | channel (path), from_time, to_time (query) |
| `/{channel}/{sensor}` | GET | Medições de um sensor específico | channel, sensor (path), from_time, to_time (query) |
| `/analytics/{channel}/consumption` | GET | Consumo total em kWh por sensor | channel (path), from_time, to_time |
| `/analytics/{channel}/demand_peaks` | GET | Picos de demanda por sensor | channel (path), from_time, to_time |
| `/analytics/{channel}/electrical_health` | GET | Saúde elétrica (avg voltage, power factor) | channel (path), from_time, to_time |
| `/analytics/{channel}/hourly_profile` | GET | Perfil horário de consumo | channel (path), from_time, to_time |
| `/analytics/{channel}/current_by_sensor` | GET | Corrente média por sensor | channel (path), from_time, to_time |

### Modelo de Dados de uma Medição
```json
{
  "channel": "string",
  "sensor": "string",
  "apparent_power": 0,
  "active_power": 0,
  "reactive_power": 0,
  "power_factor": 0,
  "current": 0,
  "voltage": 0,
  "timestamp": "string"
}
```

---

## Estratégia de Cache e Resiliência da API

### Princípio: "Cold Start + Delta Incremental"

1. **Primeira execução:** Baixar dados dos últimos 3 meses e armazenar em localStorage
2. **Execuções subsequentes:** Buscar apenas dados novos desde o último timestamp salvo
3. **Polling conservador:** Máximo 1 requisição por minuto, apenas quando o usuário está na tela (Page Visibility API)
4. **Fallback:** Se a API estiver fora, usar dados do cache com indicador visual de "dados offline"

### Estrutura do localStorage
```
frigorifico_cache_measurements_{channel}  → { lastSync: ISO, data: [...] }
frigorifico_cache_analytics_{type}        → { lastSync: ISO, data: {...} }
frigorifico_cache_version                 → "1.0"
```

---

## Racional de Transformação: Dados da API → Dados do Dashboard

A API fornece dados elétricos de um laboratório. Precisamos mapeá-los para o contexto de um frigorífico:

| Dado no Dashboard | Fonte na API | Transformação |
|---|---|---|
| **Energia Congelador (kW)** | `active_power` do sensor mapeado como "congelador" | Direto — usar `active_power` do sensor escolhido |
| **Energia Equipamentos (kW)** | `active_power` dos demais sensores | Soma dos `active_power` dos sensores restantes |
| **Temperatura (°C)** | Não existe na API | Derivar: `baseTemp + (active_power - avgPower) * fator` — simula correlação entre consumo e temperatura interna |
| **Ocupação (%)** | Não existe na API | Derivar: `basePct + (current - avgCurrent) / maxCurrent * 100` — corrente maior sugere mais carga/atividade |
| **Custo Energético (R$)** | `/analytics/{ch}/consumption` → `total_kwh` | `total_kwh * tarifa_por_faixa_horaria` (tabela de tarifas configurável) |
| **Faturamento (R$)** | Derivado de consumo | `total_kwh * fator_receita_por_kwh` — simula que energia processada gera receita proporcional |
| **Margem Operacional (%)** | Cálculo | `(faturamento - custo_energia) / faturamento * 100` |
| **Preços de Energia** | Não existe na API | Tabela estática configurável (ponta, intermediário, fora-ponta) |
| **Previsão/Projeção** | `/analytics/{ch}/hourly_profile` | Extrapolar tendência dos dados históricos |
| **Picos de Demanda** | `/analytics/{ch}/demand_peaks` | Direto |
| **Saúde Elétrica** | `/analytics/{ch}/electrical_health` | Direto — `avg_voltage`, `avg_power_factor` |
| **Alertas** | Todos os dados acima | Regras de threshold configuráveis |

---

## Sprints

### Sprint 0 — Fundação e Infraestrutura
**Objetivo:** Preparar o projeto para receber código de produção. Configurar testes, linting, estrutura de pastas, PWA, e a camada de serviços.

### Sprint 1 — Camada de Dados: API Client + Cache + Transformações
**Objetivo:** Criar toda a camada de acesso a dados: client HTTP, sistema de cache com localStorage, polling inteligente, e funções de transformação dos dados da API para o modelo do dashboard.

### Sprint 2 — Tela Operacional (Conexão com Dados Reais)
**Objetivo:** Substituir os dados mockados da tela Operacional por dados reais transformados, com atualização em tempo real e sistema de alertas funcional.

### Sprint 3 — Tela Logística (Conexão com Dados Reais)
**Objetivo:** Conectar a tela de Logística com dados reais — perfil horário, previsão de ocupação, tarifas, e análise de consumo vs ocupação.

### Sprint 4 — Tela Negócios (Conexão com Dados Reais)
**Objetivo:** Conectar a tela de Negócios com dados reais — faturamento derivado, custos energéticos, projeções mensais, margens, e insights executivos.

### Sprint 5 — PWA, Polish e Entrega Final
**Objetivo:** Configurar Service Worker, manifest, responsividade mobile-first final, testes E2E, e preparar para apresentação.

---

## Sprint 0 — Fundação e Infraestrutura

### Entregáveis
1. Estrutura de pastas reorganizada seguindo separação de camadas
2. Configuração de testes (Vitest + Testing Library)
3. ESLint + Prettier configurados
4. Tipos TypeScript globais (`types/`)
5. Estrutura base do Service Worker (PWA)
6. Componente de fallback offline

### Estrutura de Pastas Alvo
```
src/
├── app/
│   ├── components/        # Componentes visuais (já existentes)
│   │   ├── dashboard/
│   │   ├── layout/
│   │   └── ui/
│   ├── pages/             # Páginas (já existentes)
│   ├── routes.tsx
│   └── App.tsx
├── services/              # NOVO: Camada de acesso à API
│   ├── api/
│   │   ├── client.ts      # HTTP client com retry e error handling
│   │   ├── endpoints.ts   # Definição dos endpoints
│   │   └── types.ts       # Tipos de request/response da API
│   ├── cache/
│   │   ├── cacheManager.ts    # Gerenciamento de localStorage
│   │   └── syncStrategy.ts    # Cold start + delta incremental
│   └── polling/
│       └── pollingManager.ts  # Controle de polling com Page Visibility
├── domain/                # NOVO: Lógica de negócio / transformações
│   ├── transformers/
│   │   ├── energyTransformer.ts
│   │   ├── temperatureTransformer.ts
│   │   ├── occupancyTransformer.ts
│   │   ├── financialTransformer.ts
│   │   └── alertTransformer.ts
│   ├── constants/
│   │   ├── tariffs.ts         # Tabela de tarifas
│   │   └── thresholds.ts      # Limiares de alertas
│   └── types.ts               # Tipos do domínio (DashboardData, etc.)
├── hooks/                 # NOVO: React hooks customizados
│   ├── useRealtimeData.ts
│   ├── useHistoricalData.ts
│   ├── useCacheSync.ts
│   └── usePageVisibility.ts
├── config/                # NOVO: Configurações
│   └── api.ts             # Base URL, timeouts, etc.
├── styles/
└── __tests__/             # NOVO: Testes
    ├── services/
    ├── domain/
    ├── hooks/
    └── integration/
```

---

## Sprint 1 — Camada de Dados

### Entregáveis
1. `ApiClient` — HTTP client com retry, timeout, error handling
2. `CacheManager` — CRUD no localStorage com versionamento
3. `SyncStrategy` — Cold start (3 meses) + delta incremental
4. `PollingManager` — Polling com Page Visibility API
5. Todos os `Transformers` — Conversão API → domínio do dashboard
6. Constantes de tarifas e thresholds
7. Hooks React para consumir os dados
8. Testes unitários para cada módulo (cobertura > 80%)
9. Testes de integração API Client ↔ Cache ↔ Transformers

### Detalhamento Técnico

#### ApiClient
- Base URL configurável
- Timeout de 10s
- Retry com backoff exponencial (3 tentativas)
- Interceptor para logging de erros
- Método genérico `get<T>(endpoint, params): Promise<T>`

#### CacheManager
- `get(key)`, `set(key, data, ttl)`, `clear(key)`, `clearAll()`
- Versionamento: se `cache_version` mudar, limpa tudo
- Controle de tamanho: se localStorage > 4MB, limpar dados mais antigos
- Serialização/deserialização com tratamento de erro

#### SyncStrategy
- `initializeCache(channel)`: busca 3 meses, salva em cache
- `syncDelta(channel)`: busca desde `lastSync` até agora
- `getLastSyncTimestamp(channel)`: lê do cache
- Merge inteligente: dados novos complementam, não substituem

#### Transformers (cada um é uma função pura testável)
- `transformToFreezerEnergy(measurements, sensorMap)` → kW
- `transformToEquipmentEnergy(measurements, sensorMap)` → kW
- `deriveTemperature(activePower, avgPower, config)` → °C
- `deriveOccupancy(current, avgCurrent, maxCurrent)` → %
- `calculateEnergyCost(totalKwh, tariffTable, hour)` → R$
- `calculateRevenue(totalKwh, revenueFactorPerKwh)` → R$
- `calculateMargin(revenue, cost)` → %
- `checkAlerts(currentData, thresholds)` → Alert[]

---

## Sprint 2 — Tela Operacional

### Entregáveis
1. Hook `useOperationalData()` que retorna dados em tempo real transformados
2. Substituição de `mockData.ts` por dados reais na tela Operacional
3. Alertas baseados em thresholds reais
4. Indicador de "dados ao vivo" vs "dados em cache"
5. Loading states e error states nos cards
6. Testes unitários do hook
7. Teste de integração: dados da API → tela renderizada corretamente

### Dados necessários nesta tela
| Componente | Dado | Fonte |
|---|---|---|
| Card "Energia Congelador" | `freezerEnergy` (kW) | `active_power` do sensor "congelador" |
| Card "Energia Equipamentos" | `equipmentEnergy` (kW) | Soma `active_power` dos outros sensores |
| Card "Temperatura" | `temperature` (°C) | Derivada de `active_power` |
| Card "Ocupação" | `occupancy` (%) | Derivada de `current` |
| Gráfico "Consumo Total" | Série temporal | Últimos 60 pontos do cache |
| Gráfico "Energia vs Temperatura" | Dual series | Mesmos dados, 2 transformações |
| AlertBanner | Alertas ativos | `checkAlerts()` sobre dados atuais |

---

## Sprint 3 — Tela Logística

### Entregáveis
1. Hook `useLogisticsData()` que retorna dados de planejamento transformados
2. Substituição dos mocks na tela Logística por dados reais
3. Tabela de tarifas funcional (estática mas configurável)
4. Cálculo de "janelas ótimas" baseado no perfil horário real
5. Loading/error states
6. Testes unitários e de integração

### Dados necessários nesta tela
| Componente | Dado | Fonte |
|---|---|---|
| Card "Consumo Médio 24h" | `avgEnergy` (kW) | Média de `active_power` das últimas 24h do cache |
| Card "Pico de Ocupação" | `peakOccupancy` (%) | Máximo da ocupação derivada nas 24h |
| Card "Horas Tarifa Baixa" | `lowEnergyHours` (h) | Contagem de horas fora-ponta na tabela |
| Card "Próximo Horário Ideal" | `nextIdealHour` | Cruzamento perfil horário × tarifa |
| Gráfico "Ocupação vs Tarifa" | Forecast 24h | `hourly_profile` × tabela de tarifas |
| Gráfico "Consumo vs Ocupação" | Dual series | `hourly_profile` transformado |
| Insights | Textos derivados | Lógica sobre os dados acima |

---

## Sprint 4 — Tela Negócios

### Entregáveis
1. Hook `useBusinessData()` que retorna indicadores financeiros transformados
2. Substituição dos mocks na tela Negócios por dados reais
3. Cálculos de projeção mensal baseados em dados reais acumulados
4. Comparação mensal com dados do cache (3 meses)
5. Loading/error states
6. Testes unitários e de integração

### Dados necessários nesta tela
| Componente | Dado | Fonte |
|---|---|---|
| Card "Faturamento Atual" | `currentRevenue` (R$) | `total_kwh` × `revenuePerKwh` do mês |
| Card "Projeção Mensal" | `projectedRevenue` (R$) | Extrapolação linear do acumulado |
| Card "Custo Energético" | `energyCost` (R$) | `total_kwh` × tarifa média ponderada |
| Card "Margem Operacional" | `margin` (%) | `(revenue - cost) / revenue` |
| Gráfico "Custo Diário 30 dias" | Série diária | Agregação diária do cache (3 meses) |
| Gráfico "Consumo vs Ocupação" | Dual horário | `hourly_profile` + derivação |
| Comparação 5 meses | Barras mensais | Agregação mensal do cache |
| Insights Executivos | Textos | Lógica de tendência sobre dados |

---

## Sprint 5 — PWA, Polish e Entrega

### Entregáveis
1. `manifest.json` completo com ícones
2. Service Worker com cache de assets estáticos
3. Revisão de responsividade mobile-first em todas as telas
4. Indicadores de status: online/offline, última atualização
5. Testes E2E com Playwright (fluxo completo: abrir app → ver dados → navegar entre telas)
6. Otimização de bundle (lazy loading de rotas)
7. Documentação final do projeto

---

# PROMPTS PARA CADA SPRINT

Abaixo estão os prompts completos para enviar a uma LLM. Cada prompt é auto-contido e inclui todo o contexto necessário, critérios de aceite, e definição de pronto.

---

## PROMPT — Sprint 0: Fundação e Infraestrutura

```
CONTEXTO DO PROJETO:
Estou construindo um PWA (Progressive Web App) de dashboard para monitoramento de um frigorífico.
O projeto já possui um frontend mockado feito com React 18 + Vite + TypeScript + Tailwind CSS 4 + Recharts + shadcn/ui + React Router 7.
O código atual está em `figma_export/` e tem 3 páginas:
- OperationalDashboard.tsx (/)
- LogisticsDashboard.tsx (/logistics)
- BusinessDashboard.tsx (/business)

Todos os dados vêm de `utils/mockData.ts` com funções que geram dados aleatórios.

TAREFA:
Reorganizar o projeto para receber código de produção, configurando toda a infraestrutura necessária.

ENTREGAS ESPECÍFICAS:

1. ESTRUTURA DE PASTAS:
   Reorganizar o código de `figma_export/` para a raiz do projeto, criando a seguinte estrutura:
   ```
   src/
   ├── app/                    # Manter o que já existe (components/, pages/, routes.tsx, App.tsx)
   ├── services/               # CRIAR: camada de API
   │   ├── api/
   │   │   ├── client.ts       # Placeholder com TODO
   │   │   ├── endpoints.ts    # Placeholder com TODO
   │   │   └── types.ts        # Tipos de request/response
   │   ├── cache/
   │   │   ├── cacheManager.ts
   │   │   └── syncStrategy.ts
   │   └── polling/
   │       └── pollingManager.ts
   ├── domain/                 # CRIAR: lógica de negócio
   │   ├── transformers/       # Placeholders com TODO
   │   ├── constants/
   │   │   ├── tariffs.ts      # Tabela de tarifas energéticas
   │   │   └── thresholds.ts   # Limiares para alertas
   │   └── types.ts            # Tipos do domínio do dashboard
   ├── hooks/                  # CRIAR: hooks customizados
   │   └── usePageVisibility.ts
   ├── config/
   │   └── api.ts              # Base URL, timeouts
   └── styles/                 # Manter existente
   ```

2. CONFIGURAÇÃO DE TESTES:
   - Instalar e configurar Vitest + @testing-library/react + @testing-library/jest-dom
   - Criar `vitest.config.ts` com paths aliases
   - Criar um teste exemplo que roda e passa: testar se o App renderiza sem erro
   - Adicionar scripts no package.json: "test", "test:watch", "test:coverage"

3. TIPOS DO DOMÍNIO (domain/types.ts):
   Definir as interfaces TypeScript para TODO o domínio do dashboard:
   ```typescript
   // Dado cru que vem da API
   interface ApiMeasurement {
     channel: string;
     sensor: string;
     apparent_power: number;
     active_power: number;
     reactive_power: number;
     power_factor: number;
     current: number;
     voltage: number;
     timestamp: string;
   }

   // Dado transformado para o dashboard Operacional
   interface OperationalData {
     freezerEnergy: number;      // kW
     equipmentEnergy: number;    // kW
     temperature: number;        // °C (derivado)
     occupancy: number;          // % (derivado)
     timestamp: Date;
   }

   // Dado transformado para o dashboard de Logística
   interface LogisticsData {
     avgEnergy24h: number;
     peakOccupancy: number;
     lowEnergyHours: number;
     nextIdealHour: number | null;
     hourlyProfile: HourlyProfileEntry[];
     occupancyForecast: OccupancyForecastEntry[];
   }

   // Dado transformado para o dashboard de Negócios
   interface BusinessData {
     currentRevenue: number;
     projectedRevenue: number;
     energyCost: number;
     projectedEnergyCost: number;
     margin: number;
     projectedMargin: number;
     monthlyComparison: MonthlyEntry[];
     dailyData: DailyEntry[];
   }

   // Alertas
   interface Alert {
     type: 'warning' | 'critical' | 'info';
     variable: string;
     message: string;
     value: number;
     expected: number;
   }

   // Cache
   interface CacheEntry<T> {
     lastSync: string;  // ISO timestamp
     data: T;
     version: string;
   }
   ```
   Adicione também: HourlyProfileEntry, OccupancyForecastEntry, MonthlyEntry, DailyEntry, EnergyPrice, TariffConfig, ThresholdConfig.

4. CONSTANTES (domain/constants/):
   - tariffs.ts: Tabela de tarifas em 3 faixas:
     - Fora de ponta (22h-6h): R$ 0,50/kWh
     - Intermediário (6h-18h e 21h-22h): R$ 0,65/kWh
     - Ponta (18h-21h): R$ 0,85/kWh
   - thresholds.ts: Limiares para alertas:
     - Temperatura: alerta se > -16°C (crítico) ou < -20°C (warning)
     - Energia congelador: alerta se > 18kW (warning)
     - Ocupação: alerta se > 85% (info)

5. CONFIGURAÇÃO (config/api.ts):
   - BASE_URL da API (configurável via env var)
   - TIMEOUT: 10000ms
   - RETRY_ATTEMPTS: 3
   - POLLING_INTERVAL: 60000ms (1 minuto)
   - CACHE_VERSION: "1.0"
   - COLD_START_MONTHS: 3
   - Exportar como objeto congelado (Object.freeze)

6. PWA BASE:
   - Criar `public/manifest.json` com nome "Frigorífico Monitor", tema azul, display standalone
   - Adicionar meta tags no index.html para PWA
   - NÃO implementar Service Worker ainda (Sprint 5)

7. LINTING:
   - Se ESLint já estiver configurado, apenas verificar
   - Se não, configurar ESLint + Prettier com regras para React + TypeScript

REGRAS IMPORTANTES:
- NÃO alterar nenhum componente visual existente (components/, pages/)
- NÃO remover o mockData.ts — ele continuará sendo usado até as Sprints 2-4
- Manter o package.json existente, apenas adicionar novas dependências
- Todos os placeholders devem ter comentários TODO claros explicando o que será implementado

DEFINIÇÃO DE PRONTO:
Ao finalizar, execute estas verificações e confirme que TODAS passam:

1. [ ] `npm install` roda sem erros
2. [ ] `npm run build` compila sem erros
3. [ ] `npm run test` executa e o teste exemplo passa
4. [ ] A aplicação roda (`npm run dev`) e as 3 telas continuam funcionando com dados mockados
5. [ ] O arquivo `domain/types.ts` exporta todas as interfaces listadas acima
6. [ ] O arquivo `config/api.ts` exporta todas as constantes
7. [ ] O arquivo `domain/constants/tariffs.ts` tem a tabela de tarifas com as 3 faixas
8. [ ] O arquivo `domain/constants/thresholds.ts` tem os limiares corretos
9. [ ] O `manifest.json` existe e tem os campos obrigatórios
10. [ ] Nenhum componente visual foi alterado

Execute `npm run build` e `npm run test` no final e mostre o output.
Se alguma verificação falhar, corrija antes de considerar pronto.
```

---

## PROMPT — Sprint 1: Camada de Dados (API Client + Cache + Transformações)

```
CONTEXTO DO PROJETO:
Estou construindo um PWA de dashboard para monitoramento de um frigorífico.
O projeto usa React 18 + Vite + TypeScript + Tailwind CSS 4 + Recharts.
Na Sprint 0, configuramos a estrutura de pastas, tipos do domínio, constantes, e testes.

API DISPONÍVEL (MQTT Measurements API v0.1.0):
Base URL: (será configurada em config/api.ts, usar variável de ambiente VITE_API_BASE_URL)

Endpoints:
- GET /backup/download → SQLite backup (NÃO USAR)
- GET /{channel} → Medições do canal. Params: channel (path), from_time, to_time (query ISO strings). Response: { channel, from, to, count, measurements: [{ channel, sensor, apparent_power, active_power, reactive_power, power_factor, current, voltage, timestamp }] }
- GET /{channel}/{sensor} → Medições de sensor específico. Mesma resposta filtrada.
- GET /analytics/{channel}/consumption → { channel, from, to, results: [{ sensor, total_kwh, min_demand_kw, max_demand_kw }] }
- GET /analytics/{channel}/demand_peaks → { channel, from, to, results: [{ sensor, peak_kw, timestamp }] }
- GET /analytics/{channel}/electrical_health → { channel, from, to, results: [{ sensor, avg_voltage, avg_power_factor }] }
- GET /analytics/{channel}/hourly_profile → { channel, from, to, results: [{ hour, sensor, avg_power_kw }] }
- GET /analytics/{channel}/current_by_sensor → { channel, from, to, results: [{ sensor, avg_current }] }

CONSTRAINT CRÍTICO: O backend é frágil. Precisamos MINIMIZAR requisições.

ESTRATÉGIA DE CACHE (OBRIGATÓRIA):
1. Primeira vez: baixar 3 meses de dados via GET /{channel}?from_time=...&to_time=... e salvar em localStorage
2. Próximas vezes: buscar apenas delta (desde lastSync até agora)
3. Polling: máximo 1 requisição por minuto, APENAS quando a aba está visível (Page Visibility API)
4. Se API offline: usar cache com indicador visual

TAREFA:
Implementar toda a camada de dados: API client, cache, sync, polling, transformers, e hooks.

ENTREGAS ESPECÍFICAS:

1. API CLIENT (services/api/client.ts):
   ```typescript
   class ApiClient {
     private baseUrl: string;
     private timeout: number;

     async get<T>(endpoint: string, params?: Record<string, string>): Promise<T>;
     // Retry com backoff exponencial: 1s, 2s, 4s
     // Timeout de 10s por request
     // Logging de erros no console
     // Lança ApiError customizado com status, message, endpoint
   }
   ```

2. API ENDPOINTS (services/api/endpoints.ts):
   ```typescript
   // Funções tipadas para cada endpoint:
   getChannelMeasurements(channel: string, fromTime: string, toTime: string): Promise<ChannelMeasurementsResponse>
   getSensorMeasurements(channel: string, sensor: string, fromTime: string, toTime: string): Promise<SensorMeasurementsResponse>
   getConsumption(channel: string, fromTime?: string, toTime?: string): Promise<ConsumptionResponse>
   getDemandPeaks(channel: string, fromTime?: string, toTime?: string): Promise<DemandPeaksResponse>
   getElectricalHealth(channel: string, fromTime?: string, toTime?: string): Promise<ElectricalHealthResponse>
   getHourlyProfile(channel: string, fromTime?: string, toTime?: string): Promise<HourlyProfileResponse>
   getCurrentBySensor(channel: string, fromTime?: string, toTime?: string): Promise<CurrentBySensorResponse>
   ```

3. API TYPES (services/api/types.ts):
   Definir TODOS os tipos de Request e Response que espelham exatamente o que a API retorna (baseado no Swagger documentado acima).

4. CACHE MANAGER (services/cache/cacheManager.ts):
   ```typescript
   class CacheManager {
     get<T>(key: string): CacheEntry<T> | null;
     set<T>(key: string, data: T): void;
     getLastSync(key: string): string | null;  // ISO timestamp
     clear(key: string): void;
     clearAll(): void;
     isExpired(key: string, maxAgeMs: number): boolean;
     getStorageUsage(): { used: number; limit: number };  // Em bytes
     pruneOldest(key: string, keepCount: number): void;    // Remove medições antigas se muito grande
   }
   ```
   - Prefixo em todas as keys: "frigorifico_"
   - Versionamento: se CACHE_VERSION mudar, clearAll() automático
   - Tratamento de QuotaExceededError: se localStorage estourar, fazer pruneOldest
   - Serialização segura: try/catch em JSON.parse/stringify

5. SYNC STRATEGY (services/cache/syncStrategy.ts):
   ```typescript
   class SyncStrategy {
     // Chamado na PRIMEIRA vez ou quando cache está vazio
     async coldStart(channel: string): Promise<void>;
     // Busca de 3 meses em chunks de 1 mês para não sobrecarregar
     // Salva progressivamente no cache

     // Chamado nas vezes seguintes
     async syncDelta(channel: string): Promise<void>;
     // Busca desde lastSync até agora
     // Faz merge com dados existentes no cache

     // Verifica se precisa de cold start
     needsColdStart(channel: string): boolean;

     // Sincroniza dados de analytics (consumption, peaks, etc.)
     async syncAnalytics(channel: string): Promise<void>;
   }
   ```

6. POLLING MANAGER (services/polling/pollingManager.ts):
   ```typescript
   class PollingManager {
     start(callback: () => Promise<void>, intervalMs: number): void;
     stop(): void;
     // Integra com Page Visibility API:
     // - Pausa quando aba fica invisível
     // - Resume quando aba volta a ser visível
     // - Na volta, faz sync imediato se último sync foi há mais de intervalMs
     isActive(): boolean;
   }
   ```

7. TRANSFORMERS (domain/transformers/):

   a) energyTransformer.ts:
   ```typescript
   // Mapeia sensores para categorias do frigorífico
   interface SensorMap {
     freezerSensors: string[];      // IDs dos sensores que representam o congelador
     equipmentSensors: string[];    // IDs dos demais sensores
   }

   function transformToFreezerEnergy(measurements: ApiMeasurement[], sensorMap: SensorMap): number;
   // Retorna: soma de active_power dos freezerSensors da medição mais recente

   function transformToEquipmentEnergy(measurements: ApiMeasurement[], sensorMap: SensorMap): number;
   // Retorna: soma de active_power dos equipmentSensors da medição mais recente

   function getEnergyTimeSeries(measurements: ApiMeasurement[], sensorMap: SensorMap): { timestamp: Date; freezerEnergy: number; equipmentEnergy: number; }[];
   // Agrupa por timestamp, soma por categoria
   ```

   b) temperatureTransformer.ts:
   ```typescript
   interface TemperatureConfig {
     baseTemperature: number;    // -18 (temperatura alvo do congelador)
     avgPower: number;           // Consumo médio esperado
     sensitivityFactor: number;  // Quanto 1kW de desvio afeta a temperatura (ex: 0.5)
     noiseAmplitude: number;     // Variação aleatória para parecer realista (ex: 0.3)
   }

   function deriveTemperature(activePower: number, config: TemperatureConfig): number;
   // Lógica: baseTemp + (activePower - avgPower) * sensitivity + noise
   // Se consumo > média → temperatura subiu (congelador trabalhando mais)
   // Clamp entre -25 e -10 para manter realista

   function getTemperatureTimeSeries(measurements: ApiMeasurement[], config: TemperatureConfig): { timestamp: Date; temperature: number; }[];
   ```

   c) occupancyTransformer.ts:
   ```typescript
   interface OccupancyConfig {
     baseOccupancy: number;    // 65%
     avgCurrent: number;       // Corrente média esperada
     maxCurrent: number;       // Corrente máxima observada
     noiseAmplitude: number;   // Ex: 3%
   }

   function deriveOccupancy(current: number, config: OccupancyConfig): number;
   // Lógica: baseOccupancy + ((current - avgCurrent) / maxCurrent) * 40 + noise
   // Mais corrente → mais atividade → mais ocupação
   // Clamp entre 20 e 98

   function getOccupancyTimeSeries(measurements: ApiMeasurement[], config: OccupancyConfig): { timestamp: Date; occupancy: number; }[];
   ```

   d) financialTransformer.ts:
   ```typescript
   function calculateEnergyCost(totalKwh: number, hourlyBreakdown: { hour: number; kwh: number }[], tariffTable: TariffConfig[]): number;
   // Multiplica kwh de cada hora pela tarifa correspondente

   function calculateRevenue(totalKwh: number, revenuePerKwh: number): number;
   // Simula que energia processada gera receita proporcional
   // revenuePerKwh sugerido: R$ 8.50 (frigorífico ganha ~8.5x o custo de energia)

   function calculateMargin(revenue: number, cost: number): number;
   // (revenue - cost) / revenue * 100

   function projectMonthly(accumulatedValue: number, daysElapsed: number, totalDaysInMonth: number): number;
   // Projeção linear simples

   function getMonthlyAggregation(measurements: ApiMeasurement[], months: number): MonthlyEntry[];
   // Agrupa dados do cache por mês
   ```

   e) alertTransformer.ts:
   ```typescript
   function checkAlerts(data: { temperature: number; freezerEnergy: number; occupancy: number; voltage?: number; powerFactor?: number; }, thresholds: ThresholdConfig): Alert[];
   // Aplica todas as regras de threshold
   // Inclui alertas de saúde elétrica se dados disponíveis
   ```

8. HOOKS REACT (hooks/):

   a) usePageVisibility.ts:
   ```typescript
   function usePageVisibility(): boolean;
   // Retorna true se a aba está visível
   // Usa document.visibilitychange event
   ```

   b) useCacheSync.ts:
   ```typescript
   function useCacheSync(channel: string): {
     isLoading: boolean;        // true durante cold start
     isOnline: boolean;         // true se última requisição sucedeu
     lastSync: Date | null;     // timestamp do último sync
     progress: number;          // 0-100 durante cold start
     error: string | null;
   };
   // Na montagem: verifica se precisa cold start
   // Se sim: executa cold start com progresso
   // Se não: executa syncDelta
   // Inicia polling após sync inicial
   // Para polling quando componente desmonta
   ```

   c) useRealtimeData.ts:
   ```typescript
   function useRealtimeData(channel: string): {
     data: OperationalData | null;
     historical: OperationalData[];     // Último 1h
     prediction: OperationalData[];     // Próxima 1h (extrapolação)
     alerts: Alert[];
     isLoading: boolean;
     isStale: boolean;    // true se dados têm mais de 2 min
   };
   // Lê do cache, aplica transformers
   // Re-renderiza quando cache atualiza (via custom event ou state)
   ```

   d) useHistoricalData.ts:
   ```typescript
   function useHistoricalData(channel: string, periodDays: number): {
     data: OperationalData[];
     dailyAggregation: DailyEntry[];
     monthlyAggregation: MonthlyEntry[];
     hourlyProfile: HourlyProfileEntry[];
     isLoading: boolean;
   };
   // Lê dados do cache, agrega por período
   ```

REGRAS IMPORTANTES:
- Cada transformer é uma FUNÇÃO PURA (sem side effects) — fácil de testar
- O SyncStrategy é a ÚNICA parte que faz requisições HTTP
- Hooks NUNCA chamam a API diretamente — sempre passam pelo cache
- Usar um sistema de eventos (CustomEvent ou simple EventEmitter) para notificar hooks quando o cache atualiza
- Todos os números derivados (temperatura, ocupação) devem ser DETERMINÍSTICOS dado o mesmo input — usar seed baseada no timestamp, não Math.random()

TESTES OBRIGATÓRIOS:

1. Testes unitários (services/):
   - ApiClient: testa retry, timeout, error handling (mockar fetch)
   - CacheManager: testa get/set/clear, versionamento, QuotaExceededError
   - SyncStrategy: testa coldStart (mockar ApiClient), syncDelta, merge
   - PollingManager: testa start/stop, integração com visibilidade

2. Testes unitários (domain/transformers/):
   - energyTransformer: dado input X, retorna Y
   - temperatureTransformer: dado power=15, config padrão → temperatura esperada
   - occupancyTransformer: dado current=5, config padrão → occupancy esperada
   - financialTransformer: dado 100kWh em horário de pico → custo correto
   - alertTransformer: dado temperatura=-15 → alerta crítico

3. Testes de integração:
   - Fluxo completo: ApiClient → CacheManager → Transformer → resultado final
   - Cold start: simular primeira execução, verificar cache populado
   - Delta sync: simular segunda execução, verificar merge

DEFINIÇÃO DE PRONTO:
Ao finalizar, execute estas verificações e confirme que TODAS passam:

1. [ ] `npm run test` — todos os testes passam (mínimo 25 testes)
2. [ ] `npm run test:coverage` — cobertura > 80% nos arquivos de services/ e domain/
3. [ ] `npm run build` — compila sem erros TypeScript
4. [ ] Nenhum `any` usado nos tipos (exceto em catch blocks)
5. [ ] Cada transformer produz output determinístico para o mesmo input
6. [ ] CacheManager lida corretamente com QuotaExceededError (teste específico)
7. [ ] PollingManager para quando aba fica invisível (teste específico)
8. [ ] A aplicação continua rodando com dados mockados (nada quebrou)

Execute `npm run test -- --reporter=verbose` e `npm run build` no final e mostre o output completo.
Se algum teste falhar, corrija antes de considerar pronto.
```

---

## PROMPT — Sprint 2: Tela Operacional (Dados Reais)

```
CONTEXTO DO PROJETO:
PWA de dashboard para monitoramento de um frigorífico.
React 18 + Vite + TypeScript + Tailwind CSS 4 + Recharts + shadcn/ui.

Na Sprint 0, configuramos a infraestrutura.
Na Sprint 1, implementamos:
- ApiClient com retry e timeout
- CacheManager com localStorage
- SyncStrategy com cold start + delta incremental
- PollingManager com Page Visibility API
- Transformers: energy, temperature, occupancy, financial, alert
- Hooks: usePageVisibility, useCacheSync, useRealtimeData, useHistoricalData
- Todos com testes unitários e de integração

A TELA OPERACIONAL ATUAL (src/app/pages/OperationalDashboard.tsx):
- Importa dados de `utils/mockData.ts`
- Tem 4 MetricCardWithChart: Energia Congelador, Energia Equipamentos, Temperatura, Ocupação
- Tem AlertBanner para alertas
- Tem 2 gráficos: Consumo Total e Energia vs Temperatura
- Atualiza a cada 5 segundos via setInterval

TAREFA:
Substituir TODOS os dados mockados da tela Operacional por dados reais vindos dos hooks.

ENTREGAS ESPECÍFICAS:

1. REFATORAR OperationalDashboard.tsx:
   - Remover TODAS as importações de mockData.ts
   - Usar o hook `useCacheSync(channel)` para inicializar e sincronizar dados
   - Usar o hook `useRealtimeData(channel)` para dados em tempo real
   - O `channel` deve vir de uma constante de configuração (config/channels.ts)

2. SENSOR MAP:
   Criar `config/channels.ts`:
   ```typescript
   export const FRIGORIFICO_CHANNEL = "nome_do_canal";  // Será ajustado quando soubermos o channel real

   export const SENSOR_MAP: SensorMap = {
     freezerSensors: ["sensor_1"],        // Placeholder — ajustar com sensor real
     equipmentSensors: ["sensor_2", "sensor_3"],  // Placeholder
   };
   ```
   IMPORTANTE: Como não sabemos ainda os nomes reais dos channels/sensors da API, criar um módulo de "discovery" que, na primeira execução, faz uma chamada exploratória para descobrir os channels e sensors disponíveis e salva no cache.

3. DISCOVERY SERVICE (services/api/discovery.ts):
   ```typescript
   async function discoverChannelsAndSensors(): Promise<{
     channels: string[];
     sensorsByChannel: Record<string, string[]>;
   }>;
   // Estratégia: fazer GET /{channel} com um range curto (último dia)
   // Extrair lista de sensors únicos das medições retornadas
   // Cachear resultado para não repetir
   ```
   Se o discovery falhar ou não houver dados, mostrar uma tela de "Configuração Inicial" pedindo ao usuário para selecionar o channel.

4. LOADING STATE:
   Enquanto o cold start estiver em andamento, mostrar:
   - Skeleton loading nos 4 cards
   - Barra de progresso indicando % do cold start
   - Mensagem: "Carregando dados históricos... X%"

5. ERROR/OFFLINE STATE:
   Se a API estiver offline e não houver cache:
   - Mostrar mensagem amigável: "Não foi possível conectar ao servidor"
   - Botão "Tentar novamente"

   Se houver cache mas estiver stale:
   - Badge no header: "Dados de X minutos atrás"
   - Ícone de offline sutil

6. INDICADOR DE TEMPO REAL:
   - Adicionar um badge/dot pulsante verde quando dados estão ao vivo
   - Mostrar "Última atualização: HH:MM:SS" no header ou footer da tela

7. MANTER COMPATIBILIDADE VISUAL:
   - A tela DEVE continuar visualmente idêntica ao mockup original
   - Mesmos cards, mesmos gráficos, mesmas cores
   - Única diferença: os dados são reais ao invés de mockados
   - Adicionar os estados de loading/error/offline mencionados acima

TESTES OBRIGATÓRIOS:

1. Teste unitário — useRealtimeData:
   - Mockar CacheManager com dados conhecidos
   - Verificar que o hook retorna OperationalData transformado corretamente
   - Verificar que alertas são gerados quando thresholds são ultrapassados

2. Teste unitário — Discovery Service:
   - Mockar ApiClient
   - Verificar que channels e sensors são extraídos corretamente

3. Teste de integração — OperationalDashboard:
   - Renderizar a página com dados mockados no cache
   - Verificar que os 4 cards mostram valores corretos
   - Verificar que AlertBanner aparece quando há alertas
   - Verificar que gráficos recebem dados no formato correto

4. Teste de output (validação visual):
   - Dado um conjunto de medições com active_power=15 para o sensor congelador:
     → Card "Energia Congelador" deve mostrar "15.0 kW"
   - Dado active_power=15 e config padrão de temperatura:
     → Card "Temperatura" deve mostrar um valor entre -20°C e -16°C
   - Dado temperatura derivada de -15°C:
     → AlertBanner deve mostrar alerta crítico de temperatura

DEFINIÇÃO DE PRONTO:
Ao finalizar, execute estas verificações e confirme que TODAS passam:

1. [ ] `npm run test` — todos os testes passam
2. [ ] `npm run build` — compila sem erros
3. [ ] A tela Operacional renderiza sem erros no navegador
4. [ ] ZERO importações de mockData.ts na tela Operacional
5. [ ] Loading skeleton aparece durante carregamento
6. [ ] Se API offline, mostra estado de erro com botão de retry
7. [ ] Se API online, os 4 cards mostram dados numéricos reais (não NaN, não undefined)
8. [ ] Os gráficos de linha renderizam com dados reais
9. [ ] Alertas aparecem quando thresholds são ultrapassados
10. [ ] As telas de Logística e Negócios CONTINUAM funcionando com dados mockados (não foram afetadas)

Execute `npm run test -- --reporter=verbose` e `npm run build` no final e mostre o output.
Abra a aplicação no navegador e confirme visualmente que a tela Operacional mostra dados.
Se alguma verificação falhar, corrija antes de considerar pronto.
```

---

## PROMPT — Sprint 3: Tela Logística (Dados Reais)

```
CONTEXTO DO PROJETO:
PWA de dashboard para monitoramento de um frigorífico.
React 18 + Vite + TypeScript + Tailwind CSS 4 + Recharts + shadcn/ui.

Sprints anteriores concluídas:
- Sprint 0: Infraestrutura, tipos, constantes, testes configurados
- Sprint 1: ApiClient, CacheManager, SyncStrategy, PollingManager, Transformers, Hooks
- Sprint 2: Tela Operacional funcionando com dados reais da API

A TELA DE LOGÍSTICA ATUAL (src/app/pages/LogisticsDashboard.tsx):
- Importa dados de `utils/mockData.ts`
- 4 MetricCardWithChart: Consumo Médio 24h, Pico de Ocupação, Horas Tarifa Baixa, Próximo Horário Ideal
- 2 gráficos: "Previsão: Ocupação vs Tarifa" e "Consumo vs Ocupação (24h)"
- 2 cards de Insights

ENDPOINTS DA API QUE SERÃO USADOS NESTA SPRINT:
- GET /analytics/{channel}/hourly_profile → perfil médio de consumo por hora e sensor
- GET /analytics/{channel}/consumption → consumo total em kWh
- GET /analytics/{channel}/demand_peaks → picos de demanda
- Dados do cache de medições (já sincronizado na Sprint 1)

TAREFA:
Substituir TODOS os dados mockados da tela Logística por dados reais vindos dos hooks e analytics.

ENTREGAS ESPECÍFICAS:

1. HOOK useLogisticsData (hooks/useLogisticsData.ts):
   ```typescript
   function useLogisticsData(channel: string): {
     avgEnergy24h: number;                // Consumo médio das últimas 24h
     peakOccupancy: number;               // Pico de ocupação derivada nas 24h
     lowEnergyHours: number;              // Horas com tarifa fora de ponta
     nextIdealHour: number | null;        // Próximo horário com tarifa baixa
     hourlyData: HourlyDataPoint[];       // Dados por hora (energia + ocupação + tarifa)
     occupancyForecast: ForecastPoint[];  // Previsão de ocupação × tarifa
     energyPrices: EnergyPrice[];         // Tabela de 24h de tarifas
     isLoading: boolean;
     error: string | null;
   };
   ```

2. LÓGICA DE CADA DADO:

   a) avgEnergy24h:
   - Fonte: Medições das últimas 24h do cache
   - Cálculo: Média de (active_power de todos os sensors) agrupada por timestamp

   b) peakOccupancy:
   - Fonte: Medições das últimas 24h do cache
   - Cálculo: Máximo da ocupação derivada (usando occupancyTransformer)

   c) lowEnergyHours:
   - Fonte: Tabela de tarifas (domain/constants/tariffs.ts)
   - Cálculo: Contar horas onde tarifa < R$ 0.60

   d) nextIdealHour:
   - Fonte: Hora atual + tabela de tarifas
   - Cálculo: Próxima hora futura com tarifa < R$ 0.60

   e) hourlyData:
   - Fonte: /analytics/{channel}/hourly_profile (cacheado)
   - Transformação: Juntar avg_power_kw de cada hora + derivar ocupação + adicionar tarifa da tabela

   f) occupancyForecast:
   - Fonte: hourly_profile (como base) + occupancyTransformer
   - Transformação: Para cada hora das próximas 24h, estimar ocupação baseada no perfil histórico

   g) energyPrices:
   - Fonte: domain/constants/tariffs.ts
   - Transformação: Array de 24 posições com preço por hora

3. ANALYTICS SYNC:
   - Adicionar ao SyncStrategy: método `syncAnalytics(channel)` que busca:
     - hourly_profile (cachear por 1 hora)
     - consumption (cachear por 1 hora)
     - demand_peaks (cachear por 1 hora)
   - Esses endpoints de analytics são mais leves que medições brutas
   - Cachear separadamente: `frigorifico_analytics_hourly_profile`, etc.

4. REFATORAR LogisticsDashboard.tsx:
   - Remover TODAS as importações de mockData.ts
   - Usar useLogisticsData(channel) para todos os dados
   - Usar useCacheSync(channel) para status de conexão
   - Manter layout visual idêntico ao original
   - Adicionar loading states nos cards e gráficos

5. INSIGHTS DINÂMICOS:
   Os 2 cards de insight devem ser gerados dinamicamente:
   ```typescript
   function generateLogisticsInsights(data: LogisticsData): { title: string; text: string; variant: 'blue' | 'amber' }[];
   // Exemplo: Se consumo em horário comercial é 30% maior que fora → "Consumo aumenta X% durante horário comercial..."
   // Se pico de ocupação coincide com tarifa alta → "Pico de ocupação às Xh coincide com tarifa de ponta..."
   ```

TESTES OBRIGATÓRIOS:

1. Teste unitário — useLogisticsData:
   - Mockar cache com dados de hourly_profile conhecidos
   - Verificar: avgEnergy24h calculado corretamente
   - Verificar: peakOccupancy é o máximo real
   - Verificar: lowEnergyHours = 8 (22h-6h = 8 horas fora de ponta)

2. Teste unitário — generateLogisticsInsights:
   - Dado consumo diurno 30% maior que noturno → insight sobre consumo presente
   - Dado pico de ocupação às 8h → insight sobre janela de recebimento

3. Teste de integração — LogisticsDashboard:
   - Renderizar com cache populado
   - Verificar que os 4 cards mostram valores numéricos (não NaN)
   - Verificar que gráficos renderizam sem erro

4. Teste de output:
   - Dado hourly_profile com avg_power_kw=20 entre 8h-18h e avg_power_kw=12 entre 22h-6h:
     → "Consumo Médio 24h" deve ser ~16 kW (média ponderada)
     → Insight deve mencionar aumento em horário comercial

DEFINIÇÃO DE PRONTO:
1. [ ] `npm run test` — todos os testes passam
2. [ ] `npm run build` — compila sem erros
3. [ ] ZERO importações de mockData.ts na tela Logística
4. [ ] Os 4 cards mostram dados numéricos coerentes
5. [ ] Os 2 gráficos renderizam com dados reais do hourly_profile
6. [ ] Insights são gerados dinamicamente
7. [ ] Loading states funcionam durante carregamento
8. [ ] Tela Operacional continua funcionando (não quebrou)
9. [ ] Tela Negócios continua funcionando com mocks (não foi afetada)

Execute `npm run test -- --reporter=verbose` e `npm run build` e mostre output.
Se alguma verificação falhar, corrija antes de considerar pronto.
```

---

## PROMPT — Sprint 4: Tela Negócios (Dados Reais)

```
CONTEXTO DO PROJETO:
PWA de dashboard para monitoramento de um frigorífico.
React 18 + Vite + TypeScript + Tailwind CSS 4 + Recharts + shadcn/ui.

Sprints anteriores concluídas:
- Sprint 0: Infraestrutura
- Sprint 1: Camada de dados completa (ApiClient, Cache, Transformers, Hooks)
- Sprint 2: Tela Operacional com dados reais
- Sprint 3: Tela Logística com dados reais

A TELA DE NEGÓCIOS ATUAL (src/app/pages/BusinessDashboard.tsx):
- Importa dados de `utils/mockData.ts`: getMonthlyComparison, getCurrentMonthData, generateHistoricalData
- 5 MetricCardWithChart: Faturamento Atual, Projeção Mensal, Custo Energético, Projeção de Custo, Margem Operacional
- 2 gráficos: "Custo Energético Diário 30 dias" e "Padrão Diário: Consumo vs Ocupação"
- 1 modal de detalhe com gráfico "Comparação Mensal 5 Meses"
- 2 cards de Insights Executivos

DADOS FINANCEIROS DO DOMÍNIO (CONFIGURÁVEIS):
- Receita por kWh processado: R$ 8.50 (simula que cada kWh consumido pelo frigorífico gera R$ 8.50 de receita na operação de processamento de carnes)
- Tarifas de energia: conforme domain/constants/tariffs.ts
- Mês atual: calcular dinamicamente

TAREFA:
Substituir TODOS os dados mockados da tela Negócios por dados reais usando o cache de 3 meses.

ENTREGAS ESPECÍFICAS:

1. HOOK useBusinessData (hooks/useBusinessData.ts):
   ```typescript
   function useBusinessData(channel: string): {
     // KPIs do mês atual
     currentRevenue: number;           // R$ — total_kwh × R$8.50
     projectedRevenue: number;         // R$ — projeção linear para fim do mês
     energyCost: number;               // R$ — total_kwh × tarifa ponderada
     projectedEnergyCost: number;      // R$ — projeção do custo
     margin: number;                   // % — margem operacional atual
     projectedMargin: number;          // % — margem projetada
     revenueChange: number;            // % — variação vs mês anterior
     costChange: number;               // % — variação do custo vs mês anterior

     // Dados para gráficos
     dailyData: DailyEntry[];          // Últimos 30 dias: { day, energy, revenue, cost }
     monthlyComparison: MonthlyEntry[]; // Até 3 meses (do cache): { month, energyCost, revenue }
     hourlyAverages: HourlyAvgEntry[]; // Média por hora: { hour, avgEnergy, avgOccupancy }
     cumulativeData: CumulativeEntry[]; // Acumulado do mês: { day, energyAccum, revenueAccum }

     isLoading: boolean;
     error: string | null;
   };
   ```

2. LÓGICA DE CADA DADO:

   a) currentRevenue:
   - Fonte: /analytics/{channel}/consumption para o mês atual
   - Cálculo: Somar total_kwh de todos os sensores × R$ 8.50

   b) projectedRevenue:
   - Cálculo: currentRevenue / diasPassados × diasNoMês

   c) energyCost:
   - Fonte: /analytics/{channel}/consumption + hourly_profile
   - Cálculo: Distribuir total_kwh nas horas usando hourly_profile como peso, multiplicar pela tarifa de cada hora

   d) Comparação mensal:
   - Fonte: Cache de 3 meses de medições
   - Cálculo: Agregar consumption por mês
   - Se não há 3 meses no cache, mostrar o que tiver

   e) Dados diários:
   - Fonte: Medições do cache, agrupadas por dia
   - Cálculo: Para cada dia → soma de active_power × horas = kWh estimado → custo e receita

   f) Perfil horário:
   - Fonte: /analytics/{channel}/hourly_profile
   - Derivar occupancy média por hora

3. CONSTANTES FINANCEIRAS (domain/constants/financial.ts):
   ```typescript
   export const FINANCIAL_CONFIG = Object.freeze({
     REVENUE_PER_KWH: 8.50,           // R$ de receita por kWh processado
     WORKING_HOURS_PER_DAY: 16,       // Horas de operação por dia
     DAYS_PER_MONTH: 30,              // Para projeções
   });
   ```

4. INSIGHTS EXECUTIVOS DINÂMICOS:
   ```typescript
   function generateBusinessInsights(data: BusinessData): InsightCard[];
   // Regras:
   // Se revenueChange > costChange → "Crescimento Sustentável: Faturamento cresceu X% enquanto custo aumentou Y%"
   // Se margin > 85% → "Margem saudável: operação com margem de X%"
   // Se custo energético em horário de pico > 40% do total → "Oportunidade: Otimização em horários de pico pode reduzir custos em até Z%"
   ```

5. REFATORAR BusinessDashboard.tsx:
   - Remover TODAS as importações de mockData.ts
   - Usar useBusinessData(channel) para todos os dados
   - Manter layout visual idêntico
   - Manter o modal de "Comparação Mensal" com dados reais
   - Loading states em todos os cards

TESTES OBRIGATÓRIOS:

1. Teste unitário — financialTransformer:
   - Dado total_kwh=1000, tarifa média ponderada=0.65 → custo = R$650
   - Dado total_kwh=1000, revenuePerKwh=8.50 → receita = R$8500
   - Dado revenue=8500, cost=650 → margem = 92.35%
   - Dado accum=5000 no dia 15 de um mês de 30 dias → projeção = 10000

2. Teste unitário — useBusinessData:
   - Mockar cache com 2 meses de consumption data
   - Verificar monthlyComparison tem 2 entries com valores corretos
   - Verificar revenueChange é calculado corretamente

3. Teste unitário — generateBusinessInsights:
   - Dado revenueChange=5% e costChange=2% → insight "Crescimento Sustentável"
   - Dado margin > 85% → insight sobre margem saudável

4. Teste de integração — BusinessDashboard:
   - Renderizar com cache populado
   - Verificar 5 cards mostram valores em R$ (não NaN)
   - Verificar gráfico de 30 dias renderiza
   - Verificar comparação mensal renderiza

5. Teste de output:
   - Dado consumption de 10000 kWh no mês, 15 dias passados:
     → Faturamento: R$ 85.000
     → Projeção: R$ 170.000
     → Custo (tarifa média ~0.65): ~R$ 6.500
     → Margem: ~92%

DEFINIÇÃO DE PRONTO:
1. [ ] `npm run test` — todos os testes passam
2. [ ] `npm run build` — compila sem erros
3. [ ] ZERO importações de mockData.ts em QUALQUER página (mockData.ts pode ser deletado)
4. [ ] Os 5 cards financeiros mostram valores em R$ coerentes
5. [ ] Gráfico "Custo Diário 30 dias" renderiza com dados reais
6. [ ] Gráfico "Consumo vs Ocupação" renderiza com dados reais
7. [ ] Comparação mensal mostra dados dos meses disponíveis no cache
8. [ ] Insights são gerados dinamicamente baseados nos dados reais
9. [ ] Todas as 3 telas funcionam com dados reais (nenhuma usa mockData)
10. [ ] Verificar que mockData.ts pode ser deletado sem quebrar nada

Execute `npm run test -- --reporter=verbose` e `npm run build` e mostre output.
Se alguma verificação falhar, corrija antes de considerar pronto.
```

---

## PROMPT — Sprint 5: PWA, Polish e Entrega Final

```
CONTEXTO DO PROJETO:
PWA de dashboard para monitoramento de um frigorífico.
React 18 + Vite + TypeScript + Tailwind CSS 4 + Recharts + shadcn/ui.

TODAS as Sprints anteriores concluídas:
- Sprint 0: Infraestrutura e tipos
- Sprint 1: Camada de dados (API, Cache, Transformers)
- Sprint 2: Tela Operacional com dados reais
- Sprint 3: Tela Logística com dados reais
- Sprint 4: Tela Negócios com dados reais

O projeto está funcional com as 3 telas conectadas a dados reais da API.

TAREFA:
Finalizar o projeto como PWA mobile-first, otimizar performance, e preparar para apresentação.

ENTREGAS ESPECÍFICAS:

1. SERVICE WORKER (sw.ts ou usar vite-plugin-pwa):
   - Instalar e configurar `vite-plugin-pwa`
   - Cache de assets estáticos (JS, CSS, imagens, fontes)
   - Estratégia: NetworkFirst para dados da API, CacheFirst para assets
   - Offline fallback: se sem rede e sem cache, mostrar página de "Sem conexão"
   - Atualizar `manifest.json` com:
     - name: "Frigorífico Monitor"
     - short_name: "FrigoMonitor"
     - theme_color: "#3b82f6"
     - background_color: "#f8fafc"
     - display: "standalone"
     - orientation: "portrait"
     - start_url: "/"
     - Ícones em 192x192 e 512x512 (gerar com cor sólida azul e um ícone de floco de neve)

2. RESPONSIVIDADE MOBILE-FIRST:
   Revisar TODAS as 3 telas para mobile (viewport 375px):

   a) DashboardLayout.tsx:
   - Header: em mobile, reduzir tamanho do título
   - Navegação: Em mobile, mover para bottom navigation bar (tab bar fixo na parte inferior)
   - O tab bar deve ter 3 ícones: Operacional, Logística, Negócios

   b) Cards de métricas:
   - Em mobile: 1 coluna (empilhados verticalmente)
   - Em tablet: 2 colunas
   - Em desktop: 4 colunas (como está hoje)
   - Os cards devem ter touch targets mínimos de 44px

   c) Gráficos:
   - Em mobile: 1 coluna, altura reduzida (180px ao invés de 240px)
   - Labels dos eixos menores (fontSize: 9)
   - Tooltip deve funcionar com touch (não apenas hover)

   d) Modais de detalhe (MetricCardWithChart):
   - Em mobile: abrir como fullscreen sheet (de baixo para cima)
   - Em desktop: manter como modal/dialog

3. INDICADORES DE STATUS (Header):
   - Badge "Online" (verde) ou "Offline" (vermelho)
   - "Última atualização: HH:MM"
   - Durante cold start: "Sincronizando... X%"

4. PERFORMANCE:
   - Lazy loading das rotas (React.lazy + Suspense)
   - Memoização dos gráficos (React.memo) — evitar re-render quando dados não mudaram
   - Verificar bundle size: meta < 500KB gzipped
   - Se necessário, usar dynamic import para recharts

5. PULL-TO-REFRESH (mobile):
   - Implementar gesture de pull-to-refresh que força um syncDelta
   - Usar library leve ou implementar com touch events

6. TESTES E2E com Playwright:
   Instalar Playwright e criar testes para os fluxos:

   a) Fluxo de navegação:
   - Abrir app → tela Operacional carrega → navegar para Logística → navegar para Negócios → voltar para Operacional

   b) Fluxo de dados:
   - Abrir app → cold start roda → dados aparecem nos cards → valores são numéricos (não NaN)

   c) Fluxo offline:
   - Abrir app com dados em cache → desativar rede → recarregar → app mostra dados do cache → indicador "Offline" aparece

   d) Responsividade:
   - Viewport 375px → bottom tab bar visível → cards em 1 coluna
   - Viewport 1024px → sidebar navigation → cards em 4 colunas

7. LIMPEZA FINAL:
   - Deletar mockData.ts (verificar que nenhum arquivo importa)
   - Deletar ATTRIBUTIONS.md e guidelines/ se não necessários
   - Verificar que não há console.log soltos (apenas em error handlers)
   - Verificar que não há TODO/FIXME restantes no código
   - Atualizar package.json: name, version, description

8. DOCUMENTAÇÃO (README.md na raiz):
   - Descrição do projeto
   - Como rodar: npm install, npm run dev
   - Estrutura do projeto (breve)
   - Como configurar a API (VITE_API_BASE_URL)
   - Decisões técnicas: cache strategy, polling, transformações

TESTES OBRIGATÓRIOS:

1. Testes E2E (Playwright):
   - 4 testes conforme descrito acima

2. Teste de bundle:
   - `npm run build` e verificar que dist/ < 2MB total

3. Teste de PWA:
   - manifest.json válido (verificar com lighthouse ou manualmente)
   - Service Worker registra sem erro

4. Teste de responsividade:
   - Abrir em viewport 375px: layout não quebra, sem scroll horizontal
   - Bottom tab bar funcional

DEFINIÇÃO DE PRONTO:
1. [ ] `npm run test` — todos os testes unitários e de integração passam
2. [ ] `npm run build` — compila sem erros, bundle < 2MB
3. [ ] Testes E2E passam (ou, se Playwright difícil de configurar no ambiente, testar manualmente e documentar)
4. [ ] manifest.json completo e válido
5. [ ] Service Worker registra e cacheia assets
6. [ ] Em mobile (375px): bottom tab bar, cards empilhados, gráficos responsivos
7. [ ] Em desktop (1024px+): layout original preservado
8. [ ] Indicador Online/Offline funcional
9. [ ] Nenhum import de mockData.ts no projeto
10. [ ] Nenhum console.log solto (exceto error handlers)
11. [ ] README.md existe com instruções de setup
12. [ ] O projeto pode ser instalado como PWA no celular

Execute `npm run build`, verifique o tamanho do bundle, e execute `npm run test` com output verbose.
Se alguma verificação falhar, corrija antes de considerar pronto.
```

---

# RESUMO DOS SPRINTS

| Sprint | Foco | Entregáveis Chave | Testes |
|--------|------|-------------------|--------|
| 0 | Infraestrutura | Pastas, tipos, constantes, configs, PWA base | 1 teste exemplo |
| 1 | Camada de Dados | ApiClient, Cache, Sync, Polling, 5 Transformers, 4 Hooks | ~25+ testes unitários + integração |
| 2 | Tela Operacional | Dados reais, discovery, loading/error states, alertas | ~8 testes |
| 3 | Tela Logística | Analytics, perfil horário, insights dinâmicos | ~8 testes |
| 4 | Tela Negócios | Financeiro, projeções, comparação mensal | ~10 testes |
| 5 | PWA + Polish | Service Worker, responsividade, E2E, limpeza, docs | 4 E2E + lighthouse |

**Total estimado: ~55+ testes automatizados**
