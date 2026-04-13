import { Clock3, Database, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '../ui/badge';
import type {
  BackupSnapshotStatus,
  MeasurementDataSource,
} from '../../../services/cache/types';

interface DataSourceBannerProps {
  channel: string;
  isOnline: boolean;
  dataSource: MeasurementDataSource;
  sourceMessage: string | null;
  lastApiAttempt: Date | null;
  lastSuccessfulApiSync: Date | null;
  lastDataTimestamp: Date | null;
  backupSnapshotTimestamp: Date | null;
  backupSnapshotStatus: BackupSnapshotStatus | null;
  backupRefreshError: string | null;
  backupSnapshotAgeHours: number | null;
  isBackupSnapshotFreshEnough: boolean | null;
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

function formatAgeHours(value: number | null): string {
  if (value === null) {
    return '--';
  }

  if (value < 24) {
    return `${value.toFixed(1)} h`;
  }

  return `${(value / 24).toFixed(1)} d`;
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
  backupSnapshotStatus,
  backupRefreshError,
  backupSnapshotAgeHours,
  isBackupSnapshotFreshEnough,
}: DataSourceBannerProps) {
  const isUsingBackup = dataSource === 'backup';
  const isHybrid = dataSource === 'hybrid';
  const connectionBadgeClass = isOnline
    ? 'bg-emerald-100 text-emerald-800'
    : isHybrid
      ? 'bg-amber-100 text-amber-800'
      : isUsingBackup
        ? 'bg-amber-100 text-amber-900'
        : 'bg-red-100 text-red-800';
  const connectionLabel = isOnline
    ? 'API ativa'
    : isHybrid
      ? 'Sem dado novo agora'
      : isUsingBackup
        ? 'Backup ativo'
        : 'API indisponivel';
  const sourceBadgeClass = isUsingBackup
    ? 'bg-amber-100 text-amber-900'
    : isHybrid
      ? 'bg-blue-100 text-blue-800'
      : 'bg-blue-100 text-blue-800';
  const sourceLabel =
    backupSnapshotStatus === 'renewed'
      ? isHybrid
        ? 'Backup renovado + delta recente'
        : 'Backup renovado'
      : backupSnapshotStatus === 'last_good'
        ? isHybrid
          ? 'Ultimo snapshot bom + delta recente'
          : 'Ultimo snapshot bom'
        : backupSnapshotStatus === 'bundled'
          ? isHybrid
            ? 'Snapshot empacotado + delta recente'
            : 'Snapshot empacotado'
          : isHybrid
            ? 'Backup + delta recente'
            : isUsingBackup
              ? 'Snapshot do backup'
              : 'Dados recentes da API';
  const snapshotStatusLabel =
    backupSnapshotStatus === 'renewed'
      ? 'Renovado'
      : backupSnapshotStatus === 'last_good'
        ? 'Ultimo bom'
        : backupSnapshotStatus === 'bundled'
          ? 'Empacotado'
          : 'Sem snapshot';
  const headline = isUsingBackup
    ? backupSnapshotStatus === 'renewed'
      ? 'A interface abriu sobre um snapshot renovado da API e segue pronta para incorporar o delta recente no proximo ciclo.'
      : backupSnapshotStatus === 'last_good'
        ? 'A renovacao do backup falhou, entao a interface abriu usando o ultimo snapshot bom salvo localmente.'
        : 'A renovacao do backup falhou e a interface abriu usando o snapshot empacotado, que pode estar desatualizado.'
    : isHybrid
      ? backupSnapshotStatus === 'bundled'
        ? 'A interface ja trouxe dado recente da API, mas ainda combina esse delta com um snapshot empacotado atrasado.'
        : 'A interface usa um baseline de backup e ja incorporou o bloco recente mais novo encontrado na API.'
      : 'Os dados exibidos estao vindo da camada interna sincronizada diretamente com a API.';
  const snapshotToneClass =
    backupSnapshotStatus === 'renewed'
      ? 'bg-emerald-100 text-emerald-800'
      : backupSnapshotStatus === 'last_good'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-red-100 text-red-800';

  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${
        isUsingBackup
          ? 'border-amber-300 bg-amber-50'
          : isHybrid
            ? 'border-blue-200 bg-blue-50/50'
          : 'border-emerald-200 bg-white'
      }`}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={connectionBadgeClass}>
              {isOnline ? (
                <Wifi className="size-3.5" />
              ) : (
                <WifiOff className="size-3.5" />
              )}
              {connectionLabel}
            </Badge>
            <Badge className={sourceBadgeClass}>
              <Database className="size-3.5" />
              {sourceLabel}
            </Badge>
            {backupSnapshotStatus && (
              <Badge className={snapshotToneClass}>{snapshotStatusLabel}</Badge>
            )}
            <Badge variant="outline">Canal: {channel}</Badge>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900">{headline}</p>
            {sourceMessage && (
              <p className="mt-1 text-sm text-gray-600">{sourceMessage}</p>
            )}
            {backupRefreshError && (
              <p className="mt-1 text-sm text-amber-700">{backupRefreshError}</p>
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
                : isHybrid
                  ? 'border-blue-200 bg-blue-50/80'
                : 'border-gray-200 bg-white/80'
            }`}
          >
            <p
              className={`text-xs font-medium uppercase tracking-wide ${
                isUsingBackup
                  ? 'text-amber-700'
                  : isHybrid
                    ? 'text-blue-700'
                    : 'text-gray-500'
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
              Estado do snapshot
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Clock3 className="size-4 text-gray-400" />
              {snapshotStatusLabel}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Gerado em {formatDateTime(backupSnapshotTimestamp)}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white/80 p-3 md:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Idade do snapshot ativo
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {formatAgeHours(backupSnapshotAgeHours)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {isBackupSnapshotFreshEnough === null
                ? 'Ainda sem avaliacao de frescor.'
                : isBackupSnapshotFreshEnough
                  ? 'O baseline esta dentro da janela considerada fresca.'
                  : 'O baseline esta atrasado e precisa de renovacao para melhorar 7d e 30d.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
