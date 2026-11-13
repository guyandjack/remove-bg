import { api } from "@/utils/axiosConfig";
import { sessionSignal } from "@/stores/session";

type LogoutCallbacks = {
  onStart?: () => void;
  onFinished?: () => void;
};

function clearClientSessionStorage() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("session");
    localStorage.removeItem("wizpix:last_service");
    localStorage.removeItem("wizpix:account_deletion_feedback");
  } catch {
    // ignore
  }
}

/**
 * Logout côté client.
 * - Sends the HttpOnly access/refresh cookies to `/api/logout`.
 * - Clears only non-sensitive client UI state and legacy storage.
 * - La redirection (route) est gérée par l'appelant (afin d'être cohérent avec les composants existants)
 *
 * The server revokes the refresh-token family; failure is still followed by a
 * local UI cleanup so the browser never displays a stale authenticated state.
 */
async function logoutClient(callbacks?: LogoutCallbacks) {
  callbacks?.onStart?.();

  try {
    await api.post("/api/logout", {});
  } catch {
    // ignore - on veut un logout idempotent côté client
  } finally {
    sessionSignal.value = null;
    clearClientSessionStorage();
    callbacks?.onFinished?.();
  }
}

export { logoutClient };
