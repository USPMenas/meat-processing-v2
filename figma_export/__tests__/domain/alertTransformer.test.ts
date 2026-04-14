import { DEFAULT_THRESHOLD_CONFIG } from '@/domain/constants/thresholds';
import { checkAlerts } from '@/domain/transformers/alertTransformer';

describe('alertTransformer', () => {
  it('raises a critical temperature alert', () => {
    const alerts = checkAlerts(
      {
        temperature: 0.5,
        freezerEnergy: 10,
        occupancy: 60,
      },
      { ...DEFAULT_THRESHOLD_CONFIG },
    );

    expect(alerts[0]).toMatchObject({
      type: 'critical',
      variable: 'Temperatura',
    });
  });

  it('includes electrical health alerts when voltage and power factor are abnormal', () => {
    const alerts = checkAlerts(
      {
        temperature: -18,
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
        temperature: -18,
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
