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

// In-memory bus, keyed by requestId to avoid broadcasting to all clients.
const listenersByRequestId = new Map<string, Set<Listener>>();

function normalizeRequestId(input: string): string {
  return String(input || "").trim();
}

export function subscribeRemoveBgJobEvents(
  requestId: string,
  listener: Listener,
): () => void {
  const key = normalizeRequestId(requestId);
  if (!key) {
    return () => {};
  }

  const set = listenersByRequestId.get(key) ?? new Set<Listener>();
  set.add(listener);
  listenersByRequestId.set(key, set);

  return () => {
    const current = listenersByRequestId.get(key);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listenersByRequestId.delete(key);
  };
}

export function publishRemoveBgJobUpdated(requestId: string) {
  const key = normalizeRequestId(requestId);
  if (!key) return;
  const set = listenersByRequestId.get(key);
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
  const key = normalizeRequestId(payload.requestId);
  if (!key) return;
  const set = listenersByRequestId.get(key);
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
  const key = normalizeRequestId(payload.requestId);
  if (!key) return;
  const set = listenersByRequestId.get(key);
  if (!set || set.size === 0) return;
  const event: RemoveBgJobEvent = {
    type: "job.updated",
    payload: { ...payload, requestId: key },
    at: new Date().toISOString(),
  };
  set.forEach((listener) => {
    try {
      listener(event);
    } catch {}
  });
}
