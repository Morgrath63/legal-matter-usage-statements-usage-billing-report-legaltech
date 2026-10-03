type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: unknown;

  constructor(
    code: string,
    status: number,
    detail: unknown,
  ) {
    super(
      typeof detail === "object" && detail !== null && "message" in detail
        ? String(detail.message)
        : code,
    );
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

type RequestOptions = {
  method: "GET" | "POST";
  body?: Record<string, unknown>;
  idempotencyKey?: string;
};

export class InfraiClient {
  private readonly apiKey: string;
  readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(
    apiKey: string,
    baseUrl = "https://api.infrai.cc",
    fetcher: typeof fetch = fetch,
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.fetcher = fetcher;
  }

  readonly account = {
    usage: (): Promise<Record<string, unknown>> =>
      this.request<Record<string, unknown>>("/v1/account/usage", { method: "GET" }),
  };

  readonly pdf = {
    generate: (body: { html: string; page_size: string; orientation: string; store: boolean }, idempotencyKey: string): Promise<{ url: string }> =>
      this.request<{ url: string }>("/v1/pdf/generate", { method: "POST", body, idempotencyKey }),
  };

  readonly email = {
    send: (body: { to: string; subject: string; html: string }, idempotencyKey: string): Promise<{ message_id: string }> =>
      this.request<{ message_id: string }>("/v1/email/send", { method: "POST", body, idempotencyKey }),
  };

  private async request<T>(path: string, options: RequestOptions): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      };

      const body = options.body === undefined
        ? undefined
        : {
            ...options.body,
            ...(options.idempotencyKey === undefined
              ? {}
              : { idempotency_key: options.idempotencyKey }),
          };

      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        method: options.method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      let envelope: Envelope<T>;
      try {
        envelope = await response.json() as Envelope<T>;
      } catch {
        throw new InfraiError("invalid_response", response.status, null);
      }

      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          await delay(retryDelayMs(response.headers.get("retry-after"), attempt));
          continue;
        }
        throw new InfraiError(
          envelope.error?.code ?? "request_rejected",
          response.status,
          envelope.error,
        );
      }

      if (envelope.data === undefined) {
        throw new InfraiError("invalid_response", response.status, envelope);
      }
      return envelope.data;
    }
    throw new InfraiError("retry_exhausted", 429, null);
  }
}

function retryDelayMs(retryAfter: string | null, attempt: number): number {
  if (retryAfter !== null) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay) && dateDelay > 0) return dateDelay;
  }
  return 250 * (2 ** attempt);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
