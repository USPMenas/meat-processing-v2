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

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (trimmed.length === 0) {
    return '/api';
  }

  if (
    /^http:\/\//i.test(trimmed) &&
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:'
  ) {
    return '/api';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, '');
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

function buildRequestUrl(baseUrl: string, endpoint: string): URL {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  if (/^https?:\/\//i.test(normalizedBaseUrl)) {
    return new URL(normalizedEndpoint, `${normalizedBaseUrl}/`);
  }

  return new URL(
    `${normalizedBaseUrl}${normalizedEndpoint}`,
    window.location.origin,
  );
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

async function readJsonResponse<T>(response: Response, endpoint: string): Promise<T> {
  const contentType = response.headers.get('content-type') ?? 'unknown';
  const bodyText = await response.text();

  if (bodyText.length === 0) {
    throw new ApiError(
      `Expected JSON response but received an empty body (status ${response.status}, content-type: ${contentType})`,
      endpoint,
      response.status,
    );
  }

  try {
    return JSON.parse(bodyText) as T;
  } catch {
    const preview = bodyText.replace(/\s+/g, ' ').trim().slice(0, 80);
    throw new ApiError(
      `Expected JSON response but received ${contentType} (status ${response.status})${preview ? `: ${preview}` : ''}`,
      endpoint,
      response.status,
    );
  }
}

export class ApiClient {
  private baseUrl: string;

  private timeout: number;

  private retryDelaysMs: readonly number[];

  private fetchFn: FetchLike;

  private sleep: (ms: number) => Promise<void>;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? API_CONFIG.baseUrl);
    this.timeout = options.timeout ?? API_CONFIG.timeoutMs;
    this.retryDelaysMs = options.retryDelaysMs ?? API_CONFIG.retryDelaysMs;
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
    this.sleep = options.sleep ?? defaultSleep;
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = buildRequestUrl(this.baseUrl, endpoint);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    for (let attempt = 0; attempt <= this.retryDelaysMs.length; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await this.fetchFn(url.toString(), {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new ApiError(await readErrorMessage(response), endpoint, response.status);
        }

        return await readJsonResponse<T>(response, endpoint);
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
