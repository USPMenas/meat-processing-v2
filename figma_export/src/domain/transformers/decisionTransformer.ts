import { LOW_TARIFF_THRESHOLD } from '../constants/tariffs';
import type {
  DecisionActionId,
  DecisionCriterionScore,
  DecisionMatrixRow,
  DecisionMatrixSummary,
  DecisionRiskLevel,
  DecisionSignals,
} from '../types';
import { clamp, round } from './deterministic';

const DECISION_CRITERIA = Object.freeze([
  { key: 'safety', label: 'Seguranca operacional', weight: 40 },
  { key: 'efficiency', label: 'Eficiência energética', weight: 25 },
  { key: 'logistics', label: 'Impacto logístico', weight: 20 },
  { key: 'financial', label: 'Impacto financeiro', weight: 15 },
]);

const ACTION_LABELS: Record<DecisionActionId, string> = {
  operate_now: 'Operar agora',
  delay_to_ideal_window: 'Adiar para a próxima janela ideal',
  redistribute_load: 'Redistribuir carga entre equipamentos',
  schedule_maintenance: 'Acionar manutenção preventiva',
};

function buildEmptyCriteria(): DecisionCriterionScore[] {
  return DECISION_CRITERIA.map((criterion) => ({
    criterion: criterion.label,
    score: 0,
    weight: criterion.weight,
    weightedScore: 0,
    rationale: 'Sem dados suficientes para avaliar este critério.',
  }));
}

export function createEmptyDecisionSummary(
  message = 'A matriz de decisão será exibida assim que houver dados consolidados das três áreas.',
): DecisionMatrixSummary {
  return {
    currentRiskLevel: 'medium',
    recommendedAction: null,
    secondaryAction: null,
    rows: (Object.keys(ACTION_LABELS) as DecisionActionId[]).map((action) => ({
      action,
      label: ACTION_LABELS[action],
      scores: buildEmptyCriteria(),
      totalScore: 0,
      recommendation: 'watch',
      rationale: 'Aguardando dados operacionais, logísticos e financeiros.',
    })),
    executiveMessage: message,
    reviewCondition: 'Revisar assim que o twin voltar a entregar leituras utilizáveis.',
    priorityBadges: ['dados insuficientes'],
  };
}

function getTemperatureRisk(temperature: number | null): number {
  if (temperature === null) {
    return 45;
  }

  if (temperature >= -2) {
    return 95;
  }

  if (temperature >= -8) {
    return 65;
  }

  return 18;
}

function getOccupancyRisk(occupancy: number | null): number {
  if (occupancy === null) {
    return 40;
  }

  if (occupancy >= 95) {
    return 96;
  }

  if (occupancy >= 85) {
    return 72;
  }

  if (occupancy >= 70) {
    return 48;
  }

  return 15;
}

function getFreezerRisk(freezerEnergy: number | null): number {
  if (freezerEnergy === null) {
    return 35;
  }

  if (freezerEnergy >= 18) {
    return 78;
  }

  if (freezerEnergy >= 14) {
    return 52;
  }

  return 18;
}

function getTariffPressure(currentTariff: number): number {
  if (currentTariff < LOW_TARIFF_THRESHOLD) {
    return 20;
  }

  if (currentTariff < 0.8) {
    return 55;
  }

  return 90;
}

function getMarginPressure(margin: number): number {
  if (margin < 15) {
    return 85;
  }

  if (margin < 25) {
    return 65;
  }

  if (margin < 35) {
    return 45;
  }

  return 20;
}

function getEnergyCostSharePressure(energyCostShare: number): number {
  if (energyCostShare >= 0.35) {
    return 80;
  }

  if (energyCostShare >= 0.25) {
    return 60;
  }

  if (energyCostShare >= 0.15) {
    return 40;
  }

  return 20;
}

function getHoursUntil(referenceDate: Date | null, targetHour: number): number {
  const referenceHour = (referenceDate ?? new Date()).getHours();
  return ((targetHour - referenceHour) % 24 + 24) % 24;
}

function getWaitingOpportunity(signals: DecisionSignals): number {
  if (signals.nextIdealHour === null) {
    return 0;
  }

  if (signals.currentTariff < LOW_TARIFF_THRESHOLD) {
    return 15;
  }

  const hoursUntil = getHoursUntil(signals.lastUpdatedAt, signals.nextIdealHour);

  if (hoursUntil <= 2) {
    return 100;
  }

  if (hoursUntil <= 4) {
    return 80;
  }

  if (hoursUntil <= 8) {
    return 60;
  }

  if (hoursUntil <= 12) {
    return 40;
  }

  return 25;
}

function getOperationalRiskIndex(signals: DecisionSignals): number {
  const temperatureRisk = getTemperatureRisk(signals.temperature);
  const occupancyRisk = getOccupancyRisk(signals.occupancy);
  const freezerRisk = getFreezerRisk(signals.freezerEnergy);
  const alertPressure = clamp(
    signals.criticalAlerts * 30 +
      signals.warningAlerts * 16 +
      signals.infoAlerts * 8,
    0,
    100,
  );
  const stalenessRisk = signals.isStale ? 70 : 0;
  const backupRisk = signals.isUsingBackup ? 35 : 0;

  return round(
    clamp(
      temperatureRisk * 0.22 +
        occupancyRisk * 0.18 +
        freezerRisk * 0.15 +
        alertPressure * 0.25 +
        stalenessRisk * 0.15 +
        backupRisk * 0.05,
      0,
      100,
    ),
    1,
  );
}

function toRiskLevel(riskIndex: number): DecisionRiskLevel {
  if (riskIndex >= 65) {
    return 'high';
  }

  if (riskIndex >= 35) {
    return 'medium';
  }

  return 'low';
}

function clampScore(value: number): number {
  return round(clamp(value, 0, 100), 1);
}

function buildCriteria(scores: {
  safety: { score: number; rationale: string };
  efficiency: { score: number; rationale: string };
  logistics: { score: number; rationale: string };
  financial: { score: number; rationale: string };
}): DecisionCriterionScore[] {
  return DECISION_CRITERIA.map((criterion) => {
    const entry = scores[criterion.key as keyof typeof scores];
    const score = clampScore(entry.score);
    const weightedScore = round((score * criterion.weight) / 100, 1);

    return {
      criterion: criterion.label,
      score,
      weight: criterion.weight,
      weightedScore,
      rationale: entry.rationale,
    };
  });
}

function getRecommendation(score: number, highestScore: number): DecisionMatrixRow['recommendation'] {
  if (score === highestScore) {
    return 'recommended';
  }

  if (highestScore - score <= 15 && score >= 45) {
    return 'watch';
  }

  return 'avoid';
}

function buildExecutiveMessage(recommendedAction: DecisionActionId | null, riskLevel: DecisionRiskLevel): string {
  if (!recommendedAction) {
    return 'Sem dados suficientes para recomendar uma ação operacional neste momento.';
  }

  if (recommendedAction === 'operate_now') {
    return riskLevel === 'low'
      ? 'O twin indica operação estável; a recomendação é seguir operando com monitoramento contínuo.'
      : 'Apesar da pressão moderada, os sinais ainda sustentam continuidade operacional com atenção reforçada.';
  }

  if (recommendedAction === 'delay_to_ideal_window') {
    return 'A melhor decisão é segurar o processamento e capturar a próxima janela tarifária favorável.';
  }

  if (recommendedAction === 'redistribute_load') {
    return 'A matriz aponta melhor equilíbrio entre custo e continuidade ao redistribuir a carga operacional.';
  }

  return 'Os sinais do twin sugerem preservar a operação acionando manutenção preventiva antes de ampliar a carga.';
}

function buildReviewCondition(recommendedAction: DecisionActionId | null, signals: DecisionSignals): string {
  if (recommendedAction === 'operate_now') {
    return 'Revisar se a ocupação passar de 85%, surgirem alertas críticos ou a tarifa migrar para ponta.';
  }

  if (recommendedAction === 'delay_to_ideal_window') {
    return signals.nextIdealHour === null
      ? 'Revisar quando a tarifa atual aliviar ou o risco operacional mudar.'
      : `Revisar ao chegar ${String(signals.nextIdealHour).padStart(2, '0')}h ou antes, se o risco operacional subir.`;
  }

  if (recommendedAction === 'redistribute_load') {
    return 'Revisar após a redistribuição de carga ou se a ocupação seguir subindo na janela atual.';
  }

  if (recommendedAction === 'schedule_maintenance') {
    return 'Revisar após estabilização dos alertas críticos e nova leitura confiável do twin.';
  }

  return 'Revisar assim que o twin consolidar novos dados.';
}

function buildPriorityBadges(
  riskLevel: DecisionRiskLevel,
  signals: DecisionSignals,
  waitingOpportunity: number,
): string[] {
  const badges: string[] = [];

  badges.push(
    riskLevel === 'high'
      ? 'risco alto'
      : riskLevel === 'medium'
        ? 'risco moderado'
        : 'risco controlado',
  );

  if (signals.currentTariff >= 0.8) {
    badges.push('tarifa de ponta');
  } else if (signals.currentTariff < LOW_TARIFF_THRESHOLD) {
    badges.push('tarifa baixa');
  }

  if (waitingOpportunity >= 60 && signals.nextIdealHour !== null) {
    badges.push(`janela ideal ${String(signals.nextIdealHour).padStart(2, '0')}h`);
  }

  if (signals.margin < 25) {
    badges.push('margem pressionada');
  }

  if (signals.isUsingBackup) {
    badges.push('dados de backup');
  }

  return badges.slice(0, 3);
}

function buildRows(signals: DecisionSignals) {
  const operationalRiskIndex = getOperationalRiskIndex(signals);
  const tariffPressure = getTariffPressure(signals.currentTariff);
  const waitingOpportunity = getWaitingOpportunity(signals);
  const energyCostSharePressure = getEnergyCostSharePressure(signals.energyCostShare);
  const marginPressure = getMarginPressure(signals.margin);
  const financialPressure = round(
    energyCostSharePressure * 0.55 + marginPressure * 0.45,
    1,
  );
  const moderateRiskBonus =
    operationalRiskIndex >= 35 && operationalRiskIndex <= 75 ? 18 : 0;
  const alertPressure = clamp(
    signals.criticalAlerts * 30 +
      signals.warningAlerts * 16 +
      signals.infoAlerts * 8,
    0,
    100,
  );
  const occupancyPressure = Math.max(signals.peakOccupancy, signals.occupancy ?? 0);
  const freezerRisk = getFreezerRisk(signals.freezerEnergy);

  const rowInputs: Array<{
    action: DecisionActionId;
    scores: ReturnType<typeof buildCriteria>;
    rationale: string;
  }> = [
    {
      action: 'operate_now',
      scores: buildCriteria({
        safety: {
          score: 92 - operationalRiskIndex * 0.8 - signals.criticalAlerts * 8,
          rationale:
            operationalRiskIndex < 35
              ? 'Os sinais térmicos e de ocupação seguem controlados para manter a operação.'
              : 'A operação ainda é viável, mas o risco já reduz a folga operacional.',
        },
        efficiency: {
          score:
            78 -
            tariffPressure * 0.55 +
            (signals.currentTariff < LOW_TARIFF_THRESHOLD ? 10 : 0),
          rationale:
            signals.currentTariff < LOW_TARIFF_THRESHOLD
              ? 'A tarifa atual está favorável para manter a carga em operação.'
              : 'A tarifa atual reduz a eficiência de seguir operando sem ajuste.',
        },
        logistics: {
          score:
            80 -
            waitingOpportunity * 0.35 -
            Math.max(0, occupancyPressure - 80) * 0.45,
          rationale:
            occupancyPressure < 85
              ? 'A ocupação atual permite manter o fluxo logístico sem represamento.'
              : 'A ocupação alta reduz a segurança logística de seguir no ritmo atual.',
        },
        financial: {
          score:
            68 +
            Math.max(signals.margin - 20, 0) * 0.6 -
            tariffPressure * 0.35 -
            financialPressure * 0.2,
          rationale:
            signals.margin >= 25
              ? 'A margem atual suporta a continuidade sem perda financeira relevante.'
              : 'Com margem pressionada, operar agora traz menor conforto financeiro.',
        },
      }),
      rationale:
        operationalRiskIndex < 35
          ? 'Melhor escolha quando o twin indica estabilidade operacional e a janela atual não penaliza o custo.'
          : 'Alternativa possível, mas com folga menor diante da pressão operacional atual.',
    },
    {
      action: 'delay_to_ideal_window',
      scores: buildCriteria({
        safety: {
          score: 82 - operationalRiskIndex * 0.85 - signals.criticalAlerts * 10,
          rationale:
            operationalRiskIndex < 35
              ? 'Adiar é seguro porque o risco operacional está controlado no momento.'
              : 'O risco atual limita o quanto a operação pode esperar sem intervenção.',
        },
        efficiency: {
          score: 28 + waitingOpportunity * 0.75 + tariffPressure * 0.2,
          rationale:
            waitingOpportunity >= 60
              ? 'Há ganho energético claro ao aguardar a próxima faixa tarifária econômica.'
              : 'Sem janela econômica próxima, o benefício energético de esperar é limitado.',
        },
        logistics: {
          score:
            40 +
            waitingOpportunity * 0.45 -
            Math.max(0, occupancyPressure - 75) * 0.55,
          rationale:
            occupancyPressure < 75
              ? 'A ocupação atual permite segurar a operação sem impacto logístico grave.'
              : 'O acúmulo de ocupação reduz o espaço para adiar a carga com segurança.',
        },
        financial: {
          score: 38 + waitingOpportunity * 0.35 + financialPressure * 0.35,
          rationale:
            signals.currentTariff >= 0.8
              ? 'Esperar protege margem quando a operação está em tarifa de ponta.'
              : 'O ganho financeiro existe, mas é menor quando a tarifa atual não está no pico.',
        },
      }),
      rationale:
        waitingOpportunity >= 60
          ? 'Mais forte quando a tarifa atual está cara e a próxima janela ideal está próxima.'
          : 'Alternativa útil apenas se o custo atual estiver pressionando mais que a operação.',
    },
    {
      action: 'redistribute_load',
      scores: buildCriteria({
        safety: {
          score: 58 + moderateRiskBonus - signals.criticalAlerts * 12,
          rationale:
            moderateRiskBonus > 0
              ? 'Redistribuir carga ajuda quando a pressão operacional é moderada, sem colapso térmico.'
              : 'Sem pressão intermediária clara, o ganho operacional dessa ação fica menor.',
        },
        efficiency: {
          score:
            48 + tariffPressure * 0.35 + energyCostSharePressure * 0.25,
          rationale:
            energyCostSharePressure >= 40
              ? 'A participação da energia no custo justifica buscar eficiência sem parar a operação.'
              : 'A energia ainda não domina o custo a ponto de tornar essa ação prioritária.',
        },
        logistics: {
          score: 70 - Math.max(0, occupancyPressure - 85) * 0.25,
          rationale:
            occupancyPressure < 90
              ? 'Mantém continuidade logística melhor do que parar ou esperar demais.'
              : 'Com ocupação muito alta, a redistribuição sozinha pode não aliviar o fluxo.',
        },
        financial: {
          score:
            54 + financialPressure * 0.25 + energyCostSharePressure * 0.15,
          rationale:
            signals.energyCostShare >= 0.2
              ? 'Tem bom potencial para aliviar custo sem sacrificar todo o throughput.'
              : 'O impacto financeiro melhora, mas não tanto quanto em cenários de custo energético mais pesado.',
        },
      }),
      rationale:
        moderateRiskBonus > 0
          ? 'Boa resposta intermediária para aliviar pressão energética sem interromper a operação.'
          : 'Funciona melhor como ajuste fino quando o twin sugere pressão, mas não emergência.',
    },
    {
      action: 'schedule_maintenance',
      scores: buildCriteria({
        safety: {
          score: 18 + operationalRiskIndex * 0.95 + signals.criticalAlerts * 12,
          rationale:
            operationalRiskIndex >= 65
              ? 'Os sinais operacionais já apontam risco alto o suficiente para priorizar manutenção.'
              : 'Sem risco elevado, essa ação tende a ser conservadora demais para o momento.',
        },
        efficiency: {
          score: 25 + freezerRisk * 0.45 + alertPressure * 0.25,
          rationale:
            freezerRisk >= 50
              ? 'Há indício de perda de eficiência ou anomalia no congelamento que justifica manutenção.'
              : 'Sem desvio importante de energia ou alertas, o ganho energético imediato é menor.',
        },
        logistics: {
          score: 22 + operationalRiskIndex * 0.28 - waitingOpportunity * 0.1,
          rationale:
            operationalRiskIndex >= 65
              ? 'A disrupção logística compensa quando o risco de seguir operando fica alto.'
              : 'O custo logístico de parar ainda pesa quando o risco operacional não está crítico.',
        },
        financial: {
          score: 20 + operationalRiskIndex * 0.35 + financialPressure * 0.18,
          rationale:
            signals.margin < 25
              ? 'Evitar perdas maiores e falhas ajuda a proteger uma margem já pressionada.'
              : 'Financeiramente é uma defesa contra perda futura, não uma otimização imediata.',
        },
      }),
      rationale:
        operationalRiskIndex >= 65
          ? 'A recomendação ganha força quando alertas, staleness ou anomalias do freezer já ameaçam a operação.'
          : 'É a alternativa mais conservadora e só sobe quando o twin deixa claro que seguir operando aumenta o risco.',
    },
  ];

  const unsortedRows = rowInputs.map(({ action, scores, rationale }) => ({
    action,
    label: ACTION_LABELS[action],
    scores,
    totalScore: round(sumWeightedScores(scores), 1),
    rationale,
  }));
  const rows = unsortedRows
    .slice()
    .sort((left, right) => {
      if (right.totalScore !== left.totalScore) {
        return right.totalScore - left.totalScore;
      }

      return left.label.localeCompare(right.label, 'pt-BR');
    })
    .map((row, index, sortedRows) => ({
      ...row,
      recommendation: getRecommendation(row.totalScore, sortedRows[0]?.totalScore ?? 0),
      rationale:
        index === 0
          ? `${row.rationale} Esta é a melhor resposta para o cenário atual.`
          : row.rationale,
    }));

  return {
    rows,
    operationalRiskIndex,
    waitingOpportunity,
  };
}

function sumWeightedScores(scores: DecisionCriterionScore[]): number {
  return scores.reduce((total, score) => total + score.weightedScore, 0);
}

export function buildDecisionMatrix(signals: DecisionSignals): DecisionMatrixSummary {
  const { rows, operationalRiskIndex, waitingOpportunity } = buildRows(signals);
  const riskLevel = toRiskLevel(operationalRiskIndex);
  const recommendedRow = rows[0] ?? null;
  const secondaryRow = rows[1] ?? null;

  return {
    currentRiskLevel: riskLevel,
    recommendedAction: recommendedRow?.action ?? null,
    secondaryAction: secondaryRow?.action ?? null,
    rows,
    executiveMessage: buildExecutiveMessage(recommendedRow?.action ?? null, riskLevel),
    reviewCondition: buildReviewCondition(recommendedRow?.action ?? null, signals),
    priorityBadges: buildPriorityBadges(riskLevel, signals, waitingOpportunity),
  };
}

export function getDecisionActionLabel(action: DecisionActionId | null): string {
  if (!action) {
    return 'Sem recomendação';
  }

  return ACTION_LABELS[action];
}
