import { buildDecisionMatrix } from '@/domain/transformers/decisionTransformer';
import type { DecisionSignals } from '@/domain/types';

function buildSignals(overrides: Partial<DecisionSignals> = {}): DecisionSignals {
  return {
    temperature: -18,
    occupancy: 58,
    freezerEnergy: 8,
    peakOccupancy: 62,
    criticalAlerts: 0,
    warningAlerts: 0,
    infoAlerts: 0,
    isStale: false,
    currentTariff: 0.5,
    nextIdealHour: 22,
    lowEnergyHours: 8,
    energyCost: 8_500,
    projectedEnergyCost: 11_000,
    margin: 32,
    energyCostShare: 0.14,
    isOnline: true,
    isUsingBackup: false,
    dataSource: 'api',
    lastUpdatedAt: new Date(2026, 3, 8, 10, 0, 0),
    ...overrides,
  };
}

describe('decisionTransformer', () => {
  it('recommends operating now when the operation is stable', () => {
    const summary = buildDecisionMatrix(buildSignals());

    expect(summary.recommendedAction).toBe('operate_now');
    expect(summary.rows[0]?.action).toBe('operate_now');
  });

  it('recommends delaying to the next ideal window when tariff is high and the window is near', () => {
    const summary = buildDecisionMatrix(
      buildSignals({
        currentTariff: 0.85,
        nextIdealHour: 12,
        margin: 18,
        energyCostShare: 0.24,
      }),
    );

    expect(summary.recommendedAction).toBe('delay_to_ideal_window');
    expect(summary.priorityBadges).toContain('tarifa de ponta');
  });

  it('recommends maintenance when critical operational alerts are active', () => {
    const summary = buildDecisionMatrix(
      buildSignals({
        temperature: 1,
        occupancy: 97,
        peakOccupancy: 97,
        freezerEnergy: 19,
        criticalAlerts: 2,
        warningAlerts: 1,
        margin: 16,
      }),
    );

    expect(summary.recommendedAction).toBe('schedule_maintenance');
    expect(summary.currentRiskLevel).toBe('high');
  });

  it('recommends redistributing load under moderate operational and energy pressure', () => {
    const summary = buildDecisionMatrix(
      buildSignals({
        temperature: -9,
        occupancy: 78,
        peakOccupancy: 82,
        freezerEnergy: 13,
        warningAlerts: 1,
        currentTariff: 0.85,
        nextIdealHour: 20,
        energyCostShare: 0.29,
        margin: 28,
      }),
    );

    expect(summary.recommendedAction).toBe('redistribute_load');
    expect(summary.secondaryAction).toBeDefined();
  });

  it('keeps ranking deterministic for the same input', () => {
    const signals = buildSignals({
      currentTariff: 0.65,
      nextIdealHour: 18,
      margin: 27,
      energyCostShare: 0.2,
    });

    const first = buildDecisionMatrix(signals);
    const second = buildDecisionMatrix(signals);

    expect(first.rows.map((row) => row.action)).toEqual(
      second.rows.map((row) => row.action),
    );
    expect(first.rows[0]?.totalScore).toBeGreaterThanOrEqual(
      first.rows[1]?.totalScore ?? 0,
    );
  });
});
