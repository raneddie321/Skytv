import type { IncomingMessage, ServerResponse } from 'node:http';

export type Next = (err?: unknown) => void;
export type Handler = (req: IncomingMessage, res: ServerResponse, next?: Next) => void | Promise<void>;

export function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(payload);
}

export async function readJsonBody<T = unknown>(req: IncomingMessage, limit = 256 * 1024): Promise<T | undefined> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw Object.assign(new Error('Payload too large'), { status: 413 });
    chunks.push(chunk as Buffer);
  }
  if (!chunks.length) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
  } catch {
    throw Object.assign(new Error('Invalid JSON body'), { status: 400 });
  }
}
