import type {
  Summary,
  Transaction,
  TransactionFilters,
  TransactionPayload,
} from "./types";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const DEFAULT_TIMEOUT_MS = 12_000;

function extractDetail(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "object" && item !== null && "msg" in item) {
          const msg = (item as { msg: unknown }).msg;
          return typeof msg === "string" ? msg : null;
        }
        return null;
      })
      .filter((message): message is string => Boolean(message));
    if (messages.length > 0) return messages.join(" · ");
  }
  return null;
}

export class PocketLedgerApi {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
        },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ApiError("The API took too long to respond. Please retry.", 0);
      }
      throw new ApiError(
        "Cannot reach the PocketLedger API. Is the backend running?",
        0,
      );
    } finally {
      window.clearTimeout(timer);
    }

    if (!response.ok) {
      let detail: string | null = null;
      try {
        detail = extractDetail(await response.json());
      } catch {
        detail = null;
      }
      throw new ApiError(
        detail ?? `Request failed with status ${response.status}.`,
        response.status,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  health(): Promise<{ status: string; database: string }> {
    return this.request("/api/health");
  }

  listCategories(): Promise<string[]> {
    return this.request("/api/categories");
  }

  listTransactions(filters: TransactionFilters = { type: "all", category: "all" }): Promise<Transaction[]> {
    const params = new URLSearchParams();
    if (filters.type !== "all") params.set("type", filters.type);
    if (filters.category !== "all") params.set("category", filters.category);
    const query = params.toString();
    return this.request(`/api/transactions${query ? `?${query}` : ""}`);
  }

  createTransaction(payload: TransactionPayload): Promise<Transaction> {
    return this.request("/api/transactions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  updateTransaction(id: number, payload: TransactionPayload): Promise<Transaction> {
    return this.request(`/api/transactions/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  deleteTransaction(id: number): Promise<void> {
    return this.request(`/api/transactions/${id}`, { method: "DELETE" });
  }

  getSummary(): Promise<Summary> {
    return this.request("/api/summary");
  }
}
