# Guia para a LLM das proximas sprints

Este documento e um handoff direto para a LLM que vai continuar o projeto depois da Sprint 1.
Ele resume:

- o que foi investigado na pratica
- os principais achados que mudam decisoes de implementacao
- como reaproveitar os artefatos desta pasta
- quais ajustes ja valem para o fechamento real da Sprint 1
- quais cuidados sao obrigatorios para a Sprint 2

## O que foi feito

Foi executada uma investigacao de trincheira da API e do banco real, fora do fluxo das sprints, para produzir informacao complementar de design.

As frentes cobertas foram:

1. leitura do `PLANEJAMENTO_SPRINTS.md`
2. extracao do Swagger a partir do PDF enviado
3. validacao do OpenAPI vivo em producao
4. testes reais de endpoints com janelas pequenas, grandes, vazias e invalidas
5. download e inspeccao do backup SQLite real
6. analise da cobertura temporal, latencia, buracos de serie, shape real dos payloads e sensores disponiveis
7. geracao de fixtures reais para testes
8. consolidacao de thresholds, transformacoes e riscos para a tela operacional

## Arquivos que voce deve usar primeiro

Comece por estes arquivos:

- [README.md](/C:/Users/rafat/OneDrive/Área%20de%20Trabalho/Politécnica/quinto/automacao-risco-v2/meat-processing-v2/figma_export/analise-banco-de-dados/README.md)
- [checklist-riscos-sprint-2.md](/C:/Users/rafat/OneDrive/Área%20de%20Trabalho/Politécnica/quinto/automacao-risco-v2/meat-processing-v2/figma_export/analise-banco-de-dados/checklist-riscos-sprint-2.md)
- [manifest.json](/C:/Users/rafat/OneDrive/Área%20de%20Trabalho/Politécnica/quinto/automacao-risco-v2/meat-processing-v2/figma_export/analise-banco-de-dados/fixtures/manifest.json)
- [useOperationalData-example.json](/C:/Users/rafat/OneDrive/Área%20de%20Trabalho/Politécnica/quinto/automacao-risco-v2/meat-processing-v2/figma_export/analise-banco-de-dados/fixtures/useOperationalData-example.json)
- [gerar_fixtures.py](/C:/Users/rafat/OneDrive/Área%20de%20Trabalho/Politécnica/quinto/automacao-risco-v2/meat-processing-v2/figma_export/analise-banco-de-dados/scripts/gerar_fixtures.py)

## Principais insights que mudam o design

### 1. A API real nao e `localhost`

- Base real: `http://143.107.102.8:8090`
- OpenAPI real: `http://143.107.102.8:8090/openapi.json`

Implicacao:

- `VITE_API_BASE_URL` precisa existir de verdade nos ambientes de execucao
- o fallback `http://localhost:8000` e util apenas para dev local, nao como expectativa padrao do projeto

### 2. O plano de 3 meses em localStorage nao fecha

Achado pratico:

- `GET /lab` de 1 dia ja pesa cerca de `13.2 MB`
- a estimativa do historico bruto de `lab` passa de `500 MB`

Implicacao:

- a estrategia descrita na Sprint 1 precisa ser ajustada
- `localStorage` nao deve guardar bruto historico de 3 meses
- se a Sprint 1 assumiu isso como comportamento final, trate como debito tecnico de alto risco

Direcao recomendada:

- bruto recente: minutos ou poucas horas
- historico analitico: agregacoes
- persistencia pesada: `IndexedDB`, nao `localStorage`

### 3. Chamadas sem janela explicita sao perigosas

Achado pratico:

- sem `from_time` e `to_time`, a API usa uma janela implicita de 24 horas ate o agora do servidor
- como os dados reais estao atrasados, a resposta default volta vazia

Implicacao:

- o client deve sempre mandar `from_time` e `to_time`
- qualquer hook que dependa da janela default da API pode parecer "quebrado" mesmo quando a API esta funcional

### 4. O dado atual nao esta ao vivo

Achado pratico:

- o ultimo dado de `lab` e `2026-03-31T11:40:56`
- a analise foi feita em `2026-04-07`

Implicacao:

- a UI nao pode exibir "dados ao vivo" sem uma checagem de staleness
- Sprint 2 precisa de badge realista:
  - online/offline
  - atualizado/desatualizado
  - ultima medicao conhecida

### 5. O mapeamento de sensores precisa ser configuravel

Achado pratico:

- sensores reais: `fase1`, `fase2`, `fase3`
- melhor inferencia atual:
  - `fase3` como congelador
  - `fase1 + fase2` como equipamentos

Implicacao:

- isso nao deve ficar hardcoded como verdade absoluta de dominio
- a Sprint 2 precisa aceitar configuracao de sensor map, mesmo que venha de constante local na primeira versao

### 6. O contrato real e um pouco diferente do que o client espera

Achados praticos:

- `hourly_profile.hour` vem como `string`, nao `number`
- data invalida retorna `400`, nao `422`
- canal inexistente retorna `200` com arrays vazios, nao `404`
- `backup/download` devolve arquivo binario SQLite, nao JSON
- existe endpoint extra: `voltage_anomalies`

Implicacao:

- revise tipos e tratamento de erro da Sprint 1
- nao confie apenas no OpenAPI textual ou nos tipos escritos antes da validacao pratica

## Como usar o que foi construido

### Fixtures reais

Use os arquivos em [`fixtures/`](/C:/Users/rafat/OneDrive/Área%20de%20Trabalho/Politécnica/quinto/automacao-risco-v2/meat-processing-v2/figma_export/analise-banco-de-dados/fixtures) para:

- testes unitarios dos transformers
- testes de hooks
- testes de integracao do client
- mocks previsiveis para a tela operacional

Fixtures mais importantes:

- `channel-lab-1min.json`
- `sensor-lab-fase1-1min.json`
- `consumption-lab-1d.json`
- `demand-peaks-lab-1d.json`
- `electrical-health-lab-1d.json`
- `hourly-profile-lab-7d.json`
- `current-by-sensor-lab-7d.json`
- `error-invalid-from-time-400.json`
- `useOperationalData-example.json`

### Script de regeneracao

Se precisar atualizar os fixtures:

```bash
python analise-banco-de-dados/scripts/gerar_fixtures.py
```

O script ja usa headers de navegador para evitar o `403 Error 1010` observado com alguns clientes automatizados.

### Contratos estaveis

Nao rederive os contratos a partir da memoria.
Use o `README.md` desta pasta como fonte primaria para:

- shape real de `ApiMeasurement`
- shape real dos analytics
- comportamento real de erro
- shape de `useOperationalData`

## Recomendacoes para revisar a Sprint 1

Se a Sprint 1 foi "concluida", estas sao as revisoes mais provaveis de alto valor.

### 1. Corrigir os tipos da camada de API

Ajustes recomendados:

- `HourlyProfileResult.hour` deve ser `string`
- erros devem aceitar `400` com payload `{ detail: string }`
- respostas vazias com `200` precisam ser tratadas como caso normal

### 2. Mudar a estrategia de sync

Se a Sprint 1 ainda assume:

- cold start de 3 meses em bruto
- persistencia em `localStorage`
- merge de historico completo no browser

entao ela precisa ser revista.

Substitua por algo nesta linha:

1. para tela operacional:
   - sincronizar apenas uma janela curta de bruto recente
   - exemplo: `15 min`, `30 min` ou `1 h`
2. para analytics:
   - usar endpoints agregados
3. para historico longo:
   - `IndexedDB`
   - ou cache agregado por hora/dia

### 3. Tornar a janela obrigatoria no client

O `ApiClient` pode continuar generico, mas os endpoints consumidos pela aplicacao nao deveriam chamar bruto/analytics sem janela explicita.

Recomendacao:

- definir helpers de janela:
  - `getRecentWindow(minutes)`
  - `getOperationalWindow()`
  - `getAnalyticsWindow(days)`

### 4. Adicionar staleness ao dominio

Inclua no fechamento da Sprint 1 uma capacidade clara de detectar dado velho.

Sugestao:

```ts
interface DataFreshness {
  lastMeasurementAt: string | null;
  ageMs: number | null;
  isStale: boolean;
}
```

### 5. Preparar configuracao de sensor map

Adicione algo como:

```ts
export const SENSOR_MAP = {
  freezer: "fase3",
  equipment: ["fase1", "fase2"],
} as const;
```

Mesmo que provisoriamente.

Isso evita reescrever a Sprint 2 quando o nome real de negocio mudar.

### 6. Revisar fallback e observabilidade

O client deveria diferenciar:

- erro de rede
- erro de parse
- erro `400`
- resposta vazia valida
- staleness de dados

Sem isso, a tela tende a colapsar varios casos em "API quebrou".

## Recomendacoes diretas para a Sprint 2

### 1. A tela operacional nao pode depender de "tempo real"

Ela precisa funcionar bem mesmo quando:

- a API responde
- mas o ultimo timestamp esta velho

Portanto:

- renderize os cards
- exiba ultima leitura conhecida
- mostre badge de stale data
- dispare alerta operacional de dados desatualizados

### 2. Implementar `useOperationalData` em cima do mapeamento inferido

Parta deste contrato pratico:

- congelador = `fase3`
- equipamentos = `fase1 + fase2`

Use como referencia direta:

- [useOperationalData-example.json](/C:/Users/rafat/OneDrive/Área%20de%20Trabalho/Politécnica/quinto/automacao-risco-v2/meat-processing-v2/figma_export/analise-banco-de-dados/fixtures/useOperationalData-example.json)

### 3. Temperatura e ocupacao precisam ser explicitamente "derivadas"

Nao venda esses sinais como medicao real.

Recomendacao de UI:

- rotulo ou tooltip dizendo `estimado` ou `derivado`
- manter a regra de calculo no dominio, nao na pagina

### 4. Alerta de tensao deve usar thresholds reais do dataset

Nao use os defaults `198/242`.

Para esse dataset de `127V`, a recomendacao inicial e:

- warning: fora de `122 .. 131.5`
- critical: fora de `120 .. 132`

### 5. Gaps de sensor precisam ser tolerados

Como ha timestamps com apenas 2 sensores, a tela deve:

- somar o que existir
- marcar integridade parcial se faltar sensor
- evitar `NaN`

### 6. Nao bloquear renderizacao por analytics mais lentos

`demand_peaks` foi o analytics mais lento observado.

Na tela operacional:

- primeiro renderize com bruto recente
- carregue analytics secundarios em paralelo

### 7. Criar testes da Sprint 2 em cima dos fixtures desta pasta

Coberturas minimas recomendadas:

1. render com `channel-lab-1min.json`
2. render com payload vazio default de 24h
3. render com erro `400`
4. render com `isStale = true`
5. render com sensor faltando

## Sequencia recomendada para a proxima LLM

1. Ler o [README.md](/C:/Users/rafat/OneDrive/Área%20de%20Trabalho/Politécnica/quinto/automacao-risco-v2/meat-processing-v2/figma_export/analise-banco-de-dados/README.md)
2. Revisar os tipos e a estrategia de sync da Sprint 1
3. Validar onde `localStorage` esta sendo usado para historico bruto
4. Introduzir ou confirmar `SENSOR_MAP`
5. Implementar ou ajustar `useOperationalData`
6. Ligar a tela operacional com staleness e loading states reais
7. Escrever testes usando os fixtures gerados
8. Checar o [checklist-riscos-sprint-2.md](/C:/Users/rafat/OneDrive/Área%20de%20Trabalho/Politécnica/quinto/automacao-risco-v2/meat-processing-v2/figma_export/analise-banco-de-dados/checklist-riscos-sprint-2.md) antes de considerar a Sprint 2 pronta

## Em uma frase

Trate esta pasta como a camada de realidade do projeto: ela diz o que a API realmente entrega, o que o banco realmente contem e o que precisa mudar na implementacao para o dashboard nao quebrar quando sair do mundo ideal do planejamento.
