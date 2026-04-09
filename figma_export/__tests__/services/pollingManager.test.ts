import { PollingManager } from '@/services/polling/pollingManager';

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  });
}

describe('PollingManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('runs the callback on the polling interval', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    const manager = new PollingManager();

    manager.start(callback, 1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('stops polling when stop is called', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    const manager = new PollingManager();

    manager.start(callback, 1000);
    manager.stop();
    await vi.advanceTimersByTimeAsync(2000);

    expect(callback).not.toHaveBeenCalled();
  });

  it('pauses polling while the page is hidden', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    const manager = new PollingManager();

    manager.start(callback, 1000);
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(2000);

    expect(callback).not.toHaveBeenCalled();
  });

  it('resumes and triggers an immediate sync when the page becomes visible after the interval', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    const manager = new PollingManager();

    manager.start(callback, 1000);
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(1500);

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(manager.isActive()).toBe(true);
  });

  it('updates the interval for the next scheduled execution', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    const manager = new PollingManager();

    manager.start(callback, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(callback).toHaveBeenCalledTimes(1);

    manager.updateInterval(5000);
    await vi.advanceTimersByTimeAsync(4000);
    expect(callback).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('triggers an immediate sync and keeps polling active afterwards', async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    const manager = new PollingManager();

    manager.start(callback, 5000);
    await manager.triggerNow();
    expect(callback).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(manager.isActive()).toBe(true);
  });
});
