import { useMemo } from 'react';
import { FRIGORIFICO_CHANNEL } from '../config/channels';
import { getTariffForHour } from '../domain/constants/tariffs';
import {
  buildDecisionMatrix,
  createEmptyDecisionSummary,
} from '../domain/transformers/decisionTransformer';
import type {
  DecisionMatrixSummary,
  DecisionSignals,
  DecisionSourceStatus,
  OperationalChartPeriod,
} from '../domain/types';
import { useBusinessData } from './useBusinessData';
import { useLogisticsData } from './useLogisticsData';
import { useRealtimeData } from './useRealtimeData';

interface DecisionSyncContext {
  isLoading: boolean;
  isOnline: boolean;
  isUsingBackup: boolean;
  dataSource: DecisionSourceStatus['dataSource'];
  lastDataTimestamp: Date | null;
  error: string | null;
}

export function useDecisionMatrix(
  channel = FRIGORIFICO_CHANNEL,
  period: OperationalChartPeriod = '24h',
  sync: DecisionSyncContext,
): {
  summary: DecisionMatrixSummary;
  rows: DecisionMatrixSummary['rows'];
  signals: DecisionSignals;
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: Date | null;
  sourceStatus: DecisionSourceStatus;
} {
  const realtime = useRealtimeData(channel);
  const logistics = useLogisticsData(channel, period);
  const business = useBusinessData(channel, period);

  return useMemo(() => {
    const lastUpdatedAt =
      realtime.data?.timestamp ??
      business.referenceDate ??
      sync.lastDataTimestamp ??
      null;
    const tariffReferenceDate = lastUpdatedAt ?? new Date();
    const alertCounts = realtime.alerts.reduce(
      (counts, alert) => {
        if (alert.type === 'critical') {
          counts.critical += 1;
        } else if (alert.type === 'warning') {
          counts.warning += 1;
        } else {
          counts.info += 1;
        }

        return counts;
      },
      {
        critical: 0,
        warning: 0,
        info: 0,
      },
    );
    const signals: DecisionSignals = {
      temperature: realtime.data?.temperature ?? null,
      occupancy: realtime.data?.occupancy ?? null,
      freezerEnergy: realtime.data?.freezerEnergy ?? null,
      peakOccupancy: logistics.peakOccupancy,
      criticalAlerts: alertCounts.critical,
      warningAlerts: alertCounts.warning,
      infoAlerts: alertCounts.info,
      isStale: realtime.isStale,
      currentTariff: getTariffForHour(tariffReferenceDate.getHours()),
      nextIdealHour: logistics.nextIdealHour,
      lowEnergyHours: logistics.lowEnergyHours,
      energyCost: business.energyCost,
      projectedEnergyCost: business.projectedEnergyCost,
      margin: business.margin,
      energyCostShare:
        business.costBreakdown.total > 0
          ? business.costBreakdown.energy / business.costBreakdown.total
          : 0,
      isOnline: sync.isOnline,
      isUsingBackup: sync.isUsingBackup,
      dataSource: sync.dataSource,
      lastUpdatedAt,
    };

    const hasData =
      Boolean(realtime.data) ||
      logistics.hourlyData.some((entry) => entry.avgEnergy > 0) ||
      business.timeline.length > 0;
    const error = sync.error ?? logistics.error ?? business.error;
    const summary = hasData
      ? buildDecisionMatrix(signals)
      : createEmptyDecisionSummary(
          sync.error ??
            logistics.error ??
            business.error ??
            'A matriz de decisão ainda está aguardando dados consistentes do twin.',
        );
    const sourceStatus: DecisionSourceStatus = {
      isOnline: sync.isOnline,
      isUsingBackup: sync.isUsingBackup,
      dataSource: sync.dataSource,
    };

    return {
      summary,
      rows: summary.rows,
      signals,
      isLoading:
        !hasData && (sync.isLoading || logistics.isLoading || business.isLoading),
      error,
      lastUpdatedAt,
      sourceStatus,
    };
  }, [
    business.costBreakdown.energy,
    business.costBreakdown.total,
    business.energyCost,
    business.error,
    business.isLoading,
    business.margin,
    business.projectedEnergyCost,
    business.referenceDate,
    business.timeline.length,
    logistics.error,
    logistics.hourlyData,
    logistics.isLoading,
    logistics.lowEnergyHours,
    logistics.nextIdealHour,
    logistics.peakOccupancy,
    realtime.alerts,
    realtime.data,
    realtime.isStale,
    sync.dataSource,
    sync.error,
    sync.isLoading,
    sync.isOnline,
    sync.isUsingBackup,
    sync.lastDataTimestamp,
  ]);
}
