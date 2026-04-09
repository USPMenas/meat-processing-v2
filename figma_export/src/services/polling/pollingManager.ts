interface PollingManagerOptions {
  document?: Document;
  now?: () => number;
}

export class PollingManager {
  private callback: (() => Promise<void>) | null = null;

  private timeoutId: number | null = null;

  private intervalMs = 0;

  private active = false;

  private documentRef: Document | undefined;

  private now: () => number;

  private lastExecutionAt = 0;

  private inFlight = false;

  constructor(options: PollingManagerOptions = {}) {
    this.documentRef =
      options.document ?? (typeof document !== 'undefined' ? document : undefined);
    this.now = options.now ?? Date.now;
  }

  start(callback: () => Promise<void>, intervalMs: number): void {
    this.stop();
    this.callback = callback;
    this.intervalMs = intervalMs;
    this.active = true;
    this.lastExecutionAt = this.now();

    this.documentRef?.addEventListener(
      'visibilitychange',
      this.handleVisibilityChange,
    );

    if (this.isPageVisible()) {
      this.scheduleNext(this.intervalMs);
    }
  }

  stop(): void {
    this.clearTimeout();
    this.documentRef?.removeEventListener(
      'visibilitychange',
      this.handleVisibilityChange,
    );
    this.callback = null;
    this.active = false;
    this.inFlight = false;
  }

  updateInterval(intervalMs: number): void {
    this.intervalMs = intervalMs;

    if (!this.active || !this.isPageVisible()) {
      return;
    }

    const elapsed = this.now() - this.lastExecutionAt;
    const remaining = Math.max(this.intervalMs - elapsed, 0);
    this.scheduleNext(remaining);
  }

  async triggerNow(): Promise<void> {
    if (!this.active || !this.callback) {
      return;
    }

    this.clearTimeout();
    await this.executeCallback();
  }

  isActive(): boolean {
    return this.active;
  }

  private handleVisibilityChange = (): void => {
    if (!this.active) {
      return;
    }

    if (!this.isPageVisible()) {
      this.clearTimeout();
      return;
    }

    const elapsed = this.now() - this.lastExecutionAt;
    if (elapsed >= this.intervalMs) {
      void this.executeCallback();
      return;
    }

    this.scheduleNext(this.intervalMs - elapsed);
  };

  private scheduleNext(delayMs: number): void {
    this.clearTimeout();

    if (!this.callback) {
      return;
    }

    this.timeoutId = window.setTimeout(() => {
      if (!this.isPageVisible()) {
        return;
      }

      void this.executeCallback();
    }, delayMs);
  }

  private clearTimeout(): void {
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private isPageVisible(): boolean {
    return this.documentRef ? this.documentRef.visibilityState !== 'hidden' : true;
  }

  private async executeCallback(): Promise<void> {
    if (!this.callback || this.inFlight) {
      return;
    }

    this.inFlight = true;
    this.lastExecutionAt = this.now();

    try {
      await this.callback();
    } finally {
      this.inFlight = false;

      if (this.active && this.isPageVisible()) {
        this.scheduleNext(this.intervalMs);
      }
    }
  }
}
