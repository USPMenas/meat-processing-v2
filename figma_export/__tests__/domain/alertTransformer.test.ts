import { DEFAULT_THRESHOLD_CONFIG } from '@/domain/constants/thresholds';
import { checkAlerts } from '@/domain/transformers/alertTransformer';

describe('alertTransformer', () => {
  it('does not raise temperature alerts inside the ideal range', () => {
    const alerts = checkAlerts(
      {
        temperature: 0.9,
        freezerEnergy: 10,
        occupancy: 60,
      },
      { ...DEFAULT_THRESHOLD_CONFIG },
    );

    expect(alerts).toEqual([]);
  });

  it('raises a warning when the temperature goes above the ideal range', () => {
    const alerts = checkAlerts(
      {
        temperature: 2.1,
        freezerEnergy: 10,
        occupancy: 60,
      },
      { ...DEFAULT_THRESHOLD_CONFIG },
    );

    expect(alerts[0]).toMatchObject({
      type: 'warning',
      variable: 'Temperatura',
      message: 'Temperatura acima da faixa ideal',
      expected: '0°C (faixa ideal: -2°C a +2°C)',
    });
  });

  it('raises a warning when the temperature goes below the ideal range', () => {
    const alerts = checkAlerts(
      {
        temperature: -2.1,
        freezerEnergy: 10,
        occupancy: 60,
      },
      { ...DEFAULT_THRESHOLD_CONFIG },
    );

    expect(alerts[0]).toMatchObject({
      type: 'warning',
      variable: 'Temperatura',
      message: 'Temperatura abaixo da faixa ideal',
      expected: '0°C (faixa ideal: -2°C a +2°C)',
    });
  });

  it('includes electrical health alerts when voltage and power factor are abnormal', () => {
    const alerts = checkAlerts(
      {
        temperature: 0,
        freezerEnergy: 10,
        occupancy: 60,
        voltage: 118,
        powerFactor: 0.8,
      },
      { ...DEFAULT_THRESHOLD_CONFIG },
    );

    expect(alerts).toEqual(
      expect.arrayContaining([expect.objectContaining({ variable: 'Tensao' })]),
    );
  });

  it('only raises power factor alerts when a calibrated threshold is provided', () => {
    const alerts = checkAlerts(
      {
        temperature: 0,
        freezerEnergy: 10,
        occupancy: 60,
        powerFactor: 0.8,
      },
      {
        ...DEFAULT_THRESHOLD_CONFIG,
        powerFactorMin: 0.85,
      },
    );

    expect(alerts).toEqual(
      expect.arrayContaining([expect.objectContaining({ variable: 'Fator de Potencia' })]),
    );
  });
});
