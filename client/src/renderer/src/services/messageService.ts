import { encryptMessage, decryptMessage } from './encryptionService';
import { wsClient } from './wsClient';
import { apiRequest } from './apiClient';
import { WS_TYPES, MAX_MESSAGE_LENGTH } from 'discord-clone-shared';
import type { TextSendPayload, TextReceivePayload } from 'discord-clone-shared';
import useAuthStore from '../stores/useAuthStore';
import useMessageStore from '../stores/useMessageStore';
import type { DecryptedMessage } from '../stores/useMessageStore';

export function sendMessage(channelId: string, plaintext: string): void {
  const groupKey = useAuthStore.getState().groupKey;
  if (!groupKey) {
    useMessageStore.getState().setSendError('Encryption key not available');
    return;
  }

  if (plaintext.length > MAX_MESSAGE_LENGTH) {
    useMessageStore.getState().setSendError(
      `Message exceeds ${MAX_MESSAGE_LENGTH} character limit`,
    );
    return;
  }

  const { ciphertext, nonce } = encryptMessage(plaintext, groupKey);
  const tempId = crypto.randomUUID();
  const userId = useAuthStore.getState().user?.id ?? '';

  // Add optimistic message to store
  const optimistic: DecryptedMessage = {
    id: tempId,
    channelId,
    authorId: userId,
    content: plaintext,
    createdAt: new Date().toISOString(),
    status: 'sending',
    tempId,
  };

  useMessageStore.getState().addOptimisticMessage(channelId, optimistic);

  // Send via WebSocket
  try {
    wsClient.send({
      type: WS_TYPES.TEXT_SEND,
      payload: {
        channelId,
        content: ciphertext,
        nonce,
      } satisfies TextSendPayload,
      id: tempId,
    });
  } catch {
    useMessageStore.getState().markMessageFailed(tempId);
  }
}

const PAGE_LIMIT = 50;

export async function fetchMessages(
  channelId: string,
  options?: { before?: string },
): Promise<void> {
  useMessageStore.getState().setLoading(true);
  useMessageStore.getState().setError(null);

  try {
    let url = `/api/channels/${channelId}/messages?limit=${PAGE_LIMIT}`;
    if (options?.before) {
      url += `&before=${options.before}`;
    }

    const result = await apiRequest<TextReceivePayload[]>(url);

    const groupKey = useAuthStore.getState().groupKey;
    if (!groupKey) {
      useMessageStore.getState().setLoading(false);
      useMessageStore.getState().setError('Encryption key not available');
      return;
    }

    const decrypted: DecryptedMessage[] = result.map((msg) => ({
      id: msg.messageId,
      channelId: msg.channelId,
      authorId: msg.authorId,
      content: decryptMessage(msg.content, msg.nonce, groupKey),
      createdAt: msg.createdAt,
      status: 'sent' as const,
    }));

    // API returns newest first — reverse for chronological display
    decrypted.reverse();

    const hasMore = result.length === PAGE_LIMIT;
    useMessageStore.getState().setMessages(channelId, decrypted, hasMore);
    useMessageStore.getState().setLoading(false);
  } catch (err) {
    useMessageStore.getState().setLoading(false);
    useMessageStore.getState().setError(
      err instanceof Error ? err.message : 'Failed to load messages',
    );
  }
}

export async function fetchOlderMessages(channelId: string): Promise<void> {
  const store = useMessageStore.getState();
  const oldestId = store.getOldestMessageId(channelId);
  if (!oldestId) return;

  store.setLoadingMore(true);

  try {
    const url = `/api/channels/${channelId}/messages?limit=${PAGE_LIMIT}&before=${oldestId}`;
    const result = await apiRequest<TextReceivePayload[]>(url);

    const groupKey = useAuthStore.getState().groupKey;
    if (!groupKey) {
      useMessageStore.getState().setLoadingMore(false);
      return;
    }

    const decrypted: DecryptedMessage[] = result.map((msg) => ({
      id: msg.messageId,
      channelId: msg.channelId,
      authorId: msg.authorId,
      content: decryptMessage(msg.content, msg.nonce, groupKey),
      createdAt: msg.createdAt,
      status: 'sent' as const,
    }));

    // API returns newest first — reverse for chronological display
    decrypted.reverse();

    const hasMore = result.length === PAGE_LIMIT;
    useMessageStore.getState().prependMessages(channelId, decrypted, hasMore);
    useMessageStore.getState().setLoadingMore(false);
  } catch {
    useMessageStore.getState().setLoadingMore(false);
  }
}
