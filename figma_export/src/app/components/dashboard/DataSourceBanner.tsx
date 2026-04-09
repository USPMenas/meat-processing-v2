import { Clock3, Database, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '../ui/badge';
import type { MeasurementDataSource } from '../../../services/cache/types';

interface DataSourceBannerProps {
  channel: string;
  isOnline: boolean;
  dataSource: MeasurementDataSource;
  sourceMessage: string | null;
  lastApiAttempt: Date | null;
  lastSuccessfulApiSync: Date | null;
  lastDataTimestamp: Date | null;
  backupSnapshotTimestamp: Date | null;
}

function formatDateTime(value: Date | null): string {
  if (!value) {
    return '--';
  }

  return value.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function DataSourceBanner({
  channel,
  isOnline,
  dataSource,
  sourceMessage,
  lastApiAttempt,
  lastSuccessfulApiSync,
  lastDataTimestamp,
  backupSnapshotTimestamp,
}: DataSourceBannerProps) {
  const isUsingBackup = dataSource === 'backup';

  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${
        isUsingBackup
          ? 'border-amber-300 bg-amber-50'
          : 'border-emerald-200 bg-white'
      }`}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={
                isOnline && !isUsingBackup
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-red-100 text-red-800'
              }
            >
              {isOnline && !isUsingBackup ? (
                <Wifi className="size-3.5" />
              ) : (
                <WifiOff className="size-3.5" />
              )}
              {isOnline && !isUsingBackup ? 'API ativa' : 'API indisponivel'}
            </Badge>
            <Badge
              className={
                isUsingBackup
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-blue-100 text-blue-800'
              }
            >
              <Database className="size-3.5" />
              {isUsingBackup ? 'Usando backup SQLite' : 'Dados vindos da API'}
            </Badge>
            <Badge variant="outline">Canal: {channel}</Badge>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900">
              {isUsingBackup
                ? 'A API nao esta entregando dados utilizaveis. A interface esta renderizando a partir do backup local.'
                : 'Os dados exibidos estao sincronizados a partir da API, com fallback local disponivel se necessario.'}
            </p>
            {sourceMessage && (
              <p className="mt-1 text-sm text-gray-600">{sourceMessage}</p>
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:min-w-[430px]">
          <div className="rounded-lg border border-gray-200 bg-white/80 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Ultima tentativa na API
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {formatDateTime(lastApiAttempt)}
            </p>
          </div>

          <div
            className={`rounded-lg border p-3 ${
              isUsingBackup
                ? 'border-amber-200 bg-amber-100/70'
                : 'border-gray-200 bg-white/80'
            }`}
          >
            <p
              className={`text-xs font-medium uppercase tracking-wide ${
                isUsingBackup ? 'text-amber-700' : 'text-gray-500'
              }`}
            >
              Ultimo dado exibido
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {formatDateTime(lastDataTimestamp)}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white/80 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Ultima sincronizacao valida da API
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {formatDateTime(lastSuccessfulApiSync)}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white/80 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {isUsingBackup ? 'Snapshot do backup' : 'Relogio operacional'}
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Clock3 className="size-4 text-gray-400" />
              {formatDateTime(isUsingBackup ? backupSnapshotTimestamp : lastDataTimestamp)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
