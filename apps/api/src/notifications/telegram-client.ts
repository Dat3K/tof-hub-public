export class TelegramFailure extends Error {
  constructor(readonly status: number, readonly retryAfter = 0, readonly unchanged = false, readonly missingMessage = false) { super(`Telegram request failed (${status})`); }
}

/** Never expose a Bot API URL or its token through logging/error objects. */
export class TelegramClient {
  constructor(private readonly token: string, private readonly fetcher: typeof fetch = fetch) {}
  async document(owner: string, filename: string, payload: Uint8Array, caption: string): Promise<{ message_id: number }> {
    const body = new FormData();
    body.set('chat_id', owner);
    body.set('caption', caption);
    body.set('document', new Blob([new Uint8Array(payload)], { type: 'application/octet-stream' }), filename);
    let response: Response;
    try {
      response = await this.fetcher(`https://api.telegram.org/bot${this.token}/sendDocument`, {
        method: 'POST', body, signal: AbortSignal.timeout(30_000),
      });
    } catch { throw new TelegramFailure(0); }
    return this.result<{ message_id: number }>(response);
  }
  async call<T>(method: string, body: Record<string, unknown>): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
      });
    } catch { throw new TelegramFailure(0); }
    return this.result<T>(response);
  }
  private async result<T>(response: Response): Promise<T> {
    let data: { ok: boolean; result: T; error_code?: number; description?: string; parameters?: { retry_after?: number } };
    try { data = await response.json() as typeof data; } catch { throw new TelegramFailure(response.status); }
    if (!data.ok) throw new TelegramFailure(data.error_code ?? response.status, data.parameters?.retry_after ?? 0,
      !!data.description?.includes('message is not modified'), !!data.description?.includes('message to edit not found'));
    return data.result;
  }
}
