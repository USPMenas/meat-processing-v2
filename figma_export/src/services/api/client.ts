import { API_CONFIG } from '../../config/api';
import type { ApiErrorResponse } from './types';

export class ApiError extends Error {
  status: number | null;
  endpoint: string;

  constructor(message: string, endpoint: string, status: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
  }
}

type FetchLike = typeof fetch;

const fetchMod = window.fetch.bind(window)

interface ApiClientOptions {
  baseUrl?: string;
  timeout?: number;
  retryDelaysMs?: readonly number[];
  fetchFn?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function shouldRetry(
  error: ApiError,
  attempt: number,
  retryDelaysMs: readonly number[],
): boolean {
  const isRetryableStatus =
    error.status === null || error.status === 408 || error.status === 429 || error.status >= 500;

  return isRetryableStatus && attempt < retryDelaysMs.length;
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallbackMessage = `Request failed with status ${response.status}`;

  try {
    const bodyText = await response.text();

    if (!bodyText) {
      return fallbackMessage;
    }

    const parsed = JSON.parse(bodyText) as Partial<ApiErrorResponse>;
    if (typeof parsed.detail === 'string' && parsed.detail.length > 0) {
      return parsed.detail;
    }

    return bodyText;
  } catch {
    return fallbackMessage;
  }
}

export class ApiClient {
  private baseUrl: string;

  private timeout: number;

  private retryDelaysMs: readonly number[];

  private fetchFn: FetchLike;

  private sleep: (ms: number) => Promise<void>;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? API_CONFIG.baseUrl;
    this.timeout = options.timeout ?? API_CONFIG.timeoutMs;
    this.retryDelaysMs = options.retryDelaysMs ?? API_CONFIG.retryDelaysMs;
    this.fetchFn = options.fetchFn ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(endpoint, this.baseUrl);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    for (let attempt = 0; attempt <= this.retryDelaysMs.length; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetchMod(url.toString(), {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new ApiError(await readErrorMessage(response), endpoint, response.status);
        }

        return (await response.json()) as T;
      } catch (error) {
        const apiError = this.toApiError(error, endpoint);
        console.error(`[ApiClient] GET ${endpoint} failed on attempt ${attempt + 1}`, apiError);

        if (!shouldRetry(apiError, attempt, this.retryDelaysMs)) {
          throw apiError;
        }

        await this.sleep(this.retryDelaysMs[attempt]);
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    throw new ApiError('Unexpected API client state', endpoint, null);
  }

  private toApiError(error: unknown, endpoint: string): ApiError {
    if (error instanceof ApiError) {
      return error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      return new ApiError(`Request timed out after ${this.timeout}ms`, endpoint, 408);
    }

    if (error instanceof Error) {
      return new ApiError(error.message, endpoint, null);
    }

    return new ApiError('Unknown API error', endpoint, null);
  }
}

export const apiClient = new ApiClient();
