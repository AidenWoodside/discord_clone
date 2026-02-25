import type { FastifyBaseLogger } from 'fastify';
import type { WebSocket } from 'ws';
import type { WsMessage } from 'discord-clone-shared';

export type WsHandler = (ws: WebSocket, message: WsMessage, userId: string) => void;

const handlers = new Map<string, WsHandler>();

export function registerHandler(type: string, handler: WsHandler): void {
  handlers.set(type, handler);
}

export function routeMessage(ws: WebSocket, raw: string, userId: string, log: FastifyBaseLogger): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    log.warn({ userId }, 'Malformed WebSocket message: invalid JSON');
    ws.close(4002, 'Malformed message');
    return;
  }

  if (!isValidWsMessage(parsed)) {
    log.warn({ userId }, 'Malformed WebSocket message: invalid envelope');
    ws.close(4002, 'Malformed message');
    return;
  }

  const message = parsed as WsMessage;
  const handler = handlers.get(message.type);

  if (!handler) {
    log.warn({ userId, type: message.type }, 'Unknown WebSocket message type');
    return;
  }

  handler(ws, message, userId);
}

function isValidWsMessage(data: unknown): data is WsMessage {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.type !== 'string') return false;
  if (!('payload' in obj)) return false;
  if ('id' in obj && typeof obj.id !== 'string') return false;
  return true;
}
