import type { OperationalChartPeriod } from '../domain/types';

export const DASHBOARD_PERIOD_STORAGE_KEY = 'frigorifico_dashboard_period';

export const DASHBOARD_PERIOD_OPTIONS: Array<{
  label: string;
  shortLabel: string;
  value: OperationalChartPeriod;
}> = [
  { label: 'Ultimas 24 horas', shortLabel: '24h', value: '24h' },
  { label: 'Ultimos 7 dias', shortLabel: '7d', value: '7d' },
  { label: 'Ultimo mes', shortLabel: '30d', value: '30d' },
];

export const DASHBOARD_PERIOD_HOURS: Record<OperationalChartPeriod, number> = {
  '24h': 24,
  '7d': 7 * 24,
  '30d': 30 * 24,
};

export const DASHBOARD_PERIOD_DAYS: Record<OperationalChartPeriod, number> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
};

export function getPeriodLabel(period: OperationalChartPeriod): string {
  return (
    DASHBOARD_PERIOD_OPTIONS.find((option) => option.value === period)?.label ??
    DASHBOARD_PERIOD_OPTIONS[0].label
  );
}

export function getPeriodShortLabel(period: OperationalChartPeriod): string {
  return (
    DASHBOARD_PERIOD_OPTIONS.find((option) => option.value === period)?.shortLabel ??
    DASHBOARD_PERIOD_OPTIONS[0].shortLabel
  );
}
