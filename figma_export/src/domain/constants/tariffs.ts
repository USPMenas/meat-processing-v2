import type { TariffConfig } from '../types';

export const TARIFFS: readonly TariffConfig[] = Object.freeze([
  { name: 'fora_ponta', startHour: 22, endHour: 6, rate: 0.5 },
  { name: 'intermediaria', startHour: 6, endHour: 18, rate: 0.65 },
  { name: 'ponta', startHour: 18, endHour: 21, rate: 0.85 },
]);

export const LOW_TARIFF_THRESHOLD = 0.6;

export function getTariffForHour(hour: number, tariffTable: readonly TariffConfig[] = TARIFFS): number {
  const normalizedHour = ((hour % 24) + 24) % 24;

  if (normalizedHour >= 22 || normalizedHour < 6) {
    return tariffTable.find((entry) => entry.name === 'fora_ponta')?.rate ?? 0;
  }

  if (normalizedHour >= 18 && normalizedHour < 21) {
    return tariffTable.find((entry) => entry.name === 'ponta')?.rate ?? 0;
  }

  return tariffTable.find((entry) => entry.name === 'intermediaria')?.rate ?? 0;
}

export function getHourlyTariffs(tariffTable: readonly TariffConfig[] = TARIFFS): { hour: number; price: number }[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    price: getTariffForHour(hour, tariffTable),
  }));
}
