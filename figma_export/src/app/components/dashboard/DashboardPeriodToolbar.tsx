import { RefreshCcw } from 'lucide-react';
import {
  DASHBOARD_PERIOD_OPTIONS,
  getPeriodShortLabel,
} from '../../../config/periods';
import type { OperationalChartPeriod } from '../../../domain/types';
import type { PollingMode } from '../../../services/cache/types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface DashboardPeriodToolbarProps {
  period: OperationalChartPeriod;
  onPeriodChange: (period: OperationalChartPeriod) => void;
  onRefresh: () => void | Promise<void>;
  isRefreshing?: boolean;
  pollingMode: PollingMode;
  align?: 'left' | 'right';
}

function getPollingModeLabel(pollingMode: PollingMode): string {
  switch (pollingMode) {
    case 'degraded':
      return 'Retry em 5 min';
    case 'paused':
      return 'API pausada';
    default:
      return 'Retry em 1 min';
  }
}

function getPollingModeClassName(pollingMode: PollingMode): string {
  switch (pollingMode) {
    case 'degraded':
      return 'bg-amber-100 text-amber-800';
    case 'paused':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-emerald-100 text-emerald-800';
  }
}

export function DashboardPeriodToolbar({
  period,
  onPeriodChange,
  onRefresh,
  isRefreshing = false,
  pollingMode,
  align = 'right',
}: DashboardPeriodToolbarProps) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center ${
        align === 'right' ? 'sm:ml-auto' : ''
      }`}
    >
      <Badge className={getPollingModeClassName(pollingMode)}>
        {getPollingModeLabel(pollingMode)}
      </Badge>

      <div className="flex items-center gap-2">
        <Select value={period} onValueChange={(value) => onPeriodChange(value as OperationalChartPeriod)}>
          <SelectTrigger size="sm" className="min-w-[124px]">
            <SelectValue placeholder={getPeriodShortLabel(period)} />
          </SelectTrigger>
          <SelectContent>
            {DASHBOARD_PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCcw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>
    </div>
  );
}
