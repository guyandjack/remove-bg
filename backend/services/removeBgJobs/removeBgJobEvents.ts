type RemoveBgJobEvent =
  | { type: "job.updated"; requestId: string; at: string }
  | { type: "job.created"; requestId: string; at: string };

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
    requestId: key,
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

export function publishRemoveBgJobCreated(requestId: string) {
  const key = normalizeRequestId(requestId);
  if (!key) return;
  const set = listenersByRequestId.get(key);
  if (!set || set.size === 0) return;
  const event: RemoveBgJobEvent = {
    type: "job.created",
    requestId: key,
    at: new Date().toISOString(),
  };
  set.forEach((listener) => {
    try {
      listener(event);
    } catch {}
  });
}

