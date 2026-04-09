import manifestData from '../../data/backup/manifest.json';
import type {
  BackupChannelSnapshot,
  BackupSnapshotManifest,
  BackupSnapshotManifestChannel,
} from '../../domain/types';

type SnapshotModule = {
  default: BackupChannelSnapshot;
};

const SNAPSHOT_LOADERS = {
  lab: () => import('../../data/backup/lab.snapshot.json') as Promise<SnapshotModule>,
} satisfies Record<string, () => Promise<SnapshotModule>>;

const manifest = manifestData as BackupSnapshotManifest;
const snapshotCache = new Map<string, Promise<BackupChannelSnapshot | null>>();

function getChannelEntry(channel: string): BackupSnapshotManifestChannel | null {
  return manifest.channels.find((entry) => entry.channel === channel) ?? null;
}

export async function loadBackupManifest(): Promise<BackupSnapshotManifest> {
  return manifest;
}

export async function loadBackupSnapshot(
  channel: string,
): Promise<BackupChannelSnapshot | null> {
  if (!snapshotCache.has(channel)) {
    snapshotCache.set(
      channel,
      (async () => {
        const entry = getChannelEntry(channel);

        if (!entry) {
          return null;
        }

        const loader = SNAPSHOT_LOADERS[entry.snapshotId];
        if (!loader) {
          return null;
        }

        const module = await loader();
        return module.default;
      })(),
    );
  }

  return snapshotCache.get(channel) ?? null;
}

export function getBackupChannelEntry(
  channel: string,
): BackupSnapshotManifestChannel | null {
  return getChannelEntry(channel);
}
