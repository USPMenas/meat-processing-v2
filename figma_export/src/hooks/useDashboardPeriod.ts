import { useEffect, useState } from 'react';
import {
  DASHBOARD_PERIOD_STORAGE_KEY,
} from '../config/periods';
import type { OperationalChartPeriod } from '../domain/types';

function getBrowserStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storageCandidate = window.localStorage as Partial<Storage> | undefined;

  if (
    storageCandidate &&
    typeof storageCandidate.getItem === 'function' &&
    typeof storageCandidate.setItem === 'function'
  ) {
    return storageCandidate as Pick<Storage, 'getItem' | 'setItem'>;
  }

  return null;
}

function readInitialPeriod(): OperationalChartPeriod {
  const value = getBrowserStorage()?.getItem(DASHBOARD_PERIOD_STORAGE_KEY);

  if (value === '24h' || value === '7d' || value === '30d') {
    return value;
  }

  return '24h';
}

export function useDashboardPeriod(): [
  OperationalChartPeriod,
  (period: OperationalChartPeriod) => void,
] {
  const [period, setPeriod] = useState<OperationalChartPeriod>(readInitialPeriod);

  useEffect(() => {
    getBrowserStorage()?.setItem(DASHBOARD_PERIOD_STORAGE_KEY, period);
  }, [period]);

  return [period, setPeriod];
}
