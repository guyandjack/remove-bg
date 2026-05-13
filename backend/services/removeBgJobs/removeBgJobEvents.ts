export type RemoveBgJobSsePayload = {
  requestId: string;
  status: string;
  outputImageUrl: string | null;
  errorMessage: string | null;
  createdAt?: Date | string | null;
  completedAt?: Date | string | null;
};

type RemoveBgJobEvent =
  | { type: "job.updated"; payload: RemoveBgJobSsePayload; at: string }
  | { type: "job.created"; payload: RemoveBgJobSsePayload; at: string };

type Listener = (event: RemoveBgJobEvent) => void;

// In-memory bus, keyed by channel to avoid broadcasting to all clients.
// Channel is usually `requestId`, but can be namespaced (e.g. `visitor:<requestId>`).
const listenersByChannel = new Map<string, Set<Listener>>();

function normalizeChannel(input: string): string {
  return String(input || "").trim();
}

export function subscribeRemoveBgJobEvents(
  requestIdOrChannel: string,
  listener: Listener,
): () => void {
  return subscribeRemoveBgJobEventsChannel(requestIdOrChannel, listener);
}

export function subscribeRemoveBgJobEventsChannel(
  channel: string,
  listener: Listener,
): () => void {
  const key = normalizeChannel(channel);
  if (!key) return () => {};

  const set = listenersByChannel.get(key) ?? new Set<Listener>();
  set.add(listener);
  listenersByChannel.set(key, set);

  return () => {
    const current = listenersByChannel.get(key);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listenersByChannel.delete(key);
  };
}

export function publishRemoveBgJobUpdated(requestId: string) {
  const key = normalizeChannel(requestId);
  if (!key) return;
  const set = listenersByChannel.get(key);
  if (!set || set.size === 0) return;
  const event: RemoveBgJobEvent = {
    type: "job.updated",
    payload: { requestId: key, status: "unknown", outputImageUrl: null, errorMessage: null },
    at: new Date().toISOString(),
  };
  set.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // ignore listener errors
    }
  });
}

export function publishRemoveBgJobCreated(payload: RemoveBgJobSsePayload) {
  const key = normalizeChannel(payload.requestId);
  if (!key) return;
  const set = listenersByChannel.get(key);
  if (!set || set.size === 0) return;
  const event: RemoveBgJobEvent = {
    type: "job.created",
    payload: { ...payload, requestId: key },
    at: new Date().toISOString(),
  };
  set.forEach((listener) => {
    try {
      listener(event);
    } catch {}
  });
}

export function publishRemoveBgJobUpdatedPayload(payload: RemoveBgJobSsePayload) {
  return publishRemoveBgJobUpdatedPayloadToChannel(payload.requestId, payload);
}

export function publishRemoveBgJobUpdatedPayloadToChannel(
  channel: string,
  payload: RemoveBgJobSsePayload,
) {
  const key = normalizeChannel(channel);
  if (!key) return;
  const set = listenersByChannel.get(key);
  if (!set || set.size === 0) return;
  const event: RemoveBgJobEvent = {
    type: "job.updated",
    payload: { ...payload },
    at: new Date().toISOString(),
  };
  set.forEach((listener) => {
    try {
      listener(event);
    } catch {}
  });
}
