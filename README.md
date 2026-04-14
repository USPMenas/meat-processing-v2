# Sistema de Monitoramento de um Frigorífico

Projeto desenvolvido para a disciplina `PCS3819` com o objetivo de transformar dados elétricos reais de um laboratório em uma réplica digital simplificada de um frigorífico, permitindo o acompanhamento operacional, logístico e estratégico da planta.

O sistema consome medições elétricas da API do laboratório, aplica regras de transformação de domínio e apresenta três visões principais:

- `Operacional`: consumo, temperatura inferida, ocupação inferida e alertas.
- `Logística`: custo energético por horário, ocupação e janelas operacionais.
- `Negócios`: receita estimada, custos, perdas e margem operacional.

## Grupo:
- Rafael de Almeida Innecco — 12550535

- Hélcio Prado de Lima — 10770238

- Rafael Menas Tamasi — 12553775

- Guilherme Seiki Kobayashi Kiyama — 10772904


## Estrutura do projeto

O código principal da aplicação está na pasta:

```text
meat-processing-v2/figma_export
```

Ela contém:

- frontend React + Vite
- função de proxy para produção na Vercel
- scripts auxiliares
- testes automatizados
- snapshot de backup para operação resiliente

## Como rodar o projeto localmente

### Pré-requisitos

- `Node.js` 20+ recomendado
- `npm`
- `Python 3` apenas se for necessário regenerar o snapshot de backup

### 1. Entrar na pasta da aplicação

```bash
cd meat-processing-v2/figma_export
```

### 2. Instalar as dependências

```bash
npm install
```

### 3. Subir o ambiente de desenvolvimento

```bash
npm run dev
```

Por padrão, o Vite sobe a aplicação em algo como:

```text
http://localhost:5173
```

### 4. Como a aplicação acessa a API

Em desenvolvimento, o frontend usa o prefixo same-origin `/api` e o `vite.config.ts` faz o proxy local para a API real do laboratório.

Isso evita problemas de `CORS` no navegador.

Se for necessário sobrescrever a base da API manualmente, use:

```bash
VITE_API_BASE_URL=/api
```

Recomendação: para ambiente browser, manter `/api` em vez de URL absoluta.

## Scripts úteis

Dentro de `meat-processing-v2/figma_export`:

- `npm run dev`: sobe o projeto em modo desenvolvimento
- `npm run build`: gera a build de produção
- `npm run test`: executa a suíte de testes
- `npm run test:watch`: executa testes em modo observação
- `npm run test:coverage`: gera cobertura de testes
- `npm run lint`: executa lint
- `npm run generate:backup-snapshot`: regenera o snapshot de backup usado no fallback offline/backup

## Como gerar a build final

```bash
cd meat-processing-v2/figma_export
npm install
npm run build
```

Os arquivos finais ficam em:

```text
meat-processing-v2/figma_export/dist
```

## O que o projeto faz

O projeto modela um frigorífico digital simplificado a partir de medições elétricas reais do laboratório. Como a API original não fornece temperatura real, ocupação real, receita ou margem, essas variáveis são inferidas por regras de negócio implementadas no frontend.

Em outras palavras, o sistema não é apenas um painel de energia. Ele converte sinais elétricos em indicadores operacionais e financeiros.

## Metodologia de modelagem

### 1. Mapeamento dos sensores

O sistema trabalha com três canais elétricos principais:

- `fase3`: modelada como carga de refrigeração
- `fase1` e `fase2`: modeladas como carga operacional dos equipamentos/processo

Interpretação adotada:

- `fase3` representa o esforço para manter a câmara refrigerada
- `fase1` e `fase2` representam a atividade do processo, como equipamentos, movimentação e operação da planta

Esse mapeamento foi adotado porque a `fase3` apresentou comportamento mais estável ao longo do tempo, enquanto `fase1` e `fase2` tiveram maior variabilidade operacional.

### 2. Variáveis medidas diretamente

As variáveis abaixo são obtidas diretamente ou quase diretamente da API:

- consumo de energia da refrigeração
- consumo de energia dos equipamentos
- corrente elétrica
- potência ativa
- tensão
- fator de potência

Esses dados são a base de todas as demais transformações.

### 3. Variáveis inferidas

As variáveis abaixo são derivadas e não existem diretamente na API:

- temperatura
- ocupação
- produção estimada
- receita bruta
- custo de perdas
- margem operacional

## Cálculo das principais variáveis

### Energia da refrigeração

```text
energia_refrigeracao = active_power(fase3)
```

### Energia dos equipamentos

```text
energia_equipamentos = active_power(fase1) + active_power(fase2)
```

### Conversão de potência em energia

Para transformar potência em energia consumida:

```text
Energia (kWh) = Potência média (kW) x intervalo de tempo (h)
```

Essa conversão é usada nas análises históricas e financeiras.

### Temperatura inferida

A temperatura é inferida a partir da potência da `fase3`.

Fórmula:

```text
temperatura = baseTemperature + (activePower - avgPower) * sensitivityFactor
temperatura_final = clamp(temperatura, minTemperature, maxTemperature)
```

Parâmetros usados:

- `baseTemperature = 0`
- `avgPower = 7,95`
- `sensitivityFactor = 2,5 / (10 - 5,36) ≈ 0,54`
- `minTemperature = -2`
- `maxTemperature = 2`

Interpretação:

- `0°C` é o valor esperado do sistema
- a faixa ideal adotada é `-2°C` a `+2°C`
- a temperatura nunca sai desse intervalo porque o modelo aplica `clamp`

### Ocupação inferida

A ocupação operacional é inferida a partir da corrente dos sensores `fase1` e `fase2`.

Lógica adotada:

- quanto maior a corrente nos equipamentos, maior a atividade operacional estimada
- quanto menor a corrente, menor a ocupação/atividade estimada

No modelo, a ocupação é normalizada para a faixa de `0%` a `100%`.

### Fator energético do processo

Para converter energia consumida em quantidade processada estimada, o projeto usa:

```text
fator energetico = 2,4 kWh/kg
```

Assim:

```text
kg processados estimados = kWh consumidos / 2,4
```

Esse valor é uma premissa de modelagem do negócio, usada para converter intensidade energética em volume processado estimado.

### Receita bruta

O projeto considera:

- `preço médio de venda = R$ 16,00/kg`

Logo:

```text
receita_bruta = kg_processados * 16
```

Substituindo o cálculo de produção:

```text
receita_bruta = (kWh / 2,4) * 16
```

Ou seja, no modelo:

```text
receita_bruta ≈ kWh * 6,67
```

### Custo energético

O custo energético é calculado com base nas tarifas horárias.

Faixas tarifárias configuradas:

- `fora de ponta`: `R$ 0,50/kWh`
- `intermediária`: `R$ 0,65/kWh`
- `ponta`: `R$ 0,85/kWh`

O sistema tenta respeitar em qual horário o consumo ocorreu, em vez de aplicar uma tarifa média única.

### Custo de perdas

Foi assumido que:

- `5%` do volume processado é perdido

E que:

- `custo do produto = R$ 11,00/kg`

Assim:

```text
perda_kg = kg_processados * 0,05
custo_perda = perda_kg * 11
```

### Custos fixos

Custos fixos mensais modelados:

- folha salarial: `R$ 22.000,00/mês`
- manutenção: `R$ 4.500,00/mês`
- aluguel: `R$ 12.000,00/mês`

Esses custos são rateados proporcionalmente ao período visualizado no dashboard.

### Margem operacional

Fórmula conceitual:

```text
Margem operacional = [Receita - (custos fixos rateados + custos variáveis)] / Receita
```

Onde os custos variáveis incluem principalmente:

- custo energético
- custo de perdas

## Por que os gráficos históricos mudam quando a API atualiza

Esse é um comportamento esperado do modelo.

Os gráficos históricos não funcionam como um histórico contábil imutável. Eles são reconstruídos a partir da base mais recente de medições e de regras de agregação.

Isso acontece porque o sistema:

- reage à chegada de novos dados da API
- reorganiza as medições em buckets temporais, como hora, dia, semana e mês
- recalcula médias por período
- recalcula variáveis derivadas, como temperatura e ocupação
- recalcula indicadores financeiros derivados, como custo, receita e margem

Em especial:

- a temperatura é inferida a partir da potência da `fase3`
- a ocupação é inferida a partir da corrente das `fase1` e `fase2`
- a receita depende do consumo energético convertido em produção estimada
- o custo depende do horário em que o consumo foi distribuído

Por isso, ao entrar dado novo da API, o histórico recente pode mudar de forma perceptível.

Resumo metodológico:

- o histórico exibido é dinâmico e analítico
- ele representa uma reconstrução baseada nos dados mais recentes
- ele não deve ser interpretado como um fechamento financeiro definitivo

## Resiliência e fallback

O sistema foi projetado para continuar utilizável mesmo quando a API não entrega dados recentes.

Estratégia adotada:

- tentativa de leitura recente da API
- busca retroativa em blocos de `6 horas`
- lookback de até `48 horas`
- fallback para snapshot de backup quando não há dados utilizáveis

Isso permite manter o dashboard funcional mesmo com instabilidade de coleta.

## Observações importantes

- Temperatura e ocupação são variáveis inferidas, não medições físicas diretas
- Receita, perdas e margem são indicadores simulados com base em regras do modelo
- O projeto representa um digital twin simplificado, com foco em monitoramento e apoio à decisão

## Fluxo recomendado para avaliação final

### Rodar localmente

```bash
cd meat-processing-v2/figma_export
npm install
npm run dev
```

### Validar build

```bash
npm run build
```

### Validar testes

```bash
npm run test
```

## Entrega

Para entrega em `.zip`, recomenda-se compactar a pasta:

```text
meat-processing-v2
```

Se a entrega exigir um pacote mais leve, pode ser interessante remover `node_modules` antes de compactar e deixar explícito que as dependências devem ser reinstaladas com `npm install`.
