# Checklist de riscos da Sprint 2

Use esta lista antes de considerar a Sprint 2 pronta.

- [ ] O client sempre envia `from_time` e `to_time` explicitamente; nao depende da janela default de 24h
- [ ] O estado "live" nao aparece quando o ultimo dado esta velho
- [ ] Existe tratamento explicito para payload valido com `count = 0` e `results = []`
- [ ] O mapeamento de sensores esta configuravel e nao hardcoded sem fallback
- [ ] `fase3` foi revisado como candidato a "congelador" e `fase1 + fase2` como "equipamentos"
- [ ] `hourly_profile.hour` esta tipado como string (`"00"` .. `"23"`)
- [ ] Erro `400` com campo `detail` esta tratado no client; nao assumir apenas `422`
- [ ] O client trata canal invalido retornando `200` vazio em vez de `404`
- [ ] A tela operacional nao tenta puxar dias inteiros de bruto sem necessidade
- [ ] O cache de bruto recente foi dimensionado para minutos/horas, nao para meses
- [ ] O projeto ja decidiu se vai usar `IndexedDB`, agregacao ou recorte em vez de `localStorage` para historico
- [ ] Alertas de tensao usam faixa compativel com rede de `127V`, nao os defaults `198/242`
- [ ] Alertas de fator de potencia nao usam threshold global sem calibracao por sensor
- [ ] A UI lida com timestamps sem timezone de forma consistente
- [ ] A soma de sensores tolera timestamps com `2` sensores sem quebrar cards e graficos
- [ ] Gaps grandes de serie nao geram extrapolacao enganosa
- [ ] `demand_peaks` nao bloqueia a renderizacao inicial da tela operacional
- [ ] Fixtures reais desta pasta estao plugados em testes unitarios/integracao
- [ ] Existe teste cobrindo resposta vazia por staleness
- [ ] Existe teste cobrindo erro de data invalida
