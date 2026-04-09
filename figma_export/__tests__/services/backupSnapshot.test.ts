import { getBackupChannelEntry, loadBackupManifest, loadBackupSnapshot } from '@/services/backup/snapshot';

describe('backup snapshot loader', () => {
  it('loads the bundled manifest with the real lab channel metadata', async () => {
    const manifest = await loadBackupManifest();

    expect(manifest.defaultChannel).toBe('lab');
    expect(manifest.source).toBe('backup_2026-03-31.db');
    expect(manifest.channels[0]).toMatchObject({
      channel: 'lab',
      sensors: ['fase1', 'fase2', 'fase3'],
      latestMeasurementAt: '2026-03-31T10:24:17',
    });
    expect(getBackupChannelEntry('lab')?.snapshotId).toBe('lab');
  });

  it('loads the lab snapshot with recent measurements and cached periods', async () => {
    const snapshot = await loadBackupSnapshot('lab');

    expect(snapshot).not.toBeNull();
    expect(snapshot?.operational.recentMeasurements.length).toBeGreaterThan(100);
    expect(snapshot?.operational.histories['24h'].points.length).toBeGreaterThan(50);
    expect(snapshot?.operational.histories['7d'].points.length).toBeGreaterThan(100);
    expect(snapshot?.operational.histories['30d'].points.length).toBeGreaterThan(50);
    expect(snapshot?.business.consumption.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sensor: 'fase1' }),
        expect.objectContaining({ sensor: 'fase2' }),
        expect.objectContaining({ sensor: 'fase3' }),
      ]),
    );
  });
});
